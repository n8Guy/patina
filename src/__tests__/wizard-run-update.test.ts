import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';
import { scaffold } from '../scaffold.js';
import { hashContent } from '../checksums.js';
import { readState } from '../state.js';
import { applyProfileUpdate, applyModuleChanges, applyLaunchTaskUpdate, syncBaseFiles } from '../wizard.js';
import type { Profile, ScaffoldOptions } from '../types.js';

let tmp: string;
let targetDir: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-run-update-test-'));
  targetDir = join(tmp, 'my-patina');
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

function opts(overrides: Partial<ScaffoldOptions> = {}): ScaffoldOptions {
  return {
    targetDir,
    patinaName: 'test-patina',
    userName: 'Jane Doe',
    title: 'Senior Designer',
    roleDescription: 'I design product experiences.',
    jobDescriptionUrl: '',
    work: {
      self_employed: false,
      company_name: 'Acme Corp',
      website: 'https://acme.com',
      company_description: 'A software company.',
    },
    editor: 'vscode',
    modules: [],
    liProfileUrl: '',
    contentDir: 'graph',
    ...overrides,
  };
}

function loadProfile(): Profile {
  return yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;
}

function loadState() {
  return readState(targetDir);
}

function read(rel: string): string {
  return readFileSync(join(targetDir, rel), 'utf8');
}

function exists(rel: string): boolean {
  return existsSync(join(targetDir, rel));
}

// ── Group 1: applyProfileUpdate — updating personal info ──────────────────────

describe('applyProfileUpdate — updating personal info', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('updates identity fields in profile.yaml', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: 'I build distributed systems.',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: 'https://newcorp.com',
      companyDescription: 'A new company.',
    });

    const updated = loadProfile();
    expect(updated.name).toBe('John Smith');
    expect(updated.title).toBe('Staff Engineer');
    expect(updated.role_description).toBe('I build distributed systems.');
    expect(updated.work.company_name).toBe('NewCorp');
  });

  it('re-renders managed files with new values', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: '',
      companyDescription: '',
    });

    const claudeMd = read('CLAUDE.md');
    expect(claudeMd).toContain('John Smith');
    expect(claudeMd).toContain('NewCorp');
    expect(claudeMd).not.toContain('Jane Doe');
  });

  it('returns updated file list', () => {
    const result = applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: '',
      companyDescription: '',
    });

    expect(result.updated).toContain('CLAUDE.md');
    expect(result.skipped).toHaveLength(0);
  });

  it('omits blank optional fields', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'Jane Doe',
      title: 'Senior Designer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'Acme Corp',
      website: '',
      companyDescription: '',
    });

    const updated = loadProfile();
    expect(updated.role_description).toBeUndefined();
    expect(updated.job_description_url).toBeUndefined();
  });

  it('defaults company_name to "Freelance" when self-employed and blank', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'Jane Doe',
      title: 'Senior Designer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: true,
      companyName: '',
      website: '',
      companyDescription: '',
    });

    const updated = loadProfile();
    expect(updated.work.company_name).toBe('Freelance');
    expect(updated.work.self_employed).toBe(true);
  });

  it('refreshes checksums to match new content', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: '',
      companyDescription: '',
    });

    expect(loadState().checksums['CLAUDE.md']).toBe(hashContent(read('CLAUDE.md')));
  });
});

// ── Group 2: applyModuleChanges — adding a module ─────────────────────────────

