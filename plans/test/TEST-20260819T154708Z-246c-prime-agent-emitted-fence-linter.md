---
id: TEST-20260819T154708Z-246c
plan: FEAT-20260819T150641Z-10df
title: Test Report — Prime Agent emitted-fence linter
status: PASS
created_at: 2026-08-19T15:58:20Z
cycle: 0
---

**Related:** [FEAT-20260819T150641Z-10df](../feat/FEAT-20260819T150641Z-10df-prime-agent-emitted-fence-linter.md) · [SPEC-20260819T145710Z-b345](../specs/SPEC-20260819T145710Z-b345-prime-agent-emitted-fence-linter.md)

## Summary

`status: PASS` is a statement about the **floors only** — every gate this plan is required to keep green is green, and the checker's own line coverage under its suite is 98.2%. It is not a statement that the gate works as advertised.

This pass deliberately did not re-derive the nine defects a prior simplify pass already reproduced. It spent its effort on the four areas the earlier passes did not reach, and all four produced findings:

1. **Mutation testing of the test suite.** 46 semantic mutations of `scripts/lint-prime-fences.mjs`, each judged by `parity.sh` section 4 verbatim. **13 survived** (mutation score 71.7%). Three survivors reduce the checker to reading **zero of the 54 files** in the real emitted tree while section 4 stays entirely green.
2. **Fixture corpus shape.** The corpus certifies 30–89-line single-section excerpts with ≤15 inline spans and no frontmatter. The files it is meant to certify are 189–1668-line multi-section documents with 53–1264 spans. The premise that "every fixture is a single-fence excerpt" is **inaccurate** — five carry 2–4 fences — but the true deficiency is worse and is stated below.
3. **Catch matrix vs reality.** Three of the four matrix rows are overstated, and the PF05 "fails closed" claim in KNOWN LIMITS is overstated. The one row that self-rates **Weak** (PF04) is the only one that survived measurement.
4. **Unprobed surface.** No rule crashes across 27 adversarial inputs — a genuine strength. But `--allowlist` short-circuits the entire program, an unreadable file discards every finding already collected while exiting 1, and symlinked `.md` files and directories are never linted at all.

Two new defects of the **same class the gate exists to catch** were found and independently reproduced: an explicit `_ = await asyncio.gather(...)` discard is invisible, and **deleting an entire 76-line dispatch protocol block from a shipped `SKILL.md` lints clean** — that is literally matrix row 1's defect, rated **Strong**.

Per the orchestrator's explicit instruction, **nothing was fixed and no repo file was written** except this report and the two append-only log entries. All experiments ran on copies in the scratchpad.

## Flows Triaged

"e2e" in this repo means the Lane B gate scripts (PROJECT-CONTEXT: *"e2e: none — flows are skill behaviors"*). Criticality = user impact × breakage likelihood × not-covered-by-unit.

