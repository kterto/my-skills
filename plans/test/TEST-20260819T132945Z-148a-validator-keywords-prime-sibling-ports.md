---
id: TEST-20260819T132945Z-148a
plan: FEAT-20260819T130106Z-c55f
title: Test Report — Schema-validator keyword coverage and Prime sibling-skill agent-type ports
status: PASS
created_at: 2026-08-19T13:38:46Z
cycle: 0
---

**Related:** [FEAT-20260819T130106Z-c55f](../feat/FEAT-20260819T130106Z-c55f-validator-keywords-prime-sibling-ports.md)

## Summary

Two concerns on two different surfaces, tested differently and reported separately.

**Lane A (`clean-code-gates` schema validator)** is the only executable surface in this change. Its suite went **235 → 249 pass / 0 fail**; I added 14 tests, all green, all mutation-verified to bite. Line coverage **87.49% → 87.73%** overall, far above the 70% floor; the plan's own surface (`__tests__/schema.test.cjs`) is 100% line, branch 91.43% → 92.59%, funcs 96.61% → 97.47%.

**Lane B (Prime overlay ports for `roadmap` and `simplify`)** has **no executable path and no behavioural test can be written for it** — not as an excuse, as a fact about the surface. `prime-agent/skills/**` is generated markdown consumed by an agent runtime, not code this repo runs. `build-prime-agent.mjs --check` proves only that the tree matches what the overlays produce; it would exit 0 just as happily on a semantically wrong replacement, and I proved that concretely below. Lane B's only real verification is reading the **emitted text**. I read it, and it is where the highest-value finding of this run lives.

All three floors hold simultaneously on the final tree: `clean-code-gates` 249/0 (exit 0); `build-prime-agent.mjs --check` exit 0 (`11 skills, 154 files`); `prime-agent && npm test` exit 0.

**One finding rises above the rest: A1 is real, and it is worse in `simplify` than reported.** See *Independent bug assessment*.

## Flows Triaged

PROJECT-CONTEXT declares no e2e framework and no e2e flows ("**e2e:** none — 'flows' are skill behaviors described in prose"). Selection below is therefore over *verifiable behaviours*, with the e2e-equivalent for each.

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| Validator rejects each newly honoured keyword **for the right reason** | High | **Selected** | The coder's `negativeCases` loop asserts only `errs.length >= 1`. A case can stay green while being caught by the wrong keyword, which directly undercuts AC-5's stated intent ("pinned by a test, not by the implementation alone"). Highest impact per line added. |
| `minimum` is inclusive at every site (boundary, no off-by-one) | High | **Selected** | Nothing in the coder's suite fixed the boundary. Verified: the pre-existing suite *does* catch an exclusive-`minimum` mutant, but only via 2 incidental conformance failures with a misleading diagnosis; with the boundary cases it is 12 failures naming the exact site. |
| `format: date-time` regex accepts RFC-3339 and rejects near misses | High | **Selected** | A hand-rolled regex added this session, exercised by exactly one negative string. Cheap to guard, easy to silently loosen. |
| **Keyword-*form* coverage** of `report.schema.json` | High | **Selected** | This is the class behind reported bugs B1 and B2 and the only genuinely new guard I added. See below. |
| `ASSERTIONS` / `ANNOTATION_KEYWORDS` disjointness | Medium | **Selected** | Cheap invariant, and the one mutant the coder's suite scores **0 kills** on. |
| `summary.warnings` minimum site | Medium | **Selected** (folded into right-reason table) | `minimum` has 4 sites in the schema; the coder's negatives exercise 3. Thoroughness rather than a hole, since one shared handler serves all four. |
| Lane B — behavioural test of the emitted `rlm()` dispatch | High impact, **zero testability** | **Excluded — cannot exist** | Stated plainly, per the plan's own Technical Notes. No runtime, no assertable output. Substituted with a read of the emitted text plus the census. Inventing a "test" here would have been theatre. |
| `--check` / `prime-agent npm test` as Lane B *semantic* evidence | — | **Excluded as semantic evidence, kept as regression floor** | Proven inadequate this session: I mutated only the mirrored test file and `--check` went red on *bytes*, never on meaning. It is a parity gate, not a correctness gate. |
| Re-testing `src/`, `bin/`, `defaults.cjs` | Low | **Excluded** | `git diff --numstat` over those paths is empty (AC-13 verified). No behaviour changed; existing coverage stands. |
| Doc-skill structural checks on `roadmap`/`simplify` plugin sources | Low | **Excluded** | Byte-identical to HEAD (AC-24 verified, zero numstat rows). Nothing to test. |

