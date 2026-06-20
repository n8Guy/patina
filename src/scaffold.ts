import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import yaml from 'js-yaml';
import { render } from './template.js';
import { writeManagedFile, writeSeedFile } from './upgrade.js';
import { tpl } from './template-loader.js';
import { getModule } from './modules/registry.js';
import { writeState, STATE_FILENAME } from './state.js';
import { renderLaunchSection } from './launch-tasks.js';
import { markDemo as markDemoFn } from './demo/mark.js';
import { getPatinaVersion } from './version.js';
import { getAgent } from './agents/registry.js';
import type { ScaffoldOptions, Profile, TemplateVars, AgentId } from './types.js';
// Constants extracted to break circular deps with agents/
export { PREDEFINED_ARCHETYPES } from './scaffold-constants.js';
export type { PredefinedArchetypeSlug } from './scaffold-constants.js';
import { PREDEFINED_ARCHETYPES } from './scaffold-constants.js';

function writeRaw(targetDir: string, relativePath: string, content: string): void {
  const full = join(targetDir, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}

function touch(targetDir: string, relativePath: string): void {
  const full = join(targetDir, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  if (!existsSync(full)) writeFileSync(full, '', 'utf8');
}

export const MANIFEST_REQUIRED_FIELDS = ['name', 'label', 'reflect_hook', 'description', 'commands', 'installed'] as const;

function extractFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const parsed = yaml.load(match[1]);
  if (typeof parsed !== 'object' || parsed === null) return null;
  return parsed as Record<string, unknown>;
}

export function validateManifestFrontmatter(moduleName: string, content: string): void {
  const fm = extractFrontmatter(content);
  if (!fm) throw new Error(`Module "${moduleName}" manifest has missing or unparseable frontmatter`);
  for (const field of MANIFEST_REQUIRED_FIELDS) {
    if (!fm[field]) {
      throw new Error(`Module "${moduleName}" manifest is missing required field "${field}"`);
    }
  }
}

// ── Exported helpers ───────────────────────────────────────────────────────────

/**
 * Build a TemplateVars object from a Profile. Centralizes the mapping so
 * both scaffold() and runUpdate() produce identical vars.
 *
 * Note: LAUNCH_SECTION and UPDATE_CHECK_SECTION are rendered inline here so
 * they appear directly in CLAUDE.md without any separate append step.
 * MODULE_README_BLOCKS is left empty here; callers that need it fill it via
 * baseManagedFiles() which passes a populated MODULE_README_BLOCKS.
 */
export function profileToVars(profile: Profile, liProfileUrl?: string, today?: string): TemplateVars {
  const resolvedToday = today ?? new Date().toISOString().split('T')[0];
  const adapter = getAgent(profile.agent);
  const agentDir = adapter.pathVars.AGENT_DIR;
  const modulesSection = (profile.modules ?? []).length
    ? profile.modules
        .map(id => {
          const def = getModule(id);
          const label = def?.label ?? id;
          return `- [${label} module context](${agentDir}/modules/${id}/CLAUDE.md)`;
        })
        .join('\n')
    : '_No modules installed._';
  // Pass pathVars so {{AGENT_DISPLAY_NAME}} in command descriptions resolves correctly
  const commandsSection = buildCommandsSection(profile.modules ?? [], adapter.pathVars as unknown as TemplateVars);
  const guideCommands = buildGuideCommands(profile.modules ?? [], adapter.pathVars as unknown as TemplateVars);

  const baseVars: TemplateVars = {
    PATINA_NAME: profile.patina_name,
    USER_NAME: profile.name,
    USER_TITLE: profile.title ?? '',
    ROLE_DESCRIPTION: profile.role_description ?? '',
    COMPANY_NAME: profile.work.company_name,
    COMPANY_DESCRIPTION: profile.work.company_description ?? '',
    CONTENT_DIR: profile.content_dir,
    EDITOR: profile.editor,
    LI_PROFILE_URL: liProfileUrl ?? profile.linkedin?.profile_url ?? '',
    TODAY: resolvedToday,
    STALENESS_THRESHOLD: (() => { const d = Number(profile.staleness_threshold_days ?? 30); return String(Number.isFinite(d) && d > 0 ? d : 30); })(),
    MODULES_SECTION: modulesSection,
    COMMANDS_SECTION: commandsSection,
    GUIDE_COMMANDS: guideCommands,
    PATINA_VERSION: getPatinaVersion(),
    LAUNCH_SECTION: '',
    UPDATE_CHECK_SECTION: '',
    MODULE_README_BLOCKS: '',
    // Agent path tokens — resolved before render() so templates stay agent-agnostic
    ...adapter.pathVars,
  };

  // Compute update-check section with vars (needs PATINA_VERSION)
  // Adapter returns null for agents that don't support auto-update hooks (e.g. opencode v1)
  baseVars.UPDATE_CHECK_SECTION = adapter.renderUpdateCheckSection(baseVars) ?? '';

  // Compute launch section (needs CONTENT_DIR etc)
  const rawLaunch = renderLaunchSection(profile.launch_tasks, profile.modules ?? []);
  if (rawLaunch) {
    baseVars.LAUNCH_SECTION = render(rawLaunch, baseVars);
  }

  return baseVars;
}

/**
 * Core slash commands present in every patina, regardless of installed modules.
 * Rendered into the regenerated commands table in CLAUDE.md.
 */
// Keep in sync with baseManagedFiles() in each agent adapter — every base command here
// needs a corresponding entry in the adapter's baseManagedFiles() and baseManagedPaths().
const BASE_COMMANDS: ReadonlyArray<{ name: string; desc: string }> = [
  { name: '/add <description>', desc: 'Add a skill, project, or experience to your graph' },
  { name: '/reflect [slug]', desc: 'Review your graph for gaps, completions, and stale skills — also runs installed module hooks' },
  { name: '/inbox', desc: 'Process files dropped into inbox/ automatically' },
  { name: '/guide', desc: 'Show all available commands with usage examples' },
  { name: '/audience', desc: 'Define who you are speaking to' },
  { name: '/with-audience', desc: 'Talk through your draft as your defined audience' },
];

/**
 * Build the markdown table for the commands section.
 * Pass vars to resolve {{TOKEN}} placeholders in command descriptions (e.g. {{AGENT_DISPLAY_NAME}}).
 */
export function buildCommandsSection(modules: readonly string[], vars?: TemplateVars): string {
  const rows = [
    ...BASE_COMMANDS,
    ...modules.flatMap(id => getModule(id)?.commands ?? []),
  ];
  return [
    '| Command | What it does |',
    '|---------|-------------|',
    ...rows.map(c => `| \`${c.name}\` | ${vars ? render(c.desc, vars) : c.desc} |`),
  ].join('\n');
}

// Structured source-of-truth for core commands.
export const GUIDE_CORE_COMMANDS: ReadonlyArray<{ name: string; desc: string; example?: string }> = [
  { name: '/add <what you did>', desc: 'capture a project, skill, or win', example: '/add Delivered the Orca Studio brand refresh' },
  { name: '/reflect', desc: 'review your notes for skill gaps and stale entries' },
  { name: '/inbox', desc: "process any files you've dropped into `inbox/`" },
  { name: '/status', desc: 'show stale content, inbox, open goals, and pending module setup' },
  { name: '/guide', desc: 'show this command reference any time' },
  { name: '/audience', desc: 'set up who you are writing for' },
  { name: '/with-audience', desc: 'discuss a draft as that audience' },
];

const GUIDE_CORE_LINES: ReadonlyArray<string> = GUIDE_CORE_COMMANDS.map(
  c => `> - \`${c.name}\` — ${c.desc}${c.example ? ` · e.g. \`${c.example}\`` : ''}`
);

/**
 * Build the pre-rendered command-reference block written into guide.md.
 * Pass vars to resolve {{TOKEN}} placeholders in command descriptions (e.g. {{AGENT_DISPLAY_NAME}}).
 */
export function buildGuideCommands(modules: readonly string[], vars?: TemplateVars): string {
  const lines: string[] = [
    '> Here\'s what you can do:',
    ...GUIDE_CORE_LINES,
  ];
  for (const id of modules) {
    const def = getModule(id);
    if (!def?.commands?.length) continue;
    lines.push('>');
    lines.push(`> **${def.label}**`);
    for (const cmd of def.commands) {
      const desc = vars ? render(cmd.desc, vars) : cmd.desc;
      lines.push(`> - \`${cmd.name}\` — ${desc}`);
    }
  }
  return lines.join('\n');
}

