import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { ChecksumMap } from './checksums.js';
import type { Profile } from './types.js';

export interface PatinaState {
  checksums: ChecksumMap;
}

export const STATE_FILENAME = '.patina-state.json';

/** Normalize all checksum keys to forward-slash paths to prevent Windows path mismatches. */
function normalizeChecksums(checksums: ChecksumMap): ChecksumMap {
  const result: ChecksumMap = {};
  for (const [key, value] of Object.entries(checksums)) {
    result[key.replace(/\\/g, '/')] = value;
  }
  return result;
}

/**
 * Read `.patina-state.json` from `root`. Migration-aware:
 *
 * - If `.patina-state.json` exists: parse it. Throws a clear error on corrupt JSON —
 *   returning empty checksums would silently disable overwrite protection.
 * - If `.patina-state.json` does NOT exist: read checksums from `profile._checksums`
 *   if a profile is provided (migration path for first post-upgrade run).
 *   Returns `{ checksums: {} }` for a fresh install.
 */
export function readState(root: string, profile?: Profile): PatinaState {
  const statePath = join(root, STATE_FILENAME);

  if (existsSync(statePath)) {
    const raw = readFileSync(statePath, 'utf8');
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error(
        `Corrupt ${STATE_FILENAME}: failed to parse JSON. ` +
        `Fix or delete the file at ${statePath} and try again.`
      );
    }
    const obj = parsed as Record<string, unknown>;
    const rawChecksums = obj.checksums;
    if (rawChecksums !== undefined && (typeof rawChecksums !== 'object' || Array.isArray(rawChecksums) || rawChecksums === null)) {
      throw new Error(`Corrupt ${STATE_FILENAME}: 'checksums' must be an object at ${statePath}.`);
    }
    const checksums = normalizeChecksums((rawChecksums ?? {}) as ChecksumMap);
    return { checksums };
  }

  // Migration: state file absent — read from legacy profile._checksums if available.
  const legacyChecksums = (profile as Profile & { _checksums?: ChecksumMap })?._checksums;
  const checksums = normalizeChecksums(legacyChecksums ?? {});
  return { checksums };
}

/** Strip any legacy `_checksums` field written by older versions of patina. */
export function stripLegacyChecksums(profile: Profile): Profile {
  const { _checksums: _stripped, ...clean } = profile as Profile & { _checksums?: unknown };
  return clean as Profile;
}

/**
 * Write `.patina-state.json` to `root`. All checksum keys are normalized to
 * forward-slash paths before writing.
 */
export function writeState(root: string, state: PatinaState): void {
  const normalized: PatinaState = {
    checksums: normalizeChecksums(state.checksums),
  };
  writeFileSync(
    join(root, STATE_FILENAME),
    JSON.stringify(normalized, null, 2) + '\n',
    'utf8'
  );
}
