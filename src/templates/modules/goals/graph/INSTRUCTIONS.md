---
date: {{TODAY}}
type: instructions
last-updated: {{TODAY}}
tags: [goals, instructions]
---

# Goals Workflow Instructions

Read this file first before working with any goal files. It explains the folder layout, the frontmatter schema, and how to interact with goals.

---

## Folder layout

Goals use a flat layout. All goal files live directly in `{{CONTENT_DIR}}/goals/` alongside this INSTRUCTIONS.md:

```
{{CONTENT_DIR}}/goals/
  INSTRUCTIONS.md     ← you are here
  <slug>.md           ← one file per goal (e.g. ship-qstat-rust-rewrite.md)
```

There are no subfolders. Each goal is a single markdown file named with a short, descriptive slug.

---

## How to interact with goals

**Always interact with goals through {{AGENT_DISPLAY_NAME}} — never edit goal files directly.**

To create a goal, tell {{AGENT_DISPLAY_NAME}} what you want to accomplish. {{AGENT_DISPLAY_NAME}} will choose an appropriate slug, fill in the frontmatter, and write the file.

To update a goal (change its status, adjust the due date, mark it done), describe the change to {{AGENT_DISPLAY_NAME}}. {{AGENT_DISPLAY_NAME}} will update the frontmatter fields in place — it will not create a new file.

To review your goals, run `/goal-review`. It groups open and in-progress goals by status and type, flags overdue goals first, and shows a summary count.

---

## Frontmatter schema

Every goal file starts with YAML frontmatter:

```yaml
---
status: open
horizon: quarter
type: project
created: YYYY-MM-DD
due: YYYY-MM-DD
---
```

### `status`

Allowed values: `open | in-progress | done | abandoned`

- `open` — not yet started
- `in-progress` — actively being worked
- `done` — completed
- `abandoned` — decided not to pursue; keep the file for context

### `horizon`

Allowed values: `week | month | quarter | year`

The time horizon this goal belongs to. Used by `/goal-review` to group and prioritise goals.

- `week` — something to accomplish this week
- `month` — this month
- `quarter` — this quarter
- `year` — this year (or longer-term)

### `type`

Free-text label — examples: `job-search`, `project`, `learning`, `people`, `health`

**`type` is a label for grouping and filtering in `/goal-review`. It is not a template selector and has no structural meaning.** Use whatever value best describes the category of work. Common values are listed above, but you are not restricted to them.

### `created`

ISO date (YYYY-MM-DD) — the date the goal was captured. Set once at creation; do not change.

### `due`

ISO date (YYYY-MM-DD) — optional target completion date. Omit if there is no specific deadline.

---

## Goal file body

After the frontmatter, write a brief description of the goal:

- **What** you want to accomplish (one sentence)
- **Why** it matters (optional but useful for `/goal-review` context)
- **Definition of done** — how you will know it is complete (optional)

Keep it short. Goals are not project plans — they are intentions. Details belong in notes.

---

## What not to do

- Do not edit goal files directly. Always go through {{AGENT_DISPLAY_NAME}}.
- Do not use `type` to select a file template or trigger special behaviour. It is a label only.
- Do not delete a goal when it is abandoned. Change `status` to `abandoned` and leave it — it is useful context for future reviews.
- Do not create subfolders inside `{{CONTENT_DIR}}/goals/`. The flat layout is intentional.
