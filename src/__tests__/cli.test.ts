import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const TSX = resolve('node_modules/.bin/tsx');
const CLI = resolve('src/cli.ts');

function cli(args: string[]) {
  // Build a single command string to avoid DEP0190 (shell:true + array args).
  // Args are hardcoded test constants so concatenation is safe here.
  const cmd = [TSX, CLI, ...args].map(a => `"${a}"`).join(' ');
  return spawnSync(cmd, [], { encoding: 'utf8', timeout: 8000, shell: true });
}

describe('cli dispatch', () => {
  it('errors with a clear message on an unrecognized command', () => {
    const result = cli(['bogus']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Unknown command: bogus');
    expect(result.stderr).toContain("Run 'patina --help' for available commands.");
  });

  it('validate exits 1 with a clear message outside a patina directory', () => {
    const result = cli(['validate']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No patina found here');
  });

  it('--help exits 0 and lists the validate command', () => {
    const result = cli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('validate');
  });
});
