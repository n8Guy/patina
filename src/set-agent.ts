import { existsSync, readFileSync, readdirSync, rmSync, rmdirSync, statSync, writeFileSync, type Dirent } from 'fs';
import { join } from 'path';
import * as p from '@clack/prompts';
import chalk from 'chalk';
import { getAgent } from './agents/registry.js';
import { MODULES } from './modules/registry.js';
import { profileToVars, baseManagedFiles, moduleManagedFiles } from './scaffold.js';
import { PREDEFINED_ARCHETYPES } from './scaffold-constants.js';
import { writeManagedFile, writeSeedFile, isMarkedManaged, isLegacyManaged } from './upgrade.js';
import { writeProfile } from './wizard-shared.js';
import { tpl } from './template-loader.js';
import type { AgentId, Profile } from './types.js';

export interface SetAgentPlan {
  fromAgent: AgentId;
  toAgent: AgentId;
  /** Agent-managed paths under old agent dir that will be deleted (excludes shared paths) */
  toRemove: string[];
  /** New agent files [path, content] to write (excludes shared paths) */
  toAdd: Array<[string, string]>;
  /** User-owned files under old dir that will NOT be deleted */
  kept: string[];
  /**
   * Paths present in both old and new agent output (e.g. README.md, .vscode/settings.json).
   * These are written on apply but not shown in the diff to avoid confusing churn.
   */
  toAddShared: Array<[string, string]>;
}

function getModuleManagedPaths(moduleId: string): readonly string[] {
  return MODULES.find(m => m.id === moduleId)?.managedPaths ?? [];
}

/**
 * Recursively scan a directory and return all file paths relative to cwd.
 */
function scanDirRelative(dir: string, cwd: string): string[] {
  const results: string[] = [];
  function scan(d: string) {
    let entries: Dirent[];
    try { entries = readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue; // skip symlinks to avoid infinite loops
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue; // never patina-managed
        scan(join(d, entry.name));
      } else if (entry.isFile()) {
        const rel = join(d, entry.name).slice(cwd.length + 1).replace(/\\/g, '/');
        results.push(rel);
      }
    }
  }
  scan(dir);
  return results;
}

/**
 * Check if a file would be deleted by removeManagedFileIfManaged without actually deleting it.
 */
function wouldDeleteIfManaged(cwd: string, rel: string): boolean {
  const fullPath = join(cwd, rel);
  if (!existsSync(fullPath)) return false;
  const content = readFileSync(fullPath, 'utf8');
  return isMarkedManaged(rel, content);
}

/**
 * Build a plan for switching from one agent to another.
 * Does not write anything — callers inspect the plan then call applySetAgent.
 * Returns an empty plan when from === target (self-switch guard).
 */
