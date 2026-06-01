import { hashContent } from './checksums.js';
import type { ChecksumMap } from './checksums.js';

export interface ParsedSection {
  id: string;
  inner: string;  // content between start and end markers (normalized to \n)
  start: number;  // index in string where <!-- patina:id:start --> begins
  end: number;    // index where <!-- patina:id:end --> ends (exclusive)
}

export interface SectionOutcome {
  id: string;
  outcome: 'added' | 'updated' | 'skipped' | 'unchanged';
  newChecksum: string;
}

/**
 * Returns true if content contains at least one patina fence pair.
 */
export function hasFences(content: string): boolean {
  return parseSections(content).length > 0;
}

/**
 * Parse all fenced sections from content. Returns empty array if none found.
 * Inner content has \r\n normalized to \n before storing.
 * Malformed fences (start without matching end, or vice versa) are silently ignored.
 */
export function parseSections(content: string): ParsedSection[] {
  const sections: ParsedSection[] = [];
  const startRe = /<!-- patina:([a-z0-9-]+):start -->/g;
  let match: RegExpExecArray | null;

  while ((match = startRe.exec(content)) !== null) {
    const id = match[1];
    const startIdx = match.index;
    const afterStart = match.index + match[0].length;

    // Find the matching end marker
    const endMarker = `<!-- patina:${id}:end -->`;
    const endIdx = content.indexOf(endMarker, afterStart);
    if (endIdx === -1) {
      // No matching end — malformed, skip
      continue;
    }

    // Inner content: everything after the start marker's newline up to (but not including) the end marker
    // The start marker is followed by \n (or \r\n), inner content starts after that
    let innerStart = afterStart;
    if (content[innerStart] === '\r') innerStart++;
    if (content[innerStart] === '\n') innerStart++;

    // Inner ends just before the end marker (trim trailing newline before end marker)
    let innerEnd = endIdx;
    if (innerEnd > 0 && content[innerEnd - 1] === '\n') innerEnd--;
    if (innerEnd > 0 && content[innerEnd - 1] === '\r') innerEnd--;

    const inner = content.slice(innerStart, innerEnd).replace(/\r\n/g, '\n');

    sections.push({
      id,
      inner,
      start: startIdx,
      end: endIdx + endMarker.length,
    });
  }

  return sections;
}

/**
 * Produce a fenced block: <!-- patina:id:start -->\n{innerContent}\n<!-- patina:id:end -->
 */
export function renderSection(id: string, innerContent: string): string {
  return `<!-- patina:${id}:start -->\n${innerContent}\n<!-- patina:${id}:end -->`;
}

/**
 * Replace fenced blocks in `existing` with new content from `newSections` map.
 * - If a section id is in `overwrite`, replace regardless of user edits.
 * - If a section id is NOT in `overwrite`, check storedChecksums[relativePath:id];
 *   if inner content hash differs from stored → SectionOutcome 'skipped' (keep existing)
 * - If a section exists in newSections but not in existing file → append it (outcome 'added')
 * - If a section exists in existing but not in newSections → leave unchanged (outcome 'unchanged')
 * Returns the merged content string and per-section outcomes.
 */
