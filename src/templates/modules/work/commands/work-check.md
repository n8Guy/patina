---
patina: managed
---
# /work-check — Work Module Reflect Hook

You are running as part of `/reflect`. Scan the work artifact folders and surface a brief status.

## What to check

1. Read `{{CONTENT_DIR}}/work/INSTRUCTIONS.md` for context on the folder structure.

2. List all files in each subfolder, skipping any entry whose name starts with `.`:
   - `{{CONTENT_DIR}}/work/transcripts/`
   - `{{CONTENT_DIR}}/work/weeklies/`
   - `{{CONTENT_DIR}}/work/references/`

3. For each subfolder, note the count of files and the most recent date (from the `date` field in the info block at the top of each file, or from the filename if no info block is present).

## What to report

Surface a one-line summary per subfolder — count and most recent date. If a subfolder is empty, say so.

Example output:
```
Work artifacts: transcripts (3, latest 2026-05-14) · weeklies (2, latest 2026-05-10) · references (1, latest 2026-04-22)
```

If all subfolders are empty, say: "Work module is installed but no artifacts yet — drop files into `inbox/` to get started."

Keep the output brief. This is a status check, not a review.
