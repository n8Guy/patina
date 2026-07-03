---
patina: managed
name: work
label: Work
reflect_hook: work-check
description: A private space for your professional work artifacts
commands:
  - name: /work-check
    desc: Status count of artifacts across each work subfolder (no input needed — runs during /reflect too)
installed: "{{TODAY}}"
---

# Work Module

A private holding area for raw professional artifacts — meeting transcripts, weekly summaries, and reference documents. Use this module to capture the raw material of your working life before it gets synthesised into skills and notes via `/add`.

## How it works

Drop files into `inbox/` and process them with `/inbox`. Artifacts are routed to the correct subfolder in `{{CONTENT_DIR}}/work/` per `{{AGENT_DIR}}/inbox-routing.md`. You can also add context directly by running `/add` and describing something you've worked on.

Your `{{CONTENT_DIR}}/work/profile.md` is a standing document about how you work in your role. Update it when your responsibilities, team, or focus changes.

## File layout

```
{{CONTENT_DIR}}/work/
  INSTRUCTIONS.md     ← workflow guide for {{AGENT_DISPLAY_NAME}}
  profile.md          ← how you work in your role
  transcripts/        ← meeting transcripts (one file per meeting)
  weeklies/           ← periodic activity summaries
  references/         ← supporting documents and context
```

## What this module does not do

This module stores artifacts locally. It does not connect to any calendar, email, or external service. Supporting document extraction (PDF → MD, PPTX → MD) is handled separately.
