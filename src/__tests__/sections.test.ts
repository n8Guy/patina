import { describe, it, expect } from 'vitest';
import { hasFences, hasPlaceholders, parseSections, renderSection, mergeSections, inspectSections, removeSection } from '../sections.js';
import { hashContent } from '../checksums.js';

// ── hasPlaceholders ───────────────────────────────────────────────────────────

describe('hasPlaceholders', () => {
  it('returns false for content without placeholders', () => {
    expect(hasPlaceholders('')).toBe(false);
    expect(hasPlaceholders('Hello world')).toBe(false);
    expect(hasPlaceholders('<!-- patina:profile:start -->')).toBe(false);
    expect(hasPlaceholders('Jane Doe — Senior Designer')).toBe(false);
  });

  it('returns true for content with uppercase template tokens', () => {
    expect(hasPlaceholders('Hello {{USER_NAME}}')).toBe(true);
    expect(hasPlaceholders('**Company:** {{COMPANY_NAME}}')).toBe(true);
  });

  it('returns false for lowercase or mixed-case tokens', () => {
    expect(hasPlaceholders('{{userName}}')).toBe(false);
    expect(hasPlaceholders('{{user_name}}')).toBe(false);
  });

  it('returns false for patina fence ids (not uppercase)', () => {
    expect(hasPlaceholders('<!-- patina:profile:start -->\ncontent\n<!-- patina:profile:end -->')).toBe(false);
  });
});

// ── mergeSections — placeholder bypass ───────────────────────────────────────

describe('mergeSections — placeholder bypass', () => {
  it('overwrites a section whose inner content has unrendered placeholders', () => {
    const corruptInner = '**Name:** {{USER_NAME}}';
    const existing = [
      '<!-- patina:profile:start -->',
      corruptInner,
      '<!-- patina:profile:end -->',
    ].join('\n');

    const { content, sections } = mergeSections(
      existing,
      { profile: 'Jane Doe' },
      { 'CLAUDE.md:profile': hashContent('original content') },
      'CLAUDE.md',
      new Set()
    );

    // Should update, not skip — placeholder presence overrides user-edit detection
    expect(sections[0].outcome).toBe('updated');
    expect(content).toContain('Jane Doe');
    expect(content).not.toContain('{{USER_NAME}}');
  });

  it('still skips user-edited sections without placeholders', () => {
    const userEditedInner = 'I changed this myself (no placeholders)';
    const existing = [
      '<!-- patina:profile:start -->',
      userEditedInner,
      '<!-- patina:profile:end -->',
    ].join('\n');

    const { sections } = mergeSections(
      existing,
      { profile: 'wizard content' },
      { 'CLAUDE.md:profile': hashContent('original content') },
      'CLAUDE.md',
      new Set()
    );

    expect(sections[0].outcome).toBe('skipped');
  });
});

// ── hasFences ─────────────────────────────────────────────────────────────────

describe('hasFences', () => {
  it('returns false for fence-free content', () => {
    expect(hasFences('Hello world')).toBe(false);
    expect(hasFences('')).toBe(false);
    expect(hasFences('# Some markdown\n\nWith paragraphs.')).toBe(false);
  });

  it('returns false when start marker has no matching end', () => {
    expect(hasFences('<!-- patina:profile:start -->\nsome content')).toBe(false);
  });

  it('returns true when a complete fence pair is present', () => {
    const content = '<!-- patina:profile:start -->\nhello\n<!-- patina:profile:end -->';
    expect(hasFences(content)).toBe(true);
  });

  it('returns true when fences are embedded in longer content', () => {
    const content = [
      '# Preamble',
      '',
      '<!-- patina:profile:start -->',
      'inner',
      '<!-- patina:profile:end -->',
      '',
      'After the fence.',
    ].join('\n');
    expect(hasFences(content)).toBe(true);
  });
});

// ── parseSections ─────────────────────────────────────────────────────────────

