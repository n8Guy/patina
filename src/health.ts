import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { baseManagedFiles, moduleManagedFiles, profileToVars } from './scaffold.js';
import { readState, writeState } from './state.js';
import type { Profile } from './types.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CorruptionKind = 'placeholders';

export interface CorruptionFinding {
  kind: CorruptionKind;
  file: string;    // relative path
  detail: string;  // e.g. "{{USER_NAME}}"
}

export interface HealthReport {
  ok: boolean;
  findings: CorruptionFinding[];
  corruptFiles: Set<string>;  // managed files to force re-render on repair
}

// ─── Pure detectors ───────────────────────────────────────────────────────────

/**
 * Returns a deduplicated list of unrendered template tokens found in content.
 * Matches {{[A-Z][A-Z0-9_]+}} — uppercase only to avoid false positives.
 */
export function findPlaceholders(content: string): string[] {
  const matches = content.match(/\{\{[A-Z][A-Z0-9_]+\}\}/g) ?? [];
  return [...new Set(matches)];
}

/**
 * Shared repair command string for placeholder corruption.
 * Used by both formatHealthReport (health.ts) and buildFixGuidance (validate.ts).
 */
export function placeholderRepairGuidance(): string {
  return 'Run `npx my-patina repair` to fix unrendered template placeholders automatically.';
}

/**
 * Produces a plain-language summary of the health report for CLI/status output.
 */
export function formatHealthReport(report: HealthReport): string {
  if (report.ok) return 'No corruption found.';

  const lines: string[] = [];

  for (const f of report.findings) {
    if (f.kind === 'placeholders') {
      lines.push(`Unrendered template placeholders in ${f.file}: ${f.detail}`);
    }
  }

  const fileCount = report.corruptFiles.size;
  if (fileCount > 0) {
    lines.push(`${fileCount} affected file${fileCount === 1 ? '' : 's'}. ${placeholderRepairGuidance()}`);
  }

  return lines.join('\n');
}

// ─── Filesystem orchestrators ─────────────────────────────────────────────────

/**
 * Detect corruption in a patina instance.
 *
 * Checks: unrendered template placeholders in any managed file on disk.
 * Returns a HealthReport with structured findings and the set of files to repair.
 */
export function detectCorruption(
  cwd: string,
  profile: Profile,
): HealthReport {
  const findings: CorruptionFinding[] = [];
  const corruptFiles = new Set<string>();

  const vars = profileToVars(profile);
  const managedFiles: Array<[string, string]> = [
    ...baseManagedFiles({ vars, editor: profile.editor, modules: profile.modules ?? []}),
    ...profile.modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  for (const [rel] of managedFiles) {
    const fullPath = join(cwd, rel);
    if (!existsSync(fullPath)) continue;

    const content = readFileSync(fullPath, 'utf8');
    const tokens = findPlaceholders(content);
    if (tokens.length > 0) {
      corruptFiles.add(rel);
      findings.push({
        kind: 'placeholders',
        file: rel,
        detail: tokens.join(', '),
      });
    }
  }

  return {
    ok: findings.length === 0,
    findings,
    corruptFiles,
  };
}

/**
 * Repair corruption in a patina instance by re-rendering corrupt files from profile.yaml.
 *
 * - dryRun: if true, returns the report without writing anything.
 * - Corrupt files are written unconditionally regardless of ownership marker, because
 *   a corrupt file may have lost its frontmatter (e.g. truncated write) and would
 *   otherwise be silently skipped by writeManagedFile.
 */
export async function repairCorruption(
  cwd: string,
  profile: Profile,
  opts: { dryRun: boolean }
): Promise<{ report: HealthReport; repairedFiles: string[] }> {
  const existingState = readState(cwd);
  const report = detectCorruption(cwd, profile);

  if (opts.dryRun || report.ok) {
    return { report, repairedFiles: [] };
  }

  const vars = profileToVars(profile);
  const managedFiles: Array<[string, string]> = [
    ...baseManagedFiles({ vars, editor: profile.editor, modules: profile.modules ?? []}),
    ...profile.modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  const repairedFiles: string[] = [];

  for (const [rel, content] of managedFiles) {
    if (!report.corruptFiles.has(rel)) continue;
    // Write unconditionally — corrupt files may have lost their marker.
    const fullPath = join(cwd, rel);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content, 'utf8');
    repairedFiles.push(rel);
  }

  writeState(cwd, { deferred_modules: existingState.deferred_modules, update_check: existingState.update_check, backup_offer: existingState.backup_offer });

  // Post-repair validation
  const postReport = detectCorruption(cwd, profile);
  if (postReport.ok) {
    return { report: { ok: true, findings: [], corruptFiles: new Set() }, repairedFiles };
  }

  return { report: postReport, repairedFiles };
}
