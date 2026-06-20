---
name: issue
description: Create or refine GitHub issues — /issue <description>, /issue --r <N> [guidance] (Refine Mode), /issue --f <description> (Fast Mode, skips clarifying questions and persona review). Parses intent, validates against project goals, invokes persona agents, and handles decomposition. Refine Mode fetches the existing issue, applies guidance, shows a diff, and updates after confirmation.
---

## Flags

### `--r <number>` (Refine Mode)

If the arguments contain `--r` followed by a GitHub issue number (e.g. `--r 123`), activate **refine mode**:

- Extract the issue number immediately after `--r`
- Treat all remaining arguments (excluding `--r <number>` and any other flags) as refinement guidance
- Jump to the [Refine Mode Workflow](#refine-mode-workflow) section — skip the standard Create Mode workflow entirely

**`--r` and `--f` are mutually exclusive.** If both are present, stop immediately and tell the user:

> "`--r` (refine) and `--f` (fast) cannot be used together. To fast-refine an issue, use `--r <number>` without `--f`."

### `--f` (Fast Mode)

If the arguments contain `--f` (without `--r`), activate **fast mode** for Create Mode:

- **Use Haiku** — delegate the entire workflow to a subagent using `model: "haiku"` via the Agent tool, passing the full skill instructions and the user's message (minus `--f`) as the prompt
- **Skip Step 3** — do not ask clarifying questions; use best-effort judgment on intent, scope, and acceptance criteria
- **Skip Step 4** — do not invoke persona agents or present an impact table
- **Skip Step 5** — do not suggest decomposition; create a single issue as described
- **Still perform Step 5b** — determine the change type and include it in the issue body; this step requires no user interaction
- **Skip Step 7** — do not create a README issue even if no docs exist
- **Omit the Persona Impact section** from the issue body

Fast mode is for Create Mode only. It is not available in Refine Mode.

---

## Workflow

### Step 0: Preflight Check

Run the shared preflight script to verify prerequisites before doing any work:

```bash
bash .claude/skills/shared/preflight.sh
```

Stop on failure — do not proceed.

### Step 1: Validate Project Documentation

Look for project context files in this priority order: `CLAUDE.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `README.md`. Also read `docs/PRD.md` if it exists — focus on **§3 Goals & Objectives** (what the product is trying to achieve and explicit non-goals) and **§4 User Personas** (who the product is for). Read to understand:

- Project goals and vision
- Tech stack and architecture
- Scope of the project
- What's in/out of scope
- Which user personas will be affected
- Whether the request is explicitly listed as a non-goal

If **none** of these files exist, note this — you'll create an issue for a project README in addition to the requested issue.

### Step 2: Parse & Understand Intent

From the user's message, extract:

- Core intent (what needs to be done)
- Implied scope and complexity
- Technical assumptions being made
- Any explicit requirements or acceptance criteria mentioned
- Whether this aligns with the project's goals

### Step 3: Determine if Clarifying Questions Are Needed

> **Fast mode (`--f`):** Skip this step entirely. Make best-effort judgments on intent, scope, and acceptance criteria and proceed.

Ask clarifying questions if ANY of the following are true:

**Vague Intent:**

- Description uses fuzzy language ("better", "improve", "fix", "optimize")
- Lacks specifics about what, why, or how
- Could reasonably be interpreted multiple ways

**Unclear Scope:**

- The issue could be split into multiple smaller, more manageable pieces
- Dependencies between related work aren't obvious
- It conflates different concerns (e.g., backend infrastructure + UI)

**Missing Acceptance Criteria:**

- No clear way to know when the work is done
- No testable, verifiable outcomes defined
- "Done" is subjective

**Project Misalignment:**

- Based on the README or PRD (if they exist), this feature doesn't seem to serve the project's stated goals or targets a persona not in scope
- It introduces scope creep or premature optimization
- The technical approach doesn't match the project's architecture

**Technical Assumptions:**

- The description implies a specific solution (websockets, Redis, GraphQL) without exploring alternatives
- The assumption might not be optimal for this project

**Missing Project Context:**

- The project nature/goals are unclear (no README exists)
- You need to ask what the project is about to validate the request

When you ask questions, be conversational and brief — explain why you're asking.

### Step 4: Persona Impact Table & Discussion

> **Fast mode (`--f`):** Skip this step entirely. Do not invoke persona agents.

Before creating any issue, dynamically discover persona agents, invoke them all in parallel, and present the results for discussion.

**Discover persona agents:**

1. List all `.md` files in `.claude/agents/` (relative to the project root)
2. For each file, read the frontmatter and check for `role: persona`
3. Invoke only the agents that have `role: persona` — ignore all others

This means the agent list is determined at runtime. New agents added with `role: persona` are automatically included without modifying this skill.

**Invoke all persona agents IN PARALLEL**, providing each with:

- The proposed issue title and description
- Relevant project context (stack, user goals, current issue scope)

After all agents respond, present results per persona:

- [agent name] — [impact] — [key concern]

Then ask the user (use `AskUserQuestion` with selectable options):

- If ALL personas are Positive or Neutral:

  > "All personas are satisfied. Ready to create the issue?"
  > Options: (1) Yes, create the issue (2) Discuss further (3) Cancel

- If ANY persona is Negative or Mixed:
  > "One or more personas have concerns (see table above). What would you like to do?"
  > Options: (1) Proceed anyway (2) Discuss with personas to refine (3) Cancel

**If the user chooses to discuss further / refine:**
Let the discussion proceed. Re-invoke relevant persona agents as needed with the updated feature description and present fresh verdicts. Present the confirmation gate again.

**If the user cancels:** Stop the workflow entirely.

**If the user proceeds:** Save the final **## Persona Impact** table (the most recently produced one) — it will be included in the issue body in Step 6.

### Step 5: Evaluate Complexity & Suggest Decomposition

> **Fast mode (`--f`):** Skip this step entirely. Create a single issue as described.

If the issue is complex, consider breaking it into smaller issues. Signs it should be split:

- Multiple distinct technical components (frontend + backend + database)
- Sequential dependencies (can't build B until A is done)
- Could be delivered in stages, with value at each stage
- Different teams or expertise areas are involved

If you recommend splitting, create issues in dependency order and explain the sequence.

### Step 5b: Determine Change Type

> **Fast mode (`--f`):** Still perform this step — it requires no user interaction and the hint is always included in the issue body.

Analyze the intent of the issue and pick **exactly one** change type:

- **Breaking Change** — API changes, removed features, schema migrations that break backwards compat
- **New Feature** — new functionality, new screens, new endpoints, new modules
- **Bug Fix** — corrections, patches, non-functional fixes

This is a hint stored in the issue body so that `/commit` can validate it later against the actual changes. Use best-effort judgment based on the description.

### Step 6: Create the GitHub Issue(s)

> **Fast mode (`--f`):** Omit the `## Persona Impact` section from the issue body.

Use the script at `.claude/skills/issue/create-issue.sh` to create issues. For each issue:

**Title:** Action-oriented, specific, under 60 characters

- Good: "Add logout button to app menu"
- Bad: "Logout functionality", "Fix stuff"

**Body:** Use the template for the active mode:

**Standard mode:**

```
## Description
[Why is this needed? What problem does it solve? Who benefits?]

## Requirements
- [Specific, testable requirement]
- [Specific, testable requirement]

## Acceptance Criteria
- [ ] [Specific, verifiable outcome]
- [ ] [Specific, verifiable outcome]

## Change Type
<exactly one of: Breaking Change | New Feature | Bug Fix>
*(hint — will be validated against actual changes at commit time)*

## Persona Impact

| Persona | Impact | Key Concern |
| --- | --- | --- |
| [agent name] | [impact] | [key concern] |

## Additional Context
[Any relevant links, architecture notes, dependencies, or design docs]
```

**Fast mode (`--f`):**

```
## Description
[Why is this needed? What problem does it solve? Who benefits?]

## Requirements
- [Specific, testable requirement]
- [Specific, testable requirement]

## Acceptance Criteria
- [ ] [Specific, verifiable outcome]
- [ ] [Specific, verifiable outcome]

## Change Type
<exactly one of: Breaking Change | New Feature | Bug Fix>
*(hint — will be validated against actual changes at commit time)*

## Additional Context
[Any relevant links, architecture notes, dependencies, or design docs]

---
*Created with `/issue --f` (fast mode — no persona review, no clarifying questions)*
```

### Step 7: Handle Missing Documentation

> **Fast mode (`--f`):** Skip this step entirely.

If none of `CLAUDE.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, or `README.md` exist, create TWO issues:

1. "Add project README.md" with a description suggesting key sections: Project Overview, Getting Started, Architecture, Contributing Guidelines, Tech Stack
2. The actual feature issue the user requested

### Step 8: Provide Summary to User

Show the user:

- The GitHub issue URL(s) created
- A brief explanation of what was created and why
- If you asked clarifying questions, how those shaped the final issue
- If you split the issue, the dependency order

---

## Implementation Notes

**How to infer project goals:**

- Read `CLAUDE.md`, `ARCHITECTURE.md`, `CONTRIBUTING.md`, `README.md` (whichever exist)
- Read `docs/PRD.md` §3 (Goals) and §4 (Personas) if present — this is the authoritative source for what the product is and who it serves
- Check recent git commits and branches
- Look at package.json (dependencies reveal tech choices)
- Review the app.config.js or similar (for mobile apps)

**How to validate alignment:**

- Does this issue move the project toward its stated goals?
- Does this introduce new dependencies or tech that's misaligned?
- Is this premature optimization or premature generalization?
- Would a clearer, simpler approach serve the project better?

**How to handle pushback:**
If you determine the requested issue isn't aligned with project goals, be respectful but clear. Example:

> "I see what you're going for. Based on the README, this project is focused on [core goal]. This feature seems to assume [different goal]. Should we reframe this to serve [core goal] instead? Or is the README out of date?"

---

## Examples

See `.claude/skills/issue/examples.md` for worked examples covering clear, vague, complex, and missing-README cases.

---

## Refine Mode Workflow

Triggered by `--r <number>`. Fetches the existing issue, applies the user's guidance, proposes a diff, and updates the issue after confirmation.

### R1: Fetch the Existing Issue

Run:

```bash
bash .claude/skills/issue/fetch-issue.sh <number>
```

This outputs the current `number`, `title`, `body`, `labels`, and `state` as JSON. Record the **current title** and **current body** separately — you will need them for comparison in R3.

### R2: Understand the Refinement Guidance

From the refinement guidance (everything after `--r <number>` excluding flags), extract what the user wants to change:

- Specific fields to update (title, description, requirements, acceptance criteria, context)
- New information to incorporate
- Things to remove or reframe
- A new direction entirely

If the guidance is **empty or very vague**, ask using `AskUserQuestion`:

> "What would you like to change about issue #[number]?"

Provide options like: "Tighten acceptance criteria", "Update description", "Add context", "Rewrite title", "Other (type below)".

### R3: Propose Changes

Produce a revised title and revised body based on the guidance. Follow these rules:

- **Preserve all existing sections** that are not targeted by the guidance. If the live issue body contains sections beyond the standard template (e.g. triage notes, bot-generated content), carry them forward verbatim. If the live issue has a `## Depends On` section, remove it — relationships are tracked via GitHub's native Relationships feature, not in the body.
- **Only modify sections** that the guidance explicitly calls for.
- **Preserve the original title** unless the guidance explicitly asks to change it.
- **Update `## Change Type`** if the guidance changes the nature of the work (e.g., scope expands from a bug fix to a new feature). If the live issue has no `## Change Type` section, do not add one.
- Show the user a clear before/after for each changed section. If the title changed, show both the old and new title.

Use `AskUserQuestion` to confirm:

> "Here are the proposed changes to issue #[number]. Apply them?"
> Options: (1) Yes, update the issue (2) Edit further (3) Cancel

If the user chooses **Edit further**, let the discussion proceed and re-propose until they approve or cancel.

### R4: Update the Issue

Once approved, update using only the fields that changed (pipe body via stdin when `--body` is passed):

- If the title changed: `echo "New body" | bash .claude/skills/issue/update-issue.sh <number> --title "New Title" --body`
- If only the body changed: `echo "New body" | bash .claude/skills/issue/update-issue.sh <number> --body`
- If both changed: `echo "New body" | bash .claude/skills/issue/update-issue.sh <number> --title "New Title" --body`

### R5: Summary

Show the user the issue URL and a brief description of what changed.

---

## Script Usage

Create a single issue using the bundled script (body is piped via stdin):

```bash
echo "Issue body here" | bash .claude/skills/issue/create-issue.sh "Issue Title"
```

Update an existing issue (pass only the flags for fields that changed; body is read from stdin when `--body` is passed):

```bash
echo "New body" | bash .claude/skills/issue/update-issue.sh <number> --title "New Title" --body
echo "New body" | bash .claude/skills/issue/update-issue.sh <number> --body
bash .claude/skills/issue/update-issue.sh <number> --title "New Title"
```

Fetch an existing issue's content (returns JSON with `number`, `title`, `body`, `labels`, `state`):

```bash
bash .claude/skills/issue/fetch-issue.sh <number>
```

> Note: `fetch-issue.sh` in this skill fetches a smaller field set than the one in `implement/` — the implement skill additionally fetches `assignees`, `milestone`, and `comments`. Both are intentional: refine mode only needs content fields; implement needs full issue context.

The current working directory must be within a git repo — the target GitHub repo is inferred by `gh` from `git remote get-url origin`.
