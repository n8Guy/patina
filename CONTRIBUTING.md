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

### Testing locally

`npm run dev` launches the interactive wizard. Use `npx tsx src/cli.ts` directly when you need to pass arguments or invoke a specific subcommand non-interactively:

```bash
npx tsx src/cli.ts --version
npx tsx src/cli.ts update
```

This is the canonical way to exercise a specific command path without going through the wizard entry point.

### Testing a PR or branch

To test a contributor's branch or open PR against a real patina output folder — without checking it out locally:

```bash
# Test a branch
npx github:n8Guy/patina#<branch> [args]

# Test an open PR
npx github:n8Guy/patina#pull/<N>/head [args]
```

The `prepare` script (`npm run build`) runs automatically on `npm install`, so the `dist/` does not need to be committed to the branch — the npx install compiles it on the fly.

### Building

```bash
npm run build
```

Compiles TypeScript to `dist/` and copies templates to `dist/templates/`. The `dist/` directory is **gitignored** — it is built by the CI/publish workflow, not committed to the repo.

---

## Adding a predefined audience archetype

Patina ships built-in audience archetypes (Hiring Manager, Recruiter) that users can select during install or update. These are opt-in managed files: they are written when the user selects them in the wizard, and overwritten on `patina update` once installed.

To add a new predefined archetype:

1. **Create the template** at `src/templates/.claude/agents/<slug>.md`. Use existing archetypes as the model. The file must:
   - Include `patina: managed`, `role: audience`, `_patina_note`, `name`, and `description` in its frontmatter
   - Contain full canonical content (Role, What they care about, What impresses them, What concerns or bores them, Communication style)
   - May use `{{USER_TITLE}}` (and other `TemplateVars`) to personalize content — `baseManagedArchetypeFiles(vars)` renders them when vars are provided

2. **Register the path** in `MANAGED_FILES` in `src/checksums.ts` (e.g. `'.claude/agents/<slug>.md'`).

3. **Add to `PREDEFINED_ARCHETYPES`** in `src/scaffold.ts` — add an entry with `slug`, `name`, and `hint` (shown to users in the wizard multiselect).

4. **No catalog update needed** — `/with-audience` discovers archetypes dynamically by scanning `.claude/agents/` for files with `role: audience` in their frontmatter. The new archetype appears automatically once installed.

5. **Add tests** in `src/__tests__/scaffold.test.ts`:
   - Assert the template file has both `patina: managed` and `role: audience` in its frontmatter
   - Assert that after scaffold with the archetype selected, the on-disk file has no unreplaced `{{[A-Z_]+}}` tokens

6. **Run `npm test`** — the full suite must pass.

---

## Adding a module

Modules are self-contained feature packs (LinkedIn, resume, goals, …). Each one is a `ModuleDefinition` registered in `src/modules/registry.ts`, with its templates under `src/templates/modules/<name>/`.

The high-level steps are:

1. **Create templates** under `src/templates/modules/<name>/` — one file per managed or content output the module writes.
2. **Define the module** — add a `ModuleDefinition` to `src/modules/registry.ts` with at minimum `id`, `label`, `hint`, `commands`, `managedPaths`, `contentFileNames`, and a `demoContent` method.
3. **Declare managed paths** in the module's own `managedPaths` array — patina reads them automatically from the registry via `src/checksums.ts`. Do not edit `MANAGED_FILES` directly.
4. **Add tests** in `src/__tests__/<name>.test.ts` verifying the files that get written to disk.
5. **Run `npm test`** — the full suite must pass.

See **[MODULES.md](./MODULES.md)** for the full `ModuleDefinition` contract, the managed-vs-content file model, the `reflect_hook` convention, and a complete step-by-step checklist. It is the canonical reference — start there for anything not covered above.

---

## Managed-file fences and upgrades

### What fences are

Patina writes managed files (`CLAUDE.md`, `README.md`) containing fenced regions marked `<!-- patina:<id>:start -->` … `<!-- patina:<id>:end -->`. Everything **outside** a fence belongs to the user and is never touched on update — patina only rewrites what it owns.

Current `CLAUDE.md` fence ids (post-#118):

| Id | Content |
|----|---------|
| `profile` | User identity block (name, role, context) |
| `guide` | Orientation prose — what patina is, rules that always apply, session-start behaviour. One coarse block (see below). |
| `commands` | Slash-command reference |
| `modules` | Installed-module list |
| `launch` | Launch-task instructions (present when a launch task is configured; removed when unconfigured) |
| `update-check` | Update-check reminder (present when update-check is enabled; removed when disabled) |

`README.md` fences:

| Id | Content |
|----|---------|
| `base` | Static intro block ("This is your patina…") — always present from first install |
| *module-id* | Per-module reference block, e.g. `linkedin` — present when the module is installed |

### How upgrades decide

Per-section checksums stored in `.patina-state.json` (keyed `relativePath:id`, e.g. `CLAUDE.md:guide`) detect user edits. On update, `mergeSections` in `src/sections.ts` decides per section:

1. Section id is in the `overwrite` set → force-update regardless of edits.
2. Stored hash present **and** current on-disk hash differs → **skip** (user edited; leave untouched). No stored hash → treated as unedited.
3. Otherwise → update (or mark `unchanged` if content is identical).

One-time layout changes have used a bespoke pre-pass. `src/migrate-claude.ts` is one such migration — it detects and removes pre-#118 unfenced guide prose before the normal fence update runs. New content changes should not need a new bespoke migration (see the content-versioning decision below).

### Content-versioning decision (deferred)

Patina considered recording a durable per-section content-version (a merge *base*) in `.patina-state.json` alongside the checksum, to enable a future 3-way reconcile (old-patina-content vs new-patina-content vs user-edit) and retire bespoke migrations. **Decision: deferred.**

Rationale: pre-release, near-zero existing-user blast radius; the binary checksum is sufficient today; there is no pending `guide` content change requiring reconciliation; building a 3-way merge now is speculative (YAGNI).

**Revisit trigger:** when the first post-#118 change to a fenced section's built-in content lands. At that point, record base versions in `.patina-state.json` keyed `relativePath:id` *before* changing the content — the base is irrecoverable retroactively. The version source-of-truth should be keyed by globally-unique fence id (see namespace contract below).

### Coarse `guide` fence policy

The `guide` region is intentionally a single coarse fence covering all of patina's orientation prose. Split into finer fences only when a real need to update one subsection independently arises; splitting is itself a migration event and is not done speculatively.

### Fence-id namespace contract

Fence ids must be **globally unique across all managed files**. A module fence id (e.g. `linkedin` in `README.md`) must not collide with a core `CLAUDE.md` id. This keeps the per-section keying in `.patina-state.json` unambiguous and is a precondition for any future content-version source-of-truth keyed by bare id. If a collision ever becomes necessary, re-key by `relativePath:id` everywhere.

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
