import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { hashContent } from './checksums.js';
import { hasPlaceholders, parseSections, renderSection } from './sections.js';
import { baseManagedFiles, moduleManagedFiles, profileToVars, renderUpdateCheckSection } from './scaffold.js';
import { writeManagedFile } from './upgrade.js';
import { readState, writeState } from './state.js';
import { renderLaunchSection } from './launch-tasks.js';
import { render } from './template.js';
import type { Profile } from './types.js';
import type { ChecksumMap } from './checksums.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CorruptionKind = 'placeholders' | 'missing-section' | 'orphaned-checksum';

export interface CorruptionFinding {
  kind: CorruptionKind;
  file: string;    // relative path, or state file for orphans
  detail: string;  // e.g. "{{USER_NAME}}", "missing fence: update-check"
}

export interface HealthReport {
  ok: boolean;
  findings: CorruptionFinding[];
  corruptFiles: Set<string>;  // managed files to force re-render on repair
}

// ─── Pure detectors ───────────────────────────────────────────────────────────

/**
 * Returns a deduplicated list of unrendered template tokens found in content.
 * Matches {{[A-Z][A-Z0-9_]+}} — uppercase only to avoid false positives on
 * patina fence ids like <!-- patina:profile:start -->.
 */
export function findPlaceholders(content: string): string[] {
  const matches = content.match(/\{\{[A-Z][A-Z0-9_]+\}\}/g) ?? [];
  return [...new Set(matches)];
}

/**
 * Returns the required section ids for a CLAUDE.md given a profile.
 * Always includes: profile, guide, commands, modules, update-check.
 * Adds 'launch' when profile.launch_tasks has entries.
 */
export function requiredClaudeSections(profile: Profile): string[] {
  const base = ['profile', 'guide', 'commands', 'modules', 'update-check'];
  if (profile.launch_tasks?.length) base.push('launch');
  return base;
}

/**
 * Returns the ids of required sections that are absent from claudeContent.
 */
export function findMissingSections(claudeContent: string, requiredIds: string[]): string[] {
  const present = new Set(parseSections(claudeContent).map(s => s.id));
  return requiredIds.filter(id => !present.has(id));
}

/**
 * Returns checksum keys that exist in storedKeys but not in expectedKeys
 * (keys for files/sections that no longer have a corresponding managed file).
 */
export function findOrphanedChecksums(storedKeys: string[], expectedKeys: string[]): string[] {
  const expected = new Set(expectedKeys);
  return storedKeys.filter(k => !expected.has(k));
}

/**
 * Produces a plain-language summary of the health report for CLI/status output.
 */
export function formatHealthReport(report: HealthReport): string {
  if (report.ok) return 'No corruption found.';

  const lines: string[] = [];

  const placeholderFindings = report.findings.filter(f => f.kind === 'placeholders');
  const missingSectionFindings = report.findings.filter(f => f.kind === 'missing-section');
  const orphanedFindings = report.findings.filter(f => f.kind === 'orphaned-checksum');

  if (placeholderFindings.length > 0) {
    lines.push('Unrendered template placeholders found (file was never properly set up):');
    for (const f of placeholderFindings) {
      lines.push(`  ${f.file}: ${f.detail}`);
    }
  }

  if (missingSectionFindings.length > 0) {
    lines.push('Required sections missing from CLAUDE.md:');
    for (const f of missingSectionFindings) {
      lines.push(`  ${f.detail}`);
    }
  }

  if (orphanedFindings.length > 0) {
    lines.push('Orphaned checksum keys in .patina-state.json (will be pruned on repair):');
    for (const f of orphanedFindings) {
      lines.push(`  ${f.detail}`);
    }
  }

  const fileCount = report.corruptFiles.size;
  if (fileCount > 0) {
    lines.push(`Run \`npx my-patina\` to repair ${fileCount} affected file${fileCount === 1 ? '' : 's'}.`);
  } else if (orphanedFindings.length > 0) {
    lines.push('Run `npx my-patina repair` to prune orphaned checksum entries.');
  }

  return lines.join('\n');
}

// ─── Filesystem orchestrators ─────────────────────────────────────────────────

/**
 * Build the complete set of expected checksum keys for a given instance.
 * These are the keys that writeManagedFile would create for all managed files.
 *
 * Note: CLAUDE.md sections from the base template are augmented with
 * update-check (always) and launch (when profile.launch_tasks is set),
 * since those sections are appended separately by scaffold/syncBaseFiles.
 */
