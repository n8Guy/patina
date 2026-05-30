import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readState, writeState, STATE_FILENAME } from '../state.js';
import type { Profile } from '../types.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-state-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ── readState — existing state file ───────────────────────────────────────────

describe('readState — existing .patina-state.json', () => {
  it('reads checksums from the state file', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ checksums: { 'CLAUDE.md': 'abc123' } }, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.checksums['CLAUDE.md']).toBe('abc123');
  });

  it('normalizes backslash keys to forward slashes', () => {
    writeFileSync(
      join(tmp, STATE_FILENAME),
      JSON.stringify({ checksums: { '.claude\\commands\\add.md': 'def456' } }, null, 2) + '\n',
      'utf8'
    );

    const state = readState(tmp);
    expect(state.checksums['.claude/commands/add.md']).toBe('def456');
    expect(state.checksums['.claude\\commands\\add.md']).toBeUndefined();
  });

  it('returns empty checksums when state file has no checksums key', () => {
    writeFileSync(join(tmp, STATE_FILENAME), JSON.stringify({}), 'utf8');

    const state = readState(tmp);
    expect(state.checksums).toEqual({});
  });

  it('throws on corrupt JSON', () => {
    writeFileSync(join(tmp, STATE_FILENAME), 'not valid json', 'utf8');

    expect(() => readState(tmp)).toThrow(/Corrupt/);
  });

  it('throws when checksums field is a string, not an object', () => {
    writeFileSync(join(tmp, STATE_FILENAME), JSON.stringify({ checksums: 'bad' }), 'utf8');

    expect(() => readState(tmp)).toThrow(/Corrupt/);
  });

  it('throws when checksums field is an array, not an object', () => {
    writeFileSync(join(tmp, STATE_FILENAME), JSON.stringify({ checksums: ['a', 'b'] }), 'utf8');

    expect(() => readState(tmp)).toThrow(/Corrupt/);
  });

  it('throws on corrupt JSON even if a profile is provided', () => {
    writeFileSync(join(tmp, STATE_FILENAME), '{broken}', 'utf8');

    const profile = { _checksums: { 'CLAUDE.md': 'fallback' } } as unknown as Profile;
    expect(() => readState(tmp, profile)).toThrow(/Corrupt/);
  });
});

// ── readState — migration (no state file) ─────────────────────────────────────

describe('readState — migration (no .patina-state.json)', () => {
  it('returns empty checksums for a fresh install (no profile)', () => {
    const state = readState(tmp);
    expect(state.checksums).toEqual({});
  });

  it('returns empty checksums when profile has no _checksums', () => {
    const profile = { name: 'Test' } as unknown as Profile;
    const state = readState(tmp, profile);
    expect(state.checksums).toEqual({});
  });

  it('reads checksums from profile._checksums when state file absent', () => {
    const profile = { _checksums: { 'CLAUDE.md': 'migrate-hash' } } as unknown as Profile;
    const state = readState(tmp, profile);
    expect(state.checksums['CLAUDE.md']).toBe('migrate-hash');
  });

  it('normalizes backslash keys from profile._checksums', () => {
    const profile = {
      _checksums: { '.claude\\commands\\add.md': 'win-hash' },
    } as unknown as Profile;
    const state = readState(tmp, profile);
    expect(state.checksums['.claude/commands/add.md']).toBe('win-hash');
  });
});

// ── writeState ────────────────────────────────────────────────────────────────

describe('writeState', () => {
  it('creates .patina-state.json with correct content', () => {
    writeState(tmp, { checksums: { 'CLAUDE.md': 'abc123' } });

    expect(existsSync(join(tmp, STATE_FILENAME))).toBe(true);
  });

  it('writes valid JSON that round-trips through readState', () => {
    const checksums = { 'CLAUDE.md': 'abc123', '.claude/commands/add.md': 'def456' };
    writeState(tmp, { checksums });

    const state = readState(tmp);
    expect(state.checksums).toEqual(checksums);
  });

  it('writes pretty-printed JSON with a trailing newline', () => {
    writeState(tmp, { checksums: { 'CLAUDE.md': 'abc' } });

    const raw = readFileSync(join(tmp, STATE_FILENAME), 'utf8');
    expect(raw).toContain('  '); // indented
    expect(raw.endsWith('\n')).toBe(true);
  });

  it('normalizes backslash keys on write', () => {
    writeState(tmp, { checksums: { '.claude\\commands\\add.md': 'hash1' } });

    const state = readState(tmp);
    expect(state.checksums['.claude/commands/add.md']).toBe('hash1');
    expect(state.checksums['.claude\\commands\\add.md']).toBeUndefined();
  });

  it('overwrites an existing state file completely', () => {
    writeState(tmp, { checksums: { 'CLAUDE.md': 'old-hash' } });
    writeState(tmp, { checksums: { 'CLAUDE.md': 'new-hash' } });

    const state = readState(tmp);
    expect(state.checksums['CLAUDE.md']).toBe('new-hash');
  });
});

// ── Migration end-to-end ──────────────────────────────────────────────────────

describe('migration end-to-end', () => {
  it('migrates checksums from profile._checksums on first read, state file created on write', () => {
    // Simulate old-style profile with _checksums, no state file
    const profile = {
      _checksums: { 'CLAUDE.md': 'old-hash', '.claude/settings.json': 'settings-hash' },
    } as unknown as Profile;

    // First read: migrate from profile
    const state = readState(tmp, profile);
    expect(state.checksums['CLAUDE.md']).toBe('old-hash');
    expect(state.checksums['.claude/settings.json']).toBe('settings-hash');

    // State file does not yet exist (readState does not write it)
    expect(existsSync(join(tmp, STATE_FILENAME))).toBe(false);

    // Simulate an update: write the migrated state
    writeState(tmp, state);
    expect(existsSync(join(tmp, STATE_FILENAME))).toBe(true);

    // Subsequent read uses the state file, not the profile
    const state2 = readState(tmp);
    expect(state2.checksums['CLAUDE.md']).toBe('old-hash');
  });
});
