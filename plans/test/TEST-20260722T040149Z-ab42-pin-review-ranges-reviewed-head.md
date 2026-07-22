---
id: TEST-20260722T040149Z-ab42
plan: FEAT-20260722T035033Z-3962
title: Test Report — Pin pr-review-report review ranges and provenance to reviewed_head
status: PASS
created_at: 2026-07-22T04:06:09Z
cycle: 0
---

**Related:** [FEAT-20260722T035033Z-3962](../feat/FEAT-20260722T035033Z-3962-pin-review-ranges-reviewed-head.md)

## Summary

`FEAT-…-3962` is a **doc-skill change** — it pins every `pr-review-report` review
range and provenance command to the Step-1 `reviewed_head` snapshot and adds a
Step-8 drift warning. Per `PROJECT-CONTEXT.md` (§ Test tooling), this repo has **no
automated test framework or coverage for doc skills**; verification is structural,
complemented by the skill's self-contained shell fixtures. The `clean-code-gates`
JS suite is Invariant-scoped and was **not** run against this skill, as directed.

All runnable gates in scope are **green**:

| Runnable gate | Result |
| --- | --- |
| `__tests__/provenance-gate.test.sh` (mirrors pinned Step 2b) | PASS (cases A/B/D) — exit 0 |
| `__tests__/drift-warning.test.sh` (NEW — mirrors Step 8, AC6/AC11) | PASS (3/3) — exit 0 |
| `scripts/validate-pr-review-skill.sh` (executable structural gate) | PASS (sec-1 + marketplace/opencode) — exit 0 |

Every acceptance criterion (AC1–AC11) was verified structurally; the two previously
grep-only criteria (AC6 drift-fires-once, AC11 silent-when-unchanged) are now
**executable** via the added fixture.

## Flows Triaged

"Flows" here are skill behaviors described in prose; e2e = none exists (§ Test
tooling). Criticality = user-impact × breakage-likelihood × not-covered-structurally.

| Flow | Criticality | Decision | Rationale |
| --- | --- | --- | --- |
| Provenance gate judges the pinned tree (Step 2b, `$mb`...`reviewed_head`) | HIGH | Covered (existing fixture) | Security-load-bearing (sec-2); coder-authored fixture already mirrors the pinned command — re-ran, green. |
| Drift warning fires once, only on HEAD move, silent otherwise (Step 8, AC6/AC11) | HIGH | **Added executable fixture** | The plan's only genuinely-new runtime behavior; was grep-only. Backward-compat (silent when HEAD unchanged) is the load-bearing invariant and now has a real assertion. |
| Range pins in Steps 1/2/3 (`$mb`/`$base`...`reviewed_head`) | MED | Structural sweep (no fixture) | Pure string substitution in prose bash; no isolatable runtime seam beyond what grep proves. Re-implementing each `git diff` range in a fixture would tautologically re-assert the substitution. Excluded deliberately. |
| opencode-port-parity of the pinned lines (AC9) | HIGH | Structural cross-copy diff | Invariant. `diff` of the pinned command lines between plugin and `.opencode` copies is identical (PARITY-OK); not a behavioral flow, so no fixture. |
| Reference audit — no restated `..HEAD` range (AC10) | MED | Structural grep | Verified in-place note in `review-data-schema.md`; grep confirms no live `...HEAD` review range in either copy. |

**Deliberate e2e exclusion:** no e2e framework exists in this repo (§ Test tooling)
and the change ships no executable application surface — e2e is N/A, not skipped for
cost. The shell fixtures are the project-blessed runnable equivalent and are green.

## E2E Tests Added

None (no e2e framework in this repo). One **unit-equivalent shell fixture** added,
mirroring the established `provenance-gate.test.sh` pattern (test file only):

- `plugins/my-skills/skills/pr-review-report/__tests__/drift-warning.test.sh`
  - Case A — HEAD not moved → **zero output** (AC11 backward-compat: warning suppressed).
  - Case B — HEAD moved after capture → **exactly one** `HEAD-DRIFT` line (AC6) that
    **names the moved-to short sha**.
  - Re-implements the Step-8 `drift()` logic the same way the provenance fixture
    re-implements Step 2b, and carries a "keep in sync with SKILL.md step 8" note.

## Coverage

- **Before → After: N/A (not measured).** Per `PROJECT-CONTEXT.md` § Test tooling,
  coverage "is not measured except within `clean-code-gates`," and the tester role
  treats the 70% floor as advisory/N/A for doc-skill diffs — it is not a hard block.
  The `clean-code-gates` JS suite is Invariant-scoped and was correctly **not** run.
- Runnable-gate coverage of this diff went **up**: the Step-8 drift behavior moved
  from grep-only to an executable fixture (2 new assertions covering AC6 + AC11).

## Test-Quality Audit

- **Coder-authored `provenance-gate.test.sh`:** high quality. Three real assertions
  (A/B/D) with distinct expected values; no empty asserts, no tautologies; fixture
  mirrors the pinned Step-2b command and is kept in-sync by comment. Re-ran: green.
- **`scripts/validate-pr-review-skill.sh`:** exercises the sec-1 seam-injection
  regression (escaped seam intact + payload inert + vuln reproduced unescaped) and
  marketplace/opencode structural parity. Meaningful assertions, green.
- **Advisory (out of this plan's scope, pre-existing):**
  `references/report-template.demo.html` line 893 still shows
  `"commitRange": "ab12cd3..HEAD"`, which now **contradicts** the sibling
  `review-data-schema.md` note this plan added ("`commitRange` … PINNED … never a
  moving `..HEAD`"). The demo file is **not** in this branch's diff and predates
  bug-9's fix, so it is not a blocker for `FEAT-…-3962`, but the stale sample is
  worth correcting in a follow-up for internal consistency.
- **Test-tooling note:** adding the new fixture made `plugins/my-skills/skills/index.json`
  stale (the generator mechanically enumerates every skill file). Ran the documented
  remediation `node scripts/generate-opencode-skill-index.mjs`; the diff is a single
  new-entry line for `drift-warning.test.sh`, and `validate-pr-review-skill.sh` is
  green again. This is generated-manifest hygiene, not a production-logic change.

## Verdict

**PASS.** All runnable gates in scope are green (provenance fixture, new drift-warning
fixture, `validate-pr-review-skill.sh`); AC1–AC11 verified structurally with AC6/AC11
now executable. Coverage floor is N/A for doc-skill changes per PROJECT-CONTEXT and
is not a block. Ready for reviewer.
