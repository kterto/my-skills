---
id: {{id}}
kind: user-story
title: {{title}}
status: {{status}}
release: {{release}}
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

# {{id}} — {{title}} {{release_badge}}

<!-- {{release_badge}} renders as `[<release>]` (e.g. `[mvp]`, `[v1.1]`, `[backlog]`) when the item is tiered,
     and to nothing (omitted entirely) when release is null/absent — legacy untiered stories show no badge.
     Cross-format equivalence: the md badge is the pre-rendered bracketed form of the same band the html
     sibling exposes raw in `data-release` (`{{release}}` on stories, `{{release_derived}}` on phase/milestone)
     and brackets via JS. Both formats show the identical band; only the representation differs. -->

## Brief
{{brief}}

Commit with trailer: Roadmap-Story: {{id}}

## Acceptance
{{acceptance}}

## Audit log
| when (ISO-8601) | status | who | evidence |
|---|---|---|---|
| {{created_at}} | {{status}} | roadmap-skill | /roadmap plan |
