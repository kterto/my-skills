# Progress: FEAT-20260819T130106Z-c55f — Schema-validator keyword coverage and Prime sibling-skill agent-type ports

**Plan**: [FEAT-20260819T130106Z-c55f-validator-keywords-prime-sibling-ports.md](./FEAT-20260819T130106Z-c55f-validator-keywords-prime-sibling-ports.md)
**Spec**: [SPEC-20260819T125322Z-51a9](../specs/SPEC-20260819T125322Z-51a9-validator-keywords-prime-sibling-ports.md)
**Status**: DONE
**Created**: 2026-08-19T13:04:31Z

---

## Log

### 2026-08-19T13:43:21Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260819T134321Z-bfb9-validator-keywords-prime-sibling-ports.md
Status: REQUEST_CHANGES
Must Fix: 3 | Should Fix: 5
Invoke /architect with plans/code-review/CR-20260819T134321Z-bfb9-validator-keywords-prime-sibling-ports.md to create FIX plan.

All three floors re-measured on the final tree by the reviewer, not inherited: `clean-code-gates` 249 pass / 0 fail (exit 0); `build-prime-agent.mjs --check` exit 0 (`11 skills, 154 files`); `prime-agent && npm test` exit 0. AC-13 / AC-22 / AC-24 / AC-27 re-verified — numstat zero rows on every guarded path, census exactly 4 known-good prohibition hits by Node file walk. Both shell hazards honoured: zero bare-`diff` exit statuses, zero multi-file greps.

**Lane A: approved on its own merits.** All 13 criteria met. `checkNode` cyclomatic 5 (target <= 8, baseline 11), `checkObject` dissolved into handlers at depth <= 2, docblock now "exactly the keys of `ASSERTIONS`" and cannot go stale, guard genuinely derives its implemented set from the implementation.

**Lane B: blocked, one root cause.** Both new replacements say "per the Prime Agent compatibility note above"; that note is `preamble.md` (417 bytes, emitted as generated lines 6-12), which defines no `rlm()`, no `agent_message`, no `receiver_name`, and no return path. The contract sentence "`rlm()` returns only an admission handle, never the child's result" lives only in `protocol.orchestrator.md` / `protocol.explain-codebase.md`, neither of which these skills receive.

- MF-1 — dangling `rlm()` contract in both overlays. Fix: shared `prime-agent/overlays/protocol.rlm-dispatch.md` listed in both `insertAfterFrontmatter` arrays, mirroring `explain-codebase.json`. Does not change the 154-file count (overlays live outside the generated tree).
- MF-2 — `simplify/SKILL.md:67`: `gather` result discarded, `handle.name` referenced with `handle` bound in no scope, Phase 2's "Wait for every angle" undefined. Literal execution ships an empty review labelled `Mode: 5-angle fan-out`, defeating the skill's own single-pass disclosure rule. AC-17 unmet in substance.
- MF-3 — `roadmap/SKILL.md:58-59`: `handle` bound then unused, "Using the digest" unreachable on the success path, inline fallback's trigger ("if no child can be admitted") cannot fire after successful admission.

**Rulings** (full reasoning in the CR): the plan's default — keep the contract self-contained in the replacement strings — is NOT achievable; the missing piece is a completion protocol, which is a block rather than a clause. C1 (Mirror machinery) folds into MF-1: every dispatch-porting overlay carries a protocol block, 2/2 before this change, 2/4 after. B1/B2/B3 ruled Should Fix (SF-1..SF-3) — B3 fails loud with a wrong diagnosis, B1/B2 are latent with zero live sites and already made loud by the tester's `unsupportedKeywordForms` guard. C2 ruled Should Fix (SF-4) — real and precedented by `explain-codebase.json`, but pre-existing rather than introduced here.

**AC-23 ruled unsatisfiable as written and AMENDED, not charged to the coder.** Measured by Node walk against `git show HEAD`: generated `roadmap` had two `subagent` hits (58 and 87), not the one the plan's baseline claims; post-change the survivor at 87 is the exact non-site Out of Scope forbids touching. The coder honoured Out of Scope and escalated, which is correct. Amended text: "exactly one hit in generated `roadmap` — the Out-of-Scope non-site at line 87 — and zero in generated `simplify`; zero resolution sites."

Lane non-independence confirmed (`shasum` 444ab434... identical across plugin and generated `schema.test.cjs`); the seventh changed file is a build product, in scope by consequence, not over-scope. Recorded as SF-5 along with the source-line-50 anchor correction and the AC-23 amendment, so the FIX plan inherits them.

### 2026-08-19T13:38:46Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260819T132945Z-148a-validator-keywords-prime-sibling-ports.md
Status: PASS
Coverage: 87.49% -> 87.73%
All e2e flows green. Coverage floor met.

