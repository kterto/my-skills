---
id: CR-20260722T051421Z-112a
plan: FEAT-20260722T050049Z-de05
title: Review of Path-exact git status parsing in validation-fixer clean-tree gate and rollback
status: APPROVED
created_at: 2026-07-22T05:14:21Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 0
---

**Related:** [FEAT-20260722T050049Z-de05](../feat/FEAT-20260722T050049Z-de05-porcelain-status-path-exact-parsing.md)

## Summary

Single-file documentation/procedure change to `plugins/my-skills/skills/validation-fixer/SKILL.md`
(+132 / −23, working tree) that converts every `git status` parse/compare site to one canonical,
NUL-safe, path-exact command and adds a normative parse contract. Reviewed the full working-tree
diff plus the surrounding gate/rollback/acceptance prose. All nine acceptance criteria are met, the
load-bearing invariants (single-source-of-truth, mirror-machinery, backward-compat, sec-2/bug-15,
`-x`/`--ignored` prohibition, opencode-port N/A) hold, and the one factual git claim the whole
change rests on is correct. Verdict: APPROVED.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Single normative block: canonical command + per-flag rationale | ✅ | Contract block; command byte-exact once (line 379), each of `=v1`/`-z`/`-u all` rationale given (lines 383–393). |
| 2 | NUL-record parse contract (`XY`+space+verbatim path, `??`, no `!!`, record-by-record) | ✅ | Lines 395–406; byte-index shape correct, no word/line-split language. |
| 3 | Rename/copy endpoint rule (new-path-first, both endpoints, concurrency signal) | ✅ | Lines 408–417; endpoint order verified correct against git-status(1). |
| 4 | All five sites canonicalized; no plain parse-form left | ✅ | Gate (461), baseline (475), attribute-guard (509), rollback enum (542), acceptance-D (648). grep confirms every residual plain form is display/explanatory. |
| 5 | Baseline/enumeration symmetry invariant explicit | ✅ | Lines 419–425; `current_untracked − baseline` rule, `-u all` prevents `dir/` mismatch, ignored untouched. |
| 6 | Parse-vs-display note + four STOP dumps annotated | ✅ | Note lines 427–435; four surfaces annotated at 523, 671, 745, 1096 — clean 4-to-4 mapping. |
| 7 | Walkthroughs reconciled to the contract | ✅ | Lines 962, 969, 1001 now reference the canonical form; no contradiction. |
| 8 | Behavior preservation / backward-compat prose | ✅ | Lines 444–452; ASCII common case unchanged, no schema/field change, no migration. |
| 9 | `--untracked-files=all` performance trade-off noted | ✅ | Lines 437–442; framed correctness-over-rare-cost, no configurability added. |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

None — no warnings found.

## Verification notes (non-blocking, for the record)

- **Rename endpoint order is correct.** The contract asserts that under `--porcelain=v1 -z` the
  rename/copy record emits the **new path first, then the original**. This matches git-status(1),
  which documents that in `-z` mode "the field order is reversed (e.g `from -> to` becomes
  `to from`)" and the `->` is dropped. This is the load-bearing factual claim of the change and it
  holds.
- **No plain parse-step survives.** grep of `git status --porcelain` not followed by `=v1` returns
  only: the in-contract contrast sentence (389), the parse-vs-display note itself (432, 434), and
  the four human-facing STOP dumps (523, 671, 745, 1096) — each explicitly annotated as display.
- **sec-2/bug-15 preserved, not reverted.** Enumerated NUL-safe `rm -- <path>` intact (546); the
  `-x`/`--ignored` prohibition intact (405, 421–422, 547); no blanket untracked sweep introduced.
- **Invariants respected.** Single-source-of-truth (contract defined once, five sites reference it);
  mirror-machinery (Step-3.1 baseline and rollback step-4 enumeration changed symmetrically to the
  identical command form); backward-compat (internal parsing robustness only). opencode-port-parity
  is genuinely N/A — confirmed no `.opencode/skills/validation-fixer/` port exists.
- **Scope is clean.** Single-file edit exactly as planned; no reference/template/`.opencode` files
  touched; no drive-by refactor; every changed line traces to a plan task.

## Verdict

**Status**: APPROVED

All nine acceptance criteria are met with zero Must Fix items; the change is correct, in-scope, and preserves all load-bearing invariants.

Invoke `/qa` with plan ID `FEAT-20260722T050049Z-de05` to run the QA suite.
