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

<!-- patina:guide:start -->
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

**Reviewing skills:** Run `/reflect` to audit your notes for skill gaps, project completions, and stale entries.

**Generating content:** Modules (like LinkedIn) read the graph and produce drafts grounded in your notes.

## Rules that always apply

- Never invent or embellish. Every claim in generated content must trace to a note in `{{CONTENT_DIR}}/`.
- Never delete notes — they are evidence. If something is wrong, add a correction note or use the exclusions list.
- Never delete skill files automatically. Surface them to the user and wait for confirmation.
- `{{CONTENT_DIR}}/notes/exclusions.md` overrides everything. If something is listed there, it must not appear in any generated output.

## On session start

Before anything else, run `node .claude/scripts/staleness-check.mjs` and relay the result.

**If this is a non-interactive or headless session:** relay the output as the staleness report if there is any, say nothing if there is none, then stop — do not show the orientation block, check the inbox, or ask any startup questions.

For an interactive session:

- If the command produces no output, the patina has no content yet — skip the staleness report and go straight to the orientation block below.
- If the output starts with "All content is fresh", say so in one line.
- Otherwise, show the stale items exactly as listed (one line per area), then continue below.

Show a brief orientation block. Always start with the core commands:

> Here's what you can do:
> - `/add` — capture something you've worked on (a project, a skill, a win)
> - `/reflect` — when you're ready to review what you've captured and see what's worth updating
> - `/inbox` — process any files you've dropped into `inbox/`

Then, if any modules are installed, read each `.claude/modules/*/manifest.md` and, under the module's `label`, list its `commands` (the `name` and `desc` from the manifest frontmatter) — one line per command — so the reader can see what each installed module offers. Don't repeat the core commands, and keep it to one line each. Skip this entirely if no modules are installed.

If `{{CONTENT_DIR}}/notes/` contains no files other than `.gitkeep`, `README.md`, and `exclusions.md`, add one more line:

> You don't have any notes yet — try `/add` to capture something.

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
<!-- patina:guide:end -->

<!-- patina:commands:start -->
## Slash commands

This table is regenerated whenever you install or update patina, so it always reflects the commands you actually have — including any from installed modules.

{{COMMANDS_SECTION}}
<!-- patina:commands:end -->

<!-- patina:modules:start -->
## Modules

{{MODULES_SECTION}}
<!-- patina:modules:end -->
