import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

import { isNewer } from '../templates/.claude/scripts/check-update.mjs';

const SCRIPT_PATH = fileURLToPath(
  new URL('../templates/.claude/scripts/check-update.mjs', import.meta.url)
);

function runScript(cwd: string, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd,
    timeout: 5000,
    env: { ...process.env, ...env },
  });
}

// ── isNewer ───────────────────────────────────────────────────────────────────

describe('isNewer — newer version returns true', () => {
  it('newer major', () => expect(isNewer('2.0.0', '1.0.0')).toBe(true));
  it('newer minor', () => expect(isNewer('1.1.0', '1.0.0')).toBe(true));
  it('newer patch', () => expect(isNewer('1.0.1', '1.0.0')).toBe(true));
  it('newer minor beats older patch', () => expect(isNewer('1.1.0', '1.0.9')).toBe(true));
  it('newer major beats older minor and patch', () => expect(isNewer('2.0.0', '1.99.99')).toBe(true));
});

describe('isNewer — older version returns false', () => {
  it('older major', () => expect(isNewer('1.0.0', '2.0.0')).toBe(false));
  it('older minor', () => expect(isNewer('1.0.0', '1.1.0')).toBe(false));
  it('older patch', () => expect(isNewer('1.0.0', '1.0.1')).toBe(false));
});

describe('isNewer — equal version returns false', () => {
  it('same version', () => expect(isNewer('1.0.0', '1.0.0')).toBe(false));
  it('same with larger numbers', () => expect(isNewer('10.20.30', '10.20.30')).toBe(false));
});

describe('isNewer — invalid inputs return false without throwing', () => {
  it('empty string a', () => expect(isNewer('', '1.0.0')).toBe(false));
  it('empty string b', () => expect(isNewer('1.0.0', '')).toBe(false));
  it('non-semver string', () => expect(isNewer('latest', '1.0.0')).toBe(false));
  it('only two parts', () => expect(isNewer('1.0', '1.0.0')).toBe(false));
  it('four parts', () => expect(isNewer('1.0.0.0', '1.0.0')).toBe(false));
  it('negative number', () => expect(isNewer('-1.0.0', '1.0.0')).toBe(false));
  it('NaN segment', () => expect(isNewer('1.x.0', '1.0.0')).toBe(false));
  it('null a', () => expect(isNewer(null, '1.0.0')).toBe(false));
  it('undefined b', () => expect(isNewer('1.0.0', undefined)).toBe(false));
});

// ── subprocess tests ──────────────────────────────────────────────────────────

describe('flag-file sentinel — flag already exists', () => {
  it('exits 0 immediately without modifying the flag file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const flagFile = join(tmp, '.patina-update-check');
      const sentinel = 'do-not-overwrite';
      writeFileSync(flagFile, sentinel, 'utf8');

      const result = runScript(tmp);

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      expect(readFileSync(flagFile, 'utf8')).toBe(sentinel);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('flag-file write paths — no flag file present', () => {
  it('writes the latest version string when a newer version is available', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_LATEST_VERSION: '2.0.0',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      expect(readFileSync(join(tmp, '.patina-update-check'), 'utf8')).toBe('2.0.0');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('writes an empty sentinel when already up to date', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_LATEST_VERSION: '1.0.0',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      expect(existsSync(join(tmp, '.patina-update-check'))).toBe(true);
      expect(readFileSync(join(tmp, '.patina-update-check'), 'utf8')).toBe('');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('exits 0 silently without writing flag file on network failure', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_FAIL: 'true',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      expect(existsSync(join(tmp, '.patina-update-check'))).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
