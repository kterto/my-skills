---
id: QA-20260819T143237Z-bda6
plan: FIX-20260819T135107Z-3895
cr: CR-20260819T142449Z-d603
title: QA Report — Prime RLM dispatch protocol block and validator keyword-set hygiene
status: READY_WITH_WARNINGS
created_at: 2026-08-19T14:32:37Z
qa-agent: qa-agent
cycle: 0
test_failures: 0
lint_errors: 0
type_errors: 0
---

**Related:** [FIX-20260819T135107Z-3895](../code-review/FIX-20260819T135107Z-3895-rlm-dispatch-protocol-keyword-hygiene.md) · [CR-20260819T142449Z-d603](../code-review/CR-20260819T142449Z-d603-rlm-dispatch-protocol-keyword-hygiene.md) · [FEAT-20260819T130106Z-c55f](../feat/FEAT-20260819T130106Z-c55f-validator-keywords-prime-sibling-ports.md) · [SPEC-20260819T125322Z-51a9](../specs/SPEC-20260819T125322Z-51a9-validator-keywords-prime-sibling-ports.md)

## Summary

QA'd the whole change set against base `d214ff7` — the parent `FEAT-…-c55f` plus this FIX plan, **eight in-scope files** across two lanes with two entirely different verification surfaces. Lane A's executable floor is green at **250 pass / 0 fail** and I did not stop at the number: I ran three mutation-style probes against the new `NON_ASSERTING_SETS` registry to test whether it actually prevents the desync it claims to, and it does, in all three directions. Lane B has no executable path, so I verified it the only way it can be verified — by reading the emitted `roadmap` and `simplify` text as a Prime agent receives it, with access to `preamble.md` and `protocol.rlm-dispatch.md` only, and auditing every identifier at every point of use.

**The cycle-1 blocking defect is genuinely closed.** In both ports every identifier is bound in text the agent can see, and a dispatch completes end to end — admit, return, join, retry, terminating fallback. The silent-empty-review path that made generated `simplify` unexecutable is closed. All four censuses re-derived independently by Node walk agree with the CR to the line number.

Verdict is **READY_WITH_WARNINGS**: every blocking gate passes, and the single warning is **G8 aggregate rework 1.00**, driven by a cycle-1 review that correctly caught a real unexecutable-skill defect. Both open Should Fix items are confirmed real, confirmed non-blocking, and neither is a QA blocker — no gate fails on either.

## Test Results

| Suite | Total | Passed | Failed | Skipped | Status |
|-------|-------|--------|--------|---------|--------|
| `clean-code-gates` (`npm test`, `node --test`) | 250 | 250 | 0 | 0 | ✅ |
| `prime-agent` (`npm test` — `install.sh` + `parity.sh`) | 2 | 2 | 0 | 0 | ✅ |
| Build / parity (`build-prime-agent.mjs --check`) | — | — | — | — | ✅ exit 0, `11 skills, 154 files` |
| Lint | — | — | — | — | N/A — none configured (PROJECT-CONTEXT → *Commands*) |
| Format check | — | — | — | — | N/A — none configured |

Re-run after the probes to prove the probes left nothing behind: **250 / 250 / 0**, `--check` exit 0, working tree at 18 entries with **zero probe residue**.

Lane A grew **225 → 250** assertions. No test deleted; one existing assertion changed (the disjointness guard, renamed and widened) and it is named with its reason in the Progress Log — that is the assertion being *corrected*, and I verified below that the widened form is strictly stronger than the one it replaced.

## Clean Code Gates

| Gate | Metric | Threshold | Result |
|------|--------|-----------|--------|
| G1 Coverage (changed files) | stmts / branches | ≥85% / ≥80% | **INAPPLICABLE** — see below |
| G2 Complexity | cyclomatic / depth / fn-len / params / stmts | ≤8 / ≤2 / ≤30 / ≤4 / ≤15 | **INAPPLICABLE** — 0 gateable files changed |
| G3 Length & nesting | subsumed by G2 | — | **INAPPLICABLE** — 0 gateable files changed |
| G4 Naming | intent-revealing | 0 violations | **INAPPLICABLE** — 0 gateable files changed |
| G5 No comments | inline comment audit | 0 violations | **INAPPLICABLE** as a gate; ✅ clean on an advisory read |
| G6 Mutation score | killed / total | ≥70% | **INAPPLICABLE** — no gateable surface; ✅ 3/3 hand-run probes killed |
| G7 Dependency structure | layering, cycles | 0 violations | **INAPPLICABLE** — 0 gateable files changed |
| G8 Rework ratio | (REQUEST_CHANGES + FIX/QAF) / total CR | ≤0.5 | ⚠️ **HIGH_REWORK** aggregate 1.00; ✅ 0.00 plan-scoped |

