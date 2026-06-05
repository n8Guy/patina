import { describe, it, expect } from 'vitest';
import { buildClientFiles } from '../modules/clients/scaffold-client.js';

const BASE_OPTS = {
  name: 'Acme Corp',
  engagementType: 'project' as const,
  confidential: true,
  today: '2025-06-01',
  contentDir: 'graph',
};

describe('buildClientFiles', () => {
  it('slugifies client name for folder path', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, name: 'Acme Corp & Partners!' });
    const paths = entries.map(([p]) => p);
    expect(paths.every(p => p.includes('acme-corp-partners'))).toBe(true);
    expect(paths.some(p => p.includes('Acme Corp'))).toBe(false);
  });

  it('defaults confidential to true when not overridden', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, confidential: true });
    const profile = entries.find(([p]) => p.endsWith('profile.md'));
    expect(profile).toBeDefined();
    expect(profile![1]).toContain('confidential: true');
  });

  it('--no-confidential path yields confidential: false in profile.md', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, confidential: false });
    const profile = entries.find(([p]) => p.endsWith('profile.md'));
    expect(profile).toBeDefined();
    expect(profile![1]).toContain('confidential: false');
  });

  it('outcomes is commented examples, not empty array', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, emitInitialEngagement: true });
    const engagement = entries.find(([p]) => p.includes('engagements/'));
    expect(engagement).toBeDefined();
    // Must NOT contain `outcomes: []`
    expect(engagement![1]).not.toContain('outcomes: []');
    // Must contain YAML comment examples
    expect(engagement![1]).toContain('# -');
  });

  it('retainer/ present for retainer engagement type', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, engagementType: 'retainer' });
    const paths = entries.map(([p]) => p);
    expect(paths.some(p => p.includes('/retainer/'))).toBe(true);
  });

  it('retainer/ present for advisory engagement type', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, engagementType: 'advisory' });
    const paths = entries.map(([p]) => p);
    expect(paths.some(p => p.includes('/retainer/'))).toBe(true);
  });

  it('retainer/ absent for project engagement type', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, engagementType: 'project' });
    const paths = entries.map(([p]) => p);
    expect(paths.some(p => p.includes('/retainer/'))).toBe(false);
  });

  it('always emits profile.md, engagements/, deliverables/, notes/', () => {
    const entries = buildClientFiles(BASE_OPTS);
    const paths = entries.map(([p]) => p);
    expect(paths.some(p => p.endsWith('profile.md'))).toBe(true);
    expect(paths.some(p => p.includes('/deliverables/'))).toBe(true);
    expect(paths.some(p => p.includes('/notes/'))).toBe(true);
    expect(paths.some(p => p.includes('/engagements/'))).toBe(true);
  });

  it('no .gitkeep entries when emitInitialEngagement is true', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, emitInitialEngagement: true });
    const gitkeeps = entries.filter(([p]) => p.endsWith('.gitkeep'));
    // engagements/.gitkeep should be replaced by initial.md
    const engagementGitkeep = gitkeeps.find(([p]) => p.includes('/engagements/'));
    expect(engagementGitkeep).toBeUndefined();
    // But other .gitkeeps (deliverables, notes) are still present
    expect(gitkeeps.some(([p]) => p.includes('/deliverables/'))).toBe(true);
    expect(gitkeeps.some(([p]) => p.includes('/notes/'))).toBe(true);
  });

  it('emits initial.md in engagements/ when emitInitialEngagement is true', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, emitInitialEngagement: true });
    const initialEngagement = entries.find(([p]) => p.includes('/engagements/initial.md'));
    expect(initialEngagement).toBeDefined();
    expect(initialEngagement![1]).toMatch(/^---\r?\n/);
  });

  it('engagement type is recorded in initial.md frontmatter', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, engagementType: 'retainer', emitInitialEngagement: true });
    const initialEngagement = entries.find(([p]) => p.includes('/engagements/initial.md'));
    expect(initialEngagement![1]).toContain('engagement_type: retainer');
  });

  it('profile.md has YAML frontmatter', () => {
    const entries = buildClientFiles(BASE_OPTS);
    const profile = entries.find(([p]) => p.endsWith('profile.md'));
    expect(profile![1]).toMatch(/^---\r?\n/);
  });

  it('uses contentDir in all output paths', () => {
    const entries = buildClientFiles({ ...BASE_OPTS, contentDir: 'my-graph' });
    for (const [path] of entries) {
      expect(path).toMatch(/^my-graph\//);
    }
  });
});
