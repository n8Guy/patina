import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';
import { writeManagedFile, mergeProfile } from '../upgrade.js';
import { hashContent } from '../checksums.js';
import { scaffold } from '../scaffold.js';
import { applyProfileUpdate } from '../wizard.js';
import { readState, writeState } from '../state.js';
import { DEMO_TODAY } from '../demo/persona.js';
import { renderSection, parseSections } from '../sections.js';
import type { Profile } from '../types.js';

const FENCED_CONTENT = [
  '# Header',
  '',
  '<!-- patina:profile:start -->',
  'wizard-written profile section',
  '<!-- patina:profile:end -->',
  '',
  'Footer text.',
].join('\n');

let tmp: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-test-'));
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

// ── writeManagedFile ──────────────────────────────────────────────────────────

describe('writeManagedFile', () => {
  it('adds a new file and returns outcome=added', () => {
    const { outcome, checksum } = writeManagedFile(tmp, 'CLAUDE.md', 'hello', {});
    expect(outcome).toBe('added');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe('hello');
    expect(checksum).toBe(hashContent('hello'));
  });

  it('updates a file when current hash matches stored checksum', () => {
    const original = 'original content';
    writeFileSync(join(tmp, 'CLAUDE.md'), original);
    const stored = { 'CLAUDE.md': hashContent(original) };

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', 'updated content', stored);
    expect(outcome).toBe('updated');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe('updated content');
  });

  it('skips a file when the user has modified it', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), 'user modified this');
    const stored = { 'CLAUDE.md': hashContent('original content') };

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', 'new template content', stored);
    expect(outcome).toBe('skipped');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe('user modified this');
  });

  it('updates a file when no stored checksum exists (treats as unmodified)', () => {
    writeFileSync(join(tmp, 'CLAUDE.md'), 'existing content');

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', 'updated content', {});
    expect(outcome).toBe('updated');
  });

  it('creates intermediate directories for nested paths', () => {
    const { outcome } = writeManagedFile(tmp, '.claude/commands/include.md', 'content', {});
    expect(outcome).toBe('added');
    expect(readFileSync(join(tmp, '.claude/commands/include.md'), 'utf8')).toBe('content');
  });

  it('returns the new checksum for updated files', () => {
    const newContent = 'new content';
    const { checksum } = writeManagedFile(tmp, 'file.md', newContent, {});
    expect(checksum).toBe(hashContent(newContent));
  });

  it('returns the stored checksum when skipping', () => {
    writeFileSync(join(tmp, 'file.md'), 'custom');
    const stored = { 'file.md': 'stored-hash-abc' };
    const { checksum } = writeManagedFile(tmp, 'file.md', 'new', stored);
    expect(checksum).toBe('stored-hash-abc');
  });
});

// ── writeManagedFile — fenced content ─────────────────────────────────────────