describe('applyModuleChanges — adding linkedin', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('creates linkedin command files', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    for (const cmd of ['li-all', 'li-about', 'li-headline', 'li-experience', 'li-skills', 'li-featured', 'li-activity']) {
      expect(exists(`.claude/commands/${cmd}.md`), `${cmd}.md`).toBe(true);
    }
    expect(exists('.claude/modules/linkedin/manifest.md')).toBe(true);
  });

  it('adds linkedin to profile.modules', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(loadProfile().modules).toContain('linkedin');
  });

  it('stores linkedin profile url', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(loadProfile().linkedin?.profile_url).toBe('https://linkedin.com/in/x');
  });

  it('creates content-dir files', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(exists('graph/linkedin/INSTRUCTIONS.md')).toBe(true);
  });

  it('records added files and stores checksums', () => {
    const result = applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(result.added).toContain('.claude/commands/li-all.md');
    expect(typeof loadState().checksums['.claude/commands/li-all.md']).toBe('string');
  });

  it('omits linkedin url when none provided', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], []);

    const updated = loadProfile();
    expect(updated.linkedin).toBeUndefined();
    expect(updated.modules).toContain('linkedin');
  });

  it('does not duplicate module in profile.modules when already present', () => {
    // Profile already has linkedin in modules — should not add it twice
    const profileWithLinkedin = { ...profile, modules: ['linkedin'] as Profile['modules'] };
    applyModuleChanges(targetDir, profileWithLinkedin, ['linkedin'], []);

    expect(loadProfile().modules.filter(m => m === 'linkedin')).toHaveLength(1);
  });

  it('skips user-edited managed files and populates result.skipped', () => {
    // Write li-all.md manually so it exists on disk before the module add, with no stored checksum
    // patina will overwrite it (no stored checksum = treated as unmodified)
    // To test the skipped path, we need a stored checksum that doesn't match the file on disk.
    // Set up: install linkedin first, then edit li-all.md so its hash diverges, remove and re-add.
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    // Edit li-all.md so its hash differs from the stored checksum
    writeFileSync(join(targetDir, '.claude/commands/li-all.md'), 'my custom edits', 'utf8');

    // Remove linkedin (li-all.md is kept, its stored checksum remains in profile)
    applyModuleChanges(targetDir, p1, [], ['linkedin']);
    const p2 = loadProfile();

    // Re-add linkedin — li-all.md should be skipped because hash != stored checksum
    const result = applyModuleChanges(targetDir, p2, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(result.skipped).toContain('.claude/commands/li-all.md');
    expect(read('.claude/commands/li-all.md')).toBe('my custom edits');
  });
});

// ── Group 2b: applyModuleChanges — content-dir and URL preservation ───────────

describe('applyModuleChanges — content-dir and URL preservation', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/x' }));
    profile = loadProfile();
  });

  it('does not overwrite existing content-dir files', () => {
    writeFileSync(join(targetDir, 'graph/linkedin/INSTRUCTIONS.md'), 'my edits', 'utf8');

    // Remove then re-add linkedin
    applyModuleChanges(targetDir, profile, [], ['linkedin']);
    const p2 = loadProfile();
    applyModuleChanges(targetDir, p2, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(read('graph/linkedin/INSTRUCTIONS.md')).toBe('my edits');
  });

  it('does not overwrite an existing LinkedIn URL', () => {
    // Profile already has linkedin URL — add with a different URL should not overwrite
    const result = applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/new' } });

    expect(loadProfile().linkedin?.profile_url).toBe('https://linkedin.com/in/x');
    // The module is not re-added (dedup guard), result has no additions to modules
    expect(result.profile.modules.filter(m => m === 'linkedin')).toHaveLength(1);
  });
});

// ── Group 3: applyModuleChanges — removing a module ──────────────────────────

describe('applyModuleChanges — removing linkedin', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/x' }));
    profile = loadProfile();
  });

  it('deletes unmodified managed files', () => {
    applyModuleChanges(targetDir, profile, [], ['linkedin']);

    for (const cmd of ['li-all', 'li-about', 'li-headline', 'li-experience', 'li-skills', 'li-featured', 'li-activity']) {
      expect(exists(`.claude/commands/${cmd}.md`), `${cmd}.md should be deleted`).toBe(false);
    }
    expect(exists('.claude/modules/linkedin/manifest.md')).toBe(false);
  });

  it('removes linkedin from profile.modules and clears linkedin data', () => {
    applyModuleChanges(targetDir, profile, [], ['linkedin']);

    const updated = loadProfile();
    expect(updated.modules).not.toContain('linkedin');
    expect(updated.linkedin).toBeUndefined();
  });

  it('keeps user-edited managed files', () => {
    writeFileSync(join(targetDir, '.claude/commands/li-all.md'), 'user edit', 'utf8');

    const result = applyModuleChanges(targetDir, profile, [], ['linkedin']);

    expect(read('.claude/commands/li-all.md')).toBe('user edit');
    expect(result.kept).toContain('.claude/commands/li-all.md');
  });

  it('never deletes content-dir files', () => {
    applyModuleChanges(targetDir, profile, [], ['linkedin']);

    expect(exists('graph/linkedin/INSTRUCTIONS.md')).toBe(true);
  });

  it('drops removed-file checksums from state', () => {
    writeFileSync(join(targetDir, '.claude/commands/li-all.md'), 'user edit', 'utf8');

    applyModuleChanges(targetDir, profile, [], ['linkedin']);

    const state = loadState();
    expect(state.checksums).not.toHaveProperty('.claude/commands/li-about.md');
    expect(state.checksums).toHaveProperty('.claude/commands/li-all.md');
  });

  it('returns the updated profile with correct modules array', () => {
    const result = applyModuleChanges(targetDir, profile, [], ['linkedin']);

    expect(result.profile.modules).not.toContain('linkedin');
    expect(result.profile.linkedin).toBeUndefined();
  });
});

