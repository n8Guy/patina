---
patina: managed
---
# Reflect — Review Your Graph

Steps back and looks at everything you've captured to surface what's missing, what's grown since you last looked, and what might be out of date. Runs automatically after `/add`, or on its own as a full review.

## When called with an argument

The argument is a note slug (e.g. `/reflect figma`). Scope the review to that note plus any related existing notes and skills — look for connections, not just the note in isolation.

## When called with no argument

Full review across all notes and skills.

---

## Step 1 — Read the graph

Read in parallel:

- All files in `{{CONTENT_DIR}}/notes/` (skip `README.md` and `exclusions.md`)
- All files in `{{CONTENT_DIR}}/skills/`
- `{{CONTENT_DIR}}/notes/exclusions.md` — nothing matching an excluded item should ever become a skill

---

## Step 2 — Look for four types of signals

### A. Things you've finished (highest priority)

Look for notes that describe something as "in progress", "building", or "planning" where newer notes suggest it's now done or shipped.

- Flag it: "Your `client-portal` note says you're *building* this. Is it done?"
- If confirmed: update the note to past tense, strengthen the skill's evidence.

### B. Skills that haven't been written up yet

Look for notes tagged `[skill]` with no corresponding file in `{{CONTENT_DIR}}/skills/`. Also look for strong signal in untagged notes — recurring tools, patterns, or methods that appear more than once.

- Ask questions only if something is genuinely weak or missing.

### C. Things that could be connected

Look for two or more notes that cover the same subject where one has evidence the other lacks.

- Don't merge notes — suggest adding a cross-reference link, or adding evidence from one into a skill that covers the same domain.

### D. Things that might be out of date

Look for skill files where `last_seen` is more than 90 days older than today. Surface them — never delete automatically.

- "This skill hasn't appeared in your recent notes — still something you're doing?"

---

## Step 3 — Share what you found

If there are no findings, say so clearly and stop.

If there are findings, present them grouped by type in priority order (A → B → C → D). For each finding:

- State what was found in one sentence
- Ask only the question needed to resolve it
- Quote the note language that triggered it

Lead with A and B. Resolve those before moving to C and D.

---

## Step 4 — Act on the answers

**Finished:** Update the note to past tense. Strengthen the skill's evidence. Update `last_seen`.

**Skill not yet written up — ready:** Write the skill file to `{{CONTENT_DIR}}/skills/<slug>.md`. Link back to the source note via `[[wiki-link]]`. Do NOT delete the source note.

**Skill not yet written up — needs more info:** Ask, then write once answered.

**Connection found:** Add the cross-reference to the relevant note or skill.

**Out of date — still active:** No action needed.

**Out of date — no longer active:** Flag it. Tell the user: "I'll leave `{{CONTENT_DIR}}/skills/<slug>.md` in place — delete it when ready."

---

## Step 5 — Discover and run module hooks

1. List all files matching `.claude/modules/*/manifest.md` (relative to the project root)
2. For each file, read the frontmatter and extract `reflect_hook`
3. Run each hook in sequence

This step is mandatory — do not skip it even if there were no findings. New modules are picked up automatically here; nothing in this file needs to change when a module is added or removed.

---

## Skill file format

```markdown
---
date: YYYY-MM-DD
type: skill
last_seen: YYYY-MM-DD
---

## <Skill Name>

<1–2 sentences: what they do with this skill, specific and in their voice. No buzzwords.>

### Evidence
- [[<note-slug>]] — <most compelling evidence point>
- [[<source-slug>]] — <second evidence point if warranted>
```

---

## Notes

- Today's date is available in your system context as `currentDate`
- Never delete notes — they are persistent evidence artifacts
- Never delete skill files automatically — always surface to the user first
- Even when called with a scoped argument, check for related content broadly
