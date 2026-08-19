---
id: SPEC-20260819T125322Z-51a9
title: Schema-validator keyword coverage and Prime sibling-skill agent-type ports
status: READY_FOR_PLANNING
created_at: 2026-08-19T12:57:57Z
updated_at: 2026-08-19T12:57:57Z
cycle: 0
related_to: SPEC-20260819T052229Z-3d97, FEAT-20260819T053237Z-236f, SPEC-20260819T000458Z-bfac
---

## Summary

Two independent validation deviations from the Prime-agent-distribution review, fixed in one pass because neither is large enough to justify its own pipeline run and they share zero files.

**Part A** — the `clean-code-gates` schema-test validator implements seven JSON-Schema keywords but `report.schema.json` uses ten, so `blockers: -5`, `gate: "NOTAGATE"` and `line: 0` all validate clean. One of the three is a genuine regression: the hand-rolled validator that preceded the generic rewrite carried an explicit `line >= 1` check that the rewrite dropped. Nothing shippable is broken — no runtime code validates — but the guard whose only job is regression detection has a hole in it. Part A closes the three keywords, restores the dropped check as a pinned test, and adds a coverage guard so the *class* of defect ("validator honours N of M keywords") becomes a failing test rather than an invisible gap.

**Part B** — two Prime skills still resolve host agent types that do not exist under Prime. `roadmap` spawns an `Explore`/`explore` subagent; `simplify` dispatches five review angles via `Agent`/`subagent_type: general-purpose`. Both degrade the way the orchestrator's scan child did before its own fix. Part B extends the established overlay treatment to those two skills, with per-skill fallback semantics rather than a copy of the orchestrator's answer.

## Goals

- The `clean-code-gates` schema validator honours every JSON-Schema keyword that `report.schema.json` actually uses, and a guard test fails the moment the schema grows a keyword the validator does not implement.
- The `line >= 1` check lost in the validator rewrite is restored and pinned by an explicit negative test, so it cannot be dropped silently a second time.
- `checkNode` / `checkObject` come out of the change no more complex than they went in, and preferably inside the project's own G2 thresholds.
- An installed Prime Agent distribution contains no instruction to resolve a Claude/opencode agent type, in any skill.
- `roadmap` and `simplify` each get a fallback path judged on that skill's own fan-out shape, not inherited from the orchestrator.
- The plugin-side sources for `roadmap` and `simplify` remain host-generic and byte-identical; the entire Prime adaptation lives in the overlays.

## Non-goals

- **No runtime schema validation.** Wiring the validator into `src/validate-report.cjs` on the report-writing path is explicitly deferred — see *Decisions resolved by Brainstormer default*, D2. Nothing in this spec touches `src/` or `bin/`.
- **No `explain-codebase` change.** Verified a false positive (D1). Its dispatch site was already ported; the cited lines are the Prime protocol's own prohibition text.
- **No `AskUserQuestion` / `question` porting** in `roadmap` (`SKILL.md:59`) or elsewhere. That is a different defect class, was not raised, and the generic `preamble.md` already instructs the Prime port to ask the user normally in conversation.
- **No change to `roadmap/SKILL.md:79` or `roadmap/references/item-schema.md:60`.** Both say "the orchestrator subagents never see this conversation" — a statement about the *orchestrator's* children that remains true under Prime, where they are RLM children. Verified non-sites; listed here so the architect does not churn them.
- **No `simplify`-style cleanup** of adjacent validator code beyond the refactor FR-A7 mandates.
- **No new gate, no change to `defaults.cjs` thresholds, no change to the report schema itself.** The schema is correct; the validator is what is behind it.
- **No hand-edit of `prime-agent/skills/`** — per PROJECT-CONTEXT it is a generated tree.

## Users and use cases

- **Skill maintainer (this repo)**: changes `report.schema.json` or a finding-construction site and needs `npm test` to fail when the report shape drifts from the schema. Success: a report violating `minimum`, `pattern` or `format` is rejected, and adding an unimplemented keyword to the schema fails the coverage guard rather than passing silently.
- **Fixer agent / orchestrator consuming `report.json`**: unaffected by this change — the contract is unchanged. Success is that nothing it depends on moves.
- **Prime Agent end user (installed distribution)**: invokes `/skill:roadmap` or `/skill:simplify` and the skill dispatches work through `rlm()` instead of instructing the session to resolve an agent type that does not exist. Success: no dead-end dispatch, and a stated fallback when children cannot be admitted.
- **Reviewer of the next PR**: greps the generated tree for host agent vocabulary and finds only prohibition text.

