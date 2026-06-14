import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../git.js', () => ({
  isGitAvailable: vi.fn(),
  isInsideGitRepo: vi.fn(),
  gitInit: vi.fn(),
}));

const { isGitAvailable, isInsideGitRepo } = await import('../git.js');
const { backupOfferKind } = await import('../wizard-backup.js');

const mockIsGitAvailable = vi.mocked(isGitAvailable);
const mockIsInsideGitRepo = vi.mocked(isInsideGitRepo);

describe('backupOfferKind', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns unavailable when git is not installed', () => {
    mockIsGitAvailable.mockReturnValue(false);
    expect(backupOfferKind('/some/dir')).toBe('unavailable');
  });

  it('returns already-tracked when inside a git repo', () => {
    mockIsGitAvailable.mockReturnValue(true);
    mockIsInsideGitRepo.mockReturnValue(true);
    expect(backupOfferKind('/some/dir')).toBe('already-tracked');
  });

  it('returns offer when git is available and dir is not tracked', () => {
    mockIsGitAvailable.mockReturnValue(true);
    mockIsInsideGitRepo.mockReturnValue(false);
    expect(backupOfferKind('/some/dir')).toBe('offer');
  });
});
