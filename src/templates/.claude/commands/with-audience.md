---
patina: managed
---
# /with-audience — Get Your Audience Panel's Reaction

Discovers all audience archetypes in `.claude/agents/`, runs each one in parallel, and returns a panel table showing how each archetype reacts to your content. Use this to pressure-test a draft, see where you're landing, and identify gaps before you publish or send.

---

## Step 1 — Discover audience archetypes

List all files in `.claude/agents/` whose frontmatter contains `role: audience`.

If none are found, say:

> You haven't defined any audience archetypes yet. Run `/audience` to create your first one — try `/audience CFO` or `/audience hiring manager`.

Stop. Do not continue.

---

## Step 2 — Determine what to evaluate

**If there is active content in the current conversation** (a draft post, resume bullet, talking point, or any text the user has shared this session), use that as the content to evaluate. Confirm briefly: "I'll run this past your audience panel."

**If there is no active content**, ask:

> What would you like to get feedback on? Paste or describe what you want the panel to read.

Wait for the user's response. Do not scan the graph and produce unsolicited content. Do not proceed until you have something concrete to evaluate.

---

## Step 3 — Run the panel in parallel

For each discovered audience archetype, invoke a subagent using the Agent tool. Each subagent:

1. Reads the archetype's agent file from `.claude/agents/`
2. Evaluates the content from the perspective of that archetype
3. Returns:
   - **Reaction:** exactly one of Positive / Negative / Neutral / Mixed
   - **Key Concerns:** narrative observations from this archetype's perspective
     - Positive or Neutral: up to 1 concern (omit if fully positive)
     - Mixed or Negative: 1–5 concerns, ordered by significance

Run all subagents in parallel. Collect all responses before presenting the table.

---

## Step 4 — Present the panel

Output the results as a table:

| Audience | Reaction | Key Concerns |
|----------|----------|-------------|
| [Name] | [Positive / Negative / Neutral / Mixed] | [Concern(s)] |

For Mixed or Negative rows with multiple concerns, list them as separate lines or a short bulleted list within the cell.

---

## Step 5 — Continue the conversation

After presenting the panel, invite the user to respond:

- If they revise their content and ask to re-run, repeat Steps 2–4 with the updated content.
- If they want to dig into a specific archetype's reaction ("what does the CFO think about the metrics?"), respond in that archetype's voice.
- If they address a concern and ask whether it's resolved, evaluate the revised point from that archetype's perspective.

Stay available for as many rounds as the user needs. Do not summarise and close until the user signals they are done.
