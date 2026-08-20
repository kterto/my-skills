---
id: FIX-20260819T135107Z-3895
title: Prime RLM dispatch protocol block and validator keyword-set hygiene
type: fix
status: DONE
created_at: 2026-08-19T13:53:08Z
updated_at: 2026-08-19T14:12:20Z
cycle: 0
related_to: CR-20260819T134321Z-bfb9, FEAT-20260819T130106Z-c55f, SPEC-20260819T125322Z-51a9, TEST-20260819T132945Z-148a
---

**Related:** [CR-20260819T134321Z-bfb9](./CR-20260819T134321Z-bfb9-validator-keywords-prime-sibling-ports.md) · [FEAT-20260819T130106Z-c55f](../feat/FEAT-20260819T130106Z-c55f-validator-keywords-prime-sibling-ports.md) · [SPEC-20260819T125322Z-51a9](../specs/SPEC-20260819T125322Z-51a9-validator-keywords-prime-sibling-ports.md) · [TEST-20260819T132945Z-148a](../test/TEST-20260819T132945Z-148a-validator-keywords-prime-sibling-ports.md)

## Overview

Remediates the three Must Fix items in [CR-20260819T134321Z-bfb9](./CR-20260819T134321Z-bfb9-validator-keywords-prime-sibling-ports.md), all one root cause: the `roadmap` and `simplify` Prime ports instruct the agent to dispatch with `rlm()` "per the Prime Agent compatibility note above", but that note is `preamble.md` — 417 bytes that define no `rlm()`, no `agent_message`, no `receiver_name`, no handle semantics, and no return path. The pointer dangles. In `simplify` it compounds into a literally unexecutable instruction (`handle.name` with `handle` bound in no scope, over a `gather` whose result is discarded), whose literal execution ships an empty review labelled `Mode: 5-angle fan-out` — a silent wrong answer that also defeats the skill's own single-pass disclosure rule.

The fix is the CR's ruling, not a re-litigation of it: **one shared `prime-agent/overlays/protocol.rlm-dispatch.md`**, listed in BOTH overlays' existing `insertAfterFrontmatter` arrays after `preamble.md`, mirroring `explain-codebase.json`'s shape. What is missing is a *completion protocol* — child-side `agent_message.send(...)`, parent-side handle binding, join rule — which is a paragraph plus a code fence, i.e. a block by nature. Inlining it would duplicate ~8 lines four times and re-create exactly the drift Lane A spent its effort eliminating. With the block in place, both dispatch replacements are rewritten so the wave is bound, each child carries the completion contract, and the parent joins on real completion messages — restoring **AC-17**'s findings-return bound, which the original replacement dropped when it swapped a mechanism that returns findings for one that returns nothing.

