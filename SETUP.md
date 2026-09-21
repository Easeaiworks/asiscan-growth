# Setup — about 20 minutes, once

Nothing publishes until these steps are done. After them, nothing needs you
again except a one-minute digest on Sundays.

LinkedIn is skipped here on purpose. The system composes LinkedIn posts and
leaves them queued; when you switch the transport on later, the backlog is
waiting. No workflow fails in the meantime.

---

## 1. Push the repository (5 minutes)

The folder is already at `~/Downloads/asiscan-growth` with a git repository
initialised and one commit made.

Create an empty private repo at <https://github.com/new> named
`asiscan-growth` — no README, no .gitignore, no licence — then:

```bash
cd ~/Downloads/asiscan-growth
git remote add origin https://github.com/Easeaiworks/asiscan-growth.git
git branch -M main
git push -u origin main
```

## 2. Add the one secret it needs (3 minutes)

Repository → **Settings** → **Secrets and variables** → **Actions**.

**Secrets** tab → New repository secret:

| Name | Value |
|---|---|
| `ANTHROPIC_API_KEY` | A key from <https://console.anthropic.com/settings/keys>. Budget a few dollars a month. |

**Variables** tab → New repository variable:

| Name | Value |
|---|---|
| `ANTHROPIC_MODEL` | The current Sonnet model ID from <https://docs.claude.com/en/docs/about-claude/models> |
| `SCANNER_CMD` | `npx --yes asiscan-cli@latest` — published 2026-09-21 (npm refused the name `asiscan`). |

That is the entire required configuration.

## 3. Point Vercel at it (7 minutes)

Copy your current landing page in first, so the deploy does not replace the site
with only a blog:

```bash
# Done 2026-09-21: the live asiscan.dev pages (index, faq, verify, support,
# terms, privacy, thanks, style.css, registry.json, vercel.json) are already in
# site/. Do NOT copy from agentaudit-complete -- that is the pre-rename
# AgentAudit page and would replace the live ASIScan site.
cd ~/Downloads/asiscan-growth
git add site && git commit -m "site: bring across the landing page" && git push
```

Then in the Vercel project for `asiscan.dev`:

- **Settings → Git** → connect the `asiscan-growth` repository
- **Settings → Build and Deployment** → Root Directory: `site`
- Framework preset: **Other**. Build command: empty. Output directory: empty.

Deploy. `asiscan.dev/blog` should show one post.

## 4. Prove it works (5 minutes)

GitHub → **Actions** tab:

1. Run **Fact guard** manually. It should pass — 15 tests plus the content checks.
2. Run **Publish content** manually with `dry_run` ticked. It generates the next
   post and prints it without committing anything. Read it. If the voice is
   wrong, edit `config/voice.md` and run it again.
3. Run **Publish content** with `dry_run` unticked. A post goes live.

From here it runs every Tuesday at 09:00 on its own.

---

## What happens without you after that

| When | What |
|---|---|
| Tuesdays 09:00 | Generate → verify → build → commit → deploy. LinkedIn post composed and queued. |
| Tue 09:30, Thu 10:00 | Would publish to LinkedIn. Exits quietly until you configure it. |
| 1st of the month | Rescan the corpus, refresh every statistic. Needs `SCANNER_CMD` to point at a published package. |
| Sundays 09:00 | One digest issue. This is the only thing that wants your attention. |

## Stopping it

```bash
cd ~/Downloads/asiscan-growth && touch PAUSE && git commit -am "pause" && git push
```

Or set the repository variable `PAUSE_PUBLISHING` to `true`. Either stops every
publishing workflow immediately.

## Switching LinkedIn on later

1. Create a free Buffer account, connect the company page as a channel.
2. Create an API token in Buffer's developer settings.
3. `curl -H "Authorization: Bearer <token>" https://api.bufferapp.com/2/profiles.json`
   and take the `id` of the LinkedIn page channel.
4. Add `BUFFER_ACCESS_TOKEN` and `BUFFER_LINKEDIN_CHANNEL_ID` as repository secrets.
5. Run **Publish to LinkedIn** manually with `dry_run` on, read the copy, then
   run it with `dry_run` off.

Every post composed while LinkedIn was off is still sitting in
`data/social-queue.json` and will go out one at a time on the normal cadence.
