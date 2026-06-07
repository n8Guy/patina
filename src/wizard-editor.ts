import { existsSync } from 'fs';
import { join, delimiter } from 'path';
import { spawn } from 'child_process';

// ─── Claude Code ──────────────────────────────────────────────────────────────

/**
 * Best-effort detection of the `claude` CLI. Scans PATH for the executable and
 * checks the native installer's local location. Used only to decide whether to
 * show an install pointer in the wizard's closing notes — a false negative just
 * shows a harmless extra hint.
 */
export function detectClaude(): boolean {
  const dirs = (process.env.PATH ?? '').split(delimiter).filter(Boolean);
  const names = process.platform === 'win32'
    ? ['claude.cmd', 'claude.exe', 'claude.bat', 'claude']
    : ['claude'];
  for (const dir of dirs) {
    for (const name of names) {
      if (existsSync(join(dir, name))) return true;
    }
  }
  const home = process.env.HOME ?? process.env.USERPROFILE ?? '';
  return home !== '' && existsSync(join(home, '.claude', 'local', 'claude'));
}

// ─── Obsidian ─────────────────────────────────────────────────────────────────

export function detectObsidian(): boolean {
  if (process.platform === 'win32') {
    return existsSync(join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Obsidian', 'Obsidian.exe'));
  }
  if (process.platform === 'darwin') {
    return existsSync('/Applications/Obsidian.app');
  }
  return existsSync('/usr/bin/obsidian') || existsSync('/usr/local/bin/obsidian');
}

export function openInObsidian(): void {
  if (process.platform === 'win32') {
    const exe = join(process.env.LOCALAPPDATA ?? '', 'Programs', 'Obsidian', 'Obsidian.exe');
    spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
  } else if (process.platform === 'darwin') {
    spawn('open', ['-a', 'Obsidian'], { detached: true, stdio: 'ignore' }).unref();
  } else {
    // Use the resolved path rather than relying on PATH in the child environment
    const linuxPath = existsSync('/usr/bin/obsidian') ? '/usr/bin/obsidian' : '/usr/local/bin/obsidian';
    spawn(linuxPath, [], { detached: true, stdio: 'ignore' }).unref();
  }
}

// ─── VS Code ──────────────────────────────────────────────────────────────────

export function detectVSCode(): boolean {
  if (process.platform === 'win32') {
    const local = process.env.LOCALAPPDATA ?? '';
    const programFiles = process.env.ProgramFiles ?? '';
    return (
      existsSync(join(local, 'Programs', 'Microsoft VS Code', 'Code.exe')) ||
      existsSync(join(programFiles, 'Microsoft VS Code', 'Code.exe'))
    );
  }
  if (process.platform === 'darwin') {
    return existsSync('/Applications/Visual Studio Code.app');
  }
  return (
    existsSync('/usr/bin/code') ||
    existsSync('/usr/local/bin/code') ||
    existsSync('/snap/bin/code') ||       // snap install
    existsSync('/usr/share/code/code')    // deb/rpm install
  );
}

export function openInVSCode(vaultPath: string): void {
  if (process.platform === 'win32') {
    // Quote the path so spaces in directory names don't split the cmd /c invocation
    spawn('cmd', ['/c', 'code', `"${vaultPath}"`], { detached: true, stdio: 'ignore' }).unref();
  } else {
    spawn('code', [vaultPath], { detached: true, stdio: 'ignore' }).unref();
  }
}
