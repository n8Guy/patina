import type { ChecksumMap } from './checksums.js';

export type Editor = 'obsidian' | 'vscode' | 'other';

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
