import type { ModuleDefinition } from './types.js';
import { linkedinModule } from './linkedin/index.js';
import { resumeModule } from './resume/index.js';
import { goalsModule } from './goals/index.js';
import { workModule } from './work/index.js';

// Adding a module:
//   1. Create src/modules/<name>/index.ts exporting a ModuleDefinition.
//   2. Add one import above and one entry in MODULES below.
//   3. Add the new id to ModuleId in src/types.ts (kept as a literal union there to
//      avoid a circular type dependency with checksums.ts → registry.ts → types.ts).
export const MODULES = [linkedinModule, resumeModule, goalsModule, workModule] as const;

// Belt-and-suspenders runtime assertion: catches missing demoContent on any module
// that satisfies the interface structurally but skips the required method at runtime.
for (const m of MODULES) {
  if (typeof (m as ModuleDefinition).demoContent !== 'function') {
    throw new Error(`Module "${m.id}" is missing a required demoContent export.`);
  }
}

const BY_ID = new Map<string, ModuleDefinition>(MODULES.map(m => [m.id, m]));

export function getModule(id: string): ModuleDefinition | undefined {
  return BY_ID.get(id);
}
