---
id: FEAT-20260721T222950Z-7cf1
title: Validate framework-owned commits before accepting them as fixes
type: feat
status: DONE
created_at: 2026-07-21T22:31:00Z
updated_at: 2026-07-21T22:35:30Z
cycle: 0
related_to: SPEC-20260721T222531Z-adaa, ADR-0008, SPEC-20260721T215726Z-b751, SPEC-20260721T181347Z-1089
---

**Related:** [SPEC-20260721T222531Z-adaa](../specs/SPEC-20260721T222531Z-adaa-framework-commit-acceptance-gate.md)

## Overview

`validation-fixer` Step 3.4's "Framework signaled success AND HEAD advanced" branch
(SKILL.md anchor ~324) accepts a framework-owned commit as a real fix on the sole test
"success terminal AND `BEFORE_SHA..AFTER_SHA` ≥ 1 commit" — verifying **nothing** about
the HEAD advance itself. This plan (from SPEC-…-adaa, source finding `sec-1`) adds a
**post-run acceptance gate** to that one branch: a framework-owned commit is blessed only
after four invariants hold — **(A)** same branch as captured at Step 3.1, **(B)**
`BEFORE_SHA` is a linear ancestor of `AFTER_SHA`, **(C)** the committed delta excludes
every Step-1 validation file (path-exact), and **(D)** the tree is clean once validation
files + the pre-run untracked baseline are dropped. A violation records `- [~]` (never
`- [x]`) and **safely isolates**: structural violations (A/B) **STOP and surface** rather
than blind-reset an unrecognized branch (even autonomously); content violations (C/D)
reuse the existing validation-file-preserving rollback. Doc-only, purely additive to the
one branch — the own-commit path, the orchestrator lane, ADR-0008, and the superpowers/gsd
loops are untouched.

## Acceptance Criteria

1. **Step 3.1 captures `BEFORE_BRANCH`.** Where Step 3.1 records `BEFORE_SHA` and the
   pre-run untracked baseline (SKILL.md ~232-243), it also records
   `git rev-parse --abbrev-ref HEAD` as `BEFORE_BRANCH`, described as the reference the
   post-run gate compares against.
2. **The framework-owned-commit acceptance branch (anchor ~324) gates on all four
   invariants** before concluding "the framework committed the fix; it is real, nothing to
   commit." Structural checks (A/B) are ordered before any destructive handling.
3. **Invariant A — Branch unchanged.** The gate asserts `git rev-parse --abbrev-ref HEAD`
   equals `BEFORE_BRANCH`, is not a detached HEAD, and is not a protected branch, using the
   **same protected set** the Step-2 preflight uses (`main`/`master`/`dev` default,
   re-derived from the host repo when it documents one — do not fork a second definition).
4. **Invariant B — Linear ancestry.** The gate asserts
   `git merge-base --is-ancestor "$BEFORE_SHA" "$AFTER_SHA"` succeeds; the prose states why
   a naive `≥ 1 commit` count is insufficient (a switched branch or rewritten history that
   orphaned `BEFORE_SHA` would pass the count but fail ancestry).
5. **Invariant C — Validation file(s) excluded from the delta.** The gate asserts the set of
   paths changed across `BEFORE_SHA..AFTER_SHA` contains **no** Step-1 validation file,
   matched **path-exact** (repo-relative, the same matcher as the Step-3.1 exemption — never
   a glob, never "any `.md`"). The prose notes a backlog committed *before* the run lives in
   `BEFORE_SHA`, not the delta, so it is unaffected.
6. **Invariant D — Clean non-validation tree.** The gate asserts post-commit
   `git status --porcelain`, with the Step-1 validation file(s) and the Step-3.1 pre-run
   untracked baseline dropped (exactly as the Step-3.1 gate and the bug-15 baseline already
   do), is empty.
7. **Any A–D failure → not fixed.** A framework-owned commit failing **any** invariant is
   routed to the existing "Framework did NOT signal success" handling outcome and recorded
   `- [~]` (needs attention), **never** `- [x]`, so it resurfaces on re-run — the bug-12
   principle extended to a commit that exists but is structurally unacceptable.
