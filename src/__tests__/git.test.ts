import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { isGitAvailable, isInsideGitRepo, gitInit } from '../git.js';

const gitAvail = isGitAvailable();
// Detect whether tmpdir() itself is inside a git repo — if so, skip the "returns false" test
// to avoid false failures in CI environments where the clone root is an ancestor of tmpdir().
const tmpdirInsideGitRepo = gitAvail && isInsideGitRepo(tmpdir());

describe.skipIf(!gitAvail)('git utilities', () => {
  it.skipIf(tmpdirInsideGitRepo)('isInsideGitRepo returns false for a fresh temp dir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'patina-git-test-'));
    try {
      expect(isInsideGitRepo(dir)).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('isInsideGitRepo returns true after gitInit', () => {
    const dir = mkdtempSync(join(tmpdir(), 'patina-git-test-'));
    try {
      gitInit(dir);
      expect(isInsideGitRepo(dir)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('isInsideGitRepo returns true for a subdirectory of an initialized repo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'patina-git-test-'));
    try {
      gitInit(dir);
      const sub = join(dir, 'sub');
      mkdirSync(sub, { recursive: true });
      expect(isInsideGitRepo(sub)).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('gitInit returns true and creates .git', () => {
    const dir = mkdtempSync(join(tmpdir(), 'patina-git-test-'));
    try {
      const result = gitInit(dir);
      expect(result).toBe(true);
      expect(existsSync(join(dir, '.git'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('isGitAvailable', () => {
  it('returns a boolean', () => {
    expect(typeof isGitAvailable()).toBe('boolean');
  });
});
