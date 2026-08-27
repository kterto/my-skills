# PROJECT-CONTEXT

<!-- This file is written by the orchestrator bootstrap (Step B1) via the host's structured question tool (normal conversational questions in Prime Agent).
     Fill every section before running the pipeline. The context gate checks that all
     required headings are present and rates holistic confidence >= context_threshold.

     SIZE BUDGET — target 12 KB, and treat 20 KB as the move-it-out line. Every role re-reads this
     file at every spawn, so a long run re-ingests it dozens of times. Keep the RULE inline and move
     the REASONING out: a section that has grown into an explanation belongs in its own file, linked
     from here, which the roles follow when they need it. Commands, Invariants and Layout stay
     inline whatever the size — those are read on every spawn by every role. -->

## Project

<!-- fill: project name and one-line description of what it does -->

## Stack

<!-- fill: languages, frameworks, and package managers in use -->

## Commands

<!-- fill: exact build, test, lint, and per-phase gate commands. For every command that accepts a
     path, pattern, directory or spec argument, record its NARROWED form beside the whole-project one
     — the scoped form is what a phase gate runs. Pair every command that mutates the tree (a lint
     that auto-fixes, a formatter that writes in place) with its check-only sibling. -->

## Test tooling

<!-- fill: e2e framework + run command; coverage tool + command -->

## Layout

<!-- fill: directory map and where each app or module lives -->

## Conventions

<!-- fill: plan directory layout, ID prefixes, slug rules, and naming patterns -->

## Invariants

<!-- fill: load-bearing domain rules that every change must respect -->

## Critical flows

<!-- fill: main user stories that may warrant e2e coverage -->

## Out of scope

<!-- fill: deferred or explicitly forbidden items -->