8. **Structural violations (A/B) STOP and surface — no blind reset.** On branch-changed (A)
   or broken-ancestry (B), the skill MUST NOT run the destructive validation-file-preserving
   rollback against the current (unrecognized) branch; it STOPs and surfaces the observed
   state — current branch, `BEFORE_BRANCH`, `BEFORE_SHA`, `AFTER_SHA`,
   `git status --porcelain`, `git log --oneline "$BEFORE_SHA".."$AFTER_SHA"` — plus the
   specific violated invariant, records `- [~]`, and lets the operator reconcile. **This STOP
   binds autonomous mode too** (analogous to the bug-7 protected-branch STOP).
9. **Content violations (C/D) reuse the existing rollback.** When A and B hold but C or D
   fails, the safe-rollback precondition is intact, so the run reuses the existing failure
   handling verbatim — **autonomous:** validation-file-preserving rollback (bug-11, bug-15)
   to `$BEFORE_SHA`, record `- [~]`; **checkpoint:** STOP and surface the partial work, record
   `- [~]` either way. **No new rollback machinery is introduced.**
10. **Change confined; own-commit path unchanged; primitives reused.** The gate is added to
    the framework-owned-commit acceptance branch only; the Step-3.4 own-commit path
    (orchestrator `READY_TO_COMMIT`, main-agent lane, batch lane) is left as-is. All four
    checks **reuse** the skill's existing primitives (Step-3.1 porcelain parsing, path-exact
    validation-file exemption, pre-run untracked baseline, protected set) — none reinvented
    divergently. Sharing the `BEFORE_BRANCH` capture on the own-commit path is permitted but
    not required (its commit is on current HEAD, so ancestry is inherent).
11. **Consistency touch-ups.** Any Edge case / Notes / regression-trace text that describes
    framework-owned-commit acceptance is updated to reflect the gate (a framework commit that
    violates A–D → `[~]`, not `[x]`). The "Autonomous two-item lifecycle (bug-6)" happy path
    is a `READY_TO_COMMIT` orchestrator run (own-commit path) and stays unaffected. The
    one-line-per-concern Step-1 trust rule and the untrusted-evidence frame are unchanged.
12. **Backward compatibility (mandatory invariant).** Legacy
    `_fixed via <framework> · <sha> · <date>_` lines still parse and render; a well-behaved
    framework commit (same branch, fast-forward, code-only, clean tree — the normal case)
    passes all four checks and is accepted exactly as before. Only previously mis-accepted
    (contaminated / partial / branch-switched) commits change outcome, from a false `[x]` to
    a correct `[~]`.

## Out of Scope

- **sec-2** (isolated disposable worktree/clone per work unit) — the heavier remediation;
  this plan adds a validation gate on the shared worktree, not worktree isolation.
- **sec-3** (default protected set missing the repo default branch) — separate finding; this
  plan reuses the Step-2 protected set as-is, it does not redefine it.
- **bug-4** (porcelain parsing not path-exact for unusual filenames) — separate finding; the
  clean-tree check **reuses** the existing Step-3.1 porcelain parsing + exemption verbatim
  and does not independently reinvent or harden parsing.
- Re-opening or altering **ADR-0008** (work-unit commit ownership / batch atomicity) — the
  gate is additive to it, never a revert. A one-line ADR-0008 cross-reference note in
  SKILL.md is optional at the coder's discretion; a new ADR is **not** warranted.
- Changing validation-fixer's **own-commit** path (Step-3.4 "HEAD unchanged, tree dirty,
  success" branch), beyond optionally sharing the `BEFORE_BRANCH` capture helper.
- Adding a `.opencode/skills/validation-fixer/` override port (skill ships a single copy;
  no port on disk — do NOT create one).
- Committing or pushing the fix (the pipeline stops at READY_TO_COMMIT).
- The alternative remediation (worktree isolation instead of a gate) — recorded in the SPEC
  as sec-2's out-of-scope path. If the coder finds the gate untenable, route through the
  BLOCKED step rather than silently switching to isolation.

## Technical Notes