describe('writeManagedFile — fenced content', () => {
  it('adds a new fenced file and returns outcome=added with sections', () => {
    const { outcome, sections } = writeManagedFile(tmp, 'CLAUDE.md', FENCED_CONTENT, {});
    expect(outcome).toBe('added');
    expect(sections).toBeDefined();
    expect(sections).toHaveLength(1);
    expect(sections![0].id).toBe('profile');
    expect(sections![0].outcome).toBe('added');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe(FENCED_CONTENT);
  });

  it('Case B migration: existing file has no fences, stored hash matches → outcome updated, fences introduced', () => {
    const original = 'plain content, no fences';
    writeFileSync(join(tmp, 'CLAUDE.md'), original);
    const stored = { 'CLAUDE.md': hashContent(original) };

    const { outcome, sections } = writeManagedFile(tmp, 'CLAUDE.md', FENCED_CONTENT, stored);
    expect(outcome).toBe('updated');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe(FENCED_CONTENT);
    expect(sections).toBeDefined();
    expect(sections![0].outcome).toBe('added');
  });

  it('Case B migration: no stored hash → outcome updated, fences introduced', () => {
    const original = 'plain content, no fences';
    writeFileSync(join(tmp, 'CLAUDE.md'), original);

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', FENCED_CONTENT, {});
    expect(outcome).toBe('updated');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe(FENCED_CONTENT);
  });

  it('Case B migration: stored hash mismatches (user edited) → outcome skipped', () => {
    const userContent = 'user has modified this file heavily';
    writeFileSync(join(tmp, 'CLAUDE.md'), userContent);
    const stored = { 'CLAUDE.md': hashContent('original content before user edit') };

    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', FENCED_CONTENT, stored);
    expect(outcome).toBe('skipped');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe(userContent);
  });

  it('normal fenced path: existing file has matching section, no user edit → section updated', () => {
    const originalInner = 'wizard-written profile section';
    writeFileSync(join(tmp, 'CLAUDE.md'), FENCED_CONTENT);
    const stored = { 'CLAUDE.md:profile': hashContent(originalInner) };

    const newContent = FENCED_CONTENT.replace(originalInner, 'updated wizard content');
    const { outcome, sections } = writeManagedFile(tmp, 'CLAUDE.md', newContent, stored);
    expect(outcome).toBe('updated');
    expect(sections).toBeDefined();
    expect(sections![0].outcome).toBe('updated');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toContain('updated wizard content');
  });

  it('normal fenced path: user-edited section, no overwrite → section skipped', () => {
    const userInner = 'user has modified the profile section';
    const fileWithUserEdit = FENCED_CONTENT.replace('wizard-written profile section', userInner);
    writeFileSync(join(tmp, 'CLAUDE.md'), fileWithUserEdit);
    const stored = { 'CLAUDE.md:profile': hashContent('wizard-written profile section') };

    const { sections } = writeManagedFile(tmp, 'CLAUDE.md', FENCED_CONTENT, stored);
    expect(sections![0].outcome).toBe('skipped');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toContain(userInner);
  });

  it('normal fenced path: user-edited section, overwrite includes it → section updated', () => {
    const userInner = 'user has modified the profile section';
    const fileWithUserEdit = FENCED_CONTENT.replace('wizard-written profile section', userInner);
    writeFileSync(join(tmp, 'CLAUDE.md'), fileWithUserEdit);
    const stored = { 'CLAUDE.md:profile': hashContent('wizard-written profile section') };

    const { sections } = writeManagedFile(tmp, 'CLAUDE.md', FENCED_CONTENT, stored, new Set(['profile']));
    expect(sections![0].outcome).toBe('updated');
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toContain('wizard-written profile section');
  });

  it('user removes fence delimiters manually → Case B migration fires, safe skip on mismatch', () => {
    // Simulate: fences were introduced on a previous run (stored section checksum exists)
    // then user manually removed the fence markers from the file.
    const fenceFreeContent = 'wizard-written profile section\n\nSome other user content.';
    writeFileSync(join(tmp, 'CLAUDE.md'), fenceFreeContent);

    // State has both a whole-file hash (stale — from when fences existed) and a section hash
    const staleWholeFileHash = hashContent('some-previous-fenced-content');
    const stored = {
      'CLAUDE.md': staleWholeFileHash,
      'CLAUDE.md:profile': hashContent('wizard-written profile section'),
    };

    // Current file hash differs from stale whole-file hash → Case B: user-edited → skip
    const { outcome } = writeManagedFile(tmp, 'CLAUDE.md', FENCED_CONTENT, stored);
    expect(outcome).toBe('skipped');
    // File must be left untouched — no corruption, no fence injection
    expect(readFileSync(join(tmp, 'CLAUDE.md'), 'utf8')).toBe(fenceFreeContent);
  });
});

// ── mergeProfile ──────────────────────────────────────────────────────────────

const baseWork = {
  self_employed: false,
  company_name: 'Acme',
  website: 'https://acme.com',
  company_description: 'A company',
};

const baseProfile: Profile = {
  patina_name: 'my-patina',
  name: 'Jane Doe',
  title: 'Engineer',
  work: baseWork,
  editor: 'vscode',
  modules: ['linkedin'],
  content_dir: 'graph',
  created: '2026-01-01',
};

