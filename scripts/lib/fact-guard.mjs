import { existsSync, readFileSync } from 'node:fs';
import { brand, claims, path } from './config.mjs';

/**
 * FACT GUARD
 * ----------
 * This is the component that replaces a human reviewer.
 *
 * Fully autonomous publishing is only defensible if the machine cannot assert
 * something nobody verified. So: every number that appears in generated copy
 * must be traceable to either
 *   (a) the verified claims ledger in config/claims.json, or
 *   (b) machine-generated scan output in data/corpus-findings.json.
 *
 * Anything else — a plausible-sounding statistic the model produced on its own —
 * fails the build and the post does not ship. Same for banned phrasing,
 * missing disclaimers, and unsubstantiated claims sitting on the blocklist.
 *
 * Failing closed is the point. Do not add an override flag.
 */

const ALWAYS_ALLOWED = new Set([
  // Framework identifiers and structural numbers that are not claims.
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '50', '99', '2023', '2024', '2025', '2026', '2027', '2028',
  '2.1.0', '2.0.0',
]);

const NUMBER_RE = /\b\d[\d,]*(?:\.\d+)?%?\b/g;

function normaliseNumber(raw) {
  return raw.replace(/,/g, '').replace(/%$/, '');
}

/** Every numeric token that appears anywhere in a blob of text. */
function numbersIn(text) {
  const out = new Set();
  for (const m of String(text).matchAll(NUMBER_RE)) {
    out.add(normaliseNumber(m[0]));
  }
  return out;
}

/** Build the set of numbers this repository is permitted to state as fact. */
export function buildAllowedNumbers() {
  const allowed = new Set(ALWAYS_ALLOWED);

  for (const c of claims.verified) {
    for (const n of numbersIn(`${c.claim} ${c.detail}`)) allowed.add(n);
  }

  for (const t of brand.pricing.tiers) allowed.add(String(t.price));

  const findingsPath = path('data', 'corpus-findings.json');
  if (existsSync(findingsPath)) {
    const data = JSON.parse(readFileSync(findingsPath, 'utf8'));
    // Every number the scanner itself produced is fair game to publish.
    for (const n of numbersIn(JSON.stringify(data))) allowed.add(n);
    // Percentages derived from those counts, rounded both ways.
    // Durations converted to seconds, one decimal, as the brief states them.
    for (const r of data.perRepo || []) {
      if (r.durationMs != null) allowed.add((r.durationMs / 1000).toFixed(1));
    }
    for (const r of data.rulePrevalence || []) {
      const pct = (r.reposAffected / data.summary.reposScanned) * 100;
      allowed.add(String(Math.round(pct)));
      allowed.add(pct.toFixed(1));
    }
  }

  return allowed;
}

function stripCodeAndLinks(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/g, ' ')       // fenced code
    .replace(/`[^`]{0,300}`/gs, ' ')       // inline code (may wrap one or two lines)
    .replace(/^\s{4,}\S.*$/gm, ' ')        // indented code
    .replace(/\]\([^)]*\)/g, '] ')         // link targets
    .replace(/^---[\s\S]*?^---/m, ' ');    // frontmatter
}

/**
 * @param {string} markdown  full post source including frontmatter
 * @param {object} opts      { kind: 'blog' | 'social' }
 * @returns {{ok: boolean, errors: string[], warnings: string[]}}
 */
export function check(markdown, opts = {}) {
  const kind = opts.kind || 'blog';
  const errors = [];
  const warnings = [];
  const prose = stripCodeAndLinks(markdown);

  // The required disclaimers legitimately contain phrases that are banned as
  // positive claims ("endorsed by OWASP" inside "not affiliated with or
  // endorsed by OWASP"). Remove them before the banned-phrase scan; their
  // presence is checked separately below.
  let scannable = prose;
  for (const d of Object.values(claims.requiredDisclaimers)) {
    scannable = scannable.split(d).join(' ');
  }
  const lower = scannable.toLowerCase();

  // 1. Banned phrasing — unfalsifiable claims, regulatory overreach, filler.
  for (const phrase of claims.bannedPhrases) {
    if (lower.includes(phrase.toLowerCase())) {
      errors.push(`Banned phrase present: "${phrase}"`);
    }
  }

  // 2. Explicitly unverified claims must never appear.
  for (const u of claims.unverified) {
    for (const n of numbersIn(`${u.claim}`)) {
      if (ALWAYS_ALLOWED.has(n)) continue;
      if (numbersIn(prose).has(n)) {
        errors.push(
          `Unverified claim "${u.id}" leaked into copy (number ${n}). ${u.why}`
        );
      }
    }
  }

  // 3. Every number must be traceable.
  const allowed = buildAllowedNumbers();
  const used = numbersIn(prose);
  const untraceable = [...used].filter((n) => !allowed.has(n));
  if (untraceable.length) {
    errors.push(
      `Untraceable figures: ${untraceable.join(', ')}. ` +
        `Every number published must come from config/claims.json or data/corpus-findings.json. ` +
        `If one of these is legitimate, add it to the claims ledger with a source.`
    );
  }

  // 4. Required disclaimers when the copy touches OWASP or compliance.
  //    Social posts are exempt from the long-form disclaimer but must still not
  //    imply endorsement or compliance (covered by the banned-phrase list).
  if (kind === 'blog') {
    for (const [key, triggers] of Object.entries(claims.disclaimerTriggers)) {
      const triggered = triggers.some((t) => prose.includes(t));
      if (!triggered) continue;
      const required = claims.requiredDisclaimers[key];
      const stem = required.split('.')[0].toLowerCase();
      if (!markdown.toLowerCase().includes(stem)) {
        errors.push(`Missing required ${key} disclaimer: "${required}"`);
      }
    }
  }

  // 5. Structural checks.
  if (kind === 'blog') {
    const fm = markdown.match(/^---\n([\s\S]*?)\n---/);
    if (!fm) {
      errors.push('Missing YAML frontmatter block.');
    } else {
      for (const field of ['title', 'description', 'date', 'slug']) {
        if (!new RegExp(`^${field}:\\s*\\S`, 'm').test(fm[1])) {
          errors.push(`Frontmatter missing "${field}".`);
        }
      }
      const desc = fm[1].match(/^description:\s*["']?(.+?)["']?\s*$/m);
      if (desc && desc[1].length > 160) {
        errors.push(`Meta description is ${desc[1].length} characters; maximum 160 (search engines truncate beyond that).`);
      }
    }
    const words = prose.split(/\s+/).filter(Boolean).length;
    if (words < 500) errors.push(`Post is only ${words} words; minimum 500.`);
    if (words > 2600) warnings.push(`Post is ${words} words; consider splitting.`);
  }

  if (kind === 'social') {
    const words = prose.split(/\s+/).filter(Boolean).length;
    if (words > 220) errors.push(`Social post is ${words} words; maximum 220.`);
    const hashtags = (markdown.match(/#\w+/g) || []).length;
    if (hashtags > 3) errors.push(`${hashtags} hashtags; maximum 3.`);
    if (/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(markdown)) {
      errors.push('Emoji present. The voice guide bans emoji on this channel.');
    }
  }

  // 6. Naming hygiene — catch the collision coming back.
  if (/\bAgentAudit\b/.test(markdown) && brand.product.name !== 'AgentAudit') {
    errors.push(
      `Copy references "AgentAudit", which is a different company's product. ` +
        `The product is called ${brand.product.name}.`
    );
  }

  return { ok: errors.length === 0, errors, warnings };
}