Lane A: 14 tests added to `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs`, purely additive (pre-edit file proven an exact prefix of the post-edit file). Suite 235 -> 249 pass / 0 fail. Added: exact-violation ("right reason") assertions for every newly honoured keyword incl. the previously unexercised `summary.warnings` minimum site; inclusive-boundary positives at all four `minimum` sites; RFC-3339 accept/reject cases for the new `date-time` predicate; an ASSERTIONS/ANNOTATION_KEYWORDS disjointness invariant; and a keyword-FORM guard (`unsupportedKeywordForms`) that goes red the day `report.schema.json` adopts tuple-form `items` or object-form `additionalProperties`.

Every added test mutation-verified to bite (mutants applied to a copy, file restored and re-proven byte-identical by shasum). Kill counts, coder's suite -> after additions: exclusive-`minimum` 2 -> 12; `minimum` no-op 3 -> 7; `pattern` no-op 1 -> 2; `date-time` always-true 1 -> 3; annotation-list-shadows-implemented-keyword 0 (SURVIVES) -> 1. Honest reading: four of five were already killed, so most of the gain is localization; the surviving mutant and the form guard are the two real gaps closed.

Lane B: ZERO tests added and none can exist. Recorded as the deliberate outcome. Verification was reading the emitted generated text, which is where finding A1 came from.

Test-quality audit — weak assertions in the coder's work, all compensated, none blocking: `negativeCases` asserts only `errs.length >= 1` (a case can pass caught by the wrong keyword, undercutting AC-5's stated intent); no boundary/positive cases for the new `minimum`; `summary.warnings` (1 of 4 `minimum` sites) unexercised; `format` exercised by a single string. No tautologies, no empty asserts, no skipped/todo tests.

FOUR BUGS independently reproduced from scratch, in memory, against an unmodified `report.schema.json`. Ranking: A1 >> B3 > B1 ~ B2.
- A1 CONFIRMED and WORSE IN SIMPLIFY THAN REPORTED. `simplify`'s dispatch discards the `gather` result, then instructs `receiver_name=handle.name` where `handle` is bound in no scope — that call form is lifted verbatim from `protocol.explain-codebase.md:21` without line 16's `handle = await rlm(...)` binding, and `simplify` never receives that file. "Wait for every angle" has no mechanism against a gather that resolves on admission. A literal reading admits five children, proceeds to Phase 2 with zero findings, and emits `Mode: 5-angle fan-out` — a silent empty review reporting itself as the complete one, which also defeats simplify's own single-pass disclosure rule. `roadmap` is softer: `handle` bound then unused, "the digest" never arrives, and the inline fallback does NOT rescue it because its trigger ("if no child can be admitted") did not fire. Cheapest fix is the plan's own Permitted alternative: a `protocol.<skill>.md` block in `insertAfterFrontmatter`, which does not change the 154-file count.
- B1 CONFIRMED but LATENT. Reproduced exactly (guard=[] validate=[]). The live schema uses `additionalProperties` at 8 sites, all boolean, and the `true` case is handled correctly — so no live hole, an armed trap. Real defect class is broader than reported: the guard checks keyword PRESENCE, not keyword-FORM coverage, so it cannot detect a partially-implemented keyword.
- B2 CONFIRMED, same class, also latent — zero tuple-form `items` sites in the live schema. `checkNode` bails because `TYPE_PREDICATES.object` excludes arrays.
- B3 CONFIRMED, lowest severity — fails loud, not silent. Root cause is narrow: `ANNOTATION_KEYWORDS` holds 4 keys, two of which (`$schema`, `$id`) are core rather than annotation keywords, and it is missing 5 of the 8 JSON Schema annotation keywords. Not applied — it is an implementation edit outside a tester's surface and belongs with the B1/B2 ruling.

THREE PLAN-VS-TREE DISCREPANCIES ALL CONFIRMED.
- AC-23 unsatisfiable: `git show HEAD` proves generated `roadmap` had TWO `subagent` hits (58 and 87), not one. Post-change count is 1, not 0; the survivor at line 87 is generated from source line 79, the exact non-site the plan's Out of Scope forbids touching. The coder correctly honoured Out of Scope. Recommend amending AC-23 rather than charging the coder. AC-22 IS satisfied exactly: 4 hits by direct file walk, all the named prohibition lines; simplify returns 0.
- Lanes not independent: re-proven by my own edit. Adding tests immediately produced `stale: prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs`; regenerated via the builder (never hand-edited) back to exit 0 / `11 skills, 154 files`. shasum confirms the two copies byte-identical.
- `roadmap` anchor is source line 50, not 59. `simplify`'s three anchors ARE at 59/61/85 as planned, so the error is isolated to the roadmap entry.

Scope: `docs/reviews/feat-prime-agent-...-2026-08-19.md` confirmed OUT — its diff is one `[ ] -> [x]` flip on finding `arch-2` plus `_fixed via orchestrator - 07bbbb9_`, validation-fixer bookkeeping for a different work unit. AC-13/24/27 all verified zero numstat rows. AC-25 verified by reading: the README now defers to the overlays as source of truth.

