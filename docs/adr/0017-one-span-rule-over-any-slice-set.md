# ADR-0017 — One span rule over any slice set, at any depth

- **Status:** Accepted
- **Date:** 2026-08-19
- **Skills affected:** `orchestrator` (`references/config.md` → *The makespan model* (the rule, `span(L)`, `span_max`, `M_flat`, `M_seq`), *The baseline* (both rows), the `g`/`c` cancellation paragraph, *The two work-concentration conditions are evaluated at leaf granularity*, *Per-sub-lane re-application of the existing viability conditions*, *Leaf-level re-application of the two work-concentration conditions*). `templates/architect.md` is **unamended** — it names `span_base` / `span_max` / `span(L)` referentially and restates no formula, which is the property this ADR preserves. `SKILL.md` is amended **only where it restated the arithmetic or described that restatement**, and the amended locations are **named rather than counted**, so that a later amendment cannot falsify this record: Step 2p.2's **nested** print block, whose `span_max` line now carries `+ integration({n})` — mirroring the `integration({n})` idiom already used by the flat block and by the `span({lane})` line; the `span(L)` / `span_max` paragraph below that block, which gained one clause pointing at *The makespan model*; and the slot-guard paragraph beside it, which now names each of the block's integration slots with its own declared source — the critical leaf's lane, the candidate split, and the **lane-level** field — and guards the copy hazard between the two adjacent lines printing the character-identical `+ integration({n})` token from different declaration levels (`CR-20260819T112837Z-9e42` MF-2). Those locations were amended because they **did** restate the arithmetic, and the first did so in its superseded pre-ADR-0016 form; ADR-0016 §5's byte-for-byte guarantee is scoped by its own heading to the **flat** block and does not reach the nested one (`CR-20260819T104419Z-fc4f` MF-3).
- **Source finding:** the `feat/prime-agent-distribution` PR-review backlog, item `arch-2` ("the same concurrent-`max`-plus-serial-remainder shape is written as four separate normative formulas"). Specified by `SPEC-20260819T100451Z-01da`.
- **Lineage:** Follows **ADR-0012 — The nested viability gate's cost model punishes slicing in three places** → **ADR-0014 — The nested cost model prices an integration sub-lane it can never read** → **ADR-0016 — The flat/outer cost model never charges the top-level integration lane**. Those three each corrected *the same defect at a different depth*: ADR-0012 established that an integration slice is serial and is **added** to the concurrent `max` rather than folded into it; ADR-0014 made the sub-lane slice a first-class digest field so the term became reachable; ADR-0016 applied the identical shape to the run's own integration lane. This ADR does not correct a fourth instance — it removes the surface on which a fourth instance could appear, by stating the shape **once** over an arbitrary slice set and deriving each named quantity from it. It changes **no figure**.

## Context

By the end of ADR-0016 the same sentence — *the concurrent `max` over the non-integration members,
plus the declared integration slice's task count* — was written as **four** separate normative
statements in `references/config.md`: `span(L)` for a split lane, `span_max` over the run's lane set,
`M_flat`'s span term, and the baseline table's viable-row `span_base`. A fifth artifact existed only
because two of those were written separately: a fenced derivation block

```
span_base = M + X          span_max = S + X          g = (M + X) − (S + X) = M − S
```

whose entire content was the observation that two independently-written formulas happened to share a
term. Alongside it, the exclusion of the integration slice from the two work-concentration conditions
was written as **three** near-verbatim blockquotes, each carrying its own copy of the same two worked
counter-examples.

The cost of that shape is not verbosity. It is that **pricing an integration slice was a four-site
edit whose four sites had to move in agreement** — and the observed history is that they did not.
ADR-0012 moved the sub-lane site; ADR-0014 made it readable; ADR-0016 found the top-level sites still
unmoved, two ADRs later. Each was a real defect, each shipped, and each was the *same* defect. A
fourth level does not exist to be got wrong (see the depth cap, restated below), but a fourth *site*
could be introduced by any future edit, and the surface that made three misses possible was still
present.

