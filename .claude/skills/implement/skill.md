---
name: implement
description: End-to-end GitHub issue implementation — /implement <N>. Fetches the issue via GitHub CLI, writes it locally, then either implements directly (easy issues) or plans with Opus and implements with Sonnet (complex issues). Resilient to interruption — resumes from the last checkpoint. Also triggered by "implement issue #N", "work on issue N", "start issue N", "tackle #N", "pick up GH issue N".
version: 4.0.0
---

# /implement — GitHub Issue Implementation Workflow

Execute a structured workflow to implement a GitHub issue from start to finish. Each major step writes a checkpoint so the skill can resume if interrupted.

---

## Step 0: Preflight Check

Run the shared preflight script to verify prerequisites before doing any work:

```bash
bash .claude/skills/shared/preflight.sh
```

If it fails, stop and show the error to the user — do not proceed with the workflow.

---

## Step 1: Parse the issue number

Extract the issue number from the user's invocation (e.g., `/implement 42` or "work on issue 42").
If no number was provided, ask: "Which issue number should I implement?"

---

## Step 2: Resume check

Before fetching anything, check for an existing run:

1. If `.current-issue.md` exists, read it.
2. Check whether the issue number on the first line matches the requested number.
3. If it matches **and** a `## Progress` section is present:
   - Read the checklist. Find the first unchecked item.
   - Announce: "Resuming issue #N from: [first unchecked step]."
   - **Skip all checked steps** — jump directly to the first unchecked one.
   - Special case — if the first unchecked item is `Handed off to implement-plan`: invoke the `implement-plan` skill directly without re-running any prior steps.
4. If the file doesn't exist, doesn't match, or has no Progress section: proceed fresh from Step 3.

---

## Step 3: Fetch the issue

```bash
bash .claude/skills/implement/fetch-issue.sh <NUMBER>
```

If the issue is closed, warn the user and wait for confirmation.
If the command fails (not found, auth error), stop and explain the error clearly.

---

## Step 4: Write `.current-issue.md`

