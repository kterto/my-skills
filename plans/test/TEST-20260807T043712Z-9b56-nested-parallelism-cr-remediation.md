---
id: TEST-20260807T043712Z-9b56
plan: FIX-20260807T040856Z-bf97
title: Test Report — Nested inner-lane parallelism — CR-25d5 remediation
status: BELOW_FLOOR
created_at: 2026-08-07T04:37:12Z
cycle: 0
---

**Related:** [FIX-20260807T040856Z-bf97](../code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md)

## Summary

The plan's diff is **entirely prose** — 10 markdown files plus one line of a JSON config template
under `plugins/my-skills/skills/{orchestrator,product-manager}/`, 823 insertions / 140 deletions,
**zero** files under `scripts/` or `templates/html/`, **zero executable lines** of any language.
Coverage is therefore inapplicable, not missed, and there is no addressable surface for e2e. Per
`PROJECT-CONTEXT.md` → *Test tooling*, the designated substitute gate is the plans' own structural
assertion sets.

**All eleven gates — the parent plan's five as amended plus this plan's six — exit 0 as written.**
I re-ran them verbatim, extracted programmatically from the two plan files, under a real
`/usr/bin/grep` (the shell's `grep` is an `rtk`/ugrep shim). The coder's claim of a green aggregate
is accurate *as written*.

That is not the same as the claims being true, and this run was scoped to tell those apart. Four
findings, in descending severity:

1. **A harness defect the coder did not find makes 31 of ~228 assertions (14%) structurally
   incapable of failing** — and 3 of the 11 gates are genuinely RED once it is corrected. Under
   `set -euo pipefail`, bash exempts a command from `set -e` **when its return value is inverted
   with `!`**. Every `! grep -q …` assertion in both plans is a no-op: it can report false and the
   gate still prints `OK` and exits 0.
2. **MF-8 replaced a false claim with a different false claim.** `SKILL.md:928`'s new enumeration of
   what the three join templates changed is incomplete for `reviewer.md`, and its "Crucially, **no
   role walks the contract tree**" clause is contradicted by `SKILL.md:926` **two lines above it**,
   added in the same diff.
3. **MF-4's model does not close arithmetically.** The unit is declared and every quantity is
   restated in it, but the adoption gate's `g`/`c` and the `M_flat`/`M_nested` figures printed to
   the user at 2p.5 are computed from mutually inconsistent overhead accounts. A concrete input
   makes the ladder show nesting as a 2-task-equivalent *win* while the gate rejects it.
4. **MF-7's `<2-viable-sub-lanes` outcome still has more than one owner**, and one of the residual
   statements — in the normative reference file — asserts the exact outcome MF-7 exists to forbid.

The two harness defects the coder **did** report are both confirmed, precisely and independently.
The reviewer's MF-1 ruling was honoured: the SIMPLIFY prose was **not** reverted, and the amendments
are recorded and justified rather than silently relaxed. Verified directly, not by gate.

## Flows Triaged

`PROJECT-CONTEXT.md` → *Critical flows*: "Skill behaviors are verified by review of prose/templates,
not execution." No runnable surface exists in this diff, so every candidate scores zero on
*not-covered-by-unit* in the e2e sense.

| Flow | Criticality (impact × breakage × not-covered) | Decision | Rationale |
| ---- | --- | -------- | --------- |
| Orchestrator nested-parallel dispatch (2p→2c→2s→2L→3L→3s→3j) | high × high × **n/a** | **Excluded** | Prose procedure executed by an LLM agent. No entry point, no process, nothing to drive. e2e would test a paraphrase of the document. |
| `leaves=` emission across the three join spawns | high × med × **n/a** | **Excluded** → structural | Verified by scoped assertion + byte-comparison of the three lines. |
| Architect sub-contract routing on the `lane=` preamble | high × high × **n/a** | **Excluded** → structural | Routing lives in a prompt template read by an agent; asserted structurally + swept skill-wide. |
| Resume (`--resume`) two-outcome shape, orchestrator + PM | med × med × **n/a** | **Excluded** → structural | Same. |
| Artifact renderer (`render-artifact.cjs`) | med × low × low | **Excluded from new e2e; run as regression** | 45 existing tests already cover it; this plan touches zero files under `scripts/`. Run as a collateral-regression guard only — **45/45 green**. |

**No e2e tests added, and that is the correct outcome.** Adding one would require inventing a
harness for a document. The honest verification for a doc-skill diff is the structural gate, which
is what this report audits — including auditing whether the gate can fail at all.

## E2E Tests Added

None. See triage. The e2e budget for this plan is zero by construction, not by omission.

## Coverage

**Before: N/A → After: N/A.** Not measured, and not measurable.

```
git diff --name-only HEAD | grep -E '\.(js|cjs|mjs|ts|sh|py)$'   →  (no output)
```

Ten `.md` files and one `.json` template line. `PROJECT-CONTEXT.md` → *Test tooling*: "Coverage:
not measured except within `clean-code-gates`." This plan touches nothing in `clean-code-gates`.
The 70% floor is **inapplicable**, not unmet. I did not manufacture tests to move a number that
does not exist — doing so is the substitution the plan's own Phase 6 rule exists to forbid.

### Regression suites (collateral guard only)

| Suite | Result |
| ----- | ------ |
| `render-artifact.test.cjs` | **45 pass / 0 fail** |
| `check-artifact-pairing.test.cjs` | **pass** |
| `gate-target-guard.test.cjs` | **pass** |
| `gate-scope.test.cjs` | fail (pre-existing at merge-base `974b01a`, verified twice previously — **not re-litigated, not touched**) |
| `gate-shell-injection.test.cjs` | fail (same) |

## Structural Gate — all eleven assertion sets

Extracted verbatim from both plan files and run from the repo root with `bash <file>`, so `grep`
resolves to `/usr/bin/grep` rather than the shell's `rtk`/ugrep shim.

| Gate | As written | With the `!` exemption corrected |
| ---- | ---------- | -------------------------------- |
| parent Phase 1 | ✅ exit 0 | ❌ **RED** |
| parent Phase 2 | ✅ | ✅ |
| parent Phase 3 | ✅ | ✅ |
| parent Phase 4 | ✅ | ✅ |
| parent Phase 5 | ✅ | ✅ |
| FIX Phase 1 | ✅ | ❌ **RED** |
| FIX Phase 2 | ✅ | ✅ |
| FIX Phase 3 | ✅ | ✅ |
| FIX Phase 4 | ✅ | ❌ **RED** |
| FIX Phase 5 | ✅ | ✅ |
| FIX Phase 6 | ✅ | ✅ |

Assertion count cross-checks against the coder's own figures: the parent's five sets total **139**
assertions, matching the `03:37` CODER log exactly; this plan's six add **89**, for ~228 total.

## Finding 1 — `!` disables `set -e`: 31 assertions cannot fail (BLOCKING)

Bash exempts a command from `set -e` when its return value is inverted with `!`. This is
documented behaviour, not a bug in bash, and it defeats every negative assertion in both plans:

```bash
$ cat t.sh
set -euo pipefail
! true          # returns 1
echo REACHED
$ bash t.sh; echo "rc=$?"
REACHED
rc=0
```

Applied to a real assertion from the parent Phase 1 gate:

```bash
set -euo pipefail
! grep -qiE '\b(minutes|hours|seconds)\b' "$C"   # the pattern DOES match — assertion is FALSE
echo "REACHED-END"                                # …still reached
# rc=0
```

**Scope.** 31 of ~228 assertions (14%) are in this form, distributed across 9 of the 11 gates:

| Gate | Negated (unenforceable) assertions |
| ---- | --- |
| parent P1 / P3 / P4 / P5 | 3 / 3 / 2 / 5 |
| FIX P1 / P2 / P3 / P4 / P5 | 3 / 4 / 4 / 5 / 2 |

This matters more than the count suggests, because the **entire "we did not weaken anything"
half of the remediation is expressed in this form**. Specifically, these three assertions — the
ones the reviewer's ruling most depends on — are no-ops:

- `! grep -qE '^#### 3j\.4 ' "$K"` — *"the SIMPLIFY prose was not reverted"* (FIX P1 item 4)
- `! grep -rq 'Parent contract:' "$S"` — MF-3's core claim (FIX P4 item 1)
- `! grep -qF "grep -qi 'no level-specific behavior…'" "$P"` — *"the brittle assertion is gone"*

I re-verified all 31 claims individually and by re-running every gate with each `! cmd` mechanically
rewritten to `if cmd; then exit 1; fi`. **28 hold. 3 do not:**

**1a — `parent P1`: `! grep -qiE '\b(minutes|hours|seconds)\b' "$C"` is FALSE.**
`references/config.md:211` reads *"Task counts are the honest, checkable proxy; **minutes** would
be fabricated precision."* The FIX plan diagnosed this correctly and narrowed **its own** copy of
the assertion (FIX P3, recorded as an amendment), but **left the parent plan's blanket copy
unamended**. Two copies of one claim now disagree, and the strict copy is red. This directly
falsifies the plan's own AC 10 (*"All five of the parent plan's phase gates … exit 0"*) under a
working harness.

**1b / 1c — `FIX P1` and `FIX P4` contain assertions that are unsatisfiable by construction.**

```bash
! grep -qF "grep -q 'amendment loop is evaluated first'" "$P"        # FIX P1
! grep -qF "grep -q 'Parent contract:' \"\$AR\"" "$P"                 # FIX P4
```

Both assert that an old assertion's literal text is **absent** from the parent plan. But the same
FIX plan **requires that literal to be recorded** — Phase 1 task 2: *"Add an inline comment above
the amended assertions naming `CR-…` … as the recorded justification."* The coder complied,
correctly, at `FEAT-…:354` and `FEAT-…:476`/`:489`. The plan's recording requirement and its own
gate are therefore **mutually exclusive**: satisfying one necessarily reds the other. They read
green only because `!` suppressed the failure.

The fix is to scope the absence check to the fenced gate block (e.g. via the `awk` range that
already isolates it) rather than to the whole file, so the provenance comment does not collide with
the assertion it justifies.

> **Note on class.** This is the same species of defect the coder found — *a gate whose verdict is
> decided by a shell artifact rather than by the claim* — reached by a different mechanism. The
> coder swept the pipeline form and missed the negation form. Any fix should sweep both, and should
> also be applied to the Phase 6 rule the plan just added: mandating a gate re-run is only as good
> as the gate's ability to go red.

## Finding 2 — MF-8's replacement claim is itself false (BLOCKING)

The MF-8 gate assertion is a prose-presence check:

```bash
awk '/^#### 3j.3 /,/^### Step 4 /' "$K" | grep 'no role walks the contract tree' >/dev/null
```

It is green. The sentence it proves present is not true.

`SKILL.md:928` now reads: *"Their templates changed **only** to name the outer join, to accept the
pre-resolved `leaves=` set, and — **for the tester** — to fold sub-contract interface rows into its
existing critical-flow triage input. Crucially, **no role walks the contract tree**…"*

**(a) The enumeration is incomplete.** `git diff templates/reviewer.md` adds a bullet that is none
of the three listed items, and is the reviewer's own analogue of the change 3j.3 attributes to the
tester alone:

> **Interface rows live at two levels.** … the sub-contract's **Inherited interface assignments**
> region names the sub-lane that owns that side — verify it there rather than guessing which leaf
> was responsible.

plus a two-level ownership clause on the boundary lens. `templates/qa.md` additionally *deletes* the
per-lane-CR reconciliation rule, which the enumeration also does not cover.

**(b) "No role walks the contract tree" is contradicted two lines above, in the same diff.**

| Line | Text |
| --- | --- |
| `SKILL.md:926` (added here) | "Each resolves the leaf plan set from the parent `PACT`'s lane map — **walking the `Sub-contract` column one level** for any sub-split lane" |
| `SKILL.md:928` (added here) | "Crucially, **no role walks the contract tree**" |
| `SKILL.md:150` (added here) | with `leaves=` present a role "**uses it as given and does not walk the contract tree**"; the walk "stays the **fallback** for a **legacy** run" |

`:926` states the walk as normal behaviour; `:150` states it is the legacy fallback only. `:926`
was not swept when MF-2 introduced `leaves=`.

**(c) And the claim is false on the merits anyway.** `leaves=` carries **`FEAT` plan IDs only**
(`:150`). But `tester.md` now requires *"Include the rows of every adopted **sub-contract**"* and
`reviewer.md` requires reading *"the sub-contract's **Inherited interface assignments** region"*.
Neither sub-contract identity nor its rows are derivable from a list of `FEAT` IDs — they are
reachable only through the parent `PACT`'s `Sub-contract` column
(`references/artifact-format.md` → *`PACT` ID resolution*, step 2). Both roles therefore **do**
traverse the contract tree; `leaves=` spares them only the *plan-set* walk.

This is precisely the failure shape the CR catalogued and this plan was written to close — *a
definition changed without sweeping the definition's consumers* — reintroduced by the remediation
for it. MF-8 swapped one false justifying sentence for another.

## Finding 3 — MF-4's adoption arithmetic does not close (BLOCKING for AC 4)

AC 4 requires that *"`g > c` is ordinary arithmetic"*. The **unit** work is genuinely done:
`references/config.md:176` declares task-equivalents ahead of every formula, the three conversions
sit at `:179–182` with their defaults, and `span` / `makespan` / `M_flat` / `M_nested` / gain / cost
are each restated in that unit. Nothing is left in prose quantities. That half is real, and
MF-5(a)'s shape-split is real too — `:194`/`:195` split concurrent-`A` from serialized-`k × J`,
`:200–205` encode it, and the cost side at `:232` charges `k × J` "never `J`". Correct.

But the two sides are computed from **different overhead accounts**, so the number the gate decides
on and the number the user is shown are not the same number.

| Defect | Where |
| ------ | ----- |
| `A` is charged **per candidate** on the cost side (`:231`) but **once for all `k`** in `M_nested` (`:194`, `:202` — "concurrent, so slowest-of-k"). The reciprocal of the `k × J` fix was never applied to `A`. | `:231` vs `:194`/`:202` |
| `A` is **charged twice** on the cost side: bullet 1 (the Step 2s pass) and bullet 4 (the round-trip Step 2s's barrier imposes) — while `M_nested` carries only two `A` terms (2c and 2s), no third. | `:231` and `:234` vs `:202` |
| **Interface points** are charged as cost (`:233`, 1 task-equivalent each) but appear **nowhere** in the `M_nested` formula. | `:233` vs `:200–205` |
| `makespan` is *defined* to include overhead (`:188`, "the overhead is never dropped from the number"), but the after-value at `:221` is a bare `max(…)` while `:225` calls the gain "the difference between the **makespan** before and after". Read literally, the gain nets out overhead that `:231–234` then charges again. | `:188` vs `:221`/`:225` |

**Failure scenario.** Lanes `{12, 6}`; split the 12-lane into `{6, 6}`; `k = 1`; defaults
`A = 2`, `J = 2`; no interface points.

- Side-by-side shown at 2p.5: `M_flat = 12 + A + J = 16`; `M_nested = max(6,6) + A + A + 1×J + J = 14`.
  → **the ladder tells the user nesting saves 2 task-equivalents.**
- Gate at 2p.3n: `gain = 12 − max(6, 6) = 4`; `cost = A + k×J + 0 + A = 6`.
  → `4 > 6` false → **`sub-split rejected: … gain 4 task-equivalents does not exceed cost 6`.**

The user is shown option 3 as the cheaper plan and simultaneously told every candidate lane was
rejected. The discrepancy is exactly `A` at `k = 1` and widens by a further `(k − 1) × A` for
`k ≥ 2`. Because AC 4 is specifically *"so `g > c` is ordinary arithmetic"*, and because
`M_nested` is what the ladder prints, this is in scope rather than a modelling nicety.

The greedy-termination text at `:242` sides with the *`M_nested`* account ("adds a further `J`",
silent on `A`) and so contradicts cost bullet `:231` — a second signal that `:231` is the stale side.

## Finding 4 — MF-7's outcome still has more than one owner (SHOULD FIX)

The two documents MF-7 names **do** now agree, and the wrong `Step 0c` cross-reference **is** gone
from `architect.md` (zero `0c` hits). `Step 2s.3` exists at `SKILL.md:700` and defines a real halt
path (`:702` "re-invoke … once; if still missing after the retry, stop and report") that an
architect refusal lands in, so `architect.md:162`'s "halts the run at Step 2s.3" is true. Good.

But `SKILL.md:489` claims the 2p.3n gate is the sole owner and the outcome "is decided **here and
nowhere else**", and three other statements survive:

1. `SKILL.md:340` (Step 0c) — "If a lane is left with fewer than 2 sub-lanes carrying work, it is
   simply not sub-split and runs flat."
2. `references/config.md:130` — the same sentence, mirrored.
3. `references/config.md:149` — **the sharp one**: *"A lane whose candidate sub-lanes cannot be
   given bounded, contained, mutually disjoint globs **is not sub-split** — the reason is printed
   and that lane **runs flat**."*

(1) and (2) are defensible as an earlier, different stage (0c builds the candidate set; 2p.3n
adopts) — but they falsify `:489`'s "nowhere else" as written, so either the sentence or the
statements need reconciling.

(3) is a genuine contradiction. It sits under `#### Owned-glob rejection`, whose own intro at
`:134` scopes the list to *"rejected at **contract-authoring time**"* — i.e. at the Step 2s
architect. In that framing `:149` says an architect that cannot bound sub-lane globs **degrades the
lane to flat**, which is verbatim the outcome `architect.md:162` forbids in bold ("it does **not**
degrade to flat") and `SKILL.md:491` calls unrecoverable. Per the plan's own Technical Notes,
`references/config.md` is the normative home — so the normative file currently states the opposite
of the two files MF-7 reconciled. The sweep reached `SKILL.md` and `architect.md` but not the
reference.

## Independent verification of the coder's two reported defects

Both confirmed, and the coder's diagnosis is correct in mechanism as well as in conclusion.

**(a) `awk '/2p\.3n/,/2p\.4/'` spans far more than one step — CONFIRMED.**
`2p.3n` occurs 6 times in `SKILL.md`, `2p.4` 4 times, so the range closes and re-opens.

| Range | Lines |
| ----- | ----- |
| `awk '/2p\.3n/,/2p\.4/'` | **765** |
| `awk '/^#### 2p\.3n /,/^#### 2p\.4 /'` | **34** |

The real step is `:470–503`. The coder measured ~746 pre-edit; 765 post-edit. Same finding.
The two sibling anchor corrections are also confirmed: there is **no** `### Step 6` heading (so
`/^### Step 5 /,/^### Step 6 /` ran 279 lines to EOF vs 175 anchored), and Step 0r is authored
`#### 0r — ` at `:282`, so the original `/^### Step 0r /` matched **no start line at all** and the
assertion was unsatisfiable. All three corrections **tighten**; none relaxes a claim.

**(b) `awk … | grep -q` returns 141 under `pipefail` — CONFIRMED, with a measured threshold.**

```bash
$ bash -c 'set -o pipefail; awk "NR>0" SKILL.md | grep -q "^---"; echo rc=$?'
rc=141
$ bash -c 'set -o pipefail; awk "NR>0" SKILL.md | grep   "^---" >/dev/null; echo rc=$?'
rc=0
```

With the match fixed at line 1 and the producer's total output varied:

| Producer output | `\| grep -q` | `\| grep … >/dev/null` |
| --- | --- | --- |
| 4 KB | 0 | 0 |
| 16 KB | 0 | — |
| 32 KB | 0 | — |
| 60 KB | **141** | — |
| 64 KB | **141** | 0 |
| 256 KB | **141** | 0 |

So the precise trigger is **producer output exceeding the pipe buffer while the consumer exits
early** — `grep -q` closes the read end, `awk` takes `SIGPIPE`, `pipefail` surfaces 141. The
rewrite is immune at every size. The coder's framing ("where the match lands in the buffer") is
right in spirit; the sharper statement is *"whether the producer's output exceeds the pipe buffer"*,
which is the property that silently changes as a document grows.

**(c) "The parent plan's gates still use `grep -q` in pipes and are green only by luck" — CONFIRMED,
with the mechanism made precise.** The parent plan has **24 piped assertions, all 24 using
`grep -q`** (P1×1, P3×17, P4×5 plus one `grep -qF`, P5×1). This plan rewrote **19 of its own** to
`| grep … >/dev/null` — the count in the coder's log is exact. They are green because every one of
the parent's `awk` ranges is small:

| Parent gate range | Bytes |
| ----------------- | ----- |
| `Step 2s → Step 2L` | 4,767 |
| `Step 3j → 3j.1` | 4,562 |
| `Pipeline overview → How to spawn` | 4,405 |
| `Step 3C → Step 3L` (architect.md) | 11,806 |

All are well under the ~32–64 KB threshold, so `awk` finishes writing into the buffer before
`grep -q` closes it. "Luck" is the right verdict but the exposure is **latent and monotonic**: it
flips the day a section grows past the buffer, and it flips on an edit that only *moves* text.
Given the parent plan's gates are now load-bearing for this plan's Phase 6 re-run rule, they should
get the same rewrite the FIX plan applied to its own.

## Test-Quality Audit

**Recorded amendments — verified genuine, not relaxations.** This was the primary question and the
answer is favourable. All five parent-plan amendments carry an inline comment naming
`CR-20260807T035907Z-25d5` and `FIX-20260807T040856Z-bf97`, plus a Progress Log entry in the parent
plan at `04:15:59Z` giving the reasoning per assertion. Assessed individually:

| Amended assertion | Direction |
| ----------------- | --------- |
| P3 §5 `grep -q 'parent'` → `grep -qF 'Mark the lane DONE in the *parent* contract'` | **Strengthened** (the old form was tautological). Single-asterisk correction verified — the CR's suggested double-asterisk literal does ship red. |
| P3 §6 req-53 wording → `grep -qi 'level-specific behavior only in a join step'` | **Lateral.** Both old and new are prose-presence checks; the new one matches the surviving normative rule at `SKILL.md:1264`. Not a relaxation. |
| P3 §7 duplicated precedence → one scoped body assertion + two conditional-opening assertions | **Strengthened.** Three claims where there were two, and it no longer requires the duplication the project's single-source convention forbids. |
| P4 §1 `grep -q 'Parent contract:'` → scoped preamble claim | **Strengthened.** The old assertion was green *because the routing was wrong* — the exact failure a gate exists to catch. |
| P5 §3 `! grep -q 'passes --resume'` → `grep -q 'PM passes no .--resume. flag'` | **Strengthened** (the old form was vacuous either way). |

**SIMPLIFY prose not reverted — verified directly, not via the (no-op) gate.** `#### 3j.4`: zero
hits. The precedence sentence appears **exactly once**, at `SKILL.md:840`, in Step 3j's body ahead
of 3j.1 (`:874`) and 3j.2 (`:891`); neither subsection fires unconditionally — both open "Reached
for the leaves Step 3j's classification routed here". The Rules-section statement of the authoring
rule is untouched at `:1264`. The reviewer's ruling was honoured.

**SIMPLIFY provenance recorded.** The `.progress.md` carries a real per-item table mapping MF-1/2/3/
6/7/8 to specific SIMPLIFY edits (#5/#3, #7, #6, #1, #12, #8) with the failure shape named. This is
substantive, not a checkbox.

**Weak assertions found (beyond Finding 1):**

| Assertion | Problem |
| --------- | ------- |
| `grep -q 'leaves=' "$K" && grep -qi 'parallel path' "$K"` (FIX P2 §2) | **Tautological.** Labelled *"omitted on an `off` run"*, it proves only that the file contains each string *somewhere*, unrelated to each other. It cannot detect an ungated `leaves=` line. The real gating claim is asserted nowhere. |
| `if grep -qF 'Mark the lane DONE in the' …; then` (FIX P1 §6), `if grep -q 'never an error' …; then` (FIX P3 §8) | **Conditionally vacuous** — if the optional item were skipped, the whole check silently disappears. Both branches are in fact taken here, so no live defect; the pattern is fragile. |
| `! grep -viE 'Never print a wall-clock ETA' "$C" \| grep -qiE …` (FIX P3 §7) | The harness note claims *"**Every** piped assertion in this plan's gates is … `\| grep PATTERN >/dev/null`"*. This one is not — it is the 20th. Harmless (small producer, and negated so it never fires), but the note overstates. |
| MF-8's `grep 'no role walks the contract tree'` (FIX P2 §3) | Prose-presence check over a sentence that is false — see Finding 2. Presence assertions cannot detect a claim that is internally contradicted; only a read-through can. |

**Assertions verified sound.** All 19 `>/dev/null` rewrites use valid, correctly-ordered `awk`
anchors (`0r@282 → 0c@320`; `Step 3b/4/5` ranges 2.7/5.2/10.8 KB); the `python3` canonical-default
check in parent P4 genuinely compares `config.template.json` to the parsed reference block; the
sweep assertions (`git diff --name-only HEAD -- scripts/ templates/html/` empty, cross-reference
`test -f`s) are all real and all pass.

## Verdict

**BELOW_FLOOR.**

Coverage is N/A and inapplicable (zero executable lines) — that is not the reason. The verification
floor is unmet: **3 of 11 gates are red once the harness defect in Finding 1 is corrected**, so the
plan's AC 10 ("all eleven gates exit 0 over the final tree") does not hold, and 14% of the
remediation's assertions cannot fail at all. Findings 2, 3 and 4 are substantive prose defects that
the gates — being presence checks — are structurally unable to detect, and each lands on an
acceptance criterion this plan claims complete (AC 8/MF-8, AC 4/MF-4, AC 7/MF-7).

The remediation's **core ruling was honoured**: the SIMPLIFY prose was not reverted, the amendments
are recorded with justification and are lateral-or-stronger in every case, and the two harness
defects the coder reported are real and correctly fixed within this plan's own gates.

For the reviewer:

- **Findings 1 and 2 are blocking.** Finding 1 because the plan's new Phase 6 rule — mandating a
  gate re-run after `simplify` — is worth only what the gate's ability to go red is worth, and
  1b/1c are unsatisfiable-by-construction assertions that will red the moment the harness is fixed.
  Finding 2 because MF-8's remedy reintroduced the exact defect class it was written to close.
- **Finding 3 is blocking against AC 4 as written** ("`g > c` is ordinary arithmetic"), with a
  reproducible input where the ladder and the gate contradict each other.
- **Finding 4 is should-fix**, but note the contradiction lives in the normative reference file,
  which this project's conventions make authoritative over the two files that were reconciled.
- Also worth a decision: the parent plan's 24 piped `grep -q` assertions were left un-rewritten
  while this plan rewrote its own 19. They are green today for reasons unrelated to their claims.
- `gate-scope.test.cjs` / `gate-shell-injection.test.cjs` remain pre-existing red at merge-base
  `974b01a`. Not re-litigated, not touched.
