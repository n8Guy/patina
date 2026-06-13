---
patina: managed
---
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

## Sharing

This module never auto-publishes — you copy the draft into your resume document yourself, so you are the final reviewer. It gives one heads-up before a draft uses anything marked `private: true` or that reads as sensitive, then leaves the decision to you. See **Sharing is your call** in `{{CONTENT_DIR}}/resume/INSTRUCTIONS.md`.