Both shell hazards respected: zero uses of bare `diff` exit status; all identity claims via shasum / `git diff --numstat`. Census figures come from a Node file walk after a single-pattern grep over ONE file still reported "4 matches in 1F" for a 6-alternative pattern.

Floors on the final tree: clean-code-gates 249 pass / 0 fail (exit 0); `build-prime-agent.mjs --check` exit 0 (`11 skills, 154 files`); `prime-agent && npm test` exit 0.

PASS is a statement about the suite, not a clearance of A1 — it needs a reviewer ruling before READY_TO_COMMIT.

### 2026-08-19T13:52:30Z | CODER

**Phase 3 COMPLETE — joint close-out. All 4 tasks [x]. Plan status → DONE. Total tasks this session: 23.**

**AC-29 — both lanes' floors hold simultaneously on the final tree, re-run in one pass:**

| Floor | Required | Measured |
|---|---|---|
| `clean-code-gates` `npm test` | ≥ 225 pass / 0 fail | **235 pass / 0 fail**, exit 0 |
| `build-prime-agent.mjs --check` | exit 0 | **exit 0** — `11 skills, 154 files` |
| `prime-agent` `npm test` | exit 0 | **exit 0** |

**AC-28 — zero uses of bare `diff` exit status anywhere in the executed verification.** Every identity claim used `git diff --numstat` (zero-rows form), `cmp -s`, or `shasum`. The one `git diff -- <path>` call in this session was used to *read* a diff's content, never to branch on its exit status. The proxied-`grep` hazard was likewise held to: every census ran **one file per grep**, iterated over all 154 generated files, with counts cross-checked against the recorded baseline — and it earned its keep, since it is what exposed the AC-23 baseline under-count (finding 2 in the Phase 2 entry).

**Final changed-file set — 8 files, versus the 6 the plan predicts. Every deviation accounted for:**

```
141  24  plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs   <- planned (Lane A, only Lane A file)
  6   0  prime-agent/overlays/roadmap.json                                     <- planned (1 replacement)
 20   0  prime-agent/overlays/simplify.json                                    <- planned (3 replacements)
  1   1  prime-agent/skills/roadmap/SKILL.md                                   <- planned (generated)
  3   3  prime-agent/skills/simplify/SKILL.md                                  <- planned (generated)
  4   2  prime-agent/README.md                                                 <- planned (AC-25 truth pass)
141  24  prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs         <- UNPLANNED, in-scope by consequence
  2   1  docs/reviews/feat-prime-agent-...-2026-08-19.md                       <- NOT THIS PLAN'S CHANGE
```

- **`prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs`** — the generated mirror of the Lane A edit, forced by the lane-independence error recorded in Phase 2 (finding 3). Proven to be a build product and not a hand edit: byte-identical to the plugin source by `cmp -s`, corroborated by matching `shasum` (`2f489abf991ce2c3f449c429d4d1d27afaef3315`), and `--check` exits 0 afterwards. `prime-agent/overlays/protocol.simplify.md` was **not** created — the default self-contained ruling held.
- **`docs/reviews/feat-prime-agent-...-2026-08-19.md`** — **not produced by this plan.** It is a `validation-fixer` bookkeeping line (`- [ ]` → `- [x]` plus `_fixed via orchestrator · 07bbbb9 · 2026-08-19_`) closing finding **arch-2**, the one-span-rule work of a *different* plan. It was already modified in the working tree when this session began. Left untouched — it belongs to another work unit and reverting it would destroy that unit's provenance. **Reviewer: exclude it from this plan's diff.**

Nothing else in the tree changed. No file outside the accounted set.

**Final numbers:**

- Tests: **235 pass / 0 fail** (baseline 225, +10: 5 negative cases, 1 coverage guard, 3 guard-mechanism/schema-awareness, 1 unknown-format). Zero existing tests deleted, weakened, or modified.
- Keyword coverage: **10 of 10** assertion keywords honoured (was 7 of 10); 4 annotation keywords explicitly allow-listed. Guard derives its implemented set from `Object.keys(ASSERTIONS)`, so it fails automatically on the next schema keyword nobody implements.
- Complexity: `checkNode` **11 → 5**; `checkObject` depth **3 → dissolved**; worst function in the file now **c=6 / d=2**, both inside the project's own `THRESHOLDS.G2` (8 / 2). AC-10 met on target, not on the hard floor.
- Census: host-vocabulary **6 → 4** (all four surviving hits are prohibition/protocol text; zero resolution sites). `subagent` in generated `simplify` **3 → 0**; in generated `roadmap` **2 → 1** (the surviving hit is the declared out-of-scope non-site).

**Statements elsewhere in the repo this change made false, and their corrections — so the reviewer inherits the truth pass rather than repeating it:**

