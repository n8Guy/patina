# MODULES.md — Module System Extensibility Guide

This document is the canonical reference for anyone adding a new module to patina. It covers the `ModuleDefinition` contract, the file ownership model, the `reflect_hook` convention, and a step-by-step checklist.

---

## What is a module?

A module is a self-contained feature pack that patina installs into a target directory. Each module owns two categories of files:

- **Managed files** — Claude commands, a module manifest. Patina writes these on install and safely updates them on upgrade.
- **Content files** — User-facing drafting workspace (documents, instructions). Patina writes these on install only and never touches them again.

---

## The `ModuleDefinition` interface

Every module exports a single object satisfying `ModuleDefinition` from `src/modules/types.ts`:

```ts
export interface ModuleDefinition {
  id: string;
  label: string;
  hint: string;
  commands: readonly { name: string; desc: string }[];
  managedPaths: readonly string[];
  contentFileNames: readonly string[];
  managedFiles(vars: TemplateVars): FileEntry[];
  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[];
  onAdd?(profile: Profile, inputs: ModuleAddInputs): Profile;
  onRemove?(profile: Profile): Profile;
}
```

### Field reference

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | `string` | yes | Unique identifier, lowercase (e.g. `'linkedin'`). Must match the `ModuleId` union in `src/types.ts`. |
| `label` | `string` | yes | Human-readable name shown in the install wizard (e.g. `'LinkedIn'`). |
| `hint` | `string` | yes | One-line description shown next to the label in the wizard (e.g. `'draft and refine your LinkedIn profile'`). |
| `commands` | `{ name; desc }[]` | yes | The module's slash commands. `name` is the invocation as typed (e.g. `'/goal <description>'`), `desc` is a one-line summary. Used to build the regenerated command table in `CLAUDE.md` and to surface module commands in the startup orientation. Must match the manifest's `commands:` frontmatter — a test enforces this. |
| `managedPaths` | `readonly string[]` | yes | Static list of all paths that `managedFiles()` will produce. Must be in sync — define a `const` array and reference it from both. `checksums.ts` reads this at runtime to build the managed-files registry. |
| `contentFileNames` | `readonly string[]` | yes | Base filenames (not full paths) of content files. Used with the checksums registry to distinguish content files from managed files. |
| `managedFiles(vars)` | method | yes | Returns `[relativePath, content]` pairs for all managed files — commands and the module manifest. Paths must match `managedPaths` exactly. |
| `contentFiles(vars, contentDir)` | method | yes | Returns `[relativePath, content]` pairs for content-dir files. Paths must be relative to the patina install root and must include `contentDir` as a prefix (e.g. `${contentDir}/my-module/My Draft.md`). Patina writes these on install; they are never overwritten. |
| `onAdd?(profile, inputs)` | method | no | Called after file writes, before `profile.yaml` is saved. Mutate the profile to add module-specific keys (see Profile config below). |
| `onRemove?(profile)` | method | no | Called after file deletions, before `profile.yaml` is saved. Clean up any module-specific profile keys. |

### `managedPaths` and `managedFiles()` must stay in sync

The `managedPaths` array is consumed at runtime by `checksums.ts` to build the `MODULE_MANAGED_FILES` registry. The `managedFiles()` method is also called at runtime to produce file content. If they diverge, the checksum registry will mis-track files. The reason `managedPaths` must be a static array — not computed inside `managedFiles()` — is so a single `const` can be the source of truth for both. Use a shared const array:

```ts
const MY_MANAGED_PATHS = [
  '.claude/commands/my-command.md',
  '.claude/modules/my-module/manifest.md',
] as const;

export const myModule = {
  managedPaths: MY_MANAGED_PATHS,
  managedFiles(vars) {
    return MY_MANAGED_PATHS.map(/* ... */);
  },
  // ...
} satisfies ModuleDefinition;
```

---

## Managed files vs. content files

### Managed files

Patina owns managed files. On every `patina update` run, for each managed file:

