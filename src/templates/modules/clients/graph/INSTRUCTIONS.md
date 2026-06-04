---
date: {{TODAY}}
last-updated: {{TODAY}}
tags: [clients, instructions]
---

# Clients Module Workflow Instructions

Read this file first before working with any files in `{{CONTENT_DIR}}/clients/`. It explains the folder layout, the engagement record fields, how to add and process client content, and the confidential gate that governs what flows to outbound modules.

---

## Folder layout

```
{{CONTENT_DIR}}/clients/
  [client-slug]/          ← one folder per client, created by `patina client add`
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
confidential: true
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

## Confidential gate

<!-- confidential gate: must also appear in linkedin/CLAUDE.md, linkedin/INSTRUCTIONS.md, resume/CLAUDE.md, resume/INSTRUCTIONS.md, clients/CLAUDE.md -->

**This is the source of truth for the confidential gate.**

Files with `confidential: true` in their frontmatter are **NEVER** processed by `/linkedin`, `/resume`, or any outbound module. This is a hard stop.

- Do not summarise, excerpt, or reference confidential content in any output destined for external use.
- When `/inbox` or `/add` processes a file sourced from `clients/`, check its `confidential` field. If `confidential: true`, write `confidential: true` into the frontmatter of every resulting note.
- Outbound modules (`/linkedin`, `/resume`) must skip any note or artifact that has `confidential: true` — regardless of where the file lives.

To unlock a record for outbound use, set `confidential: false` explicitly in its frontmatter. The default for all client files is `confidential: true`.

---

## How to add client content

**New client:** Run `patina client add` to scaffold the folder structure. This creates `profile.md` and the subfolders.

**New engagement:** Create a new `.md` file in `[client-slug]/engagements/` using the info block format above.

**New deliverable:** Create a new `.md` file in `[client-slug]/deliverables/` with a brief description of what was handed over and when.

**Ad-hoc notes:** Drop files into `[client-slug]/notes/` or process via `/inbox`. Notes sourced from confidential clients inherit `confidential: true`.

**Via /add:** Run `/add` and describe the client work. Claude will ask clarifying questions and write the file to the appropriate subfolder.

---

## Extracting skills and notes

Client files are **source material** — do not edit them after the fact. When extracting insights:

1. Read the engagement or deliverable file.
2. Write new files to `{{CONTENT_DIR}}/notes/` (for evidence) or `{{CONTENT_DIR}}/skills/` (for skill inventory updates).
3. Carry the `confidential` flag from the source file into every derived note.
4. Leave the original artifact unchanged.

---

## What not to do

- Do not create flat files directly in `{{CONTENT_DIR}}/clients/` — every client gets its own folder.
- Do not create subfolders inside `engagements/`, `deliverables/`, or `notes/`. Flat is correct.
- Do not strip `confidential: true` from a note unless you have confirmed the source record has been explicitly unlocked.
- Do not use the `type` field for anything other than routing.
