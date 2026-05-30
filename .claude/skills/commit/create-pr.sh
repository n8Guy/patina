#!/usr/bin/env bash
# Creates or updates a GitHub pull request for the current branch.
# If an open PR already exists for this branch, updates its title and body instead of creating a new one.
# Closed or merged PRs are ignored — a new PR will be created in their place.
# Note: --base is only used when creating; gh does not support re-targeting an existing PR's base.
# Usage: echo "PR body" | bash ~/.claude/skills/commit/create-pr.sh <base-branch> "PR title"

set -euo pipefail

BASE="${1:?Usage: echo \"body\" | create-pr.sh <base-branch> <title>}"
TITLE="${2:?Usage: echo \"body\" | create-pr.sh <base-branch> <title>}"

# Read body from stdin to avoid command-line length limits on Windows
BODY=$(cat)

# Only match an OPEN PR — closed/merged PRs are ignored so a new PR can be created.
# 2>/dev/null suppresses the "no pull requests found" message; || true prevents set -e from
# firing on exit code 1. If gh itself is broken (auth, network), the subsequent create/edit
# will also fail and surface the real error.
EXISTING=$(gh pr view --json url,state --jq 'select(.state == "OPEN") | .url' 2>/dev/null || true)

if [ -n "$EXISTING" ]; then
  gh pr edit --title "$TITLE" --body "$BODY" > /dev/null
  echo "$EXISTING"
else
  gh pr create --base "$BASE" --title "$TITLE" --body "$BODY"
fi
