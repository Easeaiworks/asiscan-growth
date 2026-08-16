#!/usr/bin/env node
/**
 * Runs fact-guard over every published post and every queued social post.
 * Used as a pull-request gate so a hand-edited post cannot bypass the checks
 * the generator is subject to.
 *
 * Usage: node scripts/guard-cli.mjs [file ...]
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { path } from './lib/config.mjs';
import { check } from './lib/fact-guard.mjs';

const explicit = process.argv.slice(2);
let failures = 0;
let checked = 0;

function report(label, result) {
  checked++;
  for (const w of result.warnings) console.error(`  warning  ${label}: ${w}`);
  if (result.ok) {
    console.error(`  ok       ${label}`);
    return;
  }
  failures++;
  console.error(`  FAIL     ${label}`);
  for (const e of result.errors) console.error(`             - ${e}`);
}

const files = explicit.length
  ? explicit
  : existsSync(path('content', 'published'))
    ? readdirSync(path('content', 'published'))
        .filter((f) => f.endsWith('.md'))
        .map((f) => path('content', 'published', f))
    : [];

console.error('Blog posts:');
if (!files.length) console.error('  (none)');
for (const f of files) {
  report(f.split('/').slice(-1)[0], check(readFileSync(f, 'utf8'), { kind: 'blog' }));
}

const q = path('data', 'social-queue.json');
if (existsSync(q)) {
  console.error('\nSocial queue:');
  for (const item of JSON.parse(readFileSync(q, 'utf8'))) {
    if (item.status === 'published') continue;
    report(item.id, check(item.text, { kind: 'social' }));
  }
}

console.error(`\n${checked} checked, ${failures} failed.`);
process.exit(failures ? 1 : 0);
