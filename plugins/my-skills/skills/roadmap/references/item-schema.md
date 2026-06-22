# Roadmap — Item Schema Reference

This document is the single source of truth for the frontmatter, body sections, audit-log format, and html-mode rendering rules for every item (task, phase, milestone) in `/roadmap/`.

## Task file (md mode)

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
commit_trailer: "Roadmap-Task: <id>"
created_at: <ISO-8601>
updated_at: <ISO-8601>
---
## Brief
<plain-language orchestrator brief; self-contained;
 ends with: "Commit with trailer: Roadmap-Task: <id>">

## Acceptance
<criteria derived from spec>

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| 2026-06-21T09:00Z | todo | roadmap-skill | /roadmap plan |
```

### Frontmatter keys

| Key | Type | Notes |
|---|---|---|
| `id` | string | Stable task ID (e.g. `001.1.1`). Never changes after assignment. |
| `kind` | string | Always `task` for task files. |
| `title` | string | Short human-readable title. |
| `status` | string | One of: `todo | in_progress | done | superseded | blocked`. |
| `milestone` | string | Parent milestone ID (e.g. `"001"`). |
| `phase` | string | Parent phase ID (e.g. `"001.1"`). |
| `sequence` | integer | Logical execution order within the phase. Carries order after re-eval inserts. |
| `depends_on` | array of strings | IDs of tasks that must be `done` before this task starts. |
| `spec_refs` | array of strings | Requirement / spec identifiers this task satisfies. |
| `commit_trailer` | string | The exact git trailer line to include in the implementing commit (e.g. `Roadmap-Task: 001.1.1`). |
| `created_at` | ISO-8601 | Timestamp when the item was first materialized. |
| `updated_at` | ISO-8601 | Timestamp of the last frontmatter write. |

### Body sections

Every task file has exactly these three sections, in order:

- `## Brief` — plain-language orchestrator brief; self-contained (the orchestrator subagents never see this conversation). Ends with the line: `Commit with trailer: Roadmap-Task: <id>`.
- `## Acceptance` — testable criteria derived from the spec.
- `## Audit log` — append-only table (see below).

## Milestone and phase READMEs

Same frontmatter shape as a task, with the following differences:

- `kind: milestone` or `kind: phase` (never `task`).
- No `commit_trailer` key (milestones and phases are not directly implemented by a single commit).
- `status` is **derived** (rolled up from children) rather than set directly — see the rollup function below.
- No `orchestrator_brief` field.
- Body includes an ordered list of children rendered by `sequence`, plus the audit log.

### Rollup function

`rollup(children) -> status`:

| Condition | Derived status |
|---|---|
| All children `done` or `superseded` | `done` |
| Any child `blocked` | `blocked` |
| Any child `in_progress` or mixed `done`+`todo` | `in_progress` |
| All children `todo` | `todo` |

`superseded` children are excluded from "is there remaining work" but kept in the count.

## Status enum

Valid values for the `status` field on any item:

```
todo | in_progress | done | superseded | blocked
```

## Audit log

The audit log is **append-only**. Each status change appends one row; rows are never edited or removed — the log is the audit trail.

### Row format

| Column | Content |
|---|---|
| `when (ISO-8601)` | Timestamp of the change. |
| `status` | The new status value. |
| `who` | Actor that made the change (see below). |
| `evidence` | Proof of the change (see below). |

Columns are written in this order: `when (ISO-8601) | status | who | evidence`.

### `who` field rules

- For sync-detected `done` (i.e. a commit with `Roadmap-Task: <id>` was found by `/roadmap sync`): `who` = the git commit author (name/email).
- Otherwise: `who` = an actor tag — `roadmap-skill` for automated writes, or a user handle for manual edits.

### `evidence` field rules

- For sync-detected `done`: `evidence` = the commit sha.
- Otherwise: `evidence` = the originating action string — one of `/roadmap plan`, `/roadmap sync`, or `/roadmap` (re-evaluation, triggered by running `/roadmap` when `/roadmap/` already exists).

## html mode

html-mode items follow the orchestrator's artifact format (see `orchestrator/references/artifact-format.md`):

- Root element: `<main data-id data-status data-created-at data-updated-at>`.
- Each body section (`Brief`, `Acceptance`, `Audit log`) is wrapped in a collapsible `<details><summary>Section Title</summary>…</details>`.
- Task lists rendered as `<input type="checkbox" disabled>` (disabled checkboxes).
- Self-contained, no external assets.
