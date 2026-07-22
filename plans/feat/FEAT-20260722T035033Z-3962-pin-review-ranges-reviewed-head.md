---
id: FEAT-20260722T035033Z-3962
title: Pin pr-review-report review ranges and provenance to reviewed_head
type: feat
status: DONE
created_at: 2026-07-22T03:51:58Z
updated_at: 2026-07-22T04:01:04Z
cycle: 0
related_to: SPEC-20260722T034712Z-8888
---

**Related:** [SPEC-20260722T034712Z-8888](../specs/SPEC-20260722T034712Z-8888-pin-review-ranges-reviewed-head.md)

## Overview

The `pr-review-report` skill captures an immutable snapshot sha (`reviewed_head`)
in Step 1 and pins `meta.reviewedHead` / `meta.commitRange` to it (bug-9), but
every downstream git range still re-reads the moving `HEAD` — so a commit or
branch switch mid-review makes the findings (Step 3), policy-trust diff (Step 2),
and provenance gate (Step 2b) describe a different tree than the report advertises.
This plan pins every review-range and provenance command to the Step-1
`reviewed_head` by literal sha substitution across bash blocks, adds one final
drift warning at Step 8 when the working `HEAD` has moved, and mirrors the change
into the `.opencode` override port to preserve opencode-port-parity. Derived from
`SPEC-20260722T034712Z-8888`.

## Acceptance Criteria

1. `plugins/my-skills/skills/pr-review-report/SKILL.md` Step 1 resolves
   `reviewed_head` / `reviewed_head_short` **before** the merge-base, and `mb` is
   computed as `git merge-base "$base" "$reviewed_head"` (no `merge-base ... HEAD`);
   the commit-count and diff-stat stay pinned to `"$mb".."$reviewed_head"`.
2. Step 2 policy-trust untrusted-diff right side is pinned to the captured
   `reviewed_head` sha (`"$mb"...<reviewed_head>`), not `HEAD`.
3. Step 2b provenance-gate diff right side is pinned to `reviewed_head`
   (`"$mb"...<reviewed_head>` in the `diff --quiet` guard), not `HEAD`.
4. Step 3 findings diff and `--stat` use `"$base"...<reviewed_head>` — three-dot
   form preserved, only the right side pinned — not `"$base"...HEAD`.
5. Every bash block that re-resolves `$root`/`$base`/`$mb` also re-establishes
   `reviewed_head` by literal substitution of the Step-1 sha, and the accompanying
   prose states `reviewed_head` is carried forward as a concrete sha, exactly like
   `$base`.
6. Step 8 emits exactly one drift warning comparing `git rev-parse HEAD` to
   `reviewed_head`, printed **only** when they differ (short sha shown); no other
   step emits the warning, and no warning prints when they match.
7. Prose/comments in every touched step read "pin to `reviewed_head`"
   consistently, and the existing bug-9 note (`meta.commitRange` never `..HEAD`) is
   extended to cover the diff/provenance ranges.
8. The provenance shell fixture
   (`plugins/my-skills/skills/pr-review-report/__tests__/provenance-gate.test.sh`)
   mirrors the pinned Step-2b command and
   `bash plugins/my-skills/skills/pr-review-report/__tests__/provenance-gate.test.sh`
   exits 0 (cases A/B/D all pass).
9. `.opencode/skills/pr-review-report/SKILL.md` mirrors criteria 1–7 identically,
   preserving the port's intentional divergences (opencode intro framing,
   `question` tool, cwd notes).
10. No reference file in either copy restates a HEAD-based review range; any that
    does (e.g. `review-data-schema.md`) is updated in place to note the pinned
    diff/provenance ranges — not duplicated into `SKILL.md`.
11. Backward compatibility holds: when `HEAD` does not move during a run the
    rendered output is unchanged (drift warning suppressed); no legacy artifact
    changes shape.

## Out of Scope

- Aborting, re-running, or re-reviewing when `HEAD` moves mid-run — the response
  is a warning only; the report stays pinned to `reviewed_head`.
