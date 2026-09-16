# Orchestrator — Context Schema Reference

The orchestrator requires a `PROJECT-CONTEXT.md` file at `.orchestrator/PROJECT-CONTEXT.md` before the pipeline starts. It is written by the `context-builder` skill (ADR-0023), or — when that skill has not been run — by this skill's own bootstrap context gate (Step B1), which measures coverage against these required sections and blocks if coverage is below `context_threshold`. B1 skips its interview when a complete file is already present.

## Required Sections

| Section | Purpose |
|---|---|
| `Project` | Name and one-line description of what the project does |
| `Stack` | Languages, frameworks, and package managers in use |
| `Commands` | Exact build, test, lint, and per-phase gate commands — each narrowable one recorded in **both** its whole-project and its path-scoped form, and each mutating one paired with its check-only sibling. The scoped form is what a phase gate runs (`templates/architect.md` → *Scoping a phase gate*). The coverage check below is heading-presence only, so a missing scoped form degrades a plan's gate rather than blocking the run — it is a quality datum, never a precondition. |
| `Test tooling` | e2e framework + run command; coverage tool + command (consumed by tester role) |
| `Layout` | Directory map and where each app or module lives |
| `Conventions` | ID prefixes, slug rules, naming patterns, code style — and, where a project has one, the plan directory layout it accumulated before run folders existed. That last part is **descriptive only**: it never sets a role's write path (see *The write path is never read from `Conventions`* below). |
| `Invariants` | Load-bearing domain rules that every change must respect |
| `Critical flows` | Main user stories that may warrant e2e coverage (consumed by tester role) |
| `Out of scope` | Deferred or explicitly forbidden items |

## The write path is never read from `Conventions`

**`run_dir=` in a role's preamble is authoritative, and nothing in this file — or in the `PROJECT-CONTEXT.md` rendered from it — outranks it.** Every artifact a run writes lands flat inside one run folder, `plans/<YYYYMMDD>T<HHMMSS>Z-<4hex>-<slug>/`, minted once per run at Step 0 pre-flight and handed to all six roles on that preamble line; a role's write path is that string concatenated with the ID it was given, checked by string equality, never a directory resolved out of project context. So a hand-curated `Conventions` section may go on describing the legacy `plans/<kind>/` tree — 1653 artifacts in seven flat listings on the reference project — that the project accumulated before run folders existed. Those seven directories are frozen and read-only: a recursive resolver still finds every artifact in them, and no role writes into one again. **The stale sentence is neutralized by precedence, not by editing**, which is the whole point — no project is asked to rewrite a curated section it may have good reasons for, and no curated section can redirect a write. Every role template carries the same sentence, so the rule holds wherever a role reads it.

**What this does not weaken.** The rest of `Conventions` is still honoured in full — ID prefixes, slug rules, code style, test-file naming, identifier casing (`templates/coder.md`). What stops binding is the **directory**, not the naming. And two things a `Conventions` section should not assert about the new layout, because neither is true: the run folder's slug is a **human label that nothing parses** — every resolution is by artifact ID or front matter — and a run folder does **not** group a feature, since a feature's story spans two to four of them and 94% of families use more than one slug. "What happened to feature X" is answered by `plans/index.html`, which reads the disk.

## Size

Target **12 KB**; **20 KB** is the move-it-out line. Roles re-read this file at every spawn, so its size is multiplied by the run's length, not by its own usefulness. `Commands`, `Invariants` and `Layout` stay inline at any size — every role reads them every time. A section that has grown into an explanation moves to its own file and is linked from here; every role template says it reads `PROJECT-CONTEXT.md` **plus any project files it points to**, so a pointer is followed, not lost.

**This is a budget, not a gate.** The coverage check below is heading-presence only and cannot measure bytes, so nothing enforces this and the prose should not pretend otherwise. It is a target for whoever writes the file — the bootstrap agent, and the human who curates it afterwards.

## Coverage Check

Coverage is the fraction of required sections present (heading match, case-insensitive). A section is considered present when a level-1 or level-2 heading whose text starts with the section name exists in `PROJECT-CONTEXT.md`.

If coverage < `context_threshold` the orchestrator prints the missing sections and exits with a non-zero status. The user must add the missing sections before re-running.
