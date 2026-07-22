---
id: SPEC-20260722T034712Z-8888
title: Pin pr-review-report review ranges and provenance to reviewed_head
status: READY_FOR_PLANNING
created_at: 2026-07-22T03:49:01Z
updated_at: 2026-07-22T03:49:01Z
cycle: 0
related_to: —
---

## Summary

The `pr-review-report` skill captures an immutable snapshot identifier
(`reviewed_head`) in Step 1 and pins the report's `meta.reviewedHead` /
`meta.commitRange` to it (bug-9), but every downstream git range and provenance
command still re-reads the moving `HEAD`. Because shell state does not persist
between the skill's bash blocks, Steps 1, 2, 2b, and 3 each re-resolve the
merge-base and diff against whatever `HEAD` points at *when that block runs* — so
a new commit or branch switch mid-review makes the findings, the policy-trust
diff, and the review-state provenance gate describe a different tree than the
`meta.reviewedHead` the report advertises. This spec pins every review-range and
provenance command to the Step-1 `reviewed_head` and adds a single final drift
warning when the working `HEAD` has moved during the run. Same change mirrored
into the `.opencode` override port to preserve opencode-port-parity.

## Goals

- Compute the merge-base once against `reviewed_head` (not `HEAD`) in Step 1.
- Pin every subsequent range command to `reviewed_head` instead of `HEAD`:
  the full findings diff (Step 3), the policy-trust diff (Step 2), and the
  review-state provenance diff (Step 2b), plus the commit-count / diff-stat in
  Step 1.
- Carry the resolved `reviewed_head` sha forward across bash blocks by literal
  substitution — the same mechanism the skill already uses for `$root`, `$base`,
  and `$mb` — so re-resolution blocks re-pin to the captured sha, not the live
  `HEAD`.
- Emit exactly one final drift warning (at the Step 8 report) when the working
  `HEAD` differs from `reviewed_head`, stating the report reflects the snapshot,
  not the moved tree.
- Keep the `.opencode/skills/pr-review-report/` port SKILL.md (and any reference
  that repeats these ranges) byte-consistent with the plugin skill, preserving
  the port's intentional host divergences.

## Non-goals

- Do NOT abort, re-run, or re-review when `HEAD` moves mid-run — the response is
  a warning only; the report stays pinned to `reviewed_head`.
- Do NOT revert or alter ADR-0008 / ADR-0009 or any of the sec-1..sec-6 fixes
  landed earlier this run (symlink/path-escape gates, seam-escaping, backlog
  branch-owner gate, etc.). This change is orthogonal to them.
- Do NOT change the report's visible output when `HEAD` has not moved during the
  run — behavior is identical in the common case (backward compatible).
- Do NOT re-shape the `REVIEW_DATA`/state JSON schemas beyond a clarifying note
  that the diff/provenance ranges are pinned; `meta.reviewedHead` /
  `meta.commitRange` already exist (bug-9).
- No new machine-state files, no new flags, no migration.

## Users and use cases

- **Reviewer (skill operator / any agent running `/pr-review-report`)**: runs the
  review across several tool/bash turns. Success = the findings, counts,
  policy-trust decisions, and provenance gate all describe the exact tree named by
  `meta.reviewedHead`, regardless of commits or branch switches that land while
  the review is in progress; if the tree does move, they get one clear drift
  warning rather than a silently inconsistent report.
- **Downstream consumer (`validation-fixer` reading the `.md` backlog)**: relies
  on the backlog's findings matching the advertised snapshot sha so fixes target
  the reviewed tree.

## Functional requirements

1. **Step 1 — capture then merge-base against the snapshot.** Resolve
   `reviewed_head="$(git rev-parse HEAD)"` (and `reviewed_head_short`) *before*
   computing the merge-base, then compute `mb="$(git merge-base "$base" "$reviewed_head")"`.
   The commit-count and diff-stat already use `"$mb".."$reviewed_head"` and stay
   pinned.