ADR-0016 §3 had to **mandate** that the exclusion apply "at both evaluation sites or at neither".
That mandate is a symptom: it is only statable as a rule because the rule was written twice, once per
site. Stated over the slice set instead, the asymmetry it forbids is not expressible.

## Decision

### 1. One span rule, stated once, over an arbitrary slice set

`references/config.md` → *The makespan model* states, as lead text before any quantity that
references it, for any slice set `P` with the one integration slice `i(P)` that set declares:

```
span(P) = max over the non-integration members m of P of span(m)   +   tasks(i(P))
```

with two base cases: a **leaf** — a slice not itself split — has `span(leaf) = tasks(leaf)`, and a
declared `integration: none` gives `tasks(none) = 0`.

### 2. The four formulas become four applications of the rule

Each keeps its existing name and role, and none re-expands the shape:

- **`span(L)`** — the rule applied to lane `L`: over that lane's sub-lane set with `i(L)` the split's
  declared `integration` slice when `L` is split; the **leaf base case** when it is not.
- **`span_max`** — the rule applied to the **run's lane set**, with `i(run)` the top-level
  integration lane. Each lane enters at its own `span(L)`, so an adopted sub-split is already
  reflected.
- **viable-flat `span_base`** — the rule applied to the run's lane set with **every lane unsplit**.
- **`M_flat`** — references `span_base` **by name**, plus `A`, plus `J`, plus the parent contract's
  interface points.

### 3. `T` and `M_seq` are outside the rule, and say so where they are defined

`T` is a **sum** over every lane, the integration lane counted in full alongside the others. An `off`
run forms no slice set: there is no `max` and no serial remainder to separate, because it implements
the integration work one task at a time (ADR-0016 §2). The non-viable baseline row carries this
explicitly, so a reader cannot apply the rule to the sequential baseline.

### 4. The cancellation identity is compressed to one sentence

The fenced derivation block is **replaced**, not deleted. `span_base` and `span_max` are the *same
function applied to two slice sets that declare the identical `i(run)`*, differing only in whether
each lane enters at its leaf `tasks(L)` or at its post-adoption `span(L)`; and `X = tasks(i(run))` is
a run constant invariant under adoption (decision 5(a) below). The `+ X` term is therefore common to
both and cancels **by construction**, leaving **the cancellation identity** `g = M − S`. The identity
and its name survive; only the block that derived it from two separately-written formulas is gone.

The sequential-baseline half survives unabridged: there `span_base` is `T`, a sum that already counts
the integration work as ordinary work, so nothing cancels and `g = T − (S + X)`.

### 5. Two claims the rule does **not** subsume survive as independent statements

- **(a) The top-level integration lane is never a sub-split candidate** (ADR-0016 §4), which is what
  makes `tasks(i(run))` a run constant and the cancellation exact. The generic rule says nothing
  about which slices are candidates.
- **(b) The run has exactly two depths** — the lane set, and one split lane's sub-lane set. Steps 2s
  and 3s dispatch no third, and no slice set beyond those two is ever formed. The generality of `P`
  is a **statement economy, not a capability claim**: it says the same arithmetic would hold at any
  depth, never that any depth is on offer. The depth cap's own reasoning stays where it is made,
  under `parallelism`, and is not repeated.

### 6. The exclusion prose is partially collapsed — generalized first, then merged

The canonical statement, at the deferral site, is now generic: **both conditions exclude the declared
integration slice of whatever slice set they are evaluated over**, because they measure concurrency
and it has none. It names both instantiations, carries the only surviving worked counter-examples
(`{backend: 20, integration: 4}` and `{a: 3, b: 3, integration: 18}`), the "these two conditions only"
scope limit including the `70%` denominator, and the `integration: none` reassurance — each stated
once.

