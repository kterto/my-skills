# Measurement alignment audit — the framework against Beck & Orosz

Source: *Measuring developer productivity? A response to McKinsey* (Gergely Orosz and Kent Beck, Aug 2023), read against `plugins/my-skills/skills/*` at `5084026`.

Method: eleven principles distilled from the article, each audited against the framework by a dedicated pass over the repo; 371 measurements inventoried across seven areas; 86 findings (20 strengths, 66 gaps). Claims marked ✓ below were re-verified by hand after the audit; unmarked citations come from the audit passes and carry their own anchors.

---

## 1. The doctrine, stated for an agent pipeline

The article's backbone is a four-link chain:

| Link | What it is | Cost to measure | Attribution | Distortion |
|---|---|---|---|---|
| **Effort** | What is spent: planning, coding, reviewing, cycles | cheapest | perfect | worst |
| **Output** | What the effort produces: the diff, the doc, the green gate | cheap | good | high |
| **Outcome** | The behaviour change in someone outside the team | expensive | poor | low |
| **Impact** | Value flowing back: revenue, retention, cost saved | hardest | almost none | none |

Two claims sit on top of it. **Measuring earlier is easier and more distorting** — McKinsey's new metrics are 4-of-5 effort-or-output, and "the only folks who care about these metrics are the people collecting them." And **measurement is an intervention**: Beck's Facebook survey went from useful signal to a rating traded between managers and reports in three years, and Uber's diff-count dashboard did not change lines of code but did visibly raise the CI bill.

### Where the analogy holds and where it breaks

Transferring this to a pipeline whose "developers" are agents needs care. The audit's disanalogy set, condensed:

- **The Facebook mechanism does not transfer.** It runs on money and status inside a hierarchy. An agent has no rating to trade. What survives is the older and weaker claim: optimising a proxy displaces the goal. Cite Goodhart, not Beck.
- **"Measure less" is not available.** A human team has unmeasured channels — craft pride, a manager's read of the room. An agent pipeline has none: every instruction is a measurement or it does not exist. P2 therefore cannot be executed by deleting output metrics, only by refusing to treat them as terminal.
- **The tradeoff inverts.** Attribution is trivial here (every role invocation has a token cost, a span, a diff) and alignment is impossible (no revenue signal, no user). The article's reason for avoiding effort metrics does not apply to spend.
- **Spend is not a proxy — it is the bill.** Metering it is mandatory, not forbidden. The agent has no wallet and will not economise unprompted.
- **Reward hacking is stronger, cheaper, and usually not deceptive.** An agent satisfying a gate the cheapest way is reading the spec literally with no model of what the gate was for. The repair is to close the specification, not to change incentives. And unlike a human, an agent can edit the instrument mid-run.
- **There is no world-produced event inside the loop.** Sales can be measured on outcome because a deal closing happens independently of the salesperson's report. Every signal this pipeline reads is one it generated — including the artifacts it grades itself against. The loop is closed until a human or a deploy opens it.
- **"One customer-facing thing per week" has no clean translation**, and that gap is exactly where it matters. The nearest analogue — a phase exiting green — keeps *wholeness* and drops *customer-facing*, which is the half that dragged the metric rightward.

---

## 2. Scorecard

