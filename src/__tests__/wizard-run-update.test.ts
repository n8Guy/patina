import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';
import { scaffold } from '../scaffold.js';
import { hashContent } from '../checksums.js';
import { readState } from '../state.js';
import { applyProfileUpdate, applyModuleChanges } from '../wizard.js';
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
