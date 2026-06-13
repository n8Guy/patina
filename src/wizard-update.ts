import * as p from '@clack/prompts';
import chalk from 'chalk';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { loadProfile } from './detect.js';
import { label } from './wizard-brand.js';
import { OPTIONAL_HINT, onCancel, writeProfile, removeManagedFileIfManaged, promptLaunchTasks, GUIDE_HINT_LOG } from './wizard-shared.js';
import { applyModuleChanges, runUpdateModules } from './wizard-modules.js';
import { profileToVars, baseManagedFiles, moduleManagedFiles, GUIDE_CORE_COMMANDS } from './scaffold.js';
import { writeManagedFile, isMarkedManaged } from './upgrade.js';
import { readState, writeState, stripLegacyChecksums } from './state.js';
import { detectCorruption, formatHealthReport, type HealthReport } from './health.js';
import { availableLaunchTasks, pruneLaunchTasks } from './launch-tasks.js';
import { validate, formatReport } from './validate.js';
import type { Profile } from './types.js';

export { writeProfile, removeManagedFileIfManaged as removeManagedFileIfUnmodified };

// ─── Branch A: Update personal info ──────────────────────────────────────────

export interface ProfileFields {
  name: string;
  title: string;
  roleDescription: string;
  jobDescriptionUrl: string;
  selfEmployed: boolean;
  companyName: string;
  website: string;
  companyDescription: string;
}

export interface ProfileUpdateResult {
  profile: Profile;
  updated: string[];
  skipped: string[];
}

export function applyProfileUpdate(
  cwd: string,
  profile: Profile,
  fields: ProfileFields,
): ProfileUpdateResult {
  const updatedProfile: Profile = {
    ...profile,
    name: fields.name.trim(),
    title: fields.title.trim(),
    role_description: fields.roleDescription.trim() || undefined,
    job_description_url: fields.jobDescriptionUrl.trim() || undefined,
    work: {
      self_employed: fields.selfEmployed,
      company_name: fields.companyName.trim() || (fields.selfEmployed ? 'Freelance' : ''),
      website: fields.website.trim() || undefined,
      company_description: fields.companyDescription.trim() || undefined,
    },
  };

  const vars = profileToVars(updatedProfile);
  const existingState = readState(cwd);

  const files = [
    ...baseManagedFiles({ vars, editor: updatedProfile.editor, modules: updatedProfile.modules ?? [], targetDir: cwd }),
    ...(updatedProfile.modules ?? []).flatMap(m => moduleManagedFiles(m, vars)),
  ];

  const updated: string[] = [];
  const skipped: string[] = [];

  for (const [rel, content] of files) {
    const result = writeManagedFile(cwd, rel, content);
    if (result.outcome === 'skipped') {
      skipped.push(rel);
    } else {
      updated.push(rel);
    }
  }

  // Remove editor-specific files that no longer apply after an editor change
  if (updatedProfile.editor !== 'vscode') {
    const vscodePath = join(cwd, '.vscode/settings.json');
    if (existsSync(vscodePath)) {
      const content = readFileSync(vscodePath, 'utf8');
      if (isMarkedManaged('.vscode/settings.json', content)) {
        const outcome = removeManagedFileIfManaged(cwd, '.vscode/settings.json');
        if (outcome === 'deleted') updated.push('.vscode/settings.json');
      }
    }
  }

  writeState(cwd, { deferred_modules: existingState.deferred_modules, update_check: existingState.update_check });
  const profileToWrite = stripLegacyChecksums(updatedProfile);
  writeProfile(cwd, profileToWrite);
  return { profile: profileToWrite, updated, skipped };
}

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
          validate: (v) => (!v || !v.trim() ? 'Name is required.' : undefined),
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
    hint: chalk.hex('#64748B')('↑/↓ arrow keys · y or n · enter to confirm'),
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

  const fields: ProfileFields = {
    name: identity.name,
    title: identity.title ?? '',
    roleDescription: identity.roleDescription ?? '',
    jobDescriptionUrl: identity.jobDescriptionUrl ?? '',
    selfEmployed: selfEmployed as boolean,
    companyName: work.companyName ?? '',
    website: work.website ?? '',
    companyDescription: work.companyDescription ?? '',
  };

  const { updated, skipped } = applyProfileUpdate(cwd, profile, fields);

  const summaryLines: string[] = [];
  if (updated.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Updated: ${updated.join(', ')}`));
  }
  if (skipped.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Kept (your own files): ${skipped.join(', ')}`));
  }

  p.note(summaryLines.join('\n'), label('Done'));
  p.outro(chalk.hex('#94A3B8')('Profile updated.'));
}

// ─── Branch C: Set up launch tasks ──────────────────────────────────────────

export interface LaunchTaskUpdateResult {
  profile: Profile;
  updated: string[];
  skipped: string[];
}

export function applyLaunchTaskUpdate(
  cwd: string,
  profile: Profile,
  launchTasks: string[],
): LaunchTaskUpdateResult {
  const updatedProfile: Profile = {
    ...profile,
    launch_tasks: launchTasks.length ? launchTasks : undefined,
  };

  const vars = profileToVars(updatedProfile);
  const existingState = readState(cwd);

  // Re-render all base managed files (CLAUDE.md now contains launch section inline)
  const files = baseManagedFiles({ vars, editor: updatedProfile.editor, modules: updatedProfile.modules ?? [], targetDir: cwd });

  const updated: string[] = [];
  const skipped: string[] = [];

  for (const [rel, content] of files) {
    const result = writeManagedFile(cwd, rel, content);
    if (result.outcome === 'skipped') {
      skipped.push(rel);
    } else {
      updated.push(rel);
    }
  }

  writeState(cwd, { deferred_modules: existingState.deferred_modules, update_check: existingState.update_check });
  const profileToWrite = stripLegacyChecksums(updatedProfile);
  writeProfile(cwd, profileToWrite);
  return { profile: profileToWrite, updated, skipped };
}

