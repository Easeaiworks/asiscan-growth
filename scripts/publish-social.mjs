#!/usr/bin/env node
/**
 * Drains data/social-queue.json to the LinkedIn company page.
 *
 * Two transports, selected by which credentials are present:
 *
 *   buffer    (default, recommended) POSTs to Buffer, which already holds
 *             LinkedIn API partner approval. You never touch LinkedIn's
 *             developer portal and there is no token to refresh.
 *             Requires: BUFFER_ACCESS_TOKEN, BUFFER_LINKEDIN_CHANNEL_ID
 *
 *   linkedin  direct to LinkedIn's /rest/posts endpoint. Requires the
 *             Community Management API, which requires a registered legal
 *             entity and an approval process measured in weeks. Access tokens
 *             last 60 days and are refreshed programmatically; the refresh
 *             token lasts 365 days and then a human must re-consent once.
 *             Requires: LINKEDIN_ACCESS_TOKEN, LINKEDIN_ORGANIZATION_URN
 *
 *   webhook   generic escape hatch — POSTs the payload to SOCIAL_WEBHOOK_URL.
 *             Use this to drive Make.com, n8n, or anything else.
 *
 * Usage: node scripts/publish-social.mjs [--dry-run] [--limit 1]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { path, brand, today, isPaused } from './lib/config.mjs';
import { check } from './lib/fact-guard.mjs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const LIMIT = Number(args.includes('--limit') ? args[args.indexOf('--limit') + 1] : 1) || 1;

const LINKEDIN_VERSION = process.env.LINKEDIN_VERSION || '202607';

function transport() {
  if (process.env.SOCIAL_TRANSPORT) return process.env.SOCIAL_TRANSPORT;
  if (process.env.BUFFER_ACCESS_TOKEN) return 'buffer';
  if (process.env.LINKEDIN_ACCESS_TOKEN) return 'linkedin';
  if (process.env.SOCIAL_WEBHOOK_URL) return 'webhook';
  return null;
}

async function postToBuffer(item) {
  const token = process.env.BUFFER_ACCESS_TOKEN;
  const channel = process.env.BUFFER_LINKEDIN_CHANNEL_ID;
  if (!channel) throw new Error('BUFFER_LINKEDIN_CHANNEL_ID is not set.');

  // mode: "queue" adds to the channel's posting schedule rather than firing
  // immediately. Scheduling through a scheduler is the well-trodden path and
  // keeps the cadence looking human rather than machine-gun.
  const mode = process.env.BUFFER_MODE || 'queue';

  const res = await fetch('https://api.bufferapp.com/2/updates/create.json', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'profile_ids[]': channel,
      text: item.text,
      ...(mode === 'now' ? { now: 'true' } : {}),
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Buffer API ${res.status}: ${body}`);
  return { transport: 'buffer', response: body.slice(0, 400) };
}

async function postToLinkedIn(item) {
  const token = process.env.LINKEDIN_ACCESS_TOKEN;
  const urn = process.env.LINKEDIN_ORGANIZATION_URN || brand.social.linkedinOrganizationUrn;
  if (!urn) throw new Error('LINKEDIN_ORGANIZATION_URN is not set (expects urn:li:organization:NNNN).');

  const res = await fetch('https://api.linkedin.com/rest/posts', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      'x-restli-protocol-version': '2.0.0',
      'linkedin-version': LINKEDIN_VERSION,
    },
    body: JSON.stringify({
      author: urn,
      commentary: item.text,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    }),
  });
  if (res.status !== 201) {
    throw new Error(`LinkedIn API ${res.status}: ${await res.text()}`);
  }
  return { transport: 'linkedin', postUrn: res.headers.get('x-restli-id') };
}

async function postToWebhook(item) {
  const url = process.env.SOCIAL_WEBHOOK_URL;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: item.text, url: item.url, slug: item.slug, source: brand.product.name }),
  });
  if (!res.ok) throw new Error(`Webhook ${res.status}: ${await res.text()}`);
  return { transport: 'webhook' };
}

async function main() {
  const paused = isPaused();
  if (paused) {
    console.error(`Publishing paused: ${paused}`);
    process.exit(78);
  }

  const qPath = path('data', 'social-queue.json');
  if (!existsSync(qPath)) {
    console.error('No social queue. Nothing to do.');
    process.exit(78);
  }
  const queue = JSON.parse(readFileSync(qPath, 'utf8'));
  const pending = queue.filter((i) => i.status === 'queued').slice(0, LIMIT);
  if (!pending.length) {
    console.error('Social queue empty. Nothing to do.');
    process.exit(78);
  }

  const mode = transport();
  if (!mode) {
    // LinkedIn is deliberately optional and can be switched on later. Composed
    // posts stay queued until then. Exit cleanly rather than generating a
    // failure notification every week.
    console.error(
      `No social transport configured, so ${pending.length} post(s) stay queued. ` +
        'Set BUFFER_ACCESS_TOKEN (recommended), LINKEDIN_ACCESS_TOKEN or ' +
        'SOCIAL_WEBHOOK_URL when you want LinkedIn switched on.'
    );
    process.exit(78);
  }

  for (const item of pending) {
    // Verify one last time at the publish boundary. Copy can be edited between
    // composition and publication; the guard runs on what actually goes out.
    const res = check(item.text, { kind: 'social' });
    if (!res.ok) {
      item.status = 'blocked';
      item.error = res.errors.join('; ');
      console.error(`BLOCKED ${item.id}: ${item.error}`);
      continue;
    }

    if (DRY) {
      console.error(`[dry-run ${mode}] would publish ${item.id}:\n${item.text}\n`);
      continue;
    }

    try {
      const result =
        mode === 'buffer' ? await postToBuffer(item)
        : mode === 'linkedin' ? await postToLinkedIn(item)
        : await postToWebhook(item);
      item.status = 'published';
      item.publishedOn = today();
      item.result = result;
      console.error(`Published ${item.id} via ${mode}.`);
    } catch (err) {
      item.status = 'failed';
      item.error = String(err.message || err).slice(0, 500);
      console.error(`FAILED ${item.id}: ${item.error}`);
      writeFileSync(qPath, JSON.stringify(queue, null, 2) + '\n');
      process.exit(1);
    }
  }

  if (!DRY) writeFileSync(qPath, JSON.stringify(queue, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
