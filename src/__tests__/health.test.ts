import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';
import {
  findPlaceholders,
  requiredClaudeSections,
  findMissingSections,
  findOrphanedChecksums,
  formatHealthReport,
  detectCorruption,
  repairCorruption,
  type HealthReport,
} from '../health.js';
import { scaffold } from '../scaffold.js';
import { readState, writeState } from '../state.js';
import type { Profile } from '../types.js';

// ── findPlaceholders ──────────────────────────────────────────────────────────

describe('findPlaceholders', () => {
  it('returns empty array for clean content', () => {
    expect(findPlaceholders('Hello world')).toEqual([]);
    expect(findPlaceholders('')).toEqual([]);
    expect(findPlaceholders('<!-- patina:profile:start -->')).toEqual([]);
  });

  it('returns found placeholder tokens', () => {
    expect(findPlaceholders('Hello {{USER_NAME}}')).toEqual(['{{USER_NAME}}']);
    expect(findPlaceholders('{{COMPANY_NAME}} works at {{CONTENT_DIR}}')).toEqual([
      '{{COMPANY_NAME}}',
      '{{CONTENT_DIR}}',
    ]);
  });

  it('deduplicates repeated tokens', () => {
    const result = findPlaceholders('{{USER_NAME}} and {{USER_NAME}} again');
    expect(result).toEqual(['{{USER_NAME}}']);
  });

  it('does not match lowercase or mixed-case identifiers', () => {
    expect(findPlaceholders('{{userName}}')).toEqual([]);
    expect(findPlaceholders('{{User_Name}}')).toEqual([]);
    expect(findPlaceholders('{{user_name}}')).toEqual([]);
  });

  it('matches uppercase with numbers', () => {
    expect(findPlaceholders('{{PATINA_VERSION2}}')).toEqual(['{{PATINA_VERSION2}}']);
  });

  it('does not false-positive on fence ids', () => {
    expect(findPlaceholders('<!-- patina:profile:start -->\ncontent\n<!-- patina:profile:end -->')).toEqual([]);
  });
});

// ── requiredClaudeSections ────────────────────────────────────────────────────

const baseProfile: Profile = {
  patina_name: 'test-patina',
  name: 'Jane Doe',
  title: 'Engineer',
  work: { self_employed: false, company_name: 'Acme' },
  editor: 'vscode',
  modules: [],
  content_dir: 'graph',
  created: '2026-01-01',
};

describe('requiredClaudeSections', () => {
  it('returns base 5 sections without launch_tasks', () => {
    const result = requiredClaudeSections(baseProfile);
    expect(result).toEqual(['profile', 'guide', 'commands', 'modules', 'update-check']);
  });

  it('adds launch when launch_tasks is non-empty', () => {
    const profile = { ...baseProfile, launch_tasks: ['run tests'] };
    const result = requiredClaudeSections(profile);
    expect(result).toContain('launch');
    expect(result).toHaveLength(6);
  });

  it('does not add launch when launch_tasks is empty array', () => {
    const profile = { ...baseProfile, launch_tasks: [] };
    const result = requiredClaudeSections(profile);
    expect(result).not.toContain('launch');
    expect(result).toHaveLength(5);
  });
});

// ── findMissingSections ───────────────────────────────────────────────────────

describe('findMissingSections', () => {
  it('returns empty array when all required sections are present', () => {
    const content = [
      '<!-- patina:profile:start -->content<!-- patina:profile:end -->',
      '<!-- patina:guide:start -->content<!-- patina:guide:end -->',
    ].join('\n');
    expect(findMissingSections(content, ['profile', 'guide'])).toEqual([]);
  });

  it('returns missing section ids', () => {
    const content = '<!-- patina:profile:start -->content<!-- patina:profile:end -->';
    expect(findMissingSections(content, ['profile', 'guide', 'commands'])).toEqual(['guide', 'commands']);
  });

  it('returns all ids when content has no fences', () => {
    expect(findMissingSections('plain text', ['profile', 'guide'])).toEqual(['profile', 'guide']);
  });
});

// ── findOrphanedChecksums ─────────────────────────────────────────────────────

