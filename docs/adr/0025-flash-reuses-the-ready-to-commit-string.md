# ADR-0025 — orchestrator-flash emits the orchestrator's green, and pays for it on the banner

- **Status:** Accepted
- **Date:** 2026-09-16
- **Skills affected:** `orchestrator-flash` (`SKILL.md` → Step 5 banner and *What flash does not verify*); `product-manager` (unchanged by design — it drives flash with the matcher it already has).
- **Source finding:** `docs/superpowers/specs/2026-09-16-orchestrator-flash-design.md` (decision D3 and its risk section).
- **Precedent:** ADR-0024 (`rigor-levels-and-the-invariant-disclosure-set`), whose decision 1 anticipated this exact question; `docs/effort-tiers-design-note.md` → "Cheap green and expensive green must not look alike".

## Context

`product-manager/SKILL.md:139` defines pipeline success as the literal string
`READY_TO_COMMIT`, and `:143` defines a stop as a `Status: STALLED` line. Both are string
matches against a role's stdout, not structured results — the wrapper cannot ask which
pipeline produced them.

`orchestrator-flash` verifies materially less than the orchestrator: no tester, no QA, no
spec grading, no coverage floor, no mutation gate, and no full test suite. It is the same
shape of claim — *this is ready to commit* — resting on a fraction of the evidence.

That leaves two options, and no third. Mint a distinct vocabulary, and every existing
wrapper stops recognising a flash run: `product-manager` would not see success, and its
stop rule matches `STALLED` and nothing else, so an unrecognised terminal state does not
fail — it hangs. Or reuse the strings, and one green now means two amounts of
verification.

ADR-0024 saw this coming. Its decision 1 records: "The first time a `sketch` run's banner
is called noisy, the proposal will be to trim it. That proposal is a change to decision 1."
Trimming the orchestrator's disclosure set would be that change. Having the weaker promise
in a **sibling skill that says so** is the honest way to have it instead.

## Decision

**Flash emits `Status: READY_TO_COMMIT` and `Status: STALLED` verbatim.** A wrapper drives
it unchanged.

**The banner carries the difference.** Two mechanisms, both mandatory:

1. A `Pipeline: flash (reduced verification — see below)` line, immediately under the
   status, so the run identifies itself before a reader reaches anything else.
2. A `NOT VERIFIED` block naming every skipped check **by category** — e2e, coverage floor
   (G1, asserted by nobody), mutation (G6), spec grading, QA regression, full test suite.
   Not a count, not a summary: the names, so a reader who cares about one of them can find
   it by searching for it.

A skipped step also prints its own skip line where it would have run — `review: skipped
(config)`, `simplify: skipped (config)` — because a step that did not run must never look
like one that ran and found nothing.

## Alternatives considered

**A distinct success string (`READY_TO_COMMIT_FLASH`).** Rejected. It protects the
vocabulary and breaks every wrapper, and the failure mode is the bad one: a matcher that
does not recognise the string does not report a mismatch, it waits. A wrapper hanging on an
unrecognised green is worse than a wrapper acting on a green that is honestly labelled.

**No machine-readable terminal state at all.** Rejected against a stated requirement —
flash is meant to be drivable by `product-manager`, which is the whole reason it emits a
terminal state rather than a human summary.

**Structured output naming the pipeline.** The right long-term answer, and out of scope
here: it changes `product-manager`, the orchestrator and flash together, and none of those
edits belong in the commit that introduces a skill.

## Consequences

- `product-manager` drives flash with no change. That is the point.
- **A wrapper keying on the string alone cannot tell the two apart.** Only a human reading
  the banner can. This is a real weakness, and recording it here is the difference between
  a decision and an accident.
- `effort-tiers-design-note.md:27` is honored at the **disclosure** layer rather than the
  vocabulary layer. That is weaker than ADR-0024's treatment inside the orchestrator, and
  it is weaker on purpose: flash's promise is smaller, so it is allowed to disclose less —
  provided it says which checks it skipped, which is exactly what the `NOT VERIFIED` block
  is for.
- If a future wrapper needs to distinguish the pipelines mechanically, the migration is
  additive: a structured field alongside the string, never a replacement for it.

## First run

Measured on the end-to-end run in a scratch repository on 2026-09-16 — a zero-dependency
Node CLI printing the next public holiday for BR, US or PT. This is the measurement any
later claim about flash's speed has to argue from.

| | |
|---|---|
| Wall clock | ~24 minutes, including the orchestrator's own verification pauses between steps |
| Role spawns | **6** — brainstormer, architect, coder, reviewer, then coder and reviewer again for one review cycle. Matches the predicted 4 nominal / 6 at a budget of 1. |
| Subagent tokens | ~474k across the six |
| Artifacts | **5** — `SPEC`, `FEAT`, two `CR`s, `FINAL`. One per review cycle, not the flat four the plan predicted. |
| Reviewer, first pass | `REQUEST_CHANGES` |
| Tests at the end | 15, all passing, all written by the coder |
| Typecheck / build | Neither exists in the project; both recorded as not detected |
| Committed | Nothing. `HEAD` equalled the pre-flight base at the end of the run. |

Two findings worth keeping:

**The reviewer's snapshot earned its place on the first run.** Every file under review was
untracked, so a reviewer reaching for a commit range would have seen an empty diff. Instead
it quoted `holidays.js:50-55` and found a real defect: `toDateString` derived the
comparison date from `getUTC*`, so "today" ran ahead of the local calendar date for the
last hours of every day in Brazil (UTC-3) and every US zone. That is precisely the
same-day boundary the plan's AC6 exists to pin, and no test in the suite as written could
see it. Cycle 2 approved after the fix and its regression test.

**The home gate reports green when it has nothing to scan.** Its automatic scope is git
branch scope, and a flash run's artifacts are untracked, so `check-artifact-home.cjs` with
no arguments collects zero files and exits 0 — including when a deliberate violation is
sitting at the `plans/` root. Verifying a flash run means explicit mode, from a
materialized copy: `node .orchestrator/check-artifact-home.cjs -- $(find plans -name '*.md')`.
Run that way it returned OK for this run and rejected both control violations. This is the
same vacuous-green mechanism that decided flash would run no scoped gates at all (D6), met
here in the verification rather than the pipeline.