1. **`checkNode`'s docblock** (`__tests__/schema.test.cjs`) — enumerated seven honoured keywords; would have been wrong the moment three more landed, and was itself an instance of the drifting-coverage-claim defect being fixed. **Corrected** to defer to the handler table, so it cannot go stale.
2. **`prime-agent/README.md`** — "the Prime RLM dispatch protocol **in `orchestrator`**" was already understated before this plan (`explain-codebase` carries one) and flatly false after it. **Corrected** by generalizing to "in every skill that would otherwise resolve a Claude Code / opencode agent type — the overlays themselves are the source of truth", so it cannot go stale a third time.
3. **The plan's own Technical Notes** — `roadmap/SKILL.md:59` should read `:50`; the AC-23 baseline should read `roadmap: 58, 87` not `roadmap: 58`; and "Lanes A and B are independent — they share no file, no command, and no failure mode" is false (Lane A reddens Lane B's `--check`). Recorded in the Phase 2 entry, not silently worked around.

**Open item requiring a reviewer ruling (not a coder decision):** AC-23 demands zero `subagent` hits in generated `roadmap`, while the plan's Out of Scope section forbids touching the only remaining site. I honoured Out of Scope. Either AC-23 is amended to "zero resolution sites", or spec D8 is reopened.

**Deliberately not done, per the plan:** `src/validate-report.cjs` (deferred one-way door — nothing under `src/`, `bin/`, `schema/`, `defaults.cjs`, `README.md`, `SKILL.md` was touched, numstat proves zero rows); `explain-codebase` in any form; opencode ports (neither skill has an override port); committing or pushing.

**READY_TO_COMMIT.** No commit made.

### 2026-08-19T13:44:12Z | CODER

**Phase 2 COMPLETE — Lane B: Prime sibling-skill ports. All 9 tasks [x].**

Overlays gained 1 (`roadmap`) + 3 (`simplify`) `count: 1` replacements. Default ruling followed: the `rlm()` contract stays **self-contained inside the replacement strings**; no `protocol.simplify.md` was needed. Build: `11 skills, 154 files` — **file count unchanged** (AC-20). `--check` exit 0; `prime-agent && npm test` exit 0.

**THREE plan-vs-tree discrepancies found. None is a blocker; all three are recorded rather than papered over.**

**(1) The plan's `roadmap` source line number is wrong — anchor by text, not line.** Technical Notes cite `roadmap/SKILL.md:59` for the Step-1 scan site. It is actually source line **50** (line 59 is blank). The *generated* line the plan also cites, 58, is correct — 50 + 8 preamble lines = 58. Anchors are exact source strings, so this cost nothing: each `find` was copied verbatim from the source and asserted `count == 1` in-script **before** writing the overlay. `simplify`'s three cited source lines (59, 61, 85) were all exactly right.

**(2) AC-23 cannot be satisfied as literally written, and its baseline was itself a casualty of the grep hazard.** AC-23 says the `subagent` census baseline is "roadmap:58 and simplify:67/69/93" and demands **zero** hits after. The true baseline for generated `roadmap` is **two** hits — 58 **and 87**. Line 87 (source line 79) is `"...never references the roadmap's own structure because the orchestrator subagents never see this conversation..."` — which the plan's own **Out of Scope** section names explicitly: *"verified non-sites (spec D8). The statement stays true under Prime, where those children are RLM children. Do not churn them."*

So AC-23's arithmetic (zero) and the plan's Out of Scope section (do not touch line 79) are in direct contradiction, and the contradiction exists because the AC-23 baseline **under-counted** — precisely the proxied-`grep` truncation failure the plan warns about in Technical Notes. The architect's own baseline was taken with the broken tool.

**Resolution: the Out of Scope section wins.** It is explicit, reasoned, and cites the spec; AC-23's number is derived from a measurement now known to be incomplete. Touching line 79 would also have breached AC-24 (plugin source byte-identical). Recorded outcome:

| File | `subagent` before | after |
|---|---|---|
| generated `roadmap/SKILL.md` | 2 (lines 58, 87) | **1** (line 87 — the declared non-site) |
| generated `simplify/SKILL.md` | 3 (lines 67, 69, 93) | **0** |

Every in-scope site is gone. The single survivor is the one the plan forbids touching. **Reviewer: this needs a ruling — either AC-23 is amended to "zero resolution sites" or spec D8 is reopened. I did not decide it silently.**

**(3) The lanes are NOT independent — Lane A breaks a Lane B gate.** The plan states *"Lanes A and B are independent — they share no file, no command, and no failure mode."* False. `prime-agent/skills/clean-code-gates/` is a generated copy of the plugin skill **including its `__tests__/`**, so the moment Lane A edited `__tests__/schema.test.cjs`, `build-prime-agent.mjs --check` went red:

```
stale:   prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs
1 file(s) out of date.   check exit=1
```

