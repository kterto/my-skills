# Orchestrator — Parallel Cost Model Reference

**The inner viability gate: how a `full` run decides whether slicing a lane into sub-lanes pays.**
It is here rather than in `config.md` because it applies only when `parallelism` resolves to `full`
and a lane is a candidate for sub-splitting — while accounting for more than half of that file. A run
that resolves `off` never reads it; every other level reads at least *The makespan model*, which Step
2p.2 prints `span_base` from.

Read it whole before adopting a split: the gate is a conjunction, and a candidate that clears one
condition and fails another is not a marginal case, it is a rejection.

### The inner viability gate — makespan and marginal gain (`full` only)

This is the normative definition of every number the `full` level's gate computes and every number Step 2p prints. `references/parallel.md` → Step 2p **applies** these rules and is not their normative home: where Step 2p writes one of them out expanded rather than referencing it by name — its two Step 2p.2 print blocks — that is ADR-0016 §5's deliberate legibility decision, a **display** of the arithmetic defined here and not a second definition of it. A change to the arithmetic is made here and carried into those blocks by hand.

#### The makespan model

**Everything in this gate is denominated in task-equivalents** — one unit for both sides of the comparison, so that no executing agent has to invent a conversion of its own and two identical runs cannot adopt different nested plans. Three fixed conversions, stated here **before any formula below uses them**:

| Quantity | Worth | Default |
| -------- | ----- | ------- |
| one **contract-authoring architect pass** (Step 2c or Step 2s) | `A` task-equivalents | default `A = 2` |
| one **join pass** (Step 3j or Step 3s) | `J` task-equivalents | default `J = 2` |
| one **interface point** | `0.25` task-equivalents | one reconciliation unit |

**Why an interface point is a quarter of a task and not a whole one.** It is a **row in a table**, written during an architect pass that this same table already charges separately as `A`. Pricing it at parity with *implementing* a task double-counts the authoring and — because `I` is the only overhead term that grows with slice count in a `k = 1` plan — makes fine-grained splits arithmetically self-defeating regardless of what they buy. `0.25` prices the marginal reconciliation work a row imposes at the join, which is what the term is for. Figures therefore carry `.25` increments; that is expected, and is preferred to rescaling `A` and `J` merely to keep integers. (ADR-0012.)

`span`, `makespan`, `M_flat`, `M_nested`, every marginal gain, and every cost are computed in this single unit, so the adoption test `g > c` is **ordinary arithmetic** over two numbers of the same kind. Print both `{g}` and `{c}` with the unit named — `gain 4 task-equivalents does not exceed cost 5 task-equivalents` — never as two bare numbers.

**One span rule, stated once here and applied everywhere below.** Every critical-path term this gate computes is the **same function of a slice set**. For any slice set `P` — a set of slices that run concurrently, together with the **one integration slice** `i(P)` that set declares:

```
span(P) = max over the non-integration members m of P of span(m)   +   tasks(i(P))
```

with two base cases: a **leaf** — a slice that is not itself split — has `span(leaf) = tasks(leaf)`, and a declared `integration: none` means `i(P)` is empty, with `tasks(none) = 0`. (`tasks(X)` is defined in the first bullet below.)

The `max` is the concurrent part; the `+ tasks(i(P))` is the **serial remainder**. The non-integration members of `P` run concurrently, and the declared integration slice does not: it runs after all of them, because it is the one slice that legitimately touches the others' outputs, and modelling it inside the `max` would model an execution order the skill forbids — **optimistically**, understating the critical path by exactly the serial work.

**Every span quantity below is this rule applied to a named slice set**: `span(L)` at either level, `span_max`, and the viable baseline's `span_base`. Each is **defined** below by naming the rule and the slice set it runs over, rather than by re-expanding the rule into a `max` and a `+ tasks(…)` of its own — a claim about the **normative definitions** of those quantities, and about those only, not about every line that later writes one of them out. Defining the shape once is what makes pricing an integration slice a **one-site edit of the normative arithmetic**, instead of separately-maintained *normative* statements that a later change has to move in agreement. That bound is deliberate, and a later editor must read it as a bound. **Every other site that writes the shape out summand by summand is an application, an illustration, or a display of this rule — never an independent definition of it.** That classification is universal, and it is the test to apply to any such site, one standing here today or one added tomorrow: a line that writes a concurrent `max` and a serial `+ tasks(…)` together is deriving its value from the rule above, and the rule above is where a change to it is made. Sites doing that **today** include, for example, the post-adoption `span_max` fence under *Marginal-gain rule* below — a normative **application**, written expanded because the delta is what that section is about, and named as an application by the prose that governs it; the sub-lane micro-examples that illustrate the rule, beside that fence and in the worked examples; and `references/parallel.md` → Step 2p.2's **print blocks**, where the shape is expanded so the integration slice's contribution is legible on screen — a display decision recorded in ADR-0016 §5, which is why those blocks restate rather than reference. Those examples are illustrative of the classification, not a census of the tree, and are not maintained as one: the classification holds whether or not they are complete. What a change to how a serial remainder is charged still requires is that it be made here **and then carried by hand into every site that writes the shape out** — the classification is what tells an editor which sites those are, without anyone having had to enumerate them in advance. Two quantities are deliberately **not** applications of the rule and say so where they are defined: `T` and `M_seq`.

> **The generality of `P` is a statement economy, not a capability claim.** The run has **exactly two** depths — the lane set, and one split lane's sub-lane set — and that cap is hard, with its reasoning stated under `parallelism` above (*Nesting is capped at depth 2*). Steps 2s and 3s dispatch no third level, and no slice set other than those two is ever formed. Stating the rule over an arbitrary `P` claims only that the same arithmetic would hold at any depth; it does **not** license one, and an editor reading the generality as permission to nest deeper must defeat the depth cap's own argument first — where that argument is made, not here. (ADR-0017.)

