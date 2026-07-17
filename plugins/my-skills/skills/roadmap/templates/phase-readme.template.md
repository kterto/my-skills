---
id: {{id}}
kind: phase
title: {{title}}
status: {{rollup_status}}
release: {{release}}
system: {{system}}
milestone: "{{milestone}}"
sequence: {{sequence}}
depends_on: {{depends_on}}
created_at: {{created_at}}
updated_at: {{updated_at}}
---
[Roadmap](../../README.md) / [{{milestone}}](../README.md) / {{id}}

# Phase {{id}} — {{title}} {{release_badge}} {{system_badge}}

<!-- {{release_badge}} is the phase's DERIVED release badge: the shared band of its
     not-done child stories (e.g. `[mvp]`), or `[mixed]` when those children differ,
     or omitted entirely when all not-done children are untiered (null). Legacy phases
     with no release data render no badge. See references/mutation-ops.md. -->

<!-- {{system_badge}} is the phase's DERIVED system badge (parallel to release): the
     shared system of its not-done child stories (e.g. `[backend]`), or `[cross-cutting]`
     when those children differ, or omitted entirely when all not-done children are
     untagged (null). Legacy phases with no system data render no badge. It sits next to
     {{release_badge}}; the two bands are orthogonal. See references/mutation-ops.md. -->

**Status:** {{rollup_status}}
**Release:** {{release_derived}}   <!-- derived band or `mixed`/`untiered`; omit line when legacy/untiered -->
**System:** {{system_derived}}   <!-- derived system or `cross-cutting`/`untagged`; omit line when legacy/untagged -->

## Progress

- **Rollup:** {{done_count}}/{{total_count}} stories done ({{pct}}%)
- **By release:** {{per_release_progress}}   <!-- e.g. `mvp 2/3 · v1.1 0/1 · backlog 0/2`; each named band + backlog with done/total; omitted for legacy/untiered phases -->

## User stories (in execution order)
{{story_list_ordered_by_sequence}}

<!-- Each story row carries its own release badge token (`[<release>]`, omitted when
     untiered) and system badge token (`[<system>]`, omitted when untagged) alongside its
     id/title/status, e.g.
     `- [001.1.1 — Init repo](001.1.1-init-repo.md) [mvp] [backend] todo` -->

## User stories by release
{{story_groups_by_release}}

<!-- Release grouping / filter view: stories grouped under a heading per band, in
     roadmap.lock.json `releases[]` order, with `backlog` last and untiered stories
     under an `(untiered)` group. Rendered only when the phase has ≥1 tiered story;
     legacy/untiered phases omit this whole section. -->

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| {{created_at}} | {{rollup_status}} | roadmap-skill | /roadmap plan |
