#!/usr/bin/env bash
# Creates a GitHub issue in the current repo.
# Usage: echo "Issue body here" | bash ~/.claude/skills/issue/create-issue.sh "Issue Title"

set -euo pipefail

TITLE="${1:?Usage: echo \"body\" | create-issue.sh <title>}"

# Read body from stdin to avoid command-line length limits on Windows
BODY=$(cat)

gh issue create --title "$TITLE" --body "$BODY"
