import * as p from '@clack/prompts';
import chalk from 'chalk';
import { join } from 'path';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'fs';
import yaml from 'js-yaml';
import { isMarkedManaged } from './upgrade.js';
import { availableLaunchTasks, launchSelectionError, type AvailableLaunchTask } from './launch-tasks.js';
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
 */
export function defaultSnoozeUntil(today?: string): string {
  return snoozeUntilFor('1w', today);
}

/**
 * Maps a snooze option to a future ISO date string (YYYY-MM-DD).
 */
export function snoozeUntilFor(option: '1w' | '1m' | '3m', today?: string): string {
  const base = today ? new Date(today + 'T00:00:00Z') : new Date();
  const result = new Date(base);
  if (option === '1w') {
    result.setUTCDate(result.getUTCDate() + 7);
  } else if (option === '1m') {
    const targetMonth = result.getUTCMonth() + 1;
    result.setUTCMonth(targetMonth);
    if (result.getUTCMonth() !== targetMonth % 12) {
      result.setUTCDate(0);
    }
  } else {
    const targetMonth = result.getUTCMonth() + 3;
    result.setUTCMonth(targetMonth);
    const expectedMonth = (base.getUTCMonth() + 3) % 12;
    if (result.getUTCMonth() !== expectedMonth) {
      result.setUTCDate(0);
    }
  }
  return result.toISOString().slice(0, 10);
}

/**
 * Returns a new state with the deferred entry for `moduleId` upserted.
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

// ─── Profile / file utilities ─────────────────────────────────────────────────

/** Write profile.yaml atomically at the end of an update operation. */
export function writeProfile(cwd: string, profile: Profile): void {
  const full = join(cwd, 'profile.yaml');
  writeFileSync(full, yaml.dump(profile), 'utf8');
}

/**
 * Delete a managed file only if it carries the patina managed marker (or is absent).
 * Unmarked (user-owned) files are left in place.
 *
 * Returns 'deleted' or 'kept'.
 */
export function removeManagedFileIfManaged(
  targetDir: string,
  rel: string,
): 'deleted' | 'kept' {
  const fullPath = join(targetDir, rel);
  if (!existsSync(fullPath)) return 'deleted'; // already gone

  const content = readFileSync(fullPath, 'utf8');
  if (!isMarkedManaged(rel, content)) {
    return 'kept'; // user-owned file
  }
  unlinkSync(fullPath);
  return 'deleted';
}

// Backward-compat alias
export const removeManagedFileIfUnmodified = removeManagedFileIfManaged;

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
