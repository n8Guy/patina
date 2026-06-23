---
patina: managed
---
# Work Module Context

This module holds {{USER_NAME}}'s raw professional artifacts — transcripts of meetings, periodic activity summaries, and reference documents. These are the upstream source material that feeds into skills and notes.

## Folder structure

```
{{CONTENT_DIR}}/work/
  INSTRUCTIONS.md     — module rules and guidance
  profile.md          — how {{USER_NAME}} works in their role
  transcripts/        — meeting transcripts (one file per meeting)
  weeklies/           — periodic activity summaries (one file per week)
  references/         — supporting documents and background context
```

## Artifact types

Each file starts with an info block at the top. The `type` field tells {{AGENT_DISPLAY_NAME}} and `/add` how to handle it.

**Transcripts** — event-based records of meetings or conversations:
```
type: transcript
date: YYYY-MM-DD
participants: []
tags: []
```

**Weeklies** — periodic summaries of activity and progress:
```
type: weekly
date: YYYY-MM-DD
tags: []
```

**References** — supporting documents, context, and background material:
```
type: reference
date: YYYY-MM-DD
tags: []
```

## Slash commands

| Command | What it does |
|---------|-------------|
| `/work-check` | Surface a status count of artifacts across each work subfolder (runs automatically during `/reflect`) |

## Rules

- Raw artifacts are **inputs**, not outputs. Do not edit them to look polished — keep them as-captured.
- `profile.md` is the exception: it is authored, not transactional. Update it when role, responsibilities, or context changes.
- When extracting skills or notes from work artifacts, write new files to `{{CONTENT_DIR}}/notes/` or `{{CONTENT_DIR}}/skills/` — do not modify the source artifact.
- Routing from `inbox/` is governed by `{{AGENT_DIR}}/inbox-routing.md`. This module registers `transcript`, `weekly`, and `reference`.
