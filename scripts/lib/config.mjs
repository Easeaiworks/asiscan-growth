import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(here, '..', '..');

/** Read a JSON file, stripping the `$comment` convention keys. */
export function readJson(relPath) {
  const full = resolve(ROOT, relPath);
  if (!existsSync(full)) throw new Error(`Missing config file: ${relPath}`);
  return JSON.parse(readFileSync(full, 'utf8'));
}

export const brand = readJson('config/brand.json');
export const claims = readJson('config/claims.json');

export function readText(relPath) {
  return readFileSync(resolve(ROOT, relPath), 'utf8');
}

export function path(...parts) {
  return resolve(ROOT, ...parts);
}

/**
 * Global kill switch. Any of these stops every publishing workflow dead:
 *   - a file named PAUSE at the repo root
 *   - the repository variable / env var PAUSE_PUBLISHING set to "true"
 * Checked by every workflow before it does anything irreversible.
 */
export function isPaused() {
  if (existsSync(path('PAUSE'))) return 'PAUSE file present at repository root';
  if (String(process.env.PAUSE_PUBLISHING).toLowerCase() === 'true') {
    return 'PAUSE_PUBLISHING variable is true';
  }
  return null;
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Required environment variable ${name} is not set.`);
  return v;
}

/** ISO date (UTC) — deterministic, no locale surprises in CI. */
export function today() {
  return new Date().toISOString().slice(0, 10);
}