### Why INAPPLICABLE and not BELOW_FLOOR

This run differs from prior doc-skill QA runs on this repo in one way worth stating: **it is not an all-markdown change set.** Lane A really does touch a `.cjs` file. So I did not assert inapplicability from the file extension — I asked the repo's own gate runner, and it answered.

```
$ node bin/gates.cjs --scope "files:__tests__/schema.test.cjs" --gates G5 --out -
error: scope resolved to zero gateable files (files) — nothing was measured,
       so this run has no verdict
```

`defaults.cjs:31` sets the `node-ts` gateable root to `['src']`. The one changed code file lives in `__tests__/`, outside every gated root, so the project's own configuration declares it **not a gateable file** — and the runner refuses to emit a verdict rather than emit a misleading one. That is the correct answer, not a missing tool:

1. **No production code changed.** `git diff --numstat HEAD` over `clean-code-gates/{src,bin,schema,defaults.cjs,README.md,SKILL.md}` returns **zero rows**. Those paths are explicitly Out of Scope in the plan, and they stayed that way. Every gate G1–G7 measures production surface; none changed.
2. **The changed file is test code, and it is exercised.** It is not an untested changed file — it *is* the test, and it holds a test-local structural validator (`ASSERTIONS`, `checkNode`, `unhandledKeywords`) that its own 250 assertions cover and that I additionally drove directly in the probes below. G1's failure mode (an untested changed file) does not exist here.
3. **Lane B is markdown and JSON.** `prime-agent/overlays/*.{md,json}`, `prime-agent/README.md`, and the generated `prime-agent/skills/**` markdown carry no statement, branch, function, or import. A number here would not be low — it would be undefined.
4. **No mutation tooling is installed** (no `stryker`, no `eslint`, no `dependency-cruiser` at repo root or in the skill). Rather than record G6 as MISSING_TOOL and stop, I hand-ran three mutation probes against the exact machinery the change introduces (below) — **3 mutants, 3 killed**.

Verification was **executed**, not skipped: three suites, a full regeneration, four Node-walk censuses, three registry mutation probes, one Python execution probe, and a line-by-line identifier audit of both emitted ports.

### G8 — computed both ways, because the framing changes the answer

| Framing | REQUEST_CHANGES | FIX/QAF spawned | Total CR | Ratio | Result |
|---|---|---|---|---|---|
| Plan-scoped (`FIX-…3895` only, per role spec) | 0 | 0 | 1 | **0.00** | ✅ PASS |
| Aggregate (the work unit actually under evaluation) | 1 | 1 | 2 | **1.00** | ⚠️ HIGH_REWORK |

The aggregate governs, because the aggregate is what ships. Root-cause note is in **Verdict** — it is not "the coder was sloppy", and it is worth reading before anyone acts on the warning.

## Lane A — the schema validator (real executable surface)

### AC-16/17 — the sets now hold what they are named for

`CORE_KEYWORDS = {$schema, $id}` is split out with a docblock saying why they are core ("they identify and version the schema document itself and constrain no instance"). `ANNOTATION_KEYWORDS` is complete at all eight: `title, description, default, examples, deprecated, readOnly, writeOnly, $comment`. No set is named for a category it does not hold.

### AC-18 — does the registry actually prevent the drift it claims?

The claim under test: `unhandledKeywords` and the disjointness guard both read `NON_ASSERTING_SETS` **by reference**, so they cannot desync. A registry that merely *exists* proves nothing — a set could still be reachable by one consumer and not the other. I mutated the machinery three ways and re-ran the suite each time.

