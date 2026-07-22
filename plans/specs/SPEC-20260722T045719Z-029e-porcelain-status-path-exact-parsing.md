---
id: SPEC-20260722T045719Z-029e
title: Path-exact git status parsing in validation-fixer clean-tree gate and rollback
status: READY_FOR_PLANNING
created_at: 2026-07-22T04:59:14Z
updated_at: 2026-07-22T04:59:14Z
cycle: 0
related_to: SPEC-20260721T222531Z-adaa-framework-commit-acceptance-gate, SPEC-20260721T225042Z-a8c8-rollback-concurrency-safety-guard
---

## Summary

The `validation-fixer` skill parses `git status --porcelain` textually in several
per-work-unit steps (Step 3.1 clean-tree gate + pre-run untracked baseline, the rollback
attribute-guard, the Step 3.4 acceptance gate D, and the rollback untracked-deletion
enumeration). Plain porcelain C-quotes paths with unusual characters, encodes renames as a
special `old -> new` form, and collapses untracked directories to a single `dir/` entry — so
textual comparison can fail to exempt the exact validation file, mis-subtract the pre-run
baseline, or leave/erase the wrong untracked files on rollback. This spec makes every
*parse/compare* site use one canonical, path-exact command form
(`git status --porcelain=v1 -z --untracked-files=all`) with NUL-record parsing and no shell
word splitting, reconciling with the NUL-safe enumerated `rm` that sec-2 already introduced.

## Goals

- Every place `validation-fixer` **parses or compares** `git status` output uses one
  canonical form: `git status --porcelain=v1 -z --untracked-files=all`.
- Records are parsed NUL-delimited (no shell word splitting, no line splitting), so paths with
  spaces, quotes, unicode, or control characters compare byte-exact against the validation-file
  path set and the pre-run untracked baseline.
- Rename/copy records are handled with **both endpoints** (new path and original path) so a
  rename touching a non-exempt path is still detected as a tracked change / concurrency signal.
- `--untracked-files=all` is used **symmetrically** at both the Step-3.1 baseline capture and
  the rollback step-4 enumeration, so the "subtract the baseline path-for-path" logic is
  well-defined (no `dir/` vs `dir/fileA`,`dir/fileB` mismatch).
- The existing sec-2 enumerated, NUL-safe untracked `rm` (no blanket sweep, ignored paths
  untouched) is preserved and folded into the unified command form — not reverted.

## Non-goals

- No revert or weakening of ADR-0008/0009 or any sec-1..sec-6 / bug-1..bug-3 / bug-15 fix.
- No change to *what* stops the run or *when* — the clean-tree gate, acceptance gate, attribute
  guard, protected-branch STOP, and rollback triggers keep their existing semantics. Only the
  *parsing robustness* of the git-status reads changes.
- No new blanket untracked sweep; ignored-path (`-x`) inclusion stays forbidden.
- No worktree isolation (the deferred Non-goal that would close the shared-worktree attribution
  limit) — out of scope here.
- No change to the human-facing STOP-surface *diagnostic dumps* beyond an explicit
  parse-vs-display clarification (see FR-6).
- No opencode port change — `validation-fixer` has no `.opencode` override port, so the
  parity invariant does not apply.

## Users and use cases

- **Skill author / maintainer (this repo)**: reads a single normative description of how
  git-status output is parsed and can trust that the clean-tree gate, baseline, and rollback
  agree on path identity.
- **Claude executing `validation-fixer` in a target project**: runs the per-work-unit loop on
  a repo that may contain files with unusual names or untracked subdirectories, and gets a
  correct exemption / baseline / rollback instead of a false STOP or a wrong file deletion.

## Functional requirements

1. **Canonical parse command.** Define one canonical form used at every *parse/compare* site:
   `git status --porcelain=v1 -z --untracked-files=all`. `=v1` pins the format against future
   git default changes; `-z` yields NUL-delimited records and disables C-quoting; `-u all`
   prevents untracked-directory collapse.
