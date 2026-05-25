import { mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { render } from './template.js';
import { writeManagedFile } from './upgrade.js';
import { MANAGED_FILES, LINKEDIN_MANAGED_FILES, type ChecksumMap } from './checksums.js';
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

export async function scaffold(opts: ScaffoldOptions): Promise<void> {
  const {
    targetDir, patinaName, userName, title, roleDescription,
    jobDescriptionUrl, work, editor, modules, liProfileUrl, contentDir,
  } = opts;

  const today = new Date().toISOString().split('T')[0];

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
    ['CLAUDE.md', render(tpl('CLAUDE.md'), vars)],
    ['.claude/settings.json', tpl('.claude/settings.json')],
    ['.claude/commands/include.md', render(tpl('.claude/commands/include.md'), vars)],
    ['.claude/commands/skill-search.md', render(tpl('.claude/commands/skill-search.md'), vars)],
  ];

  if (editor === 'obsidian') {
    const mcp = {
      mcpServers: {
        obsidian: {
          command: 'npx',
          args: ['-y', 'mcp-obsidian@latest', join(targetDir, contentDir)],
        },
      },
    };
    managedFiles.push(['.mcp.json', JSON.stringify(mcp, null, 2) + '\n']);
  }

  if (modules.includes('linkedin')) {
    const liCmds = [
      'li-all.md', 'li-about.md', 'li-headline.md', 'li-experience.md',
      'li-skills.md', 'li-featured.md', 'li-activity.md', 'li-update.md',
    ];
    for (const cmd of liCmds) {
      managedFiles.push([
        `.claude/commands/${cmd}`,
        render(tpl(`modules/linkedin/commands/${cmd}`), vars),
      ]);
    }
  }

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

  if (modules.includes('linkedin')) {
    const liGraphFiles = [
      'INSTRUCTIONS.md',
      'LinkedIn Current State.md',
      'LinkedIn About.md',
      'LinkedIn Headline.md',
      'LinkedIn Experience.md',
      'LinkedIn Skills.md',
      'LinkedIn Featured.md',
      'LinkedIn Activity.md',
    ];
    for (const file of liGraphFiles) {
      writeRaw(
        targetDir,
        `${contentDir}/linkedin/${file}`,
        render(tpl(`modules/linkedin/graph/${file}`), vars)
      );
    }
  }

  // ── profile.yaml (written last — includes checksums)
  const profile: Profile = {
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
    _checksums: checksums,
  } as Profile & { _checksums: ChecksumMap };
  writeRaw(targetDir, 'profile.yaml', yaml.dump(profile));

  // ── .gitignore
  writeRaw(targetDir, '.gitignore', '.obsidian/\n.DS_Store\n');
}