| # | Mutation | Expected if the registry works | Observed |
|---|---|---|---|
| P1 | Add implemented keyword `minimum` to the **newly split** `CORE_KEYWORDS` | guard goes RED and names `CORE_KEYWORDS` | ❌→ `not ok 40 … CORE_KEYWORDS overlaps the implemented set … minimum` — **killed** |
| P2 | Register a **brand-new third set** `FUTURE_KEYWORDS = {pattern}` with no other edit | guard covers it automatically | ❌→ `not ok 40 … FUTURE_KEYWORDS overlaps … pattern` — **killed** |
| P3 | Add `$defs` to **one set only**, then ask the *other* consumer | `unhandledKeywords` honours it | ✅ `unhandledKeywords({type, $defs:{…}}) === []`, `isNonAsserting('$defs') === true` — **killed** |

**3 mutants, 3 killed.** P1 answers the question the split raised: carving `$schema`/`$id` into a new set created **no blind spot** — the guard reaches the new set as readily as the old one. P2 is the stronger result: a set added to the registry is covered by both consumers with **zero** edits anywhere else, which is exactly the "one place to look" the docblock promises. P3 closes the loop from the opposite direction — a keyword reachable by the guard is reachable by `unhandledKeywords`.

The guard also cannot pass vacuously: it asserts `names.length >= 1` before iterating, and it names the offending set in its failure message rather than reporting an anonymous overlap.

### AC-19 — the widening works in the direction it was widened for

Confirmed directly, in-memory, both directions:

- Documentary fixture carrying **all eight** annotation keywords plus `$comment`/`default`/`deprecated` → `unhandledKeywords(...)` returns `[]`. The false red that would have punished a purely documentary schema edit is gone.
- Asserting fixture → still returns `['exclusiveMinimum']`. The widening did not blunt the guard.

`report.schema.json` is untouched on disk (zero `git diff` rows) and is not read by either fixture.

### AC-20 — the documented divergence

`collectSchemaKeywords`' docblock records the split, names the safe direction (descending finds MORE keywords, so the guard stays stricter), and names `unsupportedKeywordForms` as the guard that closes the loop. Zero logic change — verified by reading the function body, which is byte-for-byte its prior form.

### Generated-mirror identity (plan Technical Note 1)

```
b58a344dc9120b3df555776ca2abff9f59ed4f6a3f99bd9a3bee145cfbd9dc7e  plugins/…/clean-code-gates/__tests__/schema.test.cjs
b58a344dc9120b3df555776ca2abff9f59ed4f6a3f99bd9a3bee145cfbd9dc7e  prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs
```

Byte-identical — confirming the parent plan's "the lanes are independent" was indeed false and this plan's correction is right.

## Lane B — the Prime sibling ports (no executable path)

`--check` was treated strictly as a **no-regression floor** and as **zero evidence of correctness**. It is on record as having passed green on an intermediate build carrying an unbound `jobs`; a build check compares the tree to what the overlays produce and is blind to whether what they produce is right. What follows is a read of the emitted text.

### The blocking defect (cycle-1 MF-1): identifier audit on the FINAL emitted text

Read as a Prime agent receives it — `preamble.md` + `protocol.rlm-dispatch.md` only, with **no** access to `protocol.orchestrator.md` or `protocol.explain-codebase.md`, which neither skill is given.

**`prime-agent/skills/simplify/SKILL.md` (187 lines).** Every identifier at every point of use:

| Identifier | Bound at | Used at | Reachable? |
|---|---|---|---|
| `jobs` | `:135` prose — "Build `jobs` as one `(angle_name, prompt)` pair per angle" | `:138`, `:139` | ✅ |
| `handles` | `:138` | — | ✅ |
| `by_angle` | `:139` | `:142` retry | ✅ |
| `by_angle["reuse"].name` | via `:139` | `:142` | ✅ resolves |
| `rlm` / `agent_message` / `asyncio` | protocol block `:14–80` | throughout | ✅ same file |

**Zero unbound identifiers.** The cycle-1 defect — `handle.name` with `handle` bound in no scope — is gone; the retry now reads `by_angle["reuse"].name`, and `by_angle` is bound on the line above.

**Can a dispatch complete?** Yes, at every stage:

- **admit** — `:138` binds the wave.
- **return** — `:142` quotes the completion contract into each angle's prompt and states "that message is the **only** path those findings take". This is AC-17's dropped findings-return bound restored in substance: the replacement removed a mechanism that returned findings and now supplies the substitute.
- **join** — `:148` "all five completion messages have arrived and been read, **not** that `asyncio.gather` returned", with the reason given ("`gather` resolves on **admission**").
- **retry** — `:142`, once, by name.
- **terminating fallback** — `:148` routes an un-reported angle to the inline single-pass path **and** its disclosure line, in the same sentence, so `Mode: 5-angle fan-out` cannot label a fan-out that did not deliver. The silent-empty-review path is closed at three independent points.

