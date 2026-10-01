# ADR-0028 — A bounded G6 is disclosed, not a stop; recorded defaults decide waiting, never the verdict

- **Status:** Accepted
- **Date:** 2026-09-29
- **Amended by:** [ADR-0030](0030-the-engine-measures-at-the-tree.md) — the open decision below is settled: the user chose (a), keep the criterion as written, on 2026-09-29. What decision 3 leaves open, whether an engine-bounded G6 also follows `on_bound`, stays open.
- **Skills affected:** `clean-code-gates` (`defaults.cjs` → `gates.G6.on_bound` for both stacks, accepted by config validation; the G6 result's `measurement` block → the reason `bounded` and `onBound`; `schema/report.schema.json`); `orchestrator` (`templates/qa.md` → Step 0, the report's `unmeasured_bounded:` frontmatter and its status ceiling; `SKILL.md` → Step 5d's `BLOCKED_STALE` synthesis and the Step 7b `Unmeasured:` line); `product-manager` and `validation-fixer` (each one's statement of what an orchestrator `READY_WITH_WARNINGS` means).
- **Source finding:** the 2026-09-29 harness re-evaluation — `DESIGN-v2.md` §6.1, decision D-G6 in §8 and principle P10, and its evidence report on the orchestrator's recent runs, `e-toodls-current.md` §0.5, §6.1 and §7.1. Neither file is in this repository; the numbers are restated below. Runs are named by their FINAL ids.
- **Precedent:** ADR-0024 decision 1, "What a level changes is whether a finding **blocks** — never whether it is **measured**, and never whether it is **said**." This ADR applies the same rule to whether a run waits.
- **Open decision:** what a project success criterion of "G6 ≥ 70" means when mutation cannot finish inside the bound. It is set out below for the user, with a recommendation. This ADR does not decide it. **Settled on 2026-09-29: the user chose (a).**

## Context

QA runs every gate command under `gate_wall_clock_minutes`, default 15
(`templates/qa.md` → Step 0). Until this ADR, a gate over the bound was stopped, recorded
`UNMEASURED` and listed in the report's `stale_gates:`, the only input to the orchestrator's
`BLOCKED_STALE` (`SKILL.md` → Step 5d): a `Status: STALLED` stop that waits for an operator
decision. The gate engine has its own bound as well, `gates.G6.budget.totalSeconds` (default
1,800), which kills the mutation runner and reports `measurement.state: "unmeasured"`.

In three full toodls runs backend G6 hit the 15-minute bound: **0c93, 2af5 and d827**. Each
parked at `BLOCKED_STALE` and waited **4.8, 7.5 and 5.4 hours, 17.7 hours in all**, at the ends of
the runs and mostly overnight. The final answer was the same all three times: ship, with G6
disclosed. In 0c93 the operator first asked for a bigger budget and a QA re-run, then reversed
it while the conductor was acting on it. The wait bought nothing: after it, each run printed
`READY_WITH_WARNINGS` with G6 unmeasured, which the pipeline could have printed without asking.
0c93 also lost half an hour to G6 being killed twice at 900 seconds.

It will keep happening. On 2af5's diff, backend Stryker stopped at 670 of 2,703 mutants on the
15-minute clock, with about 6.5 hours estimated to remain: about 7 hours for one gate. No bound
that still catches a wedged lint fits that, so without a change every full run of that size parks
and gets the same answer.

## Decision

### 1. A recorded default decides whether a run waits, never its verdict

A bounded G6 is `unmeasured`. It is **never a pass** under either policy, and it is always
disclosed. The policy chooses one thing only: whether the run stops for a human over it.

### 2. The engine: `gates.G6.on_bound`

`on_bound` takes `"disclose"` or `"stop"`, per stack (`stacks.<stack>.gates.G6.on_bound` in
`.cleancode-gates.json`), and `defaults.cjs` sets `"disclose"` for both stacks. An invalid value
resolves to `"stop"` with one warning: a value nobody can read falls back to the legacy behaviour,
never to the one that does not ask. When the engine's own G6 budget (`totalSeconds`) is hit, the
result's `measurement` block reports `unmeasured` with the reason `bounded`, and carries
`onBound: "<policy>"`.

### 3. QA: a gate over the bound looks up its policy

QA stops the command and records `UNMEASURED`, as today. It then reads that gate's `on_bound` from
the merge-base `.cleancode-gates.json`. When the key or the file is absent, the default is
`disclose` for G6 and `stop` for every other gate. Reading it from the merge base means the trunk
decides whether its runs wait over a bounded gate, not the branch under review.

- **`disclose`:** the gate joins a new frontmatter list, `unmeasured_bounded: [{gate: G6,
  elapsed_minutes: N}]`, and **not** `stale_gates:`. The report's status is at most
  `READY_WITH_WARNINGS`.
- **`stop`:** the gate joins `stale_gates:`, exactly as today.

QA emits `unmeasured_bounded: []` when the list is empty, as it does `stale_gates: []`, so an
absent key always means an older report rather than a clean one. As ADR-0014 decision 2 puts it,
"not declared" and "declared none" are different claims.

The engine's own bound takes another path. When `totalSeconds` fires before QA's clock, the gate
command returns in time and this lookup never runs: G6 reaches the report through
`templates/qa.md` → G6 as `UNMEASURED` with the runner's reason, `bounded`. It is disclosed on
`Unmeasured:`, never a pass and never a stop under either policy, and it is not held to the
`READY_WITH_WARNINGS` ceiling, exactly as an engine timeout was before this ADR. Routing that path
by `on_bound` too is left open: under `stop` it would add a stop that does not exist today.

