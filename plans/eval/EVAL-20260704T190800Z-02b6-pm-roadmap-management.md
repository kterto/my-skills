---
id: EVAL-20260704T190800Z-02b6
status: PASS
plan: FEAT-20260704T182718Z-2117
created_at: 2026-07-04T19:10:21Z
---

# Spec-Driven Eval — PM Roadmap-Management Command Surface (doc-only)

**SPEC (ground truth):** `plans/specs/SPEC-20260704T182442Z-ab87-pm-roadmap-management.md`
**Source design (context):** `docs/superpowers/specs/2026-07-04-pm-roadmap-management-design.md`
**Deliverable:** markdown skill sources under `plugins/my-skills/skills/roadmap/` and `plugins/my-skills/skills/product-manager/`.

## Methodology adaptation (doc-only deliverable)

This is a **documentation / skill-authoring** change with **no runtime code and no test suite**. The standard spec-driven-eval methodology is applied with these stated adaptations:

- **Tests axis `T` = n/a — doc-only, no runtime surface.** There is nothing to execute or assert; `T` is not scored and not fabricated.
- **Engineering Gates `G` (build/lint/unit/e2e) = N/A** — no build/lint/test target exists for markdown skill sources. Not fabricated.
- Each SPEC functional requirement (FR) is scored as an AC with **I-checks only**: a check is **MET** only if the deliverable markdown **correctly and completely specifies** that behavior/rule, cited with `file:line` evidence. **UNMET** requires a recorded search (grep terms + files inspected) confirming genuine absence.
- **`AC_score = I`** (since `T` is n/a). **`Story_score` / `Final` = mean of AC_scores**, all FRs at equal weight (the SPEC assigns no P0/P1/P2 priority labels to individual FRs — priority `ASSUMED equal`, recorded here as an assumption).
- Standard grade bands apply. Also reported: **Scope Adherence `S`** and any requirement specified inconsistently across files.

## Diff surface (search scope)

Tracked-file changes (`git diff HEAD --name-only -- plugins/my-skills/skills/`) + two new untracked files:

**roadmap skill**
- `plugins/my-skills/skills/roadmap/SKILL.md`
- `plugins/my-skills/skills/roadmap/references/directory-layout.md`
- `plugins/my-skills/skills/roadmap/references/item-schema.md`
- `plugins/my-skills/skills/roadmap/references/sync-and-reeval.md`
- `plugins/my-skills/skills/roadmap/references/mutation-ops.md` *(new / untracked)*
- `plugins/my-skills/skills/roadmap/templates/{roadmap,milestone,phase}-readme.template.{md,html}`
- `plugins/my-skills/skills/roadmap/templates/user-story.template.{md,html}`

**product-manager skill**
- `plugins/my-skills/skills/product-manager/SKILL.md`
- `plugins/my-skills/skills/product-manager/references/scope-resolution.md`
- `plugins/my-skills/skills/product-manager/references/git-flow.md`
- `plugins/my-skills/skills/product-manager/references/roadmap-management.md` *(new / untracked)*
- `plugins/my-skills/skills/product-manager/templates/pr-body.template.md`

All 8 roadmap templates were inspected for the release badge / grouping / per-release progress requirements.

## Assumptions

- **Judge ≠ author:** the deliverable was authored in a separate session; this eval is read-only over the subject (no files modified).
- **Priority:** SPEC does not label individual FRs P0/P1/P2, so all 28 FRs are weighted equally (`ASSUMED`).
- **Baseline:** no prior `_ac-baseline.md` exists for this SPEC; the 28-FR checklist below is the frozen baseline for future re-runs.

---

## I-check checklist (28 FRs — the sanctioned requirement set)

