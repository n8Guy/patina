// patina: managed
// Patina update checker — runs via UserPromptSubmit hook before each session message.
// Uses only Node.js built-ins (https, fs, url). No external dependencies.

import { readFileSync, writeFileSync } from 'fs';
import { request } from 'https';
import { fileURLToPath } from 'url';

const SENTINEL_FILE = '.patina-update-check';
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
const INSTALLED_VERSION = process.env.PATINA_MOCK_INSTALLED_VERSION ?? '{{PATINA_VERSION}}';
const REGISTRY_URL = 'https://registry.npmjs.org/my-patina/latest';

/**
 * Compare two semver strings (major.minor.patch).
 * Returns true if `a` is strictly greater than `b`.
 * Returns false if either string is not a valid semver.
 */
function isNewer(a, b) {
  const parse = (v) => {
    const parts = String(v).split('.').map(Number);
    if (parts.length !== 3 || parts.some(n => !Number.isFinite(n) || n < 0)) return null;
    return parts;
  };
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return false;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return true;
    if (pa[i] < pb[i]) return false;
  }
  return false;
}

export { isNewer };

/**
 * Returns true if a valid sentinel exists and its checked_at is within the TTL.
 * Any read/parse failure (missing file, old plain-string format, corrupt JSON,
 * missing/invalid checked_at) returns false → caller performs a fresh check.
 * This is the migration path: old-format sentinels fail JSON.parse and re-check.
 */
function checkedRecently() {
  try {
    const raw = readFileSync(SENTINEL_FILE, 'utf8');
    const data = JSON.parse(raw);
    const checkedAt = Date.parse(data.checked_at);
    if (!Number.isFinite(checkedAt)) return false;
    const age = Date.now() - checkedAt;
    return age >= 0 && age < CHECK_INTERVAL_MS;
  } catch {
    return false;
  }
}

function fetchLatestVersion() {
  if (process.env.PATINA_MOCK_LATEST_VERSION !== undefined) {
    return Promise.resolve(process.env.PATINA_MOCK_LATEST_VERSION);
  }
  if (process.env.PATINA_MOCK_FAIL) {
    return Promise.reject(new Error('mock network failure'));
  }
  return new Promise((resolve, reject) => {
    const req = request(REGISTRY_URL, { timeout: 5000 }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve(json.version);
        } catch {
          reject(new Error('Failed to parse registry response'));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
    req.on('error', reject);
    req.end();
  });
}

// Only run when executed directly (not when imported for testing).
if (fileURLToPath(import.meta.url) === process.argv[1]) {
  // Skip the network call if we checked within the TTL. Any parse/format/age
  // failure falls through to a fresh check (this auto-recovers old-format sentinels).
  if (checkedRecently()) {
    process.exit(0);
  }

  try {
    const latestVersion = await fetchLatestVersion();
    const availableVersion = isNewer(latestVersion, INSTALLED_VERSION) ? latestVersion : null;
    const sentinel = {
      _comment:
        'Patina update-check sentinel. Auto-managed by .claude/scripts/check-update.mjs. ' +
        'checked_at is the ISO 8601 time of the last npm registry check; available_version is ' +
        'the newer version found (null when up to date). The checker re-runs automatically once ' +
        'checked_at is older than 24h. Safe to delete.',
      checked_at: new Date().toISOString(),
      available_version: availableVersion,
    };
    writeFileSync(SENTINEL_FILE, JSON.stringify(sentinel, null, 2) + '\n', 'utf8');
  } catch {
    // Network/parse error — exit silently without writing. The next prompt retries.
    process.exit(0);
  }
}
