Refresh the resume working draft based on the current state of your graph.

This is a bulk refresh — the goal is to make sure `Resume Working Draft.md` accurately reflects everything in your graph right now. Run this after adding new notes or whenever your graph has changed significantly.

---

## Step 1 — Load resume context

Read these files first:
- `{{CONTENT_DIR}}/resume/INSTRUCTIONS.md` — voice guidelines, identity context, file conventions, and what NOT to do
- `{{CONTENT_DIR}}/resume/Resume Working Draft.md` — the current draft

## Step 2 — Load the exclusion list

Read `{{CONTENT_DIR}}/notes/exclusions.md`. Extract all excluded items. Throughout this entire workflow, any claim, skill, project, or technology that matches an excluded item must not appear in the resume — even if it appears in a grounding source. The exclusion list overrides everything.

## Step 3 — Load all grounding sources

Read every file in these folders:

**Notes** — `{{CONTENT_DIR}}/notes/`
Read all files except `README.md` and `exclusions.md`. These are manually authored notes covering skills, projects, prior-role work, and anything else the user has added. Treat them as first-class evidence.

**Skills** — `{{CONTENT_DIR}}/skills/`
Read all skill notes. These are the evidence-backed capability descriptions synthesised from notes.

## Step 4 — Refresh the working draft

Compare the current draft against everything you now know from the grounding sources. Ask:
- What's new in the graph that isn't reflected in the draft?
- What's in the draft that isn't backed by evidence?
- What's stale or could be more specific?

Rewrite `Resume Working Draft.md` to reflect the best current version — every claim grounded in graph evidence, in the voice defined in `INSTRUCTIONS.md`.

Update `last-updated` in the front matter to today's date. Add a row to `## Changelog` with today's date and a one-sentence summary of what changed.

## Step 5 — Report

After updating the file, give a summary of what changed:

- **Summary**: [what changed, or "no changes needed"]
- **Experience**: [what changed, or "no changes needed"]
- **Skills**: [what changed, or "no changes needed"]
- **Education**: [what changed, or "no changes needed"]

Flag anything notable: accomplishments that are well-evidenced but not yet surfaced, or gaps where the graph suggests a capability the draft doesn't mention.
