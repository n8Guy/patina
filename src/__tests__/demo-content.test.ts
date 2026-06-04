import { describe, it, expect } from 'vitest';
import { MODULES } from '../modules/registry.js';
import { DEMO_TODAY, DEMO_PERSONA } from '../demo/persona.js';
import { profileToVars } from '../scaffold.js';
import type { Profile } from '../types.js';

// Build demo vars matching what runDemo() uses
const demoProfile: Profile = {
  patina_name: DEMO_PERSONA.patinaName,
  name: DEMO_PERSONA.userName,
  title: DEMO_PERSONA.title,
  role_description: DEMO_PERSONA.roleDescription,
  job_description_url: DEMO_PERSONA.jobDescriptionUrl || undefined,
  work: DEMO_PERSONA.work,
  editor: DEMO_PERSONA.editor,
  modules: MODULES.map(m => m.id as import('../types.js').ModuleId),
  content_dir: DEMO_PERSONA.contentDir,
  created: DEMO_TODAY,
  _demo: true,
  linkedin: { profile_url: DEMO_PERSONA.liProfileUrl },
};

const demoVars = profileToVars(demoProfile, DEMO_PERSONA.liProfileUrl, DEMO_TODAY);
const contentDir = DEMO_PERSONA.contentDir;

describe('demo-content — every module has demoContent', () => {
  for (const mod of MODULES) {
    it(`${mod.id} has a callable demoContent`, () => {
      expect(typeof mod.demoContent).toBe('function');
    });
  }
});

describe('demo-content — output has no unreplaced template vars', () => {
  for (const mod of MODULES) {
    it(`${mod.id} demoContent output contains no {{...}} vars`, () => {
      const entries = mod.demoContent(demoVars, contentDir);
      for (const [path, content] of entries) {
        expect(content, `${mod.id}: ${path}`).not.toMatch(/\{\{[A-Z_]+\}\}/);
      }
    });
  }
});

describe('demo-content — files land under correct contentDir paths', () => {
  for (const mod of MODULES) {
    it(`${mod.id} demoContent paths start with ${contentDir}/${mod.id}/`, () => {
      const entries = mod.demoContent(demoVars, contentDir);
      expect(entries.length).toBeGreaterThan(0);
      for (const [path] of entries) {
        expect(path, `${mod.id}: ${path}`).toMatch(
          new RegExp(`^${contentDir}/${mod.id}/`),
        );
      }
    });
  }
});

describe('demo-content — all files have YAML frontmatter', () => {
  for (const mod of MODULES) {
    it(`${mod.id} demoContent files all start with --- frontmatter`, () => {
      const entries = mod.demoContent(demoVars, contentDir);
      for (const [path, content] of entries) {
        expect(content, `${mod.id}: ${path} should start with ---`).toMatch(/^---\r?\n/);
      }
    });
  }
});

describe('demo-content — work module coverage', () => {
  const workEntries = MODULES.find(m => m.id === 'work')!.demoContent(demoVars, contentDir);
  const workContent = workEntries.map(([, c]) => c).join('\n');

  it('includes all four artifact types (transcript, weekly, reference, work-profile)', () => {
    expect(workContent).toMatch(/^type: transcript$/m);
    expect(workContent).toMatch(/^type: weekly$/m);
    expect(workContent).toMatch(/^type: reference$/m);
    expect(workContent).toMatch(/^type: work-profile$/m);
  });

  it('includes an archived: true flag on the work-profile', () => {
    expect(workContent).toMatch(/^archived: true$/m);
  });

  it('all four artifact files exist at expected paths', () => {
    const paths = workEntries.map(([p]) => p);
    expect(paths.some(p => p.includes('/transcripts/'))).toBe(true);
    expect(paths.some(p => p.includes('/weeklies/'))).toBe(true);
    expect(paths.some(p => p.includes('/references/'))).toBe(true);
    expect(paths.some(p => p.endsWith('/work/profile.md'))).toBe(true);
  });
});

describe('demo-content — goals module coverage', () => {
  const goalsEntries = MODULES.find(m => m.id === 'goals')!.demoContent(demoVars, contentDir);
  const goalsContent = goalsEntries.map(([, c]) => c).join('\n');

  it('covers all required statuses (open, in-progress, done)', () => {
    expect(goalsContent).toMatch(/^status: open$/m);
    expect(goalsContent).toMatch(/^status: in-progress$/m);
    expect(goalsContent).toMatch(/^status: done$/m);
  });

  it('covers required horizons (week, quarter, year)', () => {
    expect(goalsContent).toMatch(/^horizon: week$/m);
    expect(goalsContent).toMatch(/^horizon: quarter$/m);
    expect(goalsContent).toMatch(/^horizon: year$/m);
  });

  it('covers required types (project, learning, job-search)', () => {
    expect(goalsContent).toMatch(/^type: project$/m);
    expect(goalsContent).toMatch(/^type: learning$/m);
    expect(goalsContent).toMatch(/^type: job-search$/m);
  });
});
