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

describe('TTL sentinel — fresh sentinel within TTL', () => {
  it('exits 0, does not make network call, does not overwrite file', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const sentinelFile = join(tmp, '.patina-update-check');
      const original = JSON.stringify({
        _comment: 'test',
        checked_at: new Date().toISOString(),
        available_version: '1.5.0',
      }, null, 2) + '\n';
      writeFileSync(sentinelFile, original, 'utf8');

      // Mock a different version — if the network call ran, the file would change
      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_LATEST_VERSION: '9.9.9',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      expect(readFileSync(sentinelFile, 'utf8')).toBe(original);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('TTL sentinel — stale sentinel (checked_at 25h ago)', () => {
  it('re-runs and writes fresh JSON with updated checked_at', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const sentinelFile = join(tmp, '.patina-update-check');
      const staleDate = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
      writeFileSync(sentinelFile, JSON.stringify({
        _comment: 'old',
        checked_at: staleDate,
        available_version: null,
      }, null, 2) + '\n', 'utf8');

      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_LATEST_VERSION: '2.0.0',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      const data = JSON.parse(readFileSync(sentinelFile, 'utf8'));
      expect(data.available_version).toBe('2.0.0');
      expect(Number.isFinite(Date.parse(data.checked_at))).toBe(true);
      expect(data.checked_at).not.toBe(staleDate);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('TTL sentinel — old-format sentinel (bare version string)', () => {
  it('migrates to JSON format on next run', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const sentinelFile = join(tmp, '.patina-update-check');
      writeFileSync(sentinelFile, '0.5.0', 'utf8');

      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_LATEST_VERSION: '2.0.0',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      const data = JSON.parse(readFileSync(sentinelFile, 'utf8'));
      expect(data.available_version).toBe('2.0.0');
      expect(Number.isFinite(Date.parse(data.checked_at))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('TTL sentinel — old-format empty-string sentinel', () => {
  it('migrates to JSON format on next run', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const sentinelFile = join(tmp, '.patina-update-check');
      writeFileSync(sentinelFile, '', 'utf8');

      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_LATEST_VERSION: '2.0.0',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      const data = JSON.parse(readFileSync(sentinelFile, 'utf8'));
      expect(data.available_version).toBe('2.0.0');
      expect(Number.isFinite(Date.parse(data.checked_at))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('TTL sentinel — future timestamp in sentinel', () => {
  it('treats it as expired and re-runs the check', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const sentinelFile = join(tmp, '.patina-update-check');
      const futureDate = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      writeFileSync(sentinelFile, JSON.stringify({
        _comment: 'test',
        checked_at: futureDate,
        available_version: null,
      }, null, 2) + '\n', 'utf8');

      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_LATEST_VERSION: '2.0.0',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      const data = JSON.parse(readFileSync(sentinelFile, 'utf8'));
      expect(data.available_version).toBe('2.0.0');
      expect(data.checked_at).not.toBe(futureDate);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('TTL sentinel — no file, newer version available', () => {
  it('writes JSON with available_version set to latest', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_LATEST_VERSION: '2.0.0',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      const data = JSON.parse(readFileSync(join(tmp, '.patina-update-check'), 'utf8'));
      expect(data.available_version).toBe('2.0.0');
      expect(Number.isFinite(Date.parse(data.checked_at))).toBe(true);
      expect(typeof data._comment).toBe('string');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('TTL sentinel — no file, already up to date', () => {
  it('writes JSON with available_version null', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'patina-update-check-test-'));
    try {
      const result = runScript(tmp, {
        PATINA_MOCK_INSTALLED_VERSION: '1.0.0',
        PATINA_MOCK_LATEST_VERSION: '1.0.0',
      });

      expect(result.error).toBeUndefined();
      expect(result.signal).toBeNull();
      expect(result.status).toBe(0);
      const data = JSON.parse(readFileSync(join(tmp, '.patina-update-check'), 'utf8'));
      expect(data.available_version).toBeNull();
      expect(Number.isFinite(Date.parse(data.checked_at))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('TTL sentinel — no file, network failure', () => {
  it('exits 0 silently without writing any file', () => {
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

