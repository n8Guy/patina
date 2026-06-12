# /status — Patina Status

Run each check below and report results in a single consolidated view. Do not ask questions or prompt for input — just show the current state.

## 1. Stale content

Run `node .claude/scripts/staleness-check.mjs` and show the output. If the command produces no output, show nothing for this section.

## 2. Inbox

Read `inbox/.processed.json` (treat missing or unparseable as `[]`). List all files in `inbox/` excluding `.gitkeep` and `.processed.json`. Any whose path relative to `inbox/` is not recorded with `status: "success"` is unprocessed.

If unprocessed files exist, list them. Otherwise show nothing for this section.

## 3. Open goals

Read all files in `{{CONTENT_DIR}}/goals/`. For each, check the `status` field in the frontmatter. List any with status `open` or `in-progress` with their title and status. If none, show nothing for this section.

## 4. Module setup

Read `.patina-state.json`. If it contains a `deferred_modules` list, check each entry's `snooze_until` against today's date. List any where today is on or after `snooze_until`, using the module's friendly label. If none are due, show nothing for this section.

## Output format

Group results under these headers only if that section has something to show:

**Stale content** — items from the staleness check
**Inbox** — unprocessed files
**Open goals** — open or in-progress goals
**Module setup** — modules awaiting setup

If everything is clear, say: `All clear.`
