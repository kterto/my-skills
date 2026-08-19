---
id: CR-20260819T023032Z-d934
plan: FIX-20260819T020345Z-48c5
title: Review of Gateable-scope guard and installer rollback fixes
status: APPROVED
created_at: 2026-08-19T02:30:32Z
reviewer: reviewer-agent
cycle: 3
must_fix_count: 0
should_fix_count: 5
---

**Related:** [FIX-20260819T020345Z-48c5](./FIX-20260819T020345Z-48c5-gateable-scope-guard-installer-rollback.md) · [CR-20260819T015653Z-4511](./CR-20260819T015653Z-4511-prime-agent-remediation-cr-fixes.md) · [CR-20260819T010844Z-f9ea](./CR-20260819T010844Z-f9ea-prime-agent-distribution-review-remediation.md) · [FIX-20260819T012309Z-b208](./FIX-20260819T012309Z-b208-prime-agent-remediation-cr-fixes.md) · [FEAT-20260819T001630Z-be84](../feat/FEAT-20260819T001630Z-be84-prime-agent-distribution-review-remediation.md) · [SPEC-20260819T000458Z-bfac](../specs/SPEC-20260819T000458Z-bfac-prime-agent-distribution-review-remediation.md) · [TEST-20260819T022100Z-2621](../test/TEST-20260819T022100Z-2621-gateable-scope-guard-installer-rollback.md)

## Summary

I reviewed the whole aggregate against `09fa490` — the parent `FEAT-…be84` plus both fix plans — and **both of my cycle-2 Must Fix findings are genuinely closed.** I did not take that on report: I reproduced each on inputs that appear in neither the suite nor the tester's matrix. MF-1 closes on `.graphql`- and `.snap`-only scopes across all four scope kinds (all exit 3, no `status: "pass"`), with mixed and source-bearing scopes still returning their verdict; MF-2 closes at `MV_FAIL_AT=3` and `9` on a genuinely empty destination (zero depth-1 entries, rollback message present, plain non-`--force` retry installs 11/11).

All twelve acceptance criteria are met. 206/206 tests pass on both the plugins source and the generated tree, `npm test` and `build-prime-agent.mjs --check` exit 0, and all fifteen touched `clean-code-gates` files are byte-identical between source and generated copy — the generated tree's only content divergence is the overlay-driven invocation-path block, which is build output.

**Verdict: APPROVED.** Five non-blocking Should Fix items, one of which is a new observation of my own (the fresh-install rollback leaves behind the empty directory chain it created while stderr says the destination was restored). The two escalated rulings are given below: the AC 12 README edit is **ratified**, and the README headline breadth is recorded as SF-5, not a blocker.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Non-source-under-a-stack-root scope exits 3, never `pass`, all four scope kinds | ✅ | Reproduced independently on `.graphql` and `.snap` (extensions neither the suite nor the tester used) across `files:`, `module:`, `diff:`, `project` — 4/4 exit 3, zero `"status": "pass"`, message names the kind and the base ref. |
| 2 | Guard keeps placement + message contract; `resolveGatePlan`'s early return structurally untouched | ✅ | `assertNonEmptyScope` at `src/run.cjs:79-84`, called at `:91` after `resolveScope`, before `resolveGatePlan`. Message text unchanged. `if (!plan.length) return plan;` intact at `:48`. |
| 3 | Predicate resolved and passed in; adapter with no `SOURCE_FILE_RE` leaves files gateable | ✅ | `sourcePredicate(cfg)` at `:64-69` mirrors `runG5:26`'s `sourceRe ? … : …` ternary exactly. Guard takes `isSource` as an argument — pure function of two arguments, no registry reach. Fallback pinned by `run.test.cjs:104-109`. |
| 4 | A scope with ≥1 adapter-recognised source file still returns a verdict; exit matrix unregressed | ✅ | Verified in my own fixture: `files:src/b.ts,src/sub/q.graphql` → exit 0 `pass`; `project` with a `.ts` present → exit 0 `pass`. `exit-codes`, `gate-selection`, `scope-*` suites all green in the 206. |
| 5 | Fresh-install rollback leaves no `SKILL.md` and no `.*` staging leftovers | ✅ | Reproduced at `MV_FAIL_AT=3` and `9`: `find … -name SKILL.md` = 0, **all** depth-1 entries = 0. The `rollback` body at `install.sh:116-125` now `rm -rf`s unconditionally and restores `.old-$name` conditionally; the `committed+=` push at `:147` is correctly unmoved. |
| 6 | Plain retry with no `--force` succeeds and installs all 11 skills | ✅ | 11/11 at both of my failure points. |
| 7 | `tests/install.sh` gains the fresh-install case and asserts the installer's stderr | ✅ | `tests/install.sh:117-144`. The stderr grep at `:138` pins the exact rollback sentence. The tester independently confirmed the case goes red against the pre-fix `rollback` at my exact "3 skills behind" number and restored the file md5-verified. |
| 8 | `g1-absent-coverage.test.cjs` documents the divergence with an `entry`-present node-ts case | ✅ | `:64-77` asserts **both** sides in one test, so it dies if node-ts stops scoring *or* if dart starts — the tester's mutants B and C confirm it is two-sided. Pinned, not repaired, exactly as the plan required. |
| 9 | `prime-agent/skills/` regenerated wholesale; `--check` exits 0; no hand-edit | ✅ | `--check` → `prime-agent/skills is up to date (11 skills, 154 files)`, exit 0. All 15 touched `clean-code-gates` files byte-identical source↔generated. The only README divergence is the overlay's `<skill-dir>` invocation block — build output, not a hand-edit. |
| 10 | `node --test` exits 0 with ≥ 197 tests; `cd prime-agent && npm test` exits 0 | ✅ | **206/206**, exit 0 — and the generated tree runs its own suite to 206/206 independently. `npm test` exit 0 (`install.sh` + `parity.sh`). |
| 11 | Per-method cyclomatic complexity ≤ 10 in every touched module | ✅ | `sourcePredicate` ≈ 3, `assertNonEmptyScope` ≈ 3, `resolveGatePlan` ≈ 4, `runG5` ≈ 4. The predicate is a module-level factory as mandated; `run()` gained one call, no decision points. |
| 12 | `README.md:155-159` / `SKILL.md:33` re-verified true, unchanged unless message or exit code moved | ✅ **(edit ratified)** | One sentence was edited. See the ruling below — ratified on the merits. |

