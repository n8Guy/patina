---
patina: managed
---
Promote a suggestion to a draft, or start a new LinkedIn post or article from scratch.

## Context to load first
1. Read `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md` — voice guidelines, identity context, and file conventions
2. Read `{{CONTENT_DIR}}/linkedin/LinkedIn Activity.md` — the current posting strategy and suggestion backlog

## Determine source

Look at the user's message after `/li-draft`:

- **If the message references a specific suggestion from `LinkedIn Activity.md`** (e.g. a topic, phrase, or list item that matches an entry in the backlog): pre-populate the draft from that suggestion. After the draft is created, remove that suggestion entry from `LinkedIn Activity.md`. Preserve all other content in `LinkedIn Activity.md` exactly as-is — only remove the matched item.
- **If the message is empty or does not reference an existing suggestion**: start a fresh draft. Do NOT touch `LinkedIn Activity.md` in this case.

## Choose content type

Ask the user one question in a single conversational message:

> "What type of content is this — a **post** (hook, body, CTA) or an **article** (title, intro, body, conclusion)?"

Wait for the answer before continuing.

## Slugify the filename

From the topic or suggestion text, produce a short slug:
- Lowercase, words joined with hyphens
- Drop stop words (a, an, the, and, or, but, in, on, at, to, for, of, with, by)
- Max ~50 characters
- No date in the filename — dates go in frontmatter only

If a file with that slug already exists in `{{CONTENT_DIR}}/linkedin/activity/drafts/`, do not overwrite it. Ask the user for a disambiguating word and incorporate it into the slug. Do not append a date.

## Review for AI patterns

Before writing anything, review the draft content you have planned and check it against the anti-AI patterns in `{{CONTENT_DIR}}/linkedin/INSTRUCTIONS.md`. Fix every occurrence in place:

- Em dashes (—) → comma, period, or parentheses
- AI vocabulary (pivotal, testament, landscape, delve, showcase, underscore, foster, garner, vibrant, robust, leverage, etc.) → plain words
- Promotional language (groundbreaking, boasts, nestled, breathtaking, renowned, world-class, passionate about, results-driven, etc.) → cut or state plainly
- Rule of three (forced groups of three) → keep only what the evidence supports
- Superficial -ing tails ("highlighting that...", "ensuring...", "reflecting...") → cut or fold into a real clause
- Negative parallelisms ("not just X, but Y") → plain statement
- Passive voice where active is clearer → active voice

Only continue to the write step once the draft is clean.

## Scaffold the draft file

Create the directory `{{CONTENT_DIR}}/linkedin/activity/drafts/` if it does not exist.

Use `created_at` from the current session date — do NOT use `{{TODAY}}` or any frozen token. Use the actual date from your session context.

### Post template

Write `{{CONTENT_DIR}}/linkedin/activity/drafts/<slug>.md` with this structure:

```
---
type: linkedin-post
status: draft
created_at: <session date>
topic: <short descriptor>
---

## Hook

<opening line — the first sentence a reader sees before "see more">

## Body

<the substance — what happened, what you learned, what the evidence supports>

## CTA

<call to action — question, invitation, or next step>
```

### Article template

Write `{{CONTENT_DIR}}/linkedin/activity/drafts/<slug>.md` with this structure:

```
---
type: linkedin-article
status: draft
created_at: <session date>
topic: <short descriptor>
---

# <Title>

## Intro

<opening paragraph — what the article is about and why it matters>

## Body

<main content — grounded in graph evidence>

## Conclusion

<takeaway or closing thought>
```

## Confirm

Report:
1. The full path of the new file
2. The content type chosen (post or article)
3. Whether a suggestion was removed from `LinkedIn Activity.md` (and if so, which one)
