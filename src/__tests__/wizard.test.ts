import { describe, it, expect } from 'vitest';
import { slugify, defaultSnoozeUntil, snoozeUntilFor, addDeferredModule, clearDeferredModule } from '../wizard.js';
import type { PatinaState } from '../state.js';

// The wizard's interactive prompts can't be unit-tested directly,
// but the pure logic functions can.

describe('slugify', () => {
  it('lowercases input', () => {
    expect(slugify('Patina')).toBe('patina');
  });

  it('replaces spaces with hyphens', () => {
    expect(slugify('my patina')).toBe('my-patina');
  });

  it('replaces multiple consecutive special chars with a single hyphen', () => {
    expect(slugify('hello   world')).toBe('hello-world');
  });

  it('strips leading and trailing hyphens', () => {
    expect(slugify('  patina  ')).toBe('patina');
  });

  it('handles special characters', () => {
    expect(slugify("Jane's Patina!")).toBe('jane-s-patina');
  });

  it('falls back to "patina" for empty or whitespace-only input', () => {
    expect(slugify('')).toBe('patina');
    expect(slugify('   ')).toBe('patina');
  });

  it('handles already-valid slugs unchanged', () => {
    expect(slugify('my-patina')).toBe('my-patina');
  });
});

// ── defaultSnoozeUntil ────────────────────────────────────────────────────────

describe('defaultSnoozeUntil', () => {
  it('returns a date 7 days from the given today', () => {
    expect(defaultSnoozeUntil('2026-06-03')).toBe('2026-06-10');
  });
});

// ── snoozeUntilFor ────────────────────────────────────────────────────────────

describe('snoozeUntilFor', () => {
  it('1w adds 7 days', () => {
    expect(snoozeUntilFor('1w', '2026-06-03')).toBe('2026-06-10');
  });

  it('1m adds one calendar month', () => {
    expect(snoozeUntilFor('1m', '2026-06-03')).toBe('2026-07-03');
  });

  it('3m adds three calendar months', () => {
    expect(snoozeUntilFor('3m', '2026-06-03')).toBe('2026-09-03');
  });

  it('1m clamps Jan 31 to Feb 28', () => {
    expect(snoozeUntilFor('1m', '2026-01-31')).toBe('2026-02-28');
  });
});

// ── addDeferredModule ─────────────────────────────────────────────────────────

describe('addDeferredModule', () => {
  const baseState: PatinaState = {};

  it('appends a new entry when none exists', () => {
    const result = addDeferredModule(baseState, 'linkedin', '2026-06-10');
    expect(result.deferred_modules).toEqual([
      { module: 'linkedin', snooze_until: '2026-06-10' },
    ]);
  });

  it('replaces an existing entry for the same module (upsert)', () => {
    const state: PatinaState = {
      deferred_modules: [{ module: 'linkedin', snooze_until: '2026-06-10' }],
    };
    const result = addDeferredModule(state, 'linkedin', '2026-07-10');
    expect(result.deferred_modules).toEqual([
      { module: 'linkedin', snooze_until: '2026-07-10' },
    ]);
  });

  it('does not duplicate when the same module is added twice', () => {
    const state: PatinaState = {
      deferred_modules: [
        { module: 'linkedin', snooze_until: '2026-06-10' },
        { module: 'resume', snooze_until: '2026-07-01' },
      ],
    };
    const result = addDeferredModule(state, 'linkedin', '2026-08-01');
    expect(result.deferred_modules?.filter(e => e.module === 'linkedin')).toHaveLength(1);
    expect(result.deferred_modules?.find(e => e.module === 'linkedin')?.snooze_until).toBe('2026-08-01');
    // Other entries preserved
    expect(result.deferred_modules?.find(e => e.module === 'resume')).toBeDefined();
  });

  it('does not mutate the original state', () => {
    const result = addDeferredModule(baseState, 'linkedin', '2026-06-10');
    expect(baseState.deferred_modules).toBeUndefined();
    expect(result).not.toBe(baseState);
  });
});

// ── clearDeferredModule ───────────────────────────────────────────────────────

describe('clearDeferredModule', () => {
  it('removes the target entry', () => {
    const state: PatinaState = {
      deferred_modules: [{ module: 'linkedin', snooze_until: '2026-06-10' }],
    };
    const result = clearDeferredModule(state, 'linkedin');
    expect(result.deferred_modules).toEqual([]);
  });

  it('leaves other entries intact', () => {
    const state: PatinaState = {
      deferred_modules: [
        { module: 'linkedin', snooze_until: '2026-06-10' },
        { module: 'resume', snooze_until: '2026-07-01' },
      ],
    };
    const result = clearDeferredModule(state, 'linkedin');
    expect(result.deferred_modules).toEqual([
      { module: 'resume', snooze_until: '2026-07-01' },
    ]);
  });

  it('returns empty array (not undefined) when result is empty', () => {
    const state: PatinaState = {
      deferred_modules: [{ module: 'linkedin', snooze_until: '2026-06-10' }],
    };
    const result = clearDeferredModule(state, 'linkedin');
    expect(result.deferred_modules).toEqual([]);
    expect(Array.isArray(result.deferred_modules)).toBe(true);
  });

  it('handles empty deferred_modules gracefully', () => {
    const result = clearDeferredModule({}, 'linkedin');
    expect(result.deferred_modules).toEqual([]);
  });

  it('does not mutate the original state', () => {
    const state: PatinaState = {
      deferred_modules: [{ module: 'linkedin', snooze_until: '2026-06-10' }],
    };
    clearDeferredModule(state, 'linkedin');
    expect(state.deferred_modules).toHaveLength(1);
  });
});
