# CLAUDE.md

This file is loaded automatically each session to give you context about who you're working with and how this patina is organised.

<!-- patina:profile:start -->
## Who you're working with

**Name:** {{USER_NAME}}
**Title:** {{USER_TITLE}}
**Company:** {{COMPANY_NAME}}

{{ROLE_DESCRIPTION}}

{{COMPANY_DESCRIPTION}}
<!-- patina:profile:end -->

## What patina is

Patina is a personal knowledge base for career and professional development. Notes about your work — projects, skills, decisions, outcomes — go into `{{CONTENT_DIR}}/`. Over time, patina synthesises those notes into a picture of who you are professionally, and uses that picture to generate content: profile updates, posts, skill inventories.

The graph is the source of truth. Nothing gets added to generated content unless it's grounded in a note.

## Folder structure

```
{{CONTENT_DIR}}/
  notes/      — anything you've written manually: projects, prior experience, skills
  skills/     — synthesised skill inventory, built from notes
  posts/      — generated content ready to share
```

## The inbox

`inbox/` is a drop zone for files you want to add to your graph without running `/add` manually on each one. Drop files there between sessions and process them on your next startup, or run `/inbox` at any time.

`inbox/.processed.json` tracks which files have been processed. Each entry records:
- `filename` — path relative to `inbox/` (e.g. `doc.pdf`, or `2026-05/doc.pdf`)
- `status` — `success` or `failed`
- `processed_at` — ISO 8601 timestamp
- `resulting_note_paths` — array of note paths written during processing

Deleting `inbox/.processed.json` simply resets tracking with no data loss — your notes remain in `{{CONTENT_DIR}}/notes/`.

## How it works

**Adding evidence:** Run `/add` and describe something you've done. Claude asks a few questions and writes a note to `{{CONTENT_DIR}}/notes/`.

**Reviewing skills:** Run `/skill-search` to audit your notes for skill gaps, project completions, and stale entries.

**Generating content:** Modules (like LinkedIn) read the graph and produce drafts grounded in your notes.

## Rules that always apply

- Never invent or embellish. Every claim in generated content must trace to a note in `{{CONTENT_DIR}}/`.
- Never delete notes — they are evidence. If something is wrong, add a correction note or use the exclusions list.
- Never delete skill files automatically. Surface them to the user and wait for confirmation.
- `{{CONTENT_DIR}}/notes/exclusions.md` overrides everything. If something is listed there, it must not appear in any generated output.

## On session start

Before anything else, scan the graph for stale content and surface a brief report.

Read the file modification times for all three areas — skip `.gitkeep`, `README.md`, and `exclusions.md` in every directory:
- `{{CONTENT_DIR}}/notes/`
- `{{CONTENT_DIR}}/skills/`
- `{{CONTENT_DIR}}/posts/`

List items not modified in the last **{{STALENESS_THRESHOLD}} days**, grouped by area:

- **Notes** — stale note slugs
- **Skills** — stale skill slugs
- **Posts** — stale draft slugs

Skip any area with nothing stale. If everything is fresh, say so in one line. Keep the report brief — one line per area.

**If this is a non-interactive or headless session, skip all remaining steps in this section (inbox check, pending module setup, and launch tasks) and do not ask any startup questions — stop after the staleness report.**

Next, check the inbox. Read `inbox/.processed.json` (treat missing or unparseable as `[]`). List all files in `inbox/` excluding `.gitkeep` and `.processed.json`. Identify any whose path relative to `inbox/` is not recorded in the registry with status `success`.

If unprocessed files exist, list their filenames (up to 5; if more, show the first 5 and "… and N more") and ask:

> Found unprocessed files in `inbox/`: [filenames]. Process now, or run `/inbox` later?

- **"Now"** — run the `/inbox` flow. Once processing is complete, continue below.
- **"Later"** — fully non-blocking, continue below immediately.

If the inbox is clear, skip this prompt entirely.

### Check for pending module setup

Read `.patina-state.json`. If it contains a `deferred_modules` list, check each entry's
`snooze_until` date against today's date. For each entry where today is on or after
`snooze_until`:

1. Ask the user in plain language, naming the module's friendly label (not internal IDs or
   file names): e.g. "I noticed you haven't finished setting up the LinkedIn module — want
   to do that now?"

2. Offer three responses: yes (set it up now), not now, or remind me later
   (1 week / 1 month / 3 months).

3. On "yes": collect what the module needs (for LinkedIn: ask for the profile URL), write the
   value to `profile.yaml`, and remove that module's entry from `deferred_modules` in
   `.patina-state.json`.

4. On "remind me later": update the entry's `snooze_until` to the chosen interval from today
   and save `.patina-state.json`.

5. On "not now": leave the entry unchanged. Do not re-ask in this session.

If nothing is due (no entries, or all entries have a future `snooze_until`), say nothing.

User-facing copy must use plain language — no "state file", "deferred flag", "snooze",
"init hook", or any YAML/JSON key names in the spoken question.

Finally, execute any tasks listed in the **## Launch tasks** section at the end of this file (if present). Then ask:

> What are we working on today?

## Slash commands

| Command | What it does |
|---------|-------------|
| `/add <description>` | Add a skill, project, or experience to your graph |
| `/reflect [slug]` | Review your graph for gaps, completions, and stale skills — also runs all installed module hooks |
| `/inbox` | Process all files dropped in `inbox/` through `/add` automatically |

## Modules

<!-- patina:modules:start -->
{{MODULES_SECTION}}
<!-- patina:modules:end -->
