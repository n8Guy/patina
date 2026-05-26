import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  extractWikiLinks,
  parseExclusions,
  listMarkdownFiles,
  checkSkillNotes,
  checkWikiLinks,
  checkExclusions,
  validate,
  findPatinaRoot,
} from '../validate.js';
import type { Profile } from '../types.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-validate-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ─── Helper to build a minimal Profile ────────────────────────────────────────

function makeProfile(contentDir = 'graph'): Profile {
  return {
    patina_name: 'test',
    name: 'Test User',
    work: { self_employed: false, company_name: 'Acme' },
    editor: 'vscode',
    modules: [],
    content_dir: contentDir,
    created: '2025-01-01',
  };
}

// ─── Helper to set up a patina skeleton ───────────────────────────────────────

function setupPatina(root: string, contentDir = 'graph'): void {
  writeFileSync(join(root, 'profile.yaml'), `patina_name: test\ncontent_dir: ${contentDir}\n`);
  mkdirSync(join(root, contentDir, 'notes'), { recursive: true });
  mkdirSync(join(root, contentDir, 'skills'), { recursive: true });
  mkdirSync(join(root, contentDir, 'posts'), { recursive: true });
}

// ─── extractWikiLinks ─────────────────────────────────────────────────────────

describe('extractWikiLinks', () => {
  it('returns empty array for content with no links', () => {
    expect(extractWikiLinks('No links here.')).toEqual([]);
  });

  it('extracts a single link', () => {
    const result = extractWikiLinks('See [[react]].');
    expect(result).toEqual([{ target: 'react', line: 1 }]);
  });

  it('extracts links from multiple lines with correct line numbers', () => {
    const content = 'First line\nSee [[react]].\nAlso [[typescript]].';
    const result = extractWikiLinks(content);
    expect(result).toEqual([
      { target: 'react', line: 2 },
      { target: 'typescript', line: 3 },
    ]);
  });

  it('strips alias portion after |', () => {
    const result = extractWikiLinks('[[react|React Framework]]');
    expect(result).toEqual([{ target: 'react', line: 1 }]);
  });

  it('strips heading portion after #', () => {
    const result = extractWikiLinks('[[react#hooks]]');
    expect(result).toEqual([{ target: 'react', line: 1 }]);
  });

  it('ignores empty targets', () => {
    const result = extractWikiLinks('[[]]');
    expect(result).toEqual([]);
  });

  it('does not match links inside fenced code blocks (backtick)', () => {
    const content = '```\n[[inside-code]]\n```\n[[outside-code]]';
    const result = extractWikiLinks(content);
    expect(result.map(r => r.target)).toEqual(['outside-code']);
  });

  it('does not match links inside fenced code blocks (tilde)', () => {
    const content = '~~~\n[[inside-code]]\n~~~\n[[outside-code]]';
    const result = extractWikiLinks(content);
    expect(result.map(r => r.target)).toEqual(['outside-code']);
  });
});

// ─── parseExclusions ──────────────────────────────────────────────────────────

describe('parseExclusions', () => {
  it('returns empty array for content with no table', () => {
    expect(parseExclusions('No table here.')).toEqual([]);
  });

  it('parses a two-item table', () => {
    const md = `| Item | Reason |\n|------|--------|\n| react | old |\n| angular | replaced |`;
    expect(parseExclusions(md)).toEqual(['react', 'angular']);
  });

  it('filters empty placeholder row | | |', () => {
    const md = `| Item | Reason |\n|------|--------|\n| | |`;
    expect(parseExclusions(md)).toEqual([]);
  });

  it('trims whitespace from items', () => {
    const md = `| Item | Reason |\n|------|--------|\n|  react  | old |`;
    expect(parseExclusions(md)).toEqual(['react']);
  });

  it('deduplicates items', () => {
    const md = `| Item | Reason |\n|------|--------|\n| react | old |\n| react | duplicate |`;
    expect(parseExclusions(md)).toEqual(['react']);
  });
});

// ─── listMarkdownFiles ────────────────────────────────────────────────────────

describe('listMarkdownFiles', () => {
  it('returns empty array for missing dir', () => {
    expect(listMarkdownFiles(join(tmp, 'nonexistent'))).toEqual([]);
  });

  it('finds .md files in top-level dir', () => {
    writeFileSync(join(tmp, 'a.md'), '');
    writeFileSync(join(tmp, 'b.md'), '');
    const result = listMarkdownFiles(tmp);
    expect(result).toHaveLength(2);
    expect(result.every(f => f.endsWith('.md'))).toBe(true);
  });

  it('ignores non-.md files', () => {
    writeFileSync(join(tmp, 'note.md'), '');
    writeFileSync(join(tmp, 'data.json'), '{}');
    const result = listMarkdownFiles(tmp);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatch(/note\.md$/);
  });

  it('recurses into subdirectories', () => {
    const sub = join(tmp, 'sub');
    mkdirSync(sub);
    writeFileSync(join(tmp, 'top.md'), '');
    writeFileSync(join(sub, 'nested.md'), '');
    const result = listMarkdownFiles(tmp);
    expect(result).toHaveLength(2);
  });
});

// ─── checkSkillNotes ─────────────────────────────────────────────────────────

describe('checkSkillNotes', () => {
  it('returns no issues when all linked notes exist', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/notes/react.md'), '# React');
    writeFileSync(join(tmp, 'graph/skills/frontend.md'), 'See [[react]].');
    expect(checkSkillNotes(tmp, profile)).toEqual([]);
  });

  it('returns an issue when a linked note is missing', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/skills/frontend.md'), 'See [[missing-note]].');
    const issues = checkSkillNotes(tmp, profile);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('Skill links to a note that doesn\'t exist: "missing-note"');
    expect(issues[0].line).toBe(1);
    expect(issues[0].file).toMatch(/skills\/frontend\.md$/);
    expect(issues[0].file).not.toContain('\\');
  });

  it('returns no issues when skills dir is empty', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    expect(checkSkillNotes(tmp, profile)).toEqual([]);
  });
});