- **`tasks(X)`** — the estimated task count of leaf or lane `X`, from the Step 2p digest. One task **is** one task-equivalent by definition; that is the anchor the other two conversions are stated against.
- **`span(L)`** — **the span rule applied to lane `L`.** For a **split** lane, the slice set is that lane's **sub-lane set** and `i(L)` is that split's declared `integration` slice. For an **unsplit** lane there is no slice set: `L` is a leaf, so the base case applies and `span(L) = tasks(L)`.

  > **`tasks(integration)` is read from the split's declared `integration` field, and a declared `none` is `0`.** The field is a **first-class part of the digest**, required of every proposed split and validated with the same strict shape as any other slice (`references/parallel.md` → Step 2p.1): the literal `none`, or a named slice carrying mapped requirement IDs, candidate globs, and an **integer** task count. This is what makes the term reachable at all. While the split declared its integration work only as prose, the acceptance rule discarded it as *"prose outside those fields"* and `tasks(integration)` was **always** `0` — so `span(L)` collapsed to the concurrent `max`, `g = span_base − span_max` was overstated by exactly the serial work, and `g > c` adopted candidates whose real critical path was longer than the one they were priced on. A split that **omits** the field is rejected outright rather than defaulted to `0`, because "not declared" and "declared none" are different claims and only the second is safe to price. Integration-slice globs satisfy the same **containment** rule as ordinary sub-lane globs (*Containment*, above), and the slice is excluded from the two work-concentration conditions (*Per-sub-lane re-application of the existing viability conditions*, below) — but from **those two conditions only**: it counts in full here, and in full toward `T`. (ADR-0014, following ADR-0012.)

  > **The integration sub-lane is serial and must be modelled as serial.** `references/parallel.md` → Step 3s dispatches it *"through a single sequential coder invocation — after its sibling sub-lanes are DONE, never concurrently with them"*, because it is the one sub-lane that legitimately touches several sub-lanes' outputs. A `max` taken over all sub-lanes including that one would model an execution order the skill forbids, and would do so **optimistically** — inflating the very figure option 3 of the `ask` ladder shows the user. Unlike the interface-point and comparand defects, this one overstates the **gain** rather than understating the cost; it is the same class of error and is corrected in the same direction: the model follows the machine. (ADR-0012.)
- **`tasks(integration)` at the top level — the run's own integration lane** — read from the **lane-level** split's declared `integration` field, with a declared `none` read as `0`. The field is a first-class part of the lane-level digest, required of every lane-level split and validated with the same strict shape as any other slice (`references/parallel.md` → Step 2p.1): the literal `none`, or a named slice carrying mapped requirement IDs, candidate globs, and an **integer** task count. A lane-level split that **omits** the field is **rejected outright** rather than defaulted to `0` — "not declared" and "declared none" are different claims, and only the second is safe to price. The declared slice is a slice in its own right: its requirement IDs and globs are **disjoint from every lane's**, it does **not** also appear as a lane row, and its globs satisfy the full *Owned-glob rejection* list (`lanes` → *Owned-glob rejection*, above) — with containment reading against the repository root rather than a parent lane, since the top-level lane has no containment parent. (ADR-0016, extending ADR-0014 one level up.)

  > **The top-level integration lane is serial and must be modelled as serial — the same defect, one level up.** `references/parallel.md` → Step 3j runs it at the outer join after **every other lane is DONE, never concurrently with them**, because it is the one lane that legitimately touches multiple lanes' outputs; and `references/parallel.md` → Step 3L dispatches **no** integration lane in the concurrent wave, at either level. A `max` taken over all lanes including that one therefore models an execution order the skill forbids, and does so **optimistically** — understating the critical path by exactly the serial work, in the same direction and for the same reason as the sub-lane case above. It counts in **full** in `span_base`, `span_max`, `M_flat`, and `T`; it is excluded from the two work-concentration conditions and from **those conditions only** (*The two work-concentration conditions are evaluated at leaf granularity* and *Leaf-level re-application*, both below). (ADR-0016.)

  > **The top-level integration lane is never a sub-split candidate**, so `span(integration) = tasks(integration)` is a **run constant** — `references/parallel.md` → Step 2p.3n evaluates candidates over the non-integration lanes only. That constancy is load-bearing rather than incidental: the same `+ tasks(integration)` term sits in **both** `span_base` and `span_max`, so on a viable flat baseline it cancels identically in `g = span_base − span_max`, and pricing the lane corrects the makespan figures without perturbing any marginal gain. This is a **deliberate divergence** from the sub-lane shape, where an integration slice belongs to a lane that was itself a split candidate; it is recorded rather than left silently different. (ADR-0016.)
- **`span_max`** — **the span rule applied to the run's lane set**, whose declared integration slice `i(run)` is the run's top-level integration lane — the one the run waits for after every other lane is DONE. Each lane enters it at its own `span(L)`, so an adopted sub-split is already reflected. This is the bare critical-path term, carrying **no** overhead. It is the only term a sub-split actually shortens, and therefore the term the marginal gain is measured over.
- **`makespan`** — `span_max`, **plus the overhead term defined immediately below**. The overhead is never dropped from the number: the whole point of the gate is that the cost is visible, not hidden. Keeping `span_max` and `makespan` as two named quantities is what lets the gain be measured over one and the cost over the other, so that no task-equivalent is counted on both sides of the same comparison.
- **`M_flat`** — the makespan with **no** lane split (the `lanes` plan): the flat **`span_base`**, named and defined in *The baseline* immediately below, plus `A` for the single parent contract, plus `J` for the single outer join, plus the parent contract's interface-point count. The span term is referenced by name here and nowhere re-expanded.
- **`M_seq`** — the sequential makespan (the `off` plan): the run's **total** task count `T` = sum over lanes of `tasks(L)`, **counting the top-level integration lane in full** alongside every other lane, with **no** overhead term at all. **`T` is a sum, not an application of the span rule** — an `off` run forms no slice set at all, so there is no `max` and no serial remainder to separate. An `off` run authors no contract and runs no join, so it has nothing to charge — and it implements the integration work like any other work, one task at a time, so **`T` and therefore `M_seq` are unchanged by this correction**. Only the two concurrent baselines were ever wrong. (ADR-0016 §2.)
- **`M_nested`** — the makespan under the **adopted** nested plan, per the overhead split below. It needs **no** separate top-level integration term of its own: it is built on `span_max`, which already carries `+ tasks(integration)`. Adding one here would charge the same serial work twice.

**The baseline — what the nested plan is priced against.** The gate always prices a candidate against **the plan that would run if it adopted nothing**, and which plan that is follows from the flat verdict (*The two work-concentration conditions*, above):

