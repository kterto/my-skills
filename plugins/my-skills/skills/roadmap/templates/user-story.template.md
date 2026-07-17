---
id: {{id}}
kind: user-story
title: {{title}}
status: {{status}}
release: {{release}}
system: {{system}}
milestone: "{{milestone}}"
phase: "{{phase}}"
sequence: {{sequence}}
depends_on: {{depends_on}}
spec_refs: {{spec_refs}}
commit_trailer: "Roadmap-Story: {{id}}"
created_at: {{created_at}}
updated_at: {{updated_at}}
---
[Roadmap](../../README.md) / [{{milestone}}](../README.md) / [{{phase}}](README.md) / {{id}}

# {{id}} — {{title}} {{release_badge}} {{system_badge}}

<!-- {{release_badge}} renders as `[<release>]` (e.g. `[mvp]`, `[v1.1]`, `[backlog]`) when the item is tiered,
     and to nothing (omitted entirely) when release is null/absent — legacy untiered stories show no badge.
     Cross-format equivalence: the md badge is the pre-rendered bracketed form of the same band the html
     sibling exposes raw in `data-release` (`{{release}}` on stories, `{{release_derived}}` on phase/milestone)
     and brackets via JS. Both formats show the identical band; only the representation differs. -->

<!-- {{system_badge}} renders as `[<system>]` (e.g. `[backend]`, `[app]`) when the story is tagged,
     and to nothing (omitted entirely) when system is null/absent — legacy untagged stories show no system
     badge. It sits next to {{release_badge}} (the two bands are orthogonal — a story may carry both).
     Cross-format equivalence: the md system badge is the pre-rendered bracketed form of the same value the
     html sibling exposes raw in `data-system` (`{{system}}` on stories, `{{system_derived}}` on phase/milestone)
     and brackets via JS. A story's raw system is never `cross-cutting` (that derived label appears only on
     phase/milestone from differing descendants). -->

## Brief
{{brief}}

Commit with trailer: Roadmap-Story: {{id}}

## Acceptance
{{acceptance}}

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| {{created_at}} | {{status}} | roadmap-skill | /roadmap plan |