- **Concrete anchors (verify live line numbers before editing — the file moves):**
  Step 3.1 capture + validation-file-preserving rollback ~232-282; the four-way Step-3.4
  reconciliation intro ~313-323; the **target** "Framework signaled success AND HEAD
  advanced" branch ~324-328; the own-commit path ~329-375; the "Framework did NOT signal
  success" handling ~376+ (the outcome A–D failures route into); Step-2 preflight protected
  set ~117-135; Edge cases ~623; Notes ~641; the bug-6 trace ~548 and bug-11 trace ~584.
- **Reuse, do not reinvent (Convention — mirror machinery / single-source-of-truth):** the
  four checks must be expressed in terms of the existing Step-3.1 primitives — porcelain
  parsing, the path-exact validation-file exemption, the pre-run untracked baseline, and the
  protected set (`main`/`master`/`dev`, re-derived from the host repo when documented). Do
  not author a second parser, a second exemption matcher, or a second protected-set
  definition.
- **Safe-isolation boundary (the load-bearing distinction):** A/B failures invalidate the
  precondition of the destructive rollback (that `BEFORE_SHA` is a valid ancestor on the
  preflighted branch), so those STOP and surface — including in autonomous mode. C/D failures
  keep that precondition intact, so they collapse onto the existing rollback / surface-for-
  decision path. Keep this split explicit in the prose so a future reader cannot conflate the
  two.
- **`BEFORE_BRANCH` capture:** `git rev-parse --abbrev-ref HEAD` at Step 3.1. A detached HEAD
  returns `HEAD`; invariant A treats a detached HEAD as a violation (branch identity is
  unverifiable), consistent with the Step-2 preflight rejecting detached HEAD.
- **Backward compatibility (mandatory Invariant):** additive verification only — no field,
  provenance-line, or artifact format changes. A re-run over a pre-existing backlog behaves
  identically for `[x]`/`[~]`/`[ ]` items; only structurally-bad framework commits flip.
- **Security preservation (NFR — this IS the hardening):** all checks are on git state, never
  on backlog text; the untrusted-evidence frame, one-line-per-concern trust rule, and sec-3
  shell-safe commit construction are preserved verbatim in meaning. The gate upholds — does
  not amend — PROJECT-CONTEXT §Invariants line 68 (the never-commit exception's clean-tree /
  same-branch / trustworthy-provenance bounds); **no** edit to that line is due (contrast
  SPEC-…-b751, which did amend it).
- **opencode-port-parity (Invariant):** `validation-fixer` ships a single copy — no
  `.opencode` override port. No port mirror is due. Do NOT create one.
- **Fallback direction:** if full supersession-style gating proves untenable, the SPEC's only
  alternative is sec-2 worktree isolation, which is explicitly out of scope — so there is no
  silent pivot; surface via the coder's BLOCKED step instead.

## Tasks

> Tasks are ordered structural-first: define/assert the verification criteria for a unit of
> work before writing it, and re-assert them after. The coder checks off [ ] → [x] as each
> task is verified. Each phase ends with a `### Phase N verification` checklist the coder MUST
> run + assert before checking the phase's last task. For this doc-only plan the phase checks
> are structural (see `## Verification (per phase)`).

### Phase 1 — Capture `BEFORE_BRANCH` at Step 3.1

- [x] Structural check first: read SKILL.md Step 3.1 (~232-243) and confirm the exact
  location where `BEFORE_SHA` and the pre-run untracked baseline are recorded; note the
  protected-set reference in the Step-2 preflight (~117-135) so Phase 2 cites the same set.
- [x] Add `BEFORE_BRANCH` capture (`git rev-parse --abbrev-ref HEAD`) alongside `BEFORE_SHA`
  and the untracked baseline in Step 3.1, described as the reference the post-run acceptance
  gate compares against (AC-1). Do not alter the existing clean-tree gate behavior.

### Phase 1 verification

- [x] Run the Phase 1 structural checks in `## Verification (per phase)` and assert green
  before checking the last Phase 1 task.

### Phase 2 — Add the four-invariant acceptance gate to the framework-owned-commit branch

- [x] Structural check first: read the Step-3.4 reconciliation intro (~313-323), the target
  "Framework signaled success AND HEAD advanced" branch (~324-328), and the "Framework did
  NOT signal success" handling (~376+) so the gate slots into the target branch and its
  failure routing lands in the existing outcome.
