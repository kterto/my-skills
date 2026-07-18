<!-- roadmap-release-matrix -->
[← Roadmap index](README.md)

# Release readiness — release × system

**Progress:** {{done_count}}/{{total_count}} stories done ({{pct}}%)

<!-- Derived on demand from each story's status + release + system (roadmap.lock.json + the
     config.systems set). NO new state is stored — this dashboard is recomputed every render.
     See roadmap/SKILL.md → Release readiness for the derivation. -->

## Matrix

{{readiness_matrix}}

<!-- {{readiness_matrix}} is a markdown table the renderer fills:
     - ROWS: one per named release in roadmap.lock.json `releases[]` order, then an
       `(untiered)` row for release: null, then `backlog`.
     - COLUMNS: one per declared system in roadmap.config.json `systems` (any order —
       systems are an unordered peer set). System `name`/`path` are untrusted config: they
       are grammar-constrained on write (config.md → name/path) and escaped on render — never
       emit a raw value (matters when this markdown is converted to html).
       Then an `(untagged)` column for system: null,
       then an `(unknown)` column ONLY when ≥1 story carries a non-null, undeclared system
       (an orphan left by a manual config edit — see below), then a trailing `READY?` column.
     - CELLS: `done/total` for cell(release r, system s) — done counts status ∈ {done,
       superseded}; total counts every story in that cell. A cell with remaining not-done
       work is a laggard.
     - READY?: `READY` only when every not-superseded story in that release is done,
       regardless of system (no cell in the row — every declared-system column, the
       `(untagged)` column, AND the `(unknown)` column when present — has remaining not-done
       work); otherwise `lagging: <col>, …` naming the laggard columns, which may include
       `(untagged)` and `(unknown)`.
     Example (no orphans — `(unknown)` column omitted):

     | release | backend | app | admin | landing | (untagged) | READY? |
     |---|---|---|---|---|---|---|
     | mvp | 6/6 | 4/4 | 3/3 | 2/2 | 0/0 | READY |
     | v1.1 | 1/4 | 0/3 | 0/1 | 0/0 | 0/0 | lagging: backend, app, admin |
     | (untiered) | 0/0 | 0/0 | 0/0 | 0/0 | 2/5 | lagging: (untagged) |
     | backlog | 0/2 | 0/1 | 0/0 | 0/0 | 0/0 | lagging: backend, app |

     When orphans exist, append an `(unknown)` column before `READY?` and, below the table,
     an integrity note: `⚠ unknown system(s): <value> — stories <ids>; fix via system rename/set-system null`.
-->

## Legend

| Marker | Meaning |
|---|---|
| `done/total` | Stories complete (`done`+`superseded`) over total in that release × system cell |
| `READY` | Every not-superseded story in the release is done regardless of system — no column, including `(untagged)`, has remaining not-done work; the release is shippable |
| `lagging: <col>…` | The release has remaining not-done work in the listed column(s), which may include `(untagged)` |
| `(untagged)` column | Stories with `system: null` — nothing is silently dropped; a legacy/untagged roadmap collapses to only this column |
| `(unknown)` column | Stories with a **non-null, undeclared** `system` (orphaned by a manual config edit) — shown (only when present) so they are never dropped; counts as a laggard. Fix via `system rename`/`set-system null` |
| `(untiered)` row | Stories with `release: null` (active but not on a named train) |

<!-- Backward compatibility: a roadmap with no declared systems and no tagged stories renders
     a single `(untagged)` column and every cell of work lands there; no system badges exist.
     `superseded` counts as no-remaining-work, exactly as in the rollup function. -->
