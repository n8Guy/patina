import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';
import { MODULES } from './modules/registry.js';

export type ChecksumMap = Record<string, string>;

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function hashFile(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  return hashContent(readFileSync(filePath, 'utf8'));
}

export const CONTENT_SUBDIRS = ['notes', 'skills', 'posts'] as const;

// Files patina manages and can safely update if the user hasn't modified them.
// graph/** is intentionally excluded — patina never touches user content.
export const MANAGED_FILES = [
  'README.md',
  'CLAUDE.md',
  '.claude/settings.json',
  '.claude/commands/add.md',
  '.claude/commands/reflect.md',
  '.mcp.json',
  'inbox/.gitkeep',
  'inbox/.processed.json',
  '.claude/commands/inbox.md',
  '.claude/commands/status.md',
  '.claude/commands/guide.md',
] as const;

export const MODULE_MANAGED_FILES: Record<string, readonly string[]> =
  Object.fromEntries(MODULES.map(m => [m.id, m.managedPaths]));

export const MODULE_CONTENT_FILES: Record<string, readonly string[]> =
  Object.fromEntries(MODULES.map(m => [m.id, m.contentFileNames]));