- [x] Insert the acceptance gate into the "Framework signaled success AND HEAD advanced"
  branch: before it concludes "the framework committed the fix; nothing to commit," verify
  **all four** invariants, structural (A/B) before content (C/D):
  - **(A) Branch unchanged** — `git rev-parse --abbrev-ref HEAD` == `BEFORE_BRANCH`, not
    detached, not protected (same set as Step-2 preflight) (AC-3).
  - **(B) Linear ancestry** — `git merge-base --is-ancestor "$BEFORE_SHA" "$AFTER_SHA"`
    succeeds; explain why the naive `≥ 1 commit` count is insufficient (AC-4).
  - **(C) Delta excludes validation file(s)** — paths changed across
    `BEFORE_SHA..AFTER_SHA` contain no Step-1 validation file, path-exact via the existing
    Step-3.1 exemption matcher; note a pre-run-committed backlog lives in `BEFORE_SHA` (AC-5).
  - **(D) Clean non-validation tree** — post-commit `git status --porcelain` with the
    validation file(s) + pre-run untracked baseline dropped (per Step-3.1 / bug-15) is empty
    (AC-6).
- [x] Route any A–D failure to the existing "did NOT signal success" outcome, recording
  `- [~]`, never `- [x]` (AC-7).
- [x] Specify safe isolation for **structural** violations (A/B): STOP and surface the
  observed state (current branch, `BEFORE_BRANCH`, `BEFORE_SHA`, `AFTER_SHA`,
  `git status --porcelain`, `git log --oneline "$BEFORE_SHA".."$AFTER_SHA"`) + the violated
  invariant, record `- [~]`, NO destructive reset on the unrecognized branch — binding in
  autonomous mode too (AC-8).
- [x] Specify that **content** violations (C/D, with A+B intact) reuse the existing
  validation-file-preserving rollback (autonomous) / surface-for-decision (checkpoint),
  record `- [~]`, introducing no new rollback machinery (AC-9).
- [x] Confirm the change is confined to this branch: the own-commit path (~329-375) is
  unchanged; all four checks reference the existing primitives (Step-3.1 porcelain parsing,
  path-exact exemption, pre-run untracked baseline, protected set) rather than reinvented
  logic; optionally note `BEFORE_BRANCH` may be shared on the own-commit path (AC-10). Confirm
  no PROJECT-CONTEXT §Invariants line-68 edit is made and no `.opencode` port is created.

### Phase 2 verification

- [x] Run the Phase 2 structural checks in `## Verification (per phase)` and assert green
  before checking the last Phase 2 task.

### Phase 3 — Reconcile Edge cases / Notes / regression traces

- [x] Structural check first: scan the Edge cases (~623), Notes (~641), and the bug-6 (~548)
  / bug-11 (~584) worked traces for any text that describes framework-owned-commit
  acceptance; record which need a touch-up and which (e.g. the bug-6 `READY_TO_COMMIT`
  own-commit happy path) are unaffected.
- [x] Update only the identified spots so they reflect the gate (a framework commit violating
  A–D → `[~]`, not `[x]`); leave the bug-6 happy path unchanged; preserve the
  one-line-per-concern trust rule and the untrusted-evidence frame verbatim in meaning
  (AC-11). Confirm backward-compat prose holds: legacy provenance lines parse, well-behaved
  commits pass unchanged (AC-12).

### Phase 3 verification

- [x] Run the Phase 3 structural checks in `## Verification (per phase)` and assert green
  before checking the last Phase 3 task.

### Final

- [x] Cross-artifact consistency pass: Step 3.1 capture ↔ Step 3.4 gate ↔ failure routing ↔
  traces/Notes all agree on the four-invariant contract and the A/B-STOP vs C/D-rollback
  split; every AC 1-12 is satisfied; the own-commit path, ADR-0008, superpowers/gsd paths,
  PROJECT-CONTEXT line 68, and the (absent) opencode port are untouched.

## Verification (per phase)

