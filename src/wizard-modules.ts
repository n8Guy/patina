import * as p from '@clack/prompts';
import chalk from 'chalk';
import { dirname, join } from 'path';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { label } from './wizard-brand.js';
import { MULTISELECT_HINT, defaultSnoozeUntil, addDeferredModule, clearDeferredModule, onCancel, applyLaunchBlock, writeProfile, removeManagedFileIfUnmodified } from './wizard-shared.js';
import { profileToVars, baseManagedFiles, moduleManagedFiles, moduleContentFiles, renderUpdateCheckSection } from './scaffold.js';
import { writeManagedFile } from './upgrade.js';
import { hashContent, type ChecksumMap } from './checksums.js';
import { hasFences, inspectSections, removeSection, renderSection } from './sections.js';
import { readState, writeState, stripLegacyChecksums } from './state.js';
import { migrateClaudeMdFile, MIGRATION_REFRESHED_MSG, MIGRATION_DUPLICATE_WARNING_MSG, type MigrationOutcome } from './migrate-claude.js';
import { pruneLaunchTasks } from './launch-tasks.js';
import { MODULES, getModule } from './modules/registry.js';
import type { ModuleAddInputs } from './modules/types.js';
import type { ModuleId, Profile } from './types.js';

// ─── Module changes ───────────────────────────────────────────────────────────

export interface ModuleChangeResult {
  profile: Profile;
  added: string[];
  skipped: string[];
  deleted: string[];
  kept: string[];
  keptSections: string[];
  migrationOutcome?: MigrationOutcome;
}

