# ADR-0027 — Execution budgets can be raised in session by a recorded approval; lowering one takes a PR

- **Status:** Accepted
- **Date:** 2026-09-29
- **Amends:** [ADR-0024](0024-rigor-levels-and-the-invariant-disclosure-set.md) decisions 2 and 3, for the six execution budgets only, and the anchoring doctrine in `orchestrator/references/config.md` → *Precedence* and *The anchored set*. *What this amends* below says exactly how.
- **Skills affected:** `orchestrator` (`scripts/run-state.cjs` → `raise`, `budget`, `raises`; `SKILL.md` → *Lifecycle — auto-detect*, whose run-state rules carry the raise, and the Step 7b FINAL; `references/config.md` → *Precedence*, *The anchored set* and *Raising an execution budget in session*; `references/bootstrap.md` → B3 item 2, which materializes the script).
- **Source finding:** the 2026-09-29 harness re-evaluation — `DESIGN-v2.md` §6.1 and decision D6 in §8, and its evidence report on the orchestrator's recent runs, `e-toodls-current.md` §6.2 and §7.1. Neither file is in this repository; the numbers this ADR rests on are restated below. Runs are named by their FINAL ids.
- **Precedent:** `--override-family-budget` (`SKILL.md` → Step 0, the family budget gate), the one control that already lets the invoking human continue past a cap on the record: for one gate, and only at invocation. This ADR generalizes it.

## Context

Ten keys resolve from the merge-base copy of `.orchestrator/config.json`
(`references/config.md` → *The anchored set*), in two families: the execution policy
(`parallelism`, `max_parallel_lanes`, `max_contract_amendments`) and the instruments
(`max_eval_cycles`, `max_family_cycles`, `max_qa_cycles`, `max_review_cycles`,
`gate_wall_clock_minutes`, `max_spec_requirements`, `rigor`). The run uses the merge-base value
whichever way the working tree moved it. A CLI arg still wins, because it "carries the invoking
user's authority rather than the branch's" (*Precedence*), but only two of the six execution
budgets have one (`--max-review`, `--max-qa`), and a CLI arg is spent at invocation. Once a run is under way, the
only route to a larger cap is to move the merge base: a PR to `main`, then a merge of `main` back
into the run's branch.

2af5 took that route twice. Its contract amendment cap ran out mid-build, over contract defects
the build had just found. The operator approved a raise each time, to 3 and then to 4, and each
raise needed a PR and a merge before it took effect: **5 cap questions, 2 PRs, 2 merges and about
7.9 hours of waiting** (6.3 h, then 1.6 h). The conductor misread the anchoring rule twice before
it found that path, and it offered the raise as "(Recommended)". Later in the same run the
operator overrode the family budget, and the host's permission classifier blocked the conductor's
hand-written override record twice, until the operator pasted it in.

None of that protected anything. The anchor exists so that **the change under review cannot set
its own budget**: `.orchestrator/config.json` is a file the branch can edit, and an agent can edit
it mid-run. In 2af5 no branch edited anything. A human decided, and the PR was only the vehicle
that carried the decision to the merge base. The round trip added hours and merges and no
information: the decision after it was the decision before it.

## Decision

### 1. Six execution budgets can be raised mid-run by the invoking human, on the record

The six are `max_contract_amendments`, `max_review_cycles`, `max_family_cycles`,
`max_qa_cycles`, `max_run_minutes` and `gate_wall_clock_minutes`. Each **starts from its
resolved value, exactly as today**: CLI > merge base > default for the five anchored keys, and
the working tree for `max_run_minutes`, which was never anchored because it caps a stop while the
meter reports regardless.

When a run reaches one of these caps, the conductor may ask the operator whether to raise it
instead of stopping (`AskUserQuestion` on Claude Code, `question` on opencode). The question shows
the cap, the current value and the proposed value, and it **never labels the raise
"(Recommended)"**. On approval the conductor runs

