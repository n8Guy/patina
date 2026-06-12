import { render } from '../../template.js';
import { tpl } from '../../template-loader.js';
import type { ModuleDefinition, FileEntry } from '../types.js';
import type { TemplateVars } from '../../types.js';

// Single source of truth for managed paths.
const RESUME_MANAGED_PATHS = [
  '.claude/commands/resume-refresh.md',
  '.claude/modules/resume/CLAUDE.md',
  '.claude/modules/resume/manifest.md',
] as const;

const CONTENT_FILE_NAMES = [
  'INSTRUCTIONS.md',
  'Resume Working Draft.md',
  'Resume Last Submitted.md',
] as const;

export const resumeModule = {
  id: 'resume',
  label: 'Resume',
  hint: 'keep your resume current from your graph',

  commands: [
    { name: '/resume-refresh', desc: 'Refresh your resume working draft from your graph (no input needed — Claude reads your notes)' },
  ],

  managedPaths: RESUME_MANAGED_PATHS,

  contentFileNames: CONTENT_FILE_NAMES,

  managedFiles(vars: TemplateVars): FileEntry[] {
    return [
      ['.claude/commands/resume-refresh.md', render(tpl('modules/resume/commands/resume-refresh.md'), vars)],
      ['.claude/modules/resume/CLAUDE.md', render(tpl('modules/resume/CLAUDE.md'), vars)],
      ['.claude/modules/resume/manifest.md', render(tpl('modules/resume/manifest.md'), vars)],
    ];
  },

  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[] {
    return CONTENT_FILE_NAMES.map(file => [
      `${contentDir}/resume/${file}`,
      render(tpl(`modules/resume/graph/${file}`), vars),
    ]);
  },

  launchTasks: [
    {
      id: 'resume-stale-check',
      label: 'Flag resume if it may be out of date',
      template: '- Compare `{{CONTENT_DIR}}/resume/Resume Working Draft.md` against recent notes and flag if the resume looks out of date.',
    },
  ] as const,

  readmeBlock(vars: TemplateVars): string {
    return [
      '## Resume module',
      '',
      'Keeps your resume current by synthesising it from your graph.',
      '',
      '### Folder additions',
      '',
      '```',
      `${vars.CONTENT_DIR}/resume/`,
      '  INSTRUCTIONS.md              — module rules and guidance',
      '  Resume Working Draft.md      — the resume you are actively editing',
      '  Resume Last Submitted.md     — the version you last sent to an employer',
      '```',
      '',
      '### Commands',
      '',
      '| Command | What it does |',
      '|---------|-------------|',
      '| `/resume-refresh` | Refresh your resume working draft from your graph |',
    ].join('\n');
  },

  demoContent(vars: TemplateVars, contentDir: string): Array<[string, string]> {
    const workingDraft = `---
date: ${vars.TODAY}
type: resume
status: draft
---

# Mara Ellison — Resume Working Draft

**Independent Software Consultant**
mara@ellisonlabs.dev · https://ellisonlabs.dev · https://linkedin.com/in/mara-ellison-demo

---

## Summary

Backend-leaning full-stack consultant with eight years of experience parachuting into small engineering teams, getting stalled systems shipped, and handing them back maintainable. Specialties: API design, distributed systems, HIPAA-aware data pipelines, observability.

Currently taking on two to three concurrent clients.

---

## Experience

### Ellison Labs — Independent Consultant
*2023 – present*

**Cedar Health** (telehealth startup) — Designed and built a HIPAA-aware patient intake pipeline. Reduced onboarding time from 45 minutes to under 10. Ongoing retainer.

**Northwind Freight** (logistics) — Rescued a late shipment-tracking API rewrite. Cut p95 latency from 4.2 s to 380 ms. Engagement ended before observability layer was completed (backlog item handed off).

**Loom & Lyre** (e-commerce) — One-month spike to diagnose and fix a checkout race condition causing ~2% of orders to duplicate. Root cause: missing idempotency key on payment provider calls.

### Meridian Financial — Staff Engineer
*2019 – 2023*

Led backend platform team of four. Owned the transaction processing service (Go, Kafka, Postgres). Team dissolved in 2023 reorg; chose not to move to the surviving product line and went independent instead.

### Broadfield Systems — Senior Software Engineer
*2017 – 2019*

Full-stack feature work on a SaaS HR platform (Node.js, React, MySQL).

---

## Skills

**Strong:** TypeScript, Go, Node.js, PostgreSQL, REST API design, Kafka, Docker, AWS (ECS, RDS, SQS)

**Building:** Rust (comfortable reading, not yet production-confident)

**Light experience:** React, Python, Redis

---

## Projects

**qstat** — Open-source CLI for inspecting job-queue backlogs (Redis-backed BullMQ). ~40 GitHub stars. https://github.com/mara-ellison/qstat

---

## Education

B.S. Computer Science — State University, 2017
`;

    const lastSubmitted = `---
date: ${vars.TODAY}
type: resume
status: submitted
submitted_to: Cedar Health (contract renewal)
---

# Mara Ellison — Resume (Last Submitted)

*Submitted to Cedar Health for contract renewal discussion — 2025-05-15*

**Independent Software Consultant**
mara@ellisonlabs.dev · https://ellisonlabs.dev

---

## Summary

Backend consultant specialising in data pipelines, API reliability, and HIPAA-compliant systems. Eight years of professional experience across fintech, logistics, and telehealth. Strong bias toward maintainable, observable code that the next engineer can understand without a tour.

---

## Relevant Experience

**Ellison Labs / Cedar Health** — Ongoing engagement since 2024. Built patient intake pipeline; reduced onboarding time from 45 min to under 10 min. Implemented audit logging to support HIPAA compliance review.

**Ellison Labs / Northwind Freight** — API rewrite rescue, 2023–2024. Cut p95 latency by 91%. Documented remaining observability gaps for internal team to complete.

**Meridian Financial** — Staff Engineer, 2019–2023. Led transaction processing platform; team dissolved in reorg.

---

## Skills

TypeScript, Go, Node.js, PostgreSQL, Kafka, Docker, AWS, REST API design

---

## Projects

qstat — open-source job-queue inspection CLI (~40 stars)

## Changelog

| Date | Change |
|------|--------|
| 2025-05-15 | Submitted to Cedar Health for renewal discussion |
| 2025-04-01 | Updated Northwind engagement end date and handoff notes |
`;

    return [
      [`${contentDir}/resume/Resume Working Draft.md`, workingDraft],
      [`${contentDir}/resume/Resume Last Submitted.md`, lastSubmitted],
    ];
  },

  // Resume has no module-specific profile fields — no onAdd/onRemove needed.
} satisfies ModuleDefinition;
