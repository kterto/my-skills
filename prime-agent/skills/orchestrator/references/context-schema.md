# Orchestrator — Context Schema Reference

The orchestrator requires a `PROJECT-CONTEXT.md` file at the repo root before the pipeline starts. The context gate (Step 0) measures coverage against these required sections and blocks if coverage is below `context_threshold`.

## Required Sections

| Section | Purpose |
|---|---|
| `Project` | Name and one-line description of what the project does |
| `Stack` | Languages, frameworks, and package managers in use |
| `Commands` | Exact build, test, lint, and per-phase gate commands |
| `Test tooling` | e2e framework + run command; coverage tool + command (consumed by tester role) |
| `Layout` | Directory map and where each app or module lives |
| `Conventions` | Plan directory layout, ID prefixes, slug rules, and naming patterns |
| `Invariants` | Load-bearing domain rules that every change must respect |
| `Critical flows` | Main user stories that may warrant e2e coverage (consumed by tester role) |
| `Out of scope` | Deferred or explicitly forbidden items |

## Coverage Check

Coverage is the fraction of required sections present (heading match, case-insensitive). A section is considered present when a level-1 or level-2 heading whose text starts with the section name exists in `PROJECT-CONTEXT.md`.

If coverage < `context_threshold` the orchestrator prints the missing sections and exits with a non-zero status. The user must add the missing sections before re-running.
