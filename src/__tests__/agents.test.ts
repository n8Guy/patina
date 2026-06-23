import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { claudeCodeAdapter } from '../agents/claude-code.js';
import { opencodeAdapter } from '../agents/opencode.js';
import { getAgent, AGENTS } from '../agents/registry.js';
import { profileToVars } from '../scaffold.js';
import type { Profile, TemplateVars } from '../types.js';

// Minimal profile for testing
function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    patina_name: 'test-patina',
    name: 'Jane Doe',
    title: 'Senior Designer',
    work: { self_employed: false, company_name: 'Acme Corp' },
    editor: 'vscode',
    modules: [],
    content_dir: 'graph',
    created: '2026-01-01',
    ...overrides,
  };
}

describe('agent registry', () => {
  it('returns claude-code adapter by default (undefined)', () => {
    expect(getAgent(undefined).agentId).toBe('claude-code');
  });

  it('returns claude-code adapter for "claude-code"', () => {
    expect(getAgent('claude-code').agentId).toBe('claude-code');
  });

  it('returns opencode adapter for "opencode"', () => {
    expect(getAgent('opencode').agentId).toBe('opencode');
  });

  it('falls back to claude-code for unknown ids', () => {
    expect(getAgent('unknown-agent' as never).agentId).toBe('claude-code');
  });

  it('AGENTS array contains both adapters', () => {
    const ids = AGENTS.map(a => a.agentId);
    expect(ids).toContain('claude-code');
    expect(ids).toContain('opencode');
  });
});

describe('claude-code adapter', () => {
  it('has correct path vars', () => {
    expect(claudeCodeAdapter.pathVars.AGENT_DIR).toBe('.claude');
    expect(claudeCodeAdapter.pathVars.AGENT_COMMANDS_DIR).toBe('.claude/commands');
    expect(claudeCodeAdapter.pathVars.AGENT_AGENTS_DIR).toBe('.claude/agents');
    expect(claudeCodeAdapter.pathVars.AGENT_SCRIPTS_DIR).toBe('.claude/scripts');
    expect(claudeCodeAdapter.pathVars.AGENT_MEMORY_FILE).toBe('CLAUDE.md');
    expect(claudeCodeAdapter.pathVars.AGENT_DISPLAY_NAME).toBe('Claude Code');
    expect(claudeCodeAdapter.pathVars.AGENT_CLI).toBe('claude');
  });

  it('archetypePath uses .claude/agents/', () => {
    expect(claudeCodeAdapter.archetypePath('hiring-manager')).toBe('.claude/agents/hiring-manager.md');
  });

  it('mapModuleManagedPaths is identity for .claude/ paths', () => {
    const paths = ['.claude/commands/li-all.md', '.claude/modules/linkedin/manifest.md'];
    expect(claudeCodeAdapter.mapModuleManagedPaths('linkedin', paths)).toEqual(paths);
  });

  it('mapModuleManagedFiles is identity', () => {
    const entries: Array<[string, string]> = [['.claude/commands/test.md', 'content']];
    const vars = profileToVars(makeProfile());
    expect(claudeCodeAdapter.mapModuleManagedFiles('test', entries, vars)).toEqual(entries);
  });

  it('renderUpdateCheckSection returns non-null string', () => {
    const vars = profileToVars(makeProfile());
    const result = claudeCodeAdapter.renderUpdateCheckSection(vars);
    expect(result).not.toBeNull();
    expect(typeof result).toBe('string');
    expect(result).toContain('Update check');
  });

  it('audiencePrefsGitignoreEntry returns .claude path', () => {
    expect(claudeCodeAdapter.audiencePrefsGitignoreEntry()).toBe('.claude/audience-prefs.json');
  });

  it('inboxRoutingPath returns .claude path', () => {
    expect(claudeCodeAdapter.inboxRoutingPath()).toBe('.claude/inbox-routing.md');
  });

  it('baseManagedPaths includes all expected claude paths', () => {
    const paths = claudeCodeAdapter.baseManagedPaths({ editor: 'other' });
    expect(paths).toContain('CLAUDE.md');
    expect(paths).toContain('.claude/settings.json');
    expect(paths).toContain('.claude/commands/add.md');
    expect(paths).toContain('.claude/inbox-routing.md');
    expect(paths).toContain('.claude/agents/hiring-manager.md');
    expect(paths).toContain('.claude/scripts/check-update.mjs');
  });

  it('baseManagedPaths includes .vscode/settings.json for vscode editor', () => {
    const paths = claudeCodeAdapter.baseManagedPaths({ editor: 'vscode' });
    expect(paths).toContain('.vscode/settings.json');
  });

  it('baseManagedPaths does NOT include .vscode/settings.json for other editor', () => {
    const paths = claudeCodeAdapter.baseManagedPaths({ editor: 'other' });
    expect(paths).not.toContain('.vscode/settings.json');
  });
});

