---
id: QA-20260819T050419Z-cfd2
plan: FIX-20260819T043728Z-13ae
cr: CR-20260819T045602Z-221d
title: QA Report — Correct the surviving inner-join run-site prose and fold back the corrected counterfactual
status: READY_TO_COMMIT
created_at: 2026-08-19T05:04:19Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FIX-20260819T043728Z-13ae](../code-review/FIX-20260819T043728Z-13ae-inner-join-run-site-prose.md) · [CR-20260819T045602Z-221d](../code-review/CR-20260819T045602Z-221d-inner-join-run-site-prose.md) · [FEAT-20260819T035826Z-835a](../feat/FEAT-20260819T035826Z-835a-adopt-overlapped-inner-joins.md) · [SPEC-20260819T034803Z-18d2](../specs/SPEC-20260819T034803Z-18d2-adopt-overlapped-inner-joins.md) · [TEST-20260819T042313Z-1acb](../test/TEST-20260819T042313Z-1acb-adopt-overlapped-inner-joins.md)

## Summary

QA covers the **whole change set against base `5403eee`** — the ADR-0013 adoption (`FEAT-20260819T035826Z-835a`) plus its cycle-1 remediation (`FIX-20260819T043728Z-13ae`) — because the two compose one shipped state: 3 orchestrator source files, 3 ADRs, and the regenerated `prime-agent/skills/**` mirror. The change is **docs-only with no executable path**: `parallelism` resolves to `off` in this repo and the changed behaviour (`full` with `k ≥ 2` sub-split lanes) is unreachable here, so there is nothing to exercise behaviourally and no coverage to measure. That is stated as a property of the change, not as a gap.

What QA could establish, it established: the **barrier half and the charge half are consistent in the shipped text** (58 checks across the structural and arithmetic sets, 0 failures), **every worked example re-derives** including the new `k = 2` regression case, **gate and ladder reconcile on both accounts**, the **generated tree is byte-identical to what the builder produces from source** (`--check` exit 0), and the **three overlay anchors hold at 3 / 3 / 2**. Both unrelated suites run clean as a no-regression floor.

Verdict: **READY_TO_COMMIT**.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| Structural assertion set (source + generated tree) | 23 | 23 | 0 | 0 | ✅ |
| Arithmetic re-derivation (4 worked examples + reconciliations) | 31 | 31 | 0 | 0 | ✅ |
| `k = 2` residual viability gates | 4 | 4 | 0 | 0 | ✅ |
| Builder drift guard — `node scripts/build-prime-agent.mjs --check` | — | — | — | — | ✅ exit 0 |
| Floor — `cd prime-agent && npm test` (install.sh + parity.sh) | 2 | 2 | 0 | 0 | ✅ |
| Floor — `cd plugins/my-skills/skills/clean-code-gates && npm test` | 213 | 213 | 0 | 0 | ✅ |
| Lint | — | — | — | — | N/A (none configured for markdown) |
| Build / typecheck | — | — | — | — | N/A (no build step for doc skills) |
| Format check | — | — | — | — | N/A (none configured) |

**Floors are unrelated surface.** Neither `prime-agent`'s suite nor `clean-code-gates`' 213 tests touch the changed prose. They are reported as a no-regression floor and are **not** evidence about this change. Per PROJECT-CONTEXT, `clean-code-gates` was run as its own suite and never applied *to* the edited markdown.

## Clean Code Gates

The gate table below is **not** empty rows and **not** substitutes dressed up as coverage. This change set contains **zero executable files**: 3 markdown skill files, 3 markdown ADRs, and their generated markdown mirror. G1–G7 measure properties of code (statements, branches, cyclomatic complexity, function length, identifiers, mutants, module edges) that markdown prose does not have. They are **N/A — inapplicable**, not `MISSING_TOOL`, and the distinction is load-bearing: no tool is missing, there is no subject to measure.

