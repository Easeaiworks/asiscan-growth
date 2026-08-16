#!/usr/bin/env node
/**
 * Composes the LinkedIn company-page post for a published article.
 *
 * Two modes, both verified by fact-guard before anything is written:
 *   template  deterministic, assembled from the post's own frontmatter and the
 *             scan data. No model involved. Cheapest and safest.
 *   llm       a model drafts the hook; if it fails verification twice we fall
 *             back to the template. Never publishes unverified copy.
 *
 * Output: data/social-queue.json (appended). publish-social.mjs drains it.
 *
 * Usage: node scripts/compose-social.mjs --slug <slug> [--mode template|llm]
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { brand, path, today, isPaused } from './lib/config.mjs';
import { complete } from './lib/anthropic.mjs';
import { check } from './lib/fact-guard.mjs';

const args = process.argv.slice(2);
const SLUG = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
const MODE = (args.includes('--mode') ? args[args.indexOf('--mode') + 1] : process.env.SOCIAL_MODE) || 'llm';

function frontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const out = {};
  if (!m) return out;
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.+)$/);
    if (kv) out[kv[1]] = kv[2].replace(/^["']|["']$/g, '').trim();
  }
  return out;
}

/** First substantive paragraph of the body, stripped of markdown. */
function lede(src) {
  const body = src.replace(/^---[\s\S]*?---\r?\n/, '');
  for (const block of body.split(/\n\s*\n/)) {
    const t = block.trim();
    if (!t || t.startsWith('#') || t.startsWith('```') || t.startsWith('>')) continue;
    return t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
  }
  return '';
}

/**
 * Pull a statistic from the scan data, preferring the rule the post is about.
 * A post on ASI09 should not open with an ASI07 number.
 */
function corpusHeadline(preferRuleId) {
  const p = path('data', 'corpus-findings.json');
  if (!existsSync(p)) return null;
  const d = JSON.parse(readFileSync(p, 'utf8'));
  if (!d.summary?.reposScanned || !d.rulePrevalence?.length) return null;

  const pick =
    (preferRuleId && d.rulePrevalence.find((r) => r.ruleId === preferRuleId)) ||
    d.rulePrevalence[0];
  if (!pick) return null;

  return {
    text: `${pick.reposAffected} of the ${d.summary.reposScanned} open-source AI agent repositories I scan showed ${pick.ruleId} — ${pick.title.toLowerCase()}.`,
    ruleId: pick.ruleId,
    onTopic: pick.ruleId === preferRuleId,
  };
}

/** Rule ID this post is about, inferred from slug or tags. */
function postRuleId(slug, fm) {
  const hay = `${slug} ${fm.title || ''} ${fm.tags || ''}`.toUpperCase();
  const m = hay.match(/\b(ASI\d{2}|LLM\d{2}|EUAIA-\d{2})\b/);
  return m ? m[1] : null;
}

function templatePost({ fm, url, first, ruleId }) {
  const stat = corpusHeadline(ruleId);
  // Only lead with a statistic if it is about the thing the post is about.
  // Otherwise the first sentence of the article is a better opener than a
  // number that has nothing to do with it.
  const opener = stat?.onTopic ? stat.text : first.split(/(?<=[.!?])\s/)[0];
  return [
    opener,
    '',
    fm.description,
    '',
    `Full write-up: ${url}`,
    '',
    '#AIsecurity #OWASP #AIagents',
  ].join('\n').trim();
}

const SYSTEM = `You write short LinkedIn company-page posts for ${brand.product.name}, a static-analysis tool for AI agent codebases.

You are writing as the engineer who built it. Constraints, enforced by an automated verifier:
- 80 to 180 words. No emoji. Maximum three hashtags, at the end.
- Every number must come from the supplied material. Never introduce a figure.
- No OWASP endorsement or certification implications. No compliance guarantees.
- No engagement bait, no "thoughts?", no line break after every sentence.
- Open with the specific finding, not with context-setting.
- End with the link on its own line, then hashtags.
Output the post text only. No commentary, no quotes around it.`;

async function llmPost({ fm, url, first, ruleId }) {
  const stat = corpusHeadline(ruleId);
  const prompt = `Article title: ${fm.title}
Article description: ${fm.description}
Opening paragraph of the article:
${first}

${stat ? `A measured statistic you may use${stat.onTopic ? '' : ' (note: this statistic is about a different rule than the article, so use it only if it genuinely fits)'}: ${stat.text}` : 'No scan statistics are available — do not cite any statistic.'}

Link to include: ${url}

Write the LinkedIn post.`;

  let errors = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const { text } = await complete({
      system: SYSTEM,
      prompt: errors ? `${prompt}\n\nYour previous attempt was rejected by the verifier for:\n${errors.map((e) => '- ' + e).join('\n')}\nRewrite it so these cannot fire.` : prompt,
      maxTokens: 700,
      temperature: attempt === 1 ? 0.8 : 0.4,
    });
    const post = text.replace(/^["']|["']$/g, '').trim();
    const res = check(post, { kind: 'social' });
    if (res.ok) return post;
    errors = res.errors;
    console.error(`LLM social draft rejected: ${errors.join('; ')}`);
  }
  return null;
}

async function main() {
  const paused = isPaused();
  if (paused) {
    console.error(`Publishing paused: ${paused}`);
    process.exit(78);
  }
  if (!SLUG) throw new Error('--slug is required');

  const src = readFileSync(path('content', 'published', `${SLUG}.md`), 'utf8');
  const fm = frontmatter(src);
  const url = `${brand.site.origin}${brand.site.blogPath}/${SLUG}`;
  const first = lede(src);

  const ruleId = postRuleId(SLUG, fm);

  let post = null;
  if (MODE === 'llm') post = await llmPost({ fm, url, first, ruleId });
  if (!post) {
    post = templatePost({ fm, url, first, ruleId });
    const res = check(post, { kind: 'social' });
    if (!res.ok) {
      console.error(`Template post also failed verification:\n${res.errors.join('\n')}`);
      process.exit(1);
    }
    console.error('Using deterministic template post.');
  }

  mkdirSync(path('data'), { recursive: true });
  const qPath = path('data', 'social-queue.json');
  const queue = existsSync(qPath) ? JSON.parse(readFileSync(qPath, 'utf8')) : [];
  queue.push({
    id: `${SLUG}-${today()}`,
    slug: SLUG,
    url,
    text: post,
    composedOn: today(),
    mode: MODE,
    status: 'queued',
  });
  writeFileSync(qPath, JSON.stringify(queue, null, 2) + '\n');

  console.error(`Queued LinkedIn post for ${SLUG}:\n\n${post}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
