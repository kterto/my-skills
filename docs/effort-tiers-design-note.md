# Rigor levels (formerly "effort tiers") — design note, resolved

**Status:** design resolved and implemented. The open questions at the end of the first draft are answered below, in *Resolutions*; the preset table is no longer a sketch — it is calibrated against 258 specs and 251 run families on this machine.
**Origin:** the owner's proposal, in session, to tune the pipeline's cost to the use case — a hackathon POC, an MVP under a deadline, and a mature project with loose deadlines should not run the same pipeline.
**Depends on:** `docs/measurement-alignment-audit-2026-09-11.md` — R1, R2, R3, R6, all landed. See *Why the dependency runs this way* below.

---

## The proposal

One setting selects a calibrated preset over the knobs the framework already has, so the pipeline can be run at a cost proportional to what the work is worth, without abandoning its structure.

## The correction that shapes the design

The instinct was "the fully-fixed pipeline is the highest level, and lower ones defer parts of it." That is half right. The eleven audit recommendations split into two groups that must be treated differently:

| | **Invariant set** | **Variable set** |
|---|---|---|
| What it is | telling the truth about what happened | how much work is done before shipping |
| Runtime cost | approximately zero | most of the run |
| Items | R1, R2, R3, R4, R6, R8, R9, R10 | R5, R7, N1, and *which* gates block |

R1 — the banner stating delivered / not delivered / unmeasured / cost — costs no time. At the cheapest level it is **more** valuable, not less: a run that skipped the eval, skipped mutation and took eleven minutes needs to say so more loudly than a hardened run does. The same holds for R6 (the meter), R2 (instrument anchoring) and R3 (a bug is a bug at every level).

> **Design rule: rigor scales the work, never the disclosure.**

The failure this rule prevents is a cheap FINAL that reads almost identically to a hardened one. That is P9 — *unmeasured must never be byte-identical to pass* — lifted from the gate level to the run level. Cheap green and expensive green must not look alike, or in three months nobody can tell which was which.

## Naming

### The axis is `rigor`, not `tier`

**`tier` is already taken, twice, and both uses are load-bearing.** The roadmap skill uses *tier* for the **release band**: `mutation-ops.md` says "re-tiers to it… or `null` (un-tier)", the matrix renders an `(untiered)` row, and every README template branches on "legacy/untiered roadmaps". `spec-driven-eval` uses *tier* for its test-distribution classes. A third meaning in the same corpus is a name that drifts inside a month.

The key is therefore **`rigor`** — the axis it actually names, how rigorously a change is verified before it is called done. It appears nowhere in the repo as an identifier, and the word's adjectival use in three role prompts is prose, not a symbol.

### The levels are named by promise, not by effort

Do not name them `low` / `medium` / `high effort`. That makes effort the unit, which is the failure the source article is about. Each level is named by what a green run at that level **claims**:

| `rigor` | The promise a green run makes | Typical use |
|---|---|---|
| `sketch` | It runs. Nothing is claimed about quality. | POC, hackathon, spike, throwaway |
| `delivery` | It does what the story's Acceptance says, and the happy path is proven. | MVP under a deadline |
| `hardened` | Plus: the gates hold, mutants die, the spec is graded, a human validated what needed validating. | mature project, anything load-bearing |

The per-level deferral list is then *derived* from the promise rather than invented, and a reader of an artifact knows what its green means without reading the project's config.

---

## Calibration

Three guesses would have undone the one thing this repo does better than most: every threshold in it carries its calibration data. So the cycle presets are derived from the same corpus that calibrated `max_family_cycles`, re-measured for this work.

**Corpus.** Every orchestrator project on this machine: 9 projects, **266 specs** (258 with a countable `## Functional requirements` section), **251 run families** carrying at least one code review, 605 attributed `CR` artifacts, 400 `QA` reports, 186 `EVAL` reports. Family membership resolves by the same provenance chain the family budget uses (`related_to` → `plan` → `spec`, normalised for the truncated and comma-suffixed ids that appear in older frontmatter).

It reproduces the published `max_family_cycles` calibration on a corpus 4× the size: median **2** reviews per family, and the 13-review cascade `max_family_cycles` was written for is still the maximum.