describe('parseSections', () => {
  it('returns empty array for content with no fences', () => {
    expect(parseSections('no fences here')).toEqual([]);
    expect(parseSections('')).toEqual([]);
  });

  it('parses a single section correctly', () => {
    const content = '<!-- patina:profile:start -->\nhello world\n<!-- patina:profile:end -->';
    const sections = parseSections(content);
    expect(sections).toHaveLength(1);
    expect(sections[0].id).toBe('profile');
    expect(sections[0].inner).toBe('hello world');
  });

  it('sets start and end indices correctly', () => {
    const content = '<!-- patina:profile:start -->\nhello\n<!-- patina:profile:end -->';
    const sections = parseSections(content);
    expect(sections[0].start).toBe(0);
    expect(sections[0].end).toBe(content.length);
  });

  it('parses multiple sections', () => {
    const content = [
      '<!-- patina:profile:start -->',
      'profile content',
      '<!-- patina:profile:end -->',
      '',
      '<!-- patina:skills:start -->',
      'skills content',
      '<!-- patina:skills:end -->',
    ].join('\n');

    const sections = parseSections(content);
    expect(sections).toHaveLength(2);
    expect(sections[0].id).toBe('profile');
    expect(sections[0].inner).toBe('profile content');
    expect(sections[1].id).toBe('skills');
    expect(sections[1].inner).toBe('skills content');
  });

  it('normalizes CRLF to LF in inner content', () => {
    const content = '<!-- patina:profile:start -->\r\nhello\r\nworld\r\n<!-- patina:profile:end -->';
    const sections = parseSections(content);
    expect(sections).toHaveLength(1);
    expect(sections[0].inner).toBe('hello\nworld');
  });

  it('ignores a start marker with no matching end', () => {
    const content = '<!-- patina:profile:start -->\nsome content';
    expect(parseSections(content)).toHaveLength(0);
  });

  it('ignores an end marker with no matching start', () => {
    const content = 'some content\n<!-- patina:profile:end -->';
    expect(parseSections(content)).toHaveLength(0);
  });

  it('handles multiline inner content', () => {
    const content = [
      '<!-- patina:profile:start -->',
      'line one',
      'line two',
      'line three',
      '<!-- patina:profile:end -->',
    ].join('\n');
    const sections = parseSections(content);
    expect(sections[0].inner).toBe('line one\nline two\nline three');
  });

  it('parses ids with hyphens and numbers', () => {
    const content = '<!-- patina:my-section-1:start -->\ncontent\n<!-- patina:my-section-1:end -->';
    const sections = parseSections(content);
    expect(sections[0].id).toBe('my-section-1');
  });
});

// ── renderSection ─────────────────────────────────────────────────────────────

describe('renderSection', () => {
  it('produces correct format with start and end markers', () => {
    const result = renderSection('profile', 'inner content');
    expect(result).toBe(
      '<!-- patina:profile:start -->\ninner content\n<!-- patina:profile:end -->'
    );
  });

  it('round-trips through parseSections', () => {
    const inner = 'some\nmultiline\ncontent';
    const rendered = renderSection('profile', inner);
    const parsed = parseSections(rendered);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].id).toBe('profile');
    expect(parsed[0].inner).toBe(inner);
  });
});

// ── mergeSections ─────────────────────────────────────────────────────────────

