# Roadmap — Mutation Operations Reference

This document is the single source of truth for the six doc-only **mutation operations** the `roadmap` skill exposes on an existing `/roadmap/`: `set-release`, `ingest-spec`, `reorder`, `revise`, `release`, and `add-item`. It also defines the staged-diff marker set, the phase/milestone cascade + derived `[mixed]` badge, and the structural-immutability rule that all ops obey.

These ops are the mutation engine invoked by the `product-manager` skill's management verbs (see `product-manager/references/roadmap-management.md`). The roadmap skill applies the mutation; the PM skill resolves the selection, cuts a branch, and commits/pushes/PRs. **Exactly one skill (`roadmap`) writes `/roadmap/`.**

---

## The apply contract (every op obeys this)

Every mutation operation follows the same doc-only lifecycle — identical to the existing re-eval model in `sync-and-reeval.md`:

1. **Stage** — the op **receives an explicit id set** from the caller (the PM front-door resolves any selection, including natural language, to ids — see `product-manager/references/roadmap-management.md`). Compute the change against the current tree + `roadmap.lock.json`; validate the id set and list it in a **staged diff** using the marker set below.
2. **Gate** — present the staged diff and require explicit user approval. A `--yes` flag (passed through from the PM front-door) skips the gate for trusted quick edits.
3. **Write** — on approval, apply the file writes: update item frontmatter/body, append audit rows, update `roadmap.lock.json` (including lazy `releases[]` creation).
4. **Propose commit** — print a proposed commit message (e.g. `docs(roadmap): <verb> …`). **Never commit.**
5. **Never commit / never run the orchestrator.** The op writes files and stops. Committing, pushing, and PR-opening are the PM front-door's job.

If the user rejects at the gate, **no files are written** and the op reports the discard back to the caller.

---

## Staged-diff marker set

The mutation ops extend the existing re-eval markers (`+ new`, `~ changed`, `! superseded`) with a band marker:

| Marker | Meaning |
|---|---|
| `+ new` | A newly appended item (new stable ID) — e.g. an `ingest-spec` append, or a materialized split/merge product. |
| `~ changed` | An in-place body/acceptance/order change on a **not-done** item (`revise`, `reorder`). |
| `! superseded` | A not-done item retired via `status: superseded` (e.g. the old story replaced by a split/merge). |
| `± release` | A **release-band** change on an item (the `set-release` op). Orthogonal to status; applies to items of any status. |

Every staged diff header lists the **exact resolved id set** the op will touch before any `+ ~ ! ±` rows.

---

## Structural immutability rule

Reaffirms `sync-and-reeval.md` and the item schema:

- `done` and `superseded` items are **structurally frozen**: their `id`, `sequence`, `depends_on`, title, `## Brief`, `## Acceptance`, and history never change.
- **The only mutation permitted on a frozen item is a `release`-band change** (`± release`) — bands are classification metadata orthogonal to status.
- Structural verbs — `reorder`, `revise`, and the split/merge folded into `revise` — apply to **not-done** items only (`todo`, `in_progress`, `blocked`). They never renumber and never touch done work; scope convergence happens by **appending** new stable IDs and **superseding** the old not-done stories.

---

## Cascade + derived `[mixed]` badge

`release` is stored on items, but phase/milestone **rendering** derives its badge from children:

- Assigning a band to a **phase or milestone** id cascades the band to **all not-done descendant stories** (done/superseded descendants keep their existing band; only a band change is allowed on them, and cascade does not force one).
- A phase/milestone **README shows a derived badge**: the shared band when all its not-done descendant stories agree (e.g. `[mvp]`), or `[mixed]` when they differ. An untiered scope (all not-done children `null`) shows **no badge**.
- Per-release progress and grouping in the READMEs derive from the same descendant bands (see the templates).

---

## Operations

### `set-release <release> <ids…>`

Assign a release band to the selected items.

- **Story id** → set that story's `release` directly.
- **Phase / milestone id** → cascade the band to all **not-done descendant stories** (see Cascade above); the phase/milestone renders the derived badge.
- `<release>` may be a named band (implicitly created in `releases[]` if new — see `directory-layout.md`), the reserved `backlog`, or `null` (un-tier).
- Editable on items of **any** status. A band change appends the release-change audit row (`± release`), leaving `status` unchanged (see `item-schema.md` → Release-change audit row).
- Diff marker: `± release`.

### `ingest-spec <path>`

Read a spec file at an **explicit, location-agnostic path** and append its new work as a **targeted re-eval** limited to that spec's content.

