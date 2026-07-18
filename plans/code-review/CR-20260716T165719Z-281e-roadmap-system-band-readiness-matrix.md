---
id: CR-20260716T165719Z-281e
plan: FEAT-20260716T161418Z-70c9
title: Review of Roadmap system band and release-readiness matrix
status: REQUEST_CHANGES
created_at: 2026-07-16T17:00:43Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 1
should_fix_count: 1
---

**Related:** [FEAT-20260716T161418Z-70c9](../feat/FEAT-20260716T161418Z-70c9-roadmap-system-band-readiness-matrix.md)

## Summary

Reviewed the full documentation-and-template change set for the `roadmap` + `product-manager` `system` band and `release × system` readiness matrix (9 doc files, 10 template files, 2 design prompts). The work is strong: the `system` band is described symmetrically to `release` with the intended deliberate differences, backward-compat prose is present in every touched file, single-source-of-truth and division-of-labor invariants hold, and `.md`/`.html` template parity is intact after the simplify pass. One blocker remains — the `READY(r)` readiness definition is self-contradictory and inconsistent across six sites (the C4 item carried forward by the tester and simplify). Verdict: **REQUEST_CHANGES** — AC11 (consistent readiness derivation) is not met.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | `config.md` documents `systems` key (shape, default, override, unique name, optional path, typo-guard rationale) | ✅ | New `### systems` section + registry table row + example config. |
| 2 | `item-schema.md` documents story `system`, derived badge, system-band audit row | ✅ | `system` frontmatter row, derived `[<system>]`/`[cross-cutting]`/none, dedicated System-change audit-row section with worked examples. |
| 3 | `directory-layout.md` documents lock `items[].system` (per-item only; set in config; non-authoritative for milestone/phase; back-compat) | ✅ | Lock schema row + "The system set lives in config" section. |
| 4 | `mutation-ops.md` documents `set-system`, `migrate-systems`, extended marker set, frozen-item rule | ✅ | `set-system` fully parallel to `set-release`; `⊞ system` marker; frozen-item rule now permits release OR system change. |
| 5 | `sync-and-reeval.md` preserves `system`, defaults new items to `null` | ✅ | Band-preservation section covers both bands; `ingest-spec` updated. |
| 6 | Roadmap `SKILL.md` invocation + mutation-ops + Release readiness subsection | ✅ | `migrate-systems`/`set-system` invocation rows; System band paragraph; Release readiness subsection with two render locations. |
| 7 | `migrate-systems` procedure documented (bootstrap → per-untagged incl. done → one diff → gate → apply → propose commit; idempotent) | ✅ | 5-step procedure in `mutation-ops.md`, mirrored in design doc. |
| 8 | PM `roadmap-management.md` adds `assign-system`/`migrate-systems` + `⊞ system` marker | ✅ | Verb catalog + op mapping + marker + verb specifics. |
| 9 | PM `scope-resolution.md` adds bare-system scope, `--system` filter, typo-guard stop | ✅ | System scope, System filter (with invocation table), System typo guard, updated data-sources. |
| 10 | PM `SKILL.md` verb rows, `--system` on `complete`, `--system` on `add-*`, path note, error rows | ✅ | All present incl. path store-now-route-later note on the brief handoff. |
| 11 | `release × system` derivation documented **consistently** in roadmap subsection and PM `release-status` | ❌ | `READY(r)` self-contradicts and reads inconsistently across six sites — see MF-1. |
| 12 | Four item templates gain `system` badge in both `.md`/`.html`; `roadmap-readme` embeds compact matrix | ✅ | Badge token verified in both variants of all four; embedded matrix in both roadmap-readme variants. |
| 13 | `release-matrix.template.md`/`.html` at parity (rows/cols/cells/READY?/laggards, self-contained, theme-aware) | ✅ | Both exist; html self-contained + theme-aware; but shares the MF-1 wording defect. |
| 14 | `docs/design-prompts/12-roadmap-release-matrix.md` exists in existing format | ✅ | Present (11.5K), matches numbered-prompt structure. |
| 15 | `docs/design-prompts/13-roadmap-system-badge-and-matrix-additions.md` exists in existing format | ✅ | Present (10.9K), states `.md`/`.html` parity mandate. |
| 16 | Backward-compat prose across every touched file | ✅ | Nullable, lazily-written, no forced migration, legacy renders unchanged, matrix collapses to `(untagged)`, `null` always permitted — asserted per file. |

## Must Fix (Blockers)

### MF-1 — `READY(r)` readiness definition self-contradicts; untagged open work either does or does not gate readiness depending on which sentence you read

**File**: `plugins/my-skills/skills/roadmap/SKILL.md` (READY derivation block, ~L175–176), and five parity sites listed below.

**Problem**: The readiness derivation is stated two incompatible ways, and the two readings disagree exactly when a release has remaining work in the `(untagged)` (`system: null`) column:

