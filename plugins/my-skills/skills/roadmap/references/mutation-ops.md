# Roadmap — Mutation Operations Reference

This document is the single source of truth for the doc-only **mutation operations** the `roadmap` skill exposes on an existing `/roadmap/`: `set-release`, `set-system`, `ingest-spec`, `reorder`, `revise`, `release`, `system`, `add-item`, and the `migrate-systems` procedure. It also defines the staged-diff marker set, the phase/milestone cascade + derived `[mixed]`/`[cross-cutting]` badges, and the structural-immutability rule that all ops obey.

These ops are the mutation engine invoked by the `product-manager` skill's management verbs (see `product-manager/references/roadmap-management.md`). The roadmap skill applies the mutation; the PM skill resolves the selection, cuts a branch, and commits/pushes/PRs. **Exactly one skill (`roadmap`) writes `/roadmap/`.**

---

## The apply contract (every op obeys this)

Every mutation operation follows the same doc-only lifecycle — identical to the existing re-eval model in `sync-and-reeval.md`:

1. **Stage** — the op **receives an explicit id set** from the caller (the PM front-door resolves any selection, including natural language, to ids — see `product-manager/references/roadmap-management.md`). Compute the change against the current tree + `roadmap.lock.json`; validate the id set and list it in a **staged diff** using the marker set below.
2. **Gate** — present the staged diff and require explicit user approval. A `--yes` flag (passed through from the PM front-door) skips the gate for trusted quick edits.
3. **Write** — on approval, apply the file writes: update item frontmatter/body, append audit rows, update `roadmap.lock.json` (including lazy `releases[]` creation). **Then re-render the readiness views** (the embedded index matrix and the standalone `/roadmap/release-matrix.<ext>` dashboard) whenever this op changed a **readiness input** — a story's `status`, `release`, or `system`; the `releases[]` order/names; or the `config.systems` set — per the refresh rule in `SKILL.md` → Release readiness (subject to its render gate). This covers `set-release`, `set-system`, `ingest-spec`, `add-item`, `revise` (when it supersedes/splits/merges), `release` (registry reorder/rename), and `migrate-systems`. **`reorder` is exempt** — it changes only `sequence`, which is not a readiness input, so it leaves both views untouched.
4. **Propose commit** — print a proposed commit message (e.g. `docs(roadmap): <verb> …`). **Never commit.**
5. **Never commit / never run the orchestrator.** The op writes files and stops. Committing, pushing, and PR-opening are the PM front-door's job.

If the user rejects at the gate, **no files are written** and the op reports the discard back to the caller.

---

## Staged-diff marker set

The mutation ops extend the existing re-eval markers (`+ new`, `~ changed`, `! superseded`) with two band markers:

| Marker | Meaning |
|---|---|
| `+ new` | A newly appended item (new stable ID) — e.g. an `ingest-spec` append, or a materialized split/merge product. |
| `~ changed` | An in-place body/acceptance/order change on a **not-done** item (`revise`, `reorder`). |
| `! superseded` | A not-done item retired via `status: superseded` (e.g. the old story replaced by a split/merge). |
| `± release` | A **release-band** change on an item (the `set-release` op). Orthogonal to status; applies to items of any status. |
| `⊞ system` | A **system-band** change on an item (the `set-system` op, and the bulk `migrate-systems` procedure). Orthogonal to status; applies to items of any status. |

Every staged diff header lists the **exact resolved id set** the op will touch before any `+ ~ ! ± ⊞` rows.

---

## Structural immutability rule

Reaffirms `sync-and-reeval.md` and the item schema:

- `done` and `superseded` items are **structurally frozen**: their `id`, `sequence`, `depends_on`, title, `## Brief`, `## Acceptance`, and history never change.
- **The mutations permitted on a frozen item are a `release`-band change (`± release`) or a `system`-band change (`⊞ system`)** — both bands are classification metadata orthogonal to status, so either may be edited on `done`/`superseded` items. (Tagging done work with a `system` is in fact required so the `release × system` readiness matrix counts completed stories — see `migrate-systems`.)
- Structural verbs — `reorder`, `revise`, and the split/merge folded into `revise` — apply to **not-done** items only (`todo`, `in_progress`, `blocked`). They never renumber and never touch done work; scope convergence happens by **appending** new stable IDs and **superseding** the old not-done stories.

---

## Cascade + derived `[mixed]` / `[cross-cutting]` badges

Both bands are stored on items, but phase/milestone **rendering** derives its badge from children. The `release` and `system` bands cascade and derive identically — only the derived-"they-differ" badge label differs (`[mixed]` for release, `[cross-cutting]` for system):

