import * as p from '@clack/prompts';
import chalk from 'chalk';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import { spawnSync } from 'child_process';
import { getPatinaPackageName } from './version.js';
import yaml from 'js-yaml';
import { profileToVars } from './scaffold.js';
import { writeManagedFile } from './upgrade.js';
import { hashContent, hashFile, type ChecksumMap } from './checksums.js';
import { hasFences, inspectSections, removeSection, renderSection } from './sections.js';
import { availableLaunchTasks, launchSelectionError, renderLaunchSection, type AvailableLaunchTask } from './launch-tasks.js';
import { render } from './template.js';
import type { DeferredModule, ModuleId, Profile } from './types.js';
import type { PatinaState } from './state.js';

// @clack/prompts supports hint on text inputs and validate on multiselect at runtime but the type definitions omit them.
declare module '@clack/prompts' {
  interface TextOptions {
    hint?: string;
  }
  interface MultiSelectOptions<Value> {
    validate?: (value: Value[]) => string | undefined;
  }
  interface ConfirmOptions {
    hint?: string;
  }
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const MULTISELECT_HINT = `\n  ${chalk.hex('#64748B')('↑↓ to move  ·  space to select  ·  enter to confirm')}`;
export const OPTIONAL_HINT = ` ${chalk.dim.italic('optional, but helps a lot — hit ENTER to skip')}`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function slugify(str: string): string {
  return (
    str
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'patina'
  );
}

// ─── Deferred module helpers ──────────────────────────────────────────────────

/**
 * Returns a date string (YYYY-MM-DD) 7 days from today (or from `today` if provided).
 * Used as the default snooze when a user picks "fill out later" in the wizard.
 */
export function defaultSnoozeUntil(today?: string): string {
  return snoozeUntilFor('1w', today);
}

/**
 * Maps a snooze option to a future ISO date string (YYYY-MM-DD).
 * Uses calendar months for '1m' and '3m'. Month-boundary clamping: if the
 * resulting day overshoots the target month (e.g. Jan 31 + 1m → Mar 3),
 * the date is walked back to the last day of the intended month (Feb 28/29).
 */
export function snoozeUntilFor(option: '1w' | '1m' | '3m', today?: string): string {
  const base = today ? new Date(today + 'T00:00:00Z') : new Date();
  const result = new Date(base);
  if (option === '1w') {
    result.setUTCDate(result.getUTCDate() + 7);
  } else if (option === '1m') {
    const targetMonth = result.getUTCMonth() + 1;
    result.setUTCMonth(targetMonth);
    // Clamp: if day overflowed (e.g. Jan 31 → Mar 3), roll back to last day of targetMonth
    if (result.getUTCMonth() !== targetMonth % 12) {
      result.setUTCDate(0); // last day of previous month
    }
  } else {
    const targetMonth = result.getUTCMonth() + 3;
    result.setUTCMonth(targetMonth);
    // Clamp: same logic as above, adjusted for 3-month offset
    const expectedMonth = (base.getUTCMonth() + 3) % 12;
    if (result.getUTCMonth() !== expectedMonth) {
      result.setUTCDate(0);
    }
  }
  return result.toISOString().slice(0, 10);
}

/**
 * Returns a new state with the deferred entry for `moduleId` upserted.
 * If the module already has an entry, it is replaced; otherwise appended.
 */
export function addDeferredModule(
  state: PatinaState,
  moduleId: ModuleId,
  snoozeUntil: string,
): PatinaState {
  const existing = state.deferred_modules ?? [];
  const without = existing.filter((e: DeferredModule) => e.module !== moduleId);
  return {
    ...state,
    deferred_modules: [...without, { module: moduleId, snooze_until: snoozeUntil }],
  };
}

/**
 * Returns a new state with the deferred entry for `moduleId` removed.
 * Sets `deferred_modules: []` (not undefined) when the result is empty
 * so the key remains present and intent is explicit.
 */
export function clearDeferredModule(
  state: PatinaState,
  moduleId: ModuleId,
): PatinaState {
  const existing = state.deferred_modules ?? [];
  return {
    ...state,
    deferred_modules: existing.filter((e: DeferredModule) => e.module !== moduleId),
  };
}

// ─── Shared cancel handler ────────────────────────────────────────────────────

export function onCancel(): never {
  p.cancel(chalk.hex('#94A3B8')('Setup cancelled.'));
  process.exit(0);
}

// ─── Launch tasks ─────────────────────────────────────────────────────────────

/**
 * Write or remove the launch fence in CLAUDE.md and mutate checksums in-place.
 * Callers must initialise checksums from stored state before calling so that
 * section-level lookups and user-edit detection are consistent.
 */
export function applyLaunchBlock(
  cwd: string,
  launchTasks: string[],
  modules: ModuleId[],
  vars: ReturnType<typeof profileToVars>,
  checksums: ChecksumMap,
  overwrite?: Set<string>,
): { updated: string[]; skipped: string[]; keptSections: string[] } {
  const updated: string[] = [];
  const skipped: string[] = [];
  const keptSections: string[] = [];

  const rawLaunch = renderLaunchSection(launchTasks, modules);

  if (rawLaunch) {
    const block = renderSection('launch', render(rawLaunch, vars));
    const result = writeManagedFile(cwd, 'CLAUDE.md', block, checksums, overwrite);
    checksums['CLAUDE.md'] = result.checksum;
    for (const s of result.sections ?? []) {
      const sKey = `CLAUDE.md:${s.id}`;
      if (s.outcome !== 'skipped') checksums[sKey] = s.newChecksum;
      // else: checksums[sKey] already holds the preserved stored value
      else keptSections.push(sKey);
    }
    if (result.outcome === 'skipped') skipped.push('CLAUDE.md');
    else updated.push('CLAUDE.md');
  } else {
    const claudePath = join(cwd, 'CLAUDE.md');
    if (existsSync(claudePath)) {
      const before = readFileSync(claudePath, 'utf8');
      const editedIds = inspectSections('CLAUDE.md', before, checksums);
      if (!editedIds.includes('launch') || overwrite?.has('launch')) {
        const after = removeSection('launch', before);
        if (after !== before) {
          writeFileSync(claudePath, after, 'utf8');
          checksums['CLAUDE.md'] = hashContent(after);
          delete checksums['CLAUDE.md:launch'];
          updated.push('CLAUDE.md');
        }
      } else {
        keptSections.push('CLAUDE.md:launch');
        skipped.push('CLAUDE.md');
      }
    }
  }

  return { updated, skipped, keptSections };
}

// ─── Profile / file utilities ─────────────────────────────────────────────────

/** Write profile.yaml atomically at the end of an update operation. */
export function writeProfile(cwd: string, profile: Profile): void {
  const full = join(cwd, 'profile.yaml');
  writeFileSync(full, yaml.dump(profile), 'utf8');
}

/**
 * Delete a managed file only if the user has not modified it since it was
 * written (i.e. the current hash matches the stored checksum).
 *
 * For fenced files: if any section has been user-edited (inspectSections returns
 * non-empty), skip deletion. If all sections match stored checksums, proceed.
 *
 * Returns 'deleted' or 'kept'.
 */
export function removeManagedFileIfUnmodified(
  targetDir: string,
  rel: string,
  stored: ChecksumMap
): 'deleted' | 'kept' {
  const fullPath = join(targetDir, rel);
  if (!existsSync(fullPath)) return 'deleted'; // already gone

  const fileContent = readFileSync(fullPath, 'utf8');

  // For fenced files, check section-level edits
  if (hasFences(fileContent)) {
    const editedIds = inspectSections(rel, fileContent, stored);
    if (editedIds.length > 0) {
      return 'kept'; // user has edited at least one section
    }
    unlinkSync(fullPath);
    return 'deleted';
  }

  // For fence-free files, use whole-file hash comparison
  const currentHash = hashFile(fullPath);
  const storedHash = stored[rel];
  if (storedHash && currentHash !== storedHash) {
    return 'kept'; // user has edited it
  }
  unlinkSync(fullPath);
  return 'deleted';
}

export async function offerGlobalInstall(): Promise<void> {
  const check = spawnSync('patina', ['--version'], { stdio: 'pipe', shell: true, timeout: 5000 });
  // status === null means timeout or signal — treat as not installed and offer anyway
  if (check.status === 0) return;

  const pkgName = getPatinaPackageName();
  const install = await p.confirm({
    message: 'Install patina globally so you can run `patina` from any directory?',
    initialValue: true,
  });
  if (p.isCancel(install) || !install) return;

  const result = spawnSync('npm', ['install', '-g', pkgName], { stdio: 'inherit', shell: true });
  if (result.status !== 0) {
    p.log.warn(`Global install failed — run \`npm install -g ${pkgName}\` manually to use patina from any directory.`);
  }
}

function guideHint(leadingNewlines: number = 0): string {
  return chalk.hex('#94A3B8')(`${'\n'.repeat(leadingNewlines)}Run `) + chalk.bold.white('/guide') + chalk.hex('#94A3B8')(' any time to see all available commands.');
}

/** Inline text appended to p.note bodies (install outro). */
export const GUIDE_HINT_INLINE = guideHint(2);

/** Standalone string for p.log.info after an update. */
export const GUIDE_HINT_LOG = guideHint(0);

export async function promptLaunchTasks(
  avail: AvailableLaunchTask[],
  initial: string[],
): Promise<string[]> {
  const selected = await p.multiselect({
    message: `Which tasks should run every time you launch Patina?${MULTISELECT_HINT}`,
    options: avail.map(t => ({
      value: t.nsId,
      label: t.label,
      hint: chalk.hex('#64748B')(t.source),
    })),
    initialValues: initial,
    required: false,
    validate: launchSelectionError,
  });
  if (p.isCancel(selected)) onCancel();
  return Array.isArray(selected) ? selected as string[] : [];
}
