---
patina: managed
---
Update your LinkedIn posting strategy or draft a post.

## Context to load first
1. Read `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md` — voice guidelines, identity context, and file conventions
2. Read `{{CONTENT_DIR}}/linkedin/LinkedIn Activity.md` — the current posting strategy and post candidates

## Check for stale drafts

After loading context, scan `{{CONTENT_DIR}}/linkedin/activity/drafts/` for files that have not been modified in more than 14 days. If the directory does not exist or is empty, skip this step silently.

If any stale drafts are found, surface them before continuing:

> "These drafts have been sitting for over 14 days — did you post any of them? If so, run `/li-post <name>`."
> - `<filename>` (last modified: <date>)

Only scan `activity/drafts/`. Do NOT scan `LinkedIn Activity.md` for staleness. Do NOT scan `activity/posted/`.

This is a nudge only — do not block the user. Continue with the rest of the command after surfacing any stale drafts.

## Apply the direction
The user's message after `/li-activity` is the direction. It may be:
- A request to update the posting strategy ("post more about leadership", "focus on my freelance work")
- A request to draft a specific post ("write a post about the project I just finished")

**The strategy is evergreen** — post types, cadence, and voice guidelines don't change week to week.

**Post candidates are timely** — specific things to write about rotate as new graph content arrives.

When drafting a post, ground every claim in graph notes. Voice: direct, specific, no buzzwords — the same voice that appears in the rest of the LinkedIn profile.

## Review for AI patterns

Before writing the file, re-read the draft you just produced and scan it against the anti-AI patterns in `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md`. Fix every occurrence in place:

- Em dashes (—) → comma, period, or parentheses
- AI vocabulary (pivotal, testament, landscape, delve, showcase, underscore, foster, garner, vibrant, robust, leverage, etc.) → plain words
- Promotional language (groundbreaking, boasts, nestled, breathtaking, renowned, world-class, passionate about, results-driven, etc.) → cut or state plainly
- Rule of three (forced groups of three) → keep only what the evidence supports
- Superficial -ing tails ("highlighting that...", "ensuring...", "reflecting...") → cut or fold into a real clause
- Negative parallelisms ("not just X, but Y") → plain statement
- Passive voice where active is clearer → active voice

Only continue to the write step once the draft is clean.

## Write the updated file
- Edit `LinkedIn Activity.md` — update strategy or add a post candidate / draft
- Update `last-updated` in front matter to today's date
- Add a row to `## Changelog` with today's date and what changed

Show what changed, followed by 2–3 sentences explaining the direction taken.
