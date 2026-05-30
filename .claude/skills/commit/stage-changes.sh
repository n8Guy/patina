#!/usr/bin/env bash
# Stages all modified tracked files and new untracked files.
# Does NOT use git add -A or git add . to avoid sweeping in unintended files.
# Uses null-delimited read loop to handle filenames with spaces or special characters.
# Usage: bash ~/.claude/skills/commit/stage-changes.sh

set -euo pipefail

# Stage modified tracked files
while IFS= read -r -d '' file; do
  git add -- "$file"
done < <(git diff --name-only -z)

# Stage new untracked files
while IFS= read -r -d '' file; do
  git add -- "$file"
done < <(git ls-files --others --exclude-standard -z)
