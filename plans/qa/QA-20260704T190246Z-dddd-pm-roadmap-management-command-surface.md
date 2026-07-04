---
id: QA-20260704T190246Z-dddd
plan: FEAT-20260704T182718Z-2117
cr: CR-20260704T185714Z-77a4
title: QA Report — PM Roadmap-Management Command Surface
status: READY_TO_COMMIT
created_at: 2026-07-04T19:02:46Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FEAT-20260704T182718Z-2117](../feat/FEAT-20260704T182718Z-2117-pm-roadmap-management-command-surface.md)

## Summary

This is a documentation / skill-authoring change only — 16 modified markdown skill files plus 2 new reference docs under `plugins/my-skills/skills/roadmap/` and `plugins/my-skills/skills/product-manager/`. There is no runtime code, no compiled module, and no automated test/coverage/mutation surface, so the code-oriented Clean Code gates (G1 coverage, G2 complexity, G3 length, G6 mutation, G7 dependencies) have no path that matches these deliverables and are recorded N/A. QA here verifies the deliverable **contract** holds end-to-end: every acceptance criterion is satisfied by real file content, all SPEC FR 1–28 are covered, internal cross-references resolve, md/html template tokens are paired, verb/op/marker terminology is uniform, and the roadmap-engine / PM-front-door layering invariants hold. The contract is sound. **Verdict: READY_TO_COMMIT.**

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| Automated test suite (`node --test`) | — | — | — | — | N/A (doc-only; no code under test — per plan + SPEC + PROJECT-CONTEXT) |
| Lint | — | — | — | — | N/A (no lint configured for markdown skill docs) |
| Build / typecheck | — | — | — | — | N/A (no build step; plain markdown) |
| Format check | — | — | — | — | N/A (no formatter wired for skill docs) |
| Deliverable-contract verification (QA-owned) | 13 AC + 28 FR | all | 0 | 0 | PASS |

## Clean Code Gates

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | N/A — no code surface; markdown deliverables have no coverage instrumentation. Not `MISSING_TOOL`: no gate path matches `.md` files. |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | N/A — no functions/code in changed set. |
| G4 Naming | intent-revealing | 0 violations | N/A — no identifiers; prose + template tokens only. |
| G5 No comments | inline comment audit | 0 violations | N/A — changed files are `.md`/`.template.md`/`.template.html`, not source; HTML template comments are load-bearing renderer instructions, not code comments. |
| G6 Mutation score (changed files) | killed / total | ≥70% | N/A — no tests/code to mutate. |
| G7 Dependency structure | layering, cycles | 0 violations | N/A for code deps. **Doc-layering equivalent verified PASS** (see Layering below). |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ✅ 0.0 — 1 CR total, 0 REQUEST_CHANGES, 0 FIX/QAF spawned → (0+0)/1 = 0.0. |

> Per the orchestrator brief and the plan's `Verification: QA-only` note, the code gates are not applicable to markdown deliverables and were not fabricated against files they don't govern.

## Deliverable-Contract Verification (QA-owned, replaces code suite)

### (1) Acceptance criteria — all 13 satisfied by real file content

| AC | Verified in | Result |
|----|-------------|--------|
| 1 `release: string \| null` key documented (orthogonal to status, any status, `backlog` reserved) | `roadmap/references/item-schema.md` (frontmatter table + Release-change audit row) | ✅ |
| 2 Ordered `releases: []` + per-item `release` + implicit-create + legacy compat | `roadmap/references/directory-layout.md` (lock schema + `releases[] registry rules`) | ✅ |
| 3 New `mutation-ops.md` (5 ops + markers + cascade/`[mixed]` + immutability) | `roadmap/references/mutation-ops.md` (apply contract, marker table, 5 op sections, cascade, immutability) | ✅ |
| 4 `sync-and-reeval.md` preserves `release`, `ingest-spec` targeted re-eval, `plans/specs/*` seed | `roadmap/references/sync-and-reeval.md` + seed added in `roadmap/SKILL.md` Step 3 | ✅ |
| 5 roadmap `SKILL.md` Mutation-operations section + link | `roadmap/SKILL.md` (`## Mutation operations` H2 + References row) | ✅ |
| 6 Release badge in all 8 templates; grouping/filter + per-release progress in 3 READMEs | all 8 templates (md+html); `per_release_progress` + `groups_by_release` in phase/milestone/roadmap | ✅ |
| 7 Legacy roadmaps render/execute unchanged, no migration | schema + layout + mutation-ops + JS badge-hide when untiered/unresolved | ✅ |
| 8 PM `SKILL.md` verb surface + FR-18 mapping + `new-spec` two-step + `--yes` | `product-manager/SKILL.md` (`## Roadmap-management verbs`) | ✅ |
| 9 New `roadmap-management.md` (verbs, selection ids/globs+NL, gate, reject-discard, spec two-step) | `product-manager/references/roadmap-management.md` | ✅ |
| 10 `scope-resolution.md` release-as-`complete`-scope + backlog exclusion | `product-manager/references/scope-resolution.md` (Release scope + Backlog exclusion) | ✅ |
| 11 `git-flow.md` planning-PR flow (branch/commit/push/PR + reject-discard) | `product-manager/references/git-flow.md` (`## Planning-PR flow`) | ✅ |
| 12 `pr-body.template.md` planning-PR variant | `product-manager/templates/pr-body.template.md` (STORY + PLANNING variants) | ✅ |
| 13 Cross-references resolve; terminology consistent | all 8 referenced docs exist; marker set + verb/op names uniform (see below) | ✅ |

