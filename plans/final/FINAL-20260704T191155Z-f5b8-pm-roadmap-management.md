---
id: FINAL-20260704T191155Z-f5b8
kind: final-report
plan: FEAT-20260704T182718Z-2117
status: READY_TO_COMMIT
created_at: 2026-07-04T19:11:55Z
---

# FINAL — PM Roadmap-Management Command Surface

**Related:** [SPEC-20260704T182442Z-ab87](../specs/SPEC-20260704T182442Z-ab87-pm-roadmap-management.md) · [FEAT-20260704T182718Z-2117](../feat/FEAT-20260704T182718Z-2117-pm-roadmap-management-command-surface.md) · [TEST-20260704T185352Z-5e84](../test/TEST-20260704T185352Z-5e84-pm-roadmap-management-command-surface.md) · [CR-20260704T185714Z-77a4](../code-review/CR-20260704T185714Z-77a4-pm-roadmap-management-command-surface.md) · [QA-20260704T190246Z-dddd](../qa/QA-20260704T190246Z-dddd-pm-roadmap-management-command-surface.md) · [EVAL-20260704T190800Z-02b6](../eval/EVAL-20260704T190800Z-02b6-pm-roadmap-management.md)

## Summary

Gives the `product-manager` skill a rich roadmap-management command surface, with the `roadmap` skill as the doc-only mutation engine. Adds a per-item `release` band (nullable; reserved `backlog`), an ordered `releases[]` registry in `roadmap.lock.json`, five roadmap mutation ops (`set-release`, `ingest-spec`, `reorder`, `revise`, `release`), a PM management verb front-door (`assign`/`park`/`unpark`/`add-spec`/`new-spec`/`reorder`/`revise`/`release`) with staged-diff gate + planning branch+PR, and extends `complete <scope>` to accept a release name (with backlog excluded from active-scope runs). Templates render a release badge + per-release grouping/progress. Backward-compatible: legacy roadmaps need no migration.

**Doc-only change** — 16 modified + 2 new markdown files under `plugins/my-skills/skills/{roadmap,product-manager}/`. No runtime code.

## Pipeline results

| Stage | Result |
|---|---|
| Brainstormer | SPEC READY_FOR_PLANNING (0 open questions) |
| Architect | FEAT plan, 19 tasks, 4 phases |
| Coder | DONE, 19/19 tasks |
| Simplify | 7 fixes applied (layering/consistency/concision), doc-only |
| Tester | PASS (coverage n/a — no runtime surface) |
| Reviewer | APPROVED (0 Must-Fix, 2 optional Should-Fix) |
| QA | READY_TO_COMMIT (code gates N/A; contract sound on 4 axes) |
| Spec eval | PASS — Final 1.00, Spec-complete, S=pass (28/28 FRs met) |

Review cycles used: 1 / 10 · QA cycles used: 1 / 5

## Issues found

- None blocking.
- Optional (CR Should-Fix, non-blocking): **SF-1** — the lock `release` field for milestone/phase entries is semantically under-specified in `directory-layout.md`; **SF-2** — an unrequested `**Status:**` line was added to `user-story.template.md`. Both can be addressed in a follow-up or during review.

## Proposed commit message

```
feat(skills): add roadmap-management command surface to product-manager

Give the product-manager skill a rich, intent-driven roadmap-management
surface, with the roadmap skill as the doc-only mutation engine.

roadmap skill:
- per-item `release` band (nullable; reserved `backlog` = parked),
  orthogonal to status, editable on any status
- ordered `releases[]` registry in roadmap.lock.json (lazy, no migration)
- five doc-only mutation ops: set-release, ingest-spec, reorder, revise,
  release — each stages a diff, gates on approval, writes, never commits
- release badge + per-release grouping/progress across all 8 templates

product-manager skill:
- management verbs: assign/park/unpark/add-spec/new-spec/reorder/revise/
  release, each cutting a pm/roadmap-<verb>-<slug> planning branch + PR
- selection by ids/globs or natural language, staged-diff gate (+ --yes)
- complete <scope> now accepts a release name; backlog excluded from
  active-scope runs

Doc-only skill-authoring change; backward-compatible with legacy roadmaps.

Roadmap-Story: n/a
```

## Proposed PR message

```
## Summary
Adds a roadmap-management command surface to the product-manager skill,
backed by new doc-only mutation operations in the roadmap skill. Introduces
a release-band model (MVP / named release trains / backlog) as a persistent
per-item dimension orthogonal to status, an ordered release registry, and a
staged-diff + planning-PR apply model. Extends `complete` to run a release
band as a scope.

Design: docs/superpowers/specs/2026-07-04-pm-roadmap-management-design.md
Spec:   plans/specs/SPEC-20260704T182442Z-ab87-pm-roadmap-management.md

## Test plan
Doc-only change (skill markdown + md/html templates) — no runtime surface.
- Content verified against 13 plan acceptance criteria + SPEC FR 1–28 (tester PASS).
- Reviewer APPROVED (0 Must-Fix); QA READY_TO_COMMIT (contract sound: acceptance,
  SPEC coverage, internal consistency, layering invariants).
- Spec-driven-eval: Final 1.00 (Spec-complete), Scope=pass, 28/28 FRs met.
- Optional follow-ups: CR SF-1 (milestone/phase lock `release` under-specified),
  SF-2 (stray Status line in user-story template).
```
