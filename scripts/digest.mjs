#!/usr/bin/env node
/**
 * Weekly digest. Opens (or updates) a GitHub issue summarising what the system
 * did, what it blocked, and anything that needs a human. This is the entire
 * surface area you have to look at — designed to be readable on a phone in
 * under a minute.
 *
 * Also fetches Vercel Web Analytics if VERCEL_TOKEN and VERCEL_PROJECT_ID are
 * set, so traffic sits next to the publishing record.
 *
 * Usage: node scripts/digest.mjs [--stdout]
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { brand, readJson, path, today } from './lib/config.mjs';

const STDOUT_ONLY = process.argv.includes('--stdout');

function read(p, fallback) {
  const full = path(...p);
  return existsSync(full) ? JSON.parse(readFileSync(full, 'utf8')) : fallback;
}

function daysBetween(a, b) {
  return Math.round((new Date(a) - new Date(b)) / 86400000);
}

async function vercelAnalytics() {
  const token = process.env.VERCEL_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;
  if (!token || !projectId) return null;

  const until = new Date();
  const since = new Date(until.getTime() - 7 * 86400000);
  const qs = new URLSearchParams({
    projectId,
    since: since.toISOString(),
    until: until.toISOString(),
    ...(teamId ? { teamId } : {}),
  });
  try {
    const res = await fetch(`https://vercel.com/api/web-analytics/timeseries?${qs}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function main() {
  const topics = readJson('content/topics.json');
  const published = topics.topics.filter((t) => t.status === 'published');
  const pending = topics.topics.filter((t) => t.status === 'pending');
  const social = read(['data', 'social-queue.json'], []);
  const corpus = read(['data', 'corpus-findings.json'], null);
  const history = read(['data', 'corpus-history.json'], []);

  const rejectedDir = path('content', 'rejected');
  const rejected = existsSync(rejectedDir)
    ? readdirSync(rejectedDir).filter((f) => f.endsWith('.md'))
    : [];

  const recentPublished = published.filter((t) => daysBetween(today(), t.publishedOn || '1970-01-01') <= 7);
  const recentSocial = social.filter((s) => s.publishedOn && daysBetween(today(), s.publishedOn) <= 7);
  const blocked = social.filter((s) => s.status === 'blocked' || s.status === 'failed');

  const analytics = await vercelAnalytics();

  const lines = [];
  lines.push(`## ${brand.product.name} — week ending ${today()}`);
  lines.push('');

  lines.push('### Shipped');
  if (recentPublished.length) {
    for (const t of recentPublished) {
      lines.push(`- **${t.title}** → ${brand.site.origin}${brand.site.blogPath}/${t.slug}`);
    }
  } else {
    lines.push('- Nothing published this week.');
  }
  for (const s of recentSocial) lines.push(`- LinkedIn: \`${s.slug}\``);
  lines.push('');

  if (blocked.length || rejected.length) {
    lines.push('### Needs a look');
    for (const f of rejected) lines.push(`- Draft rejected by fact-guard: \`content/rejected/${f}\``);
    for (const s of blocked) lines.push(`- Social \`${s.id}\` ${s.status}: ${s.error}`);
    lines.push('');
  }

  lines.push('### Pipeline');
  lines.push(`- ${published.length} published, ${pending.length} topics remaining (~${Math.floor(pending.length)} weeks of runway).`);
  if (pending.length <= 4) {
    lines.push(`- **Topic queue is running low.** Add entries to \`content/topics.json\`.`);
  }
  lines.push('');

  if (corpus) {
    lines.push('### Research corpus');
    lines.push(
      `- Last scan ${corpus.date}: ${corpus.summary.reposScanned} repositories, ` +
        `${corpus.summary.filesScanned} files, ${corpus.summary.totalFindings} findings.`
    );
    const top = corpus.rulePrevalence.slice(0, 3);
    for (const r of top) {
      const pct = Math.round((r.reposAffected / corpus.summary.reposScanned) * 100);
      lines.push(`- ${r.ruleId} present in ${r.reposAffected}/${corpus.summary.reposScanned} (${pct}%)`);
    }
    if (corpus.failed?.length) {
      lines.push(`- ${corpus.failed.length} repositories failed to scan.`);
    }
    if (history.length >= 2) {
      const prev = history[history.length - 2];
      const now = history[history.length - 1];
      lines.push(`- Change since ${prev.date}: ${now.totalFindings - prev.totalFindings} findings.`);
    }
    lines.push('');
  }

  if (analytics) {
    lines.push('### Traffic (7 days)');
    lines.push('```json');
    lines.push(JSON.stringify(analytics).slice(0, 900));
    lines.push('```');
    lines.push('');
  }

  const tokenExp = process.env.LINKEDIN_REFRESH_EXPIRES_ON;
  if (tokenExp) {
    const days = daysBetween(tokenExp, today());
    if (days <= 30) {
      lines.push(`### Action required`);
      lines.push(`- LinkedIn refresh token expires in ${days} days. Re-authorise the app once.`);
      lines.push('');
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('To stop all publishing immediately: commit an empty file named `PAUSE` at the repository root, or set the repository variable `PAUSE_PUBLISHING` to `true`.');

  const body = lines.join('\n');

  if (STDOUT_ONLY || !process.env.GITHUB_TOKEN || !process.env.GITHUB_REPOSITORY) {
    process.stdout.write(body + '\n');
    return;
  }

  const res = await fetch(
    `https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/issues`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        title: `Growth digest — ${today()}`,
        body,
        labels: ['digest'],
      }),
    }
  );
  if (!res.ok) {
    console.error(`Could not open digest issue: ${res.status} ${await res.text()}`);
    process.stdout.write(body + '\n');
    return;
  }
  const issue = await res.json();
  console.error(`Digest opened: ${issue.html_url}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
