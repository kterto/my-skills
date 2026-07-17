---
id: SPEC-20260716T160856Z-6068
title: Roadmap system band and release-readiness matrix
status: READY_FOR_PLANNING
created_at: 2026-07-16T16:08:56Z
updated_at: 2026-07-16T16:08:56Z
cycle: 0
related_to: docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md, SPEC-20260704T182442Z-ab87
---

## Summary

Add a **`system` band** — a second orthogonal classification axis mirroring the existing `release` band — to the `roadmap` and `product-manager` skills. Systems (e.g. `backend`, `landing`, `admin`, `app`) are config-declared in `roadmap.config.json` with an optional package `path`. Release readiness becomes a **derived** `release × system` matrix computed purely from story `status`, `release`, and `system` (no new stored state). A `migrate-systems` procedure lets existing roadmaps adopt systems by interactive inference; new PM verbs (`assign-system`, `migrate-systems`, `release-status`) and a universal `--system` filter operate the band. This is documentation-and-template authoring only (skill SKILL.md + `references/*.md`, `roadmap.lock.json`/`roadmap.config.json` schema docs, HTML/MD templates) plus two new Claude-design prompt files — there is no runtime application code in scope.

## Goals

- Let roadmap work be scoped by **system** via a nullable, backward-compatible `system` band that reuses the existing `release`-band machinery (registry-style set, cascade, derived badge, scope matching, nullability).
- Declare the set of systems in `roadmap.config.json` as `[{name, path?}]`; assigning an undeclared system is a **hard error** (typo guard).
- Provide a **release-readiness** `release × system` matrix, auto-derived from story status only, that answers "is this release shippable across every system, or is one lagging?".
- Add PM verbs `assign-system`, `migrate-systems`, `release-status`, and a universal `--system <name>` intersect filter (plus a bare-system-name scope) to `complete`, `add-ticket`, `add-milestone`, `add-phase`.
- Provide a `migrate-systems` procedure that adopts systems on existing roadmaps via interactive inference over one whole-roadmap staged diff, idempotently, tagging DONE items too so the matrix counts completed work.
- Store each system's optional `path` and surface it (context note on the orchestrator brief handoff + in the readiness matrix) without changing where the orchestrator runs ("store now, route later").
- Author two Claude-design prompts for the new readiness-matrix template and the incremental badge/matrix additions to the existing template family, keeping `output_format: md` and `html` at parity.

## Non-goals

- **Per-cell exit criteria or human sign-off** — readiness is auto-derived from story status only.
- **Orchestrator package-dir routing** — `path` is stored and surfaced but does not change the orchestrator's working directory (deferred future story).
- **`.opencode` ports** — `roadmap` and `product-manager` are not ported to `.opencode/skills/`; no parity work.
- **Ordered systems / system dependencies** — systems are an unordered peer set.
- No structural directory partition (`/roadmap/<system>/…`); `system` is a band, not a filesystem split — a milestone/phase may span systems.

## Users and use cases

- **Roadmap author (`/roadmap` direct commands):** runs `/roadmap migrate-systems` to adopt systems on an existing roadmap, or `set-system` for parity edits. Doc-only — writes files, proposes a commit, never commits. Success: untagged stories (incl. DONE) get a proposed system in one reviewable staged diff; un-inferable stories stay `null` and are reported.
- **Product manager (`/product-manager` verbs):** runs `assign-system`, `migrate-systems` (with the planning-PR flow), and `release-status` (read-only), and uses `--system` / bare-system scope with `complete`. Action verbs run git, gate, commit `docs(roadmap): …`, and open a planning PR. Success: system assignment and readiness reporting work through the standard front-door with typo guarding.
- **Reader of the readiness view:** opens the roadmap index README section or the dedicated release-matrix dashboard artifact and sees per-cell `done/total`, a `READY?` verdict per release, and laggard callouts. Success: legacy/untagged work is never silently dropped — it appears in an `(untagged)` column.

## Functional requirements

