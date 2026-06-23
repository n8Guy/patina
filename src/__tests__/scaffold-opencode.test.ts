/**
 * Tests for opencode agent scaffolding.
 * Verifies that selecting opencode produces the correct directory layout
 * with no .claude/ folder.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { scaffold } from '../scaffold.js';
import type { ScaffoldOptions, ModuleId } from '../types.js';

let tmp: string;
let targetDir: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-opencode-test-'));
  targetDir = join(tmp, 'my-patina');
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function opts(overrides: Partial<ScaffoldOptions> = {}): ScaffoldOptions {
  return {
    targetDir,
    patinaName: 'test-patina',
    userName: 'Jane Doe',
    title: 'Senior Designer',
    roleDescription: 'I design product experiences.',
    jobDescriptionUrl: '',
    work: {
      self_employed: false,
      company_name: 'Acme Corp',
      website: 'https://acme.com',
      company_description: 'A software company.',
    },
    editor: 'other',
    agent: 'opencode',
    modules: [],
    liProfileUrl: '',
    contentDir: 'graph',
    ...overrides,
  };
}

function exists(rel: string): boolean {
  return existsSync(join(targetDir, rel));
}

function read(rel: string): string {
  return readFileSync(join(targetDir, rel), 'utf8');
}

describe('scaffold with opencode agent', () => {
  beforeEach(async () => {
    await scaffold(opts());
  });

  it('creates AGENTS.md not CLAUDE.md', () => {
    expect(exists('AGENTS.md')).toBe(true);
    expect(exists('CLAUDE.md')).toBe(false);
  });

  it('AGENTS.md carries patina: managed frontmatter', () => {
    expect(read('AGENTS.md')).toMatch(/^---\s*\npatina: managed\s*\n---/);
  });

  it('AGENTS.md has no unreplaced template variables', () => {
    expect(read('AGENTS.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('AGENTS.md contains user name', () => {
    expect(read('AGENTS.md')).toContain('Jane Doe');
  });

  it('AGENTS.md H1 heading is # AGENTS.md not # CLAUDE.md', () => {
    expect(read('AGENTS.md')).toContain('# AGENTS.md');
    expect(read('AGENTS.md')).not.toContain('# CLAUDE.md');
  });

  it('creates .opencode/commands/ directory with commands', () => {
    expect(exists('.opencode/commands/add.md')).toBe(true);
    expect(exists('.opencode/commands/reflect.md')).toBe(true);
    expect(exists('.opencode/commands/inbox.md')).toBe(true);
    expect(exists('.opencode/commands/status.md')).toBe(true);
    expect(exists('.opencode/commands/guide.md')).toBe(true);
    expect(exists('.opencode/commands/audience.md')).toBe(true);
    expect(exists('.opencode/commands/with-audience.md')).toBe(true);
  });

  it('does NOT create .claude/ directory', () => {
    expect(exists('.claude')).toBe(false);
  });

  it('does NOT create settings.json', () => {
    expect(exists('.opencode/settings.json')).toBe(false);
    expect(exists('.claude/settings.json')).toBe(false);
  });

  it('creates .opencode/inbox-routing.md', () => {
    expect(exists('.opencode/inbox-routing.md')).toBe(true);
  });

  it('creates .opencode/scripts/staleness-check.mjs', () => {
    expect(exists('.opencode/scripts/staleness-check.mjs')).toBe(true);
  });

  it('creates .opencode/agents/ for archetypes', () => {
    expect(exists('.opencode/agents/hiring-manager.md')).toBe(true);
    expect(exists('.opencode/agents/recruiter.md')).toBe(true);
  });

  it('does NOT create .claude/agents/', () => {
    expect(exists('.claude/agents')).toBe(false);
  });

  it('profile.yaml has agent: opencode', () => {
    const content = read('profile.yaml');
    expect(content).toContain('agent: opencode');
  });

  it('.gitignore references .opencode/audience-prefs.json not .claude/', () => {
    const gitignore = read('.gitignore');
    expect(gitignore).toContain('.opencode/audience-prefs.json');
    expect(gitignore).not.toContain('.claude/audience-prefs.json');
  });

  it('command files reference {{AGENT_DIR}} resolved to .opencode/', () => {
    const inboxContent = read('.opencode/commands/inbox.md');
    expect(inboxContent).toContain('.opencode/inbox-routing.md');
    expect(inboxContent).not.toContain('.claude/');
  });

  it('status.md references .opencode/scripts/', () => {
    const statusContent = read('.opencode/commands/status.md');
    expect(statusContent).toContain('.opencode/scripts/staleness-check.mjs');
    expect(statusContent).not.toContain('.claude/');
  });

  it('audience.md references .opencode/agents/', () => {
    const audienceContent = read('.opencode/commands/audience.md');
    expect(audienceContent).toContain('.opencode/agents/');
    expect(audienceContent).not.toContain('.claude/');
  });

  it('README.md references AGENTS.md', () => {
    const readmeContent = read('README.md');
    expect(readmeContent).toContain('AGENTS.md');
    expect(readmeContent).not.toContain('CLAUDE.md');
  });
});

describe('scaffold with claude-code still produces .claude/', () => {
  beforeEach(async () => {
    await scaffold({ ...opts(), agent: 'claude-code' });
  });

  it('creates CLAUDE.md not AGENTS.md', () => {
    expect(exists('CLAUDE.md')).toBe(true);
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('creates .claude/commands/', () => {
    expect(exists('.claude/commands/add.md')).toBe(true);
  });

  it('does NOT create .opencode/', () => {
    expect(exists('.opencode')).toBe(false);
  });

  it('profile.yaml has agent: claude-code', () => {
    expect(read('profile.yaml')).toContain('agent: claude-code');
  });
});

// ── Helpers for the all-modules integration test ───────────────────────────────

function collectAllFiles(dir: string, base: string = dir): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...collectAllFiles(full, base));
    } else {
      results.push(full.slice(base.length + 1).replace(/\\/g, '/'));
    }
  }
  return results;
}

describe('opencode scaffold with ALL modules — no .claude/ leaks, no unrendered tokens', () => {
  const ALL_MODULES: ModuleId[] = ['linkedin', 'resume', 'goals', 'work', 'clients'];

  beforeEach(async () => {
    await scaffold(opts({
      agent: 'opencode',
      modules: ALL_MODULES,
      liProfileUrl: 'https://linkedin.com/in/test',
    }));
  });

  it('no emitted file path contains .claude/', () => {
    const files = collectAllFiles(targetDir);
    for (const f of files) {
      expect(f, `Found .claude/ path: ${f}`).not.toMatch(/\.claude\//);
    }
  });

  it('no managed file content contains unrendered {{TOKEN}} placeholders', () => {
    const files = collectAllFiles(targetDir);
    for (const f of files) {
      // Skip binary-ish and .gitkeep files
      if (f.endsWith('.json') || f.endsWith('.mjs') || f.endsWith('.gitkeep') || f.endsWith('.processed.json')) continue;
      const content = readFileSync(join(targetDir, f), 'utf8');
      const tokens = content.match(/\{\{[A-Z][A-Z0-9_]+\}\}/g);
      expect(tokens, `Unrendered tokens in ${f}: ${tokens?.join(', ')}`).toBeNull();
    }
  });

  it('module managed files are under .opencode/modules/ not .claude/modules/', () => {
    expect(exists('.opencode/modules/work/CLAUDE.md')).toBe(true);
    expect(exists('.opencode/modules/linkedin/CLAUDE.md')).toBe(true);
    expect(exists('.claude/modules')).toBe(false);
  });

  it('module command files are under .opencode/commands/ not .claude/commands/', () => {
    expect(exists('.opencode/commands/work-check.md')).toBe(true);
    expect(exists('.claude/commands')).toBe(false);
  });

  it('README.md work module block references .opencode/inbox-routing.md not .claude/', () => {
    const readme = read('README.md');
    expect(readme).toContain('.opencode/inbox-routing.md');
    expect(readme).not.toContain('.claude/');
  });
});
