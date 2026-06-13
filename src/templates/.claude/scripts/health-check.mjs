// Patina health checker — run during /status to surface corruption in managed files.
// Checks for unrendered template placeholders and missing required fences in CLAUDE.md.
// Exits 0 with no output when healthy; exits 1 with a description when problems are found.

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const cwd = process.cwd();

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasPlaceholders(content) {
  return /\{\{[A-Z][A-Z0-9_]+\}\}/.test(content);
}

function findPlaceholders(content) {
  const matches = content.match(/\{\{[A-Z][A-Z0-9_]+\}\}/g) ?? [];
  return [...new Set(matches)];
}

function parseSectionIds(content) {
  const ids = [];
  const re = /<!-- patina:([a-z0-9-]+):start -->/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const id = m[1];
    const end = `<!-- patina:${id}:end -->`;
    if (content.includes(end)) ids.push(id);
  }
  return ids;
}

// ── Load profile ──────────────────────────────────────────────────────────────

const profilePath = join(cwd, 'profile.yaml');
if (!existsSync(profilePath)) process.exit(0);

// Minimal YAML parse — detect whether launch_tasks has entries without a dep.
// Uses a line-state machine: enter launch_tasks on matching key, count list items
// until the next top-level key or EOF. Handles both `launch_tasks: [a,b]` and
// multi-line list forms.
const profileRaw = readFileSync(profilePath, 'utf8');
const hasLaunchTasks = (() => {
  const lines = profileRaw.split('\n');
  let inLaunchTasks = false;
  for (const line of lines) {
    if (/^launch_tasks\s*:/.test(line)) {
      // Inline array: launch_tasks: ['a', 'b'] or launch_tasks: []
      const inline = line.match(/:\s*\[(.*)]/);
      if (inline) return inline[1].trim().length > 0;
      inLaunchTasks = true;
      continue;
    }
    if (inLaunchTasks) {
      if (/^\s*-\s/.test(line)) return true;  // found a list item
      if (/^\S/.test(line.trim()) && line.trim() !== '') break;  // new top-level key
    }
  }
  return false;
})();

// Required CLAUDE.md section ids
const requiredSections = ['profile', 'guide', 'commands', 'modules', 'update-check'];
if (hasLaunchTasks) requiredSections.push('launch');

// ── Managed files to scan ─────────────────────────────────────────────────────

// Check CLAUDE.md (most important — it's the file that can silently rot)
const claudePath = join(cwd, 'CLAUDE.md');
const problems = [];

if (existsSync(claudePath)) {
  const content = readFileSync(claudePath, 'utf8');

  const tokens = findPlaceholders(content);
  if (tokens.length > 0) {
    problems.push(`CLAUDE.md contains unrendered placeholders: ${tokens.join(', ')}`);
  }

  const present = new Set(parseSectionIds(content));
  for (const id of requiredSections) {
    if (!present.has(id)) {
      problems.push(`CLAUDE.md is missing required section: ${id}`);
    }
  }
}

// ── Output ────────────────────────────────────────────────────────────────────

if (problems.length === 0) process.exit(0);

for (const p of problems) {
  process.stdout.write(p + '\n');
}
process.stdout.write('Run `npx my-patina` to repair.\n');
process.exit(1);
