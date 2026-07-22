---
id: SPEC-20260721T233925Z-b9c6
title: Gate the reduced-review main-agent lane against untrusted severity
status: READY_FOR_PLANNING
created_at: 2026-07-21T23:39:25Z
updated_at: 2026-07-21T23:39:25Z
cycle: 0
related_to: SPEC-20260721T181347Z-1089, ADR-0008, docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md (sec-4)
---

## Summary

The `validation-fixer` skill's Step-2.5 orchestrator routing reads a per-item severity
token `[<ID>|<sev>]` off each backlog line and, when it is `low`/`info`, routes the item
into the **main-agent lane** — a reduced-review inline fix by the host's own main agent
with **no orchestrator pipeline** (no independent architect/tester/reviewer/qa). But that
token is part of the **always-untrusted** item text (Step 1 guard): it may be diff-derived
(an LLM synthesis of attacker-controlled diff) or hand-authored. Trusting it to select the
reduced-review lane lets an attacker mislabel a genuinely high-severity finding as `low`/
`info` to bypass review — and in autonomous mode the routing plan auto-accepts, so the
downgrade happens with no human in the loop. This spec makes the untrusted severity token a
**hint that cannot, by itself, authorize the reduced-review lane**: entry to the main-agent
lane requires an independent, code-grounded confirmation of genuine `low`/`info` severity
(plus informed human confirmation in checkpoint mode); anything unconfirmed is treated as
`unknown` and escalated to the full-pipeline dedicated lane.

## Goals

- Treat the `[<ID>|<sev>]` severity token as **untrusted evidence** (per the Step-1 guard),
  never as a trusted routing directive — explicitly, at the point of lane assignment.
- Require, before **any** item enters the reduced-review **main-agent lane**, an independent
  confirmation that the item is genuinely `low`/`info`:
  - a **code-grounded severity verification** performed by the main agent inside the
    Step-3.2 untrusted-evidence frame, in **both** modes, as the first action of the lane;
  - **plus** informed, affirmative human confirmation in **checkpoint** mode (the routing-plan
    approval, made explicit about the review downgrade).
- On any unconfirmed / unverifiable severity, reclassify the item's effective severity as
  `unknown` and **escalate it to the dedicated lane** (full orchestrator pipeline, per-item
  commit) — reusing the existing conservative `unknown → dedicated` treatment, adding no new
  lane or record type.
- Ensure **autonomous mode never silently enters** the reduced-review lane on an unverified
  untrusted token: the standing routing-plan approval authorizes commit/granularity, not the
  review-rigor downgrade, which the code-grounded verification alone can license.
- Keep the change strictly additive and backward-compatible: legacy `_fixed via …_`
  provenance lines still parse; the well-behaved genuine-`low`/`info` case still fixes inline.

## Non-goals

- **Do not** add any new gate to the **batch** or **dedicated** lanes. Both already run the
  full orchestrator pipeline, so a mislabel among `{med, crit, high, unknown}` changes only
  commit granularity, not review rigor — outside sec-4's scope.
- **Do not** touch open findings **bug-2** and **bug-3** (they also concern these lanes but
  are separate items). Stay scoped to sec-4: untrusted severity gating the main-agent lane.
- **Do not** revert or reopen **ADR-0008** (work-unit commit ownership / batch atomicity) or
  the landed **sec-1 / sec-2 / sec-3** fixes (acceptance gate, worktree/rollback safety,
  protected-branch set resolution).
