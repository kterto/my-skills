---
id: QA-20260807T060418Z-d7d0
plan: FIX-20260807T050208Z-9ac2
cr: CR-20260807T055718Z-bd3e
title: QA Report — Nested parallelism — CR-4659 gate-integrity remediation
status: READY_WITH_WARNINGS
created_at: 2026-08-07T06:11:02Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FIX-20260807T050208Z-9ac2](../code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md) · [CR-20260807T055718Z-bd3e](../code-review/CR-20260807T055718Z-bd3e-cr-4659-gate-integrity-remediation.md) · [FEAT-20260807T030642Z-6077](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md) · [FIX-20260807T040856Z-bf97](../code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md) · [TEST-20260807T054118Z-6a09](../test/TEST-20260807T054118Z-6a09-cr-4659-gate-integrity-remediation.md)

## Summary

QA evaluated the **accumulated union** of the branch's uncommitted change set — parent `FEAT-20260807T030642Z-6077` plus remediation layers `FIX-…-bf97` and `FIX-…-9ac2` — as one change set: 10 modified files, **9 `.md` + 1 `.json`, zero executable extensions**, nothing under `scripts/` or `templates/html/`. Every claim handed to me was re-derived rather than accepted: the 16 gate blocks were independently extracted and run (16/16 exit 0), independently mutation-tested (48/48 killed after correcting one placement artifact of my own harness), the MF-1 harness-integrity meta-assertion re-proved from scratch, and the two known-red integration tests confirmed byte-identical to merge-base and red *at* merge-base in a detached worktree.

All blocking checks pass. The verdict is **READY_WITH_WARNINGS** on one signal only: **G8 rework ratio = 1.33 for the accumulated union** I was scoped to (2 `REQUEST_CHANGES` reviews and 2 remediation layers over one feature). The plan actually under QA is itself clean at 0.00. Nothing is blocked; the ratio is flagged for human root-cause review.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| Plan gate blocks (16 blocks, 3 plan files) | 16 | 16 | 0 | 0 | ✅ |
| `node --test scripts/render-artifact.test.cjs` (collateral guard) | 45 | 45 | 0 | 0 | ✅ |
| `node --test scripts/check-artifact-pairing.test.cjs` | 1 | 1 | 0 | 0 | ✅ |
| `node --test scripts/gate-target-guard.test.cjs` | 1 | 1 | 0 | 0 | ✅ |
| `node --test scripts/gate-scope.test.cjs` | — | — | — | — | ⚪ pre-existing red, unchanged |
| `node --test scripts/gate-shell-injection.test.cjs` | — | — | — | — | ⚪ pre-existing red, unchanged |
| Lint | — | — | — | — | ⚪ none configured for markdown (PROJECT-CONTEXT → Commands) |
| Build / typecheck | — | — | — | — | ⚪ no build step for markdown/template authoring |
| Format check | — | — | — | — | ⚪ none configured |
| `config.template.json` parse | 1 | 1 | 0 | 0 | ✅ valid JSON, 11 keys |

### Scope applicability — verified, not assumed

`git diff HEAD --name-only` (re-read inside a script, because the `rtk` shim injects `--- Changes ---` lines into `git` stdout in this shell) yields exactly 10 paths: 9 `.md`, 1 `.json`. A `grep -E '\.(js|cjs|mjs|ts|tsx|sh|py|dart|html)$'` over that list exits 1 (no match), as does `grep -E '(^|/)scripts/|templates/html/'`. The single `.json` change is one declarative key addition:

```
-… "lanes": [],                          "max_contract_amendments": 2 }
+… "lanes": [], "max_parallel_lanes": 6, "max_contract_amendments": 2 }
```

**Coverage is inapplicable, not missed.** The renderer suite is a collateral-regression guard only, and it is green at 45/45. (`scripts/README.md` still describes it as "40 … tests" — a stale doc count, not a failure; noted below.)

