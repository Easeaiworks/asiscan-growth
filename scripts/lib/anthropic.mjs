import { requireEnv } from './config.mjs';

const API = 'https://api.anthropic.com/v1/messages';
const VERSION = '2023-06-01';

/**
 * Minimal Anthropic Messages client. No SDK dependency on purpose — this repo
 * should install in a cold CI runner in a couple of seconds.
 *
 * Model is configurable via ANTHROPIC_MODEL so a model deprecation is a
 * repository-variable change, not a code change.
 */
export async function complete({
  system,
  prompt,
  maxTokens = 4096,
  temperature = 0.7,
  model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5',
  retries = 3,
}) {
  const key = requireEnv('ANTHROPIC_API_KEY');

  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0) {
      const backoff = Math.min(30_000, 1000 * 2 ** attempt);
      await new Promise((r) => setTimeout(r, backoff));
    }
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': key,
          'anthropic-version': VERSION,
        },
        body: JSON.stringify({
          model,
          max_tokens: maxTokens,
          temperature,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`Anthropic API ${res.status}: ${await res.text()}`);
        continue;
      }
      if (!res.ok) {
        throw new Error(`Anthropic API ${res.status}: ${await res.text()}`);
      }

      const json = await res.json();
      const text = (json.content || [])
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('')
        .trim();

      if (!text) throw new Error('Anthropic API returned no text content.');
      return { text, usage: json.usage, model: json.model };
    } catch (err) {
      lastErr = err;
      if (attempt === retries) break;
    }
  }
  throw lastErr;
}
