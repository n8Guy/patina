import { render } from '../../template.js';
import { tpl } from '../../template-loader.js';
import type { ModuleDefinition, FileEntry, ModuleAddInputs } from '../types.js';
import type { TemplateVars, Profile } from '../../types.js';

const LI_COMMANDS = [
  'li-all.md', 'li-about.md', 'li-headline.md', 'li-experience.md',
  'li-skills.md', 'li-featured.md', 'li-activity.md',
] as const;

// Single source of truth for managed paths — used by both managedPaths and managedFiles().
const LI_MANAGED_PATHS = [
  ...LI_COMMANDS.map(c => `.claude/commands/${c}`),
  '.claude/modules/linkedin/manifest.md',
  '.claude/modules/linkedin/CLAUDE.md',
] as const;

const CONTENT_FILE_NAMES = [
  'INSTRUCTIONS.md',
  'LinkedIn Current State.md',
  'LinkedIn About.md',
  'LinkedIn Headline.md',
  'LinkedIn Experience.md',
  'LinkedIn Skills.md',
  'LinkedIn Featured.md',
  'LinkedIn Activity.md',
] as const;

export const linkedinModule = {
  id: 'linkedin',
  label: 'LinkedIn',
  hint: 'draft and refine your LinkedIn profile',

  managedPaths: LI_MANAGED_PATHS,

  contentFileNames: CONTENT_FILE_NAMES,

  managedFiles(vars: TemplateVars): FileEntry[] {
    const files: FileEntry[] = LI_COMMANDS.map(cmd => [
      `.claude/commands/${cmd}`,
      render(tpl(`modules/linkedin/commands/${cmd}`), vars),
    ]);
    files.push([
      '.claude/modules/linkedin/manifest.md',
      render(tpl('modules/linkedin/manifest.md'), vars),
    ]);
    files.push([
      '.claude/modules/linkedin/CLAUDE.md',
      render(tpl('modules/linkedin/CLAUDE.md'), vars),
    ]);
    return files;
  },

  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[] {
    return CONTENT_FILE_NAMES.map(file => [
      `${contentDir}/linkedin/${file}`,
      render(tpl(`modules/linkedin/graph/${file}`), vars),
    ]);
  },

  onAdd(profile: Profile, inputs: ModuleAddInputs): Profile {
    if (!profile.linkedin?.profile_url && inputs.liProfileUrl?.trim()) {
      return { ...profile, linkedin: { profile_url: inputs.liProfileUrl.trim() } };
    }
    return profile;
  },

  onRemove(profile: Profile): Profile {
    const updated = { ...profile };
    delete (updated as Partial<Profile>).linkedin;
    return updated;
  },

  launchTasks: [
    {
      id: 'open-drafts',
      label: 'Show open LinkedIn drafts',
      template: '- Show any LinkedIn section drafts in `{{CONTENT_DIR}}/linkedin/` that have content to review.',
    },
  ] as const,

  readmeBlock(vars: TemplateVars): string {
    return [
      '## LinkedIn module',
      '',
      'Drafts and refines your LinkedIn profile from your graph.',
      '',
      '### Folder additions',
      '',
      '```',
      `${vars.CONTENT_DIR}/linkedin/`,
      '  INSTRUCTIONS.md              — module rules and guidance',
      '  LinkedIn Current State.md    — your current live profile copy',
      '  LinkedIn About.md            — draft for the About section',
      '  LinkedIn Headline.md         — draft for your headline',
      '  LinkedIn Experience.md       — draft for your experience entries',
      '  LinkedIn Skills.md           — draft for your skills section',
      '  LinkedIn Featured.md         — draft for featured content',
      '  LinkedIn Activity.md         — draft for activity/posts section',
      '```',
      '',
      '### Commands',
      '',
      '| Command | What it does |',
      '|---------|-------------|',
      '| `/li-all` | Run all LinkedIn section drafts in sequence |',
      '| `/li-about` | Draft or refine your LinkedIn About section |',
      '| `/li-headline` | Draft or refine your LinkedIn headline |',
      '| `/li-experience` | Draft or refine your LinkedIn experience entries |',
      '| `/li-skills` | Draft or refine your LinkedIn skills section |',
      '| `/li-featured` | Draft or refine your LinkedIn featured content |',
      '| `/li-activity` | Draft or refine your LinkedIn activity section |',
    ].join('\n');
  },
} satisfies ModuleDefinition;
