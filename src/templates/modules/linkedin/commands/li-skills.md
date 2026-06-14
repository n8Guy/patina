---
patina: managed
---
Refine the LinkedIn Skills list.

## Context to load first
1. Read `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md` — voice guidelines, identity context, and file conventions
2. Read `{{CONTENT_DIR}}/linkedin/LinkedIn Current State.md` — what's actually live today
3. Read `{{CONTENT_DIR}}/linkedin/LinkedIn Skills.md` — the current draft
4. Read each note in the `based-on` front matter of `LinkedIn Skills.md`

## Apply the refinement
The user's message after `/li-skills` is the refinement direction. Apply it to the `## Proposed Skills` section only.

LinkedIn allows up to 50 skills — aim for the most evidence-backed ones. Every skill should map to a note in `{{CONTENT_DIR}}/skills/`. If the user wants to add a skill with no graph evidence, flag it rather than adding it.

## Review for AI patterns

Skills are a keyword list — the patterns below apply to any accompanying narrative (rationale text, changelog entries), not to the skill keywords themselves. Before writing the file, re-read the draft you just produced and scan any prose sections against the anti-AI patterns in `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md`. Fix every occurrence in place:

- Em dashes (—) → comma, period, or parentheses
- AI vocabulary (pivotal, testament, landscape, delve, showcase, underscore, foster, garner, vibrant, robust, leverage, etc.) → plain words
- Promotional language (groundbreaking, boasts, nestled, breathtaking, renowned, world-class, passionate about, results-driven, etc.) → cut or state plainly
- Rule of three (forced groups of three) → keep only what the evidence supports
- Superficial -ing tails ("highlighting that...", "ensuring...", "reflecting...") → cut or fold into a real clause
- Negative parallelisms ("not just X, but Y") → plain statement
- Passive voice where active is clearer → active voice

Only continue to the write step once the draft is clean.

## Write the updated file
- Edit only `## Proposed Skills` in `LinkedIn Skills.md`
- Update `last-updated` in front matter to today's date
- Add a row to `## Changelog` with today's date and what changed

Show the revised skills list in full, followed by 2–3 sentences explaining the changes.