| Flow | Criticality | Decision | Rationale |
|---|---|---|---|
| The gate's own suite fails when the gate breaks (AC-6) | **9 — critical** | **Selected** | BUG-1 slipped through a suite that asserts exact rule sets per fixture. If those assertions do not discriminate, every other AC is unfalsifiable. Only reachable by mutation; no unit test can answer it. |
| Gate detects the historical defect class on the **real** emitted tree (AC-3, AC-12) | **9 — critical** | **Selected** | The whole plan's premise. Fixture-shaped proof does not transfer to real-file shape; had to be tested against the actual `prime-agent/skills/**` text. |
| Allowlist census bypass (AC-4) | **8 — high** | **Selected** | The single most obvious way to silence the gate. Tested by mutation (widen it) and by CLI probing (the flag itself). |
| Catch-matrix ratings hold per rule on the files defects shipped in (AC-13) | **8 — high** | **Selected** | A rating that does not hold *is* the false-confidence defect class the gate exists to remove — self-referentially in scope. |
| Robustness / CLI surface (crash vs report, exit codes, symlinks) | **7 — high** | **Selected** | A gate that crashes with exit 1 is indistinguishable from a gate reporting findings; that failure mode disables gates in CI. Unprobed by both prior passes. |
| Fence census AC-11 = 15 | 5 — medium | **Selected** | One Node walk; directly falsifiable; also yields the untagged-fence blind-spot count. |
| Fixture provenance headers AC-5 | 4 — medium | **Selected** | Cheap, and the headers are HTML comments — which are linted as prose, so they could contaminate the corpus's own verdicts. Tested. |
| Floors: `clean-code-gates` (250), `build-prime-agent --check`, `prime-agent npm test` (AC-15) | 6 — medium | **Selected** | Mandated no-regression floor over unrelated surface. |
| `prime-agent/tests/install.sh` installer flow | 5 — medium | **Excluded** | Unrelated surface, untouched by this plan; already exercised by the `npm test` floor run. Re-testing spends budget on a passing, unchanged path. |
| `clean-code-gates` internals beyond the floor | 6 — medium | **Excluded** | Explicitly scoped out by PROJECT-CONTEXT ("do NOT run it against other skills"); its 250-test floor is the correct level of assurance here. |
| `.md`/`.html` template parity, opencode port parity | 3 — low | **Excluded** | This plan touches no template and no ported skill. Zero breakage likelihood. |
| PROJECT-CONTEXT additivity (AC-14) | 3 — low | **Excluded from effort, verified incidentally** | Given as known defect C1. One `git diff` confirms **0 deleted lines**, so the *additivity* half of AC-14 holds; C1's separate claim about the replacement text's accuracy stands unchallenged here. |
| Defects 1–9 from the prior simplify pass | — | **Excluded (taken as given)** | Instructed. Two verified as a representative sample (below); the rest consumed as premises. |

## E2E Tests Added

**None — by instruction.** The orchestrator's brief for this run was explicit: *"Do NOT fix anything — you are the tester. Report."* Adding fixtures or `parity.sh` assertions would be remediation, and would also pre-empt the reviewer's judgement on which of the 13 mutation survivors deserve a pinned test versus a rule change.

What was built instead, all under the scratchpad, all re-runnable:

- `scratchpad/sec4.sh` — `parity.sh` section 4 extracted **verbatim** (106 lines, single `sed` of the `linter=` assignment) so a mutant is judged by the real assertions rather than a paraphrase. Baseline: green against the unmutated checker.
- `scratchpad/mutate.mjs`, `mutate2.mjs` — 46 mutants and the survive/kill runner.
- `scratchpad/mutation-results.json`, `mutation-results-2.json` — full results.
- `scratchpad/sec4-copy.sh` — the same harness pointed at a mutable copy of the fixture corpus, for testing the corpus itself.

## Coverage

PROJECT-CONTEXT sets coverage as *"not measured except within `clean-code-gates`"*, so no project harness exists for `scripts/lint-prime-fences.mjs`. I measured it directly with `NODE_V8_COVERAGE` across all five node invocations in section 4, merging per-process and taking the max per byte.

| Metric | Before | After |
|---|---|---|
| Line coverage of `scripts/lint-prime-fences.mjs` under `parity.sh` section 4 | not measured | **98.2%** (381 / 388 executable lines) |
| **Mutation score** under the same suite | not measured | **71.7%** (33 killed / 46 applied) |
| Coverage floor (70%) | — | **Met, by 28 points** |

**The gap between those two numbers is the finding.** 98.2% line coverage co-exists with 13 surviving semantic mutants. Line coverage here measures that the fixtures walk the code, not that the assertions constrain it.

The 7 never-executed lines are themselves informative:

| Line | Never exercised |
|---|---|
| 264 | PF05's prefixed-string-literal error path |
| 285 | PF05's unknown-character error path |
| 321 | `scanString`'s unterminated-string return |
| **369–370** | **the `with … as` binding branch** — which the source comment at line 331 calls *"load-bearing"* |
| 678–679 | the exit-2 "not a directory" path (asserted nowhere in the repo) |

Floors, all green:

```
cd plugins/my-skills/skills/clean-code-gates && npm test   → 250 pass, 0 fail
node scripts/build-prime-agent.mjs --check                 → exit 0
cd prime-agent && npm test                                 → exit 0
```

AC-11 verified by Node walk: **15 python fences — `explain-codebase` 2, `orchestrator` 4, `roadmap` 4, `simplify` 5.** Exact match. The same walk found **140 untagged fences** in the emitted tree that no rule inspects.

## Test-Quality Audit

### T1 (critical) — three mutants make the checker read zero files, and section 4 stays green

| Mutant | Effect on the real tree | Section 4 |
|---|---|---|
| `M17` — walk stops recursing into subdirectories | reads **0 of 54** files | **green** |
| `M55` — skip files > 100 lines | reads 0 files that matter | **green** |
| `M56` — skip files with YAML frontmatter | reads 0 files that matter | **green** |

`M17` is the cleanest: the fixture directory has **0 subdirectories**, so recursion is never exercised by 4a–4e; `prime-agent/skills/` contains **only** subdirectories, so a non-recursive walk reads nothing while 4f exits 0. This compounds with the already-known C3 (silence on success): I confirmed the real-tree run and an empty-directory run are **byte-identical on both streams (0 bytes) with identical exit codes** — `shasum` `da39a3ee…` on all four streams. Nothing in section 4 can distinguish "clean" from "not looked at".

### T2 (critical) — assertion 4f is decorative, not load-bearing

Section 4's preamble claims the pinned fixtures make a green 4f *"mean something"*. Measured independently:

- Files walked: **54**. Files carrying a python fence: **4**. Files touching any watched vocabulary: **6**. So **≤11%** of the tree is reachable by any rule; **92.6% is walked and discarded**.
- Parsed python-fence bytes: **1,749 of 1,037,309 = 0.17%** of the tree.
- In **every one** of the four fence-carrying files, the entire watched vocabulary is **already excused** — `rlm`, `agent_message`, `handle`, `by_name`, `jobs` (plus `receiver_name` in `orchestrator`) are all pre-declared by the file's own inline spans, of which those files carry 53 / 397 / 403 / **1264**, declaring 32 / 71 / 149 / **197** names. PF01 and PF02 are structurally incapable of firing on any watched name in any shipped file.

4f's green therefore certifies ~1.7 KB of fence text across four files, every name in which is already known. The preamble's transfer claim — fixtures prove the rules fire, therefore a green real-tree run means something — does not follow: the fixtures prove the rules fire on *fixture-shaped* input, and 4f runs them on input of a categorically different shape.

### T3 (high) — the "must lint clean" assertions are content-free

`expect_lint_pass` asserts "produced no findings", which an **empty file** satisfies.

- Truncating `clean-baseline.md`, `english-prose-handle.md`, `comprehension-bound-prompt.md` **to 0 bytes** → suite still passes.
- Truncating `instance-4-fixed.md` to 0 bytes → suite still passes.
- **Deleting `instance-4-fixed.md` entirely** → suite still passes. This is the fixture section 4's own comment calls the half that makes *"PF04 worth anything"*.
- Deleting the other three clean fixtures *is* caught — but by `cp` erroring under `set -e` in 4c and `awk` in 4d, **not by any assertion**. Move a fixture out of 4c's hard-coded list and its deletion becomes invisible too.

### T4 (high) — PF01's generality is proven for exactly two names

`M42` (PF01 narrowed to only the 8 watched names) survives. Narrowing further:

| PF01 restricted to | Section 4 |
|---|---|
| `['jobs','handle','gather']` | **SURVIVED** |
| `['jobs','handle']` | **SURVIVED** |
| `['jobs']` | KILLED |

PF01 is advertised as *"a name read in a python fence that nothing in this file defines"* — general over all identifiers. The suite constrains it for `jobs` and `handle`. Combined with the already-known census gap (6 of 8 `WATCHED_VOCABULARY` entries deletable with no test change), the effective proven vocabulary of the whole gate is **two names**.

