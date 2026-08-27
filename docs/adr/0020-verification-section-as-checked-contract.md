# ADR-0020 — A plan's verification section is prose nobody can check; give it a per-gate coverage table and a closed command-scope vocabulary

- **Status:** Accepted
- **Date:** 2026-08-27
- **Skills affected:** `orchestrator` (`templates/architect.md` → *Verification (per phase)*, **Scoping a phase gate**, *Rules*, the structured output summary; `templates/coder.md` → the phase-exit gate sub-step and rule 5; `SKILL.md` → Step 2 *Gate-completeness check*, Step 4a, Step 5a; `references/parallel.md` → Step 2L; `references/context-schema.md` → `Commands`; `templates/PROJECT-CONTEXT.template.md`)
- **Source finding:** run-cost forensics on a 75-hour, 9-leaf `full` run, landed on `perf/orchestrator-run-cost` (PR #40) as items P1 and P2. Measured: **eight of nine leaf plans carried no gate accounting at all**, so the gates first ran at QA — two roles late — and clearing them cost a `QAF` plan, a re-review and a second QA pass. Separately, **sixty-one whole-app suite executions crossed the single run** without anyone noticing, three of them out of one concurrent lane.

## Context

`## Verification (per phase)` was free prose plus a rule the architect was told to follow. Two
different things were consequently uncheckable, and both were observed failing in the same run.

**First: whether a gate is carried at all.** A plan whose verification section lists a toolchain
command per phase — analyze, format, test, a layer gate — and names no gate letter *reads as thorough*.
It passes every structural check the orchestrator had. It is indistinguishable from a plan that
deliberately deferred its gates, because a deliberate deferral looked exactly the same: nothing. One
such lane plan shipped **10 G2 findings in its own new widget files through six phases**, plus 4 G5;
they surfaced at QA, two roles and a full remediation run after the code was written. Prose naming
`yarn lint` per phase says nothing about whether G2's complexity thresholds or G5's no-comments scan
are enforced anywhere.

**Second: what a listed command actually looks at.** The rule forbidding a whole-app suite bound on
`lane=` — it was parallel-lane-only. So it was **off for exactly the plans that dominated the run's
tail**: the sequential remediation plans. Worse, the idiom that produces the violation reads as
diligence — *scoped for the early phases, the full suite for the last one* — and it propagates: it was
obeyed three times out of a single concurrent lane, and then copied verbatim into the remediation plan
written to fix it. A rule in the coder template loses to a plan the coder is reading, every time,
because the coder reads the plan and not the authoring guidance the architect read.

These are one defect with two faces: **the verification section carried claims that no party could
verify and no artifact could contradict.**

## Decision

### 1. `### Gate coverage` — one row per runtime gate id, closing the section

Six rows, in the order G1, G2, G4, G5, G6, G7. (`G3` is folded into `G2`; it is not a runtime gate and
gets no row.) Every `Carried by` cell names the **command** that runs that gate, or reads the literal
`n/a` with its reason in the `Phases` cell. `G6`'s row is always `n/a` / QA-only.

**It is not a summary of the prose above it: it is the only machine-checkable statement that a gate is
carried at all.** A gate genuinely uncarryable at phase exit is an `n/a` row **with its reason**, never
a missing row — an honest `n/a` is a decision the reviewer and QA can see and price, while a missing
row is indistinguishable from an oversight.

### 2. `| Command | Scope | Phases | Path condition |` — the command table

Keyed by **command**, answering *what does this command look at*. Every row carries a `Scope` token and
a `Path condition` cell stating the ground for it.

### 3. The `Scope` vocabulary is closed, at four tokens

`changed-files | whole-project | advisory-instrument | deferred-to-join`.

- **`changed-files` is the default**, and the only legal token for a command that accepts a path,
  pattern, directory or spec argument. The narrowing flag is looked up in `PROJECT-CONTEXT.md` →
  Commands and written into the row as an explicit `<placeholder>`, rather than left for the coder to
  guess.
- **`whole-project` requires all three properties** — no path argument, does not mutate the tree,
  completes in seconds — and the `Path condition` cell must name which of the three is being relied
  on. **The token is a classification, not an escape hatch: a `whole-project` row naming a test suite
  is a malformed plan**, and the orchestrator fails it on sight.
- **`advisory-instrument` is the coverage command and nothing else.** Coverage's denominator is the
  gate config's roots, so narrowing its *execution* does not narrow its *measurement* — it only
  under-reports the numerator, because a changed file is frequently covered by a test naming a
  different file.
- **`deferred-to-join` is a parallel-mode outcome only**, and is **illegal on a laneless plan**
  (sequential, `FIX`, `QAF`), which has no join to redeem a deferral at. A non-narrowable command there
  is classified `whole-project` with its cost stated, never deferred into nothing.

**Closed, not open.** An open vocabulary would let a plan name its own scope class, which is the state
this replaces. Four tokens is the number the observed command population needs; a fifth is a decision,
not an edit.

### 4. Narrowing is an authorized deviation from the plan; widening is not

The coder fills each `changed-files` row's `<placeholder>` from the phase's changed-set intersection.
**When the plan names the unscoped form of a narrowable command anyway, the coder runs the scoped form
and records the substitution — it does not obey, and does not refuse.**

This is the one exception to running the commands as the architect listed them, and it exists for a
stated reason: **a plan that names the whole-app suite beats every rule written in the coder template**,
because the coder reads the plan. Giving the coder an explicit authority is the only intervention that
binds at the point of execution.

The record is what makes it auditable: the `CODER — GATE` entry gains `cmd:` (the exact command string
executed), `scope:` (the token), and a `substituted:` line when narrowed. **The entry's first three
lines are byte-compatible with what QA already reads**, so the carried-versus-first-time discrimination
is untouched. With no command string on the record, *did this phase run the whole suite* was answerable
only from free prose — which is how sixty-one whole-app suite executions crossed one run.

### 5. No whole-app test suite at phase exit — in any mode, on any plan type, lane or no lane

The prohibition moves off `lane=` and becomes unconditional. In parallel mode a repo-wide suite reports
a sibling's in-flight state as this phase's failure; in sequential and remediation mode the cost is
fixed and multi-minute and this phase's diff does not justify it.

**This is not "nobody runs the suite", and the barriers are named** so a coder tempted to run it has
somewhere to point: the tester's coverage command (a whole-app *execution* by construction, whose
*measurement* scope is unchanged — execution scope and measurement scope are different things); QA's
Step 3, **which is the barrier that binds on a `FIX` or `QAF` plan**; and the outer join, where
`simplify` and the full suite run exactly once per run over the union.

