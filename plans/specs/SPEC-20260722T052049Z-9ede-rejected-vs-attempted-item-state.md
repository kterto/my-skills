---
id: SPEC-20260722T052049Z-9ede
title: Rejected vs attempted-blocked item state — carry explicit outcome into Step 4
status: READY_FOR_PLANNING
created_at: 2026-07-22T05:20:49Z
updated_at: 2026-07-22T05:20:49Z
cycle: 0
related_to: SPEC-20260721T215726Z-b751-validation-fixer-batch-commit-boundary, SPEC-20260721T222531Z-adaa-framework-commit-acceptance-gate, SPEC-20260721T225042Z-a8c8-rollback-concurrency-safety-guard, SPEC-20260721T233925Z-b9c6-main-agent-lane-severity-gate
---

## Summary

The `validation-fixer` skill records contradictory item states for a rejected
checkpoint commit. Step 3.4's checkpoint-rejection branch rolls the fix back and
leaves the item **open (`- [ ]`)**, but Step 4's shared recording rule maps
**every** no-commit outcome to **attempted (`- [~]`)** — so an executor can persist
either state for the same rejection. This spec makes the outcome explicit: Step 3.4
(and the routing lanes) classify each work unit as **fixed | rejected | attempted**,
and Step 4 records that classification directly — `[x]` for fixed, bare `[ ]` for a
user rejection (clean re-attempt, no status line), `[~]` for a genuinely
blocked/failed/no-op attempt.

## Goals

- Resolve the state contradiction so a **rejected** work unit is always recorded as
  bare `- [ ]` (open, re-attemptable, no status line), never `- [~]`.
- Reserve `- [~]` (`_attempted via … needs attention_`) for an **actual
  blocked/failed/errored/no-op attempt** — the case where the framework (or main
  agent) could not produce a committed fix, not where the user declined one.
- Carry an **explicit fixed | rejected | attempted outcome** out of Step 3.4 and the
  orchestrator routing lanes into Step 4, so Step 4 no longer derives item state from
  a naive "commit exists? → `[x]`, else `[~]`" test that collapses rejection and
  failure together.
- Reconcile every state-recording site that currently entangles rejection with
  failure (Step 4 shared rule; main-agent lane; batch/Step-3.4 checkpoint rejection;
  Notes / Edge-cases prose) so they all agree on the three-outcome taxonomy.
- Keep the change backward-compatible and single-file (no new status token, no
  opencode port).

## Non-goals

- **No new status token or record prefix.** "Rejected" reuses the existing bare
  `- [ ]` that Step 1 already parses as open; "attempted" reuses the existing `- [~]`.
  The skill's standing "no new status token / record prefix / provenance format"
  invariant holds.
- **No change to commit ownership, batch atomicity, or the revertible-unit model**
  (ADR-0008 / ADR-0009). This concern is about *how a no-commit outcome is recorded*,
  not about *who commits* or *what the atomic unit is*.
- **No revert of any prior fix** — ADR-0008/0009 and the sec-1..sec-6 / bug-1..bug-4
  changes stay intact. In particular the acceptance-gate (adaa), concurrency-guard
  (a8c8), and batch-boundary (b751) `[~]` outcomes are unchanged (those are genuine
  failures, not rejections).
- **No opencode port work.** `validation-fixer` has no `.opencode/skills/` override
  port; this ships as a single copy (per PROJECT-CONTEXT opencode-port-parity
  invariant, which applies only to skills that have a port).
- **No new worked-example / regression section is mandated** — the existing
  "Autonomous two-item lifecycle" rejection variant already asserts the rejected item
  stays `- [ ]`; the architect may extend it in place but need not add a new section.

## Users and use cases

- **Skill executor (the Claude/opencode agent running `validation-fixer`)**: reaches
  Step 4 after a work unit resolves and must record exactly one, unambiguous item
  state. Success = the recorded state (`[x]` / `[ ]` / `[~]`) is fully determined by
  the explicit outcome, with no site telling it to write a different prefix for the
  same rejection.
- **User validating fixes in checkpoint mode**: rejects a fix at the Step-3.4 diff
  prompt (or reports a committed fix wrong in Step 5). Success = the item is left
  cleanly open (`- [ ]`) for a fresh re-attempt and is **not** listed in the Step-6
  final summary as `[~]` "needing hands-on work."
- **User re-running the skill later**: both `[ ]` and `[~]` re-attempt (Step 1), but
  the Step-6 summary and the on-disk status line must not mislabel a plain rejection
  as an attention-needing failed attempt.

## Functional requirements