| # | Principle | Framework verdict | Evidence |
|---|---|---|---|
| P1 | Every metric's chain position is written next to it | **partial** | `orchestrator/references/config.md:32-40` argues each budget's position explicitly ✓; no artifact labels any number (`SKILL.md:1768-1797` is five counters) ✓ |
| P2 | Measure as late as attribution survives; never present output as verdict | **violated** | `READY_TO_COMMIT` is defined purely by suite/lint/gate state ✓ (`templates/qa.md:421`); no outcome column anywhere |
| P3 | Measuring changes the thing measured | **partial** | dart G6 routes un-run mutants away from `killed` ✓ (`dart-flutter.cjs:601`); node-ts G6 scores 100 on an empty denominator ✓ (`node-ts.cjs:547`); thresholds live in a branch-writable file ✓ (`config.cjs:36-47`) |
| P4 | Attribution/alignment tradeoff decided in writing | **aligned** | G8 kept advisory with its calibration attached ✓ (`qa.md:386`, `config.md:32`); spec-eval forbids volume from entering the grade (`spec-driven-eval/SKILL.md:164`) |
| P5 | Budget the cost the metric itself creates | **partial** | dart G6 preflight prices the run and declines (`dart-flutter.cjs:893-916`) ✓; node-ts Stryker spawn has no timeout at all ✓ (`node-ts.cjs:614`) |
| P6 | Self-measurement is fine; the same number as judgement is not | **partial** | G1 is diagnostic at the tester, blocking at QA; eval remediation floors on kind, not score; but no enumerable registry of what blocks, and the thresholds are branch-writable |
| P7 | A whole, customer-facing increment on a short cadence | **partial** | the per-story 1:1:1:1 branch/commit/PR contract is a real cadence; "each phase is already required to exit on a green tree" ✓ (`SKILL.md:931`) is **false** against `architect.md:146` and `coder.md:177` ✓ |
| P8 | Report against the commitment, misses included | **partial** | `## Requirement Coverage` is a genuine pre-registered promise, independently counted; the FINAL reports `Deferred by decision` ✓ — and the PR body a human reads has no field for it ✓ (`pr-body.template.md`) |
| P9 | Unmeasured must never be byte-identical to pass | **partial** | the four-value vocabulary and `assertNonEmptyScope` are exemplary ✓ (`run.cjs:71-84`); QA's gate table offers no `UNMEASURED` cell for G1–G7 ✓ (`qa.md:380-386`), and the FINAL banner has no field for the unmeasured set ✓ |
| P10 | A counter resettable by renaming the work is not a budget | **partial** | family resolved by provenance, override written twice — the best implementation in the repo; a fresh brief still mints a fresh family, and PM's retry path does exactly that |
| P11 | Meter spend, not only rework | **violated** | `max_run_minutes` is the only cost meter, it is wall-clock only, it ships `0` ✓ (`templates/config.template.json`), and no artifact carries a cost field ✓ |

---

## 3. The diagnosis

**This framework measures the pipeline, not the software.** Of the numbers it emits, the great majority are effort (cycles, minutes, reviews, lanes) or output (coverage, complexity, mutation score, gate verdicts, artifact pairing). One measurement reaches toward outcome — the tester's e2e on a high-criticality flow — and one reaches toward the commitment — the requirement-coverage map graded by the spec eval. Neither of them is what the terminal artifact reports. `ORCHESTRATOR — pipeline complete` prints four cycle counters, a rework ratio, and a coverage number. A reader of that banner cannot tell whether the change works, how much it cost, or which of the seven gates never ran.

That is not an accident of neglect; it is the predictable shape of a system built by someone doing forensics on their own runaway runs. Every control that exists was added because a run escaped: `max_family_cycles` because one spec absorbed 13 reviews across 11 slugs, `max_run_minutes` because a run reached all three cycle caps and still ran fifteen hours, `gate_wall_clock_minutes` because a mutation runner spent 43 minutes at 1% CPU. Those controls are excellent — provenance-resolved denominators, loud overrides, calibration data attached to every threshold, an explicit refusal to let G8's rework ratio block because the ratio converges as a family worsens and therefore cannot discriminate. **This is better metric hygiene than most engineering organisations achieve.** But they are all *containment* metrics. They answer "did this run get out of control", never "did this run deliver what it promised."

The gap is most visible at the three boundaries where the framework hands work onward. At the QA boundary, the four-value gate vocabulary that can honestly say "we did not verify this" collapses into a binary: `READY_TO_COMMIT` admits `MISSING_TOOL` and `UNMEASURED` as non-failures ✓, correctly, but the gate table the QA agent fills in offers no `UNMEASURED` cell for G1–G7 ✓ and the completion banner has no field for which gates were unmeasured ✓. A project with no complexity linter, no mutation runner and no dependency analyser gets a fully green-looking ship verdict on three gates that never executed. At the PR boundary, the orchestrator's honest miss report — `Deferred by decision`, `Issues found`, the eval's recorded-not-remediated gaps — reaches the FINAL and then dies: `pr-body.template.md` carries Summary, Story, Test plan and Human validation, and nothing else ✓. At the roadmap boundary, `READY(r)` is legended "the release is shippable" and computes to a count of `Roadmap-Story:` commit trailers ✓; moving the one laggard to `backlog` removes it from the matrix entirely ✓ and flips the release to READY.