1. **Config `systems` key.** `roadmap.config.json` gains `systems: array<{name: string, path?: string}>`, default `[]`, override file `/roadmap/roadmap.config.json`, no CLI flag. `name` is unique within the array (the band value); `path` is an optional monorepo package dir (advisory metadata). Documented in `references/config.md`.
2. **Empty/absent `systems` = not system-partitioned.** Fully backward-compatible: no badges, and the matrix shows only an `(untagged)` column.
3. **Typo guard.** Assigning a `system` value not present in `config.systems` is an **error** (unlike `release`, which lazily creates). `null` is always permitted (untag).
4. **User-story frontmatter `system`.** `references/item-schema.md` gains `system: string | null` (default absent/`null`); legacy items render unchanged (untagged, no badge).
5. **Derived badge on phase/milestone.** Like `release`: show the shared system of not-done descendant stories, the derived badge `[cross-cutting]` when they differ, or no badge when all are `null`. Story-level badge renders as `[<system>]` (e.g. `[backend]`).
6. **Audit convention.** A system-band change **appends one row** to the existing 4-column `## Audit log` table (no new column), status unchanged, `evidence = system: <old>→<new> (set-system)`; a front-door caller may append a source suffix (e.g. `(set-system via /product-manager assign-system)`). Parallel to the release-change row.
7. **Lock schema.** `roadmap.lock.json` `items[]` entries gain `system: string | null` (per-item value only; the *set* of systems lives in config). A lock without `system` fields is valid (untagged). For `milestone`/`phase` entries the stored value is non-authoritative for rendering (badge derived from descendants), consistent with `release`. Documented in `references/directory-layout.md`.
8. **`set-system <system> <ids…>` op** (`references/mutation-ops.md`), fully parallel to `set-release`: story id sets `system` directly; phase/milestone id cascades to all **not-done** descendant stories (done/superseded keep their value; a band change is still permitted on frozen items but cascade does not force one); `<system>` must be declared in config or `null`, unknown → error; editable on items of any status; appends the system-band audit row; diff marker `⊞ system`.
9. **Staged-diff marker set** extends to: `+ new`, `~ changed`, `! superseded`, `± release`, `⊞ system`.
10. **Structural immutability rule** updated: permitted mutations on a frozen (`done`/`superseded`) item are now **a release-band change or a system-band change** (both orthogonal to status).
11. **Sync / re-eval / ingest-spec preserve `system`.** Re-eval and `ingest-spec` preserve existing `system` values (as for `release`); new items default `system: null`. Documented in `references/sync-and-reeval.md`.
12. **Release-readiness derivation (no new stored state):**
    - `cell(release r, system s) := { done: |stories where release=r ∧ system=s ∧ status∈{done,superseded}|, total: |stories where release=r ∧ system=s| }`.
    - `READY(r) :=` for every declared system `s`, every not-superseded story with `release=r` is `done` (no cell in row `r` has remaining not-done work). `superseded` counts as "no remaining work" exactly as in the existing rollup.
    - Untagged (`system: null`) stories appear in an `(untagged)` column so nothing is dropped. The matrix is recomputed on demand.
13. **Migration procedure (`migrate-systems`)** — interactive, idempotent, tags done items too:
    1. **Config bootstrap:** if `config.systems` is empty, prompt the user to declare systems one at a time (`name` + optional `path`) via structured questions and write them to `/roadmap/roadmap.config.json`; skip if already declared.
    2. **Propose per story:** for **every untagged story** (`system: null`, regardless of status — DONE included), auto-propose a system by analyzing `title` / `## Brief` / parent phase title against declared system names and their `path` hints. Already-tagged stories are untouched (idempotent).
    3. **One staged diff:** present the whole-roadmap proposal as a single staged diff (`⊞ system` rows), grouped by proposed system, for row-level correction before applying.
    4. **Gate + apply:** on approval, apply via `set-system` semantics in bulk, append audit rows, update the lock, propose commit `docs(roadmap): migrate-systems`. Never commit.
    5. **Un-inferable stories** stay `null` and are reported; migration never guesses blindly.
