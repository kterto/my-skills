---
id: FEAT-20260819T130106Z-c55f
title: Schema-validator keyword coverage and Prime sibling-skill agent-type ports
type: feat
status: DONE
created_at: 2026-08-19T13:04:31Z
updated_at: 2026-08-19T13:52:30Z
cycle: 0
related_to: SPEC-20260819T125322Z-51a9, SPEC-20260819T052229Z-3d97, FEAT-20260819T053237Z-236f
---

**Related:** [SPEC-20260819T125322Z-51a9](../specs/SPEC-20260819T125322Z-51a9-validator-keywords-prime-sibling-ports.md)

## Overview

Two independent defects from the Prime-agent-distribution review, executed as two lanes that share no file, no command, and no failure mode.

**Lane A** closes the `clean-code-gates` schema-test validator's keyword gap: `report.schema.json` uses ten assertion keywords, the validator honours seven, so `blockers: -5`, `gate: "NOTAGATE"`, `generatedAt: "not-a-date"` and `line: 0` all validate clean. One of these (`line >= 1`) is a genuine regression — commit `6ab2224` carried the check explicitly and the generic rewrite dropped it. Lane A adds the three keywords, pins the dropped check with a named negative test, refactors `checkNode`/`checkObject` (already over this project's own G2 thresholds) rather than worsening them, and adds a coverage guard that turns "the validator honours N of M" from an invisible gap into a failing test.

