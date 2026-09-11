# Actors and domain

<!-- Written by context-builder. Linked from PROJECT-CONTEXT.md's `## Users` heading.
     The brainstormer role reads this: it needs an actor taxonomy, an entity lifecycle,
     and the canonical data stores before it can write a spec, and before this file
     existed it had nowhere to read them from.
     Every claim ends with `source: <document path | interview>`. -->

## Actors

| Actor | May do | May never do | source |
|---|---|---|---|
<!-- fill: one row per role that triggers, or is affected by, the system.
     The "may never" column is the load-bearing one — it is what a reviewer checks a
     permission change against. -->

## Domain entities

| Entity | States | Who moves it between them | source |
|---|---|---|---|
<!-- fill: the core nouns and their lifecycle. An entity whose states nobody can name is
     a sign the domain is not yet understood. -->

## Canonical data stores

<!-- fill: where truth lives for each entity, and — just as important — what may NOT be
     introduced as an alternative store. The second half is what stops a feature quietly
     growing a second source of truth. -->