describe('findOrphanedChecksums', () => {
  it('returns empty array when all stored keys are expected', () => {
    const stored = ['CLAUDE.md', 'CLAUDE.md:profile'];
    const expected = ['CLAUDE.md', 'CLAUDE.md:profile', 'README.md'];
    expect(findOrphanedChecksums(stored, expected)).toEqual([]);
  });

  it('returns keys that exist in stored but not expected', () => {
    const stored = ['CLAUDE.md', 'CLAUDE.md:old-section', 'README.md'];
    const expected = ['CLAUDE.md', 'README.md'];
    expect(findOrphanedChecksums(stored, expected)).toEqual(['CLAUDE.md:old-section']);
  });

  it('returns empty array when stored is empty', () => {
    expect(findOrphanedChecksums([], ['CLAUDE.md'])).toEqual([]);
  });
});

// ── formatHealthReport ────────────────────────────────────────────────────────

describe('formatHealthReport', () => {
  it('returns "No corruption found." when ok', () => {
    const report: HealthReport = { ok: true, findings: [], corruptFiles: new Set() };
    expect(formatHealthReport(report)).toBe('No corruption found.');
  });

  it('includes placeholder findings in output', () => {
    const report: HealthReport = {
      ok: false,
      findings: [{ kind: 'placeholders', file: 'CLAUDE.md', detail: '{{USER_NAME}}' }],
      corruptFiles: new Set(['CLAUDE.md']),
    };
    const result = formatHealthReport(report);
    expect(result).toContain('CLAUDE.md');
    expect(result).toContain('{{USER_NAME}}');
    expect(result).toContain('npx my-patina');
  });

  it('includes missing-section findings in output', () => {
    const report: HealthReport = {
      ok: false,
      findings: [{ kind: 'missing-section', file: 'CLAUDE.md', detail: 'missing fence: update-check' }],
      corruptFiles: new Set(['CLAUDE.md']),
    };
    const result = formatHealthReport(report);
    expect(result).toContain('update-check');
  });

  it('includes orphaned-checksum findings in output', () => {
    const report: HealthReport = {
      ok: false,
      findings: [{ kind: 'orphaned-checksum', file: '.patina-state.json', detail: 'CLAUDE.md:old-section' }],
      corruptFiles: new Set(),
    };
    const result = formatHealthReport(report);
    expect(result).toContain('CLAUDE.md:old-section');
  });
});

// ── Integration: scaffold → corrupt → detectCorruption → repairCorruption ────

let tmp: string;
let targetDir: string;

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-health-test-'));
  targetDir = join(tmp, 'my-patina');
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const scaffoldOpts = {
  targetDir: '' as string, // set in each test
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
  editor: 'vscode' as const,
  modules: [] as Profile['modules'],
  liProfileUrl: '',
  contentDir: 'graph',
};

describe('detectCorruption — clean instance', () => {
  it('returns ok=true on a freshly scaffolded patina', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;
    const report = detectCorruption(targetDir, profile);
    expect(report.ok).toBe(true);
    expect(report.findings).toHaveLength(0);
    expect(report.corruptFiles.size).toBe(0);
  });
});

describe('detectCorruption — placeholder corruption', () => {
  it('detects unrendered placeholders in CLAUDE.md', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    // Corrupt CLAUDE.md with raw template content (unrendered placeholders)
    const corruptContent = '# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n**Company:** {{COMPANY_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    const report = detectCorruption(targetDir, profile);
    expect(report.ok).toBe(false);
    expect(report.corruptFiles.has('CLAUDE.md')).toBe(true);

    const placeholderFinding = report.findings.find(f => f.kind === 'placeholders');
    expect(placeholderFinding).toBeDefined();
    expect(placeholderFinding!.detail).toContain('{{USER_NAME}}');
  });

  it('detects missing required sections in CLAUDE.md', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    // Write CLAUDE.md with some fences but missing update-check
    const partialContent = [
      '<!-- patina:profile:start -->',
      'profile content',
      '<!-- patina:profile:end -->',
      '',
      '<!-- patina:guide:start -->',
      'guide content',
      '<!-- patina:guide:end -->',
    ].join('\n');
    writeFileSync(join(targetDir, 'CLAUDE.md'), partialContent, 'utf8');

    const report = detectCorruption(targetDir, profile);
    expect(report.ok).toBe(false);
    const missingFindings = report.findings.filter(f => f.kind === 'missing-section');
    expect(missingFindings.length).toBeGreaterThan(0);
    expect(missingFindings.some(f => f.detail.includes('update-check'))).toBe(true);
  });
});

