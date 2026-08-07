---
id: FINAL-20260807T020356Z-402f
title: Optional layer-sliced parallel execution for the orchestrator pipeline
status: READY_WITH_WARNINGS
created_at: 2026-08-07T02:03:56Z
updated_at: 2026-08-07T02:03:56Z
cycle: 0
plan: FIX-20260807T013331Z-d607
related_to: SPEC-20260807T003303Z-62e3, FEAT-20260807T004018Z-c4af, FIX-20260807T013331Z-d607
---

# FINAL — Optional layer-sliced parallel execution for the orchestrator pipeline

**Related:** [SPEC-20260807T003303Z-62e3](../specs/SPEC-20260807T003303Z-62e3-orchestrator-parallel-lane-execution.md) · [FEAT-20260807T004018Z-c4af](../feat/FEAT-20260807T004018Z-c4af-orchestrator-parallel-lane-execution.md) · [FIX-20260807T013331Z-d607](../code-review/FIX-20260807T013331Z-d607-parallel-path-routing-fixes.md) · [TEST-20260807T011909Z-b155](../test/TEST-20260807T011909Z-b155-orchestrator-parallel-lane-execution.md) · [CR-20260807T012541Z-a43d](../code-review/CR-20260807T012541Z-a43d-orchestrator-parallel-lane-execution.md) · [CR-20260807T015046Z-032f](../code-review/CR-20260807T015046Z-032f-parallel-path-routing-fixes.md) · [QA-20260807T015610Z-de0d](../qa/QA-20260807T015610Z-de0d-parallel-path-routing-fixes.md) · [EVAL-20260807T020356Z-b476](../eval/EVAL-20260807T020356Z-b476-orchestrator-parallel-lane-execution.md)

## Overview

Adds an **opt-in, layer-sliced parallel execution mode** to the `orchestrator` skill. A run may
fan out one architect and one coder **per lane** (frontend / backend / mobile, or whatever the
project declares), governed by a new **`PACT` interface contract** that freezes the lane map,
disjoint path ownership, and every cross-lane interface before any lane starts. Downstream roles
(tester, reviewer, QA) run once at the **join**, over the union of the lane diffs.

Parallelism is **`off` by default**. Backward compatibility was treated as mandatory throughout:
with `parallelism` unset or `off`, every role prompt, artifact, status line, and stdout header
line is identical to the pre-feature pipeline.

## Pipeline run

| Stage | Artifact | Verdict |
| ----- | -------- | ------- |
| Brainstormer | `SPEC-20260807T003303Z-62e3` | READY_FOR_PLANNING — 43 functional requirements, 0 open questions |
| Architect | `FEAT-20260807T004018Z-c4af` | 66 tasks across 8 phases |
| Coder | — | DONE (66/66) |
| Simplify | *(folded into the same diff)* | 12 fixes applied, 3 skipped as design changes |
| Tester | `TEST-20260807T011909Z-b155` | **PASS** — coverage 97.86% → 97.89%; suite 40 → 45 |
| Reviewer (cycle 1) | `CR-20260807T012541Z-a43d` | REQUEST_CHANGES — 4 Must Fix, 4 Should Fix |
| Architect | `FIX-20260807T013331Z-d607` | 36 tasks across 6 phases |
| Coder | — | DONE (36/36) |
| Reviewer (cycle 2) | `CR-20260807T015046Z-032f` | **APPROVED** — 0 Must Fix, 2 Should Fix |
| QA | `QA-20260807T015610Z-de0d` | **READY_WITH_WARNINGS** — 0 test failures, 0 lint/type errors |
| Spec eval | `EVAL-20260807T020356Z-b476` | **PASS** — Final **0.95**, band *Spec-complete* |

Review cycles used: **2 / 10**  ·  QA cycles used: **1 / 5**

## What shipped

