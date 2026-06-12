import { detectMode } from './detect.js';
import { printBanner } from './wizard-brand.js';
import { runInstall } from './wizard-install.js';
import { runUpdate } from './wizard-update.js';

// ─── Main ────────────────────────────────────────────────────────────────────

export async function main(): Promise<void> {
  printBanner();

  const cwd = process.cwd();
  const mode = detectMode(cwd);

  if (mode === 'update') {
    await runUpdate(cwd);
  } else {
    await runInstall(cwd);
  }
}

// ─── Barrel re-exports (test compatibility) ───────────────────────────────────

export { slugify, defaultSnoozeUntil, snoozeUntilFor, addDeferredModule, clearDeferredModule } from './wizard-shared.js';
export { removeManagedFileIfUnmodified, applyProfileUpdate, applyLaunchTaskUpdate, syncBaseFiles } from './wizard-update.js';
export { applyModuleChanges } from './wizard-modules.js';
export type { ProfileFields, ProfileUpdateResult, LaunchTaskUpdateResult } from './wizard-update.js';
export type { ModuleChangeResult } from './wizard-modules.js';
