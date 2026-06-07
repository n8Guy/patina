import { describe, it, expect } from 'vitest';
import { migrateClaudeMd, detectOldLayout } from '../migrate-claude.js';
import { parseSections, renderSection } from '../sections.js';
import { hashContent } from '../checksums.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

// Minimal profile section inner content
const PROFILE_INNER = '## Who you\'re working with\n\n**Name:** Jane Doe';

// The unfenced patina-owned prose block (the body that becomes patina:guide)
const GUIDE_PROSE = `## What patina is

Patina is a personal knowledge base.

## Folder structure

\`\`\`
graph/
  notes/
\`\`\`

## The inbox

Drop files here.

## How it works

Run /add to capture.

## Rules that always apply

- Never invent.

## On session start

Scan the graph.

> What are we working on today?`;

// A static (old-style unfenced) slash commands section
const STATIC_SLASH_COMMANDS = `## Slash commands

This table is regenerated whenever you install or update patina, so it always reflects the commands you actually have — including any from installed modules.

| Command | Description |
|---------|-------------|
| /add    | Add a note  |`;

// A static modules heading
const STATIC_MODULES_HEADING = `## Modules`;

// Commands fence inner content
const COMMANDS_INNER = '| Command | Description |\n|---------|-------------|\n| /add    | Add a note  |';

// Modules fence inner content
const MODULES_INNER = 'See .claude/modules/ for installed modules.';

// Build a pre-#117 old-layout CLAUDE.md (profile + modules fences, no commands fence)
// Unfenced guide prose + static slash commands + unfenced modules heading sit between fences.
function makePreV117Layout(): string {
  return [
    '# CLAUDE.md',
    '',
    'This file is loaded automatically.',
    '',
    renderSection('profile', PROFILE_INNER),
    '',
    GUIDE_PROSE,
    '',
    STATIC_SLASH_COMMANDS,
    '',
    STATIC_MODULES_HEADING,
    '',
    renderSection('modules', MODULES_INNER),
  ].join('\n');
}

// Build a post-#117 old-layout CLAUDE.md (profile + commands + modules fences)
// The two-table orphan case: stale unfenced "## Slash commands" heading+intro sits before the
// commands fence, and the commands fence exists. Old guide prose is still unfenced.
function makePostV117Layout(): string {
  return [
    '# CLAUDE.md',
    '',
    'This file is loaded automatically.',
    '',
    renderSection('profile', PROFILE_INNER),
    '',
    GUIDE_PROSE,
    '',
    STATIC_SLASH_COMMANDS,
    '',
    renderSection('commands', COMMANDS_INNER),
    '',
    STATIC_MODULES_HEADING,
    '',
    renderSection('modules', MODULES_INNER),
  ].join('\n');
}

// Build an already-migrated CLAUDE.md (has patina:guide fence)
function makeAlreadyMigratedLayout(): string {
  return [
    '# CLAUDE.md',
    '',
    'This file is loaded automatically.',
    '',
    renderSection('profile', PROFILE_INNER),
    '',
    renderSection('guide', GUIDE_PROSE),
    '',
    renderSection('commands', COMMANDS_INNER),
    '',
    renderSection('modules', MODULES_INNER),
  ].join('\n');
}

// ── Pre-#117 install migration ────────────────────────────────────────────────

