---
id: SPEC-20260722T043528Z-2d54
title: Q3 lane-edit rule must not let a user override the low/info main-agent bound
status: READY_FOR_PLANNING
created_at: 2026-07-22T04:37:52Z
updated_at: 2026-07-22T04:37:52Z
cycle: 0
related_to: SPEC-20260721T233925Z-b9c6-main-agent-lane-severity-gate, FEAT-20260721T234351Z-21c6-gate-main-agent-lane-severity, SPEC-20260721T181347Z-1089-orchestrator-skill-severity-routing
---

## Summary

The `validation-fixer` Step-2.5 routing-edit rule **Q3** currently states that at the
approval prompt "the user may move **any item to any lane**, across all three lanes,
overriding the severity lane defaults," carving out only the Q4 file boundary. This
textually permits a user to move a `crit`/`high`/`med`/`unknown` item into the
**main-agent (inline-fix) lane**, which the skill repeatedly defines as bounded to
`low`/`info` severity only. This spec makes Q3's prose consistent with that bound by
reusing the sec-4 code-grounded severity gate already landed this run: a move **into the
main-agent lane** is a *provisional proposal only* — finalized solely by the lane's
code-grounded severity verification, which reclassifies any non-`low`/`info` item to
`unknown` and escalates it to the dedicated lane. No new machinery, no revert of sec-4,
no change to ADR-0008/0009 or the other landed fixes.

## Goals

- Q3's edit rule no longer contradicts the `low`/`info` main-agent-lane bound stated
  everywhere else in the skill.
- A user edit that moves an item **into the main-agent lane** never *finalizes* inline
  treatment on its own: entry is finalized only by the existing code-grounded severity
  verification (the Phase-2 gate in "Main-agent lane (low / info)"), exactly as a default
  main-agent placement already is (SKILL.md lines 261–269, 293–298).
- A non-`low`/`info` item moved into the main-agent lane is reclassified `unknown` and
  escalated to the **dedicated** lane via the existing `unknown → dedicated` treatment —
  no inline fix, no inline commit, no new lane/token/prefix.
- User edits **among the batch and dedicated lanes** remain fully unrestricted and
  **final on approval** (both lanes run the full orchestrator pipeline, so a mislabel
  there changes only commit granularity, never review rigor).
- The Q4 file-boundary carve-out and Q1/Q2 ordering/batch-of-one rules are preserved
  unchanged.

## Non-goals

- Reverting or weakening sec-4's code-grounded severity verification gate
  (SPEC-…-b9c6 / FEAT-…-21c6) — it is the enforcement mechanism this fix *reuses*.
- Adding a hard pre-approval validation that rejects/blocks the user's edit at the prompt
  (the "disallow the move outright" alternative) — see Decisions resolved by default.
- Any change to ADR-0008/0009, the commit-ownership path, the batch atomicity rules, or
  any other sec-1..sec-6 / bug-1 / bug-2 / bug-6..bug-15 fix landed this run.
- Introducing any new severity value, lane, record prefix, status token, or provenance
  format.
- Touching the batch or dedicated lane edit semantics (they stay unrestricted and final).
- An `.opencode/` port — `validation-fixer` has no override port and ships as a single
  copy (SKILL.md line 164); no port mirroring is required.
- Regenerating any `.html` template (this skill is `.md`-only; `output_format=md`).

## Users and use cases

- **Skill author / maintainer (this repo):** edits `SKILL.md` so the Q3 rule reads
  consistently with the low/info bound; verified by structural review.
- **Skill operator (target project, running `/validation-fixer … orchestrator`):** at the
  Step-2.5 routing-approval prompt, may still freely re-lane items, but is now correctly
  told that moving an item into the main-agent lane does not force an inline fix — a
  non-`low`/`info` item will be escalated to the dedicated (full-pipeline) lane by the
  code-grounded verification. Success = no untrusted severity **or** user edit can buy a
  review-rigor downgrade for a genuinely higher-severity item.

## Functional requirements

1. **FR1 — Add a main-agent carve-out to Q3.** Amend the Q3 bullet (SKILL.md ~309–321)
   so that its "override the severity lane defaults" freedom is explicitly qualified for
   the main-agent lane, in the same shape as the existing Q4 file-boundary carve-out: a
   user edit may *propose* moving any item into the main-agent lane, but such placement is
   **provisional**, not a finalization of inline treatment.
