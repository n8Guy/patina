import { execSync } from 'child_process';
import { render } from '../template.js';
import { tpl } from '../template-loader.js';
import { buildRoutingFile } from '../scaffold-routing.js';
import { PREDEFINED_ARCHETYPES } from '../scaffold-constants.js';
import type { TemplateVars } from '../types.js';
import type { AgentAdapter, AgentPathVars, BaseManagedFilesOpts } from './types.js';

function rewritePath(p: string): string {
  return p
    .replace(/^\.claude\/commands\//, '.opencode/commands/')
    .replace(/^\.claude\/agents\//, '.opencode/agents/')
    .replace(/^\.claude\/scripts\//, '.opencode/scripts/')
    .replace(/^\.claude\/modules\//, '.opencode/modules/')
    .replace(/^\.claude\//, '.opencode/');
}

export const OPENCODE_PATH_VARS: AgentPathVars = {
  AGENT_DIR: '.opencode',
  AGENT_COMMANDS_DIR: '.opencode/commands',
  AGENT_AGENTS_DIR: '.opencode/agents',
  AGENT_SCRIPTS_DIR: '.opencode/scripts',
  AGENT_MEMORY_FILE: 'AGENTS.md',
  AGENT_DISPLAY_NAME: 'opencode',
  AGENT_CLI: 'opencode',
};

export const opencodeAdapter: AgentAdapter = {
  agentId: 'opencode',
  displayName: 'opencode',
  cliCommand: 'opencode',
  installUrl: 'https://opencode.ai',
  pathVars: OPENCODE_PATH_VARS,

  baseManagedFiles(vars: TemplateVars, opts: BaseManagedFilesOpts): Array<[string, string]> {
    const { editor, modules = [] } = opts;

    // opencode uses AGENTS.md (rendered from CLAUDE.md template with updated path tokens)
    // and .opencode/commands/ for slash commands, .opencode/scripts/ for node scripts.
    // settings.json is Claude Code-specific and is NOT emitted.
    const files: Array<[string, string]> = [
      ['README.md', render(tpl('README.md'), vars)],
      ['AGENTS.md', render(tpl('CLAUDE.md'), vars)],
      ['.opencode/scripts/staleness-check.mjs', render(tpl('.claude/scripts/staleness-check.mjs'), vars)],
      ['.opencode/scripts/health-check.mjs', tpl('.claude/scripts/health-check.mjs')],
      ['.opencode/commands/add.md', render(tpl('.claude/commands/add.md'), vars)],
      ['.opencode/commands/reflect.md', render(tpl('.claude/commands/reflect.md'), vars)],
      ['.opencode/commands/inbox.md', render(tpl('.claude/commands/inbox.md'), vars)],
      ['.opencode/commands/status.md', render(tpl('.claude/commands/status.md'), vars)],
      ['.opencode/commands/guide.md', render(tpl('.claude/commands/guide.md'), vars)],
      ['.opencode/commands/audience.md', render(tpl('.claude/commands/audience.md'), vars)],
      ['.opencode/commands/with-audience.md', render(tpl('.claude/commands/with-audience.md'), vars)],
      ['.opencode/inbox-routing.md', buildRoutingFile(modules, vars)],
    ];

    // No check-update.mjs for opencode v1 — opencode has no hooks/settings.json equivalent.

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
    // Module managedFiles() already uses vars.AGENT_COMMANDS_DIR/AGENT_DIR — identity transform.
    return entries;
  },

  baseManagedPaths(opts: { editor: string }): readonly string[] {
    const paths: string[] = [
      'README.md',
      'AGENTS.md',
      '.opencode/commands/add.md',
      '.opencode/commands/reflect.md',
      '.opencode/commands/inbox.md',
      '.opencode/commands/status.md',
      '.opencode/commands/guide.md',
      '.opencode/commands/audience.md',
      '.opencode/commands/with-audience.md',
      '.opencode/inbox-routing.md',
      '.opencode/agents/hiring-manager.md',
      '.opencode/agents/recruiter.md',
      '.opencode/scripts/staleness-check.mjs',
      '.opencode/scripts/health-check.mjs',
    ];
    if (opts.editor === 'vscode') paths.push('.vscode/settings.json');
    return paths;
  },

  mapModuleManagedPaths(_moduleId: string, canonicalPaths: readonly string[]): readonly string[] {
    return canonicalPaths.map(rewritePath);
  },

  archetypeFiles(vars: TemplateVars, slugs?: readonly string[]): Array<[string, string]> {
    const archetypes = slugs
      ? PREDEFINED_ARCHETYPES.filter(a => slugs.includes(a.slug))
      : PREDEFINED_ARCHETYPES;
    return archetypes.map(a => {
      const srcPath = `.claude/agents/${a.slug}.md`;
      const outPath = `.opencode/agents/${a.slug}.md`;
      const raw = tpl(srcPath);
      return [outPath, render(raw, vars)];
    });
  },

  archetypePath(slug: string): string {
    return `.opencode/agents/${slug}.md`;
  },

  detect(): boolean {
    try {
      execSync('opencode --version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  },

  renderUpdateCheckSection(_vars: TemplateVars): string | null {
    // opencode v1 has no auto-update hook mechanism; return null to omit the section.
    return null;
  },

  audiencePrefsGitignoreEntry(): string {
    return '.opencode/audience-prefs.json';
  },

  inboxRoutingPath(): string {
    return '.opencode/inbox-routing.md';
  },
};