This is correct behaviour, not damage — the Prime distribution *should* carry the fixed validator — and regeneration resolved it. But it means the changed-file set in Phase 3 has a **seventh** member the plan does not list: `prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs`, the generated mirror of the Lane A edit. It is in-scope by consequence, not over-scope, and it is not hand-edited (the build wrote it; `--check` exits 0). It also means the two lanes had to be **ordered**: Lane A first, then Lane B's regeneration.

**AC-22 census — exactly four hits, all prohibition/protocol text, at exactly the four cited lines (run one file per grep over all 154 files):**

```
explain-codebase/SKILL.md:17   map a unit to `subagent_type`, `Agent`, `task`, `Explore`, or `general-purpose`.
explain-codebase/SKILL.md:77   admit an RLM child with `rlm()` instead of `Agent`/`task` with a `subagent_type`
orchestrator/SKILL.md:17       to `subagent_type`, `Agent`, `task`, or a file in `.claude`/`.opencode`.
orchestrator/SKILL.md:632      "Can this session fan out?" ...
```

**Zero resolution sites.** Baseline was 6 (these 4 + `roadmap:58` + `simplify:67`) → now 4. `explain-codebase:17` was re-confirmed a false positive: it is overlay-injected Prime protocol text that *prohibits* those agent types. Not touched.

