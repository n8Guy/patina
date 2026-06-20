import { MODULES } from './modules/registry.js';
import { getAgent } from './agents/registry.js';
import type { AgentId } from './types.js';

export const CONTENT_SUBDIRS = ['notes', 'skills'] as const;

// Files patina manages (marked managed, overwritten on update) — claude-code default.
// graph/** is intentionally excluded — patina never touches user content.
// For agent-aware lookups, use managedFilesFor(agent, editor) instead.
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
  '.claude/agents/hiring-manager.md',
  '.claude/agents/recruiter.md',
  '.claude/scripts/check-update.mjs',
  '.claude/scripts/staleness-check.mjs',
  '.claude/scripts/health-check.mjs',
] as const;

/**
 * Returns the set of managed file paths for the given agent and editor.
 * Replaces direct use of MANAGED_FILES when agent-awareness is needed.
 */
export function managedFilesFor(agentId: AgentId | undefined, editor: string): readonly string[] {
  return getAgent(agentId).baseManagedPaths({ editor });
}

/**
 * Returns the managed paths for a specific module under the given agent.
 */
export function moduleManagedFilesFor(agentId: AgentId | undefined, moduleId: string): readonly string[] {
  const adapter = getAgent(agentId);
  const module = MODULES.find(m => m.id === moduleId);
  if (!module) return [];
  return adapter.mapModuleManagedPaths(moduleId, module.managedPaths);
}

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