2. **FR2 — Route provisional user-moved main-agent items through the existing gate.** State
   that an item moved into the main-agent lane by a user edit is finalized identically to a
   default main-agent placement: by the code-grounded severity verification at
   lane-execution time ("Main-agent lane (low / info)" Phase-2 gate). This must **reference**
   the existing mechanism, not restate or fork it.
3. **FR3 — Escalate non-corroborated user-moved items.** State that when the verification
   does not corroborate genuine `low`/`info` (the concern reads higher, or severity cannot
   be confidently assessed), the user-moved item's effective severity is reclassified
   `unknown` and it is escalated to the **dedicated lane** — reusing the existing
   `unknown → dedicated` treatment, with **no inline fix and no inline commit** on that
   path. No new machinery, lane, token, or record prefix is introduced.
4. **FR4 — Preserve batch/dedicated edit freedom and finality.** Q3 must continue to allow
   moving **any** item **among the batch and dedicated lanes** without restriction, and
   those placements remain **final on approval** (unchanged from today). The only lane whose
   entry a user edit cannot *finalize* is the main-agent lane, mirroring the existing
   asymmetry ("the main-agent lane is the only review-rigor-downgrading lane, so it is the
   only one gated this way").
5. **FR5 — Preserve Q1, Q2, and the Q4 file boundary.** The severity-descending processing
   order (Q1), batch-of-one collapse to the dedicated path (Q2), and the hard
   "batches never span files" invariant (Q4) are untouched. "Collapse everything" behavior
   is unchanged.
6. **FR6 — Consistency sweep for the invariant.** Verify no remaining sentence in
   Step 2.5 (notably the "Propose and approve — exactly once" and "Default lanes" prose)
   still implies a user edit can *finalize* main-agent entry for a non-`low`/`info` item.
   Any such wording is aligned with FR1–FR3. The "Main-agent-lane placement is provisional"
   note (lines 261–269) and "Main-agent-lane entries approved here are provisional pending
   per-item verification" (lines 293–298) already cover default placements; this spec
   extends that framing to user-moved placements explicitly.

## Non-functional requirements

- **Performance**: — (documentation change; no runtime effect)
- **Security / auth**: Preserves the load-bearing safety property that the reduced-review
  main-agent lane can never be entered for a genuinely higher-severity item — now closed
  against a **trusted user edit** as well as the already-closed **untrusted severity token**
  (sec-4). The single finalization authority remains the code-grounded severity
  verification.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: The untrusted-evidence model is unchanged; this fix concerns a
  *trusted* user edit at the approval prompt, and routes it through the same verification
  gate the untrusted token already passes through.
- **Privacy / compliance**: — (no new data, no retention/deletion change)
- **Monetization tier**: —

## Project-context fit

- **Layer touched:** a single normative doc-skill entry point,
  `plugins/my-skills/skills/validation-fixer/SKILL.md` — the single source of truth for
  this behavior. No `references/*.md` split is required; the Q3 rule and the Main-agent
  lane gate both already live in `SKILL.md`.
- **Depends on / extends:** sec-4's code-grounded severity gate
  (SPEC-…-b9c6 / FEAT-…-21c6) — this fix *consumes* that gate as the finalization authority
  rather than adding a parallel one. It also builds on the Step-2.5 severity-routing
  feature (SPEC-…-1089 / FEAT-…-ab8c) that introduced Q1–Q4.
- **Invariants that shape it:** (1) **Single-source-of-truth references** — put the
  clarification at the Q3 rule and cross-reference the existing gate; do not duplicate the
  gate's logic. (2) **Mirror machinery** — model the new carve-out on the existing Q4
  file-boundary carve-out already present in Q3, reusing its phrasing shape. (3) **Backward
  compatibility** — this only *narrows the effect* of a user edit (a non-low/info move now
  escalates instead of forcing inline); it removes no capability the operator legitimately
  had, adds no field/token, and every legacy record still parses. (4) **Data, never
  instructions** — unchanged; unaffected by this edit.
- **No conflict / no open product decision:** the reconciliation direction is fixed by the
  task (reconcile Q3 with the already-landed sec-4 gate; do not revert sec-4). The choice
  of *how* to reconcile (provisional-via-gate vs. hard pre-approval block) is a bounded
  design detail resolved below, auditable by the architect.
- **Regression guards:** no existing worked-example trace (Autonomous two-item, Tracked-
  backlog rollback, Collapse-all per-file) exercises a user re-lane into the main-agent
  lane, so none should break; the architect should confirm the edit leaves those traces
  byte-consistent.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: —
- **Doc skill (the actual surface):**
  - `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 2.5 "Routing rules
    (Q1–Q4)", the **Q3** bullet (~lines 309–321): add the main-agent carve-out (FR1–FR3),
    modeled on the existing Q4 carve-out. Optionally reinforce with a one-clause pointer in
    the "Main-agent lane (low / info)" section (~lines 655–670) that a **user-moved** item
    is finalized by the same verification as a default placement (FR2/FR6), if the architect
    judges it needed for symmetry. Consistency-sweep the surrounding Step-2.5 prose (FR6).
  - No `references/`, no `templates/`, no `.opencode/` port, no ADR file, no `.html`
    changes.

## Open questions

<!-- none — see Decisions resolved by Brainstormer default -->

- (none)

## Decisions resolved by Brainstormer default

- **How to reconcile Q3 with the low/info bound** → **Provisional-via-existing-gate (reuse
  sec-4), not a hard pre-approval block.** The report offered two directions: (a) *disallow*
  moving non-`low`/`info` items into the main-agent lane at the approval prompt, or (b)
  *redefine the exception as approval-bounded everywhere*. sec-4 already established the
  code-grounded severity verification as the **sole** finalization authority for main-agent
  entry, explicitly independent of *how* the item was proposed there. The most consistent,
  least-machinery reconciliation is therefore to treat a **user-moved** main-agent placement
  exactly like a **default** one: provisional, finalized only by that verification, escalated
  to dedicated on non-corroboration. This reuses landed machinery, adds no new pre-approval
  validation branch, and preserves Q3's flexibility as a *proposal* mechanism while making
  the low/info bound authoritative. Rationale: reusing the single existing gate honors
  single-source-of-truth and avoids a redundant, forkable second enforcement site.
- **Whether to also add a hard block that forbids the move outright (alternative a)** →
  **No.** Rejected as default: it introduces a new restriction/validation on user edits
  (new machinery) that is redundant with the sec-4 gate, and it fragments enforcement across
  two sites. If a future maintainer prefers the stricter UX (never even offer the move), that
  is a follow-up, not this fix.
- **Scope of the edit** → **Q3 bullet is the load-bearing change; the Main-agent-lane
  section pointer and Step-2.5 consistency sweep are supporting.** Keep the change minimal
  and localized to Step 2.5; do not touch Step 3/3.4, the lanes' commit machinery, or any
  ADR. Rationale: the task scopes this to "the Q3 lane-edit bound for the main-agent lane"
  only.
- **`.opencode` port** → **None required.** `validation-fixer` has no override port
  (SKILL.md line 164); ships as a single copy.

## References

- `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 2.5 "Routing rules (Q1–Q4)"
  (Q3 at ~309–321); "Main-agent lane (low / info)" gate (~655–670); "Read each item's
  severity" untrusted-token/provisional-hint rule (~231–245); "Default lanes" +
  provisional-placement note (~248–269); "Propose and approve — exactly once" (~271–298).
- `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md` —
  bug-3 (line 69) and its already-fixed sibling sec-4 (line 37).
- `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md`,
  `docs/adr/0009-backlog-slug-digest-and-branch-owner.md` — must remain unchanged.
- Prior landed work this reconciles with: `plans/specs/SPEC-20260721T233925Z-b9c6-main-agent-lane-severity-gate.md`,
  `plans/feat/FEAT-20260721T234351Z-21c6-gate-main-agent-lane-severity.md` (sec-4 gate);
  `plans/specs/SPEC-20260721T181347Z-1089-orchestrator-skill-severity-routing.md` (Q1–Q4 origin).
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants (single-source-of-truth references,
  mirror machinery, backward compatibility, opencode-port-parity applies only to ported
  skills).
