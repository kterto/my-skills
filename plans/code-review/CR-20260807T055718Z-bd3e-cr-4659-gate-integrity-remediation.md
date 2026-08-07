---
id: CR-20260807T055718Z-bd3e
plan: FIX-20260807T050208Z-9ac2
title: Review of Nested parallelism — CR-4659 gate-integrity remediation
status: APPROVED
created_at: 2026-08-07T05:57:18Z
reviewer: reviewer-agent
cycle: 3
must_fix_count: 0
should_fix_count: 5
---

**Related:** [FIX-20260807T050208Z-9ac2](./FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md) · [CR-20260807T045301Z-4659](./CR-20260807T045301Z-4659-nested-parallelism-cr-remediation.md) · [FIX-20260807T040856Z-bf97](./FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md) · [FEAT-20260807T030642Z-6077](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md) · [TEST-20260807T054118Z-6a09](../test/TEST-20260807T054118Z-6a09-cr-4659-gate-integrity-remediation.md)

## Summary

Third review cycle. `CR-20260807T045301Z-4659`'s four Must Fix items are all closed, verified against the live tree with my own extraction and my own arithmetic rather than against the plan's claims or the tester's report. I built an independent markdown-fence parser (not the plan's `gate_code` helper, so no shared failure mode), recovered exactly 16 gate blocks from the three plan files, and ran them: **16/16 exit 0**. I then swept every block's live (comment-stripped) lines for the three banned idioms: **zero** `!`-inverted commands, **zero** real brace-group negations (the single textual hit is the meta-assertion's own `gre[p]` scanner pattern, non-self-matching by construction), **zero** `grep -q` pipe consumers. The harness defect that made 31 of 228 assertions structurally incapable of failing is gone.

The three false prose claims are gone too, and each was checked by reading the shipped text, not by trusting the presence assertion over it. MF-2's cost model closes — I re-derived `M_flat − M_nested ≡ Σg − Σc` by hand from the shipped formulas (`c` is defined as the marginal delta of `M_nested`, and `M_flat` now carries the interface-point term as well), so the gate verdict and the `ask` ladder figure are structurally incapable of disagreeing; the `{12, 6}` → `{6, 6}` worked example is recorded in the file and reproduces. MF-3's `SKILL.md` 3j.3 enumeration now matches what the three templates actually shipped, including the reviewer's two-level interface-row lens and the two deletions the old text hid. MF-4's `#### Owned-glob rejection` routes by stage and cross-references both sibling documents.

