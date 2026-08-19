---
id: CR-20260819T134321Z-bfb9
plan: FEAT-20260819T130106Z-c55f
title: Review of Schema-validator keyword coverage and Prime sibling-skill agent-type ports
status: REQUEST_CHANGES
created_at: 2026-08-19T13:43:21Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 3
should_fix_count: 5
---

**Related:** [FEAT-20260819T130106Z-c55f](../feat/FEAT-20260819T130106Z-c55f-validator-keywords-prime-sibling-ports.md) · [TEST-20260819T132945Z-148a](../test/TEST-20260819T132945Z-148a-validator-keywords-prime-sibling-ports.md) · [SPEC-20260819T125322Z-51a9](../specs/SPEC-20260819T125322Z-51a9-validator-keywords-prime-sibling-ports.md)

## Summary

Two lanes reviewed against 29 acceptance criteria, every executable claim re-measured in this session rather than inherited. **Lane A is excellent and I would approve it standing alone**: 249 pass / 0 fail, `checkNode` cyclomatic 11 → 5, keyword coverage 7/10 → 10/10, and a guard that derives its implemented set from `Object.keys(ASSERTIONS)` so the coverage claim cannot drift. All thirteen Lane A criteria are met, verified independently.

**Lane B is blocked.** Its acceptance evidence is the emitted text of the generated tree, and I read that text. Both new replacements point at a contract that is not there: they say "per the Prime Agent compatibility note above", and the note they resolve to — `preamble.md`, 417 bytes, inserted verbatim as generated lines 6–12 of both skills — defines no `rlm()`, no `agent_message`, no `receiver_name`, and no return path. The sentence that actually carries the contract, "`rlm()` returns only an admission handle, never the child's result", lives only in `protocol.orchestrator.md` and `protocol.explain-codebase.md`, and neither skill receives either file. In `simplify` this compounds into an unexecutable instruction (`handle.name` where `handle` is bound in no scope, over a `gather` whose result is discarded), whose literal execution ships a silent empty review labelled `Mode: 5-angle fan-out`.

Verdict: **REQUEST_CHANGES** — 3 Must Fix, all in Lane B, all one root cause with one fix. AC-23 is ruled **unsatisfiable as written and amended**, not charged to the coder.

## Rulings requested by the orchestrator

### Ruling 1 — A1 is BLOCKING, and the right fix is a protocol block

**Blocking: yes.** Not on the strength of the tester's reading alone — I reproduced the chain end to end:

| Claim | How verified | Result |
|---|---|---|
| Both overlays insert only `preamble.md` | `insertAfterFrontmatter` read from every overlay JSON | `roadmap` and `simplify` = `["preamble.md"]` |
| `preamble.md` defines no dispatch contract | full read (417 bytes) | no `rlm`, no `agent_message`, no `receiver_name`, no handle, no join rule |
| The contract exists elsewhere | full read of both protocol blocks | `protocol.orchestrator.md:20-26`, `protocol.explain-codebase.md:16-21` |
| Neither reaches these two skills | overlay survey above | confirmed |
| The pointer text ships | `prime-agent/skills/{roadmap,simplify}/SKILL.md` | "per the Prime Agent compatibility note above" resolves to generated lines 6–12 = `preamble.md` |

The plan's own default ruling — *"keep the `rlm()` contract self-contained inside the replacement strings; add no new overlay block file"* — **is not achievable, and the altitude argument against it is correct.** What is missing is not a clause but a *completion protocol*: a child-side `agent_message.send(...)` contract, a parent-side handle binding, and a join rule ("join only after every child's `agent_message` has arrived"). That is a paragraph plus a code fence — it is a block by nature. Inlining it into four replacement strings would duplicate the same eight lines four times and re-create the drift the plan spent Lane A eliminating.

