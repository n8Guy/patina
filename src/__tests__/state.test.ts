import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readState, writeState, STATE_FILENAME } from '../state.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-state-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ── readState — fresh install ─────────────────────────────────────────────────

describe('readState — fresh install (no state file)', () => {
  it('returns empty state for a fresh install', () => {
    const state = readState(tmp);
    expect(state).toEqual({});
  });

  it('returns undefined deferred_modules when absent', () => {
    const state = readState(tmp);
    expect(state.deferred_modules).toBeUndefined();
  });

  it('returns undefined update_check when absent', () => {
    const state = readState(tmp);
    expect(state.update_check).toBeUndefined();
  });
});

// ── readState — existing state file ───────────────────────────────────────────

describe('readState — existing .patina-state.json', () => {
  it('returns empty state when state file is an empty object', () => {
    writeFileSync(join(tmp, STATE_FILENAME), JSON.stringify({}), 'utf8');
    const state = readState(tmp);
    expect(state).toEqual({});
  });

  it('silently ignores legacy checksums field', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ checksums: { 'CLAUDE.md': 'abc123' } }, null, 2) + '\n',
      'utf8'
    );
    const state = readState(tmp);
    // checksums field should not appear on the returned state
    expect((state as Record<string, unknown>).checksums).toBeUndefined();
  });

  it('throws on corrupt JSON', () => {
    writeFileSync(join(tmp, STATE_FILENAME), 'not valid json', 'utf8');
    expect(() => readState(tmp)).toThrow(/Corrupt/);
  });
});

// ── writeState ────────────────────────────────────────────────────────────────

describe('writeState', () => {
  it('creates .patina-state.json', () => {
    writeState(tmp, {});
    expect(existsSync(join(tmp, STATE_FILENAME))).toBe(true);
  });

  it('writes pretty-printed JSON with a trailing newline', () => {
    writeState(tmp, {});
    const raw = readFileSync(join(tmp, STATE_FILENAME), 'utf8');
    expect(raw.endsWith('\n')).toBe(true);
    expect(JSON.parse(raw)).toEqual({});
  });

  it('overwrites an existing state file completely', () => {
    writeState(tmp, { deferred_modules: [{ module: 'linkedin', snooze_until: '2026-06-10' }] });
    writeState(tmp, {});
    const state = readState(tmp);
    expect(state.deferred_modules).toBeUndefined();
  });

  it('does not emit checksums key', () => {
    writeState(tmp, {});
    const raw = readFileSync(join(tmp, STATE_FILENAME), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect('checksums' in parsed).toBe(false);
  });

  it('does not emit deferred_modules when undefined', () => {
    writeState(tmp, { deferred_modules: undefined });
    const raw = readFileSync(join(tmp, STATE_FILENAME), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect('deferred_modules' in parsed).toBe(false);
  });

  it('does not emit update_check when undefined', () => {
    writeState(tmp, { update_check: undefined });
    const raw = readFileSync(join(tmp, STATE_FILENAME), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect('update_check' in parsed).toBe(false);
  });
});

// ── deferred_modules ─────────────────────────────────────────────────────────

describe('deferred_modules round-trip', () => {
  it('writeState → readState preserves deferred_modules', () => {
    const deferred = [{ module: 'linkedin' as const, snooze_until: '2026-06-10' }];
    writeState(tmp, { deferred_modules: deferred });

    const state = readState(tmp);
    expect(state.deferred_modules).toEqual(deferred);
  });

  it('readState returns undefined deferred_modules when field absent from file', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({}, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.deferred_modules).toBeUndefined();
  });

  it('readState handles state file with empty deferred_modules array', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ deferred_modules: [] }, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.deferred_modules).toEqual([]);
  });

  it('readState ignores non-array deferred_modules values', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ deferred_modules: 'bad' }, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.deferred_modules).toBeUndefined();
  });
});

// ── update_check ──────────────────────────────────────────────────────────────

describe('update_check round-trip', () => {
  it('writeState → readState preserves update_check.last_notified_version', () => {
    const updateCheck = { last_notified_version: '1.5.0' };
    writeState(tmp, { update_check: updateCheck });

    const state = readState(tmp);
    expect(state.update_check).toEqual(updateCheck);
  });

  it('readState returns undefined update_check when field absent from file', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({}, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.update_check).toBeUndefined();
  });

  it('readState ignores update_check with a non-string last_notified_version', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ update_check: { last_notified_version: 42 } }, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.update_check).toBeUndefined();
  });

  it('readState ignores non-object update_check values', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ update_check: 'bad' }, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.update_check).toBeUndefined();
  });
});

// ── backup_offer ──────────────────────────────────────────────────────────────

describe('backup_offer round-trip', () => {
  it('writeState → readState preserves backup_offer', () => {
    const backupOffer = { offered_at: '2026-06-14T10:00:00.000Z', outcome: 'initialized' as const };
    writeState(tmp, { backup_offer: backupOffer });

    const state = readState(tmp);
    expect(state.backup_offer).toEqual(backupOffer);
  });

  it('readState returns undefined backup_offer when field absent from file', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({}, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.backup_offer).toBeUndefined();
  });

  it('readState tolerates state written by an older patina (no backup_offer key)', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ deferred_modules: [], update_check: { last_notified_version: '1.0.0' } }, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.backup_offer).toBeUndefined();
    expect(state.update_check?.last_notified_version).toBe('1.0.0');
  });

  it('readState ignores backup_offer with invalid outcome', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ backup_offer: { offered_at: '2026-06-14T10:00:00.000Z', outcome: 'invalid' } }, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.backup_offer).toBeUndefined();
  });

  it('readState ignores backup_offer missing offered_at', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ backup_offer: { outcome: 'declined' } }, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.backup_offer).toBeUndefined();
  });

  it('all valid outcome values round-trip correctly', () => {
    const outcomes = ['initialized', 'declined', 'already-tracked', 'skipped'] as const;
    for (const outcome of outcomes) {
      const backupOffer = { offered_at: '2026-06-14T10:00:00.000Z', outcome };
      writeState(tmp, { backup_offer: backupOffer });
      const state = readState(tmp);
      expect(state.backup_offer?.outcome).toBe(outcome);
    }
  });

  it('does not emit backup_offer key when undefined', () => {
    writeState(tmp, { backup_offer: undefined });
    const raw = readFileSync(join(tmp, STATE_FILENAME), 'utf8');
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    expect('backup_offer' in parsed).toBe(false);
  });
});