// buildRoutingFile is re-exported from scaffold-routing.ts (moved there to break circular deps)
export { buildRoutingFile } from './scaffold-routing.js';


/**
 * Returns [relativePath, content] pairs for the predefined audience archetypes.
 * Pass vars to render template tokens (e.g. {{USER_TITLE}}) — required for on-disk writes.
 * Omit vars to get raw template content (e.g. for path/structure tests).
 * The output paths are agent-specific (e.g. .claude/agents/ or .opencode/agent/).
 * Pass agentId to resolve the correct adapter explicitly; defaults to claude-code.
 */
export function baseManagedArchetypeFiles(vars?: TemplateVars, agentId?: AgentId): Array<[string, string]> {
  const adapter = getAgent(agentId);
  if (!vars) {
    // No vars: return raw content with adapter-specific paths (no token rendering)
    return PREDEFINED_ARCHETYPES.map(a => {
      const srcPath = `.claude/agents/${a.slug}.md`;
      const outPath = adapter.archetypePath(a.slug);
      return [outPath, tpl(srcPath)];
    });
  }
  return adapter.archetypeFiles(vars);
}

export interface BaseManagedFilesOptions {
  vars: TemplateVars;
  editor: string;
  modules?: readonly string[];
  /** Agent id to resolve the adapter. Defaults to claude-code for backward compat. */
  agentId?: AgentId;
}

