import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { hashContent, hashFile, type ChecksumMap } from './checksums.js';
import type { Profile } from './types.js';

export type FileOutcome = 'added' | 'updated' | 'skipped';

export interface UpgradeResult {
  added: string[];
  updated: string[];
  skipped: string[];
}

/**
 * Write a managed file during install or upgrade.
 *
 * - If the file doesn't exist: write it (added).
 * - If the file exists and its hash matches the stored checksum: update it.
 * - If the file exists and has been modified by the user: skip it.
 *
 * Returns the outcome and the new checksum (for storage in .patina-state.json).
 */
export function writeManagedFile(
  targetDir: string,
  relativePath: string,
  newContent: string,
  storedChecksums: ChecksumMap
): { outcome: FileOutcome; checksum: string } {
  const fullPath = join(targetDir, relativePath);
  const newChecksum = hashContent(newContent);

  if (!existsSync(fullPath)) {
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, newContent, 'utf8');
    return { outcome: 'added', checksum: newChecksum };
  }

  const currentHash = hashFile(fullPath);
  const storedHash = storedChecksums[relativePath];

  if (!storedHash || currentHash === storedHash) {
    writeFileSync(fullPath, newContent, 'utf8');
    return { outcome: 'updated', checksum: newChecksum };
  }

  return { outcome: 'skipped', checksum: storedHash };
}

/**
 * Merge new fields into an existing profile without overwriting anything the user set.
 * Nested objects (like `work`) are merged shallowly — top-level keys take precedence.
 */
export function mergeProfile(existing: Profile, incoming: Partial<Profile>): Profile {
  return {
    ...incoming,
    ...existing,
    work: { ...incoming.work, ...existing.work } as Profile['work'],
    modules: existing.modules?.length ? existing.modules : (incoming.modules ?? []),
  };
}
