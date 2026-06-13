import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import yaml from 'js-yaml';
import { render } from './template.js';
import { writeManagedFile } from './upgrade.js';
import { type ChecksumMap } from './checksums.js';
import { tpl } from './template-loader.js';
import { getModule } from './modules/registry.js';
import { renderSection, hasFences } from './sections.js';
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
  writeFileSync(full, '', 'utf8');
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
  return {
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
  };
}

/**
 * Core slash commands present in every patina, regardless of installed modules.
 * Rendered into the regenerated `patina:commands` table in CLAUDE.md.
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
 * Build the markdown table for the `patina:commands` section: the core commands
 * plus the commands of every installed module, in install order. Regenerated on
 * install and update so the table never goes stale as modules change.
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
// GUIDE_CORE_LINES (for guide.md) and the wizard "nothing" note both derive from this
// so descriptions can't drift independently.
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
 * Build the pre-rendered command-reference block written into guide.md at wizard
 * run time. Stored so /guide just outputs it verbatim — no manifest reads needed.
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
 * Returns [relativePath, content] pairs for the base managed files:
 * CLAUDE.md, .claude/settings.json, add.md, reflect.md, and conditionally .mcp.json.
 *
 * @param targetDir - The absolute path to the patina directory. Required for
 *   the obsidian .mcp.json vault path. If omitted, .mcp.json is not produced
 *   (safe to omit when editor !== 'obsidian').
 */
