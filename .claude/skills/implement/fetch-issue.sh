#!/usr/bin/env bash
# Fetches a GitHub issue as JSON.
# Usage: bash ~/.claude/skills/implement/fetch-issue.sh <issue-number>

set -euo pipefail

NUMBER="${1:?Usage: fetch-issue.sh <issue-number>}"

gh issue view "$NUMBER" --json number,title,body,labels,assignees,milestone,comments,state
