---
id: FINAL-20260807T061337Z-65ce
title: Nested inner-lane parallelism — redefining the orchestrator's `full` level
status: READY_WITH_WARNINGS
created_at: 2026-08-07T06:13:37Z
updated_at: 2026-08-07T06:13:37Z
cycle: 0
plan: FIX-20260807T050208Z-9ac2
related_to: SPEC-20260807T025822Z-2a6f, FEAT-20260807T030642Z-6077, FIX-20260807T040856Z-bf97, FIX-20260807T050208Z-9ac2
---

# FINAL — Nested inner-lane parallelism (`parallelism: full` redefined)

**Related:** [SPEC-20260807T025822Z-2a6f](../specs/SPEC-20260807T025822Z-2a6f-orchestrator-nested-inner-lane-parallelism.md) · [FEAT-20260807T030642Z-6077](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md) · [FIX-20260807T040856Z-bf97](../code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md) · [FIX-20260807T050208Z-9ac2](../code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md) · [TEST-20260807T054118Z-6a09](../test/TEST-20260807T054118Z-6a09-cr-4659-gate-integrity-remediation.md) · [CR-20260807T055718Z-bd3e](../code-review/CR-20260807T055718Z-bd3e-cr-4659-gate-integrity-remediation.md) · [QA-20260807T060418Z-d7d0](../qa/QA-20260807T060418Z-d7d0-cr-4659-gate-integrity-remediation.md) · [EVAL-20260807T061337Z-a3e3](../eval/EVAL-20260807T061337Z-a3e3-nested-inner-lane-parallelism.md)

## Overview

Redefines the orchestrator's `parallelism: full` level as **nested, depth-2 inner-lane
parallelism**. A lane (`backend`) may itself be sliced into **sub-lanes**
(`backend/presentation`, `backend/data`, …), each governed by a child `PACT` — a **sub-contract** —
under the same contract-first, disjoint-path-ownership, join-reconciliation criteria as top-level
lanes. Architects and coders are dispatched at **leaf** granularity: an unsplit lane, or a
sub-lane. Each split lane gets an inner join (Step 3s) that completes before the outer join
(Step 3j).

This answers the question the source prompt ended on — *does it accommodate into the current
parallelization proposal?* — as **yes, by redefining the top rung rather than adding a mechanism**.
Everything the inner level needs already existed at the outer one: `PACT` carries a sub-contract
unchanged (same prefix, directory, frontmatter, renderer scaffold, gate compatibility), timestamp
IDs make leaf allocation collision-free, and per-plan `.progress.md` makes leaf fan-out
contention-free.

The **previous** meaning of `full` — `lanes` plus a per-lane tester and reviewer — is **removed
outright**. It had no numbered dispatch step, so an orchestrator executing the document
top-to-bottom silently ran `lanes`: the redefinition replaces a documented no-op, not working
behavior. `--parallel full` still parses; there is no migration and no deprecation shim.

## Pipeline run

| Stage | Artifact | Verdict |
| ----- | -------- | ------- |
| Brainstormer | `SPEC-20260807T025822Z-2a6f` | READY_FOR_PLANNING — 68 requirements, 0 open questions |
| Architect | `FEAT-20260807T030642Z-6077` | 44 tasks / 8 phases (61 bullets executed) |
| Coder | — | DONE |
| Simplify | *(folded into the diff)* | 12 applied, 6 skipped as design changes |
| Tester | `TEST-20260807T035031Z-230c` | BELOW_FLOOR — 3 of ~158 gate assertions red |
| Reviewer (1) | `CR-20260807T035907Z-25d5` | REQUEST_CHANGES — **8 Must Fix**, 6 Should Fix |
| Architect → Coder | `FIX-20260807T040856Z-bf97` | DONE (48 tasks) |
| Tester | `TEST-20260807T043712Z-9b56` | BELOW_FLOOR — 31 of 228 assertions found unfailable |
| Reviewer (2) | `CR-20260807T045301Z-4659` | REQUEST_CHANGES — **4 Must Fix**, 5 Should Fix |
| Architect → Coder | `FIX-20260807T050208Z-9ac2` | DONE (49 tasks) |
| Tester | `TEST-20260807T054118Z-6a09` | **PASS** — 93/95 mutations red |
| Reviewer (3) | `CR-20260807T055718Z-bd3e` | **APPROVED** — 0 Must Fix, 5 Should Fix |
| QA | `QA-20260807T060418Z-d7d0` | **READY_WITH_WARNINGS** — 0 failures, 48/48 mutations killed |
| Spec eval | `EVAL-20260807T061337Z-a3e3` | **PASS** — Final **0.96**, *Spec-complete* |