**Prior CR (`CR-…4511`) Must Fix closure:** MF-1 ✅ · MF-2 ✅. Both independently reproduced closed.

## Rulings on escalated items

### Ruling 1 — the AC 12 README edit is **RATIFIED**

The coder rewrote the *Behaviour change* sentence at `README.md:155-159`, which AC 12 nominally froze, to add the second harm shape: *"…with `gatesRun: []` when nothing resolved at all, and with a **named** `gatesRun` when files did resolve under a stack root but every gate filtered them back out (a `src/theme.css`-only diff, say)."*

I ratify it, and the escalation is correct that AC 12's literal escape clause ("unless the message or exit code moved") is narrower than the ground taken. Three reasons the broader ground is the right one:

1. **The old text was false, and I am the one who established it was false.** My cycle-2 CR reproduced `gatesRun: ["G5"]` on the `src/theme.css` scope myself, and my cycle-1 CR established the `gatesRun: []` shape. Both halves of the replacement sentence are corroborated by my own prior reproductions, independent of the tester's baseline-binary re-derivation. The old sentence described only the `gatesRun: []` shape and so understated the harm the fix closes.
2. **AC 12 exists to keep the prose true, not to keep it fixed.** Its verb is "re-verified as true"; the freeze is the *default outcome* of that verification, not its purpose. A clause that would force a reviewer-established falsehood to stay published is reading the letter against the intent.
3. **PROJECT-CONTEXT makes it mandatory, not merely permitted.** Under → Test tooling, doc-skill changes are verified by structural review with "backward-compat claims hold in prose" as an explicit criterion. This sentence *is* a backward-compat claim: it tells a CI caller which runs used to pass and now do not. Leaving it describing only one of the two shapes would leave the README understating a behaviour change to the exact audience the section addresses.

No plan amendment is needed — this CR is the ratification record.

### Ruling 2 — README headline breadth: **Should Fix, not a blocker** (SF-5)

Recorded below. The explanatory paragraph does name the general property ("no gateable source file", with the `src/theme.css` example) before the `docs-only pull request` illustration, so the document is accurate; only its headline example is gentler than the rule. The tester's containment analysis is correct and I confirm it from `detect.cjs`: `node-ts` registers only when **both** `package.json` and `tsconfig.json` are present, so a pure-JS project resolves no stack and already exited 3 before this change. Genuinely non-blocking.

### Ruling 3 — the three weak-test notes: all **Should Fix** (SF-2, SF-3, SF-4)

None is a false-green risk and none touches a Must Fix closure. Severities and reasoning are given per item below.