## E2E Tests Added

No e2e framework exists in this project, so these are unit/integration tests against the only executable surface. All appended to `plugins/my-skills/skills/clean-code-gates/__tests__/schema.test.cjs` — **purely additive** (verified: the pre-edit file is an exact prefix of the post-edit file), no existing test deleted or weakened. 14 tests, 235 → 249.

1. **`validator rejects for the right reason — <keyword>`** (6 tests). Asserts the *exact* violation list for each of `minimum` (×3 sites incl. the previously unexercised `summary.warnings`), `pattern`, `format`, and the optional-property `endLine` path. Replaces "at least one error" with "this error".
2. **`validator accepts a valid report: <site> at its minimum`** (4 tests). Every `minimum` boundary value validates clean — guards against over-rejection.
3. **`format: date-time accepts the RFC-3339 forms and rejects the near misses`** (1 test). Accepts `Z`, fractional seconds, `+02:00`; rejects space-separated, offsetless, date-only, and empty.
4. **`the annotation allow-list and the implemented set are disjoint`** (1 test). A keyword present in both sets would make the coverage guard silently permissive.
5. **`report.schema.json uses only the keyword forms the validator actually walks`** + **`the keyword-form guard detects the forms it exists to catch`** (2 tests). The new `unsupportedKeywordForms` walk. This is the direct, non-invasive answer to bugs B1/B2: it does not assert the broken behaviour and it does not touch the implementation, but it goes **red the day** `report.schema.json` adopts tuple-form `items` or object-form `additionalProperties` — precisely the moment the silent hole would open.

### Mutation verification (every added test proven to bite)

Mutants applied to a **copy**, run, then the file restored and re-verified byte-identical by `shasum`. The repo file was never left mutated.

| Mutant | Coder's suite kills | Suite after my additions |
|---|---|---|
| `minimum` becomes exclusive (`>` for `>=`) | 2 (incidental, misleading) | **12** (named sites) |
| `minimum` handler no-ops | 3 | **7** |
| `pattern` handler no-ops | 1 | **2** |
| `date-time` predicate always true | 1 | **3** |
| Annotation list shadows an implemented keyword | **0 — survives** | **1 — killed** |

Honest reading: the coder's suite already kills four of the five mutants, so my additions mostly buy **localization and diagnosis**, not newly-closed holes. The fifth mutant, and the keyword-*form* guard, are the two genuine gaps closed.

### Lane B

**Zero tests added, and none can be.** Recorded here as the deliberate outcome, not an omission.

## Coverage

Coverage tooling is not named in PROJECT-CONTEXT ("not measured except within `clean-code-gates`", and even there `package.json` has no coverage script). It is nonetheless available: Node v22.22.2, `node --test --experimental-test-coverage`. Not BLOCKED.