### Pre-existing red tests — confirmed environmental

`gate-scope.test.cjs` and `gate-shell-injection.test.cjs` fail with `MODULE_NOT_FOUND` on `…/skills/orchestrator/.orchestrator/gate-scope.cjs` — a path that does not exist in this authoring repo, exactly as `scripts/README.md` documents ("run them from a project root after `/orchestrator --setup`, not from this source tree"). Independently confirmed three ways:

1. `git diff 974b01a -- gate-scope.test.cjs gate-shell-injection.test.cjs gate-scope.cjs` is **empty** — all three byte-identical to merge-base.
2. A detached worktree at merge-base `974b01a` runs both: **RED at merge-base**.
3. Neither file appears among the 10 changed paths.

Not a regression. Not fixed, per instruction.

## Clean Code Gates

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | ⚪ **N/A** — zero executable lines in the change set |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | ⚪ **N/A** — no code files changed |
| G4 Naming | intent-revealing | 0 violations | ⚪ **N/A** — no code identifiers changed |
| G5 No comments | inline comment audit | 0 violations | ⚪ **N/A** — 0 code files in diff (audit list empty) |
| G6 Mutation (substitute suite) | killed / total | ≥70% | ✅ **100%** (48/48) — see below |
| G7 Dependency structure | layering, cycles | 0 violations | ⚪ **N/A** — no module graph changed |
| G8 Rework ratio — plan under QA | (RC + FIX/QAF) / total CR | ≤0.5 | ✅ **0.00** |
| G8 Rework ratio — accumulated union | (RC + FIX/QAF) / total CR | ≤0.5 | ⚠️ **1.33 — HIGH_REWORK** |

G1/G2/G4/G5/G7 are **N/A by construction, not `MISSING_TOOL`**: the gates' subject matter (statements, branches, functions, identifiers, module edges) does not exist in a 9-`.md`-plus-1-`.json` diff. Per `PROJECT-CONTEXT.md` → Test tooling, doc-skill changes are verified structurally; the substitute suite is the plans' own assertion sets, scored below.

### Substitute gate — the 16 plan gate blocks, independently re-derived

