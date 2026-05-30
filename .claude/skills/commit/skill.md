---
name: commit
description: Run all quality checks, review changes against the current issue, perform code review, and create a PR.
user_invocable: true
---

# /commit — Quality Gate, Review & PR

You are a senior code reviewer and release engineer. Your job is to validate, review, commit, push, and open a PR for the current branch's changes.

**Abort immediately and report to the user if any step in Phase 1 fails.**

---

## Phase 0: Preflight & Discover the Project

### 0a. Preflight Check

Run the shared preflight script to verify prerequisites before doing any work:

```bash
bash .claude/skills/shared/preflight.sh
```

If it fails, stop and show the error to the user — do not proceed with the workflow.

### 0b. Discover the Project

Before running anything, understand the project's tooling:

1. Read `package.json` (or equivalent manifest: `Cargo.toml`, `pyproject.toml`, `go.mod`, `Makefile`, etc.) to discover available scripts/commands.
2. Read `CLAUDE.md`, `CONTRIBUTING.md`, or `README.md` if they exist — look for test/lint/format/typecheck commands and commit conventions.
3. Identify the available commands for: **unit tests**, **integration tests**, **linting**, **formatting**, and **type checking**. Not all projects will have all of these — only run what exists.
4. Discover the **default/main branch** name using the shared script:

```bash
bash .claude/skills/shared/discover-default-branch.sh
```

This uses the `gh` API (fast, cached) with a local fallback. Store the result — you will need it in Phase 2, Phase 3, and Phase 6.

Use what you discover in the steps below. Do NOT assume `npm` commands — use whatever the project actually uses.

### 0c. Verify Workspace

1. If `.current-issue.md` does not exist, stop:
   > "`.current-issue.md` not found — you probably haven't run `/implement` yet. Run `/implement <issue-number>` to fetch the issue and set up a branch before committing."
2. Read `**Branch:**` from `.current-issue.md` to get the expected branch name.
   - If the value is `(set in Step 5)` or otherwise unresolved, stop:
     > "Branch hasn't been set up yet — `/implement` was interrupted before Step 5. Re-run `/implement <issue-number>` to continue from where it left off."
3. Run `git branch --show-current` and compare to the expected branch:
   - **Match** — proceed.
   - **Mismatch** — stop: "You're on `<current>` but `.current-issue.md` expects `<expected>`. Did you switch branches manually? Check out the correct branch and re-run `/commit`."

---

## Phase 1: Quality Gates (hard stop on failure)

Run all discovered checks. If **any** fail, stop, report the failures, and do NOT proceed to Phase 2.

### 1a. Unit Tests

Run the project's unit test command. Hard stop on failure.

### 1b. Integration Tests

Run the project's integration test command (if one exists).

If integration tests fail due to a **missing external dependency** (database not running, service unavailable, connection refused, etc.), warn the user and ask:

> "Integration tests failed — [dependency] doesn't appear to be running. Skip integration tests and continue, or abort?"

Only skip if the user explicitly agrees. All other integration test failures are hard stops.

### 1c. Linting

Run the project's lint-fix command (if one exists). If auto-fixed changes are produced, stage them silently — they'll be included in the commit. If there are remaining lint errors that couldn't be auto-fixed, hard stop.

### 1d. Formatting

Run the project's format command (if one exists). Stage any formatting changes silently.

### 1e. Type Checking

Run the project's type-check command (if one exists). Hard stop on any type errors.

---

## Phase 2: Scope Validation

Read `.current-issue.md` (if it exists) to understand the intent of the current issue. If `.current-issue.md` does not exist, infer the intent from the branch name and commit history.

Also check for `.implementation-plan.md`. If it exists, extract the issue number from its first line (`<!-- issue: #<number> -->`). Compare it to the issue number in `.current-issue.md`. If they match, read the plan and use it as additional context for scope validation and code review. If they don't match, ignore the plan file entirely — it's stale from a previous run.

Run `git diff <main-branch>...HEAD` to see all changes on this branch.

Validate that the changes are **confined to the intent of the issue**. Check for:

- Files modified that are unrelated to the issue
- Features added beyond what the issue describes
- Unrelated refactors or cleanups that weren't part of the scope

If scope creep is detected, report it to the user with specifics and ask whether to proceed or address it first.

---

## Phase 3: Code Review

Delegate to the reviewer agent. Use the Agent tool with `subagent_type="reviewer"` and `model="sonnet"`:

> "Review all changes on this branch for PR readiness.
>
> **Context:**
>
> - Read `.current-issue.md` (if it exists) to understand the intent of the changes.
> - Read `.implementation-plan.md` if it exists and its first-line issue number matches `.current-issue.md`.
> - Read `CLAUDE.md` for project-specific rules to enforce (accessibility, JSDoc, logging conventions, prohibited patterns, etc.).
> - Run `git diff <main-branch>...HEAD` to see all changes. Read full files where surrounding context is needed to judge correctness.
>
> Also check:
>
> - **SOLID Principles** — Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
> - **DRY** — Duplicated logic, copy-pasted blocks, patterns that warrant extraction
> - **Security** — Injection risks, XSS, credential exposure, auth checks, input validation at boundaries
>
> For each concern: include the file, line number, what's wrong, and a recommended fix."

