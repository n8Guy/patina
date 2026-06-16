import { describe, it, expect } from 'vitest';
import { MANAGED_FILES, SEED_FILES } from '../checksums.js';

describe('MANAGED_FILES registry', () => {
  it('contains core managed files', () => {
    expect(MANAGED_FILES).toContain('CLAUDE.md');
    expect(MANAGED_FILES).toContain('README.md');
    expect(MANAGED_FILES).toContain('.claude/settings.json');
    expect(MANAGED_FILES).toContain('.claude/commands/add.md');
    expect(MANAGED_FILES).toContain('.claude/commands/reflect.md');
    expect(MANAGED_FILES).toContain('.claude/commands/inbox.md');
    expect(MANAGED_FILES).toContain('.claude/commands/status.md');
    expect(MANAGED_FILES).toContain('.claude/commands/guide.md');
    expect(MANAGED_FILES).toContain('.claude/inbox-routing.md');
  });

  it('contains the predefined audience archetype paths', () => {
    expect(MANAGED_FILES).toContain('.claude/agents/hiring-manager.md');
    expect(MANAGED_FILES).toContain('.claude/agents/recruiter.md');
  });

  it('does not contain seed-once files', () => {
    expect(MANAGED_FILES).not.toContain('CUSTOM.md');
    expect(MANAGED_FILES).not.toContain('inbox/.gitkeep');
    expect(MANAGED_FILES).not.toContain('inbox/.processed.json');
  });
});

describe('SEED_FILES registry', () => {
  it('contains seed-once files', () => {
    expect(SEED_FILES).toContain('CUSTOM.md');
    expect(SEED_FILES).toContain('inbox/.gitkeep');
    expect(SEED_FILES).toContain('inbox/.processed.json');
  });

  it('does not overlap with MANAGED_FILES', () => {
    const managed = new Set(MANAGED_FILES);
    for (const f of SEED_FILES) {
      expect((managed as Set<string>).has(f), `${f} should not be in both MANAGED_FILES and SEED_FILES`).toBe(false);
    }
  });
});
