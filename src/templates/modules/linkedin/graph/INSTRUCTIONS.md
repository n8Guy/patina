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
  LinkedIn Activity.md         ← posting strategy and suggestion backlog
  activity/drafts/             ← in-progress post and article drafts
  activity/posted/             ← published posts (moved here by /li-post)
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

Patina drafts; you publish. Nothing here is posted automatically, and nothing leaves your computer until you copy it somewhere yourself — so you are always the final reviewer.

Because of that, this module never blocks content. It gives you **one** heads-up when a draft leans on something that looks sensitive, so you can decide before you share:

- a source note marked `private: true`, or
- material that reads as not-yet-public — sourced from `{{CONTENT_DIR}}/clients/`, or mentioning unreleased, internal, or pre-launch work, an NDA, or figures that haven't been announced.

When that happens, mention it once for the whole draft: name the source and ask {{USER_NAME}} to confirm they're cleared to share it. Don't repeat the warning per line, and don't withhold the draft — the decision is theirs. If they say to keep something out, set `private: true` on that source note so the heads-up is sharper next time.

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

### Activity lifecycle

Content moves through three states. The folder location is the source of truth for status:

1. **Suggested** — entries live in `LinkedIn Activity.md` as a backlog list. This file is managed by `/li-activity`.
2. **In progress** — `/li-draft` promotes a suggestion (or starts a fresh draft) into `{{CONTENT_DIR}}/linkedin/activity/drafts/<slug>.md`. When promoting a suggestion, the entry is removed from `LinkedIn Activity.md` backlog. When starting fresh, `LinkedIn Activity.md` is not touched.
3. **Posted** — `/li-post` moves the draft file from `activity/drafts/` to `{{CONTENT_DIR}}/linkedin/activity/posted/<slug>.md` and stamps `posted_at` in the frontmatter.

Rules:
- No dates in filenames. `created_at` and `posted_at` in frontmatter carry all timing information.
- `posted_at` is an ISO datetime from the session context at the moment `/li-post` is run — not a frozen scaffold token.
- `/li-post` does not touch `LinkedIn Activity.md`.
- `activity/posted/` is read-only after a file lands there — do not edit or move posted files.
