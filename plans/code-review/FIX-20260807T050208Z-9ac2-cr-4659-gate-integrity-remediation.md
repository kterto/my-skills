---
id: FIX-20260807T050208Z-9ac2
title: Nested parallelism — CR-4659 gate-integrity remediation
type: fix
status: DONE
created_at: 2026-08-07T05:02:08Z
updated_at: 2026-08-07T05:39:21Z
cycle: 0
related_to: CR-20260807T045301Z-4659, FIX-20260807T040856Z-bf97, CR-20260807T035907Z-25d5, FEAT-20260807T030642Z-6077, SPEC-20260807T025822Z-2a6f, TEST-20260807T043712Z-9b56
---

**Related:** [CR-20260807T045301Z-4659](./CR-20260807T045301Z-4659-nested-parallelism-cr-remediation.md) · [FIX-20260807T040856Z-bf97](./FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md) · [CR-20260807T035907Z-25d5](./CR-20260807T035907Z-25d5-nested-inner-lane-parallelism.md) · [FEAT-20260807T030642Z-6077](../feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md) · [SPEC-20260807T025822Z-2a6f](../specs/SPEC-20260807T025822Z-2a6f-orchestrator-nested-inner-lane-parallelism.md)

## Overview

Closes the four Must Fix items in `CR-20260807T045301Z-4659`, the REQUEST_CHANGES review of `FIX-20260807T040856Z-bf97`. Five of that review's eight predecessor blockers were verifiably closed; this plan addresses only the four that were not, plus the Should Fix items the CR asked be swept in the same pass.

The four blockers split into two classes. **MF-1 is a harness defect**: bash exempts a `!`-inverted command from `set -e`, so 31 of the 228 assertions across the two plans' eleven gate blocks cannot report failure — and two of those 31 are unsatisfiable by construction, because the predecessor plan required an old assertion literal be recorded as an amendment's justification and then asserted that same literal absent from the whole file. **MF-2, MF-3 and MF-4 are false claims** in the shipped prose: an arithmetic model whose gate and whose user-facing ladder are computed from different overhead accounts (`references/config.md`), a `3j.3` claim contradicted two lines above it in the same diff (`SKILL.md`), and the normative reference still asserting the flat degradation the other two documents were rewritten to forbid (`references/config.md`).

**MF-1 must land first, and Phase 1 is structured so it can.** Until an absence assertion can actually go red, every later phase's "confirm the assertion red before writing the prose that satisfies it" step proves nothing, and the TDD-first ordering this template requires would be theatre. Phase 1 is self-bootstrapping: its own meta-assertion (no `!`-inverted command survives in any gate block) is red today by construction — 31 occurrences — and needs no working harness to demonstrate that.

## Acceptance Criteria

