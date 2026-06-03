import * as p from '@clack/prompts';
import chalk from 'chalk';
import { render } from '../../template.js';
import { tpl } from '../../template-loader.js';
import type { ModuleDefinition, FileEntry, ModuleAddInputs } from '../types.js';
import type { TemplateVars, Profile } from '../../types.js';

const LI_COMMANDS = [
  'li-all.md', 'li-about.md', 'li-headline.md', 'li-experience.md',
  'li-skills.md', 'li-featured.md', 'li-activity.md',
] as const;

// Single source of truth for managed paths — used by both managedPaths and managedFiles().
const LI_MANAGED_PATHS = [
  ...LI_COMMANDS.map(c => `.claude/commands/${c}`),
  '.claude/modules/linkedin/manifest.md',
  '.claude/modules/linkedin/CLAUDE.md',
] as const;

const CONTENT_FILE_NAMES = [
  'INSTRUCTIONS.md',
  'LinkedIn Current State.md',
  'LinkedIn About.md',
  'LinkedIn Headline.md',
  'LinkedIn Experience.md',
  'LinkedIn Skills.md',
  'LinkedIn Featured.md',
  'LinkedIn Activity.md',
] as const;

export const linkedinModule = {
  id: 'linkedin',
  label: 'LinkedIn',
  hint: 'draft and refine your LinkedIn profile',

  requiresConfig: true,

  async promptsOnAdd(): Promise<ModuleAddInputs> {
    const url = await p.text({
      message: "What's your LinkedIn profile URL?",
      placeholder: 'https://linkedin.com/in/yourname',
      hint: chalk.hex('#64748B')('optional — you can add this later in profile.yaml'),
    });
    return { liProfileUrl: typeof url === 'string' ? url.trim() : '' };
  },

  managedPaths: LI_MANAGED_PATHS,

  contentFileNames: CONTENT_FILE_NAMES,

  managedFiles(vars: TemplateVars): FileEntry[] {
    const files: FileEntry[] = LI_COMMANDS.map(cmd => [
      `.claude/commands/${cmd}`,
      render(tpl(`modules/linkedin/commands/${cmd}`), vars),
    ]);
    files.push([
      '.claude/modules/linkedin/manifest.md',
      render(tpl('modules/linkedin/manifest.md'), vars),
    ]);
    files.push([
      '.claude/modules/linkedin/CLAUDE.md',
      render(tpl('modules/linkedin/CLAUDE.md'), vars),
    ]);
    return files;
  },

  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[] {
    return CONTENT_FILE_NAMES.map(file => [
      `${contentDir}/linkedin/${file}`,
      render(tpl(`modules/linkedin/graph/${file}`), vars),
    ]);
  },

  onAdd(profile: Profile, inputs: ModuleAddInputs): Profile {
    if (!profile.linkedin?.profile_url && inputs.liProfileUrl?.trim()) {
      return { ...profile, linkedin: { profile_url: inputs.liProfileUrl.trim() } };
    }
    return profile;
  },

  onRemove(profile: Profile): Profile {
    const updated = { ...profile };
    delete (updated as Partial<Profile>).linkedin;
    return updated;
  },

  launchTasks: [
    {
      id: 'open-drafts',
      label: 'Show open LinkedIn drafts',
      template: '- Show any LinkedIn section drafts in `{{CONTENT_DIR}}/linkedin/` that have content to review.',
    },
  ] as const,

  demoContent(vars: TemplateVars, contentDir: string): Array<[string, string]> {
    const about = `---
date: ${vars.TODAY}
type: linkedin-draft
section: about
status: draft
---

# LinkedIn About — Draft

Backend-leaning full-stack consultant. Eight years in, I parachute into small engineering teams, get a stalled system shipped, then hand it back maintainable.

I work with two to three clients at a time — mostly early-stage startups and growth-stage teams who need someone who can context-switch between architecture decisions and hands-on implementation.

Recent work: a HIPAA-aware patient intake pipeline for a telehealth startup, a late API rewrite rescue for a logistics company (cut p95 latency from 4 s to under 400 ms), and a checkout race-condition fix for an e-commerce platform.

I care about observability, clean handoffs, and code the next engineer doesn't need a tour to understand.

Open to backend, full-stack, and platform/infra contracts. TypeScript, Go, Node.js, PostgreSQL. Building Rust.

## Changelog

| Date | Change |
|------|--------|
| 2025-06-01 | Initial draft |
`;

    const headline = `---
date: ${vars.TODAY}
type: linkedin-draft
section: headline
status: draft
---

# LinkedIn Headline — Draft

**Current draft:**
Independent Software Consultant · Backend systems, API reliability, HIPAA pipelines · TypeScript / Go

**Alternatives considered:**
- Freelance Backend Engineer · Helping early-stage teams ship and stabilize
- Software Consultant · Distributed systems · TypeScript, Go, Rust (in progress)

## Changelog

| Date | Change |
|------|--------|
| 2025-06-01 | Initial draft |
`;

    const experience = `---
date: ${vars.TODAY}
type: linkedin-draft
section: experience
status: draft
---

# LinkedIn Experience — Draft

## Ellison Labs — Independent Software Consultant
*January 2023 – Present*

Running a small consultancy focused on backend systems for early-stage teams. Typical engagement: join a team with a stalled or fragile system, stabilize and ship it, hand it back with documentation and test coverage.

**Selected work:**
- Cedar Health (telehealth): designed HIPAA-aware patient intake pipeline; cut onboarding time from 45 min to under 10 min. Ongoing retainer.
- Northwind Freight (logistics): rescued a late shipment-tracking API rewrite; cut p95 latency from 4.2 s to 380 ms. Handed off with observability backlog documented.
- Loom & Lyre (e-commerce): diagnosed and fixed checkout race condition causing ~2% order duplication; root cause was missing idempotency keys on payment provider calls.

---

## Meridian Financial — Staff Engineer
*June 2019 – December 2022*

Led a backend platform team of four engineers owning the transaction processing service (Go, Kafka, Postgres). Team dissolved in a 2023 reorg; chose not to transition to the surviving product line.

---

## Broadfield Systems — Senior Software Engineer
*March 2017 – May 2019*

Full-stack feature work on a SaaS HR platform (Node.js, React, MySQL).

## Changelog

| Date | Change |
|------|--------|
| 2025-06-01 | Initial draft |
`;

    const skills = `---
date: ${vars.TODAY}
type: linkedin-draft
section: skills
status: draft
---

# LinkedIn Skills — Draft

**Top skills to feature:**
1. Backend Systems Design
2. API Development (REST)
3. TypeScript
4. Go
5. PostgreSQL
6. Kafka / Event-driven architecture
7. HIPAA-compliant systems
8. Observability & monitoring
9. Docker / AWS (ECS, RDS, SQS)
10. Technical leadership

**In-progress (building toward featuring):**
- Rust

**Do not feature yet:**
- React (light experience, not a differentiator)
- Python (occasional scripting only)

## Changelog

| Date | Change |
|------|--------|
| 2025-06-01 | Initial draft |
`;

    const featured = `---
date: ${vars.TODAY}
type: linkedin-draft
section: featured
status: draft
---

# LinkedIn Featured — Draft

**Candidates for Featured section:**

1. **qstat** — open-source CLI for inspecting job-queue backlogs (Redis / BullMQ). ~40 stars.
   Link: https://github.com/mara-ellison/qstat
   Reason: only public, shipped artifact; shows I finish things.

2. **Blog post (to write):** "What I learned rescuing a late API rewrite" — Northwind war story, anonymized. Would demonstrate ability to communicate about technical decisions.

**Hold:** no case studies published yet; Cedar Health is under NDA.

## Changelog

| Date | Change |
|------|--------|
| 2025-06-01 | Initial draft — qstat is the only ready item |
`;

    const activity = `---
date: ${vars.TODAY}
type: linkedin-draft
section: activity
status: draft
---

# LinkedIn Activity — Draft

**Current posting cadence:** none — account mostly dormant.

**Topics worth posting about (backlog):**
- The Northwind latency war story (anonymized) — observability gaps are expensive
- Why idempotency keys matter more than retry logic
- Honest take on learning Rust as a Go/TS developer mid-career
- What "maintainable handoff" actually looks like in a contract engagement

**Goal for next 90 days:** 2–3 posts, prioritizing the Northwind story and one Rust learning note.

## Changelog

| Date | Change |
|------|--------|
| 2025-06-01 | Initial draft — content backlog only, no posts yet |
`;

    const currentState = `---
date: ${vars.TODAY}
type: linkedin-draft
section: current-state
status: reference
---

# LinkedIn Current State

*Snapshot of live LinkedIn profile as of 2025-06-01 (demo placeholder)*

**Headline:** Software Consultant

**About:** (blank — not yet written)

**Experience:**
- Ellison Labs, Independent Consultant, 2023–present (no description)
- Meridian Financial, Staff Engineer, 2019–2022 (no description)
- Broadfield Systems, Senior Engineer, 2017–2019 (no description)

**Skills:** TypeScript, Node.js, Go

**Featured:** (empty)

**Activity:** last post 14 months ago (company repost, not original content)

---

*Use this file to track what's actually live versus what's in draft.*

## Changelog

| Date | Change |
|------|--------|
| 2025-06-01 | Initial snapshot captured |
`;

    return [
      [`${contentDir}/linkedin/LinkedIn About.md`, about],
      [`${contentDir}/linkedin/LinkedIn Headline.md`, headline],
      [`${contentDir}/linkedin/LinkedIn Experience.md`, experience],
      [`${contentDir}/linkedin/LinkedIn Skills.md`, skills],
      [`${contentDir}/linkedin/LinkedIn Featured.md`, featured],
      [`${contentDir}/linkedin/LinkedIn Activity.md`, activity],
      [`${contentDir}/linkedin/LinkedIn Current State.md`, currentState],
    ];
  },

  readmeBlock(vars: TemplateVars): string {
    return [
      '## LinkedIn module',
      '',
      'Drafts and refines your LinkedIn profile from your graph.',
      '',
      '### Folder additions',
      '',
      '```',
      `${vars.CONTENT_DIR}/linkedin/`,
      '  INSTRUCTIONS.md              — module rules and guidance',
      '  LinkedIn Current State.md    — your current live profile copy',
      '  LinkedIn About.md            — draft for the About section',
      '  LinkedIn Headline.md         — draft for your headline',
      '  LinkedIn Experience.md       — draft for your experience entries',
      '  LinkedIn Skills.md           — draft for your skills section',
      '  LinkedIn Featured.md         — draft for featured content',
      '  LinkedIn Activity.md         — draft for activity/posts section',
      '```',
      '',
      '### Commands',
      '',
      '| Command | What it does |',
      '|---------|-------------|',
      '| `/li-all` | Run all LinkedIn section drafts in sequence |',
      '| `/li-about` | Draft or refine your LinkedIn About section |',
      '| `/li-headline` | Draft or refine your LinkedIn headline |',
      '| `/li-experience` | Draft or refine your LinkedIn experience entries |',
      '| `/li-skills` | Draft or refine your LinkedIn skills section |',
      '| `/li-featured` | Draft or refine your LinkedIn featured content |',
      '| `/li-activity` | Draft or refine your LinkedIn activity section |',
    ].join('\n');
  },
} satisfies ModuleDefinition;