PROJECT-CONTEXT → *Test tooling* makes the coverage floor inapplicable to doc-skill changes and the plan's own `## Verification (per phase)` states it directly: *"G1 (coverage) and G6 (mutation) are NOT gates here — they remain QA-only, and both are N/A for a markdown change."* The tester correctly reported coverage **N/A** rather than BELOW_FLOOR.

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | **N/A** — 0 executable files changed; no runtime path exists (`parallelism` = `off`, `full` with `k ≥ 2` unreachable in this repo) |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | **N/A** — no functions in the change set |
| G3 Length & nesting | subsumed by G2 | — | **N/A** — same reason |
| G4 Naming | intent-revealing identifiers | 0 violations | **N/A** — no identifiers in the change set |
| G5 No comments | inline comment audit | 0 violations | **N/A** — no code files; markdown prose is the deliverable, not commentary on code |
| G6 Mutation score (changed files) | killed / total | ≥70% | **N/A** — nothing to mutate; no test exists that could kill a mutant |
| G7 Dependency structure | layering, cycles | 0 violations | **N/A** as a module graph. The structural analogue **was** verified: the generated tree's dependency on its sources is proven exact by `--check` exit 0, and the single-source-of-truth citation direction was checked (see *Substantive verification* → item 4) |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ✅ **0.0** for this plan — see the note below on the aggregate reading |

### G8 — both readings, stated plainly

- **This plan (`FIX-20260819T043728Z-13ae`), which is what the gate scopes to:** 1 CR total (`CR-221d`), 0 with `REQUEST_CHANGES`, 0 FIX/QAF spawned from it → **0.0**. **PASS.**
- **The aggregate change set (both plans):** 2 CRs total, 1 `REQUEST_CHANGES` (`CR-a7b9`), 1 FIX spawned → **1.0**.

The aggregate figure is reported rather than hidden, with the caveat that makes it readable: **1.0 is the arithmetic floor for any change that took exactly one remediation cycle** (1 REQUEST_CHANGES + 1 FIX over 2 CRs = 1.0), so the formula flags every single-fix-round change identically and the value is not by itself evidence of under-specification. The convergence signals point the other way — cycle 2 found **0 Must Fix**, all 17 acceptance criteria met, and the reviewer independently re-ran the full assertion surface rather than reading the coder's log. No root-cause investigation is indicated. A human who reads the aggregate differently has the number to act on.

## Substantive verification

The four things QA could actually establish for this change, and what each returned.

### 1. The hard constraint held — barrier half and charge half are consistent in the shipped text

This is the defect `references/config.md` exists to prevent: a cost model charging slowest-of-`k` while the skill still serializes puts the gate and the ladder on two accounts. Swept both halves:

- **Barrier half** (`SKILL.md`): every occurrence of a global leaf barrier is either a **negation** (`:102` *"there is no global leaf barrier ahead of it"*; `:964` same), the explicitly-labelled **other** barrier that ADR-0013 does *not* remove (`:905`, the Step 2s → 2L → 3L architect barrier, distinguished in its own sentence), or the paragraph recording that the global barrier was a simplicity choice now superseded (`:970`). Step 3s `:964` states the per-lane rule; Step 3j `:1028` waits for every inner join explicitly.
- **Charge half** (`config.md`): `:248` and `:256` charge the inner-join level `slowest-of-k` = `J` on the barrier property; `:297` charges `J` on the **first adoption only**; `:265` keeps the superseded serialized charge on record as history, explicitly labelled.

**No site charges what another site does not deliver.** The one place the superseded `(k − 1) × J` aggregate appears is inside the labelled history note and the optimism-delta sentence (`:263`), both correct usages. The banned literal `k × J` / `k×J` is **0 occurrences** across `SKILL.md`, `references/config.md`, `templates/coder.md` and all three generated copies.

### 2. The arithmetic — every worked example re-derived, gate and ladder reconcile

All 31 computed values match the shipped figures exactly. The `k = 2` example is the one that matters (the other three are `k = 1`, where the serialized and concurrent readings coincide and nothing can distinguish them):

