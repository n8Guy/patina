import type { TemplateVars, Profile } from '../types.js';

export type FileEntry = [string, string];

export interface LaunchTaskDefinition {
  id: string;       // e.g. 'open-drafts'; module/base prefix added by convention
  label: string;    // shown in wizard multiselect
  template: string; // markdown instruction injected into CLAUDE.md launch block
}

/** Inputs available to onAdd — collected before the helper is called. */
export interface ModuleAddInputs {
  [key: string]: string | undefined;
}

export interface ModuleDefinition {
  id: string;
  label: string;
  hint: string;
  /**
   * Static managed file paths — must reference the same paths produced by managedFiles().
   * Define as a const in the module file and use it in both managedPaths and managedFiles()
   * to keep them in sync (single source of truth).
   */
  managedPaths: readonly string[];
  contentFileNames: readonly string[];
  managedFiles(vars: TemplateVars): FileEntry[];
  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[];
  /**
   * Optional: mutate the profile when this module is added.
   * Called after file writes, before profile.yaml is saved.
   */
  onAdd?(profile: Profile, inputs: ModuleAddInputs): Profile;
  /**
   * Optional: mutate the profile when this module is removed.
   * Called after file deletions, before profile.yaml is saved.
   */
  onRemove?(profile: Profile): Profile;
  /**
   * Optional: return the inner markdown content for the README.md fenced block
   * that patina appends when this module is installed.
   */
  readmeBlock?(vars: TemplateVars): string;
  /**
   * Optional: launch tasks this module contributes to the catalog.
   */
  launchTasks?: readonly LaunchTaskDefinition[];
}
