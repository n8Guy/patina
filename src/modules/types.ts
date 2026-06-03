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
   * When true, the wizard offers a "fill out now or later" choice after this
   * module is selected. If the user picks "now", promptsOnAdd is called.
   */
  requiresConfig?: boolean;

  /**
   * Collect module-specific inputs interactively before onAdd is called.
   * Only invoked when the user chooses "fill out now" during module selection.
   * Return value is passed directly to onAdd as ModuleAddInputs.
   */
  promptsOnAdd?(): Promise<ModuleAddInputs>;

  /**
   * Optional: return the inner markdown content for the README.md fenced block
   * that patina appends when this module is installed.
   */
  readmeBlock?(vars: TemplateVars): string;
  /**
   * Optional: launch tasks this module contributes to the catalog.
   */
  launchTasks?: readonly LaunchTaskDefinition[];
  /**
   * Required: return populated demo files for this module.
   * Called by runDemo() to populate a demo patina with realistic content.
   * Each tuple is [relativePath, content] relative to the patina root.
   * All returned files must have YAML frontmatter starting with `---\n`
   * so markDemo() can inject `_demo: true`.
   */
  demoContent(vars: TemplateVars, contentDir: string): Array<[string, string]>;
}
