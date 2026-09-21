# ASIScan — product review and go-to-market plan

Prepared 14 August 2026. Covers the product review, the two things that need
fixing before any marketing spend of effort, the positioning, the autonomous
system now built, and the channels beyond the blog and LinkedIn.

---

## 1. What I reviewed

The live site at `asiscan.dev`, the full source in `~/Downloads/agentaudit-complete`
(scanner, rules, tests, templates, red-team probes, GitHub Action), the existing
marketing notes shipped alongside it, and the Vercel project. I built the
scanner, ran its test suite, and ran it against real open-source AI agent
repositories.

### The product is real

This matters, so it goes first. A lot of solo security tools are a regex file
with a landing page. This is not that.

- **18 rules**, covering all ten OWASP Agentic categories, six of the LLM Top 10,
  and two EU AI Act Article 50 checks. The rule count on the site is accurate.
- **The control-probe design is the actual innovation.** Most rules fire only
  when a risk pattern is present *and* no evidence of the standard mitigation
  exists anywhere in the codebase. That is a materially better idea than
  grepping for `eval`, and it is the thing to lead with technically.
- **Comments are stripped before mitigation evidence is matched**, with a
  regression test. A `// TODO: add sandboxing` comment cannot mark you as
  mitigated. This is a small detail that tells a security practitioner
  everything about whether the author was thinking.
- **Genuinely polyglot.** Tests assert that the same rules fire in `.ts`, `.py`,
  `.cs` and `.go` fixtures.
- **Build and tests are clean.** 16 tests pass, TypeScript strict, no warnings,
  one runtime dependency, no network calls anywhere.
- **Fast.** A 387-file Python repository scans in under a second.
- **The README's "Honest limitations" section is the best marketing asset you
  own** and you are currently underusing it.

I ran it over a corpus of open-source agent repositories. It finds real things —
multi-agent handoffs with no signing, model output reaching `innerHTML`, shell
commands built by interpolation. It also produces reproducible false positives,
which I traced: a docstring containing the word "Conversation" firing an Article
50 check, `error.message` in a JavaScript catch block reading as model output,
and a missing word boundary making `function_call` match `function_calling`.
Those three are worth fixing; each is a one-line change.

### One bug that needs fixing before the next sale

`src/cli.ts` writes its report with `console.log(out)` and then calls
`process.exit()`. When stdout is a pipe — any CI job, any `> results.sarif` —
and the report is large, the process exits before the buffer drains and the
output is truncated mid-string. On `lobe-chat` a 414 KB JSON report came back as
146 KB of unparseable fragment.

This is not conditional on the exit code; `--fail-on none` exits 0 and truncates
identically. Nine of fifty repositories in my corpus hit it.

It matters commercially because your own GitHub Action pipes SARIF to the
code-scanning upload. A customer with a large agent codebase gets a corrupt SARIF
file and a failed CI step on their first run.

```ts
// instead of: console.log(out); … process.exit(breaching > 0 ? 1 : 0);
process.stdout.write(out + "\n", () => {
  process.exitCode = breaching > 0 ? 1 : 0;
});
```

The corpus scanner in this repository works around it by writing to `--output`
rather than reading stdout, so the research pipeline is unaffected either way.

### Two things to fix before any marketing effort

**1. The product name is not yours.**

`agentaudit.dev` is a live, free, MIT-licensed AI-package scanner from another
team. The npm package `agentaudit` belongs to an unrelated third party at v3.14.0.
Your README and your GitHub Action both instruct users to run `npx agentaudit .`,
which either 404s on `agentaudit@1.0.0` or silently runs somebody else's tool.

Every SEO effort under that name competes with a free product for its own brand
term, and every install instruction is broken.

You already own `asiscan.dev`. **ASIScan** is free on npm, has no conflicting
product, costs nothing, and puts the brand on the exact string buyers will search
(`ASI01`, `OWASP ASI top 10`). Everything in this repository is already
configured for it — the name lives in one field in `config/brand.json`.

Register `asiscan` on npm today, before somebody else does. That is the single
most time-sensitive item on this page.

**2. The precision claim on the site is not reproducible.**

The site describes a three-round progression to 75–80% precision across 15
repositories and ~17,000 files. The shipped README says 5 repositories, ~3,100
files, roughly 55%. Nothing in the product substantiates rounds two and three —
no repo list, no methodology, no changelog.

For most products this is a rounding error. For a security-compliance product
sold on rigour, it is the one claim a skeptical buyer will try to check, and the
buyer who checks is the buyer with budget.

Two options, both fine:

