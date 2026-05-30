#!/usr/bin/env bash
# Fetches an existing GitHub issue's content fields for refinement.
# Returns: number, title, body, labels, state (content-only; no assignees/comments).
# Note: implement/fetch-issue.sh fetches a broader set (assignees, milestone, comments)
# because the implement workflow needs full issue context. This script is intentionally
# lighter — refine mode only needs the fields it might edit.
# Usage: bash ~/.claude/skills/issue/fetch-issue.sh <issue-number>

set -euo pipefail

NUMBER="${1:?Usage: fetch-issue.sh <issue-number>}"

gh issue view "$NUMBER" --json number,title,body,labels,state