## Functional requirements

### Part A — `clean-code-gates` schema validator

Scope: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs` only.

1. **`minimum` is honoured.** A numeric value below its schema `minimum` produces a violation. The schema uses it at four sites: `summary.blockers`, `summary.warnings`, `gates[].findings[].line`, `gates[].findings[].endLine`.
2. **`pattern` is honoured.** A string failing its schema `pattern` produces a violation. One site: `gates[].gate` (`^G[1-9][0-9]*$`).
3. **`format` is honoured as an assertion, not an annotation.** One site: `generatedAt` (`date-time`). Draft-07 leaves `format` annotation-only by default; here the validator's entire purpose is regression detection, so it must assert. The validator implements only the formats the schema actually uses, and an **unrecognized `format` value is itself a validator error** — silently ignoring an unknown format would re-open the exact gap this requirement closes.
4. **Keyword-coverage guard.** A test walks `report.schema.json`, collects every JSON-Schema keyword that appears anywhere in it, and asserts that set is covered by the validator's implemented-keyword set. This is the durable fix: it converts "the validator honours 7 of 10" from an invisible gap into a failing test the moment the schema grows an eleventh. The implemented-keyword set must be derived from the implementation (e.g. the keys of a handler table), not hand-maintained as a duplicated literal list — a hand-copied list is the same gap one level up.
5. **The dropped check is restored and pinned.** `line: 0` inside a finding produces a violation, asserted by an explicit named negative case. The check must be pinned by a test, not merely by the implementation, so a future rewrite that drops it fails rather than passes.
6. **Negative cases for each newly honoured keyword.** At minimum: `summary.blockers = -5` (minimum), `gates[0].gate = "NOTAGATE"` (pattern), `generatedAt = "not-a-date"` (format), `gates[0].findings[0].endLine = 0` (minimum on an optional property, proving the optional path is walked too). Each added to the existing `negativeCases` table so it reuses the established `corrupt()` harness.
7. **`checkNode` and `checkObject` are refactored in the same change.** Today `checkNode` is cyclomatic 11 and `checkObject` is nesting depth 3; both already exceed this project's own G2 thresholds (`defaults.cjs`: `complexity: 8`, `maxDepth: 2`), and three more keywords added inline would worsen both.
   - **Hard requirement:** neither metric is worse after the change than before (`checkNode` ≤ 11, `checkObject` depth ≤ 3).
   - **Target:** `checkNode` ≤ 8 and `checkObject` depth ≤ 2, i.e. inside the project's own thresholds.
   - **Shape is the implementer's call.** A keyword-handler table keyed by schema keyword is the review item's suggestion and pairs naturally with FR-A4's derived keyword set, but it is not mandated — any shape meeting the numbers and FR-A4 qualifies.
8. **The stale docblock is corrected.** `/** Generic recursive check honouring type, required, additionalProperties, properties, items, enum, const. */` becomes false the instant keywords are added. Either update it to match, or replace it with a form that cannot go stale (e.g. deferring to the handler table). This is not cosmetic: it is the same class of defect as the bug being fixed — a statement about coverage that drifts from actual coverage.
9. **Non-regression floor.** `npm test` in `plugins/my-skills/skills/clean-code-gates/` reports **225 pass / 0 fail** today. After the change it reports **≥ 225 pass / 0 fail**. No existing test is deleted or weakened; existing assertions change only where the assertion itself is the thing being corrected, and any such change is called out in the plan.
10. **`src/` and `bin/` are untouched.** Proven with `git diff --numstat` showing zero changed lines under those paths.

### Part B — Prime sibling-skill agent-type ports

Scope: `prime-agent/overlays/roadmap.json`, `prime-agent/overlays/simplify.json`, the regenerated `prime-agent/skills/` tree, and `prime-agent/README.md`.

11. **`roadmap`'s scan child is resolved through `rlm()`.** `prime-agent/overlays/roadmap.json` gains a replacement, `count: 1`, rewriting `SKILL.md`'s Step-1 site — `1. Spawn an \`Explore\`/\`explore\` subagent: …` — so the Prime port admits a read-only child via `handle = await rlm(prompt, name="context-scan")` and is explicitly forbidden from writes and mutating commands, per the Prime protocol's read-only-child rule.
    - **Fallback, judged for this skill:** the site is a *conditional* branch that only runs when `.orchestrator/PROJECT-CONTEXT.md` is absent, and the scan produces a bounded read-only digest that feeds the existing user-question rounds. When no child can be admitted, the skill performs the same scan inline in the parent session and continues to the question rounds — the digest is required input, so it must be produced either way. The confidence loop and `context_threshold` gate are unchanged.
    - This is the same shape as the orchestrator's Bootstrap-B1 context scan, which is a genuine match rather than an inherited default — the two sites gather the same digest for the same purpose.
