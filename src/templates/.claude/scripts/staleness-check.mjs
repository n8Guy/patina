// Patina staleness checker — run on session start via CLAUDE.md instructions.
// Outputs stale file slugs grouped by area, or an "all fresh" line.
// Produces no output when the patina has no content yet (fresh install).

import { readdirSync, statSync, existsSync } from 'fs';
import { join } from 'path';

const CONTENT_DIR = process.env.PATINA_MOCK_CONTENT_DIR ?? '{{CONTENT_DIR}}';
const THRESHOLD_DAYS = Number(process.env.PATINA_MOCK_THRESHOLD_DAYS ?? '{{STALENESS_THRESHOLD}}');
if (!Number.isFinite(THRESHOLD_DAYS) || THRESHOLD_DAYS <= 0) process.exit(0);
const SKIP = new Set(['README.md', 'exclusions.md']);
const shouldSkip = (f) => f.startsWith('.') || SKIP.has(f);

const cutoff = new Date(Date.now() - THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

function listFiles(dir) {
  const full = join(CONTENT_DIR, dir);
  if (!existsSync(full)) return [];
  try { return readdirSync(full).filter(f => !shouldSkip(f)); } catch { return []; }
}

const areas = ['notes', 'skills', 'posts'];

// Fresh patina — no real content yet. Produce no output so CLAUDE.md skips the report.
if (!areas.some(dir => listFiles(dir).length > 0)) process.exit(0);

function staleIn(dir) {
  const full = join(CONTENT_DIR, dir);
  if (!existsSync(full)) return [];
  try {
    return readdirSync(full)
      .filter(f => !shouldSkip(f))
      .filter(f => { try { return statSync(join(full, f)).mtime < cutoff; } catch { return false; } })
      .map(f => f.replace(/\.[^.]+$/, ''));
  } catch { return []; }
}

const labels = { notes: 'Notes', skills: 'Skills', posts: 'Posts' };
const stale = areas
  .map(dir => ({ label: labels[dir], slugs: staleIn(dir) }))
  .filter(({ slugs }) => slugs.length > 0);

if (stale.length === 0) {
  process.stdout.write(`All content is fresh (nothing older than ${THRESHOLD_DAYS} days).\n`);
} else {
  process.stdout.write(stale.map(({ label, slugs }) => `${label}: ${slugs.join(', ')}`).join('\n') + '\n');
}