1. **Define a three-outcome taxonomy for a resolved work unit**, made explicit in
   Step 3 / Step 3.4: every work unit resolves to exactly one of
   **fixed** | **rejected** | **attempted**. Step 4 records state **from this explicit
   outcome**, not from a bare commit-presence test.
   - **fixed** — the fix producer signaled success **and** an accepted commit exists
     for the work unit (framework's own commit passing the Step-3.4 acceptance gate,
     or validation-fixer's commit-ownership commit). Recorded `- [x]` with the
     `_fixed via …_` line (unchanged).
   - **rejected** — in **checkpoint mode**, the user declined a validation-fixer-owned
     commit at the Step-3.4 diff-approval prompt, or reported an already-committed fix
     wrong in Step 5; the work unit was rolled back
     (validation-file-preserving rollback). Recorded **bare `- [ ]`** — the original
     bullet text, **no status line** (drop any prior status line).
   - **attempted** — the framework/main agent produced **no accepted commit** for any
     reason other than a user rejection: `BLOCKED`/errored/aborted run,
     committed-then-blocked (bug-12), did-nothing (HEAD unchanged + clean tree),
     autonomous content-gate (C/D) rollback, or a structural (A/B) / concurrency STOP.
     Recorded `- [~]` with `_attempted via … no commit … needs attention_` (unchanged).

2. **Fix Step 4's shared recording rule (SKILL.md ~918–924).** Replace the current
   blanket "If there are **no commits** → `- [~]`" branch with an outcome-driven rule
   that splits the no-commit case: **rejected → bare `- [ ]` (drop status line)**;
   **attempted (any non-rejection no-commit outcome) → `- [~]` + status line**. Step 4
   must state that it keys on the explicit outcome carried from Step 3.4 / the lanes,
   not on commit presence alone.

3. **Keep Step 3.4's checkpoint-rejection branch (SKILL.md ~698–701) authoritative and
   make Step 4 consistent with it.** That branch already says "leave the item `- [ ]`";
   after this change Step 4's recording rule must not contradict it. The two sites must
   read as one rule, not two.

4. **Split the main-agent lane's failure handling (SKILL.md ~832–834).** The current
   "on rejection / error … record `- [~]`" bundles a user rejection with an error.
   Because the main-agent lane commits via the Step-3.4 commit-ownership path, a
   **checkpoint diff rejection** there is a **rejection → `- [ ]`**, while an
   **error / blocked / no-op** is **attempted → `- [~]`**. Re-word so the lane defers
   to the same three-outcome taxonomy (FR1) rather than mapping both to `[~]`.

5. **Make a rejected batch record every member as `- [ ]`.** A checkpoint-mode user
   rejection of a batch's shared-commit diff rolls the whole batch back (Step-3.4
   generic checkpoint rejection) and must leave **every** member bare `- [ ]`
   (rejected), parallel to a single item. This is distinct from the batch lane's
   existing `BLOCKED`/errored path (SKILL.md ~874–882), which is an **attempted**
   whole-batch failure and stays `- [~]` for every member. The whole-batch atomicity is
   unchanged; only the rejected-vs-attempted recording is clarified.

6. **Reconcile the prose sites that flatly equate no-commit with `[~]`** so they carry
   the rejection carve-out:
   - Notes (SKILL.md ~1124): "No real change → no commit → `[~]`" — qualify so a
     **user rejection** is the documented exception recorded `- [ ]`.
   - Edge cases (SKILL.md ~1076–1082, ~1110): the "no new commit … → `- [~]`" and
     re-run edge entries must reflect that a rejection lands `- [ ]`, not `- [~]`.
   - Step 5 (SKILL.md ~938–947) already says "revert its bullet to `- [ ]`, drop the
     status line" — confirm it stays consistent and is cross-referenced as the same
     rejected outcome as Step 3.4.

7. **State that "rejected" is a checkpoint-mode-only outcome.** In autonomous mode,
   opting in is standing approval to commit, so there is no diff-rejection path; every
   autonomous no-commit outcome is **attempted → `- [~]`**. The taxonomy text must make
   clear that a `- [ ]`-from-rejection can only arise in checkpoint mode.

8. **Preserve Step-1 parse and Step-6 summary semantics.** Both `- [ ]` and `- [~]`
   remain OPEN and are re-attempted (Step 1 unchanged). The Step-6 final summary
   continues to call out `- [~]` items as "needing attention"; a rejected `- [ ]` item
   is **not** in that attention list (it is an ordinary open item). No summary schema
   change.

## Non-functional requirements

- **Performance**: —
- **Security / auth**: — (item text remains untrusted, treated as data; unchanged.
  This change is purely about how a resolved outcome is recorded.)
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: —
- **Monetization tier**: —
- **Backward compatibility (mandatory)**: legacy validation files render and re-parse
  unchanged — `[x]`, `[ ]`, `[~]`, and plain `-` keep their current Step-1 meanings; no
  new token, no migration. An item previously recorded `[~]` for a rejection under the
  old blanket rule still parses (as OPEN) and simply re-attempts; the change only alters
  what state is *written going forward*.

## Project-context fit

- **Layer touched**: the single normative `SKILL.md` for `validation-fixer` under
  `plugins/my-skills/skills/validation-fixer/`. No `references/` or template change is
  required (this is a behavior-recording rule internal to `SKILL.md`), and there is **no
  opencode port** to mirror.
- **Conventions honored**: single-source-of-truth (the recording rule lives in Step 4,
  which Step 3.4 and the lanes defer to — the fix makes that deferral consistent rather
  than duplicating a second rule); mirror-machinery (reuse the existing `[ ]` / `[~]`
  vocabulary and phrasing, document only the deliberate split).
