#!/usr/bin/env bash
# Updates fields on an existing GitHub issue.
# Body is read from stdin to avoid command-line length limits on Windows.
# Usage:
#   echo "new body" | bash ~/.claude/skills/issue/update-issue.sh <number> --title "New Title" --body
#   echo "new body" | bash ~/.claude/skills/issue/update-issue.sh <number> --body
#   bash ~/.claude/skills/issue/update-issue.sh <number> --title "New Title"
# When --body is passed without a value, the body text is read from stdin.

set -euo pipefail

NUMBER="${1:?Usage: update-issue.sh <issue-number> [--title '...'] [--body]}"
shift

# Build args array, replacing bare --body with stdin content
ARGS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --body)
      BODY=$(cat)
      ARGS+=("--body" "$BODY")
      shift
      ;;
    *)
      ARGS+=("$1")
      shift
      ;;
  esac
done

gh issue edit "$NUMBER" "${ARGS[@]}"