describe('opencode adapter', () => {
  it('has correct path vars', () => {
    expect(opencodeAdapter.pathVars.AGENT_DIR).toBe('.opencode');
    expect(opencodeAdapter.pathVars.AGENT_COMMANDS_DIR).toBe('.opencode/commands');
    expect(opencodeAdapter.pathVars.AGENT_AGENTS_DIR).toBe('.opencode/agents');
    expect(opencodeAdapter.pathVars.AGENT_SCRIPTS_DIR).toBe('.opencode/scripts');
    expect(opencodeAdapter.pathVars.AGENT_MEMORY_FILE).toBe('AGENTS.md');
    expect(opencodeAdapter.pathVars.AGENT_DISPLAY_NAME).toBe('opencode');
    expect(opencodeAdapter.pathVars.AGENT_CLI).toBe('opencode');
  });

  it('archetypePath uses .opencode/agents/', () => {
    expect(opencodeAdapter.archetypePath('hiring-manager')).toBe('.opencode/agents/hiring-manager.md');
  });

  it('mapModuleManagedPaths rewrites .claude/ → .opencode/ with canonical plural dirs', () => {
    const paths = ['.claude/commands/li-all.md', '.claude/agents/recruiter.md', '.claude/modules/linkedin/manifest.md'];
    const result = opencodeAdapter.mapModuleManagedPaths('linkedin', paths);
    expect(result).toContain('.opencode/commands/li-all.md');
    expect(result).toContain('.opencode/agents/recruiter.md');
    expect(result).toContain('.opencode/modules/linkedin/manifest.md');
  });

  it('mapModuleManagedFiles is identity (module managedFiles already uses agent vars)', () => {
    const profile = makeProfile({ agent: 'opencode' });
    const vars = profileToVars(profile);
    const entries: Array<[string, string]> = [['.opencode/commands/test.md', 'content']];
    expect(opencodeAdapter.mapModuleManagedFiles('test', entries, vars)).toEqual(entries);
  });

  it('renderUpdateCheckSection returns null (no hooks in opencode v1)', () => {
    const vars = profileToVars(makeProfile({ agent: 'opencode' }));
    const result = opencodeAdapter.renderUpdateCheckSection(vars);
    expect(result).toBeNull();
  });

  it('audiencePrefsGitignoreEntry returns .opencode path', () => {
    expect(opencodeAdapter.audiencePrefsGitignoreEntry()).toBe('.opencode/audience-prefs.json');
  });

  it('inboxRoutingPath returns .opencode path', () => {
    expect(opencodeAdapter.inboxRoutingPath()).toBe('.opencode/inbox-routing.md');
  });

  it('baseManagedPaths includes all expected opencode paths', () => {
    const paths = opencodeAdapter.baseManagedPaths({ editor: 'other' });
    expect(paths).toContain('AGENTS.md');
    expect(paths).toContain('.opencode/commands/add.md');
    expect(paths).toContain('.opencode/inbox-routing.md');
    expect(paths).toContain('.opencode/agents/hiring-manager.md');
    expect(paths).toContain('.opencode/scripts/staleness-check.mjs');
  });

  it('baseManagedPaths does NOT include .claude/ paths', () => {
    const paths = opencodeAdapter.baseManagedPaths({ editor: 'other' });
    for (const p of paths) {
      expect(p).not.toMatch(/^\.claude\//);
    }
  });

  it('baseManagedPaths does NOT include settings.json (no claude settings for opencode)', () => {
    const paths = opencodeAdapter.baseManagedPaths({ editor: 'other' });
    expect(paths).not.toContain('.opencode/settings.json');
  });
});

describe('profileToVars includes agent path tokens', () => {
  it('includes all AGENT_* vars for claude-code', () => {
    const vars = profileToVars(makeProfile({ agent: 'claude-code' }));
    expect(vars.AGENT_DIR).toBe('.claude');
    expect(vars.AGENT_COMMANDS_DIR).toBe('.claude/commands');
    expect(vars.AGENT_AGENTS_DIR).toBe('.claude/agents');
    expect(vars.AGENT_SCRIPTS_DIR).toBe('.claude/scripts');
    expect(vars.AGENT_MEMORY_FILE).toBe('CLAUDE.md');
    expect(vars.AGENT_DISPLAY_NAME).toBe('Claude Code');
    expect(vars.AGENT_CLI).toBe('claude');
  });

  it('includes all AGENT_* vars for opencode', () => {
    const vars = profileToVars(makeProfile({ agent: 'opencode' }));
    expect(vars.AGENT_DIR).toBe('.opencode');
    expect(vars.AGENT_COMMANDS_DIR).toBe('.opencode/commands');
    expect(vars.AGENT_AGENTS_DIR).toBe('.opencode/agents');
    expect(vars.AGENT_SCRIPTS_DIR).toBe('.opencode/scripts');
    expect(vars.AGENT_MEMORY_FILE).toBe('AGENTS.md');
    expect(vars.AGENT_DISPLAY_NAME).toBe('opencode');
    expect(vars.AGENT_CLI).toBe('opencode');
  });

  it('defaults to claude-code when agent is undefined', () => {
    const vars = profileToVars(makeProfile()); // no agent field
    expect(vars.AGENT_DIR).toBe('.claude');
    expect(vars.AGENT_MEMORY_FILE).toBe('CLAUDE.md');
  });

  it('UPDATE_CHECK_SECTION is empty string for opencode', () => {
    const vars = profileToVars(makeProfile({ agent: 'opencode' }));
    expect(vars.UPDATE_CHECK_SECTION).toBe('');
  });

  it('UPDATE_CHECK_SECTION is non-empty for claude-code', () => {
    const vars = profileToVars(makeProfile({ agent: 'claude-code' }));
    expect(vars.UPDATE_CHECK_SECTION).toBeTruthy();
    expect(vars.UPDATE_CHECK_SECTION).toContain('Update check');
  });
});

describe('opencode baseManagedFiles content', () => {
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'patina-agents-test-'));
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it('emits AGENTS.md not CLAUDE.md', () => {
    const profile = makeProfile({ agent: 'opencode' });
    const vars = profileToVars(profile);
    const files = opencodeAdapter.baseManagedFiles(vars, { editor: 'other', modules: [] });
    const paths = files.map(([p]) => p);
    expect(paths).toContain('AGENTS.md');
    expect(paths).not.toContain('CLAUDE.md');
  });

  it('emits .opencode/commands/ not .claude/commands/', () => {
    const profile = makeProfile({ agent: 'opencode' });
    const vars = profileToVars(profile);
    const files = opencodeAdapter.baseManagedFiles(vars, { editor: 'other', modules: [] });
    const paths = files.map(([p]) => p);
    for (const p of paths) {
      expect(p).not.toMatch(/^\.claude\//);
    }
    expect(paths.some(p => p.startsWith('.opencode/'))).toBe(true);
  });

  it('does NOT emit settings.json', () => {
    const profile = makeProfile({ agent: 'opencode' });
    const vars = profileToVars(profile);
    const files = opencodeAdapter.baseManagedFiles(vars, { editor: 'other', modules: [] });
    const paths = files.map(([p]) => p);
    expect(paths).not.toContain('.opencode/settings.json');
    expect(paths).not.toContain('.claude/settings.json');
  });

  it('AGENTS.md content has no unreplaced template tokens', () => {
    const profile = makeProfile({ agent: 'opencode' });
    const vars = profileToVars(profile);
    const files = opencodeAdapter.baseManagedFiles(vars, { editor: 'other', modules: [] });
    const agentsMd = files.find(([p]) => p === 'AGENTS.md')?.[1] ?? '';
    expect(agentsMd).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });

  it('archetypeFiles uses .opencode/agents/ paths', () => {
    const profile = makeProfile({ agent: 'opencode' });
    const vars = profileToVars(profile);
    const files = opencodeAdapter.archetypeFiles(vars);
    for (const [p] of files) {
      expect(p).toMatch(/^\.opencode\/agents\//);
    }
  });
});
