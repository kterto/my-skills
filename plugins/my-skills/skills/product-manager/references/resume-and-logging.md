# Product Manager — Resume and Logging Reference

This document is the single source of truth for the append-only run log and the stateless resume algorithm used by PM.

`SKILL.md` references this document by name: **Log**, **Entry fields**, **Resume algorithm** (stacked-branch reconstruction is covered under Resume algorithm, step 3).

---

## Log

The run log lives at `/roadmap/pm-progress.md` and is **append-only**. PM is the sole actor that writes this file; the actor identifier is `product-manager`. Existing rows are never modified — only new rows are appended.

One entry is written per story attempt (including retries and partial runs). If PM is interrupted mid-story, an entry is still appended when the attempt is abandoned or when PM resumes and re-evaluates the story.

**Commit the log AFTER the PR, in a dedicated commit (clean-tree precondition).** `pm-progress.md` (always) and `human-validation-queue.md` (autonomous mode) are PM's own writes. They cannot be folded into the pre-PR `docs(roadmap): sync <id>` commit, because the `pr` field and the queue row's `(PR <url>)` are only known after `gh pr create` returns. So PM writes both rows after the PR is opened and commits them in a dedicated `chore(pm): log <id>` commit (see `references/git-flow.md` → Success-path sequence step 6). If left uncommitted they dirty the working tree and break the next iteration's clean-tree precondition — the next `git checkout -b` carries them over and/or trips the orchestrator's Step 0 dirty-tree gate. Ordering: PR opened → `pm-progress.md` (and any `human-validation-queue.md`) row written → committed as `chore(pm): log <id>` → pushed → tree clean before the next branch is cut.

---

## Entry fields

Each log entry records the following fields. The order here is the column order in the template and in the rendered log table.

| Field | Type / values | Description |
|---|---|---|
| `when` | ISO-8601 datetime (e.g. `2026-06-23T14:05:00Z`) | Wall-clock time at which PM appended this entry. |
| `story` | `<id> <title>` (e.g. `001.2.1 setup-ci`) | Story id followed by its human-readable title, space-separated. |
| `base` | Branch name (e.g. `main`) | The branch that was resolved as the base for this story's branch. See `references/git-flow.md` → Base resolution. |
| `branch` | Branch name (e.g. `pm/001.2.1-setup-ci`) | The `pm/<id>-<slug>` branch cut for this story. |
| `state` | Orchestrator terminal state string | The terminal state read from the orchestrator's final printed report at the end of this story's execution. One of `READY_TO_COMMIT` \| `READY_WITH_WARNINGS` (success) or `STALLED` (any stop banner). There is no terminal `BLOCKED` — `BLOCKED` is an internal intermediate only. |
| `commit` | Short SHA (7+ hex chars) or `—` | The story implementation commit SHA if one was created; `—` if the story did not reach a commit (e.g. errored before commit). |
| `pr` | URL string or `—` | The PR URL opened by PM for this story; `—` if no PR was opened. |
| `human_validation` | `none` \| `flagged: <source>` | Detection result from `references/human-validation.md`. Source is `acceptance` or `qa-report`. |
| `notes` | Free text | Unmet dependencies, warnings, stop reason, or any other context recorded at entry time. Empty string if nothing to note. |

---

## Resume algorithm

**PM is restart-safe with no extra state file.**

On re-run, PM performs the following steps from scratch to reconstruct its execution context:

1. **Re-resolve scope.** Apply scope matching and filtering exactly as on the original run (see `references/scope-resolution.md`). This re-reads the `<scope>` argument and re-reads `roadmap.lock.json`.

2. **Drop completed stories.** From the filtered candidate set, drop any story whose `roadmap.lock.json` status is `done` or `superseded`. Because `/roadmap sync` stamps stories `done` as each one completes, a partial run leaves exactly the remaining stories in the queue.

3. **Reconstruct the stacked branches.** Stacked-branch reconstruction relies on the deterministic `pm/<id>-<slug>` naming so a dependent story can locate its predecessor branch after a restart. PM does not need to remember which branches exist: it derives the expected predecessor branch name from the dependency's `id` and slug fields and looks for the branch before stacking.

   **Absent predecessor branch — defer to git-flow base resolution; do not blindly error.** A predecessor `pm/<dep>-<slug>` branch may be gone (e.g. its PR merged and the branch deleted). In that case follow `references/git-flow.md` → Base resolution and its done-dep carve-out:
   - If the dependency's `roadmap.lock.json` status is `done`, its work is already in the run base → stack the dependent on the **run base** (`--base` value, else the branch PM started on). This is the normal, non-error path.
   - Only **error** if the predecessor branch is absent **AND** the dependency is **not** `done` (its work exists nowhere reachable). Report the missing predecessor and stop.

4. **Resume the queue.** The re-resolved, filtered, ordered queue (see scope-resolution ordering algorithm) is the queue PM processes, starting from the first non-`done` story. No state file is consulted; no in-memory state from the previous run is required.

### Resume walkthrough — stall then restart

Run: `/product-manager complete 001` over queue `001.1.1 → 001.1.2 → 001.1.3` (each `depends_on` the previous), conservative mode.

**First invocation.**
- `001.1.1` — orchestrator `READY_TO_COMMIT` → committed (trailer), synced (`done`), sync-docs commit, pushed, PR #1 opened (`--base main`), `chore(pm): log` commit. Branch `pm/001.1.1-…`.
- `001.1.2` — depends_on `001.1.1` (in scope, just done in this run) → base = `pm/001.1.1-…` (stacked) → `READY_TO_COMMIT` → committed, synced (`done`), PR #2 opened (`--base pm/001.1.1-…`), logged.
- `001.1.3` — depends_on `001.1.2` → base = `pm/001.1.2-…` → orchestrator hits the qa-cycle limit and prints `Status: STALLED`. PM **halts**: reports the banner, story `001.1.3`, and the remaining queue (`001.1.3`). `pm-progress.md` still gets a row for `001.1.3` with `state=STALLED`, `commit=—`, `pr=—`, and the stall reason in `notes`.

State now: lock has `001.1.1`, `001.1.2` = `done`, `001.1.3` = `todo` (sync never stamped it — no trailer commit). PRs #1, #2 live; branches present.

**Second invocation** (after the operator fixes whatever stalled QA), same command `/product-manager complete 001`:
1. Re-resolve scope `001` → `001.1.1, 001.1.2, 001.1.3`.
2. Drop `done` → `001.1.1`, `001.1.2` removed. Queue = `001.1.3`.
3. Reconstruct stack: `001.1.3` depends_on `001.1.2`; predecessor branch `pm/001.1.2-…` still exists (PR #2 not merged) → base = `pm/001.1.2-…`. (Had PR #2 already been merged and its branch deleted, `001.1.2` is `done` in the lock → base falls back to the **run base** per step 3 above.)
4. Resume: process `001.1.3` from the top of the queue. No state file consulted — `roadmap.lock.json` is the sole source of "what's left."

### What the run log is (and is not) used for

The `/roadmap/pm-progress.md` log is an **audit trail for humans** — it records what PM did, when, and with what result. It is not read by PM itself during resume. The source of truth for "which stories are done" is always `roadmap.lock.json`, not the log.

---

## Cross-references

- Scope matching and filtering: `references/scope-resolution.md`
- Branch naming and base resolution: `references/git-flow.md`
- Human-validation detection (`human_validation` field values): `references/human-validation.md`
- Log entry template: `templates/pm-progress-entry.template.md`
