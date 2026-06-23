import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';
import { scaffold } from '../scaffold.js';
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
    expect(result.updated).toContain('.claude/commands/add.md');
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

  it('state does not contain checksums after profile update', () => {
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

    const state = loadState();
    expect((state as Record<string, unknown>).checksums).toBeUndefined();
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

  it('records added files', () => {
    const result = applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(result.added).toContain('.claude/commands/li-all.md');
  });

  it('omits linkedin url when none provided', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], []);

    const updated = loadProfile();
    expect(updated.linkedin).toBeUndefined();
    expect(updated.modules).toContain('linkedin');
  });

  it('does not duplicate module in profile.modules when already present', () => {
    const profileWithLinkedin = { ...profile, modules: ['linkedin'] as Profile['modules'] };
    applyModuleChanges(targetDir, profileWithLinkedin, ['linkedin'], []);

    expect(loadProfile().modules.filter(m => m === 'linkedin')).toHaveLength(1);
  });

  it('skips user-owned (unmarked) command files on re-add', () => {
    // Install linkedin first so files exist
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    // Overwrite li-all.md with user content (no patina: managed marker)
    writeFileSync(join(targetDir, '.claude/commands/li-all.md'), '# My custom li-all', 'utf8');

    // Remove linkedin
    applyModuleChanges(targetDir, p1, [], ['linkedin']);
    const p2 = loadProfile();

    // Re-add linkedin — li-all.md should be skipped (no marker = user-owned)
    const result = applyModuleChanges(targetDir, p2, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(result.skipped).toContain('.claude/commands/li-all.md');
    expect(read('.claude/commands/li-all.md')).toBe('# My custom li-all');
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

    applyModuleChanges(targetDir, profile, [], ['linkedin']);
    const p2 = loadProfile();
    applyModuleChanges(targetDir, p2, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    expect(read('graph/linkedin/INSTRUCTIONS.md')).toBe('my edits');
  });

  it('does not overwrite an existing LinkedIn URL', () => {
    const result = applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/new' } });

    expect(loadProfile().linkedin?.profile_url).toBe('https://linkedin.com/in/x');
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

  it('deletes marked managed files', () => {
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

  it('keeps user-owned (unmarked) files when removing', () => {
    // Write user content without the patina: managed marker
    writeFileSync(join(targetDir, '.claude/commands/li-all.md'), '# user edit', 'utf8');

    const result = applyModuleChanges(targetDir, profile, [], ['linkedin']);

    expect(read('.claude/commands/li-all.md')).toBe('# user edit');
    expect(result.kept).toContain('.claude/commands/li-all.md');
  });

  it('never deletes content-dir files', () => {
    applyModuleChanges(targetDir, profile, [], ['linkedin']);

    expect(exists('graph/linkedin/INSTRUCTIONS.md')).toBe(true);
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

  it('README gains linkedin module info after adding linkedin', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });

    const readme = read('README.md');
    expect(readme.toLowerCase()).toContain('linkedin');
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

  it('CLAUDE.md no longer links linkedin after removing it', () => {
    applyModuleChanges(targetDir, profile, ['linkedin'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['linkedin']);

    const claudeMd = read('CLAUDE.md');
    expect(claudeMd).not.toContain('.claude/modules/linkedin/CLAUDE.md');
  });

  it('README still has linkedin info after adding both then removing resume', () => {
    applyModuleChanges(targetDir, profile, ['linkedin', 'resume'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['resume']);

    const readme = read('README.md');
    expect(readme.toLowerCase()).toContain('linkedin');
  });

  it('CLAUDE.md links only LinkedIn after resume is removed', () => {
    applyModuleChanges(targetDir, profile, ['linkedin', 'resume'], [], { linkedin: { liProfileUrl: 'https://linkedin.com/in/x' } });
    const p1 = loadProfile();

    applyModuleChanges(targetDir, p1, [], ['resume']);

    const claudeMd = read('CLAUDE.md');
    expect(claudeMd).toContain('LinkedIn');
    expect(claudeMd).not.toContain('.claude/modules/resume/CLAUDE.md');
  });
});

// ── Group 5: writeManagedFile respects marker (via applyProfileUpdate) ─────

describe('applyProfileUpdate — user-owned files skipped', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('does not overwrite a user-owned CLAUDE.md (no marker)', () => {
    // Write without the patina: managed marker
    writeFileSync(join(targetDir, 'CLAUDE.md'), '# I edited this', 'utf8');

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

    expect(read('CLAUDE.md')).toBe('# I edited this');
    expect(result.skipped).toContain('CLAUDE.md');
  });

  it('still updates other marked managed files in the same pass', () => {
    writeFileSync(join(targetDir, 'CLAUDE.md'), '# I edited this', 'utf8');

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
});

// ── Group 6: applyLaunchTaskUpdate ────────────────────────────────────────────

describe('applyLaunchTaskUpdate — adding tasks', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('CLAUDE.md contains the task text', () => {
    applyLaunchTaskUpdate(targetDir, profile, ['base/today-focus']);
    expect(read('CLAUDE.md')).toContain('Ask the user what they want to focus on today');
  });

  it('profile.yaml has launch_tasks', () => {
    applyLaunchTaskUpdate(targetDir, profile, ['base/today-focus']);
    expect(loadProfile().launch_tasks).toEqual(['base/today-focus']);
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

  it('profile.yaml has no launch_tasks key', () => {
    applyLaunchTaskUpdate(targetDir, profile, []);
    expect(loadProfile().launch_tasks).toBeUndefined();
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

  it('CLAUDE.md launch section no longer contains linkedin task after removal', () => {
    applyModuleChanges(targetDir, profile, [], ['linkedin']);
    const content = read('CLAUDE.md');
    expect(content).not.toContain('LinkedIn section drafts');
  });

  it('adding a module does NOT auto-select its launch tasks', () => {
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
      resulting_paths: ['graph/notes/doc.md'],
    };
    writeFileSync(
      join(targetDir, 'inbox/.processed.json'),
      JSON.stringify([entry], null, 2) + '\n',
      'utf8'
    );

    // inbox/.processed.json is a seed file (no marker) — writeSeedFile would skip it;
    // applyProfileUpdate only uses writeManagedFile for managed files, not seed files
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

    const after = JSON.parse(read('inbox/.processed.json')) as unknown[];
    expect(after).toHaveLength(1);
    expect((after[0] as { filename: string }).filename).toBe('doc.pdf');
    expect((after[0] as { status: string }).status).toBe('success');
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
});

describe('applyProfileUpdate — inbox routing file is managed and overwrites user edits', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
  });

  it('overwrites user edits to inbox-routing.md on profile update', () => {
    writeFileSync(join(targetDir, '.claude', 'inbox-routing.md'), '---\npatina: managed\n---\n# Custom\n', 'utf8');
    applyProfileUpdate(targetDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });
    const content = readFileSync(join(targetDir, '.claude', 'inbox-routing.md'), 'utf8');
    expect(content).not.toContain('# Custom');
    expect(content).toContain('patina: managed');
  });
});

describe('syncBaseFiles — upgrade path: creates inbox-routing.md for pre-#166 installs', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['work'] }));
    profile = loadProfile();

    // Simulate a pre-#166 install: remove routing file
    rmSync(join(targetDir, '.claude', 'inbox-routing.md'), { force: true });
  });

  it('creates .claude/inbox-routing.md without requiring a profile change', () => {
    syncBaseFiles(targetDir, profile);
    expect(existsSync(join(targetDir, '.claude', 'inbox-routing.md'))).toBe(true);
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

    // Simulate a pre-guide install: remove guide.md
    rmSync(join(targetDir, '.claude', 'commands', 'guide.md'), { force: true });
  });

  it('creates .claude/commands/guide.md without requiring a profile change', () => {
    syncBaseFiles(targetDir, profile);
    expect(existsSync(join(targetDir, '.claude', 'commands', 'guide.md'))).toBe(true);
  });

  it('does not overwrite user-owned files (no marker)', () => {
    writeFileSync(join(targetDir, 'CLAUDE.md'), '# my custom content', 'utf8');
    syncBaseFiles(targetDir, profile);
    expect(read('CLAUDE.md')).toBe('# my custom content');
  });
});

// ── syncBaseFiles: module command files synced for installed modules ──────────

describe('syncBaseFiles — upgrade path: syncs module command files for installed modules', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/x' }));
    profile = loadProfile();

    // Simulate pre-fix install: remove li-draft.md and li-post.md
    rmSync(join(targetDir, '.claude', 'commands', 'li-draft.md'), { force: true });
    rmSync(join(targetDir, '.claude', 'commands', 'li-post.md'), { force: true });
  });

  it('restores li-draft.md without requiring a profile change', () => {
    syncBaseFiles(targetDir, profile);
    expect(existsSync(join(targetDir, '.claude', 'commands', 'li-draft.md'))).toBe(true);
  });

  it('restores li-post.md without requiring a profile change', () => {
    syncBaseFiles(targetDir, profile);
    expect(existsSync(join(targetDir, '.claude', 'commands', 'li-post.md'))).toBe(true);
  });

  it('includes restored module command files in the returned restoredFiles list', () => {
    const { restoredFiles } = syncBaseFiles(targetDir, profile);
    expect(restoredFiles).toContain('.claude/commands/li-draft.md');
    expect(restoredFiles).toContain('.claude/commands/li-post.md');
  });

  it('updates INSTRUCTIONS.md when it carries patina: managed marker', () => {
    // Write a stale managed INSTRUCTIONS.md (has the marker but missing sections)
    writeFileSync(
      join(targetDir, 'graph', 'linkedin', 'INSTRUCTIONS.md'),
      '---\npatina: managed\ntype: instructions\n---\n\n# Old instructions\n',
      'utf8',
    );
    syncBaseFiles(targetDir, profile);
    expect(read('graph/linkedin/INSTRUCTIONS.md')).toContain('Anti-AI writing patterns');
  });

  it('does not overwrite INSTRUCTIONS.md that lacks the patina: managed marker', () => {
    const custom = '---\ntype: instructions\n---\n\n# Custom content\n';
    writeFileSync(join(targetDir, 'graph', 'linkedin', 'INSTRUCTIONS.md'), custom, 'utf8');
    syncBaseFiles(targetDir, profile);
    expect(read('graph/linkedin/INSTRUCTIONS.md')).toBe(custom);
  });
});