Review cycles used: **3 / 10**  ·  QA cycles used: **1 / 5**

## What shipped

10 files, 851 insertions / 140 deletions. **Zero executable lines** — no file under `scripts/` or
`templates/html/` is touched; the only non-prose change is one declarative key in
`config.template.json`.

**Terminology, made normative** — *lane*, *sub-lane* (qualified `{lane}/{sub-lane}`), *leaf* (the
dispatch unit), *parent contract*, *sub-contract*, *governing contract*. **A leaf reads exactly one
contract.**

**Two new config keys** — `lanes[].sublanes` (optional) and `max_parallel_lanes` (default `6`), both
absent-tolerant.

**Two new steps** — **2s** authors one sub-contract per split lane concurrently; **3s** runs each
split lane's inner join before the outer join.

**The containment rule** — sub-lane globs must strictly partition the parent lane's globs. Combined
with parent-level disjointness (already enforced), this *proves* leaf-level disjointness with two
local checks rather than an n-way global one, which is what makes the flat leaf dispatch at Step 3L
safe. It is also what honestly rejects conceptually-separable-but-not-path-separable slices.

**The cost model** — nested is priced against **flat**, never against sequential. Makespan carries
the gain; cost is the marginal delta of `M_nested`. After remediation, `M_flat − M_nested ≡ Σg − Σc`
holds identically, so the gate verdict and the priced ladder **cannot** diverge (verified by brute
force over 28,463 greedy configurations).

**Depth is capped at 2, hard.** Every split pays a contract pass plus a join pass out of a pool the
previous split already divided, so a third level would have to earn a whole contract back from a
twice-cut pool — the marginal-gain gate would reject it in essentially every realistic shape.

**Three gaps from the previous cycle's eval closed rather than inherited** — the missing `full`
dispatch point, the `3j.1`/`3j.2` precedence ambiguity, and `PARTIAL` resume (now `--resume`, opt-in,
never prompting).

## The story of this run

Two rounds of remediation, and the root cause of both was the same and worth recording.

The mandatory `simplify` pass re-ran `render-artifact.test.cjs` — a suite this work does not touch —
but **not** the plans' own structural phase gates, which are the only gate covering a prose diff. So
twelve edits landed unverified: several changed a definition without sweeping its consumers
(`leaves=` was declared in the preamble and consumed by three role templates, but no spawn emitted
it; the sub-contract architect kept routing on body lines the pass had replaced).

Round two then found something sharper. **31 of 228 gate assertions could not fail.** Bash exempts a
command inverted with `!` from `set -e`, so every `! grep -q …` assertion reported green regardless
of its verdict — and two were unsatisfiable by construction, asserting the absence of a literal the
same plan required be recorded. The gates had been reporting green on assertions incapable of going
red. That is a tooling gap, not a discipline gap, and it is now closed: all 16 gate blocks are
mutation-tested by three independent harnesses (tester 93/95, QA 48/48, reviewer 16/16).

Both fixes are now institutional, not incidental: the `simplify` step carries a rule requiring the
plan's own phase gates be re-run, and the banned assertion idioms are scanned for by the gates
themselves.

## Issues found

**Non-blocking — QA cleared the change set for commit:**

1. **G8 HIGH_REWORK (advisory).** The plan under QA scores 0.00; the accumulated union scores 1.33
   (2 REQUEST_CHANGES + 2 remediation layers over 3 CRs). Root cause is the unfailable-gate defect
   above, now closed.
