Create a new goal from the description the user just gave you.

## Step 1 — Gather details

You have the goal description from the user's message. Collect the remaining fields in a single conversational message:

1. **Horizon** — "What time horizon does this sit in: week, month, quarter, or year?"
2. **Type** — "What type of goal is this? Common values: `project`, `job-search`, `people`, `learning` — or enter your own."
3. **Due date** (optional) — "Is there a specific due date? (Press Enter to skip.)"

Ask all three in one message.

## Step 2 — Slugify the filename

Turn the description into a filename slug:
- Lowercase, hyphen-separated
- Remove special characters and stop words
- Maximum 50 characters
- Example: "Land a senior role by Q3" → `land-senior-role-q3.md`

## Step 3 — Write the goal file

Write a new file to `{{CONTENT_DIR}}/goals/<slug>.md`:

```
---
status: open
horizon: <horizon>
type: <type>
created: <today from session context>
due: <ISO date, or omit this line entirely if not set>
---

# <Title from description, title-cased>

<One or two sentences describing what the user wants to accomplish and why it matters.>

**Definition of done:** <specific completion criterion, if the goal is concrete enough to have one>
```

Use `currentDate` from your session context for `created`.

## Step 4 — Confirm

Tell the user:
- File created at `{{CONTENT_DIR}}/goals/<slug>.md`
- Horizon and type recorded
- Due date (or "no due date set")
