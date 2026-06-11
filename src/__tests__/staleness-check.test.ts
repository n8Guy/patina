import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, utimesSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const SCRIPT_PATH = fileURLToPath(
  new URL('../templates/.claude/scripts/staleness-check.mjs', import.meta.url)
);

function runScript(cwd: string, contentDir: string, thresholdDays = 30) {
  return spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd,
    timeout: 5000,
    env: {
      ...process.env,
      PATINA_MOCK_CONTENT_DIR: contentDir,
      PATINA_MOCK_THRESHOLD_DAYS: String(thresholdDays),
    },
  });
}

function makeTmp() {
  return mkdtempSync(join(tmpdir(), 'patina-staleness-test-'));
}

function touch(path: string, mtime: Date) {
  writeFileSync(path, '');
  utimesSync(path, mtime, mtime);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

// ── fresh patina (no content) ─────────────────────────────────────────────────

describe('fresh patina — no content', () => {
  it('produces no output when all areas are empty', () => {
    const tmp = makeTmp();
    try {
      const contentDir = join(tmp, 'graph');
      for (const dir of ['notes', 'skills', 'posts']) {
        mkdirSync(join(contentDir, dir), { recursive: true });
        writeFileSync(join(contentDir, dir, '.gitkeep'), '');
      }
      const result = runScript(tmp, contentDir);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout.toString()).toBe('');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('produces no output when content dir does not exist', () => {
    const tmp = makeTmp();
    try {
      const result = runScript(tmp, join(tmp, 'graph'));
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout.toString()).toBe('');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('ignores README.md and exclusions.md when checking for content', () => {
    const tmp = makeTmp();
    try {
      const contentDir = join(tmp, 'graph');
      mkdirSync(join(contentDir, 'notes'), { recursive: true });
      writeFileSync(join(contentDir, 'notes', 'README.md'), '');
      writeFileSync(join(contentDir, 'notes', 'exclusions.md'), '');
      const result = runScript(tmp, contentDir);
      expect(result.stdout.toString()).toBe('');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ── all content fresh ─────────────────────────────────────────────────────────

describe('patina with fresh content', () => {
  it('outputs "All content is fresh" when no files exceed the threshold', () => {
    const tmp = makeTmp();
    try {
      const contentDir = join(tmp, 'graph');
      mkdirSync(join(contentDir, 'notes'), { recursive: true });
      touch(join(contentDir, 'notes', 'recent-project.md'), daysAgo(5));
      const result = runScript(tmp, contentDir, 30);
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(0);
      expect(result.stdout.toString()).toMatch(/^All content is fresh/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ── stale content ─────────────────────────────────────────────────────────────

describe('patina with stale content', () => {
  it('lists stale notes by slug (extension stripped)', () => {
    const tmp = makeTmp();
    try {
      const contentDir = join(tmp, 'graph');
      mkdirSync(join(contentDir, 'notes'), { recursive: true });
      touch(join(contentDir, 'notes', 'old-project.md'), daysAgo(45));
      const result = runScript(tmp, contentDir, 30);
      expect(result.stdout.toString()).toContain('Notes: old-project');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('lists multiple stale areas', () => {
    const tmp = makeTmp();
    try {
      const contentDir = join(tmp, 'graph');
      for (const dir of ['notes', 'skills']) {
        mkdirSync(join(contentDir, dir), { recursive: true });
        touch(join(contentDir, dir, 'stale-item.md'), daysAgo(60));
      }
      mkdirSync(join(contentDir, 'posts'), { recursive: true });
      const result = runScript(tmp, contentDir, 30);
      const out = result.stdout.toString();
      expect(out).toContain('Notes:');
      expect(out).toContain('Skills:');
      expect(out).not.toContain('Posts:');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('does not include fresh files alongside stale ones', () => {
    const tmp = makeTmp();
    try {
      const contentDir = join(tmp, 'graph');
      mkdirSync(join(contentDir, 'notes'), { recursive: true });
      touch(join(contentDir, 'notes', 'old-note.md'), daysAgo(40));
      touch(join(contentDir, 'notes', 'new-note.md'), daysAgo(2));
      const result = runScript(tmp, contentDir, 30);
      const out = result.stdout.toString();
      expect(out).toContain('old-note');
      expect(out).not.toContain('new-note');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('skips .gitkeep, README.md, exclusions.md in stale output', () => {
    const tmp = makeTmp();
    try {
      const contentDir = join(tmp, 'graph');
      mkdirSync(join(contentDir, 'notes'), { recursive: true });
      for (const name of ['.gitkeep', 'README.md', 'exclusions.md']) {
        touch(join(contentDir, 'notes', name), daysAgo(60));
      }
      touch(join(contentDir, 'notes', 'real-note.md'), daysAgo(5));
      const result = runScript(tmp, contentDir, 30);
      // Only real content — and it's fresh — so no stale output
      expect(result.stdout.toString()).toMatch(/^All content is fresh/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

// ── resilience ────────────────────────────────────────────────────────────────

describe('resilience', () => {
  it('exits 0 cleanly with no output on invalid threshold', () => {
    const tmp = makeTmp();
    try {
      const contentDir = join(tmp, 'graph');
      mkdirSync(join(contentDir, 'notes'), { recursive: true });
      touch(join(contentDir, 'notes', 'note.md'), daysAgo(60));
      const result = spawnSync(process.execPath, [SCRIPT_PATH], {
        cwd: tmp,
        timeout: 5000,
        env: {
          ...process.env,
          PATINA_MOCK_CONTENT_DIR: contentDir,
          PATINA_MOCK_THRESHOLD_DAYS: 'not-a-number',
        },
      });
      expect(result.status).toBe(0);
      expect(result.stdout.toString()).toBe('');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
