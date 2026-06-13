---
date: {{TODAY}}
last-updated: {{TODAY}}
tags: [work, instructions]
---

# Work Module Workflow Instructions

Read this file first before working with any files in `{{CONTENT_DIR}}/work/`. It explains the folder layout, the info block fields for each artifact type, and how to add and process work artifacts.

---

## Folder layout

```
{{CONTENT_DIR}}/work/
  INSTRUCTIONS.md     ← you are here
  profile.md          ← how you work in your role (authored, update as context changes)
  transcripts/        ← meeting transcripts (one file per meeting)
  weeklies/           ← periodic activity summaries (one file per week)
  references/         ← supporting documents and background context
```

---

## How to add work artifacts

**Via inbox (recommended):** Drop files into `inbox/` and run `/inbox`. The `type` field is matched against `.claude/inbox-routing.md` to choose the destination.

**Via /add:** Run `/add` and describe a meeting, a week of work, or a piece of context. Claude will ask clarifying questions and write the file to the appropriate subfolder.

---

## Info block fields

Every artifact file starts with an info block (the section between `---` markers at the top of the file). The `type` field is matched against the routing table in `.claude/inbox-routing.md` to determine which subfolder the file lives in.

### Transcripts (`transcripts/`)

```
type: transcript
date: YYYY-MM-DD
participants: [Name One, Name Two]
tags: [optional, labels]
```

- `date` — the date the meeting occurred
- `participants` — list of people present (first names or full names as appropriate)
- `tags` — optional labels for filtering (e.g. `planning`, `1-1`, `retrospective`)

### Weeklies (`weeklies/`)

```
type: weekly
date: YYYY-MM-DD
tags: [optional, labels]
```

- `date` — the Monday (or first day) of the week being summarised
- `tags` — optional labels

### References (`references/`)

```
type: reference
date: YYYY-MM-DD
tags: [optional, labels]
```

- `date` — the date the document was captured or created
- `tags` — optional labels

### profile.md (`work/` root)

`profile.md` has `type: work-profile`. This type is **not routable** — it is a standing authored document, not an inbox artifact. Do not process it as an intake artifact. It lives in the `work/` root and is updated manually.

---

## Extracting skills and notes

Work artifacts are **source material** — do not edit them. When extracting insights:

1. Read the artifact.
2. Write new files to `{{CONTENT_DIR}}/notes/` (for evidence) or `{{CONTENT_DIR}}/skills/` (for skill inventory updates).
3. Leave the original artifact unchanged.

---

## Updating profile.md

`profile.md` is the one file in this module that is authored, not captured. Update it when:
- Your role, title, or responsibilities change
- You join or leave a team
- Your focus area shifts significantly

It does not need to be updated after every meeting or sprint.

---

## What not to do

- Do not edit transcript or weekly files after the fact to make them look better. Raw is fine.
- Do not create subfolders inside `transcripts/`, `weeklies/`, or `references/`. Flat is correct.
- Do not use the `type` field for anything other than routing. It is not a template selector.
