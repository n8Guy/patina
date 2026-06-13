// patina: managed
// Patina health checker — delegates to the installed CLI for all checks.
// Exits 0 with no output when healthy; exits 1 with problems when found.
import { spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const cwd = process.cwd();

// No profile = not a patina instance; exit silently
if (!existsSync(join(cwd, 'profile.yaml'))) process.exit(0);

const result = spawnSync('npx', ['my-patina', 'validate', '--json'], {
  cwd,
  encoding: 'utf8',
  timeout: 30000,
});

// If the CLI itself fails to run (not found, error), exit 0 silently
// (health-check should not block /status due to environment issues)
if (result.error || result.status === null) process.exit(0);

// Exit 0 with no output = healthy
if (result.status === 0) process.exit(0);

// Parse JSON and format for /status display
try {
  const report = JSON.parse(result.stdout);
  for (const issue of report.issues ?? []) {
    const loc = issue.line !== undefined ? `${issue.file}:${issue.line}` : issue.file;
    process.stdout.write(`${loc}  ${issue.message}\n`);
  }
  // Repair hints
  const issues = report.issues ?? [];
  const hasRepairable = issues.some(i =>
    i.check === 'managed-file-placeholders' || i.check === 'managed-file-missing-section'
  );
  const hasOrphans = issues.some(i => i.check === 'managed-file-orphaned-checksum');
  if (hasRepairable) {
    process.stdout.write('Run `npx my-patina` to repair managed files.\n');
  } else if (hasOrphans) {
    process.stdout.write('Run `npx my-patina repair` to prune orphaned checksum entries.\n');
  }
} catch {
  // Fallback if output isn't valid JSON
  if (result.stdout) process.stdout.write(result.stdout);
}

process.exit(1);
