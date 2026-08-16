import test from 'node:test';
import assert from 'node:assert/strict';
import { check, buildAllowedNumbers } from '../scripts/lib/fact-guard.mjs';

const FM = (extra = '') => `---
title: A test post about tool calls
description: A short description that stays under the meta description limit.
date: 2026-08-14
slug: test-post
tags:
  - testing
canonical: https://asiscan.dev/blog/test-post
---
${extra}
`;

const FILLER = ('The scanner walks the tree and evaluates each rule against the corpus. ' +
  'It strips comments before matching mitigation evidence. ').repeat(30);

const DISCLAIMERS = `

## Notes

Not affiliated with or endorsed by OWASP. OWASP is a registered trademark of the OWASP Foundation.

This produces evidence for human assessment. It does not establish compliance with the EU AI Act or any other regulation.
`;

test('a clean post passes', () => {
  const md = FM(`# Heading\n\n${FILLER}\n\nThere are 18 static rules.${DISCLAIMERS}`);
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('an invented statistic is rejected', () => {
  const md = FM(`# Heading\n\n${FILLER}\n\nAround 87 per cent of teams get this wrong.${DISCLAIMERS}`);
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('Untraceable figures') && e.includes('87')));
});

test('the blocked precision claim cannot leak', () => {
  const md = FM(`# Heading\n\n${FILLER}\n\nPrecision is 75 per cent after tuning.${DISCLAIMERS}`);
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('precision-75')));
});

test('the verified precision claim is permitted', () => {
  const md = FM(`# Heading\n\n${FILLER}\n\nMeasured precision is roughly 55 per cent.${DISCLAIMERS}`);
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('compliance overclaiming is rejected', () => {
  const md = FM(`# Heading\n\n${FILLER}\n\nThis makes you compliant with the EU AI Act.${DISCLAIMERS}`);
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('makes you compliant')));
});

test('implied OWASP endorsement is rejected', () => {
  const md = FM(`# Heading\n\n${FILLER}\n\nWe are OWASP-certified.${DISCLAIMERS}`);
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('OWASP-certified')));
});

test('a missing disclaimer is caught when OWASP is mentioned', () => {
  const md = FM(`# Heading\n\n${FILLER}\n\nThe OWASP list has ten categories.`);
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('disclaimer')));
});

test('numbers inside code fences are ignored', () => {
  const md = FM(
    `# Heading\n\n${FILLER}\n\n\`\`\`js\nconst PORT = 8431;\nsetTimeout(fn, 45000);\n\`\`\`${DISCLAIMERS}`
  );
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('the old colliding product name is caught', () => {
  const md = FM(`# Heading\n\n${FILLER}\n\nAgentAudit scans your code.${DISCLAIMERS}`);
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('different company')));
});

test('frontmatter is required', () => {
  const r = check(`# No frontmatter\n\n${FILLER}${DISCLAIMERS}`, { kind: 'blog' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('frontmatter')));
});

test('a short post is rejected', () => {
  const md = FM(`# Heading\n\nToo short.${DISCLAIMERS}`);
  const r = check(md, { kind: 'blog' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('minimum 500')));
});

test('social posts reject emoji', () => {
  const r = check('A clean short social post about tool calls. 🚀', { kind: 'social' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('Emoji')));
});

test('social posts cap hashtags at three', () => {
  const r = check('Short post. #a #b #c #d', { kind: 'social' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => e.includes('hashtags')));
});

test('social posts do not require the long-form disclaimer', () => {
  const r = check('The OWASP agentic list has ten categories and I built a scanner for them. #OWASP', {
    kind: 'social',
  });
  assert.equal(r.ok, true, r.errors.join('\n'));
});

test('the allowed-number set includes ledger figures and prices', () => {
  const allowed = buildAllowedNumbers();
  assert.ok(allowed.has('18'), 'rule count');
  assert.ok(allowed.has('149'), 'price');
  assert.ok(allowed.has('55'), 'measured precision');
  assert.ok(!allowed.has('87'), 'an arbitrary number must not be allowed');
});
