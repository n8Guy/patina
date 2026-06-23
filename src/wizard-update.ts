import * as p from '@clack/prompts';
import chalk from 'chalk';
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { loadProfile } from './detect.js';
import { label } from './wizard-brand.js';
import { MULTISELECT_HINT, OPTIONAL_HINT, onCancel, writeProfile, removeManagedFileIfManaged, promptLaunchTasks, GUIDE_HINT_LOG, snoozeUntilFor } from './wizard-shared.js';
import { applyModuleChanges, runUpdateModules } from './wizard-modules.js';
import { profileToVars, baseManagedFiles, moduleManagedFiles, baseManagedArchetypeFiles, PREDEFINED_ARCHETYPES, GUIDE_CORE_COMMANDS } from './scaffold.js';
import { getAgent, AGENTS } from './agents/registry.js';
import { planSetAgent, printSetAgentDiff, confirmAndApplySetAgent } from './set-agent.js';
import { writeManagedFile, isMarkedManaged, isLegacyManaged } from './upgrade.js';
import { readState, writeState, stripLegacyChecksums } from './state.js';
import { offerBackup, backupOfferKind } from './wizard-backup.js';
import { detectCorruption, formatHealthReport, repairCorruption, type HealthReport } from './health.js';
import { availableLaunchTasks, pruneLaunchTasks } from './launch-tasks.js';
import { validate, formatReport } from './validate.js';
import { getModule } from './modules/registry.js';
import type { Profile, AgentId } from './types.js';

export { writeProfile, removeManagedFileIfManaged as removeManagedFileIfUnmodified };

/**
 * Remove or prune the legacy mcp-obsidian .mcp.json left by older patina versions.
 * - Patina-owned file with only obsidian server → delete the file.
 * - Patina-owned file with other servers too → remove the obsidian entry and
 *   drop the _patina markers so the file becomes user-owned.
 * - User-owned (no _patina marker) → leave untouched.
 *
 * Exported for testing.
 */
export function cleanupObsidianMcpJson(cwd: string, updated: string[]): void {
  const mcpPath = join(cwd, '.mcp.json');
  if (!existsSync(mcpPath)) return;

  const content = readFileSync(mcpPath, 'utf8');
  if (!isMarkedManaged('.mcp.json', content)) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content) as Record<string, unknown>;
  } catch {
    return;
  }

  const servers = (parsed.mcpServers ?? {}) as Record<string, unknown>;
  const otherServers = Object.keys(servers).filter(k => k !== 'obsidian');

  if (otherServers.length === 0) {
    unlinkSync(mcpPath);
  } else {
    // Remove the obsidian entry and patina ownership markers, leave the rest
    const { _patina, _patina_note, ...rest } = parsed as Record<string, unknown> & { _patina?: unknown; _patina_note?: unknown };
    void _patina; void _patina_note;
    const { obsidian: _obs, ...remainingServers } = servers as Record<string, unknown> & { obsidian?: unknown };
    void _obs;
    const pruned = { ...rest, mcpServers: remainingServers };
    writeFileSync(mcpPath, JSON.stringify(pruned, null, 2) + '\n', 'utf8');
  }
  updated.push('.mcp.json');
}

/**
 * Idempotently append a line to .gitignore if it isn't already present.
 * Exported for testing.
 */
export function ensureGitignoreEntry(cwd: string, entry: string, updated: string[]): void {
  const gitignorePath = join(cwd, '.gitignore');
  if (!existsSync(gitignorePath)) return;
  const content = readFileSync(gitignorePath, 'utf8');
  const lines = content.split('\n');
  if (lines.some(l => l.trim() === entry)) return;
  writeFileSync(gitignorePath, content.endsWith('\n') ? content + entry + '\n' : content + '\n' + entry + '\n', 'utf8');
  updated.push('.gitignore');
}

// ─── Branch A: Update personal info ──────────────────────────────────────────

export interface ProfileFields {
  name: string;
  title: string;
  roleDescription: string;
  jobDescriptionUrl: string;
  selfEmployed: boolean;
  companyName: string;
  website: string;
  companyDescription: string;
}

