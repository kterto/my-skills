---
id: SPEC-20260807T003303Z-62e3
title: Optional layer-sliced parallel execution for the orchestrator pipeline
status: READY_FOR_PLANNING
created_at: 2026-08-07T00:33:03Z
updated_at: 2026-08-07T00:33:03Z
cycle: 0
related_to: —
---

# Optional layer-sliced parallel execution for the orchestrator pipeline

## Summary

The `orchestrator` skill runs its six roles strictly sequentially. This spec adds an **opt-in parallel execution mode** that slices one spec's implementation work into disjoint **lanes** (layers such as `backend`, `frontend`, `app`, `admin`) and runs the per-lane architect and coder subagents concurrently. Overlap and reconciliation cost are controlled by a new **interface contract artifact (`PACT`)** authored before any lane starts: it freezes the path-ownership map and the exact shape of every cross-lane interface, so lanes never touch the same files and the join step is a mechanical check rather than a merge negotiation. A pre-fan-out **slicing analysis** estimates the speed gain and the contract overhead, and presents the user a parallelization ladder with that cost/benefit stated; parallelization is never applied silently.

## Goals

- Add a `parallelism` option to the orchestrator with a three-level ladder (`off` | `lanes` | `full`) plus an `ask` sentinel that presents the levels to the user with a stated cost/benefit evaluation.
- Introduce a **slicing analysis** that maps a spec's functional requirements onto candidate lanes, measures lane balance and overlap, and produces an honest speed-gain estimate and a viability verdict before anything is spawned.
- Introduce the **`PACT` interface-contract artifact**: lane map, per-lane path ownership globs, every cross-lane interface point with a frozen shape, the producer/consumer of each, the consumer's stub strategy, and the integration-lane assignment.
- Run per-lane architect and coder subagents concurrently in a single shared workspace with enforced disjoint path ownership.
- Add a deterministic **join step** that reconciles the lanes: every contract row verified satisfied on both producer and consumer sides before the pipeline continues.
- Keep the existing sequential pipeline byte-for-byte unchanged when `parallelism` is `off` (the default), so every current caller — including `product-manager` — is unaffected.
- Define what happens when a lane blocks, when a lane discovers the frozen contract is wrong, and when the analysis says parallelization is not worth it.

## Non-goals

- **Per-lane git worktrees or per-lane branches.** Merging lanes back requires commits, and "the orchestrator/PM stop at READY_TO_COMMIT and never commit or push" is a load-bearing invariant plus an explicit out-of-scope item in `PROJECT-CONTEXT.md`. Lanes share one workspace and are isolated by path ownership instead.
- **A seventh role/subagent** (e.g. `integrator`). Cross-lane wiring is assigned in the contract to a designated integration lane and executed by the existing coder; the join's remaining work is mechanical verification the orchestrator performs itself.
- **Parallelizing the remediation loops.** A `REQUEST_CHANGES` fix plan (`FIX`) and a QA remediation plan (`QAF`) stay single, sequential plans over the union diff. Steps 4 and 5 cycle machinery is untouched.
- **Parallelizing the brainstormer.** One spec is the single shared truth for all lanes; Step 1 stays a single sequential invocation.
- **A new HTML scaffold for the contract artifact.** Regenerating template pixel design is out of scope per `PROJECT-CONTEXT.md`; `PACT` reuses the existing `plan` scaffold.
- **Changing `product-manager`'s behavior or flags.** The design is PM-safe by construction (see Project-context fit).
- **Automated test tooling for the doc-skill portions.** Verification is structural review, per `PROJECT-CONTEXT.md`. The one exception is the `.cjs` renderer change, which carries a unit-test obligation.

## Users and use cases

- **Human developer running `/orchestrator` on a fullstack or mobile monorepo** — wants a large cross-layer feature implemented faster. Runs with `--parallel ask`, sees the lane split, the estimated speedup, and the contract overhead, picks a level. Success: wall-clock span shorter than sequential, with no cross-lane conflicts and no extra reconciliation work at the end.
- **Human developer on a single-layer change** — runs with `--parallel ask`, the analysis reports "1 viable lane — parallelization not worth it", and the pipeline runs sequentially without further prompting. Success: no overhead paid for a split that would not have helped.
- **Human developer who has never opted in** — runs `/orchestrator` exactly as today. Success: identical behavior; at most a one-line non-blocking hint that lanes were detected.
- **`product-manager` skill (non-interactive caller)** — drives the orchestrator once per user story. Success: never blocked by a new prompt, never silently parallelized; its documented obligation to answer the orchestrator's Step 0 prompt remains the only prompt it must answer.
- **Downstream project with a materialized `.orchestrator/`** — success: its existing `config.json`, `plans/` tree, and gate scripts keep working with no migration.