**The fix is the plan's own *Permitted alternative*, generalized:** add one shared `prime-agent/overlays/protocol.rlm-dispatch.md` and list it in both overlays' `insertAfterFrontmatter` after `preamble.md`, mirroring `explain-codebase.json`'s shape. Shared rather than per-skill because both sites need the identical three things, and a shared block is the Mirror-machinery-correct answer. Overlay block files live outside `prime-agent/skills/`, so the `154 files` count and AC-20 are unaffected — verified: `prime-agent/overlays/` is not walked into the generated tree.

**This is bug-4's own defect class reproduced by bug-4's fix** — a port naming a mechanism the target does not have — which is precisely why it cannot ship as-is.

### Ruling 2 — C1 (Mirror machinery) is real, and it is the *mechanism* of MF-1, not a separate finding

I surveyed all eleven overlays. Seven carry `["preamble.md"]` alone — and correctly so, because they port no dispatch site. The rule that actually holds in this tree is narrower and sharper than "the established shape is `[preamble, protocol.<skill>]`":

> **Every overlay that ports a dispatch site carries a protocol block.** Before this change: 2 of 2 (`orchestrator`, `explain-codebase`). After: 2 of 4.

So PROJECT-CONTEXT's *Mirror machinery* convention ("reuse established phrasing/shape; document deliberate divergences only") **is** breached, the divergence **is** undocumented — and fixing MF-1 fixes it. I am not filing C1 separately; MF-1's fix restores 4 of 4.

### Ruling 3 — AC-23 is AMENDED, not failed

Measured myself with a Node file walk (never the truncating proxied `grep`), against `git show HEAD` and the working tree:

- **HEAD** generated `roadmap`: `subagent` at lines **58 and 87** — two hits, not the one the plan's baseline claims.
- **Post-change**: line 58 is fixed; line **87** survives — `"…because the orchestrator subagents never see this conversation"`, generated from source line 79, which the plan's **Out of Scope** section names as a *verified non-site* and forbids touching.
- Generated `simplify`: **0** hits, exactly as specified.

AC-23 therefore demands a change the same plan forbids. The under-count is traceable to the architect's baseline being taken with the known-truncating tool. **The coder honoured Out of Scope and escalated — that is the correct behaviour and it is not a shortfall.** AC-23 is amended to:

> A walk of `prime-agent/skills/roadmap/SKILL.md` returns exactly **one** `subagent` hit — the Out-of-Scope non-site at generated line 87 — and `prime-agent/skills/simplify/SKILL.md` returns **zero**. Zero resolution sites in either.

Under the amendment, satisfied. The architect must carry this amended text into the FIX plan.

### Ruling 4 — B1/B2/B3 are Should Fix, not blockers

The tester's sharpening is right: **the guard checks keyword *presence*, not *form*,** so it structurally cannot see a partially-implemented keyword. I confirmed the mechanism by reading both walkers — `collectSchemaKeywords` descends an object-valued `additionalProperties` (line 47) while `ASSERTIONS.additionalProperties` returns unless the value is exactly `false`, and `ASSERTIONS.items` hands an array-valued `items` to `checkNode`, which bails at `TYPE_PREDICATES.object(schema)`.

But AC-7 is written as presence-coverage and is **literally satisfied**, the live schema has zero object-form `additionalProperties` and zero tuple-form `items`, and the tester's `unsupportedKeywordForms` guard already makes both traps loud the day they arm. B3 fails *loud*, not silent. None of the three ships a wrong constraint or an unmet criterion. Should Fix — and worth doing together, since all three are one allow-list/handler-table design decision.

### Ruling 5 — lane independence and the seventh file

The plan's "the lanes share no file, no command, and no failure mode" is **false**, confirmed independently: `shasum` shows `plugins/…/clean-code-gates/__tests__/schema.test.cjs` and `prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs` byte-identical (`444ab434…`), so Lane A's edit reddens Lane B's `--check`. The seventh changed file is a **build product**, regenerated by the builder and never hand-edited (`--check` exit 0 proves it). **In scope by consequence — not over-scope, no correction needed.** Recorded as SF-5 so the plan's own claim stops misleading the next run.

