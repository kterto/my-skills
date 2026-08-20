---
id: FINAL-20260819T062651Z-a94f
title: Final Report — Top-level integration lane, report schema, Prime scan child
status: READY_TO_COMMIT
created_at: 2026-08-19T06:26:51Z
updated_at: 2026-08-19T06:26:51Z
cycle: 0
---

## Related

- Spec: [SPEC-20260819T052229Z-3d97](../specs/SPEC-20260819T052229Z-3d97-integration-lane-schema-prime-scan-fixes.md)
- Plan: [FEAT-20260819T053237Z-236f](../feat/FEAT-20260819T053237Z-236f-integration-lane-schema-prime-scan.md)
- Test report: [TEST-20260819T060155Z-5bec](../test/TEST-20260819T060155Z-5bec-integration-lane-schema-prime-scan.md)
- Code review: [CR-20260819T061027Z-4206](../code-review/CR-20260819T061027Z-4206-integration-lane-schema-prime-scan.md)
- QA report: [QA-20260819T061740Z-1afa](../qa/QA-20260819T061740Z-1afa-integration-lane-schema-prime-scan.md)
- Spec eval: [EVAL-20260819T062651Z-1d9c](../eval/EVAL-20260819T062651Z-1d9c-integration-lane-schema-prime-scan.md)

## Summary

Remediates the three findings in the 2026-08-19 PR-review backlog, batched into one run.

1. **arch-1 (high)** — the orchestrator's flat cost model priced the serial top-level integration lane inside a `max` over concurrent lanes. `span_base`, `span_max` and `M_flat` now add `tasks(integration)`; the top-level split must declare the field with the same strict shape and reject-on-omission rule the sub-lane split uses; the lane is excluded from the two work-concentration conditions at both evaluation sites. Recorded as **ADR-0016**.
2. **bug-1 (med)** — `report.schema.json` declared `summary` with `additionalProperties: false`, no `gatesErrored`, and a three-value status enum, while `report.cjs` emits `gatesErrored` unconditionally and can emit `status: "error"`. Every report failed its own schema. Schema and the three documentation sites corrected; the test validator was rewritten from a hand-rolled key/type checker into a generic recursive one.
3. **bug-2 (med)** — the Prime port never resolved a scan agent, so both callers gathered their digest inline on every run. Five `count: 1` overlay replacements rewrite the resolution to `rlm()`.

Aggregate against base `4c2deec`: 19 files, +429/-201, plus ADR-0016. Suite 213 → 225.

## The derivation that governs concern 1

With `X = tasks(integration_top)`, `M = max` over non-integration lanes of `tasks(L)`, `S = max` of `span(L)`: the fix makes `span_base = M + X` and `span_max = S + X`, so **`g = M − S` and the `+X` cancels identically**; `c` is a delta of the overhead term only and is unchanged at every branch. Consequences:

- Under a **viable flat baseline**, `g` is unchanged on `X ≤ S ≤ M`, understated by `X − S` on `S < X < M`, and understated by the whole gain on `X ≥ M ≥ S`. The correction is never downward.
- Under an **`M_seq` baseline**, `g` drops by `min(S, X)` — the optimistic direction the finding named.
- `M_flat − M_nested = g − c` is preserved, so this was never a gate/ladder disagreement: both figures were wrong in the same direction.

All four pre-existing worked examples have `X = 0`, so no figure moved — proven structurally (no removed line falls inside any derivation body) as well as by hand re-derivation. A new `X > 0` example was added and reconciles exactly: `M_flat − M_nested = 29 − 25.5 = 3.5 = g − c = 8 − 4.5`, with `g = M − S = 20 − 12 = 8`.

## Pipeline

| Step | Outcome |
|---|---|
| Brainstormer | SPEC-...-3d97, 0 open questions; all three concerns independently confirmed |
| Architect | FEAT-...-236f, 4 phases / 49 tasks |
| Coder | DONE, 49 tasks, 213 → 219 |
| Simplify | 5 angles / 3 agents; 2 fixed, 7 skipped with reasons, 0 bugs |
| Tester | PASS, 219 → 225 |
| Review cycle 1 | APPROVED — 0 must-fix, 5 should-fix |
| QA | READY_TO_COMMIT — 0 failures, G8 0.0 |
| Spec eval | PASS, Final 1.00 (Spec-complete), 151/152 |

Review cycles used: 1 / 10. QA cycles used: 1 / 5.

## Issues found

1. **The test validator honours 7 of the 10 keywords the schema uses** — `pattern` (×1), `format` (×1), `minimum` (×4) are unenforced. The acceptance criteria name exactly the seven implemented, so this is a criteria gap, not an implementation miss. It is a **test fixture**: nothing in `src/` validates at runtime, so an unenforced keyword can only miss a builder regression, never mis-accept a report in production.
2. **The rewrite silently dropped a pre-existing check.** The base validator had `finding.line < 1`; the generic rewrite does not implement `minimum`, so `line: 0` now validates clean. Narrow and non-production — every finding-construction site in both adapters floors via `|| 1` — but it sharpens item 1 from "latent gap" to "one capability actually lost".
3. **`checkNode` is at cyclomatic 11 and `checkObject` at nesting 3.** Any follow-up adding `pattern`/`minimum` touches exactly that function and worsens both unless it refactors at the same time.
4. **`span(L)` and `span_max` are the same "concurrent max plus serial remainder" formula written at three sites.** A single form over any slice set would subsume both and make ADR-0016's cancellation identity true by construction rather than something the ADR must derive. Judged smaller than what landed, but out of scope: it supersedes the framing ADR-0016 was written around and would void the hand verification that is this half's only guard. Filed for ADR-0017.
5. **Three sibling Prime skills still carry unrewritten host vocabulary** — `explain-codebase/SKILL.md:17`, `roadmap/SKILL.md:58`, `simplify/SKILL.md:67`. Confirmed **not** a regression: zero lines changed in those files. Same port defect one skill over.
6. **An AC text error, not a code error:** AC-32's parenthetical mislabels the second surviving `subagent_type` prohibition as the Step-4 role-dispatch note; it is the condition-6 fan-out note.

## Corrections made during the run

- **ADR-0016 quoted ADR-0014 "in its own words" for wording this same change had rewritten.** The quoted phrase and the "Not addressed here" label no longer existed in the file being cited. Replaced with an accurate description plus a note on why nothing is quoted.
- **`key in properties` / `key in value` consult the prototype chain**, so a report carrying `toString`, `constructor` or `__proto__` passed the unknown-key check (confirmed by probe). Both switched to `Object.hasOwn`.
- **ADR-0016's `g` derivation omitted the middle branch `S < X < M`** (the eval's single scored miss). All three branches now enumerated, with a note on why the middle one is the easiest to omit and the most plausible-looking when wrong.

## Test plan

- `cd plugins/my-skills/skills/clean-code-gates && npm test` — 225 pass / 0 fail (baseline 213).
- `node scripts/build-prime-agent.mjs --check` — exit 0, 11 skills / 154 files.
- `cd prime-agent && npm test` — install + parity, exit 0.
- Overlay anchors re-censused at 3 / 3 / 2.
- Falsification, not confirmation: the strengthened validator was run against the restored pre-fix schema and produced 4 failures with the expected messages; a 2x2 cross-run additionally showed old tests + old schema green while `report.cjs` emitted the violating shape — the defect was invisible by omission, not by validator weakness.
- Concerns 1 and 3 have no executable path (`parallelism` is `off`, `full` unreachable). Verification there is arithmetic and structural; coverage is inapplicable, not below floor.