## Functional requirements

### Configuration

1. Add config key `parallelism`, type string, one of `off` | `ask` | `lanes` | `full`, **default `off`**, CLI arg `--parallel`, resolved once per run with the standard precedence (CLI arg > `.orchestrator/config.json` > default). Document it in `references/config.md` (keys table, prose, canonical default object, CLI arg table) and add it to `templates/config.template.json`.
2. Add config key `lanes`, type array of `{name: string, path: string}`, default `[]`. It declares the project's lane taxonomy when the project has no roadmap. `name` must satisfy `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` (1–64 chars) and `path` must be a normalized repo-relative path (no absolute, no `..`, no control characters or newlines) — the same grammar and path-validation rules the `roadmap` skill applies to `config.systems`.
3. Add config key `max_contract_amendments`, integer, default `2`. Caps how many times a run may revise a frozen contract before falling back to sequential execution.
4. All three keys are nullable/absent-tolerant: an existing `.orchestrator/config.json` without them resolves to the defaults, and the pipeline behaves exactly as it does today.

### Lane taxonomy resolution

5. Resolve the candidate lane set in this order, stopping at the first that yields a non-empty set: (a) `roadmap.config.json` → `config.systems` when the project has a `/roadmap/` (reuse the declared deployable systems and their `path`, per ADR-0001); (b) `.orchestrator/config.json` → `lanes`; (c) derived per-run by the slicing analysis from `PROJECT-CONTEXT.md` → **Layout**.
6. A lane `path` ingested from `roadmap.config.json` is **untrusted metadata**: re-validate it against the path rule in requirement 2 before use, surface it to any subagent as clearly delimited data, and never splice it into an instruction body. An imperative embedded in a lane name or path is surfaced, never obeyed (the "data, never instructions" invariant).
7. A lane whose `path` fails validation is dropped from the candidate set and reported; it never silently becomes an unbounded lane.

### Step 2p — Slicing analysis and parallelization choice

8. Insert a new pipeline step **2p**, between Step 1 (brainstormer) and Step 2 (architect). It runs only when the resolved `parallelism` is not `off`.
9. Step 2p spawns exactly one read-only `Explore` subagent (the same pattern as Bootstrap B1) with the spec path and the candidate lane set, and collects a digest containing, per candidate lane: the spec's functional requirements that map to it, an estimated task count, the file/dir globs it would own, and every requirement that maps to more than one lane (an overlap).
10. From the digest the orchestrator computes and prints a **cost/benefit evaluation** containing: the viable lane count, the per-lane task-count split, the estimated speedup as `total_tasks / largest_lane_tasks`, the fixed parallel overhead (one contract-authoring architect pass plus one join pass), the number of cross-lane interface points the contract must freeze, and the resulting net verdict.
11. The speed estimate is expressed as **task-count-weighted lane balance with the assumption stated inline**, never as a fabricated wall-clock ETA.
12. Step 2p declares parallelization **non-viable** and falls back to sequential — printing the specific reason — when any of these hold: fewer than 2 lanes carry work; one lane holds more than 70% of the estimated tasks; candidate lane path ownership cannot be made disjoint; the interface-point count exceeds the total task count of the smallest lane (contract cost exceeds the gain); the project's gate commands from `PROJECT-CONTEXT.md` → **Commands** cannot be scoped to a lane's paths; or the host cannot spawn concurrent subagents.
13. When resolved `parallelism` is `ask` **and** Step 2p found the split viable, present the levels via the host's structured question tool (`AskUserQuestion` / `question`), each option annotated with its evaluation from requirement 10:
    - **1. Sequential (`off`)** — today's pipeline; zero contract overhead.
    - **2. Lane-parallel implementation (`lanes`)** — contract + N lane plans + N concurrent coders; one tester, one reviewer, one QA over the union at the join.
    - **3. Full lane pipelines (`full`)** — everything in `lanes`, plus per-lane tester and reviewer running concurrently before the join.
    Option 1 is always offered and is always the recommendation when the verdict from requirement 12 is non-viable.
