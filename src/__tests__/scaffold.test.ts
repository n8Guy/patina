import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';
import { scaffold } from '../scaffold.js';
import { hashContent } from '../checksums.js';
import { readState } from '../state.js';
import type { ScaffoldOptions, Profile } from '../types.js';

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

  it('CLAUDE.md contains staleness init hook with default threshold', () => {
    const content = read('CLAUDE.md');
    expect(content).toContain('On session start');
    expect(content).toContain('30 days');
    expect(content).toContain('What are we working on today?');
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