describe('mergeProfile', () => {
  it('preserves all existing top-level fields', () => {
    const merged = mergeProfile(baseProfile, {});
    expect(merged.name).toBe('Jane Doe');
    expect(merged.title).toBe('Engineer');
  });

  it('adds missing fields from incoming', () => {
    const existing = { ...baseProfile };
    delete (existing as Partial<Profile>).role_description;
    const merged = mergeProfile(existing, { role_description: 'Builds things' });
    expect(merged.role_description).toBe('Builds things');
  });

  it('does not overwrite existing values with incoming', () => {
    const merged = mergeProfile(baseProfile, { name: 'Overwritten' } as Partial<Profile>);
    expect(merged.name).toBe('Jane Doe');
  });

  it('preserves existing modules array', () => {
    const merged = mergeProfile(baseProfile, { modules: [] });
    expect(merged.modules).toEqual(['linkedin']);
  });

  it('uses incoming modules when existing has none', () => {
    const existing = { ...baseProfile, modules: [] as Profile['modules'] };
    const merged = mergeProfile(existing, { modules: ['linkedin'] });
    expect(merged.modules).toEqual(['linkedin']);
  });

  it('merges work shallowly, preserving existing work fields', () => {
    const merged = mergeProfile(baseProfile, {
      work: { self_employed: true, company_name: 'New Co' },
    });
    expect(merged.work.company_name).toBe('Acme');
    expect(merged.work.self_employed).toBe(false);
  });
});

// ── upgrade against demo scaffold ─────────────────────────────────────────────

describe('upgrade against demo scaffold', () => {
  let demoDir: string;

  beforeEach(async () => {
    demoDir = join(tmp, 'patina-demo');
    await scaffold({
      demo: true,
      today: DEMO_TODAY,
      modules: ['linkedin', 'resume'],
      targetDir: demoDir,
      contentDir: 'graph',
      patinaName: 'patina-demo',
      userName: 'Mara Ellison',
      title: 'Independent Software Consultant',
      roleDescription: "I'm a backend-leaning full-stack consultant.",
      jobDescriptionUrl: '',
      work: {
        self_employed: true,
        company_name: 'Ellison Labs',
        website: 'https://ellisonlabs.dev',
        company_description: 'Independent consultancy.',
      },
      editor: 'vscode',
      liProfileUrl: 'https://linkedin.com/in/mara-ellison-demo',
    });
  });

  function collectContentDir(): Map<string, string> {
    const map = new Map<string, string>();
    function walk(d: string): void {
      if (!existsSync(d)) return;
      for (const entry of readdirSync(d, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          walk(join(d, entry.name));
        } else {
          const full = join(d, entry.name);
          map.set(full, readFileSync(full, 'utf8'));
        }
      }
    }
    walk(join(demoDir, 'graph'));
    return map;
  }

  it('profile.yaml has _demo: true after scaffold', () => {
    const p = yaml.load(readFileSync(join(demoDir, 'profile.yaml'), 'utf8')) as Profile;
    expect((p as Profile & { _demo?: boolean })._demo).toBe(true);
  });

  it('content-dir files are unchanged after upgrade (applyProfileUpdate)', () => {
    // Capture content-dir file state before upgrade
    const beforeUpgrade = collectContentDir();

    // Run upgrade path — same profile data, no changes
    const profile = yaml.load(readFileSync(join(demoDir, 'profile.yaml'), 'utf8')) as Profile;
    applyProfileUpdate(demoDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });

    // Content-dir files must be identical after upgrade
    const afterUpgrade = collectContentDir();
    expect([...afterUpgrade.keys()].sort()).toEqual([...beforeUpgrade.keys()].sort());
    for (const [path, content] of beforeUpgrade) {
      expect(afterUpgrade.get(path), path).toBe(content);
    }
  });

  it('profile.yaml still has _demo: true after upgrade', () => {
    const profile = yaml.load(readFileSync(join(demoDir, 'profile.yaml'), 'utf8')) as Profile;
    applyProfileUpdate(demoDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });

    const updated = yaml.load(readFileSync(join(demoDir, 'profile.yaml'), 'utf8')) as Profile;
    expect((updated as Profile & { _demo?: boolean })._demo).toBe(true);
  });

  it('checksum map is intact after upgrade (no corruption)', () => {
    const stateBefore = readState(demoDir);
    const profile = yaml.load(readFileSync(join(demoDir, 'profile.yaml'), 'utf8')) as Profile;
    applyProfileUpdate(demoDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });

    const stateAfter = readState(demoDir);
    // All checksum keys from before upgrade should still exist
    for (const key of Object.keys(stateBefore.checksums)) {
      expect(stateAfter.checksums[key], `checksum for ${key}`).toBeDefined();
      expect(typeof stateAfter.checksums[key]).toBe('string');
    }
  });
});

