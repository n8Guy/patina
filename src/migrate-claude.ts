import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { parseSections, renderSection, inspectSections } from './sections.js';
import type { ChecksumMap } from './checksums.js';

export type MigrationOutcome = 'migrated' | 'skipped-edited' | 'none';

export interface ClaudeMigrationResult {
  content: string;        // migrated file content (fences absent / unchanged if no migration)
  migrated: boolean;      // true if we removed old unfenced prose
}

// Plain-language summary lines shown after an update, shared by every wizard
// branch that runs the migration pre-pass so the wording stays in one place.
export const MIGRATION_REFRESHED_MSG =
  'Refreshed the built-in guidance in CLAUDE.md (your own notes were kept).';
export const MIGRATION_DUPLICATE_WARNING_MSG =
  'Your CLAUDE.md has hand edits, so I left the built-in guidance in place — you may see it duplicated; trim the older copy when convenient.';

// Signature headings that identify the pre-#118 unfenced patina prose region.
const SIGNATURE_HEADINGS = [
  '## What patina is',
  '## On session start',
  '## Rules that always apply',
];

// Fenced sections whose user-edits cause the migration to abort non-destructively.
const GUARD_IDS = ['profile', 'commands', 'modules'];

/** Build a predicate that reports whether a string index falls outside every fence. */
function makeIsOutsideFence(sections: ReturnType<typeof parseSections>): (idx: number) => boolean {
  const ranges = sections.map(s => ({ start: s.start, end: s.end }));
  return (idx: number) => ranges.every(r => idx < r.start || idx >= r.end);
}

/**
 * Single source of truth for classifying an existing CLAUDE.md. Used by both
 * `migrateClaudeMd` (to decide whether to act) and `migrateClaudeMdFile` (to
 * report the three-way outcome) so the heuristic can never diverge.
 *
 * - `'none'`       — not the pre-#118 layout (already fenced, fence-free, or
 *                    fewer than 2 signature headings outside a fence).
 * - `'skipped-edited'` — old layout, but a guarded fence has user edits → don't touch.
 * - `'old-clean'`  — old layout and safe to migrate.
 */
export function detectOldLayout(
  existing: string,
  storedChecksums: ChecksumMap,
  relativePath = 'CLAUDE.md',
): 'none' | 'skipped-edited' | 'old-clean' {
  const sections = parseSections(existing);

  // Already migrated (guide present) or no fences at all → nothing to do here.
  if (sections.some(s => s.id === 'guide') || sections.length === 0) {
    return 'none';
  }

  const isOutsideFence = makeIsOutsideFence(sections);
  let outsideCount = 0;
  for (const heading of SIGNATURE_HEADINGS) {
    const idx = existing.indexOf(heading);
    if (idx !== -1 && isOutsideFence(idx)) outsideCount++;
  }
  if (outsideCount < 2) {
    return 'none';
  }

  // Old layout detected — abort non-destructively if the user edited a guarded fence.
  const editedIds = inspectSections(relativePath, existing, storedChecksums);
  if (GUARD_IDS.some(id => editedIds.includes(id))) {
    return 'skipped-edited';
  }

  return 'old-clean';
}

/**
 * Given the start index of an orphaned "## Slash commands" block, return the
 * index just past the end of that block — the heading, optional intro prose,
 * and the markdown table — WITHOUT consuming any trailing user content that may
 * follow it.
 */
function orphanBlockEnd(content: string, start: number): number {
  const lines = content.slice(start).split('\n');
  let consumed = 0;
  let sawTable = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    const isTableRow = /^\s*\|/.test(line);
    const isBlank = line.trim() === '';
    const isNewSection = i > 0 && /^##\s/.test(line);
    if (isNewSection) break;
    if (isTableRow) sawTable = true;
    // Once we're past the table, the first real prose line is user content — stop.
    if (sawTable && !isTableRow && !isBlank) break;
    consumed += lines[i].length + 1; // +1 for the '\n' removed by split
  }
  return Math.min(start + consumed, content.length);
}