/**
 * Returns [relativePath, content] pairs for the base managed files.
 * These are all marked (patina: managed) and overwritten on update.
 * Delegates to the appropriate agent adapter by agentId (or falls back to claude-code).
 */
export function baseManagedFiles(opts: BaseManagedFilesOptions): Array<[string, string]> {
  const { vars, editor, modules = [], agentId } = opts;

  // Build module README blocks inline
  const moduleReadmeBlocks = modules
    .map(id => getModule(id)?.readmeBlock?.(vars))
    .filter((b): b is string => !!b)
    .join('\n\n');
  const moduleReadmeBlocksVar = moduleReadmeBlocks || '_No modules installed._';

  // Re-render vars with MODULE_README_BLOCKS filled in
  const fullVars: TemplateVars = { ...vars, MODULE_README_BLOCKS: moduleReadmeBlocksVar };

  // Resolve adapter by explicit agentId — never by sniffing a path string
  const adapter = getAgent(agentId);

  return adapter.baseManagedFiles(fullVars, { editor, modules });
}

/**
 * Returns [relativePath, content] pairs for the managed files of a given module
 * (command files + manifest).
 */
export function moduleManagedFiles(module: string, vars: TemplateVars): Array<[string, string]> {
  return getModule(module)?.managedFiles(vars) ?? [];
}

/**
 * Returns [relativePath, content] pairs for the content-dir files of a given module
 * (files under <contentDir>/<module>/). relativePath is relative to targetDir.
 */
export function moduleContentFiles(module: string, vars: TemplateVars, contentDir: string): Array<[string, string]> {
  return getModule(module)?.contentFiles(vars, contentDir) ?? [];
}

// renderUpdateCheckSection is re-exported from scaffold-routing.ts (moved there to break circular deps)
export { renderUpdateCheckSection } from './scaffold-routing.js';

/**
 * In demo mode, inserts `_demo: true` as the first line inside a leading `---` frontmatter block.
 * Returns content unchanged if no frontmatter is found or demo is false.
 */
export function markDemo(content: string, demo: boolean): string {
  if (!demo) return content;
  return markDemoFn(content);
}

/**
 * Returns true if the relative path is a content-dir file (not a setup file).
 * Used to gate demo stamping so only content files get _demo: true.
 */
