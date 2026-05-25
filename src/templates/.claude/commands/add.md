# Add Something to Your Graph

You want to add a skill, project, technology, or experience to your graph that isn't already captured there. This creates an evidence-backed note in `{{CONTENT_DIR}}/notes/` that feeds into your skills inventory and any active modules.

## Step 1 — Read the prompt

The user's message after `/add` describes what to add. It may be brief ("Figma") or already detailed. Read it before asking anything.

## Step 2 — Ask clarifying questions

Ask all of the following at once — not one at a time. Skip any the user already answered in their prompt.

1. **Where** — What context did you use this in? (employer, personal project, freelance work, side project, open source, etc.) Name the context specifically.
2. **How long** — Roughly how long have you been working with this? Is it current, something from a past role, or ongoing across multiple contexts?
3. **What you did** — What specifically did you build, decide, lead, or create using this? One or two concrete examples — the more specific the better.
4. **Depth** — How would you describe your level? For example: I use this daily / I make decisions with it / I could teach it / I'm still learning / I've shipped real work with it.
5. **Outcomes** — Any notable results? Shipped product, happy client, performance improvement, team adoption, cost saved, award, etc.

## Step 3 — Write the note

Using the prompt and answers, write a note to `{{CONTENT_DIR}}/notes/`. Write it, then show it — don't ask for confirmation first.

**Filename:** `<slug>.md` using only the skill or subject name (e.g. `figma.md`, `client-onboarding.md`). No date prefix. The `date:` front matter captures when it was written.

**Format:**

```markdown
---
date: YYYY-MM-DD
type: note
tags: [skill]
---

## <Subject Name>

<2–3 sentences describing it based on what the user shared. Specific, no buzzwords, in their voice.>

### Evidence
- <Context> — <what was built, decided, or done; outcome if known>
- <Another context if applicable> — <specific detail>

### Context
- **Experience level:** <in the user's words>
- **Current or prior:** <current | prior | both>
```

## Step 4 — Run reflect

After writing the note, immediately run `/reflect <slug>` scoped to the new note. Don't announce it — just do it and present the findings naturally.

## Notes

- The Evidence section is the most important part — one specific example beats three vague ones
- If the user gives a very sparse answer and something is genuinely unanswerable, omit that field rather than padding with generic language
- If the user mentions multiple distinct skills in one `/add`, write a separate note for each
- Never delete a note — notes are persistent evidence