1. If the file does not exist on disk: write it. Outcome: **added**.
2. If the file exists: compute its hash and compare to the stored checksum in `.patina-state.json`.
   - If the hashes match, or if no stored checksum exists for the file: patina overwrites it with the latest template output. Outcome: **updated**.
   - If the hashes differ (user has edited the file): patina skips it. Outcome: **skipped**.

The "no stored checksum" case (step 2, first bullet) occurs on the first update run after a fresh install or after migrating from a legacy version — patina treats the file as unmodified and brings it up to date.

Managed files are command files (`.claude/commands/*.md`) and the module manifest (`.claude/modules/<id>/manifest.md`).

### Content files

Content files are user-owned. Patina writes them once on `patina init` and never touches them again — not on upgrade, not on reinstall. These live under `<content_dir>/<module>/` and hold the user's drafts, current state, and instructions.

Because content files are never overwritten, users can edit them freely without risk of losing work.

---

## The `reflect_hook` contract in `manifest.md`

Every module includes a manifest at `.claude/modules/<id>/manifest.md`. The manifest has a YAML frontmatter block:

```yaml
---
name: <module-id>
label: <Module Label>
reflect_hook: <command-slug>
description: <one-line description>
commands:
  - name: /my-command <arg>
    desc: <one-line summary>
installed: {{TODAY}}
---
```

The `commands:` list must match the module definition's `commands` field exactly (a test enforces this). It is read at session start to surface the module's commands in the orientation block.

In the template source, use `{{TODAY}}` for the `installed` field — patina substitutes it with the installation date at render time. The rendered file will contain a `YYYY-MM-DD` date.

The `reflect_hook` field is the slug of a Claude command (without the `.md` extension). When the user runs `/reflect`, Step 5 of the reflect command:

1. Globs `.claude/modules/*/manifest.md`
2. Reads each file's frontmatter
3. Extracts `reflect_hook` and runs the named command in sequence

This means new modules are picked up automatically by `/reflect` — nothing in the base `reflect.md` command needs to change when a module is added or removed.

**Example:**

```yaml
reflect_hook: li-all   # runs /li-all during every reflect cycle
```

The hook command is responsible for reading the graph and producing an updated draft. Patina provides the dispatch; each module provides the logic.

---

## The `private` convention

Outbound modules — modules that generate content intended for sharing externally (LinkedIn copy, a resume, a post) — must respect a `private` marker in graph notes.

Patina never auto-publishes, so the user is always the final reviewer. Outbound modules therefore **warn rather than block**. If a note contains `private: true` in its frontmatter, or reads as sensitive (sourced from `clients/`, or mentioning unreleased/internal/pre-launch work, an NDA, or unannounced figures), the module surfaces a single heads-up for the whole draft — naming the source and asking the user to confirm they're cleared to share — then proceeds if the user is fine with it. It does not silently drop the content.

```yaml
---
date: 2024-01-15
type: note
private: true   # warn before using in LinkedIn, resume, posts
---
```

This is a behavioral contract enforced by the module's command prompt, not by code. The canonical wording lives in each outbound module's `INSTRUCTIONS.md` ("Sharing is your call"). The flag is set just-in-time: the user — or Claude, on the user's say-so — sets `private: true` when a heads-up surfaces or in plain conversation. There is no capture-time prompt.

The `exclusions.md` file is a related but separate mechanism — it excludes specific items from all output by name, unconditionally. The `private` flag only triggers a warning; the decision stays with the user.

---

## Profile config — where module-specific keys live

Module configuration lives in `profile.yaml` under a namespace matching the module's `id`. Patina merges this on upgrade without overwriting user-set values.

**Adding keys on install:** implement `onAdd` to set initial values:

```ts
onAdd(profile, inputs) {
  if (!profile.linkedin?.profile_url && inputs.liProfileUrl?.trim()) {
    return { ...profile, linkedin: { profile_url: inputs.liProfileUrl.trim() } };
  }
  return profile;
}
```

The guard `!profile.linkedin?.profile_url` prevents overwriting a value the user already has set — apply a similar guard in your own `onAdd` to make reinstall idempotent.

