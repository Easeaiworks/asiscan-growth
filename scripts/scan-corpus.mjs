#!/usr/bin/env node
/**
 * THE DATA ENGINE
 * ---------------
 * Clones the research corpus, runs the scanner over every repository, and
 * aggregates the results into data/corpus-findings.json.
 *
 * Everything downstream — blog posts, LinkedIn copy, the annual report — draws
 * its numbers from this file. That is what makes unattended publishing safe:
 * the statistics are measured, not generated.
 *
 * Usage:
 *   node scripts/scan-corpus.mjs                 # full corpus
 *   node scripts/scan-corpus.mjs --limit 5       # quick run
 *   node scripts/scan-corpus.mjs --repo owner/x  # single repo
 *
 * Env:
 *   SCANNER_CMD   command that runs the scanner (default: npx --yes asiscan-cli@latest)
 *   SCANNER_PATH  path to a local built CLI, overrides SCANNER_CMD
 *   WORKDIR       clone directory (default: .corpus-cache)
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { readJson, path, today } from './lib/config.mjs';

const exec = promisify(execFile);
const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(n);
  return i === -1 ? d : args[i + 1];
};

const WORKDIR = resolve(process.env.WORKDIR || path('.corpus-cache'));
const LIMIT = Number(flag('--limit', '0')) || 0;
const ONLY = flag('--repo', null);
const KEEP = args.includes('--keep');

// Two deliberate choices here, both worked out the hard way.
//
// --output <file> rather than reading stdout: the CLI calls process.exit()
// immediately after writing its report, which truncates a large piped stdout
// buffer before it drains. Repositories with the most findings are exactly the
// ones that come back as unparseable half-JSON. Writing to a file sidesteps it.
//
// --fail-on none: a research run wants data, not a CI gate. A non-zero exit
// here means "the scan broke", which is a much more useful signal.
function scannerArgs(target, outFile) {
  return [target, '--format', 'json', '--fail-on', 'none', '--output', outFile];
}

function scannerCommand(target, outFile) {
  if (process.env.SCANNER_PATH) {
    return ['node', [process.env.SCANNER_PATH, ...scannerArgs(target, outFile)]];
  }
  const cmd = (process.env.SCANNER_CMD || 'npx --yes asiscan-cli@latest').split(' ');
  return [cmd[0], [...cmd.slice(1), ...scannerArgs(target, outFile)]];
}

async function run(cmd, argv, opts = {}) {
  return exec(cmd, argv, { maxBuffer: 64 * 1024 * 1024, ...opts });
}

async function cloneRepo(slug) {
  const dir = resolve(WORKDIR, slug.replace('/', '__'));
  if (existsSync(dir)) {
    try {
      await run('git', ['-C', dir, 'fetch', '--depth', '1', 'origin']);
      await run('git', ['-C', dir, 'reset', '--hard', 'FETCH_HEAD']);
      return dir;
    } catch {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  await run('git', [
    'clone', '--depth', '1', '--filter=blob:none', '--quiet',
    `https://github.com/${slug}.git`, dir,
  ]);
  return dir;
}

async function scanRepo(dir) {
  const outFile = resolve(WORKDIR, `.scan-${Buffer.from(dir).toString('base64url').slice(-24)}.json`);
  const [cmd, argv] = scannerCommand(dir, outFile);
  try {
    await run(cmd, argv);
  } catch (err) {
    // A non-zero exit is only fatal if no report was produced.
    if (!existsSync(outFile)) throw err;
  }
  if (!existsSync(outFile)) throw new Error('Scanner produced no report file.');
  try {
    return JSON.parse(readFileSync(outFile, 'utf8'));
  } finally {
    rmSync(outFile, { force: true });
  }
}

function emptyRule(ruleId, meta = {}) {
  return {
    ruleId,
    title: meta.title || ruleId,
    severity: meta.severity || 'unknown',
    framework: ruleId.startsWith('ASI') ? 'OWASP ASI'
      : ruleId.startsWith('LLM') ? 'OWASP LLM'
      : 'EU AI Act Art. 50',
    reposAffected: 0,
    findings: 0,
    repoTags: {},
    // Findings per repository, used to compute concentration below and then
    // dropped: the published file carries aggregates only.
    _byRepo: {},
  };
}

async function main() {
  const { repos } = readJson('corpus/repos.json');
  let list = ONLY ? repos.filter((r) => r.slug === ONLY) : repos;
  if (LIMIT) list = list.slice(0, LIMIT);
  if (!list.length) throw new Error('No repositories selected.');

  mkdirSync(WORKDIR, { recursive: true });
  mkdirSync(path('data'), { recursive: true });

  const rules = new Map();
  const perRepo = [];
  const failed = [];
  let filesScanned = 0;
  let totalFindings = 0;

  for (const [i, repo] of list.entries()) {
    process.stderr.write(`[${i + 1}/${list.length}] ${repo.slug} … `);
    try {
      const dir = await cloneRepo(repo.slug);
      const result = await scanRepo(dir);

      const findings = result.findings || result.results || [];
      const files = result.summary?.filesScanned ?? result.filesScanned ?? 0;
      filesScanned += files;
      totalFindings += findings.length;

      const seenHere = new Set();
      for (const f of findings) {
        const id = f.ruleId || f.rule || 'UNKNOWN';
        if (!rules.has(id)) rules.set(id, emptyRule(id, f));
        const r = rules.get(id);
        r.findings += 1;
        r._byRepo[repo.slug] = (r._byRepo[repo.slug] || 0) + 1;
        if (!seenHere.has(id)) {
          seenHere.add(id);
          r.reposAffected += 1;
          r.repoTags[repo.tag] = (r.repoTags[repo.tag] || 0) + 1;
        }
        if (f.title && r.title === id) r.title = f.title;
        if (f.severity && r.severity === 'unknown') r.severity = f.severity;
      }

      perRepo.push({
        slug: repo.slug,
        tag: repo.tag,
        lang: repo.lang,
        filesScanned: files,
        durationMs: result.summary?.durationMs ?? null,
        findings: findings.length,
        rulesTriggered: [...seenHere].sort(),
      });
      process.stderr.write(`${findings.length} findings across ${files} files\n`);

      // Free the clone immediately. Scanning fifty repositories otherwise needs
      // tens of gigabytes of runner disk at once.
      if (!KEEP) rmSync(dir, { recursive: true, force: true });
    } catch (err) {
      failed.push({ slug: repo.slug, error: String(err.message || err).slice(0, 300) });
      process.stderr.write(`FAILED (${String(err.message || err).slice(0, 80)})\n`);
    }
  }

  const reposScanned = perRepo.length;
  // Concentration: the share of a rule's findings that come from its single
  // largest contributor. A total dominated by one repository says something
  // about that repository (or about a false-positive class), not about the
  // ecosystem -- content must cite repository counts for such rules.
  for (const r of rules.values()) {
    const top = Math.max(0, ...Object.values(r._byRepo));
    r.topRepoSharePct = r.findings ? Math.round((top / r.findings) * 100) : 0;
    delete r._byRepo;
  }

  const rulePrevalence = [...rules.values()].sort(
    (a, b) => b.reposAffected - a.reposAffected || b.findings - a.findings
  );

  const byTag = {};
  for (const r of perRepo) {
    byTag[r.tag] ??= { repos: 0, findings: 0 };
    byTag[r.tag].repos += 1;
    byTag[r.tag].findings += r.findings;
  }

  const out = {
    generatedAt: new Date().toISOString(),
    date: today(),
    summary: {
      reposScanned,
      reposFailed: failed.length,
      filesScanned,
      totalFindings,
      medianFindingsPerRepo: median(perRepo.map((r) => r.findings)),
      reposWithZeroFindings: perRepo.filter((r) => r.findings === 0).length,
    },
    rulePrevalence,
    byTag,
    perRepo,
    failed,
    methodology: {
      scannerVersion: await scannerVersion(),
      scanner: process.env.SCANNER_PATH ? 'local build' : (process.env.SCANNER_CMD || 'npx --yes asiscan-cli@latest'),
      cloneDepth: 1,
      note:
        'Findings are static-analysis signals, not confirmed vulnerabilities. ' +
        'Framework repositories will legitimately show control-probe findings for ' +
        'application-level controls that are the caller\'s responsibility. ' +
        'Publish aggregates only; never name individual repositories as insecure.',
    },
  };

  // Trend history — enables "this changed since last quarter" content.
  const histPath = path('data', 'corpus-history.json');
  const history = existsSync(histPath) ? JSON.parse(readFileSync(histPath, 'utf8')) : [];
  history.push({
    date: out.date,
    reposScanned,
    filesScanned,
    totalFindings,
    top: rulePrevalence.slice(0, 5).map((r) => ({ ruleId: r.ruleId, reposAffected: r.reposAffected })),
  });
  writeFileSync(histPath, JSON.stringify(history.slice(-40), null, 2) + '\n');

  writeFileSync(path('data', 'corpus-findings.json'), JSON.stringify(out, null, 2) + '\n');

  if (!KEEP) rmSync(WORKDIR, { recursive: true, force: true });

  process.stderr.write(
    `\nScanned ${reposScanned} repositories, ${filesScanned} files, ` +
      `${totalFindings} findings. ${failed.length} failed.\n` +
      `Wrote data/corpus-findings.json\n`
  );
}

async function scannerVersion() {
  try {
    const [cmd, argv] = process.env.SCANNER_PATH
      ? ['node', [process.env.SCANNER_PATH, '--version']]
      : (() => { const c = (process.env.SCANNER_CMD || 'npx --yes asiscan-cli@latest').split(' '); return [c[0], [...c.slice(1), '--version']]; })();
    const { stdout } = await run(cmd, argv);
    return stdout.trim().split(/\s+/).pop();
  } catch {
    return 'unknown';
  }
}

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
