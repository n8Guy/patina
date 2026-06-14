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
import type { ScaffoldOptions, Profile, TemplateVars } from './types.js';

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
  const modulesSection = (profile.modules ?? []).length
    ? profile.modules
        .map(id => {
          const def = getModule(id);
          const label = def?.label ?? id;
          return `- [${label} module context](.claude/modules/${id}/CLAUDE.md)`;
        })
        .join('\n')
    : '_No modules installed._';
  const commandsSection = buildCommandsSection(profile.modules ?? []);
  const guideCommands = buildGuideCommands(profile.modules ?? []);

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
  };

  // Compute update-check section with vars (needs PATINA_VERSION)
  baseVars.UPDATE_CHECK_SECTION = renderUpdateCheckSection(baseVars);

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
// Keep in sync with MANAGED_FILES in checksums.ts — every base command here needs
// a corresponding entry there and in baseManagedFiles() below.
const BASE_COMMANDS: ReadonlyArray<{ name: string; desc: string }> = [
  { name: '/add <description>', desc: 'Add a skill, project, or experience to your graph' },
  { name: '/reflect [slug]', desc: 'Review your graph for gaps, completions, and stale skills — also runs installed module hooks' },
  { name: '/inbox', desc: 'Process files dropped into inbox/ automatically' },
  { name: '/guide', desc: 'Show all available commands with usage examples' },
];

/**
 * Build the markdown table for the commands section.
 */
export function buildCommandsSection(modules: readonly string[]): string {
  const rows = [
    ...BASE_COMMANDS,
    ...modules.flatMap(id => getModule(id)?.commands ?? []),
  ];
  return [
    '| Command | What it does |',
    '|---------|-------------|',
    ...rows.map(c => `| \`${c.name}\` | ${c.desc} |`),
  ].join('\n');
}

// Structured source-of-truth for core commands.
export const GUIDE_CORE_COMMANDS: ReadonlyArray<{ name: string; desc: string; example?: string }> = [
  { name: '/add <what you did>', desc: 'capture a project, skill, or win', example: '/add Delivered the Orca Studio brand refresh' },
  { name: '/reflect', desc: 'review your notes for skill gaps and stale entries' },
  { name: '/inbox', desc: "process any files you've dropped into `inbox/`" },
  { name: '/status', desc: 'show stale content, inbox, open goals, and pending module setup' },
  { name: '/guide', desc: 'show this command reference any time' },
];

const GUIDE_CORE_LINES: ReadonlyArray<string> = GUIDE_CORE_COMMANDS.map(
  c => `> - \`${c.name}\` — ${c.desc}${c.example ? ` · e.g. \`${c.example}\`` : ''}`
);

/**
 * Build the pre-rendered command-reference block written into guide.md.
 */
export function buildGuideCommands(modules: readonly string[]): string {
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
      lines.push(`> - \`${cmd.name}\` — ${cmd.desc}`);
    }
  }
  return lines.join('\n');
}

/**
 * Build the content of `.claude/inbox-routing.md` from all installed modules' declared
 * `inboxRoutes`. Plain table with managed marker — overwritten on every update.
 */
export function buildRoutingFile(modules: readonly string[], vars: TemplateVars): string {
  const routes = modules.flatMap(id => getModule(id)?.inboxRoutes ?? []);
  const rows = routes.length
    ? routes.map(r => {
        const dest = r.destination.endsWith('/') ? r.destination : `${r.destination}/`;
        return `| \`${r.type}\` | \`${vars.CONTENT_DIR}/${dest}\` | ${r.description ?? ''} |`;
      })
    : [`| _(none)_ | — | No modules with routable types are installed. |`];

  const table = [
    '| `type:` value | Destination | Notes |',
    '|---------------|-------------|-------|',
    ...rows,
  ].join('\n');

  const preamble = [
    '---',
    'patina: managed',
    '---',
    '# Inbox routing table',
    '',
    "This file maps the `type:` field in an artifact's frontmatter to the folder it",
    'is filed into when you run `/inbox`. Any `type:` not listed here is **unknown** —',
    `\`/inbox\` will file it to \`${vars.CONTENT_DIR}/notes/\` and surface a visible warning`,
    'naming the type and the nearest registered match.',
    '',
    'The table below is regenerated by patina whenever you add or remove modules.',
    '',
  ].join('\n');

  return preamble + table + '\n';
}

export interface BaseManagedFilesOptions {
  vars: TemplateVars;
  editor: string;
  modules?: readonly string[];
}

/**
 * Returns [relativePath, content] pairs for the base managed files.
 * These are all marked (patina: managed) and overwritten on update.
 */
