# b3-app run forensics — the third pass on the same symptom

**Date:** 2026-09-04 · **Corpus:** `b3-app` (`SPEC-20260904T000644Z-875d`, 15h04m, HEAD `b48998e`)
**Report:** [The Unmeasured Gate](../The%20Unmeasured%20Gate.html) · published at
<https://claude.ai/code/artifact/ca1eb329-6836-42ab-bbd7-7835952a0848>
**Predecessor:** [The Rework Cascade](../The%20Rework%20Cascade.html) — lotery_oracle + toodls, which
produced fixes P1–P8.

## Why this one exists

b3-app is the first full run after all of P1–P8 shipped (`4313210`, `c59432c`, `967a9e4`, `93989e9`,
`f830043`, `59e1887`, `de6ca06`). They held: the cascade stayed inside one family with honest cycle
numbers, and nothing escaped the caps. **Containment worked; convergence did not.** Every ceiling was
reached inside one invocation — review 6/6, eval 2/2, family 6/6 — and the run shipped
`READY_WITH_WARNINGS` anyway. Saturation replaced escape.

## What the numbers say

| Measure | Value |
| ------- | ----- |
| Review loop | 03:14:35 → 12:59:37 — **64.7%** of wall clock |
| Production moved by that loop | **+226/−26** in `lib/`, against the build phase's +2538/−21 (**under 9%**) |
| Remediation cycles changing zero `lib/` files | **3 of 5**; `lib/` byte-identical from 07:24:40 through `HEAD` |
| After the reviewer's `APPROVED` (0 must-fix) | **23.9%** of the run, eval-driven, `Final` 0.94 → 0.98 |
| Spec size | 53 requirements — **96.6th percentile** of 218 specs (median 14, p75 ≈ 25) |
| Coupling hypothesis | **refuted** — zero RED suites across all 17 ledger rows |

## Method, and what it cost the conclusions

22 agents over two workflows: 11 investigation dimensions, then 10 adversarial verifiers instructed
to default to REFUTED and re-derive every number from source, plus a patch designer that generated
real `mutation_test` 1.8.0 reports and executed each proposed fix against them.

**Nine of ten claims came back weakened; none survived unchanged.** That is the point of recording
the method here — the first-pass numbers were not safe to act on:

- The missing class-sweep contract cost about **one** cycle, not five. The pipeline generalised on
  its own (a 39-row guard inventory by cycle 2) without any contract asking it to.
- Pinning `.gitignore` out of the tree hash saves **~zero**. The 17 ledger rows are 17 distinct
  `(suite, tree)` pairs, so the run offered one inheritance opportunity and took it.
- The dominant read cost is the reviewer's per-cycle whole-tree snapshot (4.97 MB over six cycles),
  **12×** the ~1.97 MB protocol floor.
- The corpus predicts ~3 CRs for a 53-requirement spec and this run took 6, so **at most half** the
  review cost is attributable to size. Size is a multiplier, not a threshold: the worst family in the
  corpus is a 12-requirement spec.

## G6 — the branch this run motivated

`dart_mutant` 0.4.0 silently ignores `--test-command` (it hardcodes `dart test`, which cannot run a
Flutter suite) and `--glob`. On b3-app every mutant failed in ~3s and scored as *Killed*: a completed
run would have reported **100.0**. `UNMEASURED` was the better outcome.

The `mutation_test` replacement was then found to have three defects of its own, all reproduced
against reports the real tool emits — score inflation from unread `errors=`, wrong-file attribution
from self-closing `<testcase/>`, and `error` on any zero-mutant scope. See the report and commits
`0d00c65`, `003d836`.

## Disposition

Every proposal in the report's Part III is implemented, with two deliberate deviations recorded in
the commits:

- **`MAESTRO_PREV_CR_REF` was removed, not wired.** ADR-0022 rejected per-cycle narrowing on value
  rather than safety and recorded what would reopen it; leaving a live env-var hook for the declined
  behaviour is the undisclosed narrowing that ADR warns about.
- **`.gitignore` pinning was not done** — measured at ~zero saving, above.

The resulting protocol changes were themselves put through a six-lens adversarial review, which
returned **38 findings including two critical** in the fixes. All 38 are closed; see
`fix(orchestrator): repair the backlog changes against their own review`.

## What could not be settled

- **Whether the six cycles were avoidable at all.** Fourteen real defects were found and every one
  was caught by executing a mutation rather than by reading. Had G6 worked, most would have surfaced
  in one QA pass — but G6 has never produced a number on this stack, so the counterfactual is
  untested. It is also the strongest argument for finishing the G6 work properly.
- **The "at most 14 of 59 findings are regressions" figure does not reproduce.** Loose definition: 40
  of 59. Tight: 1 of 45. The conclusion it supported survives on other evidence; the number should
  not be quoted.
- **Whether `parallelism: "ask"` ever evaluated this run.** It was armed and 145 tasks were admitted
  with no trace that the viability step ran.
- **Progress-log timestamps are model-authored** and cannot be used to attribute cost. Every timing
  above comes from ledger boundaries and artifact frontmatter instead.