**The instrument is inside the tree being measured.** `.cleancode-gates.json` holds every blocking number, is deep-merged user-wins, is auto-written into the repo on first run ✓, and is not among the three keys the orchestrator anchors to the merge-base ✓. The anchor's stated rationale is blast radius — "none of them widens a branch's blast radius, which is what the merge-base anchor exists to contain" ✓ — which is a narrower threat model than the one the repo's own forensics document. A branch that sets `max_eval_cycles: 0`, or adds its own paths to `gates.G2.exempt`, weakens the measurement of itself, from inside the change under review, and no artifact says so. That is the McKinsey dynamic in its purest agent form: not a person gaming a score, but a system in which the cheapest path to a green number runs through the instrument.

**And the one effort metric the article's argument does *not* forbid is the one that ships disabled.** For agents, spend is not a proxy for value — it is the bill, incurred whether or not the run produces anything. `max_run_minutes: 0` in the shipped template ✓ means a default install cannot state what a run cost even after it finishes, and the product-manager loop, which runs N orchestrator invocations back to back, holds no aggregate at all.

---

## 4. Recommendations, ranked

Each is traceable to a principle and to a failure it prevents. Cost is S (an hour or two), M (a day), L (more).

### R1 — Make the terminal artifacts state delivery, cost, and what was not measured · MODIFY `orchestrator` + `product-manager` · **S** · P1, P2, P8, P9, P11

The FINAL banner (`SKILL.md:1768-1797`) gains four lines, and the PM story PR body gains one section fed from them:

```
Delivered: {m} / {t} spec requirements with passing evidence
Not delivered: {requirement text} — {deferred by decision | eval-recorded, not remediated} — {follow-up id | none}
Unmeasured: {G2 MISSING_TOOL, G6 UNMEASURED (no denominator), G1.branches UNMEASURED} (or "none")
Run cost: {elapsed} min across {n} boundaries
```

`Delivered` comes from the eval evidence matrix over the root plan's `## Requirement Coverage` denominator — both already exist. `Unmeasured` is the set QA already computes and already reports prominently in its own file; this only forwards it. Nothing new is measured; four things already known stop dying at a boundary.

*Acceptance:* a run on a project with no mutation runner prints a non-empty `Unmeasured:` line, and its PM PR body carries the same list. A run where the architect deferred three requirements prints all three in `Not delivered` with their follow-up ids, and so does the PR.
*Gaming:* an agent wanting a clean banner can defer less and measure more — which is the behaviour change wanted. The line to watch is `Delivered`: it must never be computable from the plan alone, only from the eval's evidence, or it becomes a self-graded number.

### R2 — Anchor the instruments to the merge-base · MODIFY `orchestrator` Step 0b + `clean-code-gates` · **M** · P3, P6, P10

Extend the merge-base rule from "keys that widen blast radius" to "keys that weaken the measurement." Add `max_eval_cycles`, `max_family_cycles`, `max_qa_cycles`, `max_review_cycles`, `gate_wall_clock_minutes`, `max_spec_requirements` to the anchored set, and resolve `.cleancode-gates.json` thresholds, `exempt`, `exclude` and `roots` from `$mb` too. Where working-tree and merge-base disagree, run on the merge-base value and print one non-suppressible line naming every key that moved and its direction:

```
INSTRUMENT MOVED — gates.G2.exempt +3 globs (loosening), max_eval_cycles 2 → 0 (loosening) — measured against merge-base values
```

