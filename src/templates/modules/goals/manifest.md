---
name: goals
label: Goals
reflect_hook: goal-review
description: A private space for your forward-looking goals
installed: {{TODAY}}
---

# Goals Module

A private space for your forward-looking goals. Goals are distinct from notes — notes capture past evidence, goals capture future commitments. Use this module to track what you intend to accomplish across different time horizons.

## How it works

Tell Claude what you want to accomplish. It will create a goal file for you in `{{CONTENT_DIR}}/goals/`. Use `/goal-review` (coming soon) to review, update, and triage your goals.

## File layout

```
{{CONTENT_DIR}}/goals/
  INSTRUCTIONS.md     ← workflow guide for Claude
  <slug>.md           ← one file per goal
```

## What this module does not do

Goals are stored locally in your graph. This module does not connect to any external service, calendar, or task manager.

## Note on `/goal-review`

The `/goal-review` command is forthcoming. Until it ships, `/reflect` will reference it but handle a missing command gracefully.