14. When resolved `parallelism` is `lanes` or `full`, Step 2p does not prompt — it applies the level directly, subject to the viability gate in requirement 12.
15. Step 2p **never prompts** when `automation_level=autonomous`, when the split is non-viable, or when the host cannot present a structured question. In each case it resolves to `off` and prints the reason. This guarantees no non-interactive caller can be blocked by the new step.
16. When `parallelism` is `off` (including by default) and the candidate lane set would have yielded ≥2 viable lanes, the orchestrator prints a **single non-blocking hint line** naming the detected lanes and suggesting `--parallel ask`. It never waits for a reply.

### Step 2c — The interface contract (`PACT`)

17. Add a new artifact prefix **`PACT`**, written to the existing `plans/feat/` directory (no new top-level directory under `plans/` — the allow-list ban stands). Add the row to `references/artifact-format.md`'s canonical directories & prefixes table, owner: architect (type `contract`).
18. A `PACT` artifact carries the five required frontmatter keys (`id`, `status`, `created_at`, `updated_at`, `cycle`) plus `related_to` referencing the source spec, and a **Related** region linking back to the spec, so the existing pairing and link gates accept it unchanged.
19. Add `PACT: 'plan'` to the prefix→scaffold map in `scripts/render-artifact.cjs` so html mode renders it with the existing plan scaffold instead of falling through to `qa-report`. Extend `scripts/render-artifact.test.cjs` to cover the new mapping.
20. Step 2c invokes a single architect subagent with `Type: contract` and the spec path; the architect writes the `PACT` containing:
    - **Lane map** — one row per lane: name, owned path globs, the spec requirements assigned to it, and its lane plan ID.
    - **Path ownership** — the globs are mutually disjoint by construction; any file matched by two lanes is an error the architect must resolve before writing.
    - **Interface points** — one row per cross-lane dependency: producer lane, consumer lane, kind (HTTP endpoint, DTO/shared type, generated client, event, module export, navigation route), the **frozen exact shape** (signature/schema), and the consumer's stub or mock strategy while the producer is incomplete.
    - **Unowned files** — every file needed by the change that no lane owns is assigned explicitly, either to one named lane or to the integration lane.
    - **Integration lane** — the lane plan that performs cross-lane wiring, executed sequentially after the fan-out.
    - **Per-lane definition of done** — each lane's completion condition, referencing the contract rows it must satisfy.
21. The architect role template gains the `contract` type alongside `feat` | `fix` | `qa`. `contract` writes only to `plans/feat/`; it never creates a directory.

### Step 2L / 3L — Lane fan-out

22. Step 2L spawns one architect subagent **per lane, concurrently**, each with the spec path, the `PACT` path, its own lane name, and its own pre-generated `FEAT` ID. Each produces a lane `FEAT` plan plus its own `.progress.md`, with `related_to` referencing both the spec and the `PACT`.
23. The orchestrator generates every lane ID before the fan-out using the existing `newid` generator. No directory scan is performed; same-second collisions are prevented by the existing random suffix.
24. Step 3L spawns one coder subagent **per lane, concurrently**, each on its own lane `FEAT` plan. Because every lane plan and its `.progress.md` are exclusively owned by one coder, there is no artifact write contention.
25. The coder role template gains a **lane boundary** rule: when a plan declares a lane, every file the coder writes must fall inside that lane's owned path globs. A required edit outside them is not performed — the coder stops with `Status: BLOCKED` and a reason of `lane boundary` naming the file and the owning lane.
26. Per-phase verification commands run by a lane coder must be scoped to that lane's owned paths. When `PROJECT-CONTEXT.md` → **Commands** offers no path-scoped form for a gate, that gate is deferred to the join instead of run concurrently.
27. The full test suite runs **once at the join**, never concurrently inside lanes.

### Step 3j — Join and contract reconciliation

28. Add a new pipeline step **3j**, after the lane fan-out. The orchestrator waits for every in-flight lane subagent to return; it never abandons a running lane.
29. The join verifies, for **each** interface row in the `PACT`, that the producer side emitted the frozen shape and the consumer side consumes that same shape. Any unsatisfied row is a join failure naming the row, the lane, and the side that is missing.
30. If the `PACT` declared an integration lane, the join runs its plan through a single sequential coder invocation after all other lanes are DONE.
31. The `simplify` pass runs **once** at the join over the union diff — not once per lane.
32. The orchestrator (never a subagent) updates the `PACT`'s lane-status table at the join, so the run-level view has exactly one writer.
33. If any lane returns `BLOCKED`, the join halts the run in a `PARTIAL` state: completed lanes remain DONE, the blocked lane and its reason are reported, and no tester/reviewer/QA runs. Re-running the orchestrator resumes only the incomplete lane plans — existing coder resume semantics (continue from the first unchecked task) apply unchanged.