Replace `<main-branch>` in the prompt with the actual main branch name determined in Phase 0.

Present the subagent's findings to the user.

**If there are Critical or Warning issues:** Ask the user "Would you like to address any of these before committing, or proceed as-is?" and wait for their response.

**If there are only Suggestions or no issues:** Proceed directly to Phase 4 without pausing.

---

## Phase 4: Determine Change Type

Analyze the changes and the issue to determine the change type. Pick **exactly one**:

- **Breaking Change** — API changes, removed features, schema migrations that break backwards compat
- **New Feature** — new functionality, new screens, new endpoints, new modules
- **Bug Fix** — corrections, patches, non-functional fixes

Store this value — it will be included in the PR body and used to update the GitHub issue.

### 4a. Update GitHub Issue Relationships

If `.current-issue.md` references a dependency (e.g., "Depends on #NNN", "companion to #NNN", "blocked by #NNN", "see also #NNN"), add the relationship to the GitHub issue using the native Relationships feature via GraphQL:

```bash
# Get node IDs for both issues
gh api graphql -f query='{ repository(owner: "OWNER", name: "REPO") { blocker: issue(number: NNN) { id } blocked: issue(number: CURRENT) { id } } }'

# Add the blocked-by relationship (current issue is blocked by NNN)
gh api graphql -f query='mutation { addBlockedBy(input: {issueId: "BLOCKED_ID", blockingIssueId: "BLOCKER_ID"}) { issue { number } blockingIssue { number } } }'
```

Do not add or update a `## Depends On` section in the issue body — the Relationship is the authoritative record.

---

## Phase 5: Commit

### 5a. Generate Commit Message

Use **Conventional Commits** format:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation
- `refactor:` for refactors
- `chore:` for maintenance

Generate a commit message that:

- Has a concise subject line (< 72 chars) describing WHAT changed
- Has a body explaining WHY (referencing the issue number if known)
- Includes `closes #<issue_number>` if the issue is fully resolved and the issue number is known

Present the proposed commit message using `AskUserQuestion` with a preview showing the message and options like:

- "Accept (Recommended)" — use the message as-is
- "Edit" — let the user modify the message
- "Rewrite" — generate a new message

The user can hit enter to accept the default.

### 5b. Stage and Commit

Stage changes using the bundled script (handles the empty-input guard; avoids `git add -A` or `git add .`):

```bash
bash .claude/skills/commit/stage-changes.sh
```

If Phase 1c/1d produced lint or format auto-fixes, stage those files explicitly by name afterward.

Before committing, run `git status` and show the staged file list to the user so they can confirm nothing unexpected is included.

Create the commit with the confirmed message. Use a HEREDOC for the message:

```bash
git commit -m "$(cat <<'EOF'
<confirmed commit message>

Co-Authored-By: Claude <model name from system context, e.g. "Sonnet 4.6", "Opus 4.6"> <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6: Push & PR

### 6a. Push

```bash
git push -u origin HEAD
```

### 6b. Create or Update Pull Request

The script checks whether an **open** PR already exists for this branch:

- **No open PR** — creates one targeting the base branch
- **Open PR exists** — updates its title and body in place; does not create a duplicate
- **Closed or merged PR exists** — treated as no PR; creates a fresh one

The PR title should match the commit subject line.

The PR body should include:

- A summary section derived from the issue and changes
- The change type (determined in Phase 4)
- A test plan section

```bash
echo "<pr body>" | bash .claude/skills/commit/create-pr.sh "<base-branch>" "<commit subject>"
```

PR body template:

```
## Summary
<bullet points summarizing changes, derived from the issue and diff>

Closes #<issue_number>
(omit this line if issue number is unknown)

## Change Type
<exactly one of: Breaking Change | New Feature | Bug Fix>

## Version Bump
<one of: major | minor | patch | none>

Mapping from change type:
- Breaking Change → major
- New Feature → minor
- Bug Fix → patch
- Chore / docs / refactor with no user-facing change → none

## Test plan
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Lint clean
- [ ] Type checks clean
- [ ] Manual verification of <key feature>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
```

> **Important:** The `## Version Bump` line is read by the `version-bump.yml` GitHub Action on merge. Always include it — use `none` if no version change is warranted.

Report the PR URL to the user when done.

### 6c. Attach Implementation Plan to Issue

If `.implementation-plan.md` exists and its first-line issue number (`<!-- issue: #<number> -->`) matches the current issue, post the plan as a comment on the GitHub issue to preserve architectural decisions.

Read `.implementation-plan.md` with the Read tool first, then inline the content directly as the body argument — do NOT use shell substitutions like `$(tail ...)`, as they don't work inside single-quoted HEREDOCs.

```bash
echo "<comment body>" | bash .claude/skills/commit/attach-plan-to-issue.sh <issue-number>
```

Comment body template:

```
<details>
<summary>Implementation Plan (generated by Claude)</summary>

<inline the full file content here, excluding the first <!-- issue: #NNN --> line>

</details>
```

Skip this step if `.implementation-plan.md` does not exist or the issue number does not match.

---

> **Note — Versioning:** Version bumps are handled automatically by a GitHub Action on PR merge. Do not include version changes in the commit or PR.