```
node .orchestrator/run-state.cjs raise <run> <key> <to> --from <current> --approval '<the answer, verbatim>'
```

and continues with the effective cap, `max(resolved value, highest raise)`. The answer goes in
single quotes, each `'` written `'\''`: inside double quotes the shell would run its backticks and
expand its `$` before `run-state.cjs` saw it, and the record would still say approved. A resumed
run, on a new session or a new host, reads the cap back with `run-state.cjs budget <run> <key>`,
not from anyone's memory. Stopping stays the default: the question is offered, never assumed.

### 2. A raise only raises

`raise` refuses a lower value, an equal one, a `from` of `0`, an unknown key, a missing
approval, and a `from` below a raise already recorded for the key, which names a cap no longer in
force (exit 2). On several of these keys `0` switches something off rather than setting a cap
(the family gate, the run stop, the gate bound, amendment itself), so from `0` "higher" has no
single meaning, and a key at `0` changes only by a PR. And because `to > from ≥ 1`, no raise can
produce a `0`.

**Lowering a budget still takes a PR**, or at invocation a CLI arg where one exists, as today.
There are two reasons. Lowering `gate_wall_clock_minutes` is a loosening: a tighter bound turns
slow gates into `UNMEASURED`. And one rule for all six is safer than a per-key direction table
applied mid-run; in 2af5 the anchoring rule alone was misapplied twice.

### 3. The rest of the anchored set stays strictly anchored

`max_eval_cycles`, `max_spec_requirements`, `rigor`, `parallelism` and `max_parallel_lanes` have
no in-session route, in either direction:

- **`max_eval_cycles`** is the grading instrument. Reaching it means the spec and the
  implementation disagree in a way no further remediation will settle (`references/config.md`).
  A spec decision settles that; a bigger cap only buys another pass at it.
- **`max_spec_requirements`** is checked once, at Step 2, before any cycle runs. It has no mid-run
  moment, and `--override-spec-size` already covers the invocation.
- **`rigor`** is one word that sets all four cycle caps and every gate's block-or-report. ADR-0024
  decisions 2 and 3 keep it where they put it.
- **`parallelism`** and **`max_parallel_lanes`** size the fan-out of command-capable coders in a
  shared workspace, and Step 2p sliced and priced the lanes against them. That blast radius is
  what the anchor was first written for.

`max_contract_amendments` shares the execution-policy family with the last two, and it is
raisable where they are not because a raise widens nothing. The lanes and their width stay as
planned; the run may only revise the frozen contract more times before it falls back to
sequential. Each amendment still runs the loop in `references/parallel.md` → Step 3j.2.

### 4. Only the human raises

