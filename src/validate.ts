import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, relative, sep, basename, dirname, resolve } from 'path';
import type { Profile, ValidationCheckId, ValidationIssue, ValidationResult } from './types.js';
import { CONTENT_SUBDIRS } from './checksums.js';
import { getModule } from './modules/registry.js';
import { detectCorruption } from './health.js';
import type { CorruptionFinding } from './health.js';

// Destructure positionally — types enforce order: CONTENT_SUBDIRS is `readonly ['notes', 'skills', 'posts']`
const NOTES: 'notes' = CONTENT_SUBDIRS[0];
const SKILLS: 'skills' = CONTENT_SUBDIRS[1];
const POSTS: 'posts' = CONTENT_SUBDIRS[2];

// ─── Root detection ───────────────────────────────────────────────────────────

export function findPatinaRoot(cwd: string): string | null {
  return existsSync(join(cwd, 'profile.yaml')) ? cwd : null;
}

// ─── File utilities ───────────────────────────────────────────────────────────

export function listMarkdownFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listMarkdownFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      results.push(fullPath);
    }
  }
  return results;
}

function toRelForward(root: string, abs: string): string {
  return relative(root, abs).split(sep).join('/');
}

// ─── Wiki-link extraction ─────────────────────────────────────────────────────

export function extractWikiLinks(content: string): Array<{ target: string; line: number }> {
  // Strip fenced code blocks (``` and ~~~) before matching
  const stripped = content
    .replace(/```[\s\S]*?```/g, (match) => '\n'.repeat((match.match(/\n/g) ?? []).length))
    .replace(/~~~[\s\S]*?~~~/g, (match) => '\n'.repeat((match.match(/\n/g) ?? []).length));

  const results: Array<{ target: string; line: number }> = [];
  const regex = /\[\[([^\]]+)\]\]/g;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(stripped)) !== null) {
    const raw = match[1];
    // Strip alias (|) and heading (#)
    const pipeIdx = raw.indexOf('|');
    const hashIdx = raw.indexOf('#');
    let end = raw.length;
    if (pipeIdx !== -1) end = Math.min(end, pipeIdx);
    if (hashIdx !== -1) end = Math.min(end, hashIdx);
    const target = raw.slice(0, end).trim();
    if (!target) continue;

    // Count newlines before match index for 1-based line number
    const before = stripped.slice(0, match.index);
    const line = (before.match(/\n/g) ?? []).length + 1;
    results.push({ target, line });
  }

  return results;
}

// ─── Exclusions parsing ───────────────────────────────────────────────────────

export function parseExclusions(markdown: string): string[] {
  const lines = markdown.split('\n');
  let headerFound = false;
  const items: string[] = [];

  for (const line of lines) {
    if (!headerFound) {
      if (line.includes('| Item') || line.includes('|Item')) {
        headerFound = true;
      }
      continue;
    }
    // Skip separator row
    if (/^\s*\|[\s\-|]+\|\s*$/.test(line)) continue;
    // Data rows
    if (line.trim().startsWith('|')) {
      const cells = line.split('|').map(c => c.trim());
      // cells[0] is empty (before first |), cells[1] is Item column
      const item = cells[1] ?? '';
      if (item) items.push(item);
    }
  }

  // Deduplicate
  return [...new Set(items)];
}

// ─── Checks ───────────────────────────────────────────────────────────────────

export function checkSkillNotes(root: string, profile: Profile): ValidationIssue[] {
  const contentDir = join(root, profile.content_dir ?? 'graph');
  const notesDir = join(contentDir, NOTES);
  const skillsDir = join(contentDir, SKILLS);

  const noteFiles = listMarkdownFiles(notesDir);
  const noteSlugs = new Set(noteFiles.map(f => basename(f, '.md')));

  const issues: ValidationIssue[] = [];

  for (const skillFile of listMarkdownFiles(skillsDir)) {
    const content = readFileSync(skillFile, 'utf8');
    const links = extractWikiLinks(content);
    for (const { target, line } of links) {
      if (!noteSlugs.has(target)) {
        issues.push({
          check: 'skill-notes' as ValidationCheckId,
          file: toRelForward(root, skillFile),
          line,
          message: `Skill links to a note that doesn't exist: "${target}"`,
        });
      }
    }
  }

  return issues;
}