| Measure | n | median | p75 | p90 | p95 | max |
|---|---|---|---|---|---|---|
| code reviews per **family** | 251 | 2 | 3 | 5 | 6 | 13 |
| code reviews per **root plan** (the in-run figure) | 280 | 1 | 1 | 1 | 2 | 6 |
| QA reports per family | 251 | 1 | 2 | 3 | 4 | 9 |
| eval reports per family | 251 | 1 | 1 | 1 | 2 | 6 |
| numbered requirements per spec | 258 | 15 | 29 | 42 | — | 86 |

The two review rows are different measurements and the gap between them is the whole reason `max_family_cycles` exists: an in-run counter sees a median of 1 while the family it belongs to accumulates a median of 2 and a tail of 13, because the work escapes the run rather than the cap.

### The cycle presets, and what each one covers

| Knob | `sketch` | `delivery` | `hardened` | Derived from |
|---|---|---|---|---|
| `max_review_cycles` | `1` | `2` | `6` | in-run reviews per root plan: p90 = 1, p95 = 2, max = 6 |
| `max_qa_cycles` | `1` | `2` | `4` | QA per family: 66% ≤ 1, 88% ≤ 2, 95% ≤ 4 |
| `max_eval_cycles` | `0` (off) | `1` | `2` | eval per family: 92% ≤ 1, 98% ≤ 2 |
| `max_family_cycles` | `2` | `3` | `6` | reviews per family: median 2, p75 3, p95 6 |

**What each level's family budget actually covers, measured:** `sketch` at 2 completes 65% of the corpus's families inside its budget, `delivery` at 3 completes 80%, `hardened` at 6 completes 96% and fires on 10 families out of 251. `hardened` is today's shipped default, unchanged — which is the point: the highest level is not new behaviour, the lower ones are subtractions from it.

**The derived review budget is consistent at every level.** `review_budget = max(1, min(max_review_cycles, max_family_cycles − family_cr_count − eval_reserve))`, so on a fresh spec: `sketch` binds to 1, `delivery` to 2, `hardened` to 4 — and 99% of root plans in the corpus finished inside 4 reviews. No level binds to its `max(1, …)` floor by accident.

### What is deliberately *not* preset

- **`max_spec_requirements`** is a **scope** budget, orthogonal to rigor: a sketch and a hardened module can both be oversized, and the corpus's worst family is a **12**-requirement spec. Its existing calibration (off by default, `35` suggested) stands at every level.
- **`gate_wall_clock_minutes`** bounds a command's runtime, not the standard applied to it. Nothing in the artifact corpus records gate durations, so there is no data to calibrate it against and no preset is invented. `15` at every level.
- **`clarity_threshold`, `automation_level`, which gates block, e2e observation, human validation, `simplify`/`pr-review-report`, `parallelism`** are **promise-derived, not calibrated** — they follow from what the level claims, and the table below says so rather than dressing them in numbers.

### The promise-derived knobs

| Knob | `sketch` | `delivery` | `hardened` | Why |
|---|---|---|---|---|
| `automation_level` | `autonomous` | `autonomous` | `manual` | A throwaway does not earn an interview; a load-bearing change does. |
| `clarity_threshold` | unused | unused | `0.99` | Only read in `manual` mode. |
| G1 coverage | report | **blocks** | **blocks** | `delivery` claims the happy path is proven; coverage is the cheapest evidence of it. |
| G2 · G4 · G5 · G7 | report | report | **blocks** | Craft gates. `hardened` claims the gates hold; nothing below it does. |
| G6 mutation | off | off | **blocks**, with R3's cost preflight | The most expensive gate in the suite, and the only one whose promise is "the tests would notice". |
| e2e / outcome observation (R7) | report | report | required | |
| `spec-driven-eval` in-loop | off (`SKIPPED`, said out loud) | on | on | Follows `max_eval_cycles`. |
| human validation (N1 `/uat`) | none | flagged stories queued | flagged stories block `done` | |
| `simplify` / `pr-review-report` | skip | optional | run | |
| `parallelism` | `off` | `off` / `lanes` | as configured | |

**Invariant across all three levels:** the R1 banner lines, the R6 meter, R2's merge-base anchoring and its `INSTRUMENT MOVED` line, R4's `measurement` state on every gate result, R9's landed semantics, R10's spec reuse, and the suite running at all. What varies is whether a red *blocks* — never whether a result is *reported*.

---

## Resolutions — the first draft's open questions

### 1. Does `sketch` still require the suite to run, or only to exist?

