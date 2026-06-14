---
patina: managed
---
Refine the LinkedIn Experience section.

## Context to load first
1. Read `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md` — voice guidelines, identity context, and file conventions
2. Read `{{CONTENT_DIR}}/linkedin/LinkedIn Current State.md` — what's actually live today
3. Read `{{CONTENT_DIR}}/linkedin/LinkedIn Experience.md` — the current draft
4. Read each note in the `based-on` front matter of `LinkedIn Experience.md`

## Apply the refinement
The user's message after `/li-experience` is the refinement direction. Apply it to the `## Proposed` section only.

Experience bullets describe patterns, not one-off tasks. Completed work uses past tense with context; ongoing work uses present tense without time markers. The notes in `{{CONTENT_DIR}}/notes/` are the source for specific accomplishments — check there if the user wants to add something.

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
- Edit only the proposed content in `LinkedIn Experience.md`
- Update `last-updated` in front matter to today's date
- Add a row to `## Changelog` with today's date and what changed

Show the revised content in full, followed by 2–3 sentences explaining the key changes.
