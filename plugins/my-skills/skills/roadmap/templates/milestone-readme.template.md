---
id: {{id}}
kind: milestone
title: {{title}}
status: {{rollup_status}}
release: {{release}}
sequence: {{sequence}}
depends_on: {{depends_on}}
created_at: {{created_at}}
updated_at: {{updated_at}}
---
[Roadmap](../README.md) / {{id}}

# Milestone {{id}} — {{title}} {{release_badge}}

<!-- {{release_badge}} is the milestone's DERIVED release badge: the shared band of its
     not-done descendant stories (e.g. `[mvp]`), or `[mixed]` when they differ, or
     omitted when all not-done descendants are untiered (null). Legacy milestones with
     no release data render no badge. See references/mutation-ops.md. -->

**Status:** {{rollup_status}}
**Release:** {{release_derived}}   <!-- derived band or `mixed`/`untiered`; omit line when legacy/untiered -->

## Progress

- **Rollup:** {{done_count}}/{{total_count}} stories done ({{pct}}%)
- **By release:** {{per_release_progress}}   <!-- e.g. `mvp 4/6 · v1.1 0/3 · backlog 0/2`; each named band + backlog with done/total; omitted for legacy/untiered milestones -->

## Phases (in execution order)
{{phase_list_ordered_by_sequence}}

<!-- Each phase row carries its derived release badge token (`[<release>]`/`[mixed]`,
     omitted when untiered) alongside its id/title/status. -->

## Phases by release
{{phase_groups_by_release}}

<!-- Release grouping / filter view: phases grouped under a heading per band, in
     roadmap.lock.json `releases[]` order, with `backlog` last and untiered phases
     under an `(untiered)` group. Rendered only when the milestone has ≥1 tiered
     story; legacy/untiered milestones omit this whole section. -->

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| {{created_at}} | {{rollup_status}} | roadmap-skill | /roadmap plan |