12. **`simplify`'s angle fan-out is resolved through `rlm()`.** `prime-agent/overlays/simplify.json` gains replacements, each anchored `count: 1`, at all three affected sites in `plugins/my-skills/skills/simplify/SKILL.md`:
    - **line 59** — the dispatch instruction naming `Agent` / `subagent_type: general-purpose` / `task`. Under Prime the five angles are admitted together as independent RLM children (`await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`), read-only: they report findings, they do not edit. The Prime children replace the "single message so they run concurrently" mechanism while preserving its intent (concurrency) and every existing bound (one angle per child, resolved scope + diff passed in, no edits).
    - **line 61** — the fallback trigger, currently "When the host has no subagent tool, or cannot issue several tool calls in one message". Restated for this host as: when the session cannot admit RLM children. **The inline fallback itself survives in substance** — `simplify` already documents a legitimate single-pass path, including "Do not drop an angle for lack of fan-out" and the requirement to say so plainly in the summary. That is `simplify`'s own answer and it is preserved, not replaced by the orchestrator's.
    - **line 85** — the summary's mode label `single-pass inline (no subagent fan-out available)`, whose parenthetical names a host mechanism that does not exist under Prime.
    - The exact site count is the architect's to finalize; the requirement is that no host agent vocabulary survives in the generated `simplify` and that each replacement is anchored `count: 1`.
13. **`explain-codebase` is not modified.** Its two matches in the generated tree (`SKILL.md:17`, `SKILL.md:77`) are overlay-injected Prime protocol text that *prohibits* those agent types; its real dispatch site was already ported by `explain-codebase.json`'s existing bug-11 replacement. Any plan that edits it is over-scoped.
14. **Plugin sources stay byte-identical.** `plugins/my-skills/skills/roadmap/SKILL.md` and `plugins/my-skills/skills/simplify/SKILL.md` are unchanged — they must remain host-generic (Claude Code + opencode) because those hosts still consume them. The Prime adaptation lives entirely in the overlays. Proven with `git diff --numstat` showing zero changed lines for both files.
15. **The distribution is regenerated and verified.** `node scripts/build-prime-agent.mjs` is run, and `node scripts/build-prime-agent.mjs --check` exits **0**. Today it reports `prime-agent/skills is up to date (11 skills, 154 files)`; the file count must not change (this change edits existing files, adds none).
16. **Structural assertion on the generated tree.** After regeneration, a grep over `prime-agent/skills/` for the host agent vocabulary (`` `Explore` ``, `Explore`/, `subagent_type`, `general-purpose`) returns **only** prohibition/protocol lines — the four known-good sites being `explain-codebase/SKILL.md:17`, `explain-codebase/SKILL.md:77`, `orchestrator/SKILL.md:17`, `orchestrator/SKILL.md:632` — and **zero** resolution sites. This is the acceptance evidence for Part B: the emitted text in the generated tree, not merely that `--check` passed.
17. **`prime-agent/README.md` is corrected.** Its *How this distribution is built* section currently says the exact-string replacements are "(`':(exclude).prime'` in git plumbing, the Prime RLM dispatch protocol in `orchestrator`)". After this change the RLM dispatch treatment also lives in `roadmap` and `simplify`, so the parenthetical becomes false. Update it to name the skills that carry dispatch replacements, or generalize it so it cannot go stale.