- **`release`.** Assigning a band to a **phase or milestone** id cascades the band to **all not-done descendant stories** (done/superseded descendants keep their existing band; only a band change is allowed on them, and cascade does not force one). A phase/milestone **README shows a derived badge**: the shared band when all its not-done descendant stories agree (e.g. `[mvp]`), or `[mixed]` when they differ. An untiered scope (all not-done children `null`) shows **no badge**. Per-release progress and grouping in the READMEs derive from the same descendant bands (see the templates).
- **`system`.** Assigning a system to a **phase or milestone** id cascades it to **all not-done descendant stories** exactly as `release` does (done/superseded descendants keep their existing system; a system change is still allowed on them, but cascade does not force one). A phase/milestone **README shows a derived system badge**: the shared system when all its not-done descendant stories agree (e.g. `[backend]`), or `[cross-cutting]` when they differ. An untagged scope (all not-done children `null`) shows **no badge**. `[cross-cutting]` is the system-band analog of `[mixed]`.

---

## Operations

### `set-release <release> <ids…>`

Assign a release band to the selected items.

- **Story id** → set that story's `release` directly.
- **Phase / milestone id** → cascade the band to all **not-done descendant stories** (see Cascade above); the phase/milestone renders the derived badge.
- `<release>` may be a named band (implicitly created in `releases[]` if new — see `directory-layout.md`), the reserved `backlog`, or `null` (un-tier).
- Editable on items of **any** status. A band change appends the release-change audit row (`± release`), leaving `status` unchanged (see `item-schema.md` → Release-change audit row).
- Diff marker: `± release`.

### `set-system <system> <ids…>`

Assign a system band to the selected items — **fully parallel to `set-release`**, with the deliberate `system`-vs-`release` differences (config-declared set, typo guard, no reserved value):

- **Story id** → set that story's `system` directly.
- **Phase / milestone id** → cascade the system to all **not-done descendant stories** (see Cascade above); the phase/milestone renders the derived badge (`[<system>]` / `[cross-cutting]` / none).
- `<system>` must be a **declared system in `config.systems`** (see `config.md`), or `null` to untag. **An undeclared system is an error** (typo guard) — the op stops and prints the valid declared system names; unlike `set-release`, it never lazily creates the value. `null` (untag) is always permitted.
- Editable on items of **any** status, including `done`/`superseded` (a system band is permitted on frozen items — this is what lets migration tag completed work). A band change appends the system-change audit row (`⊞ system`), leaving `status` unchanged (see `item-schema.md` → System-change audit row).
- Writes the per-item `system` value into `roadmap.lock.json` `items[]` (see `directory-layout.md`); does **not** touch the `config.systems` set.
- Diff marker: `⊞ system`.

### `ingest-spec <path>`

Read a spec file at an **explicit, location-agnostic path** and append its new work as a **targeted re-eval** limited to that spec's content.

- Runs the re-eval diff (see `sync-and-reeval.md` → Re-eval procedure) but **scoped to the referenced spec** rather than the whole context: only milestones/phases/stories the spec introduces or changes are staged.
- **Immutable to `done` work** — never rewrites or renumbers completed items; converges by append + supersede like a normal re-eval.
- **New items default to `release: null`** (untiered) and **`system: null`** (untagged) unless the spec itself pins a band.
- **Preserves existing `release` and `system` values** on any item it touches (see `sync-and-reeval.md`).
- Diff markers: `+ new`, `~ changed`, `! superseded` (and `± release` / `⊞ system` only if the spec explicitly re-bands an item).

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

### `system <list | add <name> [path] | rename <old> <new> | remove <name> [--untag]>`

Manage the **`config.systems` set** (in `/roadmap/roadmap.config.json` — see `config.md`) with **referential integrity**: no sub-op may leave a story carrying a `system` value that is neither declared nor `null`. This is the system-band analog of `release <list|reorder|rename>`, with two deliberate differences — the set is **unordered** (so there is no `reorder`) and it lives in **config**, not the lock. It exists precisely so the systems set is never hand-edited into an inconsistent state; **prefer these ops over editing `roadmap.config.json` by hand** (a manual rename/removal orphans references — see Backward compatibility → orphan handling).