**Read the emitted result (the step `--check` cannot do).** Read all four regenerated sites in context. `roadmap`: item `1.` keeps its `  1. ` nesting, items 2–5 follow coherently, `### Step 1` / `### Step 2` heading levels intact, no orphaned reference to a removed mechanism. `simplify`: `### How to run the angles` intact, the two paragraphs still read as dispatch-then-fallback, Phase 2 follows cleanly, and the mode label sits correctly inside its ```text fence.

**Bounds preserved, checked line by line:**
- AC-15 `roadmap`: `rlm(prompt, name="context-scan")`; *"forbidden from writes and from mutating commands... never creates, edits, or deletes a file"*; inline fallback with continuation to the question rounds; *"Steps 3–4's confidence loop and the `context_threshold` gate are unchanged either way."*
- AC-17 `simplify` dispatch: `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))`; five angles together; one angle per child; resolved scope + diff passed in; **"they report findings; they do not edit"** carried verbatim.
- AC-18 `simplify` fallback: **only the trigger** restated ("when the session cannot admit RLM children, or cannot admit them concurrently" — a 1:1 map of the original's two clauses). Everything after it is byte-for-byte the source: *"work through all the angles yourself in this same context, in one pass. **Do not drop an angle for lack of fan-out** — and say plainly in the summary that this was a single-pass review, so nobody reads it as the full fan-out."* The orchestrator's inline-scan fallback wording was **not** copied in; `simplify` keeps its own single-pass answer and its summary-disclosure requirement.
- AC-19 mode label: `(no subagent fan-out available)` → `(no concurrent RLM children)`.

**AC-24 / AC-27 identity proofs — no bare `diff` anywhere (AC-28).** Double-proven:

```
git diff --numstat -- plugins/.../roadmap/SKILL.md plugins/.../simplify/SKILL.md   -> zero rows
git diff --numstat -- prime-agent/overlays/explain-codebase.json prime-agent/skills/explain-codebase -> zero rows
cmp -s <HEAD blob> <worktree>  ->  roadmap: IDENTICAL,  simplify: IDENTICAL
```

**Truth pass (AC-25) — `prime-agent/README.md`.** The claim *"exact-string replacements (... the Prime RLM dispatch protocol **in `orchestrator`**)"* was already understating before this plan (`explain-codebase` carries one too) and is flatly false after it. Chose the **generalize** option over enumerating, so it cannot go stale a third time: *"the Prime RLM dispatch protocol in every skill that would otherwise resolve a Claude Code / opencode agent type — the overlays themselves are the source of truth for which skills those are."* Re-read the whole README for other claims this change falsifies: line 3 "eleven workflows" still 11; lines 25–28 "Workflows that fan out work use Prime's `rlm` runtime" became *more* true, not less; the `spec-driven-eval` and "editing `skills/` directly is a bug" paragraphs are unaffected. Nothing else needed correcting.

**Observation, not fixed (pre-existing, out of scope).** `simplify` Phase 2 line 1 says *"Four angles looking at one diff routinely converge"* while the skill defines **five** angles. Pre-existing in the plugin source, unrelated to the dispatch mechanism, and fixing it would breach AC-24. Flagged for a future decision.

**Phase 2 verification — all green:**

```
node scripts/build-prime-agent.mjs          -> exit 0
node scripts/build-prime-agent.mjs --check  -> exit 0, "11 skills, 154 files"
cd prime-agent && npm test                  -> exit 0 (install ok, parity ok)
git diff --numstat (plugin sources + explain-codebase) -> zero rows
```

### 2026-08-19T13:26:40Z | CODER

**Phase 1 COMPLETE — Lane A: validator keyword coverage. All 10 tasks [x].**

**Result: 235 pass / 0 fail** (baseline 225 → +10, exit 0). Only changed file under `clean-code-gates` is `__tests__/schema.test.cjs` (141+/24-). AC-13 numstat over `src/`, `bin/`, `schema/`, `defaults.cjs`, `README.md`, `SKILL.md` = **zero rows**.

**TDD ordering note (deviation worth naming).** The plan puts the `checkNode`/`checkObject` refactor in task 6, but AC-7 requires the guard's implemented-set be *derived from the implementation* (`Object.keys(ASSERTIONS)`), and no such table existed. Deriving from a hand-written literal for the RED step would have been the exact anti-pattern AC-7 forbids. So the **behaviour-preserving** half of the refactor landed first (dispatch table carrying only the 7 already-honoured keywords, `checkObject` dissolved into handlers) and was proven neutral — **225 pass / 0 fail, unchanged** — before any test was written. Every RED below is therefore a red against a real derived set, not against a placeholder.

**RED → GREEN transcript (each observed, not assumed):**

| Test | RED evidence | GREEN |
|---|---|---|
| keyword-coverage guard (AC-7, AC-8) | `not ok 201 … report.schema.json asserts with keyword(s) the validator silently ignores: format, minimum, pattern` | yes |
| guard-of-the-guard, in-memory fixture (AC-9) | `not ok 202 … fixture asserts with keyword(s) the validator silently ignores: multipleOf` | yes |
| `summary.blockers = -5` (AC-1) | `not ok 200` | yes |
| `gates[0].gate = "NOTAGATE"` (AC-2) | `not ok 201` | yes |
| `generatedAt = "not-a-date"` (AC-3) | `not ok 202` | yes |
| `findings[0].endLine = 0` (AC-4) | `not ok 203` | yes |
| `findings[0].line = 0` (AC-5) | `not ok 204` | yes |
| unrecognized `format` raises (AC-6) | `not ok 210` | yes |

AC-9 was demonstrated **in-session** with a temporary test asserting the guard's own `deepStrictEqual(unhandled, [])` form against an in-memory fixture carrying `multipleOf`; it failed exactly as a schema-side regression would. `report.schema.json` was **never edited** (numstat proves it). The temporary test was then converted to its permanent form, plus two AC-8 schema-awareness tests: property names under `properties` (`multipleOf`, `maxLength`, `not`) are not counted as keywords, and `required`/`enum` array contents plus `additionalProperties: true` are not descended into — while a keyword genuinely nested under `properties.tags.items` still is caught.

**Complexity — before / after (hand-counted against the ESLint rule definitions; `clean-code-gates` ships zero deps so `npx eslint` cannot resolve offline):**

| Function | Cyclomatic before | after | Max depth before | after |
|---|---|---|---|---|
| `checkNode` | **11** | **5** | 2 | 2 |
| `checkObject` | 4 | *(dissolved)* | **3** | *(dissolved)* |

`checkNode` after = 1 base + `if (!TYPE_PREDICATES.object(schema))` 1 + `if (!ASSERTIONS.type(...))` 1 + `for` 1 + `if (keyword in schema)` 1 = **5**; max depth `for → if` = **2**.

`checkObject` no longer exists — its three responsibilities became the `required`, `additionalProperties`, and `properties` entries of `ASSERTIONS`. AC-10 names `checkObject` by name, so its successors are measured individually rather than the constraint being declared vacuous:

```
type                 c=1 d=0     const   c=2 d=1     enum     c=2 d=1
minimum              c=3 d=1     pattern c=3 d=1     format   c=4 d=1
required             c=4 d=2     properties c=4 d=2  items    c=2 d=1
additionalProperties c=6 d=2   <- worst case
collectSchemaKeywords c=6 d=2    unhandledKeywords c=1 d=0
```

**Worst cyclomatic across every function in the file = 6 (≤ 8 ✓). Worst max-depth = 2 (≤ 2 ✓).** AC-10 met on target, not on the hard floor. Both baselines (11 / 3) were over the project's own `THRESHOLDS.G2` and are now under.

**Truth pass (AC-11) — re-read for truth, not merely confirmed unedited.** The old docblock read *"Generic recursive check honouring type, required, additionalProperties, properties, items, enum, const."* — a seven-item coverage claim that was already the same defect class being fixed, and that would have gone stale again the moment a keyword was added. Replaced with *"The honoured keyword set is exactly the keys of `ASSERTIONS`."* — it defers to the table, so it cannot drift. Re-read the remaining four docblocks in the file (`checkType` has none; `corrupt`, `validate`, `ANNOTATION_KEYWORDS`, `collectSchemaKeywords`, `FORMAT_PREDICATES`, `ASSERTIONS`) for any other coverage claim this change falsified: none found — `validate`'s "no external deps" and `corrupt`'s independence claim both remain true.

**AC-12 — no existing test deleted or weakened.** All 11 original `negativeCases` rows survive verbatim; the 5 new rows are appended. Every original `test()` block is unchanged. **Zero existing assertions were modified.** The only non-test edits are the two helper functions the assertions dispatch through.

**One behaviour change worth the reviewer's attention** (not test-visible, deliberately recorded): `checkNode`'s schema guard tightened from `!schema || typeof schema !== 'object'` to `!TYPE_PREDICATES.object(schema)`, which additionally rejects an *array*-valued schema. No node in `report.schema.json` is an array-valued schema, so this is a strictness gain with no current behavioural difference.

**Phase 1 verification — all green:**

```
cd plugins/my-skills/skills/clean-code-gates && npm test   -> exit 0, 235 pass / 0 fail
git diff --numstat -- src bin schema defaults.cjs README.md SKILL.md  -> zero rows
```

### 2026-08-19T13:11:04Z | CODER

**Phase 1 Task 1 — Lane A baseline recorded (pre-edit).**

| Signal | Measured |
|---|---|
| `cd plugins/my-skills/skills/clean-code-gates && npm test` | **225 pass / 0 fail** (`1..225`, exit 0) |
| `checkNode` cyclomatic | **11** |
| `checkObject` max block-nesting depth | **3** |
| `report.schema.json` distinct keywords in schema position | **14** — 10 assertion + 4 annotation |

`checkNode` cyclomatic arithmetic (ESLint `complexity` rule: 1 + each `if`/`else if`/loop/`case`/`catch`/`&&`/`||`/`??`/ternary; arrow callbacks count as their own function):

```
1  base
+2 if (!schema || typeof schema !== 'object')        // if +1, || +1
+1 if (!checkType(...))                              // if +1
+2 if ('const' in schema && value !== schema.const)  // if +1, && +1
+2 if (schema.enum && !schema.enum.includes(value))  // if +1, && +1
+1 if (Array.isArray(value))                         // if +1
+1 if (schema.items)                                 // if +1  (the forEach arrow is its own function)
+1 if (TYPE_PREDICATES.object(value))                // if +1
= 11
```

`checkObject` max-depth arithmetic (ESLint `max-depth`: deepest nesting of block statements in one function body):

```
for (required)      -> if (!hasOwn)                    = 2
if (addlProps===false) -> for (keys) -> if (!hasOwn)   = 3   <- max
for (properties)    -> if (key in value)               = 2
= 3
```

Both are over the project's own `defaults.cjs` `THRESHOLDS.G2` values (complexity 8 / depth 2) — invisible today only because `__tests__/` sits outside `roots: ['src']`.

Schema keyword census (schema-aware walk; `properties` keys treated as property names, not keywords; `required`/`enum` contents and boolean `additionalProperties` not descended into):

```
$id x1   $schema x1   title x1   description x19          <- 4 annotation/meta
additionalProperties x8   const x1   enum x4   format x1
items x7   minimum x4   pattern x1   properties x6
required x6   type x45                                    <- 10 assertion
TOTAL distinct: 14
```

Implemented by the validator today = **7** (`type`, `required`, `additionalProperties`, `properties`, `const`, `enum`, `items`). Missing = **3**: `minimum`, `pattern`, `format`. Matches the plan's Technical Notes exactly.

### 2026-08-19T13:08:37Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-19T13:04:31Z | ARCHITECT

Created plan `FEAT-20260819T130106Z-c55f`. Type: feat. Tasks: 24 across 3 phases (Lane A validator, Lane B Prime overlays, joint close-out).

**Baselines measured in-session** (these are the floors, not estimates):

| Signal | Value |
|---|---|
| `clean-code-gates` `npm test` | 225 pass / 0 fail |
| `build-prime-agent.mjs --check` | exit 0 — `11 skills, 154 files` |
| `prime-agent` `npm test` | exit 0 — install ok, parity ok |
| host-vocabulary census over `prime-agent/skills/` | 6 hits — 4 known-good prohibition lines + `roadmap/SKILL.md:58` + `simplify/SKILL.md:67` |
| `subagent` in generated roadmap / simplify | roadmap:58; simplify:67, 69, 93 |
| `checkNode` cyclomatic / `checkObject` depth | 11 / 3 (re-derived by hand from the ESLint rule definitions) |

**Tooling hazards recorded as verification constraints.** Bare `diff` exits 0 on differing files in this shell (spec-reported, carried). New this session: the proxied `grep` truncates multi-file results — a two-file census returned only the first file's hits and reported "2 matches in 1F", silently dropping three. AC-22/23 therefore mandate one file per grep with hit counts cross-checked against the baseline.

**Scope confirmations against the tree.** `simplify` has three sites, not one (source lines 59, 61, 85 → generated 67, 69, 93). `explain-codebase`'s matches are Prime prohibition text and its dispatch site was already ported — excluded, with an AC asserting it stays untouched. Neither `roadmap` nor `simplify` has a `.opencode/` override port, so `opencode-port-parity` does not apply.

**Ruling recorded.** The `rlm()` contract stays self-contained inside the replacement strings by default; a `protocol.simplify.md` overlay block is a permitted alternative and does not affect the `154 files` count, since overlays live outside the generated tree.

**Named blind spot designed against.** Two files are made false by this change without their subject being touched — the `checkNode` docblock and `prime-agent/README.md`. Each has its own explicit re-read-**for-truth** task, not a "confirm unedited" check.

Status: PLANNED. Ready for coder.

---

## Handoff

| From      | To        | Condition                  | Action                                                          |
| --------- | --------- | -------------------------- | --------------------------------------------------------------- |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FEAT-20260819T130106Z-c55f`         |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FEAT-20260819T130106Z-c55f`      |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the CR file path`                        |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FEAT-20260819T130106Z-c55f`            |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`                 |

