import type { ScaffoldOptions } from '../types.js';

export const DEMO_TODAY = '2025-06-01';

export const DEMO_PERSONA: Omit<ScaffoldOptions, 'targetDir' | 'modules'> = {
  patinaName: 'patina-demo',
  userName: 'Mara Ellison',
  title: 'Independent Software Consultant',
  roleDescription:
    "I'm a backend-leaning full-stack consultant. Eight years in, I parachute into small teams, get a stalled system shipped, then hand it back maintainable.",
  jobDescriptionUrl: '',
  work: {
    self_employed: true,
    company_name: 'Ellison Labs',
    website: 'https://ellisonlabs.dev',
    company_description:
      'Independent consultancy helping early-stage teams ship and stabilize backend systems.',
  },
  editor: 'vscode',
  liProfileUrl: 'https://linkedin.com/in/mara-ellison-demo',
  contentDir: 'graph',
  launchTasks: [],
  demo: true,
  today: DEMO_TODAY,
};

export const DEMO_GRAPH_FILES: Array<[string, string]> = [
  [
    'graph/notes/northwind-freight-api-rescue.md',
    `---
date: 2025-06-01
type: note
tags: [client-work, logistics, api, performance, observability]
client: Northwind Freight
status: closed
---

# Northwind Freight — API Rewrite Rescue

**Engagement:** ~6 months, 2023–2024. Late shipment-tracking API rewrite in danger of being scrapped.

## What I found

The team had been attempting a rewrite of their shipment-tracking API for about a year. The original plan was a full re-architecture from a Rails monolith to a Go microservice. By the time I joined, they had:

- a partially migrated schema with dual-write (both sides slowly drifting)
- no meaningful test coverage on the new service
- a p95 latency of 4.2 s on the new service vs. 800 ms on the old (the opposite of what they expected)

## What I did

1. Profiled the new service — the latency was almost entirely two N+1 query patterns introduced in the migration that nobody had benchmarked.
2. Fixed the queries (two afternoon PRs). p95 dropped to 380 ms.
3. Documented the remaining dual-write logic with a concrete deprecation plan.
4. Helped them get the feature flag to 100% traffic on the new service.

## Honest loose end

The observability layer was never finished. I scoped it out, handed off a doc with the proposed approach (structured logging, a few key latency histograms), but the engagement ended before it was implemented. I don't know whether they picked it up.

## What I'd do differently

Don't accept a "we just need someone to finish it" brief without first doing a read-only week of profiling. The N+1 issues were invisible until measured.
`,
  ],
  [
    'graph/notes/cedar-health-intake-pipeline.md',
    `---
date: 2025-06-01
type: note
tags: [client-work, telehealth, hipaa, pipelines, ongoing]
client: Cedar Health
status: ongoing
---

# Cedar Health — HIPAA-Aware Intake Pipeline

**Engagement:** started early 2024, ongoing retainer.

## Background

Cedar Health is a telehealth startup handling intake for a network of mental health providers. When I joined, new patients were filling out a PDF form, emailing it to a care coordinator, who manually entered the data into the EMR. Median time from form submission to first appointment slot offered: 45 minutes on a good day, 3 hours on a bad one.

## What I built

An intake pipeline:
- Web form (React, nothing fancy) with conditional logic to skip irrelevant sections
- API layer (Node.js / TypeScript) that validates, encrypts at rest, and pushes to a queue
- Worker process that maps form responses into their EMR's HL7 FHIR format and writes them via the EMR's API
- Audit log for every PHI access (regulatory requirement)

Time from submission to EMR record: under 10 minutes on average. Care coordinators now only touch edge cases.

## HIPAA notes

- All PHI encrypted at rest (AES-256) and in transit (TLS 1.3 only)
- Audit log immutable (append-only table, no DELETE permission granted to app user)
- BAA in place; I reviewed it before starting
- Regular dependency scans; nothing flagged yet

## Current retainer scope

Monthly: dependency updates, incident response, feature additions. They have a small internal eng team now; I'm a safety net more than a primary engineer at this point.

## What I'm watching

Their volume is growing. The queue worker is single-process; if they hit 10x their current intake volume they'll need to horizontally scale it, which will require some careful thought about the audit log write ordering.
`,
  ],
  [
    'graph/notes/qstat-side-project.md',
    `---
date: 2025-06-01
type: note
tags: [side-project, open-source, tooling, redis, bullmq]
status: shipped
stars: ~40
repo: https://github.com/mara-ellison/qstat
---

# qstat — Job Queue Inspection CLI

**What it is:** A small CLI tool for inspecting the state of BullMQ job queues (Redis-backed). You give it a Redis connection string and it shows you a live table of queue depths, failed job counts, and recent failure messages without having to SSH into a box or open a Redis client.

## Why I built it

I kept running into the same problem at client sites: you suspect a queue is backed up or failing silently, but checking requires either a BullMQ dashboard (which nobody has set up) or raw Redis commands (which nobody remembers). I wanted a \`htop\`-style quick look.

## What it does

\`\`\`
$ qstat --url redis://localhost:6379
Queue           Active  Waiting  Failed  Delayed
intake-forms    2       14       3       0
email-delivery  0       0        1       0
audit-log       0       0        0       0
\`\`\`

\`--watch\` flag for live refresh. \`--fail-detail <queue>\` to print recent failure messages.

## Status

~40 stars on GitHub. A few people have opened issues; I've merged two small PRs from external contributors (timeout option, JSON output mode). Not actively developing new features, but I keep it working when BullMQ releases breaking changes.

## What I learned

This was my first npm package designed for other developers to install as a tool. The main thing I got wrong: I assumed everyone would have a local Redis. Added a \`--dry-run\` mode after several issues from people who wanted to test it against a remote Redis without risk.
`,
  ],
  [
    'graph/notes/learning-rust.md',
    `---
date: 2025-06-01
type: note
tags: [learning, rust, skill-building]
status: in-progress
confidence: low
---

# Learning Rust

**Where I am:** I can read Rust comfortably. I've written two small programs (a file watcher, an HTTP health-check tool). I am not yet production-confident — I wouldn't take a client engagement where Rust was the primary language.

## Why I'm learning it

Mostly honest curiosity. I do a lot of Go and TypeScript; Rust sits in an interesting space between them for systems-level work. Also, \`qstat\` could benefit from a rewrite — the Node.js startup time is annoying for a CLI tool.

## What's clicking

- Ownership model makes sense to me conceptually. I've stopped fighting the borrow checker and started listening to it.
- The toolchain (cargo, clippy, rustfmt) is genuinely better than the JS/Go equivalents.
- Error handling via \`Result\` / \`?\` feels natural after Go's explicit error returns.

## What's not clicking yet

- Lifetimes. I understand them in simple cases. I get lost in anything involving multiple structs with references.
- Async Rust. I've read the async book twice and I understand tokio's model in theory. In practice, I get confused about \`Send\` bounds and \`Pin\` when composing futures.
- The macro system. I'm leaving this for later.

## Current practice

Working through "Rust for Rustaceans" and building small tools. Goal: be able to write a non-trivial async service in Rust without constant reference-checking within 6 months.

## Note to self

Don't add this to LinkedIn or a proposal until I've shipped something non-trivial in production. Saying "building Rust" is fine; claiming it as a strength is not.
`,
  ],
  [
    'graph/notes/reorg-and-going-independent.md',
    `---
date: 2025-06-01
type: note
tags: [career, transition, reorg, independent]
status: reference
---

# Reorg and Going Independent

**Context:** In late 2022 / early 2023, Meridian Financial went through a restructuring. My team (backend platform, 4 engineers) was dissolved. The transaction processing service we owned was absorbed into a different product group.

## What happened

I was offered a role in the surviving product group (consumer-facing mobile app, React Native, different domain entirely). I considered it for about two weeks and declined.

Reasons:
1. I didn't want to work in React Native. It's not a values thing; it's just not where my skills or interest are.
2. The surviving product group had a culture I didn't want to join — I'd worked with them on a cross-team project and the incentives felt off.
3. I'd been curious about consulting for years and had been making excuses not to try it. This was a forcing function.

## How it went

Nerve-wracking for the first three months. My first client was a referral from a former colleague (the Northwind Freight engagement). That made it easier.

Two and a half years in: I'm glad I did it. The income is less predictable but the work is more varied and I'm learning faster than I was as a salaried engineer.

## What I'd tell someone considering the same

- Have 6 months of runway before you start. I had 4 and it was uncomfortable.
- Your first client will almost certainly be a referral. Invest in staying in touch with former colleagues.
- The thing you worry about most (inconsistent work) is real but manageable. The thing you don't anticipate (no one to think out loud with) is harder.
`,
  ],
  [
    'graph/skills/backend-systems.md',
    `---
date: 2025-06-01
type: skill
tags: [backend, systems, api, databases, messaging]
confidence: high
---

# Backend Systems

**Confidence: high.** This is my primary skill set.

## Core competencies

- **API design:** REST, versioning strategies, idempotency, pagination patterns. I've designed and maintained APIs at several clients. I have opinions about when to use query params vs. path params and I know when those opinions don't matter.
- **Databases:** PostgreSQL primarily. I can write and optimize complex queries, design schemas, manage migrations safely in production. Some MySQL and Redis.
- **Messaging / queues:** Kafka (Meridian), BullMQ/Redis (qstat, Cedar Health). I understand at-least-once vs. exactly-once delivery and the tradeoffs.
- **Observability:** Structured logging, distributed tracing (OpenTelemetry, have used Jaeger and Honeycomb), latency histograms. I consider observability a feature, not an afterthought — though I have a loose end at Northwind that contradicts this in practice.

## Languages (backend context)

- **TypeScript / Node.js:** daily driver, comfortable at scale
- **Go:** strong, used at Meridian for 3+ years
- **Rust:** learning, not production-ready yet

## Infrastructure / deployment

AWS (ECS, RDS, SQS, Lambda for lightweight tasks), Docker, GitHub Actions for CI. I can deploy things and keep them running but I don't call myself a DevOps engineer.

## What I'm not

A distributed systems researcher. I can implement well-understood patterns (saga, outbox, CQRS where it's warranted) but I'm not designing novel consensus protocols.
`,
  ],
  [
    'graph/skills/rust-in-progress.md',
    `---
date: 2025-06-01
type: skill
tags: [rust, learning, in-progress]
confidence: low
---

# Rust (In Progress)

**Confidence: low.** I can read it, write simple programs, and understand the ownership model. I am not production-ready.

See [[learning-rust]] for the full note.

## Summary for proposals / LinkedIn

Do not list as a primary skill. "Currently building Rust skills" is accurate. "Rust developer" is not.

## Checkpoint criteria for upgrading confidence

- [ ] Ship a non-trivial async service in production (or in an open-source project)
- [ ] Write code involving lifetimes that I understand without help
- [ ] Contribute a meaningful PR to someone else's Rust project
`,
  ],
];