export function applyModuleChanges(
  cwd: string,
  profile: Profile,
  toAdd: ModuleId[],
  toRemove: ModuleId[],
  moduleInputs?: Record<string, ModuleAddInputs>,
): ModuleChangeResult {
  const initialState = readState(cwd, profile);
  const stored: ChecksumMap = initialState.checksums;

  // Pre-pass: migrate CLAUDE.md from pre-#118 unfenced-prose layout if needed.
  const migrationOutcome = migrateClaudeMdFile(cwd, stored);

  const newChecksums: ChecksumMap = { ...stored };
  // Carry deferred_modules through; strip entries for removed modules.
  let deferredModules = initialState.deferred_modules;
  for (const module of toRemove) {
    if (deferredModules !== undefined) {
      const cleared = clearDeferredModule({ checksums: {}, deferred_modules: deferredModules }, module);
      deferredModules = cleared.deferred_modules;
    }
  }
  let updatedProfile: Profile = { ...profile, modules: [...(profile.modules ?? [])] };

  const added: string[] = [];
  const skippedFiles: string[] = [];
  const deleted: string[] = [];
  const kept: string[] = [];
  const keptSections: string[] = [];

  for (const module of toAdd) {
    const def = getModule(module);
    if (def?.onAdd) {
      updatedProfile = def.onAdd(updatedProfile, moduleInputs?.[module] ?? {});
    }

    const vars = profileToVars(updatedProfile);
    const contentDir = updatedProfile.content_dir;

    for (const [rel, content] of moduleManagedFiles(module, vars)) {
      const result = writeManagedFile(cwd, rel, content, newChecksums);
      newChecksums[rel] = result.checksum;
      for (const s of result.sections ?? []) {
        const sKey = `${rel}:${s.id}`;
        if (s.outcome !== 'skipped') newChecksums[sKey] = s.newChecksum;
        else {
          newChecksums[sKey] = newChecksums[sKey] ?? '';
          keptSections.push(sKey);
        }
      }
      if (result.outcome === 'skipped') {
        skippedFiles.push(rel);
      } else {
        added.push(rel);
      }
    }

    for (const [relativePath, content] of moduleContentFiles(module, vars, contentDir)) {
      const fullPath = join(cwd, relativePath);
      if (!existsSync(fullPath)) {
        mkdirSync(dirname(fullPath), { recursive: true });
        writeFileSync(fullPath, content, 'utf8');
        added.push(relativePath);
      }
    }

    // Append README.md block for this module (migration guard: only if README has fences or doesn't exist)
    if (def?.readmeBlock) {
      const readmePath = join(cwd, 'README.md');
      const readmeExists = existsSync(readmePath);
      const readmeHasFences = readmeExists ? hasFences(readFileSync(readmePath, 'utf8')) : false;
      if (!readmeExists || readmeHasFences) {
        const block = renderSection(module, def.readmeBlock(vars));
        const result = writeManagedFile(cwd, 'README.md', block, newChecksums);
        newChecksums['README.md'] = result.checksum;
        for (const s of result.sections ?? []) {
          newChecksums[`README.md:${s.id}`] = s.newChecksum;
        }
        if (result.outcome !== 'skipped') added.push(`README.md:${module}`);
      } else {
        kept.push('README.md');
      }
    }

    if (!updatedProfile.modules.includes(module)) {
      updatedProfile.modules = [...updatedProfile.modules, module];
    }
  }

  for (const module of toRemove) {
    const def = getModule(module);
    const managedRels = def?.managedPaths ?? [];
    for (const rel of managedRels) {
      const result = removeManagedFileIfUnmodified(cwd, rel, stored);
      if (result === 'deleted') {
        deleted.push(rel);
        delete newChecksums[rel];
        // Remove any orphaned section-level checksum keys for this file
        const prefix = rel + ':';
        for (const key of Object.keys(newChecksums)) {
          if (key.startsWith(prefix)) delete newChecksums[key];
        }
      } else {
        kept.push(rel);
      }
    }

    // Remove README.md block for this module (only if section is unmodified)
    const readmePath = join(cwd, 'README.md');
    if (existsSync(readmePath)) {
      const before = readFileSync(readmePath, 'utf8');
      const editedIds = inspectSections('README.md', before, stored);
      if (!editedIds.includes(module)) {
        const after = removeSection(module, before);
        if (after !== before) {
          writeFileSync(readmePath, after, 'utf8');
          newChecksums['README.md'] = hashContent(after);
          delete newChecksums[`README.md:${module}`];
          deleted.push(`README.md:${module}`);
        }
      } else {
        keptSections.push(`README.md:${module}`);
      }
    }

    updatedProfile.modules = updatedProfile.modules.filter(m => m !== module);
    if (def?.onRemove) {
      updatedProfile = def.onRemove(updatedProfile);
    }
  }

  // Prune orphaned launch tasks (tasks from modules that have just been removed)
  const prunedTasks = pruneLaunchTasks(updatedProfile.launch_tasks, updatedProfile.modules);
  updatedProfile = { ...updatedProfile, launch_tasks: prunedTasks.length ? prunedTasks : undefined };

  // Regenerate base files once (with final module list so CLAUDE.md Modules section is correct)
  const finalVars = profileToVars(updatedProfile);
  for (const [rel, content] of baseManagedFiles(finalVars, updatedProfile.editor, cwd)) {
    const result = writeManagedFile(cwd, rel, content, newChecksums);
    newChecksums[rel] = result.checksum;
    for (const s of result.sections ?? []) {
      const sKey = `${rel}:${s.id}`;
      if (s.outcome !== 'skipped') newChecksums[sKey] = s.newChecksum;
      else {
        newChecksums[sKey] = newChecksums[sKey] ?? '';
        keptSections.push(sKey);
      }
    }
  }

  // Re-render launch block so CLAUDE.md reflects orphan-pruned task list
  const launchResult = applyLaunchBlock(cwd, updatedProfile.launch_tasks ?? [], updatedProfile.modules, finalVars, newChecksums);
  keptSections.push(...launchResult.keptSections);

  // Re-render update-check block so PATINA_VERSION stays current after module changes.
  {
    const updateCheckBlock = renderSection('update-check', renderUpdateCheckSection(finalVars));
    const result = writeManagedFile(cwd, 'CLAUDE.md', updateCheckBlock, newChecksums);
    newChecksums['CLAUDE.md'] = result.checksum;
    for (const s of result.sections ?? []) {
      const sKey = `CLAUDE.md:${s.id}`;
      if (s.outcome !== 'skipped') newChecksums[sKey] = s.newChecksum;
      else {
        newChecksums[sKey] = newChecksums[sKey] ?? '';
        keptSections.push(sKey);
      }
    }
  }

  writeState(cwd, { checksums: newChecksums, ...(deferredModules !== undefined ? { deferred_modules: deferredModules } : {}), update_check: initialState.update_check });
  const finalProfile = stripLegacyChecksums(updatedProfile);
  writeProfile(cwd, finalProfile);
  return { profile: finalProfile, added, skipped: skippedFiles, deleted, kept, keptSections, migrationOutcome };
}