Two Should Fix items are adopted (SF-1 keyword-set hygiene, SF-4 `simplify`'s false dual-host claim); SF-2/SF-3 are ruled down to a documented divergence; SF-5's corrections are carried in Technical Notes below. Rulings on all five are recorded in **Should Fix rulings**.

## Acceptance Criteria

### MF-1 — the shared RLM dispatch protocol block

1. `prime-agent/overlays/protocol.rlm-dispatch.md` exists and states, at minimum, all four contract elements: (a) the child-side completion contract as a Python fence — `await agent_message.send("STATUS: <status>\nSUMMARY: <concise result>", receiver_role="parent")`; (b) that `handle = await rlm(prompt, name="<stable-name>")` returns **only an admission handle, never the child's result**; (c) the wave form `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))` **together with** the join rule that the parent joins only after every child's `agent_message` has arrived; (d) the retry form `agent_message.send(..., receiver_role="child", receiver_name=handle.name)`.
2. The block also carries the read-only-child clause in the shape `protocol.explain-codebase.md` already uses, so both consuming skills inherit it rather than restating it.
3. `prime-agent/overlays/roadmap.json` and `prime-agent/overlays/simplify.json` each list `"protocol.rlm-dispatch.md"` in `insertAfterFrontmatter`, **after** `"preamble.md"`, matching `explain-codebase.json`'s ordering.
4. Every occurrence of the phrase `per the Prime Agent compatibility note above` inside the two skills' dispatch replacement strings is repointed to the new block's own heading, in the shape `explain-codebase.json` already uses (`per the Prime Agent fan-out protocol above`). Verified by reading the emitted text, not the overlay JSON alone.
5. After regeneration, every overlay that ports a dispatch site carries a protocol block: **4 of 4** (`orchestrator`, `explain-codebase`, `roadmap`, `simplify`). Provable by reading the four overlays' `insertAfterFrontmatter` arrays.
6. The generated file count is unchanged: `--check` reports `11 skills, 154 files`. Overlay block files live outside `prime-agent/skills/` and are not walked into the generated tree.

### MF-2 — `simplify`'s dispatch is executable and cannot ship a silent empty review

7. The emitted dispatch paragraph in `prime-agent/skills/simplify/SKILL.md` **binds the wave** (e.g. `handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`). No identifier used in the emitted text is bound in no scope — in particular, the retry clause's `receiver_name=...` resolves to something the same emitted text binds.
8. The emitted text states that each angle's prompt **carries the completion contract** and that the angle returns its findings via `agent_message` — restoring in substance AC-17's dropped bound ("they report findings"). Under `Agent`/`task` the host returned the child's findings; the replacement must supply the substitute return path it removed.
9. The Phase-2 instruction "**Wait for every angle**" is made concrete in the emitted text: the parent joins only after all five completion messages have arrived, never on `gather` resolving (which resolves on admission).
10. If any angle cannot be joined, the emitted text routes to the **existing single-pass fallback and its disclosure line**, so `Mode: 5-angle fan-out` can never label a fan-out that did not deliver.
11. The three bounds the original replacement preserved stay preserved: one angle per child, the resolved scope + diff passed in, children are read-only and do not edit.

### MF-3 — `roadmap`'s scan child has a return path

12. The emitted `roadmap` scan-child brief **carries the completion contract**, and the emitted text has the parent wait for the child's `agent_message` before generated line 59's "Using the digest".
13. The read-only prohibition on writes and mutating commands, and the inline-scan fallback, are preserved exactly as written — both are correct and are not to be reworded beyond what MF-1's repointing requires.
14. The fallback trigger is **widened** so it also covers a child that was admitted but never returned a usable digest — currently an unhandled state, because the existing trigger reads "if no child can be admitted" and on this path admission succeeded.
15. The confidence loop and the `context_threshold` gate remain described as unchanged.

### SF-1 (adopted) — keyword-set hygiene in the schema test

16. `ANNOTATION_KEYWORDS` no longer holds core keywords: `$schema` and `$id` move into their own `CORE_KEYWORDS` set, **or** the single set is renamed so its name matches what it holds (e.g. `NON_ASSERTING_KEYWORDS`). Whichever route is taken, no set is named for a category it does not hold.
17. The annotation vocabulary is complete: `title`, `description`, `default`, `examples`, `deprecated`, `readOnly`, `writeOnly`, `$comment`.
18. `unhandledKeywords` consults whichever sets now exist, and the existing disjointness test ("the annotation allow-list and the implemented set are disjoint") is extended to cover every non-asserting set against `Object.keys(ASSERTIONS)` — a keyword in both sets still makes the coverage guard silently permissive.
19. A test proves the widened allow-list works in the direction it was widened for: an in-memory fixture carrying a purely documentary keyword (e.g. `default`, `$comment`) returns `[]` from `unhandledKeywords`, while an in-memory fixture carrying a genuine unimplemented assertion keyword still returns it. `report.schema.json` is **not** edited.

### SF-2 / SF-3 (ruled down to documentation)

20. `collectSchemaKeywords`' docblock records the deliberate divergence: it descends an object-valued `additionalProperties` that `checkNode` does not enforce, the broader walk is the safe direction (stricter guard, never a permissive one), and `unsupportedKeywordForms` is the guard that hard-fails the day either unsupported form appears in the schema. **No behaviour change** — neither walker's logic is altered.

### SF-4 (adopted) — `simplify`'s dual-host claim in the Prime port

21. `prime-agent/overlays/simplify.json` gains a fourth `count: 1` replacement rewriting the source `SKILL.md:18` host claim ("it runs **identically in Claude Code and opencode**") in the shape `explain-codebase.json` already uses for the same sentence class ("**Host.** This is the Prime Agent port…"). The `plugins/` source keeps its dual-host sentence unchanged.

### Census, floors, and hygiene (carried forward)

22. **AC-23, as amended by CR Ruling 3 — carried verbatim:** a walk of `prime-agent/skills/roadmap/SKILL.md` returns exactly **one** `subagent` hit — the Out-of-Scope non-site at generated line 87 — and `prime-agent/skills/simplify/SKILL.md` returns **zero**. Zero resolution sites in either.
23. The host-vocabulary census over `prime-agent/skills/` (`` `Explore` ``, `Explore`/, `subagent_type`, `general-purpose`) still returns **exactly four** hits, all prohibition/protocol text: `explain-codebase/SKILL.md:17`, `:77`, `orchestrator/SKILL.md:17`, `:632`.
24. `cd plugins/my-skills/skills/clean-code-gates && npm test` reports **≥ 249 pass / 0 fail**. No existing test is deleted or weakened; any changed existing assertion is named in the Progress Log with the reason it was the thing being corrected.
25. `node scripts/build-prime-agent.mjs --check` exits **0**, reporting `11 skills, 154 files`; `cd prime-agent && npm test` exits **0**.
26. `plugins/my-skills/skills/roadmap/SKILL.md` and `plugins/my-skills/skills/simplify/SKILL.md` are byte-identical to HEAD (`git diff --numstat`, zero rows); `prime-agent/overlays/explain-codebase.json` and `prime-agent/skills/explain-codebase/**` are untouched (zero rows).
27. `prime-agent/skills/**` is not hand-edited — provable because the tree is regenerated by the build and `--check` exits 0 afterwards.
28. Every identity/difference claim uses `cmp`, `shasum`, `git diff --numstat`, or `git diff --no-index` — **zero** uses of bare `diff` exit status. Every census is a Node file walk or a **one-file-per-scan** grep — zero multi-file grep census calls.
29. The **read-the-emitted-text** verification (Phase 3) is performed and recorded in the Progress Log: each replaced site read in place in the regenerated tree, confirming heading levels intact, surrounding steps coherent, no unbound identifier, no orphaned reference to a removed mechanism.

## Out of Scope

- **Re-litigating the CR's rulings.** The fix shape (one shared block, listed in both overlays), the AC-23 amendment, and the finding that C1 is MF-1's mechanism rather than a separate item are settled. Implement them; do not re-derive them.
- **A separate C1 (Mirror machinery) task.** Per CR Ruling 2, fixing MF-1 restores the 4-of-4 rule. There is no independent C1 work.
- **Implementing object-valued `additionalProperties` or tuple-form `items`** (SF-2/SF-3 as code). Ruled down — see *Should Fix rulings*. Documentation only.
- **`report.schema.json`, `defaults.cjs`, any threshold, any new gate.** Unchanged, as in the parent plan. AC-19's fixtures are in-memory.
- **`plugins/my-skills/skills/clean-code-gates/src/`, `bin/`, `schema/`, `README.md`, `SKILL.md`.** The only Lane A file changed is `__tests__/schema.test.cjs`.
- **`explain-codebase`** — any file, plugin-side or overlay-side. Its `protocol.explain-codebase.md` is the shape to *mirror*, not to edit or to merge into the new shared block.
- **`roadmap/SKILL.md:79` and `roadmap/references/item-schema.md:60`** ("the orchestrator subagents never see this conversation") — verified non-sites. The generated line-87 survivor named in AC-22 IS this text. **Do not touch it**; the amended AC exists precisely because the previous AC demanded a change this section forbids.
- **`AskUserQuestion` / `question` porting** anywhere. Different defect class; `preamble.md` covers it generically.
- **Hand-editing `prime-agent/skills/`.** Generated tree (`rmSync` + full rewrite). All Lane B edits land in overlays.
- **The `plugins/` sources of `roadmap` and `simplify`.** They ship one host-generic body for Claude Code + opencode; only the Prime port diverges. SF-4 changes the *port*, never the source.
- **opencode ports.** Neither skill has a `.opencode/skills/` override port; `opencode-port-parity` does not apply.
- **`docs/reviews/feat-prime-agent-...-2026-08-19.md`** in `git status` — pre-existing `validation-fixer` bookkeeping for a different work unit.
- **Committing or pushing.** This pipeline ends at READY_TO_COMMIT.

## Should Fix rulings

| Item | Ruling | Reason |
|---|---|---|
| **SF-1** — `ANNOTATION_KEYWORDS` incomplete and misnamed | **ADOPT** (AC-16–19) | The CR's highest value-per-line. The set is `{$schema, $id, title, description}`: two are *core* keywords, not annotations, and five of the eight annotation keywords are missing. Adding a purely documentary `default`/`$comment`/`deprecated` to `report.schema.json` today reddens the suite with "asserts with keyword(s) the validator silently ignores" — for an edit that added no constraint. Loud but **actively wrong**, and it trains people to widen the allow-list reflexively. Cheap, executable, carries real assertions. |
| **SF-2** — object-valued `additionalProperties` unenforced | **DECLINE as code; ADOPT as documentation** (AC-20) | Latent with **zero live sites** (all eight `additionalProperties` sites are boolean). The tester's `unsupportedKeywordForms` guard already hard-fails the day the object form appears, so the trap is armed-and-loud, not silent. The CR's "do not leave them disagreeing" is answered without new validator surface: of the two directions, making the *walker* stop descending would make the coverage guard **more permissive** (keywords nested inside an object-form sub-schema would go uncounted) — strictly the wrong direction. The broader walk is the safe divergence; PROJECT-CONTEXT's *Mirror machinery* convention asks that deliberate divergences be **documented**, which AC-20 does. Implementing a form with no consumer is speculative surface. |
| **SF-3** — tuple-form `items` unenforced | **DECLINE as code; ADOPT as documentation** (AC-20) | Same shape, same reasoning, same one-line docblock. The CR itself notes the two are one design decision; they are ruled together. |
| **SF-4** — `simplify`'s dual-host claim false in the Prime port | **ADOPT** (AC-21) | Same defect class as MF-1 — a port asserting something untrue of the target — and `explain-codebase.json` already carries the precedent replacement *and the phrasing* for this exact sentence class. `simplify.json` is open for MF-2 regardless, so the marginal cost is one JSON entry. Pre-existing rather than introduced, which is why it is a Should Fix and not a blocker. |
| **SF-5** — stale parent-plan metadata | **ADOPT as carry-forward** (Technical Notes) | Exactly what the CR asked: fold the three corrections into this plan's Technical Notes so the next reviewer inherits them instead of re-deriving them. No task of its own beyond Phase 3's changed-file-set check, which now lists the seventh file. |

## Technical Notes

### Corrections inherited from the parent plan (CR SF-5) — these override FEAT-…-c55f

1. **The lanes are NOT independent.** The parent plan's *"Lanes A and B are independent — they share no file, no command, and no failure mode"* is **false**, proven twice: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs` and `prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs` are byte-identical (`444ab434…`), because the generated tree mirrors the plugin tree. **Any Lane A edit reddens Lane B's `--check` until the tree is regenerated.** The phase ordering below is built around this: Lane A first, Lane B overlays second, **one** regeneration in Phase 3. Between the first Lane A edit and Phase 3's regeneration, `--check` is EXPECTED RED. That is not a failure, it is not to be "fixed" by hand-editing the generated tree, and it must be recorded in the Progress Log when observed.
2. **The `roadmap` anchor is source line 50, not 59.** Cosmetic only — the coder used the correct anchor, and `applyReplacements`' `count: 1` hard-fail proves it. (`simplify`'s 59/61/85 are correct.) Line 18 is SF-4's new anchor.
3. **AC-23 is amended, not failed** — carried verbatim as AC-22 above. Measured by Node walk against `git show HEAD`, generated `roadmap` had **two** `subagent` hits (58 and 87), not one; the survivor at 87 is the exact Out-of-Scope non-site. The old AC demanded a change the same plan forbids. The coder honoured Out of Scope and escalated — correct behaviour, not a shortfall. The under-count traces to the baseline being taken with the known-truncating proxied `grep`.

