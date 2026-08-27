# ADR-0021 — A red the run did not cause is not the run's finding; baseline the tree once, and carry what was already broken

- **Status:** Accepted
- **Date:** 2026-08-27
- **Skills affected:** `orchestrator` (`SKILL.md` → **Step 0d — Baseline sweep**, Step 4e *If any Engineering Gate is a confirmed red*; `references/config.md` → `baseline_sweep`; `references/gate-config.md` → *Attributing a finding to the stage that owns it*; `templates/config.template.json`)
- **Source finding:** run-cost forensics on a 75-hour, 9-leaf `full` run, landed on `perf/orchestrator-run-cost` (PR #40) as items P5 and P6. Measured: **one test was re-diagnosed independently in 44 of 49 artifacts**, and archaeology of that shape was **5.5% of everything the run wrote**; separately, one run **waited 4 hours 43 minutes, overnight**, on formatter line-wrap in three *generated* localization files.
- **Depends on:** **ADR-0018 — The run can name its base commit but never its own tree**. The sweep writes `role: "baseline"` rows into `suites[]`, and runs against `tree_base`. It amends none of that decision.

## Context

Every role in the pipeline eventually meets a red it did not cause. Standing lint debt, a flaky suite,
an environment-dependent test, a generated file the formatter disagrees with — these are **the normal
state of a real repository**, not an exceptional condition.

The pipeline had no way to say so. Each role answered *is this red mine?* by hand, from `git show`
archaeology, independently, every time. The measurement is stark: one test, re-diagnosed from scratch
in **44 of 49 artifacts** of a single run, with archaeology of that shape accounting for **5.5% of
everything the run wrote**. Forty-four independent derivations of one answer, none of them recorded
anywhere the next role would look.

The second failure is worse than waste. Step 4e's rule — *stop on a confirmed red Engineering Gate,
whatever the gap list holds* — is correct reasoning about a red **this run produced**: no `FIX` plan
authored from the gap list can close it, and `spec-driven-eval` is forbidden from fixing one itself.
But the rule did not distinguish a red that was *already there*, and for that case its own premise
argues the opposite way: **no remediation inside the run can change a pre-existing red either.** So the
run stalls, and simply waits for a human to say "that was already broken". On the run this rule was
written for, that wait was **4 hours 43 minutes, overnight, on formatter line-wrap in three generated
localization files**.

The missing thing in both cases is the same: **one observation of the tree before the run touched it.**

## Decision

### 1. Step 0d takes the baseline, and Step 0 is the only place it can be taken

Run each whole-app suite and gate command from `PROJECT-CONTEXT.md` → Commands **once**, against
`tree_base`, appending one `suites[]` row per command with `role: "baseline"`, `artifact: "baseline"`,
and a **`failing[]` array naming every failing test or path** — the names are the whole point, because
attribution is per failure, not per suite.

**A baseline taken later is not a baseline.** It answers *was this already red before we started*, and
it can only be measured on a tree carrying none of the run's work. The pipeline never commits, so from
Step 3 onward there is no ref and no checkout that reproduces such a tree. Step 0 is the last moment
one exists.

### 2. `baseline_sweep` is `auto | always | off`, and `auto` is an admitted proxy

`auto` (the default) runs the sweep when the resolved `parallelism` is not `off`.

**It is a proxy, and a rough one, and the skill says so.** What the sweep needs to know is *will this
run be long enough to pay for one extra sweep*, and the only signal available at Step 0 is the
parallelism level — the leaf count does not exist yet, and by the time it does the tree has moved and
no baseline is takeable. `always` and `off` are the honest overrides. Naming the proxy as a proxy is
the decision: an unstated heuristic is one a later editor tunes without knowing what it was standing
in for.

### 3. Advisory in every mode — it blocks nothing, and an absent row never looks like a clean one

**A red baseline is the *expected* state**, and capturing it is what the sub-step is for. Print what
went red and continue. A command that cannot run is recorded `MISSING_TOOL` with its error; a command
the project does not want baselined is recorded skipped **with its reason**, never omitted silently.

**An absent row and a clean row must not look alike.** That equality is what lets every consumer below
distinguish *not baselined* from *baselined green*, and it is why "skipped" is a recorded value rather
than a missing one.

Because the sweep is advisory in every mode, an unrecognised `baseline_sweep` value resolving to `auto`
can cost at most one wasted sweep — which is what makes the default safe to pick without ceremony.

### 4. Leave the tree as you found it, or re-mint `tree_base`

A sweep that writes coverage output, a report directory, or any other non-ignored artifact has moved
the tree off `tree_base` — and **every boundary and every inheritance match after it would then be
measured against a tree the run did not produce.** Delete what the sweep wrote and confirm it is gone;
if something cannot be removed, **re-mint `tree_base` with Step 0a's recipe and update the ledger**
rather than leaving the two disagreeing. Git-ignored build output is already invisible to the recipe.

This obligation exists because the sweep is the **only** step that executes project commands before
the first boundary is trusted. Nothing else in the run can invalidate `tree_base`.

### 5. A new attribution value: `pre-existing (baseline)`

`references/gate-config.md` → *Attributing a finding to the stage that owns it* gains one value, ahead
of its existing three: the failure is named in the `failing[]` of a `role: "baseline"` row for that
same `suite`. It was red before the run began, so **it is not this run's finding** — record it with
that label and move on. Do not investigate it, do not plan a fix for it, and do not spend a remediation
cycle on it.

**The ledger is authoritative here precisely so that five roles do not each re-derive one answer from
`git show`.** When no baseline row exists — the sweep was skipped, or this command is not in it — fall
through to the existing three values and **say which**, so a reader can tell an unbaselined finding
from a baselined one.

### 6. Step 4e carries a red engineering gate under a two-limb test

The gate is **carried**, not a stop, when **every** path it names as failing satisfies one of:

- **byte-identical to the base** — `git diff --quiet {base_sha} -- {path}` exits 0, so nothing this run
  wrote can be responsible for it; or
- **already red at Step 0d** — named in a `role: "baseline"` row's `failing[]` for that same command.

The first limb needs no baseline, which is what keeps the rule useful on a project running
`baseline_sweep: off`. A carried gate goes into Step 7b's `Issues found:` list as
`carried — {gate}: {reason}`, is printed in the transcript, and the run continues to Step 5. **It is
never silently dropped: a carried gate nobody can see is worse than a stall, because the next run
inherits it with no record of the decision.**

### 7. Fail closed — an unattributable gate is treated as this run's

If the report does not resolve the failure to paths (*"the build command exits non-zero"*, and nothing
more) the test cannot run, and the gate stops the run.

**Stopping on a red the run did not cause costs one human decision; carrying a red it did cause ships
it.** The asymmetry decides the default, and it is stated rather than left to be inferred.

### 8. The existing reasoning is untouched

*"No `FIX` plan authored from the gap list can close a red gate"* still holds, and still applies to
every red this run produced. **This does not weaken the gate**; it distinguishes a case the old rule
did not have a branch for.

## Alternatives considered

- **(A) Take the baseline lazily, the first time a role meets a red.** Rejected: by then the tree
  carries the run's work and no baseline is takeable. The pipeline's never-commit property removes
  every way back.
- **(B) Make the sweep blocking on a red baseline.** Rejected outright: a red baseline is the expected
  state of a real repository, and blocking would refuse to start on most projects. The sweep exists to
  *capture* that state, not to police it.
- **(C) Let each role judge for itself whether a red is pre-existing.** This is the status quo, and it
  is what produced 44 independent re-diagnoses of one test. It also produces *inconsistent* answers,
  which is worse than expensive ones — two roles disagreeing about whose red it is has no tiebreaker.
- **(D) Attribute from `git blame` / `git show` at the point of failure, without a baseline.** Rejected:
  it answers *who last touched this file*, not *was this command red before we started*. A pre-existing
  red in an untouched file is invisible to it, and a touched file with an unrelated pre-existing red is
  mis-attributed to the run.
- **(E) Carry a red on the evaluating model's judgement, with no ledger row and no path test.** Rejected
  — an unrecorded carry is exactly the silent gate-weakening the fail-closed rule exists to prevent.

## Consequences

**Positive.**

- One derivation replaces up to forty-four. The rule that consumes the rows is normative in one place,
  and every role cites it rather than re-deriving it.
- The overnight class of stall is gone: a pre-existing red that no remediation inside the run could
  have changed no longer waits for a human to say so.
- The carry is visible in three places — the transcript, `Issues found:`, and the ledger row — so the
  next run inherits the finding *and* the record of the decision.

**Negative / accepted costs.**

- **One full sweep on every run that clears the gate, before any work begins.** On a short run that is
  pure overhead, and the skill states it rather than burying it. `baseline_sweep: off` is the answer
  for a project doing many small fixes.
- `auto`'s proxy will sometimes be wrong in both directions — a long sequential run gets no baseline, a
  short parallel one pays for an unused sweep. Neither override is a worse answer than the default; the
  default is just the one that has to be picked without knowing.
- A `role: "baseline"` row is a schema commitment in ADR-0018's ledger, and `failing[]` is now
  load-bearing rather than informational: a baseline row that records a red without naming its failing
  paths is useless to decision 5 and to decision 6's second limb.
- **The two limbs of the carry test can disagree with each other in principle** — a path byte-identical
  to the base whose failure is nonetheless caused by a change elsewhere in the run. The test is
  deliberately per-path and deliberately conjunctive over *every* named path, which makes that case a
  stop rather than a carry; the cost is a stop on a red that was arguably carryable.

**Not addressed here:** whether a carried red should expire, and what happens when a run's baseline
disagrees with the previous run's. Both need more than one run's evidence, and inventing a policy for
them now would be the unmeasured guess this decision replaces.