// ── upgrade-from-old-layout (migration integration) ───────────────────────────

// Build a post-#117 old-layout CLAUDE.md for testing migration via applyProfileUpdate.
function makeOldLayoutClaude(profileInner: string): string {
  const guideProse = [
    '## What patina is',
    '',
    'Patina is a personal knowledge base.',
    '',
    '## Folder structure',
    '',
    '```',
    'graph/',
    '  notes/',
    '```',
    '',
    '## Rules that always apply',
    '',
    '- Never invent.',
    '',
    '## On session start',
    '',
    'Scan the graph.',
    '',
    '> What are we working on today?',
  ].join('\n');

  const staticSlashCommands = [
    '## Slash commands',
    '',
    'This table is regenerated whenever you install or update patina.',
    '',
    '| Command | Description |',
    '|---------|-------------|',
    '| /add    | Add a note  |',
  ].join('\n');

  const commandsFenceInner = '| Command | Description |\n|---------|-------------|\n| /add    | Add a note  |';
  const modulesFenceInner = 'No modules installed.';

  return [
    '# CLAUDE.md',
    '',
    'This file is loaded automatically.',
    '',
    renderSection('profile', profileInner),
    '',
    guideProse,
    '',
    staticSlashCommands,
    '',
    renderSection('commands', commandsFenceInner),
    '',
    '## Modules',
    '',
    renderSection('modules', modulesFenceInner),
  ].join('\n');
}

