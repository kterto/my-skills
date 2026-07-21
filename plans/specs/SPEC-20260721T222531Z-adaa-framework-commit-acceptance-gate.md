---
id: SPEC-20260721T222531Z-adaa
title: Validate framework-owned commits before accepting them as fixes
status: READY_FOR_PLANNING
created_at: 2026-07-21T22:27:32Z
updated_at: 2026-07-21T22:27:32Z
cycle: 0
related_to: SPEC-20260721T181347Z-1089, SPEC-20260721T215726Z-b751, ADR-0008
---

## Summary

In `validation-fixer` Step 3.4, when a framework commits a fix **autonomously**
(`gsd` commits atomically; `superpowers` may commit), the skill accepts the fix on
the sole test "terminal result was success **AND** `BEFORE_SHA..AFTER_SHA` ≥ 1
commit" (`plugins/my-skills/skills/validation-fixer/SKILL.md:324`). It verifies
**nothing** about that HEAD advance — not that the branch is still the preflighted
one, not that `BEFORE_SHA` is still an ancestor of `AFTER_SHA`, not that the
committed paths exclude the validation file(s), and not that the working tree is
otherwise clean. This spec adds a **post-run acceptance gate** to that one branch so
a framework-owned commit is accepted as a real fix only after those four invariants
hold, and otherwise the run is **rejected and safely isolated** (recorded `[~]`,
never `[x]`). It aligns with ADR-0008's work-unit model and touches no other lane.

## Goals

