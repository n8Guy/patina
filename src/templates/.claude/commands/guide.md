# /guide — Command Reference

Show a formatted command reference for this patina.

## Core commands

Always show:

> Here's what you can do:
> - `/add <what you did>` — capture a project, skill, or win · e.g. `/add Delivered the Orca Studio brand refresh`
> - `/reflect` — review your notes for skill gaps and stale entries
> - `/inbox` — process any files you've dropped into `inbox/`

## Module commands

If any modules are installed, read each `.claude/modules/*/manifest.md` and, under the module's `label`, list its `commands` (the `name` and `desc` from the manifest frontmatter) — one line per command. The `name` field is the complete typed invocation; if it includes `<angle brackets>`, those are required arguments. Don't repeat the core commands, and keep it to one line each. Skip this section entirely if no modules are installed.

Do not run staleness checks, inbox checks, or ask what the user is working on — just show the commands.
