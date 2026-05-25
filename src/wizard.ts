import * as p from '@clack/prompts';
import chalk from 'chalk';
import { join, resolve } from 'path';
import { readFileSync } from 'fs';
import yaml from 'js-yaml';
import { detectMode } from './detect.js';
import { scaffold } from './scaffold.js';
import type { Editor, ModuleId, Profile, WorkInfo } from './types.js';

// ─── Brand ───────────────────────────────────────────────────────────────────

function printBanner(): void {
  const gradient = ['#FF6B6B', '#FF8C42', '#FFAB2E', '#C084FC', '#818CF8'];
  const title = 'my-patina'
    .split('')
    .map((char, i) => chalk.bold.hex(gradient[i % gradient.length])(char))
    .join('');

  console.log('');
  console.log(`  ${title}`);
  console.log(`  ${chalk.hex('#94A3B8')('your professional story, organized')}`);
  console.log('');
}

function privacyNote(): string {
  return [
    chalk.bold.hex('#38BDF8')('Everything you enter stays on your computer.'),
    chalk.hex('#CBD5E1')(
      'Nothing is sent to the internet during setup, and nothing\n' +
      'is shared with anyone. Your answers go into a single file\n' +
      'inside your patina folder that you can open, edit, or delete\n' +
      'at any time.'
    ),
  ].join('\n\n');
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function slugify(str: string): string {
  return (
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'patina'
  );
}

function label(text: string): string {
  return chalk.bold.hex('#C084FC')(text);
}

// ─── Main ────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  printBanner();

  const cwd = process.cwd();
  const mode = detectMode(cwd);

  if (mode === 'update') {
    await runUpdate(cwd);
  } else {
    await runInstall(cwd);
  }
}

// ─── Install ─────────────────────────────────────────────────────────────────

