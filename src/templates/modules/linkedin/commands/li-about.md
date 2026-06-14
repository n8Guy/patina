---
patina: managed
---
Refine the LinkedIn About section.

## Context to load first
1. Read `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md` — voice guidelines, identity context, and file conventions
2. Read `{{CONTENT_DIR}}/linkedin/LinkedIn Current State.md` — what's actually live today
3. Read `{{CONTENT_DIR}}/linkedin/LinkedIn About.md` — the current draft
4. Read each note in the `based-on` front matter of `LinkedIn About.md`

## Apply the refinement
The user's message after `/li-about` is the refinement direction. Apply it to the `## Proposed` section only.

Voice: direct, specific, no buzzwords. Every claim must trace to a graph note. LinkedIn truncates About at ~300 chars before "see more" — the opening two sentences carry the most weight.

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
- Edit only `## Proposed` in `LinkedIn About.md`
- Update `last-updated` in front matter to today's date
- Add a row to `## Changelog` with today's date and what changed

Show the revised `## Proposed` in full, followed by 2–3 sentences explaining the key changes.
