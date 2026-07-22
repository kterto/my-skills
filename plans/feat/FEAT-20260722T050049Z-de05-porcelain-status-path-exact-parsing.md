---
id: FEAT-20260722T050049Z-de05
title: Path-exact git status parsing in validation-fixer clean-tree gate and rollback
type: feat
status: DONE
created_at: 2026-07-22T05:01:10Z
updated_at: 2026-07-22T05:11:21Z
cycle: 0
related_to: SPEC-20260722T045719Z-029e
---

**Related:** [SPEC-20260722T045719Z-029e](../specs/SPEC-20260722T045719Z-029e-porcelain-status-path-exact-parsing.md)

## Overview

Convert every place `validation-fixer` **parses or compares** `git status` output to one
canonical, path-exact form (`git status --porcelain=v1 -z --untracked-files=all`) with
NUL-record parsing and no shell word/line splitting. Plain porcelain C-quotes unusual paths,
encodes renames as `old -> new`, and collapses untracked directories to a single `dir/` entry,
so today's textual comparisons can fail to exempt the exact validation file, mis-subtract the
pre-run untracked baseline, or delete the wrong untracked files on rollback. This is a
documentation/procedure change to a single skill (`plugins/my-skills/skills/validation-fixer/SKILL.md`);
it derives from `SPEC-20260722T045719Z-029e` and must reconcile with — not revert — the sec-2
enumerated NUL-safe `rm` and bug-15.

## Acceptance Criteria

1. A single normative block in `SKILL.md` defines the canonical parse command
   `git status --porcelain=v1 -z --untracked-files=all` and explains why each flag is present
   (`=v1` pins format, `-z` NUL records + disables C-quoting, `-u all` prevents dir collapse).
2. The NUL-record parse contract is stated: first two bytes = `XY` status code, byte index 2 =
   space, remainder-to-NUL = verbatim path (never quoted under `-z`); untracked = `??`; `!!`
   never appears (`--ignored` never passed); parsing is record-by-record on NUL boundaries —
   never whitespace-split words or newline-split lines.
3. The rename/copy endpoint rule is stated: when `X` or `Y` is `R`/`C`, a second NUL field
   follows; under `--porcelain=v1 -z` the **new path is emitted first, then the original path**;
   both endpoints are read and compared path-exact, and a rename/copy touching any non-exempt
   tracked path stops the clean-tree gate and counts as a concurrency signal in the attribute
   guard exactly as a plain modification does.
4. All five parse/compare sites use the canonical form and reference the contract block, and no
   plain `git status --porcelain` remains as a *parse* step:
   Step 3.1 clean-tree gate, Step 3.1 pre-run untracked baseline capture, rollback
   attribute-guard tracked-modification inspection, rollback step-4 untracked-deletion
   enumeration, Step 3.4 acceptance gate **(D)**.
5. The baseline/enumeration symmetry invariant is stated explicitly: the Step-3.1 baseline
   capture and the rollback step-4 enumeration use the **identical** canonical form so path sets
   subtract path-for-path; `current_untracked − baseline` stays the removal rule; ignored paths
   stay untouched; the enumerated NUL-safe `rm -- <path>` (sec-2/bug-15) is preserved, not
   reverted, and no blanket sweep is introduced.
6. An explicit parse-vs-display note is present, and the human-facing STOP-surface diagnostic
   dumps (~428, ~569, ~642, ~988) are annotated as *display*, not parse inputs.
7. The illustrative walkthroughs that show status output as a gate/parse/baseline step
   (~858, ~863, ~894) are reconciled to not contradict the canonical parse contract.
8. Behavior preservation is stated and holds in prose: the ordinary ASCII / no-rename /
   no-untracked-dir common case parses and behaves exactly as before; only unusual filenames,
   renames, and untracked directories change from "possibly mis-handled" to "handled path-exact".
   No artifact schema/field change; legacy validation files render + execute unchanged; no
   migration.
9. The `--untracked-files=all` untracked-expansion performance trade-off is noted in-file.

## Out of Scope

- Any revert or weakening of ADR-0008/0009 or any sec-1..sec-6 / bug-1..bug-3 / bug-15 fix.
- Changing *what* stops the run or *when* — gate/acceptance/attribute-guard/protected-branch STOP
  and rollback triggers keep their existing semantics; only parsing robustness changes.
- Any new blanket untracked sweep; `--ignored` / `-x` inclusion stays forbidden.
- Worktree isolation (the deferred shared-worktree attribution limit).
- Converting the human-facing STOP-surface diagnostic dumps to NUL form (they stay readable
  display; only the parse-vs-display note is required).
