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

## Keeping your notes safe

Everything in this folder lives only on your computer. Your notes are your career
evidence — if this folder is lost (a dead laptop, an accidental delete), there's no
copy unless you make one.

Two simple safety nets:

- **A backup.** Keep this folder somewhere that syncs or backs up automatically —
  an external drive, Time Machine, or a synced cloud folder.
- **Version history.** patina can turn this folder into a version-controlled
  project, so you can recover anything you change or delete. patina offered this
  during setup; if you skipped it, you can turn it on any time by re-running patina
  and choosing "Back up your notes."

If you already use git: this is a normal repository (or can become one). `.gitignore`
is set up to keep machine-local files out of version control.

## Installed modules

{{MODULE_README_BLOCKS}}
