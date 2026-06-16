import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import type { Profile } from './types.js';

export type FileOutcome = 'added' | 'updated' | 'skipped';

export interface WriteResult {
  outcome: FileOutcome;
}

/**
 * Returns true if the file's content carries a patina ownership marker.
 * - Markdown/text: checks for `patina: managed` in YAML frontmatter.
 * - JSON: checks for `_patina === 'managed'`.
 * - .mjs/.js scripts: checks for `// patina: managed` comment on the first line.
 */
export function isMarkedManaged(relativePath: string, content: string): boolean {
  if (relativePath.endsWith('.json')) {
    try { return (JSON.parse(content) as Record<string, unknown>)._patina === 'managed'; }
    catch { return false; }
  }
  if (relativePath.endsWith('.mjs') || relativePath.endsWith('.js')) {
    return /^\/\/\s*patina:\s*managed\s*$/.test((content.split('\n')[0] ?? '').trimEnd());
  }
  // markdown / other text: check first frontmatter block for `patina: managed`
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return false;
  return /^\s*patina:\s*managed\s*$/m.test(m[1]);
}

/**
 * Bridge: treat legacy fenced files as patina-owned so old installs converge on first update.
 * Can be removed in a future major version once all active installs have been migrated.
 */
export function isLegacyManaged(content: string): boolean {
  return /<!--\s*patina:/.test(content);
}

export interface WriteManagedFileOptions {
  /**
   * When true, skip writing if the file does not already exist on disk.
   * Use for opt-in managed files (e.g. predefined archetypes) that should be
   * overwritten on update once installed but never auto-created on scaffold.
   */
  skipIfAbsent?: boolean;
}

/**
 * Write a managed file.
 *
 * - If the file doesn't exist and skipIfAbsent is true: skip (skipped).
 * - If the file doesn't exist: write it (added).
 * - If the file on disk is marked managed (marker or legacy fence): overwrite (updated).
 * - If the file on disk is unmarked: skip it (user-owned, skipped).
 */
export function writeManagedFile(
  targetDir: string,
  relativePath: string,
  newContent: string,
  opts: WriteManagedFileOptions = {},
): WriteResult {
  const fullPath = join(targetDir, relativePath);
  if (!existsSync(fullPath)) {
    if (opts.skipIfAbsent) return { outcome: 'skipped' };
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, newContent, 'utf8');
    return { outcome: 'added' };
  }
  const current = readFileSync(fullPath, 'utf8');
  if (isMarkedManaged(relativePath, current) || isLegacyManaged(current)) {
    writeFileSync(fullPath, newContent, 'utf8');
    return { outcome: 'updated' };
  }
  return { outcome: 'skipped' };
}

/**
 * Seed-once: write only if absent. Never overwrites existing content.
 */
export function writeSeedFile(
  targetDir: string,
  relativePath: string,
  content: string,
): 'added' | 'skipped' {
  const fullPath = join(targetDir, relativePath);
  if (existsSync(fullPath)) return 'skipped';
  mkdirSync(dirname(fullPath), { recursive: true });
  writeFileSync(fullPath, content, 'utf8');
  return 'added';
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
