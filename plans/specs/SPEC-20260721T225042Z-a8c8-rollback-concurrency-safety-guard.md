---
id: SPEC-20260721T225042Z-a8c8
title: Guard autonomous rollback against erasing concurrent work
status: READY_FOR_PLANNING
created_at: 2026-07-21T22:53:23Z
updated_at: 2026-07-21T22:53:23Z
cycle: 0
related_to: SPEC-20260721T222531Z-adaa, SPEC-20260721T215726Z-b751, SPEC-20260721T181347Z-1089, ADR-0008
---

## Summary

`validation-fixer`'s failure-path rollback (bug-11 / bug-15, `plugins/my-skills/skills/validation-fixer/SKILL.md`
~lines 254-283) restores a work unit's clean start by running `git reset --hard "$BEFORE_SHA"`
(whole tree) followed by deletion of untracked files new since a pre-run baseline (documented as
"equivalently `git clean -fd`"). The Step-3.1 clean-tree gate only proves the tree was clean at the
work unit's **start**; a framework run can be long, and any user or parallel-agent edit that lands in
the **shared** worktree *during* the run is indistinguishable from framework output at rollback time.
In autonomous mode the rollback then erases those concurrent edits **without confirmation** (finding
sec-2). This spec adds a proportionate concurrency-safety guard to the rollback — a documented
exclusive-worktree precondition, a reduced deletion blast radius, and a STOP-and-surface for detectable
concurrent modification — rather than re-architecting the skill onto isolated per-work-unit worktrees.
It aligns with ADR-0008's work-unit rollback model and sec-1's "unsafe states STOP regardless of mode"
precedent, and touches no other lane.

## Goals

- The autonomous failure-path rollback (bug-11 / bug-15) no longer **silently** destroys changes it
  cannot attribute to the failing framework work unit. Where concurrent modification is **detectable**,
  the skill **STOPs and surfaces** the observed state (records `- [~]`) instead of blindly running
  `git reset --hard` + untracked deletion — binding **autonomous** mode too, exactly as sec-1's
  structural-violation STOP and the bug-7 protected-branch preflight already do.
- The untracked-deletion step's **blast radius is reduced**: it removes an **explicitly enumerated** set
  of untracked paths new since the Step-3.1 pre-run baseline via a scoped `rm`, and **never** uses
  `git clean -fd` (which sweeps *all* untracked-but-not-ignored files, including concurrently-created
  ones) and never `-x`. The `git clean -fd` equivalence is removed from the documented rollback.
- The **exclusive-worktree precondition** the rollback silently relies on is made **explicit and loud**:
  a run owns the shared worktree for its duration; concurrent edits to it are unsupported and now
  detected-and-surfaced rather than destroyed.
- The change is **confined** to the failure-path rollback mechanics and its precondition. The
  commit-ownership decision (ADR-0008), the sec-1 acceptance gate, the validation-file-preserving
  guarantees (bug-11 tracked side, bug-15 untracked side), the untrusted-evidence frame, and the
  superpowers/gsd/orchestrator lane structure are otherwise untouched.
- **Backward compatibility holds:** for a run that *did* have exclusive use of the worktree (the normal
  case — no concurrent edits), the rollback behaves exactly as today; only runs where a concurrent edit
  is detected change outcome, from silent destruction to a surfaced `- [~]`.

## Non-goals

- **Full worktree isolation** (sec-2's *proposed* Fix — run each work unit in an isolated disposable
  worktree/clone and discard it on failure). Explicitly **out of scope** for this fix: it is a heavy
  re-architecture of a doc-skill's git-transaction model (the orchestrator Skill, superpowers/gsd, and
  the main-agent inline lane all run in the **caller session** against the caller's cwd; relocating each
  work unit into a disposable worktree is a separate, ADR-worthy one-way-door decision). The orchestrator
  steer for this concern was to weigh a proportionate mitigation against isolation and record the chosen
  default — recorded below as the proportionate guard. Isolation may be revisited later as its own spec.
- Re-opening or altering **ADR-0008** (work-unit commit ownership / batch atomicity) — this guard is
  additive to its rollback definition, never a revert.
- Altering the **sec-1 acceptance gate** (SPEC-…-adaa) or its structural-violation STOP — this guard
  is a **sibling** safety check on the *rollback* step, reusing the same STOP-and-surface pattern; the
  two compose, they do not overlap or contradict.