- `system list` — print the declared systems (`name` + optional `path`) with a per-system count of stories carrying that band, **and two integrity checks**: (a) **orphans** — any story whose `system` is **non-null but not declared** (e.g. left by a hand-edit) is reported with its id and offending value; (b) **shadowed systems** — any declared system whose `name` collides with a reserved scope word (`roadmap`, `backlog`), a registered release name, or a milestone/phase id/slug is flagged, because the PM bare-`complete <name>` scope can never reach it (the explicit `system:<name>` form still can — see `product-manager/references/scope-resolution.md` → System scope). Read-only; no diff, no gate.
- `system add <name> [path]` — append a new system to `config.systems`. The safe replacement for hand-editing config. **Name guard:** `<name>` must not collide with (i) an already-declared system, (ii) a **reserved scope word** (`roadmap`, `backlog`), (iii) a **registered release name** in `roadmap.lock.json` → `releases[]`, or (iv) a **milestone/phase id or directory-slug** (e.g. `001`, `001.2`, `001-bootstrap`). A collision is an **error** — the op stops and explains that the name would be shadowed in the PM bare-`complete <name>` scope, suggesting a different name (or the explicit `system:<name>` selector if the name is truly required). This keeps every declared system reachable by its bare scope. A new (empty) system adds a matrix column, so it re-renders the readiness views (per the apply-contract Write step). Diff marker: `~ changed` (config).
- `system rename <old> <new>` — rename a declared system **across `config.systems` AND every story carrying `system: <old>` atomically**. `<old>` must be declared; `<new>` must satisfy the **same name guard as `system add`** (no collision with another system, a reserved word, a release, or a milestone/phase id/slug). Each referencing story's `system` frontmatter + `roadmap.lock.json` `items[].system` is rewritten and a `⊞ system` audit row appended (status unchanged); the config entry (preserving its `path`) is renamed in the same write pass. Because it touches frozen `done`/`superseded` referencing items too (a band change is always permitted on them), completed work stays counted in the matrix. `system rename` is also the remedy for a **pre-existing** shadowed/orphan system surfaced by `system list`. Diff markers: `⊞ system` (each re-banded item) + `~ changed` (config).
- `system remove <name>` — remove a declared system from `config.systems`. **Referential guard:** if **any story still references `<name>`**, the op **stops before staging** and prints the referencing ids, instructing the user to `set-system null <ids>` (untag), `system rename <name> <other>`, or re-run with `--untag`. With **`--untag`**, the op stages the untag in the **same diff**: every referencing story → `system: null` (`⊞ system` rows, status unchanged) **and** the config entry removed — atomic, so no orphan is ever produced. Removing a system drops its matrix column. Diff markers: `~ changed` (config) [+ `⊞ system` per untagged story with `--untag`].

`system add`/`rename`/`remove` obey the apply contract (stage → gate → write → propose commit → never commit). `system list` is read-only. All three writing sub-ops change a readiness input (the `config.systems` set and/or a story `system`), so each re-renders both readiness views per the apply-contract Write step.

### `add-item <kind> [--to <parent-id>]`

Append **one new item** — a `milestone`, `phase`, or `user-story` — directly to an existing `/roadmap/`, without a spec file. The caller (PM front-door) supplies the item body; this op owns id assignment and all id-dependent fields.

- `<kind>` ∈ `milestone | phase | user-story`.
- `--to <parent-id>` names the parent scope: a `user-story` targets a **phase** (or a **milestone** — auto-phase, below); a `phase` targets a **milestone**; a `milestone` takes no parent.
- **ID assignment (stable-identity rule):** the new item takes the **next available number** in its parent scope — `NNN` (milestone), `NNN.M` (phase), `NNN.M.T` (story). Never renumbers existing items.
- New-item frontmatter: `status: todo`, `release: null`, `system: null`, `sequence` = (max `sequence` in the parent scope) + 1, `created_at`/`updated_at` = write timestamp. The caller (PM front-door) may pass a `system` value to set it at creation instead of `null` — it must be a declared `config.systems` name or the op errors (same typo guard as `set-system`); `null` is always permitted. `add-item` writes the field but does not append a separate `⊞ system` audit row (the creation row already records the new item).
- **`user-story`:** the op owns the id-dependent fields — it assigns the id, sets `commit_trailer: Roadmap-Story: <id>`, and appends `Commit with trailer: Roadmap-Story: <id>` as the final line of `## Brief`. The caller passes only `title`, the Brief body, and `## Acceptance`. Body sections are written in schema order (`## Brief`, `## Acceptance`, `## Audit log`).
- **`milestone`:** creates `NNN-<slug>/README.md` and **seeds one default phase** `NNN.1-general/README.md` (empty) so a later `add-item user-story --to <milestone>` has a landing phase. Both appear as `+ new` rows.
- **`phase`:** creates `NNN.M-<slug>/README.md` under the target milestone.
- **Auto-phase:** a `user-story` whose `--to` is a **milestone** with no phase creates the default phase first (as above), then appends the story to it; a milestone that already has phases receives the story in its `-general`/default phase (creating one if absent).
- Appends the creation audit row (see `item-schema.md` → Creation audit row) and one `roadmap.lock.json` `items[]` entry per new file (`content_hash` computed fresh).
- **Immutable to existing work:** only appends new stable ids; never rewrites, renumbers, or supersedes existing items, and never touches `done`/`superseded` work.
- Diff marker: `+ new` (one row per new file; a milestone add shows two — the milestone and its default phase).

