---
patina: managed
---
Mark a LinkedIn draft as posted and move it to the posted folder.

## Identify the draft

Look at the user's message after `/li-post`:

- **If the message names a specific file** (e.g. `my-draft-slug` or `my-draft-slug.md`): use that file from `{{CONTENT_DIR}}/linkedin/activity/drafts/`.
- **If the message is empty or ambiguous**: list all files in `{{CONTENT_DIR}}/linkedin/activity/drafts/` and ask the user which one to post.

## Guard

- If `{{CONTENT_DIR}}/linkedin/activity/drafts/` is empty, stop and say so. Do not continue.
- If the named draft file does not exist in `drafts/`, stop and say so. Do not continue.
- Do not create a file in `posted/` unless the source file exists in `drafts/`.

## Move the file

1. Create the directory `{{CONTENT_DIR}}/linkedin/activity/posted/` if it does not exist.
2. Read the draft file from `{{CONTENT_DIR}}/linkedin/activity/drafts/<name>.md`.
3. Update the frontmatter:
   - Change `status: draft` to `status: posted`
   - Add `posted_at: <ISO datetime from session context>` — use the actual current datetime from your session context, not a frozen token. Format: `YYYY-MM-DDTHH:MM:SS` or `YYYY-MM-DD` if time is not available.
   - Preserve `type` and `created_at` exactly as they are.
4. Write the updated file to `{{CONTENT_DIR}}/linkedin/activity/posted/<name>.md`.
5. Delete the original file from `{{CONTENT_DIR}}/linkedin/activity/drafts/<name>.md`. If the original still exists in `drafts/` after the write, delete it now — this ensures a partially interrupted move can be re-run cleanly.

Do NOT touch `LinkedIn Activity.md`.

## Confirm

Report:
1. The old path (`activity/drafts/<name>.md`)
2. The new path (`activity/posted/<name>.md`)
3. The `posted_at` value that was stamped