- Changing **who commits**, the sec-3 shell-safe commit construction, the untrusted-evidence frame, the
  one-backlog-line-equals-one-concern trust rule, or the severity-routing lanes.
- The **success path** (accepting a fix) — except that its *routing into* the rollback (sec-1's content
  violations C/D, and BLOCKED/errored/rejected outcomes) now flows through the guarded rollback like
  every other rollback caller.
- Adding a `.opencode` override port for `validation-fixer` (it ships a **single copy** — no override
  port on disk; only `pr-review-report` and `spec-driven-eval` have ports). No port mirror is due.
- Committing or pushing (the skill's commit ownership is unchanged; this touches only rollback).

## Users and use cases

- **Downstream `validation-fixer` operator** running an autonomous "fix everything" sweep on a feature
  branch while (knowingly or not) another agent or an editor session touches the same repo: today a
  framework failure mid-sweep can wipe their concurrent, unrelated edits with no prompt. After this fix
  the skill either had exclusive use of the tree (rollback unchanged) or **detects** the concurrent
  change and STOPs with the observed state, leaving the operator to reconcile — no silent data loss.
- **Skill maintainer (this repo's author):** relies on the invariant that `validation-fixer`'s
  destructive git operations are bounded to *its own* work unit's delta and never quietly reach beyond
  it — the same "never blind-destroy an unrecognized state" posture sec-1 established for branch/ancestry
  violations, now extended to concurrent worktree modification.

## Functional requirements

1. **Document the exclusive-worktree precondition (make the silent assumption explicit).** Add a
   **Preconditions** note (near the Step-2 preflight / Step-3.1 gate) stating that a `validation-fixer`
   run operates on the **shared** working tree and requires **exclusive** control of it for the run's
   duration: concurrent user or parallel-agent edits to tracked files, or creation of untracked files,
   *during* a framework work unit are unsupported, because the failure-path rollback is a worktree-level
   operation. The note must state that where such concurrent changes are **detected**, the skill STOPs
   and surfaces rather than destroying them (FR-3), and that isolated per-work-unit worktrees (sec-2's
   heavier option) are a deliberately deferred alternative (Non-goal).

2. **Reduce the untracked-deletion blast radius; forbid `git clean -fd`/`-x` in the rollback.** In the
   bug-15 rollback step 3 (SKILL.md ~lines 273-279), the "or, equivalently, `git clean -fd`" clause MUST
   be **removed**. The rollback MUST delete untracked files by **explicitly enumerating** the paths that
   are untracked **now** and **not** in the Step-3.1 pre-run untracked baseline, and `rm`-ing exactly
   that enumerated set (path-safe: `--` / NUL-safe handling consistent with the skill's existing porcelain
   parsing; `git clean -fd` is forbidden because it sweeps *every* untracked-but-not-ignored path,
   including concurrently-created ones, and `-x` remains forbidden as today). The enumerated removal set
   is the input to the FR-3 concurrency check.

3. **Detectable concurrent modification → STOP and surface, never blind-destroy (binds autonomous mode).**
   Before performing the destructive rollback (`git reset --hard "$BEFORE_SHA"` + the FR-2 enumerated
   untracked `rm`) in **autonomous** mode, the skill MUST verify the worktree's current changes are
   confined to the failing framework work unit's own delta, and MUST **STOP and surface** (record
   `- [~]`, never `- [x]`, never reset) when it detects a change it cannot attribute to that work unit —
   evidence of a concurrent actor. The **detectable** cases the skill MUST guard (the architect defines
   the precise checks, reusing existing primitives — Step-3.1 porcelain parsing, the `BEFORE_SHA..AFTER_SHA`
   committed delta from sec-1, the pre-run untracked baseline, the path-exact validation-file exemption):
   - **Tracked side:** a tracked path modified in the working tree that lies **outside** the work unit's
     attributable committed delta (`git diff --name-only "$BEFORE_SHA" "$AFTER_SHA"` for the committed
     case) is a candidate concurrent edit that `git reset --hard` would erase → STOP-and-surface.
   - **Untracked side:** the FR-2 enumerated removal set is presented in the surfaced state; the guard
     applies here in that the removal set is auditable and the STOP fires when the tracked-side check
     (or any architect-defined heuristic for unexpected untracked additions) indicates concurrency.
   The surfaced state MUST include (mirroring sec-1's structural-violation surface): the current branch,
   `BEFORE_SHA`, `AFTER_SHA`, `git status --porcelain`, `git log --oneline "$BEFORE_SHA".."$AFTER_SHA"`,
   the enumerated untracked-removal set, and the specific reason (which change could not be attributed).
   This STOP **binds autonomous mode** — a shared worktree carrying unattributable concurrent changes is
   a state the skill cannot safely auto-reconcile, exactly analogous to the bug-7 protected-branch STOP
   and sec-1's structural (A/B) STOP; safety wins over unattended progress.

4. **Acknowledge the inherently-unattributable case honestly.** For a failure where the framework left
   **only uncommitted** changes (e.g. orchestrator `BLOCKED` with a dirty tree, no commit), the framework's
   output is not individually labeled in git state, so tracked-side attribution against a committed delta
   is not available. The spec MUST make the skill's posture explicit here: it proceeds on the **documented
   exclusive-worktree precondition** (FR-1) — the whole non-baseline dirty/untracked set is treated as the
   work unit's delta — **but** the FR-2 blast-radius reduction still applies (no `git clean -fd`/`-x`; the
   removal set is explicitly enumerated and surfaced), and any tracked-side signal the architect *can*
   compute (e.g. modifications to paths the framework run had no plausible reason to touch, if such a
   heuristic is defined) still triggers the FR-3 STOP. The architect MUST NOT claim perfect attribution
   for the uncommitted-only case; the precondition, the reduced blast radius, and the surfaced removal set
   are the mitigation there. (This keeps autonomous progress possible in the common single-actor case
   while removing the `git clean -fd` "sweep everything" hazard the finding names.)

5. **Preserve every existing rollback guarantee.** The guard is **additive** to the bug-11/bug-15
   validation-file-preserving rollback: the snapshot → reset → untracked-removal → rewrite sequence, the
   tracked-side preservation of prior items' `[x]` bookkeeping (bug-11), the untracked-side removal of the
   framework's new files (bug-15), the never-`git add`/commit-the-validation-file rule, and the bug-12
   committed-then-blocked handling are all retained. When the guard does **not** fire (no concurrency
   detected — the normal exclusive-worktree case), the rollback executes **exactly as today** (minus the
   removed `git clean -fd` equivalence, replaced by the equivalent enumerated `rm`). No new machinery is
   introduced beyond the enumerated-removal computation and the concurrency STOP.

6. **Apply the guard at every rollback caller, once.** The destructive rollback is invoked from several
   places — a rejected checkpoint commit, a `BLOCKED`/errored/aborted framework (Step 3.4), sec-1's
   content-violation (C/D) autonomous rollback, and the batch lane's whole-batch rollback. The guard MUST
   be defined **once** (as part of the single validation-file-preserving-rollback recipe) so **every**
   caller inherits it, rather than special-casing one path. For a **batch** work unit, "the work unit's
   delta" is the **whole batch's** delta, consistent with ADR-0008. Checkpoint mode already STOPs and
   surfaces the partial work for the operator's roll-back/keep decision, so the concurrency risk there is
   already operator-gated; the new autonomous STOP brings autonomous mode to the same safety level.

7. **Keep regression traces, Edge cases, and Notes consistent.** The bug-6 (autonomous two-item) and
   bug-11 (tracked-backlog rollback) traces MUST still hold verbatim (their rollbacks occur on a worktree
   with no concurrent edits, so the guard does not fire). Add a short **concurrency-STOP** worked note or
   Edge-case entry: an autonomous rollback that detects a tracked change outside the work unit's delta
   STOPs and records `- [~]` instead of `reset --hard`. The Edge-cases / Notes sections MUST be updated
   wherever they describe the rollback as an unconditional `git reset --hard` + `git clean` so they
   reflect the enumerated-removal + concurrency-STOP behavior. No change to the one-backlog-line-equals-
   one-concern trust rule or the untrusted-evidence frame.

## Non-functional requirements

- **Performance**: — (a few additional local `git` plumbing reads — `git status --porcelain`, a
  `git diff --name-only` set comparison — per rollback; negligible, and only on the failure path.)
- **Security / auth**: This IS a security hardening (finding sec-2, `high`). It removes a silent
  data-loss path (autonomous destruction of unattributable concurrent work) and bounds the skill's
  destructive git operations to its own work unit's delta, converting an unsafe auto-destroy into a
  surfaced STOP. No item text is executed; all checks are on git state, not on backlog text. The
  untrusted-evidence frame, one-line-per-concern rule, and sec-3 shell-safe construction are unchanged.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: —
- **Monetization tier**: —

## Project-context fit

- **Layers touched:** the `validation-fixer` skill source **only**
  (`plugins/my-skills/skills/validation-fixer/SKILL.md`) — a prose/procedure change to the bug-11/bug-15
  rollback recipe (~lines 254-283), a new Preconditions note near Step 2 / Step 3.1, and consistency
  touch-ups to the traces / Edge cases / Notes. No JS, no templates, no ADR change.
- **Aligns with the two most recent sibling landings on this branch — do not revert either:**
  - **sec-1 acceptance gate (SPEC-…-adaa):** established the "structural violations STOP and surface,
    do NOT reset an unrecognized branch — binds autonomous mode" precedent. This guard reuses that exact
    pattern for a *different* trigger (concurrent worktree modification) and reuses sec-1's
    `BEFORE_SHA..AFTER_SHA` committed-delta primitive for tracked-side attribution. The two STOPs compose
    (branch/ancestry from sec-1; concurrency from this spec) into the same `- [~]` + surface outcome.
  - **arch-1 / ADR-0008 (SPEC-…-b751):** the rollback is per **work unit** (single item, or a whole
    batch). This guard's "the work unit's delta" honors that: a batch's attributable delta is the whole
    batch's. No ADR change — this is an enforcement/safety refinement of ADR-0008's existing rollback,
    exactly as sec-1 was an enforcement refinement of its acceptance side. The architect MAY add a
    one-line ADR-0008 cross-reference in SKILL.md; a new ADR is **not** warranted.
- **Invariant reinforced, not amended:** PROJECT-CONTEXT §Invariants line 68 bounds the never-commit
  exception by "atomic per-work-unit rollback (`git reset --hard $BEFORE_SHA`, validation-file-preserving)".
  This spec keeps that rollback and its wording; it adds a **safety guard** around *when* the destructive
  reset may run autonomously and *how* untracked deletion is scoped. It neither broadens the exception nor
  changes which skill may commit, so the invariant text needs **no** edit.
- **Convention — mirror machinery / single-source-of-truth:** the guard reuses existing Step-3.1
  primitives (porcelain parsing, path-exact validation-file exemption, pre-run untracked baseline) and
  sec-1's committed-delta primitive rather than duplicating logic — consistent with the repo's "reuse
  established shape, document only deliberate divergences" convention. bug-4 (porcelain parsing not
  path-exact for unusual filenames) is a **separate** finding that will harden that shared parsing; this
  spec rides on the existing parsing and does not reinvent it.