// ── Group 4: applyModuleChanges — resume module ───────────────────────────────

describe('applyModuleChanges — adding resume', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('creates resume command file and manifest', () => {
    applyModuleChanges(targetDir, profile, ['resume'], []);

    expect(exists('.claude/commands/resume-refresh.md')).toBe(true);
    expect(exists('.claude/modules/resume/manifest.md')).toBe(true);
  });

  it('adds resume to profile.modules', () => {
    applyModuleChanges(targetDir, profile, ['resume'], []);

    expect(loadProfile().modules).toContain('resume');
  });

  it('creates resume content-dir files', () => {
    applyModuleChanges(targetDir, profile, ['resume'], []);

    expect(exists('graph/resume/INSTRUCTIONS.md')).toBe(true);
    expect(exists('graph/resume/Resume Working Draft.md')).toBe(true);
  });
});

describe('applyModuleChanges — removing resume', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['resume'] }));
    profile = loadProfile();
  });

  it('deletes unmodified resume managed files', () => {
    applyModuleChanges(targetDir, profile, [], ['resume']);

    expect(exists('.claude/commands/resume-refresh.md')).toBe(false);
    expect(exists('.claude/modules/resume/manifest.md')).toBe(false);
  });

  it('removes resume from profile.modules', () => {
    applyModuleChanges(targetDir, profile, [], ['resume']);

    expect(loadProfile().modules).not.toContain('resume');
  });

  it('never deletes resume content-dir files', () => {
    applyModuleChanges(targetDir, profile, [], ['resume']);

    expect(exists('graph/resume/INSTRUCTIONS.md')).toBe(true);
  });
});

// ── Group 4b: applyModuleChanges — README and CLAUDE.md patching ─────────────

describe('applyModuleChanges — README.md and CLAUDE.md on add/remove', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('README gains patina:linkedin block after adding linkedin', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    const readme = read('README.md');
    expect(readme).toContain('<!-- patina:linkedin:start -->');
    expect(readme).toContain('<!-- patina:linkedin:end -->');
  });

  it('CLAUDE.md modules section links to linkedin after adding linkedin', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    const claudeMd = read('CLAUDE.md');
    expect(claudeMd).toContain('LinkedIn');
    expect(claudeMd).toContain('.claude/modules/linkedin/CLAUDE.md');
  });

  it('.claude/modules/linkedin/CLAUDE.md exists after adding linkedin', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(exists('.claude/modules/linkedin/CLAUDE.md')).toBe(true);
  });

  it('README no longer contains patina:linkedin after removing linkedin', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['linkedin']);

    const readme = read('README.md');
    expect(readme).not.toContain('patina:linkedin');
  });

  it('patina:base section preserved after removing linkedin', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['linkedin']);

    const readme = read('README.md');
    expect(readme).toContain('<!-- patina:base:start -->');
    expect(readme).toContain('<!-- patina:base:end -->');
  });

  it('no trailing blank-line artifact after removing linkedin at end', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['linkedin']);

    const readme = read('README.md');
    expect(readme).not.toMatch(/\n{3,}$/);
  });

  it('CLAUDE.md no longer links linkedin after removing it', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['linkedin']);

    const claudeMd = read('CLAUDE.md');
    expect(claudeMd).not.toContain('.claude/modules/linkedin/CLAUDE.md');
  });

  it('README still has patina:linkedin after adding both then removing resume', () => {
    applyModuleChanges(targetDir, profile, ['linkedin', 'resume'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['resume']);

    const readme = read('README.md');
    expect(readme).toContain('patina:linkedin');
    expect(readme).not.toContain('patina:resume');
  });

  it('CLAUDE.md links only LinkedIn after resume is removed', () => {
    applyModuleChanges(targetDir, profile, ['linkedin', 'resume'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['resume']);

    const claudeMd = read('CLAUDE.md');
    expect(claudeMd).toContain('LinkedIn');
    expect(claudeMd).not.toContain('.claude/modules/resume/CLAUDE.md');
  });

  it('user-edited patina:linkedin block is kept when removing linkedin', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    // Edit the linkedin section in README.md
    const readmeBefore = read('README.md');
    const edited = readmeBefore.replace(
      /<!-- patina:linkedin:start -->([\s\S]*?)<!-- patina:linkedin:end -->/,
      '<!-- patina:linkedin:start -->\nMy custom edits\n<!-- patina:linkedin:end -->'
    );
    writeFileSync(join(targetDir, 'README.md'), edited, 'utf8');

    const result = applyModuleChanges(targetDir, p1, [], ['linkedin']);

    const readmeAfter = read('README.md');
    expect(readmeAfter).toContain('My custom edits');
    expect(result.keptSections).toContain('README.md:linkedin');
  });

  it('out-of-fence text survives add/remove cycle', () => {
    // Add user text outside fences in README.md
    const readmeBefore = read('README.md');
    writeFileSync(join(targetDir, 'README.md'), readmeBefore + '\n\nMy personal notes here.\n', 'utf8');

    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['linkedin']);

    const readme = read('README.md');
    expect(readme).toContain('My personal notes here.');
  });
});