### T5 (high) — untested rule arms

| Mutant | Survived because |
|---|---|
| `M07` — PF03 drops the `await rlm(...)` child-admission arm entirely | no fixture exercises the child-admission arm; **half of PF03's rule surface is untested** |
| `M50` — PF03 inspects only the *first* admission site per file | **no fixture has two admission sites of the same kind** — the exact blind spot that hid BUG-1, now confirmed from the test side |
| `M09` — `by_name` removed from `HANDLE_NAMES` | untested |
| `M47` — PF04 counts reads file-wide instead of per-fence | untested |
| `M33` — PF01 dedup collapses to one report per name per file | untested |
| `M57` — PF01 disabled for `*/SKILL.md` | fixtures are not named `SKILL.md` |

### T6 (high) — the documented PF04 strictness is not validated

`M26` loosens PF04's declaring phrase from **adjacent** to *anywhere in the paragraph* and survives. The source comment (lines 59–63) states this strictness is *"validated in both directions against the real corpus."* It is not validated by the suite. The property does hold in the code — a non-adjacent "list" still fires PF04 on the real files — but nothing pins it, so a future loosening ships silently.

### T7 (medium) — findings' line numbers and messages are unasserted

`M32` (every finding reports line **0**) and `M54` (every remediation message **blanked**) both survive. AC-2 requires every message to *"name the offending name **and** state what would make it pass."* Section 4 asserts the rule id and the file path, never the line or the message — so the half of the output an author actually acts on is unconstrained.

### T8 (medium) — fixture provenance headers are clean, but the mechanism is live

All 11 fixtures carry provenance headers. Four use a third category, `HAND-AUTHORED`, that AC-5 does not name (AC-5 allows only *git-recovered* or *hand-reconstructed*) — defensible, since those four are not defect reconstructions, but the AC wording and the corpus disagree.

Those headers are **HTML comments**, which the checker lints as prose (known BUG-2). I tested whether the corpus's own documentation contaminates its verdicts: stripping every HTML comment (preserving line numbers) changes **no fixture's rule set**. Clean today — but the mechanism is live, and a future fixture header containing a backticked name would silently alter that fixture's expected outcome.

### T9 (medium) — AC-3 vs the corpus

AC-3 requires each rule *"individually provable by at least one fixture."* **No fixture proves PF05** — it is proved only by 4e's inline heredoc scaffold. `parity.sh` justifies this explicitly (no historical PF05 defect text exists to pin), so this is a documented deviation from AC-3's literal wording rather than a gap in proof.

### Corrections to premises handed to this pass

- **"Every fixture is a single-fence overlay excerpt"** — inaccurate. Five fixtures carry 2–4 python fences (`clean-baseline` 4, `comprehension-bound-prompt` 3, `instance-3` 2, `instance-4-fixed` 4, `instance-4-generator-jobs` 4). The real deficiency is different: every multi-fence fixture is **one procedure split across consecutive fences of a single section**, where fence *n* deliberately binds what fence *n+1* reads. Not one fixture is a **multi-section document** — a file where an independent procedure lives hundreds of lines from another and the two share a namespace only by accident of co-location. That is the shape every real emitted file has, and the shape no fixture can express.
- **BUG-1's mechanism** is not a citational quote excusing a real site. Both `simplify/SKILL.md` and `orchestrator/SKILL.md` carry **two genuine wave fences** (`:49`/`:140` and `:46`/`:175`); the second, still-bound one excuses the first. Reproduced: exit 0, zero findings.

## Defects found outside the known set

Both independently reproduced by me after the sub-agents reported them.

### D1 (critical) — deleting an entire dispatch protocol block lints clean

Matrix row 1 is *"dangling contract — `handle`/`agent_message`/`receiver_name` used in files that never received a protocol block"*, rated **PF02, Strong**. Reproduced literally: removing the 76-line `## Prime Agent child-dispatch protocol` section from `simplify/SKILL.md` (189 → 113 lines) leaves `handles = await asyncio.gather(...)`, `by_angle = dict(zip(...))` and `await agent_message.send(...)` shipping with no protocol block behind them.