**Important:** Always Read `.current-issue.md` first (to satisfy the Write tool's read-before-write check), then overwrite it.

Write the issue details followed by an initial Progress section:

```markdown
# Issue #<number>: <title>

**State:** <state>
**Labels:** <labels or "none">
**Assignees:** <assignees or "unassigned">
**Milestone:** <milestone or "none">
**Branch:** (set in Step 5)

## Description

<body>

## Comments

<for each comment: show author, date, and body — omit section if no comments>

## Progress

- [ ] Branch created
- [ ] Complexity assessed
- [ ] Persona evaluation
- [ ] Plan created
- [ ] Architect review
- [ ] Plan approved
- [ ] Handed off to implement-plan
```

> **Note on checkpoints:** After each step below completes, use the Edit tool to mark the corresponding checkbox in `.current-issue.md` as `[x]`. This is what enables resumption.

Ensure `.current-issue.md` is gitignored (it usually already is).

---

## Step 5: Create Feature Branch

Derive a branch slug from the issue title: lowercase, hyphenated, no special characters, ≤ 45 characters. The full branch name is `issue-<N>-<slug>`.

1. Discover the default branch:
   ```bash
   bash .claude/skills/shared/discover-default-branch.sh
   ```
2. Fetch and update to latest:
   ```bash
   git fetch origin
   git checkout <default-branch>
   git pull origin <default-branch>
   ```
3. Create or resume the feature branch:
   - If `issue-<N>-<slug>` exists locally: `git checkout issue-<N>-<slug>` and note "Branch already exists locally — continuing implementation."
   - If `issue-<N>-<slug>` exists on remote but not locally: `git checkout issue-<N>-<slug>` (git will track the remote automatically after the fetch) and note "Branch exists on remote — checking out locally."
   - Otherwise: `git checkout -b issue-<N>-<slug>`
4. Update `.current-issue.md`: replace `**Branch:** (set in Step 5)` with `**Branch:** issue-<N>-<slug>` using the Edit tool.

**Checkpoint:** Mark `Branch created` as `[x]`.

---

## Step 6: Assess complexity

Classify the issue as one of:

- **Trivial** — single-file, single-line or few-line change; solution stated explicitly; no tests or type changes needed (e.g. typo, copy change, config value flip)
- **Easy** — localized change across 1–3 files; fix is described but requires reading existing code; may update tests or types; labels: `bug`, `good first issue`, `documentation`, `chore`
- **Complex** — spans multiple files/modules; architectural decisions needed; multiple acceptance criteria; touches auth/security/payments; new feature rather than targeted fix; long detailed issue body; labels: `enhancement`, `feature`, `architecture`, `breaking-change`

When in doubt, lean complex.

**Checkpoint:** Mark `Complexity assessed` as `[x]`. Update the checkbox label to include the result, e.g. `- [x] Complexity assessed: Complex`.

---

## Step 7: Persona evaluation (skip if Trivial)

Check whether `.current-issue.md` contains a `## Persona Impact` section **or** the fast-mode footer (`Created with \`/issue --f\``).

- **If either is present:** skip — personas have already weighed in. Mark `Persona evaluation` as `[x] Persona evaluation: skipped (already done)`.
- **If neither is present:**
  1. List all `.md` files in `.claude/agents/` and read each file's frontmatter. Collect those with `role: persona`.
  2. Invoke all discovered persona agents **in parallel**, providing each with the issue title, description, and relevant project context.
  3. Present the results as a table:

     | Persona      | Impact   | Key Concern   |
     | ------------ | -------- | ------------- |
     | [agent name] | [impact] | [key concern] |

  4. Ask the user (use `AskUserQuestion` with selectable options):
     - If ALL personas are Positive or Neutral: "All personas are satisfied. Ready to proceed?" → (1) Proceed (2) Discuss further (3) Abort
     - If ANY persona is Negative or Mixed: "One or more personas have concerns. What would you like to do?" → (1) Proceed anyway (2) Discuss to refine first (3) Abort
  5. If the user wants to discuss: allow conversation to proceed, re-invoke relevant agents as needed, then present the gate again.
  6. If the user aborts: stop entirely.

**Checkpoint:** Mark `Persona evaluation` as `[x]` once the user confirms to proceed.

---

## Step 8: Implement

### If Trivial

Use the Agent tool with `subagent_type="general-purpose"` and `model="haiku"`:

> "Implement GitHub issue #<number>. Read `.current-issue.md` for issue details. Make the targeted change. Report exactly what was changed."

**Checkpoint:** Mark `Plan created`, `Architect review`, `Plan approved`, and `Handed off to implement-plan` as `[x] skipped (Trivial)`.

---

### If Easy

Implement directly: read the relevant code, make the targeted change. Report what was done plus anything needing human review. Do not commit.

**Checkpoint:** Mark `Plan created`, `Architect review`, `Plan approved`, and `Handed off to implement-plan` as `[x] skipped (Easy)`.

End with: "Review the changes, then run `/commit` when ready."

---

### If Complex

**C1 — Plan using Opus:**

Use the Agent tool with `subagent_type="Plan"` and `model="opus"`:

> "Create a detailed implementation plan for GitHub issue #<number>.
>
> **Title:** <title>
> **Body:** <full body>
> **Repo context:** <brief summary of relevant structure you've explored>
>
> Include: root cause analysis, files to create/modify with rationale, step-by-step sequence, testing approach, edge cases and risks. Be thorough — this plan will be passed to a fresh implementation agent."

Save the plan to `.implementation-plan.md` in the repo root. The file must always end with the `## Execution Progress` section (all boxes unchecked):

```
<!-- issue: #<number> -->
<plan content>

## Execution Progress
- [ ] Plan steps executed
- [ ] Implementation reported
```

Ensure `.implementation-plan.md` is gitignored.

**Checkpoint:** Mark `Plan created` as `[x]`.

---

**C1a — Architect review (if architect agent exists):**

Check whether `.claude/agents/architect.md` exists and contains `role: architect` in its frontmatter.

- **If not:** skip silently. Mark `Architect review` as `[x] skipped (no architect agent)`.
- **If yes:** invoke with the Agent tool, `subagent_type="architect"`, `model="sonnet"`:

  > "Review the following implementation plan for GitHub issue #<number>.
  >
  > **Plan:**
  > <full contents of .implementation-plan.md>
  >
  > Provide your architectural analysis."

  Capture the full response for the review gate.

**Checkpoint:** Mark `Architect review` as `[x]`.

---

**C1b — Review gate:**

Present the plan summary to the user via `AskUserQuestion`. If architect analysis was produced in C1a, include it under **Architect's Analysis**. Options:

- "Proceed with implementation"
- "Edit the plan first" — open `.implementation-plan.md` for the user to modify, then re-read it before continuing
- "Abort"

Do not proceed until the user explicitly approves.

**Checkpoint:** Mark `Plan approved` as `[x]` in `.current-issue.md`, then invoke the implement-plan skill:

```
skill: "implement-plan"
```

Once the skill returns successfully, mark `Handed off to implement-plan` as `[x]`. (Marking after ensures a failed invocation leaves the box unchecked so resume will retry it.)

---

## Notes

- `.current-issue.md` and `.implementation-plan.md` are untracked scratch files — never stage or commit them.
- If any step fails, stop and explain clearly — no silent workarounds.
- To force a full restart, delete `.current-issue.md`. To retry a specific step, uncheck its box manually.
- After Complex planning, this skill hands off to `/implement-plan` for execution. To resume an interrupted implementation, run `/implement-plan` directly — it reads `.implementation-plan.md` and picks up from the first unchecked `## Execution Progress` item.
