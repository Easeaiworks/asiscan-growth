# Responsible disclosure policy for corpus research

The monthly corpus scan runs ASIScan over 50 open-source AI agent repositories
belonging to other people. Publishing that research is a large part of the
marketing strategy, which means the way it is handled is itself a reputation
asset — or a liability.

These rules are not optional and two of them are enforced in code.

## 1. Aggregates only

Published content reports how many repositories in the corpus showed a given
pattern. It never publishes a per-repository findings list, never ranks projects
by finding count, and never describes a named project as insecure.

*Enforced:* `content/topics.json` briefs state this, the generation prompt states
it, and `data/corpus-findings.json` per-repository detail is never fed to the
content generator — only the aggregate section is.

## 2. A static finding is a signal, not a vulnerability

Every piece of published research must say this plainly, in the body, not in a
footnote:

- These are static-analysis signals requiring human triage.
- Framework and library repositories will legitimately show control-probe
  findings for controls that are properly the responsibility of the application
  calling them. A framework that does not implement audit logging is not
  defective; that belongs to the caller.
- The scanner's measured precision figure is published in the same piece.

*Enforced:* `fact-guard` requires the disclaimers, blocks compliance overclaiming,
and blocks the unverified precision figure.

## 3. Disclose before you publish

If a scan surfaces something that appears genuinely exploitable in a specific
project — not a missing-control signal, an actual reachable flaw — then before
any related content goes out:

1. Report it privately through the project's security policy, or to the
   maintainers directly if there is none.
2. Give a reasonable window. 90 days is the norm; shorter only by agreement.
3. Publish only aggregates until the maintainer has shipped a fix or the window
   has closed.
4. Credit the maintainer's response if they were responsive. It costs nothing and
   it is how this community works.

This one is not automatable and should not be. If the corpus scan produces
something that makes you uncomfortable, pause publishing (`touch PAUSE`) and deal
with it properly.

## 4. Right of reply

If a maintainer disputes a published aggregate finding, correct or annotate the
post the same week. A visible correction is worth more to the brand than the
original claim was.

## 5. If asked to be removed

If a maintainer asks for their repository to be excluded from the corpus, remove
it from `corpus/repos.json` without argument and without asking why.