async function runInstall(cwd: string): Promise<void> {
  p.intro(chalk.hex('#94A3B8')("No patina found here — let's create one."));
  p.note(privacyNote(), label('Privacy first'));

  // ── Identity
  const identity = await p.group(
    {
      patinaName: () =>
        p.text({
          message: 'What do you want to call your patina?',
          placeholder: 'patina',
          defaultValue: 'patina',
          hint: chalk.hex('#64748B')('becomes your folder name'),
        }),

      userName: () =>
        p.text({
          message: "What's your name?",
          placeholder: 'Your full name',
          validate: (v) => (v.trim() === '' ? 'Name is required.' : undefined),
        }),

      title: () =>
        p.text({
          message: "What's your professional title?",
          placeholder: 'e.g. Senior Engineer, Creative Director, Freelance Photographer',
        }),

      roleDescription: () =>
        p.text({
          message: 'Describe what you do — in your own words, not your title.',
          placeholder: 'e.g. I lead a small team building software for financial advisors',
          hint: chalk.hex('#64748B')('optional, but helps a lot — hit enter to skip'),
        }),

      jobDescriptionUrl: () =>
        p.text({
          message: 'Got a link to a job description or role overview?',
          placeholder: 'https://...',
          hint: chalk.hex('#64748B')('optional — hit enter to skip'),
        }),
    },
    { onCancel }
  );

  // ── Work
  console.log('');
  console.log(`  ${label('Where you work')}`);

  const selfEmployed = await p.confirm({
    message: 'Are you self-employed or freelance?',
    initialValue: false,
  });
  if (p.isCancel(selfEmployed)) onCancel();

  const companyLabel = selfEmployed
    ? "What's your company called?"
    : 'Where do you work?';

  const companyPlaceholder = selfEmployed ? 'Freelance' : 'Company or organisation name';

  const work = await p.group(
    {
      companyName: () =>
        p.text({
          message: companyLabel,
          placeholder: companyPlaceholder,
          hint: chalk.hex('#64748B')(selfEmployed ? 'hit enter to use "Freelance"' : ''),
        }),

      website: () =>
        p.text({
          message: selfEmployed ? 'Company website?' : 'Their website?',
          placeholder: 'https://...',
          hint: chalk.hex('#64748B')('optional'),
        }),

      companyDescription: () =>
        p.text({
          message: selfEmployed ? 'What does your company do?' : 'What does the company do?',
          placeholder: 'One or two sentences',
          hint: chalk.hex('#64748B')('helps generate more relevant content'),
        }),
    },
    { onCancel }
  );

  // ── Setup
  console.log('');
  console.log(`  ${label('Setup')}`);

  const setup = await p.group(
    {
      editor: () =>
        p.select<{ value: Editor; label: string; hint?: string }[], Editor>({
          message: 'How do you want to view and edit your files?',
          options: [
            {
              value: 'obsidian',
              label: 'Obsidian',
              hint: chalk.hex('#64748B')('free app — adds AI access to your files'),
            },
            { value: 'vscode', label: 'VS Code' },
            { value: 'other', label: "I'll choose later" },
          ],
        }),

      modules: () =>
        p.multiselect<{ value: ModuleId; label: string; hint?: string }[], ModuleId>({
          message: 'Which modules do you want to add?',
          options: [
            {
              value: 'linkedin',
              label: 'LinkedIn',
              hint: chalk.hex('#64748B')('draft and refine your LinkedIn profile'),
            },
          ],
          required: false,
        }),
    },
    { onCancel }
  );

  const modules: ModuleId[] = Array.isArray(setup.modules) ? setup.modules : [];
  let liProfileUrl = '';

  if (modules.includes('linkedin')) {
    const url = await p.text({
      message: "What's your LinkedIn profile URL?",
      placeholder: 'https://linkedin.com/in/yourname',
      hint: chalk.hex('#64748B')('optional — you can add this later in profile.yaml'),
    });
    liProfileUrl = typeof url === 'string' ? url : '';
  }

  // ── Scaffold
  const slug = slugify(identity.patinaName);
  const targetDir = resolve(cwd, slug);

  const s = p.spinner();
  s.start(chalk.hex('#C084FC')('Creating your patina...'));

  const workInfo: WorkInfo = {
    self_employed: selfEmployed as boolean,
    company_name: work.companyName?.trim() || (selfEmployed ? 'Freelance' : ''),
    website: work.website?.trim() || undefined,
    company_description: work.companyDescription?.trim() || undefined,
  };

  try {
    await scaffold({
      targetDir,
      patinaName: identity.patinaName,
      userName: identity.userName.trim(),
      title: (identity.title ?? '').trim(),
      roleDescription: (identity.roleDescription ?? '').trim(),
      jobDescriptionUrl: (identity.jobDescriptionUrl ?? '').trim(),
      work: workInfo,
      editor: setup.editor,
      modules,
      liProfileUrl,
      contentDir: 'graph',
    });
    s.stop(chalk.green('Done.'));
  } catch (err) {
    s.stop(chalk.red('Something went wrong.'));
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  p.note(
    [
      chalk.hex('#94A3B8')('  cd ') + chalk.bold.white(slug),
      chalk.hex('#94A3B8')('  claude'),
    ].join('\n'),
    label('Next steps')
  );

  p.outro(chalk.hex('#94A3B8')('Run claude from inside your patina to get started.'));
}

// ─── Update ──────────────────────────────────────────────────────────────────

async function runUpdate(cwd: string): Promise<void> {
  const profile = yaml.load(readFileSync(join(cwd, 'profile.yaml'), 'utf8')) as Profile;

  p.intro(chalk.hex('#94A3B8')(`Found: ${chalk.bold.white(profile.patina_name || 'patina')}`));

  p.note(
    [
      `${chalk.hex('#64748B')('Name:')}    ${profile.name}`,
      `${chalk.hex('#64748B')('Title:')}   ${profile.title || '—'}`,
      `${chalk.hex('#64748B')('Company:')} ${profile.work?.company_name || '—'}`,
      `${chalk.hex('#64748B')('Modules:')} ${profile.modules?.join(', ') || 'none'}`,
    ].join('\n'),
    label('Current profile')
  );

  const action = await p.select({
    message: 'What do you want to do?',
    options: [
      { value: 'profile', label: 'Update personal info' },
      { value: 'modules', label: 'Add or remove modules' },
      { value: 'nothing', label: 'Nothing — just checking' },
    ],
  });

  if (p.isCancel(action) || action === 'nothing') {
    p.outro(chalk.hex('#94A3B8')('No changes made.'));
    return;
  }

  p.log.warn('Full update flow coming in a future release.');
  p.outro('');
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function onCancel(): never {
  p.cancel(chalk.hex('#94A3B8')('Setup cancelled.'));
  process.exit(0);
}
