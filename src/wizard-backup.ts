import * as p from '@clack/prompts';
import chalk from 'chalk';
import { isGitAvailable, isInsideGitRepo, gitInit } from './git.js';
import { onCancel } from './wizard-shared.js';
import { label } from './wizard-brand.js';

export function backupOfferKind(targetDir: string): 'already-tracked' | 'offer' | 'unavailable' {
  if (!isGitAvailable()) return 'unavailable';
  if (isInsideGitRepo(targetDir)) return 'already-tracked';
  return 'offer';
}

export async function offerBackup(targetDir: string): Promise<'initialized' | 'declined' | 'already-tracked' | 'skipped'> {
  const kind = backupOfferKind(targetDir);

  if (kind === 'unavailable') {
    return 'skipped';
  }

  if (kind === 'already-tracked') {
    p.note(
      chalk.hex('#94A3B8')('Your patina is inside an existing version-controlled folder — your notes are already being tracked.'),
      label('Version history')
    );
    return 'already-tracked';
  }

  // kind === 'offer'
  const confirm = await p.confirm({
    message: "Your notes aren't automatically backed up. Want to enable version history so you can recover anything you delete?",
    initialValue: false,
  });

  if (p.isCancel(confirm)) {
    onCancel();
    // onCancel() exits the process, but TypeScript doesn't know that — return to satisfy types
    return 'skipped';
  }

  if (confirm) {
    const success = gitInit(targetDir);
    if (success) {
      return 'initialized';
    }
    p.log.warn('Could not initialise git repository — skipping version history. You can try running git init manually later.');
    return 'skipped';
  }

  return 'declined';
}
