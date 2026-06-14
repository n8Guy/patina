import * as p from '@clack/prompts';
import chalk from 'chalk';
import { label } from './wizard-brand.js';
import { MULTISELECT_HINT, defaultSnoozeUntil, addDeferredModule, clearDeferredModule, onCancel, writeProfile, removeManagedFileIfManaged } from './wizard-shared.js';
import { profileToVars, baseManagedFiles, moduleManagedFiles, moduleContentFiles } from './scaffold.js';
import { writeManagedFile, writeSeedFile } from './upgrade.js';
import { readState, writeState, stripLegacyChecksums } from './state.js';
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
}

export function applyModuleChanges(
  cwd: string,
  profile: Profile,
  toAdd: ModuleId[],
  toRemove: ModuleId[],
  moduleInputs?: Record<string, ModuleAddInputs>,
): ModuleChangeResult {
  const initialState = readState(cwd);

  // Carry deferred_modules through; strip entries for removed modules.
  let deferredModules = initialState.deferred_modules;
  for (const module of toRemove) {
    if (deferredModules !== undefined) {
      const cleared = clearDeferredModule({ deferred_modules: deferredModules }, module);
      deferredModules = cleared.deferred_modules;
    }
  }
  let updatedProfile: Profile = { ...profile, modules: [...(profile.modules ?? [])] };

  const added: string[] = [];
  const skippedFiles: string[] = [];
  const deleted: string[] = [];
  const kept: string[] = [];

  for (const module of toAdd) {
    const def = getModule(module);
    if (def?.onAdd) {
      updatedProfile = def.onAdd(updatedProfile, moduleInputs?.[module] ?? {});
    }

    const vars = profileToVars(updatedProfile);
    const contentDir = updatedProfile.content_dir;

    for (const [rel, content] of moduleManagedFiles(module, vars)) {
      const result = writeManagedFile(cwd, rel, content);
      if (result.outcome === 'skipped') {
        skippedFiles.push(rel);
      } else {
        added.push(rel);
      }
    }

    for (const [relativePath, content] of moduleContentFiles(module, vars, contentDir)) {
      // Module content files are seed-once (never overwrite)
      const outcome = writeSeedFile(cwd, relativePath, content);
      if (outcome === 'added') added.push(relativePath);
    }

    if (!updatedProfile.modules.includes(module)) {
      updatedProfile.modules = [...updatedProfile.modules, module];
    }
  }

  for (const module of toRemove) {
    const def = getModule(module);
    const managedRels = def?.managedPaths ?? [];
    for (const rel of managedRels) {
      const result = removeManagedFileIfManaged(cwd, rel);
      if (result === 'deleted') {
        deleted.push(rel);
      } else {
        kept.push(rel);
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

  // Regenerate base files once with final module list so CLAUDE.md Modules section and
  // README module blocks are correct
  const finalVars = profileToVars(updatedProfile);
  for (const [rel, content] of baseManagedFiles({ vars: finalVars, editor: updatedProfile.editor, modules: updatedProfile.modules})) {
    writeManagedFile(cwd, rel, content);
  }

  writeState(cwd, { ...(deferredModules !== undefined ? { deferred_modules: deferredModules } : {}), update_check: initialState.update_check });
  const finalProfile = stripLegacyChecksums(updatedProfile);
  writeProfile(cwd, finalProfile);
  return { profile: finalProfile, added, skipped: skippedFiles, deleted, kept };
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
    changeLines.push(`Adding ${def?.label ?? m}: adds commands, updates README and CLAUDE.md`);
  }
  for (const m of toRemove) {
    const def = getModule(m);
    changeLines.push(`Removing ${def?.label ?? m}: removes its commands and updates README and CLAUDE.md`);
  }
  p.note(changeLines.join('\n'), label('Planned changes'));

  // Per-module now/later prompts
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

  const { added: addedFiles, skipped: skippedFiles, deleted: deletedFiles, kept: keptFiles } =
    applyModuleChanges(cwd, profile, toAdd, toRemove, moduleInputs);

  // Merge deferred state changes after applyModuleChanges (which writes state).
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
  if (skippedFiles.length > 0) summaryLines.push(chalk.hex('#94A3B8')(`Kept (your own files): ${skippedFiles.join(', ')}`));
  if (deletedFiles.length > 0) summaryLines.push(chalk.hex('#94A3B8')(`Removed: ${deletedFiles.join(', ')}`));
  if (keptFiles.length > 0) summaryLines.push(chalk.hex('#FFAB2E')(`Kept (user-owned): ${keptFiles.join(', ')}`));

  p.note(summaryLines.join('\n') || 'No file changes.', label('Done'));
  p.outro(chalk.hex('#94A3B8')('Modules updated.'));
}