| FR | Requirement (abbrev.) | Verdict | Evidence (`file:line`) |
|---|---|---|---|
| 1 | Every item supports optional `release: string\|null`; null/absent=untiered, `backlog`=parked, other=named train | MET | `roadmap/references/item-schema.md:16,44`; `mutation-ops.md:66` |
| 2 | `release` orthogonal to `status`, editable on **any** status incl. done/superseded | MET | `item-schema.md:44`; `mutation-ops.md:42-43,67` |
| 3 | `roadmap.lock.json` gains **ordered** `releases[]`; order = render + "runs before"; `backlog` reserved, never listed | MET | `directory-layout.md:53,66,77`; `item-schema.md:44` |
| 4 | Each lock item entry gains `release` (`string\|null`) alongside `status` | MET | `directory-layout.md:56,71` |
| 5 | Implicit-create: first assignment of a new band appends to `releases[]` in order | MET | `directory-layout.md:78`; `mutation-ops.md:66,109` |
| 6 | Absent/empty `releases[]` on legacy = empty; no migration | MET | `directory-layout.md:79`; `SKILL.md:141` |
| 7 | Release change appends exactly **one** row to the 4-col audit table (status unchanged, actor tag, `release: <old>→<new>` + verb attribution); no new column | MET | `item-schema.md:119-136` (esp. :121,:128,:133,:136) |
| 8 | Staged-diff markers extend re-eval set with `± release`: `+ new / ~ changed / ! superseded / ± release` | MET | `mutation-ops.md:23-35`; `roadmap/SKILL.md:153` |
| 9 | `set-release`: phase/milestone id cascades to not-done descendants + derived `[mvp]`/`[mixed]` badge; story id sets directly; any status | MET | `mutation-ops.md:48-68` |
| 10 | `ingest-spec <path>`: explicit location-agnostic path; targeted re-eval limited to spec; immutable to done; new items default `release: null` | MET | `mutation-ops.md:70-78`; `sync-and-reeval.md:77-79` |
| 11 | `reorder <ids>` (or `--after`): change `sequence`/`depends_on` of **not-done** only | MET | `mutation-ops.md:80-86` |
| 12 | `revise <id>`: retitle/re-scope/adjust acceptance/deps; **not-done** only; split/merge via new stable IDs + supersede, never renumber/touch done | MET | `mutation-ops.md:88-95` |
| 13 | `release <list\|reorder <names>\|rename <old> <new>>`: manage registry order + names | MET | `mutation-ops.md:97-104` |
| 14 | Immutability reaffirmed: structural edits not-done only; done/superseded keep id/structure/history; only band may change | MET | `mutation-ops.md:38-45`; `item-schema.md:44` |
| 15 | `re-eval` and `ingest-spec` **preserve** existing `release` values | MET | `sync-and-reeval.md:73-79`; `mutation-ops.md:77` |
| 16 | PM verbs: resolve selection → cut `pm/roadmap-<verb>-<slug>` off starting branch → invoke op → commit `docs(roadmap): <verb>` → push → PR | MET | `pm/SKILL.md:104-131`; `roadmap-management.md:30-41`; `git-flow.md:212-254` |
| 17 | Reject at gate → PM discards empty branch, returns to starting branch | MET | `roadmap-management.md:67-75`; `git-flow.md:256-265`; `pm/SKILL.md:131` |
| 18 | Verb mapping (assign→set-release; park/unpark sugar; add-spec→ingest-spec; reorder; revise; release) | MET | `pm/SKILL.md:114-123`; `roadmap-management.md:15-24` |
| 19 | `new-spec [raw idea]`: brainstormer writes `plans/specs/SPEC-{id}.md` → STOP; does not auto-append | MET | `pm/SKILL.md:137-144`; `roadmap-management.md:79-87` |
| 20 | Selection = ids/globs **and** natural language, resolved against tree; exact resolved id set shown before applying | MET | `roadmap-management.md:44-53`; `pm/SKILL.md:127` |
| 21 | Confirmation gate on every mutation; `--yes` skips it | MET | `roadmap-management.md:57-64`; `pm/SKILL.md:133-135` |
| 22 | `complete <scope>` accepts a **release name**; runs every not-done story in that band across **all** milestones, topo-ordered | MET | `scope-resolution.md:33,36-38`; `pm/SKILL.md:146-148` |
| 23 | Active-scope runs (`roadmap`/`<milestone>`/`<phase>`) **exclude `backlog`** | MET | `scope-resolution.md:30-32,40-42` |
| 24 | Existing `complete` machinery unchanged; only scope resolver + backlog filter added | MET | `scope-resolution.md:38` ("ordered by the existing Ordering algorithm … exactly as any other scope"); `pm/SKILL.md:148` |
| 25 | Two-gated raw-idea flow: `new-spec`→STOP→`add-spec`→`ingest-spec`→staged append→approve→branch+PR | MET | `roadmap-management.md:79-87`; `pm/SKILL.md:137-144` |
| 26 | Context-gate seed list (Step 3) adds `plans/specs/*` alongside `docs/superpowers/specs/*`; ingest-spec stays path-agnostic | MET | `roadmap/SKILL.md:67` |
| 27 | All **8** templates render a release badge (`[mvp]`/`[v1.1]`/`[backlog]`/none; `[mixed]` derived on phase/milestone) | MET | md: `user-story:18`, `phase-readme:15`, `milestone-readme:14`, `roadmap-readme:35`; html: `user-story:534`, `phase-readme:499`, `milestone-readme:492`, `roadmap-readme:558,626-635` |
| 28 | Index/milestone/phase READMEs gain release grouping/filter + per-release progress (in addition to rollup) | MET | md: `roadmap-readme:6,38`, `milestone-readme:27,36`, `phase-readme:28,38`; html: `roadmap-readme:543,578`, `milestone-readme:520,554`, `phase-readme:530,569` |