export function planSetAgent(cwd: string, profile: Profile, target: AgentId): SetAgentPlan {
  const fromAgentId: AgentId = profile.agent ?? 'claude-code';
  const fromAdapter = getAgent(fromAgentId);
  const toAdapter = getAgent(target);

  // Self-switch guard: if already on the target agent, return an empty no-op plan
  if (fromAgentId === target) {
    return { fromAgent: fromAgentId, toAgent: target, toRemove: [], toAdd: [], kept: [], toAddShared: [] };
  }

  // Build the full list of managed paths under the old agent
  const canonicalBasePaths = fromAdapter.baseManagedPaths({ editor: profile.editor });
  const canonicalModulePaths = (profile.modules ?? []).flatMap(m =>
    fromAdapter.mapModuleManagedPaths(m, getModuleManagedPaths(m)),
  );
  const archetypePaths = PREDEFINED_ARCHETYPES
    .filter(a => existsSync(join(cwd, fromAdapter.archetypePath(a.slug))))
    .map(a => fromAdapter.archetypePath(a.slug));

  const managedPathsSet = new Set([...canonicalBasePaths, ...canonicalModulePaths, ...archetypePaths]);

  // Files in managedPathsSet are patina-owned by definition (canonical list is the source of
  // truth), so always queue them for removal regardless of whether the marker is present on
  // disk — old patinas pre-date the markers and would otherwise be incorrectly left behind.
  const toRemove: string[] = [];
  const kept: string[] = [];

  for (const rel of managedPathsSet) {
    if (existsSync(join(cwd, rel))) toRemove.push(rel);
  }

  // Scan the agent directory for files NOT in the managed list. Only keep ones that lack the
  // patina marker — those are genuinely user-created files we should not delete.
  const agentDirPath = join(cwd, fromAdapter.pathVars.AGENT_DIR);
  if (existsSync(agentDirPath)) {
    const userFiles = scanDirRelative(agentDirPath, cwd);
    for (const rel of userFiles) {
      if (!managedPathsSet.has(rel) && !wouldDeleteIfManaged(cwd, rel)) {
        kept.push(rel);
      }
    }
  }

  // Build new agent files
  const newProfile: Profile = { ...profile, agent: target };
  const vars = profileToVars(newProfile);

  // Which archetypes were installed under the old agent?
  const installedArchetypeSlugs = PREDEFINED_ARCHETYPES
    .filter(a => existsSync(join(cwd, fromAdapter.archetypePath(a.slug))))
    .map(a => a.slug);

  const toAddRaw: Array<[string, string]> = [
    ...baseManagedFiles({ vars, editor: profile.editor, modules: profile.modules ?? [], agentId: target }),
    ...(profile.modules ?? []).flatMap(m => toAdapter.mapModuleManagedFiles(m, moduleManagedFiles(m, vars), vars)),
    ...toAdapter.archetypeFiles(vars, installedArchetypeSlugs),
  ];

  // Diff dedup: paths emitted by both old and new adapter should not appear as
  // both "- path" and "+ path" in the summary (e.g. README.md, .vscode/settings.json).
  // We still write them on apply, but they're omitted from the visible diff.
  const toRemoveSet = new Set(toRemove);
  const toAddPaths = new Set(toAddRaw.map(([p]) => p));
  const sharedPaths = new Set([...toRemoveSet].filter(p => toAddPaths.has(p)));
  const toRemoveDeduped = toRemove.filter(p => !sharedPaths.has(p));
  const toAdd: Array<[string, string]> = toAddRaw.filter(([p]) => !sharedPaths.has(p));
  // Shared paths are still written on apply (they're in toAddRaw). We move them to
  // a separate field so applySetAgent can write them without showing them in the diff.
  const toAddShared: Array<[string, string]> = toAddRaw.filter(([p]) => sharedPaths.has(p));

  return { fromAgent: fromAgentId, toAgent: target, toRemove: toRemoveDeduped, toAdd, kept, toAddShared };
}

export interface SetAgentResult {
  profile: Profile;
  removed: string[];
  added: string[];
  kept: string[];
}

/**
 * Apply a set-agent plan: remove old files, write new files, update profile.yaml.
 */
export function applySetAgent(
  cwd: string,
  profile: Profile,
  plan: SetAgentPlan,
): SetAgentResult {
  const removed: string[] = [];
  const added: string[] = [];

  // Remove old managed files. toRemove is the canonical managed paths list, so delete
  // unconditionally — marker-based checks are not used here because legacy files pre-date
  // the markers and should still be cleaned up on an explicit agent switch.
  for (const rel of plan.toRemove) {
    const fullPath = join(cwd, rel);
    if (existsSync(fullPath)) {
      rmSync(fullPath);
      removed.push(rel);
    }
  }

  // Prune now-empty agent directories
  pruneEmptyAgentDirs(cwd, plan.fromAgent);

  // Write new agent files (visible diff entries)
  for (const [rel, content] of plan.toAdd) {
    const result = writeManagedFile(cwd, rel, content);
    if (result.outcome !== 'skipped') added.push(rel);
  }

  // Write shared-path files (same path in both agents; re-render content for new agent).
  // README.md is always force-written: it references agent-specific variables (e.g.
  // AGENT_MEMORY_FILE) and must be current after a switch regardless of marker presence.
  for (const [rel, content] of plan.toAddShared) {
    if (rel === 'README.md') {
      writeFileSync(join(cwd, rel), content, 'utf8');
    } else {
      writeManagedFile(cwd, rel, content);
    }
  }

  // Seed CUSTOM.md if absent — only created on initial scaffold; switching agents should
  // also ensure it exists so the memory file's reference to it is not broken.
  writeSeedFile(cwd, 'CUSTOM.md', tpl('CUSTOM.md'));

  // Update profile
  const newProfile: Profile = { ...profile, agent: plan.toAgent };
  writeProfile(cwd, newProfile);

  // Update .gitignore entry
  updateGitignoreForAgent(cwd, plan.fromAgent, plan.toAgent);

  return { profile: newProfile, removed, added, kept: plan.kept };
}

