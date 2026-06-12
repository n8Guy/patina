import * as p from '@clack/prompts';
import chalk from 'chalk';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { loadProfile } from './detect.js';
import { label } from './wizard-brand.js';
import { OPTIONAL_HINT, onCancel, applyLaunchBlock, writeProfile, removeManagedFileIfUnmodified, promptLaunchTasks, GUIDE_HINT_LOG, offerGlobalInstall } from './wizard-shared.js';
import { applyModuleChanges, runUpdateModules } from './wizard-modules.js';
import { profileToVars, baseManagedFiles, moduleManagedFiles, renderUpdateCheckSection, GUIDE_CORE_COMMANDS } from './scaffold.js';
import { writeManagedFile } from './upgrade.js';
import { type ChecksumMap } from './checksums.js';
import { hasFences, inspectSections, renderSection } from './sections.js';
import { readState, writeState, stripLegacyChecksums } from './state.js';
import { migrateClaudeMdFile, MIGRATION_REFRESHED_MSG, MIGRATION_DUPLICATE_WARNING_MSG, type MigrationOutcome } from './migrate-claude.js';
import { availableLaunchTasks, pruneLaunchTasks } from './launch-tasks.js';
import { getModule } from './modules/registry.js';
import { validate, formatReport } from './validate.js';
import type { ModuleId, Profile } from './types.js';

export { writeProfile, removeManagedFileIfUnmodified };

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
  keptSections: string[];
  migrationOutcome?: MigrationOutcome;
}

