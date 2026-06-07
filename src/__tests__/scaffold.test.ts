import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';
import { scaffold, markDemo, profileToVars, renderUpdateCheckSection } from '../scaffold.js';
import { hashContent } from '../checksums.js';
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

// Factory — reads targetDir at call time so beforeEach assignment is picked up
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

  it('.patina-state.json exists and stores checksums for managed files', () => {
    const state = loadState();
    expect(typeof state.checksums['CLAUDE.md']).toBe('string');
    expect(typeof state.checksums['.claude/commands/add.md']).toBe('string');
    expect(typeof state.checksums['.claude/commands/reflect.md']).toBe('string');
  });

  it('.patina-state.json stores a section checksum for CLAUDE.md:profile', () => {
    const state = loadState();
    expect(typeof state.checksums['CLAUDE.md:profile']).toBe('string');
  });

  it('stored checksum matches actual file content', () => {
    const state = loadState();
    const actual = hashContent(read('CLAUDE.md'));
    expect(state.checksums['CLAUDE.md']).toBe(actual);
  });

  it('creates CLAUDE.md', () => {
    expect(exists('CLAUDE.md')).toBe(true);
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

  it('CLAUDE.md contains profile fence markers', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('<!-- patina:profile:start -->');
    expect(content).toContain('<!-- patina:profile:end -->');
  });

  it('CLAUDE.md contains guide fence markers', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('<!-- patina:guide:start -->');
    expect(content).toContain('<!-- patina:guide:end -->');
  });

  it('.patina-state.json stores a section checksum for CLAUDE.md:guide', () => {
    const state = loadState();
    expect(typeof state.checksums['CLAUDE.md:guide']).toBe('string');
  });

  it('CLAUDE.md contains exactly one ## Slash commands heading (inside commands fence)', () => {
    const content = read('CLAUDE.md');
    const occurrences = content.split('## Slash commands').length - 1;
    expect(occurrences).toBe(1);
    // The heading must be inside the commands fence
    const commandsStart = content.indexOf('<!-- patina:commands:start -->');
    const commandsEnd = content.indexOf('<!-- patina:commands:end -->');
    const slashCmdIdx = content.indexOf('## Slash commands');
    expect(slashCmdIdx).toBeGreaterThan(commandsStart);
    expect(slashCmdIdx).toBeLessThan(commandsEnd);
  });

  it('CLAUDE.md contains staleness init hook with default threshold', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('On session start');
    expect(content).toContain('30 days');
    expect(content).toContain('What are we working on today?');
  });

  it('CLAUDE.md contains pending module setup init-hook instruction', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('pending module setup');
    expect(content).toContain('deferred_modules');
    expect(content).toContain('snooze_until');
  });

  it('creates .claude/settings.json', () => {
    expect(exists('.claude/settings.json')).toBe(true);
  });

  it('creates .claude/commands/add.md', () => {
    expect(exists('.claude/commands/add.md')).toBe(true);
  });

  it('creates .claude/commands/reflect.md', () => {
    expect(exists('.claude/commands/reflect.md')).toBe(true);
  });

  it('reflect.md contains the content dir', () => {
    expect(read('.claude/commands/reflect.md')).toContain('graph/');
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

  it('creates graph/posts/', () => {
    expect(exists('graph/posts/.gitkeep')).toBe(true);
  });

  it('creates graph/notes/README.md', () => {
    expect(exists('graph/notes/README.md')).toBe(true);
  });

  it('creates graph/notes/exclusions.md', () => {
    expect(exists('graph/notes/exclusions.md')).toBe(true);
  });

  it('exclusions.md contains today\'s date', () => {
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

  it('creates .mcp.json', () => {
    expect(exists('.mcp.json')).toBe(true);
  });

  it('.mcp.json contains mcp-obsidian server config', () => {
    const mcp = JSON.parse(read('.mcp.json'));
    expect(mcp.mcpServers.obsidian).toBeDefined();
    expect(mcp.mcpServers.obsidian.args).toContain('mcp-obsidian@latest');
  });

  it('.mcp.json vault path points into the graph directory', () => {
    const mcp = JSON.parse(read('.mcp.json'));
    const vaultPath = mcp.mcpServers.obsidian.args.at(-1) as string;
    expect(vaultPath).toContain('graph');
    expect(vaultPath).not.toContain('\\');
  });
});

describe('scaffold — non-obsidian editor', () => {
  beforeEach(async () => {
    await scaffold(opts({ editor: 'vscode' }));
  });

  it('does not create .mcp.json', () => {
    expect(exists('.mcp.json')).toBe(false);
  });
});

describe('scaffold — vscode editor', () => {
  beforeEach(async () => {
    await scaffold(opts({ editor: 'vscode' }));
  });

  it('creates .vscode/settings.json', () => {
    expect(exists('.vscode/settings.json')).toBe(true);
  });

  it('sets markdown files to open in preview by default', () => {
    const settings = JSON.parse(read('.vscode/settings.json'));
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

  it('stores linkedin command checksums in .patina-state.json', () => {
    const state = loadState();
    expect(typeof state.checksums['.claude/commands/li-all.md']).toBe('string');
    expect(typeof state.checksums['.claude/modules/linkedin/manifest.md']).toBe('string');
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

  it('stores goal command checksums in .patina-state.json', () => {
    const state = loadState();
    expect(typeof state.checksums['.claude/commands/goal.md']).toBe('string');
    expect(typeof state.checksums['.claude/commands/goal-review.md']).toBe('string');
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

  it('stores work module checksums in .patina-state.json', () => {
    const state = loadState();
    expect(typeof state.checksums['.claude/commands/work-check.md']).toBe('string');
    expect(typeof state.checksums['.claude/modules/work/manifest.md']).toBe('string');
    expect(typeof state.checksums['.claude/modules/work/CLAUDE.md']).toBe('string');
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

  it('stores checksums for both modules in .patina-state.json', () => {
    // Only managed files are checksummed; content-dir files are written with writeRaw and intentionally untracked
    const state = loadState();
    expect(typeof state.checksums['.claude/commands/li-all.md']).toBe('string');
    expect(typeof state.checksums['.claude/modules/linkedin/manifest.md']).toBe('string');
    expect(typeof state.checksums['.claude/commands/resume-refresh.md']).toBe('string');
    expect(typeof state.checksums['.claude/modules/resume/manifest.md']).toBe('string');
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

  it('README.md contains the patina:base fence', () => {
    const content = read('README.md');
    expect(content).toContain('<!-- patina:base:start -->');
    expect(content).toContain('<!-- patina:base:end -->');
  });

  it('state has checksums for README.md and README.md:base', () => {
    const state = loadState();
    expect(typeof state.checksums['README.md']).toBe('string');
    expect(typeof state.checksums['README.md:base']).toBe('string');
  });
});

describe('scaffold — README.md with linkedin module', () => {
  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/janedoe' }));
  });

  it('README.md contains patina:linkedin block', () => {
    const content = read('README.md');
    expect(content).toContain('<!-- patina:linkedin:start -->');
    expect(content).toContain('<!-- patina:linkedin:end -->');
  });

  it('CLAUDE.md modules section links to linkedin CLAUDE.md', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('.claude/modules/linkedin/CLAUDE.md');
  });

  it('creates .claude/modules/linkedin/CLAUDE.md', () => {
    expect(exists('.claude/modules/linkedin/CLAUDE.md')).toBe(true);
  });

  it('state has README.md:linkedin checksum', () => {
    const state = loadState();
    expect(typeof state.checksums['README.md:linkedin']).toBe('string');
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

  it('CLAUDE.md contains patina:launch fence', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('<!-- patina:launch:start -->');
    expect(content).toContain('<!-- patina:launch:end -->');
  });

  it('CLAUDE.md contains the rendered task text', () => {
    expect(read('CLAUDE.md')).toContain('Ask the user what they want to focus on today');
  });

  it('.patina-state.json has CLAUDE.md:launch checksum', () => {
    const state = loadState();
    expect(typeof state.checksums['CLAUDE.md:launch']).toBe('string');
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

  it('CLAUDE.md has no patina:launch fence', () => {
    const content = read('CLAUDE.md');
    expect(content).not.toContain('patina:launch');
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

  it('.patina-state.json has checksums for all three inbox files', () => {
    const state = loadState();
    expect(typeof state.checksums['inbox/.gitkeep']).toBe('string');
    expect(typeof state.checksums['inbox/.processed.json']).toBe('string');
    expect(typeof state.checksums['.claude/commands/inbox.md']).toBe('string');
  });

  it('CLAUDE.md contains /inbox command reference', () => {
    expect(read('CLAUDE.md')).toContain('/inbox');
  });

  it('CLAUDE.md mentions inbox/.processed.json', () => {
    expect(read('CLAUDE.md')).toContain('inbox/.processed.json');
  });

  it('CLAUDE.md contains startup inbox check phrasing', () => {
    expect(read('CLAUDE.md')).toContain('Process now');
  });

  it('.gitignore includes inbox/.processed.json', () => {
    expect(read('.gitignore')).toContain('inbox/.processed.json');
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
    // LinkedIn About has frontmatter
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

  it('two runs produce byte-identical output', async () => {
    // Build file map from first run (already done in beforeEach)
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

    // Run a second scaffold into a different targetDir
    const tmp2 = mkdtempSync(join(tmpdir(), 'patina-demo-run2-'));
    const targetDir2 = join(tmp2, 'patina-demo');
    try {
      await scaffold(demoOpts({ targetDir: targetDir2 }));
      const secondRun = collectFileMap(targetDir2);

      // Same set of files
      expect([...secondRun.keys()].sort()).toEqual([...firstRun.keys()].sort());

      // Same content for each file.
      // For .patina-state.json: parse both as JSON and compare checksum values
      // (keys may differ by tmpdir path, so compare the checksum hash values).
      for (const [rel, content] of firstRun) {
        if (rel === '.patina-state.json') {
          const first = JSON.parse(content) as { checksums: Record<string, string> };
          const second = JSON.parse(secondRun.get(rel)!) as { checksums: Record<string, string> };
          // Same set of relative path keys
          expect(Object.keys(second.checksums).sort()).toEqual(Object.keys(first.checksums).sort());
          // Same checksum values for each key
          for (const [key, hash] of Object.entries(first.checksums)) {
            expect(second.checksums[key], `checksum for ${key}`).toBe(hash);
          }
          continue;
        }
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

  it('.patina-state.json has a checksum for check-update.mjs', () => {
    const state = loadState();
    expect(typeof state.checksums['.claude/scripts/check-update.mjs']).toBe('string');
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

describe('scaffold — update-check CLAUDE.md section', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('CLAUDE.md contains patina:update-check fence markers', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('<!-- patina:update-check:start -->');
    expect(content).toContain('<!-- patina:update-check:end -->');
  });

  it('CLAUDE.md update-check section contains the patina version', () => {
    const content = read('CLAUDE.md');
    expect(content).toMatch(/you have \d+\.\d+\.\d+/);
  });

  it('CLAUDE.md update-check section contains the update command', () => {
    expect(read('CLAUDE.md')).toContain('npx my-patina@latest');
  });

  it('.patina-state.json has CLAUDE.md:update-check checksum', () => {
    const state = loadState();
    expect(typeof state.checksums['CLAUDE.md:update-check']).toBe('string');
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
    PATINA_VERSION: '1.2.3',
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

  it('stores clients module checksums in .patina-state.json', () => {
    const state = loadState();
    expect(typeof state.checksums['.claude/commands/client-check.md']).toBe('string');
    expect(typeof state.checksums['.claude/modules/clients/manifest.md']).toBe('string');
    expect(typeof state.checksums['.claude/modules/clients/CLAUDE.md']).toBe('string');
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
