import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { profileToVars, baseManagedFiles, moduleManagedFiles, moduleContentFiles } from '../scaffold.js';
import type { Profile } from '../types.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-helpers-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    patina_name: 'test-patina',
    name: 'Jane Doe',
    title: 'Senior Designer',
    role_description: 'I design product experiences.',
    work: {
      self_employed: false,
      company_name: 'Acme Corp',
      website: 'https://acme.com',
      company_description: 'A software company.',
    },
    editor: 'vscode',
    modules: [],
    content_dir: 'graph',
    created: '2026-01-01',
    ...overrides,
  };
}

// ── profileToVars ─────────────────────────────────────────────────────────────

describe('profileToVars', () => {
  it('maps basic identity fields', () => {
    const vars = profileToVars(makeProfile());
    expect(vars.USER_NAME).toBe('Jane Doe');
    expect(vars.USER_TITLE).toBe('Senior Designer');
    expect(vars.PATINA_NAME).toBe('test-patina');
  });

  it('maps work fields', () => {
    const vars = profileToVars(makeProfile());
    expect(vars.COMPANY_NAME).toBe('Acme Corp');
    expect(vars.COMPANY_DESCRIPTION).toBe('A software company.');
  });

  it('maps content_dir and editor', () => {
    const vars = profileToVars(makeProfile());
    expect(vars.CONTENT_DIR).toBe('graph');
    expect(vars.EDITOR).toBe('vscode');
  });

  it('uses explicit liProfileUrl when provided', () => {
    const vars = profileToVars(makeProfile(), 'https://linkedin.com/in/jane');
    expect(vars.LI_PROFILE_URL).toBe('https://linkedin.com/in/jane');
  });

  it('falls back to profile.linkedin.profile_url', () => {
    const profile = makeProfile({ linkedin: { profile_url: 'https://linkedin.com/in/jane' } });
    const vars = profileToVars(profile);
    expect(vars.LI_PROFILE_URL).toBe('https://linkedin.com/in/jane');
  });

  it('defaults LI_PROFILE_URL to empty string when not set', () => {
    const vars = profileToVars(makeProfile());
    expect(vars.LI_PROFILE_URL).toBe('');
  });

  it('defaults ROLE_DESCRIPTION to empty string when undefined', () => {
    const profile = makeProfile({ role_description: undefined });
    const vars = profileToVars(profile);
    expect(vars.ROLE_DESCRIPTION).toBe('');
  });

  it('includes a TODAY field in YYYY-MM-DD format', () => {
    const vars = profileToVars(makeProfile());
    expect(vars.TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── baseManagedFiles ──────────────────────────────────────────────────────────

describe('baseManagedFiles', () => {
  it('returns CLAUDE.md, settings.json, add.md, reflect.md for vscode', () => {
    const profile = makeProfile({ editor: 'vscode' });
    const vars = profileToVars(profile);
    const files = baseManagedFiles(vars, 'vscode');
    const paths = files.map(([rel]) => rel);
    expect(paths).toContain('CLAUDE.md');
    expect(paths).toContain('.claude/settings.json');
    expect(paths).toContain('.claude/commands/add.md');
    expect(paths).toContain('.claude/commands/reflect.md');
    expect(paths).not.toContain('.mcp.json');
  });

  it('includes .mcp.json when editor is obsidian and targetDir provided', () => {
    const profile = makeProfile({ editor: 'obsidian' });
    const vars = profileToVars(profile);
    const files = baseManagedFiles(vars, 'obsidian', tmp);
    const paths = files.map(([rel]) => rel);
    expect(paths).toContain('.mcp.json');
  });

  it('does NOT include .mcp.json when editor is obsidian but no targetDir', () => {
    const profile = makeProfile({ editor: 'obsidian' });
    const vars = profileToVars(profile);
    const files = baseManagedFiles(vars, 'obsidian');
    const paths = files.map(([rel]) => rel);
    expect(paths).not.toContain('.mcp.json');
  });

  it('.mcp.json vault path contains content_dir', () => {
    const profile = makeProfile({ editor: 'obsidian', content_dir: 'graph' });
    const vars = profileToVars(profile);
    const files = baseManagedFiles(vars, 'obsidian', tmp);
    const mcpEntry = files.find(([rel]) => rel === '.mcp.json');
    expect(mcpEntry).toBeDefined();
    const mcp = JSON.parse(mcpEntry![1]);
    const vaultPath = mcp.mcpServers.obsidian.args.at(-1) as string;
    expect(vaultPath).toContain('graph');
  });

  it('.mcp.json vault path uses forward slashes on all platforms', () => {
    const profile = makeProfile({ editor: 'obsidian', content_dir: 'graph' });
    const vars = profileToVars(profile);
    const files = baseManagedFiles(vars, 'obsidian', tmp);
    const mcpEntry = files.find(([rel]) => rel === '.mcp.json');
    expect(mcpEntry).toBeDefined();
    const mcp = JSON.parse(mcpEntry![1]);
    const vaultPath = mcp.mcpServers.obsidian.args.at(-1) as string;
    expect(vaultPath).not.toContain('\\');
  });

  it('CLAUDE.md content contains the user name', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles(vars, 'vscode');
    const claudeMd = files.find(([rel]) => rel === 'CLAUDE.md')!;
    expect(claudeMd[1]).toContain('Jane Doe');
  });

  it('CLAUDE.md content contains no unreplaced template variables', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles(vars, 'vscode');
    const claudeMd = files.find(([rel]) => rel === 'CLAUDE.md')!;
    expect(claudeMd[1]).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

// ── moduleManagedFiles ────────────────────────────────────────────────────────

describe('moduleManagedFiles — linkedin', () => {
  it('returns 8 files (7 commands + manifest)', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleManagedFiles('linkedin', vars);
    expect(files).toHaveLength(8);
  });

  it('includes all 7 li command files', () => {
    const vars = profileToVars(makeProfile());
    const paths = moduleManagedFiles('linkedin', vars).map(([rel]) => rel);
    for (const cmd of ['li-all', 'li-about', 'li-headline', 'li-experience', 'li-skills', 'li-featured', 'li-activity']) {
      expect(paths).toContain(`.claude/commands/${cmd}.md`);
    }
  });

  it('includes the manifest', () => {
    const vars = profileToVars(makeProfile());
    const paths = moduleManagedFiles('linkedin', vars).map(([rel]) => rel);
    expect(paths).toContain('.claude/modules/linkedin/manifest.md');
  });

  it('renders the content dir into command content', () => {
    const vars = profileToVars(makeProfile({ content_dir: 'graph' }));
    const files = moduleManagedFiles('linkedin', vars);
    const allContent = files.map(([, c]) => c).join('\n');
    expect(allContent).toContain('graph');
  });

  it('has no unreplaced template vars in any file', () => {
    const vars = profileToVars(makeProfile(), 'https://linkedin.com/in/jane');
    const files = moduleManagedFiles('linkedin', vars);
    for (const [rel, content] of files) {
      expect(content, rel).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
  });

  it('returns empty array for unknown module', () => {
    const vars = profileToVars(makeProfile());
    expect(moduleManagedFiles('unknown-module', vars)).toEqual([]);
  });
});

describe('moduleManagedFiles — resume', () => {
  it('returns 2 files (1 command + manifest)', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleManagedFiles('resume', vars);
    expect(files).toHaveLength(2);
  });

  it('includes resume-refresh command', () => {
    const vars = profileToVars(makeProfile());
    const paths = moduleManagedFiles('resume', vars).map(([rel]) => rel);
    expect(paths).toContain('.claude/commands/resume-refresh.md');
  });

  it('includes the manifest', () => {
    const vars = profileToVars(makeProfile());
    const paths = moduleManagedFiles('resume', vars).map(([rel]) => rel);
    expect(paths).toContain('.claude/modules/resume/manifest.md');
  });

  it('renders the content dir into command content', () => {
    const vars = profileToVars(makeProfile({ content_dir: 'graph' }));
    const files = moduleManagedFiles('resume', vars);
    const allContent = files.map(([, c]) => c).join('\n');
    expect(allContent).toContain('graph');
  });

  it('has no unreplaced template vars in any file', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleManagedFiles('resume', vars);
    for (const [rel, content] of files) {
      expect(content, rel).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
  });
});

// ── moduleContentFiles ────────────────────────────────────────────────────────

describe('moduleContentFiles — linkedin', () => {
  it('returns 8 content files', () => {
    const vars = profileToVars(makeProfile(), 'https://linkedin.com/in/jane');
    const files = moduleContentFiles('linkedin', vars, 'graph');
    expect(files).toHaveLength(8);
  });

  it('all paths are under graph/linkedin/', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleContentFiles('linkedin', vars, 'graph');
    for (const [rel] of files) {
      expect(rel.startsWith('graph/linkedin/')).toBe(true);
    }
  });

  it('respects a custom contentDir', () => {
    const vars = profileToVars(makeProfile({ content_dir: 'mywork' }));
    const files = moduleContentFiles('linkedin', vars, 'mywork');
    for (const [rel] of files) {
      expect(rel.startsWith('mywork/linkedin/')).toBe(true);
    }
  });

  it('includes INSTRUCTIONS.md', () => {
    const vars = profileToVars(makeProfile());
    const paths = moduleContentFiles('linkedin', vars, 'graph').map(([rel]) => rel);
    expect(paths).toContain('graph/linkedin/INSTRUCTIONS.md');
  });

  it('INSTRUCTIONS.md contains user name', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleContentFiles('linkedin', vars, 'graph');
    const instructions = files.find(([rel]) => rel === 'graph/linkedin/INSTRUCTIONS.md');
    expect(instructions).toBeDefined();
    expect(instructions![1]).toContain('Jane Doe');
  });

  it('has no unreplaced template vars in any file', () => {
    const vars = profileToVars(makeProfile(), 'https://linkedin.com/in/jane');
    const files = moduleContentFiles('linkedin', vars, 'graph');
    for (const [rel, content] of files) {
      expect(content, rel).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
  });

  it('returns empty array for unknown module', () => {
    const vars = profileToVars(makeProfile());
    expect(moduleContentFiles('unknown', vars, 'graph')).toEqual([]);
  });
});

describe('moduleContentFiles — resume', () => {
  it('returns 3 content files', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleContentFiles('resume', vars, 'graph');
    expect(files).toHaveLength(3);
  });

  it('all paths are under graph/resume/', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleContentFiles('resume', vars, 'graph');
    for (const [rel] of files) {
      expect(rel.startsWith('graph/resume/')).toBe(true);
    }
  });

  it('respects a custom contentDir', () => {
    const vars = profileToVars(makeProfile({ content_dir: 'mywork' }));
    const files = moduleContentFiles('resume', vars, 'mywork');
    for (const [rel] of files) {
      expect(rel.startsWith('mywork/resume/')).toBe(true);
    }
  });

  it('includes INSTRUCTIONS.md', () => {
    const vars = profileToVars(makeProfile());
    const paths = moduleContentFiles('resume', vars, 'graph').map(([rel]) => rel);
    expect(paths).toContain('graph/resume/INSTRUCTIONS.md');
  });

  it('INSTRUCTIONS.md contains user name', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleContentFiles('resume', vars, 'graph');
    const instructions = files.find(([rel]) => rel === 'graph/resume/INSTRUCTIONS.md');
    expect(instructions).toBeDefined();
    expect(instructions![1]).toContain('Jane Doe');
  });

  it('has no unreplaced template vars in any file', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleContentFiles('resume', vars, 'graph');
    for (const [rel, content] of files) {
      expect(content, rel).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
  });
});
