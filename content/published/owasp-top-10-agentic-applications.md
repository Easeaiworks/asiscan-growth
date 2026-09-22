---
title: "The OWASP Top 10 for Agentic Applications, explained for engineers"
description: "The OWASP Top 10 for Agentic Applications, walked category by category: what each one looks like in code and what static analysis can and can't see."
date: 2026-09-22
slug: owasp-top-10-agentic-applications
tags:
  - owasp
  - agentic-ai
  - ai-security
  - asi-top-10
canonical: https://asiscan.dev/blog/owasp-top-10-agentic-applications
---

The OWASP GenAI Security Project's Agentic Security Initiative published the Top 10 for Agentic Applications in December 2025, after more than a year of work from 100+ contributors. That's a separate document from the OWASP LLM Top 10, which has existed for a while and covers a different problem. If you already run LLM01 through LLM10 against your codebase, you have not covered agentic risk. You've covered model risk. This is the list for what happens once the model can act.

I built ASIScan against both lists plus two EU AI Act Article 50 checks — 18 rules in total. This post is the reference page for the ten agentic categories: what each one is, what it looks like in a codebase, and where a scanner can and can't see it. It is not a certification scheme. Nobody "passes" the OWASP Agentic Top 10. It's a list of failure modes, and the useful thing to do with it is check your own code against each one.

## Why a separate list from the LLM Top 10

The LLM Top 10 is about the model as a component: does it leak training data, can it be jailbroken, does it hallucinate output that gets trusted downstream. Those questions matter whether the model sits behind a chatbot widget or an autonomous pipeline.

The agentic list is about consequence. Once a model's output triggers a tool call, a database write, a shell command, or a handoff to another agent, the attack surface stops being "what can I make the model say" and becomes "what can I make the model do." A prompt injection that used to produce an embarrassing chat transcript now produces a wire transfer, a deleted repository, or a credential exfiltrated over a tool call. Same injection. Completely different blast radius, because there's an agent loop attached to the output.

That's the gap the LLM list was never built to cover, and it's why the Agentic Security Initiative built a new one instead of bolting more items onto the old one.

## The ten categories

