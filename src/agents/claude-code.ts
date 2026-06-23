import { render } from '../template.js';
import { tpl } from '../template-loader.js';
import { detectClaude } from '../wizard-editor.js';
import { buildRoutingFile, renderUpdateCheckSection } from '../scaffold-routing.js';
import { PREDEFINED_ARCHETYPES } from '../scaffold-constants.js';
import type { TemplateVars } from '../types.js';
import type { AgentAdapter, AgentPathVars, BaseManagedFilesOpts } from './types.js';

export const CLAUDE_PATH_VARS: AgentPathVars = {
  AGENT_DIR: '.claude',
  AGENT_COMMANDS_DIR: '.claude/commands',
  AGENT_AGENTS_DIR: '.claude/agents',
  AGENT_SCRIPTS_DIR: '.claude/scripts',
  AGENT_MEMORY_FILE: 'CLAUDE.md',
  AGENT_DISPLAY_NAME: 'Claude Code',
  AGENT_CLI: 'claude',
};

export const claudeCodeAdapter: AgentAdapter = {
  agentId: 'claude-code',
  displayName: 'Claude Code',
  cliCommand: 'claude',
  installUrl: 'https://claude.ai/code',
  pathVars: CLAUDE_PATH_VARS,

  baseManagedFiles(vars: TemplateVars, opts: BaseManagedFilesOpts): Array<[string, string]> {
    const { editor, modules = [] } = opts;

    const files: Array<[string, string]> = [
      ['README.md', render(tpl('README.md'), vars)],
      ['CLAUDE.md', render(tpl('CLAUDE.md'), vars)],
      ['.claude/settings.json', tpl('.claude/settings.json')],
      ['.claude/scripts/check-update.mjs', render(tpl('.claude/scripts/check-update.mjs'), vars)],
      ['.claude/scripts/staleness-check.mjs', render(tpl('.claude/scripts/staleness-check.mjs'), vars)],
      ['.claude/scripts/health-check.mjs', tpl('.claude/scripts/health-check.mjs')],
      ['.claude/commands/add.md', render(tpl('.claude/commands/add.md'), vars)],
      ['.claude/commands/reflect.md', render(tpl('.claude/commands/reflect.md'), vars)],
      ['.claude/commands/inbox.md', render(tpl('.claude/commands/inbox.md'), vars)],
      ['.claude/commands/status.md', render(tpl('.claude/commands/status.md'), vars)],
      ['.claude/commands/guide.md', render(tpl('.claude/commands/guide.md'), vars)],
      ['.claude/commands/audience.md', render(tpl('.claude/commands/audience.md'), vars)],
      ['.claude/commands/with-audience.md', render(tpl('.claude/commands/with-audience.md'), vars)],
      ['.claude/inbox-routing.md', buildRoutingFile(modules, vars)],
    ];

    if (editor === 'vscode') {
      const vscodeSettings = {
        _patina: 'managed',
        _patina_note: 'This file is managed by patina and is overwritten on update. Remove the _patina key to take ownership.',
        'workbench.editorAssociations': {
          '*.md': 'vscode.markdown.preview.editor',
        },
      };
      files.push(['.vscode/settings.json', JSON.stringify(vscodeSettings, null, 2) + '\n']);
    }

    return files;
  },

  mapModuleManagedFiles(_moduleId: string, entries: Array<[string, string]>, _vars: TemplateVars): Array<[string, string]> {
    // Claude Code modules already emit .claude/... paths — identity transform
    return entries;
  },

  baseManagedPaths(opts: { editor: string }): readonly string[] {
    const paths: string[] = [
      'README.md',
      'CLAUDE.md',
      '.claude/settings.json',
      '.claude/commands/add.md',
      '.claude/commands/reflect.md',
      '.claude/commands/inbox.md',
      '.claude/commands/status.md',
      '.claude/commands/guide.md',
      '.claude/commands/audience.md',
      '.claude/commands/with-audience.md',
      '.claude/inbox-routing.md',
      '.claude/agents/hiring-manager.md',
      '.claude/agents/recruiter.md',
      '.claude/scripts/check-update.mjs',
      '.claude/scripts/staleness-check.mjs',
      '.claude/scripts/health-check.mjs',
    ];
    if (opts.editor === 'vscode') paths.push('.vscode/settings.json');
    return paths;
  },

  mapModuleManagedPaths(_moduleId: string, canonicalPaths: readonly string[]): readonly string[] {
    // Claude Code modules already use .claude/... — identity transform
    return canonicalPaths;
  },

  archetypeFiles(vars: TemplateVars, slugs?: readonly string[]): Array<[string, string]> {
    const archetypes = slugs
      ? PREDEFINED_ARCHETYPES.filter(a => slugs.includes(a.slug))
      : PREDEFINED_ARCHETYPES;
    return archetypes.map(a => {
      const p = `.claude/agents/${a.slug}.md`;
      const raw = tpl(p);
      return [p, render(raw, vars)];
    });
  },

  archetypePath(slug: string): string {
    return `.claude/agents/${slug}.md`;
  },

  detect(): boolean {
    return detectClaude();
  },

  renderUpdateCheckSection(vars: TemplateVars): string | null {
    return renderUpdateCheckSection(vars);
  },

  audiencePrefsGitignoreEntry(): string {
    return '.claude/audience-prefs.json';
  },

  inboxRoutingPath(): string {
    return '.claude/inbox-routing.md';
  },
};
