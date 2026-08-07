# Progress: FIX-20260807T050208Z-9ac2 — Nested parallelism — CR-4659 gate-integrity remediation

**Plan**: [FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md](./FIX-20260807T050208Z-9ac2-cr-4659-gate-integrity-remediation.md)
**Status**: QA_READY_WITH_WARNINGS
**Created**: 2026-08-07T05:02:08Z

---

## Log

### 2026-08-07T05:57:18Z | REVIEWER

Code review complete.
CR: plans/code-review/CR-20260807T055718Z-bd3e-cr-4659-gate-integrity-remediation.md
Status: APPROVED
Must Fix: 0 | Should Fix: 5
Ready for QA — invoke /qa with plan ID FIX-20260807T050208Z-9ac2.

Cycle 3. All four `CR-20260807T045301Z-4659` blockers closed and all eight ACs met, verified
independently (own fence parser, own gate run, own arithmetic): 16/16 blocks exit 0; 0 live
`!`-inverted / brace-group / piped `grep -q`; both amendment records intact; MF-2's accounts close
structurally (`M_flat − M_nested ≡ Σg − Σc`); all three false claims gone from the shipped skill;
`scripts/**` + `templates/html/**` diffs empty; nothing committed (HEAD still `f241623`).

Tester's W-1 / W-2 / D-1 ruled **Should Fix, none blocking** (SF-1, SF-2, SF-3 in the CR), plus two
reviewer-found items in the same class (SF-4, SF-5). All five are gate-precision or plan-record
hygiene under `plans/`; none puts a wrong claim in a shipped file or leaves a criterion unmet.

### 2026-08-07T05:39:21Z | CODER

All tasks complete. Plan status → DONE.
Total tasks completed this session: **49** (5 optional, all taken), across 5 phases.

**Phases 2–4 — the three false claims.**

- **MF-3 (`SKILL.md` 3j.3).** `:926` stated the `Sub-contract`-column walk unconditionally while
  `:150` calls it the legacy fallback; rewritten so `leaves=` is the primary path and the walk is
  the fallback, with the two statements explicitly named as one rule. The absolute
  *"no role walks the contract tree"* is **false** and is gone: `leaves=` carries leaf `FEAT` plan
  IDs only, so the reviewer's *Inherited interface assignments* lookup and the tester's
  sub-contract interface rows are reachable **only** through the parent's `Sub-contract` column.
  Replaced with *no role recurses past one level, and none has a per-lane or per-sub-lane pass*,
  plus a sentence saying where the one legitimate hop happens.
  The `changed only … — for the tester —` enumeration was **verified against the actual diffs**
  before rewriting rather than copied from the CR: `git diff HEAD` shows the reviewer lost its
  `full`-mode per-lane-findings bullet outright and gained a two-level interface-row bullet plus a
  boundary-lens clause; QA lost its per-lane-`CR` reconciliation rule. All three claims now match
  the templates as shipped.
- **MF-2 (`references/config.md` cost model).** Closed by giving gain and cost **disjoint
  accounts**: a new named `span_max` (bare critical path, no overhead) carries the gain;
  `makespan = span_max + overhead` carries the cost; `c` is defined as the marginal delta of
  `M_nested`, so nothing is charged on both sides. `A` is charged on the **first** adoption only,
  matching `M_nested`'s concurrent slowest-of-`k` pricing (charging it per candidate billed
  `k × A` for a level priced at `A` — the actual defect). The barrier bullet is **deleted** as a
  double-charge, with the reason kept: `M_nested`'s `+A` (2c) `+A` (2s) against `M_flat`'s single
  `+A` already *is* the extra round-trip. An `I` interface-point term was added to `M_nested` and
  `M_flat` so the ladder and the gate charge reconciliation identically.
  The CR's worked example is recorded in the file as a permanent sanity check and **now agrees**:
  `g = 6 > c = 4` → adopt, and `M_nested` 14 < `M_flat` 16. Under the old arithmetic it gave
  `c = 6` against `g = 6` → *reject*, while the ladder printed 14 vs 16 — the exact contradiction.
  Both derivations of `c` (delta-of-`M_nested`, and the bullet list) independently give 4.
- **MF-4 (`<2-viable-sub-lanes` ownership).** `config.md`'s `#### Owned-glob rejection` now routes
  **by stage** instead of asserting one outcome: pre-freeze (sub-lane validation + the 2p.3n gate)
  leaves the lane flat; at contract-authoring time — the stage this list is scoped to per its own
  `:134` intro — the architect stops and reports and the run **halts at Step 2s.3**, because 2c has
  already frozen the `Sub-contract` cell. Cross-references to `SKILL.md` → 2p.3n / 2s.3 and
  `templates/architect.md` → *Sub-contract deltas* item 2 pin the three documents together.
  SF-4 taken: `SKILL.md:489`'s *"decided here and nowhere else"* is narrowed to the **adoption
  decision**, reconciling it with the earlier-stage drops at `:340` and `config.md:130`.