### Ruling 4 — the unregistered-stack-key probe: **no action, ruling recorded**

The tester probed a case AC 3 does not name — a user config adding a `stacks` key with no registered adapter, which `deepMerge` (`src/config.cjs:47`) permits. I accept the analysis: it takes the `: true` fallback, but it does not manufacture a false pass. With `gates: {}` the run exits 3 at gate selection; with `G5` it exits 0 **having actually scanned the file**, because `runG5`'s own `sourceRe ? … : files` fallback makes an unknown stack's files scannable. A gate really did measure it, so the report's verdict is earned. The two shapes are consistent by construction — `sourcePredicate` mirrors `runG5`'s ternary, which is exactly why the predicate cannot claim gateability the gate then declines to deliver. Correct as designed; nothing to change.

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — A failed fresh install leaves behind the empty `.prime/agent/skills` chain it created, under a message saying the destination was restored

**File**: `prime-agent/install.sh:101` (`mkdir -p "$destination"`), message at `:131`

**Problem**: New observation, mine — not raised by any prior artifact. After an injected mid-loop failure against a project that had no `.prime` at all, the destination is content-free but not absent:

```
<proj>/.prime
<proj>/.prime/agent
<proj>/.prime/agent/skills
```

stderr meanwhile prints *"Install failed — the destination was restored to its previous state."* Strictly, the previous state had no `.prime` directory. This is the same class of overstatement as MF-2, several orders smaller.

It is **not** a blocker and I want the reasoning on record so it is not re-litigated:
- It is **pre-existing**, not introduced here — `mkdir -p "$destination"` existed at `09fa490` and this cycle only moved it below the preflight banner.
- No acceptance criterion is breached. AC 5 asks for no `SKILL.md` and no `.*` staging leftovers; both hold exactly.
- It causes no functional harm: I verified a plain non-`--force` retry succeeds into the empty chain, so the user is not pushed toward `--force`, which was the actual harm MF-2 named.
- The same three directories exist after any successful install, so the residue is indistinguishable from a normal installed tree minus its contents.

**Fix**: either (a) record the deepest pre-existing ancestor before `mkdir -p` and `rmdir` back to it inside `rollback` — `rmdir` only, so a directory that acquired other content is never removed; or (b) if the empty chain is judged harmless, soften `:131` to name what was actually restored (e.g. *"no skill was installed; any existing skills were left as they were."*). Option (b) is cheaper and keeps the guarantee honest. Do not use `rm -rf` on the chain.

---