### Two verified shell hazards — both binding, both reproduced

1. **Bare `diff` returns exit 0 on differing files** in this (proxied) shell. `diff x1 x2` → exit 0; `cmp -s x1 x2` → exit 1; `git diff --no-index x1 x2` → exit 1. So `diff a b && …` and `if diff …; then` **falsely report identical**. Use `cmp`, `shasum`/`md5`, `git diff --numstat`, or `git diff --no-index` for every identity claim (AC-28).
2. **Proxied `grep` TRUNCATES multi-file results.** Reproduced: a two-file census returned only the first file's matches and reported "2 matches in 1F", silently dropping the second file's three. **This already produced the wrong AC-23 baseline** — it is the direct cause of correction 3 above. Therefore every census task in this plan is specified as a **Node file walk, or one file per scan** — never a multi-file grep. Cross-check every count against the baseline recorded in Phase 0.

### `prime-agent/skills/**` is GENERATED — never hand-edit

`scripts/build-prime-agent.mjs` does `rmSync` + a full rewrite from `plugins/my-skills/skills/` plus `prime-agent/overlays/`. Every Lane B change lands in an overlay. `applyReplacements` splits on the literal `find` string, counts occurrences, and **hard-fails the build when the count differs from `count`** — so a mis-copied anchor fails loudly, which is the mechanism working, not a blocker to route around. Copy each anchor verbatim from the plugin source and JSON-escape it (backticks are literal; backslashes and quotes are not). Census the anchor occurrence counts before and after (Phase 0 and Phase 3).

`insertAfterFrontmatter` blocks are read from `prime-agent/overlays/` and inlined after the frontmatter, in array order. Adding `protocol.rlm-dispatch.md` therefore adds **no file** to the generated tree — `154 files` is unaffected (verified independently by the reviewer).

### Lane B has NO executable path — stated plainly

There is no behavioural test for MF-1/2/3 and **none can be written**. `prime-agent/skills/` is generated markdown consumed by an agent runtime, not code this repo runs. `build-prime-agent.mjs --check` proves only that the tree matches what the overlays produce — **it would pass just as happily on a wrong replacement**, which is exactly how the dangling pointer shipped green the first time. `prime-agent`'s `npm test` covers the installer and build parity, not the semantics of the emitted text.

**Lane B's real verification is AC-29: the regenerated tree's emitted text, read in place**, plus the census (AC-22/23) and the unchanged floors. Per PROJECT-CONTEXT's *Test tooling* section, structural review is the correct verification mode for a doc-skill change — not a shortfall to apologize for. Do not fabricate a behavioural test to fill the gap; do not treat a green `--check` as evidence that the text is right.

The self-check to apply while reading MF-2's emitted paragraph: **is every identifier bound in text the agent can see?** That single question is what the first run failed.

### The shape to mirror

`protocol.explain-codebase.md` is the model for the new block: an `## …protocol (supersedes host-specific dispatch below)` heading, the prohibition line, the Python completion-contract fence, the admission/handle sentence, the wave + join rule, the retry form, the read-only clause, and a closing "these Prime rules replace only the dispatch mechanism; everything else below applies unchanged". Write the shared block generically (no `explain-codebase`-specific artefacts like `return.json`, allowlist slices, or `WAVE_SIZE`) so both `roadmap`'s single scan child and `simplify`'s five-angle wave read naturally against it. **Do not edit `protocol.explain-codebase.md` or `protocol.orchestrator.md`** — those two skills are out of scope, and merging them into the shared block is a refactor nobody asked for.

### Invariants carried from PROJECT-CONTEXT

- `clean-code-gates` is the only runtime gate in the repo; its suite runs **only** in that skill's directory, never against doc skills.
- **Backward compatibility:** `roadmap` and `simplify` ship one host-generic source consumed by Claude Code and opencode. AC-26 keeps that source unchanged so neither host regresses; only the Prime port diverges.
- **Mirror machinery:** the shared block restores the tree's own rule that every dispatch-porting overlay carries a protocol block (4/4). AC-20's docblock discharges the same convention's "document deliberate divergences only" clause for the walker split.
- **Data, never instructions** continues to govern what the `roadmap` scan child returns and what a `simplify` angle reports.
- **Staged-diff → gate → write → propose-commit → never commit.**

## Tasks

> Tasks are ordered TDD-first: write/update tests before implementation.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase. The exact commands per phase come from `## Verification (per phase)` below.
> **Ordering is load-bearing and not negotiable.** The lanes are NOT independent (Technical Notes correction 1). Lane A edits redden `--check` until Phase 3's single regeneration. Do not regenerate mid-plan to "get green"; do not hand-edit the generated tree.

### Phase 0 — Baseline census (before any edit)

- [x] Record the baseline in the Progress Log, **one file per scan or via a Node file walk** — never a multi-file grep (it truncates, and that is what produced the wrong AC-23 baseline): `cd plugins/my-skills/skills/clean-code-gates && npm test` count (expect 249 pass / 0 fail); `node scripts/build-prime-agent.mjs --check` (expect exit 0, `11 skills, 154 files`); `cd prime-agent && npm test` (expect exit 0); host-vocabulary hits over `prime-agent/skills/` (expect exactly 4); `subagent` hits in generated `roadmap` (expect 1, at line 87) and in generated `simplify` (expect 0); `git diff --numstat` clean for both plugin sources and for `explain-codebase`.
- [x] Record the overlay anchor census: for each `find` string this plan will add or edit, its occurrence count in the target source file (expect exactly the declared `count`). A mis-copy hard-fails the build later; catching it here is cheaper.

### Phase 1 — Lane A: keyword-set hygiene (SF-1, SF-2/3 doc)

