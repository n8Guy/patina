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
