import { describe, it, expect } from 'vitest';
import { profileToVars, baseManagedFiles, moduleManagedFiles, moduleContentFiles, buildGuideCommands } from '../scaffold.js';
import type { Profile } from '../types.js';

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

  it('defaults STALENESS_THRESHOLD to "30" when not set', () => {
    const vars = profileToVars(makeProfile());
    expect(vars.STALENESS_THRESHOLD).toBe('30');
  });

  it('uses staleness_threshold_days from profile when set', () => {
    const profile = makeProfile({ staleness_threshold_days: 60 });
    const vars = profileToVars(profile);
    expect(vars.STALENESS_THRESHOLD).toBe('60');
  });

  it('falls back to "30" for negative staleness_threshold_days', () => {
    const profile = makeProfile({ staleness_threshold_days: -5 });
    const vars = profileToVars(profile);
    expect(vars.STALENESS_THRESHOLD).toBe('30');
  });

  it('falls back to "30" for zero staleness_threshold_days', () => {
    const profile = makeProfile({ staleness_threshold_days: 0 });
    const vars = profileToVars(profile);
    expect(vars.STALENESS_THRESHOLD).toBe('30');
  });

  it('MODULES_SECTION is non-empty string', () => {
    const vars = profileToVars(makeProfile());
    expect(typeof vars.MODULES_SECTION).toBe('string');
    expect(vars.MODULES_SECTION.length).toBeGreaterThan(0);
  });

  it('MODULES_SECTION returns placeholder when no modules installed', () => {
    const vars = profileToVars(makeProfile({ modules: [] }));
    expect(vars.MODULES_SECTION).toBe('_No modules installed._');
  });

  it('MODULES_SECTION contains linkedin link when linkedin module active', () => {
    const vars = profileToVars(makeProfile({ modules: ['linkedin'] }));
    expect(vars.MODULES_SECTION).toContain('LinkedIn');
    expect(vars.MODULES_SECTION).toContain('.claude/modules/linkedin/CLAUDE.md');
  });

  it('COMMANDS_SECTION always includes the core commands', () => {
    const vars = profileToVars(makeProfile({ modules: [] }));
    expect(vars.COMMANDS_SECTION).toContain('/add');
    expect(vars.COMMANDS_SECTION).toContain('/reflect');
    expect(vars.COMMANDS_SECTION).toContain('/inbox');
    expect(vars.COMMANDS_SECTION).toContain('/guide');
  });

  it('COMMANDS_SECTION lists module commands when a module is installed', () => {
    const vars = profileToVars(makeProfile({ modules: ['goals'] }));
    expect(vars.COMMANDS_SECTION).toContain('/goal');
    expect(vars.COMMANDS_SECTION).toContain('/goal-review');
  });

  it('COMMANDS_SECTION omits module commands when no modules installed', () => {
    const vars = profileToVars(makeProfile({ modules: [] }));
    expect(vars.COMMANDS_SECTION).not.toContain('/goal');
    expect(vars.COMMANDS_SECTION).not.toContain('/li-');
  });

  it('GUIDE_COMMANDS contains core commands', () => {
    const vars = profileToVars(makeProfile({ modules: [] }));
    expect(vars.GUIDE_COMMANDS).toContain('/add');
    expect(vars.GUIDE_COMMANDS).toContain('/reflect');
    expect(vars.GUIDE_COMMANDS).toContain('/inbox');
    expect(vars.GUIDE_COMMANDS).toContain('/guide');
  });

  it('GUIDE_COMMANDS includes module commands when modules installed', () => {
    const vars = profileToVars(makeProfile({ modules: ['linkedin', 'goals'] }));
    expect(vars.GUIDE_COMMANDS).toContain('/li-all');
    expect(vars.GUIDE_COMMANDS).toContain('/goal');
    expect(vars.GUIDE_COMMANDS).toContain('LinkedIn');
    expect(vars.GUIDE_COMMANDS).toContain('Goals');
  });

  it('GUIDE_COMMANDS omits module commands when no modules installed', () => {
    const vars = profileToVars(makeProfile({ modules: [] }));
    expect(vars.GUIDE_COMMANDS).not.toContain('/li-');
    expect(vars.GUIDE_COMMANDS).not.toContain('/goal');
  });
});

describe('buildGuideCommands', () => {
  it('contains all four core commands', () => {
    const out = buildGuideCommands([]);
    expect(out).toContain('/add');
    expect(out).toContain('/reflect');
    expect(out).toContain('/inbox');
    expect(out).toContain('/guide');
  });

  it('includes module label and commands when modules provided', () => {
    const out = buildGuideCommands(['goals']);
    expect(out).toContain('**Goals**');
    expect(out).toContain('/goal ');
    expect(out).toContain('/goal-review');
  });

  it('output is blockquote-formatted (every line starts with >)', () => {
    const out = buildGuideCommands([]);
    expect(out.length).toBeGreaterThan(0);
    expect(out.split('\n').every(l => l.startsWith('>'))).toBe(true);
  });

  it('separates module section with a blank blockquote line', () => {
    const out = buildGuideCommands(['resume']);
    expect(out).toContain('\n>\n>');
  });
});

