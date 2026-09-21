# ASIScan — 40 Social Posts

**Core angle:** people are far too trusting of AI agents. The scanner is free and MIT; you only pay when you want the written report.

**Facts used (all verified, nothing invented):** OWASP ASI Top 10 (ASI01–ASI10) + OWASP LLM Top 10 coverage · free MIT scanner on npm (`npx asiscan-cli .`) · $490 one-off assessment · $2,400/yr continuous · $6,000/yr consultancy · asiscan.dev · hello@protocol42.io

No statistics, breach counts, customer numbers or testimonials are included, because none have been verified. Add those only when you have the receipts.

**Revised 21 Sept 2026.** Posts citing the ~75% precision figure (X 9, LinkedIn 6) are marked **HOLD**: that number predates the scanner fix and must be re-measured before it is published. "About a minute" claims were replaced with a measured figure (a 184-file agent repo scanned in under a second). Instagram posts now map to finished images in `marketing/instagram/` — post N uses `ig-0N-*.png`.

---

## X / Twitter

**1.**
Your SAST scanner doesn't know what a tool call is.

It sees `exec(cmd)` and checks whether `cmd` is tainted. It has no idea `cmd` came from a model that just read an untrusted webpage.

Free, MIT: asiscan.dev

**2.**
We ship agents that can read email, run shell commands and spend money — then review them like they're CRUD apps.

Static analysis for the OWASP Agentic Top 10. Free scanner, MIT licensed.

asiscan.dev

**3.**
"It's just a prompt" is how you describe the input to a function that can `rm -rf`.

asiscan.dev

**4.**
The dangerous line in your agent isn't the model call.

It's the three lines after it, where nobody checked what came back.

Free scanner, MIT: asiscan.dev

**5.**
Excessive agency isn't a model problem. It's a code review problem.

And your reviewers have never seen this bug class before.

asiscan.dev

**6.**
Most agent security advice is "be careful."

Ours is a scanner that scanned a 184-file agent repo in under a second. MIT, free forever. The written report is the only paid part.

asiscan.dev

**7.**
Prompt injection gets boring fast in a demo.

It stops being boring the moment the injected text reaches a tool that touches your database.

Finding where untrusted input meets a tool that acts is exactly what static analysis is for. asiscan.dev

**8.**
Merged into main this week, somewhere in the world: an agent holding an API key scoped to everything, because scoping it properly was a Friday problem.

asiscan.dev

**9. — HOLD until precision is re-measured**
We measured it rather than claiming it: ~75% precision on our benchmark.

Not magic. Not zero false positives. Just far fewer than you'd expect from a tool in this category.

asiscan.dev

**10.**
Free scanner. MIT licensed. Run it on your own repo, keep the output, tell nobody.

You only pay if you want the assessment written up.

asiscan.dev

---

## LinkedIn

**1.**
Every security tool in your pipeline was designed for software that does what it's told.

Agents don't do what they're told. They do what they're persuaded to do — by a webpage, a PDF, a calendar invite, a support ticket. The instruction and the data arrive through the same channel, and your scanner cannot tell them apart.

ASIScan is static analysis built for that specific gap. It audits agent codebases against the OWASP Top 10 for Agentic Applications and the OWASP LLM Top 10, flagging the places where untrusted input meets a tool that acts — a shell, a database, an outbox, a payment API.

The scanner is free and MIT licensed. asiscan.dev

**2.**
An uncomfortable question for engineering leaders shipping agents this quarter:

Who on your team has reviewed agent code for excessive agency before?

Not "reviewed code." Not "knows security." Specifically: has looked at a tool definition and asked whether the blast radius matches the trust level of the input.

For most teams the honest answer is nobody, because the bug class is about two years old and the tooling is younger than that. That is not a competence problem. It is a tooling gap.

Free scanner, MIT licensed: asiscan.dev

**3.**
"We'll add guardrails before launch" is the 2026 version of "we'll add tests later."

The difference is that untested code fails visibly. An over-permissioned agent works beautifully right up until someone points it at the wrong input, and then it works beautifully in the wrong direction.

ASIScan finds the paths before production does. Free and MIT: asiscan.dev

**4.**
There is a quiet assumption inside most agent deployments: that the model's output is trustworthy enough to pass to the next function.

It isn't. It's user input wearing a lab coat.