### 4. The orchestrator: no stop, and the FINAL says so

Step 5d never synthesizes `BLOCKED_STALE` from `unmeasured_bounded`. The FINAL's `Unmeasured:`
line lists each entry as `G6 (bounded at <N> min)`. Nothing stops for the operator over it.

### 5. Only G6 defaults to `disclose`

`references/config.md` already calls this asymmetry intended: its `gate_wall_clock_minutes` entry
says the default is generous for a lint and tight for a whole-project mutation run, and that a
mutation gate which cannot finish inside it should be narrowed or scheduled, not waited on. A lint
over the bound is probably wedged, which is worth a stop. A mutation run over it is expected,
which is not.

## Open decision — for the user: a criterion like "G6 ≥ 70"

> **Settled on 2026-09-29.** The user chose (a); [ADR-0030](0030-the-engine-measures-at-the-tree.md) records it. The section is kept as written.

toodls `docs/foundation/INTENT.md:51` (as of 2026-09-29) makes "G6 ≥70" a success criterion.
Under this ADR a full run of 2af5's size cannot measure it, so G6 is disclosed as bounded and the
criterion goes unobserved on every such run. What the criterion means now is the user's decision.
`INTENT.md` belongs to `context-builder` and the user (ADR-0023 decisions 5 and 6): no pipeline
edits it, and this default must not reinterpret it.

| Option | What it means |
|---|---|
| **(a) Keep it as written.** | Full runs disclose G6 `unmeasured (bounded)`. The criterion reads *unobserved*, neither met nor failed. Anything that grades INTENT (nothing does today) reads it as not done for that reason alone. That is the information today's `READY_WITH_WARNINGS` already carries, without the overnight park. |
| **(b) Measure it where it fits.** | Run Stryker whole-project on `main` on a schedule, with a bound sized to fit it, and read the criterion from that run. The bound has to be measured first: 2af5's diff alone needed about 7 hours. |
| **(c) Amend it to sampled mutation.** | Rewrite the criterion against a sampled mutation gate. That gate does not exist yet; it waits behind a data trigger. |

**Recommendation: (a) now; (b) if you want the number.**

- **(a) now,** because the bounded default lands with this ADR and a goal a human set must not be
  loosened silently. (a) is the only option that changes nothing the criterion says. It only stops
  the run from waiting on a number nobody can produce inside the run.
- **(b) if you want the number,** because it is the only option that produces one. It costs one
  scheduled run of whatever length whole-project mutation takes on `main`, off the run's critical
  path, where nothing waits on it. Raising `gate_wall_clock_minutes` to about seven hours in
  session (ADR-0027) would measure a run's own diff instead, as a seven-hour QA step. That is the
  park, moved inside the run.
- **Not (c) now:** it rewrites a human-set goal in the loosening direction, against a gate that
  does not exist.

## Alternatives considered

**Keep `stop` as the default, and pre-answer the question in every invocation.** It works as a
prompt someone re-types on every run, and it never reaches a run that `product-manager` or
`validation-fixer` starts. A default belongs in configuration.

**Raise `gate_wall_clock_minutes` until G6 fits.** Rejected: the bound is one number for every
gate, and a bound that fits seven hours of mutation no longer catches the wedged tool it exists
for.

**Score the partial run.** Rejected: `UNMEASURED` "is not a low score and never a pass"
(`templates/qa.md` → G6), and a score over 670 of 2,703 mutants is a lower bound at best.

**`disclose` for every gate.** Rejected under decision 5.

**Take G6 out of the blocking set.** Deferred until a sampled mutation gate exists and is
calibrated. That would change the standard, and this ADR changes only waiting.

## Consequences

- **The park is gone.** A run whose G6 hits QA's bound finishes, `READY_WITH_WARNINGS` at best,
  with G6 on the `Unmeasured:` line, and nobody is asked. A project that wants the question back
  sets `on_bound: "stop"` on `main`.
- **`READY_WITH_WARNINGS` has a second cause.** Beside G8's advisory rework ratio, it can now mean
  a bounded G6. The `Unmeasured:` line and QA's verdict rationale say which.
- **ADR-0024's disclosure set is untouched.** `Unmeasured:` still names the gate, and
  `measurement.state` still says `unmeasured`. Only the stop is gone.
- **A bounded gate is still a stopped command,** so QA Step 0's rule holds: it is never recorded in
  `suites[]`, and ADR-0018's inheritance cannot carry it forward as a result.
- **Every consumer of `clean-code-gates` sees the new reason.** A standalone run whose G6 hits the
  engine's own bound reports `bounded`, orchestrator or not, where it used to report
  `killed-on-clock` (node-ts) or `run-timeout` (dart-flutter). A consumer that matched either
  string must match `bounded` now. A node-ts runner killed by any other signal, which that adapter
  also called `killed-on-clock`, now reports `killed`: only the engine's own clock is a bound. That
  reach is why this is an ADR.
- **The falsifier:** a bounded G6 that reads as a pass anywhere; a park on a run where G6 hit its
  bound (the baseline is 3 of 3); a recorded default that changed a verdict. The check for this
  change forces a 1-minute G6 bound on a real diff and expects `unmeasured (bounded)`, no stop, and
  the `Unmeasured:` line.
