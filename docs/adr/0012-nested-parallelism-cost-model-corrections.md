# ADR-0012 — The nested viability gate's cost model punishes slicing in three places; correct all three

- **Status:** Accepted
- **Date:** 2026-08-14
- **Skills affected:** `orchestrator` (`SKILL.md` → Steps 2p.1, 2p.2, 2p.3; `references/config.md` → *The inner viability gate*)
- **Source finding:** A `full` run on a study project reported `parallelism: full → off (no flat plan to fall back to)` for a plan that cut a 24-task critical path to 11.

## Context

A `full` run on a single-lane spec (`mobile = 24`, every other lane `0`) proposed a nested split
into 5 concurrent sub-lanes plus a 6-task integration sub-lane, cutting the critical path from
24 to 11 task-equivalents. The gate rejected it and, because the flat verdict was already
non-viable, degraded the whole run to `off`.

The printed rejection was:

```
Verdict: nested non-viable — 8 aggregate interface points exceed the smallest leaf's 3 tasks
parallelism: full → off (no flat plan to fall back to)
```

Investigation found **four** independent defects, three of which share one shape: a cost term
that grows with slice count compared against a quantity that shrinks with slice count. Each
one therefore bites hardest exactly when the split is working best. A fifth item addresses the
upstream cause of badly-shaped splits.

## Decision

### 1. The aggregate payback comparator becomes slice-invariant

`references/config.md` → *Aggregate diminishing-payback rule* rejects the nested plan when
aggregate interface points exceed **the smallest leaf's** task count. `min(leaf)` decreases
monotonically in slice count while `I` increases monotonically, so the rule's firing
probability approaches 1 as parallelism approaches usefulness.

