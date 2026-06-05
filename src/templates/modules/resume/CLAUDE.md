# Resume Module Context

This module helps you keep your resume current by synthesising it from your patina graph.

## Folder structure

```
{{CONTENT_DIR}}/resume/
  INSTRUCTIONS.md              — module-specific rules and guidance
  Resume Working Draft.md      — the resume you are actively editing
  Resume Last Submitted.md     — the version you last sent to an employer
```

## Slash commands

| Command | What it does |
|---------|-------------|
| `/resume-refresh` | Refresh your resume working draft from your graph |

## How it works

The `/resume-refresh` command reads your `{{CONTENT_DIR}}/` graph — notes, skills, and experience — and updates your Resume Working Draft to reflect your current professional state. It never overwrites Resume Last Submitted; that file is yours to update manually when you send an application.

The working draft is compared against the last submitted version so you can see what has changed before sending.

## Confidential content

<!-- confidential gate: must also appear in linkedin/CLAUDE.md, linkedin/INSTRUCTIONS.md, resume/INSTRUCTIONS.md, clients/CLAUDE.md, clients/INSTRUCTIONS.md -->

Before including any note or artifact in output, check its frontmatter. If `confidential: true` is present — or if the file originates under `clients/` and has not been explicitly set to `confidential: false` — skip it entirely. Do not summarise, excerpt, or reference confidential content. This is a hard stop.
