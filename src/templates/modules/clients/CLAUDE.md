---
patina: managed
---
# Clients Module Context

This module holds {{USER_NAME}}'s client relationship records — profiles, engagement histories, deliverables, and notes for freelance, consulting, and advisory work.

## Folder structure

```
{{CONTENT_DIR}}/clients/
  [client-slug]/
    profile.md          — who this client is and relationship context
    engagements/        — bounded project and engagement records (one file per engagement)
    deliverables/       — what was handed over (one file per deliverable or milestone)
    notes/              — ad-hoc relationship notes
    retainer/           — monthly touchpoint records (retainer/advisory engagement types only)
```

## Engagement record fields

Every engagement file starts with an info block. The fields are:

```
type: engagement
client: Client Name
engagement_type: project | retainer | advisory
status: active | complete | paused
private: false          # set to true to flag this record to outbound drafts
started: YYYY-MM-DD
completed: YYYY-MM-DD   # leave blank if ongoing
outcomes:
  # - Add outcomes as they occur, e.g.:
  # - Reduced onboarding time by 40%
  # - Delivered executive recommendation adopted by board
tags: []
```

Note: `outcomes` uses YAML comments for scaffolded examples. Replace commented lines with real entries when outcomes are known, e.g.:
```
outcomes:
  - Reduced onboarding time by 40%
```

## Privacy

You decide what's shareable — patina never blocks client content. Each file carries a `private` flag: `private: false` (the default) is fine for outbound drafts; `private: true` makes outbound modules give **one** heads-up before they use the record, then leave the call to you. Set it on anything under NDA or not yet public — or just tell {{AGENT_DISPLAY_NAME}} to keep a client private and it sets the flag. Notes derived from a `private: true` source inherit the flag. See the **Privacy** section in `{{CONTENT_DIR}}/clients/INSTRUCTIONS.md`.

## Adding a client

To add a client, ask {{AGENT_DISPLAY_NAME}} to scaffold one in your session — provide the client name and engagement type (project, retainer, or advisory) and it will create the folder structure and profile.

## Slash commands

| Command | What it does |
|---------|-------------|
| `/client-check` | Surface a status count of clients and engagement state (runs during `/reflect`) |
