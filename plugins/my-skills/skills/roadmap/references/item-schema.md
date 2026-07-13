# Roadmap — Item Schema Reference

This document is the single source of truth for the frontmatter, body sections, audit-log format, and html-mode rendering rules for every item (user story, phase, milestone) in `/roadmap/`.

## User-story file (md mode)

```yaml
---
id: 001.1.1
kind: user-story
title: Initialize repo
status: todo            # todo | in_progress | done | superseded | blocked
release: null           # null/absent = active untiered | "backlog" = parked | any other = named release train
milestone: "001"
phase: "001.1"
sequence: 1
depends_on: ["001.1.0"]
spec_refs: ["FR-3"]
commit_trailer: "Roadmap-Story: <id>"
created_at: <ISO-8601>
updated_at: <ISO-8601>
---
## Brief
<plain-language orchestrator brief; self-contained;
 ends with: "Commit with trailer: Roadmap-Story: <id>">

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
| `id` | string | Stable user-story ID (e.g. `001.1.1`). Never changes after assignment. |
| `kind` | string | Always `user-story` for user-story files. |
| `title` | string | Short human-readable title. |
| `status` | string | One of: `todo | in_progress | done | superseded | blocked`. |
| `release` | string \| null | **Release band** — classification metadata orthogonal to `status`. Absent or `null` = active but untiered; the reserved value `backlog` = parked / out of the active plan; any other value = a named release train (e.g. `mvp`, `v1.1`). Editable on an item of **any** status (including `done`/`superseded`) — a band change never alters `status`. Named bands are registered, in order, in `roadmap.lock.json` → `releases[]` (see `directory-layout.md`); `backlog` is reserved and never listed there. Optional and nullable for backward compatibility: legacy items with no `release` key render and execute unchanged (untiered, badge omitted). |
| `milestone` | string | Parent milestone ID (e.g. `"001"`). |
| `phase` | string | Parent phase ID (e.g. `"001.1"`). |
| `sequence` | integer | Logical execution order within the phase. Carries order after re-eval inserts. |
| `depends_on` | array of strings | IDs of user stories that must be `done` before this user story starts. |
| `spec_refs` | array of strings | Requirement / spec identifiers this user story satisfies. |
| `commit_trailer` | string | The exact git trailer line to include in the implementing commit (e.g. `Roadmap-Story: 001.1.1`). |
| `created_at` | ISO-8601 | Timestamp when the item was first materialized. |
| `updated_at` | ISO-8601 | Timestamp of the last frontmatter write. |

### Body sections

Every user-story file has exactly these three sections, in order:

- `## Brief` — plain-language orchestrator brief; self-contained (the orchestrator subagents never see this conversation). Ends with the line: `Commit with trailer: Roadmap-Story: <id>`.
- `## Acceptance` — testable criteria derived from the spec.
- `## Audit log` — append-only table (see below).

## Milestone and phase READMEs

Same frontmatter shape as a user-story file, with the following differences:

- `kind: milestone` or `kind: phase` (never `user-story`).
- No `commit_trailer` key (milestones and phases are not directly implemented by a single commit).
- `status` is **derived** (rolled up from children) rather than set directly — see the rollup function below.
- `release` is likewise **derived** for display: a phase/milestone shows the shared band of its **not-done** descendant stories, or the derived badge `mixed` when those children differ (see `mutation-ops.md` → cascade + derived `[mixed]` badge). A phase/milestone frontmatter `release` may still be stored when `set-release` cascades a band, but rendering always reflects the derived value.
- No `orchestrator_brief` field.
- Body includes an ordered list of children rendered by `sequence`, plus the audit log.

### Rollup function

`rollup(children) -> status`:

| Condition | Derived status |
|---|---|
| No children (freshly created empty scope) | `todo` |
| All children `done` or `superseded` | `done` |
| Any child `blocked` | `blocked` |
| Any child `in_progress` or mixed `done`+`todo` | `in_progress` |
| All children `todo` | `todo` |

`superseded` children are excluded from "is there remaining work" but kept in the count.

An empty phase or milestone (no descendant stories yet — e.g. a default phase seeded by `add-item`, or a new empty milestone) derives `status: todo` and renders **no release badge**.

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

