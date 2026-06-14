import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { DeferredModule, Profile } from './types.js';

export interface UpdateCheck {
  last_notified_version: string;
}

export interface BackupOffer {
  offered_at: string;
  outcome: 'initialized' | 'declined' | 'already-tracked' | 'skipped';
}

export interface PatinaState {
  deferred_modules?: DeferredModule[];
  update_check?: UpdateCheck;
  backup_offer?: BackupOffer;
}

export const STATE_FILENAME = '.patina-state.json';

/** Strip any legacy `_checksums` field written by older versions of patina. */
export function stripLegacyChecksums(profile: Profile): Profile {
  const { _checksums: _stripped, ...clean } = profile as Profile & { _checksums?: unknown };
  return clean as Profile;
}

/**
 * Read `.patina-state.json` from `root`. Tolerates legacy state files that
 * contain a `checksums` key — the field is silently ignored.
 * Returns `{}` (empty state) for a fresh install or if the file is absent.
 */
export function readState(root: string): PatinaState {
  const statePath = join(root, STATE_FILENAME);

  if (!existsSync(statePath)) {
    return {};
  }

  const raw = readFileSync(statePath, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(
      `Corrupt ${STATE_FILENAME}: failed to parse JSON. ` +
      `Fix or delete the file at ${statePath} and try again.`
    );
  }
  const obj = parsed as Record<string, unknown>;

  const rawDeferred = obj.deferred_modules;
  const deferred_modules = Array.isArray(rawDeferred) ? (rawDeferred as DeferredModule[]) : undefined;

  const rawUpdateCheck = obj.update_check;
  let update_check: UpdateCheck | undefined;
  if (
    rawUpdateCheck !== null &&
    typeof rawUpdateCheck === 'object' &&
    !Array.isArray(rawUpdateCheck) &&
    typeof (rawUpdateCheck as Record<string, unknown>).last_notified_version === 'string'
  ) {
    update_check = { last_notified_version: (rawUpdateCheck as Record<string, unknown>).last_notified_version as string };
  }

  const rawBackupOffer = obj.backup_offer;
  let backup_offer: BackupOffer | undefined;
  const validOutcomes = new Set(['initialized', 'declined', 'already-tracked', 'skipped']);
  if (
    rawBackupOffer !== null &&
    typeof rawBackupOffer === 'object' &&
    !Array.isArray(rawBackupOffer) &&
    typeof (rawBackupOffer as Record<string, unknown>).offered_at === 'string' &&
    !isNaN(Date.parse((rawBackupOffer as Record<string, unknown>).offered_at as string)) &&
    validOutcomes.has((rawBackupOffer as Record<string, unknown>).outcome as string)
  ) {
    backup_offer = {
      offered_at: (rawBackupOffer as Record<string, unknown>).offered_at as string,
      outcome: (rawBackupOffer as Record<string, unknown>).outcome as BackupOffer['outcome'],
    };
  }

  return {
    ...(deferred_modules !== undefined ? { deferred_modules } : {}),
    ...(update_check !== undefined ? { update_check } : {}),
    ...(backup_offer !== undefined ? { backup_offer } : {}),
  };
}

/**
 * Write `.patina-state.json` to `root`. Does not include checksums.
 */
export function writeState(root: string, state: PatinaState): void {
  const toWrite: Record<string, unknown> = {};
  if (state.deferred_modules !== undefined) toWrite.deferred_modules = state.deferred_modules;
  if (state.update_check !== undefined) toWrite.update_check = state.update_check;
  if (state.backup_offer !== undefined) toWrite.backup_offer = state.backup_offer;
  writeFileSync(
    join(root, STATE_FILENAME),
    JSON.stringify(toWrite, null, 2) + '\n',
    'utf8'
  );
}
