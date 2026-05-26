import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { render } from './template.js';
import { writeManagedFile } from './upgrade.js';
import { MODULE_CONTENT_FILES, type ChecksumMap } from './checksums.js';
import type { ScaffoldOptions, Profile, TemplateVars } from './types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
// When compiled, __dirname = dist/ and templates are copied to dist/templates.
// When running via tsx, __dirname = src/ and templates live in src/templates.
const TEMPLATES_DIR = join(__dirname, 'templates');

function tpl(relativePath: string): string {
  return readFileSync(join(TEMPLATES_DIR, relativePath), 'utf8');
}

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

// ── Exported helpers ───────────────────────────────────────────────────────────

/**
 * Build a TemplateVars object from a Profile. Centralizes the mapping so
 * both scaffold() and runUpdate() produce identical vars.
 */
export function profileToVars(profile: Profile, liProfileUrl?: string): TemplateVars {
  const today = new Date().toISOString().split('T')[0];
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
    TODAY: today,
  };
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
    ['CLAUDE.md', render(tpl('CLAUDE.md'), vars)],
    ['.claude/settings.json', tpl('.claude/settings.json')],
    ['.claude/commands/add.md', render(tpl('.claude/commands/add.md'), vars)],
    ['.claude/commands/reflect.md', render(tpl('.claude/commands/reflect.md'), vars)],
  ];

  if (editor === 'obsidian' && targetDir) {
    const mcp = {
      mcpServers: {
        obsidian: {
          command: 'npx',
          args: ['-y', 'mcp-obsidian@latest', join(targetDir, vars.CONTENT_DIR)],
        },
      },
    };
    files.push(['.mcp.json', JSON.stringify(mcp, null, 2) + '\n']);
  }

  return files;
}

/**
 * Returns [relativePath, content] pairs for the managed files of a given module
 * (command files + manifest).
 */
export function moduleManagedFiles(module: string, vars: TemplateVars): Array<[string, string]> {
  if (module === 'linkedin') {
    const liCmds = [
      'li-all.md', 'li-about.md', 'li-headline.md', 'li-experience.md',
      'li-skills.md', 'li-featured.md', 'li-activity.md',
    ];
    const files: Array<[string, string]> = liCmds.map(cmd => [
      `.claude/commands/${cmd}`,
      render(tpl(`modules/linkedin/commands/${cmd}`), vars),
    ]);
    files.push([
      '.claude/modules/linkedin/manifest.md',
      render(tpl('modules/linkedin/manifest.md'), vars),
    ]);
    return files;
  }
  if (module === 'resume') {
    return [
      ['.claude/commands/resume-refresh.md', render(tpl('modules/resume/commands/resume-refresh.md'), vars)],
      ['.claude/modules/resume/manifest.md', render(tpl('modules/resume/manifest.md'), vars)],
    ];
  }
  return [];
}

/**
 * Returns [relativePath, content] pairs for the content-dir files of a given module
 * (files under <contentDir>/<module>/). relativePath is relative to targetDir.
 */
export function moduleContentFiles(module: string, vars: TemplateVars, contentDir: string): Array<[string, string]> {
  if (module === 'linkedin') {
    const files = MODULE_CONTENT_FILES['linkedin'] ?? [];
    return files.map(file => [
      `${contentDir}/linkedin/${file}`,
      render(tpl(`modules/linkedin/graph/${file}`), vars),
    ]);
  }
  if (module === 'resume') {
    const files = MODULE_CONTENT_FILES['resume'] ?? [];
    return files.map(file => [
      `${contentDir}/resume/${file}`,
      render(tpl(`modules/resume/graph/${file}`), vars),
    ]);
  }
  return [];
}

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const {
    targetDir, patinaName, userName, title, roleDescription,
    jobDescriptionUrl, work, editor, modules, liProfileUrl, contentDir,
  } = opts;

  const today = new Date().toISOString().split('T')[0];

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
    ...(modules.includes('linkedin') && liProfileUrl ? { linkedin: { profile_url: liProfileUrl } } : {}),
  };

  const vars: TemplateVars = {
    PATINA_NAME: patinaName,
    USER_NAME: userName,
    USER_TITLE: title,
    ROLE_DESCRIPTION: roleDescription,
    COMPANY_NAME: work.company_name,
    COMPANY_DESCRIPTION: work.company_description ?? '',
    CONTENT_DIR: contentDir,
    EDITOR: editor,
    LI_PROFILE_URL: liProfileUrl,
    TODAY: today,
  };

  mkdirSync(targetDir, { recursive: true });

  const checksums: ChecksumMap = {};

  // ── Managed files (tracked for safe upgrades)
  const managedFiles: Array<[string, string]> = [
    ...baseManagedFiles(vars, editor, targetDir),
    ...modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  for (const [relativePath, content] of managedFiles) {
    const { checksum } = writeManagedFile(targetDir, relativePath, content, {});
    checksums[relativePath] = checksum;
  }

  // ── Content directory (never touched on upgrade)
  const baseDirs = ['notes', 'skills', 'posts'];
  for (const dir of baseDirs) {
    touch(targetDir, `${contentDir}/${dir}/.gitkeep`);
  }
  writeRaw(targetDir, `${contentDir}/notes/README.md`, render(tpl('graph/notes/README.md'), vars));
  writeRaw(targetDir, `${contentDir}/notes/exclusions.md`, render(tpl('graph/notes/exclusions.md'), vars));

  for (const module of modules) {
    for (const [relativePath, content] of moduleContentFiles(module, vars, contentDir)) {
      writeRaw(targetDir, relativePath, content);
    }
  }

  // ── profile.yaml (written last — includes checksums)
  const profile: Profile = {
    ...tempProfile,
    _checksums: checksums,
  } as Profile & { _checksums: ChecksumMap };
  writeRaw(targetDir, 'profile.yaml', yaml.dump(profile));

  // ── .gitignore
  writeRaw(targetDir, '.gitignore', '.obsidian/\n.DS_Store\n');
}