- For sync-detected `done` (i.e. a commit with `Roadmap-Story: <id>` was found by `/roadmap sync`): `who` = the git commit author (name/email).
- Otherwise: `who` = an actor tag — `roadmap-skill` for automated writes, or a user handle for manual edits.

### `evidence` field rules

- For sync-detected `done`: `evidence` = the commit sha.
- Otherwise: `evidence` = the originating action string — one of `/roadmap plan`, `/roadmap sync`, or `/roadmap` (re-evaluation, triggered by running `/roadmap` when `/roadmap/` already exists).

### Release-change audit row (release-band convention)

A `release`-band change appends exactly **one** row to the item's existing 4-column `## Audit log` table — the same table, **no new column**. Because a band change is orthogonal to `status`, the row records the item's **unchanged current status**:

| Column | Value on a release change |
|---|---|
| `when (ISO-8601)` | The change timestamp. |
| `status` | The item's **current, unchanged** status (the band change does not transition status). |
| `who` | The actor tag (e.g. `roadmap-skill`, or a user handle). |
| `evidence` | `release: <old>→<new> (set-release)` — where `<old>`/`<new>` are the prior and new band values (`null` rendered as `null`, the parked band as `backlog`), and `set-release` is the roadmap op that made the change. If a front-door caller drove the op it may append its own attribution as a source suffix (e.g. `… (set-release via /product-manager park)`); the roadmap schema itself references only the op, so a direct `set-release` call has a fully-defined evidence string with no caller. |

Example — a `todo` story parked (`set-release backlog`), driven by the PM `park` verb:

```
| 2026-07-04T18:40Z | todo | roadmap-skill | release: null→backlog (set-release via /product-manager park) |
```

Status-transition rows continue to append exactly as before; the release row is additive and never replaces a status row.

### Creation audit row (`add-item`)

When `add-item` materializes a new item, it seeds the item's `## Audit log` with exactly one row:

| Column | Value |
|---|---|
| `when (ISO-8601)` | The write timestamp. |
| `status` | `todo` (the new item's initial status). |
| `who` | The actor tag (`roadmap-skill`, or a user handle). |
| `evidence` | `/roadmap add-item`. A front-door caller may append its attribution as a source suffix, e.g. `/roadmap add-item (via /product-manager add-ticket)` — mirroring the `set-release` evidence-suffix convention. |

Example — a story created by the PM `add-ticket` verb:

```
| 2026-07-13T18:40Z | todo | roadmap-skill | /roadmap add-item (via /product-manager add-ticket) |
```

## html mode

html-mode items follow the orchestrator's artifact format (see `orchestrator/references/artifact-format.md`):

- Root element: `<main data-id data-status data-created-at data-updated-at>`.
- Each body section (`Brief`, `Acceptance`, `Audit log`) is wrapped in a collapsible `<details><summary>Section Title</summary>…</details>`.
- User-story lists rendered as `<input type="checkbox" disabled>` (disabled checkboxes).
- Self-contained, no external assets.

## Output navigation

Every rendered item links to its neighbours with **relative** links (md and html). `<ext>` = `md` or `html` per `output_format`.

**Down-links (children)** are emitted by the skill when it fills the child-list tokens (see SKILL.md Step 4): index→`<NNN-slug>/README.<ext>`, milestone→`<NNN.M-slug>/README.<ext>`, phase user-story rows→`<NNN.M.T-slug>.<ext>`.

**Up-links (breadcrumb)** are template-static, near the top of each non-root item, showing the ID chain plus a `Roadmap` home link (current item unlinked):

| Level | Breadcrumb |
|---|---|
| index | none (root) |
| milestone | `Roadmap`(`../README.<ext>`) / `{{id}}` |
| phase | `Roadmap`(`../../README.<ext>`) / `{{milestone}}`(`../README.<ext>`) / `{{id}}` |
| user story | `Roadmap`(`../../README.<ext>`) / `{{milestone}}`(`../README.<ext>`) / `{{phase}}`(`README.<ext>`) / `{{id}}` |

Links are plain relative hrefs; an unrendered target simply 404s (no script error).
