import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import type { Profile } from './types.js';

export type Mode = 'install' | 'update';

export function detectMode(cwd: string): Mode {
  if (!existsSync(join(cwd, 'profile.yaml'))) return 'install';

  // Defense-in-depth: refuse to enter update mode for a demo patina.
  // The primary protection is that --demo calls runDemo() directly and never
  // routes through detectMode(), but this guard prevents accidental operations
  // when the user is inside patina-demo/ and runs `patina` directly.
  let raw: { _demo?: boolean } | null;
  try {
    raw = yaml.load(readFileSync(join(cwd, 'profile.yaml'), 'utf8')) as { _demo?: boolean } | null;
    if (raw && raw._demo === true) {
      throw new Error(
        'This is a demo patina in patina-demo/.\n' +
        'Run --demo from a different directory to create a new demo,\n' +
        'or delete patina-demo/ to remove it.',
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('This is a demo patina')) throw e;
    throw new Error(`Could not read profile.yaml: ${e instanceof Error ? e.message : e}. Try running patina from the correct directory.`);
  }

  return 'update';
}

export function loadProfile(root: string): Profile {
  const raw = yaml.load(readFileSync(join(root, 'profile.yaml'), 'utf8')) as Profile;
  return { ...raw, content_dir: raw.content_dir ?? 'graph' };
}