export function applyProfileUpdate(
  cwd: string,
  profile: Profile,
  fields: ProfileFields,
  overwrite?: Set<string>,
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
  const existingState = readState(cwd, profile);
  const stored: ChecksumMap = existingState.checksums;
  const newChecksums: ChecksumMap = {};

  // Pre-pass: migrate CLAUDE.md from pre-#118 unfenced-prose layout if needed.
  const migrationOutcome = migrateClaudeMdFile(cwd, stored);

  const files = [
    ...baseManagedFiles(vars, updatedProfile.editor, cwd),
    ...updatedProfile.modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  const updated: string[] = [];
  const skipped: string[] = [];
  const keptSections: string[] = [];

  for (const [rel, content] of files) {
    const result = writeManagedFile(cwd, rel, content, stored, overwrite);
    newChecksums[rel] = result.checksum;
    for (const s of result.sections ?? []) {
      const sKey = `${rel}:${s.id}`;
      if (s.outcome !== 'skipped') newChecksums[sKey] = s.newChecksum;
      else {
        newChecksums[sKey] = stored[sKey] ?? '';
        keptSections.push(sKey);
      }
    }
    if (result.outcome === 'skipped') {
      skipped.push(rel);
    } else {
      updated.push(rel);
    }
  }

  // Re-render module README blocks so vars like CONTENT_DIR stay current after a profile update
  for (const module of updatedProfile.modules) {
    const def = getModule(module);
    if (def?.readmeBlock) {
      const readmePath = join(cwd, 'README.md');
      const readmeExists = existsSync(readmePath);
      const readmeHasFences = readmeExists ? hasFences(readFileSync(readmePath, 'utf8')) : false;
      if (!readmeExists || readmeHasFences) {
        const block = renderSection(module, def.readmeBlock(vars));
        const result = writeManagedFile(cwd, 'README.md', block, newChecksums, overwrite);
        newChecksums['README.md'] = result.checksum;
        for (const s of result.sections ?? []) {
          const sKey = `README.md:${s.id}`;
          if (s.outcome !== 'skipped') newChecksums[sKey] = s.newChecksum;
          else {
            newChecksums[sKey] = stored[sKey] ?? '';
            keptSections.push(sKey);
          }
        }
        if (result.outcome === 'skipped') {
          skipped.push(`README.md:${module}`);
        } else if (result.outcome !== 'updated' || result.sections?.some(s => s.id === module && s.outcome !== 'unchanged')) {
          updated.push(`README.md:${module}`);
        }
      }
    }
  }

  // Re-render launch block so CONTENT_DIR references stay current after a profile update.
  // newChecksums has the fresh CLAUDE.md checksum at this point (written by baseManagedFiles above).
  if (updatedProfile.launch_tasks?.length) {
    const launchResult = applyLaunchBlock(
      cwd, updatedProfile.launch_tasks, updatedProfile.modules, vars, newChecksums, overwrite,
    );
    updated.push(...launchResult.updated);
    skipped.push(...launchResult.skipped);
    keptSections.push(...launchResult.keptSections);
  }

  // Re-render update-check block so PATINA_VERSION stays current after an upgrade.
  {
    const updateCheckBlock = renderSection('update-check', renderUpdateCheckSection(vars));
    const result = writeManagedFile(cwd, 'CLAUDE.md', updateCheckBlock, newChecksums, overwrite);
    newChecksums['CLAUDE.md'] = result.checksum;
    for (const s of result.sections ?? []) {
      const sKey = `CLAUDE.md:${s.id}`;
      if (s.outcome !== 'skipped') newChecksums[sKey] = s.newChecksum;
      else {
        newChecksums[sKey] = stored[sKey] ?? '';
        keptSections.push(sKey);
      }
    }
    if (result.outcome === 'skipped') {
      skipped.push('CLAUDE.md:update-check');
    } else if (result.sections?.some(s => s.id === 'update-check' && s.outcome !== 'unchanged')) {
      updated.push('CLAUDE.md:update-check');
    }
  }

  for (const [rel, hash] of Object.entries(stored)) {
    if (!(rel in newChecksums)) {
      newChecksums[rel] = hash;
    }
  }

  // Remove editor-specific files that no longer apply after an editor change
  if (updatedProfile.editor !== 'vscode') {
    const outcome = removeManagedFileIfUnmodified(cwd, '.vscode/settings.json', stored);
    if (outcome === 'deleted') updated.push('.vscode/settings.json');
    delete newChecksums['.vscode/settings.json'];
  }

  writeState(cwd, { checksums: newChecksums, deferred_modules: existingState.deferred_modules, update_check: existingState.update_check });
  const profileToWrite = stripLegacyChecksums(updatedProfile);
  writeProfile(cwd, profileToWrite);
  return { profile: profileToWrite, updated, skipped, keptSections, migrationOutcome };
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

  // Pre-flight: inspect managed files for user-edited fenced sections and prompt before writing.
  const overwriteSet = new Set<string>();
  const previewProfile: Profile = {
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
  const previewVars = profileToVars(previewProfile);
  const storedChecksums = readState(cwd, profile).checksums;
  const previewFiles = [
    ...baseManagedFiles(previewVars, previewProfile.editor, cwd),
    ...previewProfile.modules.flatMap(m => moduleManagedFiles(m, previewVars)),
  ];
  for (const [rel, content] of previewFiles) {
    if (hasFences(content)) {
      const fullPath = join(cwd, rel);
      if (existsSync(fullPath)) {
        const existingContent = readFileSync(fullPath, 'utf8');
        const editedIds = inspectSections(rel, existingContent, storedChecksums);
        for (const sectionId of editedIds) {
          const confirmed = await p.confirm({
            message: `Section '${sectionId}' in ${rel} has been manually edited. Overwrite?`,
            initialValue: false,
          });
          if (p.isCancel(confirmed)) onCancel();
          if (confirmed) overwriteSet.add(sectionId);
        }
      }
    }
  }

  const { updated, skipped, keptSections, migrationOutcome } = applyProfileUpdate(cwd, profile, fields, overwriteSet);

  const summaryLines: string[] = [];
  if (updated.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Updated: ${updated.join(', ')}`));
  }
  if (keptSections.length > 0) {
    summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edits: ${keptSections.join(', ')}`));
  }
  if (skipped.length > 0) {
    summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edits: ${skipped.join(', ')}`));
  }
  if (migrationOutcome === 'migrated') {
    summaryLines.push(chalk.hex('#94A3B8')(MIGRATION_REFRESHED_MSG));
  } else if (migrationOutcome === 'skipped-edited') {
    summaryLines.push(chalk.hex('#FFAB2E')(MIGRATION_DUPLICATE_WARNING_MSG));
  }

  p.note(summaryLines.join('\n'), label('Done'));
  p.outro(chalk.hex('#94A3B8')('Profile updated.'));
}

// ─── Branch C: Set up launch tasks ──────────────────────────────────────────

export interface LaunchTaskUpdateResult {
  profile: Profile;
  updated: string[];
  skipped: string[];
  keptSections: string[];
}

export function applyLaunchTaskUpdate(
  cwd: string,
  profile: Profile,
  launchTasks: string[],
  overwrite?: Set<string>,
): LaunchTaskUpdateResult {
  const updatedProfile: Profile = {
    ...profile,
    launch_tasks: launchTasks.length ? launchTasks : undefined,
  };

  const vars = profileToVars(updatedProfile);
  const existingState = readState(cwd, profile);
  const stored: ChecksumMap = existingState.checksums;
  // Start from stored so section-level lookups inside applyLaunchBlock are consistent.
  const newChecksums: ChecksumMap = { ...stored };

  const { updated, skipped, keptSections } = applyLaunchBlock(
    cwd, launchTasks, profile.modules ?? [], vars, newChecksums, overwrite,
  );

  // Re-render update-check block so PATINA_VERSION stays current after an upgrade.
  {
    const updateCheckBlock = renderSection('update-check', renderUpdateCheckSection(vars));
    const result = writeManagedFile(cwd, 'CLAUDE.md', updateCheckBlock, newChecksums, overwrite);
    newChecksums['CLAUDE.md'] = result.checksum;
    for (const s of result.sections ?? []) {
      const sKey = `CLAUDE.md:${s.id}`;
      if (s.outcome !== 'skipped') newChecksums[sKey] = s.newChecksum;
      else newChecksums[sKey] = stored[sKey] ?? '';
    }
  }

  writeState(cwd, { checksums: newChecksums, deferred_modules: existingState.deferred_modules, update_check: existingState.update_check });
  const profileToWrite = stripLegacyChecksums(updatedProfile);
  writeProfile(cwd, profileToWrite);
  return { profile: profileToWrite, updated, skipped, keptSections };
}

async function runUpdateLaunchTasks(cwd: string, profile: Profile): Promise<void> {
  const avail = availableLaunchTasks(profile.modules ?? []);
  const initial = pruneLaunchTasks(profile.launch_tasks, profile.modules ?? []);

  // Pre-flight: check if the launch section has been user-edited
  const overwriteSet = new Set<string>();
  const claudePath = join(cwd, 'CLAUDE.md');
  if (existsSync(claudePath)) {
    const storedChecksums = readState(cwd, profile).checksums;
    const existingContent = readFileSync(claudePath, 'utf8');
    const editedIds = inspectSections('CLAUDE.md', existingContent, storedChecksums);
    if (editedIds.includes('launch')) {
      const confirmed = await p.confirm({
        message: `Section 'launch' in CLAUDE.md has been manually edited. Overwrite?`,
        initialValue: false,
      });
      if (p.isCancel(confirmed)) onCancel();
      if (confirmed) overwriteSet.add('launch');
    }
  }

  const selected = await promptLaunchTasks(avail, initial);
  const { updated, skipped, keptSections } = applyLaunchTaskUpdate(cwd, profile, selected, overwriteSet);

  const summaryLines: string[] = [];
  if (updated.length > 0) {
    summaryLines.push(chalk.hex('#94A3B8')(`Updated: ${updated.join(', ')}`));
  }
  if (keptSections.length > 0) {
    summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edits: ${keptSections.join(', ')}`));
  }
  if (skipped.length > 0) {
    summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edits: ${skipped.join(', ')}`));
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
 * Runs at the top of every update wizard invocation so new template files
 * (e.g. guide.md) land even when the user makes no profile changes.
 */
export function syncBaseFiles(cwd: string, profile: Profile): void {
  const existingState = readState(cwd, profile);
  const vars = profileToVars(profile);
  const checksums = { ...existingState.checksums };
  try {
    for (const [rel, content] of baseManagedFiles(vars, profile.editor, cwd)) {
      const result = writeManagedFile(cwd, rel, content, checksums);
      checksums[rel] = result.checksum;
      for (const s of result.sections ?? []) {
        const sKey = `${rel}:${s.id}`;
        if (s.outcome !== 'skipped') checksums[sKey] = s.newChecksum;
        else checksums[sKey] = existingState.checksums[sKey] ?? '';
      }
    }
    writeState(cwd, { ...existingState, checksums });
  } catch (err) {
    p.log.warn(`Failed to sync patina files — some templates may be out of date. Run again to retry. (${err instanceof Error ? err.message : String(err)})`);
  }
}

export async function runUpdate(cwd: string): Promise<void> {
  const profile = loadProfile(cwd);
  p.intro(chalk.hex('#94A3B8')(`Found: ${chalk.bold.white(profile.patina_name || 'patina')}`));

  syncBaseFiles(cwd, profile);

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

  await offerGlobalInstall();

  p.log.info(GUIDE_HINT_LOG);
}
