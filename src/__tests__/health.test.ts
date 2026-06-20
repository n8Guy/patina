import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import yaml from 'js-yaml';
import {
  findPlaceholders,
  formatHealthReport,
  detectCorruption,
  repairCorruption,
  type HealthReport,
} from '../health.js';
import { scaffold } from '../scaffold.js';
import type { Profile } from '../types.js';

// ── findPlaceholders ──────────────────────────────────────────────────────────

describe('findPlaceholders', () => {
  it('returns empty array for clean content', () => {
    expect(findPlaceholders('Hello world')).toEqual([]);
    expect(findPlaceholders('')).toEqual([]);
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
    // Must also add the patina: managed marker so detectCorruption checks it
    const corruptContent = '---\npatina: managed\n---\n# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n**Company:** {{COMPANY_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    const report = detectCorruption(targetDir, profile);
    expect(report.ok).toBe(false);
    expect(report.corruptFiles.has('CLAUDE.md')).toBe(true);

    const placeholderFinding = report.findings.find(f => f.kind === 'placeholders');
    expect(placeholderFinding).toBeDefined();
    expect(placeholderFinding!.detail).toContain('{{USER_NAME}}');
  });
});

describe('detectCorruption — custom archetypes not scanned', () => {
  it('does not flag a user-created archetype with {{USER_TITLE}} as corrupt', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    // Create a user-owned custom archetype — NOT in MANAGED_FILES, so it must not be scanned
    const agentsDir = join(targetDir, '.claude', 'agents');
    // agentsDir may not exist if no predefined archetypes were selected; create it
    mkdirSync(agentsDir, { recursive: true });
    const cfoContent = [
      '---',
      'name: CFO',
      'role: audience',
      'description: A CFO evaluating content from a Staff Engineer at a logistics company.',
      '---',
      '',
      '## CFO',
      '',
      '**Role:** Chief Financial Officer responsible for company fiscal health.',
      '**What they care about:** ROI, risk, cost efficiency.',
      '',
      '## Personal context',
      '',
      'This archetype is reacting to content from {{USER_NAME}}, a {{USER_TITLE}} at {{COMPANY_NAME}}.',
      'They evaluate whether the content reflects the operational realities of a mid-market company.',
    ].join('\n');
    writeFileSync(join(agentsDir, 'cfo.md'), cfoContent, 'utf8');

    const report = detectCorruption(targetDir, profile);

    // The custom archetype must NOT appear in the corruption report
    expect(report.corruptFiles.has('.claude/agents/cfo.md')).toBe(false);
    const cfoFinding = report.findings.find(f => f.file === '.claude/agents/cfo.md');
    expect(cfoFinding).toBeUndefined();
    // The rest of the instance should still be clean
    expect(report.ok).toBe(true);
  });
});

describe('repairCorruption — dry run', () => {
  it('writes nothing and returns findings when dry-run=true', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    const corruptContent = '---\npatina: managed\n---\n# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n';
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

    // Corrupt: write raw template-like content with placeholders + keep marker so repair runs
    const corruptContent = '---\npatina: managed\n---\n# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n**Company:** {{COMPANY_NAME}}\n';
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

  it('after repair, detectCorruption returns ok=true', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    const corruptContent = '---\npatina: managed\n---\n# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    await repairCorruption(targetDir, profile, { dryRun: false });

    // On the next detectCorruption call, the instance should be clean
    const postReport = detectCorruption(targetDir, profile);
    expect(postReport.ok).toBe(true);
  });

  it('is idempotent — second repair on already-clean instance reports ok', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    const corruptContent = '---\npatina: managed\n---\n# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    await repairCorruption(targetDir, profile, { dryRun: false });
    const { report: secondReport } = await repairCorruption(targetDir, profile, { dryRun: false });
    expect(secondReport.ok).toBe(true);
  });

  it('does not touch graph/ content', async () => {
    await scaffold({ ...scaffoldOpts, targetDir });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    // Write a note in graph/
    const notePath = join(targetDir, 'graph', 'notes', 'my-note.md');
    writeFileSync(notePath, '# My Note\nThis is personal content.', 'utf8');

    const corruptContent = '---\npatina: managed\n---\n# CLAUDE.md\n\n**Name:** {{USER_NAME}}\n';
    writeFileSync(join(targetDir, 'CLAUDE.md'), corruptContent, 'utf8');

    await repairCorruption(targetDir, profile, { dryRun: false });

    // graph/ note must be untouched
    expect(readFileSync(notePath, 'utf8')).toBe('# My Note\nThis is personal content.');
  });
});

// ── opencode health integration ───────────────────────────────────────────────

describe('detectCorruption — opencode with module', () => {
  it('detects {{FAKE}} planted in .opencode/modules/work/CLAUDE.md', async () => {
    await scaffold({ ...scaffoldOpts, targetDir, agent: 'opencode', modules: ['work'] });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    // Plant a fake token in the opencode module file (exactly the path the adapter generates)
    const moduleClaude = join(targetDir, '.opencode', 'modules', 'work', 'CLAUDE.md');
    const original = readFileSync(moduleClaude, 'utf8');
    writeFileSync(moduleClaude, original + '\n{{FAKE}}\n', 'utf8');

    const report = detectCorruption(targetDir, profile);
    expect(report.ok).toBe(false);
    const finding = report.findings.find(f => f.file === '.opencode/modules/work/CLAUDE.md');
    expect(finding).toBeDefined();
    expect(finding!.detail).toContain('{{FAKE}}');
  });

  it('repairCorruption fixes {{FAKE}} planted in .opencode/modules/work/CLAUDE.md', async () => {
    await scaffold({ ...scaffoldOpts, targetDir, agent: 'opencode', modules: ['work'] });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    const moduleClaude = join(targetDir, '.opencode', 'modules', 'work', 'CLAUDE.md');
    const original = readFileSync(moduleClaude, 'utf8');
    writeFileSync(moduleClaude, original + '\n{{FAKE}}\n', 'utf8');

    const { report, repairedFiles } = await repairCorruption(targetDir, profile, { dryRun: false });
    expect(report.ok).toBe(true);
    expect(repairedFiles).toContain('.opencode/modules/work/CLAUDE.md');

    // Repaired content must not contain {{FAKE}}
    const repaired = readFileSync(moduleClaude, 'utf8');
    expect(repaired).not.toContain('{{FAKE}}');
  });

  it('detectCorruption on a clean opencode patina with module returns ok=true', async () => {
    await scaffold({ ...scaffoldOpts, targetDir, agent: 'opencode', modules: ['work'] });
    const profile = yaml.load(readFileSync(join(targetDir, 'profile.yaml'), 'utf8')) as Profile;

    const report = detectCorruption(targetDir, profile);
    expect(report.ok).toBe(true);
  });
});
