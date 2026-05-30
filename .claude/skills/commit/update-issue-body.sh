#!/usr/bin/env bash
# Updates the body of a GitHub issue.
# Usage: echo "new body text" | bash ~/.claude/skills/commit/update-issue-body.sh <issue-number>

set -euo pipefail

NUMBER="${1:?Usage: echo \"body\" | update-issue-body.sh <issue-number>}"

# Read body from stdin to avoid command-line length limits on Windows
BODY=$(cat)

gh issue edit "$NUMBER" --body "$BODY"