## Independent verification of the floors

Every one re-run by me on the final tree, not inherited:

| Gate | Required | Measured |
|---|---|---|
| `clean-code-gates` `npm test` | ≥ 249 pass / 0 fail | **249 pass / 0 fail**, exit 0 |
| `build-prime-agent.mjs --check` | exit 0 | **exit 0** — `11 skills, 154 files` |
| `cd prime-agent && npm test` | exit 0 | **exit 0** — install ok, parity ok |
| AC-13 `git diff --numstat` over `src`/`bin`/`schema`/`defaults.cjs`/`README.md`/`SKILL.md` | zero rows | **zero rows** |
| AC-24 plugin `roadmap`/`simplify` sources | zero rows | **zero rows** |
| AC-27 `explain-codebase` overlay + generated | zero rows | **zero rows** |
| AC-22 host-vocabulary census (Node walk) | exactly 4, all prohibition text | **4** — `explain-codebase:17`, `:77`, `orchestrator:17`, `:632` |

Both shell hazards honoured: **zero** uses of bare `diff` exit status, and **zero** multi-file `grep` census calls — every count in this report comes from a Node file walk or `git diff --numstat` (AC-28 upheld by the review itself).

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|---|---|---|
| 1 | `blockers: -5` violates `minimum` | ✅ | negative case + right-reason assertion on the exact message |
| 2 | `gate: "NOTAGATE"` violates `pattern` | ✅ | — |
| 3 | `generatedAt` violates `format: date-time` | ✅ | asserted, not annotated |
| 4 | `endLine: 0` — optional-property path walked | ✅ | — |
| 5 | `line: 0` pinned by a named negative case | ✅ | label cites commit `6ab2224` as required |
| 6 | Unrecognized `format` raises | ✅ | `assert.throws(/unsupported schema format "uuid"/)` |
| 7 | Keyword-coverage guard, implemented set derived | ✅ | `Object.keys(ASSERTIONS)` — verified by reading, not by claim |
| 8 | Schema-aware walk | ✅ | three fixtures: property-names, descend/no-descend, nested |
| 9 | Guard goes red on an unimplemented keyword | ✅ | in-memory `multipleOf` fixture; `report.schema.json` untouched |
| 10 | `checkNode` ≤ 8 cyclo, `checkObject` ≤ 2 depth | ✅ | `checkNode` = 5 by recount; `checkObject` dissolved, handlers ≤ 2 |
| 11 | `checkNode` docblock true after the change | ✅ | "exactly the keys of `ASSERTIONS`" — cannot go stale |
| 12 | ≥ 225 pass / 0 fail, nothing deleted or weakened | ✅ | 249/0; deletions confined to the validator body, no test removed |
| 13 | Zero changed lines outside `__tests__/` | ✅ | numstat empty |
| 14 | `roadmap.json` gains one `count: 1` replacement | ✅ | — |
| 15 | Read-only clause, inline fallback, loop unchanged | ✅ | all three present *literally*; see **MF-3** for the defect no AC covers |
| 16 | `simplify.json` gains three, at source 59/61/85 | ✅ | anchor lines verified against the plugin source |
| 17 | Dispatch preserves every existing bound in substance | ❌ | **MF-2** — the findings-return bound is dropped, not preserved |
| 18 | Fallback keeps `simplify`'s own inline answer | ✅ | "Do not drop an angle…" and the disclosure requirement verbatim |
| 19 | Mode label loses the host parenthetical | ✅ | → `(no concurrent RLM children)` |
| 20 | `--check` exit 0, `11 skills, 154 files` | ✅ | re-measured |
| 21 | `prime-agent && npm test` exit 0 | ✅ | re-measured |
| 22 | Census returns exactly the 4 known-good hits | ✅ | Node walk, re-measured |
| 23 | Zero `subagent` in generated `roadmap`/`simplify` | ⚠️ | **Unsatisfiable as written — AMENDED (Ruling 3).** Satisfied as amended |
| 24 | Plugin sources byte-identical | ✅ | numstat zero rows |
| 25 | README no longer names `orchestrator` as sole carrier | ✅ | generalized; verified by reading, not only numstat |
| 26 | Generated tree not hand-edited | ✅ | `--check` exit 0 after regeneration |
| 27 | `explain-codebase` untouched | ✅ | numstat zero rows |
| 28 | No bare-`diff` exit status anywhere | ✅ | upheld in this review too |
| 29 | Both lanes' floors hold simultaneously | ✅ | all three re-run on the final tree |

