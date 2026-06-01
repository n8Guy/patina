import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { hashContent, hashFile, type ChecksumMap } from './checksums.js';
import { hasFences, parseSections, mergeSections, type SectionOutcome } from './sections.js';
import type { Profile } from './types.js';

export type FileOutcome = 'added' | 'updated' | 'skipped';

export interface WriteResult {
  outcome: FileOutcome;
  checksum: string;
  sections?: SectionOutcome[];
}

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
 * If `newContent` contains patina fences, delegates to `writeSectionedFile`
 * for per-section merge logic.
 *
 * Returns the outcome and the new checksum (for storage in .patina-state.json),
 * plus optional per-section outcomes for fenced files.
 */
export function writeManagedFile(
  targetDir: string,
  relativePath: string,
  newContent: string,
  storedChecksums: ChecksumMap,
  overwrite?: Set<string>
): WriteResult {
  if (hasFences(newContent)) {
    return writeSectionedFile(targetDir, relativePath, newContent, storedChecksums, overwrite ?? new Set());
  }

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
 * Write a fenced (sectioned) managed file.
 *
 * 1. If file doesn't exist: write newContent directly, return sections with outcome 'added'.
 * 2. If file exists without fences (Case B migration):
 *    - Compare whole-file hash. Match (or no stored hash) → overwrite (introduces fences).
 *    - Mismatch → skip (user-edited).
 * 3. If file exists with fences: merge sections individually.
 */
function writeSectionedFile(
  targetDir: string,
  relativePath: string,
  newContent: string,
  storedChecksums: ChecksumMap,
  overwrite: Set<string>
): WriteResult {
  const fullPath = join(targetDir, relativePath);

  if (!existsSync(fullPath)) {
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, newContent, 'utf8');
    const sections = parseSections(newContent).map(s => ({
      id: s.id,
      outcome: 'added' as const,
      newChecksum: hashContent(s.inner),
    }));
    return { outcome: 'added', checksum: hashContent(newContent), sections };
  }

  const existingContent = readFileSync(fullPath, 'utf8');

  if (!hasFences(existingContent)) {
    // Case B migration: existing file has no fences
    const currentHash = hashFile(fullPath);
    const storedHash = storedChecksums[relativePath];

    if (!storedHash || currentHash === storedHash) {
      // Whole-file hash matches (or no stored hash) → overwrite, introducing fences
      writeFileSync(fullPath, newContent, 'utf8');
      const sections = parseSections(newContent).map(s => ({
        id: s.id,
        outcome: 'added' as const,
        newChecksum: hashContent(s.inner),
      }));
      return { outcome: 'updated', checksum: hashContent(newContent), sections };
    } else {
      // User has edited the file — skip
      return { outcome: 'skipped', checksum: storedHash ?? (currentHash as string), sections: undefined };
    }
  }

  // Normal section-merge path: existing file has fences
  const newSectionMap: Record<string, string> = {};
  for (const s of parseSections(newContent)) {
    newSectionMap[s.id] = s.inner;
  }

  const { content: mergedContent, sections } = mergeSections(
    existingContent,
    newSectionMap,
    storedChecksums,
    relativePath,
    overwrite
  );

  writeFileSync(fullPath, mergedContent, 'utf8');
  return { outcome: 'updated', checksum: hashContent(mergedContent), sections };
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