A companion rule lands with it: **when a command has a mutating and a non-mutating form, emit the
non-mutating one.** A lint that auto-fixes rewrites the tree it is measuring — its own result becomes
unreproducible, and in a shared workspace it silently reformats a sibling lane's files.

### 6. The orchestrator verifies both tables before any coder starts, at four sites

Step 2 (sequential), Step 2L (parallel, per leaf), Step 4a (`FIX`, conditional), Step 5a (`QAF`,
conditional). One architect re-invocation quoting the specific gate letters; stop and report if still
incomplete.

**Per leaf, not over the union.** Unlike requirement coverage — which no single leaf can satisfy — a
gate-coverage table is a per-plan artifact: each leaf owns a disjoint path set, so each leaf's table
stands or falls alone. **The parallel path needs the check most**: on a sequential run an omitted gate
surfaces at QA and costs one remediation plan; on a parallel run it surfaces at the *join*, where the
gate first runs over the union, and by then the omitting lane has been merged into a change set eight
other leaves also wrote.

Two failure modes are closed alongside the tables. `Verification: QA-only` must now carry **its
reason** — an unreasoned `QA-only` is indistinguishable from a dropped section, and the orchestrator is
not allowed to guess. And the check **degrades to a skip when the project holds no
`.cleancode-gates.json` anywhere**, exactly as Bootstrap B2's optional dependencies do.

