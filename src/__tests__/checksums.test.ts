import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { hashContent, hashFile } from '../checksums.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('hashContent', () => {
  it('produces a 16-character hex string', () => {
    expect(hashContent('hello')).toMatch(/^[0-9a-f]{16}$/);
  });

  it('is deterministic', () => {
    expect(hashContent('hello')).toBe(hashContent('hello'));
  });

  it('produces different hashes for different content', () => {
    expect(hashContent('hello')).not.toBe(hashContent('world'));
  });

  it('is sensitive to whitespace', () => {
    expect(hashContent('hello')).not.toBe(hashContent('hello '));
  });
});

describe('hashFile', () => {
  it('returns null when the file does not exist', () => {
    expect(hashFile(join(tmp, 'nonexistent.txt'))).toBeNull();
  });

  it('returns a hash matching hashContent for the same content', () => {
    const file = join(tmp, 'test.txt');
    writeFileSync(file, 'hello world');
    expect(hashFile(file)).toBe(hashContent('hello world'));
  });

  it('returns different hashes for files with different content', () => {
    const a = join(tmp, 'a.txt');
    const b = join(tmp, 'b.txt');
    writeFileSync(a, 'aaa');
    writeFileSync(b, 'bbb');
    expect(hashFile(a)).not.toBe(hashFile(b));
  });
});
