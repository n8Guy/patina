// Patina update checker — runs via UserPromptSubmit hook before each session message.
// Uses only Node.js built-ins (https, fs). No external dependencies.

import { existsSync, writeFileSync } from 'fs';
import { request } from 'https';

const FLAG_FILE = '.patina-update-check';
const INSTALLED_VERSION = '{{PATINA_VERSION}}';
const REGISTRY_URL = 'https://registry.npmjs.org/my-patina/latest';

// Already ran this session — exit immediately without any network call.
if (existsSync(FLAG_FILE)) {
  process.exit(0);
}

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

function fetchLatestVersion() {
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

try {
  const latestVersion = await fetchLatestVersion();
  if (isNewer(latestVersion, INSTALLED_VERSION)) {
    // Write the latest version string — Claude will read this and notify the user.
    writeFileSync(FLAG_FILE, latestVersion, 'utf8');
  } else {
    // Already up to date — write empty sentinel to prevent re-check this session.
    writeFileSync(FLAG_FILE, '', 'utf8');
  }
} catch {
  // Any error (network, parse, etc.) — exit silently without writing flag file.
  // The next session message will retry.
  process.exit(0);
}
