import { MODULES } from './modules/registry.js';

export const CONTENT_SUBDIRS = ['notes', 'skills'] as const;

// Files patina manages (marked managed, overwritten on update).
// graph/** is intentionally excluded — patina never touches user content.
export const MANAGED_FILES = [
  'README.md',
  'CLAUDE.md',
  '.claude/settings.json',
  '.claude/commands/add.md',
  '.claude/commands/reflect.md',
  '.claude/commands/inbox.md',
  '.claude/commands/status.md',
  '.claude/commands/guide.md',
  '.claude/commands/audience.md',
  '.claude/commands/with-audience.md',
  '.claude/inbox-routing.md',
  '.claude/scripts/check-update.mjs',
  '.claude/scripts/staleness-check.mjs',
  '.claude/scripts/health-check.mjs',
] as const;

// Files patina seeds once (written if absent, never overwritten).
// Note: .obsidian/app.json is also seeded (editor-conditional, obsidian only).
export const SEED_FILES = [
  'CUSTOM.md',
  'inbox/.gitkeep',
  'inbox/.processed.json',
  '.obsidian/app.json',
] as const;

export const MODULE_MANAGED_FILES: Record<string, readonly string[]> =
  Object.fromEntries(MODULES.map(m => [m.id, m.managedPaths]));

export const MODULE_CONTENT_FILES: Record<string, readonly string[]> =
  Object.fromEntries(MODULES.map(m => [m.id, m.contentFileNames]));
