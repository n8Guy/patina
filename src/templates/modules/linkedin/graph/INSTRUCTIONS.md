---
date: {{TODAY}}
type: instructions
last-updated: {{TODAY}}
tags: [linkedin, instructions]
---

# LinkedIn Workflow Instructions

Read this file first before working on any LinkedIn proposal files. It tells you who {{USER_NAME}} is, what the files mean, how to improve them, and what to avoid.

---

## Who {{USER_NAME}} Is

**{{USER_NAME}}** — {{USER_TITLE}}{{COMPANY_NAME}}

{{ROLE_DESCRIPTION}}

{{COMPANY_DESCRIPTION}}

> **Add your professional identity here.** Use `/add` to capture skills, projects, and experiences. After a few sessions, return here to describe the two or three things that make your professional identity distinctive. What do you do that most people in your field don't? What problems do you solve that others struggle with?

**Voice:** direct, specific, and free of buzzwords. Write what you actually did — not a job description of what the role involved.

---

## What the Files Are

```
{{CONTENT_DIR}}/linkedin/
  INSTRUCTIONS.md              ← you are here
  LinkedIn Current State.md    ← verified record of what is ACTUALLY live on the profile today
  LinkedIn Headline.md         ← draft for the headline field
  LinkedIn About.md            ← draft for the About/summary section
  LinkedIn Experience.md       ← draft for the Experience section
  LinkedIn Skills.md           ← draft for the Skills section
  LinkedIn Featured.md         ← draft for the Featured section
  LinkedIn Activity.md         ← posting strategy
```

**Current State** is the ground truth of what exists on LinkedIn right now. Keep it accurate — only update it when a change has actually been published.

**Draft files** each have a `## Proposed` section with copy ready to use, a `## Rationale` explaining the reasoning, and a `## Changelog` table tracking revisions.

---

## Getting started

Before running any commands, it helps to have `LinkedIn Current State.md` filled in — this file tells Claude what's already live on your profile, so drafts are grounded in reality rather than starting from scratch.

Open your LinkedIn profile in a browser while Claude has access to it, then give Claude this prompt:

> *"I have my LinkedIn profile open. Please read my current headline, About section, Experience description for my current role, Skills list, and Featured items — then write them directly into my `{{CONTENT_DIR}}/linkedin/LinkedIn Current State.md` file. After you're done, show me what you captured so I can check it over."*

Claude will read your profile and write the file for you in one step. Take a moment to read through the result — you know your profile better than anyone, and it's worth making sure everything looks right before you start drafting.

If Claude doesn't have browser access, just visit your LinkedIn profile and copy each section into that file manually. Either way works.

---

## The Workflow

**Drafting:** Run `/li-all` to generate or refresh all six drafts at once, or use a section-specific command (`/li-about`, `/li-headline`, etc.) to refine one section at a time.

**Publishing:** When a draft looks good, open the file, copy the text from the `## Proposed` section, and paste it into the right place on LinkedIn. There is no automation — LinkedIn doesn't allow it.

**After publishing:** Just tell Claude — *"I published my headline"* or *"I updated my About section."* Claude will:
1. Change `status: draft` to `status: published` in the draft file
2. Update `LinkedIn Current State.md` to reflect what's now live
3. Add a row to the Publish Log

Keeping Current State accurate matters — `/li-all` uses it as a baseline when deciding what has changed and what still needs updating.

---

## How to Improve a Draft

### Step 1 — Orient yourself

Read in this order:
1. `LinkedIn Current State.md` — understand the baseline
2. The specific draft file you're working on
3. The notes listed in that file's `based-on` front matter — these are the graph evidence that should ground any changes

The most important grounding sources are in `{{CONTENT_DIR}}/notes/` and `{{CONTENT_DIR}}/skills/`.

### Step 2 — Propose changes

Only edit the `## Proposed` section. Do not change `## Rationale` or `## Notes` without good reason — they document why earlier decisions were made.

When improving copy, ask:
- Is this grounded in something {{USER_NAME}} actually did? (If not, cut it)
- Is it specific enough to be credible?
- Does it survive the fold? (LinkedIn truncates About at ~300 chars — the first two sentences carry the weight)
- Does it sound like {{USER_NAME}}? (Direct, no buzzwords)

### Step 3 — Update the changelog

Always add a row to `## Changelog`:

```markdown
| {{TODAY}} | Updated About to reflect [what changed] |
```

Also update `last-updated` in the front matter.

---

## What Not to Do

- **Do not edit `LinkedIn Current State.md`** unless a change has actually been published. It is a factual record.
- **Do not invent accomplishments.** Every bullet must trace back to a graph note.
- **Do not write generic copy.** "Results-driven leader" and "passionate about innovation" are noise. Specificity is the point.
- **Do not create new dated files for minor edits.** The changelog table handles revision history.

---

## Section-by-Section Writing Rules

### About
- **Shelf life:** months to years — should not need edits every week
- **No dates or quarters.** Write patterns, not instances.
- **First two sentences carry the weight.** LinkedIn truncates at ~300 chars.

### Headline
- **Shelf life:** months to years
- **No dates, quarters, or project names.** Stable capability labels only.
- **Keyword-optimised.** Think about what someone searching for your expertise would type.

### Experience
- **Timelines are fine for completed work.** It's a historical record.
- **Ongoing work uses present tense without time markers.**
- **Abstract up from specifics.** A single decision is an instance. After 2–3 instances, it becomes a pattern worth writing.

### Skills
- **Keywords only.** No prose, no dates, no context.

### Featured
- **Pin content with a long shelf life.** Avoid anything tied to a specific quarter or news cycle.

### Activity
- **The strategy is evergreen.** Post types, cadence, and voice guidelines don't change week to week.
- **Post candidates are timely.** The list rotates as new graph content arrives.