- Runs the re-eval diff (see `sync-and-reeval.md` → Re-eval procedure) but **scoped to the referenced spec** rather than the whole context: only milestones/phases/stories the spec introduces or changes are staged.
- **Immutable to `done` work** — never rewrites or renumbers completed items; converges by append + supersede like a normal re-eval.
- **New items default to `release: null`** (untiered) unless the spec itself pins a band.
- **Preserves existing `release` values** on any item it touches (see `sync-and-reeval.md`).
- Diff markers: `+ new`, `~ changed`, `! superseded` (and `± release` only if the spec explicitly re-bands an item).

### `reorder <ids-in-order>` (or `--after <id>`)

Change logical execution order of **not-done** items only.

- Adjusts `sequence` and/or `depends_on` on the selected not-done items to realize the requested order; done/superseded items are never moved and never renumbered (stable-identity rule).
- `<ids-in-order>` gives an explicit order; `--after <id>` places the selection immediately after the given anchor.
- Diff marker: `~ changed`.

### `revise <id>`

Retitle, re-scope, or split/merge **not-done** items only.

- **Retitle / re-scope** — edit `title`, `## Brief`, `## Acceptance`, and/or `depends_on` on a not-done item in place. Diff marker: `~ changed`.
- **Split** — materialize two or more **new stable IDs** (next available numbers) carrying the split-out scope, then `supersede` the old not-done story. Never renumbers, never touches done work. Diff markers: `+ new` (each product) + `! superseded` (the old story).
- **Merge** — materialize **one new stable ID** carrying the combined scope, then `supersede` the merged not-done stories. Diff markers: `+ new` (the merged product) + `! superseded` (each old story).
- There is **no standalone `split`/`merge` op** — both are performed here (SPEC non-goal).

### `release <list | reorder <names…> | rename <old> <new>>`

Manage the `releases[]` registry (order + names) explicitly.

- `release list` — print the current ordered registry (read-only; no diff, no gate).
- `release reorder <names…>` — set a new registry order; the given names must be exactly the current registry set. Re-renders all per-release views in the new order. Diff marker: `~ changed` (on `roadmap.lock.json` / index views).
- `release rename <old> <new>` — rename a band across the registry and every item carrying it; `backlog` cannot be renamed and no name may collide with `backlog`. Diff markers: `± release` (on each re-banded item) + `~ changed` (registry).

### `add-item <kind> [--to <parent-id>]`

Append **one new item** — a `milestone`, `phase`, or `user-story` — directly to an existing `/roadmap/`, without a spec file. The caller (PM front-door) supplies the item body; this op owns id assignment and all id-dependent fields.

- `<kind>` ∈ `milestone | phase | user-story`.
- `--to <parent-id>` names the parent scope: a `user-story` targets a **phase** (or a **milestone** — auto-phase, below); a `phase` targets a **milestone**; a `milestone` takes no parent.
- **ID assignment (stable-identity rule):** the new item takes the **next available number** in its parent scope — `NNN` (milestone), `NNN.M` (phase), `NNN.M.T` (story). Never renumbers existing items.
- New-item frontmatter: `status: todo`, `release: null`, `sequence` = (max `sequence` in the parent scope) + 1, `created_at`/`updated_at` = write timestamp.
- **`user-story`:** the op owns the id-dependent fields — it assigns the id, sets `commit_trailer: Roadmap-Story: <id>`, and appends `Commit with trailer: Roadmap-Story: <id>` as the final line of `## Brief`. The caller passes only `title`, the Brief body, and `## Acceptance`. Body sections are written in schema order (`## Brief`, `## Acceptance`, `## Audit log`).
- **`milestone`:** creates `NNN-<slug>/README.md` and **seeds one default phase** `NNN.1-general/README.md` (empty) so a later `add-item user-story --to <milestone>` has a landing phase. Both appear as `+ new` rows.
- **`phase`:** creates `NNN.M-<slug>/README.md` under the target milestone.
- **Auto-phase:** a `user-story` whose `--to` is a **milestone** with no phase creates the default phase first (as above), then appends the story to it; a milestone that already has phases receives the story in its `-general`/default phase (creating one if absent).
- Appends the creation audit row (see `item-schema.md` → Creation audit row) and one `roadmap.lock.json` `items[]` entry per new file (`content_hash` computed fresh).
- **Immutable to existing work:** only appends new stable ids; never rewrites, renumbers, or supersedes existing items, and never touches `done`/`superseded` work.
- Diff marker: `+ new` (one row per new file; a milestone add shows two — the milestone and its default phase).

---

## Backward compatibility

All ops honor the nullable/lazy model: a legacy roadmap with no `releases[]` and no item `release` fields is valid. The first `set-release` (or PM `assign`) lazily creates `releases[]` and adds the item's `release` field; nothing is migrated retroactively, and untiered items keep rendering with **no badge**.