// ─── checkWikiLinks ───────────────────────────────────────────────────────────

describe('checkWikiLinks', () => {
  it('returns no issues when all linked notes exist', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/notes/react.md'), '# React');
    writeFileSync(join(tmp, 'graph/notes/note-with-link.md'), 'See [[react]].');
    expect(checkWikiLinks(tmp, profile)).toEqual([]);
  });

  it('returns an issue for a broken link in a post', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/posts/my-post.md'), 'See [[nonexistent]].');
    const issues = checkWikiLinks(tmp, profile);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('Reference points to a note that doesn\'t exist: "nonexistent"');
    expect(issues[0].file).toMatch(/posts\/my-post\.md$/);
  });

  it('does not scan skills (to avoid double-reporting)', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    // A skill with a broken link — checkWikiLinks should NOT report it
    writeFileSync(join(tmp, 'graph/skills/frontend.md'), 'See [[missing]].');
    const issues = checkWikiLinks(tmp, profile);
    expect(issues).toEqual([]);
  });
});

// ─── checkExclusions ─────────────────────────────────────────────────────────

describe('checkExclusions', () => {
  it('returns no issues when exclusions.md is missing', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    expect(checkExclusions(tmp, profile)).toEqual([]);
  });

  it('returns no issues when exclusions table is empty placeholder', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/notes/exclusions.md'), '| Item | Reason |\n|------|--------|\n| | |\n');
    writeFileSync(join(tmp, 'graph/skills/frontend.md'), 'Anything here.');
    expect(checkExclusions(tmp, profile)).toEqual([]);
  });

  it('returns an issue when excluded item appears in a skill', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/notes/exclusions.md'), '| Item | Reason |\n|------|--------|\n| Angular | replaced |\n');
    writeFileSync(join(tmp, 'graph/skills/frontend.md'), 'I used Angular for years.');
    const issues = checkExclusions(tmp, profile);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toBe('Contains an excluded item ("Angular") that should not appear in generated content');
    expect(issues[0].file).toMatch(/skills\/frontend\.md$/);
  });

  it('returns an issue when excluded item appears in a post', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/notes/exclusions.md'), '| Item | Reason |\n|------|--------|\n| Angular | replaced |\n');
    writeFileSync(join(tmp, 'graph/posts/my-post.md'), 'We tried Angular.');
    const issues = checkExclusions(tmp, profile);
    expect(issues).toHaveLength(1);
    expect(issues[0].file).toMatch(/posts\/my-post\.md$/);
  });

  it('does not report excluded items found in notes/', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/notes/exclusions.md'), '| Item | Reason |\n|------|--------|\n| Angular | replaced |\n');
    // Another note containing the excluded item — should NOT be flagged
    writeFileSync(join(tmp, 'graph/notes/history.md'), 'Angular was popular.');
    expect(checkExclusions(tmp, profile)).toEqual([]);
  });

  it('deduplicates the same item appearing twice on one line', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/notes/exclusions.md'), '| Item | Reason |\n|------|--------|\n| Angular | replaced |\n');
    writeFileSync(join(tmp, 'graph/skills/frontend.md'), 'Angular and Angular everywhere.');
    const issues = checkExclusions(tmp, profile);
    // Same file:line:item combo — should be deduplicated to 1
    expect(issues).toHaveLength(1);
  });
});

// ─── validate (integration) ───────────────────────────────────────────────────

describe('validate', () => {
  it('returns ok=true for a healthy patina', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/notes/react.md'), '# React');
    writeFileSync(join(tmp, 'graph/skills/frontend.md'), 'See [[react]].');
    const result = validate(tmp, profile);
    expect(result.ok).toBe(true);
    expect(result.issues).toHaveLength(0);
    expect(result.filesChecked).toBeGreaterThan(0);
  });

  it('returns ok=false with exact issues for broken skill link + broken wiki-link + excluded items', () => {
    setupPatina(tmp);
    const profile = makeProfile();
    writeFileSync(join(tmp, 'graph/notes/exclusions.md'), '| Item | Reason |\n|------|--------|\n| OldTech | deprecated |\n');
    // checkSkillNotes: [[missing-note]] in skill → 1 issue
    writeFileSync(join(tmp, 'graph/skills/frontend.md'), 'See [[missing-note]]. Also OldTech.');
    // checkExclusions: OldTech in skill (1) + post (1) → 2 issues
    writeFileSync(join(tmp, 'graph/posts/my-post.md'), 'OldTech was used here. See [[no-such-note]].');
    // checkWikiLinks: [[no-such-note]] in post → 1 issue
    const result = validate(tmp, profile);
    expect(result.ok).toBe(false);
    expect(result.issues).toHaveLength(4);
    // All file paths must use forward slashes
    for (const issue of result.issues) {
      expect(issue.file).not.toContain('\\');
    }
  });
});

// ─── findPatinaRoot ───────────────────────────────────────────────────────────

describe('findPatinaRoot', () => {
  it('returns the cwd when profile.yaml is present', () => {
    writeFileSync(join(tmp, 'profile.yaml'), 'patina_name: test\n');
    expect(findPatinaRoot(tmp)).toBe(tmp);
  });

  it('returns null when profile.yaml is absent', () => {
    expect(findPatinaRoot(tmp)).toBeNull();
  });
});