- **Primary quantifier** — "`READY(r) := for every declared system s, every not-superseded story with release=r is done`". Read literally as "for each *declared* system", untagged stories (whose `system` is not a declared value) are excluded, so a release could be `READY` with open untagged work.
- **Parenthetical** — "`( equivalently: no cell in row r has remaining not-done work )`". Row `r` in the matrix includes the `(untagged)` column, so this reading *does* count untagged open work and blocks `READY`.
- **`release-matrix.template.md` example** (L32) — `| (untiered) | … | 2/5 | lagging: (untagged) |` treats an untagged cell with remaining work as a laggard, agreeing with the parenthetical.
- **But the template comments/legends** across `release-matrix.template.md` (L23–25, L41–42), `release-matrix.template.html` (L221, L237, L256, L259), `roadmap-readme.template.md` (L52–56) and `roadmap-readme.template.html` (L585–591) all say "*every declared system's* not-superseded stories… are done" and describe laggards as "naming the laggard **system** columns" — the declared-only reading, which contradicts the `.md` example.

An implementer following the dominant "declared systems only" wording would compute `READY` for a release that still has open untagged stories. This is a shipping-safety hazard, not a cosmetic inconsistency: the `migrate-systems` procedure explicitly leaves **un-inferable stories `null` (untagged)** and reports them for manual tagging — so open untagged work in a named release is a real, expected state, and a false `READY` verdict on it is a correctness defect. It also directly fails AC11 ("documented consistently in the roadmap Release-readiness subsection and the PM `release-status` verb").

**Adjudication (against the design doc)**: **Untagged open work in a release DOES gate readiness.** The authoritative design doc (`docs/superpowers/specs/2026-07-16-…-design.md`, L47–48) writes the two forms as equivalent ("`… i.e. no cell in row r has remaining not-done work`"); that equivalence only holds if the `(untagged)` column counts as one of row `r`'s cells — i.e. the author intended untagged work to gate. This also matches the design's Problem statement (#2: "a release is ready only when every system's stories in that band are done" — an open, uncategorized MVP story means MVP is not shippable) and the "nothing is silently dropped" principle. The clean single definition is: **`READY(r)` ⇔ every not-superseded story with `release = r` is done, regardless of system ⇔ no cell in row `r`, across all declared-system columns AND the `(untagged)` column, has remaining not-done work.**

**Fix**: Reconcile all six sites to this ONE definition. Concretely:
1. `roadmap/SKILL.md` — reword the primary line so it does not restrict to declared systems, e.g. `READY(r) := every not-superseded story with release=r is done — equivalently, no cell in row r (every declared-system column and the (untagged) column) has remaining not-done work.` Keep the parenthetical; drop the misleading "for every declared system s" scaffolding.
2. `release-matrix.template.md` — fix the `READY?` verdict comment (L23–25) and the Legend rows (L41–42) so the gate includes the `(untagged)` column and the laggard callout may name `(untagged)`; the L32 example row is already correct and becomes the canonical demonstration.
3. `release-matrix.template.html` — fix the matrix comment (L221), the TBODY comment (L237), and the two Legend descriptions (L256, L259) the same way (laggard list may include `(untagged)`).
4. `roadmap-readme.template.md` (L52–56) and `roadmap-readme.template.html` (L585–591) — fix the embedded-matrix comments identically.
5. Leave the PM echoes as-is — `product-manager/SKILL.md` (`release-status`) and `product-manager/references/roadmap-management.md` state "computes exactly the derivation defined in `roadmap/SKILL.md` → Release readiness (no divergent logic)", i.e. pure pointers with no local formula. They auto-inherit the corrected definition; just re-confirm no stray local restatement is introduced.

## Should Fix (Warnings)

### SF-1 — Authoritative design doc carries the same `READY` ambiguity; update it to match the adjudication

**File**: `docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md:47`

**Problem**: The source-of-truth design doc has the identical "`for every declared system s` … `i.e. no cell in row r has remaining not-done work`" phrasing that seeded MF-1. It is outside this change set's diff (already committed), so it is not a blocker, but leaving the authoritative source ambiguous invites the exact drift MF-1 fixes to re-appear on the next edit.

**Fix**: Once MF-1 is adjudicated, mirror the reconciled wording (untagged work gates; no cell in row `r` — including `(untagged)` — may have remaining not-done work) into the design doc's Release-readiness derivation block so the authoritative source and the implemented docs agree.

## Verdict

**Status**: REQUEST_CHANGES

One acceptance criterion (AC11, consistent readiness derivation) is unmet due to a single normative contradiction replicated across six sites (MF-1); everything else meets its criterion.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260716T165719Z-281e-roadmap-system-band-readiness-matrix.md`) to generate a FIX plan. The Must Fix item will become a TDD (structural-verification) task set that reconciles the six sites to one definition.