/**
 * One-time, idempotent migration of an existing CLAUDE.md from the
 * pre-#118 unfenced-prose layout to the fenced-guide layout.
 *
 * Detects the old layout by signature headings that are NOT inside a patina
 * fence. Removes the old unfenced patina-owned prose regions (guide body,
 * old "## Slash commands" table, old "## Modules" heading) so the subsequent
 * mergeSections call inserts the fenced versions without duplication.
 *
 * Does NOT add fences itself — it only DELETES the stale unfenced regions and
 * leaves empty placeholder fences in canonical order at the seam. The caller
 * then runs the normal section merge, which fills the placeholders in place.
 */
export function migrateClaudeMd(
  existing: string,
  storedChecksums: ChecksumMap,
  relativePath = 'CLAUDE.md',
): ClaudeMigrationResult {
  const noOp = { content: existing, migrated: false };

  // Classify the file with the shared heuristic — only proceed for a clean old layout.
  if (detectOldLayout(existing, storedChecksums, relativePath) !== 'old-clean') {
    return noOp;
  }

  const sections = parseSections(existing);
  const isOutsideFence = makeIsOutsideFence(sections);

  // Find the profile fence (anchor for the migration).
  const profileSection = sections.find(s => s.id === 'profile');
  if (!profileSection) {
    return noOp;
  }

  // Detect whether the existing file uses CRLF.
  const usesCRLF = existing.includes('\r\n');
  const nl = usesCRLF ? '\r\n' : '\n';

  // Find deleteStart: earliest signature heading at/after profile.end and outside any fence.
  let deleteStart = -1;
  for (const heading of SIGNATURE_HEADINGS) {
    let searchFrom = profileSection.end;
    while (true) {
      const idx = existing.indexOf(heading, searchFrom);
      if (idx === -1) break;
      if (isOutsideFence(idx)) {
        if (deleteStart === -1 || idx < deleteStart) {
          deleteStart = idx;
        }
        break;
      }
      searchFrom = idx + 1;
    }
  }

  if (deleteStart === -1) {
    return noOp;
  }

  // Find deleteEnd: start of the earliest fence (commands or modules) that begins after deleteStart.
  // If neither exists, use EOF.
  const commandsSection = sections.find(s => s.id === 'commands');
  const modulesSection = sections.find(s => s.id === 'modules');

  // Identify surviving fences that start after deleteStart.
  const survivingFenceStarts: number[] = [];
  if (commandsSection && commandsSection.start > deleteStart) {
    survivingFenceStarts.push(commandsSection.start);
  }
  if (modulesSection && modulesSection.start > deleteStart) {
    survivingFenceStarts.push(modulesSection.start);
  }

  let deleteEnd: number;
  if (survivingFenceStarts.length > 0) {
    deleteEnd = Math.min(...survivingFenceStarts);
  } else {
    deleteEnd = existing.length;
  }

  // Sanity check.
  if (deleteStart >= deleteEnd) {
    return noOp;
  }

  // Handle stale unfenced "## Slash commands" heading+intro that sits immediately before
  // the commands fence (post-#117 installs). These are outside the delete span.
  // We need to also remove this orphan if present.
  let commandsOrphanStart = -1;
  let commandsOrphanEnd = -1;
  if (commandsSection && commandsSection.start >= deleteEnd) {
    // The commands fence is AFTER the delete span — look for orphan prose just before it.
    // Orphan: "## Slash commands\n\nThis table is regenerated..." up to the fence.
    const orphanHeading = '## Slash commands';
    // Search between deleteEnd and commandsSection.start
    const searchRegion = existing.slice(deleteEnd, commandsSection.start);
    const orphanIdx = searchRegion.lastIndexOf(orphanHeading);
    if (orphanIdx !== -1) {
      commandsOrphanStart = deleteEnd + orphanIdx;
      commandsOrphanEnd = commandsSection.start;
    }
  }

  // Also handle orphaned duplicate static "## Slash commands" table appended at EOF
  // (post-#117 two-table case): a second "## Slash commands" occurrence after commandsSection.end.
  let eofOrphanStart = -1;
  let eofOrphanEnd = -1;
  if (commandsSection) {
    const afterCommands = existing.slice(commandsSection.end);
    const eofOrphanIdx = afterCommands.indexOf('## Slash commands');
    if (eofOrphanIdx !== -1) {
      const absoluteIdx = commandsSection.end + eofOrphanIdx;
      // Make sure it's outside any fence.
      if (isOutsideFence(absoluteIdx)) {
        eofOrphanStart = absoluteIdx;
        // Consume only the orphan block (heading + intro + table), preserving any
        // user content that happens to follow it rather than truncating to EOF.
        eofOrphanEnd = orphanBlockEnd(existing, absoluteIdx);
      }
    }
  }

  // Determine which placeholder fences to insert at the seam.
  // Always insert guide. Insert commands/modules only if not already present.
  const placeholderIds: string[] = ['guide'];
  if (!commandsSection) placeholderIds.push('commands');
  if (!modulesSection) placeholderIds.push('modules');

  // Build the placeholder block.
  const placeholders = placeholderIds.map(id => renderSection(id, '')).join(nl + nl);

  // Now construct the result by splicing:
  // 1. Text before deleteStart (trim trailing whitespace at seam)
  // 2. Placeholder fences
  // 3. Text from deleteEnd onward (after removing orphan prose if present)

  let before = existing.slice(0, deleteStart);
  // Trim trailing newlines at the seam (we'll add one blank line before placeholders).
  before = before.replace(/(\r?\n)+$/, '');

  // Build the "after" region (from deleteEnd to EOF), with orphan removals applied.
  let after = existing.slice(deleteEnd);

  // Remove commandsOrphan from "after" (relative to deleteEnd).
  if (commandsOrphanStart !== -1) {
    const relStart = commandsOrphanStart - deleteEnd;
    const relEnd = commandsOrphanEnd - deleteEnd;
    if (relStart >= 0 && relEnd > relStart) {
      after = after.slice(0, relStart) + after.slice(relEnd);
    }
  }

  // Remove eofOrphan from the updated "after" string, keeping any trailing user content.
  // Need to recalculate relative positions because we may have removed commandsOrphan above.
  if (eofOrphanStart !== -1) {
    let relEofStart = eofOrphanStart - deleteEnd;
    let relEofEnd = eofOrphanEnd - deleteEnd;
    if (commandsOrphanStart !== -1) {
      const removedLen = commandsOrphanEnd - commandsOrphanStart;
      if (eofOrphanStart >= commandsOrphanEnd) {
        relEofStart -= removedLen;
        relEofEnd -= removedLen;
      }
    }
    if (relEofStart >= 0 && relEofEnd > relEofStart && relEofStart < after.length) {
      after = after.slice(0, relEofStart) + after.slice(relEofEnd);
    }
  }

  // Trim leading newlines from "after".
  after = after.replace(/^(\r?\n)+/, '');

  // Assemble result.
  let result: string;
  if (after === '') {
    result = before + nl + nl + placeholders + nl;
  } else {
    result = before + nl + nl + placeholders + nl + nl + after;
  }

  // Normalize: collapse 3+ consecutive newlines to 2.
  if (usesCRLF) {
    result = result.replace(/(\r\n){3,}/g, '\r\n\r\n');
  } else {
    result = result.replace(/\n{3,}/g, '\n\n');
  }

  return { content: result, migrated: true };
}

/**
 * Pre-pass: if CLAUDE.md on disk is in the pre-#118 unfenced-guide layout,
 * migrate it in place (removing stale prose, inserting empty placeholders in
 * canonical order) so the subsequent managed-file writes fill them via
 * mergeSections rather than appending at EOF.
 *
 * Returns 'migrated' if migration ran, 'skipped-edited' if the non-destructive
 * guard tripped (user has edited fenced sections), or 'none' if no migration
 * was needed.
 */
export function migrateClaudeMdFile(cwd: string, storedChecksums: ChecksumMap): MigrationOutcome {
  const full = join(cwd, 'CLAUDE.md');
  if (!existsSync(full)) return 'none';
  const existing = readFileSync(full, 'utf8');

  // Classify with the shared heuristic so 'none'/'skipped-edited' can't drift from
  // the logic inside migrateClaudeMd.
  const layout = detectOldLayout(existing, storedChecksums);
  if (layout !== 'old-clean') return layout;

  const { content, migrated } = migrateClaudeMd(existing, storedChecksums);
  if (migrated) {
    writeFileSync(full, content, 'utf8');
    return 'migrated';
  }

  return 'none';
}
