# ADR-0024 — Rigor levels scale the work; the disclosure set is invariant

- **Status:** Accepted
- **Date:** 2026-09-12
- **Skills affected:** `orchestrator` (`SKILL.md` → Step 0b resolution and the Step 7b banner stamp; `references/config.md` → the `rigor` key, the preset table, *The anchored set*; `templates/config.template.json`); `clean-code-gates` (`--rigor`, the anchored `rigor` field, block-vs-report demotion); `product-manager` (pass-through, PR stamp, log column); `roadmap` (the `rigor` band, its badge, the release-matrix annotation).
- **Source finding:** `docs/measurement-alignment-audit-2026-09-11.md` (P2, P6, P9) and `docs/effort-tiers-design-note.md`. The presets are calibrated against 258 specs and 251 run families on this machine; the calibration is in the design note, not restated here.
- **Precedent:** ADR-0001 (`orthogonal-system-band`) for the band mechanics; the two-trust-anchors invariant in `PROJECT-CONTEXT.md` and `orchestrator/references/config.md` → *The anchored set* for the anchoring.

## Context

One pipeline ran at one standard. A hackathon POC, an MVP under a deadline and a
load-bearing auth module all drew the same six review cycles, the same mutation gate and
the same interview, so the framework was either too expensive for the first or too cheap
for the third, and in practice people reached for the only lever available: turning
individual gates off, per project, permanently, with nothing recording that they had.

`rigor` replaces that with three named levels over knobs that already exist. The risk it
creates is obvious and worth stating plainly: **a selectable standard is a selectable
verdict.** An agent — or a person under deadline — that can lower the bar has a cheaper
path to green than fixing the code, and the audit's central finding is that this pipeline
takes the cheapest path to a green number every time, not out of malice but because the
number is what it was told to reach.

Two properties have to hold or the feature is a liability:

1. Lowering the standard must be *impossible to do silently*, and impossible to do from
   inside the change being judged.
2. A cheap green and an expensive green must not produce the same artifact.

## Decision

### 1. Rigor scales the work; it never scales the disclosure

Every level runs every gate and reports every result. What a level changes is whether a
finding **blocks** — never whether it is **measured**, and never whether it is **said**.

The **invariant disclosure set** — required identically at `sketch`, `delivery` and
`hardened`:

| Item | Where |
|---|---|
| `Delivered: {m} / {t}` and the `Not delivered` detail | orchestrator Step 7b banner, PM PR body |
| `Unmeasured:` — every gate that did not produce a verdict | Step 7b banner, QA report, PM PR body |
| `Instrument moved:` and the `INSTRUMENT MOVED` line | Step 0b, gate runner stderr and `report.md`, Step 7b banner, PM PR body |
| `Run cost:` and the per-boundary meter | every terminal banner; PM's `cost` column and queue total |
| `Spec:` on every terminal banner | every terminal banner (R10's re-entry anchor) |
| `measurement.state` on every gate result | `clean-code-gates` `report.json`, QA gate table |
| the `rigor` stamp itself, and every finding it demoted | Step 7b banner, `report.json`, `report.md`, PM PR body, story audit log |
| the suite running at all | every level |

**Moving an item out of this set is a change to this ADR, not a change to a preset.** That
sentence is the safety property; the rest of this document exists to make it enforceable.

### 2. `rigor` is in the merge-base anchored set

It resolves from `$mb:.orchestrator/config.json`, exactly like `max_eval_cycles` and
`parallelism`, and for the same reason one level up: a branch that can demote itself to
`sketch` has a one-line path past every gate in the change under review. A working-tree
demotion prints

```
INSTRUMENT MOVED — rigor hardened → sketch (loosening) — measured against merge-base values
```

and **does not take effect**. The run happens at the merge-base level. `.cleancode-gates.json`
carries the same field under the same anchoring, so the gate runner cannot be demoted
independently of the pipeline that calls it.

### 3. Rigor is never selectable by the pipeline

Only two sources may set it: the **invoking human** (`--rigor`, which carries run-time
authority and therefore outranks the file, as every CLI arg does) and **roadmap metadata**
(a story's band, written by the `roadmap` skill on a planning branch). No role, no
subagent, and no remediation loop may write it. A role that finds the level too low
records that as a finding; it does not raise the level, and it may never lower one.

### 4. A demoted finding is kept, marked, and counted

`sketch` and `delivery` do not silence gates — they demote `blocker` findings to
`warning` for the gates their promise does not cover. The finding keeps its file, line,
rule and fix hint, gains `demotedFrom: "blocker"` and the `rigor` that demoted it, and the
report summarises the set. A run whose exit code is 0 because of a demotion says so in the
line above the code.

### 5. The default is `hardened`, and it is today's behaviour byte for byte

An absent `rigor` key resolves to `hardened`, whose presets are the shipped defaults. No
existing project changes behaviour by upgrading, and the feature is a set of subtractions
from a known state rather than a new state of its own.

### 6. The three levels are named by their promise, and the key is not called `tier`

`sketch` / `delivery` / `hardened` name what a green run **claims**, not how much effort it
spent — naming them by effort would make effort the unit, which is the failure the source
article is about. The axis is `rigor` because `tier` is already the roadmap's word for the
release band (`re-tier`, `un-tier`, `(untiered)`) and `spec-driven-eval`'s word for its
test classes.

## Alternatives considered

**A single `strict: true|false` boolean.** Rejected: two states cannot express the MVP
case, which is the one that motivated the work — an MVP wants coverage to block and
mutation to be off, and a boolean has no room for that.

**Per-gate configuration only, no named levels.** This already exists — it is what people
were doing, and it is what produced permanently disabled gates with no record of why. A
named level with a written promise is auditable; sixteen independently-edited keys are
not.

**Refusing to open a release PR below the declared floor.** Rejected: it puts the cheapest
path to green through the floor itself. PM renders the mix and qualifies `READY` instead.

**Letting a role raise the level when it judges the work load-bearing.** Rejected under
decision 3. A pipeline that can set its own standard has no standard, and the symmetric
argument — "it can only raise it" — fails the moment raising is what unblocks a stuck loop.

**Naming the levels `low` / `medium` / `high`.** Rejected under decision 6.

## Consequences

- **Reds go up at `hardened` and down at `sketch`, and that is the feature.** Comparing
  gate-pass rates across levels is meaningless, and any future dashboard that does it is
  measuring the level, not the code.
- **A project that never sets `rigor` sees no change at all** — same defaults, same gates,
  same banners plus the stamp.
- **The stamp is now part of every artifact's identity.** A FINAL without one is a FINAL
  from before this ADR, not a `hardened` run; readers must not infer the level from silence.
- **`max_spec_requirements` and `gate_wall_clock_minutes` stay outside the presets** — the
  first is a scope budget orthogonal to rigor, the second has no calibration data. Adding
  either to a preset later requires the data first, per this repo's standing rule that
  every threshold carries its calibration.
- **The invariant set will be under pressure.** The first time a `sketch` run's banner is
  called noisy, the proposal will be to trim it. That proposal is a change to decision 1.
