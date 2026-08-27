# ADR-0022 — Disclose the reviewer's read scope; do not narrow it

- **Status:** Accepted
- **Date:** 2026-08-27
- **Skills affected:** `orchestrator` (`templates/reviewer.md` → Step 1.4 and the structured output summary's `Read scope:` line; `SKILL.md` → Steps 4 and 5c — the `delta=` preamble line). **No change to `MAESTRO_REVIEW_BASE`, to the working-tree snapshot, or to what the reviewer evaluates** — which is the property this ADR exists to preserve.
- **Source finding:** proposal P8 of the run-cost forensics on a 75-hour, 9-leaf `full` run, landed on `perf/orchestrator-run-cost` (PR #40). P8 proposed narrowing the reviewer's re-read on cycles ≥ 2 to the cycle delta plus a reverse-dependency closure. It was traced against the four late-cycle Must Fixes of a real six-`CR` family and **is not shipped**.
- **Depends on:** **ADR-0018 — The run can name its base commit but never its own tree**. `delta=` is computed from `boundaries[]` and is that ledger's first consumer.
- **Precedent:** **ADR-0015 — Keep G1's coverage surface divergent between the node-ts and dart-flutter adapters**, which records a deliberate non-repair and keeps the alternative open "to decide on its own merits". This ADR is the same shape.

## Context

The reviewer is instructed to read **every changed file in full**, on every cycle. On a nine-leaf
parallel run that instruction does not fit: the union was **3.5 MB of source plus a 2.1 MB diff**. P8
proposed the obvious remedy — on cycle 2 and later, narrow the re-read to the files this cycle changed
plus a reverse-dependency closure over the symbols they touch.

The proposal had to answer two questions, and both were traced rather than argued.

**Safety — would the narrowing have missed a real finding?** Against the four late-cycle Must Fixes of
a real six-`CR` family: three of the four were **inside the raw cycle delta** and needed no closure at
all — including *"MF-16 fixed the validator and left one of two doors"*, which is same-file and
same-delta. The fourth, *"MF-5 fixed the writer and left four callers"*, is reachable only by grepping a
type the delta references but does not declare-change. So **0 of 4 are missed** under an "every
identifier in the changed hunks" closure rule, and **1 of 4** under a narrower one. The narrowing was
**safer than feared.**

**Value — how many tokens would it remove?** None, and this is the finding that decides it. **The read
P8 narrows is not being performed.** The instructed read does not fit, and the six `CR`s the family
produced are 30–50 KB documents whose prose is grep-shaped rather than linear-read-shaped. **Not one of
the six states its read scope.** So a narrowing rule would have *renamed* a narrowing that already
happens rather than removing tokens anyone spends — while contradicting three landed sentences in the
same change set, one of them written specifically to fence ADR-0019's join digest off from the source
read (*"You still take the working-tree snapshot yourself, still read **every changed file in full**"*).

The situation is therefore precisely inverted from how the proposal was framed. The risk is not that
narrowing is unsafe. The risk is that **an undisclosed ad-hoc narrowing is already the shipped
behaviour**, differently on every cycle, and nothing can see it.

## Decision

### 1. The blast-radius narrowing is not shipped

No rule instructs the reviewer to read less. The subject of the review is still the whole union, the
snapshot is still the whole tree, and `MAESTRO_REVIEW_BASE` is unchanged.

**Rejected on value, not on safety** — and the distinction is recorded because it changes what evidence
would reopen it. A safety rejection is reopened by a better closure algorithm; this one is reopened by
a measurement showing the read is real.

### 2. What ships instead: `delta=`, and a `## Read scope` section

`delta=` is emitted to the reviewer on review cycles ≥ 2, naming the files **this cycle** changed,
computed from ADR-0018's `boundaries[]`. The reviewer discloses, in a `## Read scope` section of its
`CR`: the delta file list; any symbols it closed over to reach files outside it, each with its hit
count; which union files it opened; and which it did not re-open this cycle, with the reason. The
structured summary carries a one-line form:
`Read scope: {opened}/{union} files{, delta {N}, closure +{N}}{ | whole union}`.

### 3. `delta=` narrows nothing, and the template says so in its first clause

This is normative, not a caveat. The line names what changed; it does not authorize reading less. A
disclosure instrument that is read as a budget becomes the narrowing rule it was built to measure,
which is the specific way this decision could be defeated by a later reader in good faith.

### 4. Honesty is the requirement, and the template says the unflattering answer is the valuable one

*"Do not describe a read you did not perform"*, and do not treat the section as a target to satisfy:
**an honest "carried 250 of 340 files, unopened" is worth more than a claim of completeness.**

A `CR` that reports no scope is indistinguishable from one that read everything — which is exactly why
no rule about narrowing can currently be argued from evidence, and why the six-`CR` family had to be
traced by hand to answer a question the artifacts should have answered.

### 5. The re-open condition, stated with the number that decides it

**If two runs show the reviewer routinely carrying most of the union in silence, the rule writes itself
with numbers instead of arguments.** At that point the narrowing is re-proposed on measured value, and
the closure rule it needs is already known from the trace above: *every identifier in the changed
hunks* misses 0 of 4; anything narrower misses 1 of 4.

## Alternatives considered

- **(A) Ship the narrowing as proposed.** Rejected. It removes no tokens anyone spends, contradicts
  three landed sentences, and converts an undisclosed narrowing into a *sanctioned* one without ever
  measuring the first.
- **(B) Ship the narrowing behind a config key, default off.** Rejected: it takes the same decision
  while adding a key nobody has evidence to set, and the disclosure would still be missing — so the
  key's own effect would be unmeasurable.
- **(C) Ship nothing, and file the proposal as a note.** Rejected. A note records the *idea*; it does
  not produce the measurement, and the next reviewer of this area re-derives the same six-`CR` trace
  from scratch. That is the one-copy-at-a-time repair loop **ADR-0017** was written to pre-empt.
- **(D) Enforce the full read instead — fail a `CR` that carried files unopened.** Rejected: the
  instructed read demonstrably does not fit on a large union, so the rule would fail every late-cycle
  review on a nine-leaf run and stall the pipeline in front of its only convergence mechanism.

## Consequences

**Positive.**

- An undisclosed ad-hoc narrowing becomes an **audited** one. Nothing about the review's authority,
  subject or base changes; what changes is that its scope is now on the record a human reads three
  cycles later.
- The `## Read scope` section is the measurement a real scope rule would have to be argued from, and
  it accrues on every run rather than being reconstructed by hand.
- `delta=` gives ADR-0018's `boundaries[]` its first consumer, which is also the first end-to-end
  exercise of the ledger — a boundary that is written and never read is a boundary nothing proves
  correct.

**Negative / accepted costs.**

- **The run costs what it costs today.** No token saving is claimed, and none should be reported. This
  ADR buys evidence, not throughput.
- The `CR` grows by a section, on cycles ≥ 2.
- The disclosure is self-reported, and a role that misreports it defeats the instrument. There is no
  mechanical check, and inventing one would require the orchestrator to observe the reviewer's reads,
  which it cannot. The mitigation is the template's stated preference for the unflattering answer —
  which is a norm, not a gate, and is recorded as such rather than dressed up as enforcement.
- **A decision that produced no behavioural change now has an ADR.** That is deliberate: the decision
  is *not to change behaviour despite a specified, traced proposal to*, and the trace is the expensive
  artifact. ADR-0015 sets the precedent — the alternative stays open, on its own merits, and must not
  be shipped later as a cost repair.

**Not addressed here:** whether the reviewer's instructed read (*every changed file in full*) is itself
the right instruction on a large union. The measurement above says it is not being followed; this
decision deliberately does not resolve that, because resolving it either way — relaxing the
instruction, or enforcing it — is the very change the `## Read scope` data is being collected to
inform.