- **Drop the number back to 55% on the site.** Costs you nothing. "We measured
  55% and we publish it" is a *stronger* sales position than an unverifiable 78%,
  because nobody else publishes theirs at all.
- **Or ship `docs/precision-methodology.md`** listing all 15 repositories, the
  file counts, the triage procedure and the raw numbers, and cite it from the
  site.

Until one of those happens, the content engine is configured to refuse to publish
the higher figure. That block is in `config/claims.json` under `unverified`, and
it will fail a build rather than let the number out.

---

## 2. Positioning

Keep the wedge you already have. It is good.

> **Your SAST scanner doesn't know what a tool call is.**

It works because it is a claim about the reader's setup rather than about your
product, and they can check it in ten seconds. Do not replace it.

What to change is the layer underneath. The market research says something
important: **almost the entire AI security market sells runtime.** Garak,
Promptfoo, Giskard, Lakera, Zenity, Noma, Lasso, Prompt Security, Aim, Straiker,
HiddenLayer — red-teaming a running model, or a gateway sitting in front of one.
The static-analysis-of-agent-source-code slot is close to empty. The things
nearest to it (Snyk's `agent-scan`, Cisco's `mcp-scanner`, Microsoft's
agent-governance-toolkit) are free vendor ecosystem plays scoped to MCP servers
and installed components, not to your own orchestration code.

So the category sentence is:

> Everyone else tests the agent you deployed. This reads the agent you are about
> to deploy.

That is defensible, true, and it positions you as complementary to the tools your
buyer already has rather than competing with vendors who have raised nine figures.

**The risk to be clear-eyed about:** the gravity well is free. Snyk, Cisco and
Microsoft all give away adjacent scanners, so the buyer's reference price for
"a scanner" is $0. Your defensible value is not "static scanning" — it is the
*bundle*: the ASI mapping, the Article 50 worksheet, the evidence document, the
offline guarantee, and the consultancy white-label rights. Lead with the
evidence document, not with the scan.

### Message hierarchy

| Audience | Lead with |
|---|---|
| Engineers | ASI09 — the approval dialog the model wrote for itself. Concrete, unfamiliar, instantly believable. |
| Eng leads / CTOs | "Can you produce a dated assessment against ASI01–ASI10 today?" Most cannot, and they know it. |
| Security teams | The control-probe design, and that comments never count as mitigation evidence. |
| Compliance | Article 50 has been in force since 2 August 2026, and the technical documentation gap it created. |

### Pricing

Keep one-time $149 / $349 / $899. It is defensible and it is a differentiator in
a subscription-saturated category. Compliance tooling is used in bursts — before
a release, before an audit, before a fundraise — which is exactly the usage
pattern that makes people resent subscriptions.

**Add a free tier.** This is the highest-leverage commercial change available.
Open-source the scanner core with three or four of the 18 rules under MIT; sell
the full rule set, the templates and the red-team probes. Reasons, in order of
weight:

1. A developer tool that cannot be tried before purchase converts badly.
2. A public GitHub repository is a permanent discovery and SEO asset that a
   landing page can never be.
3. Hacker News is hostile to paywalled dev tools and generous to open ones. You
   get one Show HN. Do not spend it on a closed product.
4. `npx asiscan-cli .` becomes a marketing channel in itself — it is a shareable
   one-liner, which is how dev tools actually spread.

The $899 consultancy tier is your best margin per unit and your least-worked
channel. A boutique AppSec consultancy running agent reviews for clients will pay
$899 once rather than a per-seat SaaS across many engagements. That is a
different, warmer sales motion than the developer one, and it is worth a page.

---

## 3. What I built

A repository, `asiscan-growth`, that runs the content and distribution operation
without you. Full setup instructions are in its README; this is the shape of it.

### The core idea

Autonomous content usually fails because a model with nothing to say produces
fluent nothing, and for a security product fluent nothing is worse than silence.

So the model is never the source of a fact. **The scanner is.**

Every month the system clones 50 open-source AI agent repositories, scans them,
and writes the aggregate results to `data/corpus-findings.json`. Every week it
generates a blog post — and the only numbers it is permitted to write are ones
that trace back to that file or to a hand-verified claims ledger. A verifier
called `fact-guard` checks this before anything is published. If a figure cannot
be traced, the post does not ship.

This is the mechanism that makes "fully auto-publish" a responsible answer rather
than a reckless one. You asked for no human in the loop; the replacement for the
human is not trust, it is a build gate.

### What the guard enforces

- Every number in the copy traces to measured data or the claims ledger. An
  invented statistic fails the build.
- 48 banned phrases: OWASP endorsement implications, compliance guarantees,
  "100% coverage", and the standard marketing-voice tells.