## Must Fix (Blockers)

### MF-1 — The `rlm()` contract is a dangling pointer in both new ports

**File**: `prime-agent/overlays/roadmap.json` · `prime-agent/overlays/simplify.json` (`insertAfterFrontmatter`) → emitted at `prime-agent/skills/roadmap/SKILL.md:58` and `prime-agent/skills/simplify/SKILL.md:67`

**Problem**: Both new replacements instruct the agent to use `rlm()` "per the Prime Agent compatibility note above". That note is `preamble.md`, emitted as generated lines 6–12 of both files. It contains no `rlm()`, no `agent_message`, no `receiver_name`, no handle semantics, and no completion contract — it only says "use the Prime equivalent" for host control surfaces. The load-bearing sentence "`rlm()` returns only an admission handle, never the child's result" exists solely in `protocol.orchestrator.md:21` and `protocol.explain-codebase.md:16-17`, and **neither file is inserted into these two skills**. The port names a mechanism whose definition the target does not receive — the exact defect class bug-4 exists to eliminate. It also breaks the tree's own rule that every dispatch-porting overlay carries a protocol block (Ruling 2).

**Fix**: Add `prime-agent/overlays/protocol.rlm-dispatch.md` and list it in both overlays' `insertAfterFrontmatter` after `preamble.md`, mirroring `explain-codebase.json`. It must state, at minimum: the child-side completion contract (`await agent_message.send("STATUS: …\nSUMMARY: …", receiver_role="parent")`); that `handle = await rlm(prompt, name="<stable-name>")` returns **only an admission handle, never the result**; the wave form `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))` **plus** the join rule that the parent joins only after every child's `agent_message` has arrived; and the retry form `agent_message.send(..., receiver_role="child", receiver_name=handle.name)`. Then repoint both replacement strings from "per the Prime Agent compatibility note above" to the block's own heading, matching `explain-codebase`'s "per the Prime Agent fan-out protocol above". Overlay block files sit outside `prime-agent/skills/`, so AC-20's `154 files` is unaffected — confirmed.

---

### MF-2 — `simplify`'s dispatch is unexecutable and ships a silent empty review

**File**: `prime-agent/overlays/simplify.json` (first replacement) → emitted at `prime-agent/skills/simplify/SKILL.md:67`, consumed at `:73` and reported at `:93`

**Problem**: Three compounding defects in one emitted paragraph, all verified by reading the generated file:

1. `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))` — **the result is discarded**; no variable is bound.
2. The next clause instructs re-asking a child "with `receiver_name=handle.name`" — **`handle` is bound in no scope anywhere in the document**. The call form is lifted verbatim from `protocol.explain-codebase.md:21` without line 16's `handle = await rlm(...)` binding, and without `agent_message`, neither of which `simplify` receives.
3. Phase 2 opens at line 73 with "**Wait for every angle**" against a `gather` that per the platform contract resolves on *admission*, not completion — and no wait mechanism is defined anywhere in the emitted text.

A literal reading admits five children, proceeds immediately to Phase 2 dedup with **zero findings collected**, and emits a summary whose mode line (line 93) reads `Mode: 5-angle fan-out`. That is a silent-wrong-answer: an empty review reporting itself as the complete one. It also **defeats `simplify`'s own disclosure rule** at line 69 ("say plainly in the summary that this was a single-pass review"), because the agent believes the fan-out ran. This is the substance of **AC-17**: under `Agent`/`task` the host returns the child's findings, so "they report findings" was a bound the original text carried; the replacement swapped in a mechanism that returns nothing and supplied no substitute return path. The bound is not preserved.