- Baseline `M_flat` = 24 + (A2 + J2 + I0) = **28**; flat viable (largest lane 24/38 = 63% ≤ 70%).
- Adoption 1: `g₁` = 24 − 10 = **14**, `c₁` = A2 + J2 + I0.5 = **4.5** → adopted; `M_nested` = **18.5**.
- Adoption 2: `g₂` = 10 − 8 = **2**, `c₂` = I0.5 = **0.5** — no `A` (Step 2s level exists), **newly no `J`** (Step 3s level exists and its joins overlap) → adopted; `M_nested` = **17**.
- **Counterfactual under the superseded charge:** `span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1.0)` = **19**. 19 > 18.5, so the historical rejection was self-consistent on the machine that then existed — the qualitative point SF-4 preserved.
- **Overlap saving** 19 − 17 = **2** = `(k − 1) × J`, matching `config.md:263`'s own claim.
- **Both reconciliations hold:** Σ`c` = 4.5 + 0.5 = **5** = 9 − 4 (overhead delta); Σ`g` = 14 + 2 = **16** = 24 − 8 (total span reduction). Gate and ladder are on one account.
- Residual `k = 2` gates: leaves `{8,8,8,5,5,4}` sum to `T` = 38 ✅; largest leaf 8/38 = 21% ≤ 70% ✅; 4 interface points ≤ `T` ✅; 6 leaves ≤ `max_parallel_lanes` default 6 ✅.

The SF-4 fold-back landed: spec FR-16 (`:123`) and the FEAT plan (`:142`) both carry **19** in expanded term-by-term form, no `**20**` counterfactual total survives in either, the spec's `## Corrections` region (`:231`) names both `FIX-20260819T043728Z-13ae` and `CR-20260819T043042Z-a7b9`, and the FEAT plan is untouched otherwise — still `status: DONE`, **103 checked / 0 unchecked**.

### 3. The generated tree matches its sources and was never hand-edited

`node scripts/build-prime-agent.mjs --check` → *"prime-agent/skills is up to date (11 skills, 154 files)"*, **exit 0**. This is the strong form of the claim: it proves the tree is byte-identical to what the builder produces from `plugins/my-skills/skills/` plus `prime-agent/overlays/*.json`, which is precisely "never hand-edited".

`git status --porcelain prime-agent/skills/` correctly shows 3 modified files and **cannot** show a clean tree here — the pipeline never commits, so the regeneration is necessarily uncommitted. The plan's substitution of `--check` for the porcelain-empty row was the right call and is the check QA relies on. All four corrections are present in the generated copies and both deleted clauses are absent from them.

### 4. Overlay anchors resolve at their declared counts

Independently re-counted in the source `SKILL.md`: `the call shape from *How to spawn a subagent*` = **3** (want 3) ✅ · `:(exclude).claude` = **3** (want 3) ✅ · `through a **single sequential coder invocation**` = **2** (want 2) ✅. No exact-count overlay error was raised by the build.

Also confirmed: the single-source-of-truth citation direction holds — `config.md:437` and `templates/coder.md:153` **cite** `SKILL.md` → Step 3j item 4 rather than restating the rule as a parallel formulation, which is what keeps them from drifting apart again.

### 5. ADR state

`docs/adr/0013-overlapped-inner-joins.md` is **`Status: Accepted`** (moved from Proposed by this change). ADR-0012 and ADR-0014 remain `Accepted`, amended with supersession/cross-reference notes (5 lines each).

## Failures

None — all suites passed.

## Lint / Format / Type Issues

None — all checks clean. No lint, format, or type tooling applies to markdown doc skills in this repo (PROJECT-CONTEXT → *Commands*).

## Open cosmetic item (carried, not blocking)

- `plugins/my-skills/skills/orchestrator/references/config.md:391` writes `I(4×0.25=1)` while `:386` five lines above writes `I(4×0.25=1.0)`, and both upstream artifacts agree with `:386` — so `:391` is the sole outlier, including within its own file. **Confirmed present and confirmed cosmetic:** same quantity, no arithmetic affected, no verdict moves, no reader misled. Filed as SF-3 by the reviewer, who deliberately did not block on it. **No gate failed on it** — it is not a QA blocker. It should ride the next change touching `config.md` rather than trigger a `prime-agent` rebuild alone.
- The reviewer's SF-1 and SF-2 (both one-clause prose edits in `SKILL.md:958`, travelling together) are likewise non-blocking and carried forward.

## Verdict

**Status**: READY_TO_COMMIT

Every applicable check passes, the barrier/charge consistency constraint that this change exists to protect is verified green in the shipped text, all worked-example arithmetic re-derives and both accounts reconcile, and the generated tree is proven exact against its sources.

All checks pass. Safe to commit and open PR.