> This is a **doc-only** FEAT touching one markdown skill
> (`plugins/my-skills/skills/validation-fixer/SKILL.md`). Per `PROJECT-CONTEXT.md`
> §Commands there is **no build / test / lint** for markdown authoring, and the
> `clean-code-gates` JS suite is an Invariant-scoped island that MUST NOT run against doc
> skills. The applicable automated gate set is therefore **empty**; each phase's exit
> criterion is its **structural review** checklist below. No silent rewrite of prose to
> "pass" a check without a corresponding task. G1 (coverage) and G6 (mutation) remain
> QA-only and are NOT emitted here.

**Phase 1 (Step 3.1 capture) — structural checks:**
- `grep -n 'BEFORE_BRANCH' plugins/my-skills/skills/validation-fixer/SKILL.md` shows the
  capture added in Step 3.1 next to `BEFORE_SHA` / the untracked baseline, using
  `git rev-parse --abbrev-ref HEAD`, and described as the gate's reference.
- The existing Step-3.1 clean-tree gate, exemption, and rollback prose are unchanged by the
  addition (diff shows only the `BEFORE_BRANCH` insertion).

**Phase 2 (Step 3.4 gate) — structural checks:**
- The "Framework signaled success AND HEAD advanced" branch now enumerates all four
  invariants A/B/C/D with the exact commands (`git rev-parse --abbrev-ref HEAD`,
  `git merge-base --is-ancestor "$BEFORE_SHA" "$AFTER_SHA"`, the path-exact delta check over
  `BEFORE_SHA..AFTER_SHA`, and the porcelain clean-tree check with validation files +
  baseline dropped), structural (A/B) before content (C/D).
- The gate's failure routing records `- [~]`, never `- [x]`, and lands in the existing "did
  NOT signal success" outcome.
- Structural (A/B) violations are documented as STOP-and-surface with the exact surfaced
  fields and an explicit "no destructive reset on the unrecognized branch, autonomous mode
  included"; content (C/D) violations explicitly reuse the existing validation-file-
  preserving rollback / surface-for-decision path with no new machinery.
- `grep -n 'ADR-0007\|ADR-0008'` and a read of the own-commit path (~329-375) confirm it is
  unchanged; the four checks reference the existing Step-3.1 primitives (no second parser /
  exemption / protected-set definition); `.orchestrator/PROJECT-CONTEXT.md` line 68 is not
  edited; no `.opencode/skills/validation-fixer/` directory is created.

**Phase 3 (traces / Notes / Edge cases) — structural checks:**
- Every spot describing framework-owned-commit acceptance reflects the gate (violation →
  `[~]`); the bug-6 `READY_TO_COMMIT` own-commit happy path is unchanged; the
  one-line-per-concern trust rule and untrusted-evidence frame are unchanged in meaning
  (diff shows only acceptance-outcome wording).
- Backward-compat prose holds: legacy `_fixed via …_` lines still parse/render; the
  well-behaved-commit normal case still accepts as before.

Phase exit criterion: all structural checks for the phase hold. A checklist item that
cannot be made to hold routes through the coder's BLOCKED step, not a silent rewrite.

## Dependencies

- None. (Consumes the accepted SPEC-20260721T222531Z-adaa as input and rides on the ADR-0008
  work-unit redefinition already merged via FEAT-…-7b61, but no prior plan must be DONE
  first.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-21T22:48:19Z | QA

QA-20260721T224738Z-33c0 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.

### 2026-07-21T22:46:29Z | REVIEWER

CR-20260721T224406Z-1725 created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-21T22:41:24Z | TESTER

TEST-20260721T224124Z-95bd created. Status: PASS. Coverage: N/A% → N/A% (doc-only; no
coverage instrument or e2e framework for doc skills per PROJECT-CONTEXT — floor N/A, not
a breach). All 12 ACs structurally verified; change confined to SKILL.md.

### 2026-07-21T22:35:30Z | CODER

All 14 tasks complete. Plan status → DONE. Ready for reviewer.

### 2026-07-21T22:34:02Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-21T22:31:00Z | ARCHITECT

Plan `FEAT-20260721T222950Z-7cf1` created. Type: feat. Tasks: 14.
Status: PLANNED. Ready for coder.