A role never raises a cap, and the conductor never raises one without a recorded answer. A role
that finds a cap too low says so as a finding, as ADR-0024 decision 3 already requires for
`rigor`. The approval is stored verbatim because the record is the only thing that separates a
human's raise from a conductor's. "(Recommended)" is barred because a recommended option is
mostly accepted (27 of 33 across another project's runs), which would make the raise the
conductor's decision with a human click.

### 5. The FINAL prints every raise

Each raise is one line of `.orchestrator/runs/<run>/budget-raises.jsonl`:
`{"key","from","to","approval","at"}`. That directory is untracked, because
`.orchestrator/.gitignore` is an allow-list (ADR-0023 decision 5), so the durable record is the
FINAL. It prints `Budgets raised in session:` followed by the output of
`run-state.cjs raises <run>`, one line per raise with the operator's words, or `none`. A raise is
not an `Instrument moved:` entry: that line compares the working tree with the merge base, and a
raise touches neither.

## What this amends

1. **ADR-0024 decision 2, and *The anchored set*'s "The run uses the merge-base value in every
   case".** For `rigor` and the four other strictly anchored keys, nothing changes. For the five
   anchored execution budgets, the merge-base value (or the CLI's) is where the run **starts**,
   not a ceiling it must finish under. A working-tree edit to any of them still does not take
   effect and still prints `INSTRUMENT MOVED`. The branch gains nothing.
2. **ADR-0024 decision 3, and *Precedence*'s "A CLI arg still wins over both, because it carries
   the invoking user's authority".** That authority used to reach a run once, at invocation,
   through CLI args. It now also reaches it mid-run, through a recorded approval: upward only, and
   only for the six execution budgets. `rigor` gains no mid-run route in either direction, and
   decision 3's "No role, no subagent, and no remediation loop may write it" now covers the six
   budgets too.
3. **ADR-0024's rejected alternative, "it can only raise it".** Still rejected for a role, for
   the reason it gives: raising is exactly what unblocks a stuck loop. This ADR does not give a role
   that lever. It gives the human a faster route to a lever the human already held, through
   `--override-family-budget` and through a PR, and it keeps the stop as the default.
4. ***The anchored set*'s instruments family now holds two kinds of key.** Its table says those
   keys "decide how hard the run is measured and how much it may spend measuring", and the table
   stands: all of them still resolve from the merge base. How hard (`max_eval_cycles`,
   `max_spec_requirements`, `rigor`) stays an instrument in the strict sense. How much it may
   spend (`max_review_cycles`, `max_qa_cycles`, `max_family_cycles`, `gate_wall_clock_minutes`)
   is an execution budget, beside `max_contract_amendments` and the unanchored `max_run_minutes`:
   anchored where it starts, raisable by the human.
5. **Unchanged: *Direction — which way is loosening*.** Raising the three cycle caps is still that
   table's loosening direction, which is why only the human raises them and the FINAL names every
   raise.

## Alternatives considered

**Everything anchored, as today (D6 option b).** Rejected on 2af5's numbers. The anchor defends
against the branch, and the branch was never the actor.

**CLI flags for the four keys that have none.** Rejected: a flag is spent at invocation, and every
cap 2af5 hit was reached mid-run, hours after anyone could have typed one. Raising a cap on
`main` before a long run is still good practice, and it is the only route for a key at `0`.

**Let the conductor raise a cap once, unasked, and disclose it.** Rejected. A recorded default may
decide whether a run waits, never its verdict (ADR-0028), and an automatic raise decides the
verdict: a run that would have stopped `STALLED` finishes. A pipeline that can widen its own
budget has no budget.

**Lower in session too.** Rejected under decision 2.

## Consequences

- **A cap stop costs a question, not a PR.** 2af5's two raises would have been two answers and no
  merges.
- **A raise shows in the FINAL, not in a story PR.** `product-manager` copies six banner lines
  into a story PR, and `Budgets raised in session:` is not one of them, so a PR reader sees a raise
  only by opening the FINAL.
- **`--override-family-budget` stays.** The family gate refuses before Step 0a mints a run, so
  there is no run yet to record a raise against; the flag remains the route past it.
- **A raise helps only on the term that binds.** Step 4 compares against `review_budget`, which
  Step 0b derives from `max_review_cycles` and `max_family_cycles`; the Step 0b banner already
  prints which of them binds.
- **More QA cycles are more draws at a flaky gate.** Each re-run must still pass the same gates,
  so the bar does not move, but the odds of a lucky green rise. The FINAL's QA cycle count and its
  raise line, read together, show it.
- **The record is a claim, and the FINAL is what makes it checkable.** `run-state.cjs` cannot
  prove a human typed the approval. It can only insist on one, keep it verbatim and print it, so a
  fabricated raise is visible, not prevented.
- **Whether a host's permission classifier accepts the `raise` call is unmeasured.** It blocked
  2af5's hand-written override record twice.
- **The falsifier:** a cap raise that needed a PR; an in-session change used to weaken an
  instrument; a cap raise used as the normal way to finish. Watch the third. If runs routinely
  finish on a raise, the trunk's values are wrong, and the fix is a PR to them.