**`prime-agent/skills/roadmap/SKILL.md` (335 lines), site at `:126`.** `handle` bound by `handle = await rlm(prompt, name="context-scan")` on the same line as its use in `receiver_name=handle.name`. Completion contract carried in the brief. Parent join is concrete — "**Wait for that message before step 2 below**", and `:127` literally *is* "Using the digest". Read-only prohibition preserved and carried in the child's prompt. Fallback widened as AC-14 required: "or a child was admitted but never returned a usable digest even after that one re-ask". Confidence loop and `context_threshold` closing sentence verbatim.

**Conclusion: MF-1 is genuinely closed.** Not "the CR says so" — I re-derived it.

### Censuses, re-derived independently (Node walk, zero multi-file grep)

| Census | Expected | Observed |
|---|---|---|
| Generated tree file count | 154 | **154** (Node walk) |
| `subagent` in generated `roadmap` | exactly 1, at line 155 | **1, at line 155** |
| ↳ byte-identical to `plugins/…/roadmap/SKILL.md:79`? | yes (the untouched Out-of-Scope non-site) | **`true`**, 345 chars both |
| `subagent` in generated `simplify` | 0 | **0** |
| Host vocabulary over all 154 files | exactly 4 | **4** — `explain-codebase:17`, `:77`, `orchestrator:17`, `:632` |

All four host-vocabulary hits are prohibition/protocol text in **out-of-scope files**. **Zero** in either changed port. Every count came from a Node file walk; zero multi-file grep censuses were used anywhere in this run, per the recorded hazard.

### Generated tree matches source — regenerated, never hand-edited

Ran a full `node scripts/build-prime-agent.mjs` (which `rmSync`s and rewrites the tree) and compared the resulting `git diff --numstat` to the pre-regeneration one:

```
304  24  prime-agent/skills/clean-code-gates/__tests__/schema.test.cjs
69    1  prime-agent/skills/roadmap/SKILL.md
80    5  prime-agent/skills/simplify/SKILL.md
```

Identical rows before and after a destructive regeneration — the tree on disk was already **exactly** the build output. `--check` exit 0 on the result. AC-27 confirmed by construction.

`plugins/…/roadmap/SKILL.md`, `plugins/…/simplify/SKILL.md`, `explain-codebase.json`, `prime-agent/skills/explain-codebase/**`, `protocol.explain-codebase.md`, and `protocol.orchestrator.md` all return **zero** `git diff --numstat` rows — untouched, as required.

Every identity claim in this report used `shasum`, `cmp`, `git diff --numstat`, or a Node `===`. **Zero** uses of bare `diff` exit status.

## Failures

None — all suites passed.

## Lint / Format / Type Issues

None — no lint, format, or type tooling is configured for this repo (PROJECT-CONTEXT → *Commands*: "**Lint:** none configured for markdown in-repo", "**Build:** none").

Advisory G5 read of the one changed code file: all 13 added comment lines are `/** … */` doc comments attached to declarations — allow-listed as public-API doc comments. **Zero** inline `//` "what" comments inside function bodies, zero region markers. Clean.

## Should Fix items — confirmed non-blocking

Both were ruled non-blocking by the approved CR. I re-verified each independently and **neither causes a gate to fail**, so neither blocks. Recording the evidence so the follow-up does not have to re-derive it.

### SF-A — `jobs` iterated twice; a generator binding breaks the retry path

**Real, and I executed it.** The shared block binds:

```python
handles = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
by_name = dict(zip((name for name, _ in jobs), handles))
```

`jobs` is consumed twice. The prose says only "built before the call" — which permits a generator. Executed both bindings in Python:

```
LIST  binding -> len(handles)=5 len(by_name)=5   retry: by_name['reuse'].name = reuse
GEN   binding -> len(handles)=5 len(by_name)=0   retry: KeyError('reuse')
```

The failure is **invisible until retry fires** — the wave admits five children and looks healthy — and the `KeyError` **pre-empts the terminating fallback this very plan installed**, which is what makes it worth fixing rather than tolerating.

