# CLAUDE.md

This file is loaded automatically each session to give you context about who you're working with and how this patina is organised.

## Who you're working with

**Name:** {{USER_NAME}}
**Title:** {{USER_TITLE}}
**Company:** {{COMPANY_NAME}}

{{ROLE_DESCRIPTION}}

{{COMPANY_DESCRIPTION}}

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

**Adding evidence:** Run `/include` and describe something you've done. Claude asks a few questions and writes a note to `{{CONTENT_DIR}}/notes/`.

**Reviewing skills:** Run `/skill-search` to audit your notes for skill gaps, project completions, and stale entries.

**Generating content:** Modules (like LinkedIn) read the graph and produce drafts grounded in your notes.

## Rules that always apply

- Never invent or embellish. Every claim in generated content must trace to a note in `{{CONTENT_DIR}}/`.
- Never delete notes — they are evidence. If something is wrong, add a correction note or use the exclusions list.
- Never delete skill files automatically. Surface them to the user and wait for confirmation.
- `{{CONTENT_DIR}}/notes/exclusions.md` overrides everything. If something is listed there, it must not appear in any generated output.

## Slash commands

| Command | What it does |
|---------|-------------|
| `/include <description>` | Add a skill, project, or experience to your graph |
| `/skill-search [slug]` | Audit your graph for gaps, completions, and stale skills |
