import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { writeManagedFile, mergeProfile } from '../upgrade.js';
import { hashContent } from '../checksums.js';
import type { Profile } from '../types.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ── writeManagedFile ──────────────────────────────────────────────────────────

describe('writeManagedFile', () => {
  it('adds a new file and returns outcome=added', () => {
    const { outcome, checksum } = writeManagedFile(tmp, 'CLAUDE.md', 'hello', {});
    expect(outcome).toBe('added');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe('hello');
    expect(checksum).toBe(hashContent('hello'));
  });

  it('updates a file when current hash matches stored checksum', () => {
    const original = 'original content';
    writeFileSync(join(tmp, 'CLAUDE.md'), original);
    const stored = { 'CLAUDE.md': hashContent(original) };

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', 'updated content', stored);
    expect(outcome).toBe('updated');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe('updated content');
  });

  it('skips a file when the user has modified it', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), 'user modified this');
    const stored = { 'CLAUDE.md': hashContent('original content') };

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', 'new template content', stored);
    expect(outcome).toBe('skipped');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe('user modified this');
  });

  it('updates a file when no stored checksum exists (treats as unmodified)', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), 'existing content');

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', 'updated content', {});
    expect(outcome).toBe('updated');
  });

  it('creates intermediate directories for nested paths', () => {
    const { outcome } = writeManagedFile(tmp, '.claude/commands/include.md', 'content', {});
    expect(outcome).toBe('added');
    expect(readFileSync(join(tmp, '.claude/commands/include.md'), 'utf8')).toBe('content');
  });

  it('returns the new checksum for updated files', () => {
    const newContent = 'new content';
    const { checksum } = writeManagedFile(tmp, 'file.md', newContent, {});
    expect(checksum).toBe(hashContent(newContent));
  });

  it('returns the stored checksum when skipping', () => {
    writeFileSync(join(tmp, 'file.md'), 'custom');
    const stored = { 'file.md': 'stored-hash-abc' };
    const { checksum } = writeManagedFile(tmp, 'file.md', 'new', stored);
    expect(checksum).toBe('stored-hash-abc');
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
