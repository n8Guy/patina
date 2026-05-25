# Contributing to patina

Thanks for your interest. Patina is an open source project maintained by [@n8Guy](https://github.com/n8Guy). Contributions are welcome — please read this before opening a PR.

---

## Project principles

Before proposing changes, keep these in mind:

1. **Approachable over powerful.** Patina is for non-technical users as much as engineers. Plain language, no jargon, obvious naming.
2. **Local and private by default.** Nothing should require an external service, account, or network call during setup or normal use.
3. **Graph is sacred.** The `graph/` directory is the user's content. No tool or upgrade should ever modify or delete it.
4. **Modules, not monolith.** New output targets (LinkedIn, resume, etc.) belong as modules — not baked into the core.

---

## Branch policy

### Main branch

`main` is the stable branch. It is protected:

- Direct pushes are not allowed (owner excepted for urgent fixes)
- All changes come in through pull requests
- CI must pass before merging (tests + build)
- Squash merge preferred — keeps the log readable

### Branch naming

Use one of these prefixes:

| Prefix | Use for |
|--------|---------|
| `feature/` | New capabilities |
| `fix/` | Bug fixes |
| `chore/` | Maintenance, deps, tooling |
| `docs/` | Documentation only |
| `module/` | New patina modules |

Examples: `feature/update-wizard`, `fix/windows-path-mcp`, `module/resume`

### Keep branches short-lived

Open a PR as soon as you have something reviewable — even if it's not finished. Draft PRs are fine. Long-lived branches diverge and get painful.

---

## Opening an issue

Before opening a PR, open an issue first for anything non-trivial. Describe:

- What you're trying to change and why
- Any design decisions you're considering

This avoids wasted work if the direction isn't right.

For bugs, include:
- OS and Node version
- What you ran
- What you expected vs. what happened

---

## Development setup

```bash
git clone https://github.com/n8Guy/patina.git
cd patina
npm install       # also runs the build via prepare
npm test          # run the test suite
npm run dev       # run the wizard locally without building
```

### Running the wizard locally

```bash
npm run dev
```

This runs the wizard directly from TypeScript source via `tsx`. No build step needed during development.

### Building

```bash
npm run build
```

Compiles TypeScript to `dist/` and copies templates to `dist/templates/`. The `dist/` directory is committed so `npx github:n8Guy/patina` works without a build step on the user's machine.

---

## Adding a module

Modules live in `src/templates/modules/<name>/`. A module consists of:

```
src/templates/modules/<name>/
├── manifest.md          required — frontmatter with name, label, reflect_hook
├── commands/            slash commands installed into .claude/commands/
│   └── *.md
└── graph/               files installed into the user's graph/<name>/ directory
    └── *.md
```

**The manifest is how `/reflect` discovers your module.** Its frontmatter must include:

```yaml
---
name: your-module-name
label: Human Readable Name
reflect_hook: your-command-name   # the command /reflect runs after its audit
description: One line description
installed: {{TODAY}}
---
```

Register the module in `src/scaffold.ts` (add its commands to `managedFiles`, add its graph files to the graph section) and in `src/checksums.ts` (`MODULE_MANAGED_FILES`).

Add scaffold tests in `src/__tests__/scaffold.test.ts`.

---

## Tests

```bash
npm test          # run once
npm run test:watch  # watch mode
```

All PRs must pass the full test suite. For new features, add tests. The scaffold integration tests in `scaffold.test.ts` are the most important — they verify the actual files that get written to disk.

---

## Pull request checklist

- [ ] Tests pass (`npm test`)
- [ ] Build passes (`npm run build`)
- [ ] New behaviour has test coverage
- [ ] Language is plain and approachable (no jargon in user-facing strings or templates)
- [ ] `graph/` is never modified by any new code path
- [ ] `BACKLOG.md` updated if something on the list is completed

---

## Releases

The maintainer handles releases. When a PR is merged to `main`:

1. Version is bumped in `package.json`
2. `npm run build` is run locally
3. Committed and tagged
4. `npm publish` (once the package is on npm)

There is no automated release pipeline yet — this is on the backlog.