// ── Group 5: writeManagedFile respects checksums (via applyProfileUpdate) ─────

describe('writeManagedFile respects checksums (via applyProfileUpdate)', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('does not overwrite a user-edited managed file', () => {
    writeFileSync(join(targetDir, 'CLAUDE.md'), 'I edited this', 'utf8');

    const result = applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: '',
      companyDescription: '',
    });

    expect(read('CLAUDE.md')).toBe('I edited this');
    expect(result.skipped).toContain('CLAUDE.md');
  });

  it('still updates unmodified managed files in the same pass', () => {
    writeFileSync(join(targetDir, 'CLAUDE.md'), 'I edited this', 'utf8');

    const result = applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: '',
      companyDescription: '',
    });

    expect(result.updated).toContain('.claude/commands/add.md');
    expect(result.skipped).toContain('CLAUDE.md');
  });

  it('preserves the original checksum for skipped files', () => {
    const originalChecksum = loadState().checksums['CLAUDE.md'];

    writeFileSync(join(targetDir, 'CLAUDE.md'), 'I edited this', 'utf8');

    applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: '',
      companyDescription: '',
    });

    expect(loadState().checksums['CLAUDE.md']).toBe(originalChecksum);
  });
});

// ── Group 5b: section checksums stored after profile update ──────────────────

describe('applyProfileUpdate — section checksums', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('stores CLAUDE.md:profile checksum in state after profile update', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: 'Builds things.',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: '',
      companyDescription: '',
    });

    const state = loadState();
    expect(typeof state.checksums['CLAUDE.md:profile']).toBe('string');
  });

  it('preserves out-of-fence content after profile update rewrites the profile section', () => {
    // The profile update rewrites the fenced section but should not touch content outside fences
    applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: '',
      companyDescription: '',
    });

    const claudeMd = read('CLAUDE.md');
    // Content outside the fence should still be present
    expect(claudeMd).toContain('## What patina is');
    expect(claudeMd).toContain('## Folder structure');
    expect(claudeMd).toContain('## How it works');
    // The fence markers should still be present
    expect(claudeMd).toContain('<!-- patina:profile:start -->');
    expect(claudeMd).toContain('<!-- patina:profile:end -->');
    // The new profile content should be inside the fence
    expect(claudeMd).toContain('John Smith');
    expect(claudeMd).toContain('NewCorp');
  });
});

// ── Group 6: applyLaunchTaskUpdate ────────────────────────────────────────────