describe('migrateClaudeMd — pre-#117 install (no commands fence)', () => {
  it('returns migrated=true', () => {
    const { migrated } = migrateClaudeMd(makePreV117Layout(), {});
    expect(migrated).toBe(true);
  });

  it('removes the old unfenced guide prose', () => {
    const { content } = migrateClaudeMd(makePreV117Layout(), {});
    // The guide prose should be gone (migration inserts EMPTY placeholders for mergeSections to fill)
    // "## What patina is" should not appear in the result at all
    expect(content).not.toContain('## What patina is');
    expect(content).not.toContain('## On session start');
    expect(content).not.toContain('## Rules that always apply');
  });

  it('inserts a guide placeholder fence', () => {
    const { content } = migrateClaudeMd(makePreV117Layout(), {});
    expect(content).toContain('<!-- patina:guide:start -->');
    expect(content).toContain('<!-- patina:guide:end -->');
  });

  it('inserts a commands placeholder fence (missing in pre-#117)', () => {
    const { content } = migrateClaudeMd(makePreV117Layout(), {});
    expect(content).toContain('<!-- patina:commands:start -->');
    expect(content).toContain('<!-- patina:commands:end -->');
  });

  it('preserves the existing modules fence', () => {
    const { content } = migrateClaudeMd(makePreV117Layout(), {});
    expect(content).toContain('<!-- patina:modules:start -->');
    expect(content).toContain(MODULES_INNER);
  });

  it('removes the static slash commands table from outside fences', () => {
    const { content } = migrateClaudeMd(makePreV117Layout(), {});
    const sections = parseSections(content);
    const fenceRanges = sections.map(s => ({ start: s.start, end: s.end }));
    // Static slash commands heading should not appear outside a fence
    const allSlashHeadingIdxs: number[] = [];
    let searchFrom = 0;
    while (true) {
      const idx = content.indexOf('## Slash commands', searchFrom);
      if (idx === -1) break;
      allSlashHeadingIdxs.push(idx);
      searchFrom = idx + 1;
    }
    // Any occurrence should be inside a fence
    for (const idx of allSlashHeadingIdxs) {
      expect(fenceRanges.some(r => idx >= r.start && idx < r.end)).toBe(true);
    }
  });

  it('inserts guide placeholder before commands placeholder before modules', () => {
    const { content } = migrateClaudeMd(makePreV117Layout(), {});
    const guideStart = content.indexOf('<!-- patina:guide:start -->');
    const commandsStart = content.indexOf('<!-- patina:commands:start -->');
    const modulesStart = content.indexOf('<!-- patina:modules:start -->');
    expect(guideStart).toBeLessThan(commandsStart);
    expect(commandsStart).toBeLessThan(modulesStart);
  });

  it('does not produce 3+ consecutive newlines', () => {
    const { content } = migrateClaudeMd(makePreV117Layout(), {});
    expect(content).not.toMatch(/\n{3,}/);
  });
});

// ── Post-#117 install (two-table orphan case) ─────────────────────────────────

describe('migrateClaudeMd — post-#117 install (two-table orphan)', () => {
  it('returns migrated=true', () => {
    const { migrated } = migrateClaudeMd(makePostV117Layout(), {});
    expect(migrated).toBe(true);
  });

  it('inserts a guide placeholder fence', () => {
    const { content } = migrateClaudeMd(makePostV117Layout(), {});
    expect(content).toContain('<!-- patina:guide:start -->');
  });

  it('preserves the existing commands fence (not removed)', () => {
    const { content } = migrateClaudeMd(makePostV117Layout(), {});
    expect(content).toContain('<!-- patina:commands:start -->');
    expect(content).toContain('<!-- patina:commands:end -->');
    const sections = parseSections(content);
    const cmdSection = sections.find(s => s.id === 'commands');
    expect(cmdSection).toBeDefined();
  });

  it('removes the stale unfenced ## Slash commands heading+intro before the commands fence', () => {
    const { content } = migrateClaudeMd(makePostV117Layout(), {});
    const sections = parseSections(content);
    const fenceRanges = sections.map(s => ({ start: s.start, end: s.end }));
    // Count occurrences of "## Slash commands" outside any fence
    let outsideCount = 0;
    let searchFrom = 0;
    while (true) {
      const idx = content.indexOf('## Slash commands', searchFrom);
      if (idx === -1) break;
      if (fenceRanges.every(r => idx < r.start || idx >= r.end)) {
        outsideCount++;
      }
      searchFrom = idx + 1;
    }
    expect(outsideCount).toBe(0);
  });

  it('has exactly one commands fence in the result', () => {
    const { content } = migrateClaudeMd(makePostV117Layout(), {});
    const sections = parseSections(content);
    const commandsSections = sections.filter(s => s.id === 'commands');
    expect(commandsSections).toHaveLength(1);
  });

  it('does not duplicate the commands table content', () => {
    const { content } = migrateClaudeMd(makePostV117Layout(), {});
    // The commands fence inner content should appear once
    const occurrences = content.split(COMMANDS_INNER).length - 1;
    expect(occurrences).toBe(1);
  });

  it('guide fence placeholder appears before commands fence in output', () => {
    const { content } = migrateClaudeMd(makePostV117Layout(), {});
    const guideStart = content.indexOf('<!-- patina:guide:start -->');
    const commandsStart = content.indexOf('<!-- patina:commands:start -->');
    expect(guideStart).toBeLessThan(commandsStart);
  });

  it('leaves exactly one blank line between the guide placeholder and the commands fence', () => {
    const { content } = migrateClaudeMd(makePostV117Layout(), {});
    const seam = content.slice(
      content.indexOf('<!-- patina:guide:end -->'),
      content.indexOf('<!-- patina:commands:start -->') + '<!-- patina:commands:start -->'.length,
    );
    expect(seam).toBe('<!-- patina:guide:end -->\n\n<!-- patina:commands:start -->');
  });
});

