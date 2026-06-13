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

## Step 5 — Archive source files

After all files have been processed, silently move each file whose registry entry has `status: "success"` from `inbox/` to `inbox/archive/`, preserving any subdirectory structure (e.g. `inbox/2026-05/doc.pdf` → `inbox/archive/2026-05/doc.pdf`). Create `inbox/archive/` and any subdirectories as needed. Never move hidden files or directories (any entry whose name starts with `.`). Leave files with `status: "failed"` in place — they will be retried on the next run.

After moving each file, update its registry entry: change `filename` from the original relative path (e.g. `doc.pdf`, or `2026-05/doc.pdf` for subdirectory files) to the archive-relative path (e.g. `archive/doc.pdf`, or `archive/2026-05/doc.pdf`) so the registry reflects where the file actually is, and so a re-dropped file with the same name is treated as a new file to process.

Report the outcome in a single line: `Moved N files to inbox/archive/.`

## Edge cases

- Files listed in the registry with status `success` but no longer present on disk are silently ignored — do not error or re-process them.
- Never re-process a file recorded as `success` unless the user drops it again.
- `resulting_note_paths` is always an array — never a bare string.
- Never process hidden files or directories (any entry whose name starts with `.`), including `.gitkeep` and `.processed.json`. This rule applies recursively.
- Never process files inside `inbox/archive/` — that directory is excluded from Step 2.
- If a file already exists at its archive destination, keep both by appending a numeric suffix (e.g. `doc-2.pdf`) rather than overwriting.
- If a file was moved to `inbox/archive/` but its registry `filename` was not yet updated (interrupted session), the entry still shows `status: "success"` under the original path, so it will never be re-scanned or re-processed — the stale path is harmless.