- **Backward compatibility (mandatory invariant):** purely additive safety. A run with exclusive
  worktree use (the normal case) rolls back exactly as before; legacy `_fixed via …_` provenance lines
  still parse/render; `[x]`/`[~]`/`[ ]` re-run semantics are unchanged. Only a run that detects concurrent
  modification changes outcome — from silent destruction to a correct, surfaced `- [~]`.
- **opencode-port-parity:** `validation-fixer` ships a **single copy** — no
  `.opencode/skills/validation-fixer/` override port (confirmed on disk). No port mirror is due.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**:
  - `plugins/my-skills/skills/validation-fixer/SKILL.md` —
    - the bug-11 / bug-15 validation-file-preserving rollback recipe (~lines 254-283): remove the
      `git clean -fd` equivalence; require an enumerated `rm` of only non-baseline untracked paths; add
      the pre-reset autonomous concurrency STOP that surfaces unattributable changes and records `- [~]`;
    - a new **Preconditions** note near the Step-2 preflight / Step-3.1 gate documenting the exclusive-
      worktree requirement and the deferred worktree-isolation alternative;
    - the shared rollback is invoked by all callers (checkpoint rejection, BLOCKED/errored, sec-1 C/D
      autonomous, batch whole-batch), so the single recipe edit propagates to each;
    - consistency touch-ups: the bug-6 / bug-11 regression traces (must still hold), a new concurrency-STOP
      note/Edge-case, and any Edge cases / Notes describing the rollback as an unconditional
      `git reset --hard` + `git clean`.
    - No ADR, template, or PROJECT-CONTEXT edit required.