**Phase 5 — no regression.** `scripts/`, `orchestrator/scripts/` and `templates/html/` diffs all
empty. Every `test -f` cross-reference resolves. `#### 3j.4` still absent; the precedence sentence
still appears exactly once. No JS suite was invoked against a doc skill. Nothing committed or
pushed — HEAD is unchanged at `f241623`, which predates this session.

### 2026-08-07T05:32:40Z | CODER

**Phase 1 complete — MF-1 closed. 16/16 tasks (4 optional).** Phase 1 gate exits 0.

RED confirmed before any edit, matching the architect's counts exactly: 13 `!`-inverted assertions
in the parent plan's 5 gates + 18 in the predecessor `FIX`'s 6 gates = **31**; 24 piped `grep -q`
in the parent + 1 in the predecessor = **25**; 1 brace-group negation variant.

**The harness defect is real and was demonstrated, not assumed.** Red canary, same deliberately
violated absence assertion: `! grep -qF Verification <file>` under `set -euo pipefail` exits **0**;
`if grep -qF Verification <file>; then …; exit 1; fi` exits **1**.

**Each of the 31 was then run as a real assertion.** 28 were genuinely satisfied and went green on
rewrite. Exactly **three** were false — precisely the three the plan named:

1. parent P1 §9 `! grep -qiE '\b(minutes|hours|seconds)\b' "$C"` — `references/config.md:211` is
   the prohibition sentence itself ("…minutes would be fabricated precision"). Narrowed (MF-1(c)).
2. `FIX` P1 §1 `amendment loop is evaluated first` — survives at `FEAT-…:476+`.
3. `FIX` P4 §3 `grep -q 'Parent contract:' "$AR"` — survives at `FEAT-…:366` **and** `:517`.

**MF-1(b) — the architect's second finding is confirmed against the live tree.** Scoping to the
fenced block alone resolves (2): that literal sits outside every fence. It does **not** resolve
(3): `FEAT-…:366` is a `#`-comment line *inside* the Phase 4 gate's own fence. The `gate_body`
rule (awk range + comment strip) covers both. Neither recording requirement nor absence assertion
was deleted; both amendment records survive (3 and 2 occurrences respectively).