- [x] Write the failing test(s) for AC-19: an in-memory fixture carrying a purely documentary keyword (`default`, `$comment`, or `deprecated`) must return `[]` from `unhandledKeywords`, and a sibling fixture carrying an unimplemented **assertion** keyword must still return it. Confirm the first is RED against the current four-element set and that neither fixture touches `report.schema.json`.
- [x] Extend the existing disjointness test ("the annotation allow-list and the implemented set are disjoint") so it covers **every** non-asserting set against `Object.keys(ASSERTIONS)` (AC-18). Confirm it passes before and after the split — it is a guard, not a target.
- [x] Implement AC-16/AC-17: complete the annotation vocabulary to the eight annotation keywords, and either split `$schema`/`$id` into `CORE_KEYWORDS` or rename the single set so its name matches its contents. Point `unhandledKeywords` at whichever sets now exist. All tests from the two tasks above turn GREEN.
- [x] Implement AC-20: update `collectSchemaKeywords`' docblock to record the deliberate divergence from `checkNode` (object-form `additionalProperties`), state that the broader walk is the safe direction, and name `unsupportedKeywordForms` as the guard that closes it. **No logic change** — confirm the diff for this task is comment-only.
- [x] Confirm no existing test was deleted or weakened; list in the Progress Log any existing assertion that changed, with the reason it was the thing being corrected (AC-24).
- [x] Record in the Progress Log that `--check` is now EXPECTED RED (Technical Notes correction 1) and that it will be resolved by Phase 3's single regeneration — not by a hand-edit and not by an early rebuild.
- [x] Run `### Phase 1 verification` and assert every command exits 0 before checking this task.

### Phase 2 — Lane B: the shared protocol block and the rewritten dispatch sites (overlays only)

- [x] Author `prime-agent/overlays/protocol.rlm-dispatch.md` carrying all four contract elements (AC-1) plus the read-only clause (AC-2), written generically for both consumers and mirroring `protocol.explain-codebase.md`'s structure. Do **not** edit `protocol.explain-codebase.md` or `protocol.orchestrator.md`.
- [x] Add `"protocol.rlm-dispatch.md"` after `"preamble.md"` in `insertAfterFrontmatter` for both `prime-agent/overlays/roadmap.json` and `prime-agent/overlays/simplify.json` (AC-3).
- [x] Rewrite `simplify.json`'s dispatch replacement for MF-2 (AC-7–AC-11): bind the wave so the retry clause's `receiver_name` has a referent; state that each angle's prompt carries the completion contract and returns findings via `agent_message`; keep one-angle-per-child, resolved scope + diff, and the read-only prohibition. Repoint the pointer phrase to the new block's heading (AC-4).
- [x] Rewrite `simplify.json`'s Phase-2 join for MF-2 (AC-9, AC-10): make "Wait for every angle" concrete — join only after all five completion messages have arrived, never on `gather` resolving — and route an un-joinable angle to the existing single-pass fallback **and** its disclosure line. Preserve "Do not drop an angle for lack of fan-out" and the disclosure requirement verbatim.
- [x] Rewrite `roadmap.json`'s scan-child replacement for MF-3 (AC-12–AC-15): the brief carries the completion contract; the parent waits for the child's `agent_message` before "Using the digest"; the read-only prohibition and the inline fallback are preserved as written; the fallback trigger is widened to cover an admitted child that never returned a usable digest. Repoint the pointer phrase (AC-4). Keep the confidence loop and `context_threshold` described as unchanged.
- [x] Add `simplify.json`'s fourth `count: 1` replacement for SF-4 (AC-21): rewrite the source line-18 host claim in `explain-codebase.json`'s "**Host.** This is the Prime Agent port…" shape. Anchor copied verbatim from `plugins/my-skills/skills/simplify/SKILL.md` and JSON-escaped.
- [x] Give every new or rewritten replacement a `why` naming this FIX plan and the CR finding it discharges (MF-1 / MF-2 / MF-3 / SF-4), matching the files' existing entry style.
- [x] Run `### Phase 2 verification` and assert every command exits 0 before checking this task.

### Phase 3 — Regenerate, READ THE EMITTED TEXT, close out

