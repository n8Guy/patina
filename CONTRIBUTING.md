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

> **Note:** Branches created by the `/implement` workflow use the format `issue-<N>-<slug>` (e.g. `issue-39-feat-add-cli-subcommand-parser`). This is intentional — those branches are bot-managed and do not follow the prefix convention above.

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

Compiles TypeScript to `dist/` and copies templates to `dist/templates/`. The `dist/` directory is **gitignored** — it is built by the CI/publish workflow, not committed to the repo.

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

The maintainer handles releases. Publishing is fully automated via GitHub Actions — no manual tagging or version commits needed.

### How releases work

Releases are driven by the `## Version Bump` directive in merged PR bodies. When a PR merges to `main`:

1. `version-bump.yml` reads the `## Version Bump` value from the merged PR body.
2. If a valid bump type is found, the workflow bumps `package.json`, opens a bot PR, and merges it to `main`. The bot PR is excluded from this flow by an internal guard — it will not re-trigger another bump.
3. That merge triggers `publish.yml`, which runs the test suite and publishes to npm (a no-op if the version is already on npm, so accidental double-merges are safe).

> **Owner only:** PRs to `main` require maintainer approval before merge. Non-owner contributors cannot cut releases.

### Version Bump directive

Add this to your PR body to request a release when the PR merges. Use the inline form — no blank line between the heading and value:

```
## Version Bump: patch
```

Or the next-line form (no blank line):

```
## Version Bump
patch
```

Accepted values:

| Value | When to use |
|-------|-------------|
| `major` | Breaking changes |
| `minor` | New backwards-compatible features |
| `patch` | Bug fixes and minor updates |
| `none` | No release needed |

Omitting the `## Version Bump` section entirely also defaults to `none`.

### Emergency releases

For urgent releases outside the normal PR flow, manually update the `version` field in `package.json` in your PR. The workflow detects the version change and skips the `## Version Bump` directive entirely; `publish.yml` publishes automatically when the PR merges to `main`. This path is owner-only.

### NPM_TOKEN prerequisite

Publishing requires an `NPM_TOKEN` secret in GitHub Actions (Settings → Secrets and variables → Actions).

Create a granular access token on npmjs.com scoped to the `my-patina` package with **publish** permission. Set an expiry (90 days recommended) and **renew it before it expires** — a lapsed token will cause the publish job to fail with 401. Update the secret in GitHub when you renew the token.