## Open questions

<!-- Empty: the concern is fully specified and every unknown is resolved by an auditable default below.
     The one heavy alternative (full worktree isolation) is a deliberately deferred Non-goal, not an
     unresolved reserved decision — the orchestrator prompt explicitly authorized choosing a proportionate
     mitigation over isolation and recording the default with rationale. No out-of-scope creep, product,
     compliance, or irreversible decision remains open. -->

- (none)

## Decisions resolved by Brainstormer default

- **Remediation shape — proportionate concurrency guard vs. full worktree isolation** →
  **Default: a proportionate guard on the shared worktree** (documented exclusive-worktree precondition +
  reduced untracked-deletion blast radius, no `git clean -fd`/`-x` + autonomous STOP-and-surface on
  detectable concurrent modification), **not** sec-2's isolated disposable worktree/clone per work unit →
  the orchestrator prompt explicitly steered me to weigh a proportionate mitigation against isolation and
  record the chosen default; isolation is a heavy re-architecture of a doc-skill's git-transaction model
  (frameworks and the inline main-agent lane all run in the caller session/cwd) and a separate one-way-door
  decision, disproportionate to fixing this one concern. Isolation is recorded as a deferred Non-goal for a
  possible future spec, not adopted here.
- **Does the autonomous STOP bind autonomous mode (vs. only warn)?** → **Default: yes, it binds
  autonomous mode** — detected concurrent modification STOPs and surfaces (records `- [~]`), never
  auto-`reset --hard` → matches sec-1's structural-violation STOP and the bug-7 preflight, both of which
  already halt autonomous runs on states unsafe to auto-resolve; safety over unattended progress.
