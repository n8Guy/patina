#!/usr/bin/env bash
# Posts a comment on a GitHub issue (used to attach the implementation plan).
# Usage: echo "comment body" | bash ~/.claude/skills/commit/attach-plan-to-issue.sh <issue-number>

set -euo pipefail

NUMBER="${1:?Usage: echo \"body\" | attach-plan-to-issue.sh <issue-number>}"

# Read body from stdin to avoid command-line length limits on Windows
BODY=$(cat)

gh issue comment "$NUMBER" --body "$BODY"
