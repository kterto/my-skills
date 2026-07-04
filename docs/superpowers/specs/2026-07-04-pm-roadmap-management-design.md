# PM Roadmap-Management — Design Spec

**Date:** 2026-07-04
**Status:** Approved for planning
**Affects:** `plugins/my-skills/skills/product-manager/`, `plugins/my-skills/skills/roadmap/`

---

## 1. Problem

The `roadmap` skill decomposes a project spec into a milestone→phase→user-story tree once, then only `sync`s (stamp done from commit trailers) or whole-tree `re-eval`s (re-derive from the spec). Real product management needs finer, intent-driven surgery *after* the initial automated build:

- Define a **subset as the MVP** without losing track of secondary/intended-later specs.
- **Add new specs** (or raw ideas) into an existing roadmap.
- **Defer / park** work out of the active plan and pull it back later.
- **Reprioritize / reorder / re-scope** stories.

The user wants the **product-manager (PM)** skill to be the command surface for all of this, self-contained to the workspace.

## 2. Division of labor

The three-skill separation is preserved:

| Skill | Role after this change |
|---|---|
| **roadmap** | Sole writer of `/roadmap/`. Gains **doc-only mutation operations**. Each op: compute a **staged diff → gate on approval → write files → print a proposed commit message**. Still **never commits**. Owns immutability, audit log, templates, `roadmap.lock.json`, rollup. |
| **product-manager** | Command **front-door**. Resolves user intent, cuts a planning branch, invokes the roadmap op, then **commits + pushes + opens a PR**. |
| **orchestrator** | Unchanged executor. Its **brainstormer** subagent is reused for spec creation. |

Rationale: one place writes `/roadmap`, so invariants never diverge. This mirrors the existing pattern where `/roadmap sync` writes docs and PM commits them.

## 3. Data model changes

### 3.1 `release` band (new, per-item)

- New **optional** frontmatter key `release` (`string | null`) on every item (user-story, phase, milestone).
- **Absent / `null`** = active but untiered (in the plan, not yet classified).
- Reserved value **`backlog`** = parked / out of the active plan.
- Any other value = a named release train (e.g. `mvp`, `v1.1`, `v2`).
- `release` is **classification metadata**, editable on items of **any** status (a shipped `done` story can belong to `mvp`). It is orthogonal to `status`.

### 3.2 Release registry (new, ordered)

- `roadmap.lock.json` gains `releases: []` — an **ordered** array of named releases (e.g. `["mvp","v1.1","v2"]`). Order defines render order and "runs before" semantics.
- `backlog` is **reserved** and never appears in the registry.
- **Implicit create:** the first time an item is assigned a name not in the registry, the name is appended to the registry order.
- **Explicit management** via the `release` registry op (list / reorder / rename).
- Absent/empty registry on legacy roadmaps → treated as empty (no migration needed).

### 3.3 `roadmap.lock.json` items

Each item entry gains `release` (`string | null`) alongside the existing `status`.

### 3.4 Audit log

A release change appends **one row** to the item's `## Audit log`, reusing the existing 4-column table:

| Column | Value on a release change |
|---|---|
| `when (ISO-8601)` | timestamp of the change |
| `status` | the item's **unchanged** current status |
| `who` | actor tag (e.g. a user handle) |
| `evidence` | `release: <old>→<new> (/product-manager assign)` |

No new column. Status transitions continue to append rows exactly as today.

## 4. roadmap skill — new mutation operations

All operations are **doc-only**: each computes a staged diff, requires approval, writes files, prints a proposed commit message, and **never commits**. Staged-diff markers extend the existing re-eval set: `+ new`, `~ changed`, `! superseded`, plus `± release` for band changes.

| Op | Behavior |
|---|---|
| `set-release <release> <ids…>` | Assign the band. Given a **phase/milestone** id, **cascade** the band to all **not-done descendant stories**; the phase/milestone README shows a **derived badge** (`[mvp]`, or `[mixed]` when children differ). Given a **story** id, set it directly. Editable on any status. |
| `ingest-spec <path>` | Read a spec file at an explicit path (location-agnostic). Append new milestones/phases/stories as a **targeted re-eval** limited to that spec's content: immutable to `done` work, new items default `release: null`. |
| `reorder <ids-in-order>` (or `--after <id>`) | Change `sequence` / `depends_on` of **not-done** items only. |
| `revise <id>` | Retitle, re-scope `## Brief`, adjust `## Acceptance` / `depends_on`. **Not-done** only. **split/merge** are handled here by materializing new stable IDs and superseding the old **not-done** stories (never renumbering, never touching done work). |
| `release <list \| reorder <names…> \| rename <old> <new>>` | Manage the registry order/names. |

**Immutability (reaffirmed):** structural edits (`reorder`, `revise`, split/merge) apply to **not-done** items only. `done`/`superseded` items keep their id, structure, and history; only their `release` band may change.

## 5. product-manager skill — new command surface

