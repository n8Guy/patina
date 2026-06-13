import { MODULES } from './modules/registry.js';

export const CONTENT_SUBDIRS = ['notes', 'skills', 'posts'] as const;

// Files patina manages (marked managed, overwritten on update).
// graph/** is intentionally excluded — patina never touches user content.
export const MANAGED_FILES = [
  'README.md',
  'CLAUDE.md',
  '.claude/settings.json',
  '.claude/commands/add.md',
  '.claude/commands/reflect.md',
  '.mcp.json',
  '.claude/commands/inbox.md',
  '.claude/commands/status.md',
  '.claude/commands/guide.md',
  '.claude/inbox-routing.md',
  '.claude/scripts/check-update.mjs',
  '.claude/scripts/staleness-check.mjs',
  '.claude/scripts/health-check.mjs',
] as const;

// Files patina seeds once (written if absent, never overwritten).
export const SEED_FILES = [
  'CUSTOM.md',
  'inbox/.gitkeep',
  'inbox/.processed.json',
] as const;

export const MODULE_MANAGED_FILES: Record<string, readonly string[]> =
  Object.fromEntries(MODULES.map(m => [m.id, m.managedPaths]));

export const MODULE_CONTENT_FILES: Record<string, readonly string[]> =
  Object.fromEntries(MODULES.map(m => [m.id, m.contentFileNames]));