export function baseManagedFiles(opts: BaseManagedFilesOptions): Array<[string, string]> {
  const { vars, editor, modules = [] } = opts;

  // Build module README blocks inline
  const moduleReadmeBlocks = modules
    .map(id => getModule(id)?.readmeBlock?.(vars))
    .filter((b): b is string => !!b)
    .join('\n\n');
  const moduleReadmeBlocksVar = moduleReadmeBlocks || '_No modules installed._';

  // Re-render vars with MODULE_README_BLOCKS filled in
  const fullVars: TemplateVars = { ...vars, MODULE_README_BLOCKS: moduleReadmeBlocksVar };

  const files: Array<[string, string]> = [
    ['README.md', render(tpl('README.md'), fullVars)],
    ['CLAUDE.md', render(tpl('CLAUDE.md'), fullVars)],
    ['.claude/settings.json', tpl('.claude/settings.json')],
    ['.claude/scripts/check-update.mjs', render(tpl('.claude/scripts/check-update.mjs'), fullVars)],
    ['.claude/scripts/staleness-check.mjs', render(tpl('.claude/scripts/staleness-check.mjs'), fullVars)],
    ['.claude/scripts/health-check.mjs', tpl('.claude/scripts/health-check.mjs')],
    ['.claude/commands/add.md', render(tpl('.claude/commands/add.md'), fullVars)],
    ['.claude/commands/reflect.md', render(tpl('.claude/commands/reflect.md'), fullVars)],
    ['.claude/commands/inbox.md', render(tpl('.claude/commands/inbox.md'), fullVars)],
    ['.claude/commands/status.md', render(tpl('.claude/commands/status.md'), fullVars)],
    ['.claude/commands/guide.md', render(tpl('.claude/commands/guide.md'), fullVars)],
    ['.claude/inbox-routing.md', buildRoutingFile(modules, fullVars)],
  ];

  if (editor === 'vscode') {
    const vscodeSettings = {
      _patina: 'managed',
      _patina_note: 'This file is managed by patina and is overwritten on update. Remove the _patina key to take ownership.',
      'workbench.editorAssociations': {
        '*.md': 'vscode.markdown.preview.editor',
      },
    };
    files.push(['.vscode/settings.json', JSON.stringify(vscodeSettings, null, 2) + '\n']);
  }

  return files;
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

/**
 * Build the body of the update-check section in CLAUDE.md.
 * The embedded version number is read from `vars.PATINA_VERSION` so it stays
 * accurate on upgrade without any user action.
 */
export function renderUpdateCheckSection(vars: TemplateVars): string {
  return `## Update check

After you finish responding to the user's **first message** of this session — at the natural
end of that response, not mid-task — check for \`.patina-update-check\`.

If the file exists, parse it as JSON:
- It looks like \`{ "checked_at": "<ISO timestamp>", "available_version": "<version or null>" }\`.
- If \`available_version\` is null, missing, or not a valid semver string, say nothing.
- Otherwise, read \`.patina-state.json\`. If \`update_check.last_notified_version\` equals
  \`available_version\`, say nothing (already notified).
- Otherwise, append this notification to the end of your response (fill in the version numbers):

    ---
    There's a newer version of patina available (you have ${vars.PATINA_VERSION}, the latest is [version]).

    To update: finish what you're doing in this session, close this window, and run this
    command in your terminal:

        npx my-patina@latest

    Your notes and settings will stay exactly as they are.
    ---

  - After notifying, write \`available_version\` to \`update_check.last_notified_version\` in
    \`.patina-state.json\`.
- Do NOT delete \`.patina-update-check\`. The checker script re-runs automatically once \`checked_at\` is older than 24 hours.
- If the file is absent or not valid JSON, say nothing.

For version comparison, split on \`.\` and compare major, minor, and patch numerically. If
the value is not a valid semver string, skip silently.

Skip this step entirely in headless or non-interactive sessions.`;
}

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
    demo = false,
    today: todayOverride,
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
    modules,
    content_dir: contentDir,
    created: today,
    ...(launchTasks.length ? { launch_tasks: launchTasks } : {}),
    ...(modules.includes('linkedin') && liProfileUrl ? { linkedin: { profile_url: liProfileUrl } } : {}),
  };

  const vars = profileToVars(tempProfile, liProfileUrl, today);

  mkdirSync(targetDir, { recursive: true });

  // ── Managed files (marked, overwritten on update)
  const managedFiles: Array<[string, string]> = [
    ...baseManagedFiles({ vars, editor, modules }),
    ...modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  for (const module of modules) {
    const manifestEntry = managedFiles.find(([p]) => p === `.claude/modules/${module}/manifest.md`);
    if (manifestEntry) validateManifestFrontmatter(module, manifestEntry[1]);
  }

  for (const [relativePath, content] of managedFiles) {
    // Apply _demo: true stamp only to content-dir files with YAML frontmatter
    const fileContent = (demo && isContentFile(relativePath, contentDir) && content.startsWith('---')) ? markDemo(content, demo) : content;
    writeManagedFile(targetDir, relativePath, fileContent);
  }

  // ── Seed files (written once if absent, never overwritten)
  writeSeedFile(targetDir, 'CUSTOM.md', tpl('CUSTOM.md'));
  writeSeedFile(targetDir, 'inbox/.gitkeep', '');
  writeSeedFile(targetDir, 'inbox/.processed.json', '[]\n');

  // ── Content directory (never touched on upgrade)
  const baseDirs = ['notes', 'skills', 'posts'];
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
  writeRaw(targetDir, '.gitignore', `.obsidian/\n.DS_Store\n${STATE_FILENAME}\ninbox/.processed.json\n.patina-update-check\n`);
}
