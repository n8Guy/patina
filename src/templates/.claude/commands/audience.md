---
patina: managed
---
# /audience — Create or Edit an Audience Archetype

Defines a role archetype that `/with-audience` can consult when reviewing your content. Each archetype lives in `.claude/agents/` as a separate file with `role: audience` frontmatter — Claude discovers them automatically, no registration needed.

---

## Step 1 — Parse the invocation

**If the user provided a role description** (e.g. `/audience CFO at a Series B SaaS company`), extract it and skip to Step 2.

**If no role was provided** (bare `/audience`):

1. List all files in `.claude/agents/` whose frontmatter contains `role: audience`. Collect their plain names (the `name:` frontmatter field, or the filename without extension if no `name:` field).
2. If none exist, say: "You haven't defined any audience archetypes yet. Try `/audience CFO` or `/audience hiring manager at a design agency` to create your first one."
3. If one or more exist, present them by plain name and ask: "Which audience would you like to edit? Or describe a new role to create one."
4. Wait for the user's choice, then continue from the appropriate step.

---

## Step 2 — Synthesize the archetype with profile context

Draw on both your general knowledge of the role **and** the profile context you already have from CLAUDE.md (the user's name, title, role description, company name, and company description). Do not ask the user to supply this — it is already in context.

Your synthesis goal is not just "what does a CFO care about in general" but specifically **"what does a CFO care about when evaluating content from this particular user"** — i.e., someone with this title, at this type of company, doing this kind of work. Calibrate every field accordingly:

- **Name:** a short label for this archetype (e.g. "CFO", "Hiring Manager — Design Agency")
- **Role summary:** 1–2 sentences on what this role is responsible for
- **What they care about:** the priorities and pressures that shape how they evaluate content, calibrated to the user's actual level and domain
- **What impresses them:** the kinds of signals, evidence, or framing that earn their attention — specifically from someone with the user's background
- **What concerns or bores them:** red flags, irrelevant detail, or framing that loses them — considering what might be typical blind spots for someone at the user's level
- **Communication style:** how they prefer to receive information (e.g. direct and data-driven, narrative, executive summary first)

Present the draft to the user and ask: "Does this sound right? Anything to adjust or add?"

Wait for confirmation or edits before continuing.

---

## Step 2b — Optional: pull in your notes or projects (skip if none)

After the user confirms or adjusts the synthesis draft, offer them an optional step to add more context from their own files.

1. List files available in `{{CONTENT_DIR}}/notes/` and `{{CONTENT_DIR}}/skills/`. Use the file's title (from its `# heading` or frontmatter `title:` if present, otherwise the filename stem). Never show raw file paths or use the phrase "knowledge graph."
2. **If no files exist** in either location, skip this step automatically — do not present an empty prompt. Note "I don't see any notes or skills files yet — skipping this step" and continue to Step 2c.
3. **If files are available,** present them with `AskUserQuestion` using `multiSelect: true`. Phrase the prompt as:

   > Want me to factor in any of your notes, your resume, or a specific project to sharpen this archetype? (You can skip this — it's optional.)

   Label each option by human-friendly title, not by filename. Include a "Skip — no additional context" option as the default selection so the user can easily pass.

4. If the user selects one or more files (not Skip), read them and use their content to augment or refine the synthesis draft. Update the draft in memory — you don't need to re-present the full draft unless something changed significantly.

Track which files (if any) were selected. You'll reference them in Step 2c and write them to the `## Context sources` section in Step 3.

---

## Step 2c — Context preview

Before writing the file, show the user a summary of what context was used to build this archetype. Example:

> I'll personalize this archetype using:
> - Your profile (title: Staff Engineer, company: Acme Logistics)
> - These notes: "Project Atlas migration", "Skills inventory"
>
> Sound good?

Always list the profile fields used (title, role, company are always included). List selected notes/skills files by their human-friendly title. If no files were selected in Step 2b, omit that line.

Wait for a yes/no confirmation before proceeding to Step 3. If the user asks to change something, loop back to the relevant step.

---

## Step 3 — Write the agent file

Derive a filename slug from the archetype name: lowercase, hyphens, no special characters (e.g. `cfo.md`, `hiring-manager-design-agency.md`).

Write to `.claude/agents/<slug>.md` using the format below.

**Critical formatting rules:**

- `description:` in frontmatter must be a plain resolved English sentence with no template tokens. Write the actual resolved text (e.g. "A CFO evaluating content from a Staff Engineer at a logistics company."). Do NOT write template tokens like `{{ USER_NAME }}` in frontmatter — they confuse tooling that reads the file before runtime resolution.
- The `## Personal context` section body is where template tokens go. Write `{{ USER_NAME }}`, `{{ USER_TITLE }}`, `{{ COMPANY_NAME }}`, `{{ ROLE_DESCRIPTION }}`, `{{ COMPANY_DESCRIPTION }}` literally into that section (using double curly-brace syntax with a space inside each) — `/with-audience` will substitute live values at panel time.
- Do NOT add `patina: managed` to custom archetypes — they are user-owned files, not managed by patina.
- Graph file references in `## Context sources` use wiki-link syntax `[[filename-without-extension]]`.

Use this exact format (the `{{ TOKEN }}` placeholders are written literally to the file — they are not rendered at creation time):

```markdown
---
name: [Name]
role: audience
description: [Plain-English role summary — e.g. "A CFO evaluating content from a Staff Engineer at a logistics company."]
---

## [Name]

**Role:** [Role summary]
**What they care about:** [answer]
**What impresses them:** [answer]
**What concerns or bores them:** [answer]
**Communication style:** [answer]

## Personal context

This archetype is reacting to content from {{ USER_NAME }}, a {{ USER_TITLE }} at {{ COMPANY_NAME }}.
[1–2 sentences about how this user's specific role and company shapes what this archetype looks for — e.g. "They're particularly attuned to whether the content reflects experience at a mid-market logistics company, not just general engineering depth."]

## Context sources

- profile: title, role, company
```

**Important:** When writing the `## Personal context` section, write `{{ USER_NAME }}`, `{{ USER_TITLE }}`, and `{{ COMPANY_NAME }}` exactly as shown — double curly braces with a space inside. These are template tokens that `/with-audience` resolves at runtime. Always write the `## Context sources` section, even when no files were selected — the `- profile: title, role, company` line is always present.

If the user selected notes or skills files in Step 2b, append them to the `## Context sources` list using wiki-link syntax:

```
- note: [[note-filename-without-extension]]
- skills: [[skills-filename-without-extension]]
```

Use the file's base name (without `.md` extension) as the wiki-link target. For skills files, the link target is relative to the skills folder — write `[[index]]` not `[[skills/index]]`.

---

## Step 4 — Confirm

Tell the user the archetype name and that they can run `/with-audience` to get their reaction. Tell them the file is at `.claude/agents/<slug>.md` and they can edit it directly any time.
