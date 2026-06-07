import { render } from '../../template.js';
import { tpl } from '../../template-loader.js';
import type { ModuleDefinition, FileEntry } from '../types.js';
import type { TemplateVars } from '../../types.js';

// Single source of truth for managed paths.
const GOALS_MANAGED_PATHS = [
  '.claude/commands/goal.md',
  '.claude/commands/goal-review.md',
  '.claude/modules/goals/manifest.md',
  '.claude/modules/goals/CLAUDE.md',
] as const;

// .gitkeep is intentionally omitted — it is a sentinel file emitted as an empty-string
// tuple in contentFiles(), not a rendered template. MODULE_CONTENT_FILES (built from
// contentFileNames) tracks only template-sourced content files.
const CONTENT_FILE_NAMES = [
  'INSTRUCTIONS.md',
] as const;

export const goalsModule = {
  id: 'goals',
  label: 'Goals',
  hint: 'track and review your forward-looking goals',

  commands: [
    { name: '/goal <description>', desc: 'Create a new goal' },
    { name: '/goal-review', desc: 'Review open and in-progress goals, flag overdue' },
  ],

  managedPaths: GOALS_MANAGED_PATHS,

  contentFileNames: CONTENT_FILE_NAMES,

  managedFiles(vars: TemplateVars): FileEntry[] {
    return [
      ['.claude/commands/goal.md', render(tpl('modules/goals/commands/goal.md'), vars)],
      ['.claude/commands/goal-review.md', render(tpl('modules/goals/commands/goal-review.md'), vars)],
      ['.claude/modules/goals/manifest.md', render(tpl('modules/goals/manifest.md'), vars)],
      ['.claude/modules/goals/CLAUDE.md', render(tpl('modules/goals/CLAUDE.md'), vars)],
    ];
  },

  contentFiles(vars: TemplateVars, contentDir: string): FileEntry[] {
    return [
      ...CONTENT_FILE_NAMES.map((file): FileEntry => [
        `${contentDir}/goals/${file}`,
        render(tpl(`modules/goals/graph/${file}`), vars),
      ]),
      [`${contentDir}/goals/.gitkeep`, ''],
    ];
  },

  readmeBlock(vars: TemplateVars): string {
    return [
      '## Goals module',
      '',
      'Tracks your forward-looking goals across different time horizons.',
      '',
      '### Folder additions',
      '',
      '```',
      `${vars.CONTENT_DIR}/goals/`,
      '  INSTRUCTIONS.md     — module rules and guidance',
      '  <slug>.md           — one file per goal',
      '```',
      '',
      '### Commands',
      '',
      '| Command | What it does |',
      '|---------|-------------|',
      '| `/goal <description>` | Create a new goal |',
      '| `/goal-review` | Review open and in-progress goals, flag overdue |',
    ].join('\n');
  },

  demoContent(vars: TemplateVars, contentDir: string): Array<[string, string]> {
    // Compute future dates from vars.TODAY using UTC to stay deterministic across timezones.
    const year = parseInt(vars.TODAY.slice(0, 4), 10);
    const month = parseInt(vars.TODAY.slice(5, 7), 10) - 1; // 0-indexed
    const day = parseInt(vars.TODAY.slice(8, 10), 10);

    const threeMonths = new Date(Date.UTC(year, month + 3, day));
    const threeMonthsStr = threeMonths.toISOString().split('T')[0];

    const endOfYearStr = `${year}-12-31`;

    const shipQstat = `---
status: in-progress
horizon: quarter
type: project
created: ${vars.TODAY}
due: ${threeMonthsStr}
---

# Ship qstat Rust rewrite

Rewrite the qstat CLI in Rust and publish a new release. The current Node.js implementation is slow on large queues and hard to distribute as a single binary.

**Definition of done:** v2.0.0 tagged and published to crates.io, README updated with install instructions.
`;

    const landRetainer = `---
status: open
horizon: year
type: job-search
created: ${vars.TODAY}
due: ${endOfYearStr}
---

# Land a second retainer client

Secure a second ongoing retainer engagement to stabilise revenue alongside Cedar Health. Target: a company in healthtech, fintech, or logistics where backend reliability is a core concern.

**Definition of done:** signed contract for a retainer of at least 20 hrs/month.
`;

    const finishRustBook = `---
status: open
horizon: quarter
type: learning
created: ${vars.TODAY}
---

# Finish the Rust async book

Work through the entire Rust Async Programming book and build the two exercises at the end. Goal is to reach production-confident Rust, not just "comfortable reading."

**Definition of done:** both capstone exercises complete and pushed to GitHub.
`;

    const publishNorthwind = `---
status: done
horizon: week
type: project
created: ${vars.TODAY}
---

# Publish Northwind Freight writeup

Write and publish a post-mortem / case study on the Northwind Freight API rewrite engagement — latency improvements, what was left unfinished, what I'd do differently.

**Definition of done:** post published to ellisonlabs.dev/writing.
`;

    return [
      [`${contentDir}/goals/ship-qstat-rust-rewrite.md`, shipQstat],
      [`${contentDir}/goals/land-second-retainer-client.md`, landRetainer],
      [`${contentDir}/goals/finish-rust-async-book.md`, finishRustBook],
      [`${contentDir}/goals/publish-northwind-writeup.md`, publishNorthwind],
    ];
  },
} satisfies ModuleDefinition;