### `migrate-systems`

Adopt the `system` band on an **existing** roadmap by interactive inference. It is a doc-only procedure that runs the standard apply contract once over the whole roadmap (one staged diff → gate → bulk write → propose commit → never commit). **Idempotent** — re-running only picks up still-untagged stories. **Tags done items too** — the system band is permitted on frozen items, and completed work must be tagged or it is invisible to the readiness matrix.

Steps:

1. **Config bootstrap.** If `config.systems` (see `config.md`) is **empty**, prompt the user to declare systems one at a time — `name` + optional `path` — via structured questions (`AskUserQuestion` in Claude Code, `question` in opencode), and write them to `/roadmap/roadmap.config.json`. Each proposed name is checked against the **`system add` name guard** (no collision with a reserved word, a registered release, or a milestone/phase id/slug); a colliding name is rejected and re-prompted so bootstrapped systems stay reachable by their bare PM scope. If systems are already declared, skip this step.
2. **Propose per untagged story.** For **every untagged story** (`system: null`, **regardless of status — `done`/`superseded` included**), auto-propose a system by analyzing its `title`, `## Brief`, and parent phase title against the declared system `name`s and their `path` hints. Stories already tagged are left untouched (this is what makes re-running idempotent).
3. **One whole-roadmap staged diff.** Present the entire proposal as a **single** staged diff of `⊞ system` rows, **grouped by proposed system**, so the user can correct any row before applying. Un-inferable stories are shown **untagged** (left `null`) and called out — migration never guesses blindly.
4. **Gate + bulk apply.** On approval, apply every proposed assignment via `set-system` semantics in bulk: write each story's `system` frontmatter, append one system-change audit row per changed story (`⊞ system`, status unchanged), and update `roadmap.lock.json` `items[].system`. Because this is typically the **first** system tagging on a legacy roadmap, it flips the readiness render gate on: per the apply contract's Write step, **render both readiness views now** — this is what first creates `/roadmap/release-matrix.<ext>` and the embedded index matrix. Then **propose the commit `docs(roadmap): migrate-systems`** (which now includes `release-matrix.<ext>`). **Never commit.**
5. **Report.** Print a summary: how many stories were tagged, the per-system counts, and the list of un-inferable stories left `null` for the user to `set-system` / PM `assign-system` manually later.

Diff marker: `⊞ system` (one row per newly-tagged story). Backward compatibility: migration is **opt-in** — a legacy roadmap that never runs it keeps working (untagged, no badges, the readiness matrix shows only an `(untagged)` column).

---

## Backward compatibility

All ops honor the nullable/lazy model:

- **`release`:** a legacy roadmap with no `releases[]` and no item `release` fields is valid. The first `set-release` (or PM `assign`) lazily creates `releases[]` and adds the item's `release` field; nothing is migrated retroactively, and untiered items keep rendering with **no badge**.
- **`system`:** a legacy roadmap with no `config.systems` and no item `system` fields is valid. `system` is nullable and lazily written — the field is added only when a story is first tagged via `set-system` (PM `assign-system`), passed to `add-item` at creation, or bulk-tagged by `migrate-systems`. **No forced migration**; untagged items keep rendering with **no badge**, and the derived `release × system` readiness matrix collapses to a single `(untagged)` column. `null` is always a permitted assignment.

### Orphan handling (referential integrity)

Story `system` values reference the config-owned `config.systems` set. The `system add|rename|remove` op keeps the two sides consistent (rename cascades; remove is guarded/`--untag`), so **going through the ops never produces an orphan**. A **manual edit of `roadmap.config.json`** (renaming or deleting a `name` that stories still carry) can, however, leave an **orphan** `system` value — non-null but no longer declared. Orphans are handled defensively rather than silently dropped:

- **Rendering never drops them.** Any story whose `system` is non-null but undeclared is bucketed into an explicit **`(unknown)` column** in both readiness views (parallel to the `(untagged)` column for `null`), so no story disappears from the matrix. See `SKILL.md` → Release readiness and `item-schema.md`.
- **The integrity check surfaces them.** `system list` reports every orphan with its story id and offending value; the readiness views render the `(unknown)` column with an integrity note listing the affected ids. The fix is `system rename <orphan> <declared>` (re-home) or `set-system null <ids>` / `system remove <orphan> --untag` (untag).
- **A release with unknown-system remaining work is not `READY`** — the `(unknown)` column counts as a laggard exactly like any declared column (see the READY definition in `SKILL.md` → Release readiness).