Scope, precisely: the hazard text is inherited by **two** skills (`roadmap`, `simplify`), but only `simplify` instantiates the wave form — `roadmap`'s site at `:126` admits a single child with `handle = await rlm(...)` and never touches `jobs`. So the live blast radius today is `simplify` plus any future consumer that follows the block's wave form. New to this block; `explain-codebase` iterates `jobs` once. One-word fix: bind as a list.

**Non-blocking:** no gate measures emitted markdown, the primary path is correct, and the plan's own fallback still covers every case except this one interaction.

### SF-B — `simplify`'s frontmatter still claims dual-host

**Real, and now bounded.** `prime-agent/skills/simplify/SKILL.md:3` still ends `Dual-host (Claude Code + opencode).` — the claim SF-4 ruled false for this port. The **body** was fixed (`:86` now carries the `**Host.**` sentence), so the emitted file contradicts itself.

I swept all 11 emitted Prime skills' frontmatter for host claims: **`simplify` is the only one.** A single outlier in a tree of 11.

The CR's mechanical claim holds — verified: `scripts/build-prime-agent.mjs:96` reads `overlay.frontmatterReplacements ?? []`, `orchestrator.json:7` already uses it for the identical defect class, and `simplify.json` has **0** uses. Cost is genuinely one JSON entry; no new builder vocabulary is needed.

**Non-blocking:** a description-field inaccuracy in a generated port. No gate fails. It is, however, the last surviving instance of the exact defect class this plan set out to eliminate — a port asserting something untrue of its target — which is an argument for cheapness, not urgency.

## Repo-level advisory (not a finding)

`protocol.rlm-dispatch.md` is the only one of four protocol blocks whose join has **no filesystem-observable anchor**. `agent_message.send` is the only form present under `prime-agent/` — 22 occurrences, zero receive/poll/wait forms — so "wait until every child's message has arrived" names no mechanism a reader can inspect. The same join shape ships **at base** in both untouched blocks, and the artifact-free divergence was plan-mandated. Tester and reviewer both placed it below Should Fix; QA concurs and records it as a repo-level note for whoever next touches the Prime dispatch vocabulary. It is **not** attributable to this change set.

## Accounting note

The CR states "eight changed files, of which seven are in scope". The precise count is **nine total, eight in scope** — `git diff --numstat` lists eight modified tracked files, and `prime-agent/overlays/protocol.rlm-dispatch.md` is a **new untracked** file that `--numstat` does not row. Benign: the CR verified that file's contents in detail under AC-1 and AC-2, so nothing went unreviewed; only the tally was one short. `docs/reviews/feat-prime-agent-…-2026-08-19.md` is the one out-of-scope entry (pre-existing bookkeeping for a different work unit), correctly excluded.

## Verdict

**Status**: READY_WITH_WARNINGS

All blocking checks pass — three suites green, all censuses re-derived and matching, the blocking defect independently confirmed closed, and Lane A's anti-drift claim proven by three killed mutants — with the single warning being G8 aggregate rework of 1.00.

**Root cause worth weighing before anyone acts on HIGH_REWORK.** The ratio is 1.00 because cycle 1 found a *genuine* blocking defect: a generated skill that was literally unexecutable and would have shipped an empty review labelled `Mode: 5-angle fan-out`. That is a review cycle doing precisely its job, and a pipeline that never spends one is not obviously healthier. The pattern actually worth attention is narrower and sharper: **the fix for an unbound-identifier bug itself nearly shipped a different unbound identifier**, caught only by a manual read *after* `--check` passed it green — and SF-A is that same family one authoring choice further out (an identifier that is bound, but whose *binding form* is unconstrained). Three near-misses of one shape in one work unit is a signal about the **verification surface**, not about care: this lane has no gate that can catch identifier-level defects, so `--check` keeps offering false comfort. If anything is worth doing about G8 here, it is giving Lane B a real linter for its emitted Python fences — not tightening process.

All blocking checks pass but G8 > 0.5 (HIGH_REWORK). Plan can ship; flag for human root-cause investigation.

**Recommended follow-ups (neither blocks this commit):** SF-A's one-word list binding in `protocol.rlm-dispatch.md`, and SF-B's one `frontmatterReplacements` entry in `simplify.json`. Both are one-line changes to files this work unit already owns.
