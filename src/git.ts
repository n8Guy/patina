import { execSync } from 'child_process';

export function isInsideGitRepo(dir: string): boolean {
  try {
    execSync('git rev-parse --is-inside-work-tree', { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function isGitAvailable(): boolean {
  try {
    execSync('git --version', { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

export function gitInit(dir: string): boolean {
  try {
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}
