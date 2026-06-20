# Agent-only Markdown Rules

These rules apply to files consumed by Claude, not humans. Optimize for token efficiency and model readability.

## Scope

Targets are resolved by `.claude/skills/format-agent-md/list-targets.mjs` — see that file for the canonical glob patterns.

## Hard Guardrail

**R10 takes precedence over all other rules.** When any rule would alter text inside a fenced code block, skip it. YAML frontmatter is never reformatted; `name:`, `description:`, `patina: managed`, and `_patina_note:` are always preserved.

## Rules

**R1 no-tables** — No markdown tables. Convert to bullet lists (`key — value` per line). Tables cost tokens and reflow badly. *Auto-fixable.*

**R2 terse-em-dash** — Prefer terse `term — definition` phrasing over full sentences with linking verbs. *Auto-fixable with judgment.*

**R3 no-heading-restatement** — Don't restate the heading in the first sentence beneath it. *Auto-fixable.*

**R4 one-idea-per-bullet** — Each bullet carries one idea; split compound bullets joined by "and/also/then". *Auto-fixable.*

**R5 cut-redundant-prose** — Remove filler and ceremony. Examples: "It's important to note" → delete; "In order to" → "To"; "As mentioned above" → delete. *Auto-fixable.*

**R6 no-cross-file-duplication** — Content already in another agent-only file should be referenced, not copied. *Manual review — flag, never auto-rewrite.*

**R7 depth-to-references** — Long background/depth belongs in a linked reference file, not inline. Flag inline sections over ~40 lines of exposition. *Manual review / suggest.*

**R8 drop-scaffolding** — Remove human-doc scaffolding with no instruction value: `## Overview`, `## Introduction`, `## Conclusion`, boilerplate intros. *Auto-fixable.*

**R9 why-only-comments** — Inside fenced code blocks, comments should explain WHY, not narrate WHAT the code obviously does. *Manual review — don't auto-strip code comments.*

**R10 keep-signal-code-blocks** — Never delete or mangle fenced code blocks carrying executable signal. Formatting rules apply to prose only. **Hard guardrail.**
