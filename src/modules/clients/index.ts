import { render } from '../../template.js';
import { tpl } from '../../template-loader.js';
import type { ModuleDefinition, FileEntry } from '../types.js';
import type { TemplateVars } from '../../types.js';

const CLIENTS_MANAGED_PATHS = [
  '.claude/commands/client-check.md',
  '.claude/modules/clients/manifest.md',
  '.claude/modules/clients/CLAUDE.md',
] as const;

const CONTENT_FILE_NAMES = [
  'INSTRUCTIONS.md',
] as const;

export const clientsModule = {
  id: 'clients',
  label: 'Clients',
  hint: 'track freelance, consulting, and advisory relationships',

  commands: [
    { name: '/client-check', desc: 'Status count of clients and their engagement state (no input needed — runs during /reflect too)' },
  ],

  managedPaths: CLIENTS_MANAGED_PATHS,

  contentFileNames: CONTENT_FILE_NAMES,

  managedFiles(vars: TemplateVars): FileEntry[] {
    return [
      ['.claude/commands/client-check.md', render(tpl('modules/clients/commands/client-check.md'), vars)],
      ['.claude/modules/clients/manifest.md', render(tpl('modules/clients/manifest.md'), vars)],
      ['.claude/modules/clients/CLAUDE.md', render(tpl('modules/clients/CLAUDE.md'), vars)],
    ];
  },

  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[] {
    return [
      ...CONTENT_FILE_NAMES.map((file): FileEntry => [
        `${contentDir}/clients/${file}`,
        render(tpl(`modules/clients/graph/${file}`), vars),
      ]),
      [`${contentDir}/clients/.gitkeep`, ''],
    ];
  },

  readmeBlock(vars: TemplateVars): string {
    return [
      '## Clients module',
      '',
      'Tracks your freelance, consulting, and advisory client relationships.',
      '',
      '### Folder additions',
      '',
      '```',
      `${vars.CONTENT_DIR}/clients/`,
      '  [client-slug]/        — one folder per client',
      '    profile.md          — who this client is and relationship context',
      '    engagements/        — bounded project records',
      '    deliverables/       — what was handed over',
      '    notes/              — ad-hoc relationship notes',
      '    retainer/           — monthly touchpoint records (retainer/advisory only)',
      '```',
      '',
      '### Adding a client',
      '',
      'To add a client, ask Claude to scaffold one in your session — it will create the folder structure and profile.',
      '',
      '### Commands',
      '',
      '| Command | What it does |',
      '|---------|-------------|',
      '| `/client-check` | Surface a status count of clients and their engagement state |',
    ].join('\n');
  },

  demoContent(_vars: TemplateVars, contentDir: string): Array<[string, string]> {
    // Cedar Health — ongoing retainer, private: false (so it flows into demo LinkedIn/resume)
    const cedarProfile = `---
type: client-profile
client: Cedar Health
private: false
started: 2024-01-15
tags: [telehealth, hipaa, ongoing]
---

# Cedar Health

Cedar Health is a telehealth startup handling intake for a network of mental health providers. Started as a project engagement to rebuild their patient intake pipeline; transitioned to a monthly retainer after go-live.

**How we connected:** Referral from a former colleague at Meridian Financial.

**Relationship context:** Primary point of contact is their CTO, Priya Vasquez. Small internal eng team (3 engineers). I'm a safety net and feature-extension resource, not a primary engineer at this point.
`;

    const cedarEngagement = `---
type: engagement
client: Cedar Health
engagement_type: retainer
status: active
private: false
started: 2024-01-15
completed:
outcomes:
  # - Reduced patient intake time from 45 min average to under 10 min
  # - Delivered HIPAA-compliant pipeline with full audit log
  # - Zero PHI incidents since go-live
tags: [telehealth, hipaa, pipelines, typescript, nodejs]
---

# HIPAA-Aware Intake Pipeline

**Scope:** Rebuild patient intake from a manual PDF/email workflow to an automated pipeline with HIPAA compliance controls baked in.

## What was delivered

- Web form (React) with conditional logic to skip irrelevant sections
- API layer (Node.js / TypeScript) that validates, encrypts at rest, and pushes to a queue
- Worker process that maps form responses into their EMR's HL7 FHIR format via the EMR API
- Audit log for every PHI access (regulatory requirement — append-only table, no DELETE)

## Transition to retainer

After go-live, transitioned to a monthly retainer covering: dependency updates, incident response, and feature additions.

## Current retainer scope

Monthly check-in + on-call. Volume is growing — queue worker is single-process and will need horizontal scaling if they hit 10x current intake volume.
`;

    const cedarDeliverable = `---
type: deliverable
client: Cedar Health
private: false
delivered: 2024-06-01
tags: [architecture, hipaa, documentation]
---

# HIPAA Compliance Architecture Brief

**Delivered to:** Priya Vasquez (CTO), Cedar Health
**Purpose:** Internal documentation for their compliance officer and future engineering hires.

## Summary

Documents the security controls implemented in the intake pipeline:

1. **Encryption at rest** — AES-256 for all PHI fields
2. **Encryption in transit** — TLS 1.3 enforced, no downgrade
3. **Audit log** — append-only table; app user has INSERT only, no DELETE or UPDATE
4. **BAA** — in place before any PHI was processed
5. **Dependency scanning** — monthly scan via GitHub Dependabot; no high-severity findings to date

## Open items at time of delivery

- Queue worker horizontal scaling plan (not yet needed but documented as a future risk)
- Key rotation schedule not yet established — recommended quarterly rotation
`;

    // Northwind Freight — completed project, private: false
    const northwindProfile = `---
type: client-profile
client: Northwind Freight
private: false
started: 2023-02-01
tags: [logistics, api, completed]
---

# Northwind Freight

Northwind Freight is a mid-size logistics company with a shipment-tracking API that had been stuck in a failed rewrite for about a year when I joined. Project engagement — completed and closed.

**How we connected:** First client after going independent — referral from Diego Reyes (former colleague at Meridian Financial).

**Relationship context:** Worked directly with their engineering lead, Sam Park. Friendly terms at close; they've referred two other potential clients since.
`;

    const northwindEngagement = `---
type: engagement
client: Northwind Freight
engagement_type: project
status: complete
private: false
started: 2023-02-01
completed: 2023-08-15
outcomes:
  # - Dropped p95 API latency from 4.2s to 380ms (two afternoon PRs)
  # - Unblocked a stalled rewrite that had been in flight for over a year
  # - Documented dual-write deprecation plan; handed off cleanly
tags: [logistics, api, performance, go, postgresql]
---

# Shipment-Tracking API Rewrite Rescue

**Scope:** ~6 months. Late shipment-tracking API rewrite in danger of being scrapped.

## What I found

- Partially migrated schema with dual-write (both sides slowly drifting)
- No meaningful test coverage on the new service
- p95 latency of 4.2s on the new service vs. 800ms on the old

## What I did

1. Profiled the new service — latency was almost entirely two N+1 query patterns introduced in the migration
2. Fixed the queries (two afternoon PRs). p95 dropped to 380ms
3. Documented the remaining dual-write logic with a concrete deprecation plan
4. Helped them get the feature flag to 100% traffic on the new service

## Honest loose end

The observability layer was scoped out and handed off as a doc but never implemented before the engagement ended. Don't know whether they picked it up.
`;

    const cedarRetainerCheckin = `---
type: retainer-checkin
client: Cedar Health
private: false
date: 2024-11-01
tags: [telehealth, retainer, checkin]
---

# November 2024 Retainer Check-in

**Status:** Active. No incidents this month.

**Completed this month:**
- Upgraded two Node.js dependencies flagged by Dependabot (no breaking changes)
- Brief async review of Priya's draft plan for horizontal queue scaling — recommended consistent hashing on patient ID to keep related records on the same worker

**Next month:**
- Q4 dep audit (scheduled)
- Monitor intake volume — approaching the threshold where single-process queue worker becomes a risk
`;

    return [
      [`${contentDir}/clients/cedar-health/profile.md`, cedarProfile],
      [`${contentDir}/clients/cedar-health/engagements/retainer-2024.md`, cedarEngagement],
      [`${contentDir}/clients/cedar-health/deliverables/hipaa-compliance-brief.md`, cedarDeliverable],
      [`${contentDir}/clients/cedar-health/retainer/2024-11-checkin.md`, cedarRetainerCheckin],
      [`${contentDir}/clients/northwind-freight/profile.md`, northwindProfile],
      [`${contentDir}/clients/northwind-freight/engagements/api-rescue-2023.md`, northwindEngagement],
    ];
  },
} satisfies ModuleDefinition;
