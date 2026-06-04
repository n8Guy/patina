Review your open and in-progress goals.

## Step 1 — Load context

Read `{{CONTENT_DIR}}/goals/INSTRUCTIONS.md` for field definitions and module-level guidance.

Read every `.md` file in `{{CONTENT_DIR}}/goals/` except `INSTRUCTIONS.md`.

## Step 2 — Filter

Include only goals where `status` is `open` or `in-progress`.

If the user ran `/goal-review --all`, also include `done` and `abandoned` goals in a separate **Closed Goals** section at the end.

## Step 3 — Determine overdue status

Use `currentDate` from your session context as today's date.

For each active goal, compute whether it is overdue:
- If `due` is set and `due` < today → **overdue**
- If `due` is not set, derive a deadline from `created` + `horizon` (calendar approximations):
  - `week` → +7 days
  - `month` → +30 days
  - `quarter` → +90 days
  - `year` → +365 days
  - Overdue if that deadline has passed

## Step 4 — Build the report

**Sort order (outermost to innermost):**
1. Overdue goals first, most overdue first
2. Then `in-progress` goals
3. Then `open` goals
4. Within each bucket, group by `type` alphabetically

Format each goal as:

```
### <H1 title from goal body, or slug if no H1>
**Horizon:** <horizon> | **Type:** <type> | **Created:** <created> | **Due:** <due or "none">
**Status:** <status>[ ⚠️ OVERDUE]

<First paragraph of goal body>
```

Add `⚠️ OVERDUE` after the status only when the goal is overdue.

## Step 5 — Summary

End the report with a divider and summary block:

---

**Summary**
- Open: N
- In-progress: N
- Overdue: N — [list slugs]

If there are no active goals, say so in one sentence and suggest running `/goal` to create one.