```
node scripts/lint-prime-fences.mjs <copy>   → exit 0, zero findings
```

Same result for `explain-codebase/SKILL.md` (634 → 583 lines). The rule cannot fire because `rlm`/`agent_message` are allowlisted, `handles` binds itself in the surviving fence, and `handle`/`jobs` self-declare as the leading identifier of their own spans. **This is the gate's headline defect class, reproduced against the gate, passing.**

### D2 (high) — an explicit discard counts as a binding

`classifyStatement` sets `assigned = true` for any bare-name target, including `_`. So the deliberate throw-away is invisible:

```
_ = await asyncio.gather(*(rlm(prompt, name=name) for name, prompt in jobs))
→ exit 0, zero findings
```

The admission result is discarded, the name map is gone, the surrounding retry prose has nothing to address — and PF03 is silent. KNOWN LIMITS admits the file-scoped half of PF03's weakness and not this half.

### D3 (high) — `--allowlist` short-circuits the entire program

`main()` tests `argv.includes('--allowlist')` before target resolution, before `existsSync`, before any linting. Order-independent, exact-match, and it wins over everything:

| command | exit |
|---|---|
| `… --allowlist /nonexistent/zzz` | **0**, prints the census |
| `… prime-agent/skills --allowlist` | **0**, lints nothing |

4d itself is written correctly (bare flag) and does pin the live `BUILTIN_ALLOWLIST` — it is, in fact, the **only assertion in section 4 whose green depends on something other than "no finding was produced"**, and the only one that survives all three zero-coverage mutants. But 4f would become vacuous if `--allowlist` ever entered its argv, and nothing would notice. Latent: `parity.sh` is the only invocation site in the repo.

### D4 (high) — an unreadable file discards every finding already collected

Findings print only after the full walk. A `chmod 000` file mid-walk throws a raw `EACCES` stack trace from `fs.readFileSync`, **exit 1** — indistinguishable from "findings were reported" — and every finding gathered before it is lost:

```
$ node scripts/lint-prime-fences.mjs <dir>   # a-bad.md has a real PF01; z-unreadable.md is chmod 000
Error: EACCES: permission denied, open '…/z-unreadable.md'
exit: 1        ← the PF01 in a-bad.md is never printed
```

Same for an unreadable subdirectory (`fs.readdirSync`). Exit 2 is reserved for the *benign* not-a-directory case and never used for the crash case.

### D5 (high) — symlinked files and directories are never linted

`readdirSync(withFileTypes)` reports a symlink as neither `isFile()` nor `isDirectory()`, so a symlinked `.md` is skipped entirely and a symlinked directory is never entered — **exit 0, no error, no output**. A symlink loop terminates safely, but only as a side effect of the same hole. Latent: the real tree contains **0 symlinks** and the builder writes files directly (no `symlink`/`copyFile`/`cpSync` in `build-prime-agent.mjs`). The walk also has no exclusion list — it descends `.git` and `node_modules`.

### D6 (medium) — one unclosed non-python fence silently disables the linter for the rest of a file

A `` ```text `` block someone forgot to close swallows every subsequent fence, including a correctly-tagged `` ```python `` one containing a real defect → **exit 0**. Same for a python fence nested inside a ` ````markdown ` wrapper. Latent: the emitted tree currently has **zero** unclosed fences.

### D7 (medium) — PF05 poisons the binding model of *correct* fences

A PF05 fence contributes no bindings, so names it would have bound look unbound elsewhere. One stray `@` produced two PF01 findings pointing at **lines that are fine**, where the same file without the `@` is clean. Conversely, appending one unparseable character to a defective fence converts a PF01+PF03 into PF05 alone — erasing the real rule ids while the exit code stays 1. Any fixture asserting an *exact* rule set is one stray character away from a different verdict.

### D8 (low) — new false-positive class: the walrus operator