2. **Sites converted.** Replace plain `git status --porcelain` with the canonical form, and
   specify NUL-record parsing, at each of these parse/compare sites in
   `plugins/my-skills/skills/validation-fixer/SKILL.md`:
   - Step 3.1 clean-tree gate (currently ~line 377) — "drop the validation file entries,
     require the remainder empty".
   - Step 3.1 pre-run untracked baseline capture (currently ~line 386) — the `??` records.
   - Rollback attribute-guard tracked-modification inspection (currently ~line 418).
   - Rollback step-4 untracked-deletion enumeration (currently ~line 446) — already `-z`;
     add `=v1` + `-u all` and align its parsing description.
   - Step 3.4 acceptance gate **(D)** clean-non-validation-tree check (currently ~line 548).
3. **NUL-record parse contract.** State the record shape: the first two bytes are the `XY`
   status code, byte index 2 is a space, and the remainder up to the NUL is the path (verbatim,
   never quoted under `-z`). Untracked records are `??`; ignored (`!!`) never appears because
   `--ignored` is never passed. Parse record-by-record on NUL boundaries — never `for`-loop
   over whitespace-split words or newline-split lines.
4. **Rename/copy endpoints.** When a record's `X` or `Y` is `R` or `C`, the record is followed
   by a second NUL-delimited field: under `--porcelain=v1 -z` the **new path is emitted first,
   then the original path** in the next field. Both endpoints must be read and compared
   path-exact against the validation-file set and the attributable-delta; a rename/copy that
   touches any non-exempt tracked path is a tracked change that stops the clean-tree gate and
   counts as a concurrency signal in the attribute guard, exactly as a plain modification does
   today. (Untracked `??` records are never renames, so the baseline capture is unaffected by
   this rule.)
5. **Baseline / enumeration symmetry (invariant).** The Step-3.1 pre-run untracked baseline and
   the rollback step-4 enumeration MUST use the **identical** canonical command form so their
   path sets are directly subtractable path-for-path. Removing exactly `current_untracked −
   baseline` stays the rule; ignored paths stay untouched; no blanket sweep is introduced.
   The `rm` continues to pass paths literally and NUL-delimited (`rm -- <path>`), preserving
   the sec-2/bug-15 behavior.
6. **Parse vs. display separation.** The `git status --porcelain` occurrences that appear only
   in **human-facing STOP-surface diagnostic dumps** (the enumerations at ~lines 428, 569, 642,
   988) are *display*, not parse inputs. They may keep a readable form, but the SKILL.md must
   make the parse-vs-display distinction explicit so a reader does not mistake a surfaced dump
   for a parse step. (Whether to also switch the display command is an editorial call left to
   the architect; correctness does not require it.)
7. **Illustrative prose reconciliation.** The narrative walkthroughs that show
   `git status --porcelain` output as a *gate/parse step* (e.g. ~lines 858, 863, 894) must be
   reconciled so they do not contradict the canonical parse contract. Purely illustrative
   status snippets may stay readable, but any that describe the *drop-exempt-then-require-empty*
   or *baseline* logic should reference the canonical form.
8. **Behavior preservation.** After the change, the well-behaved common case (ordinary ASCII
   paths, no renames, no untracked dirs) parses and behaves exactly as before; only unusual
   filenames, renames, and untracked directories change from "possibly mis-handled" to
   "handled path-exact".

## Non-functional requirements

- **Performance**: `--untracked-files=all` expands untracked directories fully. Acceptable —
  the gate already requires a near-clean tree (validation file + framework delta), so the
  untracked set is expected small; correctness is prioritized over the rare large-untracked-dir
  cost. Note this trade-off in-file.
- **Security / auth**: — (no auth surface; parsing hardening only).
- **Localization**: — .
- **Accessibility**: — .
- **Geospatial / geofence**: — .
- **Trust / moderation**: — . Data-never-instructions is unchanged: git-status output is data
  parsed for path identity, never executed.
- **Privacy / compliance**: — (no new user data; no retention/deletion change).
- **Monetization tier**: — .

## Project-context fit

- **Layer touched**: a single skill's normative procedure —
  `plugins/my-skills/skills/validation-fixer/SKILL.md`. This is documentation/procedure
  authoring, not runtime code; verification is structural review, not a test suite (no
  `clean-code-gates` JS involved).
