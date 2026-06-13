import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { removeManagedFileIfManaged } from '../wizard-shared.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-wizard-update-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ── removeManagedFileIfManaged ────────────────────────────────────────────────

describe('removeManagedFileIfManaged', () => {
  it('deletes a file that carries the patina: managed marker', () => {
    const content = '---\npatina: managed\n---\nmanaged content';
    const rel = 'CLAUDE.md';
    writeFileSync(join(tmp, rel), content, 'utf8');

    const result = removeManagedFileIfManaged(tmp, rel);

    expect(result).toBe('deleted');
    expect(existsSync(join(tmp, rel))).toBe(false);
  });

  it('keeps a file that does not carry the patina: managed marker (user-owned)', () => {
    const rel = 'CLAUDE.md';
    writeFileSync(join(tmp, rel), '# My own file\nI wrote this myself.', 'utf8');

    const result = removeManagedFileIfManaged(tmp, rel);

    expect(result).toBe('kept');
    expect(existsSync(join(tmp, rel))).toBe(true);
  });

  it('returns deleted when the file does not exist', () => {
    const result = removeManagedFileIfManaged(tmp, 'nonexistent.md');
    expect(result).toBe('deleted');
  });

  it('keeps a file with legacy patina fence comments (user-owned without marker)', () => {
    // removeManagedFileIfManaged only checks isMarkedManaged, not isLegacyManaged.
    // Legacy files without the marker are treated as user-owned and kept.
    const legacy = '<!-- patina:profile:start -->\nold content\n<!-- patina:profile:end -->\n';
    const rel = 'CLAUDE.md';
    writeFileSync(join(tmp, rel), legacy, 'utf8');

    const result = removeManagedFileIfManaged(tmp, rel);

    expect(result).toBe('kept');
    expect(existsSync(join(tmp, rel))).toBe(true);
  });

  it('deletes a marked JSON file', () => {
    const content = JSON.stringify({ _patina: 'managed', foo: 'bar' }, null, 2) + '\n';
    const rel = 'settings.json';
    writeFileSync(join(tmp, rel), content, 'utf8');

    const result = removeManagedFileIfManaged(tmp, rel);

    expect(result).toBe('deleted');
    expect(existsSync(join(tmp, rel))).toBe(false);
  });

  it('keeps an unmarked JSON file (user-owned)', () => {
    const content = JSON.stringify({ foo: 'bar' }, null, 2) + '\n';
    const rel = 'settings.json';
    writeFileSync(join(tmp, rel), content, 'utf8');

    const result = removeManagedFileIfManaged(tmp, rel);

    expect(result).toBe('kept');
    expect(readFileSync(join(tmp, rel), 'utf8')).toBe(content);
  });

  it('handles nested file paths', () => {
    const rel = '.claude/commands/li-all.md';
    mkdirSync(join(tmp, '.claude', 'commands'), { recursive: true });
    const content = '---\npatina: managed\n---\nli-all content';
    writeFileSync(join(tmp, rel), content, 'utf8');

    const result = removeManagedFileIfManaged(tmp, rel);

    expect(result).toBe('deleted');
    expect(existsSync(join(tmp, rel))).toBe(false);
  });
});