describe('repairCorruption — dry run', () => {
  it('writes nothing and returns findings when dry-run=true', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    const corruptContent = '# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    const { report, repairedFiles } = await repairCorruption(targetDir, profile, { dryRun: true });
    expect(repairedFiles).toHaveLength(0);
    // File should remain corrupt
    expect(readFileSync(join(targetDir, 'CLAUDE.md'), 'utf8')).toBe(corruptContent);
    // Report should still show the corruption
    expect(report.ok).toBe(false);
  });
});

describe('repairCorruption — full repair', () => {
  it('repairs placeholder corruption and restores personalized content', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    // Corrupt: write raw template-like content with placeholders
    const corruptContent = '# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n**Company:** {{COMPANY_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    const { report, repairedFiles } = await repairCorruption(targetDir, profile, { dryRun: false });
    expect(report.ok).toBe(true);
    expect(repairedFiles).toContain('CLAUDE.md');

    // Repaired content should have actual name, no placeholders
    const repairedContent = readFileSync(join(targetDir, 'CLAUDE.md'), 'utf8');
    expect(repairedContent).toContain('Jane Doe');
    expect(repairedContent).not.toContain('{{USER_NAME}}');
    expect(repairedContent).not.toContain('{{COMPANY_NAME}}');
  });

  it('updates checksums in state after repair', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    const corruptContent = '# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    await repairCorruption(targetDir, profile, { dryRun: false });

    // On the next detectCorruption call, the instance should be clean
    const postReport = detectCorruption(targetDir, profile);
    expect(postReport.ok).toBe(true);
  });

  it('is idempotent — second repair on already-clean instance reports ok', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    const corruptContent = '# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    await repairCorruption(targetDir, profile, { dryRun: false });
    const { report: secondReport } = await repairCorruption(targetDir, profile, { dryRun: false });
    expect(secondReport.ok).toBe(true);
  });

  it('prunes orphaned checksum keys on repair', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    // Inject bogus orphaned key into state
    const state = readState(targetDir);
    writeState(targetDir, {
      ...state,
      checksums: { ...state.checksums, 'CLAUDE.md:bogus-orphan': 'abc123' },
    });

    // Corrupt CLAUDE.md so repairCorruption triggers (orphan-only isn't enough to repair)
    const corruptContent = '# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    await repairCorruption(targetDir, profile, { dryRun: false });

    const stateAfter = readState(targetDir);
    expect(stateAfter.checksums['CLAUDE.md:bogus-orphan']).toBeUndefined();
  });

  it('does not touch graph/ content', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    // Write a note in graph/
    const notePath = join(targetDir, 'graph', 'notes', 'my-note.md');
    writeFileSync(notePath, '# My Note\nThis is personal content.', 'utf8');

    const corruptContent = '# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    await repairCorruption(targetDir, profile, { dryRun: false });

    // graph/ note must be untouched
    expect(readFileSync(notePath, 'utf8')).toBe('# My Note\nThis is personal content.');
  });
});

describe('mergeSections — placeholder bypass', () => {
  it('re-renders a section whose inner content has placeholders, not treating it as user edit', async () => {
    // This tests the sections.ts change: hasPlaceholders(inner) → fall through to update
    const { mergeSections } = await import('../sections.js');
    const { hashContent } = await import('../checksums.js');

    const inner = '**Name:** {{USER_NAME}}';
    const existing = [
      '<!-- patina:profile:start -->',
      inner,
      '<!-- patina:profile:end -->',
    ].join('\n');

    // Stored hash differs (simulating corruption where hash was recorded from raw template)
    const { content, sections } = mergeSections(
      existing,
      { profile: 'Jane Doe — Senior Designer' },
      { 'CLAUDE.md:profile': hashContent('different original content') },
      'CLAUDE.md',
      new Set()
    );

    // Should NOT skip — placeholder presence overrides user-edit detection
    expect(sections[0].outcome).toBe('updated');
    expect(content).toContain('Jane Doe — Senior Designer');
    expect(content).not.toContain('{{USER_NAME}}');
  });
});