describe('applyLaunchTaskUpdate — adding tasks', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('writes CLAUDE.md launch fence', () => {
    applyLaunchTaskUpdate(targetDir, profile, ['base/today-focus']);
    const content = read('CLAUDE.md');
    expect(content).toContain('<!-- patina:launch:start -->');
    expect(content).toContain('<!-- patina:launch:end -->');
  });

  it('CLAUDE.md contains the task text', () => {
    applyLaunchTaskUpdate(targetDir, profile, ['base/today-focus']);
    expect(read('CLAUDE.md')).toContain('Ask the user what they want to focus on today');
  });

  it('profile.yaml has launch_tasks', () => {
    applyLaunchTaskUpdate(targetDir, profile, ['base/today-focus']);
    expect(loadProfile().launch_tasks).toEqual(['base/today-focus']);
  });

  it('state stores CLAUDE.md:launch checksum', () => {
    applyLaunchTaskUpdate(targetDir, profile, ['base/today-focus']);
    expect(typeof loadState().checksums['CLAUDE.md:launch']).toBe('string');
  });

  it('returns updated in result', () => {
    const result = applyLaunchTaskUpdate(targetDir, profile, ['base/today-focus']);
    expect(result.updated).toContain('CLAUDE.md');
  });

  it('CLAUDE.md has no unreplaced template variables', () => {
    applyLaunchTaskUpdate(targetDir, profile, ['base/recent-notes']);
    expect(read('CLAUDE.md')).not.toMatch(/\{\{[A-Z_]+\}\}/);
  });
});

describe('applyLaunchTaskUpdate — removing all tasks', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ launchTasks: ['base/today-focus'] }));
    profile = loadProfile();
  });

  it('removes patina:launch fence from CLAUDE.md', () => {
    applyLaunchTaskUpdate(targetDir, profile, []);
    expect(read('CLAUDE.md')).not.toContain('patina:launch');
  });

  it('profile.yaml has no launch_tasks key', () => {
    applyLaunchTaskUpdate(targetDir, profile, []);
    expect(loadProfile().launch_tasks).toBeUndefined();
  });

  it('state no longer has CLAUDE.md:launch', () => {
    applyLaunchTaskUpdate(targetDir, profile, []);
    expect(loadState().checksums['CLAUDE.md:launch']).toBeUndefined();
  });
});

describe('applyLaunchTaskUpdate — user-edited launch fence', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ launchTasks: ['base/today-focus'] }));
    profile = loadProfile();
    // Edit the launch section manually
    const before = readFileSync(join(targetDir, 'CLAUDE.md'), 'utf8');
    const edited = before.replace(
      /<!-- patina:launch:start -->([\s\S]*?)<!-- patina:launch:end -->/,
      '<!-- patina:launch:start -->\nMy custom launch instructions\n<!-- patina:launch:end -->'
    );
    writeFileSync(join(targetDir, 'CLAUDE.md'), edited, 'utf8');
  });

  it('preserves user-edited launch block when overwrite not requested', () => {
    applyLaunchTaskUpdate(targetDir, profile, ['base/recent-notes']);
    expect(read('CLAUDE.md')).toContain('My custom launch instructions');
  });

  it('records launch in keptSections', () => {
    const result = applyLaunchTaskUpdate(targetDir, profile, ['base/recent-notes']);
    expect(result.keptSections).toContain('CLAUDE.md:launch');
  });

  it('overwrites when overwrite set contains "launch"', () => {
    applyLaunchTaskUpdate(targetDir, profile, ['base/recent-notes'], new Set(['launch']));
    expect(read('CLAUDE.md')).not.toContain('My custom launch instructions');
    expect(read('CLAUDE.md')).toContain('modified in the last 7 days');
  });
});

describe('applyLaunchTaskUpdate — no pre-existing launch section', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('no error when profile has no launch_tasks and tasks are set to empty', () => {
    expect(() => applyLaunchTaskUpdate(targetDir, profile, [])).not.toThrow();
  });

  it('no patina:launch fence when removing tasks that were not there', () => {
    applyLaunchTaskUpdate(targetDir, profile, []);
    expect(read('CLAUDE.md')).not.toContain('patina:launch');
  });
});

describe('applyModuleChanges — launch task orphan pruning', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/x', launchTasks: ['linkedin/open-drafts', 'base/today-focus'] }));
    profile = loadProfile();
  });

  it('prunes linkedin launch task when linkedin is removed', () => {
    applyModuleChanges(targetDir, profile, [], ['linkedin']);
    expect(loadProfile().launch_tasks).not.toContain('linkedin/open-drafts');
  });

  it('keeps base launch task after linkedin is removed', () => {
    applyModuleChanges(targetDir, profile, [], ['linkedin']);
    const lt = loadProfile().launch_tasks;
    expect(lt).toContain('base/today-focus');
  });

  it('CLAUDE.md launch fence no longer contains linkedin task after removal', () => {
    applyModuleChanges(targetDir, profile, [], ['linkedin']);
    const content = read('CLAUDE.md');
    expect(content).not.toContain('LinkedIn section drafts');
  });

  it('adding a module does NOT auto-select its launch tasks', () => {
    // Start clean (no linkedin), add linkedin
    const profileNoLi = { ...profile, modules: [] as Profile['modules'], launch_tasks: undefined };
    applyModuleChanges(targetDir, profileNoLi, ['linkedin'], []);
    expect(loadProfile().launch_tasks).toBeUndefined();
  });
});