`if (n := jobs):` → `:=` is not a known operator, so `n` is never bound and is reported as an unbound read (PF01 ×2). Adjacent to the already-known `handles: list = await …` annotated-assignment false positive.

## Catch matrix vs reality

The matrix is reproduced verbatim in the checker header per AC-13, and the header warns: *"a gate advertised as catching four and catching two is the same false-confidence failure this checker exists to remove."* That warning applies to the header itself.

| Row | Shipped rating | **Earned** | Why |
|---|---|---|---|
| 1 — dangling contract / **PF02** | Strong | **Weak** | D1: deleting the protocol block from a shipped `SKILL.md` lints exit 0. Excused by any backticked mention, by a mention inside an HTML comment, and by the dangling use itself (`by_name[unit].name`). Writing the same contract as bare `` `handle.name` `` instead of `receiver_name=handle.name` silences it — the corpus pins one lucky rendering. |
| 2 — unbound `jobs` / **PF01** | Strong | **Conditional** | Holds for the literal historical edit. Silenced by one backticked mention anywhere in the file, by a binding in any unrelated fence in the file, and by a `description:` line in YAML frontmatter. Absent entirely for inline spans unless the name is one of the 8 watched. |
| 3 — discarded `gather`/`handle` / **PF01 + PF03** | Strong for the binding defect | **Weak** | Not only file-scoped (BUG-1): D2 shows `_ = …` is treated as a binding, so a deliberate discard is invisible. |
| 4 — generator exhaustion / **PF04** | Weak | **Weak** | **Honest.** Fires on the real pre-fix prose in both files; correctly silent when the fence has one read; adjacency holds in the fail-closed direction. |
| KNOWN LIMITS — "PF05 fails closed" | fails closed | **Conditional** | True *inside* a fence tagged exactly `python`. Fence **selection** fails wide open: ` ```py `, ` ```python3 ` and untagged fences are linted by no rule at all, and inline spans are pattern-scanned, never fail-closed. |

Three of four rows plus the PF05 limit are overstated. As measured, the header advertises three **Strong**s and delivers one **Conditional** and two **Weak**s. The only row that survived is the one that already called itself weak — which is itself evidence that the honest-matrix discipline works when applied, and was not applied to the other three.

The KNOWN LIMITS block also names only PF02/PF03 as file-scoped (known finding A2); measurement confirms **PF01 and PF04 are file-scoped by the same mechanism**, so the block understates the scope of its own most important caveat.

## Verdict

**PASS on the floors.** All three mandated gates are green, AC-11's census is exact, AC-14's edit is additive (0 deleted lines), the checker's line coverage is 98.2%, and — a real and under-credited strength — **no rule crashes**: 27 adversarial inputs (10,000-deep brackets, 400 KB lines, NUL bytes, unicode identifiers, unclosed spans, 20,000 spans in one paragraph) all terminated in under 0.1 s with a finding or a clean exit, no ReDoS, no stack overflow. The tokenizer's fail-closed design is sound *within its region*.

**The gate does not yet earn the confidence its artifacts claim.** Three findings should be weighed as blocking-grade by the reviewer:

1. **D1** — the gate's own headline defect class (matrix row 1, rated Strong) reproduces against the gate and passes.
2. **T1 + T2** — three independent coverage-destroying mutations leave section 4 fully green; 4f cannot distinguish the emitted distribution from an empty directory (byte-identical output, identical exit code); the tree it certifies is 0.17% of bytes and 4 of 54 files, in every one of which the entire watched vocabulary is already excused.
3. **The catch matrix is overstated on three of four rows** — the precise failure mode the plan's Overview says this work exists to eliminate, now present in the work itself.

The cheapest structural fix identified — offered as an observation, not a change — is not a new rule but a **coverage floor**: have the checker report how many files it modeled and fail when that count is zero or below a pinned number. That single change kills all three zero-coverage mutants and closes the empty-directory equivalence. It does not address D1, D2, or the matrix ratings, which need rule changes and honest downward corrections respectively.

Nothing was fixed. No production or test file was modified.
