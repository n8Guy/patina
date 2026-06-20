// list-targets.mjs — resolves agent-only markdown files in this repo.
// Usage: node .claude/skills/format-agent-md/list-targets.mjs [subdir]
// Prints one repo-relative path per line. No external deps. Node ESM.

import { readdir, stat } from 'node:fs/promises';
import { join, relative, normalize } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const REPO_ROOT = normalize(join(__dirname, '../../..'));

// Include globs expressed as { dir, ext } — we walk recursively under dir.
const INCLUDE_DIRS = [
  '.claude/skills',
  '.claude/agents',
  'src/templates/.claude',
];

// Exclude patterns (checked against forward-slash repo-relative paths).
const EXCLUDE_EXACT = new Set([
  'README.md',
  'CONTRIBUTING.md',
  'MODULES.md',
  '.implementation-plan.md',
  '.current-issue.md',
]);

const EXCLUDE_BASENAME = new Set([
  'CLAUDE.md',
]);

// Prefix-based excludes (forward-slash paths).
const EXCLUDE_PREFIXES = [
  'dist/',
  '.claude/worktrees/',
];

// Suffix patterns for scratch files.
const EXCLUDE_SUFFIX_PATTERNS = [/^scratch-.+\.md$/];

/** Normalize a path to forward slashes. */
function fwd(p) {
  return p.replace(/\\/g, '/');
}

/** Recursively collect .md files under a directory. */
async function walk(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results; // dir doesn't exist — skip silently
  }
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...await walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Return true if the file is gitignored. */
function isGitIgnored(repoRelPath) {
  const result = spawnSync(
    'git',
    ['check-ignore', '--quiet', repoRelPath],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  return result.status === 0;
}

/** Return true if this repo-relative (forward-slash) path should be excluded. */
function isExcluded(relFwd) {
  const basename = relFwd.split('/').pop();

  if (EXCLUDE_EXACT.has(relFwd)) return true;
  if (EXCLUDE_BASENAME.has(basename)) return true;
  for (const prefix of EXCLUDE_PREFIXES) {
    if (relFwd.startsWith(prefix)) return true;
  }
  for (const pattern of EXCLUDE_SUFFIX_PATTERNS) {
    if (pattern.test(basename)) return true;
  }
  return false;
}

async function main() {
  const scopeArg = process.argv[2];

  const candidates = [];

  for (const includeDir of INCLUDE_DIRS) {
    const absDir = join(REPO_ROOT, includeDir);

    // If a scope arg was given, skip dirs that can't possibly match.
    if (scopeArg) {
      const scopeFwd = fwd(normalize(scopeArg));
      const includeFwd = fwd(includeDir);
      // Check overlap: scope must be under includeDir or includeDir under scope.
      if (!includeFwd.startsWith(scopeFwd) && !scopeFwd.startsWith(includeFwd)) {
        continue;
      }
    }

    const files = await walk(absDir);
    for (const f of files) {
      const relFwd = fwd(relative(REPO_ROOT, f));

      // Apply scope filter.
      if (scopeArg) {
        const scopeFwd = fwd(normalize(scopeArg));
        if (!relFwd.startsWith(scopeFwd)) continue;
      }

      candidates.push(relFwd);
    }
  }

  // Deduplicate (unlikely but safe).
  const seen = new Set();
  const results = [];
  for (const p of candidates) {
    if (seen.has(p)) continue;
    seen.add(p);

    if (isExcluded(p)) continue;
    if (isGitIgnored(p)) continue;

    results.push(p);
  }

  results.sort();
  for (const p of results) {
    process.stdout.write(p + '\n');
  }
}

main().catch((err) => {
  process.stderr.write('list-targets.mjs error: ' + err.message + '\n');
  process.exit(1);
});