Everything we learned about input validation over thirty years still applies — we've just stopped applying it, because the input now arrives in fluent English and sounds reasonable.

ASIScan audits agent codebases for exactly this. asiscan.dev

**5.**
Why we made the scanner free and MIT.

Security tooling that costs money before it proves value doesn't get run. It gets evaluated, deferred, and forgotten. We'd rather the scanner be everywhere and charge for the thing that genuinely takes human effort: the written assessment, the triage, the remediation guidance.

Scan free, forever. $490 when you need it documented for a customer, a board or an auditor.

asiscan.dev

**6. — HOLD until precision is re-measured**
On precision, since everyone in this category claims perfection:

ASIScan measures ~75% precision on our benchmark. That means roughly one in four flagged items won't be worth acting on.

We publish that number because a scanner that claims zero false positives is either lying or barely looking. You should ask every vendor in this space for theirs, and be suspicious of anyone who doesn't have one.

asiscan.dev

**7.**
The compliance conversation around AI is converging fast, and most teams are approaching it backwards — starting with the policy document rather than the codebase.

You cannot attest to controls you have never measured. A scan produces evidence. The policy document describes it.

This matters whether or not you sell into the EU. Enterprise procurement is asking the same questions regardless of jurisdiction.

asiscan.dev

**8.**
A pattern worth naming, because it shows up constantly in agent code:

The agent reads from an untrusted source. The output goes into context. Context goes to the model. The model emits a tool call. The tool call runs with the service account's full permissions.

Five hops, no validation at any of them, and each hop looks reasonable in isolation. That's what makes it hard to catch in review — and why a scanner that knows what a tool call is helps.

asiscan.dev

**9.**
If you're a consultancy delivering agent work to clients, you already have this problem: clients are starting to ask how you validated what you built, and "we tested it thoroughly" is no longer a satisfying answer.

ASIScan's consultancy tier is white-label — scan client codebases, deliver the findings under your own brand.

asiscan.dev

**10.**
Three things worth checking in your agent codebase this week, whether or not you use our tool:

1. Can any tool the agent can call cause an irreversible action — deleting data, sending money, emailing externally — without a human approval step?
2. Does any credential the agent holds have a scope broader than the narrowest task it performs?
3. Can content from an untrusted source reach a tool call without passing through validation?

If you can't answer all three from memory, that's the finding.

The free scanner answers them in under a second: asiscan.dev

---

## Facebook

**1.**
Here's the thing nobody says out loud about AI agents: we are handing them real permissions — email, files, databases, payment systems — mostly on trust.

Not because anyone decided that was safe. Because it worked in the demo and the deadline was Friday.

ASIScan is a free, open-source scanner that checks agent code for exactly this. asiscan.dev

**2.**
Ask someone running an AI agent in production what it's actually allowed to do.

Watch how long the pause is.

That pause is the product. Free scanner at asiscan.dev — MIT licensed, run it on your own machine, nothing leaves your laptop.

**3.**
A quick translation of one security term, because it's the one that matters most right now.

"Excessive agency" means the agent can do more than the task requires. It needed to read one calendar; it can edit all of them. It needed to query one table; it holds admin.

Nothing is wrong until something goes wrong, and then everything is.

asiscan.dev

**4.**
People are far too trusting of these systems, and honestly, the systems have earned some of it — they're genuinely useful and they usually behave.

"Usually behave" is fine for a writing assistant. It is not fine for something holding your production credentials.

Free scanner: asiscan.dev

**5.**
Why the scanner is free: because a security tool nobody runs protects nobody.

It's MIT licensed, it runs locally, and it always will be free. You only pay if you want the findings written up properly — for a client, a board, or a procurement questionnaire.

asiscan.dev

**6.**
If you build with AI agents, a small experiment.

Open the file where your tools are defined. Read it as though you were an attacker who can put any text you like in front of the model.

Give it five minutes. asiscan.dev checks the same file in under a second.

**7.**
The uncomfortable part of agent security is that nothing looks broken.

No crash, no error, no red text. The agent does something reasonable-looking that it should never have been allowed to do, and it does it confidently.

That's why you need a tool that reads the code rather than watching the behaviour. asiscan.dev

**8.**
Traditional security scanners are very good at their job. Their job is just a different one.