I rule the tester's three handed-up findings — W-1, W-2, D-1 — as **Should Fix, none blocking**, with reasoning below. All three are gate/record hygiene on artifacts under `plans/`; not one of them puts a false claim into a shipped skill file or leaves an acceptance criterion unmet. I add two more of my own in the same class. Verdict: **APPROVED**.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | MF-1(a) — every absence assertion can fail; zero `!`-inverted survive; canonical form adopted | ✅ | My own sweep of all 16 blocks' live lines: 0 `!`-inverted, 0 real brace-group negations, 0 piped `grep -q`. Canonical-form counts hold (`echo "FAIL:` ≥ 13 in `P`, ≥ 18 in `F`). The red canary in `T` Phase 1 §9 actually executes a violated absence assertion in a subshell and confirms rc≠0 — it is not decorative. |
| 2 | MF-1(b) — the two unsatisfiable assertions are gate-scoped and green; neither side deleted | ✅ | Verified both directions myself. Live Phase 3 body: 0 hits of the old literal; live Phase 4 body: 0 hits. Amendment records intact — `amendment loop is evaluated first` survives 3× (`:32`, `:122`, `:544`), `grep -q 'Parent contract:' "$AR"` survives 2×. Comment-stripping is load-bearing exactly as the Technical Notes claim: the `awk` range alone still finds the Phase 4 literal (it is an in-fence `#` line); `gate_body` finds 0. |
| 3 | MF-1(c) — the parent's blanket wall-clock assertion is narrowed and recorded | ✅ | `P` Phase 1 gate §8 now permits a time unit only on the line carrying `Never print a wall-clock ETA`, and §8b asserts `CR-20260807T045301Z-4659` appears inside that gate's own commentary. `references/config.md` has exactly one time-unit occurrence, on the prohibition sentence itself. The two copies of the claim agree. |
| 4 | MF-2 — one overhead account across gate and ladder | ✅ | Re-derived by hand from the shipped prose, not accepted. `span_max` (bare critical path) carries the gain; `makespan = span_max + overhead` carries the cost; `c` is the marginal delta of `M_nested`, so `M_flat − M_nested = Σg − Σc` identically and `g > c ⟺ M_nested < M_flat`. `A` charged on first adoption only on **both** sides, matching the slowest-of-`k` concurrency claim. Barrier round-trip in **neither** side with the reason retained. `I` present in both `M_nested` and `M_flat`. Greedy increment at `#### Greedy, recomputed adoption` reads `A + J + I` first / `J + I` after — matching the delta exactly. Worked example recorded and correct (`g` 6 > `c` 4, `M_nested` 14 < `M_flat` 16). |
| 5 | MF-3 — `3j.3` states what is true | ✅ | Read the shipped text. `:926` names `leaves=` as the primary path and the `Sub-contract`-column walk as the **legacy fallback**, agreeing with `:150`. `no role walks the contract tree` = **0** hits; replaced by `no role recurses past one level, and none has a per-lane or per-sub-lane pass`, plus a sentence naming where the one legitimate hop happens. The `changed only … — for the tester —` enumeration = **0** hits, rewritten to name the reviewer's two-level lens and boundary clause, the reviewer's lost `full`-mode bullet, and QA's lost per-lane-`CR` rule. The class-catching assertion binds (see SF-1 for its range width). |
| 6 | MF-4 — `<2-viable-sub-lanes` has one owner across all three documents | ✅ | `#### Owned-glob rejection` contains 0 hits of `runs flat` and routes by stage: pre-freeze → 2p.3n leaves the lane flat; contract-authoring (Step 2s) → architect stops, run halts at Step 2s.3, with the frozen-`Sub-contract`-cell reason. Cross-references to `SKILL.md` → 2p.3n / 2s.3 and `templates/architect.md` → *Sub-contract deltas* item 2 are present. `architect.md:162` and `SKILL.md:489` agree; SF-4's narrowing of "here and nowhere else" to the **adoption decision** reconciles it with the earlier-stage drops. |
| 7 | No regression — all gates exit 0 as one batch; `scripts/**` and `templates/html/**` empty; every `test -f` resolves | ✅ | **16/16 exit 0** under my own independent extraction. `git diff --stat -- scripts/ …/templates/html/ …/orchestrator/scripts/` is empty. Every `test -f` cross-reference resolves. The AC's own "fifteen / this plan's 4" wording is off by one (it is 5 + 6 + 5 = 16); documentation-only and self-disclosed — the Phase 5 gate asserts the correct 5. See SF-4. |
| 8 | Nothing in the CR's exclusion list is touched | ✅ | `#### 3j.4` = 0 hits; the halt/amend precedence sentence appears exactly once (`SKILL.md:840`); no JS suite was invoked against a doc skill; `HEAD` is unchanged at `f241623` — nothing committed or pushed. `gate-scope`/`gate-shell-injection` not re-litigated. |

**Invariants (`PROJECT-CONTEXT.md`).** opencode-port-parity — N/A, `orchestrator` has no `.opencode/skills/` override port (only `pr-review-report` and `spec-driven-eval` do). Single-source-of-truth references — honoured: MF-2 and MF-4 both landed in `references/config.md`, the normative home, with `SKILL.md` and `templates/architect.md` pointing there. `.md`/`.html` template parity — N/A, no token or section added. Backward compatibility — all edits are prose/arithmetic corrections to existing sections; no new key, no forced migration. Never-commit — honoured.

## Must Fix (Blockers)

**None — no blockers found.**

The four Must Fix items from `CR-20260807T045301Z-4659` are closed, and I found nothing new of that severity. Explicit rulings on the three items the tester handed up follow, in the Should Fix section — I am ruling on each rather than deferring, and none of them blocks.

