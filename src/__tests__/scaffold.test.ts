import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';
import { scaffold, markDemo, profileToVars, renderUpdateCheckSection } from '../scaffold.js';
import { readState } from '../state.js';
import { detectMode } from '../detect.js';
import type { ScaffoldOptions, Profile } from '../types.js';
import { DEMO_TODAY } from '../demo/persona.js';

let tmp: string;
let targetDir: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-scaffold-test-'));
  targetDir = join(tmp, 'my-patina');
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function opts(overrides: Partial<ScaffoldOptions> = {}): ScaffoldOptions {
  return {
    targetDir,
    patinaName: 'test-patina',
    userName: 'Jane Doe',
    title: 'Senior Designer',
    roleDescription: 'I design product experiences for B2B software teams.',
    jobDescriptionUrl: '',
    work: {
      self_employed: false,
      company_name: 'Acme Corp',
      website: 'https://acme.com',
      company_description: 'A software company building tools for finance teams.',
    },
    editor: 'vscode',
    modules: [],
    liProfileUrl: '',
    contentDir: 'graph',
    ...overrides,
  };
}

function read(relativePath: string): string {
  return readFileSync(join(targetDir, relativePath), 'utf8');
}

function exists(relativePath: string): boolean {
  return existsSync(join(targetDir, relativePath));
}

function profile(): Profile {
  return yaml.load(read('profile.yaml')) as Profile;
}

function loadState() {
  return readState(targetDir);
}

// ── Core files ────────────────────────────────────────────────────────────────

