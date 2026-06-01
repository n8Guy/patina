import { describe, it, expect } from 'vitest';
import {
  availableLaunchTasks,
  renderLaunchSection,
  pruneLaunchTasks,
  launchSelectionError,
} from '../launch-tasks.js';

// ── availableLaunchTasks ──────────────────────────────────────────────────────

describe('availableLaunchTasks', () => {
  it('returns only base/* ids when no modules installed', () => {
    const tasks = availableLaunchTasks([]);
    expect(tasks.every(t => t.nsId.startsWith('base/'))).toBe(true);
    expect(tasks.length).toBeGreaterThan(0);
  });

  it('includes base tasks when modules installed', () => {
    const tasks = availableLaunchTasks(['linkedin']);
    const baseIds = tasks.filter(t => t.source === 'base').map(t => t.nsId);
    expect(baseIds.length).toBeGreaterThan(0);
  });

  it('includes linkedin/open-drafts when linkedin module installed', () => {
    const tasks = availableLaunchTasks(['linkedin']);
    const nsIds = tasks.map(t => t.nsId);
    expect(nsIds).toContain('linkedin/open-drafts');
  });

  it('includes resume/resume-stale-check when resume module installed', () => {
    const tasks = availableLaunchTasks(['resume']);
    const nsIds = tasks.map(t => t.nsId);
    expect(nsIds).toContain('resume/resume-stale-check');
  });

  it('does not include module tasks when that module is not installed', () => {
    const tasks = availableLaunchTasks([]);
    const nsIds = tasks.map(t => t.nsId);
    expect(nsIds).not.toContain('linkedin/open-drafts');
    expect(nsIds).not.toContain('resume/resume-stale-check');
  });

  it('source field is "base" for base tasks', () => {
    const tasks = availableLaunchTasks([]);
    for (const t of tasks) {
      expect(t.source).toBe('base');
    }
  });

  it('source field is module id for module tasks', () => {
    const tasks = availableLaunchTasks(['linkedin']);
    const liTask = tasks.find(t => t.nsId === 'linkedin/open-drafts');
    expect(liTask?.source).toBe('linkedin');
  });
});

// ── renderLaunchSection ───────────────────────────────────────────────────────

describe('renderLaunchSection', () => {
  it('returns null when selectedNsIds is undefined', () => {
    expect(renderLaunchSection(undefined, [])).toBeNull();
  });

  it('returns null when selectedNsIds is empty array', () => {
    expect(renderLaunchSection([], [])).toBeNull();
  });

  it('returns a string containing the task template when a valid id is selected', () => {
    const result = renderLaunchSection(['base/today-focus'], []);
    expect(result).not.toBeNull();
    expect(result).toContain('Ask the user what they want to focus on today');
  });

  it('includes ## Launch tasks heading', () => {
    const result = renderLaunchSection(['base/today-focus'], []);
    expect(result).toContain('## Launch tasks');
  });

  it('drops orphaned ids (module not installed) and returns null if all drop', () => {
    const result = renderLaunchSection(['linkedin/open-drafts'], []);
    expect(result).toBeNull();
  });

  it('drops orphaned ids but keeps valid ones', () => {
    const result = renderLaunchSection(['base/today-focus', 'linkedin/open-drafts'], []);
    expect(result).not.toBeNull();
    expect(result).toContain('Ask the user what they want to focus on today');
    expect(result).not.toContain('LinkedIn');
  });

  it('includes linkedin task template when linkedin is installed', () => {
    const result = renderLaunchSection(['linkedin/open-drafts'], ['linkedin']);
    expect(result).not.toBeNull();
    expect(result).toContain('LinkedIn section drafts');
  });

  it('includes {{CONTENT_DIR}} placeholder in templates that use it (pre-expansion)', () => {
    const result = renderLaunchSection(['base/recent-notes'], []);
    expect(result).toContain('{{CONTENT_DIR}}');
  });
});

// ── pruneLaunchTasks ──────────────────────────────────────────────────────────

describe('pruneLaunchTasks', () => {
  it('returns empty array when selectedNsIds is undefined', () => {
    expect(pruneLaunchTasks(undefined, [])).toEqual([]);
  });

  it('returns empty array when selectedNsIds is empty', () => {
    expect(pruneLaunchTasks([], [])).toEqual([]);
  });

  it('keeps base tasks regardless of module list', () => {
    expect(pruneLaunchTasks(['base/today-focus'], [])).toEqual(['base/today-focus']);
  });

  it('drops module task when module is not installed', () => {
    const result = pruneLaunchTasks(['linkedin/open-drafts', 'base/today-focus'], []);
    expect(result).toEqual(['base/today-focus']);
  });

  it('keeps module task when module is installed', () => {
    const result = pruneLaunchTasks(['linkedin/open-drafts', 'base/today-focus'], ['linkedin']);
    expect(result).toContain('linkedin/open-drafts');
    expect(result).toContain('base/today-focus');
  });

  it('drops unknown ids entirely', () => {
    const result = pruneLaunchTasks(['unknown/task', 'base/today-focus'], []);
    expect(result).toEqual(['base/today-focus']);
  });
});

// ── launchSelectionError ──────────────────────────────────────────────────────

describe('launchSelectionError', () => {
  it('returns undefined for empty array', () => {
    expect(launchSelectionError([])).toBeUndefined();
  });

  it('returns undefined for exactly 5 items', () => {
    expect(launchSelectionError(['a', 'b', 'c', 'd', 'e'])).toBeUndefined();
  });

  it('returns an error string for 6 items', () => {
    const err = launchSelectionError(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(typeof err).toBe('string');
    expect(err!.length).toBeGreaterThan(0);
  });

  it('returns an error string for more than 6 items', () => {
    const err = launchSelectionError(['a', 'b', 'c', 'd', 'e', 'f', 'g']);
    expect(typeof err).toBe('string');
  });
});