**Removing keys on uninstall:** implement `onRemove` to clean up:

```ts
onRemove(profile) {
  const updated = { ...profile };
  delete (updated as Partial<Profile>).linkedin;
  return updated;
}
```

If your module adds no profile-level config (like the resume module), you can omit both hooks.

---

## `.patina-state.json` vs. `profile.yaml`

| | `.patina-state.json` | `profile.yaml` |
|---|---|---|
| **Purpose** | Internal machinery | User-facing configuration |
| **Contents** | SHA-256 checksums for managed files | Name, modules list, content_dir, module config |
| **Ownership** | Patina only | User + patina (merges safely) |
| **Gitignored** | Yes — always | No — commit it (it is your configuration source of truth; the gitignore intentionally excludes only `.patina-state.json`) |
| **Edit manually?** | Never | Yes, safe to edit |

`.patina-state.json` is how patina knows whether a managed file has been user-modified since the last install or upgrade. Deleting it is safe — patina will treat all managed files as unmodified and rewrite them on the next update.

`profile.yaml` is the source of truth for who the user is and what modules are installed. It survives upgrades intact.

---

## Adding a new module — checklist

Follow these steps in order. The registry comment in `src/modules/registry.ts` repeats steps 1–3 as a quick reminder.

### 1. Create the module definition

Create `src/modules/<name>/index.ts` and export a `ModuleDefinition` object. Use an existing module (`linkedin` or `resume`) as a reference.

Minimum viable structure:

```ts
import type { ModuleDefinition } from '../types.js';

const MY_MANAGED_PATHS = [
  '.claude/commands/my-command.md',
  '.claude/modules/my-module/manifest.md',
] as const;

const CONTENT_FILE_NAMES = ['INSTRUCTIONS.md', 'My Draft.md'] as const;

export const myModule = {
  id: 'my-module',
  label: 'My Module',
  hint: 'describe what this module does',
  commands: [
    { name: '/my-command <arg>', desc: 'what this command does' },
  ],
  managedPaths: MY_MANAGED_PATHS,
  contentFileNames: CONTENT_FILE_NAMES,
  managedFiles(vars) { /* return [path, content] pairs */ },
  contentFiles(vars, contentDir) { /* return [path, content] pairs */ },
} satisfies ModuleDefinition;
```

### 2. Register the module

In `src/modules/registry.ts`:

```ts
import { myModule } from './my-module/index.js';

export const MODULES = [linkedinModule, resumeModule, myModule] as const;
```

### 3. Add the module ID to the type union

In `src/types.ts`, add the new id to `ModuleId`:

```ts
export type ModuleId = 'linkedin' | 'resume' | 'my-module';
```

This union is kept in `types.ts` rather than derived from the registry to avoid a circular dependency (`checksums.ts` → `registry.ts` → `types.ts`).

### 4. Create templates

Add your templates under `src/templates/modules/<name>/`:

```
src/templates/modules/my-module/
  manifest.md                   ← required; must include reflect_hook frontmatter
  commands/
    my-command.md               ← one file per command
  graph/
    INSTRUCTIONS.md             ← content file: user-facing workflow guide
    My Draft.md                 ← content file: user-facing draft document
```

The `graph/` subdirectory name is load-bearing — `tpl()` resolves content file templates as `modules/<name>/graph/<filename>`. Do not rename it.

The manifest template must have the `reflect_hook` field in its frontmatter (see above).

### 5. Write tests

Add a test file at `src/__tests__/<name>.test.ts` covering at minimum:

- `managedFiles()` returns the correct paths and non-empty content for all entries
- `contentFiles()` returns the correct paths for all content files
- `managedPaths` matches the paths produced by `managedFiles()`
- `onAdd` / `onRemove` behave correctly if implemented

### 6. Verify end-to-end

Run `patina init` with the module selected and confirm:

- All managed files appear at the expected paths
- All content files appear under `<content_dir>/<name>/`
- `/reflect` runs the module's hook without error
- `patina update` updates managed files and skips user-modified ones