### (2) SPEC FR 1–28 coverage — complete

- FR 1–2, 7 → `item-schema.md` (`release` key, orthogonal/any-status, release-change audit row, no new column).
- FR 3–6 → `directory-layout.md` (ordered `releases[]`, `backlog` never listed, per-item `release`, implicit-create, legacy empty = no migration).
- FR 8–15 → `mutation-ops.md` (marker set incl. `± release`; `set-release` cascade + `[mixed]`; `ingest-spec`; `reorder`; `revise` incl. split/merge via new stable IDs + supersede; `release` registry; not-done-only immutability; band preservation).
- FR 16–21 → PM `SKILL.md` + `roadmap-management.md` (verb→op mapping, front-door flow, selection ids/globs + NL → exact id set in staged diff, confirmation gate + `--yes`, reject-and-discard).
- FR 22–24 → `scope-resolution.md` (release-name scope across all milestones topo-ordered; `backlog` excluded from active-scope runs; existing `complete` machinery otherwise unchanged).
- FR 25 → `roadmap-management.md` Spec-creation two-step (`new-spec` → brainstormer writes `plans/specs/SPEC-{id}.md` → STOP → `add-spec` → `ingest-spec`).
- FR 26 → `roadmap/SKILL.md` Context-gate Step 3 seed list adds `plans/specs/*` (location-agnostic `ingest-spec` note preserved).
- FR 27–28 → all 8 templates render the release badge (derived `[mixed]` on phase/milestone); phase/milestone/index add grouping/filter view + per-release progress alongside rollup.

### (3) Internal consistency — clean

- **Cross-references resolve:** all 8 inter-doc reference targets exist on disk (mutation-ops, item-schema, directory-layout, sync-and-reeval, roadmap-management, scope-resolution, git-flow, pr-body template); pre-existing References-table targets (`config.md`) also present. No dangling links.
- **md↔html token parity:** each of the 4 template pairs exposes the same band — md pre-renders `{{release_badge}}`/`[{{release}}]` while html carries the raw band in `data-release` (`{{release}}` on stories, `{{release_derived}}` on phase/milestone) and brackets it via JS; `{{per_release_progress}}` and `{{*_groups_by_release}}` appear in both formats of all 3 READMEs. Equivalence is documented in the user-story template.
- **Terminology uniform:** the marker quadruple `+ new` / `~ changed` / `! superseded` / `± release` is identical everywhere it appears in full; the 5 op names match one-to-one between the PM verb table and the `mutation-ops.md` op headers; the verb set (`assign`/`park`/`unpark`/`add-spec`/`new-spec`/`reorder`/`revise`/`release`) is consistent across PM `SKILL.md` and `roadmap-management.md`. `git-flow.md` intentionally omits `new-spec` (it opens no PR — it stops for user review), which is correct, not a gap.
- **No contradictions:** `sync-and-reeval.md` keeps the base 3 re-eval markers and points to `mutation-ops.md` for `± release` — a deliberate scoping, not a conflict.

### (4) Layering invariants — hold

- (a) **Exactly one skill (`roadmap`) writes `/roadmap/`.** Stated in `mutation-ops.md`, `roadmap-management.md`, and PM `SKILL.md`; PM front-door only invokes the op, then does git.
- (b) **Ops never commit** — `mutation-ops.md` apply contract: stage → gate → write → propose commit → never commit; PM owns branch/commit/push/PR.
- (c) **Immutability** — `done`/`superseded` items structurally frozen; only the `release` band may change; structural verbs are not-done-only. Consistent across schema, mutation-ops, sync-and-reeval, scope-resolution, roadmap-management.
- (d) **Backward compatibility** — `release` nullable, `releases[]` lazily created, no migration; badge/grouping/legend omitted for legacy/untiered roadmaps (documented + JS-enforced in html).

## Failures

None — all suites and contract checks passed.

## Lint / Format / Type Issues

None — all checks clean (no code surface; N/A tooling recorded above, not failures).

## Notes on CR Should-Fix items (non-blocking, do not affect verdict)

- **SF-1** (lock `release` for milestone/phase under-specified): cross-covered — `item-schema.md` states a phase/milestone `release` "may still be stored… but rendering always reflects the derived value," and `scope-resolution.md` reads the band only for `kind: user-story`. Optional polish, non-blocking.
- **SF-2** (`**Status:**` body line on user-story md template): present and harmless; improves parity with phase/milestone templates. Non-blocking.

## Verdict

**Status**: READY_TO_COMMIT

All 13 acceptance criteria are satisfied by real file content, SPEC FR 1–28 are fully covered, cross-references resolve, md/html template tokens are paired, verb/op/marker terminology is uniform, and the roadmap-engine / PM-front-door layering and never-commit / immutability / backward-compat invariants hold. Code-oriented Clean Code gates are N/A for this documentation-only change; G8 rework ratio is 0.0. Safe to commit and open PR.