- The unverifiable 75–80% precision claim cannot appear, in any wording.
- Required disclaimers are present whenever the copy touches OWASP or compliance.
- LinkedIn copy: word count, no emoji, at most three hashtags.
- The old colliding product name cannot appear.
- Structural: frontmatter, minimum length, meta description length.

15 tests cover it. It runs on every push and pull request, so a post you write by
hand is held to the same standard as a generated one.

### Schedule

| When | What happens |
|---|---|
| Tuesday 09:00 | Generate the next post, verify, build, commit, deploy, queue LinkedIn |
| Tuesday 09:30, Thursday 10:00 | Publish one queued LinkedIn post |
| 1st of the month | Rescan the corpus, refresh every published statistic |
| Sunday 09:00 | One digest issue: what shipped, what was blocked, traffic, queue depth |

Kill switch: `touch PAUSE`, commit, push. Or set a repository variable. Both stop
everything instantly.

### On LinkedIn specifically

Direct API access to post to a company page requires LinkedIn's Community
Management API, which requires a registered legal entity and an approval process
that runs weeks to months with no guarantee. Do not block on it.

The system uses Buffer's free tier instead: Buffer already holds LinkedIn partner
approval, so you connect the page once as its admin and never deal with
LinkedIn's developer portal or token rotation. The code supports the direct API
too, and switching is a matter of setting two secrets.

One honest note. LinkedIn's developer AI policy says applications should not
publish AI-generated content without giving a person a chance to edit it first.
It is written for multi-tenant apps and scheduling your own company's posts is
ordinary permitted use — but a fully unattended generate-and-publish loop is
closer to that line than a scheduled queue. Two settings keep you comfortably on
the right side: posts go into Buffer's *queue* rather than firing immediately,
and `SOCIAL_MODE=template` will compose social copy deterministically with no
model involved at all. Your own website is subject to nobody's platform policy,
so the blog stays fully generated either way.

### Running cost

| Item | Monthly |
|---|---|
| Anthropic API, ~4 posts | $2–5 |
| GitHub Actions | $0 (public repo, or well inside the free minutes) |
| Buffer free tier | $0 |
| Vercel | $0 on your existing plan |
| **Total** | **under $5** |

---

## 4. The channels, ranked

### Tier 1 — do these

**1. The ASI content cluster.** Twelve pages: a pillar on the OWASP Agentic Top
10, one page per risk, and an Article 50 pillar. These terms barely exist in
search today and every AI security vendor will be writing about them within
twelve months. Owning those URLs before the wave is the highest-leverage move
available and it costs nothing but generation. The topic queue is already loaded
with all twelve in publishing order.

**2. The corpus research report.** Scan 50 open-source agent repositories and
publish the aggregate findings. Not naming and shaming — aggregate statistics
only.

This single piece will do more than everything else combined. It is genuinely
useful to the field, it is inherently newsworthy, it proves the tool works at
scale on real code rather than on its own fixtures, and it produces the numbers
that anchor every subsequent post and every LinkedIn update for a year. The
infrastructure to produce and refresh it monthly is built and working.

Publish it *before* the launch post, and lead with it.

**3. Free tier plus a public GitHub repository.** Covered above. It unlocks
Hacker News, it is a permanent discovery asset, and it makes `npx asiscan-cli .`
a thing people can paste to each other.

**4. Register the npm package.** `npx asiscan-cli .` in a README, in a talk, in a
comment thread, is distribution. It cannot be that while the name resolves to
somebody else's package.

### Tier 2 — worth real effort

**5. GitHub Action in the Marketplace.** You already ship the workflow. Listing
it is an afternoon and it is evergreen discovery from inside the tool people
already use for CI.

**6. Get listed where developers look for this.** Pull requests to
`awesome-llm-security`, `awesome-ai-security` and similar curated lists; GitHub
topic tags; AlternativeTo. Each is a one-time effort producing a permanent
backlink from a page that already ranks.

**7. Reddit, as research not promotion.** r/netsec and r/cybersecurity will
remove a launch announcement and upvote "I scanned 50 open-source AI agents
against the OWASP Agentic Top 10, here is what I found." r/cybersecurity runs a
9-to-1 rule on self-promotion. Post the finding; let people find the tool.

**8. Show HN — but only after the free tier exists.** You get one shot and a
front-page day is worth more than a month of everything else. Do not spend it
early on a closed product.

**9. OWASP GenAI Agentic Security Initiative.** They hold open weekly meetings.
Participating as a contributor rather than a vendor is the most credible
visibility available in this niche, and it is free. It also keeps you accurate on
a framework that is still moving — worth doing for correctness alone.