## Should Fix (Warnings)

### SF-1 — W-1: the Phase 2 gate's `awk` range is one line too wide

**File**: `plans/code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md` (Phase 2 gate, item 1)

**Ruling: Should Fix, not blocking.** The tester's finding reproduces exactly — I confirmed the range `/^Each resolves the /,/^\*\*Beyond that one rule/` spans `SKILL.md:926–928` and that `:928` **alone** carries both `leaves=` and `falling back … legacy run`, so it satisfies both of item 1's presence probes on its own. Gutting `:926` while preserving its opening words therefore leaks green.

It does not block for three reasons I verified independently. The shipped prose at `:926` is **correct**, so nothing false is in the product. Deleting `:926` outright still reds the gate (the range-start anchor vanishes). And AC 5's *explicit* gate demand — sub-demand 4, "a gate assertion exists that can catch the unconditional-walk form" — is item 2, which **does** bind on `:926`: the range includes that line, so injecting the banned unconditional-walk phrasing there drives the gate red. What leaks is item 1's precision, not the criterion. The plan's own phase exit criterion also requires "a read-through confirming the prose actually says what the grep proves is present", which is the backstop that caught nothing here because there was nothing to catch.

**Fix**: make the range end exclusive, or anchor item 1 on the sentence rather than the paragraph pair — e.g. `sed -n '/^Each resolves the /p'` or an `awk` range terminating on the blank line. One line.

---

### SF-2 — W-2: the Phase 3 gate's barrier-round-trip check is a silently-skipped conditional

**File**: `plans/code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md` (Phase 3 gate, item 2)

**Ruling: Should Fix, not blocking.** The tester is right that the guarded body never runs on the shipped tree — the coder took the "delete the bullet" branch, so `grep -F "extra architect round-trip Step 2s"` over the cost side is false and the `-ge 3` test is skipped without a word.

I part company with the tester on one point of classification, and it is why this is not a blocker. SF-5's class was `if <optional plan item was taken>; then <assert the required work>; fi` — a wrapper where a skipped branch produces **no signal at all** about whether required work happened, so the gate reads OK either way. This item is a **conditional invariant** ("if the bullet survives, `M_nested` must carry the matching third `A`"), and its false branch is itself the verified end state: the bullet is absent, which is one of the two outcomes AC 4 explicitly permits ("appears in both or neither with a stated reason"). The tester confirmed it fires (rc=1) when the bullet is reintroduced without the third `A`, so it binds the regression path it exists to guard. What is genuinely missing is an assertion over the *neither* branch's "stated reason" — and I confirmed that reason is present in the shipped file (`#### The cost side` → **Why there is no separate barrier charge**), just unpinned.

The criticism that stands, and it is a fair one: this was written in the same pass that removed two identical-looking wrappers elsewhere, and the plan itself prescribed the remedy.

**Fix**: apply SF-5's own prescription — add `else echo "SKIPPED: barrier bullet absent (the deleted branch); nothing to reconcile" >&2` so the skip is visible, and add a positive assertion that the neither-branch reason is present.

---

### SF-3 — D-1: the predecessor plan's AC 8 and task line still state the claims MF-3 ruled false

**File**: `plans/code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md:31` and `:78`

**Ruling: Should Fix, not blocking.** Confirmed verbatim at both sites — AC 8 and the MF-8 task still say *"changed only to name the outer join … — for the tester —"* and *"no role walks the contract tree"*, both ruled false by `CR-4659` MF-3. The gate side of that plan was amended and carries a 10-line inline record naming `CR-20260807T045301Z-4659 (MF-3)` and this plan's Phase 2; the AC side carries nothing.

This is the closest call of the three, and I considered blocking it. The argument for blocking: this plan **did** modify `bf97`, and it left that file internally inconsistent — two copies of one claim disagreeing, which is the precise defect shape this chain has been remediating for three cycles.

