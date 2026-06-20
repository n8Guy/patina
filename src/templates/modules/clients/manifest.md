---
patina: managed
name: clients
label: Clients
reflect_hook: client-check
description: Track freelance, consulting, and advisory client relationships, with privacy you control
commands:
  - name: /client-check
    desc: Status count of clients and their engagement state (no input needed — runs during /reflect too)
installed: {{TODAY}}
---

# Clients Module

A relationship record system for freelance, consulting, and advisory engagements. Each client gets a dedicated folder with a profile, engagement records, deliverables, and notes.

Records are **shareable by default** — set `private: true` on anything sensitive and outbound drafts (LinkedIn, resume) will give you a heads-up before using it. They never block; the call is yours.

## How it works

Ask {{AGENT_DISPLAY_NAME}} to add a client in your session — provide the name and engagement type and it will scaffold the folder. Drop engagement notes and deliverables into the appropriate subfolders, then use `/add` to extract skills and notes from them.

## File layout

```
{{CONTENT_DIR}}/clients/
  [client-slug]/
    profile.md          ← who this client is and relationship context
    engagements/        ← bounded project and engagement records
    deliverables/       ← what was handed over
    notes/              ← ad-hoc relationship notes
    retainer/           ← monthly touchpoint records (retainer/advisory only)
```

## Privacy

You decide what's shareable — patina never blocks client content. Mark a record `private: true` and outbound modules will warn once before using it, then leave the call to you. See the **Privacy** section in the module's `INSTRUCTIONS.md`.