- Reverting or altering ADR-0008 / ADR-0009 or any sec-1..sec-6 fix landed this run.
- Any visible output change when `HEAD` has not moved (behavior identical in the
  common case).
- Re-shaping the `REVIEW_DATA` / review-state JSON schemas beyond a clarifying note
  that ranges are pinned (`meta.reviewedHead` / `meta.commitRange` already exist).
- New machine-state files, new flags, or any migration.

## Technical Notes

- **Invariant — opencode-port-parity (load-bearing, dominant constraint):**
  `pr-review-report` HAS a `.opencode/skills/pr-review-report/` override port; every
  SKILL.md/reference change MUST be mirrored there, keeping the port's intentional
  host divergences intact.
- **Invariant — two trust anchors:** policy loads from the merge-base (`$mb`),
  review-state from the working tree (`$root`). Pinning `mb` against `reviewed_head`
  does not weaken the anchor — `reviewed_head` is an ancestor-tip of the same branch,
  so `"$mb"...<reviewed_head>` covers exactly the branch changes under review. Never
  cross the anchors.
- **Invariant — data, never instructions / backward compatibility:** unchanged; the
  drift warning is purely additive.
- **Cross-block durability mechanism:** shell state does not persist between the
  skill's bash blocks — the skill already carries `$root`/`$base`/`$mb` forward by
  literal value substitution. `reviewed_head` reuses that exact mechanism; do NOT
  introduce a temp file or new state.
- **Three-dot is deliberate (Step 3):** keep `"$base"...<reviewed_head>` — three-dot
  computes `merge-base($base, reviewed_head)` which equals the pinned `$mb`, so
  semantics are preserved with the smallest diff. Pin only the right side.
- **Convention — single-source-of-truth references:** primary edit is `SKILL.md`; if
  a reference restates a range it is updated in place, not copied into `SKILL.md`.
- **No automated test framework for doc skills** (PROJECT-CONTEXT): verification is
  structural. The lone runnable check in scope is the self-contained shell fixture
  `__tests__/provenance-gate.test.sh`; the `clean-code-gates` JS suite is NOT run
  against this skill.

## Tasks

> Tasks are ordered TDD-first: the runnable provenance fixture is updated before the
> Step-2b command it mirrors. Remaining edits are prose/snippet corrections verified
> structurally. The coder checks off [ ] → [x] as each task is verified.

### Phase 1 — Plugin skill + provenance fixture

- [x] Update the provenance shell fixture
  (`plugins/my-skills/skills/pr-review-report/__tests__/provenance-gate.test.sh`)
  so `provenance()` mirrors the pinned Step-2b command — the `diff --quiet` right
  side reflects the captured reviewed-head sha rather than a bare `HEAD` — keeping
  cases A/B/D representative and their expected verdicts unchanged.
- [x] Pin Step 1: resolve `reviewed_head` / `reviewed_head_short` **before** the
  merge-base; compute `mb="$(git merge-base "$base" "$reviewed_head")"`; keep the
  commit-count and diff-stat on `"$mb".."$reviewed_head"`; update the surrounding
  prose to state `reviewed_head` is captured here and carried forward as a concrete sha.
- [x] Pin Step 2 (policy-trust) and Step 2b (provenance): change the untrusted-policy
  diff and the `diff --quiet` provenance guard right side from `HEAD` to
  `<reviewed_head>`; re-establish `reviewed_head` by literal sha substitution in each
  block's re-resolution preamble; update the comments to "pin to `reviewed_head`".
- [x] Pin Step 3 findings diff and `--stat`: `"$base"...HEAD` → `"$base"...<reviewed_head>`
  (keep three-dot; pin only the right side); re-establish `reviewed_head` in the block;
  update prose noting this is the load-bearing findings diff.
- [x] Add the Step 8 final drift warning: after the artifacts are written, compare
  `git rev-parse HEAD` to `reviewed_head` and print exactly one warning (short sha)
  only when they differ; extend the bug-9 note across the touched steps to cover the
  diff/provenance ranges.