**Fix**: With MF-1's block in place, rewrite the dispatch replacement to (a) bind the wave — `handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))` — so `receiver_name` has a referent, (b) state that each angle's prompt must carry the completion contract and return its findings via `agent_message`, and (c) make Phase 2's "Wait for every angle" concrete: join only after all five completion messages have arrived. If any angle cannot be joined, the emitted text must route to the existing single-pass fallback **and** its disclosure line, so the mode label can never claim a fan-out that did not deliver.

---

### MF-3 — `roadmap`'s scan child has no return path; "the digest" never arrives

**File**: `prime-agent/overlays/roadmap.json` (new replacement) → emitted at `prime-agent/skills/roadmap/SKILL.md:58`, consumed at `:59`

**Problem**: Generated line 58 binds `handle = await rlm(prompt, name="context-scan")` and `handle` is never used again. Generated line 59 then says "Using **the digest**, run structured user-question rounds" — but no mechanism delivers a digest, and `rlm()` returns only an admission handle. **The inline fallback does not rescue this**: its trigger is "if no child can be admitted", and on this path admission *succeeded*. The realistic failure mode is the agent proceeding to the question rounds with an empty digest, silently starving the `context_threshold` confidence gate that Step 1 exists to satisfy — and then re-asking the user everything the scan was supposed to have covered, in direct contradiction of line 59's "Do not re-ask what the scan already covered."

Softer than MF-2 (no unbound identifier, no false completeness label) but the same root cause and the same class of silent degradation, so it must land in the same fix.

**Fix**: With MF-1's block in place, extend the replacement so the scan child's brief carries the completion contract and the parent waits for its `agent_message` before line 59's "Using the digest". Keep the read-only prohibition and the inline fallback exactly as written — both are correct — and widen the fallback trigger so it also covers a child that was admitted but never returned a usable digest, which is currently an unhandled state.

## Should Fix (Warnings)

### SF-1 — `ANNOTATION_KEYWORDS` is incomplete and misnamed, producing a red suite with a wrong diagnosis (B3)

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs:35`

**Problem**: The set is `{$schema, $id, title, description}`. Two of those four (`$schema`, `$id`) are *core* keywords, not annotations, and five of the eight JSON Schema annotation keywords are missing. Consequence: adding a purely documentary `default`, `examples`, `$comment`, `deprecated`, or `readOnly` to `report.schema.json` reddens the suite with "asserts with keyword(s) the validator silently ignores" — for an edit that added no constraint at all. Loud rather than silent, so not blocking, but the message is actively wrong and trains people to widen the allow-list reflexively without reading it.

**Fix**: Complete the set to the annotation vocabulary (`title`, `description`, `default`, `examples`, `deprecated`, `readOnly`, `writeOnly`, `$comment`) and split the two core keywords into their own `CORE_KEYWORDS` set, or rename to `NON_ASSERTING_KEYWORDS` so the name matches what it holds. Highest value-per-line of the five warnings.

---

### SF-2 — Object-valued `additionalProperties` is unenforced *and* unflagged (B1)

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs` — handler at the `ASSERTIONS.additionalProperties` entry, walker at `:47`

**Problem**: The handler returns unless the value is exactly `false`, so an object-valued `additionalProperties` sub-schema is never applied. Meanwhile the key's *presence* in `ASSERTIONS` makes the coverage guard report full coverage. The two walkers genuinely disagree: `collectSchemaKeywords` descends into the object form (its own docblock says so), `checkNode` never walks it. **Latent — the live schema has eight `additionalProperties` sites, all boolean.** The tester's `unsupportedKeywordForms` guard now goes red the day the object form appears, so the trap is armed-but-loud rather than armed-and-silent.

