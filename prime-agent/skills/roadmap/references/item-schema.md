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
system: null            # null/absent = untagged | any declared config.systems name (e.g. "backend")
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
| `system` | string \| null | **System band** — a **second classification axis orthogonal to both `status` and `release`** (a monorepo story belongs to one deployable system, e.g. `backend`, and to one release train, e.g. `mvp`, at the same time). Absent or `null` = **untagged**; any other value must be a `name` declared in `config.systems` (see `config.md`). Unlike `release`, the set is **config-declared, not lazily created**: assigning a value not in `config.systems` is an **error** (typo guard); `null` (untag) is always permitted. Renaming/removing a declared system is done via the `system` op, which cascades to referencing stories (see `mutation-ops.md` → `system`). If a **manual `roadmap.config.json` edit** removes or renames a `name` a story still carries, that value becomes an **orphan** (non-null but undeclared); it is not silently dropped — the readiness matrix renders it in a dedicated **`(unknown)` column** and `system list` reports it (see `SKILL.md` → Release readiness → Derivation and `mutation-ops.md` → Orphan handling). Editable on an item of **any** status (including `done`/`superseded`) — a band change never alters `status`. Optional and nullable for backward compatibility: legacy items with no `system` key render and execute unchanged (untagged, badge omitted). Everything not called out here matches the `release` band's shape (nullable per-item field, cascade to not-done descendants, derived phase/milestone badge, editable on frozen items). The orthogonal-band decision is recorded in [ADR-0001](../../../../../docs/adr/0001-orthogonal-system-band.md). |
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
- `system` is derived for display in exactly the same way (parallel to `release`): a phase/milestone shows the shared system of its **not-done** descendant stories as `[<system>]` (e.g. `[backend]`), the derived badge `[cross-cutting]` when those children differ, or **no badge** when all not-done descendants are untagged (`null`). A phase/milestone frontmatter `system` may still be stored when `set-system` cascades a band, but rendering always reflects the derived value. (`[cross-cutting]` is the system-band analog of the release band's `[mixed]`.)

  **State is separate from the configured name (never infer state from the name string).** Because the `system` grammar has **no reserved value** (a real system may legitimately be named `cross-cutting`, `null`, `untagged`, `none`, …), the renderer must decide the badge from the *derived state*, computed structurally — **not** by string-matching the name. The three states are:
  - **`none`** — untagged (all not-done descendants `null`, or a story with `system: null`): **no badge**.
  - **`named`** — a single shared declared system: badge `[<name>]`, where `<name>` is the configured value **verbatim** (a system literally named `cross-cutting` renders `[cross-cutting]` as a real band, **without** the derived-mixed styling).
  - **`cross-cutting`** — derived mixed (phase/milestone whose not-done children differ): badge `[cross-cutting]` with the mixed styling. Never applies to a raw user-story.

  In **html**, this is carried by a dedicated `data-system-state="none|named|cross-cutting"` attribute alongside `data-system="<raw name>"`; the badge JS keys off `data-system-state` and reads the name only when the state is `named` (see the badge templates). In **md**, the renderer emits `[<name>]` / `[cross-cutting]` / nothing by the same state, never by parsing the name. The pre-rendered per-milestone badges in the index (`roadmap-readme`) follow the identical state rule.
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

An empty phase or milestone (no descendant stories yet — e.g. a default phase seeded by `add-item`, or a new empty milestone) derives `status: todo` and renders **no release badge and no system badge**.

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

### System-change audit row (system-band convention)

A `system`-band change appends exactly **one** row to the item's existing 4-column `## Audit log` table — the same table, **no new column** — exactly parallel to the release-change row. Because a band change is orthogonal to `status`, the row records the item's **unchanged current status**:

| Column | Value on a system change |
|---|---|
| `when (ISO-8601)` | The change timestamp. |
| `status` | The item's **current, unchanged** status (the band change does not transition status). |
| `who` | The actor tag (e.g. `roadmap-skill`, or a user handle). |
| `evidence` | `system: <old>→<new> (set-system)` — where `<old>`/`<new>` are the prior and new band values (`null` rendered as `null`), and `set-system` is the roadmap op that made the change. If a front-door caller drove the op it may append its own attribution as a source suffix (e.g. `… (set-system via /product-manager assign-system)`); the roadmap schema itself references only the op, so a direct `set-system` call has a fully-defined evidence string with no caller. |

Example — a `todo` story tagged `backend` (`set-system backend`), driven by the PM `assign-system` verb:

```
| 2026-07-16T18:40Z | todo | roadmap-skill | system: null→backend (set-system via /product-manager assign-system) |
```

Example — the same story later untagged (`set-system null`) by a direct roadmap call:

```
| 2026-07-16T19:10Z | todo | roadmap-skill | system: backend→null (set-system) |
```

Like the release row, the system row is additive and never replaces a status row; a story may accumulate both a release-change row and a system-change row over its life. A system-band change is permitted on a frozen (`done`/`superseded`) item too (see `mutation-ops.md` → Structural immutability), so migration can tag completed work.

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
- **Injection safety (system `name` + `path`).** These come from contributor-editable config and are surfaced widely; renderers MUST treat them as untrusted:
  - **YAML.** Write a `system:` value as a **safe scalar** (a grammar-valid name — see `config.md` → `name` — needs no quoting; any value that is not grammar-valid must be single-quoted with internal quotes escaped, or the write is refused). Never emit a value that could introduce a newline or a sibling key into frontmatter or the lock.
  - **HTML.** **Context-aware-escape** every system `name` and `path` (and the derived `[<name>]`/`[cross-cutting]` badges and audit-row values) before emitting it into HTML — HTML-escape `& < > " '` in text nodes, and attribute-escape when placed in an attribute (e.g. a `data-*` value or `title`). This applies to renderer-generated readiness markup too (the `release-matrix` column headers, cells, and integrity notes). A grammar-valid name is already inert, but escaping is required so a hand-edited/legacy value can never inject executable markup into a rendered artifact.
  - A value failing the `config.md` grammar/validation (surfaced by `system list`) is escaped/neutralized on render, never passed through raw.

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
