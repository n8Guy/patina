---
patina: managed
---
# {{PATINA_NAME}}

This is your patina — a personal knowledge base for your professional story.

- Profile and config live in `profile.yaml` and `{{AGENT_MEMORY_FILE}}`.
- Your notes and skills live in `{{CONTENT_DIR}}/`.

Your own always-on instructions live in `CUSTOM.md` — patina seeds it once and never overwrites it.

**Your notes and graph content in `{{CONTENT_DIR}}/` are never touched by updates — only setup files ({{AGENT_MEMORY_FILE}}, commands, settings) reset on update.**

## Commands

Open a terminal in this folder and run `{{AGENT_CLI}}` to start a session. Then try:

Run `/guide` in your session to see all available commands with usage examples.

## Using the inbox

Drop files into `inbox/` — documents, PDFs, notes, transcripts, anything you want to add to your graph. On your next session startup, patina will notice them and offer to process them, or run `/inbox` at any time. After processing, files are moved automatically to `inbox/archive/` — patina never deletes them.

## Customising your setup

To add your own persistent instructions for {{AGENT_DISPLAY_NAME}}, edit `CUSTOM.md` — patina never overwrites it.

To customise a patina command, copy it to a new filename and remove the `patina: managed` frontmatter. Unmarked files are yours and survive updates. For example, copy `{{AGENT_COMMANDS_DIR}}/add.md` to `{{AGENT_COMMANDS_DIR}}/add-work.md` (without the frontmatter) to create a specialised version.

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
