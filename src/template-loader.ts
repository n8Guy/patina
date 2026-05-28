import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// When compiled, __dirname = dist/ and templates are copied to dist/templates.
// When running via tsx, __dirname = src/ and templates live in src/templates.
export const TEMPLATES_DIR = join(__dirname, 'templates');

export function tpl(relativePath: string): string {
  return readFileSync(join(TEMPLATES_DIR, relativePath), 'utf8');
}