- **How to handle the inherently-unattributable uncommitted-only failure (BLOCKED, dirty tree, no
  commit)?** → **Default: proceed on the documented exclusive-worktree precondition, but still apply the
  blast-radius reduction (enumerated `rm`, no `git clean -fd`) and surface the removal set; do not claim
  perfect attribution** → git state cannot label uncommitted framework output, so a hard STOP on every
  such failure would defeat autonomy for the common single-actor case; the precondition + reduced blast
  radius + surfaced removal set is the honest, proportionate mitigation there, and any computable
  tracked-side heuristic still triggers the STOP.
- **Replace `git clean -fd` with what?** → **Default: an explicitly enumerated `rm` of exactly the
  untracked paths new since the Step-3.1 pre-run baseline (path/NUL-safe), forbidding `git clean -fd` and
  `-x`** → `git clean -fd` is precisely the "removes everything untracked, including concurrent work"
  hazard the finding names; an enumerated removal set is auditable, surfaceable, and bounded to the
  baseline diff.
- **Is a new ADR warranted?** → **Default: no new ADR; this is an enforcement/safety detail of ADR-0008**
  → the guard does not change the commit-ownership or rollback *decision*, only bounds *when/how* the
  existing rollback destroys — mirroring how sec-1 hardened acceptance without a new ADR. Architect may add
  a one-line ADR-0008 cross-reference in SKILL.md.
- **Define the guard once vs. per caller?** → **Default: once, inside the single validation-file-preserving
  rollback recipe, so every caller (checkpoint rejection, BLOCKED/errored, sec-1 C/D, batch) inherits it**
  → consistent with the skill's single-source-of-truth rollback machinery and avoids drift.

## References

- `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md` §Security →
  finding `sec-2` (the source concern).
- `plugins/my-skills/skills/validation-fixer/SKILL.md` — the bug-11 / bug-15
  validation-file-preserving rollback (~lines 254-283, `git reset --hard` at 271, `git clean -fd`
  equivalence at 277); the Step-3.1 clean-tree gate + pre-run untracked baseline (lines 232-283); the
  Step-2 protected-branch preflight (bug-7); the bug-6 and bug-11 regression traces.
- `plans/specs/SPEC-20260721T222531Z-adaa-framework-commit-acceptance-gate.md` (sec-1) — the sibling
  acceptance gate whose structural-violation STOP-and-surface pattern (and `BEFORE_SHA..AFTER_SHA`
  committed-delta primitive) this guard reuses.
- `plans/specs/SPEC-20260721T215726Z-b751-validation-fixer-batch-commit-boundary.md` and
  `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` — the work-unit rollback contract this
  guard enforces admission to (batch delta = whole-batch delta).
- `.orchestrator/PROJECT-CONTEXT.md` §Invariants line 68 — the never-commit exception's
  "atomic per-work-unit rollback, validation-file-preserving" bound (reinforced, not amended).