14. **`SKILL.md` (roadmap):** invocation table gains `/roadmap migrate-systems` (doc-only, like `sync`/re-eval — writes files, proposes commit, never commits); `set-system` also runnable directly for parity. Mutation-ops section lists `set-system` and `migrate-systems`. New **Release readiness** subsection describing the matrix derivation and where it renders (index README section + dedicated dashboard artifact).
15. **PM verb `assign-system <system> <selection>`** → roadmap `set-system`. Standard management-verb front-door: resolve selection (ids/globs **and** natural language) → cut `pm/roadmap-assign-system-<slug>` → op stages `⊞ system` diff → gate → commit `docs(roadmap): assign-system …` → planning PR. `--yes` supported. Typo-guarded against config systems.
16. **PM verb `migrate-systems`** wraps roadmap `migrate-systems` with the planning-PR flow: cut `pm/roadmap-migrate-systems` → op runs the interactive Migration procedure → gate → commit `docs(roadmap): migrate-systems` → planning PR. (Bare `/roadmap migrate-systems` does the doc-only write without git.)
17. **PM verb `release-status [release]`** — read-only. Prints the `release × system` readiness matrix (all releases if none named; one row if named), per-cell `done/total`, and a `READY? / laggards` verdict per release. No branch, no gate, no PR — mirrors `release list`.
18. **Universal `--system <name>` filter on `complete`** — an intersect filter composable with any base scope:
    - `complete mvp --system backend` → `release=mvp ∧ system=backend`, not-done, topo-ordered.
    - `complete backend` (bare system name as scope) → all not-done `system=backend` stories across releases; **backlog excluded** (active-scope rule).
    - `complete 001 --system app` → milestone 001 stories filtered to `system=app`.
    - `complete mvp` (unchanged) → whole mvp band, all systems.
    - `--system` validates against `config.systems` (typo guard); unknown → stop and print valid system names.
    - Bare-system-as-scope resolves after milestone/phase/release matching fails but before the unrecognized-scope stop; excludes `backlog`.
    - `references/scope-resolution.md` gains the bare-system scope row, the `--system` filter (applied after base scope matching, before Filter), and the typo-guard stop.
19. **`add-ticket` / `add-milestone` / `add-phase` gain `--system <name>`** — sets the new item's `system` at creation (passed through to `add-item`). Typo-guarded. Omitted: conservative mode asks which system (structured question offering the declared set + "leave untagged"); autonomous leaves `system: null`.
20. **Path routing — store now, route later.** PM reads the resolved system's `path` from config and, for a system-scoped story, **appends a context note** to the orchestrator brief handoff (e.g. trailing line `System: app (package: apps/mobile)`) and surfaces `path` in the `release-status` matrix. PM does **not** change where the orchestrator runs.
21. **PM references touched:** `references/roadmap-management.md` (add `assign-system`, `migrate-systems` to verb catalog + op mapping; `⊞ system` marker); `references/scope-resolution.md` (bare-system scope, `--system` filter, typo guard); `SKILL.md` (verb table rows, `release-status`, `--system` in `complete` signature, error-handling rows for unknown system).
22. **New design-prompt `docs/design-prompts/12-roadmap-release-matrix.md`** → produces `plugins/my-skills/skills/roadmap/templates/release-matrix.template.html` **and** a matching `.md` template. The `release × system` readiness dashboard: rows = releases (registry order) + an untiered row; columns = declared systems + `(untagged)`; cells = `done/total` progress with state color; a `READY?` verdict column; laggard callouts; self-contained, theme-aware, no external assets, following `00-design-system.md` tokens.
23. **New design-prompt `docs/design-prompts/13-roadmap-system-badge-and-matrix-additions.md`** → describes incremental edits to the existing four-template family (roadmap-index, milestone, phase, user-story) so they regenerate consistently: a `system` badge token (`[<system>]` / `[cross-cutting]`) rendered next to the existing release badge, and an embedded compact readiness-matrix section in the roadmap index template. Both `.md` and `.html` template variants get the same badge/matrix tokens (plain-text rendering for `md`) so `output_format: md` stays at parity.

## Non-functional requirements

- **Performance**: readiness matrix is recomputed on demand from lock data; scope matching reads only `roadmap.lock.json` per-item `system` values (no per-story file opens). No stored derived state to keep consistent.
- **Security / auth**: —
- **Localization**: —
- **Accessibility**: release-matrix and badge templates must be theme-aware (light/dark) and self-contained (no external assets/CDN), per the existing design-system tokens.
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: no new user data; doc/template authoring only.
- **Monetization tier**: —

## Project-context fit

**Note on stale PROJECT-CONTEXT.md.** `.orchestrator/PROJECT-CONTEXT.md` currently describes a *completed prior pipeline* (the clean-code-gates G6 `dart_mutant` rewrite) and lists "Any change outside the clean-code-gates skill" as out-of-scope. That is a stale scoping statement for a finished task, not a live invariant for this work. The orchestrator explicitly launched this roadmap/PM feature with an approved, user-signed-off design doc and seven locked decisions, which authorizes this scope. The architect should treat the design doc + this spec as the source of truth and, if desired, refresh PROJECT-CONTEXT.md to reflect the roadmap/PM surface (Step 7 candidate — not required for planning).