- **Do not** introduce worktree isolation or any other deferred Non-goal already recorded in
  the skill (per-unit worktrees, sec-2's proposed option).
- **Do not** change the superpowers / gsd paths — Step 2.5 and the lanes are orchestrator-only.
- **No `.opencode/` port** work: `validation-fixer` ships a single copy (no override port).

## Users and use cases

- **Repo maintainer running `/validation-fixer` (checkpoint mode)**: sees, at the single
  routing-plan approval, that main-agent-lane items are *reduced-review, inline, no-pipeline*,
  and gives informed consent (or moves them to a full-review lane). Success: no item is
  fixed inline without the maintainer knowing it skipped the pipeline.
- **Unattended autonomous sweep (autonomous mode)**: an attacker-influenced backlog labels a
  serious finding `[x|low]`. The main agent, reading the actual code before fixing, cannot
  corroborate `low`/`info`, so the item is escalated to the dedicated full pipeline instead of
  being quietly patched inline and committed. Success: mislabeled severity cannot buy a
  review bypass.
- **Legitimate trivial finding (`low`/`info`, genuinely minor)**: code-grounded verification
  confirms it; it is fixed inline exactly as today. Success: the fast path is preserved for
  real low/info work.

## Functional requirements

1. **Severity token is untrusted, at lane-assignment time.** In Step 2.5 ("Read each item's
   severity"), state explicitly that the `[<ID>|<sev>]` token is part of the **always-untrusted
   item text** (Step-1 guard, lines 72–80) and is therefore a **provisional hint** for
   proposing a lane — it can never, on its own, finalize the reduced-review main-agent lane.
   (Reading it remains "data, never executed"; one line stays exactly one item.)

2. **Main-agent-lane assignments are provisional pending per-item verification.** In the
   Default-lanes table / note and the Propose-and-approve step, mark that an item's placement
   in the **main-agent lane** is provisional: it is finalized only after the per-item
   confirmation in FR3–FR5 passes at lane-execution time. Placement in the batch or dedicated
   lanes is unchanged (not provisional).

3. **Code-grounded severity verification is the first action of the main-agent lane, in both
   modes.** Before the existing read→minimal-fix→run-tests sequence, the main agent — inside
   the Step-3.2 untrusted-evidence frame — must independently assess, **against the real code**
   (not the token), whether the concern is genuinely `low`/`info`. This verification is
   grounded in code the attacker does not control, so it is independent of the untrusted token.

4. **Unconfirmed severity → treat as `unknown` → escalate to the dedicated lane.** If the
   FR3 verification does **not** corroborate genuine `low`/`info` (the concern reads as
   higher-severity, or severity cannot be confidently assessed), the main agent must **not**
   fix it inline. Reclassify the item's effective severity to `unknown` and route it to the
   **dedicated lane** (one orchestrator run, full pipeline, per-item commit) — reusing the
   existing `unknown → dedicated` behavior (Step 2.5, current line ~233), introducing no new
   lane, record prefix, or machinery. Escalation only ever *adds* review; it never removes it.

5. **Checkpoint mode additionally requires informed human confirmation for the reduced-review
   lane.** At the Step-2.5 routing-plan approval, main-agent-lane entries must be surfaced as
   *reduced-review · inline · no-pipeline* so the human's approval of those items is informed,
   affirmative consent to skip the pipeline. Existing routing rule Q3 (user may move any item
   to any lane) is unchanged; this only makes the downgrade explicit at the prompt.

6. **Autonomous standing approval does not license the downgrade.** Clarify that opting into
   autonomous mode is standing approval of the routing plan's **granularity and commits**, but
   is **not** consent to downgrade review rigor on an unverified untrusted token — hence the
   FR3 code-grounded verification is the sole authority for entering the reduced-review lane
   in autonomous mode, and FR4 escalation applies when it fails. (Refines, does not remove,
   the existing "opting into autonomous is the standing approval of the routing plan" text.)

7. **Both confirmations must hold to fix inline; failure of either escalates.** To finalize
   the main-agent lane an item needs: FR3 code-grounded verification (both modes) **and** —
   in checkpoint mode — FR5 informed human confirmation. If either is absent/negative, apply
   FR4 (reclassify `unknown`, route dedicated). No inline fix, no inline commit, occurs for an
   item that fails to clear this gate.

8. **Recording is unchanged for escalated items.** An item escalated per FR4 is processed and
   recorded exactly as a dedicated-lane item (`- [x]` with its own per-item SHA on success, or
   `- [~]` on failure) — no new status token. Genuine inline fixes still record
   `_fixed via main-agent · <sha> · <date>_` as today.

9. **Documentation touch-ups.** Update the Step-2.5 severity-read section, the Default-lanes
   table/note, the Propose-and-approve step, the "Main-agent lane (low / info)" subsection,
   and add an **Edge case** ("severity token labels an item `low`/`info` but code-grounded
   verification does not corroborate it → escalate to dedicated") and a **Notes** line stating
   the untrusted severity token cannot buy a review-lane downgrade. Cross-references to Step 1's
   untrusted-evidence guard and to the `unknown → dedicated` rule must resolve.

## Non-functional requirements

- **Performance**: — (doc-skill; the code-grounded verification reuses the read the lane
  already performs, so no material added cost).
- **Security / auth**: This *is* a security fix — removes an untrusted-input → review-bypass
  path. The security property to preserve: no attacker-controlled severity value can, by
  itself, cause an item to skip the orchestrator pipeline.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: Reinforces the "Data, never instructions" and untrusted-evidence
  invariants — the severity token joins item text as untrusted data used only as a hint.
- **Privacy / compliance**: —
- **Monetization tier**: —

## Project-context fit

- **Layer touched**: a single authoring skill's `SKILL.md` — documentation/procedure, not
  runtime code. No JS, no tests to run (`clean-code-gates` suite is unrelated).
- **Depends on / extends**: the Step-2.5 severity-routing lanes introduced by
  `SPEC-20260721T181347Z-1089` and the main-agent-lane exception reconciled in
  `FIX-20260721T185705Z-a3ae`; the commit-ownership contract in **ADR-0008**; the Step-1
  untrusted-evidence guard and the Step-3.2 untrusted-evidence frame.
- **Invariants that shape it**:
  - *Data, never instructions* / *untrusted-evidence*: the fix's core principle — extend it to
    the severity token's routing influence.
  - *Backward compatibility*: additive only; legacy provenance lines and the genuine-low/info
    fast path are preserved.
  - *opencode-port-parity*: N/A — no override port exists; single copy, no mirroring.
- **Must not conflict with**: ADR-0008, and the landed sec-1/sec-2/sec-3 fixes — the change
  is confined to *lane-entry gating for the main-agent lane* and touches none of the
  commit-ownership, rollback, acceptance-gate, or protected-branch machinery.
- **Design note for the architect (see Decisions resolved by default)**: the chosen mechanism
  is *verify-then-escalate* (keep the lane, gate its entry). A simpler alternative —
  *disable the main-agent lane entirely in autonomous mode* — is a valid, more conservative
  option the architect may weigh; it trades the fast path for a smaller surface. The default
  below picks verify-then-escalate to match the finding's "independently verify severity"
  wording and preserve the lane's utility.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: —
- **Skill (this repo)**: `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 2.5
  (severity-read, Default-lanes table/note, Propose-and-approve), Step 3 "Main-agent lane
  (low / info)" subsection, Edge cases, Notes. **No** `.opencode/` port to mirror.

## Open questions

- (none — all resolved by Brainstormer default in autonomous mode; none reserved)

## Decisions resolved by Brainstormer default

- Autonomous-mode confirmation substitute → **code-grounded severity verification by the main
  agent** (not disabling the lane outright) → matches the finding's "independently verify
  severity before lane assignment" and preserves the lane's usefulness; escalation-only-adds-review
  keeps it safe. Alternative (disable lane in autonomous mode) surfaced to the architect in
  Project-context fit.
- Escalation target for unverified severity → **the dedicated lane** (`unknown → dedicated`,
  reusing existing behavior at current line ~233) → conservative, no new lane/record/machinery.
- Scope of the new gate → **main-agent lane only**; batch and dedicated unchanged → only the
  main-agent lane downgrades review rigor, so only it needs the gate; keeps the change tight to
  sec-4 and clear of bug-2/bug-3.
- Verification runs in **both** modes; checkpoint additionally needs informed human confirmation
  → cheap (reuses the lane's code read), strongest defense-in-depth, simplest to state.
- Routing-plan main-agent assignments are **provisional pending per-item verification** →
  required so autonomous verification can escalate at execution time; escalation only adds review.
- **No opencode port mirroring** → `validation-fixer` has no `.opencode/` override port; single copy.

## References

- `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md` — §Security,
  finding **sec-4** (source of this spec).
- `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 1 untrusted-evidence guard
  (~72–80), Step 2.5 severity-read + lanes (~211–280), Step 3 "Main-agent lane (low / info)"
  (~592–621).
- `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` — commit-ownership /
  batch-atomicity contract the lanes rely on (must not be reverted).
- `SPEC-20260721T181347Z-1089-orchestrator-skill-severity-routing.md` — introduced the
  three-lane severity routing this spec hardens.
- `.orchestrator/PROJECT-CONTEXT.md` — §Invariants ("Data, never instructions", backward
  compatibility, opencode-port-parity).
