---
patina: managed
name: resume
label: Resume
reflect_hook: resume-refresh
description: A private drafting space for your resume
commands:
  - name: /resume-refresh
    desc: Refresh your resume working draft from your graph (no input needed — Claude reads your notes)
installed: {{TODAY}}
---

# Resume Module

A private drafting workspace for your resume. You add notes about your work, and this module keeps your resume current. When you submit to a role, tell Claude — it will freeze a copy of what you sent so you always know exactly what a hiring team has seen.

## How it works

1. Use `/add` to capture your work — projects, skills, decisions, outcomes.
2. Run `/resume-refresh` to update your working draft from your latest notes.
3. When your draft looks good, copy it into your resume document and submit.
4. Tell Claude — *"I submitted to Acme Corp"* — and it will snapshot the working draft to `Resume Last Submitted.md`.

## Commands

| Command | What it does |
|---------|-------------|
| `/resume-refresh` | Refresh the working draft from your latest notes |

## File layout

```
{{CONTENT_DIR}}/resume/
  INSTRUCTIONS.md              ← voice guidelines, file conventions
  Resume Working Draft.md      ← your current resume, updated from the graph
  Resume Last Submitted.md     ← frozen copy of what you most recently submitted
```

## What this module does not do

It does not submit your resume anywhere, access job platforms, or connect to any external service. Everything stays in your graph until you copy and paste it yourself.
