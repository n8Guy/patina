---
patina: managed
---
# /client-check — Clients Module Reflect Hook

You are running as part of `/reflect`. Scan the clients folder and surface a brief status of client relationships and engagement state.

## What to check

1. List all client folders in `{{CONTENT_DIR}}/clients/` (skip any entry whose name starts with `.`).

2. For each client folder, read `profile.md` for the client name and `private` status.

3. For each client, scan the `engagements/` subfolder and note:
   - Total engagement count (skip any entry whose name starts with `.`)
   - Status of each engagement (`active`, `complete`, `paused`) from the `status` field in the info block

4. Note whether the client has any `deliverables/` files (count, skip any entry whose name starts with `.`).

## What to report

Surface a one-line summary per client — name, active/complete engagement counts, and deliverable count. Skip clients with no files beyond `.gitkeep`.

Example output:
```
Clients: Cedar Health (1 active engagement, 2 deliverables) · Northwind Freight (1 complete engagement, 1 deliverable)
```

If the clients folder is empty or contains only hidden entries (names starting with `.`), say: "Clients module is installed but no clients yet — ask Claude to add a client to get started."

Keep the output brief. This is a status check, not a review.
