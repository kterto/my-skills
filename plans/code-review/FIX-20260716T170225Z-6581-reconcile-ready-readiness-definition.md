---
id: FIX-20260716T170225Z-6581
title: Reconcile READY(r) readiness definition across six sites
type: fix
status: DONE
created_at: 2026-07-16T17:02:25Z
updated_at: 2026-07-16T17:35:00Z
cycle: 0
related_to: CR-20260716T165719Z-281e, FEAT-20260716T161418Z-70c9
---

**Related:** [CR-20260716T165719Z-281e](./CR-20260716T165719Z-281e-roadmap-system-band-readiness-matrix.md) · [FEAT-20260716T161418Z-70c9](../feat/FEAT-20260716T161418Z-70c9-roadmap-system-band-readiness-matrix.md)

## Overview

This plan resolves the sole blocker from `CR-20260716T165719Z-281e` (MF-1): the `READY(r)` release-readiness definition is stated two incompatible ways and is replicated inconsistently across six documentation/template sites. The two readings disagree exactly when a release has remaining work in the `(untagged)` (`system: null`) column. The CR adjudicated the semantics against the authoritative design doc: **untagged open work in a release DOES gate readiness.** This plan rewrites all six sites — plus (optionally, SF-1) the authoritative design doc — to state ONE consistent definition, and re-confirms the two PM pointer sites carry no divergent local formula. This is documentation/template authoring; verification is structural review, not test execution.

## Canonical definition (the reconciliation oracle)

Every site must express exactly this, in its own local phrasing:

> `READY(r)` ⇔ every not-superseded story with `release = r` is **done**, regardless of `system` ⇔ no cell in row `r` — across **all declared-system columns AND the `(untagged)` column** — has remaining not-done work.

Consequences that every site must respect:
- Drop any "for every **declared** system s" scaffolding that excludes untagged stories.
- The laggard callout **may name `(untagged)`** as a lagging column (not only declared-system columns).
- The `release-matrix.template.md` L32 example row (`| (untiered) | … | 2/5 | lagging: (untagged) |`) is already correct and becomes the canonical demonstration — do not "fix" it.

## Acceptance Criteria

1. `roadmap/SKILL.md` READY derivation states the release-wide, untagged-inclusive definition with no "declared systems only" restriction (MF-1 site 1).
2. `release-matrix.template.md` READY? verdict comment and Legend rows include the `(untagged)` column in the gate and permit `(untagged)` in the laggard callout; L32 example row unchanged (MF-1 site 2).
3. `release-matrix.template.html` matrix comment, TBODY comment, and both Legend descriptions include `(untagged)` in the gate and permit it in the laggard list (MF-1 site 3).
4. `roadmap-readme.template.md` embedded-matrix comments match the canonical definition (MF-1 site 4).
5. `roadmap-readme.template.html` embedded-matrix comments match the canonical definition (MF-1 site 5), and `.md`/`.html` template parity is preserved for both template pairs.
6. `product-manager/SKILL.md` (`release-status`) and `product-manager/references/roadmap-management.md` remain pure pointers to `roadmap/SKILL.md` → Release readiness — no local formula introduced (MF-1 site 6 re-confirm).
7. A repo-wide search for the declared-only phrasing (e.g. "every declared system", "laggard system columns", "declared-system … done") returns no remaining occurrence that contradicts the canonical definition across the six sites.
8. (optional, SF-1) `docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md` Release-readiness derivation block (~L47–48) mirrors the reconciled wording.

## Out of Scope

- Any semantic change to how readiness is computed beyond the adjudicated definition (readiness stays derived from `status` + `release` + `system`; no new persisted state).
- Any change to the PM verbs' behavior — the PM sites are pointers and only get a no-op re-confirmation (or removal of a stray restatement if one is found).
- Regenerating the final pixel design of the HTML templates (Claude-design step; human-run) — only the normative comment/legend text is edited.
- Any file not listed in the CR's MF-1 / SF-1 (no scope creep into other `system`-band prose).

## Technical Notes

- **`.md` + `.html` template parity is mandatory** (PROJECT-CONTEXT Conventions): the `release-matrix` and `roadmap-readme` pairs must stay at parity — a wording change to one variant's readiness/legend text is mirrored into the other.
- **Single-source-of-truth** (PROJECT-CONTEXT Conventions): `roadmap/SKILL.md` owns the normative derivation; templates and PM sites echo/point to it. Keep the PM sites as pointers ("computes exactly the derivation defined in `roadmap/SKILL.md` → Release readiness (no divergent logic)") — do not inline a formula.
- **Readiness is derived, not stored** (PROJECT-CONTEXT Invariants) — this edit is purely definitional wording; add no persisted readiness state.
- **Backward-compat prose must survive** (PROJECT-CONTEXT Invariants): a legacy untagged roadmap still collapses the matrix to the `(untagged)` column; the reconciled definition must remain coherent in that single-column case (a release is READY iff its one `(untagged)` cell has no remaining not-done work).
- **No build/test** for this change (PROJECT-CONTEXT Commands): do NOT run `clean-code-gates` / `node --test`. Verification is structural review and text search only.
- Line numbers from the CR (SKILL.md ~L175–176; matrix.md L23–25/L32/L41–42; matrix.html L221/L237/L256/L259; readme.md L52–56; readme.html L585–591) are guides — re-locate the exact spans by content before editing, as prior simplify passes may have shifted them.