async function runUpdateLaunchTasks(cwd: string, profile: Profile): Promise<void> {
  const avail = availableLaunchTasks(profile.modules ?? []);
  const initial = pruneLaunchTasks(profile.launch_tasks, profile.modules ?? []);

  const selected = await promptLaunchTasks(avail, initial);
  const { updated, skipped } = applyLaunchTaskUpdate(cwd, profile, selected);

  const summaryLines: string[] = [];
  if (updated.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Updated: ${updated.join(', ')}`));
  }
  if (skipped.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Kept (your own files): ${skipped.join(', ')}`));
  }

  p.note(summaryLines.join('\n') || 'No changes.', label('Done'));
  p.outro(chalk.hex('#94A3B8')('Launch tasks updated.'));
}

// ─── Validate ────────────────────────────────────────────────────────────────

async function runValidate(cwd: string, profile: Profile): Promise<void> {
  const result = validate(cwd, profile);
  const report = formatReport(result);
  p.note(report, label('Health check'));
  if (result.ok) {
    p.outro(chalk.green('All good.'));
  } else {
    p.outro(chalk.red('Issues found — see above.'));
  }
}

// ─── Update orchestrator ──────────────────────────────────────────────────────

/**
 * Sync base managed files to the patina directory without changing the profile.
 * Runs at the top of every update wizard invocation so new template files land
 * even when the user makes no profile changes.
 */
export function syncBaseFiles(cwd: string, profile: Profile): { healthReport: HealthReport; repairedFiles: string[] } {
  const existingState = readState(cwd);
  const vars = profileToVars(profile);

  const healthReport = detectCorruption(cwd, profile);
  const repairedFiles: string[] = [];

  try {
    for (const [rel, content] of baseManagedFiles({ vars, editor: profile.editor, modules: profile.modules ?? [], targetDir: cwd })) {
      const result = writeManagedFile(cwd, rel, content);
      if (healthReport.corruptFiles.has(rel) && result.outcome !== 'skipped') {
        repairedFiles.push(rel);
      }
    }
  } catch (err) {
    p.log.warn(`Failed to sync patina files — some templates may be out of date. Run again to retry. (${err instanceof Error ? err.message : String(err)})`);
    return { healthReport, repairedFiles: [] };
  }
  try {
    writeState(cwd, { deferred_modules: existingState.deferred_modules, update_check: existingState.update_check });
  } catch (err) {
    p.log.warn(`Patina files updated but state not saved — run again to retry. (${err instanceof Error ? err.message : String(err)})`);
  }
  return { healthReport, repairedFiles };
}

export async function runUpdate(cwd: string): Promise<void> {
  const profile = loadProfile(cwd);
  p.intro(chalk.hex('#94A3B8')(`Found: ${chalk.bold.white(profile.patina_name || 'patina')}`));

  const { healthReport, repairedFiles } = syncBaseFiles(cwd, profile);

  if (repairedFiles.length > 0) {
    const noteLines = [
      chalk.hex('#94A3B8')(`Repaired: ${repairedFiles.join(', ')}`),
      chalk.hex('#94A3B8')('Your notes and settings in graph/ were not changed.'),
    ];
    p.note(noteLines.join('\n'), label('Corruption repaired'));
  }

  p.note(
    [
      `${chalk.hex('#64748B')('Name:')}         ${profile.name}`,
      `${chalk.hex('#64748B')('Title:')}        ${profile.title || '—'}`,
      `${chalk.hex('#64748B')('Company:')}      ${profile.work?.company_name || '—'}`,
      `${chalk.hex('#64748B')('Modules:')}      ${profile.modules?.join(', ') || 'none'}`,
      `${chalk.hex('#64748B')('Launch tasks:')} ${profile.launch_tasks?.length ?? 0}`,
    ].join('\n'),
    label('Current profile')
  );

  const action = await p.select({
    message: 'What do you want to do?',
    options: [
      { value: 'profile', label: 'Update personal info' },
      { value: 'modules', label: 'Add or remove modules' },
      { value: 'launch-tasks', label: 'Set up launch tasks', hint: chalk.hex('#64748B')('tasks Claude runs every session') },
      { value: 'validate', label: 'Run health check', hint: chalk.hex('#64748B')('check for broken links and excluded items') },
      { value: 'nothing', label: 'Nothing — just checking' },
    ],
  });

  if (p.isCancel(action)) {
    p.cancel(chalk.hex('#94A3B8')('No changes made.'));
    return;
  }

  if (action === 'nothing') {
    const coreLines = GUIDE_CORE_COMMANDS
      .map(c => chalk.bold.white(`  ${c.name.split(' ')[0]}`) + chalk.hex('#94A3B8')(` — ${c.desc}`))
      .join('\n');
    p.note(
      chalk.hex('#94A3B8')('Run ') + chalk.bold.white('claude') + chalk.hex('#94A3B8')(' to start your session, then try:') + '\n' + coreLines,
      label('In your session')
    );
    p.outro(chalk.hex('#94A3B8')('No changes made.'));
    return;
  } else if (action === 'profile') {
    await runUpdateProfile(cwd, profile);
  } else if (action === 'modules') {
    await runUpdateModules(cwd, profile);
  } else if (action === 'launch-tasks') {
    await runUpdateLaunchTasks(cwd, profile);
  } else if (action === 'validate') {
    await runValidate(cwd, profile);
    return;
  }

  p.log.info(GUIDE_HINT_LOG);
}