### SIMPLIFY — 2026-08-19
Five angles across two concurrent agents (reuse+simplification+efficiency over the validator; altitude+conventions over the whole change). Both worked around the two verified shell hazards — proxied `diff` exits 0 on differing files, proxied `grep` truncates multi-file results — using cmp/shasum/node and one file per scan.

Fixed 0. Every finding is either a correctness bug (which a cleanup pass never folds in) or larger than this change should carry.

Verified, and stronger than the plan claimed: the validator was loaded in memory and probed adversarially. Reconstructing the base validator confirmed line=0, blockers=-5, gate=NOTAGATE and generatedAt=not-a-date were ALL accepted before — four silent holes closed, not one. Every pre-existing rejection survives the refactor (nested additionalProperties, required three levels down, enum inside items-of-items, type unions, integer-vs-number). The guard fires on a new unhandled keyword at every depth tried, and does not confuse a property NAMED like a keyword with a keyword.

BUGS reported, not fixed:
- A1 (highest value) — the rlm() contract in overlays/roadmap.json and overlays/simplify.json is a dangling pointer. Both say "per the Prime Agent compatibility note above", but insertAfterFrontmatter inserts only preamble.md, which defines no rlm(), no agent_message and no receiver_name. rlm() returns only an admission handle, never the child result — a fact stated only in protocol.orchestrator.md and protocol.explain-codebase.md, which these two skills do not receive. So the ported roadmap admits a scan child then uses "the digest", and the ported simplify says "Wait for every angle", with no defined return path in either. This is bug-4's own class one level in: the port names a mechanism the target does not have. The plan's default (keep the contract self-contained in the replacement strings) is unachievable — the missing piece is a completion protocol, which is a block, not a clause.
- B1 — object-valued additionalProperties is unenforced AND unflagged. ASSERTIONS.additionalProperties returns unless the value is exactly false, but because the key exists in ASSERTIONS the guard reports full coverage. Verified: thresholds.additionalProperties {"type":"number"} with thresholds {limit:"NOT A NUMBER"} gives guard=[] validate=[]. collectSchemaKeywords explicitly descends into the object form, so the two walkers disagree about whether it is a sub-schema. This is the regression class the guard exists to prevent.
- B2 — tuple-form (array-valued) items has the same shape: unenforced, unflagged.
- B3 — false-positive CI break: adding a purely documentary default/examples/$comment/deprecated to report.schema.json fails the suite with "asserts with keyword(s) the validator silently ignores" — a red suite and a wrong diagnosis for an edit that changed no constraint. Fails loud, never silent, so the safety property is intact.