// ─── Branch B: Add or remove modules ─────────────────────────────────────────

export async function runUpdateModules(cwd: string, profile: Profile): Promise<void> {
  const currentModules = profile.modules ?? [];

  const selected = await p.multiselect({
    message: `Which modules do you want active?${MULTISELECT_HINT}`,
    options: MODULES.map(m => ({
      value: m.id as ModuleId,
      label: m.label,
      hint: chalk.hex('#64748B')(m.hint),
    })),
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

  // Show planned file changes
  const changeLines: string[] = [];
  for (const m of toAdd) {
    const def = getModule(m);
    changeLines.push(`Adding ${def?.label ?? m}: appends a section to README.md, adds a link to CLAUDE.md`);
  }
  for (const m of toRemove) {
    const def = getModule(m);
    changeLines.push(`Removing ${def?.label ?? m}: removes its section from README.md and its link from CLAUDE.md`);
  }
  p.note(changeLines.join('\n'), label('Planned changes'));

  // Per-module now/later prompts (generic — driven by requiresConfig on each module def).
  // Only modules being added and not already configured are prompted.
  const moduleInputs: Record<string, ModuleAddInputs> = {};
  const deferredUpdates: Array<{ moduleId: ModuleId; snoozeUntil: string }> = [];
  const clearDeferred: ModuleId[] = [];

  for (const moduleId of toAdd.filter(m => getModule(m)?.requiresConfig)) {
    const def = getModule(moduleId)!;
    const choice = await p.select({
      message: `Set up ${def.label} now or fill it out later?`,
      options: [
        { value: 'now', label: 'Fill out now' },
        { value: 'later', label: 'Fill out later', hint: chalk.hex('#64748B')("I'll remind you next session") },
      ],
    });
    if (p.isCancel(choice)) {
      p.cancel(chalk.hex('#94A3B8')('No changes made.'));
      return;
    }
    if (choice === 'now') {
      if (def.promptsOnAdd) {
        const inputs = await def.promptsOnAdd();
        moduleInputs[moduleId] = inputs;
      }
      clearDeferred.push(moduleId);
    } else {
      deferredUpdates.push({ moduleId, snoozeUntil: defaultSnoozeUntil() });
    }
  }

  const { added: addedFiles, skipped: skippedFiles, deleted: deletedFiles, kept: keptFiles, keptSections: keptSectionKeys, migrationOutcome } =
    applyModuleChanges(cwd, profile, toAdd, toRemove, moduleInputs);

  // Merge deferred state changes after applyModuleChanges (which writes state with checksums).
  if (deferredUpdates.length > 0 || clearDeferred.length > 0) {
    let state = readState(cwd);
    for (const { moduleId, snoozeUntil } of deferredUpdates) {
      state = addDeferredModule(state, moduleId, snoozeUntil);
    }
    for (const moduleId of clearDeferred) {
      state = clearDeferredModule(state, moduleId);
    }
    writeState(cwd, state);
  }

  const summaryLines: string[] = [];
  if (addedFiles.length > 0) summaryLines.push(chalk.hex('#94A3B8')(`Added: ${addedFiles.join(', ')}`));
  if (keptSectionKeys.length > 0) summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edits: ${keptSectionKeys.join(', ')}`));
  if (skippedFiles.length > 0) summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edits: ${skippedFiles.join(', ')}`));
  if (deletedFiles.length > 0) summaryLines.push(chalk.hex('#94A3B8')(`Removed: ${deletedFiles.join(', ')}`));
  if (keptFiles.length > 0) summaryLines.push(chalk.hex('#FFAB2E')(`Kept your edited files: ${keptFiles.join(', ')}`));
  if (migrationOutcome === 'migrated') {
    summaryLines.push(chalk.hex('#94A3B8')(MIGRATION_REFRESHED_MSG));
  } else if (migrationOutcome === 'skipped-edited') {
    summaryLines.push(chalk.hex('#FFAB2E')(MIGRATION_DUPLICATE_WARNING_MSG));
  }

  p.note(summaryLines.join('\n') || 'No file changes.', label('Done'));
  p.outro(chalk.hex('#94A3B8')('Modules updated.'));
}
