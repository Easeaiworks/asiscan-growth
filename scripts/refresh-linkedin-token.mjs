#!/usr/bin/env node
/**
 * Refreshes the LinkedIn access token and writes it back to the repository
 * secret. Only needed if you are using the direct LinkedIn transport.
 *
 * LinkedIn access tokens last 60 days. Refresh tokens last 365 days and do NOT
 * rotate — so this keeps the system running unattended for a year, after which
 * a human has to click through consent once. The digest warns you 30 days out.
 *
 * Requires: LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET, LINKEDIN_REFRESH_TOKEN
 * Optional: GH_TOKEN + GITHUB_REPOSITORY to write the new token back as a secret.
 */
import { requireEnv } from './lib/config.mjs';

async function main() {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: requireEnv('LINKEDIN_REFRESH_TOKEN'),
    client_id: requireEnv('LINKEDIN_CLIENT_ID'),
    client_secret: requireEnv('LINKEDIN_CLIENT_SECRET'),
  });

  const res = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params,
  });
  if (!res.ok) throw new Error(`LinkedIn token refresh ${res.status}: ${await res.text()}`);

  const json = await res.json();
  const expiresDays = Math.round((json.expires_in || 0) / 86400);
  const refreshDays = Math.round((json.refresh_token_expires_in || 0) / 86400);

  console.error(
    `New access token acquired. Expires in ~${expiresDays} days. ` +
      `Refresh token expires in ~${refreshDays} days.`
  );

  if (process.env.GITHUB_OUTPUT) {
    const { appendFileSync } = await import('node:fs');
    appendFileSync(process.env.GITHUB_OUTPUT, `refresh_token_days=${refreshDays}\n`);
  }

  // Print only to the step output; GitHub masks registered secrets in logs.
  // The workflow pipes this into `gh secret set`.
  process.stdout.write(json.access_token);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