- **Aggregate rule** → reject when `aggregate I > T` (the run's total task count). `T` does not
  move when slices are cut finer.
- **`references/config.md` → *Per-sub-lane re-application*, item 4** (`sub-contract I > smallest
  sub-lane's tasks`) → **deleted**. Same self-defeating `min`, and now subsumed by the
  aggregate form.
- **`SKILL.md` → Step 2p.3, condition 4** (`I > smallest lane's tasks`) → rewritten to the same
  `I > T` form. Consistency; this one rarely fires, because flat lanes are few and coarse.

**Why not delete the guard entirely.** `g > c` already charges every interface point as cost,
so an aggregate guard firing *after* `g > c` passed can only contradict correct arithmetic.
But `g > c` prices interface points as *mean cost* and says nothing about *variance*:
reconciliation touching nearly every leaf carries rework probability that is on no account in
this model. `I > T` keeps that backstop at a threshold that means something.

**`I > T` is a dimensionless ratio of counts, not a cost inequality.** It fires when the plan
freezes more interface rows than the run has tasks — a shape where reconciliation touches
essentially every unit of work. It must **not** be described as *"interface cost exceeds the
run's work"*: with a point priced at `0.25` (change 2 below), that claim would be `0.25 I > T`,
i.e. `I > 4T`, a threshold so extreme it could never fire. The cost reading was dropped rather
than the comparand rescaled — a guard that never fires is not a guard.

### 2. An interface point costs `0.25` task-equivalents, not `1`

`references/config.md` → *The makespan model* prices one interface point at `1` task-equivalent
— the same as implementing a task. An interface point is a row in a table written during an
architect pass that is **already charged separately as `A`**. Charging it at parity with
implementation work is what makes fine-grained splits arithmetically self-defeating, since
`I` is the only overhead term that grows with slice count in a `k = 1` plan.

New conversion table entry: one **interface point** = `0.25` task-equivalents.

**Consequence:** gate figures now carry `.25` increments. This is accepted. The alternative —
rescaling `A` and `J` to `8` to keep integers — changes more constants for a cosmetic gain.

**Both worked examples in `references/config.md` must be recomputed.** The first
(`{12, 6}`, no interface points) is unaffected. The second (*one lane carries all the work*)
changes: `I(0 + 2)` becomes `0.5`, overhead becomes `8.5`, `M_nested` becomes `16.5`, and the
candidate still adopts (`g = 16 > c = 8.5`). The examples are load-bearing regression checks —
`config.md` says to re-check them whenever either side of the model is edited.

### 3. `span(L)` must account for the serialized integration sub-lane

`references/config.md` defines `span(L)` for a split lane as `max` over its sub-lanes — but
`SKILL.md` → Step 3s mandates that the integration sub-lane runs **"through a single sequential
coder invocation — after its sibling sub-lanes are DONE, never concurrently with them."**
The model and the machine disagree about execution order, and the model is the optimistic one.
Unlike defects 1 and 2, this one **inflates the gain** rather than the cost.

- `span(L)` for a split lane → `max` over its **non-integration** sub-lanes, **plus**
  `tasks(integration sub-lane)`.
- The integration sub-lane is **excluded** from the two concentration conditions
  (*Per-sub-lane re-application*, items 1 and 2). It is not a concurrent slice, so counting it
  measures parallelism that does not exist. Without this, `{work: 20, integration: 4}` reads as
  "2 sub-lanes carry work" and is rejected for concentration when it was never a split at all;
  worse, `{a: 3, b: 3, integration: 18}` passes both checks while being 75% serial.

This change makes the gate **stricter**. That is correct: the number it feeds is the one
option 3 of the `ask` ladder shows the user.

### 4. The printed cost must show its terms

The observed run printed `cost ~3`. Under the model that quantity is `A + A + J + J + I` and
cannot be 3 under any constant choice. `SKILL.md` → Step 2p.2 prints `{c}` as a bare scalar,
which is unfalsifiable — neither the user nor the agent can see which term went missing.

The 2p.2 nested block prints `g`, `c`, and `span` **term by term with values substituted**:

```
c = A(2) + A(2) + J(2) + k×J(2) + I(8×0.25=2) = 10
```

**Rejected: a deterministic `gate-calc.cjs`.** `render-artifact.cjs` is precedent only for the
optional html path; Step 2p runs on **every** non-`off` run, and this skill is dual-host
(Claude Code + opencode). A node dependency on the always-on path means a host without node
either loses `full` or silently falls back to agent arithmetic. Shipping *both* would
reintroduce the two-accounts defect that `config.md` → *The cost side* and its worked example
exist to make structurally impossible.

### 5. Step 2p.1 asks for splits that are cheap to reconcile

Step 2p.1 asks the scan agent for mapped requirements, task counts, globs, and overlaps. It
never says **minimize the overlaps** — so the agent proposes the partition most obvious from
the tree, which for a mobile app is directories named after layers. Layer slices touch each
other; feature slices mostly do not. The observed run's 8 interface points and 25%-serial
integration sub-lane are that choice, measured faithfully.

Step 2p.1's digest request gains: prefer splits that minimize cross-slice interface rows and
integration-sub-lane size, and **name the axis used** (feature / layer / other). Step 2p.2
prints the axis, so a thin margin and its likely cause appear on the same screen.

This is the least verifiable item in the set — a prompt-quality change judged over runs, not a
printed line you can check.

## The reported case, recomputed

```
span(mobile) = max(5 concurrent sub-lanes) + integration = 5 + 6 = 11
g = T − span_max = 24 − 11 = 13
c = A(2) + A(2) + J(2) + k×J(2) + I(8 × 0.25 = 2) = 10      (first adoption, sequential baseline)
g > c → 13 > 10 → adopted, margin 3
M_nested = 11 + 10 = 21   vs   M_seq = 24
```

Adopted, at a 12.5% win. The margin is thin, and honestly so: the integration sub-lane (6) is
larger than the critical concurrent leaf (5), so more than half the lane's span is serial.
That is Amdahl's law reported accurately, and it is what item 5 attacks upstream.

## Consequences

- `full` stops rejecting splits that shorten the critical path by 2× — the reported case now runs.
- Two of five changes (3 and the concentration exclusion) make the gate **stricter**. Net
  looser, not uniformly looser.
- Gate figures carry `.25` increments.
- Both worked examples in `references/config.md` are recomputed; they remain the regression check.
- **Not addressed here:** `k × J` — inner joins are serialized, so a `k`-way plan pays `k` full
  join passes. Same defect family (a term that scales with slice count), but fixing it changes
  Step 3s's barrier discipline rather than a constant. See **ADR-0013**.
- **Not addressed here:** a re-slice retry when the gate rejects a badly-shaped split. Rejected
  because `SKILL.md` → Step 2p.1 is emphatic that the analysis is one pass — *"this is a
  decision, not an economy"* — and a retry loop on the step whose job is keeping cost visible
  doubles that cost with no guarantee axis #2 beats axis #1. Item 5 attacks the cause instead.