A loosening move inside the change under review is a reviewer finding, not a silent config read. Legitimate threshold changes still work: they land in their own commit, where the line is informative rather than damning. This unifies two audit proposals (`G0 gate-config integrity`, `instrument provenance`) into one mechanism and reuses the two-trust-anchors invariant already in `PROJECT-CONTEXT.md`.

*Acceptance:* a branch adding `"max_eval_cycles": 0` to `.orchestrator/config.json` runs with the eval live and prints the moved-instrument line. A branch adding its own files to `gates.G1.exempt` is measured without the exemption.
*Gaming:* the escape is to move the instrument in a separate earlier PR. That is a much higher bar, it is visible in history, and it is the same bar a human faces.

### R3 — Close node-ts G6's fail-open and bound it · MODIFY `clean-code-gates` · **S/M** · P3, P5, P9

Two defects, one of them the exact class `run.cjs:71-78` exists to forbid:

1. `fileMutationScore` returns `score: denom ? (100*killed)/denom : 100` (`node-ts.cjs:547`) ✓ — a file whose mutants were all excluded, or for which Stryker generated none, scores a perfect 100 and passes. It must return the `unmeasured` state the dart adapter already has, not a pass.
2. The Stryker spawn (`node-ts.cjs:614`) ✓ carries `maxBuffer` and no `timeout` and no `killSignal`, while the dart runner carries both with a comment naming the 43-minute hang that motivated them (`dart-flutter.cjs:861-864`). Port `gates.G6.budget` (`perMutantSeconds` / `totalSeconds` / `maxMutants`), the preflight that declines with arithmetic, and the hard `timeout` + `SIGKILL`. `clean-code-gates/SKILL.md:96-107` already documents this as the shared G6 contract; one adapter implements it.

While there: eight of nine adapter process spawns carry no timeout, including both whole-test-suite runs. A leaked handle in a project's vitest config hangs the gate indefinitely, and `gate_wall_clock_minutes` explicitly does not cover the suite (`config.md:38` vs `qa.md:23` disagree on this — fix the doc too).

*Acceptance:* `--gates G6` on a file with zero generated mutants reports `UNMEASURED`, not `pass`. A wedged Stryker run returns `UNMEASURED (timeout)` inside the budget instead of blocking the QA subagent forever.

### R4 — Generalise the `measurement` block to every gate and stack · MODIFY `clean-code-gates` + `orchestrator/templates/qa.md` · **M** · P9

The dart G6 result already carries `measurement.state ∈ {empty, measured, partial, unmeasured}` beside `status`, so that "did it pass" and "was this actually verified" are two fields. Make that universal: every gate result carries it, `report.schema.json` permits it (today it does not), the run summary carries `unmeasuredFiles`, and QA's gate table gains the `UNMEASURED` cell it is elsewhere required to write ✓ — today the table offers `✅ / ❌ / MISSING_TOOL` for G1, G2, G6, G7 and `✅ / ❌` for G4 and G5, while `qa.md:181` and `:235` require `UNMEASURED` to be recorded. The QA progress-log vocabulary needs the same value; today it has an undefined `WARN` where `UNMEASURED` should be.

Special case worth its own line: dart G4 returns `pass` when the project enables no naming lints. The tool ran, measured nothing, and is indistinguishable from a clean measurement.

### R5 — Grade the story's pre-registered Acceptance, not only the derived spec · MODIFY `product-manager` + `orchestrator` · **S/M** · P8, P7

The roadmap story is where a promise is made in advance (`## Acceptance`), and it is not what gets graded. PM hands the orchestrator the Brief; the brainstormer writes a spec; the eval grades the spec. The story's acceptance criteria can go unmentioned end to end, and the story is stamped `done` by the presence of a commit trailer.

Fix: PM passes `## Acceptance` verbatim into the story brief with an instruction that the spec's numbered requirements must cover it; the FINAL reports a per-acceptance-criterion verdict; `/roadmap sync` stamps `done` only on a trailer **plus** a FINAL whose acceptance verdicts are all met-or-explicitly-deferred. This is the single most doctrine-aligned change available: it makes the pre-registered commitment the graded unit.