function isContentFile(relativePath: string, contentDir: string): boolean {
  return relativePath.startsWith(contentDir + '/') || relativePath.startsWith(contentDir + '\\');
}

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const {
    targetDir, patinaName, userName, title, roleDescription,
    jobDescriptionUrl, work, editor, modules, liProfileUrl, contentDir,
    launchTasks = [],
    selectedArchetypes,
    demo = false,
    today: todayOverride,
    agent,
  } = opts;

  const today = todayOverride ?? new Date().toISOString().split('T')[0];

  // Build a temporary Profile object so we can use profileToVars
  const tempProfile: Profile = {
    patina_name: patinaName,
    name: userName,
    title,
    role_description: roleDescription || undefined,
    job_description_url: jobDescriptionUrl || undefined,
    work,
    editor,
    agent: agent ?? 'claude-code',
    modules,
    content_dir: contentDir,
    created: today,
    ...(launchTasks.length ? { launch_tasks: launchTasks } : {}),
    ...(modules.includes('linkedin') && liProfileUrl ? { linkedin: { profile_url: liProfileUrl } } : {}),
  };

  const vars = profileToVars(tempProfile, liProfileUrl, today);
  const adapter = getAgent(tempProfile.agent);

  mkdirSync(targetDir, { recursive: true });

  // ── Managed files (marked, overwritten on update)
  const managedFiles: Array<[string, string]> = [
    ...baseManagedFiles({ vars, editor, modules, agentId: tempProfile.agent }),
    ...modules.flatMap(m => adapter.mapModuleManagedFiles(m, moduleManagedFiles(m, vars), vars)),
  ];

  const agentDir = adapter.pathVars.AGENT_DIR;
  for (const module of modules) {
    const manifestEntry = managedFiles.find(([p]) => p === `${agentDir}/modules/${module}/manifest.md`);
    if (manifestEntry) validateManifestFrontmatter(module, manifestEntry[1]);
  }

  for (const [relativePath, content] of managedFiles) {
    // Apply _demo: true stamp only to content-dir files with YAML frontmatter
    const fileContent = (demo && isContentFile(relativePath, contentDir) && content.startsWith('---')) ? markDemo(content, demo) : content;
    writeManagedFile(targetDir, relativePath, fileContent);
  }

  // ── Predefined audience archetypes (write only the ones the user selected)
  const archetypeFiles = selectedArchetypes !== undefined
    ? baseManagedArchetypeFiles(vars, tempProfile.agent).filter(([p]) => selectedArchetypes.some(slug => p.endsWith(`/${slug}.md`)))
    : baseManagedArchetypeFiles(vars, tempProfile.agent);
  for (const [relativePath, content] of archetypeFiles) {
    writeManagedFile(targetDir, relativePath, content);
  }

  // ── Seed files (written once if absent, never overwritten)
  writeSeedFile(targetDir, 'CUSTOM.md', tpl('CUSTOM.md'));
  writeSeedFile(targetDir, 'inbox/.gitkeep', '');
  writeSeedFile(targetDir, 'inbox/.processed.json', '[]\n');

  if (editor === 'obsidian') {
    // Written to disk only; .obsidian/ is intentionally gitignored — Obsidian reads it at runtime.
    const obsidianConfig = { attachmentFolderPath: `${contentDir}/attachments` };
    writeSeedFile(targetDir, '.obsidian/app.json', JSON.stringify(obsidianConfig, null, 2) + '\n');
  }

  // ── Content directory (never touched on upgrade)
  const baseDirs = ['notes', 'skills'];
  for (const dir of baseDirs) {
    touch(targetDir, `${contentDir}/${dir}/.gitkeep`);
  }
  writeRaw(targetDir, `${contentDir}/notes/README.md`, markDemo(render(tpl('graph/notes/README.md'), vars), demo));
  writeRaw(targetDir, `${contentDir}/notes/exclusions.md`, markDemo(render(tpl('graph/notes/exclusions.md'), vars), demo));

  for (const module of modules) {
    for (const [relativePath, content] of moduleContentFiles(module, vars, contentDir)) {
      writeRaw(targetDir, relativePath, markDemo(content, demo));
    }
  }

  // ── profile.yaml (clean — no internal state)
  const profileToWrite: Profile = demo ? { ...tempProfile, _demo: true } : tempProfile;
  writeRaw(targetDir, 'profile.yaml', yaml.dump(profileToWrite));

  // ── .patina-state.json (internal state, gitignored)
  writeState(targetDir, {});

  // ── .gitignore
  const audiencePrefsEntry = adapter.audiencePrefsGitignoreEntry();
  writeRaw(targetDir, '.gitignore', `.obsidian/\n.DS_Store\n${STATE_FILENAME}\ninbox/.processed.json\n.patina-update-check\n${audiencePrefsEntry}\n`);
}
