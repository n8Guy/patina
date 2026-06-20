---
name: format-agent-md
description: Lint and auto-fix agent-only markdown files for token efficiency and model readability.
user_invocable: true
---

# /format-agent-md — Lint and auto-fix agent-only markdown

You are a precise markdown formatter. Your job is to apply the agent-MD rule set to all agent-only files in this repo, with a dry-run gate before any mutations.

The skill accepts an optional argument: a single path or subdir to scope the run (e.g. `/format-agent-md .claude/skills/commit`).

---

## Phase 0 — Resolve targets

Run the target resolver to get the file list:

```bash
node .claude/skills/format-agent-md/list-targets.mjs
```

If a scope argument was passed, append it:

```bash
node .claude/skills/format-agent-md/list-targets.mjs <scope>
```

If the output is empty, report "No agent-only files found in scope." and stop.

Store the list of paths — you will use it in every subsequent phase.

---

## Phase 1 — Read the rule set

Read `.claude/skills/format-agent-md/rules.md` before judging any file. The rules must be in context for the analysis in Phase 2.

---

## Phase 2 — Dry run (analysis only — NO writes)

For each target file:

1. Read the file.
2. Identify violations of R1–R10 per the rule set.
3. Classify each violation: auto-fixable (R1, R2, R3, R4, R5, R8) or manual-review (R6, R7, R9).
4. For R6 (cross-file duplication): compare files to detect blocks appearing near-verbatim in 2+ targets. Record: files involved, duplicated topic, recommendation (`extract to .claude/skills/shared/ and reference it`).
5. Build a per-file change list.

**Write nothing in this phase.** This is analysis only.

---

## Phase 3 — Plain-language scope summary (gate)

Before any mutation, present this summary using `AskUserQuestion`:

> Rewriting N Claude-internal instruction files to be more efficient for Claude to read. These are the files that tell Claude how to do its job — your own notes, skills, and career data are NOT touched. Files affected: [list filenames only, not full paths]. M files also have items I can't fix automatically and will flag for you to review. Proceed?

Offer these options:
- "Apply fixes (recommended)"
- "Show me the detailed diff first"
- "Cancel"

**Rules for this summary:**
- Avoid jargon: no "frontmatter", "lint", "glob", "regex", "R1"/"R2", or similar.
- Make clear that personal data (notes, career content, skills) is untouched.
- Use plain file names (e.g. `skill.md`, `commit/skill.md`), not full repo-relative paths.

If the user chooses "Show me the detailed diff first", display a file-by-file summary of proposed changes (human-readable, not a git diff), then ask again.

If the user chooses "Cancel", stop immediately with no writes.

---

## Phase 4 — Apply auto-fixes

On confirmation, apply fixes for R1, R2, R3, R4, R5, R8 to each file via the Edit tool, one file at a time.

**Hard guardrails (R10 and frontmatter):**
- Never alter text inside fenced code blocks (``` ... ```).
- Never reformat or remove YAML frontmatter (`---` blocks).
- Never remove or alter `name:`, `description:`, `patina: managed`, or `_patina_note:` keys.
- Never alter `{{ VAR }}` or `{{VAR}}` template tokens — preserve spacing exactly.

Auto-fix is the default path. Do not stop to warn about auto-fixable items — fix them.

---

## Phase 5 — Surface manual-review items

After applying auto-fixes, print a consolidated list of items that were flagged but NOT auto-applied, grouped by file:

- **R6 (duplication):** files involved, duplicated topic, recommendation.
- **R7 (depth):** file, section name, line count, recommendation (move to reference file).
- **R9 (comments):** file, code block location, specific comment, why it may be a WHAT comment.

Never silently skip manual-review items. If there are none, say "No manual-review items found."

---

## Phase 6 — Report

Summarize:
- Files changed — count and list
- Fixes applied per rule (e.g. "R1: 3 tables converted, R8: 5 scaffolding headings removed")
- Manual-review items remaining — count
- Any files skipped and why
