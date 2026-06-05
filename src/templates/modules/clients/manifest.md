---
name: clients
label: Clients
reflect_hook: client-check
description: Track freelance, consulting, and advisory client relationships with confidentiality controls
installed: {{TODAY}}
---

# Clients Module

A relationship record system for freelance, consulting, and advisory engagements. Each client gets a dedicated folder with a profile, engagement records, deliverables, and notes.

Content is **confidential by default** — set `confidential: false` on a record to allow it to flow into LinkedIn or resume drafts.

## How it works

Run `patina client add` to scaffold a new client folder. Drop engagement notes and deliverables into the appropriate subfolders, then use `/add` to extract skills and notes from them.

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

## Confidential content

Files with `confidential: true` are **never** processed by `/linkedin`, `/resume`, or any outbound module. Set `confidential: false` explicitly to unlock a record for outbound use.