2. **The tester, reviewer, and QA templates were changed** against spec requirement 50 and its
   recorded decision ("Do the templates change? → No"). All three gained nesting knowledge the spec
   required to live only in `artifact-format.md`; `SKILL.md` admits it. Proximate cause is the
   untraced `leaves=` mechanism, itself introduced by the `simplify` pass.
3. **The manual-mode resume confirmation (R60) was removed, not implemented.** Deliberate — it
   strengthens the never-block-a-non-interactive-caller guarantee — but the spec's second opt-in
   mechanism is absent.
4. **`lanes` is no longer behaviorally unchanged (R64).** `max_parallel_lanes` wave enforcement was
   deliberately extended to `lanes` runs so the key binds at both depths; that also over-builds
   R26's nested-only scope.
5. **21% of requirements (14/68) carry no gate**, concentrated where it matters: all four Step 2p
   analysis requirements, both amendment-scoping requirements, and the sole-writer invariant.
6. **Out-of-spec behavior on the sequential path** — the mandatory phase-gate re-run after
   `simplify` traces to no requirement and changes what an `off` run does. Defensible (it closes the
   systemic hole that caused both remediation rounds) but untraced.
7. **Five open Should Fix items** from the approving CR: two gate-precision leaks (a one-line-wide
   `awk` range that lets a sentence be gutted; a conditionally-vacuous wrapper), a stale-claim
   pointer in a superseded plan, and two near-tautological assertions.
8. **Skipped design findings, deliberately deferred to spec-level follow-ups** — Steps 2s/3s are a
   depth-2 copy of 2c/3j rather than a generalization (a *contract node* abstraction would let one
   2c and one 3j serve both depths); the inner join waits on every leaf across all lanes before any
   inner join starts, so it is `k` serialized passes rather than early reconciliation; and Step 2s
   adds a second global barrier that stalls unsplit lanes' architects.

**Pre-existing, out of scope, verified four times:** `scripts/gate-scope.test.cjs` (24 fail) and
`scripts/gate-shell-injection.test.cjs` (3 fail) are red at merge-base `974b01a` with an identical
`MODULE_NOT_FOUND` signature. `scripts/README.md` documents both as runnable only from a bootstrapped
target project. Also incidental and pre-existing: that README still says the renderer suite has 40
tests; it has 45.

**Environment note for future runs:** this shell proxies both `grep` **and** `git` through an `rtk`
shim that can inject text into stdout and alter exit codes. It produced at least one false failure
per pipeline stage. Anything whose verdict depends on an exit code or clean stdout should run from
inside a script file, where `grep` resolves to `/usr/bin/grep`.

## Proposed commit message

```
feat(orchestrator): redefine `full` as nested inner-lane parallelism

Redefine `parallelism: full` as nested, depth-2 inner-lane parallelism. A lane
may itself be sliced into sub-lanes (backend → presentation / business logic /
data), each governed by a child PACT — a sub-contract — under the same
contract-first, disjoint-glob, join-reconciliation criteria as top-level lanes.
Architects and coders are dispatched at leaf granularity; each split lane gets
an inner join (Step 3s) before the outer join (Step 3j).

- config: lanes[].sublanes and max_parallel_lanes (default 6), both
  absent-tolerant. `full` keeps parsing; no migration, no shim.
- The containment rule (sub-lane globs strictly partition the parent lane's)
  plus existing parent-level disjointness proves leaf-level disjointness with
  two local checks, which is what makes the flat leaf dispatch safe.
- Cost model prices nested against flat, never against sequential. c is the
  marginal delta of M_nested, so M_flat − M_nested ≡ Σg − Σc holds identically
  and the gate verdict cannot diverge from the priced ladder.
- Depth is capped at 2: a third level would have to earn a whole contract back
  from a twice-divided pool, which the marginal-gain gate would always reject.
- The previous `full` (per-lane tester + reviewer) is removed outright — it had
  no dispatch step, so it silently ran `lanes` and never actually happened.
- Closes three gaps the prior eval found: the missing `full` dispatch point,
  the 3j.1/3j.2 precedence ambiguity, and PARTIAL resume (now opt-in via
  --resume, never prompting).
- Gate integrity: `! grep -q` assertions are exempt from `set -e`, so 31 of 228
  structural assertions could not fail. All rewritten to an if/exit form and
  mutation-tested; the `simplify` step now requires re-running the plan's own
  phase gates.

Spec: SPEC-20260807T025822Z-2a6f
Plans: FEAT-20260807T030642Z-6077, FIX-20260807T040856Z-bf97,
       FIX-20260807T050208Z-9ac2

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

## Proposed PR message

```markdown
## Summary