- A framework-owned HEAD advance is accepted as a fix (Step-3.4 "Framework signaled
  success AND HEAD advanced" branch, SKILL.md:324) **only after** verifying all four
  acceptance invariants: **(A)** the checked-out branch is unchanged from the value
  captured at Step 3.1; **(B)** `BEFORE_SHA` is a linear ancestor of `AFTER_SHA`
  (the advance is a fast-forward extension, so the recorded `BEFORE_SHA..AFTER_SHA`
  SHAs really are the fix commits); **(C)** the committed delta excludes every
  Step-1 validation file (path-exact); **(D)** the post-commit tree is clean once the
  Step-1 validation file(s) and the Step-3.1 pre-run untracked baseline are dropped.
- Any invariant violation means the framework-owned commit is **not** accepted as a
  fix — the item is recorded `[~]` (needs attention), never `[x]`.
- Violations are **safely isolated**: a violation that invalidates the safe-rollback
  precondition (branch changed, or ancestry broken) does **not** trigger a blind
  destructive `git reset --hard $BEFORE_SHA` on an unrecognized branch — it STOPs and
  surfaces the state for manual resolution instead.
- The change is confined to the framework-owned-commit acceptance branch; the
  orchestrator lane (never commits), the batch/main-agent/dedicated commit-ownership
  path, ADR-0008, and the superpowers/gsd per-item loops are otherwise untouched.

## Non-goals

- **sec-2** (autonomous rollback erasing concurrent work → isolated disposable
  worktree/clone per work unit) — a separate, heavier remediation in the same review
  §Security; out of scope. This spec adds a validation gate on the shared worktree,
  not worktree isolation.
- **sec-3** (default protected set misses the repo default branch) — separate finding.
- **bug-4** (porcelain parsing not path-exact for unusual filenames) — separate
  finding. This spec **reuses** the skill's existing Step-3.1 porcelain-parsing +
  validation-file-exemption approach verbatim for its post-run clean-tree check; it
  does not independently reinvent parsing, and bug-4 will harden that parsing
  everywhere it is used.
- Re-opening or altering **ADR-0008** (work-unit commit ownership / batch atomicity)
  — the acceptance gate is additive to it, never a revert.
- Changing validation-fixer's **own-commit** path (Step-3.4 "HEAD unchanged, tree
  dirty, success" branch), which already controls exactly what it stages
  (`git add -- <code>…`, never the validation file) and re-asserts protected-branch
  before committing — beyond optionally sharing the branch-capture helper (see FR-6).
- Adding a `.opencode` override port for `validation-fixer` (it ships a single copy —
  no override port on disk; see Project-context fit).
- Committing or pushing the fix (the pipeline stops at READY_TO_COMMIT).

## Users and use cases

- **Downstream `validation-fixer` operator** running framework `gsd` or
  `superpowers` (the frameworks that commit autonomously) over a findings backlog:
  success = an item is marked `[x]` with a `_fixed via <framework> · <sha> · <date>_`
  provenance line **only** when the recorded SHA truly is the fix, on the intended
  branch, without the backlog swept into the commit and without leftover uncommitted
  fix work. A contaminated or partial framework commit is caught and surfaced, not
  silently blessed.
- **Skill maintainer (this repo's author)**: relies on the invariant that a fix
  commit is a clean, code-only, same-branch fast-forward whose provenance SHA is
  trustworthy — the same guarantees the own-commit path already enforces, now also
  enforced for framework-owned commits.

## Functional requirements

1. **Capture the branch identity at Step 3.1, alongside `BEFORE_SHA`.** When Step 3.1
   records `BEFORE_SHA` and the pre-run untracked baseline for a work unit, it MUST
   also record the current branch name (`git rev-parse --abbrev-ref HEAD`) as
   `BEFORE_BRANCH`. This is the reference the post-run gate compares against.

2. **Gate the framework-owned-commit acceptance branch (SKILL.md:324).** Before the
   "Framework signaled success AND HEAD advanced" branch concludes "the framework
   committed the fix; it is real, nothing to commit," it MUST verify **all four**
   acceptance invariants (order the architect may choose, but structural checks A/B
   before destructive handling):
   - **(A) Branch unchanged.** `git rev-parse --abbrev-ref HEAD` equals
     `BEFORE_BRANCH`, is not a detached HEAD, and is not a protected branch
     (`main`/`master`/`dev`, per the same protected set the Step-2 preflight uses).
   - **(B) Linear ancestry.** `git merge-base --is-ancestor "$BEFORE_SHA"
     "$AFTER_SHA"` succeeds — the HEAD advance is a fast-forward extension of the
     pre-run commit, so `BEFORE_SHA..AFTER_SHA` enumerates exactly the fix commits
     and the recorded provenance SHA(s) are meaningful (a switched branch or a
     rewritten history that orphaned `BEFORE_SHA` fails here even though a naive
     `≥ 1 commit` count would pass).
   - **(C) Committed paths exclude the validation file(s).** The set of paths changed
     across `BEFORE_SHA..AFTER_SHA` MUST contain **no** Step-1 validation file,
     matched **path-exact** (repo-relative, the same matcher as the Step-3.1
     exemption — never a glob, never "any `.md`"). This upholds the standing contract
     that the backlog is the skill's untracked scratchpad and is **never committed as
     part of a fix**. (A backlog an operator committed *before* the run lives in
     `BEFORE_SHA`, not in the `BEFORE_SHA..AFTER_SHA` delta, so it is unaffected.)
   - **(D) Clean non-validation tree.** After the framework's commit, `git status
     --porcelain` — with the Step-1 validation file(s) and the Step-3.1 pre-run
     untracked baseline dropped, exactly as the Step-3.1 gate and bug-15 baseline
     already do — MUST be empty. Leftover dirty tracked edits or new untracked files
     (not the backlog) mean the framework left uncommitted fix work; the advance is
     not "nothing to commit."

3. **On any acceptance-invariant failure, do not mark the item fixed.** A
   framework-owned commit that fails **any** of A–D is **not** a fix. Route it to the
   existing "Framework did NOT signal success" handling outcome — record `- [~]`
   (needs attention), never `- [x]` — so the item resurfaces on re-run. This mirrors
   the bug-12 principle (a commit alone never means fixed) for the case where the
   commit exists and the terminal was success but the commit is structurally
   unacceptable.

4. **Safely isolate structural violations (A/B) — no blind reset on an unknown
   branch.** The skill's rollback (`git reset --hard $BEFORE_SHA` + untracked
   cleanup) assumes the preflighted branch with `BEFORE_SHA` as a valid ancestor.
   When **(A)** branch changed or **(B)** ancestry is broken, that precondition no
   longer holds, so the skill MUST NOT perform the destructive validation-file-
   preserving rollback against the current (unrecognized) branch. Instead it MUST
   **STOP and surface** the observed state (current branch, `BEFORE_BRANCH`,
   `BEFORE_SHA`, `AFTER_SHA`, `git status --porcelain`, `git log --oneline
   "$BEFORE_SHA".."$AFTER_SHA"`) and the specific violated invariant, record the item
   `- [~]`, and let the operator reconcile manually. **This STOP applies in autonomous
   mode too** — a repo left on an unexpected branch or with rewritten history is a
   state the skill cannot safely auto-reconcile, analogous to the bug-7 protected-
   branch STOP; safety wins over unattended progress. The architect decides whether a
   structural violation aborts the whole remaining run or halts at just this work unit
   and surfaces, but it MUST NOT destructively reset an unrecognized branch.

5. **Content violations (C/D) use the existing validation-file-preserving rollback.**
   When A and B hold (same branch, valid ancestry) but **(C)** the delta committed a
   validation file or **(D)** the tree is left dirty, the safe-rollback precondition
   is intact, so the run reuses the **existing** failure handling verbatim:
   - **autonomous:** validation-file-preserving rollback (bug-11, bug-15) to
     `$BEFORE_SHA` — discarding the framework's partial commits, tracked edits, and
     new untracked files while preserving every validation file — and record `- [~]`.
   - **checkpoint:** STOP and surface the partial work (as the current "did NOT signal
     success / checkpoint" branch already does), let the operator roll back or keep,
     record `- [~]` either way.
   No new rollback machinery is introduced; C/D reuse the current path.

6. **Confine the change; keep the own-commit path's existing guarantees.** The gate
   is added to the framework-owned-commit acceptance branch only. The Step-3.4
   own-commit path (orchestrator `READY_TO_COMMIT`, main-agent lane, batch lane) is
   unchanged: it already stages code paths explicitly, never stages the validation
   file, and re-asserts protected-branch before committing. Reusing the same
   `BEFORE_BRANCH` capture helper on that path is **permitted but not required** (its
   commit is on the current HEAD, so ancestry is inherent); the architect may share
   the helper for symmetry without expanding scope. All four acceptance checks MUST
   reuse the skill's existing primitives (Step-3.1 porcelain parsing, the path-exact
   validation-file exemption, the pre-run untracked baseline, the protected set) —
   they are not to be reinvented divergently.

7. **Keep the regression traces and Edge cases consistent.** The "Autonomous two-item
   lifecycle (bug-6)" trace's happy path is a `READY_TO_COMMIT` orchestrator run (own-
   commit path) and is unaffected; if any trace or the Edge-cases / Notes sections
   describe framework-owned-commit acceptance, they MUST be updated to reflect the new
   gate (a framework commit that violates A–D → `[~]`, not `[x]`). No change to the
   one-backlog-line-equals-one-concern trust rule or the untrusted-evidence frame.

## Non-functional requirements

- **Performance**: — (a handful of local `git` plumbing calls per framework-owned
  work unit; negligible.)
- **Security / auth**: This IS a security hardening. It upholds the standing
  invariants that (a) the validation backlog is untracked scratchpad **never
  committed as part of a fix** (path-exact exclusion), (b) each work unit is a clean,
  same-branch, fast-forward code change, and (c) a recorded provenance SHA is
  trustworthy. The untrusted-evidence frame, one-line-per-concern rule, and sec-3
  shell-safe commit construction are unchanged. No item text is executed; all checks
  are on git state, not on backlog text.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: —
- **Monetization tier**: —

## Project-context fit

- **Layers touched:** the `validation-fixer` skill source only
  (`plugins/my-skills/skills/validation-fixer/SKILL.md`) — a prose/procedure change
  to Step 3.1 (capture `BEFORE_BRANCH`) and Step 3.4 (the framework-owned-commit
  acceptance branch, anchor line 324), plus consistency touch-ups to Edge
  cases/Notes/traces if they describe that branch. No JS, no templates, no ADR change.
- **Invariant reinforced, not amended:** PROJECT-CONTEXT §Invariants line 68 names
  `validation-fixer` as the single never-commit exception, bounded by "atomic
  per-work-unit rollback … clean-tree-per-unit … `_fixed via <sha>_` provenance."
  This gate makes the **framework-owned** commit honor those same bounds; it neither
  broadens the exception nor changes which skill may commit, so the invariant text
  needs **no** edit. (Contrast the sibling SPEC-…-b751, which *did* amend line 68 for
  the work-unit redefinition; this spec rides on that redefinition unchanged.)
- **ADR alignment:** ADR-0008 defines the work unit as the revertible unit and its
  rollback as validation-file-preserving. The acceptance gate slots in *before* a
  framework-owned commit is blessed as that revertible unit; a failing gate routes to
  ADR-0008's existing `[~]` failure handling. No ADR change is required (the architect
  may add a short ADR-0008 cross-reference note in SKILL.md at their discretion, but a
  new ADR is not warranted — this is an enforcement detail of an existing decision).
- **Convention — mirror machinery / single-source-of-truth:** the four checks reuse
  the existing Step-3.1 primitives (porcelain parsing, path-exact exemption, untracked
  baseline, protected set) rather than duplicating parsing logic — consistent with the
  repo's "reuse established shape, document only deliberate divergences" convention.
- **Backward compatibility (mandatory invariant):** purely additive verification.
  Legacy `_fixed via <framework> · <sha> · <date>_` lines still parse/render; a
  well-behaved framework commit (same branch, fast-forward, code-only, clean tree —
  the normal case) passes all four checks and is accepted exactly as before. Only
  previously-mis-accepted (contaminated/partial/branch-switched) commits change
  outcome, from a false `[x]` to a correct `[~]`.
- **opencode-port-parity:** `validation-fixer` ships a **single copy** — no
  `.opencode/skills/validation-fixer/` override port (confirmed on disk; only
  `pr-review-report` and `spec-driven-eval` have ports). No port mirror is due.
- **Precedent/dependency:** SPEC-20260721T181347Z-1089 introduced the severity
  routing; SPEC-20260721T215726Z-b751 + ADR-0008 redefined the revertible unit as a
  work unit. This spec is the security follow-up hardening the framework-owned-commit
  side of that same Step-3.4 reconciliation.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**:
  - `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 3.1 (add
    `BEFORE_BRANCH` capture alongside `BEFORE_SHA`/untracked baseline); Step 3.4 the
    "Framework signaled success AND HEAD advanced" branch (anchor line 324) gains the
    four-invariant acceptance gate + safe-isolation routing; Edge cases / Notes /
    regression-trace touch-ups where they describe framework-owned-commit acceptance.
    No ADR, template, or PROJECT-CONTEXT edit required.

## Open questions

<!-- Empty: the concern is fully specified and every unknown is resolved by an
     auditable default below. No reserved decision (out-of-scope / product /
     compliance / irreversible) remains. -->

- (none)

## Decisions resolved by Brainstormer default

- **Remediation shape — validation gate vs. worktree isolation** → **Default: a
  post-run acceptance gate on the shared worktree** (the four A–D invariant checks),
  not sec-2's isolated disposable worktree/clone → the finding sec-1's own Fix text
  asks to "verify the original branch, linear ancestry, expected committed paths, and
  a clean non-validation tree; reject and safely isolate" — a validation gate, not
  isolation. Worktree isolation is sec-2's separate, heavier remediation and is out of
  scope; keeping this spec to the gate honors the "one concern only" instruction.
- **Behavior on structural violation (branch changed / ancestry broken) in autonomous
  mode** → **Default: STOP and surface, do NOT auto-`reset --hard`** → a blind
  destructive reset assumes the preflighted branch with `BEFORE_SHA` as ancestor; when
  that precondition is gone, resetting an unrecognized branch could destroy unrelated
  state (the sec-2 concern in miniature). Safety wins over unattended progress, exactly
  as the bug-7 protected-branch preflight already STOPs autonomous runs.
- **Behavior on content violation (validation file committed / dirty tree) with branch
  + ancestry intact** → **Default: reuse the existing validation-file-preserving
  rollback (autonomous) / surface-for-decision (checkpoint), record `[~]`** → the safe-
  rollback precondition holds, so no new machinery is needed; it collapses onto the
  current "did NOT signal success" path.
- **Whether to also gate validation-fixer's own-commit path** → **Default: no new gate
  there; sharing the `BEFORE_BRANCH` helper is optional** → that path already stages
  explicitly, never stages the validation file, commits on the current HEAD (ancestry
  inherent), and re-asserts protected-branch; the cited concern (line 324) is
  framework-owned commits only. Keeps the change scoped to the one concern.
- **Whether a new ADR is warranted** → **Default: no new ADR; this is an enforcement
  detail of ADR-0008** → the gate does not change the commit-ownership *decision*, only
  enforces that a framework-owned commit qualifies as ADR-0008's revertible work unit
  before acceptance. Architect may add a one-line ADR-0008 cross-reference in SKILL.md.

## References

- `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md`
  §Security → finding `sec-1` (the source concern).
- `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 3.4
  framework-owned-commit acceptance branch (anchor line 324); Step 3.1 gate/capture
  (lines 232–282); own-commit path (lines 330–375); validation-file-preserving
  rollback (bug-11/bug-15, lines 254–282); bug-12 committed-then-blocked rule.
- `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` — the
  commit-ownership contract this gate enforces admission to.
- `.orchestrator/PROJECT-CONTEXT.md` §Invariants line 68 — the documented
  never-commit exception and its clean-tree / provenance / rollback bounds (reinforced,
  not amended, by this spec).
- Sibling specs: `plans/specs/SPEC-20260721T181347Z-1089-orchestrator-skill-severity-routing.md`,
  `plans/specs/SPEC-20260721T215726Z-b751-validation-fixer-batch-commit-boundary.md`.