## Tasks

> Tasks are ordered verification-first: the reconciliation oracle and the search that proves consistency bracket the edits.
> The coder will check off [ ] → [x] as each task is verified against the canonical definition above.

- [x] Record the canonical READY(r) reconciliation oracle (the "Canonical definition" block above) as the target wording, and run an initial repo-wide search across the six sites for the declared-only phrasing to enumerate every span that must change (expected: the sites named in AC1–AC5).
- [x] Reword `plugins/my-skills/skills/roadmap/SKILL.md` READY derivation (~L175–176): remove the "for every declared system s" scaffolding; state `READY(r) := every not-superseded story with release=r is done — equivalently, no cell in row r (every declared-system column and the (untagged) column) has remaining not-done work`; keep the parenthetical equivalence.
- [x] Fix `plugins/my-skills/skills/roadmap/templates/release-matrix.template.md`: update the READY? verdict comment (~L23–25) and the Legend rows (~L41–42) so the gate includes the `(untagged)` column and the laggard callout may name `(untagged)`; confirm the L32 example row is left as the canonical demonstration.
- [x] Fix `plugins/my-skills/skills/roadmap/templates/release-matrix.template.html`: update the matrix comment (~L221), the TBODY comment (~L237), and both Legend descriptions (~L256, ~L259) identically (gate includes `(untagged)`; laggard list may include `(untagged)`); confirm parity with the `.md` variant just edited.
- [x] Fix `plugins/my-skills/skills/roadmap/templates/roadmap-readme.template.md` embedded-matrix comments (~L52–56) to match the canonical definition.
- [x] Fix `plugins/my-skills/skills/roadmap/templates/roadmap-readme.template.html` embedded-matrix comments (~L585–591) identically, and confirm `.md`/`.html` parity for the `roadmap-readme` pair.
- [x] Re-confirm `plugins/my-skills/skills/product-manager/SKILL.md` (`release-status`) and `plugins/my-skills/skills/product-manager/references/roadmap-management.md` are pure pointers to `roadmap/SKILL.md` → Release readiness — no local formula; remove any stray local restatement only if present (otherwise no change).
- [x] (optional) Mirror the reconciled wording into `docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md` Release-readiness derivation block (~L47–48) so the authoritative source matches (SF-1).
- [x] Final consistency verification: re-run the repo-wide search for declared-only phrasing ("every declared system", "laggard system columns", declared-only READY wording) across all six sites (and the design doc if the optional task was done) and confirm zero contradicting occurrences remain; confirm both template pairs are still at `.md`/`.html` parity and backward-compat prose (untagged-only matrix collapse) is intact.

## Dependencies

- None. All target files exist and are self-contained doc/template edits.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-16T17:02:25Z | ARCHITECT

Plan `FIX-20260716T170225Z-6581` created. Type: fix. Tasks: 9.
Status: PLANNED. Ready for coder.

### 2026-07-16T17:15:00Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-16T17:41:39Z | TESTER

TEST-20260716T170858Z-9955 created. Status: PASS. Coverage: n/a% → n/a% (doc/template change — no coverage tooling per PROJECT-CONTEXT). Structural verification only: all six sites + design doc state one untagged-inclusive READY(r); untagged-excluding phrasing grep = 0; both template pairs at .md/.html parity; backward-compat (untagged)-collapse prose intact.

### 2026-07-16T17:42:58Z | REVIEWER

CR-20260716T174258Z-492e created. Status: APPROVED. Must Fix: 0. Should Fix: 0.

### 2026-07-16T17:35:00Z | CODER

All 9 tasks complete. Plan status → DONE. Ready for reviewer.
Reconciled READY(r) to one semantics (untagged column gates readiness) across all six sites: roadmap/SKILL.md derivation; release-matrix.template.md (verdict comment + both legend rows, L32 example unchanged); release-matrix.template.html (matrix comment, TBODY comment, both legend descs); roadmap-readme.template.{md,html} embedded-matrix comments (+ laggard-columns filler note in .html for parity). PM sites (SKILL.md release-status, references/roadmap-management.md) confirmed pure pointers — no local formula, no change. Optional SF-1 done: design doc L47–48 derivation block mirrored. Final search: zero declared-only READY occurrences remain; both template pairs at .md/.html parity; backward-compat single-`(untagged)`-column collapse prose intact.

### 2026-07-16T17:46:35Z | QA

QA-20260716T174635Z-06c6 created. Status: BLOCKED. Failures: 1 (structural). Lint/type errors: 0.
Design prompt 12 (docs/design-prompts/12-roadmap-release-matrix.md L16, L47) still carries the pre-reconciliation "for every declared system" / "laggard system columns" wording — the regeneration source for the reconciled release-matrix templates was not updated, reproducing MF-1. Automated gates G1–G7 + node --test recorded N/A (doc/template change, out of scope per PROJECT-CONTEXT).