Named subcommands under `/product-manager`. Each management verb: **resolve selection → cut `pm/roadmap-<verb>-<slug>` branch (base = PM's starting branch, existing base-resolution) → invoke the roadmap op (which gates + writes) → commit `docs(roadmap): <verb> …` → push → open a PR**. If the user **rejects at the staged-diff gate**, PM discards the empty branch and returns to the starting branch.

| Subcommand | Delegates to | Notes |
|---|---|---|
| `assign <release> <selection>` | roadmap `set-release` | Tiering / MVP scoping. `assign backlog …` == parking. (Verb is `assign`, not `scope`, to avoid colliding with the `complete <scope>` noun.) |
| `park <selection>` | `assign backlog <selection>` | Sugar. |
| `unpark <selection> [<release>]` | `assign <release-or-null> <selection>` | Sugar; omitting the release un-tiers to `null`. |
| `add-spec <path>` | roadmap `ingest-spec` | Ingest an existing spec file. |
| `new-spec [raw idea]` | brainstormer subagent | Spawn brainstormer → writes `plans/specs/SPEC-{id}.md` → **stop for user review** (two-step; user runs `add-spec` after approving). Does **not** auto-append. |
| `reorder …` | roadmap `reorder` | Thin wrapper. |
| `revise <id>` | roadmap `revise` | Thin wrapper. |
| `release <list\|reorder\|rename …>` | roadmap `release` | Registry management. |
| `complete <scope>` | (existing) | Now accepts a release name as scope — see §6. |

**Selection mechanism:** accepts **ids/globs** (`001.1.*`, `002.1.1`) **and natural language** ("make auth and onboarding the MVP") resolved against the tree. Either way, the staged diff lists the **exact resolved id set** before applying.

**Confirmation gate:** every mutation shows the staged diff and requires approval; a `--yes` flag skips it for trusted quick edits.

## 6. Execution integration

- `complete <scope>` scope grammar is extended to accept a **release name**: `complete mvp`, `complete v1.1`, `complete backlog`. This runs every **not-done** story in that band across **all** milestones, topo-ordered (existing ordering algorithm).
- **Active-scope runs** — `complete roadmap`, `complete <milestone>`, `complete <phase>` — **exclude `backlog`** items. Parked work runs only via `complete backlog` or after un-parking.
- All existing `complete` machinery (conservative/autonomous, stacked PRs, trailer sync, artifact verification) is unchanged; only the scope resolver and the backlog filter are added.

## 7. Apply model

1. **Staged-diff → approve** for every mutation (markers `+ new / ~ changed / ! superseded / ± release`). `--yes` skips.
2. **Branch + PR per plan edit**: `pm/roadmap-<verb>-<slug>`, committed as `docs(roadmap): <verb> …`, pushed, PR opened. Planning changes are individually reviewable.
3. Reject at gate → discard empty branch.

## 8. Spec-creation flow (raw idea → roadmap)

```
new-spec "raw idea"
   └─ brainstormer subagent ─▶ plans/specs/SPEC-{id}.md   [STOP — user reviews/edits]
add-spec plans/specs/SPEC-{id}.md
   └─ roadmap ingest-spec ─▶ staged append diff ─▶ approve ─▶ branch+PR
```

Two gates: the **spec** is validated before it reshapes the plan, and the **roadmap change** is validated before commit. Reuses the existing brainstormer (writes to `plans/specs/`) — no new spec-authoring logic.

> **Path reconciliation:** the brainstormer writes to `plans/specs/`, while the roadmap Context-gate seed list currently reads `docs/superpowers/specs/*`. `ingest-spec` takes an **explicit path**, so it is location-agnostic; additionally the roadmap seed list (Context gate Step 3) will add `plans/specs/*` as a recognized spec source.

## 9. Rendering / templates

All 8 roadmap templates (user-story / phase / milestone / index, in md and html) render:

- A **release badge** on each item (`[mvp]`, `[v1.1]`, `[backlog]`, or none when untiered; `[mixed]` derived badge on phases/milestones).
- Index / milestone / phase READMEs gain a **release grouping / filter view** and **per-release progress** in addition to the existing rollup progress.

## 10. Migration / backward compatibility

- **Zero rewrite.** `release` is nullable and the registry is created lazily. Legacy roadmaps (no `release`, no `releases[]`) render and execute unchanged.
- `/roadmap sync` unchanged.
- `re-eval` and `ingest-spec` **preserve** existing `release` values on items they touch.

## 11. Documentation to update

**roadmap skill**
- `SKILL.md` — add a "Mutation operations" section + release-band concept.
- `references/item-schema.md` — `release` frontmatter key + audit-row convention.
- `references/directory-layout.md` — `releases[]` registry in `roadmap.lock.json`; `release` in items.
- `references/sync-and-reeval.md` — preserve `release`; define `ingest-spec` as a targeted re-eval.
- **new** `references/mutation-ops.md` — normative spec of `set-release`, `ingest-spec`, `reorder`, `revise`, `release`, staged-diff markers, cascade + immutability rules.
- All 8 templates — release badge + release view.

**product-manager skill**
- `SKILL.md` — new subcommands + management front-door flow.
- `references/scope-resolution.md` — release-as-scope + backlog exclusion in active-scope runs.
- `references/git-flow.md` — planning-PR flow (`pm/roadmap-<verb>-<slug>`, `docs(roadmap):` commits).
- **new** `references/roadmap-management.md` — the verb catalog, selection resolution, staged-diff gate, reject-and-discard, spec-creation two-step.
- `templates/pr-body.template.md` — a planning-PR body variant (or a new template).

## 12. Out of scope / decisions for v1

- **split / merge** are folded under `revise` (not standalone verbs).
- `pm.config.json` gains **no** new keys — management verbs always use the staged-diff gate + planning PR regardless of `conservative`.
- Multi-release execution ordering beyond "topo-sort within a band" is not modeled; releases render in registry order but `complete <release>` runs a single band at a time.

## 13. Verb glossary (final naming)

| PM verb | Roadmap op | Purpose |
|---|---|---|
| `assign <release> <sel>` | `set-release` | tier / MVP-scope |
| `park` / `unpark` | `set-release` | sugar |
| `add-spec <path>` | `ingest-spec` | append a spec |
| `new-spec [idea]` | (brainstormer) | raw idea → spec, stop for review |
| `reorder` | `reorder` | sequence / deps |
| `revise <id>` | `revise` | retitle / re-brief / split / merge |
| `release <sub>` | `release` | registry list/reorder/rename |
| `complete <scope>` | (existing) | execute; scope now accepts a release name |