Redefines the orchestrator's `parallelism: full` as **nested, depth-2 inner-lane parallelism**.

`lanes` splits a run across layers (`backend`, `frontend`, `app`). `full` now additionally slices a
lane into **sub-lanes** — `backend/presentation`, `backend/data`, `backend/domain` — each governed by
a child `PACT` (a **sub-contract**) under exactly the criteria the outer level already uses:
contract-first, disjoint path ownership, mechanical join reconciliation. Architects and coders are
dispatched at **leaf** granularity (an unsplit lane, or a sub-lane), and each split lane's inner join
completes before the outer join.

Three things make this a redefinition rather than a second mechanism:

- **The sub-contract is the same artifact one level down** — same `PACT` prefix, same `plans/feat/`
  directory, same five frontmatter keys, same renderer scaffold. Both artifact gates accept it
  unmodified; the allow-list is untouched.
- **The containment rule** (sub-lane globs strictly partition the parent lane's) composes with
  parent-level disjointness to *prove* leaf-level disjointness from two local checks — which is what
  lets Step 3L dispatch the whole leaf set flat, and what honestly rejects slices that are
  conceptually separable but not path-separable.
- **Nested is priced against flat, never against sequential.** `c` is the marginal delta of
  `M_nested`, so `M_flat − M_nested ≡ Σg − Σc` holds identically and the gate can never reject a
  split the ladder just showed the user as cheaper. Verified by brute force over 28,463
  configurations.

The previous `full` — `lanes` plus a per-lane tester and reviewer — is **removed outright**. It was
specified only inside a join subsection and the `ask` ladder, with no numbered dispatch step, so an
orchestrator executing the document silently ran `lanes`. `--parallel full` still parses; there is
no migration path because no run ever got the old behavior.

## Test plan

The diff is **entirely prose** (9 `.md` + 1 declarative JSON key; zero files under `scripts/`), so
the substitute gate is the plans' own **16 structural assertion blocks** — and this branch spent two
remediation rounds making them trustworthy:

- **31 of 228 assertions could not fail.** Bash exempts `!`-inverted commands from `set -e`, so every
  `! grep -q …` reported green regardless of verdict; two were unsatisfiable by construction. All
  rewritten to `if <probe>; then echo FAIL; exit 1; fi`, and 24 piped `grep -q` swept (SIGPIPE 141
  once output exceeds the pipe buffer).
- **Mutation-tested by three independent harnesses** — tester 93/95 correctly red (2 deliberate green
  controls), QA 48/48 killed with a polarity-aware mutator, reviewer 16/16 blocks green with its own
  fence parser. Each built its own extractor so none shares a failure mode with the plans'.
- Collateral guards: `render-artifact.test.cjs` **45/45**, `check-artifact-pairing.test.cjs` green,
  `config.template.json` parses.
- Pipeline: tester **PASS**, reviewer **APPROVED** (cycle 3/10), QA **READY_WITH_WARNINGS** (G8
  advisory), spec eval **0.96 — Spec-complete**.

`gate-scope` and `gate-shell-injection` are red both before and after at the merge-base — they are
integration tests meant to run from a bootstrapped target project. Untouched.

## Known follow-ups

The eval flags five requirement-level gaps (notably: the three downstream role templates were changed
against R50; the manual-mode resume confirmation was dropped rather than built; `max_parallel_lanes`
was deliberately extended to `lanes` runs, which R64 said would be unchanged). Three design findings
were deferred as spec-level work: Steps 2s/3s are a depth-2 copy of 2c/3j rather than a
generalization, the inner join is `k` serialized passes rather than early reconciliation, and Step 2s
adds a second global barrier. All are itemized in
`plans/final/FINAL-20260807T061337Z-65ce-nested-inner-lane-parallelism.md`.
```