**10. Answer-engine optimisation.** A growing share of this buyer's research
starts in a language model, not a search box. What gets cited is structured,
specific, well-sourced content with clear headings and real numbers — which is
exactly what the corpus report is. Add an `llms.txt` at the site root summarising
what ASIScan does and linking the canonical pages. Cheap, and this channel is
still uncrowded.

**11. The consultancy motion.** Boutique AppSec and AI consultancies are your
highest-margin buyer and nobody is selling to them. A dedicated page — white
label the report, use it across unlimited client engagements, $899 once — plus
direct outreach to twenty firms doing AI security assessments. This is the one
place where manual, non-automated effort has the best return, and it is maybe
three evenings of work.

**12. Cloud Security Alliance and newsletters.** CSA runs an active MCP security
research hub and publishes frequent notes; a guest contribution is credible
placement. TLDR Sec and similar newsletters are the right list for this buyer.

### Tier 3 — later, if the above is working

Conference CFPs (the agentic list is new enough that slots are open), a free
web-based single-file scanner as a lead magnet, comparison pages
("static analysis vs red-teaming for agents"), and guest posts.

### Do not bother

**Paid ads.** At $149 a unit your acquisition cost will exceed the price
immediately. **Cold email.** You are in Ontario; CASL makes unsolicited
commercial email a real legal exposure, not a grey area. **Product Hunt.** Wrong
audience for a security tool sold to engineers.

---

## 5. First 90 days

The system handles everything in the "automatic" column. The "you" column is the
whole of your involvement.

| Week | Automatic | You (total time) |
|---|---|---|
| 0 | — | Register `asiscan` on npm. Fix the precision claim on the site. Create the repo, add secrets, connect Buffer. **~2 hours, once.** |
| 1 | Corpus scan runs; Article 50 pillar publishes | Read the digest. |
| 2 | ASI09 + ASI05 publish; LinkedIn posts go out | Read the digest. |
| 3 | ASI01 publishes | Split out the free tier and push a public repo. **~3 hours.** |
| 4 | Pillar page publishes | Register the npm package name if not done. Submit the GitHub Action. **~1 hour.** |
| 5–6 | Risk pages continue | Awesome-list PRs, GitHub topics, AlternativeTo. **~1 hour.** |
| 7 | **Corpus research report publishes** | Post it to r/netsec as research. **~30 minutes.** |
| 8 | — | Show HN, with the free tier live. **~30 minutes.** |
| 9–12 | Remaining risk pages, opinion posts | Consultancy page and outreach to 20 firms. **~3 hours.** |
| 13 | Quarterly corpus comparison publishes | Review what converted. |

Under fifteen hours of your time across three months, most of it in the first
fortnight, and the content operation runs regardless.

---

## 6. What to measure

The system reports the first five in the weekly digest.

| Metric | Where | Target by day 90 |
|---|---|---|
| Organic sessions | Vercel Analytics | 400+/month |
| Pages ranking top 20 | Search Console | 8+ of the 12 cluster pages |
| LinkedIn page followers | LinkedIn | 200+ |
| GitHub stars (after free tier) | GitHub | 100+ |
| npm weekly downloads | npm | 200+ |
| Sales | Stripe | see below |

### Honest revenue expectation

At $149 with a technical B2B audience and a new domain, a realistic first month
is **0–5 sales**. Not because the product is weak, but because this buyer
converts on trust and trust takes more than one post.

The variables that move it, in order: whether the corpus report lands, whether a
free tier exists, whether the name is fixed, and everything else.

Read the signal carefully at day 90. Engagement but no sales means trust or
price. Neither means the audience is not the buyer, and the product should be
repositioned toward the consultancy channel before more effort goes into
developer marketing.

---

## 7. Your action list

**Today**

1. Register `asiscan` on npm. Cheapest insurance available.
2. Decide on the precision claim: revert the site to 55%, or ship the
   methodology file. Either is fine; leaving it as-is is not.

**This week**

3. Push this repository, add `ANTHROPIC_API_KEY`, connect Buffer, run the
   publish workflow once by hand.
4. Rename the product in the site copy, README and GitHub Action. Fix the
   `npx` install line.

**This month**

5. Split out a free tier and put a public repository on GitHub.
6. Fix the stdout truncation bug in `src/cli.ts`. This one is a correctness
   issue in a shipped product and takes five minutes.
7. Fix the three false positives I traced (docstring context on EUAIA-52, the
   `error.message` clause in LLM05, the missing `\b` in the `function_call`
   fragment). Each is a one-line change and each one improves the precision
   number you get to publish.
8. Build the consultancy page.

Everything else runs on its own.