**Fix**: Either implement the object form (`checkNode(value[key], schema.additionalProperties, …)` for each unknown key) or make the walker stop descending into it so guard and validator agree. Do not leave them disagreeing.

---

### SF-3 — Tuple-form (array-valued) `items` is unenforced *and* unflagged (B2)

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs` — `ASSERTIONS.items`

**Problem**: Same shape as SF-2. `ASSERTIONS.items` calls `checkNode(item, schema.items, …)`, whose first line bails because `TYPE_PREDICATES.object` excludes arrays; `collectSchemaKeywords` likewise adds nothing for the array form. Latent (zero tuple-form sites live), now guarded by the tester's form test.

**Fix**: Fix alongside SF-2 — they are one design decision. Either implement positional `items`, or have the form guard reject tuple-form outright as an unsupported schema shape so it can never be silently accepted.

---

### SF-4 — `simplify`'s dual-host claim is false in the Prime port, and the tree already treats that as a defect (C2)

**File**: `prime-agent/skills/simplify/SKILL.md:18` (source: `plugins/my-skills/skills/simplify/SKILL.md`, via `prime-agent/overlays/simplify.json`)

**Problem**: The emitted Prime port states "it runs **identically in Claude Code and opencode**" while its own preamble twelve lines above announces it as the Prime Agent port. `explain-codebase.json` treats exactly this sentence class as a defect worth a `count: 1` replacement (its third entry rewrites the "**Dual-host.**" paragraph to "**Host.** This is the Prime Agent port…"), so the precedent and the phrasing already exist.

**Not blocking, and not introduced by this change** — the line is pre-existing in the generated tree (`prime-agent/skills/simplify/SKILL.md` shows 3 changed lines, all three replacements) and no acceptance criterion covers it. It is the natural next entry in this overlay, best folded into the FIX plan while the file is open.

**Fix**: Add a fourth `count: 1` replacement to `simplify.json` rewriting line 18's host claim in the shape `explain-codebase.json` already uses.

---

### SF-5 — Plan metadata is stale in three places; carry the corrections forward

**File**: `plans/feat/FEAT-20260819T130106Z-c55f-validator-keywords-prime-sibling-ports.md`

**Problem**: Three statements are now known-false and will mislead the next run if they propagate into the FIX plan unamended:

1. *"Lanes A and B are independent — they share no file, no command, and no failure mode."* False. `plugins/…/clean-code-gates/__tests__/schema.test.cjs` and `prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs` are byte-identical (`444ab434…`), so any Lane A edit reddens Lane B's `--check` until the tree is regenerated. Phase 3's expected changed-file set must list that build product as the seventh file.
2. *Technical Notes*: the `roadmap` anchor is source line **50**, not 59. (`simplify`'s 59/61/85 are correct — verified.) Cosmetic only: the coder used the correct anchor, and `applyReplacements`' `count: 1` hard-fail proves it.
3. **AC-23** must carry the amended text from Ruling 3.

**Fix**: Fold all three into the FIX plan's Technical Notes so the reviewer inherits the corrections rather than re-deriving them.

## Verdict

**Status**: REQUEST_CHANGES

Lane A is complete and well-built — all thirteen criteria met, independently re-measured — but Lane B ships a dispatch contract that points at a document not containing it, and in `simplify` that renders the instruction literally unexecutable and its failure mode silent, so it cannot reach READY_TO_COMMIT.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260819T134321Z-bfb9-validator-keywords-prime-sibling-ports.md`) to generate a FIX plan. Every Must Fix item will become a TDD task pair — note that Lane B has **no executable path**, so MF-1/2/3's verification is the emitted text of the regenerated tree read in place, plus the unchanged floors (`clean-code-gates` ≥ 249 / 0, `--check` exit 0 at `11 skills, 154 files`, `prime-agent && npm test` exit 0). SF-1 through SF-3 are executable and should carry real assertions.