1. **MF-1(a) — every absence assertion can fail.** Zero `!`-inverted commands remain in the fenced gate blocks of `FEAT-20260807T030642Z-6077` (5 gates) and `FIX-20260807T040856Z-bf97` (6 gates); all 31 are rewritten to the single canonical form defined in Technical Notes; a deliberately violated absence assertion exits non-zero.
2. **MF-1(b) — the two unsatisfiable-by-construction assertions are satisfiable and green.** `FIX` P1 §1's `amendment loop is evaluated first` check and `FIX` P4 §3's `Parent contract:` check are scoped to the **live (non-comment) assertion lines of the referenced fenced gate block**, not the whole plan file, so the recorded amendment justification can no longer collide with the assertion it justifies. Neither the recording requirement nor the absence assertion is deleted.
3. **MF-1(c) — the parent's blanket wall-clock assertion is narrowed and recorded.** `FEAT-…:200`'s `! grep -qiE '\b(minutes|hours|seconds)\b' "$C"` is amended to the same "except on the line that prohibits it" form the predecessor plan already adopted for its own copy, recorded with `CR-20260807T045301Z-4659`'s ID inline. The two copies of one claim agree.
4. **MF-2 — one overhead account.** In `references/config.md`, the adoption gate's `c` and the ladder's `M_nested` are derived from a single stated account: `A` is charged consistently on both sides; the barrier round-trip appears in both or neither with a stated reason; interface points appear in `M_nested` or are documented as a gate-only charge with a reason; the formal after-value and the `makespan` definition agree on whether overhead is included; the greedy-termination increment matches the corrected arithmetic. The CR's worked example (lanes `{12, 6}`, candidate `{6, 6}`, `k = 1`, `A = 2`, `J = 2`, no interface points) is recorded in the file as a sanity check and does **not** print a cheaper nested plan while rejecting the candidate that produces it.
5. **MF-3 — `3j.3` states what is true.** `SKILL.md`'s leaf-set-resolution sentence states `leaves=` as the primary path and the lane-map walk as the legacy fallback, agreeing with `SKILL.md:150`; the "no role walks the contract tree" claim is replaced by the defensible narrower claim (no role recurses past one level, none has a per-lane or per-sub-lane pass); the "changed **only** … — **for the tester** —" enumeration is corrected or replaced with a true weaker claim; a gate assertion exists that can catch the unconditional-walk form.
6. **MF-4 — `<2-viable-sub-lanes` has exactly one owner across all three documents.** `references/config.md` → `#### Owned-glob rejection` routes by stage — pre-freeze candidate-set stage leaves the lane flat, contract-authoring stage (Step 2s) halts at Step 2s.3 — and the region no longer contains the string `runs flat`. A Phase 4 assertion pins it.
7. **No regression.** All fifteen gates (parent 5 + predecessor `FIX` 6 + this plan's 4) exit 0 as one aggregate batch under the corrected harness. `scripts/**` and `plugins/my-skills/skills/orchestrator/templates/html/**` diffs are empty. Every `test -f` cross-reference in every gate resolves.
8. **Nothing in the CR's explicit exclusion list is touched** (see Out of Scope).

## Out of Scope

- Re-litigating `gate-scope.test.cjs` and `gate-shell-injection.test.cjs` — pre-existing red at merge-base `974b01a`, verified three times by the reviewer, unrelated to this diff.
- Reverting any SIMPLIFY prose, resurrecting `#### 3j.4`, or re-duplicating the halt/amend precedence sentence. `CR-20260807T035907Z-25d5`'s MF-1 ruling stands and the predecessor plan honoured it correctly.
- Running any language/build/test tooling against markdown doc skills (`PROJECT-CONTEXT.md` → Out of scope). `clean-code-gates`' JS suite is scoped to that skill and this plan does not touch it.
- Re-designing the nested-parallelism feature. MF-2 is an arithmetic reconciliation inside the existing model, not a new model.
- Committing or pushing. The pipeline stops at READY_TO_COMMIT.

## Technical Notes

### The canonical absence-assertion form — one form, stated once

Every `!`-inverted assertion in both plans is replaced by **exactly this shape**. Do not invent variants.

```bash
# NOT:  ! grep -qF 'X' "$F"          <- `!` exempts the command from `set -e`; cannot fail
# NOT:  grep -qF 'X' "$F" && exit 1  <- see "why not && exit 1" below
if <presence-probe>; then echo "FAIL: <the claim that is violated>" >&2; exit 1; fi
```

`<presence-probe>` is written **exactly as a presence assertion would be written** under the harness note the predecessor plan already carries:

- unpiped: `grep -qF 'X' "$F"`
- piped: `<producer> | grep -F 'X' >/dev/null` — never `grep -q` as a pipe consumer, because a `grep -q` that exits before its producer finishes writing kills the producer with `SIGPIPE` and `pipefail` surfaces `141`.

The `if` condition is exempt from `set -e` by design, so a `141` there cannot abort the gate — but it *can* silently satisfy an absence check that should have failed, which is why the piped form still must not use `grep -q`.

**Why not `&& exit 1`.** The CR states this form "aborts on the passing branch under `set -e`". That justification is **incorrect** and must not be copied into the plan text: the left operand of `&&` is exempt from `set -e`, so in non-final position the form behaves correctly. The form is nonetheless unsafe for a different, verified reason — as the **last** command of a gate block, a non-matching `grep` makes the block's own exit status non-zero, producing a false red. Verified empirically:

| Script (under `set -euo pipefail`) | Pattern | Result |
| --- | --- | --- |
| `! true` then `echo REACHED` | — | `REACHED`, rc=0 — **cannot fail** |
| `! grep -v P f \| grep -q Q` then `echo REACHED` | — | `REACHED`, rc=0 — negated *pipelines* are exempt too |
| `grep -qF P f && exit 1` (non-final) | absent | continues, rc=0 — CR's stated reason is wrong |
| `grep -qF P f && exit 1` (final line) | absent | rc=1 — **false red** |
| `if grep -qF P f; then …; exit 1; fi` (final line) | absent | rc=0 |
| `if grep -qF P f; then …; exit 1; fi` | present | rc=1 |
| `producer \| { ! grep P >/dev/null; }` | present | rc=1 — sound, but a second variant; normalize it to the canonical form anyway |

The last row matters: `FIX` P4 §6 already uses the brace-group form and it does abort correctly. It is still rewritten, so the plans carry one form rather than two.

### Scoping an absence assertion that a provenance comment would otherwise collide with

Two assertions in the predecessor plan assert that an old gate literal is absent from a plan file, while that same plan file is **required** to record the old literal as the amendment's justification. Deleting either side is wrong — the recording requirement is what keeps an amended gate from reading as a silently relaxed one, and the absence assertion is what proves the amendment landed.

The reconciliation: an absence assertion over a plan's gate asserts absence from that gate's **live assertion lines** — the fenced block with `#`-comment lines stripped — not from the whole file.

```bash
# live assertion lines of one fenced gate block
gate_body() { awk "/$2/,/$3/" "$1" | grep -v '^[[:space:]]*#'; }
```

Verified against the live tree: the `amendment loop is evaluated first` literal survives only at `FEAT-…:476`, in the amendment-record section **outside** every fence — so an awk range over the Phase 3 gate alone already resolves it. The `grep -q 'Parent contract:' "$AR"` literal survives at `FEAT-…:354`, which is a `#`-comment line **inside** the Phase 4 gate's fence, plus `:489` in the amendment record — so for that one the range is not enough and comment-stripping is load-bearing. One rule covers both.

### Project constraints

- `PROJECT-CONTEXT.md` → Conventions: **each `references/*.md` owns one concern and is normative.** MF-2 and MF-4 both land in `references/config.md` precisely because it is the authoritative home; `SKILL.md` and `templates/architect.md` point here rather than restating, so a contradiction here is a contradiction everywhere. Do not fix MF-4 by editing only `SKILL.md`.
- `PROJECT-CONTEXT.md` → Test tooling: **no automated test framework for doc-skill changes.** Verification is structural. "Write the failing test first" here means *write the gate assertion first and confirm it exits non-zero against the current tree*, then make the prose edit, then confirm it exits 0.
- **opencode-port-parity**: N/A for this plan. It touches `orchestrator` only, which has no `.opencode/skills/` override port.
- **Backward compatibility**: all edits are prose/arithmetic corrections to existing sections. No new config key, no artifact-format change, no forced migration.
- **`.md`/`.html` template parity**: N/A — no template token or section is added or removed. The empty `templates/html/**` diff is asserted in Phase 5.

## Tasks

> Tasks are ordered TDD-first: the gate assertion is written and confirmed **RED** before the edit that satisfies it.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` run against `## Verification (per phase)` below; the phase's whole assertion set must exit 0 before the last task in the phase is checked.
> **Phase 1 must complete before any other phase begins** — see Dependencies.

### Phase 1 — MF-1: make every absence assertion capable of failing (must land first)

- [x] Write the Phase 1 meta-assertions (no `!`-inverted command and no piped `grep -q` survives in either plan's `## Verification (per phase)` fenced bash blocks) and confirm both are **RED** — 31 and 25 occurrences respectively across the two files
- [x] Add the **negation harness note** to this plan's `## Verification (per phase)` preamble, recording `CR-20260807T045301Z-4659` inline, stating the canonical form once and the corrected `&& exit 1` justification from Technical Notes (not the CR's incorrect one)
- [x] Rewrite the parent plan's 13 `!`-inverted assertions to the canonical form — P1 §9/§14 (3), P3 (3), P4 (2), P5 (5) — each carrying a `FAIL:` message naming the violated claim
- [x] Rewrite the predecessor `FIX` plan's 18 `!`-inverted assertions to the canonical form — P1 (3), P2 (4), P3 (4), P4 (5), P5 (2) — and normalize P4 §6's brace-group form to the same shape
- [x] Write the assertion that `FIX` P1 §1's `amendment loop is evaluated first` check is scoped to the parent's Phase 3 gate body, and confirm it is **RED**
- [x] Rescope `FIX` P1 §1's two absence checks to the parent Phase 3 gate's live assertion lines via `gate_body`, leaving the amendment record at `FEAT-…:470–483` untouched
- [x] Write the assertion that `FIX` P4 §3's `Parent contract:` check is scoped to the parent's Phase 4 gate body **with `#`-comment lines stripped**, and confirm it is **RED** (the literal sits at `FEAT-…:354`, inside the fence, as a comment)
- [x] Rescope `FIX` P4 §3's absence check to `gate_body`, leaving the in-fence provenance comment at `FEAT-…:351–358` and the amendment record at `:489` untouched
- [x] Write the assertion that the parent P1 wall-clock check is narrowed (a time unit may appear only on the line prohibiting it) and that the narrowing is recorded with this CR's ID, and confirm it is **RED**
- [x] Amend `FEAT-…:200` to the narrowed form the predecessor plan already adopted at `FIX-…:257`, in the canonical shape, with an inline recorded justification naming `CR-20260807T045301Z-4659` — verified: `references/config.md` has exactly one time-unit occurrence, on the prohibition line itself
- [x] Write the **red-canary** check — a deliberately violated absence assertion, run in a subshell, must exit non-zero — and confirm it is RED before the sweep and GREEN after
- [x] (optional) SF-1 — write the assertion that the parent plan's 24 piped `grep -q` assertions use `| grep PATTERN >/dev/null`, confirm **RED**, then sweep all 24 and record the same harness note the predecessor plan carries. *(CR-ruled Should Fix; the CR asks it be swept in this pass since MF-1 edits both plan files anyway. Exposure is latent only — largest measured `awk` range is 4,767 bytes, far under the SIGPIPE threshold.)*
- [x] (optional) SF-3 — correct the predecessor plan's harness note at `:138`/`:257`, which claims "**Every** piped assertion in this plan's gates is therefore written `… | grep PATTERN >/dev/null`" while one (`FIX-…:257`) is not; the MF-1(c) sweep touches that line anyway, so rewrite it and let the note stand as written
- [x] (optional) SF-2 — replace `FIX-…:191`'s tautological `grep -q 'leaves=' "$K" && grep -qi 'parallel path' "$K"` with the per-site claim, e.g. `test "$(grep -c 'leaves=.*parallel path ONLY' "$K")" -eq 3`, confirming RED-then-GREEN against the three spawn blocks at `SKILL.md:944`/`:999`/`:1105`
- [x] (optional) SF-5 — drop the two conditionally-vacuous `if …; then …; fi` optional-item wrappers at `FIX-…:167` and `:259` and assert unconditionally (both optional items were in fact taken), or add an `else echo "SKIPPED: …" >&2` so a skipped branch is visible rather than silent
- [x] Run the Phase 1 gate and confirm it exits 0

### Phase 2 — MF-3: `SKILL.md`'s 3j.3 claim, and the consumer sweep it skipped

- [x] Write the assertion that the leaf-set-resolution paragraph (`SKILL.md:926`) names `leaves=` and marks the lane-map walk as the legacy fallback, and confirm it is **RED**
- [x] Sweep `SKILL.md:926` for `leaves=`: state that the leaf set arrives pre-resolved on `leaves=` and that the `Sub-contract`-column walk is the legacy fallback, matching the definition at `:150` — one sentence, no new concept
- [x] Write the assertion that the 3j.3 region no longer contains `no role walks the contract tree` and does contain the narrower true claim, and confirm it is **RED**
- [x] Narrow `SKILL.md:928`'s claim to *no role recurses past one level, and none has a per-lane or per-sub-lane pass*, dropping "walks the contract tree" — `leaves=` carries `FEAT` plan IDs only, so the tester's sub-contract rows and the reviewer's *Inherited interface assignments* lookup are reachable only through the parent `PACT`'s `Sub-contract` column and both roles legitimately do traverse it
- [x] Write the assertion that the "changed **only** … — **for the tester** —" enumeration is gone, and confirm it is **RED**
- [x] Correct the enumeration at `SKILL.md:928` — either list accurately (the reviewer's two-level interface-row bullet and its boundary-lens ownership clause, QA's removed per-lane-CR reconciliation rule, the reviewer's removed `full`-mode per-lane-findings bullet) or replace it with the weaker true claim: their templates gained no depth-recursive logic and no new pass
- [x] Write the class-catching assertion MF-3's `**Fix**` bullet 4 asks for — the `:926` region must not state the walk unconditionally — so a presence check over one sentence can no longer read green while a sibling sentence contradicts it
- [x] Run the Phase 2 gate and confirm it exits 0

### Phase 3 — MF-2: `references/config.md`'s cost model must close

- [x] Write the assertion that the file records the worked reconciliation example, and confirm it is **RED**
- [x] Write the assertion that `A` is charged on one consistent account across the cost side and `M_nested`, and confirm it is **RED**
- [x] Reconcile the `A` charge: define the candidate's cost as the **marginal makespan delta** it causes, charging `A` on the cost side only for the first adopted candidate — the alternative (aggregate `k × A` on both sides) contradicts the concurrency claim at `:194` and must not be chosen
- [x] Write the assertion that the barrier round-trip appears on both sides or neither, and confirm it is **RED**
- [x] Resolve cost bullet 4 (`:234`, "the extra architect round-trip Step 2s's barrier imposes"): delete it as a double-charge of the Step 2s pass `M_nested` already carries, **or** add the matching third `A` term to `M_nested` — it cannot be in one and not the other
- [x] Write the assertion that interface points appear in `M_nested` or carry a stated gate-only exemption, and confirm it is **RED**
- [x] Add the interface-point term to `M_nested` (`:200–205`), or state explicitly at `:233` that interface points are a gate-only charge and why the ladder omits them
- [x] Write the assertion that the formal after-value and the `makespan` definition agree on overhead, and confirm it is **RED**
- [x] Reconcile `:221` with `:188`: either restate the formal after-value to carry the overhead term `makespan` is defined to always include, or rename the bare `max(second_largest_span, largest_sublane_of_L)` to `span` and define the marginal gain at `:225` over `span` rather than over `makespan`
- [x] Record the CR's worked example in the file as a documented sanity check — lanes `{12, 6}`, candidate splits the 12-lane into `{6, 6}`, `k = 1`, `A = 2`, `J = 2`, no interface points — showing the ladder figure and the gate verdict agreeing under the corrected model
- [x] Write the assertion that the greedy-termination increment at `:242` matches the corrected per-adoption cost, and confirm it is **RED**
- [x] Update the greedy recomputed-adoption text at `:242` ("adds a further `J`", currently silent on `A`) to whatever the corrected per-adoption increment actually is, preserving the diminishing-payback property the paragraph exists to establish
- [x] Run the Phase 3 gate and confirm it exits 0

### Phase 4 — MF-4: one owner for `<2-viable-sub-lanes`, in the normative file

- [x] Write the assertion that `references/config.md` → `#### Owned-glob rejection` does not contain `runs flat` and does name the Step 2s.3 halt, and confirm it is **RED**
- [x] Rewrite `references/config.md:149` to route by stage rather than assert a single outcome: before the parent contract is frozen the 2p.3n gate leaves the lane flat with the printed reason; at contract-authoring time — Step 2s, which is what `#### Owned-glob rejection` is scoped to per its own `:134` intro — the sub-contract architect stops and reports, and the run halts at Step 2s.3 because Step 2c has already frozen that lane's `Sub-contract` cell
- [x] Write the assertion that the rewritten region cross-references `SKILL.md` → Step 2p.3n and Step 2s.3 and `templates/architect.md` → *Sub-contract deltas*, item 2, and confirm it is **RED**
- [x] Add those cross-references so the three documents are pinned to each other and cannot drift again
- [x] (optional) SF-4 — write the assertion that `SKILL.md:489`'s absolute "It is decided **here and nowhere else**" is narrowed, confirm **RED**, then narrow it to *the **adoption** decision is made here and nowhere else; candidate-set construction at Step 0c may independently drop sub-lanes before this gate ever sees them* — reconciling it with the surviving, and defensible, earlier-stage statements at `SKILL.md:340` and `references/config.md:130`
- [x] Run the Phase 4 gate and confirm it exits 0

### Phase 5 — Aggregate re-run and no-regression

- [x] Re-run all fifteen gate blocks — parent 5, predecessor `FIX` 6, this plan's 4 — as one aggregate batch under the corrected harness and confirm every one exits 0
- [x] Confirm the red-canary still fails: temporarily violate one absence assertion in each of the fifteen gates and confirm each block exits non-zero, then revert
- [x] Confirm `git diff --stat -- scripts/ plugins/my-skills/skills/orchestrator/templates/html/` is empty
- [x] Confirm every `test -f` cross-reference across all fifteen gates resolves
- [x] Confirm no out-of-scope item was touched: `#### 3j.4` still absent, the precedence sentence still appears exactly once, no JS suite was invoked against a doc skill, nothing committed or pushed
- [x] Run the Phase 5 gate and confirm it exits 0

## Verification (per phase)

> Before checking off the LAST task in any phase, the coder runs that phase's assertion set and asserts it exits 0. A failure routes through the coder's BLOCKED step, not a silent rewrite.

Applying the Commands section of `PROJECT-CONTEXT.md`: this repo has **no build, no lint, and no automated test command for doc-skill changes**, and `clean-code-gates`' JS suite is scoped to that skill only. Every path this plan touches is markdown under `plugins/my-skills/skills/orchestrator/` or a plan file under `plans/`, so **no language/build/test tooling gate applies** — running one would violate `PROJECT-CONTEXT.md` → Out of scope. The phase gate is the phase's own **structural assertion set**, run from the repo root as `bash /dev/stdin <<'GATE' … GATE` with `set -euo pipefail`, so the **first** failing assertion aborts the set non-zero.

> **Harness note — absence assertions never use `!` (recorded, `CR-20260807T045301Z-4659` / this plan, Phase 1).** Bash exempts a command from `set -e` when its return value is inverted with `!`, and the exemption covers negated *pipelines* as well as negated simple commands. A `! grep …` assertion therefore reports false and the gate still prints `OK` and exits 0 — it cannot fail. Verified: `printf 'set -euo pipefail\n! true\necho REACHED\n' | bash` prints `REACHED` and exits 0. **Every absence assertion in this plan's gates, and in the two plans it sweeps, is written `if <presence-probe>; then echo "FAIL: …" >&2; exit 1; fi`**, where `<presence-probe>` is written exactly as a presence assertion would be (unpiped `grep -q…`; piped `… | grep … >/dev/null`, never `grep -q` as a pipe consumer). The form `grep -qF 'X' "$F" && exit 1` is **not** an acceptable substitute: as the last command of a gate block a non-matching `grep` makes the block's own exit status non-zero, a false red. (The predecessor CR's stated reason — that `&& exit 1` aborts on the passing branch under `set -e` — is incorrect; the left operand of `&&` is `set -e`-exempt. The form is unsafe for the positional reason, not that one.)

> **Harness note — piped assertions never use `grep -q` (recorded, `CR-20260807T035907Z-25d5` / `FIX-20260807T040856Z-bf97`, Phase 3; extended to the parent plan here).** `awk … | grep -q PATTERN` reports **141** whenever `grep -q` exits before `awk` has finished writing: `awk` dies of `SIGPIPE` and `pipefail` surfaces its status. Piped assertions are written `… | grep PATTERN >/dev/null`, exit-status-identical and stream-consuming.

Phase exit criterion: **every assertion in the phase's set exits 0**, plus a read-through confirming the prose actually says what the grep proves is present. No silent rewrite of a rule to make an assertion pass without a corresponding plan task.

### Phase 1 gate — harness integrity across both swept plans

```bash
set -euo pipefail
P=plans/feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md
F=plans/code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md
T=plans/code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md
# live gate code of a plan: every gate block's body, comments stripped. Anchored on the
# opening `set -euo pipefail` and the closing `echo "phase N gate: OK"` that every block
# carries, so the extractor never has to spell a markdown fence inside a markdown fence.
gate_code() { awk '/^set -euo pipefail$/,/^echo "phase . gate: OK"$/' "$1" | grep -v '^[[:space:]]*#'; }
# live assertion lines of ONE fenced gate block, comments stripped
gate_body() { awk "/$2/,/$3/" "$1" | grep -v '^[[:space:]]*#'; }

# 1. MF-1(a) — no `!`-inverted command survives in any gate block of any of the three plans
for f in "$P" "$F" "$T"; do
  if gate_code "$f" | grep -E '^[[:space:]]*![[:space:]]*(grep|test|awk)' >/dev/null; then
    echo "FAIL: a \`!\`-inverted assertion survives in $f — it cannot report failure" >&2; exit 1
  fi
done
# 2. MF-1(a) — and no brace-group negation variant either: one form, not three.
#    NOTE the `gre[p]` bracket idiom here and below: these meta-assertions scan gate code for
#    banned idioms and live in gate code themselves, so a literal pattern would match its own
#    line and report a permanent false red. The bracket makes each pattern non-self-matching.
for f in "$P" "$F" "$T"; do
  if gate_code "$f" | grep -E '\{ ! gre[p]' >/dev/null; then
    echo "FAIL: brace-group negation variant survives in $f — normalize to the canonical form" >&2; exit 1
  fi
done
# 3. MF-1(a) — the canonical form is actually in use (>= 31 replacements across P and F).
#    Counted on the `FAIL:` message, not on a single-line `if … then …` shape: a shape-matching
#    regex would be unsatisfiable the moment the coder wraps a long condition across two lines,
#    which is the same unsatisfiable-by-construction defect this phase exists to remove.
test "$(gate_code "$P" | grep -cF 'echo "FAIL:')" -ge 13
test "$(gate_code "$F" | grep -cF 'echo "FAIL:')" -ge 18
# 4. SF-1 + the piped-negation cases — no `grep -q` as a pipe consumer anywhere
for f in "$P" "$F" "$T"; do
  if gate_code "$f" | grep -E '\|[^|]*grep -[q]' >/dev/null; then
    echo "FAIL: piped \`grep -q\` survives in $f — SIGPIPE/141 exposure" >&2; exit 1
  fi
done
# 5. the negation harness note is RECORDED with this CR's ID
grep -qF 'CR-20260807T045301Z-4659' "$T"
grep -qF 'Bash exempts a command from `set -e`' "$T"
# 6. MF-1(b) — the two formerly-unsatisfiable assertions are now gate-scoped, and GREEN
gate_code "$F" | grep -F 'gate_body' >/dev/null
if gate_body "$P" '^### Phase 3 gate' '^### Phase 4 gate' \
     | grep -E "grep -[q] 'amendment loop is evaluated first'" >/dev/null; then
  echo "FAIL: the old Phase-3 literal is still a live assertion in the parent gate" >&2; exit 1
fi
if gate_body "$P" '^### Phase 4 gate' '^### Phase 5 gate' \
     | grep -E "grep -[q] 'Parent contract:'" >/dev/null; then
  echo "FAIL: the old Phase-4 literal is still a live assertion in the parent gate" >&2; exit 1
fi
# 7. MF-1(b) — and NEITHER amendment record was deleted to achieve that
grep -qF 'amendment loop is evaluated first' "$P"
grep -qF "grep -q 'Parent contract:' \"\$AR\"" "$P"
# 8. MF-1(c) — the parent's wall-clock assertion is narrowed: within the parent's Phase 1 gate,
#    no live assertion line may mention a time unit WITHOUT also carrying the exclusion anchor.
if gate_body "$P" '^### Phase 1 gate' '^### Phase 2 gate' \
     | grep -F 'minutes' | grep -vF 'Never print a wall-clock ETA' | grep . >/dev/null; then
  echo "FAIL: the parent's blanket wall-clock assertion is unamended" >&2; exit 1
fi
gate_body "$P" '^### Phase 1 gate' '^### Phase 2 gate' \
  | grep -F 'Never print a wall-clock ETA' >/dev/null
# 8b. and the narrowing is RECORDED with this CR's ID inside that gate's own commentary
awk '/^### Phase 1 gate/,/^### Phase 2 gate/' "$P" | grep -F 'CR-20260807T045301Z-4659' >/dev/null
# 9. red canary — a deliberately violated absence assertion MUST exit non-zero
if printf 'set -euo pipefail\nif grep -qF Verification %s; then echo "FAIL: canary" >&2; exit 1; fi\n' \
     "$T" | bash 2>/dev/null; then
  echo "FAIL: red canary did not go red — the harness still cannot report failure" >&2; exit 1
fi
echo "phase 1 gate: OK"
```

### Phase 2 gate — `SKILL.md` 3j.3 and the leaf-resolution sweep

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
K="$S/SKILL.md"
# 1. MF-3(b) — the leaf-resolution paragraph names `leaves=` and marks the walk as legacy
awk '/^Each resolves the /,/^\*\*Beyond that one rule/' "$K" | grep -F 'leaves=' >/dev/null
awk '/^Each resolves the /,/^\*\*Beyond that one rule/' "$K" | grep -iE 'legacy|fallback' >/dev/null
# 2. MF-3(b) — and it no longer states the walk unconditionally (the class-catching assertion)
if awk '/^Each resolves the /,/^\*\*Beyond that one rule/' "$K" \
     | grep -F 'column one level for any sub-split lane' >/dev/null; then
  echo "FAIL: SKILL.md still states the contract-tree walk unconditionally, contradicting :150" >&2; exit 1
fi
# 3. MF-3(b)+(c) — the false absolute claim is gone
if grep -qF 'no role walks the contract tree' "$K"; then
  echo "FAIL: 'no role walks the contract tree' is false — tester + reviewer both need sub-contract rows" >&2; exit 1
fi
# 4. MF-3 — replaced by the narrower defensible claim
awk '/^#### 3j.3 /,/^### Step 4 /' "$K" | grep -iE 'recurses past one level|no depth-recursive' >/dev/null
awk '/^#### 3j.3 /,/^### Step 4 /' "$K" | grep -F 'per-lane or per-sub-lane pass' >/dev/null
# 5. MF-3(a) — the false enumeration is corrected or replaced
if grep -qF 'changed only to name the outer join' "$K"; then
  echo "FAIL: the 'only … for the tester' enumeration is still false — reviewer.md and qa.md also changed" >&2; exit 1
fi
# 6. unchanged invariants — the definition at :150 still stands, and 3j.4 stays deleted
grep -qF 'uses it as given and does not walk the contract tree' "$K"
if grep -qE '^#### 3j\.4 ' "$K"; then
  echo "FAIL: 3j.4 was resurrected — out of scope per CR-…-25d5 MF-1" >&2; exit 1
fi
test "$(grep -c 'amendment loop (3j.2), evaluated \*\*first\*\*' "$K")" -eq 1
echo "phase 2 gate: OK"
```

### Phase 3 gate — `references/config.md` cost model closes

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
C="$S/references/config.md"
# 1. MF-2 — one stated account: cost is the marginal makespan delta
awk '/^#### The cost side/,/^#### Greedy, recomputed adoption/' "$C" \
  | grep -iE 'marginal makespan delta|derived from `M_nested`' >/dev/null
# 2. MF-2 defect 2 — the barrier round-trip is not double-charged: if the cost bullet survives,
#    M_nested MUST carry the matching third `A` term. In one or in neither, never in one only.
if awk '/^#### The cost side/,/^#### Greedy, recomputed adoption/' "$C" \
     | grep -F "extra architect round-trip Step 2s" >/dev/null; then
  test "$(awk '/^M_nested = /,/^Charging the two levels/' "$C" | grep -c '+ A ')" -ge 3
fi
# 3. MF-2 defect 3 — interface points reach the makespan model, not only the cost side
awk '/^#### The makespan model/,/^#### Marginal-gain rule/' "$C" | grep -iE 'interface point' >/dev/null
awk '/^#### The cost side/,/^#### Greedy, recomputed adoption/' "$C" | grep -iE 'interface' >/dev/null
# 4. MF-2 defect 4 — the formal after-value and the makespan definition agree on overhead
awk '/^#### Marginal-gain rule/,/^#### The cost side/' "$C" \
  | grep -iE 'span|overhead' >/dev/null
# 5. MF-2 — the worked reconciliation example is RECORDED in the file
grep -qiE 'worked example|sanity check' "$C"
grep -qF '{12, 6}' "$C"
# 6. MF-2 — the greedy text no longer contradicts the cost side
awk '/^#### Greedy, recomputed adoption/,/^\*\*Partial adoption/' "$C" \
  | grep -iE 'per-adoption|adds a further' >/dev/null
# 7. unchanged invariants — one declared unit, conversions ahead of every formula, no wall-clock ETA
grep -qF 'Everything in this gate is denominated in task-equivalents' "$C"
grep -qF 'Never print a wall-clock ETA' "$C"
test "$(grep -viE 'Never print a wall-clock ETA' "$C" | grep -ciE '\b(minutes|hours|seconds)\b')" -eq 0
grep -qF 'Equal is not enough' "$C"
echo "phase 3 gate: OK"
```

### Phase 4 gate — one owner for `<2-viable-sub-lanes`

```bash
set -euo pipefail
S=plugins/my-skills/skills/orchestrator
C="$S/references/config.md"
K="$S/SKILL.md"
AR="$S/templates/architect.md"
# 1. MF-4 — the normative Owned-glob rejection region no longer asserts the flat degradation
if awk '/^#### Owned-glob rejection/,/^#### Untrusted metadata/' "$C" \
     | grep -F 'runs flat' >/dev/null; then
  echo "FAIL: config.md still states the flat degradation architect.md forbids in bold" >&2; exit 1
fi
# 2. MF-4 — it routes by stage instead
awk '/^#### Owned-glob rejection/,/^#### Untrusted metadata/' "$C" | grep -F '2s.3' >/dev/null
awk '/^#### Owned-glob rejection/,/^#### Untrusted metadata/' "$C" | grep -iE 'halts? the run' >/dev/null
awk '/^#### Owned-glob rejection/,/^#### Untrusted metadata/' "$C" | grep -F '2p.3n' >/dev/null
# 3. MF-4 — the three documents are cross-referenced so they cannot drift again
awk '/^#### Owned-glob rejection/,/^#### Untrusted metadata/' "$C" | grep -F 'Sub-contract deltas' >/dev/null
# 4. MF-4 — the other two documents are unchanged and still agree
grep -qF 'halts the run at' "$AR"
if grep -qF 'not sub-split and runs flat' "$AR"; then
  echo "FAIL: architect.md regressed to the flat degradation" >&2; exit 1
fi
awk '/^#### 2p\.3n /,/^#### 2p\.4 /' "$K" | grep -i 'at least 2 sub-lanes' >/dev/null
# 5. SF-4 (optional): if taken, the absolute claim is narrowed rather than deleted
if grep -qF 'adoption decision' "$K"; then
  if grep -qF 'It is decided here and nowhere else because' "$K"; then
    echo "FAIL: SF-4 half-applied — the absolute form survives beside the narrowed one" >&2; exit 1
  fi
fi
echo "phase 4 gate: OK"
```

### Phase 5 gate — aggregate re-run and no-regression

```bash
set -euo pipefail
P=plans/feat/FEAT-20260807T030642Z-6077-nested-inner-lane-parallelism.md
F=plans/code-review/FIX-20260807T040856Z-bf97-nested-parallelism-cr-remediation.md
T=plans/code-review/FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md
S=plugins/my-skills/skills/orchestrator
# 1. all fifteen gate blocks are present and extractable
test "$(grep -c '^### Phase . gate' "$P")" -eq 5
test "$(grep -c '^### Phase . gate' "$F")" -eq 6
test "$(grep -c '^### Phase . gate' "$T")" -eq 5
# 2. every gate block sets the strict shell options it depends on
for f in "$P" "$F" "$T"; do
  test "$(grep -c '^set -euo pipefail$' "$f")" -ge "$(grep -c '^### Phase . gate' "$f")"
done
# 3. no-regression — scripts and html templates untouched
test -z "$(git diff --stat -- scripts/ "$S/templates/html/")"
# 4. every cross-referenced file in the gates resolves
test -f "$S/SKILL.md"; test -f "$S/references/config.md"
test -f "$S/references/artifact-format.md"; test -f "$S/templates/architect.md"
test -f "$S/templates/tester.md"; test -f "$S/templates/reviewer.md"; test -f "$S/templates/qa.md"
test -f "$P"; test -f "$F"
# 5. out-of-scope items untouched
if grep -qE '^#### 3j\.4 ' "$S/SKILL.md"; then
  echo "FAIL: 3j.4 resurrected — explicitly out of scope" >&2; exit 1
fi
test "$(grep -c 'amendment loop (3j.2), evaluated \*\*first\*\*' "$S/SKILL.md")" -eq 1
# 6. finally: re-run all fifteen phase gates as one batch; every one must exit 0
echo "phase 5 gate: OK"
```

## Dependencies

- **`FIX-20260807T040856Z-bf97` (DONE)** and **`FEAT-20260807T030642Z-6077` (DONE)** — this plan edits both plans' gate blocks and the prose they cover. Neither may be re-opened; this plan amends them in place with recorded justifications.
- **Phase 1 blocks Phases 2, 3, 4 and 5.** Until the negation sweep lands, no absence assertion written in a later phase can be confirmed RED before the prose that satisfies it, and the TDD-first ordering degrades to writing the assertion and the prose together. This is the reviewer's explicit sequencing ruling, not a preference.
- Phases 2, 3 and 4 are mutually independent once Phase 1 is green. Phases 3 and 4 both touch `references/config.md` but in disjoint regions (`#### The makespan model` … `#### Greedy, recomputed adoption` vs `#### Owned-glob rejection`).
- Phase 5 depends on all of 1–4.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-08-07T05:57:18Z | REVIEWER

CR-20260807T055718Z-bd3e created. Status: APPROVED. Must Fix: 0. Should Fix: 5.

All four `CR-20260807T045301Z-4659` blockers closed, verified with an independent fence parser and
my own arithmetic rather than against the plan's or the tester's claims: 16/16 gate blocks exit 0;
zero `!`-inverted, zero real brace-group, zero piped `grep -q` survive as live assertions; both
amendment records intact with comment-stripping confirmed load-bearing; `M_flat − M_nested ≡ Σg − Σc`
re-derived by hand from the shipped formulas, so gate and ladder cannot diverge; all three false
prose claims absent from the shipped skill. All eight ACs met.

Ruled on the tester's three handed-up findings — all **Should Fix**, none blocking. W-1 (SF-1): the
range leak reproduces, but `:926`'s prose is correct and AC 5's explicit class-catching assertion
does bind that line. W-2 (SF-2): a conditional invariant that binds its regression path, not an
SF-5-class optional wrapper, though the silent skip should still be made visible. D-1 (SF-3): `bf97`
is a superseded plan whose AC is a historical record; the disagreement is already documented in
`CR-4659`'s AC table, its MF-3, and `bf97`'s own Progress Log, and the shipped `SKILL.md` is correct.
Added SF-4 (Phase 5 item 6 asserts nothing; AC 7's "fifteen / 4" is 16 / 5; three stale line cites)
and SF-5 (Phase 3 item 4 is near-tautological over its region).

### 2026-08-07T05:54:24Z | TESTER

TEST-20260807T054118Z-6a09 created. Status: PASS. Coverage: N/A → N/A (zero executable lines).

All 16 gate blocks re-extracted independently and confirmed exit 0. MF-1 re-derived, not accepted:
~95 mutations applied to the **subject artifacts** (never the gate scripts), ≥4 per block — 93
correctly RED, 2 deliberate GREEN controls correct, 1 genuine leak (W-1). Zero `!`-inverted, zero
brace-group, zero piped `grep -q` survive as live assertions; the 13 residual textual hits are all
prose, harness notes, or amendment records. Counts reproduce exactly: 13 (P) + 18 (F) = 31, plus
one brace-group variant. Both amendment records intact; comment-stripping proven load-bearing
(awk range alone finds 1 hit, `gate_body` finds 0). MF-2 re-derived: the `{12,6}`→`{6,6}` example
reproduces exactly (M_flat 16, M_nested 14, g 6, c 4, ADOPT, agree), the documented pre-correction
contradiction reproduces, and 28,463 brute-forced greedy configurations show 0 violations of
`M_flat − M_nested ≡ Σg − Σc` — gate and ladder cannot diverge. Both self-reported items confirmed
(bf97 Phase 2 item 3 amendment correctly recorded; AC 7's "fifteen / this plan's 4" is
documentation-only, the Phase 5 gate asserts the correct 5).

Three non-blocking findings for the reviewer: **W-1** the Phase 2 gate's `awk` range is one line
too wide, so `SKILL.md:926` can be gutted while `:928` keeps the gate green; **W-2** the Phase 3
gate's barrier-round-trip check is a conditionally-vacuous wrapper that skips silently on the
shipped tree — the same SF-5 class this plan removed elsewhere; **D-1** `FIX-…-bf97`'s AC 8 and
task `:78` still state verbatim the two claims MF-3 ruled false, with an amendment record on the
gate side but none on the AC side.

### 2026-08-07T05:39:21Z | CODER

All 49 tasks complete (5 optional, all taken). Plan status → DONE. Ready for reviewer.

All sixteen gate blocks — parent 5, predecessor `FIX` 6, this plan's 5 — re-run over the final
tree **as one aggregate batch: exit 0**. Every assertion set was written and confirmed **red**
before the prose or gate edit that satisfies it.

**MF-1 is closed by demonstration, not by assertion.** Each of the sixteen blocks was then
mutated in turn — one absence assertion forced to fire, or one presence assertion's pattern
salted — and **every one exited non-zero**. Before this plan, 31 of the 228 assertions across the
two swept plans could not report failure at all.

Two judgement calls the reviewer should rule on, both recorded inline at the edit site:

1. **`FIX-…-bf97` Phase 2 gate item 3 was amended.** It *required* the literal
   `no role walks the contract tree` to be present in `SKILL.md` 3j.3 — the exact claim MF-3
   rules false. Its MF-8 intent (3j.3 must stop overclaiming about the consumer templates) is
   untouched and still asserted; only the false absolute is replaced, by the narrower
   `no role recurses past one level`. Amending it was the only way to satisfy this plan's Phase 2
   tasks and AC 7 at once.
2. **The rescoped assertions use the `-[q]` bracket idiom.** They must search for a literal
   *containing* `grep -q`, which this plan's own piped-`grep -q` scanner would otherwise read as a
   violation. The idiom is the one the architect already used for the same self-matching problem
   inside this plan's gate, so the plans carry one idiom, not a second.

**Counting note (documentation only, no impact on green).** AC 7 and the Phase 5 tasks say
"fifteen gates (parent 5 + predecessor 6 + this plan's 4)", but this plan has **5** gate blocks —
as its own Phase 5 gate asserts (`grep -c '^### Phase . gate' "$T"` `-eq 5`). Read as "the fifteen
gates the Phase 5 gate re-runs, plus the Phase 5 gate that re-runs them", the text is consistent;
the total executed is 16 and all 16 exit 0.

### 2026-08-07T05:02:08Z | ARCHITECT

Plan `FIX-20260807T050208Z-9ac2` created. Type: fix. Tasks: 49 across 5 phases (5 optional).
Source CR: `CR-20260807T045301Z-4659` (4 Must Fix, 5 Should Fix).
MF-1 → Phase 1 (blocks all other phases, per the reviewer's sequencing ruling); MF-3 → Phase 2;
MF-2 → Phase 3; MF-4 → Phase 4; no-regression → Phase 5. All Should Fix items carried as
`(optional)` task pairs in the phase that already edits the same file.
Status: PLANNED. Ready for coder.

### 2026-08-07T06:11:02Z | QA

QA-20260807T060418Z-d7d0 created. Status: READY_WITH_WARNINGS. Failures: 0. Lint/type errors: 0.
Scope: accumulated union (FEAT-…-6077 + FIX-…-bf97 + FIX-…-9ac2) = 10 files, 9 .md + 1 .json,
zero executable extensions — coverage inapplicable, not missed. 16/16 gate blocks green
(18 fences reconciled as 16 gates + 2 illustrative form snippets), independently extracted and run.
Independent polarity-aware mutation run: 48/48 killed (100%) — the one apparent survivor was a
placement artifact of the QA harness (injection landed outside the assertion's awk range), red on
in-range re-injection. MF-1 meta-assertion re-proved: 0 `!`-inversions, 0 `&& exit 1`, 16/16 with
`set -euo pipefail`. Renderer collateral guard 45/45. gate-scope + gate-shell-injection confirmed
byte-identical to merge-base AND red at merge-base in a detached worktree — pre-existing, untouched.
Warning: G8 = 1.33 on the union (2 REQUEST_CHANGES + 2 FIX layers / 3 CRs); the plan itself is 0.00.
