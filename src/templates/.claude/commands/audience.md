---
patina: managed
---
# /audience — Define Your Target Audience

Walks you through a short Q&A and writes a reusable audience definition to `{{CONTENT_DIR}}/audience.md`. Every other command that needs to know who you're writing for reads that file automatically.

---

## Step 1 — Check for an existing audience definition

Read `{{CONTENT_DIR}}/audience.md`.

- If the file **does not exist**, skip to Step 2.
- If the file **exists**, summarise who the current audience is in one or two sentences, then ask:

  > "You already have an audience defined. Would you like to **update** the existing one (keep what's there and refine it) or **replace** it entirely with a fresh definition?"

  Wait for the answer before continuing. Do not overwrite anything yet.

---

## Step 2 — Guided Q&A

Ask the following questions one at a time. Wait for each answer before asking the next. Do not rush through them or ask multiple questions at once.

1. **Who are they?** A few sentences describing the person — their background, industry, experience level.
2. **What is their role or title?** (e.g. "VP of Engineering at a Series B startup", "hiring manager in a design agency")
3. **What do they care about most?** What drives their decisions or shapes how they evaluate people?
4. **What impresses them?** What kinds of accomplishments, skills, or ways of working earn their respect?
5. **What concerns or bores them?** What raises red flags, or what do they immediately tune out?
6. **What communication style do they respond to?** (e.g. direct and data-driven, storytelling and warmth, concise and tactical)

If the user gave a partial answer, ask a brief follow-up to fill it out. Otherwise move on.

---

## Step 3 — Write the audience file

Write the following to `{{CONTENT_DIR}}/audience.md`, substituting the user's answers:

```markdown
---
date: YYYY-MM-DD
type: audience
---

## Audience

**Who they are:** [answer]
**Role / title:** [answer]
**What they care about:** [answer]
**What impresses them:** [answer]
**What concerns or bores them:** [answer]
**Communication style:** [answer]
```

Use today's date for `date`. Do not include any other fields in the frontmatter.

---

## Step 4 — Confirm

Say exactly:

> I saved your audience to audience.md in your patina folder. You can open and edit it directly any time.

Do not reference the folder name or the full file path. Do not add anything else to this sentence.