// ── inbox/.processed.json preservation on update ─────────────────────────────

describe('applyProfileUpdate — inbox/.processed.json preserved on update', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts());
    profile = loadProfile();
  });

  it('preserves non-empty .processed.json entries across a profile update', () => {
    // Simulate Claude writing a registry entry after processing a file
    const entry = {
      filename: 'doc.pdf',
      status: 'success',
      processed_at: '2026-01-15T09:32:00.000Z',
      resulting_note_paths: ['graph/notes/doc.md'],
    };
    writeFileSync(
      join(targetDir, 'inbox/.processed.json'),
      JSON.stringify([entry], null, 2) + '\n',
      'utf8'
    );

    // Run a profile update — the file hash now differs from the stored checksum,
    // so writeManagedFile should skip it (hash-skip path).
    applyProfileUpdate(targetDir, profile, {
      name: 'John Smith',
      title: 'Staff Engineer',
      roleDescription: '',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'NewCorp',
      website: '',
      companyDescription: '',
    });

    const after = JSON.parse(read('inbox/.processed.json'));
    expect(after).toHaveLength(1);
    expect(after[0].filename).toBe('doc.pdf');
    expect(after[0].status).toBe('success');
  });
});

// ── Upgrade path: pre-inbox install gets inbox files on first update ──────────

describe('applyProfileUpdate — upgrade path: creates inbox files for pre-inbox installs', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts());
    profile = loadProfile();

    // Simulate a pre-inbox install: remove inbox files and their checksums
    rmSync(join(targetDir, 'inbox'), { recursive: true, force: true });
    rmSync(join(targetDir, '.claude', 'commands', 'inbox.md'), { force: true });
    const state = loadState();
    delete state.checksums['inbox/.gitkeep'];
    delete state.checksums['inbox/.processed.json'];
    delete state.checksums['.claude/commands/inbox.md'];
    writeFileSync(join(targetDir, '.patina-state.json'), JSON.stringify(state), 'utf8');
  });

  it('creates inbox/.gitkeep on first applyProfileUpdate after upgrade', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'Jane Doe',
      title: 'Senior Designer',
      roleDescription: 'I design product experiences.',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'Acme Corp',
      website: 'https://acme.com',
      companyDescription: 'A software company.',
    });
    expect(existsSync(join(targetDir, 'inbox', '.gitkeep'))).toBe(true);
  });

  it('creates inbox/.processed.json seeded as [] on first applyProfileUpdate after upgrade', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'Jane Doe',
      title: 'Senior Designer',
      roleDescription: 'I design product experiences.',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'Acme Corp',
      website: 'https://acme.com',
      companyDescription: 'A software company.',
    });
    const content = JSON.parse(read('inbox/.processed.json'));
    expect(content).toEqual([]);
  });

  it('creates .claude/commands/inbox.md on first applyProfileUpdate after upgrade', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'Jane Doe',
      title: 'Senior Designer',
      roleDescription: 'I design product experiences.',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'Acme Corp',
      website: 'https://acme.com',
      companyDescription: 'A software company.',
    });
    expect(existsSync(join(targetDir, '.claude', 'commands', 'inbox.md'))).toBe(true);
  });
});

// ── Migration: legacy profile.yaml with _checksums ────────────────────────────

describe('migration — legacy profile.yaml with _checksums', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts());
    profile = loadProfile();

    // Simulate a legacy workspace: embed _checksums back into profile.yaml
    // and delete .patina-state.json
    const { rmSync: rm } = await import('fs');
    const { join: j } = await import('path');
    rm(j(targetDir, '.patina-state.json'), { force: true });
    const legacyProfile = { ...profile, _checksums: loadState().checksums };
    writeFileSync(
      join(targetDir, 'profile.yaml'),
      (await import('js-yaml')).dump(legacyProfile),
      'utf8'
    );
    // Reload profile from the legacy file (includes _checksums on disk)
    profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;
  });

  it('migrates checksums on first applyProfileUpdate and cleans profile.yaml', () => {
    expect(existsSync(join(targetDir, '.patina-state.json'))).toBe(false);

    applyProfileUpdate(targetDir, profile, {
      name: 'Jane Doe',
      title: 'Senior Designer',
      roleDescription: 'I design product experiences.',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'Acme Corp',
      website: 'https://acme.com',
      companyDescription: 'A software company.',
    });

    // .patina-state.json now exists with checksums
    expect(existsSync(join(targetDir, '.patina-state.json'))).toBe(true);
    expect(typeof loadState().checksums['CLAUDE.md']).toBe('string');

    // profile.yaml no longer contains _checksums
    const updatedProfile = loadProfile() as Profile & { _checksums?: unknown };
    expect(updatedProfile._checksums).toBeUndefined();
  });
});