// ── Already migrated — idempotency ────────────────────────────────────────────

describe('migrateClaudeMd — already migrated (guide fence present)', () => {
  it('returns migrated=false', () => {
    const { migrated } = migrateClaudeMd(makeAlreadyMigratedLayout(), {});
    expect(migrated).toBe(false);
  });

  it('returns content byte-identical to input', () => {
    const input = makeAlreadyMigratedLayout();
    const { content } = migrateClaudeMd(input, {});
    expect(content).toBe(input);
  });
});

// ── Idempotency — running twice equals running once ───────────────────────────

describe('migrateClaudeMd — idempotency', () => {
  it('running twice on pre-#117 layout equals running once', () => {
    const input = makePreV117Layout();
    const { content: first } = migrateClaudeMd(input, {});
    const { content: second, migrated: secondMigrated } = migrateClaudeMd(first, {});
    expect(secondMigrated).toBe(false);
    expect(second).toBe(first);
  });

  it('running twice on post-#117 layout equals running once', () => {
    const input = makePostV117Layout();
    const { content: first } = migrateClaudeMd(input, {});
    const { content: second, migrated: secondMigrated } = migrateClaudeMd(first, {});
    expect(secondMigrated).toBe(false);
    expect(second).toBe(first);
  });
});

// ── Heavily customized file — signature headings absent ───────────────────────

describe('migrateClaudeMd — heavily customized (signature headings absent)', () => {
  it('returns migrated=false when signature headings are absent', () => {
    const customized = [
      renderSection('profile', PROFILE_INNER),
      '',
      '## My custom section',
      '',
      'I rewrote everything.',
      '',
      renderSection('modules', MODULES_INNER),
    ].join('\n');
    const { migrated } = migrateClaudeMd(customized, {});
    expect(migrated).toBe(false);
  });

  it('returns content unchanged when heavily customized', () => {
    const customized = [
      renderSection('profile', PROFILE_INNER),
      '',
      '## My custom section',
      '',
      renderSection('modules', MODULES_INNER),
    ].join('\n');
    const { content } = migrateClaudeMd(customized, {});
    expect(content).toBe(customized);
  });
});

// ── Non-destructive guard — user-edited fenced section ───────────────────────

describe('migrateClaudeMd — non-destructive guard (user-edited sections)', () => {
  it('returns migrated=false when profile section is user-edited', () => {
    const layout = makePreV117Layout();
    const sections = parseSections(layout);
    const profileSection = sections.find(s => s.id === 'profile')!;
    // Store a different checksum to simulate user edit
    const stored = { 'CLAUDE.md:profile': hashContent('original profile content') };
    const { migrated } = migrateClaudeMd(layout, stored);
    expect(migrated).toBe(false);
  });

  it('returns content unchanged when guard trips', () => {
    const layout = makePreV117Layout();
    const stored = { 'CLAUDE.md:profile': hashContent('original profile content') };
    const { content } = migrateClaudeMd(layout, stored);
    expect(content).toBe(layout);
  });

  it('proceeds when no stored checksums (no user edits possible)', () => {
    const { migrated } = migrateClaudeMd(makePreV117Layout(), {});
    expect(migrated).toBe(true);
  });

  it('proceeds when stored checksums match current content (not user-edited)', () => {
    const layout = makePreV117Layout();
    const sections = parseSections(layout);
    const profileSection = sections.find(s => s.id === 'profile')!;
    const stored = { 'CLAUDE.md:profile': hashContent(profileSection.inner) };
    const { migrated } = migrateClaudeMd(layout, stored);
    expect(migrated).toBe(true);
  });
});

// ── User content after modules/launch fences is preserved ────────────────────

describe('migrateClaudeMd — user content after modules fence preserved', () => {
  it('preserves user text appended after the modules fence', () => {
    const layout = makePreV117Layout() + '\n\n## My notes\n\nSome personal notes I added.\n';
    const { content } = migrateClaudeMd(layout, {});
    expect(content).toContain('## My notes');
    expect(content).toContain('Some personal notes I added.');
  });
});

// ── CRLF fixture ──────────────────────────────────────────────────────────────

