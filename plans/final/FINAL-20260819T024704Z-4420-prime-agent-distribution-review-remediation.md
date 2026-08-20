---
id: FINAL-20260819T024704Z-4420
title: Final Report — Prime Agent distribution review remediation
status: READY_WITH_WARNINGS
created_at: 2026-08-19T02:47:04Z
updated_at: 2026-08-19T02:47:04Z
cycle: 0
---

## Related

- Spec: [SPEC-20260819T000458Z-bfac](../specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md)
- Plan: [FEAT-20260819T001630Z-be84](../feat/FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md)
- Fix plan (cycle 1): [FIX-20260819T012309Z-b208](../code-review/FIX-20260819T012309Z-b208-prime-agent-remediation-cr-fixes.md)
- Fix plan (cycle 2): [FIX-20260819T020345Z-48c5](../code-review/FIX-20260819T020345Z-48c5-gateable-scope-guard-installer-rollback.md)
- Test report: [TEST-20260819T022100Z-2621](../test/TEST-20260819T022100Z-2621-gateable-scope-guard-installer-rollback.md)
- Code review: [CR-20260819T023032Z-d934](../code-review/CR-20260819T023032Z-d934-gateable-scope-guard-installer-rollback.md)
- QA report: [QA-20260819T023647Z-5465](../qa/QA-20260819T023647Z-5465-gateable-scope-guard-installer-rollback.md)
- Spec eval: [EVAL-20260819T024704Z-1a02](../eval/EVAL-20260819T024704Z-1a02-prime-agent-distribution-review-remediation.md)

## Summary

Remediates all 17 findings from the PR review of `feat/prime-agent-distribution`, across four families: a shell-injection hole and an installer path-traversal hole; four `clean-code-gates` defects that let a gate run report green while measuring nothing; five Prime-port adaptation gaps; and packaging/documentation defects.

Aggregate against base `09fa490`: 58 files changed, +1715/-308. Test suite 106 -> 206. Coverage 77.23% -> 86.77%.

## Pipeline

| Step | Outcome |
|---|---|
| Brainstormer | SPEC-...-bfac, 86 FRs, READY_FOR_PLANNING. Corrected 3 backlog premises against real code; excluded 2 adjacent defects and filed them. |
| Architect | FEAT-...-be84, 7 phases / 67 tasks / 25 ACs |
| Coder | DONE, 90 tasks |
| Simplify | 8 cleanups applied; 3 correctness bugs reported, not folded in |
| Review cycle 1 | REQUEST_CHANGES — 4 must-fix (incl. MF-4, found by the reviewer alone) |
| Review cycle 2 | REQUEST_CHANGES — 2 must-fix (incl. installer rollback bug found by the reviewer alone) |
| Review cycle 3 | APPROVED — 0 must-fix, 12/12 ACs |
| QA | READY_WITH_WARNINGS — 0 failures, G8 HIGH_REWORK 1.33 |
| Spec eval | 0.91 Spec-complete, status ISSUES |

Review cycles used: 3 / 10. QA cycles used: 1 / 5.

## Issues found

1. **G8 HIGH_REWORK (1.33)** — non-blocking. Three CRs, two REQUEST_CHANGES. Both fix cycles caught real reviewer-reproduced defects, but both landed on the same bug class: a guard reporting success at protecting something it did not protect. Root-cause question for a human.
2. **FR-60 (confirmed defect)** — G5's scanner has no `${}` interpolation state, so a `//` inside a template literal is reported as a comment, and a real comment after a Dart raw string ending in a backslash is swallowed.
3. **FR-44 (confirmed defect)** — `install.sh:101` runs `mkdir -p "$destination"` before staging and never unwinds it, so a failed fresh install leaves an empty `.prime/agent/skills` chain while stderr says the destination "was restored to its previous state". Material harm is prevented and tested; only the literal clause fails. Same item the reviewer raised as SF-1.
4. **20 of 86 requirements have no automated guard** — most notably all ten arch-1 requirements, which have neither a test nor an overlay anchor: deleting the entire nested cost-model remediation still yields `--check` exit 0. Eval records `T = 0.77` as an upper bound.
5. **G1 below threshold on two adapters** (node-ts 58.36, dart-flutter 64.80) — tracked debt, not blocked. Uncovered ranges are exclusively external-tool bodies behind `missingTool()` guards; covering them needs eslint/stryker/dependency-cruiser installed, which PROJECT-CONTEXT puts out of scope. Every changed file improved or held.
6. **node-ts monorepo G1 cannot execute** (filed beyond spec) — roots now resolve to `apps/api/src`, but the adapter has no `packageDir` equivalent to Dart's. Combined with the new FR-28 rule this turns a silent no-op into a flood of zero-coverage blockers on the first monorepo run.
7. **5 non-blocking Should Fix** items remain open in the approved CR.

## Deferred, with written reasons

Three adjacent defects found during the run, judged out of scope and filed rather than silently absorbed: the flat/outer cost model omits the top-level integration lane; `report.schema.json` forbids the `status: "error"` that `report.cjs` emits; Prime scan-agent resolution still names `subagent_type`.

## Test plan

- `cd plugins/my-skills/skills/clean-code-gates && npm test` — 206 pass / 0 fail (baseline 106)
- Same 206 verified on the generated `prime-agent/skills/` copy
- `cd prime-agent && npm test` — install preflight, containment, all-or-nothing install, mid-loop rollback, parity — exit 0
- `node scripts/build-prime-agent.mjs --check` — exit 0, 11 skills / 154 files
- Blocker closures verified by mutation: reverting `assertNonEmptyScope` killed by 6 tests; reverting `rollback()` killed with "a failed fresh install left 3 skills behind"