### SF-2 — `run.test.cjs` mutates the shared `ADAPTERS` registry with no teardown

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/run.test.cjs:105`

**Problem**: `registerAdapter('bare-stack', …)` writes into the module-level registry and never removes it, so it leaks into every later test in the file. Harmless today — `bare-stack` collides with nothing, `node --test` gives the file its own process, and the two tests that follow (`:111`, `:117`) use `node-ts` — but a future test asserting the *converse* (that an unknown stack is absent from the registry) would become order-dependent, and the failure would present as a mystery rather than as a leak.

Severity: Should Fix. It cannot produce a false green today; it degrades the isolation of the file that now carries MF-1's closure, which is the only reason it is worth logging at all.

**Fix**: add a teardown deleting the key (`t.after(…)` or an explicit `unregisterAdapter`), or build a local registry object for the case so the module-level one is never touched.

---

### SF-3 — Redundant assertion pair in the docs-only CLI case

**File**: `plugins/my-skills/skills/clean-code-gates/__tests__/cli-e2e.test.cjs:123-124`

**Problem**: `assert.notStrictEqual(r.status, 0)` is immediately subsumed by `assert.strictEqual(r.status, 3)` on the next line. Not vacuous, not wrong — just a line that can never fail while the line after it passes. Its sibling test at `:134` already carries only the exact assertion, so the file is inconsistent with itself.

**Fix**: drop `:123`.

---

### SF-4 — The fresh-install rollback case pins one failure point where the overwrite cases loop over two

**File**: `prime-agent/tests/install.sh:127` (vs. the `for fail_at in 5 6` loop at `:100`)

**Problem**: The new case pins `MV_FAIL_AT=4` only. The fix is in fact correct at every point — the tester probed 1, 2, 4, 7, 11 and I independently probed 3 and 9, all clean — but the *suite* would not catch a regression that only broke the first or last iteration, which is precisely the shape of boundary bug a rollback loop is prone to (`committed` empty, or `committed` holding every name).

Severity: Should Fix. The property is proven; the guard against it silently un-proving itself is single-pointed.

**Fix**: wrap `:124-144` in `for fail_at in 1 4 11` and parameterise the destination, matching the shape `:100` already uses. Near-zero cost — the case already tears down and recreates `$tmp/fresh` at the top.

---

### SF-5 — The README's headline example is narrower than the strictness increase it introduces

**File**: `plugins/my-skills/skills/clean-code-gates/README.md:157`

**Problem**: The *Behaviour change* section leads its concrete illustration with *"a CI job running `--scope diff:origin/main` over a **docs-only pull request** now fails where it previously passed."* The guard also newly fails a pull request touching only `.js`, `.jsx`, `.json`, `.css`, `.scss`, `.svg`, `.snap` or `.graphql` **under a TypeScript stack root** — files that are not docs, and (as my cycle-2 CR noted) a strictly more common CI shape than the docs-only case.

The document is not wrong: the preceding sentence states the general rule and names the `src/theme.css` case explicitly. The issue is that a reader scanning for "does this break my pipeline?" meets the gentler example first. Since this section exists specifically to warn CI callers, the headline is the sentence most likely to be read in isolation.

**Fix**: widen the illustration — e.g. *"a CI job running `--scope diff:origin/main` over a pull request that touched no gateable source file (a docs-only PR, or a CSS- or JSON-only PR under a TypeScript root) now fails where it previously passed."* Worth keeping the note that a pure-JavaScript project is unaffected, since `detect.cjs` requires both `package.json` and `tsconfig.json` to register `node-ts`, so such a repo resolves no stack and already exited 3.

## Notes (no action required)

- **The `committed` ordering is right and the two failure states are both covered.** If the move-aside `mv` at `:145` fails, the name is not yet in `committed`, so rollback correctly leaves the untouched original alone; if the commit `mv` at `:148` fails, the name *is* in `committed`, so the unconditional `rm -rf` clears the partial and the conditional restore puts the original back. Both states verified live.
- **A polyglot scope can still have one stack measure nothing.** With `src/a.ts` (node-ts, source) and `lib/x.json` (dart, non-source) in one scope, the guard passes on the aggregate and dart's gates report `pass` over an empty filtered set. This is pre-existing per-stack semantics, the aggregate run did genuinely measure something, and AC 1 is framed on the scope as a whole. Out of scope here; recorded so a future reader does not mistake it for a residual of MF-1.
- **ADR-0015 is accurate and correctly framed.** It reproduces the history correction my cycle-2 CR made — that node-ts's pre-change `runG1` had no `TS_FILE_RE` filter at all, so `!entry && !TS_FILE_RE.test(rel)` *narrowed* rather than widened it — and explicitly classes the closing of the divergence as a deliberate narrowing needing its own migration note, not a backward-compat repair. It is next in sequence after 0014, cross-references resolve, and it does not duplicate normative detail into `SKILL.md` (PROJECT-CONTEXT → Conventions).
- **`opencode-port-parity` is untriggered.** No path in this cycle's diff sits under `pr-review-report/` or `spec-driven-eval/`, the only two skills carrying an override port. The plan required this be stated rather than silently skipped; it is stated.
- **No scope creep.** Every changed path this cycle traces to a task in `FIX-…48c5`: `src/run.cjs`, the five test files and the fixture, `README.md`, `install.sh`, `tests/install.sh`, `docs/adr/0015-*.md`, and the regenerated tree. The wider aggregate was cleared for scope in `CR-…4511`. `prime-agent/skills/**` was regenerated, never hand-edited.
- **The optional tasks were all taken and all landed correctly.** SF-5's symlink-refusal prefixes are pinned at `tests/install.sh:37` and `:61` in place of the loose globs the usage banner also satisfied, and the `outside`-is-empty assertion is present at `:50`. SF-6's `GIT_CONFIG_GLOBAL=/dev/null` plus `git init --template=` is at `fixtures/empty-scope.cjs:43-45`. SF-2's rewritten comment at `gate-selection.test.cjs` now names the real mechanism, with the near-vacuous `doesNotMatch` swapped for a real stderr assertion and both controls surviving.

## Verdict

**Status**: APPROVED

Both Must Fix findings are closed — verified by my own reproduction on inputs no prior artifact used, not on report — all twelve acceptance criteria are met, and the five remaining items are non-blocking hygiene with one new pre-existing overstatement recorded for a future pass.

Invoke `/qa` with plan ID `FIX-20260819T020345Z-48c5` to run the QA suite.
