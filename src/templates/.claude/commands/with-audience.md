---
patina: managed
---
# /with-audience — Get Your Audience Panel's Reaction

Discovers all audience archetypes in `.claude/agents/`, lets you choose which ones to include, runs each selected one in parallel, and returns a panel table showing how each archetype reacts to your content. Use this to pressure-test a draft, see where you're landing, and identify gaps before you publish or send.

---

## Step 1 — Discover audience archetypes

List all files in `.claude/agents/` whose frontmatter contains `role: audience`. Collect their plain names (the `name:` frontmatter field, or the filename without extension if no `name:` field).

If none are found, say:

> You haven't defined any audience archetypes yet. Run `/audience` to create your first one — try `/audience CFO` or `/audience hiring manager`.

Stop. Do not continue.

---

## Step 2 — Load saved selection

Check whether `.claude/audience-prefs.json` exists.

- **If it exists:** read it. If it is valid JSON with a `defaultAudience` array, use those names as your saved selection. If the file is missing, malformed, or `defaultAudience` is absent or not an array, treat this as a first run (no saved selection).
- **If it does not exist:** treat the saved selection as all discovered archetypes (first run).

---

## Step 3 — Audience selection

Present a multi-select prompt listing each discovered archetype by plain name. Pre-select the saved selection (or all, if no saved selection). Do not show filenames, frontmatter fields, or any technical vocabulary.

Phrase the prompt as:

> Who should read this? (Your last selection is pre-checked — accept to keep it, or change it for this run.)

On first run (no saved selection), phrase it as:

> Who should read this? (All are selected by default.)

Use `AskUserQuestion` with `multiSelect: true`. Each option should be the archetype's plain name. Include all discovered archetypes as options, with the saved selection pre-checked.

If the user selects zero archetypes, say:

> Please select at least one audience member to continue.

And re-present the prompt.

---

## Step 4 — Determine what to evaluate

**If there is active content in the current conversation** (a draft post, resume bullet, talking point, or any text the user has shared this session), use that as the content to evaluate. Confirm briefly: "I'll run this past your audience panel."

**If there is no active content**, ask:

> What would you like to get feedback on? Paste or describe what you want the panel to read.

Wait for the user's response. Do not scan the graph and produce unsolicited content. Do not proceed until you have something concrete to evaluate.

---

## Step 5 — Run the panel in parallel

### Step 5a — Prepare each archetype (resolve context before spawning subagents)

Before invoking any subagent, the parent `/with-audience` session must prepare each selected archetype's content. Do this for every archetype before spawning any of them in parallel.

For each selected archetype:

1. **Check for new-format sections.** Read the archetype file and check whether it contains a `## Personal context` or `## Context sources` section. If neither section is present, this is an old-format archetype — skip all preparation steps below and use the file content as-is. Old archetypes work exactly as before.

2. **Resolve profile vars.** If the archetype body contains any of the five profile token placeholders — `{{ USER_NAME }}`, `{{ USER_TITLE }}`, `{{ ROLE_DESCRIPTION }}`, `{{ COMPANY_NAME }}`, `{{ COMPANY_DESCRIPTION }}` (double curly braces with a space inside) — substitute the live values you know from CLAUDE.md. Do this substitution yourself, in this parent session — do not rely on subagents to resolve these vars. The subagent receives already-resolved text.

3. **Check for unresolved vars.** After substitution, check whether any `{{ UPPERCASE }}` tokens (double curly braces with a space inside) remain in the resolved content. If any do (e.g. a profile field is blank or missing), warn the user before proceeding:

   > Note: [ArchetypeName] has context placeholders that couldn't be resolved — your profile may be missing [field name]. The panel will run but results may be less personalized.

   Then continue — do NOT abort the panel run.

4. **Resolve graph file references.** If the archetype has a `## Context sources` section containing `note:` or `skills:` entries with wiki-link syntax (e.g. `[[project-atlas]]`), read each referenced file:
   - For `note:` entries, look in `{{CONTENT_DIR}}/notes/<name>.md`
   - For `skills:` entries, look in `{{CONTENT_DIR}}/skills/<name>.md`
   - If a referenced file no longer exists, note it gracefully (e.g. "Note: referenced file 'project-atlas' not found — skipping") and continue. Do not error out.
   - Collect the content of all successfully read files. You will include this as additional context in the subagent's prompt alongside the resolved archetype text.

After completing Steps 1–4 for all archetypes, proceed to spawn the subagents in parallel.

### Step 5b — Invoke subagents in parallel

For each **selected** audience archetype, invoke a subagent using the Agent tool. Each subagent:

1. Receives the resolved archetype content (with profile vars substituted and graph file content appended) prepared in Step 5a
2. Evaluates the content from the perspective of that archetype
3. Returns:
   - **Reaction:** exactly one of Positive / Negative / Neutral / Mixed
   - **Key Concerns:** narrative observations from this archetype's perspective
     - Positive or Neutral: up to 1 concern (omit if fully positive)
     - Mixed or Negative: 1–5 concerns, ordered by significance

Run all subagents in parallel. Collect all responses before presenting the table.

---

## Step 6 — Present the panel

Output the results per audience member:

- [Name] — [Positive / Negative / Neutral / Mixed] — [Concern(s)]

For Mixed or Negative results with multiple concerns, list them on separate lines after the entry.

---

## Step 7 — Save the selection

After presenting the panel, write the chosen selection to `.claude/audience-prefs.json`:

```json
{
  "defaultAudience": ["name-one", "name-two"]
}
```

Use the exact plain names from Step 3. Write the file even if the selection matches the previous one.

---

## Step 8 — Continue the conversation

After saving, invite the user to respond:

- If they revise their content and ask to re-run, repeat Steps 4–7 with the updated content (skip the selection prompt; use the current selection).
- If they want to dig into a specific archetype's reaction ("what does the CFO think about the metrics?"), respond in that archetype's voice.
- If they address a concern and ask whether it's resolved, evaluate the revised point from that archetype's perspective.

Stay available for as many rounds as the user needs. Do not summarise and close until the user signals they are done.