| Metric | Before | After |
|---|---|---|
| All files — line | 87.49% | **87.73%** |
| All files — branch | 88.55% | 88.77% |
| All files — funcs | 93.00% | 93.25% |
| `__tests__/schema.test.cjs` (this plan's Lane A surface) — line | 100.00% | 100.00% |
| `__tests__/schema.test.cjs` — branch | 91.43% | **92.59%** |
| `__tests__/schema.test.cjs` — funcs | 96.61% | **97.47%** |
| `src/report.cjs` (module under test) — line | 100.00% | 100.00% |

**≥ 70% floor met with room to spare.** No coverage-driven test additions were needed; every test above was added for defect-detection value, not to move a number.

Note for the reviewer: Lane A's "production code" *is* a test file — the validator lives inside `__tests__/schema.test.cjs`. Coverage of this plan's diff is therefore a partly degenerate metric, which is why the mutation table above carries more weight than the percentages.

## Test-Quality Audit

**Weak assertions found in the coder's work** (none blocking, all now compensated):

- **`negativeCases` asserts `errs.length >= 1` and nothing more** (16 cases). A case can pass while the violation comes from a different keyword than the one the label names. This matters most for the five cases added this session, whose entire purpose is to pin specific keywords. Compensated by the right-reason table; the original loop was left intact.
- **No boundary/positive cases for the new `minimum` keyword.** Rejection was proven; non-over-rejection was not. Compensated.
- **`summary.warnings` — one of four `minimum` sites — was unexercised.** Compensated.
- **`format` exercised by a single string** (`'not-a-date'`), which does not distinguish "rejects garbage" from "rejects everything". Compensated.

**No tautologies, no empty asserts, no disabled/skipped tests** found. `# skipped 0 # todo 0` on every run. The `corrupt()` deep-clone harness correctly isolates cases. The `unhandledKeywords` guard genuinely derives its implemented set from `Object.keys(ASSERTIONS)` as AC-7 requires — verified by reading, and by the guard-of-the-guard fixtures the coder wrote (which are real, not decorative).

The `checkNode` docblock truth-pass (AC-11) holds: it now reads "The honoured keyword set is exactly the keys of `ASSERTIONS`", which cannot go stale.

## Independent bug assessment

All four reproduced from scratch, in memory, against an unmodified `report.schema.json`. Repro harness: a byte-exact `sed` slice of the coder's validator into a scratchpad module — no repo file was edited to reproduce anything.

### A1 — the `rlm()` contract is a dangling pointer. **CONFIRMED, and worse in `simplify` than reported. Highest severity of the four.**

`prime-agent/overlays/{roadmap,simplify}.json` both declare `insertAfterFrontmatter: ["preamble.md"]` — verified programmatically. `preamble.md` is 417 bytes and defines **no `rlm()`, no `agent_message`, no `receiver_name`, no return path**; it only says "use the Prime equivalent" for host control surfaces. `orchestrator` and `explain-codebase` additionally receive `protocol.orchestrator.md` / `protocol.explain-codebase.md`, which is where every one of those idioms is actually defined — including the load-bearing sentence "**`rlm()` returns only an admission handle, never the child's result**" and the join rule "join only after every child's `agent_message` has arrived".

Both new replacements cite "**per the Prime Agent compatibility note above**". That note is `preamble.md`. The pointer resolves to a document that does not contain the contract.

Concretely, in the **emitted** text:

- **`roadmap` (generated line 50 region).** Binds `handle = await rlm(prompt, name="context-scan")`, then two clauses later says "Using **the digest**, run structured user-question rounds". The digest never arrives and `handle` is never used again. The well-specified inline fallback does **not** rescue this: its trigger is "if no child can be admitted", and admission *succeeded*. Realistic failure mode — the agent proceeds to the question rounds with an empty digest, silently degrading the very `context_threshold` gate the step exists to satisfy.
- **`simplify` (generated lines 67–73). Worse.** The dispatch is `await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))` with **the result discarded** — no variable is bound. The very next sentence instructs re-asking a child "with `receiver_name=handle.name`", where **`handle` does not exist in any scope**. That call form is lifted verbatim from `protocol.explain-codebase.md:21`, but without line 16's `handle = await rlm(...)` binding and without any mention of `agent_message`, neither of which `simplify` receives. Phase 2 then opens with "1. **Wait for every angle**" — with no defined wait mechanism, and against a `gather` that per the platform contract resolves on *admission*, not completion.

**Judgement on the orchestrator's question — can a Prime agent following this text complete the dispatch?** For `roadmap`: only by improvising a receive step the document never describes. For `simplify`: no. A literal reading admits five children, immediately proceeds to Phase 2 dedup with zero findings collected, and then emits a summary whose mode line reads `5-angle fan-out` — an empty review that reports itself as the complete one. That is a silent-wrong-answer failure mode, which is why I rank A1 above all three validator bugs. **`simplify`'s own fallback disclosure rule ("say plainly in the summary that this was a single-pass review") is defeated**, because the agent believes the fan-out ran.

Cheapest correct fix, entirely within the plan's own stated *Permitted alternative*: add `protocol.simplify.md` (and the equivalent for `roadmap`) to `insertAfterFrontmatter`, mirroring `explain-codebase`'s shape. The plan already rules this permitted and already notes overlay block files live outside the generated tree, so the `154 files` count is unaffected.

### B1 — object-valued `additionalProperties` unenforced AND unflagged. **CONFIRMED. Latent.**

Reproduced exactly as reported. Cloning `report.schema.json` in memory, setting `gates.items.properties.thresholds.additionalProperties = {"type":"number"}` and validating `{thresholds: {limit: "NOT A NUMBER"}}`:

```
guard    (unhandledKeywords) = []
validate (subtree)           = []
```

The handler returns unless the value is exactly `false`; the guard reports full coverage because the *key* `additionalProperties` is in `ASSERTIONS`. The two walkers do disagree as reported — `collectSchemaKeywords` explicitly descends into the object form (proven: a `multipleOf` nested under it **is** flagged), while `checkNode` never walks it at all.

**Severity: low-but-sharp.** The live schema uses `additionalProperties` at 8 sites, all boolean (`false` ×6, `true` ×2), and the `true` case is handled correctly. So there is **no live hole today** — it is a trap armed for the next schema edit. The real defect class is broader than the report frames it: **the guard checks keyword *presence*, not keyword-*form* coverage**, so it cannot detect a partially-implemented keyword. My `unsupportedKeywordForms` test now makes that specific trap loud.

### B2 — tuple-form (array-valued) `items` unenforced AND unflagged. **CONFIRMED. Latent. Same class as B1.**

```
guard    = []
validate = []      // {pair: [999, "wrong-way-round"]} against items:[{string},{integer}]
```

Mechanism: `ASSERTIONS.items` calls `checkNode(item, schema.items, …)`, and `checkNode`'s first line bails because `TYPE_PREDICATES.object` excludes arrays. `collectSchemaKeywords` likewise adds nothing. Verified the live schema has **zero** tuple-form `items` sites, so again latent, and again now guarded.

### B3 — false-positive CI break on documentary keywords. **CONFIRMED. Lowest severity of the four.**

In-memory clone, adding one purely documentary keyword to `summary.blockers`:

```
default    -> ["default"]      examples  -> ["examples"]
$comment   -> ["$comment"]     deprecated-> ["deprecated"]     readOnly -> ["readOnly"]
(unmodified schema)            -> []
```

Root cause is narrow and cheap: `ANNOTATION_KEYWORDS` is `{$schema, $id, title, description}`. Two of those four (`$schema`, `$id`) are *core* keywords, not annotations — so the set is mis-named and, judged against the JSON Schema annotation vocabulary it claims to model (`title, description, default, examples, deprecated, readOnly, writeOnly, $comment`), it is missing five of eight.

**Severity: low, and correctly so.** It fails loud, not silent. But the diagnosis is actively wrong — "asserts with keyword(s) the validator silently ignores" for an edit that added no constraint — which is the kind of red that trains people to widen the allow-list reflexively without reading. Recommend completing `ANNOTATION_KEYWORDS` to the spec vocabulary. I did **not** apply this: it is an implementation edit, outside a tester's surface, and it belongs to whoever rules on B1/B2 since all three are the same allow-list/handler-table design.

**Ranking for the reviewer: A1 ≫ B3 > B1 ≈ B2.** A1 ships a silently-wrong review. B3 is a live, recurring papercut with a misleading message. B1/B2 are armed traps with no live trigger, now converted from silent to loud by test 5.

## Corroboration of the simplify pass

Independently confirmed, not taken on report:

- The base validator accepted **all four** silent holes — `line: 0`, `blockers: -5`, `gate: "NOTAGATE"`, `generatedAt: "not-a-date"`. Each now produces exactly one violation with a correct message. **Four holes closed, not one.**
- **Every pre-existing rejection survives the refactor** — all 16 `negativeCases` green, and the two whole-report conformance tests green.
- The guard fires on a new unhandled keyword at depth (verified at three depths: top-level, under `properties.*`, and nested inside `items`), and does **not** confuse a property *named* like a keyword with a keyword (the coder's `multipleOf`/`maxLength`/`not` property-name fixture is genuine and passes).
- Complexity claim holds by inspection: `checkNode` is now a 3-line dispatch over `POST_TYPE_KEYWORDS` — cyclomatic 5 against the plan's ≤ 8 target and 11 baseline.

## Plan-vs-tree discrepancies — all three confirmed

1. **AC-23 is unsatisfiable as written. CONFIRMED.** The plan's baseline claims generated `roadmap` has one `subagent` hit (line 58). Measured against `git show HEAD`: it has **two** — line 58 (the site, now fixed) and **line 87**. Post-change the count is **1, not 0**. Line 87 is `"…because the orchestrator subagents never see this conversation"` — generated from source line 79, which the plan's own **Out of Scope** section names as a verified non-site and forbids touching. AC-23 cannot be satisfied without violating Out of Scope. **The coder correctly honoured Out of Scope and escalated.** Root cause is exactly as the orchestrator flagged: the architect's baseline was taken with the truncating grep. Recommend the reviewer amend AC-23 to "exactly one hit, the Out-of-Scope non-site at generated line 87" rather than treating this as a coder shortfall.
   Meanwhile **AC-22 is satisfied exactly**: a census by direct file walk (not grep) returns **4** hits — `explain-codebase/SKILL.md:17`, `:77`, `orchestrator/SKILL.md:17`, `:632`. Zero resolution sites. `simplify` returns **0** `subagent` hits as specified.
2. **The lanes are not independent. CONFIRMED, and re-proven by my own edit.** `shasum` shows `plugins/…/clean-code-gates/__tests__/schema.test.cjs` and `prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs` byte-identical — the generated tree mirrors the plugin `__tests__/`. When I added my 14 tests, `--check` immediately reported `stale: prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs`. I regenerated via the builder (never hand-edited the generated tree) and `--check` returned to exit 0 at `11 skills, 154 files`. The seventh changed file is a build product, in-scope by consequence.
3. **The `roadmap` anchor is source line 50, not 59. CONFIRMED.** `plugins/my-skills/skills/roadmap/SKILL.md:50` carries the `Spawn an \`Explore\`/\`explore\` subagent` anchor. `simplify`'s three anchors **are** at 59 / 61 / 85 as the plan states, so the error is isolated to the `roadmap` entry.

## Scope confirmations

- **`docs/reviews/feat-prime-agent-…-2026-08-19.md` is out of scope. CONFIRMED.** Its diff is a single `[ ] → [x]` checkbox flip on finding `arch-2` plus a `_fixed via orchestrator · 07bbbb9 · 2026-08-19_` provenance line — `validation-fixer` bookkeeping for a different work unit. Nothing to do with this plan.
- **AC-24 / AC-27 / AC-13 all verified clean** — `git diff --numstat` returns zero rows for `roadmap`/`simplify` plugin sources, `explain-codebase` overlay and generated tree, and every `clean-code-gates` non-test path.
- **AC-28 honoured throughout.** Every identity claim in this report used `shasum`, `git diff --numstat`, or a direct file walk. **Bare `diff` exit status was used zero times.** Independently re-confirmed the second hazard too: a single-pattern `grep` over one file reported `4 matches in 1F` for a 6-alternative pattern, so all census figures here come from a Node file walk, cross-checked per file.
- **AC-25 verified by reading, not just by numstat**: `prime-agent/README.md` now generalizes to "every skill that would otherwise resolve a Claude Code / opencode agent type — the overlays themselves are the source of truth", which cannot go stale.

## Verdict

**PASS.**

- Lane A: 249 pass / 0 fail (exit 0), up from 235. Coverage 87.73% line, floor is 70%. Every added test mutation-verified.
- Lane B: no behavioural test exists or can exist — stated plainly. Verified by reading the emitted text, which is where finding A1 came from.
- Floors hold simultaneously on the final tree: `clean-code-gates` exit 0 · `build-prime-agent.mjs --check` exit 0 (`11 skills, 154 files`) · `prime-agent && npm test` exit 0.

**PASS is a statement about the test suite, not a clearance of A1.** Nothing in the executable surface is failing. But A1 is a genuine defect in what this plan actually shipped for Lane B, it is not covered by any gate that exists, and in `simplify` it produces a silent empty review that reports itself as a complete one. **It needs a reviewer ruling before this reaches READY_TO_COMMIT.** B3 warrants a cheap fix; B1/B2 are now guarded and can be scheduled.