function buildExpectedKeys(cwd: string, profile: Profile): string[] {
  const vars = profileToVars(profile);
  const files: Array<[string, string]> = [
    ...baseManagedFiles(vars, profile.editor, cwd),
    ...profile.modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  const keys: string[] = [];
  const claudeSectionKeys = new Set<string>();

  for (const [rel, content] of files) {
    keys.push(rel);
    // Add section-level keys for fenced files
    for (const s of parseSections(content)) {
      keys.push(`${rel}:${s.id}`);
      if (rel === 'CLAUDE.md') claudeSectionKeys.add(s.id);
    }
  }

  // CLAUDE.md also gets update-check and (conditionally) launch sections
  // appended by scaffold/syncBaseFiles — always include them as expected keys.
  if (!claudeSectionKeys.has('update-check')) {
    keys.push('CLAUDE.md:update-check');
  }
  if (profile.launch_tasks?.length && !claudeSectionKeys.has('launch')) {
    keys.push('CLAUDE.md:launch');
  }

  return keys;
}

/**
 * Detect corruption in a patina instance.
 *
 * Checks:
 * 1. Unrendered template placeholders in any managed file
 * 2. Missing required fences in CLAUDE.md
 * 3. Orphaned checksum keys in .patina-state.json
 *
 * Returns a HealthReport with structured findings and the set of files to repair.
 */
export function detectCorruption(
  cwd: string,
  profile: Profile,
  storedChecksums?: ChecksumMap
): HealthReport {
  const state = storedChecksums !== undefined
    ? { checksums: storedChecksums }
    : readState(cwd, profile);
  const checksums = state.checksums;

  const findings: CorruptionFinding[] = [];
  const corruptFiles = new Set<string>();

  const vars = profileToVars(profile);
  const managedFiles: Array<[string, string]> = [
    ...baseManagedFiles(vars, profile.editor, cwd),
    ...profile.modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  // Check 1 & 2: scan managed files for placeholders and (for CLAUDE.md) missing fences
  for (const [rel] of managedFiles) {
    const fullPath = join(cwd, rel);
    if (!existsSync(fullPath)) continue;

    const content = readFileSync(fullPath, 'utf8');

    // Placeholder check
    const tokens = findPlaceholders(content);
    if (tokens.length > 0) {
      corruptFiles.add(rel);
      findings.push({
        kind: 'placeholders',
        file: rel,
        detail: tokens.join(', '),
      });
    }

    // Missing required sections check (CLAUDE.md only)
    // Note: missing sections alone do NOT trigger repair — only placeholder findings do.
    // A user may legitimately edit CLAUDE.md to remove fences; missing sections are
    // reported as a finding but only drive corruptFiles when combined with placeholders
    // (which are never a legitimate user edit).
    if (rel === 'CLAUDE.md') {
      const required = requiredClaudeSections(profile);
      const missing = findMissingSections(content, required);
      for (const id of missing) {
        // Only flag as corrupt if placeholders were also found (indicating raw template).
        // Otherwise just report as an informational finding.
        if (tokens.length > 0) corruptFiles.add(rel);
        findings.push({
          kind: 'missing-section',
          file: rel,
          detail: `missing fence: ${id}`,
        });
      }
    }
  }

  // Check 3: orphaned checksum keys
  const expectedKeys = buildExpectedKeys(cwd, profile);
  const storedKeys = Object.keys(checksums);
  const orphaned = findOrphanedChecksums(storedKeys, expectedKeys);
  for (const key of orphaned) {
    findings.push({
      kind: 'orphaned-checksum',
      file: '.patina-state.json',
      detail: key,
    });
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
 * - After repair, updates checksums in .patina-state.json for all repaired files.
 * - Orphaned checksum keys are pruned on repair.
 */
export async function repairCorruption(
  cwd: string,
  profile: Profile,
  opts: { dryRun: boolean }
): Promise<{ report: HealthReport; repairedFiles: string[] }> {
  const existingState = readState(cwd, profile);
  const report = detectCorruption(cwd, profile, existingState.checksums);

  if (opts.dryRun || report.ok) {
    return { report, repairedFiles: [] };
  }

  const vars = profileToVars(profile);
  const managedFiles: Array<[string, string]> = [
    ...baseManagedFiles(vars, profile.editor, cwd),
    ...profile.modules.flatMap(m => moduleManagedFiles(m, vars)),
  ];

  const checksums: ChecksumMap = { ...existingState.checksums };
  const repairedFiles: string[] = [];

  for (const [rel, content] of managedFiles) {
    if (!report.corruptFiles.has(rel)) continue;

    const result = writeManagedFile(cwd, rel, content, checksums, undefined, new Set([rel]));
    checksums[rel] = result.checksum;
    for (const s of result.sections ?? []) {
      const sKey = `${rel}:${s.id}`;
      checksums[sKey] = s.newChecksum;
    }
    repairedFiles.push(rel);
  }

  // After repairing CLAUDE.md, re-append update-check and (if applicable) launch sections,
  // since these are always appended separately and may be missing from the repaired file.
  if (report.corruptFiles.has('CLAUDE.md')) {
    // Re-render update-check section (always present)
    const updateCheckBlock = renderSection('update-check', renderUpdateCheckSection(vars));
    const ucResult = writeManagedFile(cwd, 'CLAUDE.md', updateCheckBlock, checksums, new Set(['update-check']));
    checksums['CLAUDE.md'] = ucResult.checksum;
    for (const s of ucResult.sections ?? []) {
      checksums[`CLAUDE.md:${s.id}`] = s.newChecksum;
    }

    // Re-render launch section (only when launch_tasks is set)
    if (profile.launch_tasks?.length) {
      const rawLaunch = renderLaunchSection(profile.launch_tasks, profile.modules ?? []);
      if (rawLaunch) {
        const launchBlock = renderSection('launch', render(rawLaunch, vars));
        const launchResult = writeManagedFile(cwd, 'CLAUDE.md', launchBlock, checksums, new Set(['launch']));
        checksums['CLAUDE.md'] = launchResult.checksum;
        for (const s of launchResult.sections ?? []) {
          checksums[`CLAUDE.md:${s.id}`] = s.newChecksum;
        }
      }
    }
  }

  // Prune orphaned checksum keys
  const orphanedKeys = report.findings
    .filter(f => f.kind === 'orphaned-checksum')
    .map(f => f.detail);
  for (const key of orphanedKeys) {
    delete checksums[key];
  }

  writeState(cwd, { ...existingState, checksums });

  // Post-repair validation: warn if residual placeholders remain
  const postReport = detectCorruption(cwd, profile, checksums);
  const residual = postReport.findings.filter(f => f.kind === 'placeholders' || f.kind === 'missing-section');
  if (residual.length > 0) {
    // Return the post-repair report so callers can warn
    return { report: postReport, repairedFiles };
  }

  return { report: { ok: true, findings: [], corruptFiles: new Set() }, repairedFiles };
}
