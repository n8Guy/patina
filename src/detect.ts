import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'js-yaml';
import type { Profile } from './types.js';

export type Mode = 'install' | 'update';

export function detectMode(cwd: string): Mode {
  return existsSync(join(cwd, 'profile.yaml')) ? 'update' : 'install';
}

export function loadProfile(root: string): Profile {
  const raw = yaml.load(readFileSync(join(root, 'profile.yaml'), 'utf8')) as Profile;
  return { ...raw, content_dir: raw.content_dir ?? 'graph' };
}
