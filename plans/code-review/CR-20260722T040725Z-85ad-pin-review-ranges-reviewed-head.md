---
id: CR-20260722T040725Z-85ad
plan: FEAT-20260722T035033Z-3962
title: Review of Pin pr-review-report review ranges and provenance to reviewed_head
status: APPROVED
created_at: 2026-07-22T04:10:48Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 0
should_fix_count: 1
---

**Related:** [FEAT-20260722T035033Z-3962](../feat/FEAT-20260722T035033Z-3962-pin-review-ranges-reviewed-head.md)

## Summary

Reviewed the working-tree changes for FEAT-20260722T035033Z-3962: pinning every `pr-review-report` review range, merge-base, and provenance guard to the Step-1 `reviewed_head` snapshot, plus a single additive Step-8 drift warning, mirrored into the `.opencode` port. All 11 acceptance criteria are met, both runnable fixtures (`provenance-gate.test.sh`, new `drift-warning.test.sh`) and the structural validator pass, and the opencode-port-parity invariant holds. One non-blocking, pre-existing demo-sample inconsistency is noted. Verdict: APPROVED.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Step 1 resolves `reviewed_head`/`_short` before merge-base; `mb = merge-base "$base" "$reviewed_head"`; count/stat on `"$mb".."$reviewed_head"` | ✅ | SKILL.md L88–95: capture precedes `mb`, no `merge-base … HEAD` remains |
| 2 | Step 2 policy-trust untrusted-diff right side pinned to `reviewed_head` | ✅ | L139 `"$mb"..."$reviewed_head"` |
| 3 | Step 2b provenance `diff --quiet` right side pinned to `reviewed_head` | ✅ | L206 guard pinned; matches fixture |
| 4 | Step 3 findings diff and `--stat` use `"$base"...<reviewed_head>` (three-dot, right side only) | ✅ | L275–276 three-dot preserved |
| 5 | Every re-resolving block re-establishes `reviewed_head` by literal sha + prose | ✅ | 4 literal-substitution blocks (steps 2, 2b, 3, 8); all 3 `merge-base` calls pinned |
| 6 | Step 8 emits exactly one drift warning, only when `HEAD != reviewed_head` | ✅ | Single `HEAD-DRIFT` emit; drift-warning fixture proves suppress-on-match |
| 7 | Prose reads "pin to `reviewed_head`" consistently; bug-9 note extended to diff/provenance | ✅ | `review-data-schema.md` note extended (steps 1/2/2b/3) |
| 8 | Provenance fixture mirrors pinned Step-2b command and exits 0 | ✅ | `provenance()` takes `reviewed_head`; cases A/B/D pass, exit 0 |
| 9 | `.opencode` port mirrors criteria 1–7, preserving intentional divergences | ✅ | Port pins identical; opencode cwd/intro/`question` divergences intact |
| 10 | No reference restates a HEAD-based review range; offending ones updated in place | ✅ | Named `review-data-schema.md` updated in both copies; see SF-1 for a pre-existing demo sample |
| 11 | Backward compat: HEAD unmoved → output unchanged (warning suppressed) | ✅ | drift-warning fixture Case A asserts empty output on no-drift |

## Must Fix (Blockers)

None — no blockers found.

## Should Fix (Warnings)

### SF-1 — Demo render still shows a `..HEAD` commitRange sample

**File**: `plugins/my-skills/skills/pr-review-report/references/report-template.demo.html:893` (and the mirrored `.opencode/skills/pr-review-report/references/report-template.demo.html:893`)
**Problem**: The demo JSON payload carries `"commitRange": "ab12cd3..HEAD"`, which now directly contradicts the sibling `review-data-schema.md` note this plan added ("PINNED … NEVER `ab12cd3..HEAD`"). It is a documentation inconsistency inside the same `references/` directory. This is **pre-existing** — the value is present at `main`, predating this plan and even the bug-9 fix that established the pin-`commitRange` rule (which itself left the demo untouched) — and the plan's Out of Scope explicitly excludes changing the shape of legacy artifacts, so it does not block AC10 (whose named target, `review-data-schema.md`, was correctly updated).
**Fix**: Change the demo sample to a pinned form, e.g. `"commitRange": "ab12cd3..9f8e7d6"`, in both copies, so the demo render matches the schema it illustrates. Ideally addressed under bug-9's template ownership rather than expanding this plan's scope.

---

## Verdict

**Status**: APPROVED

All 11 acceptance criteria are met, both runnable fixtures and the structural validator pass, and the opencode-port-parity invariant holds; the sole finding is a pre-existing, out-of-scope demo sample.

Invoke `/qa` with plan ID `FEAT-20260722T035033Z-3962` to run the QA suite.