describe('scaffold — core files', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('creates the target directory', () => {
    expect(existsSync(targetDir)).toBe(true);
  });

  it('creates profile.yaml', () => {
    expect(exists('profile.yaml')).toBe(true);
  });

  it('profile.yaml contains correct identity fields', () => {
    const p = profile();
    expect(p.name).toBe('Jane Doe');
    expect(p.title).toBe('Senior Designer');
    expect(p.role_description).toBe('I design product experiences for B2B software teams.');
    expect(p.patina_name).toBe('test-patina');
    expect(p.content_dir).toBe('graph');
    expect(p.editor).toBe('vscode');
  });

  it('profile.yaml contains correct work info', () => {
    const p = profile();
    expect(p.work.self_employed).toBe(false);
    expect(p.work.company_name).toBe('Acme Corp');
    expect(p.work.website).toBe('https://acme.com');
  });

  it('profile.yaml has an empty modules array', () => {
    expect(profile().modules).toEqual([]);
  });

  it('profile.yaml has no _checksums field', () => {
    const p = profile() as Profile & { _checksums?: unknown };
    expect(p._checksums).toBeUndefined();
  });

  it('.patina-state.json exists', () => {
    expect(exists('.patina-state.json')).toBe(true);
  });

  it('.patina-state.json does not contain checksums', () => {
    const raw = read('.patina-state.json');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect('checksums' in parsed).toBe(false);
  });

  it('creates CLAUDE.md', () => {
    expect(exists('CLAUDE.md')).toBe(true);
  });

  it('CLAUDE.md carries patina: managed frontmatter', () => {
    const content = read('CLAUDE.md');
    expect(content).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });

  it('CLAUDE.md contains the user name', () => {
    expect(read('CLAUDE.md')).toContain('Jane Doe');
  });

  it('CLAUDE.md contains the content dir', () => {
    expect(read('CLAUDE.md')).toContain('graph/');
  });

  it('CLAUDE.md contains no unreplaced template variables', () => {
    expect(read('CLAUDE.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('CLAUDE.md does not contain fence comment markers', () => {
    const content = read('CLAUDE.md');
    expect(content).not.toContain('<!-- patina:profile:start -->');
    expect(content).not.toContain('<!-- patina:profile:end -->');
    expect(content).not.toContain('<!-- patina:guide:start -->');
    expect(content).not.toContain('<!-- patina:commands:start -->');
  });

  it('CLAUDE.md contains the Slash commands heading', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('## Slash commands');
  });

  it('CLAUDE.md does not contain startup flow (moved to /status)', () => {
    const content = read('CLAUDE.md');
    expect(content).not.toContain('On session start');
    expect(content).not.toContain('What are we working on today?');
    expect(content).not.toContain('deferred_modules');
  });

  it('status.md contains staleness check and deferred module logic', () => {
    const content = read('.claude/commands/status.md');
    expect(content).toContain('staleness-check.mjs');
    expect(content).toContain('deferred_modules');
    expect(content).toContain('snooze_until');
  });

  it('creates .claude/settings.json', () => {
    expect(exists('.claude/settings.json')).toBe(true);
  });

  it('settings.json carries _patina: managed marker', () => {
    const settings = JSON.parse(read('.claude/settings.json')) as Record<string, unknown>;
    expect(settings._patina).toBe('managed');
  });

  it('settings.json does not contain a SessionStart hook (startup flow removed)', () => {
    const settings = JSON.parse(read('.claude/settings.json')) as Record<string, { SessionStart?: unknown }>;
    expect(settings?.hooks?.SessionStart).toBeUndefined();
  });

  it('creates .claude/commands/add.md', () => {
    expect(exists('.claude/commands/add.md')).toBe(true);
  });

  it('.claude/commands/add.md carries patina: managed frontmatter', () => {
    expect(read('.claude/commands/add.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });

  it('creates .claude/commands/reflect.md', () => {
    expect(exists('.claude/commands/reflect.md')).toBe(true);
  });

  it('reflect.md contains the content dir', () => {
    expect(read('.claude/commands/reflect.md')).toContain('graph/');
  });

  it('creates CUSTOM.md as a seed file', () => {
    expect(exists('CUSTOM.md')).toBe(true);
  });

  it('CUSTOM.md does not carry patina: managed frontmatter', () => {
    expect(read('CUSTOM.md')).not.toMatch(/^---\s*\npatina: managed/);
  });

  it('creates .gitignore', () => {
    expect(exists('.gitignore')).toBe(true);
  });

  it('.gitignore includes .patina-state.json', () => {
    expect(read('.gitignore')).toContain('.patina-state.json');
  });
});

// ── Graph directory structure ─────────────────────────────────────────────────

describe('scaffold — graph structure', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('creates graph/notes/', () => {
    expect(exists('graph/notes/.gitkeep')).toBe(true);
  });

  it('creates graph/skills/', () => {
    expect(exists('graph/skills/.gitkeep')).toBe(true);
  });

  it('creates graph/notes/README.md', () => {
    expect(exists('graph/notes/README.md')).toBe(true);
  });

  it('creates graph/notes/exclusions.md', () => {
    expect(exists('graph/notes/exclusions.md')).toBe(true);
  });

  it("exclusions.md contains today's date", () => {
    const today = new Date().toISOString().split('T')[0];
    expect(read('graph/notes/exclusions.md')).toContain(today);
  });

  it('does not create weekly-work-summaries directory', () => {
    expect(exists('graph/weekly-work-summaries')).toBe(false);
  });

  it('does not create monthly-professional-profile directory', () => {
    expect(exists('graph/monthly-professional-profile')).toBe(false);
  });
});

// ── Editor: Obsidian ──────────────────────────────────────────────────────────

describe('scaffold — obsidian editor', () => {
  beforeEach(async () => {
    await scaffold(opts({ editor: 'obsidian' }));
  });

  it('does not create .mcp.json', () => {
    expect(exists('.mcp.json')).toBe(false);
  });

  it('seeds .obsidian/app.json', () => {
    expect(exists('.obsidian/app.json')).toBe(true);
  });

  it('.obsidian/app.json sets attachmentFolderPath to contentDir/attachments', () => {
    const config = JSON.parse(read('.obsidian/app.json')) as Record<string, string>;
    expect(config.attachmentFolderPath).toBe('graph/attachments');
  });

  it('.obsidian/app.json is not overwritten on second scaffold run (seed semantics)', async () => {
    const modified = JSON.stringify({ attachmentFolderPath: 'custom/path', custom: true }, null, 2) + '\n';
    writeFileSync(join(targetDir, '.obsidian/app.json'), modified, 'utf8');
    await scaffold(opts({ editor: 'obsidian' }));
    expect(read('.obsidian/app.json')).toBe(modified);
  });

  it('.obsidian/app.json reflects a custom contentDir', async () => {
    const customDir = join(targetDir, 'custom-content-target');
    await scaffold(opts({ editor: 'obsidian', contentDir: 'mywork', targetDir: customDir }));
    const config = JSON.parse(readFileSync(join(customDir, '.obsidian/app.json'), 'utf8')) as Record<string, string>;
    expect(config.attachmentFolderPath).toBe('mywork/attachments');
  });
});

describe('scaffold — vscode editor', () => {
  beforeEach(async () => {
    await scaffold(opts({ editor: 'vscode' }));
  });

  it('creates .vscode/settings.json', () => {
    expect(exists('.vscode/settings.json')).toBe(true);
  });

  it('.vscode/settings.json carries _patina: managed marker', () => {
    const settings = JSON.parse(read('.vscode/settings.json')) as Record<string, unknown>;
    expect(settings._patina).toBe('managed');
  });

  it('sets markdown files to open in preview by default', () => {
    const settings = JSON.parse(read('.vscode/settings.json')) as Record<string, Record<string, string>>;
    expect(settings['workbench.editorAssociations']['*.md']).toBe('vscode.markdown.preview.editor');
  });
});

describe('scaffold — non-vscode editor', () => {
  beforeEach(async () => {
    await scaffold(opts({ editor: 'obsidian' }));
  });

  it('does not create .vscode/settings.json', () => {
    expect(exists('.vscode/settings.json')).toBe(false);
  });
});

describe('scaffold — non-obsidian editor', () => {
  beforeEach(async () => {
    await scaffold(opts({ editor: 'vscode' }));
  });

  it('does not create .obsidian/app.json', () => {
    expect(exists('.obsidian/app.json')).toBe(false);
  });
});

// ── LinkedIn module ───────────────────────────────────────────────────────────

describe('scaffold — linkedin module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/janedoe' }));
  });

  it('creates linkedin commands', () => {
    for (const cmd of ['li-all', 'li-about', 'li-headline', 'li-experience', 'li-skills', 'li-featured', 'li-activity']) {
      expect(exists(`.claude/commands/${cmd}.md`), `${cmd}.md`).toBe(true);
    }
  });

  it('does not create li-update command', () => {
    expect(exists('.claude/commands/li-update.md')).toBe(false);
  });

  it('creates module manifest', () => {
    expect(exists('.claude/modules/linkedin/manifest.md')).toBe(true);
  });

  it('manifest contains reflect_hook', () => {
    expect(read('.claude/modules/linkedin/manifest.md')).toContain('reflect_hook: li-all');
  });

  it('manifest carries patina: managed marker', () => {
    expect(read('.claude/modules/linkedin/manifest.md')).toContain('patina: managed');
  });

  it('creates graph/linkedin/ directory with all proposal files', () => {
    const files = [
      'INSTRUCTIONS.md',
      'LinkedIn Current State.md',
      'LinkedIn About.md',
      'LinkedIn Headline.md',
      'LinkedIn Experience.md',
      'LinkedIn Skills.md',
      'LinkedIn Featured.md',
      'LinkedIn Activity.md',
    ];
    for (const file of files) {
      expect(exists(`graph/linkedin/${file}`), file).toBe(true);
    }
  });

  it('INSTRUCTIONS.md contains the user name', () => {
    expect(read('graph/linkedin/INSTRUCTIONS.md')).toContain('Jane Doe');
  });

  it('INSTRUCTIONS.md contains no unreplaced template variables', () => {
    expect(read('graph/linkedin/INSTRUCTIONS.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('li-all.md carries patina: managed frontmatter', () => {
    expect(read('.claude/commands/li-all.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });

  it('stores linkedin profile url in profile.yaml', () => {
    expect(profile().linkedin?.profile_url).toBe('https://linkedin.com/in/janedoe');
  });
});

describe('scaffold — no linkedin module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
  });

  it('does not create linkedin commands', () => {
    expect(exists('.claude/commands/li-all.md')).toBe(false);
  });

  it('does not create graph/linkedin/', () => {
    expect(exists('graph/linkedin')).toBe(false);
  });

  it('does not create module manifest', () => {
    expect(exists('.claude/modules/linkedin/manifest.md')).toBe(false);
  });
});

// ── Goals module ──────────────────────────────────────────────────────────────

describe('scaffold — goals module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: ['goals'] }));
  });

  it('creates module manifest', () => {
    expect(exists('.claude/modules/goals/manifest.md')).toBe(true);
  });

  it('manifest contains reflect_hook: goal-review', () => {
    expect(read('.claude/modules/goals/manifest.md')).toContain('reflect_hook: goal-review');
  });

  it('manifest contains name: goals', () => {
    expect(read('.claude/modules/goals/manifest.md')).toContain('name: goals');
  });

  it('creates .claude/modules/goals/CLAUDE.md', () => {
    expect(exists('.claude/modules/goals/CLAUDE.md')).toBe(true);
  });

  it('creates graph/goals/INSTRUCTIONS.md', () => {
    expect(exists('graph/goals/INSTRUCTIONS.md')).toBe(true);
  });

  it('INSTRUCTIONS.md contains no unreplaced template variables', () => {
    expect(read('graph/goals/INSTRUCTIONS.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('creates graph/goals/.gitkeep', () => {
    expect(exists('graph/goals/.gitkeep')).toBe(true);
  });

  it('creates .claude/commands/goal.md', () => {
    expect(exists('.claude/commands/goal.md')).toBe(true);
  });

  it('creates .claude/commands/goal-review.md', () => {
    expect(exists('.claude/commands/goal-review.md')).toBe(true);
  });

  it('goal.md contains the content dir and no unreplaced template variables', () => {
    const content = read('.claude/commands/goal.md');
    expect(content).toContain('graph/goals/');
    expect(content).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('goal-review.md contains the content dir and no unreplaced template variables', () => {
    const content = read('.claude/commands/goal-review.md');
    expect(content).toContain('graph/goals/');
    expect(content).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('goal.md carries patina: managed frontmatter', () => {
    expect(read('.claude/commands/goal.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });
});

describe('scaffold — no goals module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
  });

  it('does not create .claude/modules/goals/manifest.md', () => {
    expect(exists('.claude/modules/goals/manifest.md')).toBe(false);
  });

  it('does not create .claude/modules/goals/CLAUDE.md', () => {
    expect(exists('.claude/modules/goals/CLAUDE.md')).toBe(false);
  });

  it('does not create graph/goals/INSTRUCTIONS.md', () => {
    expect(exists('graph/goals/INSTRUCTIONS.md')).toBe(false);
  });

  it('does not create graph/goals/.gitkeep', () => {
    expect(exists('graph/goals/.gitkeep')).toBe(false);
  });

  it('does not create goal commands', () => {
    expect(exists('.claude/commands/goal.md')).toBe(false);
    expect(exists('.claude/commands/goal-review.md')).toBe(false);
  });
});

// ── Work module ───────────────────────────────────────────────────────────────

describe('scaffold — work module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: ['work'] }));
  });

  it('creates module manifest', () => {
    expect(exists('.claude/modules/work/manifest.md')).toBe(true);
  });

  it('manifest contains name: work', () => {
    expect(read('.claude/modules/work/manifest.md')).toContain('name: work');
  });

  it('creates .claude/modules/work/CLAUDE.md', () => {
    expect(exists('.claude/modules/work/CLAUDE.md')).toBe(true);
  });

  it('creates graph/work/INSTRUCTIONS.md', () => {
    expect(exists('graph/work/INSTRUCTIONS.md')).toBe(true);
  });

  it('creates graph/work/profile.md', () => {
    expect(exists('graph/work/profile.md')).toBe(true);
  });

  it('creates graph/work/transcripts/.gitkeep', () => {
    expect(exists('graph/work/transcripts/.gitkeep')).toBe(true);
  });

  it('creates graph/work/weeklies/.gitkeep', () => {
    expect(exists('graph/work/weeklies/.gitkeep')).toBe(true);
  });

  it('creates graph/work/references/.gitkeep', () => {
    expect(exists('graph/work/references/.gitkeep')).toBe(true);
  });

  it('INSTRUCTIONS.md contains the content dir and no unreplaced template variables', () => {
    const content = read('graph/work/INSTRUCTIONS.md');
    expect(content).toContain('graph/work/');
    expect(content).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('profile.md contains no unreplaced template variables', () => {
    expect(read('graph/work/profile.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('CLAUDE.md contains no unreplaced template variables', () => {
    expect(read('.claude/modules/work/CLAUDE.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('manifest contains no unreplaced template variables', () => {
    expect(read('.claude/modules/work/manifest.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('creates .claude/commands/work-check.md', () => {
    expect(exists('.claude/commands/work-check.md')).toBe(true);
  });

  it('work-check.md contains the content dir and no unreplaced template variables', () => {
    const content = read('.claude/commands/work-check.md');
    expect(content).toContain('graph/work/');
    expect(content).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('work-check.md carries patina: managed frontmatter', () => {
    expect(read('.claude/commands/work-check.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });

  it('manifest contains reflect_hook: work-check', () => {
    expect(read('.claude/modules/work/manifest.md')).toContain('reflect_hook: work-check');
  });

  it('manifest does not contain the word "frontmatter"', () => {
    expect(read('.claude/modules/work/manifest.md')).not.toContain('frontmatter');
  });

  it('CLAUDE.md does not contain the word "frontmatter"', () => {
    expect(read('.claude/modules/work/CLAUDE.md')).not.toContain('frontmatter');
  });
});

describe('scaffold — no work module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
  });

  it('does not create .claude/modules/work/manifest.md', () => {
    expect(exists('.claude/modules/work/manifest.md')).toBe(false);
  });

  it('does not create .claude/modules/work/CLAUDE.md', () => {
    expect(exists('.claude/modules/work/CLAUDE.md')).toBe(false);
  });

  it('does not create graph/work/', () => {
    expect(exists('graph/work')).toBe(false);
  });

  it('does not create .claude/commands/work-check.md', () => {
    expect(exists('.claude/commands/work-check.md')).toBe(false);
  });
});

// ── Multi-module scaffold ─────────────────────────────────────────────────────

describe('scaffold — multiple modules (linkedin + resume)', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin', 'resume'], liProfileUrl: 'https://linkedin.com/in/janedoe' }));
  });

  it('writes all linkedin command files', () => {
    for (const cmd of ['li-all', 'li-about', 'li-headline', 'li-experience', 'li-skills', 'li-featured', 'li-activity']) {
      expect(exists(`.claude/commands/${cmd}.md`), `${cmd}.md`).toBe(true);
    }
  });

  it('writes linkedin manifest', () => {
    expect(exists('.claude/modules/linkedin/manifest.md')).toBe(true);
  });

  it('writes resume command file', () => {
    expect(exists('.claude/commands/resume-refresh.md')).toBe(true);
  });

  it('writes resume manifest', () => {
    expect(exists('.claude/modules/resume/manifest.md')).toBe(true);
  });

  it('writes all resume content files', () => {
    for (const file of ['INSTRUCTIONS.md', 'Resume Working Draft.md', 'Resume Last Submitted.md']) {
      expect(exists(`graph/resume/${file}`), file).toBe(true);
    }
  });

  it('writes all linkedin content files', () => {
    const files = [
      'INSTRUCTIONS.md',
      'LinkedIn Current State.md',
      'LinkedIn About.md',
      'LinkedIn Headline.md',
      'LinkedIn Experience.md',
      'LinkedIn Skills.md',
      'LinkedIn Featured.md',
      'LinkedIn Activity.md',
    ];
    for (const file of files) {
      expect(exists(`graph/linkedin/${file}`), file).toBe(true);
    }
  });

  it('profile.yaml lists both modules', () => {
    expect(profile().modules).toEqual(expect.arrayContaining(['linkedin', 'resume']));
    expect(profile().modules).toHaveLength(2);
  });

  it('profile.yaml preserves linkedin profile url alongside resume', () => {
    expect(profile().linkedin?.profile_url).toBe('https://linkedin.com/in/janedoe');
  });

  it('resume does not leak files into graph/linkedin/', () => {
    expect(exists('graph/linkedin/Resume Working Draft.md')).toBe(false);
  });

  it('linkedin does not leak files into graph/resume/', () => {
    expect(exists('graph/resume/LinkedIn About.md')).toBe(false);
  });
});

// ── README.md ─────────────────────────────────────────────────────────────────

describe('scaffold — README.md', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('creates README.md', () => {
    expect(exists('README.md')).toBe(true);
  });

  it('README.md carries patina: managed frontmatter', () => {
    expect(read('README.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });

  it('README.md does not contain patina fence comments', () => {
    const content = read('README.md');
    expect(content).not.toContain('<!-- patina:base:start -->');
    expect(content).not.toContain('<!-- patina:base:end -->');
  });

  it('README.md contains module blocks area', () => {
    // No modules: MODULE_README_BLOCKS is empty or has placeholder
    const content = read('README.md');
    expect(content).toContain('## Installed modules');
  });

  it('README.md contains the backup safety section', () => {
    const content = read('README.md');
    expect(content).toContain('## Keeping your notes safe');
  });

  it('README.md backup section appears before Installed modules', () => {
    const content = read('README.md');
    const backupIdx = content.indexOf('## Keeping your notes safe');
    const modulesIdx = content.indexOf('## Installed modules');
    expect(backupIdx).toBeGreaterThan(-1);
    expect(modulesIdx).toBeGreaterThan(-1);
    expect(backupIdx).toBeLessThan(modulesIdx);
  });

  it('scaffold does not create a .git directory', () => {
    expect(exists('.git')).toBe(false);
  });
});

describe('scaffold — README.md with linkedin module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/janedoe' }));
  });

  it('README.md contains linkedin module info', () => {
    const content = read('README.md');
    expect(content.toLowerCase()).toContain('linkedin');
  });

  it('CLAUDE.md modules section links to linkedin CLAUDE.md', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('.claude/modules/linkedin/CLAUDE.md');
  });

  it('creates .claude/modules/linkedin/CLAUDE.md', () => {
    expect(exists('.claude/modules/linkedin/CLAUDE.md')).toBe(true);
  });
});

// ── Launch tasks ──────────────────────────────────────────────────────────────

describe('scaffold — with launch tasks', () => {
  beforeEach(async () => {
    await scaffold(opts({ launchTasks: ['base/today-focus'] }));
  });

  it('profile.yaml has launch_tasks', () => {
    expect(profile().launch_tasks).toEqual(['base/today-focus']);
  });

  it('CLAUDE.md contains the rendered task text', () => {
    expect(read('CLAUDE.md')).toContain('Ask the user what they want to focus on today');
  });

  it('CLAUDE.md contains no unreplaced template variables in launch section', () => {
    expect(read('CLAUDE.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

describe('scaffold — launch tasks with content_dir substitution', () => {
  it('expands {{CONTENT_DIR}} in task templates', async () => {
    await scaffold(opts({ launchTasks: ['base/recent-notes'], contentDir: 'mygraph' }));
    const content = read('CLAUDE.md');
    expect(content).toContain('mygraph/notes/');
    expect(content).not.toContain('{{CONTENT_DIR}}');
  });
});

describe('scaffold — without launch tasks', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('profile.yaml has no launch_tasks', () => {
    expect(profile().launch_tasks).toBeUndefined();
  });
});

// ── Inbox ─────────────────────────────────────────────────────────────────────

describe('scaffold — inbox', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('creates inbox/.gitkeep', () => {
    expect(exists('inbox/.gitkeep')).toBe(true);
  });

  it('creates inbox/.processed.json', () => {
    expect(exists('inbox/.processed.json')).toBe(true);
  });

  it('inbox/.processed.json parses to an empty array', () => {
    const content = read('inbox/.processed.json');
    expect(JSON.parse(content)).toEqual([]);
  });

  it('creates .claude/commands/inbox.md', () => {
    expect(exists('.claude/commands/inbox.md')).toBe(true);
  });

  it('inbox.md contains the content dir and no unreplaced template variables', () => {
    const content = read('.claude/commands/inbox.md');
    expect(content).toContain('graph/');
    expect(content).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('CLAUDE.md contains /inbox command reference', () => {
    expect(read('CLAUDE.md')).toContain('/inbox');
  });

  it('CLAUDE.md mentions inbox/.processed.json', () => {
    expect(read('CLAUDE.md')).toContain('inbox/.processed.json');
  });

  it('status.md contains inbox check logic', () => {
    expect(read('.claude/commands/status.md')).toContain('inbox/.processed.json');
  });

  it('.gitignore includes inbox/.processed.json', () => {
    expect(read('.gitignore')).toContain('inbox/.processed.json');
  });

  it('inbox files do not carry patina: managed (they are seed-once)', () => {
    // inbox/.processed.json is a JSON seed file — no _patina marker
    const processed = JSON.parse(read('inbox/.processed.json'));
    expect(Array.isArray(processed)).toBe(true);
  });
});

// ── Inbox routing file ────────────────────────────────────────────────────────

describe('scaffold — inbox routing file (no modules)', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
  });

  it('creates .claude/inbox-routing.md', () => {
    expect(exists('.claude/inbox-routing.md')).toBe(true);
  });

  it('.claude/inbox-routing.md contains _(none)_ placeholder when no modules installed', () => {
    expect(read('.claude/inbox-routing.md')).toContain('_(none)_');
  });

  it('.claude/inbox-routing.md carries patina: managed frontmatter', () => {
    expect(read('.claude/inbox-routing.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });

  it('.claude/inbox-routing.md contains no unreplaced template variables', () => {
    expect(read('.claude/inbox-routing.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

describe('scaffold — inbox routing file (work module)', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: ['work'] }));
  });

  it('.claude/inbox-routing.md exists', () => {
    expect(exists('.claude/inbox-routing.md')).toBe(true);
  });

  it('.claude/inbox-routing.md contains transcript row', () => {
    expect(read('.claude/inbox-routing.md')).toContain('`transcript`');
  });

  it('.claude/inbox-routing.md contains weekly row pointing to graph/work/weeklies/', () => {
    expect(read('.claude/inbox-routing.md')).toContain('graph/work/weeklies/');
  });

  it('.claude/inbox-routing.md contains reference row', () => {
    expect(read('.claude/inbox-routing.md')).toContain('`reference`');
  });

  it('.claude/inbox-routing.md contains no unreplaced template variables', () => {
    expect(read('.claude/inbox-routing.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

});

describe('scaffold — inbox routing file (custom content dir)', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: ['work'], contentDir: 'mywork' }));
  });

  it('destinations reflect custom content dir', () => {
    const content = read('.claude/inbox-routing.md');
    expect(content).toContain('mywork/work/weeklies/');
    expect(content).toContain('mywork/work/transcripts/');
    expect(content).toContain('mywork/work/references/');
  });
});

// ── Template rendering ────────────────────────────────────────────────────────

describe('scaffold — template rendering', () => {
  it('renders company name into CLAUDE.md', async () => {
    await scaffold(opts());
    expect(read('CLAUDE.md')).toContain('Acme Corp');
  });

  it('omits job_description_url from profile.yaml when blank', async () => {
    await scaffold(opts({ jobDescriptionUrl: '' }));
    expect(profile().job_description_url).toBeUndefined();
  });

  it('includes job_description_url in profile.yaml when provided', async () => {
    await scaffold(opts({ jobDescriptionUrl: 'https://example.com/jd' }));
    expect(profile().job_description_url).toBe('https://example.com/jd');
  });

  it('uses a custom content dir name', async () => {
    await scaffold(opts({ contentDir: 'mywork' }));
    expect(exists('mywork/notes/.gitkeep')).toBe(true);
    expect(read('CLAUDE.md')).toContain('mywork/');
  });
});

// ── markDemo helper ───────────────────────────────────────────────────────────

describe('markDemo', () => {
  it('inserts _demo: true as first line inside frontmatter', () => {
    const content = '---\ndate: 2025-06-01\ntype: note\n---\n\n# Hello\n';
    const result = markDemo(content, true);
    expect(result).toBe('---\n_demo: true\ndate: 2025-06-01\ntype: note\n---\n\n# Hello\n');
  });

  it('handles \\r\\n line endings in frontmatter delimiter', () => {
    const content = '---\r\ndate: 2025-06-01\r\n---\r\n\n# Hello\n';
    const result = markDemo(content, true);
    expect(result).toContain('_demo: true');
    expect(result.startsWith('---\r\n_demo: true\r\n')).toBe(true);
  });

  it('returns content unchanged when demo is false', () => {
    const content = '---\ndate: 2025-06-01\n---\n\n# Hello\n';
    expect(markDemo(content, false)).toBe(content);
  });

  it('returns content unchanged when no frontmatter', () => {
    const content = '# No frontmatter\n\nJust text.\n';
    expect(markDemo(content, true)).toBe(content);
  });
});

// ── scaffold — demo mode ──────────────────────────────────────────────────────

describe('scaffold — demo mode', () => {
  function demoOpts(overrides: Partial<ScaffoldOptions> = {}): ScaffoldOptions {
    return {
      targetDir,
      patinaName: 'patina-demo',
      userName: 'Mara Ellison',
      title: 'Independent Software Consultant',
      roleDescription: "I'm a backend-leaning full-stack consultant.",
      jobDescriptionUrl: '',
      work: {
        self_employed: true,
        company_name: 'Ellison Labs',
        website: 'https://ellisonlabs.dev',
        company_description: 'Independent consultancy.',
      },
      editor: 'vscode',
      modules: ['linkedin', 'resume', 'goals', 'work'],
      liProfileUrl: 'https://linkedin.com/in/mara-ellison-demo',
      contentDir: 'graph',
      demo: true,
      today: DEMO_TODAY,
      ...overrides,
    };
  }

  beforeEach(async () => {
    await scaffold(demoOpts());
  });

  it('profile.yaml has _demo: true', () => {
    const p = yaml.load(read('profile.yaml')) as Profile;
    expect((p as Profile & { _demo?: boolean })._demo).toBe(true);
  });

  it('profile.yaml created date uses DEMO_TODAY', () => {
    const p = yaml.load(read('profile.yaml')) as Profile;
    expect(p.created).toBe(DEMO_TODAY);
  });

  it('exclusions.md contains DEMO_TODAY (not today)', () => {
    expect(read('graph/notes/exclusions.md')).toContain(DEMO_TODAY);
  });

  it('content files from modules have _demo: true in frontmatter', () => {
    const about = read('graph/linkedin/LinkedIn About.md');
    expect(about).toContain('_demo: true');
  });

  it('no unreplaced {{...}} template variables in any file', () => {
    function collectFiles(dir: string): string[] {
      const results: string[] = [];
      if (!existsSync(dir)) return results;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          results.push(...collectFiles(join(dir, entry.name)));
        } else {
          results.push(join(dir, entry.name));
        }
      }
      return results;
    }
    const files = collectFiles(targetDir);
    for (const f of files) {
      if (f.endsWith('.md') || f.endsWith('.yaml') || f.endsWith('.json')) {
        const content = readFileSync(f, 'utf8');
        expect(content, f).not.toMatch(/\{\{[A-Z_]+\}\}/);
      }
    }
  });

  it('two runs produce byte-identical output (excluding .patina-state.json)', async () => {
    function collectFileMap(dir: string): Map<string, string> {
      const map = new Map<string, string>();
      function walk(d: string): void {
        if (!existsSync(d)) return;
        for (const entry of readdirSync(d, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            walk(join(d, entry.name));
          } else {
            const full = join(d, entry.name);
            const rel = full.slice(dir.length + 1).replace(/\\/g, '/');
            map.set(rel, readFileSync(full, 'utf8'));
          }
        }
      }
      walk(dir);
      return map;
    }

    const firstRun = collectFileMap(targetDir);

    const tmp2 = mkdtempSync(join(tmpdir(), 'patina-demo-run2-'));
    const targetDir2 = join(tmp2, 'patina-demo');
    try {
      await scaffold(demoOpts({ targetDir: targetDir2 }));
      const secondRun = collectFileMap(targetDir2);

      // Same set of files
      expect([...secondRun.keys()].sort()).toEqual([...firstRun.keys()].sort());

      // Same content for each file (skip .patina-state.json which may differ in structure)
      for (const [rel, content] of firstRun) {
        if (rel === '.patina-state.json') continue;
        expect(secondRun.get(rel), rel).toBe(content);
      }
    } finally {
      rmSync(tmp2, { recursive: true, force: true });
    }
  });
});

// ── detectMode — demo guard ───────────────────────────────────────────────────

describe('detectMode — throws on demo patina', () => {
  let demoDir: string;

  beforeEach(async () => {
    demoDir = join(tmp, 'demo-detect');
    await scaffold({
      targetDir: demoDir,
      patinaName: 'patina-demo',
      userName: 'Mara Ellison',
      title: 'Independent Software Consultant',
      roleDescription: "I'm a backend-leaning full-stack consultant.",
      jobDescriptionUrl: '',
      work: {
        self_employed: true,
        company_name: 'Ellison Labs',
        website: 'https://ellisonlabs.dev',
        company_description: 'Independent consultancy.',
      },
      editor: 'vscode',
      modules: ['linkedin', 'resume'],
      liProfileUrl: 'https://linkedin.com/in/mara-ellison-demo',
      contentDir: 'graph',
      demo: true,
      today: DEMO_TODAY,
    });
  });

  it('detectMode throws with a message containing "demo" for a demo patina', () => {
    expect(() => detectMode(demoDir)).toThrow(/demo/i);
  });
});

// ── PATINA_VERSION ────────────────────────────────────────────────────────────

describe('profileToVars — PATINA_VERSION', () => {
  it('includes PATINA_VERSION matching the current package version', () => {
    const p: Profile = {
      patina_name: 'test',
      name: 'Jane',
      work: { self_employed: false, company_name: 'Acme' },
      editor: 'vscode',
      modules: [],
      content_dir: 'graph',
      created: '2026-01-01',
    };
    const vars = profileToVars(p);
    expect(typeof vars.PATINA_VERSION).toBe('string');
    expect(vars.PATINA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

describe('scaffold — check-update.mjs', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('creates .claude/scripts/check-update.mjs', () => {
    expect(exists('.claude/scripts/check-update.mjs')).toBe(true);
  });

  it('check-update.mjs contains the literal version string (no leftover {{PATINA_VERSION}})', () => {
    const content = read('.claude/scripts/check-update.mjs');
    expect(content).not.toContain('{{PATINA_VERSION}}');
    expect(content).toMatch(/'\d+\.\d+\.\d+'/);
  });
});

describe('scaffold — staleness-check.mjs', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('creates .claude/scripts/staleness-check.mjs', () => {
    expect(exists('.claude/scripts/staleness-check.mjs')).toBe(true);
  });

  it('staleness-check.mjs contains rendered CONTENT_DIR and threshold (no leftover {{}})', () => {
    const content = read('.claude/scripts/staleness-check.mjs');
    expect(content).not.toContain('{{CONTENT_DIR}}');
    expect(content).not.toContain('{{STALENESS_THRESHOLD}}');
    expect(content).toContain('graph');
    expect(content).toContain("'30'");
  });

  it('settings.json allows staleness-check.mjs', () => {
    const settings = JSON.parse(read('.claude/settings.json')) as { permissions: { allow: string[] } };
    expect(settings.permissions.allow).toContain('Bash(node .claude/scripts/staleness-check.mjs)');
  });
});

describe('scaffold — .gitignore update-check entry', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('.gitignore includes .patina-update-check', () => {
    expect(read('.gitignore')).toContain('.patina-update-check');
  });
});

describe('scaffold — update-check section in CLAUDE.md', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('CLAUDE.md contains the update-check heading', () => {
    expect(read('CLAUDE.md')).toContain('## Update check');
  });

  it('CLAUDE.md update-check section contains the patina version', () => {
    expect(read('CLAUDE.md')).toMatch(/you have \d+\.\d+\.\d+/);
  });

  it('CLAUDE.md update-check section contains the update command', () => {
    expect(read('CLAUDE.md')).toContain('npx my-patina@latest');
  });

  it('CLAUDE.md contains no unreplaced template variables in update-check section', () => {
    expect(read('CLAUDE.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

describe('renderUpdateCheckSection', () => {
  const vars = {
    PATINA_NAME: 'test',
    USER_NAME: 'Jane',
    USER_TITLE: '',
    ROLE_DESCRIPTION: '',
    COMPANY_NAME: 'Acme',
    COMPANY_DESCRIPTION: '',
    CONTENT_DIR: 'graph',
    EDITOR: 'vscode',
    LI_PROFILE_URL: '',
    TODAY: '2026-01-01',
    STALENESS_THRESHOLD: '30',
    MODULES_SECTION: '',
    COMMANDS_SECTION: '',
    GUIDE_COMMANDS: '',
    PATINA_VERSION: '1.2.3',
    LAUNCH_SECTION: '',
    UPDATE_CHECK_SECTION: '',
    MODULE_README_BLOCKS: '',
  };

  it('returns a string containing the installed version', () => {
    const result = renderUpdateCheckSection(vars);
    expect(result).toContain('1.2.3');
  });

  it('returns a string containing the update command', () => {
    const result = renderUpdateCheckSection(vars);
    expect(result).toContain('npx my-patina@latest');
  });

  it('does not contain any unreplaced {{...}} template vars', () => {
    const result = renderUpdateCheckSection(vars);
    expect(result).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('mentions .patina-update-check flag file', () => {
    const result = renderUpdateCheckSection(vars);
    expect(result).toContain('.patina-update-check');
  });

  it('mentions .patina-state.json', () => {
    const result = renderUpdateCheckSection(vars);
    expect(result).toContain('.patina-state.json');
  });

  it('does not instruct Claude to delete .patina-update-check', () => {
    const result = renderUpdateCheckSection(vars);
    expect(result).not.toMatch(/(?<!NOT? )\bdelete\b[^.]*\.patina-update-check/i);
  });
});

// ── Clients module ────────────────────────────────────────────────────────────

describe('scaffold — clients module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: ['clients'] }));
  });

  it('creates graph/clients/.gitkeep', () => {
    expect(exists('graph/clients/.gitkeep')).toBe(true);
  });

  it('creates graph/clients/INSTRUCTIONS.md', () => {
    expect(exists('graph/clients/INSTRUCTIONS.md')).toBe(true);
  });

  it('INSTRUCTIONS.md contains no unreplaced template variables', () => {
    expect(read('graph/clients/INSTRUCTIONS.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('creates .claude/modules/clients/manifest.md', () => {
    expect(exists('.claude/modules/clients/manifest.md')).toBe(true);
  });

  it('creates .claude/modules/clients/CLAUDE.md', () => {
    expect(exists('.claude/modules/clients/CLAUDE.md')).toBe(true);
  });

  it('creates .claude/commands/client-check.md', () => {
    expect(exists('.claude/commands/client-check.md')).toBe(true);
  });

  it('manifest contains reflect_hook: client-check', () => {
    expect(read('.claude/modules/clients/manifest.md')).toContain('reflect_hook: client-check');
  });

  it('manifest contains name: clients', () => {
    expect(read('.claude/modules/clients/manifest.md')).toContain('name: clients');
  });

  it('manifest contains no unreplaced template variables', () => {
    expect(read('.claude/modules/clients/manifest.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('CLAUDE.md contains no unreplaced template variables', () => {
    expect(read('.claude/modules/clients/CLAUDE.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('client-check.md contains the content dir and no unreplaced template variables', () => {
    const content = read('.claude/commands/client-check.md');
    expect(content).toContain('graph/clients/');
    expect(content).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('client-check.md carries patina: managed frontmatter', () => {
    expect(read('.claude/commands/client-check.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });
});

describe('scaffold — no clients module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
  });

  it('does not create graph/clients/.gitkeep', () => {
    expect(exists('graph/clients/.gitkeep')).toBe(false);
  });

  it('does not create graph/clients/INSTRUCTIONS.md', () => {
    expect(exists('graph/clients/INSTRUCTIONS.md')).toBe(false);
  });

  it('does not create .claude/modules/clients/manifest.md', () => {
    expect(exists('.claude/modules/clients/manifest.md')).toBe(false);
  });

  it('does not create .claude/commands/client-check.md', () => {
    expect(exists('.claude/commands/client-check.md')).toBe(false);
  });
});

// ── Audience commands ─────────────────────────────────────────────────────────

describe('scaffold — audience commands', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('creates .claude/commands/audience.md', () => {
    expect(exists('.claude/commands/audience.md')).toBe(true);
  });

  it('audience.md carries patina: managed frontmatter', () => {
    expect(read('.claude/commands/audience.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });

  it('audience.md contains the rendered content dir', () => {
    expect(read('.claude/commands/audience.md')).toContain('graph/');
  });

  it('audience.md contains the required success message without "graph"', () => {
    const content = read('.claude/commands/audience.md');
    expect(content).toContain('audience.md in your patina folder');
    // Lock the no-graph guarantee: the success step must not reference the content dir word
    const step4 = content.slice(content.indexOf('## Step 4'));
    expect(step4).not.toContain('graph');
    expect(step4).not.toContain('graph/');
  });

  it('audience.md has no unreplaced template variables', () => {
    expect(read('.claude/commands/audience.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('creates .claude/commands/with-audience.md', () => {
    expect(exists('.claude/commands/with-audience.md')).toBe(true);
  });

  it('with-audience.md carries patina: managed frontmatter', () => {
    expect(read('.claude/commands/with-audience.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });

  it('with-audience.md contains the rendered audience file path', () => {
    expect(read('.claude/commands/with-audience.md')).toContain('graph/audience.md');
  });

  it('with-audience.md contains specific guard to run /audience if file is missing', () => {
    const content = read('.claude/commands/with-audience.md');
    expect(content).toContain('Run `/audience` first');
    expect(content).toContain('Stop. Do not continue.');
  });

  it('with-audience.md has no unreplaced template variables', () => {
    expect(read('.claude/commands/with-audience.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('CLAUDE.md contains /audience', () => {
    expect(read('CLAUDE.md')).toContain('/audience');
  });

  it('CLAUDE.md contains /with-audience', () => {
    expect(read('CLAUDE.md')).toContain('/with-audience');
  });

  it('guide.md contains /audience', () => {
    expect(read('.claude/commands/guide.md')).toContain('/audience');
  });

  it('guide.md contains /with-audience', () => {
    expect(read('.claude/commands/guide.md')).toContain('/with-audience');
  });
});
