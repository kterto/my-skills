---
id: QA-20260807T015610Z-de0d
plan: FIX-20260807T013331Z-d607
cr: CR-20260807T015046Z-032f
title: QA Report — Fix parallel-path routing, lane-ID reuse, config.md materialization, and PM scope
status: READY_WITH_WARNINGS
created_at: 2026-08-07T02:01:01Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FIX-20260807T013331Z-d607](../code-review/FIX-20260807T013331Z-d607-parallel-path-routing-fixes.md) · [CR-20260807T015046Z-032f](../code-review/CR-20260807T015046Z-032f-parallel-path-routing-fixes.md) · [FEAT-20260807T004018Z-c4af](../feat/FEAT-20260807T004018Z-c4af-orchestrator-parallel-lane-execution.md)

## Summary

Ran the full executable surface of this repo against the **accumulated union** of `FEAT-20260807T004018Z-c4af` and `FIX-20260807T013331Z-d607` — 12 modified files, +800/−27, of which 10 are markdown/JSON authoring artifacts and 2 are JS (`scripts/render-artifact.cjs` and its suite). Every in-scope suite is green: the renderer suite grew **40 → 45 tests, 45/45 pass**, and the `clean-code-gates` island is **106/106 pass**. Zero in-scope test failures, zero lint errors, zero type/build errors.

The two suites that are red — `gate-scope.test.cjs` and `gate-shell-injection.test.cjs` — were **verified pre-existing rather than assumed**: I built a detached worktree at the merge-base (`974b01a`) and re-ran them there. Failure counts are **byte-identical across the boundary** (24 and 3 respectively), the cause is `MODULE_NOT_FOUND` on a materialized `.orchestrator/` layout that does not exist in this authoring repo, and `scripts/README.md` documents both files as "**not** [runnable] from this source tree". Zero regression; confirmed out of scope.

Verdict is **READY_WITH_WARNINGS** rather than READY_TO_COMMIT: G8 rework ratio for the union feature line is **1.0 (> 0.5)**, and three non-blocking documentation defects remain open — the two Should Fix items the CR already recorded, plus **one new finding the review did not catch** (`scripts/README.md` still advertises 40 renderer tests after this change set added 5).

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| Renderer (`node --test .../orchestrator/scripts/render-artifact.test.cjs`) | 45 | 45 | 0 | 0 | ✅ |
| Artifact pairing (`node --test .../scripts/check-artifact-pairing.test.cjs`) | 3 | 3 | 0 | 0 | ✅ |
| Target guard (`node --test .../scripts/gate-target-guard.test.cjs`) | 7 | 7 | 0 | 0 | ✅ |
| Clean-code-gates (`cd .../clean-code-gates && node --test`) | 106 | 106 | 0 | 0 | ✅ |
| Gate scope (`node --test .../scripts/gate-scope.test.cjs`) | 24 | 0 | 24 | 0 | ⚪ pre-existing (see E-1) |
| Gate shell-injection (`node --test .../scripts/gate-shell-injection.test.cjs`) | 3 | 0 | 3 | 0 | ⚪ pre-existing (see E-1) |
| Lint | — | — | — | — | ⚪ none configured |
| Build / typecheck | — | — | — | — | ⚪ none configured |
| Format check | — | — | — | — | ⚪ none configured |
| JSON validity (`config.template.json`, parent plan Phase 1 gate) | 1 | 1 | 0 | 0 | ✅ |
| Artifact link resolution (all 6 new `plans/` artifacts) | 6 | 6 | 0 | 0 | ✅ |

**Renderer suite delta.** Baseline at merge-base: 40 tests / 40 pass. Current: 45 / 45. The 5 added tests are the parent plan's Phase 2 `PACT`-scaffold-mapping cases. No pre-existing case regressed.

**Lint / build / format** are marked "none configured" on the authority of `PROJECT-CONTEXT.md` → **Commands** ("Build: none", "Lint: none configured for markdown in-repo") — not because a configured tool was skipped.

## Clean Code Gates