**Lane B** extends the established Prime overlay treatment to the two sibling skills that still instruct the session to resolve a host agent type: `roadmap` (one scan-child site) and `simplify` (three sites — dispatch, fallback trigger, and the summary's mode label). Lane B has **no executable path**: its acceptance evidence is the emitted text of the regenerated `prime-agent/skills/` tree, not merely that `--check` exits 0.

Verified this session, against the tree: `npm test` in `clean-code-gates` = **225 pass / 0 fail**; `build-prime-agent.mjs --check` = exit 0, `11 skills, 154 files`; `prime-agent && npm test` = exit 0; the host-vocabulary census returns exactly **6** hits — 4 known-good prohibition lines plus the 2 sites this plan fixes.

## Acceptance Criteria

### Lane A — validator keyword coverage

1. A report whose `summary.blockers` is `-5` produces at least one violation (`minimum`).
2. A report whose `gates[0].gate` is `"NOTAGATE"` produces at least one violation (`pattern`, `^G[1-9][0-9]*$`).
3. A report whose `generatedAt` is `"not-a-date"` produces at least one violation (`format: date-time` asserted, not annotated).
4. A report whose `gates[0].findings[0].endLine` is `0` produces at least one violation — proving the optional-property path is walked, not only required properties.
5. A report whose `gates[0].findings[0].line` is `0` produces at least one violation, asserted by an explicitly named negative case whose label identifies it as the restored check (FR-A5: pinned by a test, not by the implementation alone).
6. The validator raises an error on an **unrecognized** `format` value rather than ignoring it. Provable by a unit-level assertion, not only by inspection.
7. A keyword-coverage guard test walks `report.schema.json`, collects every keyword appearing in a schema position, and fails when any keyword is neither in the validator's implemented set nor in an explicit annotation/meta allow-list. The implemented set is **derived from the implementation** (e.g. `Object.keys(handlers)`), never a hand-maintained literal.
8. The guard's walk is schema-aware: keys under `properties` are property names, not keywords, and are not counted as keywords; `items`, `properties.*` values are descended into; `required`/`enum` array contents and `additionalProperties: true|false` booleans are not descended into as schemas.
9. The guard fails (red) if a keyword is added to `report.schema.json` that the validator does not implement. Demonstrated once, in-session, by a temporary in-memory schema fixture — **not** by editing `report.schema.json`, which is out of scope.
10. `checkNode` cyclomatic complexity ≤ **8** and `checkObject` max block-nesting depth ≤ **2** (the project's own `defaults.cjs` `THRESHOLDS.G2` values). Hard floor if the target is missed: no worse than the measured baseline (`checkNode` 11, `checkObject` 3), with the miss and its reason recorded in the Progress Log.
11. The `checkNode` docblock is true after the change: it either enumerates exactly the honoured keywords, or is restated in a form that cannot go stale (e.g. deferring to the handler table).
12. `npm test` in `plugins/my-skills/skills/clean-code-gates/` reports **≥ 225 pass / 0 fail**. No existing test is deleted or weakened; any changed existing assertion is called out by name in the Progress Log with the reason it was the thing being corrected.
13. `git diff --numstat` shows **zero** changed lines under `plugins/my-skills/skills/clean-code-gates/src/`, `bin/`, `schema/`, `defaults.cjs`, `README.md`, and `SKILL.md`. The only Lane A file changed is `__tests__/schema.test.cjs`.

### Lane B — Prime sibling-skill ports

14. `prime-agent/overlays/roadmap.json` gains exactly one new `count: 1` replacement, rewriting the Step-1 scan site so the Prime port admits a read-only child with `handle = await rlm(prompt, name="context-scan")`.
15. The `roadmap` replacement text explicitly forbids the scan child from writes and mutating commands (Prime read-only-child rule), and states the inline fallback: when no child can be admitted, the parent performs the same scan inline and continues to the question rounds. The confidence loop and `context_threshold` gate are described as unchanged.
16. `prime-agent/overlays/simplify.json` gains **three** new `count: 1` replacements, covering source `SKILL.md` lines **59** (dispatch), **61** (fallback trigger), and **85** (summary mode label).
17. The `simplify` dispatch replacement admits the five angles together as independent read-only RLM children (`await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`) and preserves every existing bound verbatim in substance: one angle per child, resolved scope + diff passed in, "they report findings; they do not edit".
18. The `simplify` fallback replacement preserves that skill's **own** single-pass inline answer — including "Do not drop an angle for lack of fan-out" and the summary-disclosure requirement — restating only the trigger as "when the session cannot admit RLM children". The orchestrator's fallback wording is **not** copied in.
19. The `simplify` mode-label replacement removes the host-mechanism parenthetical `(no subagent fan-out available)` in favour of a Prime-accurate phrasing.
20. `node scripts/build-prime-agent.mjs` runs clean and `node scripts/build-prime-agent.mjs --check` exits **0**, reporting `prime-agent/skills is up to date (11 skills, 154 files)` — the file count is unchanged.
21. `cd prime-agent && npm test` exits 0 (installer + build-parity).
22. **Census assertion (Lane B's acceptance evidence).** After regeneration, a grep of `prime-agent/skills/` for `` `Explore` ``, `Explore`/, `subagent_type`, `general-purpose` returns **exactly four** hits, all prohibition/protocol text: `explain-codebase/SKILL.md:17`, `explain-codebase/SKILL.md:77`, `orchestrator/SKILL.md:17`, `orchestrator/SKILL.md:632`. Zero resolution sites.
23. **Second census term.** A grep of `prime-agent/skills/roadmap/SKILL.md` and `prime-agent/skills/simplify/SKILL.md` for the lowercase word `subagent` returns **zero** hits. Baseline is roadmap:58 and simplify:67/69/93 — the first census term alone does not catch simplify's lines 69 and 93.
24. `plugins/my-skills/skills/roadmap/SKILL.md` and `plugins/my-skills/skills/simplify/SKILL.md` are byte-identical to HEAD, proven with `git diff --numstat` (zero rows) — never with bare `diff` (see Technical Notes).
25. `prime-agent/README.md`'s *How this distribution is built* section no longer claims the RLM dispatch protocol lives only "in `orchestrator`". It either names every skill carrying a dispatch replacement, or is generalized so it cannot go stale again.
26. `prime-agent/skills/roadmap/SKILL.md` and `prime-agent/skills/simplify/SKILL.md` are **not** hand-edited. Provable because the tree is regenerated by the build and `--check` exits 0 afterwards.
27. `prime-agent/overlays/explain-codebase.json` and `prime-agent/skills/explain-codebase/**` are untouched (`git diff --numstat` shows zero rows) — the cited match there is a verified false positive.

### Cross-cutting

28. Every byte-identity and difference claim in this plan's verification is made with `cmp`, `shasum`, `git diff --numstat`, or `git diff --no-index`. Zero uses of bare `diff` exit status anywhere in the executed verification.
29. Both lanes' floors hold simultaneously at the end: `clean-code-gates` ≥ 225 pass / 0 fail, `build-prime-agent.mjs --check` exit 0, `prime-agent && npm test` exit 0.

## Out of Scope

- **`src/validate-report.cjs` / runtime schema validation on the report-writing path** (spec D2). It changes the shipping CLI's observable contract — a one-way door with no mandate here. Deferred deliberately, not omitted. Nothing in this plan touches `src/` or `bin/`.
- **`explain-codebase`** — any file of it, plugin-side or overlay-side (spec D1, AC-27). Its two census matches are Prime prohibition text; its real dispatch site was already ported by the existing bug-11 replacement.
- **`AskUserQuestion` / `question` porting** in `roadmap/SKILL.md:59` or anywhere else (spec D7). Different defect class; `preamble.md` already covers it generically.
- **`roadmap/SKILL.md:79` and `roadmap/references/item-schema.md:60`** ("the orchestrator subagents never see this conversation") — verified non-sites (spec D8). The statement stays true under Prime, where those children are RLM children. Do not churn them.
- **`report.schema.json`, `defaults.cjs`, any threshold, any new gate.** The schema is correct; the validator is what is behind it.
- **`simplify`-style cleanup of adjacent validator code** beyond the refactor AC-10 mandates.
- **Hand-editing `prime-agent/skills/`.** Generated tree — `rmSync` + full rewrite. All Lane B edits land in overlays.
- **opencode ports.** Neither `roadmap` nor `simplify` has a `.opencode/skills/` override port (verified: only `pr-review-report` and `spec-driven-eval` do), and neither plugin source changes. `opencode-port-parity` does not apply.
- **Committing or pushing.** This pipeline ends at READY_TO_COMMIT.
- **Amending `.orchestrator/PROJECT-CONTEXT.md`.** Its *Commands* section predates `prime-agent/` and does not name that package's `npm test`. Noted as an observation below; fixing it is a separate decision, not this plan's.

## Technical Notes

### Verified baselines (measured this session — these are the floors)

| Signal | Baseline |
|---|---|
| `cd plugins/my-skills/skills/clean-code-gates && npm test` | 225 pass / 0 fail |
| `node scripts/build-prime-agent.mjs --check` | exit 0 — `prime-agent/skills is up to date (11 skills, 154 files)` |
| `cd prime-agent && npm test` | exit 0 — install ok, parity ok |
| Host-vocabulary census over `prime-agent/skills/` | 6 hits: 4 known-good + `roadmap/SKILL.md:58` + `simplify/SKILL.md:67` |
| `subagent` in generated `roadmap`/`simplify` | roadmap:58; simplify:67, 69, 93 |
| `checkNode` cyclomatic | 11 |
| `checkObject` max block depth | 3 |

### Tooling hazards — both reproduced in this session, both load-bearing

1. **Bare `diff` exits 0 on differing files** in this shell (proxied). `diff x1 x2` → exit 0; `cmp -s x1 x2` → exit 1; `git diff --no-index x1 x2` → exit 1. Therefore `diff a b && …` and `if diff …; then` **falsely report identical**. Use `cmp`, `shasum`/`md5`, `git diff --numstat`, or `git diff --no-index` for every identity claim (AC-28).
2. **Proxied `grep` truncates multi-file results.** Reproduced: `grep -n 'subagent' <roadmap> <simplify>` returned only roadmap's 2 matches and reported "2 matches in 1F", silently dropping simplify's three. A census that misses hits is worse than no census. Run the census **one file at a time**, or via `rtk proxy grep` / `git grep`, and cross-check the total hit count against the baseline table above.

### Lane A — the schema's actual keyword surface

`report.schema.json` uses, in schema position: `$schema`, `$id`, `title`, `description`, `type`, `required`, `additionalProperties`, `properties`, `const`, `enum`, `items`, `format`, `pattern`, `minimum`.

- **Assertion keywords = 10**: `type`, `required`, `additionalProperties`, `properties`, `const`, `enum`, `items`, `minimum`, `pattern`, `format`.
- **Implemented today = 7**. Missing: `minimum`, `pattern`, `format`.
- **Annotation/meta = 4**: `$schema`, `$id`, `title`, `description`. These belong in the guard's explicit allow-list. The guard must fail on any keyword in *neither* set — that is what makes it a guard rather than a filter.

Sites: `minimum` ×4 (`summary.blockers`, `summary.warnings`, `findings[].line`, `findings[].endLine`); `pattern` ×1 (`gates[].gate`); `format` ×1 (`generatedAt`).

**Guard walk subtleties (AC-8).** The walk must not treat property *names* as keywords. Keys of `properties` are names; `items` and each `properties.*` value are sub-schemas; `required` and `enum` array contents are values; `additionalProperties` may be a boolean (`true` at `thresholds` and `metric`, `false` elsewhere) and only descends when it is an object. Getting this wrong makes the guard either permanently red or permanently useless.

**`format` asserts, for `date-time` only** (spec D4). An unrecognized `format` value is itself a validator error (AC-6) — silently ignoring an unknown format re-opens exactly the gap being closed.

### Lane A — complexity measurement protocol

`clean-code-gates` ships zero dependencies; there is no `node_modules`, and `npx eslint` cannot resolve offline. So the numbers are counted by hand, **against the ESLint rule definitions**, and both before and after are recorded in the Progress Log so they are comparable:

- `complexity` = 1 + each `if` / `else if` / loop / `case` / `catch` / `&&` / `||` / `??` / ternary. Arrow callbacks count as their own function.
- `max-depth` = deepest nesting of block statements (`if`/`for`/`while`/`try`) inside one function body.

Baseline arithmetic (verified): `checkNode` = 1 + 2 (`!schema || typeof…`) + 1 + 2 (`'const' in … &&`) + 2 (`schema.enum &&`) + 1 (`Array.isArray`) + 1 (`schema.items`) + 1 (`TYPE_PREDICATES.object`) = **11**. `checkObject` = `for` → `if` = 2, then `if` → `for` → `if` = **3**.

A keyword-handler table keyed by schema keyword is the recommended shape (it composes with the derived implemented-set of AC-7) but is **not mandated** (spec D3). Any shape hitting the numbers and AC-7 qualifies.

### Lane B — where the Prime contract text goes

`roadmap.json` and `simplify.json` currently insert only `preamble.md` — neither carries a protocol block, unlike `orchestrator` (`protocol.orchestrator.md`) and `explain-codebase` (`protocol.explain-codebase.md`).

**Default ruling: keep the `rlm()` contract self-contained inside the replacement strings; add no new overlay block file.** Both skills have a single fan-out concept each, and `preamble.md` already establishes the Prime-port framing. **Permitted alternative:** if `simplify`'s dispatch replacement would otherwise run past one paragraph, add `prime-agent/overlays/protocol.simplify.md` and list it in `insertAfterFrontmatter` after `preamble.md`, mirroring `explain-codebase`'s shape. An overlay block file lives outside `prime-agent/skills/`, so it does not change the `154 files` count (AC-20). Whichever route is taken, AC-22/23 and the anchor counts are unaffected.

**Anchors are exact source strings.** `applyReplacements` splits on the literal `find`, counts occurrences, and hard-fails the build when the count differs from `count`. Copy each anchor verbatim from `plugins/my-skills/skills/{roadmap,simplify}/SKILL.md` and JSON-escape it (backticks are literal; backslashes and quotes are not). A mis-copied anchor fails the build loudly — which is the mechanism working, not a blocker to route around.

Source sites to anchor:
- `roadmap/SKILL.md:59` — `1. Spawn an \`Explore\`/\`explore\` subagent: …` (the numbered Step-1 list item; generated tree line 58).
- `simplify/SKILL.md:59` — `**Fan out when the host can.** …` (generated 67).
- `simplify/SKILL.md:61` — `**Otherwise run them inline.** When the host has no subagent tool, or cannot issue several tool calls in one message, …` (generated 69).
- `simplify/SKILL.md:85` — `Mode: 5-angle fan-out | single-pass inline (no subagent fan-out available)` (generated 93).

Precedents to mirror: `orchestrator.json`'s scan-child replacement (read-only clause + stable per-caller `name` + inline fallback) and `explain-codebase.json`'s bug-11 replacement (dispatch mechanism swapped, every bound below preserved).

### Lane B has no behavioural test — stated plainly

There is no executable path for Lane B and none can be written. `prime-agent/skills/` is generated markdown consumed by an agent runtime, not code this repo runs. `build-prime-agent.mjs --check` proves only that the tree matches what the overlays produce — it would pass just as happily on a wrong replacement. `prime-agent`'s `npm test` covers the installer and build parity, not the semantics of the emitted text. **Lane B's real verification is AC-22/23: the emitted text of the regenerated tree, read and grepped.** Per PROJECT-CONTEXT's *Test tooling* section, that is the correct verification mode for a doc-skill change, not a shortfall to apologize for.

### Truth-pass targets (the previous run's named blind spot)

The last run verified the documents it *edited* and never the documents it *invalidated* — an unamended file was confirmed `md5`-identical and mistaken for still-accurate. Two files here are made false by this change without their subject being touched, and each gets its own explicit re-read-for-truth task:

- **`checkNode`'s docblock** — enumerates the honoured keywords; a coverage claim drifting from actual coverage, i.e. the same defect class being fixed (AC-11).
- **`prime-agent/README.md`** — "the Prime RLM dispatch protocol **in `orchestrator`**" becomes false the moment `roadmap` and `simplify` carry dispatch replacements (AC-25).

If the implementation makes any further statement elsewhere false, the same rule applies: re-read it for truth, do not merely confirm it was not edited.

### Invariants carried from PROJECT-CONTEXT

- `clean-code-gates` is the only runtime gate in the repo; its suite runs **only** in that skill's directory and is never invoked against doc skills.
- Backward compatibility is mandatory: `roadmap` and `simplify` ship one host-generic source consumed by Claude Code and opencode. AC-24 keeps that source unchanged so neither host regresses; only the Prime port diverges.
- Generated tree is never hand-edited; overlay `find` anchors hard-fail on drift, which is how a future plugin-side edit invalidating these adaptations gets caught.
- *Data, never instructions* continues to govern what the `roadmap` scan child returns — it synthesizes from contributor-editable files.
- Staged-diff → gate → write → propose-commit → **never commit**.

### Observation, not a task

`.orchestrator/PROJECT-CONTEXT.md`'s *Commands* section does not name `prime-agent`'s `npm test` or `scripts/build-prime-agent.mjs`, both of which are load-bearing gates for Lane B. Flagged for a future decision; **not** in this plan's scope.

## Tasks

> Tasks are ordered TDD-first: tests before implementation.
> The coder checks off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that MUST run green before the phase's last task is checked.
> Lanes A and B are independent — they share no file, no command, and no failure mode. Phase 2 may run before Phase 1 if that suits execution; Phase 3 requires both.

### Phase 1 — Lane A: validator keyword coverage (`clean-code-gates`)

- [x] Record the Lane A baseline in the Progress Log before any edit: `npm test` count (expect 225 pass / 0 fail), the hand-counted `checkNode` cyclomatic (expect 11) and `checkObject` max-depth (expect 3) with the arithmetic shown, and the schema's keyword census (expect 14 keywords: 10 assertion, 4 annotation).
- [x] Write the failing keyword-coverage guard test (AC-7, AC-8): schema-aware walk over `report.schema.json`, implemented set derived from the implementation, explicit annotation/meta allow-list, failure on any keyword in neither set. Confirm it is RED and names `minimum`, `pattern`, `format`.
- [x] Write the failing guard-of-the-guard assertion (AC-9): a temporary in-memory schema fixture carrying an unimplemented keyword makes the guard fail. Confirm RED against the current implementation and that it does **not** touch `report.schema.json`.
- [x] Add the failing negative cases to the existing `negativeCases` table so they reuse the `corrupt()` harness (AC-1–AC-5): `summary.blockers = -5`; `gates[0].gate = "NOTAGATE"`; `generatedAt = "not-a-date"`; `gates[0].findings[0].endLine = 0`; and `gates[0].findings[0].line = 0` under a label naming it as the restored check from commit `6ab2224`. Confirm all five are RED.
- [x] Write the failing assertion that an unrecognized `format` value is a validator error, not a silent pass (AC-6). Confirm RED.
- [x] Refactor `checkNode` / `checkObject` to a shape that meets AC-10 (keyword-handler table recommended, not mandated) and implement `minimum`, `pattern`, and `format` (`date-time` only, erroring on unknown formats). All tests from the five tasks above turn GREEN.
- [x] Re-count `checkNode` cyclomatic and `checkObject` max-depth by the same protocol and record before/after in the Progress Log. Assert ≤ 8 and ≤ 2 (AC-10); if the target is missed, record the miss, the reason, and confirm the hard floor (≤ 11 / ≤ 3) still holds.
- [x] **Truth pass:** re-read the `checkNode` docblock and correct it so it is true after the change (AC-11) — enumerate exactly what is honoured, or defer to the handler table so it cannot go stale. Then re-read the rest of `__tests__/schema.test.cjs` for any other statement about validator coverage that this change makes false, and correct it.
- [x] Confirm no existing test was deleted or weakened; list in the Progress Log any existing assertion that changed, with the reason it was the thing being corrected (AC-12).
- [x] Run `### Phase 1 verification` and assert every command exits 0 before checking this task.

### Phase 2 — Lane B: Prime sibling-skill ports (`roadmap`, `simplify`)

- [x] Record the Lane B baseline census in the Progress Log before any edit, **one file per grep** (proxied `grep` truncates multi-file results): `--check` output and file count; host-vocabulary hits (expect 6 — the 4 known-good plus `roadmap:58`, `simplify:67`); `subagent` hits in generated `roadmap` (58) and `simplify` (67, 69, 93); `git diff --numstat` clean for both plugin sources.
- [x] Add one `count: 1` replacement to `prime-agent/overlays/roadmap.json` for the Step-1 scan site (AC-14, AC-15): `rlm(prompt, name="context-scan")`, explicit read-only prohibition on writes and mutating commands, inline-scan fallback when no child can be admitted, confidence loop and `context_threshold` stated as unchanged. Include a `why` naming the source spec, matching the file's existing entries.
- [x] Add three `count: 1` replacements to `prime-agent/overlays/simplify.json` (AC-16–AC-19): source line 59 dispatch (`asyncio.gather` over five read-only `rlm()` children, every existing bound preserved); line 61 fallback trigger (restated as "cannot admit RLM children", `simplify`'s own inline answer preserved including "Do not drop an angle for lack of fan-out" and the summary-disclosure requirement); line 85 mode label (host-mechanism parenthetical replaced). Each anchor copied verbatim from the plugin source and JSON-escaped.
- [x] Regenerate: `node scripts/build-prime-agent.mjs`, then `node scripts/build-prime-agent.mjs --check` — exit 0, `11 skills, 154 files` unchanged (AC-20).
- [x] **Read the emitted result.** Read the regenerated `prime-agent/skills/roadmap/SKILL.md` and `prime-agent/skills/simplify/SKILL.md` around every replaced site and confirm the Prime text reads correctly in place — heading levels intact, surrounding steps still coherent, no orphaned reference to a removed mechanism. `--check` passing proves the tree matches the overlays, not that the overlays say the right thing.
- [x] Run the post-change census, one file per grep (AC-22, AC-23): host-vocabulary hits reduced to exactly the four known-good prohibition lines; zero `subagent` hits in generated `roadmap`/`simplify`. Record both in the Progress Log next to the baseline.
- [x] Prove the plugin sources are byte-identical with `git diff --numstat` (AC-24) and `explain-codebase` untouched (AC-27). **Never** with bare `diff` — it exits 0 on differing files in this shell.
- [x] **Truth pass:** re-read `prime-agent/README.md`'s *How this distribution is built* section and correct the parenthetical that names `orchestrator` as the sole carrier of the RLM dispatch protocol (AC-25) — name every skill that carries one, or generalize so it cannot go stale. Then re-read the rest of that README for any other claim this change makes false.
- [x] Run `### Phase 2 verification` and assert every command exits 0 before checking this task.

### Phase 3 — Joint close-out

- [x] Re-run both lanes' floors in one pass and confirm they hold simultaneously (AC-29): `clean-code-gates` ≥ 225 pass / 0 fail; `build-prime-agent.mjs --check` exit 0; `prime-agent && npm test` exit 0.
- [x] Confirm AC-28: no bare-`diff` exit status was relied on anywhere in the executed verification; every identity claim used `cmp`, `shasum`, `git diff --numstat`, or `git diff --no-index`.
- [x] Review the full `git status` / `git diff --numstat` for the change and confirm the changed-file set is exactly: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs`, `prime-agent/overlays/roadmap.json`, `prime-agent/overlays/simplify.json`, `prime-agent/skills/roadmap/SKILL.md`, `prime-agent/skills/simplify/SKILL.md`, `prime-agent/README.md` — plus `prime-agent/overlays/protocol.simplify.md` only if the permitted alternative route was taken. Any file outside this set is over-scope and must be justified or reverted.
- [x] Record in the Progress Log: final test count, final census counts, final complexity numbers, and any statement elsewhere in the repo that this change made false (with its correction), so the reviewer inherits the truth pass rather than repeating it.

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands
> below that apply to the phase's touched paths and asserts each exits 0. A failure
> routes through the coder's BLOCKED step, not a silent rewrite of source to make a
> gate pass.

Applying PROJECT-CONTEXT's **Commands** section: there is no build and no lint for this repo, and no automated test for doc-skill changes — `clean-code-gates` owns the one JS suite. Lane B's commands come from the spec's *Verification commands* (`build-prime-agent.mjs`, `prime-agent` package tests); PROJECT-CONTEXT's Commands section does not yet name them (see *Observation, not a task*).

### Phase 1 verification — touched paths: `plugins/my-skills/skills/clean-code-gates/__tests__/**`

```bash
cd /Volumes/ssd/Developer/my-skills/plugins/my-skills/skills/clean-code-gates && npm test   # exit 0, >= 225 pass / 0 fail
cd /Volumes/ssd/Developer/my-skills && git diff --numstat -- \
  plugins/my-skills/skills/clean-code-gates/src \
  plugins/my-skills/skills/clean-code-gates/bin \
  plugins/my-skills/skills/clean-code-gates/schema \
  plugins/my-skills/skills/clean-code-gates/defaults.cjs \
  plugins/my-skills/skills/clean-code-gates/README.md \
  plugins/my-skills/skills/clean-code-gates/SKILL.md    # zero rows
```

Do **not** run this suite against any non-JS doc skill. Phase exit criterion: both exit 0 and the numstat is empty.

### Phase 2 verification — touched paths: `prime-agent/**`

```bash
cd /Volumes/ssd/Developer/my-skills && node scripts/build-prime-agent.mjs
cd /Volumes/ssd/Developer/my-skills && node scripts/build-prime-agent.mjs --check   # exit 0, "11 skills, 154 files"
cd /Volumes/ssd/Developer/my-skills/prime-agent && npm test                          # exit 0
cd /Volumes/ssd/Developer/my-skills && git diff --numstat -- \
  plugins/my-skills/skills/roadmap/SKILL.md \
  plugins/my-skills/skills/simplify/SKILL.md \
  prime-agent/overlays/explain-codebase.json \
  prime-agent/skills/explain-codebase                                                # zero rows
```

Plus the census (AC-22, AC-23), run **one file per grep** and cross-checked against the baseline hit counts. `clean-code-gates`'s suite is not applicable to this phase's paths and is not run for it.

### Phase 3 verification — both phases' commands, in one pass

All Phase 1 and Phase 2 commands above, run consecutively, all exiting 0 on the final tree.

G1 (coverage) and G6 (mutation) are **not** gates here — they remain QA-only.

## Dependencies

None. `SPEC-20260819T052229Z-3d97` and `FEAT-20260819T053237Z-236f` are already landed; this plan closes that spec's criteria gap and extends its overlay pattern. Neither is modified.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T13:43:21Z | REVIEWER

CR-20260819T134321Z-bfb9 created. Status: REQUEST_CHANGES. Must Fix: 3. Should Fix: 5.

Lane A approved on its own merits — all 13 criteria met, re-measured independently (249 pass / 0 fail, `checkNode` c=5, coverage guard derived from `Object.keys(ASSERTIONS)`).

Lane B blocked on one root cause: both new replacements cite "per the Prime Agent compatibility note above", which resolves to `preamble.md` — a file containing no `rlm()`, no `agent_message`, no `receiver_name`, and no return path. MF-1 (dangling contract, both skills), MF-2 (`simplify`: unbound `handle`, discarded `gather`, silent empty review labelled `5-angle fan-out`), MF-3 (`roadmap`: "the digest" never arrives; the inline fallback's trigger cannot fire on the success path). AC-17 unmet in substance.

Rulings recorded in the CR: the plan's default (contract self-contained in replacement strings) is NOT achievable — the missing piece is a completion protocol, a block by nature; fix is a shared `protocol.rlm-dispatch.md` in both overlays' `insertAfterFrontmatter`, which does not change the 154-file count. C1 folds into MF-1 (every dispatch-porting overlay carries a protocol block: was 2/2, now 2/4). B1/B2/B3 are Should Fix — latent or loud, and already guarded by the tester's keyword-form test.

**AC-23 ruled unsatisfiable as written and AMENDED, not charged to the coder**: HEAD's generated `roadmap` had two `subagent` hits (58, 87), not one; the survivor at 87 is the exact non-site Out of Scope forbids touching. Amended to "exactly one hit — the Out-of-Scope non-site at generated line 87 — and zero in `simplify`".

Floors re-verified on the final tree: `clean-code-gates` 249/0 exit 0 · `--check` exit 0 (`11 skills, 154 files`) · `prime-agent && npm test` exit 0. AC-28 upheld by the review itself: zero bare-`diff` exit statuses, zero multi-file greps.

### 2026-08-19T13:38:46Z | TESTER

TEST-20260819T132945Z-148a created. Status: PASS. Coverage: 87.49% → 87.73%.

### 2026-08-19T13:52:30Z | CODER

All 23 tasks complete. Plan status → DONE. Ready for reviewer.

Floors hold simultaneously: `clean-code-gates` 235 pass / 0 fail (baseline 225); `build-prime-agent.mjs --check` exit 0 (`11 skills, 154 files`); `prime-agent && npm test` exit 0.

Three plan-vs-tree discrepancies recorded rather than worked around, all detailed in `.progress.md`: (1) the `roadmap` anchor is source line **50**, not 59; (2) **AC-23 is unsatisfiable as written** — its baseline under-counted generated `roadmap` (2 hits, not 1) and the survivor at line 87 is the very non-site the plan's Out of Scope section forbids touching, so Out of Scope was honoured and a reviewer ruling is requested; (3) **the lanes are not independent** — Lane A's test edit reddens Lane B's `--check`, because `prime-agent/skills/clean-code-gates/` mirrors the plugin `__tests__/`, adding a seventh, in-scope-by-consequence changed file.

Complexity: `checkNode` 11 → 5, `checkObject` depth 3 → dissolved into handlers; worst function now c=6 / d=2, inside the project's own G2 thresholds. Keyword coverage 7/10 → 10/10, with a guard that derives its implemented set from the implementation.

Both truth-pass targets were re-read for truth and corrected: the `checkNode` docblock (now defers to the handler table) and `prime-agent/README.md` (now generalized). A third false statement was found — the plan's own Technical Notes — and is recorded.

`docs/reviews/feat-prime-agent-...-2026-08-19.md` appears in `git status` but is **not this plan's change**; it is pre-existing `validation-fixer` bookkeeping for another work unit. Exclude it from review.

READY_TO_COMMIT. No commit made.

### 2026-08-19T13:08:37Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-08-19T13:04:31Z | ARCHITECT

Plan `FEAT-20260819T130106Z-c55f` created. Type: feat. Tasks: 24 (Phase 1: 10, Phase 2: 9, Phase 3: 4, plus per-phase verification gates).
Status: PLANNED. Ready for coder.

Baselines measured in-session and written into the plan: `clean-code-gates` 225 pass / 0 fail; `build-prime-agent.mjs --check` exit 0 (`11 skills, 154 files`); `prime-agent && npm test` exit 0; host-vocabulary census 6 hits (4 known-good + roadmap:58 + simplify:67); `subagent` in generated roadmap/simplify at 58 / 67, 69, 93; `checkNode` cyclomatic 11 and `checkObject` depth 3, both re-derived by hand from the ESLint rule definitions.

Two tooling hazards reproduced and recorded as constraints on verification: bare `diff` exits 0 on differing files in this shell, and the proxied `grep` truncates multi-file results (a two-file census returned only the first file's hits and reported "2 matches in 1F"). The second is new this session and is why AC-22/23 mandate one file per grep.

Ruling recorded (Technical Notes → *Lane B — where the Prime contract text goes*): the `rlm()` contract stays self-contained inside the replacement strings by default; a `protocol.simplify.md` overlay block is a permitted alternative and does not affect the `154 files` count, since overlays live outside the generated tree.
