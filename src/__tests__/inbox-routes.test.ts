import { describe, it, expect } from 'vitest';
import { MODULES } from '../modules/registry.js';
import type { ModuleDefinition } from '../modules/types.js';
import { workModule } from '../modules/work/index.js';

const ALL_MODULES = MODULES as readonly ModuleDefinition[];

// ── InboxRoute shape validation ───────────────────────────────────────────────

describe('inboxRoutes — shape validation', () => {
  for (const mod of ALL_MODULES) {
    if (!mod.inboxRoutes?.length) continue;

    describe(`module: ${mod.id}`, () => {
      for (const route of mod.inboxRoutes!) {
        it(`route '${route.type}' has non-empty type`, () => {
          expect(typeof route.type).toBe('string');
          expect(route.type.trim()).not.toBe('');
        });

        it(`route '${route.type}' has non-empty destination ending with /`, () => {
          expect(typeof route.destination).toBe('string');
          expect(route.destination.trim()).not.toBe('');
          expect(route.destination.endsWith('/')).toBe(true);
        });
      }
    });
  }
});

// ── Type uniqueness across all modules ───────────────────────────────────────

describe('inboxRoutes — type uniqueness across all modules', () => {
  it('no two modules claim the same type:', () => {
    const seen = new Map<string, string>(); // type → module id
    const conflicts: string[] = [];

    for (const mod of ALL_MODULES) {
      for (const route of mod.inboxRoutes ?? []) {
        if (seen.has(route.type)) {
          conflicts.push(`type '${route.type}' claimed by both '${seen.get(route.type)}' and '${mod.id}'`);
        } else {
          seen.set(route.type, mod.id);
        }
      }
    }

    expect(conflicts).toHaveLength(0);
  });
});

// ── Work module specific assertions ──────────────────────────────────────────

describe('inboxRoutes — work module', () => {
  it('registers exactly transcript, weekly, and reference', () => {
    const types = (workModule.inboxRoutes ?? []).map(r => r.type).sort();
    expect(types).toEqual(['reference', 'transcript', 'weekly']);
  });

  it('does NOT register weekly-summary', () => {
    const types = (workModule.inboxRoutes ?? []).map(r => r.type);
    expect(types).not.toContain('weekly-summary');
  });

  it('does NOT register work-profile', () => {
    const types = (workModule.inboxRoutes ?? []).map(r => r.type);
    expect(types).not.toContain('work-profile');
  });

  it('transcript destination points to work/transcripts/', () => {
    const route = workModule.inboxRoutes?.find(r => r.type === 'transcript');
    expect(route?.destination).toBe('work/transcripts/');
  });

  it('weekly destination points to work/weeklies/', () => {
    const route = workModule.inboxRoutes?.find(r => r.type === 'weekly');
    expect(route?.destination).toBe('work/weeklies/');
  });

  it('reference destination points to work/references/', () => {
    const route = workModule.inboxRoutes?.find(r => r.type === 'reference');
    expect(route?.destination).toBe('work/references/');
  });
});
