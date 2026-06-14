---
date: {{TODAY}}
type: instructions
last-updated: {{TODAY}}
tags: [resume, instructions]
---

# Resume Workflow Instructions

Read this file first before working on any resume files. It tells you who {{USER_NAME}} is, what the files mean, how to improve them, and what to avoid.

---

## Who {{USER_NAME}} Is

**{{USER_NAME}}** — {{USER_TITLE}} at {{COMPANY_NAME}}

{{ROLE_DESCRIPTION}}

{{COMPANY_DESCRIPTION}}

> **Add your professional identity here.** Use `/add` to capture skills, projects, and experiences. After a few sessions, return here to describe the two or three things that make your professional identity distinctive. What do you do that most people in your field don't? What problems do you solve that others struggle with?

**Voice:** direct, specific, and free of buzzwords. Write what you actually did — not a job description of what the role involved.

---

## What the Files Are

```
{{CONTENT_DIR}}/resume/
  INSTRUCTIONS.md              ← you are here
  Resume Working Draft.md      ← your current resume, updated from the graph
  Resume Last Submitted.md     ← frozen copy of what you most recently submitted
```

**Working Draft** is the living document. Run `/resume-refresh` to keep it current with your graph. This is what you copy from when applying somewhere.

**Last Submitted** is a snapshot of the Working Draft at the time you most recently submitted to a role. It answers the question: "what did they actually see?" Do not edit it manually — update it by telling Claude you submitted.

---

## Getting started

Before running `/resume-refresh`, it helps to have a few notes in `{{CONTENT_DIR}}/notes/` — these are the raw material the module drafts from. Use `/add` to capture projects, skills, and work history. The more specific the notes, the better the draft.

---

## The Workflow

**Drafting:** Run `/resume-refresh` to generate or update the working draft from your graph.

**Publishing:** When the draft looks good, copy the content and paste it into your resume document (Word, Google Docs, a PDF tool). There is no automation — this module generates the content, you control where it goes.

**After submitting:** Tell Claude — *"I submitted to Acme Corp"* or *"I applied to the senior engineer role at Acme."* Claude will copy the current Working Draft into `Resume Last Submitted.md`, adding a note about when and where you applied.

---

## How to Improve the Draft

### Step 1 — Orient yourself

Read in this order:
1. The current Working Draft — understand what's there
2. The notes in `{{CONTENT_DIR}}/notes/` and `{{CONTENT_DIR}}/skills/` — the grounding sources

### Step 2 — Propose changes

Only claim things that are grounded in a graph note. When improving copy, ask:
- Is this grounded in something {{USER_NAME}} actually did? (If not, cut it)
- Is it specific enough to be credible?
- Does it sound like {{USER_NAME}}? (Direct, no buzzwords)

### Step 3 — Update the changelog

Always add a row to `## Changelog`:

```markdown
| {{TODAY}} | Updated [section] to reflect [what changed] |
```

Also update `last-updated` in the front matter.

---

## What Not to Do

- **Do not invent accomplishments.** Every bullet must trace back to a graph note.
- **Do not write generic copy.** "Results-driven leader" and "passionate about innovation" are noise. Specificity is the point.
- **Do not edit `Resume Last Submitted.md` manually.** It is a factual record of what was sent.
- **Do not create new dated files for minor edits.** The changelog table handles revision history.

## Anti-AI writing patterns

Drafts are grounded in real notes, but they still pick up AI writing tells. Before any draft is saved, the text must be free of these. Watch for them while drafting, not just at review:

- **Em dashes (—).** Rewrite with a comma, period, or parentheses. Straight hyphens in compound words are fine.
- **AI vocabulary.** Cut or replace: pivotal, testament, landscape (figurative), delve, showcase, underscore, foster, garner, vibrant, robust, leverage, spearhead, tapestry, realm, intricate, seamless.
- **Promotional language.** Cut: groundbreaking, boasts, nestled, breathtaking, renowned, world-class, cutting-edge, passionate about, results-driven.
- **Rule of three.** Do not force ideas into groups of three for the sake of rhythm ("strategy, execution, and delivery"). Keep the items the evidence actually supports.
- **Superficial -ing tails.** Cut clauses tacked on to fake depth: "highlighting that...", "ensuring...", "reflecting...", "showcasing...", "underscoring...".
- **Negative parallelisms.** Rewrite "not just X, but Y" and "it's not about X, it's about Y" as a plain statement.
- **Passive voice where active is clearer.** "Migration was led by me" becomes "I led the migration."

When you find one, fix it in place. The goal is copy that reads like {{USER_NAME}} wrote it, not like it was generated.

## Sharing is your call

Patina drafts; you publish. Nothing here is sent anywhere automatically — you copy the draft into your resume document yourself, so you are always the final reviewer.

Because of that, this module never blocks content. It gives you **one** heads-up when a draft leans on something that looks sensitive, so you can decide before you share:

- a source note marked `private: true`, or
- material that reads as not-yet-public — sourced from `{{CONTENT_DIR}}/clients/`, or mentioning unreleased, internal, or pre-launch work, an NDA, or figures that haven't been announced.

When that happens, mention it once for the whole draft: name the source and ask {{USER_NAME}} to confirm they're cleared to share it. Don't repeat the warning per line, and don't withhold the draft — the decision is theirs. If they say to keep something out, set `private: true` on that source note so the heads-up is sharper next time.

---

## Section-by-Section Writing Rules

### Summary / Objective
- **2–4 sentences max.** The hiring manager spends 6 seconds on an initial scan — the summary is your hook.
- **No "I" statements.** Start with a noun or verb.
- **No generic claims.** "Experienced professional" means nothing. Name your actual domain.

### Experience
- **Impact over activity.** "Led migration of X to Y, cutting deploy time by 40%" beats "Responsible for infrastructure."
- **Completed work uses past tense.** Ongoing work uses present tense.
- **3–5 bullets per role.** More dilutes; fewer leaves evidence on the table.

### Skills
- **Keywords only.** No prose, no context, no dates.
- **Every skill should map to a note.** If there's no evidence, don't list it.

### Education
- **Degree, institution, year.** Add honours, relevant coursework, or thesis only if genuinely relevant to the target role.
- **Stable.** Rarely needs updating.