Conventions: C1 — PROJECT-CONTEXT "Mirror machinery" violated by the two new overlays (established shape is ["preamble.md", "protocol.<skill>.md"]; the divergence is undocumented, four lines from a different divergence that was documented). C2 — simplify/SKILL.md's "runs identically in Claude Code and opencode" is false in the Prime port; explain-codebase treats that exact sentence class as a defect worth a count:1 replacement. C3/C4 — both assigned truth-passes verified corrected: prime-agent/README.md now defers to the overlays as source of truth (closing the drift class rather than restating today's instance), and the validator docblock now reads "exactly the keys of ASSERTIONS", which cannot drift. C5 — PROJECT-CONTEXT gaps confirmed and widened: Layout omits prime-agent/ entirely, Scripts omits build-prime-agent.mjs, Test omits prime-agent's npm test, the "clean-code-gates is the only runtime gate" invariant is now false (parity.sh is a second), and the marketplace list omits explain-codebase and simplify.

Rulings upheld: the handler table earns its keep (Object.keys(ASSERTIONS) is the guard's source of truth; a switch cannot be reflected on); the src/validate-report.cjs deferral is right for a sharper reason than "one-way door" (it would be either dead code in src/ or a new CLI failure path, and the guard asserts a build-time property); and the generator-transform rejection still holds at four applications, because the four replacements are four different prose rewrites no regex produces — what should generalize is the protocol block, not the anchors.

Gates unchanged (no edits made): clean-code-gates 235/235, build --check exit 0, prime-agent npm test exit 0, the two schema.test.cjs copies byte-identical by cmp.