2. **Step 2 — policy-trust diff pinned.** Re-resolve `mb` as
   `git merge-base "$base" "$reviewed_head"` and change the untrusted-policy diff
   from `"$mb"...HEAD` to `"$mb"...<reviewed_head>` (right side pinned to the
   captured sha).
3. **Step 2b — provenance gate pinned.** Re-resolve `mb` against `reviewed_head`
   and change the review-state provenance diff from
   `diff --quiet "$mb"...HEAD -- ".pr-review/review-state.json"` to the
   `reviewed_head`-pinned right side.
4. **Step 3 — findings diff pinned.** Change `git --no-pager diff "$base"...HEAD`
   and `--stat "$base"...HEAD` to `"$base"...<reviewed_head>` (keep the three-dot
   form; pin only the right side). This is the load-bearing case — it is the diff
   the findings are authored from.
5. **Cross-block durability.** Every bash block that re-resolves `$root`/`$base`/`$mb`
   also re-establishes `reviewed_head` by literal substitution of the Step-1 sha
   (mirroring the existing "substitute the resolved values" instruction), so a
   re-resolution never falls back to the live `HEAD`. The accompanying prose must
   state that `reviewed_head` is carried forward as a concrete sha, exactly like
   `$base`.
6. **Final drift warning (Step 8).** After the report is written, compare
   `git rev-parse HEAD` to `reviewed_head`; if they differ, emit exactly one
   warning that the working tree moved during the review and the report reflects
   the `reviewed_head` snapshot (short sha shown). No other step emits this
   warning; when they match, no warning is printed.
7. **Prose consistency.** Update the surrounding comments/instructions in each
   touched step so the rationale reads "pin to `reviewed_head`" consistently, and
   the existing bug-9 note about `meta.commitRange` never being `..HEAD` is
   extended to cover the diff/provenance ranges.
8. **Port parity.** Apply requirements 1–7 identically to
   `.opencode/skills/pr-review-report/SKILL.md`, preserving that port's
   intentional divergences (opencode intro framing, `question` tool, cwd notes),
   and to any reference file in either copy that restates these ranges.

## Non-functional requirements

- **Performance**: — (doc/markdown skill; no runtime budget)
- **Security / auth**: The two-trust-anchors invariant is preserved — policy still
  loads from the merge-base (now computed against `reviewed_head`, which does not
  weaken the anchor because `reviewed_head` is an ancestor-tip of the same branch),
  review-state still loads from the working tree. Pinning the provenance diff to
  `reviewed_head` must not narrow what the gate inspects: `reviewed_head` is the
  reviewed tip, so `"$mb"...<reviewed_head>` covers exactly the branch changes
  under review. No trust anchor is crossed.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: —
- **Monetization tier**: —

## Project-context fit

- **Layers touched**: `plugins/my-skills/skills/pr-review-report/SKILL.md`
  (primary), its `references/*.md` where a range is restated, the mirrored
  `.opencode/skills/pr-review-report/` port, and the `__tests__/` shell fixture
  that mirrors the provenance command.
- **Invariant — opencode-port-parity (load-bearing)**: `pr-review-report` HAS an
  override port, so every SKILL.md/reference change MUST be mirrored into
  `.opencode/skills/pr-review-report/`, keeping the port's intentional host
  divergences intact. This is the dominant constraint on the change.
- **Invariant — two trust anchors**: unchanged; the fix keeps policy on the
  merge-base and state on the working tree (see Security above).
- **Invariant — backward compatibility**: output is identical when `HEAD` does not
  move during a run; the drift warning is purely additive. No legacy artifact
  changes shape.
- **Convention — single-source-of-truth references + `.md`/`.html` parity**: the
  primary edit is in `SKILL.md`; `review-data-schema.md` already documents the
  pinned `meta`. If a reference restates a range command it is updated in place,
  not duplicated into `SKILL.md`.