### 7. The two tables are keyed differently and are not merged

`### Gate coverage` is keyed by **gate id** and answers *is this gate carried at all*; the command
table is keyed by **command** and answers *what does this command look at*. One plan routinely runs
more commands than it has gate letters, and one command's scope can differ between phases — neither
fits in a six-row per-gate table. Where they touch, the scope is stated once in the command table and
the gate row names the command only.

### 8. `PROJECT-CONTEXT.md` → Commands must supply what the rows need

Each narrowable command is recorded in **both** its whole-project and its path-scoped form, and each
mutating command is paired with its check-only sibling. This is stated as a **quality datum, never a
precondition**: the context coverage check is heading-presence only and cannot see inside the section,
so a missing scoped form degrades a plan's gate rather than blocking the run. The schema says so
explicitly, rather than implying an enforcement that does not exist.

## Alternatives considered

- **(A) One merged table keyed by gate id.** Rejected: it cannot express a command with no gate letter,
  nor one command whose scope differs across phases — both of which are the common case.
- **(B) Keep the whole-app prohibition bound to `lane=`.** Rejected: that binding is precisely why the
  rule was off for the remediation plans that dominated the run's tail, and those plans are where the
  idiom propagated to.
- **(C) An open `Scope` vocabulary, or free prose in the cell.** Rejected: the orchestrator's check
  becomes non-empty-string, which is the state being replaced. Two of the checks that fire on sight —
  `whole-project` on a test runner, `deferred-to-join` on a laneless plan — are only expressible over a
  closed set.
- **(D) Make the tables advisory.** Rejected: eight of nine leaf plans omitted the accounting when it
  was advisory-by-absence. An unenforced table is the state that cost the `QAF`+re-review+second-QA
  cycle.
- **(E) Have the coder infer the scope instead of reading a token.** Rejected: it reproduces the
  authority problem in decision 4 — an inference has no record, and *did this phase run the whole
  suite* stays unanswerable.

## Consequences

**Positive.**

- A gate that is not carried is now visible **before any coder starts**, which is the cheapest point in
  the run to discover it and the most expensive one to discover at QA. Same asymmetry, same argument,
  as the requirement-coverage check that sits beside it.
- Every gate execution now leaves the command string it ran, so a scope claim is auditable at all.
- The `Verification: per-phase — gates {ids}` summary line makes the accounting visible in the
  transcript without opening the plan.

**Negative / accepted costs.**

- **This is a strictness increase, and it lands on sequential and remediation runs that were previously
  unaffected.** A plan that used to name the whole-app suite in its close-out phase is now malformed.
  That is a behaviour change of the class **ADR-0015** describes as requiring its own changelog entry
  and its own migration note — it is not a backward-compatibility repair and must not be shipped as
  one.
- The architect writes two tables where it wrote none, on every plan.
- **The check verifies accounting, never enforcement.** It confirms every gate is *accounted for*, not
  that the named command truly enforces it — the orchestrator runs no gates and cannot know. This is
  the same trade the requirement-coverage check makes one level up, and it is stated rather than
  implied, so a reader does not mistake a complete table for a passing gate.
- A `whole-project` command failing in a file outside the phase's intersection is recorded
  `not-mine — {owning lane | pre-existing}` and does **not** fail the phase. This is an extension of
  the existing *a violation in a file no task in this phase touched is not yours to clear* rule from
  gate findings to command results — one clause, not a new rule, and deliberately **not** a new
  attribution instrument. The instrument that does exist is ADR-0021's baseline.

**Not addressed here:** what the gates measure, any threshold, and the `.cleancode-gates.json` contract.
This decision governs *which command runs over which paths*, and nothing about the verdict it produces.
