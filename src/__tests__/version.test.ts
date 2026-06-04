import { describe, it, expect } from 'vitest';
import { getPatinaVersion } from '../version.js';

describe('getPatinaVersion', () => {
  it('returns a string', () => {
    const version = getPatinaVersion();
    expect(typeof version).toBe('string');
  });

  it('returns a valid semver string (major.minor.patch)', () => {
    const version = getPatinaVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('matches the version in package.json', async () => {
    // Import package.json dynamically to avoid hard-coding the version in the test
    const { createRequire } = await import('module');
    const { fileURLToPath } = await import('url');
    const { dirname, join } = await import('path');
    const require = createRequire(import.meta.url);
    const pkg = require(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json')) as { version: string };
    expect(getPatinaVersion()).toBe(pkg.version);
  });
});
