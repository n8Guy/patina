import { claudeCodeAdapter } from './claude-code.js';
import { opencodeAdapter } from './opencode.js';
import type { AgentAdapter } from './types.js';
import type { AgentId } from '../types.js';

export const AGENTS: readonly AgentAdapter[] = [claudeCodeAdapter, opencodeAdapter];

/**
 * Returns the adapter for the given agent id.
 * Defaults to claude-code when id is undefined (backward-compat: existing patinas
 * with no `agent` field in profile.yaml continue to work unchanged).
 */
export function getAgent(id?: AgentId): AgentAdapter {
  if (!id) return claudeCodeAdapter;
  const found = AGENTS.find(a => a.agentId === id);
  if (!found) {
    console.warn(`Unknown agent id "${id}" — falling back to claude-code.`);
    return claudeCodeAdapter;
  }
  return found;
}