export function checkWikiLinks(root: string, profile: Profile): ValidationIssue[] {
  const contentDir = join(root, profile.content_dir ?? 'graph');
  const notesDir = join(contentDir, NOTES);
  const postsDir = join(contentDir, POSTS);

  const noteFiles = listMarkdownFiles(notesDir);
  const noteSlugs = new Set(noteFiles.map(f => basename(f, '.md')));

  const issues: ValidationIssue[] = [];

  // Scan notes and posts — NOT skills (those are handled by checkSkillNotes)
  const filesToScan = [
    ...listMarkdownFiles(notesDir),
    ...listMarkdownFiles(postsDir),
  ];

  for (const file of filesToScan) {
    const content = readFileSync(file, 'utf8');
    const links = extractWikiLinks(content);
    for (const { target, line } of links) {
      if (!noteSlugs.has(target)) {
        issues.push({
          check: 'wiki-links' as ValidationCheckId,
          file: toRelForward(root, file),
          line,
          message: `Reference points to a note that doesn't exist: "${target}"`,
        });
      }
    }
  }

  return issues;
}

export function checkExclusions(root: string, profile: Profile): ValidationIssue[] {
  const contentDir = join(root, profile.content_dir ?? 'graph');
  const notesDir = join(contentDir, NOTES);
  const exclusionsPath = join(notesDir, 'exclusions.md');

  if (!existsSync(exclusionsPath)) return [];

  const content = readFileSync(exclusionsPath, 'utf8');
  const items = parseExclusions(content);
  if (items.length === 0) return [];

  const skillsDir = join(contentDir, SKILLS);
  const postsDir = join(contentDir, POSTS);

  // Scan skills and posts — NOT notes (exclusions.md lives there)
  const filesToScan = [
    ...listMarkdownFiles(skillsDir),
    ...listMarkdownFiles(postsDir),
  ];

  const issues: ValidationIssue[] = [];
  const seen = new Set<string>();

  for (const file of filesToScan) {
    const fileContent = readFileSync(file, 'utf8');
    const lines = fileContent.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i];
      const lineNum = i + 1;
      for (const item of items) {
        if (lineText.includes(item)) {
          const key = `${file}:${lineNum}:${item}`;
          if (!seen.has(key)) {
            seen.add(key);
            issues.push({
              check: 'exclusions' as ValidationCheckId,
              file: toRelForward(root, file),
              line: lineNum,
              message: `Contains an excluded item ("${item}") that should not appear in generated content`,
            });
          }
        }
      }
    }
  }

  return issues;
}

// ─── Module wiki-link check ───────────────────────────────────────────────────

export function checkModuleWikiLinks(root: string, profile: Profile): ValidationIssue[] {
  const contentDir = join(root, profile.content_dir ?? 'graph');
  const notesDir = join(contentDir, NOTES);
  const skillsDir = join(contentDir, SKILLS);
  const postsDir = join(contentDir, POSTS);

  const noteFiles = listMarkdownFiles(notesDir);
  const noteSlugs = new Set(noteFiles.map(f => basename(f, '.md')));

  // Stub vars — contentFiles() uses contentDir directly, not template vars
  const stubVars = new Proxy({} as Record<string, string>, { get: () => '' });

  const issues: ValidationIssue[] = [];

  for (const moduleId of profile.modules ?? []) {
    const mod = getModule(moduleId);
    if (!mod) continue;

    // Derive content dirs from the paths contentFiles() returns.
    // Exclude .gitkeep sentinels (they mark empty dirs and aren't real content).
    // Normalize with resolve() for cross-platform path comparison.
    const entries = mod.contentFiles(stubVars as never, contentDir);
    const moduleDirs = [...new Set(
      entries.filter(([p]) => !p.endsWith('.gitkeep')).map(([p]) => dirname(resolve(p)))
    )];
    const coreNotes = resolve(notesDir);
    const coreSkills = resolve(skillsDir);
    const corePosts = resolve(postsDir);

    for (const dir of moduleDirs) {
      // Skip dirs already covered by core checks to avoid double-reporting
      if (dir === coreNotes || dir === coreSkills || dir === corePosts) continue;

      for (const file of listMarkdownFiles(dir)) {
        const content = readFileSync(file, 'utf8');
        const links = extractWikiLinks(content);
        for (const { target, line } of links) {
          if (!noteSlugs.has(target)) {
            issues.push({
              check: 'module-wiki-links' as ValidationCheckId,
              file: toRelForward(root, file),
              line,
              message: `Module content links to a note that doesn't exist: "${target}"`,
            });
          }
        }
      }
    }
  }

  return issues;
}

