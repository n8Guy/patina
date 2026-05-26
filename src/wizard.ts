import * as p from '@clack/prompts';
import chalk from 'chalk';
import { dirname, join, resolve } from 'path';
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { detectMode } from './detect.js';
import { scaffold, profileToVars, baseManagedFiles, moduleManagedFiles, moduleContentFiles } from './scaffold.js';
import { writeManagedFile } from './upgrade.js';
import { hashFile, MODULE_MANAGED_FILES, type ChecksumMap } from './checksums.js';
import type { Editor, ModuleId, Profile, WorkInfo } from './types.js';

// @clack/prompts supports hint on text inputs at runtime but the type definitions omit it.
declare module '@clack/prompts' {
  interface TextOptions {
    hint?: string;
  }
}

// ─── Brand ───────────────────────────────────────────────────────────────────

function printBanner(): void {
  const gradient = ['#FF6B6B', '#FF8C42', '#FFAB2E', '#C084FC', '#818CF8'];
  const title = 'patina'
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
    chalk.bold.hex('#38BDF8')('Your content stays on your computer. Always.'),
    chalk.hex('#CBD5E1')(
      'Everything in your patina — your profile, notes, skills,\n' +
      'and LinkedIn drafts — lives in a folder on your machine.\n' +
      'Nothing is sent to the internet, nothing is stored in the\n' +
      'cloud, and nothing is shared with anyone. You own it all\n' +
      'and can open, edit, or delete any of it at any time.'
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

const MULTISELECT_HINT = `\n  ${chalk.hex('#64748B')('↑↓ to move  ·  space to select  ·  enter to confirm')}`;
const OPTIONAL_HINT = ` ${chalk.dim.italic('optional, but helps a lot — hit enter to skip')}`;

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
          message: `What's your professional title?${OPTIONAL_HINT}`,
          placeholder: 'e.g. Senior Engineer, Creative Director, Freelance Photographer',
        }),

      roleDescription: () =>
        p.text({
          message: `Describe what you do — in your own words, not your title.${OPTIONAL_HINT}`,
          placeholder: 'e.g. I lead a small team building software for financial advisors',
        }),

      jobDescriptionUrl: () =>
        p.text({
          message: `Got a link to a job description or role overview?${OPTIONAL_HINT}`,
          placeholder: 'https://...',
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
          message: `${selfEmployed ? 'Company website?' : 'Their website?'}${OPTIONAL_HINT}`,
          placeholder: 'https://...',
        }),

      companyDescription: () =>
        p.text({
          message: `${selfEmployed ? 'What does your company do?' : 'What does the company do?'}${OPTIONAL_HINT}`,
          placeholder: 'One or two sentences',
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
        p.select<Editor>({
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
        p.multiselect<ModuleId>({
          message: `Which modules do you want to add?${MULTISELECT_HINT}`,
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

/** Write profile.yaml atomically at the end of an update operation. */
function writeProfile(cwd: string, profile: Profile): void {
  const full = join(cwd, 'profile.yaml');
  writeFileSync(full, yaml.dump(profile), 'utf8');
}

/**
 * Delete a managed file only if the user has not modified it since it was
 * written (i.e. the current hash matches the stored checksum).
 * Returns 'deleted' or 'kept'.
 */
export function removeManagedFileIfUnmodified(
  targetDir: string,
  rel: string,
  stored: ChecksumMap
): 'deleted' | 'kept' {
  const fullPath = join(targetDir, rel);
  if (!existsSync(fullPath)) return 'deleted'; // already gone
  const currentHash = hashFile(fullPath);
  const storedHash = stored[rel];
  if (storedHash && currentHash !== storedHash) {
    return 'kept'; // user has edited it
  }
  unlinkSync(fullPath);
  return 'deleted';
}

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

  if (action === 'profile') {
    await runUpdateProfile(cwd, profile);
  } else if (action === 'modules') {
    await runUpdateModules(cwd, profile);
  }
}

// ─── Branch A: Update personal info ──────────────────────────────────────────

async function runUpdateProfile(cwd: string, profile: Profile): Promise<void> {
  console.log('');
  console.log(`  ${label('Update personal info')}`);
  console.log(`  ${chalk.hex('#64748B')('Press enter to keep the current value.')}`);

  const identity = await p.group(
    {
      name: () =>
        p.text({
          message: "What's your name?",
          initialValue: profile.name,
          validate: (v) => (v.trim() === '' ? 'Name is required.' : undefined),
        }),

      title: () =>
        p.text({
          message: `What's your professional title?${OPTIONAL_HINT}`,
          initialValue: profile.title ?? '',
        }),

      roleDescription: () =>
        p.text({
          message: `Describe what you do — in your own words, not your title.${OPTIONAL_HINT}`,
          initialValue: profile.role_description ?? '',
        }),

      jobDescriptionUrl: () =>
        p.text({
          message: `Got a link to a job description or role overview?${OPTIONAL_HINT}`,
          initialValue: profile.job_description_url ?? '',
        }),
    },
    { onCancel }
  );

  // ── Work
  console.log('');
  console.log(`  ${label('Where you work')}`);

  const selfEmployed = await p.confirm({
    message: 'Are you self-employed or freelance?',
    initialValue: profile.work?.self_employed ?? false,
  });
  if (p.isCancel(selfEmployed)) onCancel();

  const companyLabel = selfEmployed
    ? "What's your company called?"
    : 'Where do you work?';

  const work = await p.group(
    {
      companyName: () =>
        p.text({
          message: companyLabel,
          initialValue: profile.work?.company_name ?? '',
        }),

      website: () =>
        p.text({
          message: `${selfEmployed ? 'Company website?' : 'Their website?'}${OPTIONAL_HINT}`,
          initialValue: profile.work?.website ?? '',
        }),

      companyDescription: () =>
        p.text({
          message: `${selfEmployed ? 'What does your company do?' : 'What does the company do?'}${OPTIONAL_HINT}`,
          initialValue: profile.work?.company_description ?? '',
        }),
    },
    { onCancel }
  );

  // Build updated profile (direct field assignment — do NOT use mergeProfile)
  const updatedProfile: Profile = {
    ...profile,
    name: identity.name.trim(),
    title: (identity.title ?? '').trim(),
    role_description: (identity.roleDescription ?? '').trim() || undefined,
    job_description_url: (identity.jobDescriptionUrl ?? '').trim() || undefined,
    work: {
      self_employed: selfEmployed as boolean,
      company_name: work.companyName?.trim() || (selfEmployed ? 'Freelance' : ''),
      website: work.website?.trim() || undefined,
      company_description: work.companyDescription?.trim() || undefined,
    },
  };

  // Re-render and re-write all managed files
  const vars = profileToVars(updatedProfile);
  const stored: ChecksumMap = profile._checksums ?? {};
  const newChecksums: ChecksumMap = {};

  const files = [
    ...baseManagedFiles(vars, updatedProfile.editor, cwd),
    ...updatedProfile.modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  const updated: string[] = [];
  const skipped: string[] = [];

  for (const [rel, content] of files) {
    const { outcome, checksum } = writeManagedFile(cwd, rel, content, stored);
    newChecksums[rel] = checksum;
    if (outcome === 'skipped') {
      skipped.push(rel);
    } else {
      updated.push(rel);
    }
  }

  // Preserve checksums for files not in the current render pass
  for (const [rel, hash] of Object.entries(stored)) {
    if (!(rel in newChecksums)) {
      newChecksums[rel] = hash;
    }
  }

  updatedProfile._checksums = newChecksums;

  // Write profile.yaml atomically at the very end
  writeProfile(cwd, updatedProfile);

  const summaryLines: string[] = [];
  if (updated.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Updated: ${updated.join(', ')}`));
  }
  if (skipped.length > 0) {
    summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edits: ${skipped.join(', ')}`));
  }

  p.note(summaryLines.join('\n'), label('Done'));
  p.outro(chalk.hex('#94A3B8')('Profile updated.'));
}

// ─── Branch B: Add or remove modules ─────────────────────────────────────────

async function runUpdateModules(cwd: string, profile: Profile): Promise<void> {
  const currentModules = profile.modules ?? [];

  const selected = await p.multiselect({
    message: `Which modules do you want active?${MULTISELECT_HINT}`,
    options: [
      {
        value: 'linkedin',
        label: 'LinkedIn',
        hint: chalk.hex('#64748B')('draft and refine your LinkedIn profile'),
      },
    ],
    initialValues: currentModules,
    required: false,
  });

  if (p.isCancel(selected)) {
    p.cancel(chalk.hex('#94A3B8')('No changes made.'));
    return;
  }

  const selectedModules: ModuleId[] = Array.isArray(selected) ? (selected as ModuleId[]) : [];
  const toAdd = selectedModules.filter(m => !currentModules.includes(m));
  const toRemove = currentModules.filter(m => !selectedModules.includes(m));

  if (toAdd.length === 0 && toRemove.length === 0) {
    p.outro(chalk.hex('#94A3B8')('No changes — modules unchanged.'));
    return;
  }

  const stored: ChecksumMap = profile._checksums ?? {};
  const newChecksums: ChecksumMap = { ...stored };
  const updatedProfile: Profile = { ...profile, modules: [...currentModules] };

  const addedFiles: string[] = [];
  const skippedFiles: string[] = [];
  const deletedFiles: string[] = [];
  const keptFiles: string[] = [];

  // ── Add modules
  for (const module of toAdd) {
    // Prompt for LinkedIn URL if not already set
    if (module === 'linkedin' && !updatedProfile.linkedin?.profile_url) {
      const url = await p.text({
        message: "What's your LinkedIn profile URL?",
        placeholder: 'https://linkedin.com/in/yourname (optional)',
      });
      if (p.isCancel(url)) {
        p.cancel(chalk.hex('#94A3B8')('No changes made.'));
        return;
      }
      if (typeof url === 'string' && url.trim()) {
        updatedProfile.linkedin = { profile_url: url.trim() };
      }
    }

    const vars = profileToVars(updatedProfile);
    const contentDir = updatedProfile.content_dir;

    // Write managed files
    for (const [rel, content] of moduleManagedFiles(module, vars)) {
      const { outcome, checksum } = writeManagedFile(cwd, rel, content, stored);
      newChecksums[rel] = checksum;
      if (outcome === 'skipped') {
        skippedFiles.push(rel);
      } else {
        addedFiles.push(rel);
      }
    }

    // Write content-dir files only if they don't already exist
    for (const [relativePath, content] of moduleContentFiles(module, vars, contentDir)) {
      const fullPath = join(cwd, relativePath);
      if (!existsSync(fullPath)) {
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content, 'utf8');
        addedFiles.push(relativePath);
      }
    }

    updatedProfile.modules = [...updatedProfile.modules, module];
  }

  // ── Remove modules
  for (const module of toRemove) {
    const managedRels = MODULE_MANAGED_FILES[module] ?? [];
    for (const rel of managedRels) {
      const result = removeManagedFileIfUnmodified(cwd, rel, stored);
      if (result === 'deleted') {
        deletedFiles.push(rel);
        delete newChecksums[rel];
      } else {
        keptFiles.push(rel);
      }
    }
    // Content-dir files are never deleted
    updatedProfile.modules = updatedProfile.modules.filter(m => m !== module);

    // Remove linkedin data from profile if module removed
    if (module === 'linkedin') {
      delete (updatedProfile as Partial<Profile>).linkedin;
    }
  }

  updatedProfile._checksums = newChecksums;

  // Write profile.yaml atomically at the very end
  writeProfile(cwd, updatedProfile);

  const summaryLines: string[] = [];
  if (addedFiles.length > 0) summaryLines.push(chalk.hex('#94A3B8')(`Added: ${addedFiles.join(', ')}`));
  if (skippedFiles.length > 0) summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edits: ${skippedFiles.join(', ')}`));
  if (deletedFiles.length > 0) summaryLines.push(chalk.hex('#94A3B8')(`Removed: ${deletedFiles.join(', ')}`));
  if (keptFiles.length > 0) summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edited files: ${keptFiles.join(', ')}`));

  p.note(summaryLines.join('\n') || 'No file changes.', label('Done'));
  p.outro(chalk.hex('#94A3B8')('Modules updated.'));
}

// ─── Shared ──────────────────────────────────────────────────────────────────

function onCancel(): never {
  p.cancel(chalk.hex('#94A3B8')('Setup cancelled.'));
  process.exit(0);
}
