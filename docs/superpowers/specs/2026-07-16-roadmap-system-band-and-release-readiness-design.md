# Roadmap system band + release readiness — design

**Date:** 2026-07-16
**Skills touched:** `roadmap`, `product-manager`
**Status:** approved (brainstorm) → ready for implementation plan

## Problem

A monorepo project comprises several distinct **systems** (e.g. `backend`, `landing`, `admin`, `app`) that all advance toward a shared release. Today the roadmap has one orthogonal classification axis — the **`release` band** (`mvp`, `v1.1`, `backlog`) — but no way to express *which system* a story belongs to, and no way to answer "is the MVP shippable across every system, or is one lagging?".

The user needs:
1. A way to scope roadmap work by system.
2. A **release-readiness** view gated across all systems (a release is ready only when every system's stories in that band are done).
3. `product-manager` verbs to operate on those systems.
4. A **migration** path so existing roadmaps can adopt systems.
5. Claude-design prompts for any new templates.

## Chosen approach

Introduce **`system` as a second orthogonal band**, mirroring the existing `release` band machinery (registry, cascade, derived badge, scope matching, nullable/backward-compatible). Release readiness is a **pure derivation** — a `release × system` matrix computed from `status` + `release` + `system`, with **no new stored state**.

### Why a band (not a structural partition)

A release like "MVP" legitimately spans backend + app + admin + landing simultaneously, so system cannot nest under release, and release cannot nest under system — they are orthogonal. A structural top-level partition (`/roadmap/backend/…`) would force each milestone into exactly one system and break the "all systems ship together" requirement. The band model reuses all existing machinery and stays strictly more flexible.

### `system` band vs `release` band — deliberate differences

| Property | `release` band (existing) | `system` band (new) |
|---|---|---|
| Source of truth for the set | lazy `releases[]` registry in `roadmap.lock.json` | **config-declared** in `roadmap.config.json` |
| Order | ordered (train "runs before" order) | **unordered set** (peers) |
| Extra per-entry data | none | optional **`path`** (monorepo package dir) |
| Unknown value on assign | lazily created & registered | **rejected** (typo guard) |
| Reserved value | `backlog` | none |
| Nullability / back-compat | nullable; legacy = untiered, no badge | nullable; legacy = untagged, no badge |
| Derived badge on phase/milestone | `[mvp]` / `[mixed]` / none | `[backend]` / `[cross-cutting]` / none |
| Cascade to not-done descendants | yes | yes |
| Editable on frozen (`done`/`superseded`) items | yes | yes |

Everything not in this table is identical to the `release` band.

### Release readiness — derivation only

```
cell(release r, system s) := { done: |stories where release=r ∧ system=s ∧ status∈{done,superseded}|,
                               total:|stories where release=r ∧ system=s| }
READY(r) := every not-superseded story with release=r is done, regardless of system
          ( i.e. no cell in row r — every declared-system column AND the (untagged) column — has remaining not-done work )
```

`superseded` stories count toward "no remaining work" exactly as in the existing rollup function. Untagged (`system: null`) stories in a band appear in an `(untagged)` column so nothing is silently dropped from the matrix. No new fields are persisted — the matrix is recomputed on demand.

## Roadmap skill changes

### `references/config.md`

New key:

| Key | Type | Default | Override file | CLI flag |
|---|---|---|---|---|
| `systems` | array of `{name: string, path?: string}` | `[]` (no systems declared) | `/roadmap/roadmap.config.json` | — |

- `name` — the system band value (e.g. `backend`). Unique within the array.
- `path` — optional monorepo package directory (e.g. `apps/api`). Advisory metadata; **stored now, used for routing later** (see Path routing).
- An empty/absent `systems` array means the roadmap is not system-partitioned — fully backward-compatible; no badges, no matrix rows beyond `(untagged)`.
- **Typo guard:** assigning a `system` value not present in this set is an error (unlike `release`, which lazily creates). Rationale: systems are deployables, not free-form trains — a typo should fail loudly.

### `references/item-schema.md`

- New user-story frontmatter key: `system: string | null` (default absent/`null`). Nullable for backward-compat; legacy items render unchanged (untagged, no badge).
- **Derived on phase/milestone** (like `release`): shows the shared system of its not-done descendant stories, the derived badge `[cross-cutting]` when they differ, or no badge when all are `null`.
- New audit convention: a **system-band change appends one row** to the existing 4-column `## Audit log` table (no new column), status unchanged, `evidence = system: <old>→<new> (set-system)` — exactly parallel to the release-change row. A front-door caller may append a source suffix (e.g. `(set-system via /product-manager assign-system)`).

### `references/directory-layout.md`

- `roadmap.lock.json` `items[]` entries gain `system: string | null`. The **set** of systems lives in config (unlike `releases[]`, which is in the lock); the lock stores only the per-item value so scope matching does not have to open every story file. For `kind: milestone`/`kind: phase` entries the stored value is non-authoritative for rendering (badge derived from descendants), consistent with `release`.
- Backward compatibility: a lock without `system` fields is valid; items are untagged.

### `references/mutation-ops.md`

- New op **`set-system <system> <ids…>`**, fully parallel to `set-release`:
  - Story id → set `system` directly.
  - Phase/milestone id → cascade to all **not-done** descendant stories (done/superseded keep their value; a band change is still permitted on them but cascade does not force one).
  - `<system>` must be a declared system in config, or `null` to untag. **Unknown → error** (typo guard).
  - Editable on items of any status; appends the system-band audit row.
  - Diff marker: **`⊞ system`**.
- New op **`migrate-systems`** (see Migration).
- Staged-diff marker set extends to: `+ new`, `~ changed`, `! superseded`, `± release`, **`⊞ system`**.
- Structural immutability rule updated: the permitted mutations on a frozen item are now **a release-band change or a system-band change** (both orthogonal to status).

### `references/sync-and-reeval.md`

- Re-eval and `ingest-spec` **preserve** existing `system` values (as they do for `release`); new items default `system: null`.

### `SKILL.md`

- Invocation table gains two direct commands (doc-only, like `sync`/re-eval — write files, propose commit, never commit):
  - `/roadmap migrate-systems` — run the Migration procedure.
  - (`set-system` is invoked via the PM front-door; also runnable directly for parity with the other ops.)
- Mutation-ops section lists `set-system` and `migrate-systems`.
- New **Release readiness** subsection describing the matrix derivation and where it renders (index README section + dedicated dashboard artifact).

## Migration procedure (`migrate-systems`)

Interactive inference, idempotent, tags done items too.

1. **Config bootstrap.** If config `systems` is empty, prompt the user to declare systems one at a time (`name` + optional `path`) via structured questions, and write them to `/roadmap/roadmap.config.json`. If already declared, skip.
2. **Propose per story.** For **every untagged story** (`system: null`, regardless of status — done items included so the readiness matrix counts completed work), auto-propose a system by analyzing its `title` / `## Brief` / parent phase title against the declared system names and their `path` hints. Stories already tagged are left untouched (idempotent — re-running only picks up stragglers).
3. **One staged diff.** Present the whole-roadmap proposal as a single staged diff (`⊞ system` rows), grouped by proposed system, so the user can correct any row before applying.
4. **Gate + apply.** On approval, apply via `set-system` semantics in bulk, append audit rows, update the lock, propose a commit (`docs(roadmap): migrate-systems`). Never commit.
5. **Un-inferable stories** stay `null` and are reported; the user can `assign-system` them manually later. Migration never guesses blindly — an ambiguous story is shown untagged for the user to fill.

Backward compatibility: migration is opt-in. A legacy roadmap that never runs it keeps working (untagged, no badges, matrix shows only an `(untagged)` column).

## Product-manager skill changes

### New verb: `assign-system <system> <selection>`

Maps to roadmap `set-system`. Standard management-verb front-door: resolve selection (ids/globs **and** natural language) → cut `pm/roadmap-assign-system-<slug>` → op stages `⊞ system` diff → gate → commit `docs(roadmap): assign-system …` → planning PR. `--yes` supported. Typo-guarded against config systems.

### New verb: `migrate-systems`

Wraps roadmap `migrate-systems` with the planning-PR flow: cut `pm/roadmap-migrate-systems` → op runs the interactive Migration procedure → gate → commit `docs(roadmap): migrate-systems` → planning PR. (The bare `/roadmap migrate-systems` direct command does the doc-only write without git.)

### New verb: `release-status [release]`

Read-only. Prints the `release × system` readiness matrix (all releases if none named; one row if named), per-cell `done/total`, and a `READY? / laggards` verdict per release. No branch, no gate, no PR — mirrors `release list`.

### `complete` scope — universal `--system <name>` filter

Rather than adding N new scope tokens, `--system <name>` is a **universal intersect filter** composable with any base scope:

| Invocation | Resolved queue |
|---|---|
| `complete mvp --system backend` | stories where `release=mvp ∧ system=backend`, not-done, topo-ordered |
| `complete backend` (bare system name as scope) | all not-done `system=backend` stories across releases; **backlog excluded** (active-scope rule) |
| `complete 001 --system app` | milestone 001 stories filtered to `system=app` |
| `complete mvp` (unchanged) | whole mvp band, all systems |

- `--system` validates against config `systems` (typo guard); unknown → stop and print valid system names.
- Bare-system-as-scope resolves in Scope matching after milestone/phase/release matching fails but before the unrecognized-scope stop; it excludes `backlog` like every other active scope.
- `references/scope-resolution.md` gains: the bare-system scope row, the `--system` filter (applied after base scope matching, before Filter), and the typo-guard stop.

### `add-ticket` / `add-milestone` / `add-phase` — `--system <name>`

- `--system <name>` sets the new item's `system` at creation (passed through to `add-item`, which writes the field). Typo-guarded.
- Omitted: conservative mode asks which system (structured question, offering the declared set + "leave untagged"); autonomous leaves `system: null`.

### Path routing — store now, route later

PM reads the resolved system's `path` from config and, for a system-scoped story, **appends a context note** to the orchestrator brief handoff (e.g. a trailing line `System: app (package: apps/mobile)`), and surfaces `path` in the `release-status` matrix. PM does **not** change where the orchestrator runs. Actual package-dir routing is a deferred future story.

### References touched

- `references/roadmap-management.md` — add `assign-system`, `migrate-systems` to the verb catalog + op mapping; `⊞ system` marker.
- `references/scope-resolution.md` — bare-system scope, `--system` filter, typo guard.
- `SKILL.md` — verb table rows, `release-status`, `--system` flag in the `complete` signature, error-handling rows (unknown system).

## Templates → Claude-design prompts

Two prompts, authored into `docs/design-prompts/` alongside the existing numbered family (`01-roadmap-index.md` … `11-…`):

1. **New** `docs/design-prompts/12-roadmap-release-matrix.md` → produces `plugins/my-skills/skills/roadmap/templates/release-matrix.template.html` (and a matching `.md` template for `output_format: md`). The `release × system` readiness dashboard: rows = releases (registry order) + an untiered row; columns = declared systems + `(untagged)`; cells = `done/total` progress with state color; a `READY?` verdict column; laggard callouts; self-contained, theme-aware, no external assets, following the existing design-system tokens from `00-design-system.md`.

2. **Additions** `docs/design-prompts/13-roadmap-system-badge-and-matrix-additions.md` → describes the incremental edits to the existing four-template family so they can be regenerated consistently:
   - a `system` badge token (`[backend]` / `[cross-cutting]`) rendered next to the existing release badge on index / milestone / phase / user-story artifacts;
   - an embedded compact readiness-matrix section in the roadmap index template.

Both `.md` template variants get the same badge/matrix tokens (plain-text rendering) so `output_format: md` stays at parity.

## Out of scope (YAGNI)

- **Per-cell exit criteria / human sign-off** — readiness is auto-derived from story status only.
- **Orchestrator package-dir routing** — `path` is stored and surfaced but does not change the orchestrator's working directory yet (deferred story).
- **`.opencode` ports** — `roadmap` and `product-manager` are not ported to `.opencode/skills/`, so no parity work is required for this change.
- **Ordered systems / system dependencies** — systems are an unordered peer set.

## Backward compatibility summary

- No migration is forced. A legacy roadmap with no `systems` config and no `system` fields renders and executes unchanged.
- All new fields are nullable and lazily written; keys are added only when a system is first assigned (or migration runs).
- The readiness matrix degrades gracefully: with nothing tagged it shows a single `(untagged)` column.
