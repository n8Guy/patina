import { createHash } from 'crypto';
import { readFileSync, existsSync } from 'fs';

export type ChecksumMap = Record<string, string>;

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export function hashFile(filePath: string): string | null {
  if (!existsSync(filePath)) return null;
  return hashContent(readFileSync(filePath, 'utf8'));
}

// Files patina manages and can safely update if the user hasn't modified them.
// graph/** is intentionally excluded — patina never touches user content.
export const MANAGED_FILES = [
  'CLAUDE.md',
  '.claude/settings.json',
  '.claude/commands/add.md',
  '.claude/commands/reflect.md',
  '.mcp.json',
] as const;

export const LINKEDIN_MANAGED_FILES = [
  '.claude/commands/li-all.md',
  '.claude/commands/li-about.md',
  '.claude/commands/li-headline.md',
  '.claude/commands/li-experience.md',
  '.claude/commands/li-skills.md',
  '.claude/commands/li-featured.md',
  '.claude/commands/li-activity.md',
  '.claude/commands/li-update.md',
] as const;

export const MODULE_MANAGED_FILES: Record<string, readonly string[]> = {
  linkedin: [
    ...LINKEDIN_MANAGED_FILES,
    '.claude/modules/linkedin/manifest.md',
  ],
};
