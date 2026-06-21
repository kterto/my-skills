# Roadmap Skill — Design Spec

- **Date:** 2026-06-21
- **Status:** approved (design)
- **Author:** Kainã Terto
- **Related:** `docs/superpowers/specs/2026-06-21-orchestrator-skill-design.md`, `plugins/my-skills/skills/orchestrator/`

## 1. Purpose

A `roadmap` skill that turns a project's context/spec into an **auditable, traceable implementation roadmap** of nested milestones → phases → tasks, materialized as a deliverable handout under `/roadmap/`.

Each task is an **orchestrator-ready brief** that can be fed verbatim to the existing `orchestrator` skill for implementation. Every milestone, phase, and task carries a status and an **append-only audit log** recording who changed it and when.

**Hard constraint — doc-only.** The skill writes documentation. It never executes code, never runs the orchestrator pipeline, and never commits. Its entire job is producing and maintaining `/roadmap/` docs.

## 2. Goals & non-goals

### Goals
- Reach high confidence (default 0.95) on project context before planning, reusing the orchestrator's context when present.
- Decompose the spec into an ordered, numbered tree of milestones → phases → tasks.
- Produce a deliverable handout in `md` or `html` (configurable), rooted at `/roadmap/`.
- Make every status change auditable: who + when + evidence, append-only.
- Make each task directly consumable by the `orchestrator` skill.
- Re-evaluate and reconcile the roadmap when context/spec changes, without destroying completed-work history.

### Non-goals
- Executing tasks, running the orchestrator, or committing code.
- Tracking implementation internals beyond what git/orchestrator artifacts expose.
- Replacing the orchestrator's own brainstormer/architect pipeline.

## 3. Invocation

| Command | Behavior |
|---|---|
| `/roadmap` | Auto-detect: no `/roadmap` dir → **build**; dir exists → **re-evaluate** (diff + preserve). |
| `/roadmap sync` | Scan git commit trailers, stamp matched tasks `done`, roll up, refresh progress. |

Flags (override config): `--format md\|html`, `--threshold <0-1>`.

## 4. Context gate (reuse orchestrator)

1. If `.orchestrator/PROJECT-CONTEXT.md` exists → read it as the **base context** (read-only; the skill never edits orchestrator-owned files).
2. If absent → run an **own gate**: spawn an `Explore` subagent to digest the repo, then loop `AskUserQuestion`, self-rating holistic confidence after each round, until confidence ≥ `context_threshold`. Persist the result to `/roadmap/CONTEXT.md`.
3. In **both** cases, grill only **roadmap-specific gaps** the base context does not settle: milestone boundaries, sequencing/dependencies, release targets, and what "done" means per milestone. Loop on a roadmap-clarity confidence score to the same threshold.
4. Pull the spec/PRD from `docs/superpowers/specs/*`, any PRD files, and README to seed decomposition.

When a base context exists, `/roadmap/CONTEXT.md` is written as a **roadmap addendum** (milestones/sequencing decisions) rather than a full duplicate.

## 5. Decomposition (propose-then-confirm)

1. From context + spec, derive a full milestone → phase → task tree.
2. Assign IDs (see §7). Each task gets a self-contained `orchestrator_brief`.
3. Present a **tree summary** (per-milestone phase/task counts, sequence) to the user.
4. User edits / approves. Only on approval does the skill **materialize** `/roadmap/`.

The `orchestrator_brief` is plain-language and self-contained — it does not reference the roadmap's own structure, because the orchestrator subagents never see this conversation. The brief ends with the line: `Commit with trailer: Roadmap-Task: <id>`.

## 6. Directory layout

```
/roadmap/
  README.md              # index: milestones, rollup status, progress %, legend, sequence order
  CONTEXT.md             # roadmap context (own gate) OR roadmap addendum (orchestrator base exists)
  roadmap.lock.json      # machine state: IDs, statuses, content hashes, last-synced sha
  roadmap.config.json    # optional: roadmap-specific config overrides
  001-bootstrap/
    README.md            # milestone overview + rollup status + audit log + ordered phase list
    001.1-scaffold/
      README.md          # phase overview + rollup status + audit log + task list
      001.1.1-init-repo.md
      001.1.2-....md
  002-auth/
  ...
```

- `output_format` (`md`|`html`) controls **all** generated artifact files (every README and item file).
- `roadmap.lock.json` is always JSON — it is machine state for diffing, not a deliverable.

## 7. ID scheme & stable-identity rule

- Milestone: zero-padded ordinal + kebab name — `001-bootstrap`, `002-auth`.
- Phase: `<milestone>.<n>` — `001.1`, `001.2`.
- Task: `<phase>.<n>` — `001.1.1`.

**Stable-identity rule.** A directory number, once assigned, is **never renumbered**. It is identity, not position. New milestones/phases/tasks append as the next number. Logical execution order is carried by a `sequence` (and `depends_on`) field and rendered in that order in every README.

Consequence: after the first re-eval insert, directory number ≠ execution order. This is intentional — it keeps the audit identity of completed work intact (a `done` item is never rewritten by renumbering).

## 8. Item file schema

### Task (md mode)

```yaml
---
id: 001.1.1
kind: task
title: Initialize repo
status: todo            # todo | in_progress | done | superseded | blocked
milestone: "001"
phase: "001.1"
sequence: 1
depends_on: ["001.1.0"]
spec_refs: ["FR-3"]
commit_trailer: "Roadmap-Task: 001.1.1"
created_at: <ISO-8601>
updated_at: <ISO-8601>
---
## Brief
<plain-language orchestrator brief; self-contained;
 ends with: "Commit with trailer: Roadmap-Task: 001.1.1">

## Acceptance
<criteria derived from spec>

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| 2026-06-21T09:00Z | todo | roadmap-skill | /roadmap plan |
```