**I totals:** 28 / 28 I-checks MET. `I = 1.00` for every FR ⇒ every `AC_score = 1.00`.

## Tests axis

**`T` = n/a — doc-only, no runtime surface.** No unit/e2e/integration coverage is applicable to markdown skill sources; not scored, not fabricated.

## Engineering Gates `G`

**N/A — doc-only deliverable.** No `build`/`lint`/`unit`/`e2e` target exists for skill markdown. No gate run, no `Adjusted Final` (no `✗`). Not fabricated.

## Scope Adherence `S` — `pass`

Every built behavior traces to a SPEC FR; nothing untraceable or out-of-scope was authored. Non-goals were honored:

- **No standalone `split`/`merge` verbs** (non-goal) — both folded under `revise`. Evidence: `mutation-ops.md:95` ("There is **no standalone `split`/`merge` op**").
- **No new `pm.config.json` keys** (non-goal) — PM config still exposes only `conservative` + `base_branch`. Evidence: `pm/SKILL.md:44-49`. (`--yes` is a CLI flag required by FR21, not a config key.)
- **No runtime/code, no orchestrator changes** — every op reaffirms "never commit / never run the orchestrator". Evidence: `mutation-ops.md:16-17`.
- **Backward compatibility** — nullable band + lazy `releases[]`, no migration. Evidence: `directory-layout.md:79`; `mutation-ops.md:107-109`.

No PRD-boundary violation, no rogue build, no plan-drift (spec-sanctioned behavior left unbuilt). `S = pass`.

## Reported beside `Final` (not folded in)

- **Robustness `R`:** n/a (no tests).
- **Elicitation `E`:** n/a — this SPEC is itself the derived artifact; no separate `spec.md`/`tasks.md` to grade for extraction.
- **Test Distribution `D`:** n/a (no tests).

## Consistency note (non-scoring)

One cross-document wording nuance, recorded for transparency — it does **not** lower any I-check because the behavior is completely and correctly specified:

- **FR7 evidence-string literal.** SPEC FR7 gives the example `evidence = release: <old>→<new> (/product-manager <verb>)`. The deliverable adopts a reconciled canonical form `release: <old>→<new> (set-release)` with the PM verb as an optional attribution suffix `… (set-release via /product-manager park)` (`item-schema.md:128,133`). This is a deliberate reconciliation of the invariant "roadmap is the sole writer; PM is a caller that may be absent when `set-release` is invoked directly." It **subsumes** the SPEC's example (the verb is still recorded) and additionally defines the no-caller case, so it is correct and complete. `item-schema.md` and `mutation-ops.md` agree with each other, so this is not an internal inconsistency — only a wording expansion relative to the SPEC's illustrative example.

## Roll-up (computed via script)

```
FR count: 28
Sum AC_scores: 28.0000
Final (mean, equal weight): 1.00
Band: Spec-complete
```

- **Final = 1.00** (mean of 28 equally-weighted AC_scores, each `= I = 1.00`).
- **Adjusted Final:** not applicable (no gate `✗`).
- **Band:** **Spec-complete** (`Final ≥ 0.90`).

## Ranked gaps + fixes to reach 1.00

**None.** `Final` is already 1.00 and `S = pass`. No functional requirement is unspecified, incompletely specified, or contradicted across files.

Optional polish (does not affect the grade):
- If exact literal fidelity to the SPEC's FR7 example is desired, add a one-line note in `item-schema.md` explicitly mapping `(set-release)` ↔ the SPEC's `(/product-manager <verb>)` example so a reader who diffs against the SPEC sees the reconciliation called out. Purely cosmetic.

## Status

`Final = 1.00 (≥ 0.90)` and `S = pass` ⇒ **status: PASS**.