describe('mergeSections', () => {
  it('replaces a section when overwrite set contains its id', () => {
    const existing = [
      'Before.',
      '<!-- patina:profile:start -->',
      'old content',
      '<!-- patina:profile:end -->',
      'After.',
    ].join('\n');

    const { content, sections } = mergeSections(
      existing,
      { profile: 'new content' },
      { 'CLAUDE.md:profile': hashContent('old content') },
      'CLAUDE.md',
      new Set(['profile'])
    );

    expect(content).toContain('new content');
    expect(content).not.toContain('old content');
    expect(sections[0].outcome).toBe('updated');
  });

  it('skips a user-edited section (hash differs from stored) when NOT in overwrite', () => {
    const userEditedInner = 'user edited this';
    const originalHash = hashContent('original content');

    const existing = [
      '<!-- patina:profile:start -->',
      userEditedInner,
      '<!-- patina:profile:end -->',
    ].join('\n');

    const { content, sections } = mergeSections(
      existing,
      { profile: 'wizard wants to write this' },
      { 'CLAUDE.md:profile': originalHash },
      'CLAUDE.md',
      new Set()
    );

    // Content should be unchanged (skipped)
    expect(content).toContain(userEditedInner);
    expect(content).not.toContain('wizard wants to write this');
    expect(sections[0].outcome).toBe('skipped');
    expect(sections[0].newChecksum).toBe(originalHash); // preserved stored checksum
  });

  it('updates a wizard-unmodified section (hash matches stored)', () => {
    const existingInner = 'original content';

    const existing = [
      '<!-- patina:profile:start -->',
      existingInner,
      '<!-- patina:profile:end -->',
    ].join('\n');

    const { content, sections } = mergeSections(
      existing,
      { profile: 'new wizard content' },
      { 'CLAUDE.md:profile': hashContent(existingInner) },
      'CLAUDE.md',
      new Set()
    );

    expect(content).toContain('new wizard content');
    expect(content).not.toContain(existingInner);
    expect(sections[0].outcome).toBe('updated');
    expect(sections[0].newChecksum).toBe(hashContent('new wizard content'));
  });

  it('updates a section with no stored checksum (treats as unmodified)', () => {
    const existing = [
      '<!-- patina:profile:start -->',
      'some content',
      '<!-- patina:profile:end -->',
    ].join('\n');

    const { content, sections } = mergeSections(
      existing,
      { profile: 'new content' },
      {},  // no stored checksum
      'CLAUDE.md',
      new Set()
    );

    expect(content).toContain('new content');
    expect(sections[0].outcome).toBe('updated');
  });

  it('appends a new section not present in the existing file', () => {
    const existing = 'Some existing text without fences.\n';

    const { content, sections } = mergeSections(
      existing,
      { profile: 'brand new profile section' },
      {},
      'CLAUDE.md',
      new Set()
    );

    expect(content).toContain('Some existing text without fences.');
    expect(content).toContain('<!-- patina:profile:start -->');
    expect(content).toContain('brand new profile section');
    expect(content).toContain('<!-- patina:profile:end -->');
    expect(sections[0].outcome).toBe('added');
  });

  it('leaves sections not in newSections unchanged', () => {
    const existingInner = 'existing skills content';
    const existing = [
      '<!-- patina:profile:start -->',
      'profile content',
      '<!-- patina:profile:end -->',
      '',
      '<!-- patina:skills:start -->',
      existingInner,
      '<!-- patina:skills:end -->',
    ].join('\n');

    const { content, sections } = mergeSections(
      existing,
      { profile: 'updated profile' },
      { 'CLAUDE.md:profile': hashContent('profile content'), 'CLAUDE.md:skills': hashContent(existingInner) },
      'CLAUDE.md',
      new Set()
    );

    expect(content).toContain(existingInner);
    const skillsOutcome = sections.find(s => s.id === 'skills');
    expect(skillsOutcome?.outcome).toBe('unchanged');
    expect(skillsOutcome?.newChecksum).toBe(hashContent(existingInner));
  });

  it('preserves all out-of-fence text exactly (before, between, after)', () => {
    const existing = [
      'Text before first fence.',
      '<!-- patina:profile:start -->',
      'profile content',
      '<!-- patina:profile:end -->',
      'Text between fences.',
      '<!-- patina:skills:start -->',
      'skills content',
      '<!-- patina:skills:end -->',
      'Text after last fence.',
    ].join('\n');

    const { content } = mergeSections(
      existing,
      { profile: 'new profile', skills: 'new skills' },
      {
        'CLAUDE.md:profile': hashContent('profile content'),
        'CLAUDE.md:skills': hashContent('skills content'),
      },
      'CLAUDE.md',
      new Set()
    );

    expect(content).toContain('Text before first fence.');
    expect(content).toContain('Text between fences.');
    expect(content).toContain('Text after last fence.');
    expect(content).toContain('new profile');
    expect(content).toContain('new skills');
  });

  it('fills inner content into a pre-existing EMPTY guide placeholder in place (not appended)', () => {
    // This simulates the post-migration state: guide is present but empty; mergeSections
    // should replace its inner content in place rather than appending at EOF.
    const existing = [
      '<!-- patina:profile:start -->',
      'profile content',
      '<!-- patina:profile:end -->',
      '',
      '<!-- patina:guide:start -->',
      '',
      '<!-- patina:guide:end -->',
      '',
      '<!-- patina:modules:start -->',
      'modules content',
      '<!-- patina:modules:end -->',
    ].join('\n');

    const { content, sections } = mergeSections(
      existing,
      { guide: 'new guide content', profile: 'profile content', modules: 'modules content' },
      { 'CLAUDE.md:profile': hashContent('profile content'), 'CLAUDE.md:modules': hashContent('modules content') },
      'CLAUDE.md',
      new Set()
    );

    const guideOutcome = sections.find(s => s.id === 'guide');
    expect(guideOutcome?.outcome).toBe('updated');
    expect(content).toContain('new guide content');

    // Guide should appear before modules in the file (not appended at EOF)
    const guidePos = content.indexOf('<!-- patina:guide:start -->');
    const modulesPos = content.indexOf('<!-- patina:modules:start -->');
    expect(guidePos).toBeLessThan(modulesPos);

    // Guide should NOT be appended at the end after modules
    const lastModulesEnd = content.lastIndexOf('<!-- patina:modules:end -->');
    const lastGuideStart = content.lastIndexOf('<!-- patina:guide:start -->');
    expect(lastGuideStart).toBeLessThan(lastModulesEnd);
  });
}); // end describe('mergeSections')

// ── inspectSections ───────────────────────────────────────────────────────────

