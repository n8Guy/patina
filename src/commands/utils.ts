import { mkdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';

export function writeFileEntry(root: string, relativePath: string, content: string): void {
  const full = join(root, relativePath);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content, 'utf8');
}
