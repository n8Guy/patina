// agent-md-lint-check.mjs — PostToolUse hook for Write/Edit.
// Reads Claude Code hook JSON from stdin. If the edited file is an agent-only
// file, runs cheap regex checks and nudges Claude to run /format-agent-md.
// Exits 0 silently for non-agent-only files or on any error.
// Node ESM, no external deps.

import { normalize, relative } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
// Hook lives at .claude/scripts/ — repo root is two levels up.
const REPO_ROOT = normalize(__dirname + '../../../');

// --- Include/exclude logic (mirrors list-targets.mjs) ---

const INCLUDE_PREFIXES = [
  '.claude/skills/',
  '.claude/agents/',
  'src/templates/.claude/',
];

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

const EXCLUDE_PREFIXES = [
  'dist/',
  '.claude/worktrees/',
];

const EXCLUDE_SUFFIX_PATTERNS = [/^scratch-.+\.md$/];

function fwd(p) {
  return p.replace(/\\/g, '/');
}

function isAgentOnlyFile(rawPath) {
  if (!rawPath) return false;
  if (!rawPath.endsWith('.md')) return false;

  // Resolve to repo-relative forward-slash path, handling both absolute and relative inputs.
  const abs = normalize(rawPath);
  const rel = fwd(relative(REPO_ROOT, abs)).replace(/^\.\//, '');
  const basename = rel.split('/').pop();

  // Must match at least one include prefix.
  if (!INCLUDE_PREFIXES.some(prefix => rel.startsWith(prefix))) return false;

  // Must not match any exclude.
  if (EXCLUDE_EXACT.has(rel)) return false;
  if (EXCLUDE_BASENAME.has(basename)) return false;
  for (const prefix of EXCLUDE_PREFIXES) {
    if (rel.startsWith(prefix)) return false;
  }
  for (const pattern of EXCLUDE_SUFFIX_PATTERNS) {
    if (pattern.test(basename)) return false;
  }

  return true;
}

// --- Cheap structural checks (regex only, no LLM) ---
// Note: TABLE_ROW_RE may produce false positives for pipe characters inside
// fenced code blocks. The hook is advisory-only, so false positives result in
// an extra nudge rather than a blocked edit.

const TABLE_ROW_RE = /^\s*\|.*\|/m;
const SCAFFOLDING_HEADING_RE = /^#{1,6}\s+(Overview|Introduction|Conclusion|Table of Contents)\s*$/im;

function checkViolations(content) {
  const violations = [];
  if (TABLE_ROW_RE.test(content)) {
    violations.push('markdown table detected (R1: convert to bullet list)');
  }
  if (SCAFFOLDING_HEADING_RE.test(content)) {
    violations.push('scaffolding heading detected (R8: drop Overview/Introduction/Conclusion/Table of Contents headings)');
  }
  return violations;
}

// --- Main ---

async function main() {
  let raw = '';
  try {
    for await (const chunk of process.stdin) {
      raw += chunk;
    }
  } catch {
    process.exit(0);
  }

  if (!raw.trim()) process.exit(0);

  let hook;
  try {
    hook = JSON.parse(raw);
  } catch {
    process.exit(0);
  }

  const filePath = hook?.tool_input?.file_path;
  if (!isAgentOnlyFile(filePath)) process.exit(0);

  let content = '';
  try {
    content = readFileSync(filePath, 'utf8');
  } catch {
    process.exit(0);
  }

  const violations = checkViolations(content);
  if (violations.length === 0) process.exit(0);

  const list = violations.map(v => `  - ${v}`).join('\n');
  process.stdout.write(
    `Agent-only file style violation in ${filePath}:\n${list}\n` +
    `Run /format-agent-md to auto-fix.\n`
  );

  process.exit(0); // Non-blocking — never fail the user's edit.
}

main().catch(() => process.exit(0));
