export type Editor = 'obsidian' | 'vscode' | 'other';

export type AgentId = 'claude-code' | 'opencode';

export type ValidationCheckId =
  | 'wiki-links' | 'exclusions' | 'skill-notes'
  | 'module-wiki-links'
  | 'managed-file-placeholders';

export interface ValidationIssue {
  check: ValidationCheckId;
  file: string;       // project-relative, forward-slash normalized
  line?: number;      // 1-based
  message: string;    // plain language
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  filesChecked: number;
}

// Literal union kept here to avoid a circular type dependency
// (checksums.ts imports MODULES from registry.ts at runtime, preventing registry.ts
// from safely importing this type back). When adding a module, also add its id here.
export type ModuleId = 'linkedin' | 'resume' | 'goals' | 'work' | 'clients';

export interface DeferredModule {
  module: ModuleId;
  snooze_until: string; // YYYY-MM-DD
}

export interface WorkInfo {
  self_employed: boolean;
  company_name: string;
  website?: string;
  company_description?: string;
}

export interface Profile {
  patina_name: string;
  name: string;
  title?: string;
  role_description?: string;
  job_description_url?: string;
  work: WorkInfo;
  editor: Editor;
  agent?: AgentId;
  modules: ModuleId[];
  content_dir: string;
  created: string;
  staleness_threshold_days?: number;
  launch_tasks?: string[];
  linkedin?: {
    profile_url: string;
  };
  _demo?: boolean;
}

export interface ScaffoldOptions {
  targetDir: string;
  patinaName: string;
  userName: string;
  title?: string;
  roleDescription: string;
  jobDescriptionUrl: string;
  work: WorkInfo;
  editor: Editor;
  agent?: AgentId;
  modules: ModuleId[];
  liProfileUrl: string;
  contentDir: string;
  launchTasks?: string[];
  /** Slugs of predefined audience archetypes to install. Defaults to all if omitted. */
  selectedArchetypes?: string[];
  demo?: boolean;
  /** ISO date string in YYYY-MM-DD format. Defaults to today. Used in demo mode for determinism. */
  today?: string;
}

export interface TemplateVars {
  PATINA_NAME: string;
  USER_NAME: string;
  USER_TITLE: string;
  ROLE_DESCRIPTION: string;
  COMPANY_NAME: string;
  COMPANY_DESCRIPTION: string;
  CONTENT_DIR: string;
  EDITOR: string;
  LI_PROFILE_URL: string;
  TODAY: string;
  STALENESS_THRESHOLD: string;
  MODULES_SECTION: string;
  COMMANDS_SECTION: string;
  GUIDE_COMMANDS: string;
  PATINA_VERSION: string;
  LAUNCH_SECTION: string;
  UPDATE_CHECK_SECTION: string;
  MODULE_README_BLOCKS: string;
  /** Agent path tokens — resolved before render() so templates stay agent-agnostic */
  AGENT_DIR: string;           // e.g. '.claude' or '.opencode'
  AGENT_COMMANDS_DIR: string;  // e.g. '.claude/commands' or '.opencode/command'
  AGENT_AGENTS_DIR: string;    // e.g. '.claude/agents' or '.opencode/agent'
  AGENT_SCRIPTS_DIR: string;   // e.g. '.claude/scripts' or '.opencode/scripts'
  AGENT_MEMORY_FILE: string;   // e.g. 'CLAUDE.md' or 'AGENTS.md'
  AGENT_DISPLAY_NAME: string;  // e.g. 'Claude Code' or 'opencode'
  AGENT_CLI: string;           // e.g. 'claude' or 'opencode'
  [key: string]: string;
}
