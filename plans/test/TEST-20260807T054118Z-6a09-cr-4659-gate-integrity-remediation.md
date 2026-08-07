---
id: TEST-20260807T054118Z-6a09
plan: FIX-20260807T050208Z-9ac2
title: Test Report — Nested parallelism, CR-4659 gate-integrity remediation
status: PASS
created_at: 2026-08-07T05:54:24Z
cycle: 0
---

**Related:** [FIX-20260807T050208Z-9ac2](../code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md) · [CR-20260807T045301Z-4659](../code-review/CR-20260807T045301Z-4659-nested-parallelism-cr-remediation.md) · [TEST-20260807T043712Z-9b56](./TEST-20260807T043712Z-9b56-nested-parallelism-cr-remediation.md) · [TEST-20260807T035031Z-230c](./TEST-20260807T035031Z-230c-nested-inner-lane-parallelism.md)

## Summary

Third tester pass on this branch. The charter was not "are the gates green" but "**can the gates go red**" — the plan exists because 31 of 228 assertions across two plan files were structurally incapable of reporting failure.

Every claim in the coder's Progress Log was re-derived independently rather than accepted. The harness is now genuinely capable of failing: **16/16 gate blocks green, ~95 subject-artifact mutations applied, 93 correctly RED, 2 controls correctly GREEN, 1 genuine leak found.** MF-1 is closed by direct demonstration, MF-2 closes structurally (not just on the one worked example), and both amendment records survive intact.

Two non-blocking findings and one stale-claim divergence are recorded for the reviewer. None is a false-green on a shipped artifact claim; all three are gate-hygiene defects of the same class this plan was chartered to remove.

