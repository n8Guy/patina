import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import yaml from 'js-yaml';
import { render } from './template.js';
import { writeManagedFile } from './upgrade.js';
import { type ChecksumMap } from './checksums.js';
import { tpl } from './template-loader.js';
import { getModule } from './modules/registry.js';
import { writeState, STATE_FILENAME } from './state.js';
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

export const MANIFEST_REQUIRED_FIELDS = ['name', 'label', 'reflect_hook', 'description', 'installed'] as const;

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
    STALENESS_THRESHOLD: (() => { const d = Number(profile.staleness_threshold_days ?? 30); return String(Number.isFinite(d) && d > 0 ? d : 30); })(),
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
          args: ['-y', 'mcp-obsidian@latest', join(targetDir, vars.CONTENT_DIR).replace(/\\/g, '/')],
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
  return getModule(module)?.managedFiles(vars) ?? [];
}

/**
 * Returns [relativePath, content] pairs for the content-dir files of a given module
 * (files under <contentDir>/<module>/). relativePath is relative to targetDir.
 */
export function moduleContentFiles(module: string, vars: TemplateVars, contentDir: string): Array<[string, string]> {
  return getModule(module)?.contentFiles(vars, contentDir) ?? [];
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

  const vars = profileToVars(tempProfile, liProfileUrl);

  mkdirSync(targetDir, { recursive: true });

  const checksums: ChecksumMap = {};

  // ── Managed files (tracked for safe upgrades)
  const managedFiles: Array<[string, string]> = [
    ...baseManagedFiles(vars, editor, targetDir),
    ...modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  for (const module of modules) {
    const manifestEntry = managedFiles.find(([p]) => p === `.claude/modules/${module}/manifest.md`);
    if (manifestEntry) validateManifestFrontmatter(module, manifestEntry[1]);
  }

  for (const [relativePath, content] of managedFiles) {
    const result = writeManagedFile(targetDir, relativePath, content, {});
    checksums[relativePath] = result.checksum;
    for (const s of result.sections ?? []) {
      checksums[`${relativePath}:${s.id}`] = s.newChecksum;
    }
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

  // ── profile.yaml (clean — no internal state)
  writeRaw(targetDir, 'profile.yaml', yaml.dump(tempProfile));

  // ── .patina-state.json (internal state, gitignored)
  writeState(targetDir, { checksums });

  // ── .gitignore
  writeRaw(targetDir, '.gitignore', `.obsidian/\n.DS_Store\n${STATE_FILENAME}\n`);
}
