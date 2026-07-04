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

## Milestones (in execution order)
{{milestone_list_ordered_by_sequence}}

<!-- Each milestone row carries its derived release badge token (`[<release>]`/`[mixed]`,
     omitted when untiered) alongside its id/title/status. -->

## Milestones by release
{{milestone_groups_by_release}}

<!-- Release grouping / filter view: milestones grouped under a heading per band, in
     `releases[]` order, with `backlog` last and untiered milestones under an
     `(untiered)` group, each with per-release progress. Rendered only when the
     roadmap has ≥1 tiered item; legacy/untiered roadmaps omit this whole section. -->
