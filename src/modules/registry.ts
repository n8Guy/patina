import type { ModuleDefinition } from './types.js';
import { linkedinModule } from './linkedin/index.js';
import { resumeModule } from './resume/index.js';

// Adding a module:
//   1. Create src/modules/<name>/index.ts exporting a ModuleDefinition.
//   2. Add one import above and one entry in MODULES below.
//   3. Add the new id to ModuleId in src/types.ts (kept as a literal union there to
//      avoid a circular type dependency with checksums.ts → registry.ts → types.ts).
export const MODULES = [linkedinModule, resumeModule] as const;

const BY_ID = new Map<string, ModuleDefinition>(MODULES.map(m => [m.id, m]));

export function getModule(id: string): ModuleDefinition | undefined {
  return BY_ID.get(id);
}
