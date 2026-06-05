import { slugify } from '../../wizard.js';

export interface BuildClientFilesOpts {
  name: string;
  engagementType: 'project' | 'retainer' | 'advisory';
  confidential: boolean;
  today: string;        // YYYY-MM-DD
  contentDir: string;
  /**
   * When true, emit engagements/initial.md with a full engagement info block
   * instead of just the folder .gitkeep. Used by the `patina client add` subcommand.
   * Demo mode leaves this false and provides its own named engagement files.
   */
  emitInitialEngagement?: boolean;
}

export function buildClientFiles(opts: BuildClientFilesOpts): Array<[string, string]> {
  const { name, engagementType, confidential, today, contentDir, emitInitialEngagement } = opts;
  const slug = slugify(name);
  const base = `${contentDir}/clients/${slug}`;

  const profile = `---
type: client-profile
client: ${name}
confidential: ${confidential}
started: ${today}
tags: []
---

# ${name}

<!-- Add relationship context here: how did you meet, what do they do, what's the engagement scope? -->
`;

  const entries: Array<[string, string]> = [
    [`${base}/profile.md`, profile],
    [`${base}/engagements/.gitkeep`, ''],
    [`${base}/deliverables/.gitkeep`, ''],
    [`${base}/notes/.gitkeep`, ''],
  ];

  if (engagementType === 'retainer' || engagementType === 'advisory') {
    entries.push([`${base}/retainer/.gitkeep`, '']);
  }

  if (emitInitialEngagement) {
    const initialEngagement = `---
type: engagement
client: ${name}
engagement_type: ${engagementType}
status: active
confidential: ${confidential}
started: ${today}
completed:
outcomes:
  # - Add outcomes here as they occur
  # - e.g., Reduced onboarding time by 40%
  # - e.g., Delivered executive recommendation adopted by board
tags: []
---

# Initial Engagement

<!-- Describe the engagement scope, goals, and context here. -->
`;
    entries.push([`${base}/engagements/initial.md`, initialEngagement]);
    // Remove the .gitkeep since we have a real file
    const gitkeepIdx = entries.findIndex(([p]) => p === `${base}/engagements/.gitkeep`);
    if (gitkeepIdx !== -1) entries.splice(gitkeepIdx, 1);
  }

  return entries;
}