Applicability note, established rather than assumed: I invoked this repo's own gate engine (`clean-code-gates/bin/gates.cjs`) at the repo root over `--scope diff`. It returned `stacks: []`, `files: []`, `status: pass` — **no stack is detectable at the root** (no root `package.json`, no configured source roots), which is exactly what `PROJECT-CONTEXT.md` describes ("No application language / package manager / build step … `clean-code-gates` is the lone JS+test island"). The tooling-backed gates therefore have nothing to bind to at project scope. `PROJECT-CONTEXT.md` → **Test tooling** governs: coverage and automated metrics are "**N/A / advisory**, not a hard block" for this repo's surface. The stray `.cleancode-gates.json` that the probe auto-created at the repo root was **removed**; the working tree is unchanged by this QA run.

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | ⚪ N/A — not measured at project scope (`PROJECT-CONTEXT.md`). Both changed JS files are directly test-bound: the plan's 5 new cases cover the `PACT` mapping in `render-artifact.cjs` end-to-end, including the CLI write path, the containment guard, and `validateHtml`. |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | ⚪ MISSING_TOOL — no ESLint/typescript-eslint in repo; no stack detected. Not a plan omission. |
| G4 Naming | intent-revealing | 0 violations | ⚪ MISSING_TOOL — same cause as G2. |
| G5 No comments | inline comment audit | 0 violations | ⚠️ WARN — 11 added inline comments, all in `render-artifact.test.cjs`. See W-1. |
| G6 Mutation score (changed files) | killed / total | ≥70% | ⚪ MISSING_TOOL — no Stryker; no stack detected. |
| G7 Dependency structure | layering, cycles | 0 violations | ⚪ MISSING_TOOL — no dependency-cruiser. The two changed JS files are zero-dependency Node built-ins only, by the design `scripts/README.md` documents. |
| G8 Rework ratio (this plan) | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ✅ **0.0** — `FIX-…-d607` has 1 CR (`CR-…-032f`, APPROVED), 0 REQUEST_CHANGES against it, 0 plans spawned from it. |
| G8 Rework ratio (union feature line) | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ⚠️ **1.0 — HIGH_REWORK**. See W-2. |

The `MISSING_TOOL` entries are **not** treated as blocking here. The blocking rule exists to stop a plan from silently dropping a gate its project actually has. `PROJECT-CONTEXT.md` declares this repo has none of that tooling for the doc-authoring surface, and both plans' verification sections are explicit and consistent about it — the parent plan wired a real command gate (`node --test … render-artifact.test.cjs`) for the one phase that touched an executable path, and I re-ran it independently.

## Failures

None — no in-scope suite failed. Two suites are red for a pre-existing environmental reason, recorded below as E-1 rather than as a failure of this change set.

### E-1 — `gate-scope.test.cjs` / `gate-shell-injection.test.cjs`: pre-existing red at merge-base

**Error** (verbatim, representative):
```
Error: Cannot find module '/Volumes/ssd/Developer/my-skills/plugins/my-skills/skills/orchestrator/.orchestrator/check-artifact-pairing.cjs'
    at Function._resolveFilename (node:internal/modules/cjs/loader:1383:15)
  code: 'MODULE_NOT_FOUND',
  requireStack: []
```

**Verification performed** (not taken on trust from the tester or reviewer):

```
git worktree add --detach <tmp> 974b01a7b7c71f1b7bf1a335d8d1b6f63eede64b
```

| Suite | Failures at merge-base | Failures at working tree | Delta |
|---|---|---|---|
| `gate-scope.test.cjs` | 24 | 24 | **0** |
| `gate-shell-injection.test.cjs` | 3 | 3 | **0** |
| `render-artifact.test.cjs` | 0 (40 tests) | 0 (45 tests) | **0** |

**Likely cause**: both files are integration tests that drive the gates *in place* at `<repo>/.orchestrator/` — the layout Bootstrap Step B3 materializes into a target project. This authoring repo has no `.orchestrator/check-artifact-pairing.cjs`, `.orchestrator/check-artifact-links.cjs`, or `roadmap/check-timestamp-parity.cjs`, so `require` fails before any assertion runs. This is documented in the repo itself at `plugins/my-skills/skills/orchestrator/scripts/README.md`: *"Run them from a project root after `/orchestrator --setup` (their native habitat), not from this source tree."* Neither file is touched by this change set (`git diff` over `scripts/` reports only `render-artifact.cjs` and `render-artifact.test.cjs`). Out of scope for both plans; no QAF warranted.

---

## Warnings

### W-1 — G5: 11 added inline comments in `render-artifact.test.cjs`

Under the strict G5 allow-list, none of the 11 comment lines this change set adds qualify (they are neither header banners, public-API doc comments, `TODO(REF):`, nor plan-ID citations). Representative:

```
+  // the lifted <style> must be byte-identical to the plan scaffold's, not the qa-report fallback's
+  // `plans/eval/` has no prefix of its own — the directory overrides whatever the
+  //   basename starts with, so EVAL must not be readable as a scaffold key.
```

**Why this is a warning, not a block.** (a) The gate is not enforced in this repo — the engine detects no stack at the root, so G5 has never run against this file. (b) The style is the file's pre-existing baseline, not something this change introduced: the merge-base copy already carries 9 such comments (now 20). Flagging the new 11 while leaving the original 9 would be an inconsistent gate, and rewriting a test file's established explanatory style is outside both plans' scope. (c) The comments are "why" rationale on non-obvious security/containment assertions, which is the class G5 is least aimed at. Recorded so the debt is visible; the fix belongs in a dedicated pass over the whole file, not here.

