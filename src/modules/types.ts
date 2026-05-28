import type { TemplateVars, Profile } from '../types.js';

export type FileEntry = [string, string];

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
}
