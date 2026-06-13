# Process Your Inbox

Loops through every file dropped in `inbox/` and runs the full `/add` flow on each one — deriving notes automatically from each file's content without stopping for per-file confirmation gates.

## Step 1 — Read the registry

Read `inbox/.processed.json`. If the file is missing or cannot be parsed as JSON, treat it as an empty array `[]`.

## Step 2 — Identify unprocessed files

List all files in `inbox/`, excluding any file or directory whose name starts with `.` (this covers `.gitkeep`, `.processed.json`, and any hidden sync scaffolding such as `.tmp.drivedownload/`), and also excluding the `archive/` directory and its contents. Apply the dot-entry exclusion recursively — do not traverse into any directory whose name starts with `.`.

A file is **unprocessed** if its path relative to `inbox/` (e.g. `doc.pdf`, or `2026-05/doc.pdf` for a subdirectory) does not appear in the registry with status `success`. Files recorded with status `failed` are retried.

## Step 3 — Process each file

For each unprocessed file, run the `/add` flow — read the file contents and derive note(s). Write them to `{{CONTENT_DIR}}/notes/`. Use the file's content directly to fill in the `/add` fields (context, depth, evidence, outcomes) without pausing to ask for per-file confirmation before you start each file.

Ask clarifying questions only when the file content genuinely cannot answer a required field. Batch any questions together and ask them for the current file before moving to the next.

Collect every note path written for the file into an array (`resulting_note_paths`). A single note still goes into a one-element array.

## Step 4 — Update the registry after each file

After processing each file, append or update its entry in the registry array. Write the updated array back to `inbox/.processed.json` as pretty-printed JSON after each file so progress is saved if interrupted.

Each registry entry has this shape:

```json
{
  "filename": "doc.pdf",
  "status": "success",
  "processed_at": "2026-01-15T09:32:00.000Z",
  "resulting_note_paths": ["{{CONTENT_DIR}}/notes/doc.md"]
}
```

For files in subdirectories, `filename` is the path relative to `inbox/` — e.g. `"filename": "2026-05/meeting-notes.md"`.

- `filename` — path relative to `inbox/` (basename for top-level files; `subdir/name` for nested files)
- `status` — `success` or `failed`
- `processed_at` — ISO 8601 timestamp
- `resulting_note_paths` — always an array, even for a single note

`failed` means `/add` errored; the file will be retried on the next run.

## Step 5 — Offer to archive source files

After all files have been processed, ask:

> All files processed. Would you like to move the source files to `inbox/archive/`? (default: keep in place)

Wait for the user's response. **Default is to keep files in place** — patina never deletes source files. If the user says yes, move each file that was processed in this session from `inbox/` to `inbox/archive/`, preserving any subdirectory structure (e.g. `inbox/2026-05/doc.pdf` → `inbox/archive/2026-05/doc.pdf`). Create `inbox/archive/` and any subdirectories as needed. Registry entries remain regardless of what the user decides. Never move hidden files or directories (any entry whose name starts with `.`) — only move files that were actually processed in this session.

## Edge cases

- Files listed in the registry with status `success` but no longer present on disk are silently ignored — do not error or re-process them.
- Never re-process a file recorded as `success` unless the user drops it again.
- `resulting_note_paths` is always an array — never a bare string.
- Never process hidden files or directories (any entry whose name starts with `.`), including `.gitkeep` and `.processed.json`. This rule applies recursively.
- Never process files inside `inbox/archive/` — that directory is excluded from Step 2.
- If a file already exists at its archive destination, keep both by appending a numeric suffix (e.g. `doc-2.pdf`) rather than overwriting.
