/**
 * Tests for the set-agent operation — switching agents on an existing patina.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, writeFileSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import * as yaml from 'js-yaml';
import { scaffold } from '../scaffold.js';
import { planSetAgent, applySetAgent } from '../set-agent.js';
import type { Profile, ScaffoldOptions } from '../types.js';

let tmp: string;
let targetDir: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-set-agent-test-'));
  targetDir = join(tmp, 'my-patina');
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function claudeOpts(overrides: Partial<ScaffoldOptions> = {}): ScaffoldOptions {
  return {
    targetDir,
    patinaName: 'test-patina',
    userName: 'Jane Doe',
    title: 'Senior Designer',
    roleDescription: 'I design product experiences.',
    jobDescriptionUrl: '',
    work: { self_employed: false, company_name: 'Acme Corp' },
    editor: 'other',
    agent: 'claude-code',
    modules: [],
    liProfileUrl: '',
    contentDir: 'graph',
    ...overrides,
  };
}

function loadProfile(): Profile {
  const content = readFileSync(join(targetDir, 'profile.yaml'), 'utf8');
  return yaml.load(content) as Profile;
}

function exists(rel: string): boolean {
  return existsSync(join(targetDir, rel));
}

describe('planSetAgent — claude-code → opencode', () => {
  beforeEach(async () => {
    await scaffold(claudeOpts());
  });

  it('builds a plan with correct fromAgent / toAgent', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    expect(plan.fromAgent).toBe('claude-code');
    expect(plan.toAgent).toBe('opencode');
  });

  it('plan.toRemove includes .claude/ files', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    expect(plan.toRemove.some(p => p.startsWith('.claude/'))).toBe(true);
    expect(plan.toRemove).toContain('CLAUDE.md');
  });

  it('plan.toAdd includes .opencode/ files', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    expect(plan.toAdd.some(([p]) => p.startsWith('.opencode/'))).toBe(true);
    expect(plan.toAdd.some(([p]) => p === 'AGENTS.md')).toBe(true);
  });

  it('plan.toAdd does not include .claude/ files', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    for (const [p] of plan.toAdd) {
      expect(p).not.toMatch(/^\.claude\//);
    }
  });

  it('plan respects user-owned files (not marked managed)', () => {
    // Write a user-owned file (no patina: managed frontmatter)
    const userFile = join(targetDir, '.claude/commands/custom.md');
    mkdirSync(dirname(userFile), { recursive: true });
    writeFileSync(userFile, '# My custom command\nDo something custom.\n', 'utf8');

    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');

    // custom.md should NOT be in toRemove (it's user-owned)
    expect(plan.toRemove).not.toContain('.claude/commands/custom.md');
    // It should be in kept
    expect(plan.kept).toContain('.claude/commands/custom.md');
  });

  it('plan includes managed-set files in toRemove even when patina: managed marker is absent (legacy patinas)', () => {
    // Simulate a pre-marker install: strip patina: managed from add.md so it looks user-owned
    const addMd = join(targetDir, '.claude/commands/add.md');
    const content = readFileSync(addMd, 'utf8');
    writeFileSync(addMd, content.replace(/^---\s*\npatina: managed\s*\n---\s*\n/, ''), 'utf8');

    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');

    // add.md is a canonical managed path — must be removed even without the marker
    expect(plan.toRemove).toContain('.claude/commands/add.md');
    expect(plan.kept).not.toContain('.claude/commands/add.md');
  });
});

describe('applySetAgent — claude-code → opencode', () => {
  beforeEach(async () => {
    await scaffold(claudeOpts());
  });

  it('removes .claude/ managed files', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    expect(exists('.claude/commands/add.md')).toBe(false);
    expect(exists('.claude/settings.json')).toBe(false);
  });

  it('creates .opencode/ files', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    expect(exists('.opencode/commands/add.md')).toBe(true);
    expect(exists('AGENTS.md')).toBe(true);
  });

  it('does not remove user-owned .claude/ files', () => {
    // Write a user-owned file
    const userFile = join(targetDir, '.claude/commands/custom.md');
    writeFileSync(userFile, '# My custom command\n', 'utf8');

    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    // custom.md should still exist
    expect(exists('.claude/commands/custom.md')).toBe(true);
  });

  it('removes legacy .claude/ managed files that lack patina: managed marker', () => {
    // Strip the managed marker from add.md to simulate a pre-marker install
    const addMd = join(targetDir, '.claude/commands/add.md');
    const content = readFileSync(addMd, 'utf8');
    writeFileSync(addMd, content.replace(/^---\s*\npatina: managed\s*\n---\s*\n/, ''), 'utf8');

    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    expect(exists('.claude/commands/add.md')).toBe(false);
  });

  it('seeds CUSTOM.md if absent', () => {
    rmSync(join(targetDir, 'CUSTOM.md'), { force: true });

    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    expect(exists('CUSTOM.md')).toBe(true);
  });

  it('force-writes README.md even when patina: managed marker is absent', () => {
    // Strip the marker from README.md to simulate a legacy install
    const readmePath = join(targetDir, 'README.md');
    const content = readFileSync(readmePath, 'utf8');
    writeFileSync(readmePath, content.replace(/^---\s*\npatina: managed\s*\n---\s*\n/, ''), 'utf8');

    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    // README.md must reference AGENTS.md after switching to opencode
    expect(readFileSync(join(targetDir, 'README.md'), 'utf8')).toContain('AGENTS.md');
  });

  it('updates profile.yaml to agent: opencode', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    const updated = loadProfile();
    expect(updated.agent).toBe('opencode');
  });

  it('updates .gitignore audience-prefs entry', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    const gitignore = readFileSync(join(targetDir, '.gitignore'), 'utf8');
    expect(gitignore).toContain('.opencode/audience-prefs.json');
    expect(gitignore).not.toContain('.claude/audience-prefs.json');
  });

  it('graph/ content is untouched', () => {
    // Write a graph note
    const noteDir = join(targetDir, 'graph/notes');
    mkdirSync(noteDir, { recursive: true });
    writeFileSync(join(noteDir, 'my-note.md'), '# My Note\nSome content.\n', 'utf8');

    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    // Note should still exist
    expect(exists('graph/notes/my-note.md')).toBe(true);
    expect(readFileSync(join(targetDir, 'graph/notes/my-note.md'), 'utf8')).toContain('My Note');
  });

  it('.patina-state.json is preserved', () => {
    // state file should still exist after switch
    expect(exists('.patina-state.json')).toBe(true);
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);
    expect(exists('.patina-state.json')).toBe(true);
  });
});

describe('applySetAgent — opencode → claude-code (reverse)', () => {
  beforeEach(async () => {
    await scaffold({ ...claudeOpts(), agent: 'opencode' });
  });

  it('removes .opencode/ managed files', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'claude-code');
    applySetAgent(targetDir, profile, plan);

    expect(exists('.opencode/commands/add.md')).toBe(false);
    expect(exists('AGENTS.md')).toBe(false);
  });

  it('creates .claude/ files', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'claude-code');
    applySetAgent(targetDir, profile, plan);

    expect(exists('.claude/commands/add.md')).toBe(true);
    expect(exists('CLAUDE.md')).toBe(true);
    expect(exists('.claude/settings.json')).toBe(true);
  });

  it('updates profile.yaml to agent: claude-code', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'claude-code');
    applySetAgent(targetDir, profile, plan);

    const updated = loadProfile();
    expect(updated.agent).toBe('claude-code');
  });
});

describe('planSetAgent — self-switch guard', () => {
  beforeEach(async () => {
    await scaffold(claudeOpts());
  });

  it('returns empty plan when switching to the same agent', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'claude-code');
    expect(plan.fromAgent).toBe('claude-code');
    expect(plan.toAgent).toBe('claude-code');
    expect(plan.toRemove).toHaveLength(0);
    expect(plan.toAdd).toHaveLength(0);
    expect(plan.kept).toHaveLength(0);
  });
});

describe('planSetAgent — diff dedup (shared paths not shown as both - and +)', () => {
  beforeEach(async () => {
    await scaffold(claudeOpts({ editor: 'vscode' }));
  });

  it('README.md does not appear in both toRemove and toAdd', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    const inRemove = plan.toRemove.includes('README.md');
    const inAdd = plan.toAdd.some(([p]) => p === 'README.md');
    // README.md is shared — it should NOT appear in both toRemove and toAdd
    expect(inRemove && inAdd).toBe(false);
  });

  it('.vscode/settings.json does not appear in both toRemove and toAdd', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    const inRemove = plan.toRemove.includes('.vscode/settings.json');
    const inAdd = plan.toAdd.some(([p]) => p === '.vscode/settings.json');
    expect(inRemove && inAdd).toBe(false);
  });
});

describe('applySetAgent with modules — files move .claude/ → .opencode/', () => {
  beforeEach(async () => {
    await scaffold(claudeOpts({ modules: ['work'] }));
  });

  it('module managed files move from .claude/modules/ to .opencode/modules/', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    expect(exists('.opencode/modules/work/CLAUDE.md')).toBe(true);
    expect(exists('.claude/modules/work/CLAUDE.md')).toBe(false);
  });

  it('module command files move from .claude/commands/ to .opencode/commands/', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    expect(exists('.opencode/commands/work-check.md')).toBe(true);
    expect(exists('.claude/commands/work-check.md')).toBe(false);
  });

  it('and switching back moves .opencode/ back to .claude/', () => {
    const profile = loadProfile();
    const plan = planSetAgent(targetDir, profile, 'opencode');
    applySetAgent(targetDir, profile, plan);

    const updatedProfile = loadProfile();
    const backPlan = planSetAgent(targetDir, updatedProfile, 'claude-code');
    applySetAgent(targetDir, updatedProfile, backPlan);

    expect(exists('.claude/modules/work/CLAUDE.md')).toBe(true);
    expect(exists('.opencode/modules')).toBe(false);
  });
});

describe('planSetAgent — legacy profile (agent field absent)', () => {
  beforeEach(async () => {
    await scaffold(claudeOpts());
  });

  it('defaults fromAgent to claude-code when profile.agent is undefined', () => {
    const profile = loadProfile();
    const legacyProfile: Profile = { ...profile, agent: undefined };
    const plan = planSetAgent(targetDir, legacyProfile, 'opencode');
    expect(plan.fromAgent).toBe('claude-code');
    expect(plan.toAgent).toBe('opencode');
    expect(plan.toRemove.length).toBeGreaterThan(0);
    expect(plan.toAdd.length).toBeGreaterThan(0);
  });

  it('applies the switch correctly from a legacy profile', () => {
    const profile = loadProfile();
    const legacyProfile: Profile = { ...profile, agent: undefined };
    const plan = planSetAgent(targetDir, legacyProfile, 'opencode');
    applySetAgent(targetDir, legacyProfile, plan);
    expect(exists('.opencode/commands/add.md')).toBe(true);
    expect(exists('AGENTS.md')).toBe(true);
    expect(exists('.claude/commands/add.md')).toBe(false);
  });
});