describe('migrateClaudeMd — CRLF line endings', () => {
  it('migrates without corrupting the seam on CRLF input', () => {
    const lfLayout = makePreV117Layout();
    const crlfLayout = lfLayout.replace(/\n/g, '\r\n');
    const { content, migrated } = migrateClaudeMd(crlfLayout, {});
    expect(migrated).toBe(true);
    // Result should contain CRLF (not converted to LF)
    expect(content).toContain('\r\n');
    // Should have guide fence
    expect(content).toContain('<!-- patina:guide:start -->');
    // Should not have 3+ consecutive CRLF
    expect(content).not.toMatch(/(\r\n){3,}/);
  });
});

// ── Malformed / unclosed fences ───────────────────────────────────────────────

describe('migrateClaudeMd — malformed fences', () => {
  it('returns no-op when existing file has only a start marker (malformed)', () => {
    const malformed = '<!-- patina:profile:start -->\nsome content\n\n## What patina is\n\nsome text';
    const { migrated } = migrateClaudeMd(malformed, {});
    // parseSections ignores start-without-end, so no fences → no migration
    expect(migrated).toBe(false);
  });
});

// ── Fence-free file ───────────────────────────────────────────────────────────

describe('migrateClaudeMd — fence-free file', () => {
  it('returns no-op for a completely fence-free file', () => {
    const fenceFree = '# CLAUDE.md\n\nThis is a plain file.\n\n## What patina is\n\nSome text.\n\n## On session start\n\nStart stuff.';
    const { migrated } = migrateClaudeMd(fenceFree, {});
    expect(migrated).toBe(false);
  });
});

// ── EOF-appended slash-commands orphan with trailing user content ─────────────

// commands fence + modules fence in canonical order, then a static "## Slash commands"
// table appended at EOF (the literal #117 append-at-EOF orphan), then user notes after it.
function makeEofOrphanWithUserContent(): string {
  return [
    '# CLAUDE.md',
    '',
    'This file is loaded automatically.',
    '',
    renderSection('profile', PROFILE_INNER),
    '',
    GUIDE_PROSE,
    '',
    renderSection('commands', COMMANDS_INNER),
    '',
    STATIC_MODULES_HEADING,
    '',
    renderSection('modules', MODULES_INNER),
    '',
    STATIC_SLASH_COMMANDS,
    '',
    '## My notes',
    '',
    'Personal notes after the orphan table.',
  ].join('\n');
}

describe('migrateClaudeMd — EOF orphan with trailing user content', () => {
  it('removes the EOF slash-commands orphan but preserves trailing user content', () => {
    const { content, migrated } = migrateClaudeMd(makeEofOrphanWithUserContent(), {});
    expect(migrated).toBe(true);
    // The user notes after the orphan survive.
    expect(content).toContain('## My notes');
    expect(content).toContain('Personal notes after the orphan table.');
    // No "## Slash commands" heading remains outside a fence.
    const sections = parseSections(content);
    const fenceRanges = sections.map(s => ({ start: s.start, end: s.end }));
    let outsideCount = 0;
    let searchFrom = 0;
    while (true) {
      const idx = content.indexOf('## Slash commands', searchFrom);
      if (idx === -1) break;
      if (fenceRanges.every(r => idx < r.start || idx >= r.end)) outsideCount++;
      searchFrom = idx + 1;
    }
    expect(outsideCount).toBe(0);
    // The commands fence is retained exactly once.
    expect(sections.filter(s => s.id === 'commands')).toHaveLength(1);
  });
});

// ── detectOldLayout — shared three-way classifier ─────────────────────────────

describe('detectOldLayout', () => {
  it('classifies a clean pre-#117 layout as old-clean', () => {
    expect(detectOldLayout(makePreV117Layout(), {})).toBe('old-clean');
  });

  it('classifies an already-migrated file as none', () => {
    expect(detectOldLayout(makeAlreadyMigratedLayout(), {})).toBe('none');
  });

  it('classifies a fence-free file as none', () => {
    expect(detectOldLayout('# CLAUDE.md\n\nplain.', {})).toBe('none');
  });

  it('returns skipped-edited when a guarded fence is user-edited', () => {
    const layout = makePreV117Layout();
    // Stored checksum for profile that does NOT match current inner → looks user-edited.
    const stored = { 'CLAUDE.md:profile': hashContent('something else entirely') };
    expect(detectOldLayout(layout, stored)).toBe('skipped-edited');
  });
});
