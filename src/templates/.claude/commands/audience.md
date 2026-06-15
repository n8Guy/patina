---
patina: managed
---
# /audience — Create or Edit an Audience Archetype

Defines a role archetype that `/with-audience` can consult when reviewing your content. Each archetype lives in `.claude/agents/` as a separate file with `role: audience` frontmatter — Claude discovers them automatically, no registration needed.

---

## Step 1 — Parse the invocation

**If the user provided a role description** (e.g. `/audience CFO at a Series B SaaS company`), extract it and skip to Step 2.

**If no role was provided** (bare `/audience`):

1. List all files in `.claude/agents/` whose frontmatter contains `role: audience`.
2. If none exist, say: "You haven't defined any audience archetypes yet. Try `/audience CFO` or `/audience hiring manager at a design agency` to create your first one."
3. If one or more exist, present them by name and ask: "Which audience would you like to edit? Or describe a new role to create one."
4. Wait for the user's choice, then continue from the appropriate step.

---

## Step 2 — Synthesize the archetype

Using your knowledge of the role, synthesize a draft archetype. Do not ask the user to describe what a CFO cares about — you already know. Draft the following:

- **Name:** a short label for this archetype (e.g. "CFO", "Hiring Manager — Design Agency")
- **Role summary:** 1–2 sentences on what this role is responsible for
- **What they care about:** the priorities and pressures that shape how they evaluate content
- **What impresses them:** the kinds of signals, evidence, or framing that earn their attention
- **What concerns or bores them:** red flags, irrelevant detail, or framing that loses them
- **Communication style:** how they prefer to receive information (e.g. direct and data-driven, narrative, executive summary first)

Present the draft to the user and ask: "Does this sound right? Anything to adjust or add?"

Wait for confirmation or edits before writing the file.

---

## Step 3 — Write the agent file

Derive a filename slug from the archetype name: lowercase, hyphens, no special characters (e.g. `cfo.md`, `hiring-manager-design-agency.md`).

Write to `.claude/agents/<slug>.md`:

```markdown
---
name: [Name]
role: audience
description: [Role summary in one sentence]
---

## [Name]

**Role:** [Role summary]
**What they care about:** [answer]
**What impresses them:** [answer]
**What concerns or bores them:** [answer]
**Communication style:** [answer]
```

---

## Step 4 — Confirm

Tell the user the archetype name and that they can run `/with-audience` to get their reaction. Tell them the file is at `.claude/agents/<slug>.md` and they can edit it directly any time.