I extracted every ` ```bash ` fence from the three plan files myself: **18 fences = 16 gate blocks + 2 illustrative form snippets** (`AC92-01`/`AC92-02`, 3 and 2 lines, under *"The canonical absence-assertion form"* and *"Scoping an absence assertion"* — documentation of the idiom, not assertions). That reconciles the 18-fence raw count with the reported 16. Distribution: parent `FEAT` 5, `bf97` 6, `9ac2` 5.

All 16 run green from repo root, `set -euo pipefail` on line 1 of every block. Confirmed `grep` resolves to `/usr/bin/grep` (BSD 2.6.0-FreeBSD) inside a script — the `rtk` shim rewrites Bash-tool command lines, not script bodies, so no gate verdict here rode a proxied exit code.

**MF-1 meta-assertion re-proved independently.** Across all 16 blocks: **0** `!`-inverted commands, **0** `&& exit 1` constructs, 16/16 carrying `set -euo pipefail`. The harness defect MF-1 existed to close is closed.

**Mutation testing — 48 mutations, 48 killed (100%).** I built a polarity-aware harness on a mirrored tree: presence assertions mutated by *deleting* the asserted literal from the target file, absence assertions by *injecting* the forbidden literal. One survivor appeared — `AC92-04`'s `'column one level for any sub-split lane'` — and it was **an artifact of my own mutation placement, not a gate weakness**: that assertion is deliberately scoped to the `awk` range `/^Each resolves the /,/^\*\*Beyond that one rule/` (`SKILL.md:926–928`), and my harness appended at end-of-file, outside the range. Re-injecting the literal *inside* the range at `:926` drove the block red with its intended diagnostic:

```
FAIL: SKILL.md still states the contract-tree walk unconditionally, contradicting :150
EXIT=1
```

This independently corroborates the reviewer's SF-1 ruling: item 1's *precision* leaks, but item 2 — the assertion AC 5 actually demands — binds on `:926`. Mirror verified restored; working tree still shows exactly the same 10 modified files, so no mutation leaked.

My 48 mutations cover `-F` literal assertions only and are a deliberately **independent sample**, not a re-run of the tester's broader ~95 (which also swept `grep -E`, `test -eq`, and `awk` ranges). Two independent harnesses agreeing is the signal.

### Invariants (PROJECT-CONTEXT)

- **opencode-port-parity** — ⚪ N/A. Neither `orchestrator` nor `product-manager` has a `.opencode/skills/` override port; only `pr-review-report` and `spec-driven-eval` do. No mirroring obligation.
- **`.md` + `.html` template parity** — ✅. `templates/html/` untouched; `max_parallel_lanes` is a config key, not an artifact token, so no scaffold gains a section.
- **Backward compatibility** — ✅, demonstrated live. `config.md:314` and `:354` declare the new key absent-tolerant → `6`. This repo's own `.orchestrator/config.json` has 6 keys and **does not contain `max_parallel_lanes`**; the entire pipeline including this QA run executed against it unchanged.
- **Never-commit** — ✅. This report ends at READY_WITH_WARNINGS; nothing staged, committed, or pushed.

## Failures

None — all suites passed. The two red integration tests are pre-existing, environmental, byte-identical to merge-base, and red at merge-base; they are excluded from the failure count by the same reasoning `scripts/README.md` documents.

## Lint / Format / Type Issues

None — all checks clean (none configured for markdown authoring in this repo, per `PROJECT-CONTEXT.md` → Commands).

Two non-blocking documentation observations of my own, both outside the shipped product:

- `plugins/my-skills/skills/orchestrator/scripts/README.md`: describes the renderer suite as "40 zero-dep conformance … tests"; it is now **45**. Stale count in an untouched file — pre-existing, not introduced by this change set.
- The five open Should Fix items from `CR-…-bd3e` all sit in `plans/` artifacts. I verified the load-bearing part of the reviewer's non-blocking rationale independently: the two claims `CR-4659` MF-3 ruled false — `'no role walks the contract tree'` and `'changed only to name the outer join'` — occur **0 times in all 10 changed product files**. Likewise SF-4's `"fifteen"` count drift appears only in the plan file and in **no** product file; my own independent count is 5 + 6 + 5 = **16**, matching the Phase 5 gate's own assertion. Nothing false ships.

## Verdict

**Status**: READY_WITH_WARNINGS

Every blocking check passes — 16/16 gate blocks green, 100% mutation kill, 45/45 renderer guard, zero regressions, all invariants held — but G8 on the accumulated union is 1.33, above the 0.5 threshold.

All blocking checks pass but G8 > 0.5 (HIGH_REWORK). Plan can ship; flag for human root-cause investigation.

**On the HIGH_REWORK signal.** The plan under QA is clean (0.00: one CR, approved, no remediation spawned). The 1.33 belongs to the **lineage** I was scoped to: `FEAT-6077 → CR-25d5 (REQUEST_CHANGES, 8 MF) → FIX-bf97 → CR-4659 (REQUEST_CHANGES, 4 MF) → FIX-9ac2 → CR-bd3e (APPROVED, cycle 3)`. Two full remediation rounds on one feature, and the approving review itself took three cycles. Worth noting for root cause: the dominant defect class across both rounds was **false claims in prose that the phase gates could not catch**, because the gate harness itself was broken (MF-1: `!`-inversion exempting 31 of 228 assertions from `set -e`). The gates were reporting green on assertions that could not fail. That is a tooling gap that let two rounds of prose drift through, not a coder-discipline gap — and it is now closed and independently verified closed. The remaining five Should Fix items are gate-precision and record hygiene inside `plans/`; none touches shipped skill files.
