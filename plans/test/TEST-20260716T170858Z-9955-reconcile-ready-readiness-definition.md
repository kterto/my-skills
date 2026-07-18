---
id: TEST-20260716T170858Z-9955
plan: FIX-20260716T170225Z-6581
title: Test Report — Reconcile READY(r) readiness definition across six sites
status: PASS
created_at: 2026-07-16T17:41:39Z
cycle: 0
---

**Related:** [FIX-20260716T170225Z-6581](../code-review/FIX-20260716T170225Z-6581-reconcile-ready-readiness-definition.md)

## Summary

This plan is a **documentation/template reconciliation**, not runtime code (PROJECT-CONTEXT → Test tooling: "no automated test framework for this change… verification is structural review, not test execution"). Per the orchestrator directive, no build/test suite was run — no `clean-code-gates`, no `node --test`. Verification is **structural + text-search only**.

The single blocker being closed (CR MF-1) was that `READY(r)` was stated two incompatible ways across the codebase — the readings diverging exactly when a release has open work in the `(untagged)` (`system: null`) column. The adjudicated semantics is: **untagged open work DOES gate readiness.** I confirmed this one consistent semantics now holds at all six required sites plus the authoritative design doc, that the untagged-excluding phrasing is gone repo-wide (grep = 0), that `.md`/`.html` parity holds for both edited template pairs, and that the backward-compat `(untagged)`-column-collapse prose survives.

**Verdict: PASS** — every site states one consistent, untagged-inclusive READY(r); no diverging site remains.

## Flows Triaged

Per PROJECT-CONTEXT, "flows" here are skill behaviors verified by prose/template review, not executable paths. No flow is e2e-eligible (there is no runnable program). Triage is therefore a **structural consistency check** of the readiness derivation as it appears at each site.

| Flow / site | Criticality | Decision | Rationale |
|---|---|---|---|
| roadmap/SKILL.md READY derivation (normative owner) | High | Structural verify | Single source of truth for the definition; all other sites echo it. |
| release-matrix.template.md (verdict comment + legend + L32 example) | High | Structural verify | Standalone dashboard template; canonical laggard demonstration lives here. |
| release-matrix.template.html (matrix + TBODY comment + 2 legends) | High | Structural verify + parity | Must mirror the `.md` variant exactly (parity invariant). |
| roadmap-readme.template.md (embedded-matrix comments) | High | Structural verify | Embedded compact matrix in the index README. |
| roadmap-readme.template.html (embedded-matrix comments) | High | Structural verify + parity | Must mirror the `.md` variant (parity invariant). |
| product-manager SKILL.md + references/roadmap-management.md (pointers) | High | Structural verify (no-formula) | Must stay pure pointers to roadmap/SKILL.md — no divergent local formula. |
| design doc `2026-07-16-…-design.md` (SF-1, optional) | Medium | Structural verify | Authoritative source; optional but done — must mirror the reconciled wording. |
| e2e execution of any flow | n/a | **Excluded** | No runnable flow exists; skills are markdown/templates (PROJECT-CONTEXT → Test tooling: "e2e: none"). e2e would have nothing to drive. |

## E2E Tests Added

**None** — and none warranted. There is no runnable application surface in this change set (markdown + HTML templates only); PROJECT-CONTEXT explicitly declares "e2e: none. There is no runnable flow." Adding e2e here would be inventing a harness for prose. Exclusion is deliberate and justified by project context.

## Coverage

**Not applicable / not measured.** PROJECT-CONTEXT → Coverage: "not measured; no floor tooling. Not a gate for this task." No coverage command exists for markdown/template docs; the 70% floor does not apply. Before → after: **n/a → n/a**.

## Test-Quality Audit (structural verification results)

All checks below passed.

**1. Forbidden untagged-excluding phrasing removed repo-wide (AC7).** Grep across `plugins/my-skills/skills` and `docs/superpowers/specs`:
- `"every declared system"` → **0**
- `"for every declared"` → **0**
- `"laggard system columns"` → **0**

The residual `"declared system"` hits are all legitimate, unrelated references (matrix *columns* = declared systems + `(untagged)`; config-declared `systems` set; typo-guard prose; PM scope-resolution). None is a READY(r) definition — none contradicts the canonical wording.

**2. Each site states the one untagged-inclusive semantics.**
- **roadmap/SKILL.md** (L175–176): `READY(r) := every not-superseded story with release=r is done, regardless of system` + parenthetical `no cell in row r — every declared-system column AND the (untagged) column — has remaining not-done work`. Quantifier and parenthetical agree.
- **release-matrix.template.md**: verdict comment (L23–26) gates on "no cell in the row — every declared-system column AND the `(untagged)` column"; laggard callout "may include `(untagged)`". Legend READY row (L42) and lagging row (L43) both name `(untagged)`. **L33 example row `| (untiered) | … | 2/5 | lagging: (untagged) |` left intact** as the canonical demonstration (plan explicitly forbade "fixing" it).
- **release-matrix.template.html**: matrix comment (L221–223), TBODY comment (L236–238), and both legend descriptions (L257, L261) all include `(untagged)` in the gate and permit it in the laggard list.
- **roadmap-readme.template.md** (L52–55): "no column, including `(untagged)`, has remaining not-done work; laggard columns (which may include `(untagged)`) are called out."
- **roadmap-readme.template.html** (L585–588, plus L603–604 structural note): identical wording, `(untagged)` included in gate and laggard list.
- **design doc** (SF-1, ~L47–48): `READY(r) := every not-superseded story with release=r is done, regardless of system ( i.e. no cell in row r — every declared-system column AND the (untagged) column — has remaining not-done work )`. Mirrors the reconciled wording.

**3. PM sites are pure pointers — no divergent local formula (AC6).**
- product-manager/SKILL.md (L182): "computes exactly the derivation defined in `roadmap/SKILL.md` → Release readiness — PM adds no divergent logic."
- product-manager/references/roadmap-management.md (L34): "computes exactly the matrix defined in `roadmap/SKILL.md` → Release readiness (no divergent logic)."
No local READY formula introduced at either site.

**4. `.md` / `.html` template parity preserved (AC5).**
- release-matrix pair: `.md` legend (READY + lagging rows) and `.html` legend (READY + lagging descriptions) carry equivalent untagged-inclusive wording; both comment blocks match.
- roadmap-readme pair: `.md` embedded-matrix comment and `.html` embedded-matrix comment carry equivalent wording; the `.html` additionally states the laggard-columns note in its structural block (a superset, still consistent).

**5. Backward-compat prose intact.** The `(untagged)`-column-collapse statement survives at every relevant site: release-matrix.template.md (L44, L47–49), release-matrix.template.html (L240, L265), roadmap-readme.template.md (L57–58), roadmap-readme.template.html (L589–590), and roadmap/SKILL.md (L180). The reconciled definition stays coherent in the single-column case: a release is READY iff its one `(untagged)` cell has no remaining not-done work.

**Weak tests found:** none — there are no coder-authored automated tests in this change set to audit (documentation change).

## Verdict

**PASS.** The `READY(r)` readiness definition now states ONE consistent, untagged-inclusive semantics across all six required sites and the authoritative design doc. No untagged-excluding ("for every declared system") phrasing remains anywhere (grep = 0). Both edited template pairs are at `.md`/`.html` parity, and the backward-compat `(untagged)`-column-collapse prose is intact. No diverging site remains.
