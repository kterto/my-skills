---
id: TEST-20260721T230735Z-784a
plan: FEAT-20260721T225557Z-02b3
title: Test Report — Guard autonomous rollback against erasing concurrent work
status: PASS
created_at: 2026-07-21T23:09:05Z
cycle: 0
---

**Related:** [FEAT-20260721T225557Z-02b3](../feat/FEAT-20260721T225557Z-02b3-rollback-concurrency-safety-guard.md)

## Summary

Documentation-only plan: a single-file prose/procedure change to
`plugins/my-skills/skills/validation-fixer/SKILL.md` adding a concurrency-safety guard to the
failure-path rollback. Per **PROJECT-CONTEXT §Commands / §Test tooling**, this repo has **no
automated build/test/lint** for doc-skill authoring, **no e2e framework**, and coverage is **not
measured** outside `clean-code-gates` — whose JS suite is Invariant-scoped and was **not run** here
(PROJECT-CONTEXT §Invariants line 69, and the plan's own Verification/Technical-Notes constraints).

Automated tests + coverage are therefore treated as **N/A / advisory, not a hard block** (the
project-declared tester posture). Verification is **structural**: the tester confirms the SKILL.md
change satisfies its acceptance criteria, that cross-references resolve, that the two named
regression traces read verbatim, and that the diff is confined. All structural checks **passed**.

## Flows Triaged

"Flows" for a doc skill are behaviors described in prose, verified by review — there is no runtime
to exercise (PROJECT-CONTEXT §Critical flows). e2e is expensive and requires an executable target;
none exists for this change.

| Flow | Criticality | Decision | Rationale |
| --- | --- | --- | --- |
| Autonomous failure-path rollback (concurrency guard) | High user-impact, but non-executable prose | **Excluded from e2e** | No runtime/e2e framework in repo; behavior is a documented procedure. Verified structurally against AC-1…AC-9 instead. |
| Enumerated untracked `rm` vs. `git clean -fd` blast radius | High | **Excluded from e2e** | Same — no executable skill target. Structurally verified: recipe is `git clean`-free; `-x` stays forbidden. |
| Uncommitted-only failure posture | Medium | **Excluded from e2e** | Prose posture; structurally verified present and honest (no perfect-attribution claim). |
| `clean-code-gates` JS suite | N/A | **Excluded (forbidden)** | Invariant-scoped to that skill only; MUST NOT run against this markdown change (PROJECT-CONTEXT §Invariants; plan Technical Notes). |

**No flow qualified for e2e** — the repo has no e2e harness and this change ships no runtime code.
Every exclusion is a framework/target limitation, not a coverage shortcut.

## E2E Tests Added

**None.** No e2e framework exists for markdown/template authoring (PROJECT-CONTEXT §Test tooling:
"e2e: none"). Adding one is out of scope and would test nothing executable. e2e status is vacuously
green (zero applicable flows).

## Coverage

**Not measured (advisory / N/A).** No coverage instrumentation exists for doc-skill markdown
(PROJECT-CONTEXT §Test tooling: "Coverage: not measured except within `clean-code-gates`"). The 70%
line-coverage floor does not apply to a prose change and is **waived per project policy**, not
missed. Before → after: **N/A → N/A**.

## Test-Quality Audit (structural verification)

For a doc skill the "tests" are the plan's structural acceptance criteria. Audited each against the
edited working-tree `SKILL.md`; all hold, with no weak/tautological assertions:

- **AC-1 (FR-2) — blast-radius reduction:** ✓ The rollback recipe (step 4, SKILL.md ~320-331) is
  `git clean`-free — the only surviving `git clean` string is the AC-8 backward-compat note (line
  805), outside the recipe. Untracked removal is an explicitly enumerated, NUL-safe `rm --`
  (`git status --porcelain -z` `??` entries minus the pre-run baseline); `-x`/ignored paths stay
  forbidden (line 329).
- **AC-2/AC-3 (FR-3) — pre-reset concurrency STOP + surface:** ✓ Guard is recipe step 1 (~293): any
  tracked working-tree path outside `git diff --name-only "$BEFORE_SHA" "$AFTER_SHA"` (or an
  architect-defined signal) → **STOP**, record `- [~]` (never `- [x]`), never `git reset --hard`;
  binds autonomous mode. Surface enumerates branch, `BEFORE_SHA`, `AFTER_SHA`,
  `git status --porcelain`, `git log --oneline "$BEFORE_SHA".."$AFTER_SHA"`, the enumerated
  untracked-removal set, and the specific reason — mirroring sec-1's Structural-violation (A/B) STOP.
- **AC-4 (FR-1) — Preconditions note:** ✓ New "Preconditions — exclusive worktree; detect-and-surface,
  never destroy" section (~137-157): exclusive-worktree-for-the-run, detect-and-surface posture, and
  worktree isolation (sec-2) as a deliberately deferred Non-goal.
- **AC-5 (FR-6) — defined once, all callers inherit:** ✓ Guard is stated once ("defined here once;
  every caller below inherits it", line 293). The shared "validation-file-preserving rollback" is
  referenced by checkpoint rejection (467, 512), BLOCKED/errored Step 3.4 (447, 506), sec-1 C/D
  (447), and the batch whole-batch rollback (566, 600) — no per-path special-casing. Batch delta =
  whole-batch `BEFORE_SHA..AFTER_SHA`, per ADR-0008 (line 298).
- **AC-6 (FR-4) — uncommitted-only posture:** ✓ Explicit block (~335-345): proceeds on the
  precondition, FR-2 reduction still applies, removal set surfaced, **no** perfect-attribution claim,
  any computable tracked-side heuristic still fires the STOP.
- **AC-7 (FR-5/FR-7) — preservation + consistency + verbatim traces:** ✓ Four-step
  snapshot→reset→enumerated-rm→rewrite retained (now preceded by the guard as step 1). Diff hunks
  land at lines 137, 291-345, 767, 798 only — the **bug-6 "Autonomous two-item lifecycle"** (~672)
  and **bug-11 "Tracked-backlog rollback lifecycle"** (~708) trace sections are **untouched → read
  verbatim**. A concurrency STOP Edge-case/Note was added; ADR-0008 batch-delta cross-reference
  present (line 298).
- **AC-8 — backward compatibility:** ✓ Normal exclusive-worktree case behaves as before except the
  `git clean` equivalence is replaced by the equivalent enumerated `rm`; `_fixed via …_` provenance
  and `[x]`/`[~]`/`[ ]` semantics unchanged.
- **AC-9 — confinement:** ✓ `git diff --name-only` reports exactly one tracked file changed:
  `plugins/my-skills/skills/validation-fixer/SKILL.md`. No JS, template, ADR, or PROJECT-CONTEXT edit.

No weak or empty assertions found; the coder's per-phase structural gate is corroborated
independently here.

## Verdict

**PASS.** e2e is vacuously green (no applicable flows in a no-runtime doc repo), the coverage floor
is waived per project policy (coverage not measured for markdown), and every structural acceptance
criterion (AC-1…AC-9) is independently verified against the edited SKILL.md. The `clean-code-gates`
JS suite was correctly **not** run. Ready for reviewer.
