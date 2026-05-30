#!/usr/bin/env bash
# Verifies prerequisites before any skill workflow begins.
# Checks: git available, inside a git repo, gh installed, gh authenticated, GitHub remote reachable.
# Usage: bash .claude/skills/shared/preflight.sh

set -euo pipefail

# 1. git must be available
if ! command -v git > /dev/null 2>&1; then
  echo "ERROR: git is not installed or not in PATH." >&2
  exit 1
fi

# 2. Must be inside a git repository
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "ERROR: Not inside a git repository." >&2
  exit 1
fi

# 3. gh (GitHub CLI) must be installed
if ! command -v gh > /dev/null 2>&1; then
  echo "ERROR: gh (GitHub CLI) is not installed. Install it from https://cli.github.com" >&2
  exit 1
fi

# 4. gh must be authenticated
if ! gh auth status > /dev/null 2>&1; then
  echo "ERROR: gh is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

# 5. Repo must have a GitHub remote
if ! gh repo view --json name > /dev/null 2>&1; then
  echo "ERROR: No GitHub remote found for this repository. Check 'git remote -v'." >&2
  exit 1
fi

echo "OK"