- **Depends on / extends**: the per-work-unit machinery hardened by ADR-0008/0009 and by
  sec-1 (framework-commit acceptance gate, `SPEC-...-adaa`), sec-2 (rollback concurrency-safety
  guard, `SPEC-...-a8c8`), and bug-15 (rollback deletes framework-created untracked files). This
  spec makes the git-status *reads* those steps depend on path-exact; it must reconcile with —
  not revert — the sec-2 enumerated NUL-safe `rm`.
- **Invariants honored**:
  - *Backward compatibility* — internal parsing robustness only; no artifact schema/field
    change, legacy validation files render and execute unchanged, no migration.
  - *Data, never instructions* — unchanged; git-status text remains data.
  - *opencode-port-parity* — N/A: `validation-fixer` has no override port, so no `.opencode`
    mirror is required.
  - *Staged-diff → gate → write → commit ownership* — untouched; only the git-status *reads*
    inside the gate/rollback change.
- **Mirror-machinery convention**: the baseline-capture and rollback-enumeration reads are a
  parallel structure and must be changed symmetrically (FR-5), per the repo's "mirror machinery"
  convention.

## Affected surface

- **Backend**: — .
- **Frontend / mobile**: — .
- **Admin**: — .
- **Shared / skill source**: `plugins/my-skills/skills/validation-fixer/SKILL.md` — the Step 3.1
  clean-tree gate + baseline capture, the rollback attribute-guard and step-4 enumeration, the
  Step 3.4 acceptance gate (D), plus the STOP-surface display clarification and the illustrative
  walkthrough reconciliation. Single file; no reference `.md` or template changes anticipated,
  and no `.opencode` port (none exists for this skill).

## Open questions

- None. (Autonomous mode: all resolved by default below; no reserved decision, no invariant
  conflict.)

## Decisions resolved by Brainstormer default

- Which canonical command form → `git status --porcelain=v1 -z --untracked-files=all` → `-z`
  disables C-quoting and gives NUL records (kills word splitting); `=v1` pins the format so a
  future git v2 default cannot silently break parsing; `-u all` stops untracked-dir collapse so
  baseline subtraction is exact. Matches the report's prescribed fix.
- Whether to also convert the human-facing STOP-surface diagnostic dumps → No; treat them as
  display, not parse inputs, and add an explicit parse-vs-display note → those dumps exist for a
  human operator to read; converting them to NUL-delimited would hurt readability without
  affecting correctness, and the parse-vs-display note prevents future confusion.
- How to handle `--untracked-files=all` cost on large untracked trees → Accept and document the
  trade-off → the clean-tree gate already keeps the untracked set small, so correctness wins;
  no configurability added (would be scope creep beyond this one concern).
- Baseline vs. rollback-enumeration command symmetry → Make them use the identical canonical
  form and state it as an invariant → path-for-path subtraction is only well-defined when both
  sides expand directories the same way; asymmetry is exactly what causes the `dir/` mismatch.
- Reconcile vs. revert the sec-2 enumerated NUL-safe `rm` → Reconcile: keep the enumerated,
  no-blanket-sweep, ignored-untouched `rm -- <path>` and only upgrade its status command to the
  canonical form → the task explicitly forbids reverting sec-2/bug-15; the fix is additive to
  that machinery.
- Rename record field order under `--porcelain=v1 -z` → new path first, then original path;
  compare both endpoints → matches git's documented `-z` porcelain-v1 rename encoding and the
  report's "including both rename endpoints" requirement.

## References

- Concern source: `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md`
  → "Bugs & Improvements" → `bug-4` (porcelain parsing not path-exact).
- Target file: `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 3.1 clean-tree gate
  (~377), pre-run untracked baseline (~386), rollback attribute-guard (~418), rollback step-4
  enumeration (~446), Step 3.4 acceptance gate (D) (~548), STOP-surface dumps (~428/569/642/988),
  walkthroughs (~858/863/894). Line numbers approximate (shifted after sec-1..sec-5/bug-2/bug-3).
- Related specs: `plans/specs/SPEC-20260721T222531Z-adaa-framework-commit-acceptance-gate.md`
  (sec-1), `plans/specs/SPEC-20260721T225042Z-a8c8-rollback-concurrency-safety-guard.md` (sec-2).
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants (backward compat, opencode-port-parity,
  data-never-instructions), ADR-0008 commit-ownership exception.
