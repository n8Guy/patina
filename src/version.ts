import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Assumption: package.json is always one directory above this module's compiled
// location — holds for both dev (tsx src/) and production (dist/).
function readPackageJson(): { name: string; version: string } {
  const pkgPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
  let pkg: unknown;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  } catch {
    throw new Error(`patina: could not read package.json at ${pkgPath}`);
  }
  if (
    typeof pkg !== 'object' || pkg === null ||
    typeof (pkg as Record<string, unknown>).version !== 'string' ||
    typeof (pkg as Record<string, unknown>).name !== 'string'
  ) {
    throw new Error(`patina: package.json at ${pkgPath} is missing valid "name" or "version" fields`);
  }
  return pkg as { name: string; version: string };
}

export function getPatinaVersion(): string {
  return readPackageJson().version;
}

export function getPatinaPackageName(): string {
  return readPackageJson().name;
}