**New config surface** (`references/config.md`, `templates/config.template.json`)
`parallelism` (`off` default | `ask` | `lanes` | `full`, CLI `--parallel`), `lanes` (the project's
lane taxonomy, mirroring `roadmap`'s `config.systems` per ADR-0001), and `max_contract_amendments`
(default `2`).

**New `PACT` artifact** — the interface contract. A new *prefix*, not a new directory: it lives in
the existing `plans/feat/` beside the lane plans it governs, so the no-new-top-level-directory ban
holds. Six regions: lane map, disjoint path ownership, frozen interface points, unowned-file
assignment, integration lane, per-lane definition of done. It rides the generic artifact machinery
unchanged — the pairing and link gates needed zero edits.

**New pipeline steps** in `SKILL.md`
- **0c** — lane taxonomy resolution from declared config, with untrusted-metadata re-validation.
- **2p** — one read-only `Explore` slicing analysis, a printed cost/benefit evaluation (lane
  balance, task-count-weighted speedup with its assumption stated inline, contract overhead,
  interface-point count), a six-condition viability gate, two hard no-prompt guards, the `ask`
  ladder, and the fork into the parallel path.
- **2c / 2L / 3L** — contract authoring, then concurrent per-lane architects and coders.
- **3j** — the join: verify every interface row on both sides, run the integration lane, run
  `simplify` once over the union, update the `PACT` lane-status table.

**Role templates** — architect gained the `contract` type and lane-plan mode; coder gained the lane
boundary rule plus two reserved BLOCKED reasons (`lane boundary`, `contract violation`); tester,
reviewer, and QA accept a `PACT` ID at the join.

**The one executable change** — `scripts/render-artifact.cjs`: the prefix map was split into
`SCAFFOLD` + `KICKER_BY_PREFIX` so a `PACT` borrows the plan scaffold's chrome but renders under
its own label, `Interface Contract`. 5 new tests; suite 45/45.

## Design decisions worth knowing

- **No per-lane git worktrees.** Merging lanes would require commits, and the orchestrator never
  commits. Isolation is **disjoint path ownership** instead — which is why an unbounded,
  `..`-escaping, or overlapping glob is rejected at contract-authoring time and why a coder writing
  outside its globs is a hard BLOCKED, not a style note.
- **`parallelism` ships as `off`, not `ask`.** Any other default would change the behavior of every
  existing run.
- **Lane taxonomy reuses `roadmap`'s `config.systems`** rather than inventing a second layer
  vocabulary.
- **Lane membership travels in the orchestrator preamble** (`lane=` / `contract=`), never inferred
  from plan prose — a boundary rule that could be switched off by differently-worded prose would
  fail open and silently.
- **Remediation loops stay sequential.** The review and QA loops, both cycle caps, and
  `BLOCKED_STALE` handling are untouched; they simply operate over the union diff with a `PACT` ID
  where a plan ID would be.

## Issues found

**Non-blocking (QA cleared the change set for commit):**

1. **G8 HIGH_REWORK (advisory).** Union rework ratio 1.0 (1 REQUEST_CHANGES + 1 FIX over 2 CRs),
   above the 0.5 threshold. The FIX plan's own ratio is 0.0. Root cause is legible: three of the
   four cycle-1 blockers were the same defect class — routing *into* correct new machinery was
   never written.
2. **Spec requirement 16 (`off`-mode lane-detection hint) is not implemented.** The `simplify`
   pass deleted the implementing Step 0d because its firing condition was unsatisfiable (Step 0c is
   gated off in `off` mode) and printing it would have broken requirement 41's byte-identical-stdout
   guarantee. Logged in the plan's `.progress.md`, but the plan task still reads `[x]` — the removal
   was never reconciled against the task list.
3. **`full` mode has no dispatch point.** Per-lane testers/reviewers are described in `3j.3` and
   priced at the `ask` ladder, but no step spawns them and no per-lane `TEST`/`CR` IDs are
   pre-generated. An orchestrator executing the document in `full` mode runs `lanes` mode silently.
4. **The lane name/path grammar is unreachable from the architect that enforces it.**
   `references/config.md` delegates it to `roadmap/references/config.md`, which Bootstrap B3 does
   not materialize into `.orchestrator/`. Mitigated: the safety-critical owned-glob rejection list
   *is* self-contained and reachable, and Step 0c drops invalid lanes before the architect is
   spawned.
5. **`PARTIAL` resume is asserted as an outcome with no mechanism** — no detection of a prior
   PARTIAL run, no re-entry at 3L, no `PACT` recovery, yet the status line tells the user to re-run
   to resume.
6. **`3j.1` and `3j.2` have no precedence rule** — both match a lane stopping with
   `contract violation`, with opposite outcomes. Present in the source spec too (requirements 33
   vs 35), so it is inherited, not introduced.
7. **Doc nits.** The Pipeline overview still says "three no-prompt guards" where Step 2p.4 is headed
   "Two"; `scripts/README.md` still says the suite has 40 tests (now 45); two repo-relative links in
   `references/config.md` (ADR-0001, and the roadmap grammar pointer) will not resolve once B3
   materializes that file into a target project.

**Confirmed pre-existing, out of scope:** `scripts/gate-scope.test.cjs` (24 fail) and
`scripts/gate-shell-injection.test.cjs` (3 fail) are red at the merge-base `974b01a` with identical
counts. Both are integration tests the repo's own `scripts/README.md` documents as runnable only
from a bootstrapped target project, never from this authoring tree.

## Proposed commit message

```
feat(orchestrator): optional layer-sliced parallel lane execution

Add an opt-in parallel mode to the orchestrator pipeline. A run may fan out
one architect and one coder per lane (frontend/backend/mobile or whatever the
project declares), governed by a new PACT interface contract that freezes the
lane map, disjoint path ownership, and every cross-lane interface before any
lane starts. Tester, reviewer, and QA run once at the join over the union diff.

- config: parallelism (off|ask|lanes|full, --parallel), lanes, and
  max_contract_amendments; parallelism defaults to off so no existing run
  changes behavior.
- Step 2p prices the split before offering it: lane balance, task-count
  speedup with its assumption stated inline, contract overhead, and a
  six-condition viability gate that falls back to sequential with a reason.
- Isolation is path ownership, not worktrees: merging lanes would require
  commits, and the pipeline never commits. Lane membership travels in the
  orchestrator preamble so it cannot be switched off by plan prose.
- PACT is a new prefix in the existing plans/feat/, not a new directory; the
  pairing and link gates accept it unchanged.
- render-artifact: split the prefix map into SCAFFOLD + KICKER_BY_PREFIX so a
  PACT borrows plan chrome but renders as "Interface Contract".

Spec: SPEC-20260807T003303Z-62e3
Plan: FEAT-20260807T004018Z-c4af, FIX-20260807T013331Z-d607

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
```

## Proposed PR message

```markdown
## Summary

Adds an **opt-in, layer-sliced parallel execution mode** to the `orchestrator` skill.

A run may now fan out one architect and one coder **per lane** — frontend / backend / mobile, or
whatever the project declares — instead of driving a single sequential plan. The slicing is
governed by a new **`PACT` interface contract** that freezes the lane map, disjoint path
ownership, and every cross-lane interface *before* any lane starts, so reconciliation at the join
is mechanical rather than a merge negotiation. Tester, reviewer, and QA each run once at the join,
over the union of the lane diffs.

The user is never opted in silently. `parallelism` defaults to `off`; `--parallel ask` prints a
priced cost/benefit evaluation (lane balance, task-count-weighted speedup with its assumption
stated inline, contract overhead, interface-point count) and a viability verdict before offering
the three levels. Six named conditions make the orchestrator refuse the split and fall back to
sequential with the reason printed.

Two invariants shaped the design:

- **Isolation is path ownership, not worktrees.** Merging lanes would require per-lane commits,
  and the pipeline never commits — so lanes share one workspace and are separated by disjoint
  globs. That makes an unbounded/escaping/overlapping glob a contract-authoring rejection and a
  cross-boundary write a hard `BLOCKED`.
- **Backward compatibility is mandatory.** With `parallelism` unset or `off`, every role prompt,
  artifact, status line, and stdout header line is identical to the pre-feature pipeline.

## Test plan

- `node --test scripts/render-artifact.test.cjs` — **45 pass / 0 fail** (was 40). 5 new cases:
  `PACT` scaffold + label routing, conformance shell, CLI e2e, and a `MAP(a)/MAP(b)` backfill
  locking all nine prefix→scaffold entries (six had zero coverage before).
- `node --test scripts/check-artifact-pairing.test.cjs` — pass.
- `clean-code-gates` — 106/106.
- Coverage 97.86% → **97.89%**; branch coverage 87.84% → **88.74%**.
- Pipeline gates: tester **PASS**, reviewer **APPROVED** (cycle 2/10), QA **READY_WITH_WARNINGS**
  (G8 rework-risk advisory only), spec eval **0.95 — Spec-complete**.

Two sibling suites (`gate-scope`, `gate-shell-injection`) are red both before and after this change
at the merge-base — they are integration tests meant to run from a bootstrapped target project, not
from this authoring tree. Untouched.

## Known follow-ups

`full` mode is documented and priced but has no dispatch point yet (it silently degrades to
`lanes`); the `off`-mode lane-detection hint was dropped during simplification as unsatisfiable;
`PARTIAL` resume is asserted without a mechanism. See the Issues section of
`plans/final/FINAL-20260807T020356Z-402f-orchestrator-parallel-lane-execution.md`.
```
