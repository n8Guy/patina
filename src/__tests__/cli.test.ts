import { spawnSync } from 'child_process';
import { resolve } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

const TSX = resolve('node_modules/.bin/tsx');
const CLI = resolve('src/cli.ts');

function cli(args: string[], cwd?: string) {
  // Build a single command string to avoid DEP0190 (shell:true + array args).
  // Args are hardcoded test constants so concatenation is safe here.
  const cmd = [TSX, CLI, ...args].map(a => `"${a}"`).join(' ');
  return spawnSync(cmd, [], { encoding: 'utf8', timeout: 8000, shell: true, cwd });
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

  it('--help output contains --demo', () => {
    const result = cli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('--demo');
  });

  it('--help lists the repair command', () => {
    const result = cli(['--help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('repair');
  });
});

describe('cli repair', () => {
  it('repair exits 1 with a clear message outside a patina directory', () => {
    const result = cli(['repair', '--dry-run']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('No patina found here');
  });

  describe('in a valid patina directory', () => {
    let tmp: string;
    let patinaDir: string;

    beforeEach(async () => {
      tmp = mkdtempSync(join(tmpdir(), 'patina-cli-repair-test-'));
      patinaDir = join(tmp, 'my-patina');
      const { scaffold } = await import('../scaffold.js');
      await scaffold({
        targetDir: patinaDir,
        patinaName: 'test-patina',
        userName: 'Jane Doe',
        title: 'Senior Designer',
        roleDescription: 'I design things.',
        jobDescriptionUrl: '',
        work: {
          self_employed: false,
          company_name: 'Acme Corp',
          website: 'https://acme.com',
          company_description: 'A software company.',
        },
        editor: 'vscode',
        modules: [],
        liProfileUrl: '',
        contentDir: 'graph',
      });
    });

    afterEach(() => {
      rmSync(tmp, { recursive: true, force: true });
    });

    it('repair --dry-run exits 0 on a clean instance', () => {
      const result = cli(['repair', '--dry-run'], patinaDir);
      expect(result.status).toBe(0);
      expect(result.stdout).toContain('No corruption found');
    });
  });
});
