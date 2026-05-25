Refresh all LinkedIn proposal sections based on the current state of your graph.

This is a bulk refresh — not a targeted edit. The goal is to make sure every `## Proposed` section across all LinkedIn files accurately reflects what's in your graph right now. Run this after adding new notes or whenever your graph has changed.

## Mode detection

Check `$ARGUMENTS` before doing anything else.

**Full refresh (default — no arguments):** Bulk reconciliation against all graph sources. Follow all steps below.

**Prompt-only (arguments provided, no `--light` flag):** A refinement directive was passed (e.g. `/li-all make the tone more direct`). Skip Step 2 — do NOT read notes or skills. Load only the LinkedIn context (Step 1) and the six proposal files (Step 3). Apply the prompt as a style or phrasing directive across all six sections. Do not change the substance of any proposal unless the prompt explicitly asks for it. Still run Steps 4 and 5.

**Light mode (`--light` flag present):** Same as prompt-only but explicit. Strip `--light` from the arguments and treat the remainder as the refinement directive. If no other arguments remain, apply a general phrasing and consistency pass using the voice guidelines from `INSTRUCTIONS.md`. Skip Step 2.

---

## Step 1 — Load the LinkedIn context

Read these two files first:
- `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md` — voice guidelines, identity context, file conventions, and what NOT to do
- `{{CONTENT_DIR}}/linkedin/LinkedIn Current State.md` — what is actually live on the profile today

## Step 1b — Load the exclusion list

Read `{{CONTENT_DIR}}/notes/exclusions.md`. Extract all excluded items. Throughout this entire workflow, any claim, skill, project, or technology that matches an excluded item must be removed from proposals — even if it appears in a grounding source. The exclusion list overrides everything.

## Step 2 — Load all grounding sources

Read every file in these folders:

**Notes** — `{{CONTENT_DIR}}/notes/`
Read all files except `README.md` and `exclusions.md`. These are manually authored notes covering skills, projects, prior-role work, and anything else the user has added. Treat them as first-class evidence.

**Skills** — `{{CONTENT_DIR}}/skills/`
Read all skill notes. These are the evidence-backed capability descriptions synthesised from notes.

## Step 3 — Refresh each proposal

Work through all six proposal files in order. For each one:

1. Read the current `## Proposed` section
2. Compare it against what you now know from the grounding sources
3. Ask: what's new in the graph that isn't reflected here? What's in the proposal that isn't backed by evidence? What's stale or could be more specific?
4. Rewrite `## Proposed` to reflect the best current version — grounded in graph evidence, in the voice defined in `INSTRUCTIONS.md`
5. Update `last-updated` in front matter to today's date
6. Add a row to `## Changelog`: today's date + a one-sentence summary of what changed and why

**Sections to update (in this order):**
- `{{CONTENT_DIR}}/linkedin/LinkedIn About.md`
- `{{CONTENT_DIR}}/linkedin/LinkedIn Headline.md`
- `{{CONTENT_DIR}}/linkedin/LinkedIn Experience.md`
- `{{CONTENT_DIR}}/linkedin/LinkedIn Skills.md`
- `{{CONTENT_DIR}}/linkedin/LinkedIn Featured.md`
- `{{CONTENT_DIR}}/linkedin/LinkedIn Activity.md`

**For LinkedIn Skills.md specifically:** cross-reference the `{{CONTENT_DIR}}/skills/` notes against the proposed skills list. Add any skills that now have graph evidence and aren't listed. Remove or downgrade any that lack evidence.

## Step 4 — Report

After updating all six files, give a summary of what changed:

- **About**: [what changed, or "no changes needed"]
- **Headline**: [what changed, or "no changes needed"]
- **Experience**: [what changed, or "no changes needed"]
- **Skills**: [skills added / removed / reordered, or "no changes needed"]
- **Featured**: [what changed, or "no changes needed"]
- **Activity**: [what changed, or "no changes needed"]

Flag anything notable: accomplishments that are well-evidenced but not yet surfaced, or gaps where the graph suggests a capability the proposals don't mention.