// ── syncBaseFiles: legacy README repair ──────────────────────────────────────

describe('syncBaseFiles — legacy README.md without patina: managed marker', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/x' }));
    profile = loadProfile();

    // Simulate a pre-marker install: strip the `patina: managed` frontmatter from README.md
    // so writeManagedFile considers it user-owned and would normally skip it.
    const readmePath = join(targetDir, 'README.md');
    const current = readFileSync(readmePath, 'utf8');
    const stripped = current.replace(/^---\s*\npatina: managed\s*\n---\s*\n/, '');
    // Inject the stale placeholder so the legacy repair condition triggers
    const stale = stripped.replace(/## Installed modules[\s\S]*$/, '## Installed modules\n\n_No modules installed._\n');
    writeFileSync(readmePath, stale, 'utf8');
  });

  it('force-writes README.md module blocks when marker is absent and modules are installed', () => {
    syncBaseFiles(targetDir, profile);
    expect(read('README.md').toLowerCase()).toContain('linkedin');
  });

  it('includes README.md in the returned restoredFiles list', () => {
    const { restoredFiles } = syncBaseFiles(targetDir, profile);
    expect(restoredFiles).toContain('README.md');
  });

  it('does not touch a user-owned README.md that lacks the stale placeholder', () => {
    // User has customised their README without the stale placeholder
    writeFileSync(join(targetDir, 'README.md'), '# My custom README\n\nI wrote this myself.\n', 'utf8');
    syncBaseFiles(targetDir, profile);
    expect(read('README.md')).toBe('# My custom README\n\nI wrote this myself.\n');
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

// ── Module uninstall: content-dir files left on disk ─────────────────────────

describe('applyModuleChanges — uninstalling linkedin leaves INSTRUCTIONS.md on disk', () => {
  let profile: Profile;

  beforeEach(async () => {
    await scaffold(opts({ modules: ['linkedin'], liProfileUrl: 'https://linkedin.com/in/x' }));
    profile = loadProfile();
  });

  it('leaves graph/linkedin/INSTRUCTIONS.md on disk after module removal', () => {
    applyModuleChanges(targetDir, profile, [], ['linkedin']);
    expect(existsSync(join(targetDir, 'graph', 'linkedin', 'INSTRUCTIONS.md'))).toBe(true);
  });
});

// ── backup_offer state preservation ──────────────────────────────────────────

describe('backup_offer survives writeState calls', () => {
  let profile: Profile;
  const backupOffer = { offered_at: '2026-06-14T10:00:00.000Z', outcome: 'initialized' as const };

  beforeEach(async () => {
    await scaffold(opts({ modules: [] }));
    profile = loadProfile();
    // Pre-write state with backup_offer set
    const state = loadState();
    writeFileSync(
      join(targetDir, '.patina-state.json'),
      JSON.stringify({ ...state, backup_offer: backupOffer }, null, 2) + '\n',
      'utf8'
    );
  });

  it('applyProfileUpdate preserves backup_offer', () => {
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

    const state = loadState();
    expect(state.backup_offer).toEqual(backupOffer);
  });

  it('applyLaunchTaskUpdate preserves backup_offer', () => {
    applyLaunchTaskUpdate(targetDir, profile, []);

    const state = loadState();
    expect(state.backup_offer).toEqual(backupOffer);
  });

  it('syncBaseFiles preserves backup_offer', () => {
    syncBaseFiles(targetDir, profile);

    const state = loadState();
    expect(state.backup_offer).toEqual(backupOffer);
  });

  it('applyModuleChanges preserves backup_offer', () => {
    applyModuleChanges(targetDir, profile, [], []);

    const state = loadState();
    expect(state.backup_offer).toEqual(backupOffer);
  });
});