- [x] Regenerate once: `node scripts/build-prime-agent.mjs`, then `node scripts/build-prime-agent.mjs --check` — exit 0, `11 skills, 154 files` unchanged (AC-6, AC-25, AC-27). If an anchor count hard-fails, fix the anchor in the overlay — never the generated tree.
- [x] **READ THE EMITTED TEXT (this is Lane B's only real verification — AC-29; no behavioural test exists or can exist).** Read the regenerated `prime-agent/skills/simplify/SKILL.md` and `prime-agent/skills/roadmap/SKILL.md` end to end around the protocol block and every replaced site, and assert in the Progress Log, per site: the pointer phrase resolves to a block that **is present in this same file**; **every identifier the text uses is bound in text the agent can see** (the question the first run failed); the join rule is stated and cannot be satisfied by admission alone; the fallback and its disclosure line are reachable from the failure path; heading levels are intact and the surrounding steps still read coherently; no orphaned reference to a removed mechanism. A green `--check` is NOT evidence for any of this.
- [x] Verify AC-5 by reading all four dispatch-porting overlays' `insertAfterFrontmatter` arrays: `orchestrator`, `explain-codebase`, `roadmap`, `simplify` each carry a protocol block — 4 of 4.
- [x] Run the post-change census (AC-22, AC-23), **one file per scan or by Node file walk**: host-vocabulary hits over `prime-agent/skills/` = exactly the four known-good prohibition lines; `subagent` in generated `roadmap` = exactly one, the Out-of-Scope non-site at line 87; `subagent` in generated `simplify` = zero. Record each next to its Phase-0 baseline.
- [x] Prove the plugin sources are byte-identical with `git diff --numstat` (AC-26) and `explain-codebase` untouched — **never** with bare `diff`, which exits 0 on differing files in this shell (AC-28).
- [x] Re-run both lanes' floors in one pass and confirm they hold simultaneously (AC-24, AC-25): `clean-code-gates` ≥ 249 pass / 0 fail; `--check` exit 0 at `11 skills, 154 files`; `cd prime-agent && npm test` exit 0.
- [x] Review the full `git status` / `git diff --numstat` and confirm the changed-file set is exactly: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs`, `prime-agent/overlays/protocol.rlm-dispatch.md` (new), `prime-agent/overlays/roadmap.json`, `prime-agent/overlays/simplify.json`, `prime-agent/skills/roadmap/SKILL.md`, `prime-agent/skills/simplify/SKILL.md`, **and the seventh file — `prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs`, the build product that mirrors the Lane A edit** (Technical Notes correction 1; in scope by consequence, regenerated never hand-edited). Anything outside this set is over-scope and must be justified or reverted. `docs/reviews/feat-prime-agent-…-2026-08-19.md` is pre-existing and out of scope.
- [x] Confirm AC-28 for the whole run: zero reliance on bare-`diff` exit status, zero multi-file grep census calls.
- [x] Record in the Progress Log: final test count, both census counts against their baselines, the per-site emitted-text findings, and any statement elsewhere in the repo this change made false (with its correction) — including a re-read of `prime-agent/README.md`'s *How this distribution is built* section for truth after a fourth and fifth skill gained protocol blocks.
- [x] Run `### Phase 3 verification` and assert every command exits 0 before checking this task.

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs the gate commands
> below that apply to the phase's touched paths and asserts each exits 0. A failure
> routes through the coder's BLOCKED step, not a silent rewrite.

Applying the *Commands* section of `PROJECT-CONTEXT.md` to this plan's touched paths. There is no repo-wide build or lint; `clean-code-gates` is the lone runtime gate, and `prime-agent` adds a build/parity gate.

**Phase 0** — read-only census. No gate; the baseline numbers themselves are the exit criterion, and each must be recorded before any edit.

**Phase 1** (touches `plugins/my-skills/skills/clean-code-gates/__tests__/`):

- `cd plugins/my-skills/skills/clean-code-gates && npm test` → exit 0, **≥ 249 pass / 0 fail**.
- `node scripts/build-prime-agent.mjs --check` → **EXPECTED NON-ZERO** at this point, and only because the generated tree mirrors the edited test file. Record the observation; do not regenerate here and do not hand-edit the tree. This is the one place in this plan where a red gate is the correct state.

**Phase 2** (touches `prime-agent/overlays/` only):

- No gate runs against overlays in isolation — they are inputs to the build, and the build is Phase 3's. The phase exit criterion is that every new/edited `find` anchor matches its declared `count` in the source file, verified by the Phase-0 anchor census re-run one file per scan.

**Phase 3** (touches the regenerated tree; both lanes' floors):

- `node scripts/build-prime-agent.mjs && node scripts/build-prime-agent.mjs --check` → exit 0, `11 skills, 154 files`.
- `cd prime-agent && npm test` → exit 0.
- `cd plugins/my-skills/skills/clean-code-gates && npm test` → exit 0, ≥ 249 pass / 0 fail.
- `git diff --numstat` over the plugin `roadmap`/`simplify` sources and `explain-codebase` → zero rows.

Phase exit criterion: ALL applicable commands exit 0 on the changed set (with Phase 1's `--check` the single documented exception above). No silent rewrites of source to make a gate pass without a corresponding plan task. **Lane B's semantics are not covered by any of these commands** — `--check` passes on a wrong replacement; AC-29's read-the-emitted-text task is the gate that covers it, and it is not skippable.

G1 (coverage) and G6 (mutation) are QA-only and are not emitted here.

## Dependencies

- `FEAT-20260819T130106Z-c55f` — DONE. This plan amends its AC-23 and corrects three Technical Notes statements (see *Corrections inherited from the parent plan*).
- `CR-20260819T134321Z-bfb9` — the source review. Its Rulings 1–5 are settled inputs, not open questions.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-19T14:29:56Z | REVIEWER

CR-20260819T142449Z-d603 created. Status: APPROVED. Must Fix: 0. Should Fix: 2.

### 2026-08-19T14:12:20Z | CODER — session complete

All **27** tasks complete across Phases 0–3. Plan status → **DONE**. Ready for reviewer.

All three Must Fix items discharged, both adopted Should Fix items delivered, SF-2/SF-3 documented
rather than implemented per the plan's ruling, SF-5's corrections carried.

Floors green simultaneously: `clean-code-gates` **250 pass / 0 fail** (floor 249) ·
`build-prime-agent.mjs --check` **exit 0, 11 skills / 154 files** · `prime-agent && npm test`
**exit 0**. Census unchanged from baseline: host vocabulary **4**, `subagent` in generated `roadmap`
**1** (the untouched Out-of-Scope non-site) and `simplify` **0**.

**Two things the reviewer should look at first**, because both are places a green gate proved nothing:

1. The shared block's prohibition line had to **diverge from `protocol.explain-codebase.md`'s
   wording**. Mirroring it verbatim would have injected `subagent_type`/`Explore`/`general-purpose`
   into *two* skills at once, breaking AC-22 and AC-23 (4 → 6 host-vocab hits). The line keeps its
   force without the host vocabulary. This is a deliberate, census-driven divergence from the shape
   the plan named as the model.
2. The `jobs` gloss was added to the block **after** a regeneration on which `--check` had already
   exited 0. Only the AC-29 read caught it. Two rebuilds ran in Phase 3 as a result — the
   "regenerate once" rule guards the Phase-1 expected-red window, which was never re-entered.

Nothing was hand-edited under `prime-agent/skills/`; every Lane B change landed in an overlay.
No commit, no push — pipeline ends at READY_TO_COMMIT.

### 2026-08-19T14:12:20Z | CODER — Phase 3 complete (regenerate, read the emitted text, close out)

**Regeneration.** `node scripts/build-prime-agent.mjs` → `wrote prime-agent/skills with 11 skills
(154 files)`; `--check` → **exit 0**, `11 skills, 154 files`. AC-6 holds: the shared block lives in
`prime-agent/overlays/`, outside the walked tree, so adding it added **no file** — 154 before, 154
after. AC-27 holds: the tree is a full regeneration, never hand-edited, and `--check` exits 0 on it.
The Phase-1 expected-red state is now resolved by this single rebuild, exactly as planned.

**AC-29 — READ THE EMITTED TEXT.** Both regenerated files read end to end around the block and every
replaced site. Findings per site:

**`prime-agent/skills/simplify/SKILL.md`**

| Check | Result |
|---|---|
| Pointer resolves to a block **present in this same file** | Block heading at **line 14**; pointer at **line 135** — after it, so it resolves upward ✅ |
| Dangling phrase `per the Prime Agent compatibility note above` | **0 occurrences** ✅ |
| Every identifier bound in text the agent can see | `handles`, `by_angle`, `jobs`, `handle`, `by_name` all bound in-file ✅ |
| Join rule cannot be satisfied by admission alone | line 147 states it explicitly, with the reason ✅ |
| Fallback + disclosure reachable from the failure path | line 147 routes to the inline path named at line 143, and to its disclosure ✅ |
| Heading levels intact / steps coherent | `### How to run the angles` → `## Phase 2` intact; items 2–5 unchanged and still follow ✅ |
| Orphaned reference to a removed mechanism | none ✅ |

**`prime-agent/skills/roadmap/SKILL.md`**

| Check | Result |
|---|---|
| Pointer resolves in-file | Block at **line 14**, pointer at **line 126** ✅ |
| Dangling phrase | **0 occurrences** ✅ |
| Identifiers bound | `handle` bound by `handle = await rlm(prompt, name="context-scan")` on the same line ✅ |
| Parent waits before "Using the digest" | "**Wait for that message before step 2 below**" at line 125; "Using the digest" is line **126**, literally the next line ✅ |
| Fallback + widened trigger reachable | same list item, admitted-but-no-digest state now covered ✅ |
| Heading levels / steps coherent | `### Step 1` list items 1–5 intact; the confidence loop and `context_threshold` sentence unchanged ✅ |
| Orphaned reference | none ✅ |

**A second defect the read caught — recorded because a green `--check` said nothing about it.**
On the first regeneration the shared block's wave fence used `jobs` with no gloss binding it:
`handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`. `simplify`'s
own site binds `jobs`, but the block is read on its own by `roadmap` too, and the AC-29 self-check —
*is every identifier bound in text the agent can actually see?* — fails on it. Fixed **in the
overlay** (`— where `jobs` is one `(name, prompt)` pair per child, built before the call —`) and
rebuilt; the generated tree was never hand-edited. `--check` had exited **0** on the version
carrying this gap, which is precisely the Technical Notes point that `--check` would pass just as
happily on a wrong replacement. Two rebuilds ran in Phase 3, both after Lane A and Lane B were
complete — the "regenerate once" rule protects the Phase-1 expected-red window, which was not
re-entered.

**AC-5 — 4 of 4**, re-read post-regeneration: `orchestrator` → `protocol.orchestrator.md`;
`explain-codebase` → `protocol.explain-codebase.md`; `roadmap` and `simplify` → `protocol.rlm-dispatch.md`.

**AC-22 / AC-23 — post-change census against the Phase-0 baseline** (Node walk; one file per scan):

| Census | Baseline | After | Verdict |
|---|---|---|---|
| Files under `prime-agent/skills/` | 154 | **154** | unchanged ✅ |
| Host vocabulary (`` `Explore` ``, `Explore/`, `subagent_type`, `general-purpose`) | 4 | **4** | same four lines, byte-for-byte: `explain-codebase:17`, `:77`, `orchestrator:17`, `:632` ✅ |
| `subagent` in generated `roadmap` | 1 | **1** | ✅ |
| `subagent` in generated `simplify` | 0 | **0** | ✅ |

> **Line-number note on AC-22, not a violation.** The surviving `roadmap` hit moved from line **87**
> to line **155**. Nothing about it changed — it is verbatim the Out-of-Scope non-site ("…because
> the orchestrator subagents never see this conversation") and was not touched. The shift is
> arithmetic: the shared block adds 68 lines above it (the pre-H1 region grew from 13 to 81 lines).
> AC-22's substance — *exactly one hit, and it is that non-site* — holds exactly.

**AC-26 — plugin sources byte-identical**, proven two independent ways, **zero** bare-`diff`:
`git diff --numstat` returns **zero rows** for `plugins/…/roadmap/SKILL.md` and
`plugins/…/simplify/SKILL.md`; `git diff --no-index --quiet` against each file's `HEAD` blob exits
0 → `IDENTICAL` for both. `prime-agent/overlays/explain-codebase.json`,
`prime-agent/skills/explain-codebase/**`, `protocol.explain-codebase.md` and
`protocol.orchestrator.md` all return **zero rows** — untouched, as Out of Scope requires.

**AC-24 / AC-25 — both lanes' floors hold simultaneously**, re-run in one pass after regeneration:

| Floor | Result |
|---|---|
| `clean-code-gates` `npm test` | **exit 0 — 250 pass / 0 fail** (floor 249) |
| `build-prime-agent.mjs --check` | **exit 0 — 11 skills, 154 files** |
| `cd prime-agent && npm test` | **exit 0 — `install ok`, `parity ok`** |

**Changed-file set — exactly the seven the plan names**, no more:

1. `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs` (+304/−24 vs HEAD, cumulative with the parent plan)
2. `prime-agent/overlays/protocol.rlm-dispatch.md` **(new)**
3. `prime-agent/overlays/roadmap.json` (+8/−1)
4. `prime-agent/overlays/simplify.json` (+34/−1)
5. `prime-agent/skills/roadmap/SKILL.md` (+69/−1)
6. `prime-agent/skills/simplify/SKILL.md` (+80/−5)
7. `prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs` (+304/−24) — the build product mirroring #1

Both copies of #1/#7 now `shasum` to `744dd711…` (baseline `444ab434…`), i.e. the mirror is a
faithful rebuild, not a hand-edit. Outside the seven, and **not** introduced by this plan:
`prime-agent/README.md` and `docs/reviews/feat-prime-agent-…-2026-08-19.md`, both pre-existing in
the Phase-0 baseline (the former from the parent `FEAT-…-c55f`, the latter `validation-fixer`
bookkeeping explicitly out of scope), plus this pipeline's own `plans/` artifacts. Nothing reverted.

**AC-28 — confirmed for the whole run.** **Zero** uses of bare-`diff` exit status: every identity
claim used `git diff --numstat`, `git diff --no-index --quiet`, or `shasum`. **Zero** multi-file
grep census calls: every census was a Node file walk (`census.mjs`, `emitted-audit.mjs`) or a
single-file read; the handful of `grep` invocations were each against **one** named file or a pipe
of command stdout, never a multi-file scan.

**Statements elsewhere in the repo this change made false: none found.**
`prime-agent/README.md` *How this distribution is built* re-read (lines 36–54). It describes the
overlay mechanism as applying "the Prime RLM dispatch protocol in every skill that would otherwise
resolve a Claude Code / opencode agent type — **the overlays themselves are the source of truth for
which skills those are**". It hardcodes no count and defers to the overlays, so it stays true now
that a fourth and fifth skill carry protocol blocks. **No correction needed.** Its "Editing a file
under `skills/` directly is a bug" line also remains accurate — this plan edited none.

**Final counts:** `clean-code-gates` **250 pass / 0 fail**; generated tree **11 skills / 154 files**;
host-vocabulary census **4**; `subagent` in generated `roadmap` **1** / `simplify` **0**.

### 2026-08-19T14:26:05Z | CODER — Phase 2 complete (Lane B: shared block + rewritten dispatch sites)

Overlays only. `prime-agent/skills/**` not touched; `protocol.explain-codebase.md` and
`protocol.orchestrator.md` not touched; the `plugins/` sources not touched.

**`prime-agent/overlays/protocol.rlm-dispatch.md` (new, 3.0 KB)** — all four AC-1 contract elements
verified present by literal substring match, plus AC-2's read-only clause:

| AC-1 element | Verified literal |
|---|---|
| (a) child completion contract | `agent_message.send("STATUS: <status>\nSUMMARY: <concise result>", receiver_role="parent")` in a `python` fence |
| (b) admission handle, never the result | `handle = await rlm(prompt, name="<stable-name>")` + "returns **only an admission handle, never the child's result**" |
| (c) wave form **and** join rule | `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`, then "**`gather` resolves on admission, not on completion.** Join only after **every** child's `agent_message` has arrived" |
| (d) retry form | `agent_message.send(..., receiver_role="child", receiver_name=handle.name)` |
| AC-2 | `**Read-only clause (load-bearing).**` in `protocol.explain-codebase.md`'s shape |

Written **generically** — leakage scan confirms zero occurrences of `return.json`, `WAVE_SIZE`,
`MAX_UNITS`, "allowlist slice", or "identity catalog", so it reads naturally for both `roadmap`'s
single scan child and `simplify`'s five-angle wave.

**A defect caught before it shipped, worth recording.** The block was first drafted mirroring
`protocol.explain-codebase.md`'s prohibition line verbatim — *"never map one to `subagent_type`,
`Agent`, `task`, `Explore`, or `general-purpose`"*. Because this block is inserted into **both**
`roadmap` and `simplify`, that line would have added a `subagent_type` hit to each: generated
`roadmap` would have gone to **2** `subagent` hits (breaking AC-22's "exactly one") and `simplify`
to **1** (breaking AC-22's "zero"), and the host-vocabulary census would have gone **4 → 6**
(breaking AC-23). Caught by scanning the block against the census patterns *before* regenerating.
The prohibition line was rewritten to keep its full force without the host vocabulary: *"**never**
map one onto a host dispatch tool, and never resolve an agent-type name for it."* The block is now
verified clean of `subagent` (any case), `` `Explore` ``, `Explore/`, `subagent_type`, and
`general-purpose`. This is the AC-23-amendment hazard reappearing in a new place; the shared block
is the one file where a single careless line multiplies across two skills.

**AC-3 / AC-5 — protocol block registration.** `"protocol.rlm-dispatch.md"` added **after**
`"preamble.md"` in both arrays, matching `explain-codebase.json`'s ordering. All four
dispatch-porting overlays now carry a protocol block — **4 of 4**:

| Overlay | `insertAfterFrontmatter` |
|---|---|
| `orchestrator` | `["preamble.md", "protocol.orchestrator.md"]` |
| `explain-codebase` | `["preamble.md", "protocol.explain-codebase.md"]` |
| `roadmap` | `["preamble.md", "protocol.rlm-dispatch.md"]` |
| `simplify` | `["preamble.md", "protocol.rlm-dispatch.md"]` |

**MF-2 — `simplify` dispatch (AC-7, AC-8, AC-11).** The wave is now **bound**:
`handles = await asyncio.gather(...)` followed by `by_angle = dict(zip((name for name, _ in jobs), handles))`.
The retry clause reads `receiver_name=by_angle["reuse"].name` — resolving to something the *same
emitted text binds*, which the previous `handle.name` did not. `jobs` is bound by the instruction
immediately preceding the fence. Each angle's prompt now carries the completion contract and the
angle **returns its findings by message**, supplying the return path that swapping `Agent`/`task`
for `rlm()` had removed — AC-8's restoration of AC-17's bound. One angle per child, resolved scope
+ diff, and the read-only "they report findings; they do not edit" prohibition are all preserved.

**MF-2 — the join (AC-9, AC-10).** New `count: 1` replacement on the Phase-2 anchor. "Wait for every
angle" is now defined as *all five completion messages arrived and read, **not** that
`asyncio.gather` returned* — with the reason stated inline ("`gather` resolves on **admission**").
An angle that never reports after its one re-ask routes explicitly to the single-pass inline path
**and its disclosure line**, so `Mode: 5-angle fan-out` cannot label a fan-out that did not deliver.
The dedup sentence is preserved verbatim.

**Consequential edit, declared.** Phase 2 now routes *into* the inline fallback, so that fallback's
trigger was widened by one clause — "cannot admit them concurrently, **or an admitted angle never
reports back (see Phase 2)**". Without it a reader arriving from the new Phase-2 route would find a
fallback whose stated trigger did not cover them. This traces to AC-10 ("routes to the existing
single-pass fallback"). **"Do not drop an angle for lack of fan-out" and the disclosure sentence are
untouched, verbatim**, as the task requires.

**MF-3 — `roadmap` scan child (AC-12–AC-15).** The brief now carries the completion contract; the
parent is told **"Wait for that message before step 2 below"** — step 2 being generated line 59's
"Using the digest" — with the reason stated ("the `rlm()` call returning means the child started,
not that a digest exists"). AC-13's read-only prohibition sentence and the inline-scan fallback are
preserved as written. AC-14's trigger is widened: *"if no child can be admitted, **or a child was
admitted but never returned a usable digest** even after that one re-ask"*. AC-15's closing sentence
("Steps 3–4's confidence loop and the `context_threshold` gate are unchanged either way") is verbatim.

> Wording note, for the reviewer: the original fallback read "do not retry". Because the shared block
> establishes retry-once, that clause now reads "stop retrying" and sits after the single re-ask.
> The change is forced by AC-14's widening — the old trigger assumed admission had failed, so there
> was nothing to retry; on the newly-covered path there is. Nothing else in the sentence moved.

**SF-4 (AC-21).** Fourth `count: 1` replacement added to `simplify.json`, rewriting the host claim
in `explain-codebase.json`'s "**Host.** This is the Prime Agent port…" shape. **Anchor found at
plugin source line 10, not 18** — same cosmetic class as Technical Notes correction 2; the anchor
string itself is verbatim and counts 1/1, which is what the build enforces. The `plugins/` source
keeps its dual-host sentence unchanged.

**`why` provenance (task 7).** All five replacements this plan created or rewrote name
`FIX-20260819T135107Z-3895` and the CR finding they discharge — `roadmap[0]` MF-3, `simplify[0]`
MF-2, `simplify[1]` MF-2, `simplify[2]` MF-2, `simplify[4]` SF-4. The four pre-existing untouched
entries keep their original `why` verbatim.

**Phase 2 verification** — the phase's stated exit criterion is the anchor census re-run one file
per scan: **all 12 `find` anchors across both overlays match their declared `count: 1` — zero
mismatches**, including the two new ones. Both JSON files parse. No gate runs against overlays in
isolation by design; the build is Phase 3's.

### 2026-08-19T14:12:40Z | CODER — Phase 1 complete (Lane A: keyword-set hygiene)

Sole file touched: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs`.
`report.schema.json`, `src/`, `bin/`, `schema/`, `defaults.cjs` untouched, as Out of Scope requires.

**TDD red→green, per task**

1. **AC-19 test written first — confirmed RED.** New test
   `keyword-coverage guard ignores every documentary keyword but still reports an unimplemented assertion`.
   Failure was the expected one, naming exactly the gap SF-1 describes:
   `actual [ '$comment', 'default', 'deprecated', 'examples', 'readOnly', 'writeOnly' ] - expected []`
   — six of the eight annotation keywords missing from the four-element set. Both fixtures are
   **in-memory**; `report.schema.json` is not read by either.
2. **AC-18 guard generalized — confirmed GREEN before AND after the split**, as the plan requires of a
   guard (`ok 223` pre-split, still green post-split). It now iterates a `NON_ASSERTING_SETS`
   registry rather than naming one set, and asserts the registry is non-empty so an emptied registry
   cannot make the guard vacuously pass.
3. **AC-16/AC-17 implemented — 250 pass / 0 fail.** `$schema`/`$id` moved into their own
   `CORE_KEYWORDS`; `ANNOTATION_KEYWORDS` now holds exactly the eight annotation keywords
   (`title`, `description`, `default`, `examples`, `deprecated`, `readOnly`, `writeOnly`, `$comment`).
   Neither set is now named for a category it does not hold. `unhandledKeywords` consults both
   through `isNonAsserting()`, which reads the same registry the disjointness guard reads — so the
   production path and its guard cannot drift apart.
4. **AC-20 docblock — proven comment-only.** Verified mechanically, not by eye: block comments
   stripped from the current file and from a reconstructed pre-edit copy, both **16977 bytes,
   byte-identical** → the edit changed zero code. The docblock records the divergence, states that
   the broader walk is the safe direction (narrowing would leave keywords nested in an object-form
   sub-schema uncounted and make the guard *more* permissive), and names `unsupportedKeywordForms`
   as the guard that closes the loop. Neither walker's logic was altered.

**AC-24 — no test deleted or weakened.** Proven against a byte-exact baseline rather than from
memory: `prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs` is still at Phase 0's
`444ab434…` (untouched all phase), so it *is* the pre-edit file. Inventory delta:

- **Renamed + strengthened (the one changed existing assertion, per AC-24):**
  `the annotation allow-list and the implemented set are disjoint` →
  `every non-asserting keyword set is disjoint from the implemented set`.
  **Reason it was the thing being corrected:** AC-18 requires the guard cover *every* non-asserting
  set, and the old assertion hard-coded the single set by name — after the split it would have
  checked `ANNOTATION_KEYWORDS` and silently ignored `CORE_KEYWORDS`. The rewrite widens what it
  checks and adds a non-empty-registry assertion; it weakens nothing.
- **Added:** the AC-19 documentary/asserting test.
- **Removed:** none. Test count 249 → **250**, above the 249 floor.

**`--check` is now EXPECTED RED — recorded, deliberately NOT resolved.** Observed exactly as
Technical Notes correction 1 predicts:

```
stale:   prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs
1 file(s) out of date.   (exit 1)
```

Exactly one stale file, and it is the generated mirror of the file Lane A just edited — the lanes
are coupled, as the correction states. This is the correct state at this point in the plan. It will
be resolved by **Phase 3's single regeneration**, not by an early rebuild and not by hand-editing
the generated tree.

**Phase 1 verification** — `cd plugins/my-skills/skills/clean-code-gates && npm test` → **exit 0,
250 pass / 0 fail**. `--check` → **exit 1, expected non-zero per the plan's documented exception**.
Phase gate satisfied.

### 2026-08-19T13:57:32Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task (Phase 0).

### 2026-08-19T14:01:10Z | CODER — Phase 0 baseline census (before any edit)

Method note (AC-28): every census below is a **Node file walk** (`scratchpad/census.mjs`) or a
single-file read. **Zero** multi-file grep calls; **zero** reliance on bare-`diff` exit status.

**Floors**

| Gate | Baseline | Expected |
|---|---|---|
| `cd plugins/my-skills/skills/clean-code-gates && npm test` | **249 pass / 0 fail** (`1..249`, `# fail 0`) | 249 / 0 ✅ |
| `node scripts/build-prime-agent.mjs --check` | exit **0** — `prime-agent/skills is up to date (11 skills, 154 files)` | exit 0, 11/154 ✅ |
| `cd prime-agent && npm test` | exit **0** — `install ok`, `parity ok` | exit 0 ✅ |

**Node-walk file count** over `prime-agent/skills/`: **154 files** — matches `--check`'s report.

**Host-vocabulary census** over `prime-agent/skills/` (`` `Explore` ``, `Explore/`, `subagent_type`,
`general-purpose`) — **exactly 4 hits**, all prohibition/protocol text, exactly the known-good set:

- `explain-codebase/SKILL.md:17` — protocol prohibition line
- `explain-codebase/SKILL.md:77` — Host paragraph, "instead of `Agent`/`task` with a `subagent_type`"
- `orchestrator/SKILL.md:17` — protocol prohibition line
- `orchestrator/SKILL.md:632` — "Can this session fan out?" capability prose

**`subagent` census** (case-insensitive, one file per scan):

- generated `roadmap/SKILL.md` → **1 hit, line 87** — the Out-of-Scope non-site ("the orchestrator
  subagents never see this conversation"). Confirms AC-22's amended baseline. **Not to be touched.**
- generated `simplify/SKILL.md` → **0 hits**.

**Byte-identity (AC-26 baseline)** — `git diff --numstat`, zero rows for
`plugins/my-skills/skills/roadmap/SKILL.md`, `plugins/my-skills/skills/simplify/SKILL.md`,
`prime-agent/overlays/explain-codebase.json`, and `prime-agent/skills/explain-codebase/**`.

**Lane-coupling confirmed empirically** (Technical Notes correction 1):
`shasum` of `plugins/…/clean-code-gates/__tests__/schema.test.cjs` and
`prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs` are both `444ab434…` — byte-identical.
Any Lane A edit therefore reddens `--check` until Phase 3's single regeneration.

**Pre-existing working-tree state (NOT introduced by this plan).** The parent `FEAT-…-c55f` is DONE
but uncommitted, so its edits are already in the tree and are the baseline this plan deltas from:
`plugins/…/clean-code-gates/__tests__/schema.test.cjs`, `prime-agent/README.md`,
`prime-agent/overlays/roadmap.json`, `prime-agent/overlays/simplify.json`,
`prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs`, `prime-agent/skills/roadmap/SKILL.md`,
`prime-agent/skills/simplify/SKILL.md`, plus `docs/reviews/feat-prime-agent-…-2026-08-19.md`
(pre-existing `validation-fixer` bookkeeping, out of scope per Out of Scope). Phase 3's changed-file
check is read against **this** baseline, not against a clean tree.

### 2026-08-19T14:01:10Z | CODER — Phase 0 overlay anchor census

Every `find` string in `roadmap.json` and `simplify.json` counted against its plugin-source file
(Node walk, one file per read). **All 10 declared anchors match `count: 1` exactly — zero mismatches:**

- `roadmap.json` / `SKILL.md` — 4 anchors (scan site, "All normative details live", ADR-0001, ADR-0010): 1/1 each.
- `roadmap.json` / `references/{config,item-schema,mutation-ops}.md` — 1/1 each.
- `simplify.json` / `SKILL.md` — 3 anchors (fan-out dispatch, inline fallback, Mode label): 1/1 each.

Confirms Technical Notes correction 2: the `roadmap` scan anchor resolves cleanly (the source-line
number cited in the parent plan was cosmetic; the anchor string itself is correct). SF-4's new
anchor at source line 18 is verified separately in Phase 2 before the entry is added.

### 2026-08-19T13:53:08Z | ARCHITECT

Plan `FIX-20260819T135107Z-3895` created. Type: fix. Tasks: 26.
Source CR: `CR-20260819T134321Z-bfb9` (3 Must Fix, 5 Should Fix).
Should Fix rulings: SF-1 ADOPT, SF-2/SF-3 DECLINE-as-code / ADOPT-as-documentation, SF-4 ADOPT, SF-5 ADOPT-as-carry-forward. AC-23 carried in its amended form as AC-22.
Status: PLANNED. Ready for coder.

### 2026-08-19T14:21:35Z | TESTER

TEST-20260819T141514Z-b51c created. Status: PASS. Coverage: N/A → N/A (no coverage command; PROJECT-CONTEXT declares coverage advisory for doc-skill changes).

AC-29 audit run against the FINAL emitted text of both regenerated ports, read end to end with no access to sibling overlays. **A1 independently confirmed closed** — zero unbound identifiers; `handle`, `jobs`, `by_name`/`by_angle`, `prompt` all bound at every point of use, and the coder's reported intermediate unbound-`jobs` defect did not ship. A dispatch is completable in both ports: admit → return → join → retry → terminating fallback on every non-delivery branch. AC-22 (roadmap 2→1, survivor byte-identical to source L79; 87→155 verified as exactly +68 pre-H1 lines), AC-23 (4 host-vocab lines, all out-of-scope), AC-26/AC-28 all re-derived independently by Node walk / `cmp` / `shasum` — zero bare-`diff`, zero multi-file grep. Lane A's `NON_ASSERTING_SETS` registry probed: no desync path; the one uncovered case (an unregistered set) fails red, in the safe direction. Floors green: 250 pass / 0 fail, `--check` exit 0 at 11 skills / 154 files, `prime-agent` npm test green.

Two Should-Fix findings carried to the reviewer, neither blocking: **SF-A** — the shared block iterates `jobs` twice, so a lazily-built `jobs` silently yields an empty `by_name`/`by_angle` and the retry path raises `KeyError` (reproduced under Python; fix is binding `jobs` as a **list**). **SF-B** — `prime-agent/skills/simplify/SKILL.md:3` frontmatter still asserts "Dual-host (Claude Code + opencode)", the exact claim SF-4 ruled false for this port, and the only host-vocabulary description among all 11 generated ports. Advisory A-2 recorded for the reviewer's own weighing: this block is the only one of four whose join has no filesystem-observable anchor.

### 2026-08-19T14:45:12Z | QA

QA-20260819T143237Z-bda6 created. Status: READY_WITH_WARNINGS. Failures: 0. Lint/type errors: 0.
