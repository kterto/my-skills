---
id: TEST-20260721T233029Z-ac82
plan: FEAT-20260721T232022Z-f51c
title: Test Report — validation-fixer default-branch-aware protected-branch set resolution
status: PASS
created_at: 2026-07-21T23:30:29Z
cycle: 0
---

**Related:** [FEAT-20260721T232022Z-f51c](../feat/FEAT-20260721T232022Z-f51c-protected-branch-set-resolution.md)

## Summary

Documentation-only plan: a single-file prose/procedure change to
`plugins/my-skills/skills/validation-fixer/SKILL.md` (68 insertions / 14 deletions, one file)
that replaces the hardcoded `main`/`master`/`dev` protected-branch set (finding **sec-3**) with a
**single named "Protected-branch set resolution recipe"** and re-points all three enforcement sites
at it by name.

Per **PROJECT-CONTEXT §Commands / §Test tooling**, this repo has **no automated build/test/lint**
for doc-skill authoring, **no e2e framework**, and coverage is **not measured** outside
`clean-code-gates` — whose JS suite is Invariant-scoped (PROJECT-CONTEXT §Invariants line 69) and
was **not run** here, consistent with the plan's own Verification/Technical-Notes constraints.
Automated tests + coverage are therefore treated as **N/A / advisory, not a hard block** (the
project-declared tester posture). Verification is **structural**: the tester independently confirms
the SKILL.md change satisfies acceptance criteria 1–8, that the recipe is single-sourced, that every
enforcement site references it by name with no literal branch list surviving outside it, and that
the diff is confined. All structural checks **passed**.

## Flows Triaged

"Flows" for a doc skill are behaviors described in prose, verified by review — there is no runtime to
exercise (PROJECT-CONTEXT §Critical flows). e2e is expensive and requires an executable target; none
exists for this change.

| Flow | Criticality | Decision | Rationale |
| --- | --- | --- | --- |
| Step-2 preflight STOP resolves a non-hardcoded protected set (protects a `trunk`/`production`/custom default) | High user-impact (silent commit onto real default), but non-executable prose | **Excluded from e2e** | No runtime/e2e framework in repo; behavior is a documented procedure. Structurally verified against AC 1–5, 7 instead. |
| Silent, non-fatal degrade when `origin/HEAD` cannot resolve (offline / no remote / detached / error) | High (a fatal degrade would break every run) | **Excluded from e2e** | No executable skill target. Structurally verified: recipe states best-effort degrade to (b) ∪ (c), set never empty, never aborts (AC-3). |
| Merge-base (`$mb`) trust anchor for documented policy names; resolved names treated as data | High (weaponized working-tree policy) | **Excluded from e2e** | Prose invariant; structurally verified — source (c) reads from `$mb`, names used only for comparison (AC-7). |
| Single-source-of-truth: no drift between the three enforcement sites | Medium | **Excluded from e2e** | Structurally verified — one recipe block, three by-name references, zero literal lists at any site (AC-1, AC-5). |
| `clean-code-gates` JS suite | N/A | **Excluded (forbidden)** | Invariant-scoped to that skill only; MUST NOT run against this markdown change (PROJECT-CONTEXT §Invariants; plan Technical Notes; orchestrator note). |

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

- **AC-1 — exactly one named recipe, before first use:** ✓ Single `### Protected-branch set
  resolution recipe` block at SKILL.md line 117, immediately preceding the Step-2 preflight
  (`### Preflight — reject a protected branch …`, line 166). Diff adds exactly one recipe header.
- **AC-2 — union of three sources:** ✓ (a) dynamic default from `origin/HEAD`
  (`git symbolic-ref --short refs/remotes/origin/HEAD` → strip `origin/`, fallback `git remote show
  origin`) at 126-132; (b) widened static fallback `main`/`master`/`dev`/`trunk` "always present" at
  133-135; (c) documented policy read from merge-base `$mb` at 136-139.