### R6 — Meter spend unconditionally; aggregate it across the PM queue · MODIFY `orchestrator` + `product-manager` · **S** · P11

`max_run_minutes` caps; it should not also *enable*. The run already binds `run_started_at = boundaries[0].at` unconditionally and mints five timestamped boundaries — compute and print elapsed at every boundary and in every terminal banner regardless of the cap, and persist it in the FINAL. Default `0` then means "no stop", not "no number". Add the same at the PM level: per-story minutes in the progress row, a running sum across the resolved queue, and an opt-in `max_queue_minutes`. A twenty-story milestone where every run is under its 60-minute cap still legally consumes twenty hours, and nothing anywhere can say so.

Add a token/cost field where the host exposes it; where it does not, say so explicitly in the artifact rather than leaving the field absent.

### R7 — An outcome observation before `READY_TO_COMMIT`, disclosure-first · MODIFY `orchestrator/templates/qa.md` + `tester.md` · **S/M** · P2, P7

For each critical flow the diff touches, QA records whether the built thing was executed through the user-visible path it was changed for: the verbatim command, its exit code, and what behaviour was observed. Where it was not executed, that non-observation and its reason are written into the QA report, the banner and the PR body.

**Make this a disclosure, not a blocker, in its first iteration.** A hard gate on "did you run it" is satisfiable by `--version`; a required disclosure that a human reads is not. Promote it to blocking only after a few runs show what honest observations look like — the same discipline `config.md:36` already applies to `max_run_minutes`.

This is also the honest place to write down the framework's ceiling: a closed loop cannot observe outcome, only execution. The report should say which is which.

### R8 — Delete the false "green tree" warrant · MODIFY `orchestrator/SKILL.md:931` · **S** · P7

The scope-band refusal tells the operator to split on phase boundaries "because each phase is already required to exit on a green tree and is therefore already a shippable unit" ✓. The phase-exit rule is "EVERY applicable command was run and its verdict recorded — exit 0, **or a carried `GATE` entry**" (`architect.md:146`) ✓, and `coder.md:177` says in terms that a gate finding is not a stop: record what you cannot clear and proceed ✓. A phase can exit red, by design and for good reasons. The banner should attribute verification to the boundary that performs it — the run's tester/reviewer/QA barriers — and give each proposed split group a `needs:` token naming what it depends on. One paragraph of text; it is on the list because a false warrant in a refusal banner is exactly the kind of claim that gets believed.

### R9 — `READY` means landed · MODIFY `roadmap` · **M** · P1, P4, P7

`READY(r)` is a count of trailer commits found by `git log --grep` on any branch ✓, legended "the release is shippable", and a story moved to `backlog` leaves the matrix entirely ✓, so parking the laggard flips the release green. Make `done` require the story's commit to be an ancestor of a declared integration ref, and render a non-suppressible departure list: stories that carried the release band and left it without landing. Keep the trailer as the identity mechanism; change the predicate from "a commit exists" to "the code reached the trunk".

### R10 — A retry reuses the SPEC id · MODIFY `product-manager` · **S** · P10

The family budget is the only cross-run cost control, and it resolves from spec provenance. PM invokes the orchestrator with story brief prose; a re-run after a `STALLED` story re-types the brief, mints a fresh `SPEC-*`, and starts the family at zero — the documented cascade vector, reproduced by the framework's own retry path. PM already logs per story; log the `SPEC-*` id too and pass it positionally on any retry of the same story.

### R11 — A deferral needs a correction · MODIFY `orchestrator/templates/architect.md` + reviewer/eval contracts · **S** · P8

`Deferred` is written by the architect, exempts the requirement from structural completeness and from the grade, and its follow-up field legally reads `none yet`. The article's accountability unit is "I take accountability for the miss, here is the cause, here is the change." Require every `Deferred` row to carry either a follow-up id or an explicit `accepted — {reason}`, and surface the deferral count in the banner (R1) and PR (R1) so the cost of deferring is visible where someone reads it.

---

## 5. New skills

Only two gaps genuinely cannot live inside an existing skill, and both sit at the boundary where the closed loop has to open.