### ASI01 — Agent Goal Hijack
The agent's actual objective gets overridden by content it wasn't supposed to treat as instructions — a webpage, a retrieved document, a tool result. In code, the tell is untrusted or dynamic content interpolated directly into a system prompt, or fetched external content flowing into context with no delimiting step marking it as untrusted. In our scan of 50 open-source agent repositories, 17/50 (34%) showed at least one ASI01 finding. Full detail: [ASI01 deep dive](https://asiscan.dev/blog/asi01-agent-goal-hijack).

### ASI02 — Tool Misuse & Exploitation
The agent has tools, and nothing checks whether the arguments the model produced for those tools are sane. The tell: tool definitions with no parameter schema validation, or no allowlist restricting which tools are reachable in a given context. 7/50 repositories (14%) showed this. [ASI02 deep dive](https://asiscan.dev/blog/asi02-tool-misuse).

### ASI03 — Identity & Privilege Abuse
The agent runs on a credential that's too broad or too long-lived for what it's doing. The tell: a hardcoded long-lived credential, a session configured to never expire, or an agent making tool calls with no evidence of scoped, short-lived credential exchange — it may be running on a standing token indefinitely. This was the most widespread category in our scan: 35/50 repositories (70%). [ASI03 deep dive](https://asiscan.dev/blog/asi03-identity-privilege-abuse).

### ASI04 — Agentic Supply Chain Vulnerabilities
Agent frameworks pull in a lot of moving parts — MCP servers, tool packages, plugin registries — and agentic supply chain risk is what happens when one of those isn't pinned. The tell: an unpinned dependency range, or an MCP server launched at an unpinned version, where a compromised upstream release executes immediately with the agent's own privileges. 19/50 repositories (38%). [ASI04 deep dive](https://asiscan.dev/blog/asi04-supply-chain).

### ASI05 — Unexpected Code Execution
The model's output reaches an execution sink. The tell: dynamic evaluation of a non-literal value, a shell command built by string concatenation where part of the string can be model-influenced, or a code-execution tool exposed to the agent with no sandboxing or network egress restriction. Half the corpus — 25/50 repositories (50%) — showed at least one instance. This is the category with the most direct line from "the model said something" to "the machine did something." [ASI05 deep dive](https://asiscan.dev/blog/asi05-unexpected-code-execution).

### ASI06 — Memory & Context Poisoning
Agent memory persists across sessions, and if it isn't scoped or validated, one poisoned entry keeps influencing every later run — potentially across tenants. The tell: memory persisted with no per-user or per-tenant scope key, or memory writes with no validation or expiry. This showed up in 1/50 repositories in our scan, concentrated in a single codebase, so treat that as a low base rate rather than a rare category — it's the kind of thing that's invisible until someone looks for it specifically. [ASI06 deep dive](https://asiscan.dev/blog/asi06-memory-poisoning).

### ASI07 — Insecure Inter-Agent Communication
Multi-agent systems talk to each other, and that channel needs the same scrutiny as any other network boundary. The tell: a plaintext HTTP endpoint between agents, or a multi-agent handoff with no authentication or message signing. 20/50 repositories (40%). [ASI07 deep dive](https://asiscan.dev/blog/asi07-inter-agent-communication).

### ASI08 — Cascading Failures
An agent loop with no way to stop propagates its own failure to everything downstream of it. The tell: an execution loop with no evident iteration cap, retry bound, or timeout, or tool dispatch with no error handling. We saw this in 1/50 repositories, again concentrated in a single codebase — but an agent that can't terminate is a design flaw worth checking for regardless of how rare it looks in a sample. [ASI08 deep dive](https://asiscan.dev/blog/asi08-cascading-failures).

### ASI09 — Human-Agent Trust Exploitation
Irreversible actions ship without a human actually confirming them, or the confirmation step exists but can be routed around. The tell: an approval gate that gets bypassed, or a high-impact operation reachable with no human-in-the-loop step evident anywhere in the path. 8/50 repositories (16%). [ASI09 deep dive](https://asiscan.dev/blog/asi09-trust-exploitation).

### ASI10 — Rogue Agents
An agent operating outside its intended bounds, with nobody able to see it happening or stop it. The tell: agent actions dispatched with no audit logging, or no kill switch or cancellation path for a running agent. We found this in 2/50 repositories, again concentrated in one — but note what it means when it's present: no log, no way to halt, no way to know. [ASI10 deep dive](https://asiscan.dev/blog/asi10-rogue-agents).

## What an ordinary SAST tool can and can't see

A traditional SAST tool built for web application code is very good at data-flow analysis: taint tracking from an HTTP request parameter to a SQL query, for instance. That machinery doesn't disappear when the codebase happens to contain an agent. Direct injection patterns — request data going straight into a system message, a shell string built by concatenation — are visible to any tool that reads code carefully.

What a conventional SAST tool doesn't have is a concept of "tool call," "system prompt," "MCP server," or "agent loop." It has no notion that a function decorated `@tool` and handed to a model is a different risk category from a function called directly by your own code. It has no idea what a missing iteration cap looks like, because "this loop never had a cap" isn't a data-flow bug — it's an absent control. Most of the OWASP Agentic categories are absence problems, not presence problems: the risk isn't that a dangerous construct exists, it's that the mitigation for a known-risky pattern doesn't.

That's the design behind most of ASIScan's rules: a control probe fires when a risk trigger is present *and* no evidence of the standard mitigation exists anywhere in the project — not just a keyword match on `eval()`. Comments are stripped before that mitigation check runs, so a `// TODO: add sandboxing` comment can't satisfy the probe and mark the project as covered. That's a deliberate design decision, and it's covered by a regression test, because it's exactly the kind of thing that quietly breaks a scanner over time.

None of that makes ASIScan an AST-based tool. It's regex-based. It will miss things a real data-flow engine would catch, and it will flag things that turn out to be fine on inspection — a framework repository, for instance, will legitimately show control-probe findings for controls that are actually the calling application's responsibility to implement, not the framework's. We measured roughly 55% precision on the August 2026 build, against five open-source agent frameworks (~3,100 source files). That number describes that build, not the current release — precision for the current version is being re-measured against a larger, 50-repository corpus, and I'm not going to publish a number for it until that methodology is documented alongside the result.

## How to run an assessment against the list today

Static analysis covers part of this list, not all of it. Some of the ten categories — approval-gate design, kill-switch reachability, whether your incident response plan actually works — are process and architecture questions that no scanner, regex or AST, can answer from source code alone. That's why the checklist exists separately from the scanner: 49 manual review points with severity and an evidence column, mapped to ASI01 through ASI10, covering exactly the non-source factors static analysis can't see.

For what static analysis can cover, ASIScan runs all 18 rules — the ten ASI categories, six OWASP LLM Top 10 rules using the 2025 edition's numbering, and the two Article 50 checks — against TypeScript/JavaScript, Python, C#, and Go, entirely offline. No telemetry, no network calls, nothing leaves the machine. It outputs to terminal, Markdown, JSON, or SARIF 2.1.0, which uploads straight into the GitHub code-scanning tab if that's where your team already looks.

There's also a set of 30 adversarial red-team probes shipped as JSONL, each mapped to an ASI or LLM ID with a defined fail signal, built to be delivered through a real ingestion channel — retrieval, a tool result, memory — rather than typed into a chat box. Static analysis tells you what the code allows. The probes tell you what actually happens when you try it.

Put together — the 18 static rules, the 30 probes, the 49-point checklist — you get an evidence package for a human reviewer to work from. That's the ceiling. It's evidence for assessment, not a determination that the system is safe, and not compliance with anything.

## Notes

Not affiliated with or endorsed by OWASP. OWASP is a registered trademark of the OWASP Foundation.

This produces evidence for human assessment. It does not establish compliance with the EU AI Act or any other regulation.

Run `npx asiscan-cli .` against your own agent codebase and see which of these ten categories show up first.
