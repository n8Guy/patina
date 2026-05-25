import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { detectMode } from '../detect.js';

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('detectMode', () => {
  it('returns install when profile.yaml does not exist', () => {
    expect(detectMode(tmp)).toBe('install');
  });

  it('returns update when profile.yaml exists', () => {
    writeFileSync(join(tmp, 'profile.yaml'), 'patina_name: test\n');
    expect(detectMode(tmp)).toBe('update');
  });

  it('returns install for an empty directory', () => {
    expect(detectMode(tmp)).toBe('install');
  });
});