| Flat verdict | Baseline | `span_base` (the baseline's critical-path term) | Baseline overhead |
| ------------ | -------- | --------------------------------------------- | ----------------- |
| viable | `M_flat` | the span rule over the run's lane set with **every lane unsplit** — each lane at its leaf `span` | `A + J +` parent interface points |
| non-viable | `M_seq` | `T`, the total task count (integration lane included in full) — **a sum, not the span rule** | `0` |

**The two rows are different kinds of quantity, and the span rule applies to one of them only.** The viable row's `span_base` is the rule over a slice set, so each lane contributes its `span` and the top-level integration lane is charged **after** the `max`. The non-viable row's `span_base` is `T`, a **sum** over every lane — the integration lane among them, counted like any other work, with nothing held back to the end. `T` and `M_seq` are therefore **outside** the rule and the rule is never applied to them: an `off` run forms no slice set and implements the integration work one task at a time, which is exactly why pricing that lane moved the two concurrent baselines and left the sequential one untouched. (ADR-0016 §2.)

**The `+ tasks(i(run))` term appears in the viable row's `span_base` and in `span_max`, and under the one rule that is a consequence to read off rather than a coincidence to check.** Writing `X = tasks(i(run))`, `M` for the `max` of `tasks(L)` over the non-integration lanes, and `S` for the `max` of `span(L)` over those same lanes: because `span_base` and `span_max` are **the same function applied to two slice sets that declare the identical `i(run)`** — differing only in whether each lane enters at its leaf `tasks(L)` or at its post-adoption `span(L)` — and because `X` is a **run constant** invariant under adoption (the top-level integration lane is never a sub-split candidate, so nothing an adoption does can move it; *The makespan model*, above), the `+ X` term is common to both and cancels **by construction** in `g = span_base − span_max`, leaving **the cancellation identity** `g = M − S`. That is what makes pricing the lane a correction to the *makespan figures* rather than a perturbation of every marginal gain.

On a **sequential** baseline there is nothing to cancel — `span_base` is `T`, a sum that already counts the integration work as ordinary work rather than holding it back to the end — so `g = T − (S + X)` there.

The `M_flat − M_nested = g − c` reconciliation holds on both baselines, unchanged. Be explicit about what it is worth as evidence: a defect in this term moves **both** makespans by the same amount, so the reconciliation goes on balancing while both figures are wrong — **a passing reconciliation is not by itself evidence the model is right.** (ADR-0016; the old-model comparison and the direction each figure moved are recorded there, not re-inlined here.)

**Pricing against a plan that cannot run is the defect this table exists to prevent — in both directions.** Pricing a nested plan against `M_flat` when the flat split was ruled non-viable would refund it the `A + J` the flat plan pays — 4 task-equivalents at the defaults — quoting a candidate as cheaper than an alternative the run does not have; and it would measure the gain from a critical path (`max` over lanes) that no plan on offer achieves. Conversely, pricing against `M_seq` whenever flat *is* viable would make every nested plan look good regardless of what it buys over the flat split the user could have had for free — the failure this model names two paragraphs below, under *Never print a wall-clock ETA*.

The consequence for the cost side is mechanical and is stated once, in *The cost side*: with a sequential baseline **the first adoption carries the whole nested overhead**, because none of it — not the parent contract, not the outer join — exists in the baseline.

**The overhead term is split by level, and each level is concurrent for its own reason.** Both levels cost `slowest-of-k`, so they no longer have opposing shapes — but they are still charged as **two** terms, because *why* each one is `slowest-of-k` differs at each level. Reading them as interchangeable is how a later edit would break one while "simplifying" it into the other:

- **Contract-authoring passes at one level are issued concurrently.** Step 2s spawns its `k` sub-contract architects together, so `k` of them cost `slowest-of-k` — which, under the equal-effort assumption, is `A`, not the sum of `k`. The concurrency here is a property of the **dispatch**: the architects are spawned in one wave.
- **Inner-join passes overlap, because each lane's join is gated only on its own sub-lanes.** Step 3s begins a lane's inner join as soon as **that lane's own** sub-lanes are DONE, concurrently with leaves still running in other lanes, so the `k` inner joins overlap rather than queueing behind one global leaf barrier — and `k` of them cost `slowest-of-k`, which under the equal-effort assumption is `J`. The concurrency here is a property of the **barrier**, not the dispatch: the joins are never spawned together and do not start together; nothing serializes them. (`references/parallel.md` → Step 3s; ADR-0013.)

For a nested plan adopting `k` lanes:

```
M_nested = span_max
         + A        parent contract          (Step 2c)
         + A        k sub-contracts          (Step 2s — concurrent, so slowest-of-k)
         + J        k inner joins            (Step 3s — per-lane barrier, so slowest-of-k)
         + J        the outer join           (Step 3j)
         + I        aggregate interface points, parent contract plus every adopted
                    sub-contract (0.25 task-equivalents each — the same reconciliation
                    units the cost side charges, so the two sides stay on one account)
```

Charging the two levels as one undifferentiated overhead makes `M_nested` optimistic by roughly `(k − 1) × J`. Since `M_nested` is exactly the number option 3 of the `ask` ladder shows the user, and since `full`'s whole claim is wall-clock, a systematically optimistic figure is a defect in a decision input — not a rounding concern.

> **Recorded history — the superseded serialized inner-join charge (ADR-0012 era; superseded by ADR-0013).** Under the barrier discipline in force when ADR-0012 was written, Step 3s waited on a **global** leaf barrier and then reconciled each sub-split lane in turn, so every one of the `k` inner joins sat on the critical path. The level was therefore charged **once per adopted lane, serialized behind the leaf barrier** — an aggregate `(k − 1) × J` above what the concurrent reading charges. **That charge was correct for the machine it described**, and is kept on record rather than deleted: charging `slowest-of-k` against a Step 3s that genuinely serialized would have priced a cost the implementation did not have, which is the alternative ADR-0013 rejects on sight. ADR-0013 supersedes it by **changing the machine** — the per-lane barrier is what makes `slowest-of-k` true — never by re-reading the same machine more favourably. That is the whole reason the barrier and the charge had to move in one change: either half alone puts the gate and the ladder back on two accounts.

> **Assumption (state it inline every single time a number derived from it is shown):** leaves run concurrently, **task counts proxy wall-clock effort equally**, *and* the three conversions above hold — an architect pass, a join pass, and an interface point are each worth the stated number of tasks. The conversion is the load-bearing half of this disclosure: concurrency alone says nothing about how a *pass* or an *interface point* becomes a number, and it is the unstated conversion, not the concurrency, that would let two identical runs adopt different plans.

**Never print a wall-clock ETA**, at either level. Task counts are the honest, checkable proxy; minutes would be fabricated precision. `full` is priced against `M_flat` **whenever the flat plan is on offer** — pricing against sequential there would make every nested plan look good regardless of what it actually buys over the flat split the user could have had for free. The single exception is a **non-viable flat verdict**, where the flat plan is not on offer at all and `M_seq` is the only honest baseline (*The baseline*, above). The rule is one rule in both cases: price against the plan that would otherwise run.

#### Marginal-gain rule (the critical-path test)

A candidate sub-split of lane `L` is evaluated by the reduction it produces in the **run's** critical-path term `span_max` — **not** in `L`'s own task count.

Splitting a lane that is **not** the current critical path yields a **marginal gain of zero**: the run still waits for the largest lane, so the split buys no wall-clock while paying a full contract. That is a property of the gain, not a separate rejection rule — a gain of zero can never exceed a strictly positive cost, so the single adoption test below already rejects it, and it prints the same `gain 0` line every other shortfall prints.

Formally, splitting the critical lane `L` lowers `span_max` only to:

```
max(second_largest_span, span(L after the split)) + tasks(i(run))
```

and the **marginal gain** `g` is the reduction in `span_max` — the current `span_max` minus that value. This is the span rule (*The makespan model*) applied to the post-adoption lane set: the same `i(run)` the run declared, so the serial remainder is carried here exactly as it is in `span_base` and in every other `span_max`. **`second_largest_span` is that rule's concurrent term over the *rest* of the set**: the maximum of `span(L)` taken over the post-adoption lane set's **other non-integration lanes** — every lane but the one being split, with the run's own integration lane excluded, because that lane *is* `i(run)` and is already charged once by the `+ tasks(i(run))` term sitting outside the `max`. Ranking **all** lanes here instead would double-charge `i(run)` whenever the integration lane ranks second, adding its task count inside the `max` as well as after it — the mirror of the optimistic error the serial remainder exists to prevent, wrong in the opposite direction and equally a reason the gain would not be the gain.

**`tasks(i(run))` is a run constant, and that is what makes the shorter form correct as a *delta* and wrong as a *span*.** The top-level integration lane is never a sub-split candidate (*The makespan model*), so no adoption can move it: the term sits in both the minuend and the subtrahend and cancels in `g`, which is why dropping it from **both** sides leaves the marginal gain unchanged. It does not leave the **value above** unchanged. That value is a `span_max` — the run's critical path after the adoption, the number the nested block prints and the `ask` ladder quotes for the nested plan — and without `+ tasks(i(run))` it understates that critical path by exactly the serial work, in the same direction and for the same reason as the two defects *The makespan model* records above. Write the delta by subtracting two spans, never by subtracting a span from a bare `max`.

**The second term is the split lane's `span(L)`, not its largest sub-lane.** `span(L)` for a split lane is `max` over its **concurrent** sub-lanes **plus** its integration sub-lane (*The makespan model*), and that whole quantity is what the run waits for — so substituting `largest_sublane_of_L` silently drops the serialized integration work from the gain side while `span(L)` carries it everywhere else. Concretely: lane `L` = 16 split into `{5, 5}` plus an integration sub-lane of 6, with a second lane at 10. The real post-split critical path is `max(10, 5 + 6)` = **11**; `largest_sublane_of_L` yields `max(10, 5)` = **10**, overstating `g` by 1 and adopting a candidate that may not clear its true cost. The two terms are also **different kinds of quantity** — one is a run-level span over lanes, the other a sub-lane's bare task count — and mixing them inside one `max` is what let the error hide.

**Before the first adoption, "the current `span_max`" is `span_base`** (*The makespan model* → *The baseline*), taken from there **by name** and not re-expanded here — the span rule over the run's lane set with **every lane unsplit** under a viable flat verdict, and `T` under a non-viable one. After any adoption it is the recomputed `span_max` of the plan adopted so far, per *Greedy, recomputed adoption*. This is the whole of the baseline's effect on the gain side, and it is what makes the first adoption on a sequential baseline correctly credited with **both** things it buys — the lane-level concurrency the flat plan could not deliver on its own, and the sub-split itself. Under a sequential baseline the *zero-gain* case above therefore does not arise for the first adoption: with nothing running concurrently yet, every viable split strictly lowers the span. It reappears for every adoption after the first, unchanged.

It is deliberately **not** the reduction in `makespan`. `makespan` is defined above to always carry the overhead term, and the overhead a candidate adds is exactly what the cost side charges as `c`. Measuring `g` over `makespan` as well would net that overhead against itself inside one comparison, so a candidate would be billed for it on the right-hand side and silently refunded it on the left. `g` is the span reduction; `c` is the overhead increase; `g > c` weighs each of them once. This is also why the after-value above is stated as a `span_max`, not as a `makespan`: it carries no overhead term, and naming it a makespan is what previously put the two sides of the test on different accounts.

#### The cost side

A candidate's cost `c` is the **marginal makespan delta** it causes **against the baseline's overhead** (*The makespan model* → *The baseline*): the amount its adoption adds to `M_nested`'s overhead term over and above what the baseline plan already pays, in the **same task-equivalents** the gain is computed in. Deriving `c` from `M_nested` rather than listing charges assembled independently of it is what keeps the gate and the ladder on **one account** — every task-equivalent the user sees inside option 3's figure is a task-equivalent the gate charged, and every task-equivalent the gate charged is visible in that figure.

For the candidate under evaluation:

- one **inner-join pass** (Step 3s) — `J` task-equivalents, charged on the **first** adoption only. Step 3s's per-lane barrier begins a lane's inner join as soon as that lane's own sub-lanes are DONE, so the `k` inner joins overlap and that whole level costs `slowest-of-k` = `J` no matter how many lanes are adopted — the same claim `M_nested` is built on. Charging `J` once per candidate would bill an aggregate of `k` full join passes for a level `M_nested` prices at `J`, which is precisely how the gate and the ladder drifted onto two accounts — the identical failure the sub-contract architect bullet below already names, one level up. The first adopted candidate is what brings the Step 3s level into existence, so it carries the charge; every later one rides it at no extra cost. (ADR-0013.)
- the sub-contract's **interface-point count** — 0.25 task-equivalents each, as reconciliation units, matching the `I` term in `M_nested`;
- the **sub-contract architect pass** (Step 2s) — `A` task-equivalents, charged on the **first** adoption only. Step 2s spawns its `k` sub-contract architects concurrently, so that whole level costs `slowest-of-k` = `A` no matter how many lanes are adopted — the same claim `M_nested` is built on. Charging `A` once per candidate would bill `k × A` for a level `M_nested` prices at `A`, which is precisely how the gate and the ladder drifted onto two accounts. The first adopted candidate is what brings the Step 2s level into existence, so it carries the charge; every later one rides it at no extra cost.

> **Why there is no separate barrier charge.** An earlier form of this list carried a fourth item: a further `A` for the architect round-trip the Step 2s barrier imposes on every lane, on the grounds that `full` pays three serial architect round-trips where `lanes` pays two. That is a double-charge of the pass the bullet above already prices. `M_nested` carries `+ A` for Step 2c and `+ A` for Step 2s against `M_flat`'s single `+ A` for Step 2c, so the difference between the two plans **already is** exactly one extra architect round-trip; billing it a second time is what let `c` exceed `g` on candidates whose own `M_nested` was strictly below `M_flat`. The underlying observation is still true and still worth knowing — an unsplit lane's architect does wait on sub-contracts it will never read (see `references/parallel.md` → Step 2L) — but it is an argument for why the Step 2s `A` sits on the critical path at all, not a second charge on top of it.

**Under a sequential baseline the first adoption additionally carries the flat plan's own overhead** — `A` for the parent contract (Step 2c), `J` for the outer join (Step 3j), and the **parent** contract's interface points — because a non-viable flat verdict means none of that exists in the baseline. The list above charges the marginal delta against `M_flat`; when the baseline is `M_seq` the delta is against zero, so those three terms are charged too, once, on the first adoption. Every adoption after the first is charged exactly as it is above: **that sub-contract's interface points alone** — by then the Step 2s and Step 3s levels both exist, and both are `slowest-of-k`.

Concretely, on a sequential baseline the first adoption costs `A + A + J + J + I` — parent contract, sub-contract level, the inner-join level, the outer join, and the aggregate interface points — which is exactly `M_nested`'s whole overhead term for `k = 1`. That is the correct number: it is the entire price of leaving `off`, and it is the price the ladder's option 3 quotes. **This figure is unchanged by ADR-0013**, and necessarily so: at `k = 1` the inner-join level's `slowest-of-k` and its superseded serialized charge are the same quantity.

A sub-split is adopted **only when its marginal gain exceeds that cost**. **Equal is not enough** — a wash means paying contract overhead for zero wall-clock. Both sides are already in task-equivalents, so the test is ordinary arithmetic and needs no conversion at the comparison site.

#### Worked example — the gate verdict and the ladder figure must agree

A **sanity check**, recorded here because an earlier form of this model failed it. Two lanes with task counts `{12, 6}`; the lane-level split declares **`integration: none`**, so the top-level `tasks(integration) = 0`; the candidate splits the 12-lane into sub-lanes `{6, 6}` and likewise declares **`integration: none`**, so that split's `tasks(integration) = 0` too; `k = 1`; defaults `A = 2`, `J = 2`; no interface points on either contract.

| | flat (`lanes`) | nested (candidate adopted) |
| --- | --- | --- |
| `span_max` | `max(12, 6)` = **12** | `max(span(L)=max(6, 6) + 0, 6)` = **6** |
| overhead | `A + J` = **4** | `A` + `A` + `J` + `J` = **8** |
| makespan | `M_flat` = **16** | `M_nested` = **14** |

Gain `g` is the reduction in `span_max`: `12 − 6` = **6**. Cost `c` is the marginal overhead delta: `8 − 4` = **4** — the first adoption's `A`, plus its one inner join's `J`, plus zero interface points. `g > c` (`6 > 4`), so the candidate is **adopted**, and `M_nested` (14) is indeed below `M_flat` (16). Verdict and figure agree.

Under the pre-correction arithmetic they did not. The cost side billed `A` for the sub-contract pass **and** a second `A` for the barrier round-trip, giving `c = 6` against the same `g = 6` — and *"equal is not enough"* rejected the candidate, while the ladder went on printing `M_nested = 14` against `M_flat = 16`, telling the user that the plan the gate had just refused was two task-equivalents cheaper than the one it recommended. A gate and a ladder computed from different overhead accounts can disagree about the same candidate; keeping `c` defined as a delta of `M_nested` is what makes that structurally impossible.

**Re-derived by hand under ADR-0013's concurrent inner-join charge, every figure above is unchanged** — only the notation moved, from `1 × J` to `J`. At `k = 1` the two readings are the same quantity: one adopted lane is one inner join, and slowest-of-one is `J`. `span_max` **6**, nested overhead `A + A + J + J` = **8**, `M_nested` **14** against `M_flat` **16**, `g` **6**, `c` **4**, **adopted**. Re-check this example whenever either side of the model is edited.

#### Worked example — one lane carries all the work (sequential baseline)

The shape the leaf-granularity rule exists for. Lane set `{mobile, backend, web, admin, landing, shared}`; the spec maps **every** requirement to `mobile`, so `tasks(mobile) = 24` and every other lane is `0`. The lane-level split declares **`integration: none`**, so the top-level `tasks(integration) = 0`. The candidate splits `mobile` into `{ui: 8, data: 8, services: 8}` and likewise declares **`integration: none`**, so that split's `tasks(integration) = 0`; `k = 1`; defaults `A = 2`, `J = 2`; the parent contract has **0** interface points (one lane carries work, so there is no cross-lane row to freeze) and the sub-contract has **2**.

Outer gate: conditions 3–6 pass; condition 1 fails — `only 1 lane carries work`. On `lanes` that ends the run. On `full` it is recorded as **flat verdict: non-viable**, so the baseline is `M_seq`.

| | baseline (`off`) | nested (candidate adopted) |
| --- | --- | --- |
| `span_base` / `span_max` | `T` = **24** | `max(8, 8, 8) + 0` = **8** |
| overhead | **0** | `A` + `A` + `J` + `J` + `I((0 + 2) × 0.25)` = **8.5** |
| makespan | `M_seq` = **24** | `M_nested` = **16.5** |

Gain `g` = `24 − 8` = **16**. Cost `c` = `8.5 − 0` = **8.5** — the first adoption on a sequential baseline, so it carries the parent contract, the sub-contract level, its inner join, the outer join, and the aggregate interface points. `g > c` (`16 > 8.5`), so the candidate is **adopted**, and `M_nested` (16.5) is below `M_seq` (24). The leaf-level re-application then passes: **3** leaves carry work (≥ 2), and the largest holds `8/24` = **33%** (≤ 70%).

The run is `full` with a **one-lane parent contract** whose single row carries `—` in `Lane plan ID` and the sub-contract's `PACT` ID in `Sub-contract`. That is a legitimate contract, not a degenerate one — `templates/architect.md` → *Path ownership* states the same exception in the same terms — and the run dispatches 3 leaves, not 1.

Had the sub-split instead come out `{20, 4}`, `span_max` = 20, `g` = 4, `c` = 8.5, and the candidate would be **rejected**; with no other candidate, `full` would degrade to **`off`** (not to `lanes` — the flat split was already non-viable), printing both reasons.

**Re-derived by hand under ADR-0013's concurrent inner-join charge, every figure above is unchanged** — only `1 × J` became `J`, and at `k = 1` those are the same quantity. `span_max` **8**, nested overhead `A + A + J + J + I(2×0.25)` = **8.5**, `M_nested` **16.5** against `M_seq` **24**, `g` **16**, `c` **8.5**, **adopted**. Re-check this example whenever either side of the model is edited.

#### Worked example — a split carrying an integration sub-lane

The third regression check, covering the two terms the examples above do not exercise: a serial integration sub-lane and a non-trivial interface-point count. Same shape as the example above — one lane carries everything — with `tasks(mobile) = 24` split into **5 concurrent sub-lanes** whose largest is `5`, **plus a declared `integration` slice of 6** (`tasks(integration) = 6`). The **lane-level** split declares **`integration: none`**, so the top-level `tasks(integration) = 0` — the serial work in this example is all one level down. `k = 1`; defaults `A = 2`, `J = 2`; parent contract **0** interface points, sub-contract **8**.

| | baseline (`off`) | nested (candidate adopted) |
| --- | --- | --- |
| `span_base` / `span_max` | `T` = **24** | `max(concurrent) + integration` = `5 + 6` = **11** |
| overhead | **0** | `A` + `A` + `J` + `J` + `I((0 + 8) × 0.25)` = **10** |
| makespan | `M_seq` = **24** | `M_nested` = **21** |

Gain `g` = `24 − 11` = **13**; cost `c` = **10**; `g > c` (`13 > 10`), so the candidate is **adopted** — at a margin of 3, on a 12.5% improvement.

**This is the example the declared-field rule exists for.** Before `integration` was a first-class digest field, the acceptance rule discarded the slice as prose and `tasks(integration)` read as `0`: `span_max` came out `5` instead of `11`, `g` came out `24 − 5 = 19` instead of `13`, and the candidate cleared its cost of `10` by a margin of 9 rather than 3. The plan is still adopted either way here — but the number the `ask` ladder showed the user was wrong by 6 task-equivalents, and on a split whose integration slice is larger relative to its concurrent work the same error adopts a candidate that does not clear its cost at all. Re-check this example whenever either side of the model is edited.

**Read the thin margin as a finding, not as noise.** The integration sub-lane (6) is larger than the critical concurrent leaf (5), so more than half this lane's span is serial and no amount of further slicing touches that half. The model is reporting Amdahl's law accurately. The lever is the **slice axis**, not the thresholds: 8 interface points across 6 sub-lanes is the signature of a layer-wise split, where every slice touches every other. `references/parallel.md` → Step 2p.1 therefore asks the analysis to minimize cross-slice rows and to **name the axis it used**, so this shape is visible on the same screen as the margin it produced.

The aggregate payback rule passes here — `8 ≤ T = 24`. Under the superseded `min(leaf)` comparand it did **not**: aggregate `8` against a smallest leaf of `3` rejected the whole plan, and with a non-viable flat verdict the run degraded to `off`, discarding a plan that more than halved the critical path. That regression is what this example exists to prevent.

**Re-derived by hand under ADR-0013's concurrent inner-join charge, every figure above is unchanged** — only `1 × J` became `J`, and at `k = 1` those are the same quantity. `span_max` **11**, nested overhead `A + A + J + J + I(8×0.25)` = **10**, `M_nested` **21** against `M_seq` **24**, `g` **13**, `c` **10**, **adopted**. Re-check this example whenever either side of the model is edited.

#### Worked example — `k = 2`, the case the overlap exists for

The regression check for ADR-0013, and the only example here with `k > 1` — the three above are all `k = 1`, where the serialized and concurrent readings of the inner-join level coincide and nothing can distinguish them. Lane set `{A: 24, B: 10, C: 4}` with a lane-level **`integration: none`**, so the top-level `tasks(integration) = 0`; `T` = **38**. The flat verdict is **viable** (3 lanes carry work; the largest holds `24/38` = **63%** ≤ 70%), so the baseline is `M_flat`. The parent contract has **0** interface points; each adopted sub-contract has **2**. Defaults `A = 2`, `J = 2`.

**Baseline.** `span_base = max(24, 10, 4)` = **24**; flat overhead `A + J + I(0×0.25=0)` = **4**; `M_flat` = `24 + 4` = **28**.

**Adoption 1 — the critical lane `A`**, split into `{8, 8, 8}` with `integration: none`, so `span(A)` = `max(8, 8, 8) + 0` = 8.

| | before | after adoption 1 |
| --- | --- | --- |
| `span_max` | `max(24, 10, 4)` = **24** | `max(8, 10, 4)` = **10** |
| accumulated overhead | `A + J` = **4** | `A + A + J + J + I(2×0.25=0.5)` = **8.5** |
| makespan | `M_flat` = **28** | `M_nested` = **18.5** |

`g₁` = `24 − 10` = **14**. `c₁` = `A(2) + J(2) + I(2×0.25=0.5)` = **4.5** — the first adoption on a flat baseline, so it carries the Step 2s level, the Step 3s level, and its own sub-contract's interface points. `14 > 4.5` → **adopted**.

**Adoption 2 — recompute, and the critical lane is now `B`** = 10, split into `{5, 5}` with `integration: none`, so `span(B)` = 5.

| | before | after adoption 2 |
| --- | --- | --- |
| `span_max` | `max(8, 10, 4)` = **10** | `max(8, 5, 4)` = **8** |
| accumulated overhead | **8.5** | `A + A + J + J + I(4×0.25=1.0)` = **9** |
| makespan | `M_nested` = **18.5** | `M_nested` = **17** |

`g₂` = `10 − 8` = **2**. `c₂` = `I(2×0.25=0.5)` = **0.5** — **no `A`**, because the Step 2s level already exists and its architects run concurrently, and **newly no `J`**, because the Step 3s level already exists and its joins now overlap. `2 > 0.5` → **adopted**.

**The behavior change this example pins.** Under the superseded serialized charge, adoption 2 cost `J(2) + I(0.5)` = **2.5** against the same `g₂` = **2**, so `g > c` **rejected** it. That rejection was **self-consistent at the time**, and that is the point: the serialized plan's own `M_nested` would have been `span_max(8) + A(2) + A(2) + 2 join passes(4) + J(2) + I(4×0.25=1)` = **19** — *worse* than the **18.5** of leaving `B` flat — so the gate and the ladder agreed then, on the machine that then existed. Under the overlapped machine they agree again, in the other direction: the adopted plan's `M_nested` is **17**, strictly better than 18.5, and the gate adopts it. **Agreement on both sides of the change is what this example checks** — a candidate whose verdict flips is exactly where a half-landed change (barrier without charge, or charge without barrier) would show a gate and a ladder disagreeing about the same plan.

**Both reconciliations.** They are stated because either one failing means the two accounts have drifted apart again:

- **Cost.** `M_nested`'s overhead (**9**) − `M_flat`'s overhead (**4**) = **5** = `c₁`(4.5) + `c₂`(0.5). Every task-equivalent the gate charged is visible in the figure the ladder prints, and nothing else is.
- **Gain.** Total span reduction `24 → 8` = **16** = `g₁`(14) + `g₂`(2). Every task-equivalent of span the gate credited is span the adopted plan actually removes.

**The remaining gates all pass**, and are checked here rather than assumed: the 6 leaves `{8, 8, 8, 5, 5, 4}` sum to `T` = **38**; at least 2 leaves carry work; the largest leaf holds `8/38` = **21%** ≤ 70%; the aggregate interface-point count (0 parent + 2 + 2) = **4** ≤ `T` = 38; and 6 leaves is exactly within the `max_parallel_lanes` default of **6**.

Re-check this example whenever either side of the model is edited.

#### Worked example — a declared top-level integration lane (`tasks(integration) > 0`)

The regression check for ADR-0016, and the only example here with a **non-zero top-level** `tasks(integration)` — the four above all declare `integration: none` at the lane level, where `X = 0` and the correction is invisible by construction.

Lane set `{backend: 20, frontend: 12, admin: 6}`, plus a declared top-level integration lane `wiring` with `tasks(integration) = 4` — its requirement IDs and globs disjoint from all three lanes', and no lane-map row of its own. `T` = `20 + 12 + 6 + 4` = **42**. Parent contract **4** interface points; the one adopted sub-contract **2**. Defaults `A = 2`, `J = 2`. Write `X = 4`.

**Flat verdict.** The two work-concentration conditions exclude `wiring`: **3** non-integration lanes carry work (≥ 2), and the largest holds `20/42` = **48%** (≤ 70%). Conditions 3–6 pass. **Viable** — so the baseline is `M_flat`.

**Baseline.** `M` = `max(20, 12, 6)` = 20, so `span_base` = `M + X` = `20 + 4` = **24**; flat overhead `A + J + I(4×0.25=1.0)` = **5**; `M_flat` = `24 + 5` = **29**. (`M_seq` = `T` = **42**, shown for reference only — the flat plan is on offer, so it is not the baseline.)

**Adoption — the critical lane `backend`**, split into `{8, 8}` with `integration: none`, so `span(backend)` = `max(8, 8) + 0` = 8.

| | flat (`lanes`) | nested (candidate adopted) |
| --- | --- | --- |
| non-integration term | `max(20, 12, 6)` = **20** | `max(span(backend)=8, 12, 6)` = **12** |
| `+ tasks(integration)` | `+ 4` | `+ 4` |
| `span_base` / `span_max` | **24** | **16** |
| overhead | `A + J + I(4×0.25=1.0)` = **5** | `A + A + J + J + I((4+2)×0.25=1.5)` = **9.5** |
| makespan | `M_flat` = **29** | `M_nested` = **25.5** |

`g` = `24 − 16` = **8**. Via the cancellation identity (*The makespan model*, above), `g` = `M − S` = `20 − 12` = **8** — the same number, as it must be: `X` is common to both slice sets and cancels by construction, not by coincidence. `c` = `A(2) + J(2) + I(2×0.25=0.5)` = **4.5**, the first adoption on a flat baseline. `g > c` (`8 > 4.5`) → **adopted**.

**Reconciliation.** `M_flat − M_nested` = `29 − 25.5` = **3.5** = `g − c` = `8 − 4.5` = **3.5**. Exact.

**Lanes left flat, both for reasons the model produces rather than asserts.** `frontend`'s proposed sub-split `{11, 1}` fails the re-applied condition 2 — one sub-lane holds `11/12` = 92% of the lane's tasks — so `sub-split rejected: lane frontend`. `admin` is not on the critical path: splitting it leaves `span_max` at 16, so `g = 0`, and `0 > 0` is false. `wiring` is **not a candidate at all** — the top-level integration lane is never sub-split.

**The remaining gates pass**, checked rather than assumed: the aggregate interface count `4 + 2` = **6** ≤ `T` = 42; the adopted leaf set `{backend/a: 8, backend/b: 8, frontend: 12, admin: 6}` has **4** non-integration leaves carrying work (≥ 2) and its largest holds `12/42` = **29%** (≤ 70%), both with `wiring` excluded from the conditions and included in the `T` denominator; and **4** concurrent leaves is within the `max_parallel_lanes` default of **6** — `wiring` is not counted against the ceiling, because Step 3L never dispatches it in the concurrent wave.

**What this example is actually pinning.** Under the uncorrected model — which took a bare `max` over lanes, folding `wiring` in rather than charging it after them — `span_base` read `max(20, 4)` = 20 and `span_max` read `max(12, 4)` = 12. **`g` came out 8 either way**, and `M_flat − M_nested = g − c` reconciled either way (`25 − 21.5` = 3.5). The gate and the ladder never disagreed, so nothing in the transcript contradicted the figures. What was wrong is that **both** makespans were understated by exactly `X = 4` — `M_flat` 25 against the true 29, `M_nested` 21.5 against the true 25.5 — so the `ask` ladder quoted the user two wall-clock figures that no run could achieve, and the `Estimated speedup:` line divided `T` by a denominator missing the serial tail. Re-check this example whenever either side of the model is edited, and read it as the case that shows why a passing reconciliation is not by itself evidence the model is right.

#### Greedy, recomputed adoption

Evaluate candidates **critical-lane first**. After each adoption, **recompute the makespan** and re-evaluate every remaining candidate against the **new** critical path. Stop when no remaining candidate's marginal gain exceeds its cost, or when the leaf-width ceiling (`max_parallel_lanes`) is reached.

**The candidate set is the run's non-integration lanes.** The top-level integration lane is **never** a sub-split candidate at 2p.3n, so `span(integration) = tasks(integration)` holds for the whole run and no adoption changes it (*The makespan model*, above). Splitting it is not merely unprofitable — it is not on offer: the lane exists precisely to be the one serial pass that wires the others' outputs together, and Step 3j dispatches it as one lane after all of them are DONE. (ADR-0016.)

Recomputing after each adoption is what makes *"each split shrinks the next one's payback"* fall out of the model rather than needing a separate heuristic. The **per-adoption** increment to the overhead is `A + J` plus that sub-contract's interface points for the **first** adopted lane, and **that sub-contract's interface points alone** for every lane after it — **both** the Step 2s and the Step 3s level are brought into existence once and paid for once, the first because its architects are spawned concurrently and the second because its joins overlap (*The makespan model*; ADR-0013).

**Termination does not rest on a strictly positive cost, and must not be argued as though it did.** A later adoption whose sub-contract freezes no interface rows costs exactly **0**, so the accumulated overhead can stay flat across an adoption. Three things still terminate the loop, and they are the honest replacement for that argument:

- **Greedy critical-lane-first evaluation shrinks the gain side monotonically.** Each adoption lowers `span_max`, so the `n`-th adoption is measured against a strictly smaller remaining gain than the one before it.
- **`g > c` still rejects a wash, even a free one.** `0 > 0` is false, so a zero-gain candidate is rejected at zero cost — a split off the critical path buys nothing and is refused whether or not it is cheap.
- **The lane set is finite.** There are only so many lanes to adopt.

**Three independent guards additionally bound a cheap later adoption**, so "it costs nothing" never means "adopt it freely": the **leaf-width ceiling** (`max_parallel_lanes`, below) caps the adopted leaf set outright; the **aggregate diminishing-payback rule** rejects the whole nested plan once the aggregate interface-point count exceeds `T`; and the **per-sub-lane re-application of the viability conditions** rejects any split that is not a real one. A cheap adoption is bounded by all three, and by `g > c` on the gain side — never by the price of its own contract.

**Partial adoption is the normal outcome.** `full` routinely sub-splits some lanes and leaves others flat, and the printed plan says which lanes were split, with their marginal gain and cost, and which were left flat, with the reason.

#### Aggregate diminishing-payback rule

After the nested plan is assembled, **reject the whole nested plan** — falling back per *Degradation* below, which is `lanes` on a viable flat verdict and `off` on a non-viable one — when the **aggregate** interface-point count — across the parent contract **plus every adopted sub-contract** — exceeds `T`, the run's **total** task count.

This is the two-level form of the flat gate's condition 4, and it is a **risk heuristic, not a cost test**. The cost test is `g > c`, which already charges every interface point at `0.25` task-equivalents (*The cost side*) — so this rule is **not** a second cost comparison, and `I > T` deliberately **is not** an inequality between two task-equivalent quantities.

> **`I > T` is a dimensionless ratio, and both sides are counts.** It fires when the plan freezes **more interface rows than the run has tasks** — a shape where reconciliation touches essentially every unit of work, so the rework probability rises in a way no term in `g > c` models. `g > c` bounds **expected cost**; this bounds **variance**, and variance is not denominated in task-equivalents. Do **not** read it as *"interface cost exceeds the run's work"*: at `0.25` each, that claim would be `0.25 I > T`, i.e. `I > 4T` — a threshold so extreme it could never fire, which is precisely why the cost reading was dropped rather than the comparand rescaled. (ADR-0012.)

> **The comparand is `T`, and it is `T` because `T` does not move when slices are cut finer.** An earlier form of this rule compared the aggregate against the **smallest leaf's** task count. `min(leaf)` decreases monotonically in slice count while `I` increases monotonically, so that rule's firing probability approached 1 exactly as the split approached usefulness — it rejected hardest the plans that shortened the critical path most. A guard whose threshold is defined by the thing it is guarding against cannot be tuned; it can only be replaced. (ADR-0012.)

#### Per-sub-lane re-application of the existing viability conditions

Every per-lane viability condition is re-applied at **sub-lane granularity** for each candidate split:

1. at least **2 non-integration sub-lanes** carry work;
2. no **non-integration** sub-lane holds more than **70%** of the lane's tasks;

   > **What the exclusion removes here is the split's declared `integration` slice** — the slice set these two conditions are evaluated over is this lane's sub-lane set, so the canonical rule (*The two work-concentration conditions are evaluated at leaf granularity*, above) lands on that slice; it is still charged in **full** toward `span(L)` (*The makespan model*) and toward `T`, and is excluded from **these two conditions only**. (ADR-0012; field made first-class by ADR-0014; generalized over the slice set by ADR-0017.)
3. sub-lane globs are **bounded, contained, and mutually disjoint** (the rejection list above, cases 1–6);
4. the project's gate commands from `PROJECT-CONTEXT.md` → **Commands** can be **scoped to a sub-lane's paths** — otherwise that gate defers to the inner join, which records it for the outer join rather than running it (`references/parallel.md` → Step 3j item 4 is the single run site for every deferred gate, at either depth; ADR-0013);
5. the **host can fan out at the resulting leaf width**.

> **There is no per-sub-lane interface-point condition, deliberately.** This list once carried a sixth entry, at position 4 — *the sub-contract's interface points do not exceed the smallest sub-lane's task count* — with the same self-defeating `min` comparand the *Aggregate diminishing-payback rule* documents above, one level down. It is deleted rather than repaired: interface points are charged per candidate by `g > c` (*The cost side*), and the absurd-case backstop is the aggregate rule. A third check on the same quantity could only contradict one of the other two. (ADR-0012.)

Any failure **rejects that lane's split with a named reason and leaves that lane flat**. It never rejects the run, and it never degrades the flat split that already passed its own gate.

#### Leaf-level re-application of the two work-concentration conditions

After the nested plan is assembled — after greedy adoption, the aggregate payback rule, and the leaf-width ceiling — outer conditions 1 and 2 are re-applied **over the run's adopted leaf set**, which is what *The two work-concentration conditions are evaluated at leaf granularity* defers them to:

1. at least **2 non-integration leaves** carry work → otherwise `nested non-viable: only {N} leaf carries work`;
2. no **non-integration** leaf holds more than **70%** of the run's **total** task count → otherwise `nested non-viable: leaf {qualified name} holds {p}% of tasks — the split would not shorten the critical path`.

> **What the exclusion removes here is the run's top-level integration lane** — the slice set these two conditions are re-applied over is the run's adopted leaf set, whose declared integration slice is that lane, so the canonical rule (*The two work-concentration conditions are evaluated at leaf granularity*, above) lands on it here exactly as it does at 2p.3, and cannot land at one site and not the other; the lane is still counted in **full** in `span_base`, `span_max`, `M_flat`, and `T`, and the `70%` denominator is still the run's total task count `T`, which includes it. (ADR-0016; generalized over the slice set by ADR-0017.)

**These two checks can only ever bite when the flat verdict was non-viable, and that is a property of the arithmetic, not a convention.** A leaf is a lane or a slice of one, so if every lane held ≤ 70% then every leaf does, and if ≥ 2 lanes carried work then ≥ 2 leaves do. On a run whose flat split already passed conditions 1 and 2 this step is a no-op that cannot change a verdict — which is precisely why deferring the two conditions is safe for every run that was already working.

Failure here rejects **the nested plan**, not an individual candidate, and the run then falls back per *Degradation* below.

#### Leaf-width ceiling

The adopted nested plan's leaf set is capped by `max_parallel_lanes` — see that key for the full policy. This is a **planning** preference (do not adopt a split whose payoff is smaller than the sub-splits it would force out), not the enforcement: dispatch width is bounded unconditionally at Steps 2L/3L.

#### Degradation

When **no** lane clears this gate — or the assembled plan fails the aggregate payback rule or the leaf-level re-application — what `full` degrades to is decided by the **flat verdict**, and by nothing else:

| Flat verdict | `full` degrades to | Printed |
| ------------ | ------------------ | ------- |
| viable | `lanes` | the nested reason; the flat split is unaffected, it passed its own gate |
| non-viable | `off` | **both** reasons — the nested one and the flat condition that failed at 2p.3 |

A viable flat verdict is what makes `full → lanes` correct: there is a priced, gated plan to fall back to. A non-viable one means there never was one, so `off` is not a conflation of the two gates — it is the only remaining plan, and printing both reasons is what keeps the two failures distinguishable in the log.

`lanes` itself never degrades to `off` from this gate; that is conditions 3–6's outcome at 2p.3, printed there.