export function mergeSections(
  existing: string,
  newSections: Record<string, string>,
  storedChecksums: ChecksumMap,
  relativePath: string,
  overwrite: Set<string>
): { content: string; sections: SectionOutcome[] } {
  const existingSections = parseSections(existing);
  const outcomes: SectionOutcome[] = [];

  // Build a map of existing sections by id
  const existingMap = new Map<string, ParsedSection>(
    existingSections.map(s => [s.id, s])
  );

  // Process existing sections in order, replacing where needed
  let result = existing;
  // We need to do replacements from end to start to preserve indices
  const replacements: Array<{ start: number; end: number; replacement: string }> = [];

  for (const section of existingSections) {
    const { id, inner } = section;

    if (id in newSections) {
      const newInner = newSections[id];
      const storedKey = `${relativePath}:${id}`;
      const storedHash = storedChecksums[storedKey];
      const currentHash = hashContent(inner);

      if (overwrite.has(id)) {
        // Force overwrite
        const normalized = newInner.replace(/\r\n/g, '\n');
        replacements.push({
          start: section.start,
          end: section.end,
          replacement: renderSection(id, normalized),
        });
        outcomes.push({ id, outcome: 'updated', newChecksum: hashContent(normalized) });
      } else if (storedHash && currentHash !== storedHash) {
        // User has edited this section — skip
        // newChecksum = preserved stored checksum
        outcomes.push({ id, outcome: 'skipped', newChecksum: storedHash });
      } else {
        // Not user-edited (hash matches stored or no stored hash)
        const normalized = newInner.replace(/\r\n/g, '\n');
        const normalizedHash = hashContent(normalized);
        if (normalizedHash === currentHash) {
          // Content identical — no rewrite needed
          outcomes.push({ id, outcome: 'unchanged', newChecksum: currentHash });
        } else {
          replacements.push({
            start: section.start,
            end: section.end,
            replacement: renderSection(id, normalized),
          });
          outcomes.push({ id, outcome: 'updated', newChecksum: normalizedHash });
        }
      }
    } else {
      // Section not in newSections — leave unchanged
      outcomes.push({ id, outcome: 'unchanged', newChecksum: hashContent(inner) });
    }
  }

  // Apply replacements from end to start to preserve indices
  replacements.sort((a, b) => b.start - a.start);
  for (const { start, end, replacement } of replacements) {
    result = result.slice(0, start) + replacement + result.slice(end);
  }

  // Append new sections that don't exist in the current file
  for (const [id, innerContent] of Object.entries(newSections)) {
    if (!existingMap.has(id)) {
      const normalized = innerContent.replace(/\r\n/g, '\n');
      const block = renderSection(id, normalized);
      // Append with a newline separator
      result = result.endsWith('\n') ? result + block + '\n' : result + '\n' + block + '\n';
      outcomes.push({ id, outcome: 'added', newChecksum: hashContent(normalized) });
    }
  }

  return { content: result, sections: outcomes };
}

/**
 * Remove the fenced block with the given id from content.
 * - If the id is not present, returns content unchanged.
 * - Collapses double blank lines at the seam to a single blank line.
 * - No trailing blank-line artifact if block was at end.
 */
export function removeSection(id: string, content: string): string {
  const sections = parseSections(content);
  const section = sections.find(s => s.id === id);
  if (!section) return content;

  const { start, end } = section;

  let before = content.slice(0, start);
  // Remove trailing newlines (including any blank lines immediately before the fence)
  before = before.replace(/(\r?\n)+$/, '');

  // Strip all leading blank lines from the text after the block
  let after = content.slice(end);
  // Remove leading newlines (including blank lines immediately after the fence)
  after = after.replace(/^(\r?\n)+/, '');

  let result: string;
  if (before === '' && after === '') {
    result = '';
  } else if (before === '') {
    // Block was at start; after content becomes the full result
    result = after;
  } else if (after === '') {
    // Block was at end; before content becomes the full result
    result = before;
  } else {
    // Block was in the middle — join with a single blank line
    result = before + '\n\n' + after;
  }

  // Normalize: collapse any runs of 3+ newlines down to 2
  result = result.replace(/\n{3,}/g, '\n\n');

  return result;
}

/**
 * Returns the ids of sections in `existing` whose inner content hash differs
 * from storedChecksums[relativePath + ':' + id]. Missing stored hash → not edited.
 */
export function inspectSections(
  relativePath: string,
  existing: string,
  storedChecksums: ChecksumMap
): string[] {
  const sections = parseSections(existing);
  const editedIds: string[] = [];

  for (const { id, inner } of sections) {
    const storedKey = `${relativePath}:${id}`;
    const storedHash = storedChecksums[storedKey];
    if (!storedHash) {
      // No stored hash — treat as not edited
      continue;
    }
    if (hashContent(inner) !== storedHash) {
      editedIds.push(id);
    }
  }

  return editedIds;
}