// ─── Managed-file health check ────────────────────────────────────────────────

function corruptionToIssue(f: CorruptionFinding): ValidationIssue {
  switch (f.kind) {
    case 'placeholders':
      return {
        check: 'managed-file-placeholders' as ValidationCheckId,
        file: f.file,
        message: `Unrendered template placeholders: ${f.detail}`,
      };
    default:
      f.kind satisfies never;
      throw new Error(`Unknown corruption kind: ${f.kind}`);
  }
}

export function checkManagedFileHealth(root: string, profile: Profile): ValidationIssue[] {
  const report = detectCorruption(root, profile);
  return report.findings.map(corruptionToIssue);
}

// ─── Main validate ────────────────────────────────────────────────────────────

export function validate(root: string, profile: Profile): ValidationResult {
  const skillNotesIssues = checkSkillNotes(root, profile);
  const wikiLinkIssues = checkWikiLinks(root, profile);
  const exclusionIssues = checkExclusions(root, profile);
  const moduleWikiIssues = checkModuleWikiLinks(root, profile);
  const managedFileIssues = checkManagedFileHealth(root, profile);

  const allIssues = [...skillNotesIssues, ...wikiLinkIssues, ...exclusionIssues, ...moduleWikiIssues, ...managedFileIssues];
  allIssues.sort((a, b) => {
    if (a.file < b.file) return -1;
    if (a.file > b.file) return 1;
    return (a.line ?? 0) - (b.line ?? 0);
  });

  // Count distinct files scanned
  const contentDir = join(root, profile.content_dir ?? 'graph');
  const stubVars = new Proxy({} as Record<string, string>, { get: () => '' });
  const scannedFiles = new Set<string>([
    ...listMarkdownFiles(join(contentDir, NOTES)),
    ...listMarkdownFiles(join(contentDir, SKILLS)),
    ...listMarkdownFiles(join(contentDir, POSTS)),
  ]);

  // Add module content files
  for (const moduleId of profile.modules ?? []) {
    const mod = getModule(moduleId);
    if (!mod) continue;
    const entries = mod.contentFiles(stubVars as never, contentDir);
    const moduleDirs = [...new Set(
      entries.filter(([p]) => !p.endsWith('.gitkeep')).map(([p]) => dirname(resolve(p)))
    )];
    for (const dir of moduleDirs) {
      for (const file of listMarkdownFiles(dir)) {
        scannedFiles.add(file);
      }
    }
  }

  return {
    ok: allIssues.length === 0,
    issues: allIssues,
    filesChecked: scannedFiles.size,
  };
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatReport(result: ValidationResult): string {
  if (result.ok) {
    return `Healthy — checked ${result.filesChecked} files, no problems found.`;
  }

  const lines: string[] = [];
  for (const issue of result.issues) {
    const loc = issue.line !== undefined ? `${issue.file}:${issue.line}` : issue.file;
    lines.push(`${loc}  ${issue.message}`);
  }

  // Count distinct files with issues
  const filesWithIssues = new Set(result.issues.map(i => i.file)).size;
  lines.push(`Found ${result.issues.length} problem${result.issues.length === 1 ? '' : 's'} in ${filesWithIssues} file${filesWithIssues === 1 ? '' : 's'}.`);

  return lines.join('\n');
}

export function formatReportJson(result: ValidationResult): string {
  return JSON.stringify(result) + '\n';
}
