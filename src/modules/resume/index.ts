import { render } from '../../template.js';
import { tpl } from '../../template-loader.js';
import type { ModuleDefinition, FileEntry } from '../types.js';
import type { TemplateVars } from '../../types.js';

// Single source of truth for managed paths.
const RESUME_MANAGED_PATHS = [
  '.claude/commands/resume-refresh.md',
  '.claude/modules/resume/manifest.md',
] as const;

const CONTENT_FILE_NAMES = [
  'INSTRUCTIONS.md',
  'Resume Working Draft.md',
  'Resume Last Submitted.md',
] as const;

export const resumeModule = {
  id: 'resume',
  label: 'Resume',
  hint: 'keep your resume current from your graph',

  managedPaths: RESUME_MANAGED_PATHS,

  contentFileNames: CONTENT_FILE_NAMES,

  managedFiles(vars: TemplateVars): FileEntry[] {
    const [commandPath, manifestPath] = RESUME_MANAGED_PATHS;
    return [
      [commandPath, render(tpl('modules/resume/commands/resume-refresh.md'), vars)],
      [manifestPath, render(tpl('modules/resume/manifest.md'), vars)],
    ];
  },

  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[] {
    return CONTENT_FILE_NAMES.map(file => [
      `${contentDir}/resume/${file}`,
      render(tpl(`modules/resume/graph/${file}`), vars),
    ]);
  },

  // Resume has no module-specific profile fields — no onAdd/onRemove needed.
} satisfies ModuleDefinition;