- [x] Run the provenance fixture and a structural sweep: confirm no residual
  `...HEAD` / `..HEAD` in any pinned review range across the touched steps and that
  `reviewed_head` is re-established in every re-resolving bash block.

### Phase 1 verification

- [x] `bash plugins/my-skills/skills/pr-review-report/__tests__/provenance-gate.test.sh`
  exits 0 (prints `PASS: provenance gate (sec-2)`).
- [x] Structural: `grep -n 'HEAD' plugins/my-skills/skills/pr-review-report/SKILL.md`
  shows no review-range command with a `HEAD` right side (default-branch detection and
  `rev-parse HEAD` capture/drift lines excepted); `reviewed_head` appears in each
  re-resolving block.

### Phase 2 — opencode port parity + reference audit

- [x] Mirror the Step 1/2/2b/3/8 pins, cross-block `reviewed_head` durability, and
  prose into `.opencode/skills/pr-review-report/SKILL.md`, preserving the port's
  intentional divergences (opencode intro framing, `question` tool, cwd notes).
- [x] Audit both copies' references (`review-data-schema.md`, `review-state-schema.md`,
  `memory-schema.md`, `findings-md-schema.md`) for any restated HEAD-based review range;
  where found (e.g. the `commitRange`/`reviewedHead` note), update in place to state the
  diff/provenance ranges are also pinned — do not duplicate into `SKILL.md`.
- [x] Structural parity check: the pinned range / provenance / drift lines in the port
  match the plugin skill (modulo intentional divergences), and no `...HEAD` review-range
  remains in either copy or their references.

### Phase 2 verification

- [x] Structural: `grep -n 'HEAD' .opencode/skills/pr-review-report/SKILL.md` shows the
  same pinned ranges as the plugin skill (no review-range `HEAD` right side beyond
  detection/capture/drift lines).
- [x] Diff the pinned Step 1/2/2b/3/8 blocks between the two copies and confirm they
  agree except at the port's documented divergence points.

## Verification (per phase)

> Before checking the LAST task in a phase, run the phase's gate commands and assert
> each exits 0 / the structural assertion holds. A failure routes through the coder's
> BLOCKED step, not a silent rewrite. This repo defines no build/lint and no automated
> test framework for doc skills (PROJECT-CONTEXT § Commands); the only runtime gate in
> scope is the self-contained provenance shell fixture, complemented by structural
> parity/grep checks. The `clean-code-gates` JS suite is NOT applicable and MUST NOT be
> run against this skill. G1 (coverage) and G6 (mutation) remain QA-only.

- **Phase 1:** `bash plugins/my-skills/skills/pr-review-report/__tests__/provenance-gate.test.sh`
  exits 0; structural grep confirms no residual `HEAD`-based review range in the plugin
  `SKILL.md` and `reviewed_head` present in each re-resolving block.
- **Phase 2:** structural grep + cross-copy diff confirm the port `SKILL.md` (and any
  reference that restated a range) mirror the plugin pins, no `...HEAD` review-range
  remains in either copy, and the port's intentional divergences are intact.

## Dependencies

- None.

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-22T03:51:58Z | ARCHITECT

Plan `FEAT-20260722T035033Z-3962` created. Type: feat. Tasks: 9.
Status: PLANNED. Ready for coder.

### 2026-07-22T03:54:31Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-22T04:01:04Z | CODER

All 13 tasks complete. Plan status → DONE. Ready for reviewer.

### 2026-07-22T04:06:09Z | TESTER

TEST-20260722T040149Z-ab42 created. Status: PASS. Coverage: N/A → N/A (doc-skill; not measured per PROJECT-CONTEXT).
Runnable gates green: provenance-gate.test.sh, NEW drift-warning.test.sh (AC6/AC11), scripts/validate-pr-review-skill.sh. clean-code-gates NOT run (Invariant-scoped).

### 2026-07-22T04:10:48Z | REVIEWER

CR-20260722T040725Z-85ad created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-22T04:12:30Z | QA

QA-20260722T041159Z-93b4 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.