// ── Deferred module: applyModuleChanges clears entry on module remove ─────────

describe('applyModuleChanges — deferred entry cleared when module removed', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/x' }));
    profile = loadProfile();
  });

  it('removes the deferred entry from .patina-state.json when the module is removed', () => {
    // Seed a deferred entry in the state file
    const state = loadState();
    const stateWithDeferred = {
      ...state,
      deferred_modules: [{ module: 'linkedin' as const, snooze_until: '2026-06-10' }],
    };
    writeFileSync(
      join(targetDir, '.patina-state.json'),
      JSON.stringify(stateWithDeferred, null, 2) + '\n',
      'utf8'
    );

    applyModuleChanges(targetDir, profile, [], ['linkedin']);

    const finalState = loadState();
    const remaining = finalState.deferred_modules?.filter(e => e.module === 'linkedin') ?? [];
    expect(remaining).toHaveLength(0);
  });

  it('preserves deferred entries for other modules when one is removed', () => {
    // Seed deferred entries for both linkedin and resume
    const state = loadState();
    const stateWithDeferred = {
      ...state,
      deferred_modules: [
        { module: 'linkedin' as const, snooze_until: '2026-06-10' },
        { module: 'resume' as const, snooze_until: '2026-07-01' },
      ],
    };
    writeFileSync(
      join(targetDir, '.patina-state.json'),
      JSON.stringify(stateWithDeferred, null, 2) + '\n',
      'utf8'
    );

    applyModuleChanges(targetDir, profile, [], ['linkedin']);

    const finalState = loadState();
    const resumeEntry = finalState.deferred_modules?.find(e => e.module === 'resume');
    expect(resumeEntry).toBeDefined();
    expect(resumeEntry?.snooze_until).toBe('2026-07-01');
  });
});

// ── Migration: legacy install + populated inbox preserved ─────────────────────

describe('migration — populated inbox/.processed.json survives legacy migration', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts());
    profile = loadProfile();

    // Pre-populate .processed.json with a real entry
    const entry = {
      filename: 'report.pdf',
      status: 'success',
      processed_at: '2026-01-20T10:00:00.000Z',
      resulting_note_paths: ['graph/notes/report.md'],
    };
    const entryJson = JSON.stringify([entry], null, 2) + '\n';
    writeFileSync(join(targetDir, 'inbox/.processed.json'), entryJson, 'utf8');

    // Simulate legacy workspace: embed the current state (which stores the original '[]' hash
    // for inbox/.processed.json) in profile.yaml, then delete .patina-state.json.
    // writeManagedFile sees: storedHash = hash('[]\n'), currentHash = hash(entryJson) → mismatch → skip.
    const stateBeforeDelete = loadState();

    const { rmSync: rm } = await import('fs');
    const { join: j } = await import('path');
    rm(j(targetDir, '.patina-state.json'), { force: true });
    const legacyProfile = { ...profile, _checksums: stateBeforeDelete.checksums };
    writeFileSync(
      join(targetDir, 'profile.yaml'),
      (await import('js-yaml')).dump(legacyProfile),
      'utf8'
    );
    profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;
  });

  it('preserves inbox/.processed.json entries during legacy migration', () => {
    applyProfileUpdate(targetDir, profile, {
      name: 'Jane Doe',
      title: 'Senior Designer',
      roleDescription: 'I design product experiences.',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'Acme Corp',
      website: 'https://acme.com',
      companyDescription: 'A software company.',
    });

    const after = JSON.parse(read('inbox/.processed.json'));
    expect(after).toHaveLength(1);
    expect(after[0].filename).toBe('report.pdf');
    expect(after[0].status).toBe('success');
  });
});

// ── Inbox routing file: routing table updates with module changes ─────────────

