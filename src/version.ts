import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Read patina's own version from package.json.
 *
 * Assumption: package.json is always one directory above this module's
 * compiled location. This holds for both dev (`tsx src/`) and production
 * (`dist/`) because tsup places compiled output directly in `dist/` and
 * package.json lives at the repo root (one level above `dist/`).
 */
export function getPatinaVersion(): string {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  let pkg: unknown;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    throw new Error(`patina: could not read package.json at ${pkgPath}`);
  }
  if (typeof pkg !== 'object' || pkg === null || typeof (pkg as Record<string, unknown>).version !== 'string') {
    throw new Error(`patina: package.json at ${pkgPath} is missing a valid "version" field`);
  }
  return (pkg as { version: string }).version;
}