- **Layers touched:** the `roadmap` skill (SKILL.md, five `references/*.md`, templates) and the `product-manager` skill (SKILL.md, two `references/*.md`), plus `docs/design-prompts/`. No runtime application code.
- **Depends on / extends:** the existing `release`-band machinery (registry, cascade, derived badge, scope matching, nullability) — the `system` band mirrors it with the deliberate differences tabulated in the design doc. Precedent: `SPEC-20260704T182442Z-ab87` (PM Roadmap-Management Command Surface) established the PM front-door/verb pattern this reuses.
- **Invariant that shapes implementation:** `system` is orthogonal to `release` and to structure — a milestone/phase may span systems; readiness is a pure derivation with **no new stored state** beyond the per-item `system` value and the config `systems[]` set.
- **Backward compatibility is mandatory:** all new fields nullable and lazily written; legacy roadmaps (no `systems` config, no `system` fields) render and execute unchanged.
- **`.md`/`.html` parity** must be preserved across templates and design prompts (`output_format: md` stays at parity with `html`).
- **Skill sync:** in-repo `plugins/my-skills/skills/*` is the source of truth; `sync.sh` mirrors to global. Edits land in-repo.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Roadmap skill** (`plugins/my-skills/skills/roadmap/`):
  - `SKILL.md` — invocation table (`migrate-systems`, `set-system`), mutation-ops list, new **Release readiness** subsection.
  - `references/config.md` — `systems` key.
  - `references/item-schema.md` — `system` story key, derived phase/milestone badge, audit-row convention.
  - `references/directory-layout.md` — lock `items[].system`, back-compat.
  - `references/mutation-ops.md` — `set-system`, `migrate-systems`, `⊞ system` marker, updated staged-diff marker set + frozen-item rule.
  - `references/sync-and-reeval.md` — preserve `system` on re-eval / ingest-spec.
  - `templates/release-matrix.template.html` **(new)** and `templates/release-matrix.template.md` **(new)**.
  - `templates/{roadmap-readme,milestone-readme,phase-readme,user-story}.template.{md,html}` — badge token + (index) embedded readiness-matrix section.
- **Product-manager skill** (`plugins/my-skills/skills/product-manager/`):
  - `SKILL.md` — verb rows (`assign-system`, `migrate-systems`, `release-status`), `--system` in `complete` signature, unknown-system error rows.
  - `references/roadmap-management.md` — `assign-system` / `migrate-systems` verb catalog + op mapping, `⊞ system` marker.
  - `references/scope-resolution.md` — bare-system scope, `--system` filter, typo guard.
- **Design prompts** (`docs/design-prompts/`):
  - `12-roadmap-release-matrix.md` **(new)**.
  - `13-roadmap-system-badge-and-matrix-additions.md` **(new)**.
- **Shared / schema (documented, not code)**: `roadmap.config.json` (`systems[]`), `roadmap.lock.json` (`items[].system`).

## Open questions

- (none — the approved design doc and the seven locked decisions resolve all material ambiguity. Exact intra-template placement/wording of the readiness matrix and `READY?`/laggard rendering are delegated to the Claude-design prompts (`12`, `13`), which is their intended purpose, not spec-level decisions.)

## Decisions resolved by Brainstormer default

<!-- The user pre-approved the design via the referenced design doc; no questions were delegated back. The two items below are pre-locked decisions (from the approved brainstorm), recorded here for the architect's audit trail — not new defaults invented by the brainstormer. -->

- Scope of "existing four-template family" for design-prompt 13 → **roadmap-index, milestone, phase, user-story** templates → these are the four roadmap `templates/*-readme` + `user-story` pairs; matches the design doc's "existing four-template family".
- `.orchestrator/PROJECT-CONTEXT.md` out-of-scope line ("any change outside clean-code-gates") → **treated as stale prior-task context, not a live invariant** → the orchestrator authorized this scope via the approved design doc; surfaced above for the architect rather than treated as a blocking conflict.

## References

- `docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md` — approved design (primary input; resolves the seven locked decisions).
- `plans/specs/SPEC-20260704T182442Z-ab87-pm-roadmap-management.md` — precedent: PM Roadmap-Management Command Surface (front-door/verb pattern reused).
- `plugins/my-skills/skills/roadmap/` and `plugins/my-skills/skills/product-manager/` — target skills (existing SKILL.md, `references/*.md`, `templates/*`).
- `docs/design-prompts/00-design-system.md` … `11-*.md` — existing numbered design-prompt family (new prompts are `12`, `13`).
- `.orchestrator/PROJECT-CONTEXT.md` — stale (describes prior clean-code-gates task); see Project-context fit.
