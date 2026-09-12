# Effort tiers — design note

**Status:** design recorded, not implemented. Deferred from the 2026-09-11 session so the measurement fixes it depends on could land first.
**Origin:** the owner's proposal, in session, to tune the pipeline's cost to the use case — a hackathon POC, an MVP under a deadline, and a mature project with loose deadlines should not run the same pipeline.
**Depends on:** `docs/measurement-alignment-audit-2026-09-11.md` — specifically R1, R2, R3, R6. See *Why the dependency runs this way* below.

---

## The proposal

One `tier` setting selects a calibrated preset over the knobs the framework already has, so the pipeline can be run at a cost proportional to what the work is worth, without abandoning its structure.

## The correction that shapes the design

The instinct was "the fully-fixed pipeline is the highest tier, and lower tiers defer parts of it." That is half right. The eleven audit recommendations split into two groups that must be treated differently:

| | **Invariant set** | **Tierable set** |
|---|---|---|
| What it is | telling the truth about what happened | how much work is done before shipping |
| Runtime cost | approximately zero | most of the run |
| Items | R1, R2, R3, R4, R6, R8, R9, R10 | R5, R7, N1, and *which* gates block |

R1 — the banner stating delivered / not delivered / unmeasured / cost — costs no time. At the cheapest tier it is **more** valuable, not less: a run that skipped the eval, skipped mutation and took eleven minutes needs to say so more loudly than a hardened run does. The same holds for R6 (the meter), R2 (instrument anchoring) and R3 (a bug is a bug at every tier).

> **Design rule: tiers scale the work, never the disclosure.**

The failure this rule prevents is a cheap-tier FINAL that reads almost identically to a hardened-tier FINAL. That is P9 — *unmeasured must never be byte-identical to pass* — lifted from the gate level to the tier level. Cheap green and expensive green must not look alike, or in three months nobody can tell which was which.

## Naming: promise, not effort

Do not name the tiers `low` / `medium` / `high effort`. That makes effort the unit, which is the failure the source article is about. Name each tier by what a green run at that tier **claims**:

| Tier | The promise a green run makes | Typical use |
|---|---|---|
| `sketch` | It runs. Nothing is claimed about quality. | POC, hackathon, spike, throwaway |
| `delivery` | It does what the story's Acceptance says, and the happy path is proven. | MVP under a deadline |
| `hardened` | Plus: the gates hold, mutants die, the spec is graded, a human validated what needed validating. | mature project, anything load-bearing |

The per-tier deferral list is then *derived* from the promise rather than invented, and a reader of an artifact knows what its green means without reading the project's config.

## What varies, mapped to knobs that already exist

Every key below is already in `.orchestrator/config.json` (see `orchestrator/templates/config.template.json`) or in `.cleancode-gates.json`. A tier is a named preset over them plus a promise sentence — not new machinery.

| Knob | `sketch` | `delivery` | `hardened` |
|---|---|---|---|
| `automation_level` | `autonomous` | `autonomous` | `manual` |
| `clarity_threshold` | low / unused | mid | 0.99 |
| `max_review_cycles` | 0–1 | 2 | full |
| `max_qa_cycles` | 1 | 2–3 | 5 |
| `max_eval_cycles` | 0 (`SKIPPED`, and the banner must say so) | 1 | 2 |
| `max_family_cycles` | tight | mid | 6 |
| G1 coverage | report | blocks | blocks |
| G2 / G7 | report | report | block |
| G6 mutation | off | off | blocks, with the cost preflight (R3) |
| e2e / outcome observation (R7) | report | report | required |
| spec-driven-eval in-loop | off | on | on |
| human validation (N1 `/uat`) | none | flagged stories queued | flagged stories block `done` |
| `simplify` / `pr-review-report` | skip | optional | run |
| `parallelism` | `off` | `off` / `lanes` | as configured |

**Invariant across all three tiers:** the R1 banner lines, the R6 meter, R2's merge-base anchoring, R4's `measurement` state on every gate result, R9's landed semantics, and the suite running at all — what varies is whether a red *blocks*, never whether the result is *reported*.

## Three rules that make or break it

1. **Tier is chosen per spec or story, defaulted per project.** A mature repo still has throwaway spikes; an MVP still has an auth module that deserves `hardened`. Roadmap stories carry a tier field; the project config sets the default; a CLI flag outranks both.
2. **Tier is merge-base anchored, and lowering it is a loud, recorded event.** Otherwise dropping the tier becomes the cheapest path to green — the R2 instrument problem one level up, and the most likely way this feature turns into a liability. A branch that demotes itself to `sketch` to clear review is the version that eats you. Tier must never be selectable by the pipeline itself, only by the invoking human or by roadmap metadata.
3. **Tier stamps travel with the artifact.** FINAL, QA report, PR body, story `done`, release matrix. `READY(mvp)` where nine stories ran `delivery` and three ran `sketch` is not one release, and the matrix must show it.

## Calibration

Do not invent the preset numbers. The same corpus that calibrated `max_family_cycles` to 6 — 218 specs and 63 run families on this machine (`orchestrator/references/config.md` → `max_family_cycles`, `max_spec_requirements`) — can derive what each tier's caps actually need to be. Three guesses would undo the one thing this repo does better than most: every threshold in it currently carries its calibration data.

## Why the dependency runs this way

Tiering a framework that cannot state what it delivered produces three flavours of the same silence. The invariant set *is* R1/R2/R3/R6 — so "the disclosure is tier-invariant" has nothing to be invariant about until those land. Landing them first also makes the tier work cheaper: the artifacts will already carry the fields a tier stamp attaches to.

## Open questions for the implementing session

- Does `sketch` still require the suite to run, or only to exist? (Recommendation: run and report; never block.)
- Where does the tier field live on a roadmap story — frontmatter key, or a release-band-style orthogonal band?
- Does `/product-manager` allow a mixed-tier release, or refuse to open a release PR until every story reaches the release's declared floor?
- Does an ADR record the tier-invariant disclosure set, so a future change cannot quietly move an item from invariant to tierable? (Recommendation: yes — that ADR is the whole safety property.)
- Naming check: `sketch` / `delivery` / `hardened` against the repo's existing vocabulary (`READY_TO_COMMIT`, `READY_WITH_WARNINGS`, release bands `mvp` / `v1.1` / `backlog`) — avoid a tier name colliding with a release band.

## Surfaces this touches

`orchestrator/SKILL.md` (Step 0b resolution, banner stamp) · `orchestrator/references/config.md` (the preset table, bounds, calibration) · `orchestrator/templates/*.md` (per-role tier behaviour) · `orchestrator/templates/config.template.json` · `roadmap` (story tier field, matrix display) · `product-manager` (tier pass-through, PR body stamp) · `clean-code-gates` (block-vs-report per gate) · a new ADR.
