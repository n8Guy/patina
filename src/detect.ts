import { existsSync } from 'fs';
import { join } from 'path';

export type Mode = 'install' | 'update';

export function detectMode(cwd: string): Mode {
  return existsSync(join(cwd, 'profile.yaml')) ? 'update' : 'install';
}