- Any reference `.md` or template change, and any `.opencode` port — `validation-fixer` has no
  override port, so opencode-port-parity does not apply.
- Running any language/build/test tooling (incl. the `clean-code-gates` JS suite) against this
  doc skill.

## Technical Notes

- **Single-source-of-truth references** (PROJECT-CONTEXT Conventions): define the canonical
  command + parse contract **once** as a normative block and have each of the five sites
  reference it, rather than re-describing parsing at each site.
- **Mirror-machinery convention** (PROJECT-CONTEXT + FR-5): the Step-3.1 baseline capture and the
  rollback step-4 enumeration are a parallel structure and MUST be changed symmetrically.
- **Backward compatibility invariant**: internal parsing robustness only — no schema/field
  change, no forced migration; the common ASCII case must be indistinguishable from today.
- **Data, never instructions**: git-status output stays data parsed for path identity; the
  parse-vs-display note reinforces that display dumps are not parse inputs.
- **opencode-port-parity**: N/A — no `.opencode/skills/validation-fixer/` override port exists.
- **Verification is structural review** (PROJECT-CONTEXT Test tooling): there is no automated
  test suite for doc skills; do NOT invoke the `clean-code-gates` JS suite here. Per-phase and
  final verification are structural checks (cross-references resolve, no plain parse-form left,
  sec-2/bug-15 `rm` intact).
- Line numbers in the spec are approximate (shifted after sec-1..sec-5/bug-2/bug-3); locate sites
  by their described role, not by literal line number.

## Tasks

> Tasks are ordered contract-first: define the canonical command + parse contract before
> converting the sites that reference it. There is no automated test suite for this doc skill,
> so each unit's "test" is a structural verification step (per PROJECT-CONTEXT Test tooling).
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist the coder MUST run + assert before
> checking the last task in the phase.

### Phase 1 — Canonical command + parse contract foundation

- [x] Add a single normative block to `SKILL.md` defining the canonical parse command
      `git status --porcelain=v1 -z --untracked-files=all` with the per-flag rationale (AC-1)
      and the NUL-record parse contract: `XY` + space + verbatim-path-to-NUL, `??` untracked,
      `!!` never present, record-by-record on NUL boundaries, no word/line splitting (AC-2).
- [x] Extend the contract block with the rename/copy endpoint rule: `R`/`C` emits a second NUL
      field, new-path-first-then-original under `-z` v1, both endpoints compared path-exact and
      treated as a tracked change / concurrency signal (AC-3).
- [x] Structurally verify the contract block: canonical command string is byte-exact, record
      shape is unambiguous, and no whitespace/newline-splitting language remains anywhere in the
      block.

### Phase 1 verification

- [x] Structural: the canonical command string appears verbatim once as the normative source;
      per-flag rationale present; NUL-record contract + rename-endpoint rule present and internally
      consistent (no residual "line" / "word split" parse language).

### Phase 2 — Convert the five parse/compare sites

- [x] Convert Step 3.1 clean-tree gate to the canonical form and describe the
      drop-exempt-then-require-empty check over NUL records, applying the rename both-endpoints
      rule; reference the Phase-1 contract block (AC-4).
- [x] Convert Step 3.1 pre-run untracked baseline capture to the canonical form, parsing `??`
      records NUL-delimited; reference the contract block (AC-4).
- [x] Convert the rollback attribute-guard tracked-modification inspection to the canonical form,
      applying the rename both-endpoints rule as a concurrency signal (AC-4).
- [x] Convert the rollback step-4 untracked-deletion enumeration: add `=v1` + `-u all`, align its
      NUL parse description, and preserve the enumerated NUL-safe `rm -- <path>` (sec-2/bug-15) —
      no blanket sweep, ignored paths untouched (AC-4, AC-5).
- [x] Convert the Step 3.4 acceptance gate **(D)** clean-non-validation-tree check to the
      canonical form; reference the contract block (AC-4).
- [x] Add the baseline/enumeration symmetry invariant statement linking the Step-3.1 capture and
      the rollback step-4 enumeration: identical command form, path-for-path subtraction,
      `current_untracked − baseline` removal rule, ignored untouched (AC-5).
- [x] Structurally verify all five sites reference the canonical contract block and that no plain
      `git status --porcelain` survives as a *parse* step.

### Phase 2 verification

