# ADR-0001 — Model systems as an orthogonal roadmap band

- **Status:** Accepted
- **Date:** 2026-07-16
- **Skills affected:** `roadmap`, `product-manager`
- **Source design:** [`docs/superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md`](../superpowers/specs/2026-07-16-roadmap-system-band-and-release-readiness-design.md)

## Context

A monorepo project comprises several distinct **systems** (e.g. `backend`, `landing`, `admin`, `app`) that all advance toward a shared release. The roadmap already had one orthogonal classification axis — the **`release` band** (`mvp`, `v1.1`, `backlog`) — but no way to express *which system* a story belongs to, and no way to answer "is the MVP shippable across every system, or is one lagging?".

A release like "MVP" legitimately spans backend + app + admin + landing **at the same time**. So system cannot nest under release, and release cannot nest under system — the two axes vary independently. Any model that makes one a parent of the other, or that binds a story to a physical directory per system, breaks the "all systems ship together" requirement.

This decision reaches across schemas (`roadmap.lock.json`, item frontmatter), templates (READMEs + the `release × system` readiness dashboard), `product-manager` scope/verbs, the migration path, and future package-dir routing — with long-term trade-offs — so it is recorded here.

## Decision

Model **`system` as a second orthogonal band**: nullable classification **metadata** on each item, not directory hierarchy.

- **Orthogonal to both `status` and `release`.** A story sits in exactly one cell of a derived `release × system` matrix. Release readiness is a **pure derivation** over `status` + `release` + `system` — **no new stored state**.
- **Config-owned set.** The declared systems live in `roadmap.config.json` → `systems` (each an optional `path`), an **unordered peer set** — deliberately unlike the `release` band's lazily-grown, ordered `releases[]` lock registry. Assigning an undeclared system is a **typo-guard error** (no reserved value; `null`/untag always permitted).
- **Reuses the `release` machinery** otherwise: nullable + backward-compatible (legacy roadmaps render/execute unchanged, no badges), cascade to not-done descendants, derived phase/milestone badge (`[backend]` / `[cross-cutting]`), editable on frozen `done`/`superseded` items so completed work still counts toward readiness.

The full `release`-vs-`system` difference table is in the source design's *"`system` band vs `release` band — deliberate differences"* section.

## Consequences

**Positive**

- Preserves **cross-system releases** — a release band spans every system simultaneously; readiness is gated across all of them.
- Maximal reuse of existing band machinery; strictly more flexible than a structural partition.
- Readiness views store nothing — they cannot drift from the source of truth.

**Costs / obligations future operations must maintain**

- **Config→lock referential integrity.** Story `system` values reference the config-owned set. Renames/removals must stay consistent: the `system <list|add|rename|remove>` op cascades renames and guards removals; a manual config edit that orphans references is surfaced (not dropped) via a defensive **`(unknown)` matrix column** and the `system list` integrity check. See ADR obligations in `roadmap/references/mutation-ops.md` → Orphan handling.
- **Namespace constraints.** A system name must not collide with a reserved scope word (`roadmap`, `backlog`), a release, or a milestone/phase id — otherwise the PM bare `complete <name>` scope is shadowed. The declaration ops reject collisions, `system list` flags pre-existing ones, and the explicit unshadowable **`system:<name>`** scope always reaches a system. See `product-manager/references/scope-resolution.md` → System scope.
- **Metadata, not structure.** Systems are tags, so existing roadmaps need a **migration** (`migrate-systems`) to adopt them; untagged work lands in a dedicated `(untagged)` column.
- **`path` is advisory.** The optional per-system `path` is stored now and surfaced by PM, but actual package-dir routing is a **deferred** future story — nothing changes where the orchestrator runs today.
- **System `name` and `path` are untrusted input (injection boundary).** `roadmap.config.json` is contributor-editable, and both fields are surfaced widely — `path` into a command-capable agent's prompt, and `name` into YAML frontmatter/lock, HTML badges/attributes, and renderer-generated readiness markup. Both must be constrained at the source: `name` to a **strict kebab grammar** (`^[a-z0-9]([a-z0-9-]*[a-z0-9])?$`) and `path` to a **normalized repo-relative token** (no absolute/`..`/control-char/newline). On top of the grammar, values must be **serialized as safe YAML scalars** and **context-aware HTML-escaped** on render, `path` passed only as **clearly delimited untrusted metadata the agent must not interpret as instructions**. Any future use (routing, tooling, new artifacts) inherits these obligations. See `roadmap/references/config.md` → `name`/`path`, `roadmap/references/item-schema.md` → html mode, and `product-manager/SKILL.md` → System context block.

## Alternatives considered

- **Structural top-level partition** (`/roadmap/backend/…`) — *rejected.* Forces each milestone into exactly one system and breaks the all-systems-ship-together requirement.
- **Nest `system` under `release` (or vice-versa)** — *rejected.* The axes are orthogonal; neither is a parent of the other.