### Contract amendment

34. A lane coder may **never** unilaterally change the contract. Discovering that a frozen interface is wrong is a `BLOCKED` stop with reason `contract violation`, naming the offending `PACT` row.
35. On a contract violation the orchestrator halts the fan-out at the join, invokes the architect to write an **amended** `PACT` (a new artifact whose `related_to` references the superseded one), re-slices, and resumes the affected lanes. This consumes one contract amendment.
36. When the amendment count reaches `max_contract_amendments`, the orchestrator abandons parallel execution for the remainder of the run, prints the reason, and continues sequentially from the current state. It never silently retries indefinitely.

### Downstream roles at the join

37. In `lanes` mode, the tester, reviewer, and QA each run **once** at the join, invoked with the `PACT` ID; each resolves the set of lane plans from the `PACT`'s lane map and evaluates the union of their diffs. Their role templates are extended to accept a `PACT` ID in addition to a plan ID.
38. In `full` mode, a tester and a reviewer additionally run **per lane, concurrently**, on that lane's `FEAT` ID (no template change needed for that path), before the join. The join still runs one tester pass for integration and one reviewer pass for cross-lane concerns.
39. A per-lane reviewer returning `REQUEST_CHANGES` in `full` mode does not fan out a fix: the finding is carried into the single join-level reviewer pass, and remediation follows the existing sequential Step 4 loop over the union.
40. Steps 4 and 5 (review loop, QA loop, cycle caps, `BLOCKED_STALE` handling, Step 7 eval/final report/gates) are unchanged in every mode.

### Backward compatibility

