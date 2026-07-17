<!-- roadmap-index -->
# Roadmap

**Progress:** {{done_count}}/{{total_count}} stories done ({{pct}}%)

**By release:** {{per_release_progress}}
<!-- Per-release progress across the whole roadmap, e.g. `mvp 6/12 · v1.1 0/4 · backlog 0/3`;
     named bands in roadmap.lock.json `releases[]` order, then backlog. Omitted for
     legacy/untiered roadmaps (no releases[] and no tiered items). -->

## Status legend

| Status | Meaning |
|---|---|
| `todo` | Not yet started |
| `in_progress` | Actively being worked on |
| `done` | Completed |
| `superseded` | Replaced by another item; no longer active |
| `blocked` | Cannot proceed — dependency or blocker outstanding |

## Release legend

| Badge | Meaning |
|---|---|
| `[mvp]`, `[v1.1]`, … | Named release train (registered, in order, in `roadmap.lock.json` → `releases[]`) |
| `[backlog]` | Parked — excluded from active-scope runs; runs only via `complete backlog` |
| `[mixed]` | Derived badge on a milestone/phase whose not-done children span different bands |
| _(none)_ | Untiered — active but not assigned to a release train |

<!-- Release legend is omitted for legacy/untiered roadmaps (no releases[] and no tiered items). -->

## System legend

| Badge | Meaning |
|---|---|
| `[backend]`, `[app]`, … | Named system — a deployable declared in `roadmap.config.json` → `systems` (unordered peer set) |
| `[cross-cutting]` | Derived badge on a milestone/phase whose not-done children span different systems |
| _(none)_ | Untagged — active but not assigned to a system |

<!-- System legend is omitted for roadmaps with no declared systems and no tagged items.
     The system band is orthogonal to release: a story may carry both a release badge and a
     system badge. See references/config.md (systems key) and references/mutation-ops.md. -->

## Release readiness

{{readiness_matrix}}

<!-- Embedded compact `release × system` readiness matrix, derived on demand (no stored
     state) from each story's status + release + system. Rows = named releases in
     roadmap.lock.json `releases[]` order + an untiered row (release: null) + backlog;
     columns = declared config.systems + an `(untagged)` column for system: null. Each
     cell shows `done/total` (superseded counts as done). A trailing `READY?` column marks
     a release ready only when every not-superseded story in that release is done, regardless
     of system — no column, including `(untagged)`, has remaining not-done work; laggard
     columns (which may include `(untagged)`) are called out. The full-grid dashboard lives in the
     dedicated release-matrix template; this is the compact index view. Rendered only when
     the roadmap has ≥1 declared system OR ≥1 tagged story; a legacy/untagged roadmap
     collapses the whole matrix to a single `(untagged)` column (and the section may be
     omitted entirely when nothing is tagged). See roadmap/SKILL.md → Release readiness and
     templates/release-matrix.template.md. -->

## Milestones (in execution order)
{{milestone_list_ordered_by_sequence}}

<!-- Each milestone row carries its derived release badge token (`[<release>]`/`[mixed]`,
     omitted when untiered) AND its derived system badge token (`[<system>]`/`[cross-cutting]`,
     omitted when untagged) alongside its id/title/status. The two bands are orthogonal. -->

## Milestones by release
{{milestone_groups_by_release}}

<!-- Release grouping / filter view: milestones grouped under a heading per band, in
     `releases[]` order, with `backlog` last and untiered milestones under an
     `(untiered)` group, each with per-release progress. Rendered only when the
     roadmap has ≥1 tiered item; legacy/untiered roadmaps omit this whole section. -->