### N1 · `uat` — work the human-validation queue and turn it into fixable items

```yaml
name: uat
description: Walks a human through the pending validation spots the pipeline recorded, captures pass/fail with evidence, stamps the stories, and writes the failures as a validation file /validation-fixer can consume. Use when the user invokes /uat, says "work the validation queue", or resumes a conservative product-manager run that halted for validation.
```

The producer exists and the consumer does not. PM appends to `/roadmap/human-validation-queue.md` — an append-only file that "accumulates all flagged spots" while "the operator works the queue" by hand ✓ — and in conservative mode (the default) halts asking for exactly this. Meanwhile `validation-fixer` consumes a hand-written markdown file of `-` bullets. `/uat` is the missing middle: read the queue (and the story's `## Acceptance`), present each check with the PR URL and what to look at, record the human's verdict and evidence, stamp passes into the story's audit log, write failures into `docs/user_validation_errors/<date>.md` in validation-fixer's own input shape, and hand off. It is the only place in the framework where a signal the pipeline did not generate can enter, which is precisely the article's point about sales: outcome is measurable because the world, not the worker, produces the event.

Detection should also stop being a twelve-keyword substring scan — "confirm the payment completes and the receipt email arrives" matches none of the markers — but that repair belongs to PM, not to this skill.

### N2 · `delivery-ledger` — what the last N runs committed to, delivered, and cost

```yaml
name: delivery-ledger
description: Read-only. Aggregates every FINAL report, QA report and PM log in the project into one append-only delivery ledger — per run: requirements committed, delivered, deferred, gates unmeasured, human validations outstanding, and cost — and renders the trend. Use when the user invokes /delivery-ledger, asks "what has this pipeline actually shipped", or wants the cost of a milestone.
```

Nothing owns the cross-run view. The orchestrator is per-run, `roadmap` is doc-only planning, PM is per-story, `pr-review-report` is per-branch. So the question the article ends on — *deliver the business impact committed to* — has no artifact in this framework at all, and the question its own forensics keeps asking (how much did that family cost, how many runs were rework) is answerable only by hand-reading `.progress.md` files.

It writes no gate and blocks nothing. That is deliberate and should be stated in the skill text: this is the diagnostic tier of P6, and promoting any of its numbers to a gate is a deliberate, reviewed change. Its rows are the four R1 lines plus the run's provenance, which is why R1 comes first — the ledger is cheap once the runs state their own delivery, and impossible before.

---

## 6. What not to do

- **Do not build a pipeline-metrics dashboard.** Cycle counts, tokens per role, diffs per run, gate-pass rates over time: all effort, all cheap to collect, all optimisable by an agent that reads them. This is the Uber CI-cost anecdote waiting to happen — the metric did not change the lines of code, it changed the bill. The ledger (N2) reports delivery and cost per run; it should not rank roles.
- **Do not gate on G8.** The rework ratio is already correctly advisory, with the argument attached: it converges as a family worsens, so it cannot discriminate — the eight-hour cascade scores 0.67. That analysis is better than the metric that would replace it. Leave it.
- **Do not promote the outcome observation (R7) to a blocking gate on day one.** A hard "did you execute it" gate is satisfiable by the cheapest possible execution, and the agent has no way to know that is not what was wanted. Disclosure first, blocking later, with runs to calibrate against.
- **Correction to one audit finding: node-ts counting Stryker's `Timeout` as killed is not a defect.** Stryker's own mutation score counts timeouts as *detected* — a mutant that sends the suite into an infinite loop was caught by the suite. `mutation_test`'s timeouts mean the opposite (an unmeasured mutant), which is why `dart-flutter.cjs:601` routes them to `G6_UNRUN`. The adapters correctly follow different tools' semantics. What must change is the empty-denominator pass (R3) and the missing bound (R3) — and the divergence should be documented in the shared G6 contract so the next reader does not "fix" one adapter into the other's semantics.
- **Do not add a token-cost *cap* before a baseline exists.** `config.md:36` already makes this argument for `max_run_minutes` and it is right: a number chosen badly stops good runs. Report first (R6), cap once the distribution is known.
- **Do not build a metric-registry skill.** The registry P6 asks for is a table in `orchestrator/references/config.md` listing every number, its chain position, and whether it blocks — a reference doc with a linter, not a skill.
- **Do not try to measure impact inside the loop.** The pipeline has no revenue signal and no user; anything claiming to measure impact internally is measuring something else. P8 is a handoff obligation (N1), not a gate.

---

## 7. Sequencing

| When | Items | Why together |
|---|---|---|
| **First** | R1, R3, R6, R8, R10 | All S, all verified by hand, no cross-skill coordination. R1 alone changes what every future run reports; R3 closes a live fail-open in shipped code. |
| **Next** | R2, R4, R11 | The integrity layer: anchor the instrument, make "unmeasured" universal, make a deferral cost something. R4 wants R1's banner field to land in. |
| **Then** | R5, R7 | Both touch role contracts and want a few runs of R1 output to calibrate against. |
| **After** | N1 `uat`, R9 | `uat` closes the loop PM opens; R9 makes `READY` mean landed, which `uat` results can then gate. |
| **Last** | N2 `delivery-ledger` | Cheap once every run states its own delivery and cost; near-impossible before. |

The through-line: **the framework's containment metrics are excellent and should not be touched. What is missing is a delivery statement — what was promised, what landed, what was never measured, what it cost — and a way for a signal the pipeline did not generate to get back in.**

---

## 8. Verdict — what to ship, what to hold

Written after the recommendations, in answer to a direct question: would following these increase the framework's efficiency and, long-term, the productivity of using its skills?

**Efficiency and productivity pull opposite ways here, and most of this list buys the second at the cost of the first.**

Efficiency means cost per run. Four items touch it: **R3** (a wedged Stryker blocks a QA subagent indefinitely — hours), **R10** (a retry re-mints the family and unbinds the only cross-run budget — the documented fifteen-hour vector), **R2** (a false green ships a defect that costs a whole later family), **R6** (nothing can be stopped that is not measured). Those four pay for themselves. **R8** is negative cost: it deletes a false sentence.

Everything else *adds* work. R5 grades more, R7 observes more, R4 reports more states, N1 waits on a human. Runs get slower and reds go up. If the success metric is "pipeline complete", these make the framework look worse — which is the point, and worth being clear-eyed about. The pipeline is currently efficient at producing runs. A system optimises what it can measure; this one measures completion, so it completes. Whether it delivered appears in no artifact, so nothing in the loop is under pressure to.

### Confidence tiers

| Confidence | Items | Reasoning |
|---|---|---|
| **Ship, no debate** | R3 · R10 · R8 · R6 | A bug, a cascade vector, a false claim, and blindness. All small, all verified by hand, none add ceremony. |
| **Ship, high confidence** | R1 · R2 | R1 is the highest value per byte in the list — four lines making every future run state what it delivered. R2 closes the structural hole: an agent that can edit the instrument makes every other gate advisory. |
| **Genuinely uncertain** | R5 · R7 · N1 | Right in principle, but each widens the loop, and the loop's documented failure mode is not converging. Ship R1 first, run ten stories, decide with data. |
| **Hold** | N2 `delivery-ledger` | Proposed here and least certain. A cross-run ledger is one product decision away from being the dashboard this report warns against: the moment a number in it is compared across runs, it is a target. If built, it must never rank roles or trend cycles. |

### The risk worth naming loudest

The repo's own rework root-cause analysis lists skill size as a contributing factor, and nine of these eleven add text to files already past 150KB. Every addition is read by every agent on every run. **R4 and R7 are the most likely to pay for themselves in clarity and the least likely to pay for themselves in tokens.**

### And the honest bottom line

Neither this report nor its author can answer the productivity question, because the framework cannot currently state what a run cost or what it delivered. Ship R6 and R1, run a milestone, and the question is answerable from the project's own numbers rather than from anyone's opinion — which is the doctrine applied to the doctrine: do not argue about productivity, measure the delivery and the bill, late on the chain, and let the argument settle itself.
