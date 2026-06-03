import { describe, it, expect } from 'vitest';
import yaml from 'js-yaml';
import { tpl } from '../template-loader.js';
import { MANIFEST_REQUIRED_FIELDS } from '../scaffold.js';
import { MODULES, getModule } from '../modules/registry.js';

function parseFrontmatter(raw: string): Record<string, unknown> {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error('No YAML frontmatter found');
  const parsed = yaml.load(match[1]);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Frontmatter did not parse to an object');
  return parsed as Record<string, unknown>;
}

describe('requiresConfig / promptsOnAdd', () => {
  it('linkedin module has requiresConfig: true', () => {
    const def = getModule('linkedin');
    expect(def?.requiresConfig).toBe(true);
  });

  it('linkedin module has promptsOnAdd as a function', () => {
    const def = getModule('linkedin');
    expect(typeof def?.promptsOnAdd).toBe('function');
  });

  it('resume module does NOT have requiresConfig: true', () => {
    const def = getModule('resume');
    expect(def?.requiresConfig).toBeFalsy();
  });
});

describe('module manifest frontmatter', () => {
  for (const { id: module } of MODULES) {
    describe(`${module} manifest`, () => {
      const raw = tpl(`modules/${module}/manifest.md`);
      const frontmatter = parseFrontmatter(raw);

      for (const field of MANIFEST_REQUIRED_FIELDS) {
        it(`has required field: ${field}`, () => {
          // Raw templates may use {{PLACEHOLDER}} values (e.g. installed: {{TODAY}});
          // js-yaml parses those as objects, not strings. Truthy covers both.
          // Rendered values are validated by scaffold integration tests.
          expect(
            frontmatter[field],
            `Module "${module}" manifest is missing required field "${field}"`
          ).toBeTruthy();
        });
      }
    });
  }
});
