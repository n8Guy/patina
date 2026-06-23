import type { AgentId, TemplateVars } from '../types.js';

export type AgentPathVars = Pick<
  TemplateVars,
  | 'AGENT_DIR'
  | 'AGENT_COMMANDS_DIR'
  | 'AGENT_AGENTS_DIR'
  | 'AGENT_SCRIPTS_DIR'
  | 'AGENT_MEMORY_FILE'
  | 'AGENT_DISPLAY_NAME'
  | 'AGENT_CLI'
>;

export interface BaseManagedFilesOpts {
  editor: string;
  modules: readonly string[];
}

export interface AgentAdapter {
  readonly agentId: AgentId;
  readonly displayName: string;     // "Claude Code" / "opencode"
  readonly cliCommand: string;      // "claude" / "opencode"
  readonly installUrl: string;      // shown when the agent is not detected
  readonly pathVars: AgentPathVars;

  /**
   * Returns [relativePath, content] pairs for all base managed files for this agent.
   * The vars passed in already include pathVars spread in.
   */
  baseManagedFiles(vars: TemplateVars, opts: BaseManagedFilesOpts): Array<[string, string]>;

  /**
   * Map module-level managed file entries from their canonical form to agent-specific paths.
   * For claude-code this is an identity transform. For opencode it rewrites .claude/ → .opencode/.
   */
  mapModuleManagedFiles(moduleId: string, entries: Array<[string, string]>, vars: TemplateVars): Array<[string, string]>;

  /**
   * Returns the set of base managed paths (no content). Used by checksums and removal logic.
   */
  baseManagedPaths(opts: { editor: string }): readonly string[];

  /**
   * Map canonical module managed paths to agent-specific paths.
   */
  mapModuleManagedPaths(moduleId: string, canonicalPaths: readonly string[]): readonly string[];

  /**
   * Returns [relativePath, content] pairs for predefined audience archetype files.
   */
  archetypeFiles(vars: TemplateVars, slugs?: readonly string[]): Array<[string, string]>;

  /**
   * Returns the output path for a given archetype slug (e.g. 'hiring-manager').
   */
  archetypePath(slug: string): string;

  /**
   * Optional: attempt to detect whether this agent is installed.
   */
  detect?(): boolean;

  /**
   * Render the update-check section content. Returns null if this agent has no
   * equivalent (e.g. opencode v1 which lacks hook/script support).
   */
  renderUpdateCheckSection(vars: TemplateVars): string | null;

  /**
   * Returns the gitignore entry for this agent's audience-prefs file.
   */
  audiencePrefsGitignoreEntry(): string;

  /**
   * Returns the path used for inbox routing config.
   */
  inboxRoutingPath(): string;
}
