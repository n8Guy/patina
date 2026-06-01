import { render } from '../../template.js';
import { tpl } from '../../template-loader.js';
import type { ModuleDefinition, FileEntry } from '../types.js';
import type { TemplateVars } from '../../types.js';

// Single source of truth for managed paths.
const RESUME_MANAGED_PATHS = [
  '.claude/commands/resume-refresh.md',
  '.claude/modules/resume/CLAUDE.md',
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
    return [
      ['.claude/commands/resume-refresh.md', render(tpl('modules/resume/commands/resume-refresh.md'), vars)],
      ['.claude/modules/resume/CLAUDE.md', render(tpl('modules/resume/CLAUDE.md'), vars)],
      ['.claude/modules/resume/manifest.md', render(tpl('modules/resume/manifest.md'), vars)],
    ];
  },

  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[] {
    return CONTENT_FILE_NAMES.map(file => [
      `${contentDir}/resume/${file}`,
      render(tpl(`modules/resume/graph/${file}`), vars),
    ]);
  },

  readmeBlock(vars: TemplateVars): string {
    return [
      '## Resume module',
      '',
      'Keeps your resume current by synthesising it from your graph.',
      '',
      '### Folder additions',
      '',
      '```',
      `${vars.CONTENT_DIR}/resume/`,
      '  INSTRUCTIONS.md              — module rules and guidance',
      '  Resume Working Draft.md      — the resume you are actively editing',
      '  Resume Last Submitted.md     — the version you last sent to an employer',
      '```',
      '',
      '### Commands',
      '',
      '| Command | What it does |',
      '|---------|-------------|',
      '| `/resume-refresh` | Refresh your resume working draft from your graph |',
    ].join('\n');
  },

  // Resume has no module-specific profile fields — no onAdd/onRemove needed.
} satisfies ModuleDefinition;
