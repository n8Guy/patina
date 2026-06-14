---
patina: managed
---
# CLAUDE.md

This file is loaded automatically each session to give you context about who you're working with and how this patina is organised.

Your own always-on instructions live in `CUSTOM.md` (patina never overwrites it).

## Who you're working with

**Name:** {{USER_NAME}}
**Title:** {{USER_TITLE}}
**Company:** {{COMPANY_NAME}}

{{ROLE_DESCRIPTION}}

{{COMPANY_DESCRIPTION}}

## What patina is

Patina is a personal knowledge base for career and professional development. Notes about your work — projects, skills, decisions, outcomes — go into `{{CONTENT_DIR}}/`. Over time, patina synthesises those notes into a picture of who you are professionally, and uses that picture to generate content: profile updates, skill inventories.

The graph is the source of truth. Nothing gets added to generated content unless it's grounded in a note.

## Folder structure

```
{{CONTENT_DIR}}/
  notes/      — anything you've written manually: projects, prior experience, skills
  skills/     — synthesised skill inventory, built from notes
```

## The inbox

`inbox/` is a drop zone for files you want to add to your graph without running `/add` manually on each one. Drop files there between sessions and process them on your next startup, or run `/inbox` at any time. After processing, files are moved to `inbox/archive/` automatically.

`inbox/.processed.json` tracks which files have been processed. Each entry records:
- `filename` — path relative to `inbox/` (e.g. `doc.pdf`, `archive/doc.pdf` once archived, or `2026-05/doc.pdf`)
- `status` — `success` or `failed`
- `processed_at` — ISO 8601 timestamp
- `resulting_paths` — array of paths written during processing

Where each file lands is governed by `.claude/inbox-routing.md`; files without a routable `type:` go to `{{CONTENT_DIR}}/notes/`.

Deleting `inbox/.processed.json` simply resets tracking with no data loss — your notes remain in `{{CONTENT_DIR}}/notes/`.

**Never read or scan `inbox/archive/`.** It is a storage area for already-processed source files, not part of the active graph. Treat it as opaque.

## How it works

**Adding evidence:** Run `/add` and describe something you've done. Claude asks a few questions and writes a note to `{{CONTENT_DIR}}/notes/`.

**Reviewing skills:** Run `/reflect` to audit your notes for skill gaps, project completions, and stale entries.

**Generating content:** Modules (like LinkedIn) read the graph and produce drafts grounded in your notes.

## Rules that always apply

- Never invent or embellish. Every claim in generated content must trace to a note in `{{CONTENT_DIR}}/`.
- Never delete notes — they are evidence. If something is wrong, add a correction note or use the exclusions list.
- Never delete skill files automatically. Surface them to the user and wait for confirmation.
- `{{CONTENT_DIR}}/notes/exclusions.md` overrides everything. If something is listed there, it must not appear in any generated output.

## Slash commands

This table is regenerated whenever you install or update patina, so it always reflects the commands you actually have — including any from installed modules.

{{COMMANDS_SECTION}}

## Modules

{{MODULES_SECTION}}

{{LAUNCH_SECTION}}

{{UPDATE_CHECK_SECTION}}