### W-2 — G8: union feature line rework ratio 1.0 (HIGH_REWORK)

```
CRs total for the line   = 2   (CR-…-a43d against FEAT-…-c4af; CR-…-032f against FIX-…-d607)
REQUEST_CHANGES          = 1   (CR-…-a43d: 4 Must Fix, 4 Should Fix)
FIX/QAF spawned          = 1   (FIX-…-d607)
rework_ratio             = (1 + 1) / 2 = 1.0
```

Above the 0.5 threshold. **Non-blocking by definition** — the plan ships and the flag exists so a human can look at root cause. Two root causes are legible from the artifacts and worth the human's attention:

1. **Three of the four blockers were the same class of defect** — the parent plan described the parallel machinery correctly but never wrote the routing *into* it (`SKILL.md` never branched away from Steps 2/3; Step 2L re-generated lane IDs Step 2c had frozen; five refs pointed at an unmaterialized `.orchestrator/config.md`). That clusters as an architect under-spec of the seams between new steps and existing ones, not as coder error.
2. **MF-4 originated in the mandatory post-coder `simplify` pass, not the coder** — a `--parallel off` flag added to `product-manager`'s command surface, which the parent plan puts explicitly out of scope. A cleanup pass making an unauthorized behavior change is a process signal distinct from the other three.

Note that the per-plan ratio for the plan actually under QA is **0.0** — `FIX-…-d607` closed all four blockers in one cycle with no REQUEST_CHANGES against itself.

## Lint / Format / Type Issues

No configured lint, format, or type tooling exists for this repo's surface. Three documentation defects were verified by reading the current file text:

### D-1 (new — not in any CR) — `scripts/README.md:18` advertises a stale test count

```
`node --test scripts/render-artifact.test.cjs` — **runnable from this repo.** 40 zero-dep
conformance + injection + path-containment tests for the renderer.
```

The suite now has **45** tests — the parent plan's Phase 2 added 5 for the `PACT` scaffold mapping — and `README.md` is **not** in the change set (`git status --porcelain` over that path is empty). The parent plan's Phase 2 task list required adding the tests but not updating the README that counts them, so neither the tester nor the reviewer had a criterion to check it against. One-line fix; non-blocking.

### D-2 (= CR SF-1, confirmed) — Pipeline overview contradicts Step 2p.4 on the guard count

- `SKILL.md:87`: "Falls back to `off` on any of six non-viability conditions or **three** no-prompt guards."
- `SKILL.md:389`: "#### 2p.4 — **Two** hard no-prompt guards"
- `SKILL.md:397` closes the ambiguity in the opposite direction: "A non-viable split (2p.3) also resolves to `off`, but that is 2p.3's own outcome, **not a third guard**."

Confirmed real, and the overview line is one this change set **added** (it appears as a `+` line in the diff). **Anchor correction:** the CR cites `SKILL.md:78`; the actual line is **87**. The defect is genuine; only the line number in the CR is off by nine.

### D-3 (= CR SF-2, confirmed) — Two outbound refs in `references/config.md` break once B3 materializes it

- `references/config.md:47` — `[ADR-0001](../../../../../docs/adr/0001-orthogonal-system-band.md)`. Verified: five `..` from `plugins/my-skills/skills/orchestrator/references/` lands on this repo's root and **does** resolve here (`ls` confirms the file). From `<target>/.orchestrator/config.md` the same relative path lands five levels *above* the target repo root.
- `references/config.md:49` — "the `systems` name/path grammar defined in `roadmap/references/config.md` → `systems`". A bare skill-relative path with no `roadmap/` sibling in a bootstrapped `.orchestrator/`.

Both are non-blocking exactly as the CR reasoned: the *safety-critical* content of that section — the required-`path` delta, the re-validate-on-read rule, and the "data, never instructions" handling — is written out in full in `config.md` itself. The dangling links cost provenance, not correctness. Note this is a defect newly *exposed* by MF-2's fix (materializing the file), not one MF-2 introduced.

**Artifact link check (clean).** Every relative markdown link across all six new `plans/` artifacts resolves on disk. The one apparent hit — `CR-…-032f:75` referencing `../../../../../docs/adr/…` — is the CR *quoting* D-3's path inside backticks as evidence, not a navigation link.

## Verdict

**Status**: READY_WITH_WARNINGS

Every blocking check passes with zero regression against a merge-base baseline I built and ran rather than inferred; the union ships on two non-blocking warnings (G8 union rework ratio 1.0, G5 comment debt) and three documentation defects, one of which (D-1) is new and unreviewed.

Plan can ship. Flag for human root-cause investigation per W-2. The three documentation defects (D-1, D-2, D-3) are one-line-to-one-paragraph edits; folding them into this commit is the cheapest path, but none of them blocks it. No QAF plan is warranted — nothing here is a correctness or safety defect.