Method note: mutations were applied to the **subject artifacts** (`SKILL.md`, `references/config.md`, `templates/*`, and the plan files' own gate bodies), never to the extracted gate scripts — so a mutation that passes is a gate that failed to bind a real claim, not a gate script I weakened. Gate scripts were verified byte-identical to first extraction at the end of the run. `/usr/bin/grep` was used for every exit-code-bearing check.

## Flows Triaged

No e2e framework exists (`PROJECT-CONTEXT.md` → Test tooling: doc-skill changes are verified structurally). "Flows" here are the harness capabilities the plan claims. Criticality = user impact × breakage likelihood × not-covered-by-existing-checks.

| Flow | Criticality | Decision | Rationale |
| --- | --- | --- | --- |
| An absence assertion can actually fail | **Critical** | **Selected** | The entire plan's premise. If false, every downstream phase's TDD ordering is theatre. Verified by direct execution of both forms, plus per-block mutation. |
| Each of the 16 gate blocks binds a real claim | **Critical** | **Selected** | The coder's headline claim ("mutated each in turn, every one exited non-zero") is exactly the claim most likely to be self-confirming. Re-derived with ≥4 independent mutations per block. |
| No banned form survives as a live assertion | **Critical** | **Selected** | A single surviving `!` or piped `grep -q` reopens the defect. Swept all 16 blocks; cross-checked the sweep's own extractor for blind spots. |
| MF-2 cost model: gate verdict ≡ ladder figure | **High** | **Selected** | The CR's counterexample is a single data point; a model can satisfy one example and still disagree elsewhere. Re-derived the example, then brute-forced the invariant. |
| Both amendment records preserved | **High** | **Selected** | The plan's own fix could have "resolved" the contradiction by silently deleting one side. Checked both literals' every surviving occurrence and fence position. |
| No vacuous assertion (empty `awk` range) | **High** | **Selected** | An absence check over an empty stream is silently green. Traced all 30 distinct range invocations actually executed. |
| Renderer suite (`render-artifact.test.cjs`) | Low | **Selected** (collateral guard only) | Not in this plan's diff, but the only executable suite adjacent to the touched tree. Cheap regression signal. |
| `gate-scope.test.cjs`, `gate-shell-injection.test.cjs` | — | **Excluded** | Pre-existing red at merge-base `974b01a`, verified three times, unrelated to this diff. Plan Out of Scope. Not re-litigated. |
| `clean-code-gates` JS suite | — | **Excluded** | `PROJECT-CONTEXT.md` → Invariants: scoped to that skill only; must not be run against doc skills. |
| Live orchestrator pipeline execution | — | **Excluded** | No runtime; skills are markdown procedures. Would test nothing this plan changed. |

## E2E Tests Added

None — and none should be. This repo has no e2e framework and the plan's deliverable is markdown prose plus its own structural gates. Adding an e2e harness here would be scope invention, not coverage.

What was built instead (all in scratchpad, not committed — the plan's gates remain the deliverable):

1. **Fence extractor** — pulls each `### Phase N gate` fenced block into a standalone script. Independent of the plan's own `gate_code` helper, so the extractor and the thing it audits do not share a failure mode. Recovered exactly 16 blocks (P 5 / F 6 / T 5).
2. **Banned-form sweep** — line-level scan of all 16 blocks' live (comment-stripped) lines for `!`-inverted commands, brace-group negations, and piped `grep -q`.
3. **Range-vacuity tracer** — runs every block under `bash -x`, harvests every `awk` range invocation actually executed, re-runs each and counts output lines.
4. **Mutation matrix** — ~95 subject-artifact mutations with automatic backup/restore and a post-run residue check.
5. **Cost-model re-implementation** (`costmodel.cjs`) — the MF-2 model transcribed only from the shipped prose, then brute-forced.

## Coverage

**N/A — inapplicable, not below floor.**

| | Before | After |
| --- | --- | --- |
| Executable lines in this plan's diff | 0 | 0 |
| Line coverage | N/A | N/A |

`FIX-20260807T050208Z-9ac2` touches only markdown (`plugins/my-skills/skills/orchestrator/**` and three plan files under `plans/`). There is no executable line to cover, so the 70% floor has no denominator. Per `PROJECT-CONTEXT.md` → Test tooling, coverage is advisory here and not a block.

Collateral guard (not in this plan's diff): `node --test plugins/my-skills/skills/orchestrator/scripts/render-artifact.test.cjs` → **45/45 pass**.

## Verification Results

### 1. Harness integrity — MF-1

| Check | Result |
| --- | --- |
| Gate blocks recovered / green | **16 / 16 exit 0** |
| `!`-inverted commands in live gate lines | **0** across all 16 |
| Brace-group negations in live gate lines | **0** (1 textual hit is the meta-assertion's own `gre[p]` scanner pattern) |
| Piped `grep -q` consumers in live gate lines | **0** across all 16 |
| Residual textual hits of `! grep` in the 3 plan files | 13 — **all** prose (harness notes), amendment records, or the Technical-Notes verification table. **None live.** |
| Canonical rewrites (`echo "FAIL:` count, live code) | P = **13**, F = **19** (18 `!`-inverted + 1 brace-group), T = 18 |

13 + 18 = **31 `!`-inverted plus one brace-group variant** — the coder's count reproduces exactly.

The `gate_code` extractor the meta-assertions depend on was itself audited for blind spots: range starts, range ends, and `### Phase N gate` heading counts agree 1:1 in all three files (5/5/5, 6/6/6, 5/5/5). It cannot silently skip a block that harbours a surviving banned form.

Canonical form verified by direct execution, not by inspection:

| Script under `set -euo pipefail` | Claim | rc | Reached next line? |
| --- | --- | --- | --- |
| `if grep -qF X f; then echo "FAIL:…"; exit 1; fi` | violated | **1** | no |
| `if grep -qF X f; then echo "FAIL:…"; exit 1; fi` | satisfied | **0** | yes |
| `! grep -qF X f` (the old form) | **violated** | **0** | **yes — the defect** |

### 2. Mutation matrix — did each block bind a real claim?

~95 mutations, ≥4 per block, all applied to subject artifacts. Diff-line counts were checked on the corrected re-run so that "mutation applied" was proven before any verdict was drawn.

| Block | Mutations | Correctly RED | Leak |
| --- | --- | --- | --- |
| P phase 1–5 | 27 | 27 | — |
| F phase 1–6 | 29 | 29 | — |
| T phase 1 | 10 (+1 GREEN control) | 10 | — |
| T phase 2 | 6 | 5 | **1** (see W-1) |
| T phase 3 | 7 | 7 | — |
| T phase 4 | 7 | 7 | — |
| T phase 5 | 7 | 7 | — |

Two deliberate **GREEN controls** both behaved correctly — proving the fixes discriminate rather than blanket-reject:

- A banned literal added as a `#`-comment line inside the parent's Phase 3 gate → **stays green** (comment-stripping working as designed).
- `config.md` with a time unit only on the prohibition line → **stays green** (MF-1(c)'s narrowing is a correction, not a relaxation).

Twelve mutations initially read as leaks. Nine were **my** bug — perl's range operator is inert under `-0` whole-file slurp — and two more were no-ops for the same reason; all eleven went correctly RED once re-run in line mode with the applied diff verified. One survived as a genuine finding.

### 3. MF-1(b) — both amendment records preserved

Neither side of either contradiction was deleted.

| Literal | Surviving occurrences in `FEAT-…-6077` | In fence? | Live Phase gate body hits |
| --- | --- | --- | --- |
| `amendment loop is evaluated first` | `:32` (AC 11), `:122` (task), `:544` (amendment record) | all NO | Phase 3 body: **0** |
| `grep -q 'Parent contract:' "$AR"` | `:379` (provenance comment), `:557` (amendment record) | `:379` **YES** | Phase 4 body: **0** |

Comment-stripping is demonstrably **load-bearing**, exactly as the plan's Technical Notes claim: over the parent's Phase 4 gate, the `awk` range **alone** finds **1** hit; the range **plus** comment-stripping finds **0**. An `awk` range without `gate_body` would not have resolved this collision.

Both rescopes were also mutation-tested from the other direction: re-inserting either literal as a **live** assertion line in the parent's gate drives F phase 1 and F phase 4 red, and deleting either amendment record from the parent drives T phase 1 red. The rescoping binds in both directions.

### 4. MF-2 — cost model re-derived

The CR's worked counterexample reproduces **exactly** against the shipped prose:

| | flat (`lanes`) | nested (candidate adopted) |
| --- | --- | --- |
| `span_max` | 12 | 6 |
| overhead | `A + J` = 4 | `A + A + 1×J + J` = 8 |
| makespan | `M_flat` = **16** | `M_nested` = **14** |

`g` = 12 − 6 = **6**; `c` = 8 − 4 = **4**; `g > c` → **ADOPT**, and `M_nested` (14) < `M_flat` (16). **Verdict and figure agree.** The documented pre-correction contradiction also reproduces: billing `A` twice gives `c = 6` against `g = 6`, and "Equal is not enough" **rejects** the candidate while the ladder prints it 2 task-equivalents cheaper.

One example proves little, so the invariant was brute-forced. Transcribing the model from the prose only (`:191–250`, `:266–272`) and running greedy critical-lane-first adoption over random configurations:

- **28,463** configurations with ≥1 adoption
- **0** violations of `M_flat − M_nested ≡ Σg − Σc`
- **0** cases where the gate adopted but the ladder was not cheaper

This is structural, not incidental: because `c` is defined as the marginal delta of `M_nested`, `M_nested − M_flat = −g + c` identically, so `g > c ⟺ M_nested < M_flat`. The two accounts **cannot** diverge. Verified by hand for both branches of the `A` charge — first adoption `A + J + Δ I`, later adoptions `J + Δ I` — each matching `M_nested`'s delta exactly, and matching the greedy-termination text at `:270` verbatim.

The other three MF-2 sub-defects check out: `I` now appears in `M_nested` (`:211`), the barrier round-trip is in **neither** side with a stated reason (`:248`), and `span_max`/`makespan` are kept as two named quantities so the gain is measured over one and the cost over the other (`:193–194`, `:236`).

### 5. Vacuity

- **0 empty `awk` ranges** across all **30** distinct range invocations executed by the 16 blocks. No absence assertion is silently green on an empty stream.
- **1 conditionally-vacuous wrapper** survives across all 16 blocks (see W-2). Every SF-5 target in the predecessor plan was correctly converted to an unconditional assertion.

### 6. Self-reported items — both confirmed

**`FIX-…-bf97` Phase 2 gate item 3 amendment: confirmed, correctly recorded.** The gate line that required the literal `no role walks the contract tree` now requires `no role recurses past one level`, carrying a 10-line inline justification naming `CR-20260807T045301Z-4659 (MF-3)` and this plan's Phase 2. MF-8's actual demand is untouched and still asserted directly above (`if grep -qF 'their templates are unchanged' … FAIL`), and that assertion mutation-tests red. The shipped `SKILL.md` contains **0** occurrences of the false enumeration. See D-1 for the one loose end.

**AC 7 counting discrepancy: confirmed, documentation-only.** AC 7 (`:30`) reads "All fifteen gates (parent 5 + predecessor `FIX` 6 + this plan's 4)". Actual: 5 + 6 + **5** = **16**. The plan's own Phase 5 gate asserts the correct figure (`grep -c '^### Phase . gate' "$T"` `-eq 5`), so no gate is affected. The coder disclosed this at `:425–429`.

## Test-Quality Audit

### W-1 — `awk` range one line too wide (T / Phase 2 gate, item 1) · genuine leak

`awk '/^Each resolves the /,/^\*\*Beyond that one rule/'` spans `SKILL.md:926–928`. Line **928** independently carries both `leaves=` and "falling back", so it satisfies both of item 1's assertions on its own.

Consequence, verified by mutation:

| Mutation of `SKILL.md:926` | Gate |
| --- | --- |
| Delete the line entirely | **RED** (range start anchor vanishes) |
| Keep the opening words, gut the rest | **GREEN — leak** |
| Gut `:926` **and** strip `:928` | **RED** |

So `:926` — the exact sentence AC 5 and the Phase 2 task name — is not individually pinned; only the region is. This is the same class as the "ANCHOR TIGHTENED" defect the predecessor plan fixed in its own Phase 3 gate. **Fix:** make the range end exclusive, or anchor the assertion on the sentence rather than the paragraph pair. Not a blocker — the shipped prose is correct and the region as a whole is pinned.

### W-2 — conditionally-vacuous wrapper (T / Phase 3 gate, item 2) · silent skip

```bash
if awk '…cost side…' "$C" | grep -F "extra architect round-trip Step 2s" >/dev/null; then
  test "$(awk '/^M_nested = /,/^Charging the two levels/' "$C" | grep -c '+ A ')" -ge 3
fi
```

The coder took the "delete the bullet" branch, so the condition is **false** on the shipped tree and the guarded body never executes. The logic is sound — I confirmed it fires (rc=1) when the cost bullet is reintroduced without a third `A` — but it skips **silently**.

This is the only surviving instance of the defect class across all 16 blocks, and it was written **in this pass**, by the same plan whose SF-5 task removed two identical wrappers from the predecessor and prescribed the remedy: assert unconditionally, or add `else echo "SKIPPED: …" >&2` so a skipped branch is visible. **Fix:** apply SF-5's own prescription to it.

### D-1 — the predecessor plan's AC still states the claim MF-3 ruled false

The coder amended `FIX-…-bf97`'s Phase 2 **gate** item 3 and recorded it. But that plan's **AC 8 (`:31`)** and its **MF-8 task (`:78`)** still state verbatim both claims `CR-4659` MF-3 ruled false:

> "…they changed **only** to name the outer join … — **for the tester** — … ; **no role walks the contract tree** and none has a per-lane or per-sub-lane pass"

The shipped `SKILL.md` is correct. But two copies of one claim now disagree **inside the predecessor plan**, with an amendment record on the gate side and none on the AC side — which is precisely what this plan's AC 3 ("The two copies of one claim agree") exists to prevent. A future reader treating AC 8 as a checklist would reintroduce the false claim. **Fix:** a one-line amendment record on AC 8 and task `:78` pointing at `CR-4659` MF-3, in the same shape the gate amendment already uses.

### Minor / informational

- **Stale line cites.** The plan's Technical Notes locate the two colliding literals at `FEAT-…:476` and `FEAT-…:354`/`:489`. They now sit at `:544` and `:379`/`:557` — the file grew during the pass. The claims hold at the new locations; only the cites drifted.
- **"Four plan files."** The gate blocks live in **three** files (one `FEAT` + two `FIX`), carrying 16 blocks total. No file was missed.
- **Piped-consumer count.** SF-1 says 24; the live sweep counts 26 `| grep … >/dev/null` consumers in the parent (multi-stage pipelines contribute more than one). Cosmetic — what matters is that **zero** `grep -q` consumers survive, which is confirmed.

### Assertion quality — positives worth recording

- Every previously-tautological assertion the CR named now binds under mutation: SF-2's per-site count (`… -eq 3` → drops to 2 and goes red), SF-6's positive `--resume` claim, and the `Mark the lane DONE in the *parent* contract` literal.
- The MF-3 "class-catching" assertion the CR asked for does bind: injecting the banned unconditional-walk phrasing into `:926` drives the gate red.
- The `-[q]` bracket idiom introduces no blind spot — re-inserting a real `grep -q 'Parent contract:'` line as live gate code is caught.
- The red canary is not decorative: it exercises the canonical form end-to-end in a subshell and would fail the gate if the form ever stopped aborting.

## Verdict

**PASS.**

The harness is genuinely capable of failing. The coder's central claim — all 16 blocks mutation-tested red — is **independently reproduced and extended**: ~95 mutations against subject artifacts rather than one per block, with two GREEN controls proving the fixes discriminate rather than blanket-reject. The 31 + 1 banned assertions are gone with no live survivor, both amendment records are intact with comment-stripping proven load-bearing, and MF-2's model closes structurally across 28k configurations rather than on a single worked example.

Three items are handed to the reviewer, none blocking:

| ID | Type | Severity |
| --- | --- | --- |
| W-1 | `awk` range one line too wide — `SKILL.md:926` not individually pinned | Low |
| W-2 | Conditionally-vacuous wrapper, silent skip — the plan's own SF-5 class | Low |
| D-1 | Predecessor plan's AC 8 / task `:78` still state the claim MF-3 ruled false | Low |

Working tree restored to exactly the branch's 10 modified files; extracted gate scripts byte-identical to first extraction; all 16 blocks re-confirmed green after the full mutation run.
