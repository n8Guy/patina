---
patina: managed
---
Refine the LinkedIn Featured section or draft a post to pin.

## Context to load first
1. Read `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md` — voice guidelines, identity context, and file conventions
2. Read `{{CONTENT_DIR}}/linkedin/LinkedIn Current State.md` — what's actually live today
3. Read `{{CONTENT_DIR}}/linkedin/LinkedIn Featured.md` — the current draft

## Apply the refinement
The user's message after `/li-featured` is the direction. It may be:
- A request to update what's pinned ("pin my latest post", "remove the old article")
- A request to draft a new post suitable for pinning

**Pinned content** should have a long shelf life — avoid anything tied to a specific quarter, news cycle, or in-progress project. Pin things that will still be relevant in six months.

**Posts drafted for Featured** can be more timely — a specific decision, launch, or lesson learned is fine. Ground every claim in graph notes.

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
- Edit `## Proposed` in `LinkedIn Featured.md`
- Update `last-updated` in front matter to today's date
- Add a row to `## Changelog` with today's date and what changed

Show the revised content in full, followed by 2–3 sentences explaining the key changes.