export function baseManagedFiles(vars: TemplateVars, editor: string, targetDir?: string): Array<[string, string]> {
  const files: Array<[string, string]> = [
    ['README.md', render(tpl('README.md'), vars)],
    ['CLAUDE.md', render(tpl('CLAUDE.md'), vars)],
    ['.claude/settings.json', tpl('.claude/settings.json')],
    ['.claude/scripts/check-update.mjs', render(tpl('.claude/scripts/check-update.mjs'), vars)],
    ['.claude/scripts/staleness-check.mjs', render(tpl('.claude/scripts/staleness-check.mjs'), vars)],
    ['.claude/scripts/health-check.mjs', tpl('.claude/scripts/health-check.mjs')],
    ['.claude/commands/add.md', render(tpl('.claude/commands/add.md'), vars)],
    ['.claude/commands/reflect.md', render(tpl('.claude/commands/reflect.md'), vars)],
    // Inlined as literals rather than template files to avoid dotfile packaging risk
    // (.gitkeep and .processed.json may be skipped by glob copies into dist/).
    ['inbox/.gitkeep', ''],
    // Seeds as []; writeManagedFile preserves user/Claude entries on update via the
    // hash-skip path (stored hash != current hash → skip). Deleting resets tracking
    // with no data loss.
    ['inbox/.processed.json', '[]\n'],
    ['.claude/commands/inbox.md', render(tpl('.claude/commands/inbox.md'), vars)],
    ['.claude/commands/status.md', render(tpl('.claude/commands/status.md'), vars)],
    ['.claude/commands/guide.md', render(tpl('.claude/commands/guide.md'), vars)],
  ];

  if (editor === 'obsidian' && targetDir) {
    const mcp = {
      mcpServers: {
        obsidian: {
          command: 'npx',
          args: ['-y', 'mcp-obsidian@latest', join(targetDir, vars.CONTENT_DIR).replace(/\\/g, '/')],
        },
      },
    };
    files.push(['.mcp.json', JSON.stringify(mcp, null, 2) + '\n']);
  }

  if (editor === 'vscode') {
    const vscodeSettings = {
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
 * Build the body of the `patina:update-check` fenced section in CLAUDE.md.
 * The embedded version number is read from `vars.PATINA_VERSION` so it stays
 * accurate on upgrade without any user action.
 */
export function renderUpdateCheckSection(vars: TemplateVars): string {
  return `After you finish responding to the user's **first message** of this session — at the natural
end of that response, not mid-task — check for \`.patina-update-check\`.

If the file exists:
- Read its contents. If it contains a version string (e.g. \`0.14.0\`):
  - Read \`.patina-state.json\`. If \`update_check.last_notified_version\` matches the version in
    the file, say nothing.
  - Otherwise, append this notification to the end of your response (fill in the version numbers):

    ---
    There's a newer version of patina available (you have ${vars.PATINA_VERSION}, the latest is [version]).

    To update: finish what you're doing in this session, close this window, and run this
    command in your terminal:

        npx my-patina@latest

    Your notes and settings will stay exactly as they are.
    ---

  - After notifying, write \`update_check.last_notified_version\` to \`.patina-state.json\`.
- If the file is empty or unparseable, say nothing.
- In all cases, delete \`.patina-update-check\` after checking.

For version comparison, split on \`.\` and compare major, minor, and patch numerically. If
either side is not a valid semver string, skip silently.

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

  const checksums: ChecksumMap = {};

  // ── Managed files (tracked for safe upgrades)
  // README.md migration guard: if a fence-free README already exists with no stored checksum,
  // skip writing it to avoid overwriting a hand-crafted file.
  const baseFiles = baseManagedFiles(vars, editor, targetDir);
  const readmePath = join(targetDir, 'README.md');
  const filteredBaseFiles = baseFiles.filter(([rel]) => {
    if (rel === 'README.md') {
      if (existsSync(readmePath)) {
        const existing = readFileSync(readmePath, 'utf8');
        if (!hasFences(existing)) {
          return false; // skip fence-free existing README
        }
      }
    }
    return true;
  });

  const managedFiles: Array<[string, string]> = [
    ...filteredBaseFiles,
    ...modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  for (const module of modules) {
    const manifestEntry = managedFiles.find(([p]) => p === `.claude/modules/${module}/manifest.md`);
    if (manifestEntry) validateManifestFrontmatter(module, manifestEntry[1]);
  }

  for (const [relativePath, content] of managedFiles) {
    // Apply _demo: true stamp to managed files with YAML frontmatter when in demo mode
    const fileContent = (demo && content.startsWith('---')) ? markDemo(content, demo) : content;
    const result = writeManagedFile(targetDir, relativePath, fileContent, {});
    checksums[relativePath] = result.checksum;
    for (const s of result.sections ?? []) {
      checksums[`${relativePath}:${s.id}`] = s.newChecksum;
    }
  }

  // ── Append module README blocks
  for (const module of modules) {
    const def = getModule(module);
    if (def?.readmeBlock) {
      const block = renderSection(module, def.readmeBlock(vars));
      const result = writeManagedFile(targetDir, 'README.md', block, checksums);
      checksums['README.md'] = result.checksum;
      for (const s of result.sections ?? []) {
        checksums[`README.md:${s.id}`] = s.newChecksum;
      }
    }
  }

  // ── Append launch block (two-phase: render then expand vars)
  // Phase 1 produces raw task templates; phase 2 expands {{CONTENT_DIR}} etc.
  // render() is single-pass so we must expand before inserting into the fence.
  const rawLaunch = renderLaunchSection(launchTasks, modules);
  const expandedLaunch = rawLaunch ? render(rawLaunch, vars) : null;
  if (expandedLaunch) {
    const launchBlock = renderSection('launch', expandedLaunch);
    const result = writeManagedFile(targetDir, 'CLAUDE.md', launchBlock, checksums);
    checksums['CLAUDE.md'] = result.checksum;
    for (const s of result.sections ?? []) {
      checksums[`CLAUDE.md:${s.id}`] = s.newChecksum;
    }
  }

  // ── Append update-check block
  const updateCheckBlock = renderSection('update-check', renderUpdateCheckSection(vars));
  {
    const result = writeManagedFile(targetDir, 'CLAUDE.md', updateCheckBlock, checksums);
    checksums['CLAUDE.md'] = result.checksum;
    for (const s of result.sections ?? []) {
      checksums[`CLAUDE.md:${s.id}`] = s.newChecksum;
    }
  }

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
  writeState(targetDir, { checksums });

  // ── .gitignore
  writeRaw(targetDir, '.gitignore', `.obsidian/\n.DS_Store\n${STATE_FILENAME}\ninbox/.processed.json\n.patina-update-check\n`);
}