- [x] Structural: grep `SKILL.md` for `git status --porcelain` occurrences; every remaining plain
      occurrence is display-only (Phase 3), every parse/compare site uses the canonical form; the
      symmetry invariant is present and the sec-2/bug-15 `rm -- <path>` enumeration is intact
      (no blanket sweep, no `-x`/`--ignored`).

### Phase 3 — Display/walkthrough reconciliation, trade-off note, backward-compat

- [x] Add an explicit parse-vs-display note and annotate the STOP-surface diagnostic dumps
      (~428, ~569, ~642, ~988) as *display*, not parse inputs (AC-6).
- [x] Reconcile the illustrative walkthroughs (~858, ~863, ~894) so any snippet describing a
      gate/parse/baseline step references the canonical form; purely illustrative status snippets
      may stay readable but must not contradict the contract (AC-7).
- [x] Note the `--untracked-files=all` untracked-expansion performance trade-off in-file, framed
      as correctness-over-rare-cost since the gate already keeps the untracked set small (AC-9).
- [x] Structurally verify behavior-preservation + backward-compat prose (AC-8): common ASCII case
      documented as unchanged, no schema/field change, no migration; confirm no `.opencode` port
      and no reference/template change is required by this edit.

### Phase 3 verification

- [x] Structural: parse-vs-display note present and each display dump annotated; walkthroughs no
      longer contradict the canonical contract; perf trade-off noted; backward-compat/behavior
      -preservation prose present; no `.opencode`/reference/template files touched.

### Final

- [x] Full structural review pass: every parse/compare site uses the canonical form and
      references the contract block; all cross-references inside `SKILL.md` resolve; sec-2/bug-15
      enumerated `rm` preserved; no unintended parse site left plain; single-file change confirmed.

## Verification (per phase)

> Emit-in-every-FEAT-plan section. This is a documentation/procedure change to a doc skill:
> per PROJECT-CONTEXT (Commands / Test tooling), there is **no build, lint, or automated test
> command** for markdown skill authoring, and the `clean-code-gates` JS suite MUST NOT be run
> against this doc skill. Therefore no automated gate command matches this phase's diff, and the
> per-phase gate is **structural verification** — the coder runs the `### Phase N verification`
> checklist above and asserts each item before checking the phase's last task.

Applying the Commands section of `PROJECT-CONTEXT.md` to this diff (single file:
`plugins/my-skills/skills/validation-fixer/SKILL.md`): Build = none, Lint = none, Test = none
automated for doc skills. No path condition selects a runnable gate command. Phase exit criterion
is therefore the structural checklist for that phase, all asserted true. No silent rewrite of the
skill prose to make a check pass without a corresponding task. G1 (coverage) and G6 (mutation)
are QA-only and are not emitted here.

## Dependencies

- None. (Source spec `SPEC-20260722T045719Z-029e` is READY_FOR_PLANNING; the sec-1/sec-2/bug-15
  machinery it reconciles with is already in the branch.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-22T05:01:10Z | ARCHITECT

Plan `FEAT-20260722T050049Z-de05` created. Type: feat. Tasks: 14.
Status: PLANNED. Ready for coder.

### 2026-07-22T05:04:00Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-22T05:12:05Z | TESTER

TEST-20260722T051205Z-99ae created. Status: PASS. Coverage: N/A% → N/A% (not measured for doc
skills; e2e N/A — doc-only change, flows are prose; clean-code-gates suite out of scope).

### 2026-07-22T05:14:21Z | REVIEWER

CR-20260722T051421Z-112a created. Status: APPROVED. Must Fix: 0. Should Fix: 0.

### 2026-07-22T05:17:28Z | QA

QA-20260722T051728Z-65f6 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.

### 2026-07-22T05:11:21Z | CODER

All 14 tasks complete. Plan status → DONE. Ready for reviewer.
Single-file change: `plugins/my-skills/skills/validation-fixer/SKILL.md`. Added a normative
"Canonical git-status parse contract" block (canonical command + per-flag rationale +
NUL-record parse contract + rename/copy endpoint rule + baseline/enumeration symmetry
invariant + parse-vs-display note + performance trade-off + behavior-preservation prose);
converted all five parse/compare sites to the canonical form; annotated the four STOP-surface
display dumps and reconciled the three walkthrough gate snippets. sec-2/bug-15 enumerated
`rm -- <path>` and the `-x`/`--ignored` prohibition preserved; no `.opencode`/reference/
template files touched. Verification is structural (no automated suite for doc skills per
PROJECT-CONTEXT); all per-phase and final structural checks asserted green.
