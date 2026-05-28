import type { ChecksumMap } from './checksums.js';

export type Editor = 'obsidian' | 'vscode' | 'other';

export type ValidationCheckId = 'wiki-links' | 'exclusions' | 'skill-notes';

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
export type ModuleId = 'linkedin' | 'resume';

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
  modules: ModuleId[];
  content_dir: string;
  created: string;
  linkedin?: {
    profile_url: string;
  };
  _checksums?: ChecksumMap;
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
  modules: ModuleId[];
  liProfileUrl: string;
  contentDir: string;
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
  [key: string]: string;
}
