#!/usr/bin/env node
/**
 * Generates the next queued blog post, verifies it, and writes it to
 * content/published/. If verification fails after N attempts the post is NOT
 * published — it is written to content/rejected/ and the run reports a failure
 * so the workflow can open an issue.
 *
 * Failing closed is deliberate. A week with no post costs nothing. A week with
 * a wrong claim about a security framework costs the whole positioning.
 *
 * Usage:
 *   node scripts/generate-post.mjs [--slug my-topic] [--dry-run]
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { brand, claims, readText, readJson, path, today, isPaused } from './lib/config.mjs';
import { complete } from './lib/anthropic.mjs';
import { check } from './lib/fact-guard.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const WANT = args.includes('--slug') ? args[args.indexOf('--slug') + 1] : null;
const MAX_ATTEMPTS = 3;

function loadCorpus() {
  const p = path('data', 'corpus-findings.json');
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null;
}

function corpusBrief(corpus) {
  if (!corpus) {
    return 'NO SCAN DATA AVAILABLE. Do not state any statistic about open-source repositories in this post.';
  }
  const s = corpus.summary;
  const lines = [
    `Corpus scan of ${s.reposScanned} open-source AI agent repositories (${s.filesScanned} source files), run ${corpus.date}.`,
    `Total findings: ${s.totalFindings}. Median per repository: ${s.medianFindingsPerRepo}. Repositories with zero findings: ${s.reposWithZeroFindings}.`,
    '',
    'Rule prevalence (repositories affected out of ' + s.reposScanned + '):',
  ];
  for (const r of corpus.rulePrevalence.slice(0, 18)) {
    const pct = Math.round((r.reposAffected / s.reposScanned) * 100);
    lines.push(`  ${r.ruleId} ${r.title} — ${r.reposAffected}/${s.reposScanned} repositories (${pct}%), ${r.findings} findings, severity ${r.severity}`);
  }
  lines.push('', 'Methodology caveat that MUST be reflected honestly if you cite these numbers:');
  lines.push('  ' + corpus.methodology.note);
  return lines.join('\n');
}

function claimsBrief() {
  const lines = ['VERIFIED FACTS — these are the only product claims you may make:'];
  for (const c of claims.verified) {
    lines.push(`  [${c.id}] ${c.claim}. ${c.detail}`);
  }
  lines.push('', 'BLOCKED CLAIMS — never state these, in any wording:');
  for (const u of claims.unverified) {
    lines.push(`  [${u.id}] ${u.claim} — ${u.why}`);
  }
  return lines.join('\n');
}

const SYSTEM = `You write technical content for ${brand.product.name}, a static-analysis tool for AI agent codebases sold by ${brand.product.legalEntity}.

You are writing as the person who built the tool. You are not a marketing department and you must not sound like one.

Hard constraints, enforced by an automated verifier that will reject your output:

1. EVERY number you write must come from the supplied verified-facts list or the supplied scan data. You may compute a percentage from two supplied numbers. You may not introduce a figure from your own knowledge, and you may not estimate. If you want to say something is common and you have no number for it, say it qualitatively or leave it out.
2. Never claim or imply OWASP endorsement, certification, or affiliation.
3. Never claim the tool makes anyone compliant with any regulation. It produces evidence for human assessment. Use "readiness", "evidence", or "assessment".
4. Never name an individual open-source repository as insecure. Aggregate statistics only. A repository may be named only to illustrate a pattern that is easy to get wrong, framed neutrally.
5. State the tool's limitations in the body, not in a footnote. It is regex-based, not AST-based. It produces false positives. Do not state a current precision figure. If precision comes up, say it is being re-measured for the current release against a 50-repository corpus; the only figure you may cite is the historical August-build one in the verified-facts list, and only when clearly labelled as that build.
6. Include both required disclaimer sentences verbatim, in a short "Notes" section at the end, when the post touches OWASP or compliance topics.

Output format: a single Markdown document beginning with YAML frontmatter containing exactly these keys: title, description, date, slug, tags (a YAML list), and canonical. Nothing before the frontmatter, no commentary after the document.`;

function buildPrompt(topic, corpus, retryErrors) {
  const parts = [
    `# Voice guide\n\n${readText('config/voice.md')}`,
    `# ${claimsBrief()}`,
    `# Scan data\n\n${corpusBrief(corpus)}`,
    `# Brand\n\nProduct: ${brand.product.name}\nDomain: ${brand.site.origin}\nInstall command: ${brand.product.cliInvocation}\nTagline: ${brand.product.tagline}`,
    `# Required disclaimer sentences (use verbatim when triggered)\n\n- ${claims.requiredDisclaimers.owasp}\n- ${claims.requiredDisclaimers.compliance}`,
    `# The post to write

Slug: ${topic.slug}
Working title: ${topic.title}
Target length: ${topic.words || 1100} words
Primary keyword: ${topic.keyword || topic.title}
Secondary keywords: ${(topic.keywords || []).join(', ') || 'none specified'}
Canonical URL: ${brand.site.origin}${brand.site.blogPath}/${topic.slug}
Date: ${today()}

Brief:
${topic.brief}

Required structure:
${(topic.structure || [
  'What the risk actually is, in plain language',
  'A concrete failure with real code',
  'The same code done correctly',
  'How to detect it, including which rule covers it',
  'Mitigations',
  'Notes (limitations and disclaimers)',
]).map((s, i) => `${i + 1}. ${s}`).join('\n')}

End with exactly one call to action, one sentence, phrased as a next step.`,
  ];

  if (retryErrors?.length) {
    parts.push(
      `# YOUR PREVIOUS ATTEMPT WAS REJECTED\n\nThe automated verifier returned these errors. Fix every one of them. Do not argue with the verifier; rewrite the copy so the errors cannot fire.\n\n${retryErrors.map((e) => `- ${e}`).join('\n')}`
    );
  }

  return parts.join('\n\n---\n\n');
}

async function main() {
  const paused = isPaused();
  if (paused) {
    console.error(`Publishing paused: ${paused}`);
    process.exit(78); // EX_CONFIG — workflow treats this as a clean stop
  }

  const topics = readJson('content/topics.json');
  const topic = WANT
    ? topics.topics.find((t) => t.slug === WANT)
    : topics.topics.find((t) => t.status === 'pending');

  if (!topic) {
    console.error('No pending topics. Nothing to publish. This is not an error.');
    process.exit(78);
  }

  const corpus = loadCorpus();
  let errors = null;
  let markdown = null;
  let result = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.error(`Generating "${topic.slug}" (attempt ${attempt}/${MAX_ATTEMPTS})…`);
    const { text, usage } = await complete({
      system: SYSTEM,
      prompt: buildPrompt(topic, corpus, errors),
      maxTokens: 6000,
      temperature: attempt === 1 ? 0.7 : 0.4,
    });
    markdown = text.replace(/^```(?:markdown|md)?\n?/, '').replace(/\n?```$/, '').trim();
    result = check(markdown, { kind: 'blog' });

    if (result.ok) {
      console.error(`Verified clean on attempt ${attempt}. Tokens: ${JSON.stringify(usage)}`);
      break;
    }
    errors = result.errors;
    console.error(`Rejected:\n${errors.map((e) => '  - ' + e).join('\n')}`);
  }

  if (!result.ok) {
    mkdirSync(path('content', 'rejected'), { recursive: true });
    writeFileSync(path('content', 'rejected', `${topic.slug}-${today()}.md`), markdown);
    writeFileSync(
      path('content', 'rejected', `${topic.slug}-${today()}.errors.txt`),
      result.errors.join('\n') + '\n'
    );
    console.error(
      `\nFAILED after ${MAX_ATTEMPTS} attempts. Nothing published. ` +
        `Draft saved to content/rejected/ for inspection.`
    );
    process.exit(1);
  }

  for (const w of result.warnings) console.error(`warning: ${w}`);

  if (DRY) {
    process.stdout.write(markdown + '\n');
    return;
  }

  mkdirSync(path('content', 'published'), { recursive: true });
  writeFileSync(path('content', 'published', `${topic.slug}.md`), markdown + '\n');

  topic.status = 'published';
  topic.publishedOn = today();
  writeFileSync(path('content', 'topics.json'), JSON.stringify(topics, null, 2) + '\n');

  console.error(`Published content/published/${topic.slug}.md`);
  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `slug=${topic.slug}\ntitle=${topic.title}\npublished=true\n`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