// ── baseManagedFiles ──────────────────────────────────────────────────────────

describe('baseManagedFiles', () => {
  it('returns base command files for vscode', () => {
    const profile = makeProfile({ editor: 'vscode' });
    const vars = profileToVars(profile);
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const paths = files.map(([rel]) => rel);
    expect(paths).toContain('README.md');
    expect(paths).toContain('CLAUDE.md');
    expect(paths).toContain('.claude/settings.json');
    expect(paths).toContain('.claude/commands/add.md');
    expect(paths).toContain('.claude/commands/reflect.md');
    expect(paths).toContain('.claude/commands/guide.md');
    expect(paths).not.toContain('.mcp.json');
  });

  it('does not include .mcp.json for obsidian editor', () => {
    const profile = makeProfile({ editor: 'obsidian' });
    const vars = profileToVars(profile);
    const files = baseManagedFiles({ vars, editor: 'obsidian' });
    const paths = files.map(([rel]) => rel);
    expect(paths).not.toContain('.mcp.json');
  });

  it('includes inbox.md command but not inbox seed files', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const paths = files.map(([rel]) => rel);
    // inbox.md is a managed command file
    expect(paths).toContain('.claude/commands/inbox.md');
    // inbox/.gitkeep and inbox/.processed.json are seed-once files, not in baseManagedFiles
    expect(paths).not.toContain('inbox/.gitkeep');
    expect(paths).not.toContain('inbox/.processed.json');
  });

  it('inbox.md has no unreplaced template variables', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const inboxMd = files.find(([rel]) => rel === '.claude/commands/inbox.md');
    expect(inboxMd).toBeDefined();
    expect(inboxMd![1]).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('guide.md has no unreplaced template variables', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const guideMd = files.find(([rel]) => rel === '.claude/commands/guide.md');
    expect(guideMd).toBeDefined();
    expect(guideMd![1]).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('README.md content carries patina: managed frontmatter', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const readmeEntry = files.find(([rel]) => rel === 'README.md')!;
    expect(readmeEntry[1]).toMatch(/^---\s*\npatina: managed\s*\n---/);
    // No fence comments in new model
    expect(readmeEntry[1]).not.toContain('<!-- patina:base:start -->');
  });

  it('README.md content has no unreplaced template variables', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const readmeEntry = files.find(([rel]) => rel === 'README.md')!;
    expect(readmeEntry[1]).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('CLAUDE.md content contains the user name', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const claudeMd = files.find(([rel]) => rel === 'CLAUDE.md')!;
    expect(claudeMd[1]).toContain('Jane Doe');
  });

  it('CLAUDE.md content contains no unreplaced template variables', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const claudeMd = files.find(([rel]) => rel === 'CLAUDE.md')!;
    expect(claudeMd[1]).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('staleness-check.mjs renders custom staleness threshold', () => {
    const profile = makeProfile({ staleness_threshold_days: 60 });
    const vars = profileToVars(profile);
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const script = files.find(([rel]) => rel === '.claude/scripts/staleness-check.mjs')!;
    expect(script[1]).toContain("'60'");
    expect(script[1]).not.toContain("'30'");
  });

  it('staleness-check.mjs renders default staleness threshold when not set', () => {
    const vars = profileToVars(makeProfile());
    const files = baseManagedFiles({ vars, editor: 'vscode' });
    const script = files.find(([rel]) => rel === '.claude/scripts/staleness-check.mjs')!;
    expect(script[1]).toContain("'30'");
  });
});

// ── moduleManagedFiles ────────────────────────────────────────────────────────

describe('moduleManagedFiles — linkedin', () => {
  it('returns 9 files (7 commands + manifest + CLAUDE.md)', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleManagedFiles('linkedin', vars);
    expect(files).toHaveLength(9);
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

  it('includes CLAUDE.md at .claude/modules/linkedin/CLAUDE.md', () => {
    const vars = profileToVars(makeProfile());
    const paths = moduleManagedFiles('linkedin', vars).map(([rel]) => rel);
    expect(paths).toContain('.claude/modules/linkedin/CLAUDE.md');
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
  it('returns 3 files (1 command + CLAUDE.md + manifest)', () => {
    const vars = profileToVars(makeProfile());
    const files = moduleManagedFiles('resume', vars);
    expect(files).toHaveLength(3);
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

  it('includes CLAUDE.md at .claude/modules/resume/CLAUDE.md', () => {
    const vars = profileToVars(makeProfile());
    const paths = moduleManagedFiles('resume', vars).map(([rel]) => rel);
    expect(paths).toContain('.claude/modules/resume/CLAUDE.md');
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