export interface ProfileUpdateResult {
  profile: Profile;
  updated: string[];
  skipped: string[];
}

export function applyProfileUpdate(
  cwd: string,
  profile: Profile,
  fields: ProfileFields,
): ProfileUpdateResult {
  const updatedProfile: Profile = {
    ...profile,
    name: fields.name.trim(),
    title: fields.title.trim(),
    role_description: fields.roleDescription.trim() || undefined,
    job_description_url: fields.jobDescriptionUrl.trim() || undefined,
    work: {
      self_employed: fields.selfEmployed,
      company_name: fields.companyName.trim() || (fields.selfEmployed ? 'Freelance' : ''),
      website: fields.website.trim() || undefined,
      company_description: fields.companyDescription.trim() || undefined,
    },
  };

  const vars = profileToVars(updatedProfile);
  const existingState = readState(cwd);
  const profileAdapter = getAgent(updatedProfile.agent);

  const files = [
    ...baseManagedFiles({ vars, editor: updatedProfile.editor, modules: updatedProfile.modules ?? [], agentId: updatedProfile.agent }),
    ...(updatedProfile.modules ?? []).flatMap(m => profileAdapter.mapModuleManagedFiles(m, moduleManagedFiles(m, vars), vars)),
  ];

  const updated: string[] = [];
  const skipped: string[] = [];

  for (const [rel, content] of files) {
    const result = writeManagedFile(cwd, rel, content);
    if (result.outcome === 'skipped') {
      skipped.push(rel);
    } else {
      updated.push(rel);
    }
  }

  // Remove editor-specific files that no longer apply after an editor change
  if (updatedProfile.editor !== 'vscode') {
    const vscodePath = join(cwd, '.vscode/settings.json');
    if (existsSync(vscodePath)) {
      const content = readFileSync(vscodePath, 'utf8');
      if (isMarkedManaged('.vscode/settings.json', content)) {
        const outcome = removeManagedFileIfManaged(cwd, '.vscode/settings.json');
        if (outcome === 'deleted') updated.push('.vscode/settings.json');
      }
    }
  }

  // Remove or prune the legacy mcp-obsidian .mcp.json (no longer emitted by scaffold)
  cleanupObsidianMcpJson(cwd, updated);

  writeState(cwd, { deferred_modules: existingState.deferred_modules, update_check: existingState.update_check, backup_offer: existingState.backup_offer });
  const profileToWrite = stripLegacyChecksums(updatedProfile);
  writeProfile(cwd, profileToWrite);
  return { profile: profileToWrite, updated, skipped };
}