**One deviation from the emitted gate text, resolved without weakening a claim.** The rescoped
assertions must search for a *literal containing* `grep -q`, which the Phase 1 gate's own
piped-`grep -q` scanner reads as a violation. Resolved with the `-[q]` bracket idiom the architect
already used for the same self-matching problem inside this plan's gate — one idiom, not a second.
The `"$AR"` tail was dropped from the Parent-contract pattern (as the architect's own copy does),
avoiding `$` ambiguity in ERE; the claim is unchanged and arguably tighter.

Should Fix items all taken. SF-2's replacement was proven non-vacuous: on a tree with one of the
three `leaves=` spawn blocks regressed, the new per-site count assertion goes **red** while the
old tautology stays **green**.

**All eleven pre-existing gates (parent 5 + predecessor 6) re-run under the corrected harness:
exit 0.** They now pass because their claims hold, not because they cannot fail.

### 2026-08-07T05:15:07Z | CODER

Session started. Plan status → IN_PROGRESS.

### 2026-08-07T05:02:08Z | ARCHITECT

Created plan `FIX-20260807T050208Z-9ac2`. Type: fix. Tasks: 49 across 5 phases (5 optional).

Source: `CR-20260807T045301Z-4659` (REQUEST_CHANGES, 4 Must Fix / 5 Should Fix).

Phase mapping — MF-1 → Phase 1 (must land first, per the reviewer's explicit sequencing ruling); MF-3 → Phase 2; MF-2 → Phase 3; MF-4 → Phase 4; AC 7 no-regression → Phase 5. Should Fix items are annotated `(optional)`: SF-1, SF-2, SF-3, SF-5 in Phase 1 (all touch the two plan files the MF-1 sweep already edits); SF-4 in Phase 4 (same `<2-viable-sub-lanes` ownership area as MF-4).

Three architect findings recorded in the plan rather than passed through silently:

1. **The CR's stated reason for banning `grep -q X && exit 1` is incorrect.** The left operand of `&&` is exempt from `set -e`, so in non-final position the form does *not* abort on the passing branch. Verified empirically. The form is still banned, for the real reason: as the **last** command of a gate block a non-matching `grep` makes the block's own exit status non-zero — a false red. The plan states the corrected justification and flags the CR's version, since the plan text becomes normative prose and propagating a false claim is the exact defect class this chain is remediating.
2. **The CR's proposed fix for the two unsatisfiable-by-construction assertions is sufficient for one and not the other.** Scoping to the fenced gate block resolves `FIX` P1 §1 (the surviving literal sits at `FEAT-…:476`, outside every fence). It does **not** resolve `FIX` P4 §3: that literal sits at `FEAT-…:354`, a `#`-comment line *inside* the Phase 4 gate's own fence. The plan therefore specifies one rule covering both — absence assertions over a plan gate operate on the block's **live (non-comment) assertion lines**, via a `gate_body` helper — and neither the recording requirement nor the absence assertion is deleted.
3. **The gate extractor cannot spell a markdown fence inside a markdown fence**, and the meta-assertions self-match. Both resolved in the emitted gates: `gate_code` anchors on the `set -euo pipefail` / `echo "phase N gate: OK"` bookends every block already carries, and the banned-idiom scanners use the `gre[p]` / `grep -[q]` bracket idiom so a pattern cannot match its own line. Verified: all five emitted gate blocks pass `bash -n`, and the plan satisfies its own three meta-assertions (0 negations, 0 brace-negations, 0 piped `grep -q`).

Counts reproduced independently against the live tree and matching the CR exactly: 13 `!`-inverted assertions in the parent plan's 5 gates + 18 in the predecessor `FIX` plan's 6 gates = **31**; 24 piped `grep -q` in the parent + 1 remaining in the predecessor = **25**. Phase 1's meta-assertions are therefore RED today by construction and need no working harness to demonstrate it — which is what makes Phase 1 self-bootstrapping.

Status: PLANNED. Ready for coder.

---

## Handoff

| From      | To        | Condition                  | Action                                                       |
| --------- | --------- | -------------------------- | ------------------------------------------------------------ |
| ARCHITECT | CODER     | Plan created               | `invoke /coder with plan ID FIX-20260807T050208Z-9ac2`       |
| CODER     | REVIEWER  | All tasks [x], status DONE | `invoke /reviewer with plan ID FIX-20260807T050208Z-9ac2`    |
| REVIEWER  | ARCHITECT | REQUEST_CHANGES            | `invoke /architect with the new CR file path`                |
| REVIEWER  | QA        | APPROVED                   | `invoke /qa with plan ID FIX-20260807T050208Z-9ac2`          |
| QA        | ARCHITECT | BLOCKED                    | `invoke /architect with the QA report file path`             |

### 2026-08-07T05:54:24Z | TESTER

Test suite complete.
Report: plans/test/TEST-20260807T054118Z-6a09-cr-4659-gate-integrity-remediation.md
Status: PASS
Coverage: N/A → N/A (zero executable lines in this plan's diff; renderer collateral guard 45/45)
All e2e flows green. Coverage floor met — inapplicable, not below floor.

16/16 gate blocks green. Harness re-derived independently rather than accepted: ~95 subject-artifact
mutations (≥4 per block, applied to SKILL.md / references/config.md / templates/* / the plan files'
own gate bodies, never to the gate scripts) — 93 correctly RED, 2 GREEN controls correct, 1 genuine
leak. Zero live `!`-inverted / brace-group / piped `grep -q` assertions survive; 31 + 1 rewrite count
reproduces exactly. Both amendment records intact, comment-stripping proven load-bearing. MF-2 closes
structurally: the worked example reproduces and 28,463 brute-forced configurations show gate verdict
and ladder figure cannot disagree. Both coder self-reports confirmed.

Non-blocking findings for the reviewer: W-1 (Phase 2 gate `awk` range one line too wide — SKILL.md:926
not individually pinned), W-2 (Phase 3 gate barrier-round-trip wrapper skips silently — the plan's own
SF-5 class), D-1 (FIX-…-bf97 AC 8 / task :78 still state the claims MF-3 ruled false).

### 2026-08-07T06:04:18Z | QA

Precondition check: Plan FIX-20260807T050208Z-9ac2 status=DONE, CR=CR-20260807T055718Z-bd3e
CR status=APPROVED (must_fix_count: 0, should_fix_count: 5, cycle 3). Proceeding.

### 2026-08-07T06:06Z | QA

Ran: git diff HEAD --name-only (re-read via script — the rtk shim injects "--- Changes ---" into git stdout)
Result: PASS — 10 files: 9 .md + 1 .json. `grep -E '\.(js|cjs|mjs|ts|tsx|sh|py|dart|html)$'` exits 1;
`grep -E '(^|/)scripts/|templates/html/'` exits 1. Zero executable lines CONFIRMED, not assumed.
The lone .json change is one declarative key: "max_parallel_lanes": 6. Parses; 11 keys.

### 2026-08-07T06:06Z | QA

Ran: node --test scripts/render-artifact.test.cjs
Result: PASS — Total: 45 | Passed: 45 | Failed: 0 | Skipped: 0 (collateral-regression guard)
Note: scripts/README.md still says "40 … tests" — stale count in an untouched file, pre-existing.

### 2026-08-07T06:06Z | QA

Ran: node --test scripts/check-artifact-pairing.test.cjs; node --test scripts/gate-target-guard.test.cjs
Result: PASS — 1/1 and 1/1.

### 2026-08-07T06:07Z | QA

Ran: node --test scripts/gate-scope.test.cjs; node --test scripts/gate-shell-injection.test.cjs
Result: RED — pre-existing, NOT a regression. MODULE_NOT_FOUND on
…/skills/orchestrator/.orchestrator/gate-scope.cjs (absent in this authoring repo, per scripts/README.md).
Verified three ways: (1) git diff 974b01a over both tests + gate-scope.cjs is EMPTY;
(2) detached worktree at merge-base 974b01a runs both RED; (3) neither file is among the 10 changed paths.
Not fixed, per instruction.

### 2026-08-07T06:08Z | QA

Ran: extraction + execution of every ```bash fence across the three plan files
Result: PASS — 18 fences reconciled as 16 gate blocks + 2 illustrative form snippets (AC92-01/02,
3 and 2 lines, documenting the absence-assertion idiom). Distribution: FEAT 5, bf97 6, 9ac2 5.
16/16 exit 0. Confirmed grep resolves to /usr/bin/grep inside scripts — no proxied exit codes.

### 2026-08-07T06:09Z | QA

Gate G1 (Coverage) / G2 (Complexity) / G4 (Naming) / G5 (No comments) / G7 (Dependency structure)
Ran: changed-file classification over the 10-file diff
Result: N/A — not MISSING_TOOL. Zero code files, so statements/branches/functions/identifiers/module
edges do not exist in this change set. Substitute suite = the plans' own assertion sets (G6 below).

### 2026-08-07T06:09Z | QA

Gate G6 (Mutation testing — substitute suite)
Ran: polarity-aware mutation harness on a mirrored tree (presence assertions → delete literal;
absence assertions → inject literal), independent of the tester's ~95-mutation run
Result: PASS — 48 mutations, 48 killed, 100% (threshold ≥70%). One apparent survivor
(AC92-04, 'column one level for any sub-split lane') was an artifact of QA-harness placement — the
assertion is range-scoped to SKILL.md:926–928 and my injection landed at EOF; in-range re-injection
drove it red with its intended diagnostic. Corroborates the reviewer's SF-1 ruling independently.
Mirror confirmed restored; working tree still exactly 10 modified files.

### 2026-08-07T06:09Z | QA

Gate MF-1 harness integrity (meta-assertion, re-proved independently)
Ran: scan of all 16 extracted gate blocks
Result: PASS — 0 `!`-inverted commands, 0 `&& exit 1` constructs, 16/16 begin `set -euo pipefail`.

### 2026-08-07T06:10Z | QA

Gate G8 (Rework ratio)
Ran: CR/FIX census over the plan lineage
Result: WARN — plan under QA FIX-…-9ac2: (0 RC + 0 FIX)/1 CR = 0.00 PASS.
Accumulated union FEAT-…-6077 → bf97 → 9ac2: (2 RC + 2 FIX)/3 CR = 1.33 → HIGH_REWORK (>0.5).
Non-blocking warning; flagged for human root-cause investigation.

### 2026-08-07T06:10Z | QA

Ran: invariant checks (PROJECT-CONTEXT)
Result: PASS — opencode-port-parity N/A (neither touched skill has an override port; only
pr-review-report and spec-driven-eval do). .md/.html template parity held (templates/html/ untouched;
new key is config, not an artifact token). Backward compatibility demonstrated live: this repo's own
.orchestrator/config.json has 6 keys and lacks max_parallel_lanes, and the pipeline ran unchanged
against it — exactly the absent-tolerance config.md:314/:354 claims.
Shipped-prose check: the two claims CR-4659 MF-3 ruled false occur 0 times across all 10 changed
product files; SF-4's "fifteen" drift appears in no product file (independent count = 16).

### 2026-08-07T06:11:02Z | QA

QA suite complete.
Report: plans/qa/QA-20260807T060418Z-d7d0-cr-4659-gate-integrity-remediation.md
Status: READY_WITH_WARNINGS
Test failures: 0 | Lint errors: 0 | Type errors: 0
All blocking checks pass. G8 = 1.33 on the accumulated union (HIGH_REWORK) — plan can ship;
flag for human root-cause investigation. Safe to commit and open PR.
