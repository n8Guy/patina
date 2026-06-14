import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

vi.mock('@clack/prompts', () => ({
  select: vi.fn(),
  note: vi.fn(),
  log: { success: vi.fn(), info: vi.fn(), warn: vi.fn() },
  isCancel: vi.fn(() => false),
}));

vi.mock('../modules/registry.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../modules/registry.js')>();
  return { ...actual, getModule: vi.fn() };
});

import * as p from '@clack/prompts';
import { getModule } from '../modules/registry.js';
import { handleDeferredModules } from '../wizard-update.js';
import { writeState } from '../state.js';
import type { Profile } from '../types.js';

const mockSelect = vi.mocked(p.select);
const mockGetModule = vi.mocked(getModule);

const TODAY = new Date().toISOString().slice(0, 10);
const PAST = '2026-01-01';
const FUTURE = '2099-12-31';

let tmp: string;

function baseProfile(): Profile {
  return {
    name: 'Test User',
    patina_name: 'test',
    content_dir: 'graph',
    modules: ['linkedin'],
  } as unknown as Profile;
}

function loadState(dir: string) {
  try {
    return JSON.parse(readFileSync(join(dir, '.patina-state.json'), 'utf8'));
  } catch {
    return {};
  }
}

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'patina-deferred-test-'));
  vi.resetAllMocks();
  vi.mocked(p.isCancel).mockReturnValue(false);
  // Default: no module found (safe; most tests override)
  mockGetModule.mockReturnValue(undefined);
});

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('handleDeferredModules', () => {
  it('does nothing when no modules are due', async () => {
    writeState(tmp, { deferred_modules: [{ module: 'linkedin', snooze_until: FUTURE }] });
    await handleDeferredModules(tmp, baseProfile());
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('does nothing when deferred_modules is absent', async () => {
    writeState(tmp, {});
    await handleDeferredModules(tmp, baseProfile());
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('"done" removes the deferral entry', async () => {
    mockGetModule.mockReturnValue({ id: 'linkedin', label: 'LinkedIn' } as ReturnType<typeof getModule>);
    writeState(tmp, { deferred_modules: [{ module: 'linkedin', snooze_until: PAST }] });
    mockSelect.mockResolvedValueOnce('done');

    await handleDeferredModules(tmp, baseProfile());

    const state = loadState(tmp);
    expect(state.deferred_modules ?? []).toHaveLength(0);
  });

  it('"done" preserves other deferred entries', async () => {
    mockGetModule.mockReturnValue({ id: 'linkedin', label: 'LinkedIn' } as ReturnType<typeof getModule>);
    writeState(tmp, {
      deferred_modules: [
        { module: 'linkedin', snooze_until: PAST },
        { module: 'resume', snooze_until: FUTURE },
      ],
    });
    mockSelect.mockResolvedValueOnce('done');

    await handleDeferredModules(tmp, baseProfile());

    const state = loadState(tmp);
    expect(state.deferred_modules).toHaveLength(1);
    expect(state.deferred_modules[0].module).toBe('resume');
  });

  it('"snooze" updates snooze_until to a future date', async () => {
    mockGetModule.mockReturnValue({ id: 'linkedin', label: 'LinkedIn' } as ReturnType<typeof getModule>);
    writeState(tmp, { deferred_modules: [{ module: 'linkedin', snooze_until: PAST }] });
    mockSelect
      .mockResolvedValueOnce('snooze')   // first select: what to do
      .mockResolvedValueOnce('1w');       // second select: snooze duration

    await handleDeferredModules(tmp, baseProfile());

    const state = loadState(tmp);
    const entry = state.deferred_modules?.find((e: { module: string }) => e.module === 'linkedin');
    expect(entry).toBeDefined();
    expect(entry.snooze_until).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entry.snooze_until > TODAY).toBe(true);
  });

  it('"now" without promptsOnAdd still clears the deferral', async () => {
    mockGetModule.mockReturnValue({ id: 'linkedin', label: 'LinkedIn' } as ReturnType<typeof getModule>);
    writeState(tmp, { deferred_modules: [{ module: 'linkedin', snooze_until: PAST }] });
    mockSelect.mockResolvedValueOnce('now');

    await handleDeferredModules(tmp, baseProfile());

    const state = loadState(tmp);
    expect(state.deferred_modules ?? []).toHaveLength(0);
  });

  it('"now" with promptsOnAdd calls it and clears the deferral', async () => {
    const mockPromptsOnAdd = vi.fn().mockResolvedValue({ liProfileUrl: 'https://linkedin.com/in/x' });
    mockGetModule.mockReturnValue({
      id: 'linkedin',
      label: 'LinkedIn',
      promptsOnAdd: mockPromptsOnAdd,
    } as ReturnType<typeof getModule>);
    writeFileSync(join(tmp, 'profile.yaml'), 'name: Test\npatina_name: test\ncontent_dir: graph\n');
    writeState(tmp, { deferred_modules: [{ module: 'linkedin', snooze_until: PAST }] });
    mockSelect.mockResolvedValueOnce('now');

    await handleDeferredModules(tmp, baseProfile());

    expect(mockPromptsOnAdd).toHaveBeenCalled();
    const state = loadState(tmp);
    expect(state.deferred_modules ?? []).toHaveLength(0);
  });

  it('"now" with unknown module ID still clears the deferral', async () => {
    mockGetModule.mockReturnValue(undefined);
    writeState(tmp, { deferred_modules: [{ module: 'unknown-module', snooze_until: PAST }] });
    mockSelect.mockResolvedValueOnce('now');

    await handleDeferredModules(tmp, baseProfile());

    const state = loadState(tmp);
    expect(state.deferred_modules ?? []).toHaveLength(0);
  });

  it('unknown module ID: still prompts and respects "done"', async () => {
    mockGetModule.mockReturnValue(undefined);
    writeState(tmp, { deferred_modules: [{ module: 'unknown-module', snooze_until: PAST }] });
    mockSelect.mockResolvedValueOnce('done');

    await handleDeferredModules(tmp, baseProfile());

    const state = loadState(tmp);
    expect(state.deferred_modules ?? []).toHaveLength(0);
  });

  it('handles multiple due modules in sequence', async () => {
    mockGetModule.mockReturnValue({ id: 'linkedin', label: 'LinkedIn' } as ReturnType<typeof getModule>);
    writeState(tmp, {
      deferred_modules: [
        { module: 'linkedin', snooze_until: PAST },
        { module: 'resume', snooze_until: PAST },
      ],
    });
    mockSelect
      .mockResolvedValueOnce('done')    // linkedin: done
      .mockResolvedValueOnce('snooze')  // resume: snooze
      .mockResolvedValueOnce('1m');     // resume snooze duration

    await handleDeferredModules(tmp, baseProfile());

    const state = loadState(tmp);
    expect(state.deferred_modules).toHaveLength(1);
    expect(state.deferred_modules[0].module).toBe('resume');
    expect(state.deferred_modules[0].snooze_until > TODAY).toBe(true);
  });
});
