---
patina: managed
---
# {{PATINA_NAME}}

This is your patina — a personal knowledge base for your professional story.

- Profile and config live in `profile.yaml` and `CLAUDE.md`.
- Your notes, skills, and posts live in `{{CONTENT_DIR}}/`.

Your own always-on instructions live in `CUSTOM.md` — patina seeds it once and never overwrites it.

**Your notes and graph content in `{{CONTENT_DIR}}/` are never touched by updates — only setup files (CLAUDE.md, commands, settings) reset on update.**

## Commands

Run `/guide` in your session to see all available commands with usage examples.

## Using the inbox

Drop files into `inbox/` — documents, PDFs, notes, transcripts, anything you want to add to your graph. On your next session startup, patina will notice them and offer to process them, or run `/inbox` at any time. After processing, files are moved automatically to `inbox/archive/` — patina never deletes them.

## Customising your setup

To add your own persistent instructions for Claude, edit `CUSTOM.md` — patina never overwrites it.

To customise a patina command, copy it to a new filename and remove the `patina: managed` frontmatter. Unmarked files are yours and survive updates. For example, copy `.claude/commands/add.md` to `.claude/commands/add-work.md` (without the frontmatter) to create a specialised version.

## Installed modules

{{MODULE_README_BLOCKS}}