**It runs, it reports, it never blocks.** A level that skips the suite has nothing to disclose, and the invariant then has nothing to be invariant about. Two supporting facts: `assertNonEmptyScope` already refuses to hand a passing verdict to a run that measured nothing, and R1's `Unmeasured:` line means a skipped suite must be printed anyway — at which point running it is usually cheaper than the disclosure avoiding it would require. Every gate runs at every level. Only the severity of what it finds moves.

### 2. Where does the level live on a roadmap story?

**A third orthogonal band, `rigor`, with the same mechanics as `system`** — a nullable story-level frontmatter key, a badge beside the release and system badges, derived up to phase and milestone with a `mixed` label where descendants differ, and editable on an item of any status. The precedent and its reasoning are ADR-0001.

Three deliberate differences from `system`:

1. **The vocabulary is fixed, not project-declared** — three values and `null`. There is no `rigor add`, no rename cascade, no orphan/`(unknown)` handling, because there is nothing a project can invent.
2. **It is not a matrix axis.** Release × system is already two dimensions; rigor renders as a per-release-row annotation and a qualification on `READY`, not as a third set of columns.
3. **Lowering it is a recorded event.** See resolution 5 and rule 2 below.

### 3. Does `product-manager` allow a mixed-rigor release?

**Yes, and it renders the mix rather than refusing.** A refusal would put the cheapest path to green through the release's declared floor — lower the floor, ship the release — which is the R2 problem two levels up. So: a release may declare a `rigor_floor`; PM never blocks on it; the matrix row prints the mix and, when a story is below the floor, `READY` is qualified and the below-floor stories are named in a non-suppressible departure list. That composes with R9's landed semantics rather than competing with it: R9 decides *whether the code reached the trunk*, the floor decides *what its green claims*, and a release needs both statements.

### 4. Does an ADR record the invariant disclosure set?

**Yes — ADR-0024**, and it is the whole safety property. Without it, nothing stops a future change from quietly moving an item out of the invariant set, which is the only way this feature turns into the thing the audit warns about.

### 5. Naming check against the repo's existing vocabulary

Done, and it changed the design: `tier` collided with the roadmap's release-band verbs and with `spec-driven-eval`'s test classes, so the key is `rigor` (see *Naming* above). The three level names are clear: `sketch` appears nowhere; `hardened` appears once, as prose; `delivery` appears three times, as prose. None collides with a release band (`mvp`, `v1.1`, `backlog`) or a status value (`READY_TO_COMMIT`, `READY_WITH_WARNINGS`, `DRAFT`, `DONE`, `STALLED`).

---

## Three rules that make or break it

1. **Rigor is chosen per story, defaulted per project.** A mature repo still has throwaway spikes; an MVP still has an auth module that deserves `hardened`. Roadmap stories carry the band; the project config sets the default; a CLI flag outranks both.
2. **Rigor is merge-base anchored, and lowering it is a loud, recorded event.** Otherwise dropping it becomes the cheapest path to green — the R2 instrument problem one level up, and the most likely way this feature turns into a liability. A branch that demotes itself to `sketch` to clear review is the version that eats you. **`rigor` is therefore in the anchored set** (`orchestrator/references/config.md` → *The anchored set*), it resolves from `$mb`, a working-tree demotion prints `INSTRUMENT MOVED — rigor hardened → sketch (loosening)` and does not take effect, and it is never selectable by the pipeline itself — only by the invoking human or by roadmap metadata.
3. **Rigor stamps travel with the artifact.** FINAL, QA report, PR body, story `done`, release matrix. `READY(mvp)` where nine stories ran `delivery` and three ran `sketch` is not one release, and the matrix must show it.

## Why the dependency runs this way

Adding rigor levels to a framework that cannot state what it delivered produces three flavours of the same silence. The invariant set *is* R1/R2/R3/R6 — so "the disclosure is rigor-invariant" has nothing to be invariant about until those land. Landing them first also made this work cheaper: the artifacts already carry the fields a rigor stamp attaches to, and R2 already built the anchoring and the `INSTRUMENT MOVED` line that rule 2 needs.

## Surfaces this touches

`orchestrator/SKILL.md` (Step 0b resolution, banner stamp) · `orchestrator/references/config.md` (the preset table, bounds, calibration) · `orchestrator/templates/*.md` (per-role behaviour) · `orchestrator/templates/config.template.json` · `roadmap` (story band, badge, matrix annotation) · `product-manager` (pass-through, PR stamp, log column) · `clean-code-gates` (block-vs-report) · `docs/adr/0024-rigor-levels-and-the-invariant-disclosure-set.md`.