The other two sites keep a **one-line pointer that names, in that site's own vocabulary, what is
excluded there** — the split's declared `integration` slice at *Per-sub-lane re-application*, the
run's top-level integration lane at *Leaf-level re-application* — and that it still counts in full
toward that site's totals. **A bare cross-reference was rejected**: this is agent-read normative
prose, and a reader landing mid-document must learn *what* is excluded without scrolling. What is
removed is the duplicated worked counter-examples, which buy a mid-document reader nothing the
one-line effect statement does not.

The collapse is deliberately **partial**. Brevity is not the objective; removing duplication that
must move in agreement is.

## What this supersedes

Only **ADR-0016's derivation framing** — not one of its decisions and not one of its figures:

- **The `g`/`c` interaction — derived, not asserted**, specifically the `span_base = M + X` /
  `span_max = S + X` presentation. That derivation treated the shared `+ X` as an observation about
  two separately-written formulas. Under one rule it is a consequence to read off, so it is restated
  as such. The result — `g = M − S`, cancelling because `X` is a run constant — is **unchanged**.
- **§3's assertion that the exclusion applies at both evaluation sites or at neither.** Superseded as
  a *mandate* and retained as a *consequence*: stated over the slice set, the asymmetry it forbade is
  unstatable, so the rule no longer needs asserting. The failure it guards against is retained in
  full at the canonical site.

ADR-0016's `Status:` remains **Accepted**, and it carries a forward pointer here.

## What stands

- **Every ADR-0016 figure**, without exception. This is a reframing, not a repricing.
- **ADR-0016 §1** (the top-level `integration` field is first-class, strictly shaped, and a split
  omitting it is rejected outright rather than read as zero), **§2** (the term enters `span_base`,
  `span_max`, and `M_flat` and nothing else; `M_nested` needs no separate term; `T` and `M_seq` are
  unchanged), **§4** (never a sub-split candidate), **§5** (Step 2p.2's flat print block divides by
  `span_base` in expanded form), **§6** (the parent contract's integration-lane region is bound, not
  authored), and **§7** (normative detail lives in `references/config.md`).
- **The three-branch old-model comparison** (`X ≤ S ≤ M`, `S < X < M`, `X ≥ M ≥ S`) and the note that
  the middle branch is the one an implementer is most likely to omit. It stays recorded in ADR-0016
  and is deliberately **not** re-inlined into `references/config.md`.
- **The `min(S, X)` sequential-baseline result** — that the corrected `g = T − (S + X)` differs from
  the uncorrected `g = T − max(S, X)` by exactly `(S + X) − max(S, X) = min(S, X)`, the optimistic
  direction the original finding named. It lives here and in ADR-0016; `references/config.md` states
  the surviving sequential sentence `g = T − (S + X)` and deliberately carries **no** `min(S, X)`
  claim, because adding one would be new normative content rather than a compression.
- **ADR-0012, ADR-0013, and ADR-0014, unamended.** **ADR-0013 explicitly so**: the per-lane
  inner-join barrier and its `J` (not `k × J`) charge are untouched, and the `k = 2` worked example
  that pins them was re-derived figure by figure and is unchanged.
- **Every heading in `references/config.md`.** Cross-references resolve by title, so a renamed
  heading would break them silently. None was renamed, removed, added, or re-levelled.
- **Step 2p.2's *flat* print-block template strings**, byte for byte. Their expanded on-screen form
  is ADR-0016 §5's deliberate legibility decision, not a fifth normative statement of the shape —
  and §5's own heading (*"Step 2p.2's **flat** print block divides by `span_base`"*) scopes that
  guarantee to the flat block. The **nested** block is **not** covered by it. Its `span_max` line was
  still carrying the superseded pre-ADR-0016 shape, so it was **corrected** rather than exempted — it
  now ends `+ integration({n})`, making the block's decomposition equal its own stated result
  (`CR-20260819T104419Z-fc4f` MF-3). Every other line of the nested block stands byte for byte.

## Deliberate divergences

Recorded rather than left silently different, per the repository's `mirror machinery` convention:

- **The generic rule does not subsume the never-a-sub-split-candidate claim.** It is a statement about
  *arithmetic over a slice set*, not about which slices are candidates; the run-constancy of
  `tasks(i(run))` — on which the cancellation identity rests — comes from decision 5(a) alone.
- **The generic rule does not subsume the depth cap.** Its generality over `P` is a statement
  economy. Reading it as licence to nest deeper is precisely the misreading decision 5(b) exists to
  block, and an editor who wants a third depth must defeat the cap's own argument where that argument
  is made.

## Consequences

- **No figure moves.** Every numeral in all five worked examples is identical, pinned by two
  independent checks: a mechanical no-numeral-drift diff over the five subsections (identical numeral
  sequences; four of the five bodies byte-identical) **and** a full hand re-derivation of each from
  the rewritten rule. The prior green did not carry over, because the rewrite changed the very text
  the examples are checked against.
- **The reconciliation identity is unchanged.** `M_flat − M_nested = g − c` still holds on both
  baselines, and still carries ADR-0016's warning that a defect in this term moves both makespans by
  the same amount — so a passing reconciliation is not by itself evidence the model is right.
- **The depth cap is now explicit at the arithmetic**, not only under `parallelism`. It was
  previously implied by writing the formulas at exactly two named levels; making the rule generic
  removed that implication, so the cap is stated where the generality is introduced.
- **Integration-lane pricing is now a one-site edit of the normative arithmetic.** A future change to
  how a serial remainder is charged edits the rule; the named quantities follow automatically. No set
  of *normative* statements has to be moved in agreement any more — that is the specific failure mode
  ADR-0012 → ADR-0014 → ADR-0016 exhibited three times. The bound is load-bearing and not a formality,
  and `references/config.md` states it as a **universal classification** rather than as a census:
  every other site that writes the shape out summand by summand is an **application, an illustration,
  or a display** of the rule, never an independent definition of it. That classification is what a
  later editor checks a site against, and it stays true as sites are added or removed — which is the
  property a list does not have. Sites of that kind **today** include, for example, the normative
  post-adoption `span_max` fence under *Marginal-gain rule*, an **application** and named as one by
  the prose that governs it; the sub-lane micro-examples that illustrate the rule; and `SKILL.md` →
  Step 2p.2's print blocks, which ADR-0016 §5 records as a deliberate legibility **display** decision.
  §5's heading scopes it to the **flat** block and its body reaches no further, so the **nested**
  block's `span_max` line, which had been left carrying the superseded pre-ADR-0016 shape, was
  **fixed rather than exempted** (`CR-20260819T104419Z-fc4f` MF-3). An earlier revision of this bullet
  enumerated those sites as a **closed** set; that enumeration was false in the shipped tree — it
  omitted the `span_max` fence this same change had created — and is replaced here, because a closed
  census must be re-audited against the whole document on every edit touching the shape, which is
  exactly the maintenance burden this ADR claims to have retired (`CR-20260819T112837Z-9e42` MF-1).
  What a later editor no longer has to do is keep several normative formulas in agreement; what they
  must still do is carry a change by hand into every site the classification covers.
- **The "three depths of one defect" observation is the reason this ADR exists.** Three ADRs, each
  correcting the same shape at a different site, is not three unrelated bugs — it is one duplicated
  statement being repaired one copy at a time. This ADR pre-empts a fourth rather than waiting to
  file it.
- **No behavioural or executable test is emitted, and none is reachable.** `parallelism` defaults to
  `off` in this repository and the `full` level with `k >= 2` is unreachable here, so nothing would
  execute the span rule. Verification is **structural** (headings and cross-references resolve; the
  rule stated once; the exclusion once plus two pointers; overlay-anchor counts hold; the
  distribution regenerates clean) and **arithmetic** (no-numeral-drift plus hand re-derivation).
- **Not addressed here:** any change to the digest contract, to the `0.25` interface-point
  conversion, to the `70%` threshold, to the aggregate `I > T` guard, or to the `max_parallel_lanes`
  ceiling. Moving any of those would have meant the work was mis-scoped.