describe('applyModuleChanges — inbox routing file regenerates with modules', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('routing file has _(none)_ when no modules installed', () => {
    expect(read('.claude/inbox-routing.md')).toContain('_(none)_');
  });

  it('routing file contains work routes after adding work module', () => {
    applyModuleChanges(targetDir, profile, ['work'], []);
    const content = read('.claude/inbox-routing.md');
    expect(content).toContain('`weekly`');
    expect(content).toContain('graph/work/weeklies/');
    expect(content).toContain('`transcript`');
    expect(content).toContain('`reference`');
  });

  it('routing file reverts to _(none)_ after removing work module', () => {
    applyModuleChanges(targetDir, profile, ['work'], []);
    const p2 = loadProfile();
    applyModuleChanges(targetDir, p2, [], ['work']);
    expect(read('.claude/inbox-routing.md')).toContain('_(none)_');
  });

  it('custom rules outside the fence survive a routing file regeneration', () => {
    // Add work module to get a routing file with the fence
    applyModuleChanges(targetDir, profile, ['work'], []);

    // Write a custom row in the Custom rules area (outside the fence)
    const routingPath = join(targetDir, '.claude/inbox-routing.md');
    const original = readFileSync(routingPath, 'utf8');
    const withCustom = original + '| `client-acme` | `graph/clients/acme/` | Custom client route |\n';
    writeFileSync(routingPath, withCustom, 'utf8');

    // Run a profile update which regenerates base files
    applyProfileUpdate(targetDir, loadProfile(), {
      name: 'Jane Doe',
      title: 'Senior Designer',
      roleDescription: 'I design product experiences.',
      jobDescriptionUrl: '',
      selfEmployed: false,
      companyName: 'Acme Corp',
      website: 'https://acme.com',
      companyDescription: 'A software company.',
    });

    // The custom row should survive because it lives outside the fence
    expect(read('.claude/inbox-routing.md')).toContain('`client-acme`');
  });
});

describe('syncBaseFiles — upgrade path: creates inbox-routing.md for pre-#166 installs', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['work'] }));
    profile = loadProfile();

    // Simulate a pre-#166 install: remove routing file and its checksum
    rmSync(join(targetDir, '.claude', 'inbox-routing.md'), { force: true });
    const state = loadState();
    delete state.checksums['.claude/inbox-routing.md'];
    writeFileSync(join(targetDir, '.patina-state.json'), JSON.stringify(state), 'utf8');
  });

  it('creates .claude/inbox-routing.md without requiring a profile change', () => {
    syncBaseFiles(targetDir, profile);
    expect(existsSync(join(targetDir, '.claude', 'inbox-routing.md'))).toBe(true);
  });

  it('stores the inbox-routing.md checksum in state', () => {
    syncBaseFiles(targetDir, profile);
    expect(typeof loadState().checksums['.claude/inbox-routing.md']).toBe('string');
  });

  it('routing file contains work routes after upgrade', () => {
    syncBaseFiles(targetDir, profile);
    const content = read('.claude/inbox-routing.md');
    expect(content).toContain('`weekly`');
    expect(content).toContain('graph/work/weeklies/');
  });
});

// ── syncBaseFiles: new template files land without a profile change ───────────

describe('syncBaseFiles — upgrade path: creates guide.md for pre-guide installs', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts());
    profile = loadProfile();

    // Simulate a pre-guide install: remove guide.md and its stored checksum
    rmSync(join(targetDir, '.claude', 'commands', 'guide.md'), { force: true });
    const state = loadState();
    delete state.checksums['.claude/commands/guide.md'];
    writeFileSync(join(targetDir, '.patina-state.json'), JSON.stringify(state), 'utf8');
  });

  it('creates .claude/commands/guide.md without requiring a profile change', () => {
    syncBaseFiles(targetDir, profile);
    expect(existsSync(join(targetDir, '.claude', 'commands', 'guide.md'))).toBe(true);
  });

  it('stores the guide.md checksum in state', () => {
    syncBaseFiles(targetDir, profile);
    expect(typeof loadState().checksums['.claude/commands/guide.md']).toBe('string');
  });

  it('does not overwrite user-edited managed files', () => {
    writeFileSync(join(targetDir, 'CLAUDE.md'), 'my custom content', 'utf8');
    syncBaseFiles(targetDir, profile);
    expect(read('CLAUDE.md')).toBe('my custom content');
  });
});
