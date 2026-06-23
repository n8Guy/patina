---
patina: managed
---
# Goals Module Context

This module tracks {{USER_NAME}}'s forward-looking goals. Goals are future commitments — distinct from notes, which capture past evidence.

## Folder structure

```
{{CONTENT_DIR}}/goals/
  INSTRUCTIONS.md     — module rules and guidance
  <slug>.md           — one file per goal
```

## Slash commands

| Command | What it does |
|---------|-------------|
| `/goal <description>` | Create a new goal |
| `/goal-review` | Review open and in-progress goals, flag overdue |

## How it works

Goals are created and updated through {{AGENT_DISPLAY_NAME}}. Each goal is a markdown file with YAML frontmatter capturing its status, time horizon, and type. Read `{{CONTENT_DIR}}/goals/INSTRUCTIONS.md` before working with any goal files.

## Rules

- Never edit goal files directly on behalf of the user — always go through {{AGENT_DISPLAY_NAME}}.
- Use the `type` field for grouping and filtering only. It has no structural meaning.
- When a goal's `status` changes, update the frontmatter field — do not create a new file.