They know what a SQL query is. They don't know what a tool call is, or that the string being passed into it was written by a model that read a stranger's webpage thirty seconds ago.

ASIScan knows. Free and open source: asiscan.dev

**9.**
Built by Protocol 42 — a small operation, which is partly the point. The scanner is MIT licensed and runs entirely on your machine. No account, no telemetry, no uploading your source code to anyone.

Scan first, decide about us later. asiscan.dev

**10.**
Genuine question for anyone shipping agents: what's your rollback plan if one does something wrong at 2am?

Not the model saying something wrong. The agent *doing* something wrong — in a system that holds real data.

If the answer is "it can't," the free scanner will tell you whether that's true. asiscan.dev

---

## Instagram

Captions are written to sit under a single strong visual. Suggested visual is noted for each — a code frame, a simple diagram, or bold type on a dark background fits the product.

**1.**
*Visual: code frame — an LLM response being passed straight into a shell call*
Your scanner sees a function call.
It doesn't see that the argument was written by a model that just read a stranger's webpage.
Free, MIT, runs locally. Link in bio.
#AIsecurity #appsec #devsecops #aiagents #opensource

**2.**
*Visual: bold type on dark*
"IT'S JUST A PROMPT"
— person describing the input to a function with database access
Link in bio.
#promptinjection #aisecurity #devsecops #softwareengineering

**3.**
*Visual: five-step flow diagram, each arrow unlabelled except the last, marked "no validation"*
Untrusted page → context → model → tool call → your production database.
Five hops. Each one looks fine on its own.
That's why it survives code review.
#aisecurity #appsec #aiagents #devtools

**4.**
*Visual: permissions list, most items highlighted red*
It needed to read one calendar.
It can edit all of them.
This is called excessive agency, and it is everywhere.
Free scanner, link in bio.
#aisecurity #devsecops #aiagents #infosec

**5.**
*Image: ig-05-offline.png*
Runs offline.
No network calls during a scan. No telemetry. No account, no API key. Your source never leaves your machine.
MIT licensed — don't trust us, read the source. Link in bio.
#AIsecurity #privacy #opensource #devsecops #appsec

**6.**
*Visual: split frame — "FREE" / "$490"*
The scanner: free, MIT, forever.
The written assessment: $490, only when you need it documented.
Security tooling nobody runs protects nobody.
#opensource #aisecurity #devtools #startup

**7.**
*Visual: terminal frame mid-scan*
Under a second on a 184-file repo.
Runs locally. No account, no telemetry, no uploading your source anywhere.
Link in bio.
#devsecops #cicd #aisecurity #opensource #devtools

**8.**
*Visual: plain text, centred*
Nothing crashes.
No error, no red text.
The agent just does something reasonable-looking that it should never have been allowed to do.
#aisecurity #aiagents #appsec #infosec

**9.**
*Visual: three numbered questions on dark*
Three questions for your agent codebase:
Can it take an irreversible action with no human approval?
Does any credential it holds exceed the task?
Can untrusted input reach a tool call unvalidated?
Can't answer all three? That's the finding.
#devsecops #aisecurity #engineeringleadership #aiagents

**10.**
*Visual: OWASP ASI01–ASI10 as a checklist grid*
OWASP Top 10 for Agentic Applications.
Ten failure modes specific to software that acts on your behalf.
We scan for all of them. Free and open source.
#owasp #aisecurity #appsec #opensource #aiagents

---

## Suggested rotation

Four posts a week sustains all 40 for ten weeks without repeating a platform inside a fortnight.

- **Mon — LinkedIn.** Highest-intent audience; the credibility posts (2, 6, 10) work best as week-openers.
- **Wed — X/Twitter.** Two per week if you have the appetite; the short ones (3, 4, 8) are the most reshareable.
- **Thu — Instagram.** Needs the visual made first; batch three or four images in one sitting.
- **Sat — Facebook.** Lower competition at weekends, and the conversational tone suits the slot.

Lead with the free scanner in every post. The paid tiers convert off the tool, not off the ad — mentioning $490 before someone has run a scan asks for the sale too early.

## Two things to add once you have them

Neither exists yet, so neither appears above — but both would outperform everything in this file:

1. **A real finding, anonymised.** "We scanned an open-source agent framework and found X" is worth more than any amount of positioning.
2. **A named user.** One sentence from someone who ran it beats ten posts of argument.