async function runUpdateProfile(cwd: string, profile: Profile): Promise<void> {
  console.log('');
  console.log(`  ${label('Update personal info')}`);
  console.log(`  ${chalk.hex('#64748B')('Press enter to keep the current value.')}`);

  const identity = await p.group(
    {
      name: () =>
        p.text({
          message: "What's your name?",
          initialValue: profile.name,
          validate: (v) => (!v || !v.trim() ? 'Name is required.' : undefined),
        }),

      title: () =>
        p.text({
          message: `What's your professional title?${OPTIONAL_HINT}`,
          initialValue: profile.title ?? '',
        }),

      roleDescription: () =>
        p.text({
          message: `Describe what you do — in your own words, not your title.${OPTIONAL_HINT}`,
          initialValue: profile.role_description ?? '',
        }),

      jobDescriptionUrl: () =>
        p.text({
          message: `Got a link to a job description or role overview?${OPTIONAL_HINT}`,
          initialValue: profile.job_description_url ?? '',
        }),
    },
    { onCancel }
  );

  // ── Work
  console.log('');
  console.log(`  ${label('Where you work')}`);

  const selfEmployed = await p.confirm({
    message: 'Are you self-employed or freelance?',
    initialValue: profile.work?.self_employed ?? false,
    hint: chalk.hex('#64748B')('↑/↓ arrow keys · y or n · enter to confirm'),
  });
  if (p.isCancel(selfEmployed)) onCancel();

  const companyLabel = selfEmployed
    ? "What's your company called?"
    : 'Where do you work?';

  const work = await p.group(
    {
      companyName: () =>
        p.text({
          message: companyLabel,
          initialValue: profile.work?.company_name ?? '',
        }),

      website: () =>
        p.text({
          message: `${selfEmployed ? 'Company website?' : 'Their website?'}${OPTIONAL_HINT}`,
          initialValue: profile.work?.website ?? '',
        }),

      companyDescription: () =>
        p.text({
          message: `${selfEmployed ? 'What does your company do?' : 'What does the company do?'}${OPTIONAL_HINT}`,
          initialValue: profile.work?.company_description ?? '',
        }),
    },
    { onCancel }
  );

  const fields: ProfileFields = {
    name: identity.name,
    title: identity.title ?? '',
    roleDescription: identity.roleDescription ?? '',
    jobDescriptionUrl: identity.jobDescriptionUrl ?? '',
    selfEmployed: selfEmployed as boolean,
    companyName: work.companyName ?? '',
    website: work.website ?? '',
    companyDescription: work.companyDescription ?? '',
  };

  const { updated, skipped } = applyProfileUpdate(cwd, profile, fields);

  const summaryLines: string[] = [];
  if (updated.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Updated: ${updated.join(', ')}`));
  }
  if (skipped.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Kept (your own files): ${skipped.join(', ')}`));
  }

  p.note(summaryLines.join('\n'), label('Done'));
  p.outro(chalk.hex('#94A3B8')('Profile updated.'));
}

// ─── Branch C: Set up launch tasks ──────────────────────────────────────────

export interface LaunchTaskUpdateResult {
  profile: Profile;
  updated: string[];
  skipped: string[];
}

export function applyLaunchTaskUpdate(
  cwd: string,
  profile: Profile,
  launchTasks: string[],
): LaunchTaskUpdateResult {
  const updatedProfile: Profile = {
    ...profile,
    launch_tasks: launchTasks.length ? launchTasks : undefined,
  };

  const vars = profileToVars(updatedProfile);
  const existingState = readState(cwd);

  // Re-render all base managed files (CLAUDE.md now contains launch section inline)
  const files = baseManagedFiles({ vars, editor: updatedProfile.editor, modules: updatedProfile.modules ?? [], agentId: updatedProfile.agent });

  const updated: string[] = [];
  const skipped: string[] = [];

  for (const [rel, content] of files) {
    const result = writeManagedFile(cwd, rel, content);
    if (result.outcome === 'skipped') {
      skipped.push(rel);
    } else {
      updated.push(rel);
    }
  }

  writeState(cwd, { deferred_modules: existingState.deferred_modules, update_check: existingState.update_check, backup_offer: existingState.backup_offer });
  const profileToWrite = stripLegacyChecksums(updatedProfile);
  writeProfile(cwd, profileToWrite);
  return { profile: profileToWrite, updated, skipped };
}

async function runUpdateLaunchTasks(cwd: string, profile: Profile): Promise<void> {
  const avail = availableLaunchTasks(profile.modules ?? []);
  const initial = pruneLaunchTasks(profile.launch_tasks, profile.modules ?? []);

  const selected = await promptLaunchTasks(avail, initial);
  const { updated, skipped } = applyLaunchTaskUpdate(cwd, profile, selected);

  const summaryLines: string[] = [];
  if (updated.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Updated: ${updated.join(', ')}`));
  }
  if (skipped.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Kept (your own files): ${skipped.join(', ')}`));
  }

  p.note(summaryLines.join('\n') || 'No changes.', label('Done'));
  p.outro(chalk.hex('#94A3B8')('Launch tasks updated.'));
}

// ─── Branch D: Audience archetypes ───────────────────────────────────────────

