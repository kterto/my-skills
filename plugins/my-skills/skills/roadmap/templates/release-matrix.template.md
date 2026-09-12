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
     - ROWS: one per named release in roadmap.lock.json `releases[]` order, then a single
       `(untiered)` row for release: null. `backlog` is NOT a row — parked work is not a
       shippable release; stories with release: backlog are excluded from the matrix.
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
     - RIGOR: the release's rigor **mix** — a count per band over the release's stories, most
       rigorous first, e.g. `9 hardened · 3 sketch`, or `—` when no story in the release
       declares a band. Rigor is NOT a third axis of this table: it is one cell per release row.
       `READY(mvp)` where nine stories ran `delivery` and three ran `sketch` is not one release,
       and this cell is what says so.
     - READY?: `READY` only when every not-superseded story in that release is done,
       regardless of system (no cell in the row — every declared-system column, the
       `(untagged)` column, AND the `(unknown)` column when present — has remaining not-done
       work); otherwise `lagging: <col>, …` naming the laggard columns, which may include
       `(untagged)` and `(unknown)`.
       **A release may declare a `rigor_floor`** in `roadmap.lock.json` → `releases[]`. It never
       blocks: a done release whose stories are not all at or above the floor renders
       `READY (below floor: <n>)` and, below the table, a non-suppressible departure list naming
       those stories and their bands. Refusing to render READY would put the cheapest path to
       green through the floor itself — lower the floor, ship the release — so the matrix states
       the shortfall instead of hiding it behind a verdict.
     Example (no orphans — `(unknown)` column omitted; `mvp` declares `rigor_floor: delivery`):

     | release | backend | app | admin | landing | (untagged) | rigor | READY? |
     |---|---|---|---|---|---|---|---|
     | mvp | 6/6 | 4/4 | 3/3 | 2/2 | 0/0 | 9 hardened · 3 sketch | READY (below floor: 3) |
     | v1.1 | 1/4 | 0/3 | 0/1 | 0/0 | 0/0 | 8 delivery | lagging: backend, app, admin |
     | (untiered) | 0/0 | 0/0 | 0/0 | 0/0 | 2/5 | — | lagging: (untagged) |

     Below a table with any below-floor story:
     `⚠ below rigor_floor delivery — mvp: 001.2.1 (sketch), 001.2.4 (sketch), 001.3.2 (sketch)`

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
| `rigor` cell | The release's mix of rigor bands — what its stories' greens **claim**. `—` when no story declares one. A `sketch` green and a `hardened` green are not the same result, and this cell is where that survives |
| `READY (below floor: n)` | The release is done, and `n` of its stories are below the release's declared `rigor_floor`. Still READY — the floor discloses, it never blocks — with the stories named in the departure list under the table |

<!-- Backward compatibility: a roadmap with no declared systems and no tagged stories renders
     a single `(untagged)` column and every cell of work lands there; no system badges exist.
     `superseded` counts as no-remaining-work, exactly as in the rollup function. -->
