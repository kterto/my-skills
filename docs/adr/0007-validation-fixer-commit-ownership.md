# ADR-0007 — Commit ownership after READY_TO_COMMIT (validation-fixer exception)

- **Status:** Accepted
- **Date:** 2026-07-20
- **Skills affected:** `validation-fixer` (`SKILL.md` Step 3.4); the repo commit policy in `.orchestrator/PROJECT-CONTEXT.md` §Invariants
- **Source finding:** arch-4 — "Validation-fixer takes commit ownership against trusted policy" (`SKILL.md` Step 3.4). Amends the never-commit invariant; interacts with bug-1 (`d721104`).

## Context

The repo commit policy (`.orchestrator/PROJECT-CONTEXT.md` §Invariants) is:

> **Staged-diff → gate → write → propose-commit → never-commit** for every mutating
> skill op; the orchestrator/PM stop at `READY_TO_COMMIT` and never commit or push.

That invariant was written for the **orchestrator pipeline** (and PM): a single feature
runs `brainstormer → … → qa`, stops at `READY_TO_COMMIT`, and a **human commits once**.
The rule exists so no skill autonomously mutates history — the human is the commit actor.

`validation-fixer` is a **different class of actor**. It walks a findings backlog and, per
item, invokes a framework (`superpowers` / `gsd` / `orchestrator`) to fix that one concern,
then records the outcome back into the `.md` (its resumable source of truth). Frameworks
disagree on who commits: `gsd` commits atomically (HEAD advances), `superpowers` may leave
changes uncommitted, and the `orchestrator` deliberately **stops at `READY_TO_COMMIT` and
never commits** — its contract ends there *precisely so its caller commits*.

`bug-1` (`d721104`) made `validation-fixer` own that per-item commit, because otherwise a
successful orchestrator fix (dirty tree, no HEAD advance) was mis-recorded as `- [~]`
needs-attention. Correct in effect, but it moved commit ownership into a skill without an
approved exception to the never-commit invariant — the defect `arch-4` raises.

Reverting to strict compliance (leave every fix at `READY_TO_COMMIT`, human commits) is
**not viable** here, because the surrounding design depends on a real per-item commit:

1. **Provenance.** The findings-`.md` records `_fixed via <framework> · <short-sha(s)> ·
   <date>_` per item; `arch-2` prior-only retention carries that commit evidence forward
   after a finding leaves the diff. Both require a per-item **SHA** that only a commit
   produces.
2. **Clean-tree-per-item precondition.** Each item's framework run assumes a clean start;
   leaving item *N*'s **code** changes uncommitted co-mingles them with item *N+1*, and the
   rollback (`git reset --hard $BEFORE_SHA`) that protects a rejected/failed item would
   then also destroy prior items' accepted work. (The precondition is clean-except-the-
   validation-file: that file is the skill's untracked scratchpad, exempt from the gate and
   never committed — see `SKILL.md` Step 3.1, bug-6. Its untracked-ness is also what keeps
   the `reset --hard` rollback from discarding prior items' in-file bookkeeping.)
3. **Resumability.** `- [x] … _fixed via <sha>_` lets a re-run skip already-fixed items;
   without a commit boundary there is no durable per-item done-marker.

There is also no "external commit actor" in `validation-fixer`'s flow — it is the terminal
consumer of the backlog, not a stage handing off to a human-committed pipeline.

## Decision

**`validation-fixer` is an explicit, documented exception to the never-commit invariant:
it owns the per-item commit for frameworks that stop at `READY_TO_COMMIT` (or otherwise
leave a successful fix uncommitted). No other skill gains this right.**

The exception is bounded by the exact safeguards the never-commit policy protects — a
human stays in control of history, and every commit is atomic and reversible:

1. **Which actor commits.** `validation-fixer`, and only for the single item it is
   currently reconciling (Step 3.4). A framework that already committed (`gsd`) is left
   untouched — no double commit.
2. **Under which authorization.**
   - **checkpoint mode:** show the diff + intended message and **get the user's approval**
     before committing. On rejection, `git reset --hard $BEFORE_SHA` and leave the item
     `- [ ]`. This is per-commit human authorization.
   - **autonomous mode:** commit directly — **opting into autonomous *is* the standing
     authorization** to commit each item. Message: `fix(validation): <one-line summary>`.
3. **How rollback stays atomic.** Every item begins from a clean tree (Step 1
   precondition) with `$BEFORE_SHA = HEAD`. A rejected, blocked, or errored item is
   restored with `git reset --hard $BEFORE_SHA`, so a failed item never lands partial
   work and never disturbs a prior committed item. One item = one commit = one revertible
   unit.
4. **Protected-branch semantics.** `validation-fixer` **never auto-commits to a protected
   branch** (`main` / `master` / `dev`): it STOPS and reports so the user branches/commits
   deliberately. Autonomous mode does **not** override this — the standing approval covers
   feature branches only.

`.orchestrator/PROJECT-CONTEXT.md` §Invariants is amended to name this exception inline and
to reaffirm that **no other skill may commit**.

## Alternatives considered

- **(A) Strict compliance — never commit, leave at `READY_TO_COMMIT`.** Rejected: breaks
  per-item SHA provenance (`_fixed via <sha>_`), the `arch-2` prior-only evidence trail,
  the clean-tree-per-item precondition, and resumability — and there is no external commit
  actor in the flow to hand off to. It would force a redesign of the backlog provenance
  model to satisfy a rule written for a different actor class.
- **(B) Undocumented commit ownership (the `bug-1` state).** Rejected: functionally
  correct but silently contradicts a load-bearing invariant — the `arch-4` defect. An
  invariant with an unwritten exception is a trap for the next author.
- **(C — chosen) Documented, safeguard-bounded exception.** Records which actor commits,
  under which authorization, and how rollback/protected-branch semantics keep the human in
  control — turning an implicit override into an explicit, auditable contract while
  preserving the downstream design that depends on real commits.
- **Batch-commit sub-decision — one commit for all fixed items at the end.** Rejected:
  loses per-item provenance and per-item rollback, and a single failure would strand or
  revert the whole batch. Per-item atomicity is the point.

## Consequences

- The never-commit invariant now has exactly **one** named exception (`validation-fixer`);
  the orchestrator/PM and every other skill still stop at `READY_TO_COMMIT`. The exception
  is scoped, not a general loosening.
- `validation-fixer` Step 3.4 is unchanged in mechanics (bug-1 already implemented
  checkpoint approval, `reset --hard` rollback, and the protected-branch STOP); it now
  cites this ADR as the authority for owning the commit, closing the "no approved
  exception" gap.
- The trust model is preserved: a human authorizes every commit (per-commit in checkpoint
  mode, by opting into autonomous mode otherwise), protected branches are never touched
  autonomously, and every item is an atomic, revertible unit.
- `validation-fixer` ships a single copy (no `.opencode` override port), so this change is
  one-file for the skill plus the ADR and the policy amendment; no port mirror is due.