async function runUpdateAudiences(cwd: string, profile: Profile): Promise<void> {
  console.log('');
  console.log(`  ${label('Your audience')}`);
  console.log(`  ${chalk.hex('#64748B')('Patina can show you how your content lands before you share it — whether that\'s')}`);
  console.log(`  ${chalk.hex('#64748B')('a post, an email, or a resume. Manage which built-in personas are installed below.')}`);
  console.log(`  ${chalk.hex('#64748B')('User-created personas (added via /audience) are never affected here.')}`);

  const vars = profileToVars(profile);
  const adapter = getAgent(profile.agent);
  const archetypeFiles = baseManagedArchetypeFiles(vars, profile.agent);

  const initialValues: string[] = PREDEFINED_ARCHETYPES
    .filter(a => existsSync(join(cwd, adapter.archetypePath(a.slug))))
    .map(a => a.slug);

  const selected = await p.multiselect<string>({
    message: `Who do you communicate with?${MULTISELECT_HINT}`,
    options: PREDEFINED_ARCHETYPES.map(a => ({
      value: a.slug,
      label: a.name,
      hint: chalk.hex('#64748B')(a.hint),
    })),
    initialValues,
    required: false,
  });
  if (p.isCancel(selected)) {
    p.cancel(chalk.hex('#94A3B8')('No changes made.'));
    return;
  }

  const added: string[] = [];
  const removed: string[] = [];

  for (const [rel, content] of archetypeFiles) {
    const slug = rel.replace(/.*\//, '').replace('.md', '');
    if (selected.includes(slug)) {
      const result = writeManagedFile(cwd, rel, content);
      if (result.outcome === 'added' || result.outcome === 'updated') added.push(slug);
    } else {
      const outcome = removeManagedFileIfManaged(cwd, rel);
      if (outcome === 'deleted' && initialValues.includes(slug)) removed.push(slug);
    }
  }

  const summaryLines: string[] = [];
  if (added.length > 0) summaryLines.push(chalk.hex('#94A3B8')(`Installed: ${added.join(', ')}`));
  if (removed.length > 0) summaryLines.push(chalk.hex('#94A3B8')(`Removed: ${removed.join(', ')}`));

  p.note(summaryLines.join('\n') || 'No changes.', label('Done'));
  p.outro(chalk.hex('#94A3B8')('Audience archetypes updated.'));
}

// ─── Validate ────────────────────────────────────────────────────────────────

async function runValidate(cwd: string, profile: Profile): Promise<void> {
  const result = validate(cwd, profile);
  const report = formatReport(result);
  p.note(report, label('Health check'));

  // Note: 'managed-file-placeholders' is the only auto-repairable check type,
  // so this branch specifically handles that case.
  const hasPlaceholders = !result.ok && result.issues.some(i => i.check === 'managed-file-placeholders');
  if (hasPlaceholders) {
    const shouldRepair = await p.confirm({
      message: 'Repair placeholder issues now?',
    });
    if (!p.isCancel(shouldRepair) && shouldRepair) {
      try {
        const { repairedFiles } = await repairCorruption(cwd, profile, { dryRun: false });
        if (repairedFiles.length > 0) {
          p.log.success(`Repaired: ${repairedFiles.join(', ')}`);
        } else {
          p.log.info('Nothing to repair.');
        }
      } catch (err) {
        p.log.error(`Repair failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (result.ok) {
    p.outro(chalk.green('All good.'));
  } else {
    p.outro(chalk.red('Issues found — see above.'));
  }
}

// ─── Deferred module prompting ────────────────────────────────────────────────

/**
 * For any deferred module whose snooze date has passed, prompt the user to act:
 * set it up now, snooze again, or mark it done. Updates state on disk after each choice.
 */
export async function handleDeferredModules(cwd: string, profile: Profile): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const state = readState(cwd);
  const due = (state.deferred_modules ?? []).filter(e => e.snooze_until <= today);
  if (due.length === 0) return;

  for (const entry of due) {
    const module = getModule(entry.module);
    const moduleName = module?.label ?? entry.module;

    p.note(
      chalk.hex('#94A3B8')(`You deferred setup for this module. It's ready when you are.`),
      label(`${moduleName} setup pending`),
    );

    const choice = await p.select({
      message: `What would you like to do with ${moduleName}?`,
      options: [
        { value: 'now', label: 'Set it up now' },
        { value: 'snooze', label: 'Remind me later' },
        { value: 'done', label: "Already done — stop reminding me" },
      ],
    });

    if (p.isCancel(choice)) {
      p.cancel(chalk.hex('#94A3B8')('Stopped early — any earlier changes were saved.'));
      process.exit(0);
    }

    const currentState = readState(cwd);

    if (choice === 'done') {
      writeState(cwd, {
        ...currentState,
        deferred_modules: (currentState.deferred_modules ?? []).filter(e => e.module !== entry.module),
      });
      p.log.success(`${moduleName} marked as done.`);

    } else if (choice === 'snooze') {
      const snoozeChoice = await p.select({
        message: 'Remind me in:',
        options: [
          { value: '1w', label: '1 week' },
          { value: '1m', label: '1 month' },
          { value: '3m', label: '3 months' },
        ],
      });
      if (p.isCancel(snoozeChoice)) {
        p.cancel(chalk.hex('#94A3B8')('Stopped early — any earlier changes were saved.'));
        process.exit(0);
      }
      const newSnooze = snoozeUntilFor(snoozeChoice as '1w' | '1m' | '3m');
      const without = (currentState.deferred_modules ?? []).filter(e => e.module !== entry.module);
      writeState(cwd, {
        ...currentState,
        deferred_modules: [...without, { module: entry.module, snooze_until: newSnooze }],
      });
      p.log.info(`${moduleName} snoozed until ${newSnooze}.`);

    } else if (choice === 'now') {
      if (module?.promptsOnAdd) {
        const inputs = await module.promptsOnAdd();
        if (module.onAdd) {
          const updatedProfile = module.onAdd(profile, inputs);
          writeProfile(cwd, updatedProfile);
          profile = updatedProfile;
        }
      }
      writeState(cwd, {
        ...currentState,
        deferred_modules: (currentState.deferred_modules ?? []).filter(e => e.module !== entry.module),
      });
      p.log.success(`${moduleName} is set up. Use the module commands in your next session.`);
    }
  }
}

// ─── Update orchestrator ──────────────────────────────────────────────────────

/**
 * Sync base managed files to the patina directory without changing the profile.
 * Runs at the top of every update wizard invocation so new template files land
 * even when the user makes no profile changes.
 */
export function syncBaseFiles(cwd: string, profile: Profile): { healthReport: HealthReport; repairedFiles: string[]; restoredFiles: string[] } {
  const existingState = readState(cwd);
  const vars = profileToVars(profile);

  const healthReport = detectCorruption(cwd, profile);
  const repairedFiles: string[] = [];
  const restoredFiles: string[] = [];

  try {
    const baseEntries = baseManagedFiles({ vars, editor: profile.editor, modules: profile.modules ?? [], agentId: profile.agent });
    for (const [rel, content] of baseEntries) {
      const result = writeManagedFile(cwd, rel, content);
      if (healthReport.corruptFiles.has(rel) && result.outcome !== 'skipped') {
        repairedFiles.push(rel);
      }
    }

    // Legacy repair: README.md written before the `patina: managed` frontmatter was introduced
    // has no ownership marker, so writeManagedFile treats it as user-owned and skips it. If it
    // still contains the stale "No modules installed" placeholder but modules are now installed,
    // force-write the current content so module blocks land correctly.
    if ((profile.modules ?? []).length > 0) {
      const readmeRel = 'README.md';
      const readmePath = join(cwd, readmeRel);
      if (existsSync(readmePath)) {
        const existing = readFileSync(readmePath, 'utf8');
        if (!isMarkedManaged(readmeRel, existing) && !isLegacyManaged(existing) && existing.includes('_No modules installed._')) {
          const readmeEntry = baseEntries.find(([rel]) => rel === readmeRel);
          if (readmeEntry) {
            writeFileSync(readmePath, readmeEntry[1], 'utf8');
            restoredFiles.push(readmeRel);
          }
        }
      }
    }

    const syncAdapter = getAgent(profile.agent);
    for (const module of profile.modules ?? []) {
      const moduleFiles = syncAdapter.mapModuleManagedFiles(module, moduleManagedFiles(module, vars), vars);
      for (const [rel, content] of moduleFiles) {
        const result = writeManagedFile(cwd, rel, content);
        if (healthReport.corruptFiles.has(rel) && result.outcome !== 'skipped') {
          repairedFiles.push(rel);
        } else if (result.outcome === 'added' || result.outcome === 'updated') {
          restoredFiles.push(rel);
        }
      }
    }
    // ── Predefined audience archetypes (skipIfAbsent: refresh installed ones, don't force-add)
    for (const [rel, content] of baseManagedArchetypeFiles(vars, profile.agent)) {
      const result = writeManagedFile(cwd, rel, content, { skipIfAbsent: true });
      if (result.outcome === 'updated') {
        restoredFiles.push(rel);
      }
    }
  } catch (err) {
    p.log.warn(`Failed to sync patina files — some templates may be out of date. Run again to retry. (${err instanceof Error ? err.message : String(err)})`);
    return { healthReport, repairedFiles: [], restoredFiles: [] };
  }

  // Clean up the legacy mcp-obsidian .mcp.json on every update path
  cleanupObsidianMcpJson(cwd, []);
  // Ensure audience-prefs.json is gitignored (added in 1.7.x; backfill for existing installs)
  const agentAdapterForGitignore = getAgent(profile.agent);
  ensureGitignoreEntry(cwd, agentAdapterForGitignore.audiencePrefsGitignoreEntry(), []);

  try {
    writeState(cwd, { deferred_modules: existingState.deferred_modules, update_check: existingState.update_check, backup_offer: existingState.backup_offer });
  } catch (err) {
    p.log.warn(`Patina files updated but state not saved — run again to retry. (${err instanceof Error ? err.message : String(err)})`);
  }
  return { healthReport, repairedFiles, restoredFiles };
}

// ─── Branch E: Switch AI assistant ───────────────────────────────────────────

async function runUpdateAgent(cwd: string, profile: Profile): Promise<void> {
  const currentAgentId = profile.agent ?? 'claude-code';
  const currentAdapter = getAgent(currentAgentId);

  const otherAgents = AGENTS.filter(a => a.agentId !== currentAgentId);
  if (otherAgents.length === 0) {
    p.note(chalk.hex('#64748B')('No other assistants are available to switch to.'), label('Switch assistant'));
    return;
  }

  const target = await p.select({
    message: `Switch from ${currentAdapter.displayName} to:`,
    options: otherAgents.map(a => ({
      value: a.agentId,
      label: a.displayName,
    })),
  });

  if (p.isCancel(target)) {
    p.cancel(chalk.hex('#94A3B8')('No changes made.'));
    return;
  }

  const plan = planSetAgent(cwd, profile, target as AgentId);
  printSetAgentDiff(plan);

  const result = await confirmAndApplySetAgent(cwd, profile, plan);
  if (result === null) {
    p.cancel(chalk.hex('#94A3B8')('No changes made.'));
    return;
  }

  p.outro(chalk.hex('#94A3B8')('Assistant switched.'));
}

export async function runUpdate(cwd: string): Promise<void> {
  const profile = loadProfile(cwd);
  p.intro(chalk.hex('#94A3B8')(`Found: ${chalk.bold.white(profile.patina_name || 'patina')}`));

  const { healthReport, repairedFiles, restoredFiles } = syncBaseFiles(cwd, profile);

  if (repairedFiles.length > 0) {
    const noteLines = [
      chalk.hex('#94A3B8')(`Repaired: ${repairedFiles.join(', ')}`),
      chalk.hex('#94A3B8')('Your notes and settings in graph/ were not changed.'),
    ];
    p.note(noteLines.join('\n'), label('Corruption repaired'));
  }

  if (restoredFiles.length > 0) {
    p.note(
      chalk.hex('#94A3B8')(`Synced: ${restoredFiles.join(', ')}`),
      label('Files synced'),
    );
  }

  p.note(
    [
      `${chalk.hex('#64748B')('Name:')}         ${profile.name}`,
      `${chalk.hex('#64748B')('Title:')}        ${profile.title || '—'}`,
      `${chalk.hex('#64748B')('Company:')}      ${profile.work?.company_name || '—'}`,
      `${chalk.hex('#64748B')('Modules:')}      ${profile.modules?.join(', ') || 'none'}`,
      `${chalk.hex('#64748B')('Launch tasks:')} ${profile.launch_tasks?.length ?? 0}`,
    ].join('\n'),
    label('Current profile')
  );

  const existingStateForBackup = readState(cwd);
  if (!existingStateForBackup.backup_offer) {
    const kind = backupOfferKind(cwd);
    if (kind === 'offer') {
      const backupOutcome = await offerBackup(cwd);
      const nowState = readState(cwd);
      writeState(cwd, {
        deferred_modules: nowState.deferred_modules,
        update_check: nowState.update_check,
        backup_offer: { offered_at: new Date().toISOString(), outcome: backupOutcome },
      });
    } else if (kind === 'already-tracked') {
      // Record silently so we don't re-evaluate on every update run
      writeState(cwd, {
        deferred_modules: existingStateForBackup.deferred_modules,
        update_check: existingStateForBackup.update_check,
        backup_offer: { offered_at: new Date().toISOString(), outcome: 'already-tracked' },
      });
    }
  }

  await handleDeferredModules(cwd, profile);

  const currentAgent = getAgent(profile.agent);
  const action = await p.select({
    message: 'What do you want to do?',
    options: [
      { value: 'profile', label: 'Update personal info' },
      { value: 'modules', label: 'Add or remove modules' },
      { value: 'audiences', label: 'Manage audience personas', hint: chalk.hex('#64748B')('choose which built-in personas are installed') },
      { value: 'launch-tasks', label: 'Set up launch tasks', hint: chalk.hex('#64748B')(`tasks ${currentAgent.displayName} runs every session`) },
      { value: 'switch-agent', label: 'Switch your AI assistant', hint: chalk.hex('#64748B')(`currently ${currentAgent.displayName} — switch to another assistant`) },
      { value: 'backup', label: 'Back up your notes', hint: chalk.hex('#64748B')('version history — recover anything you delete') },
      { value: 'validate', label: 'Run health check', hint: chalk.hex('#64748B')('check for broken links and excluded items') },
      { value: 'nothing', label: 'Nothing — just checking' },
    ],
  });

  if (p.isCancel(action)) {
    p.cancel(chalk.hex('#94A3B8')('No changes made.'));
    return;
  }

  if (action === 'nothing') {
    const coreLines = GUIDE_CORE_COMMANDS
      .map(c => chalk.bold.white(`  ${c.name.split(' ')[0]}`) + chalk.hex('#94A3B8')(` — ${c.desc}`))
      .join('\n');
    const agentCli = getAgent(profile.agent).cliCommand;
    p.note(
      chalk.hex('#94A3B8')('Run ') + chalk.bold.white(agentCli) + chalk.hex('#94A3B8')(' to start your session, then try:') + '\n' + coreLines,
      label('In your session')
    );
    p.outro(chalk.hex('#94A3B8')('No changes made.'));
    return;
  } else if (action === 'profile') {
    await runUpdateProfile(cwd, profile);
  } else if (action === 'modules') {
    await runUpdateModules(cwd, profile);
  } else if (action === 'audiences') {
    await runUpdateAudiences(cwd, profile);
  } else if (action === 'launch-tasks') {
    await runUpdateLaunchTasks(cwd, profile);
  } else if (action === 'switch-agent') {
    await runUpdateAgent(cwd, profile);
    return;
  } else if (action === 'backup') {
    const backupOutcome = await offerBackup(cwd);
    const nowState = readState(cwd);
    writeState(cwd, {
      deferred_modules: nowState.deferred_modules,
      update_check: nowState.update_check,
      backup_offer: { offered_at: new Date().toISOString(), outcome: backupOutcome },
    });
  } else if (action === 'validate') {
    await runValidate(cwd, profile);
    return;
  }

  p.log.info(GUIDE_HINT_LOG);
}
