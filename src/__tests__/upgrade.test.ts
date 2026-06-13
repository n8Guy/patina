import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeManagedFile, writeSeedFile, isMarkedManaged, isLegacyManaged, mergeProfile } from '../upgrade.js';
import type { Profile } from '../types.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ── isMarkedManaged ───────────────────────────────────────────────────────────

describe('isMarkedManaged', () => {
  it('returns true for markdown with patina: managed frontmatter', () => {
    const md = '---\npatina: managed\n---\n# Hello';
    expect(isMarkedManaged('CLAUDE.md', md)).toBe(true);
  });

  it('returns false for markdown without patina marker', () => {
    const md = '# Hello world\nNo frontmatter.';
    expect(isMarkedManaged('CLAUDE.md', md)).toBe(false);
  });

  it('returns false for markdown with frontmatter but no patina: managed', () => {
    const md = '---\ntitle: My File\n---\n# Hello';
    expect(isMarkedManaged('CLAUDE.md', md)).toBe(false);
  });

  it('returns true for JSON with _patina: managed', () => {
    const json = JSON.stringify({ _patina: 'managed', foo: 'bar' }, null, 2);
    expect(isMarkedManaged('settings.json', json)).toBe(true);
  });

  it('returns false for JSON without _patina marker', () => {
    const json = JSON.stringify({ foo: 'bar' }, null, 2);
    expect(isMarkedManaged('settings.json', json)).toBe(false);
  });

  it('returns false for malformed JSON', () => {
    expect(isMarkedManaged('settings.json', 'not-json{')).toBe(false);
  });

  it('handles CRLF line endings in frontmatter', () => {
    const md = '---\r\npatina: managed\r\n---\r\n# Hello';
    expect(isMarkedManaged('CLAUDE.md', md)).toBe(true);
  });

  it('returns false for _patina with wrong value', () => {
    const json = JSON.stringify({ _patina: 'unmanaged' });
    expect(isMarkedManaged('file.json', json)).toBe(false);
  });

  it('returns true for .mjs file with // patina: managed on first line', () => {
    const mjs = '// patina: managed\n// Other comment\nimport { foo } from "bar";\n';
    expect(isMarkedManaged('check-update.mjs', mjs)).toBe(true);
  });

  it('returns false for .mjs file without the marker', () => {
    const mjs = '// Some other comment\nimport { foo } from "bar";\n';
    expect(isMarkedManaged('check-update.mjs', mjs)).toBe(false);
  });

  it('returns false for .mjs file with marker on second line', () => {
    const mjs = '// Header comment\n// patina: managed\nimport { foo } from "bar";\n';
    expect(isMarkedManaged('check-update.mjs', mjs)).toBe(false);
  });
});

// ── isLegacyManaged ───────────────────────────────────────────────────────────

describe('isLegacyManaged', () => {
  it('returns true for content with patina fence comments', () => {
    expect(isLegacyManaged('<!-- patina:profile:start -->\nhello\n<!-- patina:profile:end -->')).toBe(true);
  });

  it('returns false for content without fence comments', () => {
    expect(isLegacyManaged('# Just a plain file\nno fences here')).toBe(false);
  });
});

// ── writeManagedFile ──────────────────────────────────────────────────────────