- **Precedent**: this completes the bug-9 pinning intent (snapshot identifier)
  by extending it from `meta` labels to the *commands that produce* the findings
  and provenance. No conflict with the out-of-scope list — this is a doc-skill
  prose/snippet correctness fix, not runtime tooling.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared (skill sources — the real change set)**:
  - `plugins/my-skills/skills/pr-review-report/SKILL.md` — Steps 1, 2, 2b, 3, 8:
    pin ranges/provenance to `reviewed_head`, add cross-block substitution note,
    add final drift warning.
  - `.opencode/skills/pr-review-report/SKILL.md` — mirror all of the above
    (line numbers shifted; same steps), preserving intentional port divergences.
  - `plugins/my-skills/skills/pr-review-report/references/review-data-schema.md`
    and its `.opencode` twin — extend the existing `commitRange`/`reviewedHead`
    note to state the diff/provenance ranges are also pinned (if a range is
    restated there).
  - `plugins/my-skills/skills/pr-review-report/__tests__/provenance-gate.test.sh`
    — mirrors the `"$mb"...HEAD` provenance command; update to the
    `reviewed_head`-pinned form so the fixture stays representative (advisory —
    architect confirms whether the fixture asserts the literal command string).
  - Verify no other reference (`review-state-schema.md`, `memory-schema.md`,
    `findings-md-schema.md`) restates a HEAD-based review range before finalizing.

## Open questions

- (none)

## Decisions resolved by Brainstormer default

- Should a mid-run `HEAD` move abort/re-run the review, or only warn? → **Warn
  only; report stays pinned to `reviewed_head`.** → Matches the bug report's
  explicit "emit only a final drift warning" and preserves the point-in-time
  snapshot semantics established by bug-9.
- Keep the Step-3 findings diff as three-dot `$base...<reviewed_head>` vs. convert
  to two-dot `$mb..<reviewed_head>`? → **Keep three-dot, pin only the right
  side.** → Minimal change; three-dot already computes merge-base(base, right)
  which equals the pinned `$mb`, so semantics are preserved with the smallest
  diff.
- How is `reviewed_head` made durable across bash blocks given shell state does
  not persist? → **Carry it forward by literal sha substitution, like `$root` /
  `$base` / `$mb`.** → Reuses the skill's established cross-block value-substitution
  mechanism rather than introducing a temp file or new state.
- Where does the single drift warning live? → **Step 8 (Report), after the
  artifacts are written.** → It is a closing advisory about the finished report,
  and centralizing it avoids duplicate warnings across steps.
- Update the `__tests__/provenance-gate.test.sh` fixture? → **Yes, mirror the
  pinned command (architect to confirm it is a string-literal fixture, not an
  executed gate).** → Keeps the fixture representative of the canonical command;
  flagged advisory because PROJECT-CONTEXT scopes automated tests to
  `clean-code-gates` only.

## References

- `plugins/my-skills/skills/pr-review-report/SKILL.md` §Step 1 (lines ~84–100),
  §Step 2 (lines ~119, 130), §Step 2b (lines ~170, 193), §Step 3 (lines ~258–259),
  §Step 8 (lines ~584–594).
- `.opencode/skills/pr-review-report/SKILL.md` — mirrored steps (line numbers
  shifted by port intro framing).
- `plugins/my-skills/skills/pr-review-report/references/review-data-schema.md`
  lines ~23–30 (`reviewedHead` / `commitRange` / `commitCount`).
- `plugins/my-skills/skills/pr-review-report/__tests__/provenance-gate.test.sh`
  line ~14 (mirrors the provenance diff).
- `.orchestrator/PROJECT-CONTEXT.md` §Invariants (opencode-port-parity, two trust
  anchors, backward compatibility).
- Source concern: `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md`
  §Bugs & Improvements, bug-1 (fingerprint
  `bugs|plugins/my-skills/skills/pr-review-report/SKILL.md|review-content-still-follows-moving-head-after-snapshot-capture`).