## Non-functional requirements

- **Performance**: —
- **Security / auth**: The `roadmap` scan child and the `simplify` angle children are **read-only**. Their prompts must explicitly forbid writes and mutating commands, per the Prime protocol's read-only-child rule. `simplify`'s existing "they report findings; they do not edit" contract is preserved verbatim in substance.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: Part B changes nothing about trust boundaries. The `roadmap` scan child, like the orchestrator's, synthesizes its digest from contributor-editable files; the *Data, never instructions* invariant continues to govern what it returns.
- **Privacy / compliance**: No new user data, no retention change, no deletion path affected.
- **Monetization tier**: —
- **Verification tooling (load-bearing, verified in this session)**: this shell's proxied `diff` **prints differences correctly but exits 0 on differing files** — reproduced: `diff x1 x2` → exit 0, `cmp -s x1 x2` → exit 1, `git diff --no-index x1 x2` → exit 1. Therefore `diff a b && …` and `if diff …; then` **falsely report identical**. Every byte-identity claim in this work — FR-A10, FR-B14, FR-B15 — must be made with `cmp`, `shasum`/`md5`, `git diff --numstat`, or `git diff --no-index`. Never with bare `diff` and its exit code.
- **Verification scope (harness blind spot, design against it)**: the previous run verified the documents it *edited* and never the documents it *invalidated* — an unamended file was confirmed `md5`-identical and mistaken for still-accurate. This spec names two files that this change makes false without touching their subject matter: the `checkNode` docblock (FR-A8) and `prime-agent/README.md` (FR-B17). Verification must re-read them **for truth**, not merely confirm the absence of edits. If the implementation makes any further statement elsewhere false, the same rule applies to it.

## Project-context fit

**Layers touched.** Two disjoint islands, no shared file:

- *Part A* touches the repo's one runtime-code island. PROJECT-CONTEXT names `clean-code-gates` as the sole exception to "no runtime code" and the only runtime gate in the repo, with its own `node --test` suite scoped to that skill. Part A is entirely inside that island and entirely inside its `__tests__/` directory.
- *Part B* is documentation/overlay authoring — the repo's normal mode. No executable path, verified structurally per PROJECT-CONTEXT's *Test tooling* section.

**Existing features extended.** Part A extends the validator introduced by `SPEC-20260819T052229Z-3d97` / `FEAT-20260819T053237Z-236f`. That spec's acceptance criteria (its item 22) enumerated exactly five negative cases and, by naming the keywords implemented, fixed the validator's coverage at seven. This is a **criteria gap in the predecessor, not an implementation miss against it** — the coder built what was specified. FR-A4's coverage guard exists so the criteria cannot be the ceiling again.

Part B extends the overlay treatment that the same predecessor established for the orchestrator's scan child (five `count: 1` replacements plus `protocol.orchestrator.md`). That fix was deliberately scoped to the orchestrator and did not reach these skills; confirmed **not** a regression of it — `git diff --numstat` shows zero changed lines in all three sibling source files.

**Invariants that shape the work.**

- *Generated tree is never hand-edited.* `prime-agent/skills/` is built by `scripts/build-prime-agent.mjs` (rmSync + full rewrite) from `plugins/my-skills/skills/` plus `prime-agent/overlays/*.json`. All Part B edits land in the overlays; the tree is then regenerated. Overlay `find` anchors assert exact occurrence counts and hard-fail the build on drift — which is the mechanism that will catch a future plugin-side edit invalidating these adaptations.
- *Backward compatibility is mandatory.* `roadmap` and `simplify` ship a single host-generic source consumed by Claude Code and opencode. FR-B14 keeps that source unchanged so neither host regresses; only the Prime port diverges.
- *opencode-port-parity* does **not** apply here — neither `roadmap` nor `simplify` has a `.opencode/skills/` override port (only `pr-review-report` and `spec-driven-eval` do), and neither plugin source changes anyway.
- *`clean-code-gates` suite is the only runtime gate; do not invoke it against non-JS doc skills.* Part A's tests run only in that skill's directory. Part B gets no behavioural test.
- *Staged-diff → gate → write → propose-commit → never-commit.* This pipeline ends at READY_TO_COMMIT.