### Milestone / phase READMEs
Same frontmatter shape (`kind: milestone|phase`) minus `orchestrator_brief`. They carry a **rolled-up** status (derived, §9), their own append-only audit log, and an ordered list of children rendered by `sequence`.

### html mode
Follows the orchestrator's `references/artifact-format.md`: root `<main data-id data-status data-created-at data-updated-at>`, sections in collapsible `<details><summary>`, task lists as disabled `<input type="checkbox">`. Self-contained, no external assets.

## 9. Status model & audit

- Statuses: `todo | in_progress | done | superseded | blocked`.
- **Rollup derivation** (phase from tasks, milestone from phases):
  - all children `done` (or `superseded`) → `done`
  - any child `blocked` → `blocked`
  - any child `in_progress` / mixed done+todo → `in_progress`
  - all children `todo` → `todo`
  - `superseded` children are excluded from "is there remaining work" but kept in the count.
- **Audit log is append-only.** Each status change appends one row: `when | status | who | evidence`. Rows are never edited or removed — the log *is* the audit trail.
  - `who` = git commit author (name/email) for sync-detected `done`; otherwise an actor tag (`roadmap-skill`, or a user handle for manual edits).
  - `evidence` = commit sha (sync), or the originating action (`/roadmap plan`, `/roadmap sync`, `/roadmap re-eval` — re-eval is the bare `/roadmap` run on an existing dir, §11).

## 10. `/roadmap sync`

1. Read `last_synced_sha` from `roadmap.lock.json`.
2. `git log <last_synced_sha>..HEAD --grep 'Roadmap-Task:'`, extracting per commit: matched task id(s), author name/email, author date (ISO-8601), sha.
3. For each matched task: set `status: done`, append an audit row (`who` = author, `evidence` = sha). Skip tasks already `done`/`superseded` (idempotent).
4. Roll up phase and milestone statuses (§9); append rollup audit rows only where the derived status changed.
5. Update `last_synced_sha` to `HEAD`, refresh README progress %, print a summary of stamped tasks.

Sync is idempotent and additive — re-running it never regresses or rewrites prior rows.

## 11. Re-evaluation (diff + preserve)

Triggered by `/roadmap` when `/roadmap` already exists.

1. Re-read context/spec; re-derive the target tree.
2. Diff target vs `roadmap.lock.json`:
   - **New** items → stage as appends with next stable IDs.
   - **Scope-changed** items → stage body/acceptance update; status unchanged unless the change obsoletes the item.
   - **Obsoleted** items: if `done` → `status: superseded` (kept + flagged, audit row); if not-done → `superseded` as well (kept for audit; never hard-deleted).
3. Present the staged diff (`+ new`, `~ changed`, `! superseded`) for approval.
4. On approval → apply, append audit rows, update `roadmap.lock.json`.

Completed work is immutable: never renumbered, never deleted. The roadmap converges on the new spec by adding and superseding, not by rewriting history.

## 12. Config

| Key | Type | Default | Source |
|---|---|---|---|
| `output_format` | `md`\|`html` | inherit `.orchestrator/config.json`, else `md` | `--format` |
| `context_threshold` | float 0–1 | inherit `.orchestrator/config.json`, else `0.95` | `--threshold` |

Precedence: CLI flag > `/roadmap/roadmap.config.json` > `.orchestrator/config.json` > built-in default.

## 13. Skill file layout

```
plugins/my-skills/skills/roadmap/
  SKILL.md
  references/
    item-schema.md          # frontmatter + audit-log format (md + html)
    directory-layout.md     # /roadmap structure, ID scheme, stable-identity rule
    sync-and-reeval.md      # trailer scan, diff algorithm, supersede rules, rollup
    config.md               # keys, precedence, inheritance from orchestrator
  templates/
    roadmap-readme.template.md / .html
    milestone-readme.template.md / .html
    phase-readme.template.md / .html
    task.template.md / .html
```

Registered in the plugin manifest alongside `orchestrator`.

## 14. Interaction with orchestrator (end-to-end)

1. `/roadmap` → build the tree; each task carries an `orchestrator_brief` + `commit_trailer`.
2. User picks a task, runs `/orchestrator "<orchestrator_brief>"`. Orchestrator runs its pipeline to `READY_TO_COMMIT`.
3. User commits the diff including `Roadmap-Task: <id>` in the trailer.
4. `/roadmap sync` → detects the trailer, stamps the task `done` with the commit author/sha, rolls up.
5. When the spec changes → `/roadmap` re-evaluates, preserving completed/superseded history.

## 15. Open considerations (resolved)

- **Context source:** reuse orchestrator's `.orchestrator/PROJECT-CONTEXT.md`; own gate as fallback. ✅
- **Task↔orchestrator loop:** doc-only; closed by `/roadmap sync` reading real git evidence. ✅
- **Audit identity:** git author for sync; actor tag otherwise; append-only log. ✅
- **Decomposition:** propose-then-confirm with one review gate. ✅
- **Re-eval:** diff + preserve, never delete done work. ✅
- **Sync linkage:** `Roadmap-Task:` commit trailer. ✅
- **ID stability:** stable identity; sequence field carries order. ✅