describe('upgrade-from-old-layout via applyProfileUpdate (migration integration)', () => {
  let demoDir: string;
  let profile: Profile;

  beforeEach(async () => {
    demoDir = join(tmp, 'patina-old-layout');
    await scaffold({
      demo: false,
      modules: [],
      targetDir: demoDir,
      contentDir: 'graph',
      patinaName: 'test-patina',
      userName: 'Jane Doe',
      title: 'Senior Designer',
      roleDescription: 'I design things.',
      jobDescriptionUrl: '',
      work: {
        self_employed: false,
        company_name: 'Acme Corp',
        website: 'https://acme.com',
        company_description: 'A software company.',
      },
      editor: 'vscode',
      liProfileUrl: '',
    });

    profile = yaml.load(readFileSync(join(demoDir, 'profile.yaml'), 'utf8')) as Profile;

    // Downgrade the CLAUDE.md to old unfenced-guide layout
    const state = readState(demoDir);
    const profileInner = '## Who you\'re working with\n\n**Name:** Jane Doe\n**Company:** Acme Corp';
    const oldLayout = makeOldLayoutClaude(profileInner);
    writeFileSync(join(demoDir, 'CLAUDE.md'), oldLayout, 'utf8');

    // Update stored checksums to reflect the old layout:
    // Remove CLAUDE.md:guide (doesn't exist in old layout)
    const newChecksums = { ...state.checksums };
    delete newChecksums['CLAUDE.md:guide'];
    // Store the profile section checksum correctly so it's not flagged as edited
    const sections = parseSections(oldLayout);
    const profileSection = sections.find(s => s.id === 'profile');
    if (profileSection) {
      newChecksums['CLAUDE.md:profile'] = hashContent(profileSection.inner);
    }
    const commandsSection = sections.find(s => s.id === 'commands');
    if (commandsSection) {
      newChecksums['CLAUDE.md:commands'] = hashContent(commandsSection.inner);
    }
    const modulesSection = sections.find(s => s.id === 'modules');
    if (modulesSection) {
      newChecksums['CLAUDE.md:modules'] = hashContent(modulesSection.inner);
    }
    writeState(demoDir, { ...state, checksums: newChecksums });
  });

  it('guide fence is present in CLAUDE.md after applyProfileUpdate', () => {
    applyProfileUpdate(demoDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });

    const content = readFileSync(join(demoDir, 'CLAUDE.md'), 'utf8');
    expect(content).toContain('<!-- patina:guide:start -->');
    expect(content).toContain('<!-- patina:guide:end -->');

    // The guide placeholder must be FILLED by the section merge, not left empty.
    const guide = parseSections(content).find(s => s.id === 'guide');
    expect(guide).toBeDefined();
    expect(guide!.inner.trim().length).toBeGreaterThan(0);
    expect(guide!.inner).toContain('## What patina is');
  });

  it('no duplication of "What patina is" heading after migration', () => {
    applyProfileUpdate(demoDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });

    const content = readFileSync(join(demoDir, 'CLAUDE.md'), 'utf8');
    const occurrences = content.split('## What patina is').length - 1;
    expect(occurrences).toBe(1);
  });

  it('exactly one ## Slash commands heading after migration', () => {
    applyProfileUpdate(demoDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });

    const content = readFileSync(join(demoDir, 'CLAUDE.md'), 'utf8');
    const occurrences = content.split('## Slash commands').length - 1;
    expect(occurrences).toBe(1);
  });

  it('guide/commands/modules fences appear in canonical order after migration', () => {
    applyProfileUpdate(demoDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });

    const content = readFileSync(join(demoDir, 'CLAUDE.md'), 'utf8');
    const guidePos = content.indexOf('<!-- patina:guide:start -->');
    const commandsPos = content.indexOf('<!-- patina:commands:start -->');
    const modulesPos = content.indexOf('<!-- patina:modules:start -->');
    expect(guidePos).toBeGreaterThan(-1);
    expect(commandsPos).toBeGreaterThan(-1);
    expect(modulesPos).toBeGreaterThan(-1);
    expect(guidePos).toBeLessThan(commandsPos);
    expect(commandsPos).toBeLessThan(modulesPos);
  });

  it('CLAUDE.md:guide checksum is present in state after migration', () => {
    applyProfileUpdate(demoDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });

    const state = readState(demoDir);
    expect(typeof state.checksums['CLAUDE.md:guide']).toBe('string');
  });

  it('migration returns migrationOutcome=migrated', () => {
    const result = applyProfileUpdate(demoDir, profile, {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    });

    expect(result.migrationOutcome).toBe('migrated');
  });

  it('second applyProfileUpdate is idempotent (no duplication)', () => {
    const applyArgs = {
      name: profile.name,
      title: profile.title ?? '',
      roleDescription: profile.role_description ?? '',
      jobDescriptionUrl: profile.job_description_url ?? '',
      selfEmployed: profile.work.self_employed,
      companyName: profile.work.company_name,
      website: profile.work.website ?? '',
      companyDescription: profile.work.company_description ?? '',
    };

    applyProfileUpdate(demoDir, profile, applyArgs);
    const contentAfterFirst = readFileSync(join(demoDir, 'CLAUDE.md'), 'utf8');

    applyProfileUpdate(demoDir, profile, applyArgs);
    const contentAfterSecond = readFileSync(join(demoDir, 'CLAUDE.md'), 'utf8');

    // No additional duplication
    expect(contentAfterSecond.split('## What patina is').length - 1).toBe(1);
    expect(contentAfterSecond.split('## Slash commands').length - 1).toBe(1);
    // guide fence appears exactly once
    expect(contentAfterSecond.split('<!-- patina:guide:start -->').length - 1).toBe(1);
  });
});