**Conflicts the architect must resolve.** One, and it is bounded: `checkNode` (cyclomatic 11) and `checkObject` (nesting 3) already exceed `defaults.cjs`'s own G2 thresholds (8 / 2). The file lives under `__tests__/`, outside the `roots: ['src']` scope those thresholds gate, so nothing currently fails — but the skill's own standard is the honest bar. FR-A7 sets ≤ 8 / ≤ 2 as the target and "no worse than today" as the hard floor, and leaves the shape open.

**Open product decisions this depends on.** None.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: —
- **Skill runtime (`clean-code-gates`)**: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs` — the only file changed by Part A. Explicitly **not** touched: `src/`, `bin/`, `schema/report.schema.json`, `defaults.cjs`, `README.md`, `SKILL.md`.
- **Prime overlays (source of the generated distribution)**: `prime-agent/overlays/roadmap.json`, `prime-agent/overlays/simplify.json`.
- **Prime generated tree (regenerated, never hand-edited)**: `prime-agent/skills/roadmap/SKILL.md`, `prime-agent/skills/simplify/SKILL.md`.
- **Prime docs**: `prime-agent/README.md` (FR-B17).
- **Verification commands**: `npm test` in `plugins/my-skills/skills/clean-code-gates/`; `node scripts/build-prime-agent.mjs` then `node scripts/build-prime-agent.mjs --check`.

## Open questions

_(none — every unknown was resolved by a recorded default below; no reserved decision was reached.)_

## Decisions resolved by Brainstormer default

- **D1 — Is `explain-codebase` in scope?** → **No; excluded as a verified false positive.** → The backlog item cites `prime-agent/skills/explain-codebase/SKILL.md:17`, but that line reads `map a unit to \`subagent_type\`, \`Agent\`, \`task\`, \`Explore\`, or \`general-purpose\`` and sits inside the overlay-injected *Prime Agent fan-out protocol* block — it is a **prohibition**, the opposite of a resolution instruction. Line 77 is likewise Prime instruction text. The skill's real dispatch site (`plugins/…/explain-codebase/SKILL.md:237-238`) was already rewritten to `handle = await rlm(prompt, name="<unit>")` by `explain-codebase.json`'s existing bug-11 replacement. A full grep of the generated tree finds no unresolved site in that skill. Concern 2 is therefore two skills, not three.

- **D2 — Is moving the validator into `src/validate-report.cjs` (runtime validation on the report-writing path) in scope?** → **No; deliberately deferred.** → The concern's own text flags it as needing its own decision, and it is one: it changes the shipping CLI's observable contract (what does `clean-code-gates` do when its own output fails its schema — new exit code? stderr warning? refuse to write?). That is a public-interface, one-way-door choice, and this spec has no mandate to make it. Deferring commits to nothing and leaves the option fully open; the fixture-level fix in Part A is independently worth doing and is what the reported defect actually asks for. Recorded here so it is a visible deferral rather than an omission.

