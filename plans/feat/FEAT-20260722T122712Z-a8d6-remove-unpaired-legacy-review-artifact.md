---
id: FEAT-20260722T122712Z-a8d6
title: Remove unpaired legacy PR-review artifact so one authoritative snapshot pair remains
type: feat
status: DONE
created_at: 2026-07-22T12:27:12Z
updated_at: 2026-07-22T12:31:00Z
cycle: 0
related_to: SPEC-20260722T122523Z-b0c5
---

**Related:** [SPEC-20260722T122523Z-b0c5](../specs/SPEC-20260722T122523Z-b0c5-remove-unpaired-legacy-review-artifact.md)

## Overview

`docs/reviews/` holds two competing PR-review reports for the `feat-pr-review-md-backlog` / `2026-07-20` branch-date: a tracked, unpaired legacy `feat-pr-review-md-backlog-2026-07-20.html` (reviewedHead `494e4169…`, no `.md` sibling) and a complete digest-named pair `feat-pr-review-md-backlog-92b62e30d08f-2026-07-20.html` + `.md` (reviewedHead `21d74f1b…`). Because they describe different reviewed HEADs, there is no single authoritative snapshot. This plan stages the deletion of ONLY the unpaired legacy `.html`; the digest-named pair already satisfies the "one authoritative pair" requirement and is left byte-for-byte untouched. Per repo policy, work stops at a staged deletion (READY_TO_COMMIT) — the human commits.

## Acceptance Criteria

1. `docs/reviews/feat-pr-review-md-backlog-2026-07-20.html` is removed from the working tree and the deletion is staged (`git status` shows it as `D` / staged for deletion).
2. After removal, the `feat-pr-review-md-backlog` / `2026-07-20` slice of `docs/reviews/` contains exactly the digest-named pair `feat-pr-review-md-backlog-92b62e30d08f-2026-07-20.html` and `…-92b62e30d08f-2026-07-20.md`, and no legacy-named sibling.
3. No other file under `docs/reviews/` (or anywhere in the repo) is added, deleted, or modified — the current-branch report `feat-validation-fixer-severity-routing-345083349153-2026-07-21.{md,html}`, the `_sample-report.html`, and the digest-named pair all remain byte-for-byte unchanged.
4. The change stops at a staged deletion; no commit and no push are performed.

## Out of Scope

- Regenerating any PR-review report (the digest-named pair already exists and is complete; re-running `pr-review-report` is explicitly forbidden here).
- Touching the digest-named pair or any other file under `docs/reviews/`, including the current-branch validation-fixer report.
- Modifying any `SKILL.md`, reference, or template — this is a doc-artifact cleanup, not a skill/code change (the `pr-review-report` digest-naming logic is not in scope).
- Reverting or altering any fix landed earlier in this run.
- Committing or pushing (repo invariant: stop at READY_TO_COMMIT).

## Technical Notes

- **Staged-diff → propose-commit → never-commit invariant.** Use `git rm` (not plain `rm`): the file is tracked, so staging the deletion yields a clean, reviewable diff and keeps the change reversible before the human commit (`git restore --staged …` / `git checkout …`).
- **Reference integrity (confirmed at planning time).** The legacy basename `feat-pr-review-md-backlog-2026-07-20.html` is referenced only by (a) the source spec and (b) the current-branch validation-fixer report that cited it as evidence of the duplication. No `index.json`, review-state JSON, or template links to the basename — a repo-wide grep over `*.json` returned zero hits, and no consuming/index `.md`/`.html` outside the spec and that report references it. Removing the file therefore breaks no live cross-reference. The coder should re-run this grep to re-confirm before staging.
- **No automated gates apply.** Per PROJECT-CONTEXT (Commands / Test tooling), there is no build/lint/test for doc-artifact changes; verification is structural (git-state assertions). The `clean-code-gates` JS suite is out of scope (this change touches no JS).

## Tasks

> Tasks are ordered verification-first: establish the expected end-state assertion before mutating, then assert it holds after.
> The coder will check off [ ] → [x] as each task is verified.
> The phase ends with a `### Phase 1 verification` checklist that the coder MUST run + assert green before checking the last task.

- [x] Re-confirm preconditions: `git ls-files docs/reviews/ | grep 2026-07-20` shows the legacy `.html` tracked and the digest-named `.html`+`.md` present; `grep -rn "feat-pr-review-md-backlog-2026-07-20" --include="*.json" .` returns no hits (no live index/state cross-reference).
- [x] Stage the deletion: `git rm docs/reviews/feat-pr-review-md-backlog-2026-07-20.html`.
- [x] Structurally verify the post-state: `git status --short` shows exactly one staged deletion (`D  docs/reviews/feat-pr-review-md-backlog-2026-07-20.html`) and no other added/deleted/modified path; the digest-named pair and all other `docs/reviews/` artifacts are untouched.

### Phase 1 verification

- [x] `git status --short docs/reviews/` shows a single staged deletion of the legacy file and nothing else under `docs/reviews/` changed.
- [x] `git status --short` (whole tree) introduces no other add/delete/modify attributable to this task (pre-existing untracked files from earlier in the run are not this change's concern, but no new modification of a tracked file appears).
- [x] `ls docs/reviews/` no longer lists `feat-pr-review-md-backlog-2026-07-20.html`, and still lists `feat-pr-review-md-backlog-92b62e30d08f-2026-07-20.html` and `…-92b62e30d08f-2026-07-20.md`.
- [x] No commit and no push were performed (state is READY_TO_COMMIT).

## Verification (per phase)

> This repo has no automated build/lint/test gates for doc-artifact changes (PROJECT-CONTEXT → Commands / Test tooling); verification is structural. The gate for this phase is the git-state assertion set in `### Phase 1 verification` above. Before checking off the last task, the coder runs those `git status` / `ls` assertions and confirms each holds. A failure routes through the coder's BLOCKED step, not a silent workaround.

Phase 1 gate commands (all must hold):

- `git status --short docs/reviews/` → exactly one line `D  docs/reviews/feat-pr-review-md-backlog-2026-07-20.html`.
- `ls docs/reviews/` → legacy `.html` absent; digest-named `.html`+`.md` present.
- `grep -rn "feat-pr-review-md-backlog-2026-07-20" --include="*.json" .` → no hits (reference integrity preserved).

G1 (coverage) and G6 (mutation) are QA-only and not emitted here. The `clean-code-gates` JS suite does not apply (no JS touched).

## Dependencies

- None.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-22T12:36:42Z | QA

QA-20260722T123538Z-ae9b created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.

### 2026-07-22T12:33:26Z | REVIEWER

CR-20260722T123326Z-ca0c created. Status: APPROVED. Must Fix: 0. Should Fix: 0.

### 2026-07-22T12:31:42Z | TESTER

TEST-20260722T123142Z-8e09 created. Status: PASS. Coverage: N/A → N/A.

### 2026-07-22T12:31:00Z | CODER

All 3 tasks complete. Plan status → DONE. Ready for reviewer.
Staged one deletion (`D  docs/reviews/feat-pr-review-md-backlog-2026-07-20.html`) via `git rm`; no commit/push (READY_TO_COMMIT). Phase 1 git-state + reference-integrity gates all green.

### 2026-07-22T12:30:05Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-22T12:27:12Z | ARCHITECT

Plan `FEAT-20260722T122712Z-a8d6` created. Type: feat. Tasks: 3.
Status: PLANNED. Ready for coder.