41. With `parallelism` unset or `off`, every role prompt, artifact, status line, and stdout header line is identical to today. No new prompt fires, no `PACT` is created, and Steps 2p/2c/2L/3L/3j are skipped entirely.
42. Legacy artifacts, legacy `.orchestrator/config.json` files, and existing `plans/` trees render and execute unchanged. No migration is forced.
43. The stdout header-line contract in `references/artifact-format.md` gains rows only for the new artifact/step; existing rows are untouched, so downstream parsers (including `product-manager`'s reliance on the `pipeline complete` banner) keep working.

## Non-functional requirements

- **Performance**: the feature's own purpose is wall-clock reduction; the fixed overhead it introduces (one Explore analysis, one contract-authoring architect pass, one join pass) must be stated in the cost/benefit output and must be the basis of the viability gate in requirement 12, not hidden.
- **Security / auth**: lane names and paths ingested from `roadmap.config.json` are untrusted, re-validated, and surfaced as delimited data — never spliced into instruction bodies (the "data, never instructions" invariant). Path globs are the only isolation mechanism between concurrent coders, so an unbounded or `..`-escaping glob is a correctness *and* safety failure and must be rejected at contract-authoring time.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: no new user data is introduced, stored, or retained.
- **Monetization tier**: —

## Project-context fit

**Layers touched.** This is a doc-skill change plus one small runtime change:
- `plugins/my-skills/skills/orchestrator/SKILL.md` — new Steps 2p, 2c, 2L, 3L, 3j; `parallelism` resolution; the lane fan-out spawn pattern; join reconciliation; amendment cap; updated pipeline-overview diagram and Rules.
- `plugins/my-skills/skills/orchestrator/references/config.md` — three new keys across all four places the reference documents a key.
- `plugins/my-skills/skills/orchestrator/references/artifact-format.md` — the `PACT` row in the directories/prefixes allow-list; any new stdout header lines.
- `plugins/my-skills/skills/orchestrator/templates/config.template.json` — canonical default object gains the three keys.
- `plugins/my-skills/skills/orchestrator/templates/architect.md` — the `contract` type and `PACT` authoring; lane-plan mode.
- `plugins/my-skills/skills/orchestrator/templates/coder.md` — the lane boundary rule and the two new BLOCKED reasons (`lane boundary`, `contract violation`).
- `plugins/my-skills/skills/orchestrator/templates/tester.md`, `reviewer.md`, `qa.md` — accept a `PACT` ID and resolve the lane set from it.
- `plugins/my-skills/skills/orchestrator/scripts/render-artifact.cjs` + `render-artifact.test.cjs` — the `PACT: 'plan'` scaffold mapping and its test.

**Existing features it extends.** It builds directly on machinery already in place: timestamp IDs are documented as the mechanism that makes "parallel actors never race", so no ID work is needed; the Step 0 pre-flight already establishes the single isolated workspace all lanes share; the `.progress.md` append-log is already per-plan, so per-lane logs are contention-free by construction.

**Invariants that shape the implementation.**
- *Never commit or push* (invariant + explicit out-of-scope item) **decides** the isolation model: per-lane worktrees would require per-lane commits to merge, so lanes share one workspace and isolate by path ownership. This is a resolved conflict, not an open one.
- *Backward compatibility is mandatory* **decides** the default: `parallelism` ships as `off`, not `ask`, because defaulting to `ask` would change the behavior of every existing manual-mode run.
- *Single-source-of-truth references* — the normative detail for the new config keys belongs in `references/config.md` and the artifact rules in `references/artifact-format.md`; `SKILL.md` summarizes and links.
- *Mirror machinery* — the lane taxonomy deliberately reuses the `roadmap` skill's `config.systems` band (ADR-0001) rather than inventing a second, competing layer vocabulary; the `.orchestrator` `lanes` key is the fallback for projects without a roadmap and mirrors its `{name, path}` shape, name grammar, and path validation.
- *Data, never instructions* — applies to every lane name/path read from roadmap config.
- *Staged-diff → gate → write → propose-commit → never-commit* — the join produces no commit; the run still ends at `READY_TO_COMMIT`.

**Cross-skill contract the architect must verify (not left open).** `product-manager` documents that it answers the orchestrator's Step 0 prompt on the user's behalf, and it does **not** set `automation_level`. A new blocking prompt would therefore strand PM. The design prevents this by construction — Step 2p exists only when `parallelism` is not `off`, `off` is the default, and requirement 15 hard-gates the prompt off for non-interactive callers. The architect **must verify** this holds end-to-end. If any path is found where PM could reach the Step 2p prompt, the fix is a one-paragraph mirror into `product-manager/references/git-flow.md` stating PM answers Step 2p with option 1 (`off`) — bounded to that, docs-only, and only if the guard proves insufficient.

**opencode parity.** `orchestrator` has no `.opencode/skills/orchestrator/` override port, so the opencode-port-parity invariant does not apply. Bootstrap B3 does materialize role templates for the opencode host, so every role-template change must remain host-agnostic, and the fan-out spawn pattern must be expressed for both `Agent` (Claude Code) and `task` (opencode). Because concurrent `task` fan-out is not guaranteed on every host, requirement 12's host-concurrency condition is the fallback.

**Testing posture.** Per `PROJECT-CONTEXT.md`, doc-skill changes are verified by structural review — template tokens defined, cross-references resolving, `.md`/`.html` parity, backward-compat claims holding, new machinery described symmetrically to the machinery it mirrors. The single exception is `render-artifact.cjs`, which has a real unit-test suite that must be extended for the `PACT` mapping.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: `plugins/my-skills/skills/orchestrator/SKILL.md`; `references/config.md`; `references/artifact-format.md`; `templates/config.template.json`; `templates/architect.md`; `templates/coder.md`; `templates/tester.md`; `templates/reviewer.md`; `templates/qa.md`; `scripts/render-artifact.cjs`; `scripts/render-artifact.test.cjs`. Conditionally and only if the PM guard proves insufficient: `plugins/my-skills/skills/product-manager/references/git-flow.md`.

## Open questions

- None. Every unknown was resolved by a recorded default below or decided by a `PROJECT-CONTEXT.md` invariant.

## Decisions resolved by Brainstormer default

- **Which pipeline stages parallelize?** → Architect and coder fan out per lane; brainstormer stays single; tester/reviewer optionally fan out only at level `full`; QA and both remediation loops stay sequential. → The coder is the long pole and the only stage whose work is genuinely partitionable by layer; one spec must stay the single shared truth; keeping the Step 4/5 loops sequential leaves the existing cycle-cap machinery untouched.
- **Isolation model: shared workspace vs. per-lane worktrees?** → Shared workspace with enforced disjoint path ownership. → Per-lane worktrees require per-lane commits to merge, which the "never commit or push" invariant and the explicit out-of-scope item forbid. Invariant-determined, not a preference.
- **Default value of `parallelism`?** → `off`, with `ask` reachable via config or `--parallel ask`, plus a one-line non-blocking hint when lanes are detected. → Mandatory backward compatibility forbids changing existing runs' behavior; the hint keeps the feature discoverable without blocking any caller (notably `product-manager`).
- **Where does the interface contract live?** → A new `PACT` prefix inside the existing `plans/feat/` directory. → The allow-list forbids new top-level directories under `plans/`, and the repo's precedent is co-locating derived artifacts with their parents (`FIX` in `plans/code-review/`, `QAF` in `plans/qa/`). Additive and reversible.
- **New HTML scaffold for `PACT`?** → No; map `PACT` to the existing `plan` scaffold in the renderer. → New scaffold pixel design is out of scope; the plan scaffold already renders tables, checklists, and the `<main data-*>` shell the gates require.
- **Lane taxonomy source?** → `roadmap.config.json` → `config.systems` first, then `.orchestrator/config.json` → `lanes`, then derived from `PROJECT-CONTEXT.md` → Layout. → ADR-0001 already models deployable systems as an orthogonal band with a validated `{name, path}` shape; inventing a second layer vocabulary would fork the taxonomy. The "mirror machinery" convention applies.
- **Who performs the slicing analysis?** → One read-only `Explore` subagent, exactly as Bootstrap B1 does. → Avoids adding a seventh role; the analysis is a read, not an artifact-producing role.
- **How is speed gain estimated?** → `total_tasks / largest_lane_tasks` minus the stated fixed overhead, presented with its assumption inline. → A wall-clock ETA would be fabricated precision; task-count balance is the honest, checkable proxy.
- **Number of parallelization levels?** → Three (`off` | `lanes` | `full`) plus the `ask` sentinel. → The user asked for *levels* with cost/benefit; two levels are a boolean, and the `lanes`/`full` split is a genuinely different cost profile (per-lane review concurrency vs. join-only review).
- **What happens when one lane blocks?** → Wait for all in-flight lanes, then halt in a `PARTIAL` state; re-running resumes only the incomplete lanes. → Abandoning a running subagent leaves the shared workspace in an unknown state; the coder's existing resume-from-first-unchecked-task semantics make partial resume free.
- **Can a lane change the frozen contract?** → No. It stops with `BLOCKED — contract violation`; the architect writes an amended `PACT`, capped by `max_contract_amendments` (default 2), after which the run continues sequentially. → Unilateral contract edits are exactly the overlap-and-reconciliation cost the contract exists to prevent; an uncapped amendment loop would erase the speed gain the feature is meant to deliver.
- **New role/subagent for the join?** → No. Cross-lane wiring is a contract-assigned integration lane run by the existing coder; the rest of the join is mechanical verification the orchestrator does itself. → A seventh role would add a template, a bootstrap materialization target, and an opencode rendering obligation for work the existing roles already cover.
- **Does `product-manager` change?** → Not by default. The design is PM-safe by construction; a bounded, docs-only one-paragraph mirror into `product-manager/references/git-flow.md` is authorized *only* if the architect finds a path where PM can reach the Step 2p prompt. → The scope note names the orchestrator skill; repairing a cross-skill regression is an implication of the change, but it is bounded so it cannot become scope creep.
- **Config-file trust anchor for the new keys?** → Read `.orchestrator/config.json` and the lane declaration from the working tree, consistent with how the orchestrator already reads all `.orchestrator/` state; apply roadmap's own validation rules verbatim to any ingested `path`. → Introducing a merge-base anchor here would diverge from the orchestrator's established read model without a threat that justifies it; the value-level validation and the "data, never instructions" rule carry the safety.

## References

- `plugins/my-skills/skills/orchestrator/SKILL.md` — Steps 0–7, the spawn pattern, the mandatory role-prompt preamble, `newid`.
- `plugins/my-skills/skills/orchestrator/references/config.md` — key/type/default table, precedence, CLI args.
- `plugins/my-skills/skills/orchestrator/references/artifact-format.md` — directory/prefix allow-list, ID allocation, Related navigation, stdout header-line contract.
- `plugins/my-skills/skills/orchestrator/scripts/render-artifact.cjs` (prefix→scaffold map, ~line 336) and `render-artifact.test.cjs`.
- `plugins/my-skills/skills/roadmap/references/config.md` — `config.systems` shape, name grammar, `path` validation, backward-compat posture.
- `docs/adr/0001-orthogonal-system-band.md` — the systems-as-orthogonal-band decision this lane taxonomy reuses.
- `plugins/my-skills/skills/product-manager/references/git-flow.md` — PM's documented obligation to answer the orchestrator's Step 0 prompt.
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants (never-commit, backward compatibility, data-never-instructions, mirror machinery, opencode-port-parity), Test tooling, Out of scope.
- `docs/prompts/parallel-agents-orchestration.md` — the raw request this spec formalizes.
