---
patina: managed
name: goals
label: Goals
reflect_hook: goal-review
description: A private space for your forward-looking goals
commands:
  - name: /goal <description>
    desc: Create a new goal · e.g. /goal Land a senior IC role by end of year
  - name: /goal-review
    desc: Review open and in-progress goals, flag overdue (no input needed)
installed: {{TODAY}}
---

# Goals Module

A private space for your forward-looking goals. Goals are distinct from notes — notes capture past evidence, goals capture future commitments. Use this module to track what you intend to accomplish across different time horizons.

## How it works

Tell {{AGENT_DISPLAY_NAME}} what you want to accomplish. Run `/goal` and it will ask for a horizon, type, and optional due date, then create a goal file in `{{CONTENT_DIR}}/goals/`. Run `/goal-review` to see all open and in-progress goals grouped by status and type, with overdue goals surfaced first.

## File layout

```
{{CONTENT_DIR}}/goals/
  INSTRUCTIONS.md     ← workflow guide for {{AGENT_DISPLAY_NAME}}
  <slug>.md           ← one file per goal
```

## What this module does not do

Goals are stored locally in your graph. This module does not connect to any external service, calendar, or task manager.