describe('writeManagedFile', () => {
  it('adds a new file and returns outcome=added', () => {
    const content = '---\npatina: managed\n---\nhello';
    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', content);
    expect(outcome).toBe('added');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe(content);
  });

  it('overwrites a marked markdown file (updated)', () => {
    const original = '---\npatina: managed\n---\noriginal content';
    writeFileSync(join(tmp, 'CLAUDE.md'), original);

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', '---\npatina: managed\n---\nupdated content');
    expect(outcome).toBe('updated');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe('---\npatina: managed\n---\nupdated content');
  });

  it('skips an unmarked markdown file (user-owned)', () => {
    const userContent = '# My own file\nI wrote this myself.';
    writeFileSync(join(tmp, 'CLAUDE.md'), userContent);

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', '---\npatina: managed\n---\nnew content');
    expect(outcome).toBe('skipped');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe(userContent);
  });

  it('overwrites a marked JSON file (updated)', () => {
    const original = JSON.stringify({ _patina: 'managed', val: 1 }, null, 2) + '\n';
    writeFileSync(join(tmp, 'settings.json'), original);

    const updated = JSON.stringify({ _patina: 'managed', val: 2 }, null, 2) + '\n';
    const { outcome } = writeManagedFile(tmp, 'settings.json', updated);
    expect(outcome).toBe('updated');
    expect(readFileSync(join(tmp, 'settings.json'), 'utf8')).toBe(updated);
  });

  it('skips an unmarked JSON file (user-owned)', () => {
    const userContent = JSON.stringify({ foo: 'bar' }, null, 2) + '\n';
    writeFileSync(join(tmp, 'settings.json'), userContent);

    const { outcome } = writeManagedFile(tmp, 'settings.json', JSON.stringify({ _patina: 'managed' }, null, 2));
    expect(outcome).toBe('skipped');
    expect(readFileSync(join(tmp, 'settings.json'), 'utf8')).toBe(userContent);
  });

  it('overwrites a legacy fence-bearing file (convergence)', () => {
    const legacy = '# CLAUDE.md\n\n<!-- patina:profile:start -->\nold content\n<!-- patina:profile:end -->\n';
    writeFileSync(join(tmp, 'CLAUDE.md'), legacy);

    const newContent = '---\npatina: managed\n---\n# CLAUDE.md\nnew content';
    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', newContent);
    expect(outcome).toBe('updated');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe(newContent);
  });

  it('creates intermediate directories for nested paths', () => {
    const { outcome } = writeManagedFile(tmp, '.claude/commands/include.md', '---\npatina: managed\n---\ncontent');
    expect(outcome).toBe('added');
    expect(readFileSync(join(tmp, '.claude/commands/include.md'), 'utf8')).toBe('---\npatina: managed\n---\ncontent');
  });
});

// ── writeSeedFile ─────────────────────────────────────────────────────────────

describe('writeSeedFile', () => {
  it('writes a seed file if absent and returns added', () => {
    const outcome = writeSeedFile(tmp, 'CUSTOM.md', '# My Custom File\n');
    expect(outcome).toBe('added');
    expect(readFileSync(join(tmp, 'CUSTOM.md'), 'utf8')).toBe('# My Custom File\n');
  });

  it('skips writing if the file already exists', () => {
    const existing = '# User content\nI wrote this.';
    writeFileSync(join(tmp, 'CUSTOM.md'), existing);

    const outcome = writeSeedFile(tmp, 'CUSTOM.md', '# New content');
    expect(outcome).toBe('skipped');
    expect(readFileSync(join(tmp, 'CUSTOM.md'), 'utf8')).toBe(existing);
  });

  it('creates intermediate directories', () => {
    const outcome = writeSeedFile(tmp, 'inbox/.gitkeep', '');
    expect(outcome).toBe('added');
    expect(existsSync(join(tmp, 'inbox/.gitkeep'))).toBe(true);
  });
});

// ── mergeProfile ──────────────────────────────────────────────────────────────

const baseWork = {
  self_employed: false,
  company_name: 'Acme',
  website: 'https://acme.com',
  company_description: 'A company',
};

const baseProfile: Profile = {
  patina_name: 'my-patina',
  name: 'Jane Doe',
  title: 'Engineer',
  work: baseWork,
  editor: 'vscode',
  modules: ['linkedin'],
  content_dir: 'graph',
  created: '2026-01-01',
};

describe('mergeProfile', () => {
  it('preserves all existing top-level fields', () => {
    const merged = mergeProfile(baseProfile, {});
    expect(merged.name).toBe('Jane Doe');
    expect(merged.title).toBe('Engineer');
  });

  it('adds missing fields from incoming', () => {
    const existing = { ...baseProfile };
    delete (existing as Partial<Profile>).role_description;
    const merged = mergeProfile(existing, { role_description: 'Builds things' });
    expect(merged.role_description).toBe('Builds things');
  });

  it('does not overwrite existing values with incoming', () => {
    const merged = mergeProfile(baseProfile, { name: 'Overwritten' } as Partial<Profile>);
    expect(merged.name).toBe('Jane Doe');
  });

  it('preserves existing modules array', () => {
    const merged = mergeProfile(baseProfile, { modules: [] });
    expect(merged.modules).toEqual(['linkedin']);
  });

  it('uses incoming modules when existing has none', () => {
    const existing = { ...baseProfile, modules: [] as Profile['modules'] };
    const merged = mergeProfile(existing, { modules: ['linkedin'] });
    expect(merged.modules).toEqual(['linkedin']);
  });

  it('merges work shallowly, preserving existing work fields', () => {
    const merged = mergeProfile(baseProfile, {
      work: { self_employed: true, company_name: 'New Co' },
    });
    expect(merged.work.company_name).toBe('Acme');
    expect(merged.work.self_employed).toBe(false);
  });
});