- **D3 — Refactor shape for `checkNode`.** → **Numbers are the requirement; the keyword-handler table is a recommendation.** → Specifying a shape would over-constrain the implementer for no gain. FR-A7 sets measurable acceptance (hard floor: no worse than 11 / 3; target: ≤ 8 / ≤ 2, the project's own G2 thresholds) and names the handler table as the suggested route because it composes cleanly with FR-A4's derived keyword set.

- **D4 — Should `format` assert, or stay annotation-only as draft-07 permits?** → **Assert, for `date-time` only, and error on unrecognized `format` values.** → An annotation-only `format` leaves `generatedAt: "not-a-date"` validating clean, which is precisely the reported defect. Implementing only the formats the schema uses keeps the change small; erroring on an unknown format stops the gap silently reopening the next time the schema gains one.

- **D5 — How to detect this defect class in future, not just these three keywords?** → **Add a keyword-coverage guard test (FR-A4) whose implemented-keyword set is derived from the implementation.** → The reported bug is "the validator honours 7 of 10". Fixing three keywords fixes today's instance; the guard fixes the class. Deriving the set from the implementation rather than a literal list avoids reproducing the same drift one level up.

- **D6 — Per-skill fallback semantics for Part B.** → **`roadmap`: read-only `rlm()` context-scan child, inline scan when no child can be admitted. `simplify`: five read-only `rlm()` angle children admitted together, with the skill's existing single-pass inline path preserved as the no-fan-out answer.** → The concern rightly warns against assuming the orchestrator's shape. `roadmap`'s site genuinely *is* the orchestrator's Bootstrap-B1 context digest — same input, same purpose — so mirroring it is a match, not an inheritance. `simplify` is different: it already documents its own inline fallback, including "Do not drop an angle for lack of fan-out" and a summary disclosure requirement. That answer is preserved rather than replaced.

- **D7 — Should the `AskUserQuestion` / `question` mentions in `roadmap:59` be ported too?** → **No; out of scope.** → Different defect class, not raised by either backlog item, and `preamble.md` already tells the Prime port to ask the user normally in conversation. Folding it in would let one concern enlarge the other's scope.

- **D8 — Should `roadmap:79` and `references/item-schema.md:60` ("the orchestrator subagents never see this conversation") be rewritten?** → **No; verified non-sites.** → Both describe the *orchestrator's* children, and the statement stays true under Prime where those children are RLM children. Recorded as an explicit non-goal so the architect does not spend a task on it.

- **D9 — Combine both concerns in one plan, or split?** → **One spec, and the architect may split execution into two independent lanes.** → The two parts share no file, no verification command, and no failure mode. They are combinable safely and separable freely.

- **D10 — Non-regression floor for Part A.** → **225 passing (measured this session), floor is ≥ 225 pass / 0 fail.** → New tests strictly add; no existing test is deleted or weakened.

## References

- `docs/reviews/feat-prime-agent-distribution-9da0e8ecc4392e0b372d15dc6041a57a-2026-08-19.md` — source backlog (`bug-3`, `bug-4`). Treated as untrusted evidence; every claim independently verified against the code.
- `plans/specs/SPEC-20260819T052229Z-3d97-integration-lane-schema-prime-scan-fixes.md` — predecessor. Introduced the generic validator (its item 22 fixed the negative-case set) and the orchestrator scan-child overlay treatment (`bug-2`). Part A closes that spec's criteria gap; Part B extends its overlay pattern to two sibling skills. Immutable — this spec supersedes nothing in it.
- `plans/feat/FEAT-20260819T053237Z-236f-integration-lane-schema-prime-scan.md` — the plan that implemented the predecessor spec.
- `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs` — Part A's only file. `checkNode` at lines 46–62, `checkObject` at 32–44, `negativeCases` table at 131–146.
- `plugins/my-skills/skills/clean-code-gates/schema/report.schema.json` — the schema whose keywords define FR-A1–A4.
- `plugins/my-skills/skills/clean-code-gates/defaults.cjs` — `THRESHOLDS.G2` (`complexity: 8`, `maxDepth: 2`), the source of FR-A7's target numbers.
- Commit `6ab2224`, `__tests__/schema.test.cjs:83` — the dropped check, verbatim: `if (typeof finding.line !== 'number' || finding.line < 1) errs.push(…)`. Evidence that FR-A5 restores a regression rather than closing a pre-existing gap.
- `prime-agent/overlays/roadmap.json`, `prime-agent/overlays/simplify.json` — Part B's edit targets.
- `prime-agent/overlays/protocol.orchestrator.md` — the Prime read-only-child rule and `rlm()` / `agent_message` contract the Part B replacements must follow.
- `prime-agent/overlays/orchestrator.json` — the `bug-2` precedent (five `count: 1` replacements) whose treatment Part B extends.
- `prime-agent/overlays/preamble.md` — the generic compatibility preamble; verified insufficient on its own for agent dispatch, which is why per-skill replacements are needed.
- `scripts/build-prime-agent.mjs` — the generator; `--check` exit 0 is FR-B15's acceptance signal.
- `.orchestrator/PROJECT-CONTEXT.md` — *Invariants* (backward compatibility, opencode-port-parity scope, `clean-code-gates` as the only runtime gate), *Test tooling* (structural verification for doc skills), *Out of scope* (pipeline never commits).
