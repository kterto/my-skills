---
id: FINAL-20260819T051010Z-ec8c
title: Final Report — Adopt ADR-0013, overlapped inner joins
status: READY_TO_COMMIT
created_at: 2026-08-19T05:10:10Z
updated_at: 2026-08-19T05:10:10Z
cycle: 0
---

## Related

- Spec: [SPEC-20260819T034803Z-18d2](../specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md)
- Plan: [FEAT-20260819T035826Z-835a](../feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md)
- Fix plan: [FIX-20260819T043728Z-13ae](../code-review/FIX-20260819T043728Z-13ae-inner-join-run-site-prose.md)
- Test report: [TEST-20260819T042313Z-1acb](../test/TEST-20260819T042313Z-1acb-adopt-overlapped-inner-joins.md)
- Code review: [CR-20260819T045602Z-221d](../code-review/CR-20260819T045602Z-221d-inner-join-run-site-prose.md)
- QA report: [QA-20260819T050419Z-cfd2](../qa/QA-20260819T050419Z-cfd2-inner-join-run-site-prose.md)
- Spec eval: [EVAL-20260819T051010Z-7b6d](../eval/EVAL-20260819T051010Z-7b6d-adopt-overlapped-inner-joins.md)

## Summary

Adopts ADR-0013 (`Proposed` -> `Accepted`). The orchestrator's Step 3s global leaf barrier becomes per-lane — a lane's inner join begins as soon as its own sub-lanes are DONE, concurrently with leaves still running elsewhere — and the inner-join charge drops from `k × J` to `J`, charged on the first adoption only. Barrier and charge changed together, as ADR-0013 requires: charging slowest-of-k while the skill still serializes is the "gate and ladder on two accounts" defect `references/config.md` exists to prevent.

Aggregate against base `5403eee`: 9 files, +334/-85 — three markdown skill files, three ADRs, and the regenerated `prime-agent/skills/**` mirror.

## What the brainstormer resolved

ADR-0013 shipped with four self-named open questions. All four were answered from the skill text, and the resolution overturned the ADR on one:

- **Deferred gates** — the ADR offered a lock as option B. Killed: an unscopable gate is by definition one with no path-scoped form, so it reads outside the lane and containment covers nothing about it. A lock serializes the invocation without settling its input, falsifying Step 3s's own "run each once over the settled lane union". Deferred gates now collect at 3s and run only at 3j item 4, which already de-duplicates and already blocks.
- **Lane-status writes** — safe as-is; the orchestrator is sole writer and is one agent. What overlaps is subagent execution, not orchestrator steps.
- **Determinism** — execution goes wall-clock; the two observable surfaces (artifact writes, `SUBJOIN` print order) are pinned explicitly.
- **`PARTIAL`** — consistent, provided the halt is recorded at 3s and taken at 3j.

## Three hazards ADR-0013 did not name

Each would have made the change unsafe alone:

1. **Step 3j needed its own barrier.** Its claim that "every inner join has already completed" was true only because of the barrier being removed; an integration sub-lane coder can outlive the last leaf.
2. **The 3j.2 amendment loop could invalidate an in-flight leaf**, contradicting "Never abandon a running leaf". Resolved by recording at 3s and entering the loop at 3j in row order.
3. **`max_parallel_lanes` stopped binding**, because integration coders now run alongside a leaf wave.

## Pipeline

| Step | Outcome |
|---|---|
| Brainstormer | SPEC-...-18d2, READY_FOR_PLANNING, 0 open questions |
| Architect | FEAT-...-835a, 4 phases / 63 tasks |
| Coder | DONE, 103 tasks |
| Simplify | 1 fix (duplicated containment restatement cut), 0 bugs |
| Tester | PASS — coverage N/A by design; 3 stale prose sites found |
| Review cycle 1 | REQUEST_CHANGES — 1 must-fix, 4 should-fix |
| Review cycle 2 | APPROVED — 0 must-fix |
| QA | READY_TO_COMMIT — 58 checks, 0 failures |
| Spec eval | PASS, 0.91 Spec-complete, I = 57/57 |

Review cycles used: 2 / 10. QA cycles used: 1 / 5.

## Issues found

1. **Five propositions ship correct but unguarded** — FR-3, FR-7, FR-9, FR-14, FR-19a. Each can be silently reverted with nothing failing. The entire eval shortfall is this. Five one-line greps close it; listed in the eval report.
2. **`references/config.md:391`** writes `I(4×0.25=1)` where `:386` five lines above writes `I(4×0.25=1.0)`, and both upstream artifacts agree with `:386`. An exhaustive sweep confirms `:391` is the sole outlier. Cosmetic; should ride the next change touching that file rather than trigger a rebuild alone.
3. **Two milder imprecisions at `SKILL.md`:958**, both inherited rather than introduced: the opening subject "Path-scoped gates defer" inverts the criterion stated correctly at `:947` and `:989` (pre-existing since base), and "records rather than running the gate" is bound generically to "the nearest enclosing join", which is false of the outer join named in the same breath. AC-1 itself carries the second imprecision, so it is a plan-authoring artefact, not a coder deviation.
4. **The spec's one real weakness** — its *Affected surface* missed three stale run-site prose sites, which the code review had to catch. Recorded as the `E_recall` miss.
5. **G8 = 1.0 scoped to the aggregate, 0.0 scoped to this plan.** Not flagged HIGH_REWORK: 1.0 is the arithmetic floor for any change taking exactly one remediation cycle, so the formula scores every single-fix-round change identically.

## Corrections made during the run

- The spec's FR-16 stated the superseded serialized k=2 `M_nested` as **20**; its own expression yields **19** (`span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1.0)`). The coder shipped 19 rather than transcribe a self-refuting figure into the one file whose premise is that gate and ladder agree; tester, reviewer and eval each confirmed it independently, and 19 was folded back into the spec and the plan.
- Three verification rows were unsatisfiable or vacuous as written (a `git status` clean check the never-commit invariant forbids; a banned-literal grep that would have deleted the plan's own acceptance criterion; a `git diff` over an untracked file). Each was replaced with a strictly stronger substitute.

## Test plan

- No behavioural test exists or can exist: `parallelism` defaults to `off` and `full` with k >= 2 is unreachable in this repo. Verification is structural and arithmetic.
- Arithmetic: all four worked examples re-derived by hand at four independent stages. Both k=2 reconciliations close — overhead delta 9-4 = 5 = 4.5+0.5; span reduction 24->8 = 16 = 14+2. Overlap saving 19-17 = 2 = (k-1)×J, matching the document's own claim.
- No-regression floor over unrelated surface: `clean-code-gates` 213/213, `prime-agent && npm test` exit 0, `node scripts/build-prime-agent.mjs --check` exit 0 (11 skills, 154 files).
- Generated-tree integrity: `--check` exit 0 is the strong form; `git status` cannot show clean because the pipeline never commits.
- Overlay anchors re-counted at 3 / 3 / 2.