function pruneEmptyAgentDirs(cwd: string, agentId: AgentId): void {
  const adapter = getAgent(agentId);
  const agentDir = join(cwd, adapter.pathVars.AGENT_DIR);
  if (!existsSync(agentDir)) return;
  pruneEmptyDirsRecursive(agentDir);
}

function pruneEmptyDirsRecursive(dir: string): boolean {
  if (!existsSync(dir)) return true;
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return false;
  }
  let allGone = true;
  for (const entry of entries) {
    const full = join(dir, entry);
    try {
      const stat = statSync(full);
      if (stat.isDirectory()) {
        const childEmpty = pruneEmptyDirsRecursive(full);
        if (!childEmpty) allGone = false;
      } else {
        allGone = false;
      }
    } catch {
      allGone = false;
    }
  }
  if (allGone) {
    try { rmdirSync(dir); } catch { /* ignore */ }
    return true;
  }
  return false;
}

function updateGitignoreForAgent(cwd: string, fromAgent: AgentId, toAgent: AgentId): void {
  const fromAdapter = getAgent(fromAgent);
  const toAdapter = getAgent(toAgent);
  const gitignorePath = join(cwd, '.gitignore');
  if (!existsSync(gitignorePath)) return;
  let content = readFileSync(gitignorePath, 'utf8');
  const oldEntry = fromAdapter.audiencePrefsGitignoreEntry();
  const newEntry = toAdapter.audiencePrefsGitignoreEntry();
  if (content.includes(oldEntry) && !content.includes(newEntry)) {
    content = content.split(oldEntry).join(newEntry);
    writeFileSync(gitignorePath, content, 'utf8');
  }
}

/**
 * Print a human-readable diff summary of a set-agent plan.
 * Shared between CLI (cli.ts) and wizard (wizard-update.ts) so output is identical.
 */
export function printSetAgentDiff(plan: SetAgentPlan): void {
  const fromAdapter = getAgent(plan.fromAgent);
  const toAdapter = getAgent(plan.toAgent);
  console.log('');
  console.log(chalk.bold(`Switching from ${fromAdapter.displayName} to ${toAdapter.displayName}:`));
  console.log('');

  if (plan.toRemove.length > 0) {
    console.log(chalk.red(`  - ${plan.toRemove.length} files from ${fromAdapter.pathVars.AGENT_DIR}/`));
  }
  if (plan.toAdd.length > 0) {
    console.log(chalk.green(`  + ${plan.toAdd.length} files to ${toAdapter.pathVars.AGENT_DIR}/`));
  }
  if (plan.kept.length > 0) {
    console.log('');
    console.log(chalk.dim(`  (kept, user-owned: ${plan.kept.join(', ')})`));
  }
  console.log('');
}

/**
 * Confirm with the user and apply a set-agent plan.
 * Returns the result of applySetAgent, or null if the user aborted.
 * Shared between CLI and wizard for identical UX.
 */
export async function confirmAndApplySetAgent(
  cwd: string,
  profile: Profile,
  plan: SetAgentPlan,
): Promise<SetAgentResult | null> {
  const proceed = await p.confirm({
    message: 'Apply? Your graph/ content will not be touched.',
  });
  if (p.isCancel(proceed) || !proceed) {
    return null;
  }

  const result = applySetAgent(cwd, profile, plan);
  const toAdapter = getAgent(plan.toAgent);

  const parts: string[] = [];
  if (result.removed.length > 0) parts.push(`removed ${result.removed.length}`);
  if (result.added.length > 0) parts.push(`added ${result.added.length}`);
  console.log('');
  if (parts.length > 0) console.log(chalk.hex('#94A3B8')(parts.join(', ') + '.'));
  if (result.kept.length > 0) {
    console.log(chalk.dim(`Kept (user-owned): ${result.kept.join(', ')}`));
  }
  console.log(chalk.green(`\nSwitched to ${toAdapter.displayName}.`));

  return result;
}
