# Product Manager — Resume and Logging Reference

This document is the single source of truth for the append-only run log and the stateless resume algorithm used by PM.

`SKILL.md` references this document by name: **Log**, **Entry fields**, **Resume algorithm**, **Stacked-branch reconstruction**.

---

## Log

The run log lives at `/roadmap/pm-progress.md` and is **append-only**. PM is the sole actor that writes this file; the actor identifier is `product-manager`. Existing rows are never modified — only new rows are appended.

One entry is written per story attempt (including retries and partial runs). If PM is interrupted mid-story, an entry is still appended when the attempt is abandoned or when PM resumes and re-evaluates the story.

---

## Entry fields

Each log entry records the following fields. The order here is the column order in the template and in the rendered log table.

| Field | Type / values | Description |
|---|---|---|
| `when` | ISO-8601 datetime (e.g. `2026-06-23T14:05:00Z`) | Wall-clock time at which PM appended this entry. |
| `story` | `<id> <title>` (e.g. `001.2.1 setup-ci`) | Story id followed by its human-readable title, space-separated. |
| `base` | Branch name (e.g. `main`) | The branch that was resolved as the base for this story's branch. See `references/git-flow.md` → Base resolution. |
| `branch` | Branch name (e.g. `pm/001.2.1-setup-ci`) | The `pm/<id>-<slug>` branch cut for this story. |
| `state` | Orchestrator terminal state string | The terminal state emitted by the orchestrator at the end of this story's execution (e.g. `done`, `error`, `stalled`). |
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

3. **Reconstruct the stacked branches.** Stacked-branch reconstruction relies on the deterministic `pm/<id>-<slug>` naming so a dependent story can locate its predecessor branch after a restart. PM does not need to remember which branches exist: it derives the expected predecessor branch name from the dependency's `id` and slug fields and verifies the branch exists on the remote before stacking.

4. **Resume the queue.** The re-resolved, filtered, ordered queue (see scope-resolution ordering algorithm) is the queue PM processes, starting from the first non-`done` story. No state file is consulted; no in-memory state from the previous run is required.

### What the run log is (and is not) used for

The `/roadmap/pm-progress.md` log is an **audit trail for humans** — it records what PM did, when, and with what result. It is not read by PM itself during resume. The source of truth for "which stories are done" is always `roadmap.lock.json`, not the log.

---

## Cross-references

- Scope matching and filtering: `references/scope-resolution.md`
- Branch naming and base resolution: `references/git-flow.md`
- Human-validation detection (`human_validation` field values): `references/human-validation.md`
- Log entry template: `templates/pm-progress-entry.template.md`
