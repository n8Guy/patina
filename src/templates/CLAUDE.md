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

Skip any area with nothing stale. If everything is fresh, say so in one line. Keep the report brief — one line per area. Then ask:

> What are we working on today?

## Slash commands

| Command | What it does |
|---------|-------------|
| `/add <description>` | Add a skill, project, or experience to your graph |
| `/reflect [slug]` | Review your graph for gaps, completions, and stale skills — also runs all installed module hooks |

## Modules

<!-- patina:modules:start -->
{{MODULES_SECTION}}
<!-- patina:modules:end -->
