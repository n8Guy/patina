---
date: {{TODAY}}
last-updated: {{TODAY}}
tags: [clients, instructions]
---

# Clients Module Workflow Instructions

Read this file first before working with any files in `{{CONTENT_DIR}}/clients/`. It explains the folder layout, the engagement record fields, how to add and process client content, and the `private` flag that flags sensitive records to outbound modules.

---

## Folder layout

```
{{CONTENT_DIR}}/clients/
  [client-slug]/          ← one folder per client
    profile.md            ← who this client is and relationship context
    engagements/          ← bounded project and engagement records
    deliverables/         ← what was handed over
    notes/                ← ad-hoc relationship notes
    retainer/             ← monthly touchpoint records (retainer/advisory types only)
```

---

## Engagement record info block

Every file in `engagements/` starts with an info block. Use this exact format:

```
---
type: engagement
client: Client Name
engagement_type: project | retainer | advisory
status: active | complete | paused
private: false
started: YYYY-MM-DD
completed: YYYY-MM-DD   # leave blank if ongoing
outcomes:
  # - Add outcomes as they occur, e.g.:
  # - Reduced onboarding time by 40%
  # - Delivered executive recommendation adopted by board
tags: []
---
```

**Outcomes field:** Scaffold with YAML comments as shown above. Replace commented lines with real bullet entries once outcomes are known. Do not use `outcomes: []` — commented examples are the correct placeholder.

---

## Privacy — the `private` flag

Client work is often sensitive, but **you** decide what's shareable — patina never blocks it. Each client file carries a `private` flag in its frontmatter:

- `private: false` (the default) — fine to draw on for LinkedIn, resume, and other outbound drafts.
- `private: true` — outbound modules give you a heads-up before using it, so you can confirm you're cleared to share. They won't block it; the call is yours.

Set `private: true` on any record you want flagged — a client under NDA, unreleased work, anything not yet public. You can also just tell {{AGENT_DISPLAY_NAME}} ("keep the Acme work private") and it will set the flag for you.

When a note is derived from a `private: true` source, carry `private: true` onto the derived note too, so the flag follows the evidence.

---

## How to add client content

**New client:** Ask {{AGENT_DISPLAY_NAME}} to scaffold one — provide the client name and engagement type and it will create the folder structure and profile.

**New engagement:** Create a new `.md` file in `[client-slug]/engagements/` using the info block format above.

**New deliverable:** Create a new `.md` file in `[client-slug]/deliverables/` with a brief description of what was handed over and when.

**Ad-hoc notes:** Drop files into `[client-slug]/notes/` or process via `/inbox`. Notes derived from a `private: true` source inherit `private: true`.

**Via /add:** Run `/add` and describe the client work. {{AGENT_DISPLAY_NAME}} will ask clarifying questions and write the file to the appropriate subfolder.

---

## Extracting skills and notes

Client files are **source material** — do not edit them after the fact. When extracting insights:

1. Read the engagement or deliverable file.
2. Write new files to `{{CONTENT_DIR}}/notes/` (for evidence) or `{{CONTENT_DIR}}/skills/` (for skill inventory updates).
3. If the source is marked `private: true`, carry that flag onto every derived note.
4. Leave the original artifact unchanged.

---

## What not to do

- Do not create flat files directly in `{{CONTENT_DIR}}/clients/` — every client gets its own folder.
- Do not create subfolders inside `engagements/`, `deliverables/`, or `notes/`. Flat is correct.
- Do not strip `private: true` from a note unless the user has confirmed the work is now shareable.
- Do not use the `type` field for anything other than routing.
