import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: vi.fn() };
});

const mockExistsSync = vi.mocked(fs.existsSync);

// Import after mock is registered
const { detectObsidian, detectVSCode } = await import('../wizard-editor.js');

afterEach(() => {
  vi.restoreAllMocks();
});

// ── detectObsidian ────────────────────────────────────────────────────────────

describe('detectObsidian — win32', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.LOCALAPPDATA = 'C:\\Users\\test\\AppData\\Local';
  });

  it('returns true when Obsidian.exe exists', () => {
    mockExistsSync.mockReturnValue(true);
    expect(detectObsidian()).toBe(true);
  });

  it('returns false when Obsidian.exe is missing', () => {
    mockExistsSync.mockReturnValue(false);
    expect(detectObsidian()).toBe(false);
  });

  it('checks the correct path', () => {
    mockExistsSync.mockReturnValue(false);
    detectObsidian();
    expect(mockExistsSync).toHaveBeenCalledWith(
      expect.stringContaining('Obsidian.exe')
    );
  });
});

describe('detectObsidian — darwin', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
  });

  it('returns true when Obsidian.app exists', () => {
    mockExistsSync.mockImplementation((p) => p === '/Applications/Obsidian.app');
    expect(detectObsidian()).toBe(true);
  });

  it('returns false when Obsidian.app is missing', () => {
    mockExistsSync.mockReturnValue(false);
    expect(detectObsidian()).toBe(false);
  });
});

// ── detectVSCode ──────────────────────────────────────────────────────────────

describe('detectVSCode — win32', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('win32');
    process.env.LOCALAPPDATA = 'C:\\Users\\test\\AppData\\Local';
    process.env.ProgramFiles = 'C:\\Program Files';
  });

  it('returns true when Code.exe exists at LOCALAPPDATA path', () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).includes('Local') && String(p).includes('Code.exe')
    );
    expect(detectVSCode()).toBe(true);
  });

  it('returns true when Code.exe exists at ProgramFiles path', () => {
    mockExistsSync.mockImplementation((p) =>
      String(p).includes('Program Files') && String(p).includes('Code.exe')
    );
    expect(detectVSCode()).toBe(true);
  });

  it('returns false when VS Code is not installed', () => {
    mockExistsSync.mockReturnValue(false);
    expect(detectVSCode()).toBe(false);
  });

  it('checks paths containing Code.exe', () => {
    mockExistsSync.mockClear();
    mockExistsSync.mockReturnValue(false);
    detectVSCode();
    const checkedPaths = mockExistsSync.mock.calls.map(([p]) => String(p));
    expect(checkedPaths.every((p) => p.includes('Code.exe'))).toBe(true);
  });
});

describe('detectVSCode — darwin', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
  });

  it('returns true when Visual Studio Code.app exists', () => {
    mockExistsSync.mockImplementation((p) => p === '/Applications/Visual Studio Code.app');
    expect(detectVSCode()).toBe(true);
  });

  it('returns false when VS Code is not installed', () => {
    mockExistsSync.mockReturnValue(false);
    expect(detectVSCode()).toBe(false);
  });
});

describe('detectVSCode — linux', () => {
  beforeEach(() => {
    vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
  });

  it('returns true for /usr/bin/code', () => {
    mockExistsSync.mockImplementation((p) => p === '/usr/bin/code');
    expect(detectVSCode()).toBe(true);
  });

  it('returns true for snap install at /snap/bin/code', () => {
    mockExistsSync.mockImplementation((p) => p === '/snap/bin/code');
    expect(detectVSCode()).toBe(true);
  });

  it('returns true for deb/rpm install at /usr/share/code/code', () => {
    mockExistsSync.mockImplementation((p) => p === '/usr/share/code/code');
    expect(detectVSCode()).toBe(true);
  });

  it('returns false when VS Code is not installed', () => {
    mockExistsSync.mockReturnValue(false);
    expect(detectVSCode()).toBe(false);
  });
});
