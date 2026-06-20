---
name: implement-plan
description: Execute (or resume) an implementation plan stored in .implementation-plan.md. Use when the user types /implement-plan, asks to "resume implementation", or "continue the plan". Reads .implementation-plan.md, picks up at the first uncompleted step in the Execution Progress checklist, and dispatches a Sonnet agent to finish the work.
version: 1.0.0
user_invocable: true
---

# /implement-plan — Resume or Execute an Implementation Plan

Execute (or resume) the plan stored in `.implementation-plan.md`. Picks up at the first unchecked item in the `## Execution Progress` checklist — completed steps are never re-run.

---

## Step 0: Preflight Check

Run the shared preflight script to verify prerequisites before doing any work:

```bash
bash .claude/skills/shared/preflight.sh
```

Stop on failure — do not proceed.

---

## Step 1: Locate the Plan

Verify that `.implementation-plan.md` exists.

- **If not found:** abort with — "No `.implementation-plan.md` found. Run `/implement <issue-number>` first, or create the file manually."
- **If found:** read the full file. Extract the issue number from the `<!-- issue: #N -->` comment on the first line.
  - If the comment is missing, warn: "No issue number found in `.implementation-plan.md` — proceeding in plan-only mode."

---

## Step 2: Cross-Reference Current Issue (Best-Effort)

Check whether `.current-issue.md` exists:

- **Exists and matches** the same issue number → use it as additional context throughout.
- **Exists with a different issue number** → stop:
  > "`.current-issue.md` is for issue #X but `.implementation-plan.md` is for issue #N. These are out of sync — delete the stale file or run `/implement <issue-number>` to start fresh."
- **Does not exist** → proceed in plan-only mode without warning.

---

## Step 3: Locate or Initialize Execution Progress

Look for a `## Execution Progress` section in `.implementation-plan.md`.

- **If missing:** append it to the file using the Edit tool:

  ```
  ## Execution Progress
  - [ ] Plan steps executed
  - [ ] Implementation reported
  ```

- **Find the first unchecked item** in the `## Execution Progress` checklist.
  - **If all items are checked:** announce "Plan already complete — run `/commit` when ready." and exit.
  - **If at least one is unchecked:** proceed to Step 4.

---

## Step 4: Dispatch Sonnet Subagent

Use the Agent tool with `subagent_type="general-purpose"` and `model="sonnet"`:

> "Implement (or resume implementing) GitHub issue #<N>.
>
> Read `.implementation-plan.md` for the full plan and `.current-issue.md` (if it exists) for issue context.
>
> The plan contains a `## Execution Progress` checklist near the bottom. Find the first unchecked item and resume from there — do NOT redo completed steps. As you complete each item, use the Edit tool to mark its checkbox `[x]` in `.implementation-plan.md`.
>
> Report what was done plus anything needing human review. Do not commit."

---

## Step 5: Report Back

Re-read `.implementation-plan.md` after the subagent completes.

- **If any Execution Progress items remain unchecked:** report them as "Remaining work" and instruct the user to re-run `/implement-plan` to continue.
- **If all items are checked:** report "Implementation complete. Review the changes, then run `/commit` when ready."
