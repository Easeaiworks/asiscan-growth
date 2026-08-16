#!/usr/bin/env node
/** Prints a Markdown summary of the latest corpus scan, for the Actions job summary. */
import { readFileSync, existsSync } from 'node:fs';
import { path } from './lib/config.mjs';

const p = path('data', 'corpus-findings.json');
if (!existsSync(p)) {
  console.log('No corpus findings file.');
  process.exit(0);
}
const d = JSON.parse(readFileSync(p, 'utf8'));
const s = d.summary;

const lines = [
  `## Corpus scan ${d.date}`,
  '',
  `${s.reposScanned} repositories, ${s.filesScanned} files, ${s.totalFindings} findings. ` +
    `Median per repository: ${s.medianFindingsPerRepo}. Failed to scan: ${s.reposFailed}.`,
  '',
  '| Rule | Title | Repositories | Findings |',
  '|---|---|---|---|',
  ...d.rulePrevalence
    .slice(0, 18)
    .map((r) => `| ${r.ruleId} | ${r.title} | ${r.reposAffected}/${s.reposScanned} | ${r.findings} |`),
];

if (d.failed?.length) {
  lines.push('', '### Failed', ...d.failed.map((f) => `- \`${f.slug}\` — ${f.error}`));
}

console.log(lines.join('\n'));