describe('inspectSections', () => {
  it('returns empty array when no sections are user-edited', () => {
    const inner = 'profile content';
    const existing = [
      '<!-- patina:profile:start -->',
      inner,
      '<!-- patina:profile:end -->',
    ].join('\n');

    const result = inspectSections(
      'CLAUDE.md',
      existing,
      { 'CLAUDE.md:profile': hashContent(inner) }
    );
    expect(result).toEqual([]);
  });

  it('returns edited section ids when content differs from stored hash', () => {
    const existing = [
      '<!-- patina:profile:start -->',
      'user edited this content',
      '<!-- patina:profile:end -->',
    ].join('\n');

    const result = inspectSections(
      'CLAUDE.md',
      existing,
      { 'CLAUDE.md:profile': hashContent('original content') }
    );
    expect(result).toContain('profile');
  });

  it('treats missing stored checksum as not-edited', () => {
    const existing = [
      '<!-- patina:profile:start -->',
      'some content',
      '<!-- patina:profile:end -->',
    ].join('\n');

    const result = inspectSections('CLAUDE.md', existing, {});
    expect(result).toEqual([]);
  });

  it('returns only the ids of sections that were edited', () => {
    const profileInner = 'original profile';
    const skillsInner = 'user edited skills';

    const existing = [
      '<!-- patina:profile:start -->',
      profileInner,
      '<!-- patina:profile:end -->',
      '',
      '<!-- patina:skills:start -->',
      skillsInner,
      '<!-- patina:skills:end -->',
    ].join('\n');

    const result = inspectSections(
      'CLAUDE.md',
      existing,
      {
        'CLAUDE.md:profile': hashContent(profileInner),
        'CLAUDE.md:skills': hashContent('original skills'), // skills was edited
      }
    );
    expect(result).not.toContain('profile');
    expect(result).toContain('skills');
  });

  it('returns empty array for fence-free content', () => {
    const result = inspectSections('CLAUDE.md', 'no fences here', {});
    expect(result).toEqual([]);
  });
});

// ── removeSection ─────────────────────────────────────────────────────────────

describe('removeSection', () => {
  it('removes a single block and leaves surrounding text intact', () => {
    const content = [
      'Before the fence.',
      '<!-- patina:linkedin:start -->',
      'linkedin content',
      '<!-- patina:linkedin:end -->',
      'After the fence.',
    ].join('\n');

    const result = removeSection('linkedin', content);
    expect(result).toContain('Before the fence.');
    expect(result).toContain('After the fence.');
    expect(result).not.toContain('linkedin content');
    expect(result).not.toContain('patina:linkedin');
  });

  it('collapses seam to a single blank line when block is in the middle', () => {
    const content = [
      'Section A.',
      '',
      '<!-- patina:linkedin:start -->',
      'linkedin content',
      '<!-- patina:linkedin:end -->',
      '',
      'Section B.',
    ].join('\n');

    const result = removeSection('linkedin', content);
    expect(result).toContain('Section A.');
    expect(result).toContain('Section B.');
    // Should not have triple blank lines
    expect(result).not.toMatch(/\n{3,}/);
  });

  it('produces no trailing blank-line artifact when block is at end of file', () => {
    const content = [
      'Some content.',
      '',
      '<!-- patina:linkedin:start -->',
      'linkedin content',
      '<!-- patina:linkedin:end -->',
    ].join('\n');

    const result = removeSection('linkedin', content);
    expect(result).toContain('Some content.');
    expect(result).not.toContain('linkedin content');
    // No excessive trailing newlines
    expect(result).not.toMatch(/\n{2,}$/);
  });

  it('returns content unchanged when id is not present', () => {
    const content = 'Some text without any fences.';
    expect(removeSection('linkedin', content)).toBe(content);

    const fencedContent = [
      '<!-- patina:resume:start -->',
      'resume content',
      '<!-- patina:resume:end -->',
    ].join('\n');
    expect(removeSection('linkedin', fencedContent)).toBe(fencedContent);
  });

  it('handles block at start of file', () => {
    const content = [
      '<!-- patina:linkedin:start -->',
      'linkedin content',
      '<!-- patina:linkedin:end -->',
      '',
      'After content.',
    ].join('\n');

    const result = removeSection('linkedin', content);
    expect(result).toContain('After content.');
    expect(result).not.toContain('linkedin content');
  });

  it('handles only fence in file — preserves surrounding non-fence text', () => {
    const content = [
      '<!-- patina:linkedin:start -->',
      'linkedin content',
      '<!-- patina:linkedin:end -->',
    ].join('\n');

    const result = removeSection('linkedin', content);
    expect(result).not.toContain('patina:linkedin');
    expect(result).not.toContain('linkedin content');
  });

  it('round-trips: renderSection + mergeSections + removeSection returns to original', () => {
    const original = 'Base content.\n';
    const section = renderSection('linkedin', 'linkedin inner');

    // Merge to add the section
    const { content: withSection } = mergeSections(original, { linkedin: 'linkedin inner' }, {}, 'README.md', new Set());
    expect(withSection).toContain('linkedin inner');

    // Remove to get back to original
    const restored = removeSection('linkedin', withSection);
    // The restored content should contain the original text
    expect(restored).toContain('Base content.');
    expect(restored).not.toContain('linkedin inner');
  });
});
