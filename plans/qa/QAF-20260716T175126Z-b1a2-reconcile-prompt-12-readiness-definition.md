---
id: QAF-20260716T175126Z-b1a2
title: Reconcile design prompt 12 READY(r) to untagged-inclusive definition
type: qa
status: DONE
created_at: 2026-07-16T17:51:26Z
updated_at: 2026-07-16T17:55:45Z
cycle: 0
related_to: QA-20260716T174635Z-06c6, FIX-20260716T170225Z-6581, CR-20260716T174258Z-492e
---

**Related:** [QA-20260716T174635Z-06c6](./QA-20260716T174635Z-06c6-reconcile-ready-readiness-definition.md) · [FIX-20260716T170225Z-6581](../code-review/FIX-20260716T170225Z-6581-reconcile-ready-readiness-definition.md)

## Overview

Remediates the single blocking defect (F-1) in QA report `QA-20260716T174635Z-06c6`. Design prompt `docs/design-prompts/12-roadmap-release-matrix.md` — the human-run Claude-design regeneration source for `release-matrix.template.{md,html}` — still states the pre-reconciliation "declared system"-only readiness semantics at L16 (derivation note) and L47 (READY? verdict). Every other site (shipped templates, `roadmap/SKILL.md`, PM pointer sites, SF-1 design doc) was reconciled by FIX-20260716T170225Z-6581 to the untagged-INCLUSIVE form; prompt 12 was scoped out and is now the one divergent site. Left as-is, a future regeneration from this prompt would re-emit templates carrying the since-adjudicated-wrong semantics, undoing the FIX. This plan rewrites L16 + L47 to the reconciled form and re-verifies with a declared-only grep.

## Acceptance Criteria

1. Prompt 12 L16 (derivation note) states the untagged-INCLUSIVE READY(r) definition: a release is `READY` only when every not-superseded story with that `release` is `done` regardless of `system` — no cell across every declared-system column AND the `(untagged)` column has remaining not-done work; `superseded` counts as no-remaining-work. Matches `roadmap/SKILL.md` → Release readiness and `release-matrix.template.{md,html}`.
2. Prompt 12 L47 (READY? verdict component) permits `(untagged)` among the named laggards — "naming the laggard columns, which may include `(untagged)`" — and no longer reads "laggard system columns".
3. `grep -rniE "for every declared system|laggard system column" docs/design-prompts/` returns zero matches.
4. The legitimate structural phrasing that gives the matrix one column per declared system (L44, L45, L64, and the gallery "every declared-system cell done" at L103) is left unchanged — the fix touches only the two readiness-gate spans.

## Out of Scope

- Design prompt `13-roadmap-system-badge-and-matrix-additions.md` — QA dimension 8 confirmed it is clean (structural additions + system legend, no READY formula).
- The shipped `release-matrix.template.{md,html}`, `roadmap-readme.template.{md,html}`, `roadmap/SKILL.md`, `product-manager/SKILL.md`, `roadmap-management.md`, and the SF-1 design doc — all already correctly reconciled (QA dimensions 1–7 green); do not re-touch.
- Actually regenerating the HTML/MD template files from prompt 12 (a human Claude-design step, out of scope per PROJECT-CONTEXT).
- Any change to the readiness semantics themselves — this is a wording reconciliation to the already-adjudicated definition, not a redefinition.

## Technical Notes

- **Documentation/template authoring — no build, no test framework.** Per PROJECT-CONTEXT → Commands / Test tooling, verification for this change is structural (grep + read), not test execution.
- **The grep must be declared-only, not blanket.** "declared system" appears legitimately in structural contexts (L44/L45/L64 "one column per declared system"; L103 gallery "every declared-system cell done") — those describe the matrix layout and are correct. The verification greps only the two readiness-gate phrasings (`for every declared system`, `laggard system column`); it must NOT flag or remove the structural uses.
- **Target wording (align verbatim intent to the shipped sites):**
  - L16 → e.g. "A release is `READY` only when every not-superseded story with that `release` is `done`, regardless of `system` — no cell in the row, across every declared-system column AND the `(untagged)` column, has remaining not-done work; `superseded` counts as no-remaining-work."
  - L47 → e.g. "**READY? verdict:** `READY` in `success`, or `lagging: <col>, …` in `warning` naming the laggard columns, which may include `(untagged)`."
- **Reviewed adjacent spans, deliberately left in scope of F-1 only:** L7 intro ("names its laggard systems") is descriptive prose, not a readiness definition, and is not matched by the declared-only grep; L65 legend ("lagging: `<system>`…") and L104 gallery ("naming the laggard columns") are already untagged-safe (L104 says "columns", not "system columns"). No edit required to satisfy F-1 or the grep. Flag L7 to the reviewer only if a stricter consistency pass is later requested.

## Tasks

> The single BLOCKED item (F-1) is two spans in one file plus a verification grep.
> The coder checks off [ ] → [x] as each edit is applied and verified.

- [x] Rewrite `docs/design-prompts/12-roadmap-release-matrix.md` L16 (Derivation note) to the untagged-INCLUSIVE READY(r) definition (gates on every declared-system column AND the `(untagged)` column, regardless of `system`; `superseded` = no-remaining-work), matching `roadmap/SKILL.md` → Release readiness and `release-matrix.template.{md,html}`.
- [x] Rewrite `docs/design-prompts/12-roadmap-release-matrix.md` L47 (READY? verdict) so the laggard callout names "laggard columns, which may include `(untagged)`" — removing "laggard system columns".
- [x] Run `grep -rniE "for every declared system|laggard system column" docs/design-prompts/` and confirm zero matches; spot-read L16, L47, and the untouched structural uses (L44/L45/L64/L103) to confirm they remain intact.

## Dependencies

- None. FIX-20260716T170225Z-6581 (parent) is already applied to every other site; this QAF closes the one remaining divergent site.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-16T17:51:26Z | ARCHITECT

Plan `QAF-20260716T175126Z-b1a2` created. Type: qa. Tasks: 3.
Status: PLANNED. Ready for coder.

### 2026-07-16T17:54:23Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-16T17:55:45Z | CODER

All 3 tasks complete. Plan status → DONE. Ready for reviewer.
- L16 derivation note → untagged-INCLUSIVE READY(r) (gates on every declared-system column AND `(untagged)`, `superseded` = no-remaining-work).
- L47 READY? verdict → "laggard columns, which may include `(untagged)`".
- Declared-only grep `for every declared system|laggard system column` over `docs/design-prompts/` = zero matches; structural uses at L45/L64/L103 confirmed intact.

### 2026-07-16T17:58:11Z | REVIEWER

CR-20260716T175603Z-7112 created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-16T18:00:42Z | QA

QA-20260716T175919Z-1d60 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