The argument that wins, and it is decisive: `bf97` is a **completed, superseded orchestration artifact**, and its AC 8 is a historical record of what the plan was *asked* to do, not a normative claim about the product. Rewriting a DONE plan's acceptance criterion would falsify that record; the correct fix is a pointer, not an edit. And the disagreement is already documented in three places a reader reaches before acting on AC 8: `CR-4659`'s AC table rules AC 8 ❌ explicitly, `CR-4659` MF-3 explains why in full, and `bf97`'s **own Progress Log** (`:511`) records that "no role walks the contract tree" is false and why. The shipped `SKILL.md` is correct with 0 occurrences of either claim. Nothing normative is wrong, and this plan's AC 3 — which the tester invokes — is scoped to the wall-clock claim specifically, not stated as a general rule the plan must enforce everywhere.

**Fix**: one amendment line on `:31` and `:78`, in the same shape the gate amendment already uses — `<!-- AMENDED (recorded, CR-20260807T045301Z-4659 (MF-3) / FIX-20260807T050208Z-9ac2, Phase 2): the "changed only …" enumeration and "no role walks the contract tree" are both FALSE; see the gate amendment at :236 and SKILL.md 3j.3 as shipped. -->`

---

### SF-4 — the Phase 5 gate's item 6 claims a batch re-run it does not perform, and AC 7's counts drift

**File**: `plans/code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md:30`, `:85`, `:110–111`, `:154`, and the Phase 5 gate's last two lines

**Problem**: Three documentation drifts, all found in my own read-through, all cosmetic but all in a plan whose subject is claims matching reality.

1. The Phase 5 gate's final item reads `# 6. finally: re-run all fifteen phase gates as one batch; every one must exit 0` and is followed immediately by `echo "phase 5 gate: OK"` — the block asserts nothing for item 6. A gate block cannot re-invoke itself without recursing, so this is necessarily an external step; the comment should say so rather than read as an assertion the block performs. (The batch re-run itself **was** done — by the coder, by the tester, and by me: 16/16.)
2. AC 7 (`:30`) and three Phase 5 tasks say "fifteen gates (parent 5 + predecessor `FIX` 6 + this plan's 4)". It is 5 + 6 + **5** = **16**, as the Phase 5 gate itself asserts. Self-disclosed by the coder at `:450`; no gate is affected.
3. Technical Notes cite the colliding literals at `FEAT-…:476` and `:354`/`:489`; they now sit at `:544` and `:379`/`:557` — the file grew during the pass. The claims hold at the new locations; only the cites drifted. `:154` cites `SKILL.md:489`, which is still correct.

**Fix**: reword item 6 as an external instruction, correct AC 7's parenthetical to `parent 5 + predecessor 6 + this plan's 5 = 16`, and refresh the three line cites.

---

### SF-5 — the Phase 3 gate's overhead-agreement assertion is near-tautological

**File**: `plans/code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md` (Phase 3 gate, item 4)

**Problem**: `awk '/^#### Marginal-gain rule/,/^#### The cost side/' "$C" | grep -iE 'span|overhead' >/dev/null` is meant to pin MF-2 defect 4 — that the formal after-value and the `makespan` definition agree on overhead. But the region it scans is *about* span reduction and overhead; the words are unavoidable there. The assertion would survive almost any rewrite of that section, including one that reintroduced the `makespan`/bare-`max` mismatch it exists to prevent. The resolution the coder shipped is genuinely good (`span_max` and `makespan` kept as two named quantities, with an explicit paragraph on why the gain is measured over one and the cost over the other) — the assertion just does not bind it.

**Fix**: pin the actual distinction, e.g. assert the region contains `it carries no overhead term` and that `span_max` is named as what the gain is measured over, or assert the after-value line is stated as a `span_max` rather than a `makespan`.

---

## Verdict

**Status**: APPROVED

All four Must Fix items from `CR-20260807T045301Z-4659` are closed and independently verified — the harness can now report failure (16/16 blocks green, zero banned idioms surviving as live assertions), the cost model closes structurally rather than incidentally, and all three false prose claims are gone from the shipped skill; the five remaining items are gate-precision and plan-record hygiene on artifacts under `plans/`, none of which puts a wrong claim into a shipped file or leaves a criterion unmet.

Invoke `/qa` with plan ID `FIX-20260807T050208Z-9ac2` to run the QA suite.
