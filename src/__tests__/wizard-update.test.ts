import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { hashContent } from '../checksums.js';
import { removeManagedFileIfUnmodified } from '../wizard.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-wizard-update-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ── removeManagedFileIfUnmodified ─────────────────────────────────────────────

describe('removeManagedFileIfUnmodified', () => {
  it('deletes the file when hash matches stored checksum', () => {
    const content = 'managed content';
    const rel = 'CLAUDE.md';
    writeFileSync(join(tmp, rel), content, 'utf8');
    const stored = { [rel]: hashContent(content) };

    const result = removeManagedFileIfUnmodified(tmp, rel, stored);

    expect(result).toBe('deleted');
    expect(existsSync(join(tmp, rel))).toBe(false);
  });

  it('keeps the file when hash does not match stored checksum (user-edited)', () => {
    const rel = 'CLAUDE.md';
    writeFileSync(join(tmp, rel), 'user-edited content', 'utf8');
    const stored = { [rel]: hashContent('original patina content') };

    const result = removeManagedFileIfUnmodified(tmp, rel, stored);

    expect(result).toBe('kept');
    expect(existsSync(join(tmp, rel))).toBe(true);
  });

  it('returns deleted when file does not exist', () => {
    const result = removeManagedFileIfUnmodified(tmp, 'nonexistent.md', {});
    expect(result).toBe('deleted');
  });

  it('deletes the file when no stored checksum exists (migration path)', () => {
    const rel = 'CLAUDE.md';
    writeFileSync(join(tmp, rel), 'some content', 'utf8');

    // No stored checksum → treat as unmodified (safe to delete)
    const result = removeManagedFileIfUnmodified(tmp, rel, {});

    expect(result).toBe('deleted');
    expect(existsSync(join(tmp, rel))).toBe(false);
  });

  it('handles nested file paths', () => {
    const rel = '.claude/commands/li-all.md';
    mkdirSync(join(tmp, '.claude', 'commands'), { recursive: true });
    const content = 'li-all content';
    writeFileSync(join(tmp, rel), content, 'utf8');
    const stored = { [rel]: hashContent(content) };

    const result = removeManagedFileIfUnmodified(tmp, rel, stored);

    expect(result).toBe('deleted');
    expect(existsSync(join(tmp, rel))).toBe(false);
  });
});