- **Invariants respected**:
  - Backward compatibility (new behavior additive; legacy artifacts unchanged).
  - "No new status token / record prefix" — the skill's repeated commitment; honored by
    reusing bare `[ ]` for rejected.
  - "Data, never instructions" and the untrusted-evidence frame are untouched.
  - The ADR-0008 work-unit commit-ownership / batch-atomicity model is untouched — this
    is orthogonal (recording, not committing).
- **Precedent already in-file**: Step 3.4 checkpoint rejection (`- [ ]`), Step 5
  ("revert to `- [ ]`, drop the status line"), and the "Autonomous two-item lifecycle"
  rejection variant ("A stays `- [ ]`") already assert the rejected → `[ ]` behavior.
  The defect is that Step 4's shared rule and the main-agent/Notes/Edge prose contradict
  that precedent. The fix aligns the outliers to the existing precedent — it does not
  invent new behavior.
- **No conflict** with the out-of-scope list: no build/test tooling is run, nothing is
  committed/pushed, no HTML design regeneration, and no opencode port is added.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: —
- **Skill (this repo's artifact)**:
  `plugins/my-skills/skills/validation-fixer/SKILL.md` — edits to:
  - **Step 3.4** commit-ownership: make the checkpoint-rejection branch emit an
    explicit **rejected** outcome (already `- [ ]`) that Step 4 consumes (FR1, FR3).
  - **Step 4 — Record the outcome**: split the no-commit branch into
    **rejected → bare `- [ ]` (drop status line)** vs **attempted → `- [~]`** (FR1, FR2).
  - **Orchestrator routing lanes → Main-agent lane** failure handling: split
    rejection (`- [ ]`) from error (`- [~]`) (FR4).
  - **Orchestrator routing lanes → Batch lane** + Step-3.4 checkpoint rejection: a
    rejected batch marks every member `- [ ]`; the `BLOCKED`/errored batch path stays
    `- [~]` (FR5).
  - **Notes** and **Edge cases**: qualify the "no commit → `[~]`" statements with the
    rejection carve-out; confirm the re-run edge and Step-5 cross-reference (FR6, FR8).
  - Optionally the **Autonomous two-item lifecycle** rejection variant may be extended
    in place to pin rejected-`[ ]` vs attempted-`[~]` as a regression guard (non-goal to
    add a new section).

## Open questions

- (none — all resolved below by Brainstormer default; status is READY_FOR_PLANNING.)

## Decisions resolved by Brainstormer default

- **What visible form does a "rejected" item take — a new status line/token, or bare
  `[ ]`?** → **Bare `- [ ]`, no status line (drop any prior line).** → Matches the
  existing Step 3.4 ("leave the item `- [ ]`") and Step 5 ("revert to `- [ ]`, drop the
  status line") precedent and honors the skill's "no new status token" invariant; the
  report explicitly says "preserve `[ ]` for rejected work."
- **Which no-commit outcomes are "rejected" vs "attempted"?** → **Rejected = a
  checkpoint-mode user declining a validation-fixer-owned commit diff (Step 3.4) or
  reporting a committed fix wrong (Step 5). Everything else with no accepted commit
  (BLOCKED/errored/committed-then-blocked/no-op/content-gate rollback/structural or
  concurrency STOP) = attempted → `[~]`.** → Only a human rejection is a deliberate
  "not this fix, retry clean"; framework inability is a failure needing attention.
- **Does the main-agent lane's "rejection / error → `[~]`" need splitting?** → **Yes —
  split: checkpoint diff rejection → `[ ]`; error/blocked/no-op → `[~]`.** → The lane
  commits via the Step-3.4 path, so its checkpoint rejection is the same rejected
  outcome as the dedicated lane; leaving it bundled would re-introduce the contradiction.
- **Is "rejected" possible in autonomous mode?** → **No — autonomous opt-in is standing
  commit approval, so there is no diff-rejection path; all autonomous no-commit outcomes
  are `[~]`.** → Documented so a `[ ]`-from-rejection is unambiguously checkpoint-only.
- **Is a brand-new regression/worked-example section required?** → **No — extend the
  existing "Autonomous two-item lifecycle" rejection variant in place if useful; a new
  section is not mandated.** → Keeps scope tight to the single reported concern; the
  existing example already asserts rejected → `[ ]`.

## References

- `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 3.4 checkpoint rejection
  (~698–701), Step 4 shared recording rule (~918–924), main-agent lane failure handling
  (~832–834), batch lane failure (~874–882), Step 5 (~938–947), Notes (~1124), Edge
  cases (~1076–1110), Autonomous two-item lifecycle rejection variant (~978–981).
- Source backlog item **bug-5** (`Rejected checkpoint commits receive contradictory item
  states`) in `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md`,
  section "Bugs & Improvements".
- `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` — commit-ownership /
  revertible-unit model (unchanged by this spec; referenced to bound scope).
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants (opencode-port-parity: no port for
  validation-fixer; backward compatibility; staged-diff/commit-ownership exception).