- **AC-3 — silent, non-fatal degrade:** ✓ Lines 141-144: dynamic (a) is best-effort; on no remote /
  offline / detached / command error it degrades silently to (b) ∪ (c) and "never aborts, errors, or
  STOPs the run"; (b) always present so the set is never empty.
- **AC-4 — exact, case-sensitive equality; detached HEAD independent STOP:** ✓ Lines 146-152:
  membership is exact case-sensitive equality of `git rev-parse --abbrev-ref HEAD`, no
  prefix/substring/case-insensitive matching; detached HEAD kept as a separate, unchanged STOP.
- **AC-5 — all three sites reference the recipe by name; no literal list at any site:** ✓
  Preflight (line 175 "Resolve the protected set via the **protected-branch set resolution recipe**",
  reinforced 185); Step-3.4 acceptance gate A (line 455 "resolved via the **protected-branch set
  resolution recipe** … do **not** fork a second definition"); Step-3.4 defense-in-depth guard
  (line 550 "resolved via the **protected-branch set resolution recipe** (the same set the preflight
  consumes)"). The only literal `main`/`master`/`dev`/`trunk` occurrences are **inside** the recipe
  (rule statement line 121, static fallback 133, backward-compat prose 159-160) — none at an
  enforcement site.
- **AC-6 — every other gate behavior preserved verbatim:** ✓ Preflight STOP message +
  "create or switch to a feature branch" guidance intact (178-183); gate A retains A/B/C/D ordering
  with "structural (A/B) before content (C/D)" (450-464) and the "do not fork a second definition"
  directive (456); defense-in-depth re-asserts before committing then STOPs rather than commits
  (546-552). Detached-HEAD handling unchanged at each site.
- **AC-7 — merge-base trust anchor + data-not-commands:** ✓ Source (c) explicitly loads from
  merge-base `$mb` per the two-trust-anchors invariant (136-139); the dynamic `origin/HEAD` value is
  labeled repo state, read normally (131-132); resolved names/documented text are "data used only for
  name comparison — never executed" (154-156).
- **AC-8 — backward compatibility + no opencode port:** ✓ Lines 158-164: static fallback (b) always
  contains the former `main`/`master`/`dev` set, so protection only *widens*; no previously-allowed
  feature branch is newly blocked unless it IS the repo's real default (the sec-3 gap). Confirmed no
  `.opencode/skills/validation-fixer/` port exists → no port mirroring required.

**Confinement:** `git diff --name-only` reports exactly one changed file —
`plugins/my-skills/skills/validation-fixer/SKILL.md` (uncommitted working-tree change, as expected:
the coder never commits). No JS, template, ADR, or PROJECT-CONTEXT edit.

### Weak-tracking finding (non-blocking)

The plan's Phase-2 task **"Re-point the Step-3.4 defense-in-depth 'Protected-branch guard'"**
(plan line 66) is left **`[ ]` unchecked** even though the plan status is `DONE` and the coder's
Progress-Log claims "All 9 tasks complete." Independent structural review confirms the underlying
work **is** present and correct (SKILL.md line 550 references the recipe by name and preserves the
re-assert-before-commit STOP), so this is a **checkbox bookkeeping miss, not a functional gap** — the
acceptance criterion it maps to (AC-5, defense-in-depth site) passes. Surfaced for the reviewer to
tick the box; no behavior is affected. This is the only weak/inconsistent artifact found; no empty or
tautological assertions elsewhere.

## Verdict

**PASS.** e2e is vacuously green (no applicable flows in a no-runtime doc repo), the coverage floor is
waived per project policy (coverage not measured for markdown), and every structural acceptance
criterion (AC 1–8) is independently verified against the edited SKILL.md. The recipe is single-sourced
with no drift across the three enforcement sites, and the `clean-code-gates` JS suite was correctly
**not** run. One non-blocking bookkeeping discrepancy (an unchecked plan task whose work is
nonetheless present) is noted for the reviewer. Ready for reviewer.
