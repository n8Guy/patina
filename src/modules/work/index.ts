import { render } from '../../template.js';
import { tpl } from '../../template-loader.js';
import type { ModuleDefinition, FileEntry } from '../types.js';
import type { TemplateVars } from '../../types.js';

const WORK_MANAGED_PATHS = [
  '.claude/commands/work-check.md',
  '.claude/modules/work/manifest.md',
  '.claude/modules/work/CLAUDE.md',
] as const;

// .gitkeep files for subfolders are emitted as empty-string tuples in contentFiles(),
// not rendered from templates, so they are intentionally omitted here.
const CONTENT_FILE_NAMES = [
  'INSTRUCTIONS.md',
  'profile.md',
] as const;

export const workModule = {
  id: 'work',
  label: 'Work',
  hint: 'capture and organise professional work artifacts',

  commands: [
    { name: '/work-check', desc: 'Status count of artifacts across each work subfolder (no input needed — runs during /reflect too)' },
  ],

  managedPaths: WORK_MANAGED_PATHS,

  contentFileNames: CONTENT_FILE_NAMES,

  managedFiles(vars: TemplateVars): FileEntry[] {
    return [
      ['.claude/commands/work-check.md', render(tpl('modules/work/commands/work-check.md'), vars)],
      ['.claude/modules/work/manifest.md', render(tpl('modules/work/manifest.md'), vars)],
      ['.claude/modules/work/CLAUDE.md', render(tpl('modules/work/CLAUDE.md'), vars)],
    ];
  },

  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[] {
    return [
      ...CONTENT_FILE_NAMES.map((file): FileEntry => [
        `${contentDir}/work/${file}`,
        render(tpl(`modules/work/graph/${file}`), vars),
      ]),
      [`${contentDir}/work/transcripts/.gitkeep`, ''],
      [`${contentDir}/work/weeklies/.gitkeep`, ''],
      [`${contentDir}/work/references/.gitkeep`, ''],
    ];
  },

  readmeBlock(vars: TemplateVars): string {
    return [
      '## Work module',
      '',
      'Captures raw professional artifacts that feed into your graph.',
      '',
      '### Folder additions',
      '',
      '```',
      `${vars.CONTENT_DIR}/work/`,
      '  INSTRUCTIONS.md     — module rules and guidance',
      '  profile.md          — how you work in your role',
      '  transcripts/        — meeting transcripts (one file per meeting)',
      '  weeklies/           — periodic activity summaries',
      '  references/         — supporting documents and context',
      '```',
      '',
      '### Intake',
      '',
      'Drop files into `inbox/` and run `/inbox`. Artifacts are routed to the correct subfolder automatically based on their `type` field.',
      '',
      '### Commands',
      '',
      '| Command | What it does |',
      '|---------|-------------|',
      '| `/work-check` | Surface a status count of artifacts across each work subfolder |',
    ].join('\n');
  },

  demoContent(vars: TemplateVars, contentDir: string): Array<[string, string]> {
    const profile = `---
date: 2022-11-01
type: work-profile
last-updated: 2022-11-01
archived: true
---

# Work Profile — Meridian Financial (archived)

*This is a snapshot from Mara's time as Staff Engineer at Meridian Financial (2019–2022). She went independent at the end of 2022. These notes were captured before her departure.*

---

## Role

**Title:** Staff Engineer
**Company:** Meridian Financial
**Team:** Backend Platform
**Reporting to:** VP Engineering

Responsible for the transaction processing service and the four-person team that owns it. The service handles all inbound payment events, deduplication, and ledger writes. I set technical direction, review all production changes, and represent the platform in cross-team planning.

---

## What I've shipped

- Rewrote the deduplication layer in the transaction processor to use a distributed lock (Redis + Postgres advisory locks). Eliminated a class of double-processing bugs that had caused three incidents in 18 months.
- Migrated the team from ad hoc deploys to a trunk-based flow with feature flags. Deploy frequency went from weekly to daily with zero increase in incidents.
- Shipped observability backlog: structured logging, latency histograms, and a Grafana dashboard covering all critical paths. Oncall handoffs went from 45-minute briefs to 10 minutes.

---

## Processes I've improved

- Replaced bi-weekly retrospectives (attendance ~40%) with async written retros in Notion. Participation jumped to 100% and the format produces more specific action items.
- Standardised incident response: template, severity levels, and a 48-hour post-mortem requirement for P0/P1s. Three incidents since adoption; all had post-mortems within 24 hours.

---

## People I've unblocked or supported

- Sponsored two engineers through the senior IC promotion process; both promoted in the 2022 cycle.
- Paired weekly with a junior engineer (Priya) for six months on systems design fundamentals. She shipped her first production service in month four.
- Unblocked the fraud team's dependency on transaction metadata by shipping a read-replica endpoint they could query without touching the write path.

---

## Decisions I've made or driven

- Chose Kafka over SQS for the new event pipeline based on replay requirements and ordering guarantees. Documented the tradeoffs in an ADR; decision held through two subsequent reviews.
- Decided against migrating to microservices in 2022 despite pressure from leadership. Made the case that the monolith's pain points were operational (deploy friction, observability gaps), not architectural, and those could be fixed without a rewrite.

---

## Context at departure

Chose not to follow the team into the surviving product line after the 2022–2023 reorg. Left on good terms. The runbook documentation project was handed off incomplete — that was a loose end.
`;

    const transcript = `---
date: 2022-11-14
type: transcript
participants: [Mara Ellison, Diego Reyes, Priya Nair, Sam Okafor, Jordan Liu]
tags: [sprint-planning, platform]
---

# Sprint Planning — Backend Platform — 2022-11-14

**Facilitator:** Mara Ellison
**Duration:** 60 minutes

---

## Agenda

1. Retro action items check-in (5 min)
2. Capacity — who is out, what is the adjusted velocity (5 min)
3. Backlog grooming — top items (30 min)
4. Commit to sprint (15 min)
5. Blockers and parking lot (5 min)

---

## Notes

**Retro action items:**
- Observability dashboard: shipped to staging last Tuesday, promoted to prod Thursday. Done.
- Async retro format: ran one cycle. Feedback from team was positive; keeping it.
- Oncall handoff template: first use was this week. Sam said it cut his ramp-up from 30 min to under 10. Keeping.

**Capacity:**
- Jordan is out Wednesday and Thursday (dentist, then travel). Adjusted velocity: 26 points (down from 31).
- No other absences flagged.

**Backlog grooming:**

PLAT-441 — Read-replica endpoint for fraud team (8 points)
- Fraud team has been blocked on this for six weeks. Query pattern is simple (read-by-transaction-id), but we need to expose it without polluting the write path.
- Discussed: expose via a new \`/v2/transactions/:id\` GET route backed by the read replica. No schema changes needed.
- Priya will own this. Mara to review the connection pool config before she starts.
- **Estimate: 8 points. Accepted into sprint.**

PLAT-448 — Structured logging cleanup in payment-events consumer (5 points)
- Several log statements in the consumer still use printf-style formatting. They won't parse correctly in our Grafana queries.
- Diego will pick this up. Estimated 2 days including tests.
- **Estimate: 5 points. Accepted into sprint.**

PLAT-452 — Investigate Redis lock contention on high-load days (5 points)
- Three alerts last Friday during the settlement window. The lock TTL may be too short for the throughput spikes.
- Sam will investigate. Deliverable: a writeup with recommended TTL change or an alternative approach, not a fix yet.
- **Estimate: 5 points. Accepted into sprint.**

PLAT-437 — ADR for event ordering guarantees (3 points)
- Carry-over from last sprint. Mara to finish this week; was deprioritised by the observability work.
- **Estimate: 3 points. Accepted into sprint.**

Total committed: 21 points (Jordan's reduced capacity means we left 5 points of buffer).

**Blockers:**
- Priya needs read access to the fraud team's staging environment to validate the read-replica endpoint. Mara to request this from fraud team EM today.
- No other blockers.

**Parking lot:**
- Jordan asked about migrating the test suite from Mocha to Vitest. Mara: "Not this quarter. Add it to the backlog for 2023 planning."
`;

    const weekly = `---
date: 2022-11-07
type: weekly
tags: [platform, sprint]
---

# Week of 2022-11-07 — Backend Platform

## What shipped

- **Observability dashboard** (PLAT-399): Promoted to production on Thursday. All four critical paths now have latency histograms and error-rate panels. Oncall team has been using it since Friday; first feedback from Sam: "I could debug the settlement spike in 8 minutes instead of the usual 45."
- **Async retro format** (process change): Ran first cycle. Eight responses out of eight team members (100% participation vs ~40% for the old format). Two action items closed immediately; one carried to sprint planning.

## What's in progress

- PLAT-441 (read-replica endpoint for fraud team): Priya has the design done, waiting on read-access credentials from fraud team EM. Should start implementation Tuesday.
- PLAT-437 (ADR for event ordering): Mara — 50% written. Blocked by sprint planning prep this week; target finish by Thursday.

## Decisions made

- Committed to 26-point sprint velocity for the next two weeks given Jordan's reduced availability.
- Decided to hold the Mocha → Vitest migration until 2023 planning. Not urgent; current test suite is stable.

## What I spent time on

- Sprint planning facilitation (60 min)
- 1-1s: Diego, Priya, Sam, Jordan (4 × 30 min)
- Cross-team: fraud team dependency unblock discussion (45 min)
- Stakeholder sync with VP Engineering on headcount projections (30 min) — not good news, but nothing official yet
- Incident review: one P2 on Wednesday (settlement window delay, 12 minutes). No post-mortem required at P2 but wrote a brief internal note.

## Concerns

The headcount conversation is starting to affect team morale. Diego asked me directly if we're at risk of layoffs. I told him I don't have confirmed information but that I'd share what I can when I can. Not sure that landed well.

Need to start the runbook documentation project before this gets urgent.
`;

    const reference = `---
date: 2022-10-18
type: reference
tags: [architecture, kafka, adr]
---

# ADR-007: Kafka for the Payment Events Pipeline

**Status:** Accepted
**Date:** 2022-10-18
**Author:** Mara Ellison

---

## Context

The current payment events consumer reads from a single SQS queue. We have three open issues related to event ordering (PLAT-388, PLAT-391, PLAT-402) and one recurring incident class (double-processing under high load) that we have been patching with increasingly complex deduplication logic.

The fraud team has also requested the ability to replay historical payment events for a 30-day window to backfill their risk scoring model. SQS does not support replay natively.

---

## Decision

Replace SQS with a Kafka topic (\`payment-events\`) as the event bus for the payment processing pipeline.

---

## Rationale

**Ordering guarantees:** Kafka partitions preserve event order within a partition key. We will partition by account ID, which gives us ordering per account — sufficient for the deduplication use case.

**Replay:** Kafka's log-based retention means the fraud team can consume from an arbitrary offset. We will retain 30 days of events, matching their stated requirement.

**Ecosystem fit:** The rest of the platform already uses Kafka (the settlement pipeline has been on it since 2021). Adding this consumer does not introduce a new technology dependency.

**SQS tradeoffs we are accepting:**
- At-least-once delivery: SQS and Kafka both provide at-least-once. Our deduplication layer remains necessary.
- Operational complexity: Kafka requires more operational overhead than SQS. We accept this given the existing team familiarity.

---

## Alternatives considered

**Keep SQS, fix ordering in application code:** Addressed in PLAT-388 (rejected). Ordering guarantees in application code are fragile and don't solve the replay requirement.

**SQS FIFO queues:** Support ordering but have a throughput cap (3,000 messages/second per queue) that we project we would hit during settlement windows by Q2 2023.

---

## Consequences

- New Terraform module needed for Kafka topic provisioning (Sam to own).
- Consumer migration: four consumer groups need to be migrated off SQS. Plan: run dual consumers (SQS + Kafka) in parallel for two weeks, then cut over. Estimated effort: 3 sprints.
- Fraud team can self-serve historical replay once the new topic is live.
`;

    return [
      [`${contentDir}/work/profile.md`, profile],
      [`${contentDir}/work/transcripts/sprint-planning-2022-11-14.md`, transcript],
      [`${contentDir}/work/weeklies/week-2022-11-07.md`, weekly],
      [`${contentDir}/work/references/adr-007-kafka-payment-events.md`, reference],
    ];
  },
} satisfies ModuleDefinition;
