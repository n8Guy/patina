#!/usr/bin/env bash
# Discovers the default branch name for the current GitHub repo.
# Uses the gh API (fast, cached) with a local fallback.
# Usage: bash .claude/skills/shared/discover-default-branch.sh
# Output: prints the default branch name (e.g. "main") to stdout

set -euo pipefail

# Try gh API first (fast, uses cached data)
if DEFAULT=$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name' 2>/dev/null) && [ -n "$DEFAULT" ]; then
  echo "$DEFAULT"
  exit 0
fi

# Fallback: prefer remote tracking refs (authoritative) over local branches
for candidate in main master; do
  if git show-ref --verify --quiet "refs/remotes/origin/$candidate" 2>/dev/null; then
    echo "$candidate"
    exit 0
  fi
done
# Last resort: local branch (may be stale)
for candidate in main master; do
  if git show-ref --verify --quiet "refs/heads/$candidate" 2>/dev/null; then
    echo "$candidate"
    exit 0
  fi
done

echo "ERROR: Could not determine default branch. Check 'gh repo view' or git remotes." >&2
exit 1
