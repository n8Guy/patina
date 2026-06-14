import type { LaunchTaskDefinition } from './modules/types.js';
import { getModule } from './modules/registry.js';
import type { ModuleId } from './types.js';

export type { LaunchTaskDefinition };

export const BASE_LAUNCH_TASKS: readonly LaunchTaskDefinition[] = [
  {
    id: 'today-focus',
    label: 'Ask what to focus on today',
    template: '- Ask the user what they want to focus on today and note it before proceeding.',
  },
  {
    id: 'recent-notes',
    label: 'Summarise notes changed in the last 7 days',
    template: '- Summarise any notes in `{{CONTENT_DIR}}/notes/` modified in the last 7 days, one line each.',
  },
];

export interface AvailableLaunchTask {
  nsId: string;
  label: string;
  template: string;
  source: 'base' | ModuleId;
}

/**
 * Collect all available launch tasks from base catalog + installed modules.
 * Tasks are namespaced as `base/<id>` or `<moduleId>/<id>`.
 */
export function availableLaunchTasks(modules: ModuleId[]): AvailableLaunchTask[] {
  const tasks: AvailableLaunchTask[] = BASE_LAUNCH_TASKS.map(t => ({
    nsId: `base/${t.id}`,
    label: t.label,
    template: t.template,
    source: 'base' as const,
  }));

  for (const moduleId of modules) {
    const def = getModule(moduleId);
    if (def?.launchTasks) {
      for (const t of def.launchTasks) {
        tasks.push({
          nsId: `${moduleId}/${t.id}`,
          label: t.label,
          template: t.template,
          source: moduleId,
        });
      }
    }
  }

  return tasks;
}

/**
 * Resolve selected ns-ids against available tasks, returning the inner block
 * content (a `## Launch tasks` heading followed by task template lines joined
 * with newlines), or `null` when no tasks resolve.
 *
 * NOTE: task templates may contain `{{CONTENT_DIR}}` etc. — callers are
 * responsible for expanding vars before writing to CLAUDE.md (single-pass).
 */
export function renderLaunchSection(
  selectedNsIds: string[] | undefined,
  modules: ModuleId[],
): string | null {
  if (!selectedNsIds || selectedNsIds.length === 0) return null;

  const avail = availableLaunchTasks(modules);
  const availMap = new Map(avail.map(t => [t.nsId, t]));

  const resolved = selectedNsIds
    .map(id => availMap.get(id))
    .filter((t): t is AvailableLaunchTask => t !== undefined);

  if (resolved.length === 0) return null;

  return ['## Launch tasks', '', ...resolved.map(t => t.template)].join('\n');
}

/**
 * Return only the ns-ids that are still available given the current module list.
 * Orphaned ids (module removed) are dropped.
 */
export function pruneLaunchTasks(
  selectedNsIds: string[] | undefined,
  modules: ModuleId[],
): string[] {
  if (!selectedNsIds || selectedNsIds.length === 0) return [];
  const avail = new Set(availableLaunchTasks(modules).map(t => t.nsId));
  return selectedNsIds.filter(id => avail.has(id));
}

/**
 * Returns an error message if values.length > 5, else undefined.
 * Pure function — safe to use in prompt validate callbacks and unit tests.
 */
export function launchSelectionError(values: string[]): string | undefined {
  if (values.length > 5) {
    return 'You can select at most 5 launch tasks.';
  }
  return undefined;
}
