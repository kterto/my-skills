---
id: SPEC-20260722T000131Z-cb13
title: Robust dynamic fence for the untrusted-evidence handoff frame
status: READY_FOR_PLANNING
created_at: 2026-07-22T00:01:31Z
updated_at: 2026-07-22T00:01:31Z
cycle: 0
related_to: SPEC-20260721T233925Z-b9c6, SPEC-20260721T225042Z-a8c8, SPEC-20260721T215726Z-b751, docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md
---

## Summary

The `validation-fixer` skill's Step-3.2 handoff prompt wraps the verbatim, always-untrusted backlog item in a **fixed four-backtick code fence** (`plugins/my-skills/skills/validation-fixer/SKILL.md:449–451`). A backlog item whose text contains a line of four (or more) backticks closes that fence early, so any attacker-controlled text after it is presented to the downstream framework **outside** the data boundary — as if it were part of the trusted preamble rather than quoted evidence (finding `sec-5`). This spec replaces the fixed fence with a **dynamically computed fence** whose length always exceeds the longest backtick run in the item, restoring an unbreakable data boundary for both the single-item and batch (multi-concern) handoff paths.

## Goals

- The Step-3.2 untrusted-evidence frame closes only where the framework intends, regardless of backtick runs inside the verbatim item.
- The fence length is derived from the item content: at least one backtick longer than the longest consecutive-backtick run in the item, with a floor equal to today's width (four) so nothing gets narrower than the current behavior.
- The rule is stated once, operatively, at the point where the handoff prompt is constructed (Step 3.2), and the batch/multi-concern brief inherits it (each block already re-wrapped in the Step-3.2 frame).
- The change is a pure authoring/instruction change to `SKILL.md`; legacy backlogs and provenance formats are unaffected.

## Non-goals

- Do **not** revert or weaken ADR-0008 (work-unit commit ownership / batch atomicity) or the `sec-1`, `sec-2`, `sec-3`, `sec-4` fixes landed earlier this run.
- Do **not** touch any other trust or severity machinery: the Step-1 untrusted-evidence guard's *substance*, the `[<ID>|<sev>]` provisional-severity handling, the sec-3 shell-safe commit construction, rollback safety, or the main-agent-lane gate. The only change is *how the fence delimiter is sized*.
- Do **not** re-architect the evidence encoding into escaped JSON or an out-of-band delimiter scheme (evaluated and rejected as default — see "Decisions resolved by Brainstormer default"); keep the fenced-code-block representation the downstream framework already reads.
- No opencode override port work: `validation-fixer` has **no** `.opencode/skills/validation-fixer/` port (only `pr-review-report` and `spec-driven-eval` do), so the opencode-port-parity invariant does not apply here.
- No behavioral change to any framework invocation, routing lane, or commit flow.

## Users and use cases

- **Main agent running `validation-fixer` (host, Claude Code or opencode)**: constructs the Step-3.2 handoff prompt for each work unit. It must be instructed to size the fence from the item content so a malicious item cannot break out of the quoted block.
- **Downstream framework subagent (superpowers / gsd / orchestrator roles)**: receives the handoff prompt and must see the entire item — including any embedded backtick runs — as inert quoted data, never as trusted instructions.

## Functional requirements

1. Step 3.2's handoff-prompt construction MUST instruct the agent to compute the fence delimiter from the verbatim item: scan the item text for the longest run of consecutive backtick characters (call it `M`), then fence the item with a run of `max(4, M + 1)` backticks on both the opening and closing fence lines.
2. The opening and closing fences MUST use the **same** computed length, each on its own line immediately before and after the verbatim item, so the item is fully enclosed.
3. The illustrative example currently shown at `SKILL.md:449–451` MUST be updated so it no longer presents a hardcoded four-backtick fence as the literal rule; it must convey the computed-length fence (e.g. a placeholder/annotation making clear the fence is `≥ 4` and always longer than any backtick run inside the item).
4. The batch / multi-concern brief path (the "Combined brief, trust never merged" bullet) MUST continue to wrap **each** grouped item in the Step-3.2 frame and therefore inherit the dynamic-fence rule per block — no separate fixed-fence literal may remain on that path.
5. After the change, there MUST be no remaining literal fixed-width fence used to wrap untrusted item text anywhere in `validation-fixer/SKILL.md`; any surviving fixed-fence occurrence must be a non-evidence example (e.g. unrelated code sample) explicitly out of the untrusted-evidence path.
6. The Step-1 untrusted-evidence guard (~lines 72–80), if it describes the fencing mechanism, MUST remain consistent with the new rule — either by cross-referencing Step 3.2 or by not contradicting it. (It need not restate the algorithm; Step 3.2 is the operative site.)

## Non-functional requirements

- **Performance**: — (authoring change; no runtime cost of consequence — a single scan of the item text the agent already reads)
- **Security / auth**: Core objective. Restores an unbreakable data/instruction boundary for untrusted evidence; a crafted backtick run in a backlog item can no longer smuggle text into the trusted preamble region seen by the downstream framework.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: Reinforces the "Data, never instructions" invariant at the point where untrusted item text crosses into a framework prompt.
- **Privacy / compliance**: — (no new data collected, stored, or retained)
- **Monetization tier**: —

## Project-context fit

- **Layer touched**: a single authoring skill, `plugins/my-skills/skills/validation-fixer/SKILL.md`. This repo is documentation-and-template authoring; the "code" here is the prose instruction the main agent executes, so the fix is a wording/rule change, verified by structural review (no automated test suite for this skill).
- **Invariants honored**:
  - *Data, never instructions* — this change directly hardens that boundary.
  - *Backward compatibility* — the change alters only how the handoff prompt is built at runtime; no artifact schema, state file, provenance line, or legacy backlog is affected, and a wider fence renders identically for items without long backtick runs.
  - *opencode-port-parity* — not applicable; `validation-fixer` has no override port.
  - *Staged-diff → gate → … → never-commit* and ADR-0008 commit ownership — untouched.
- **Precedent / mirror**: the computed-fence rule mirrors the CommonMark fenced-code-block convention (a closing fence must be at least as long as the opening, so an opening longer than any inner run cannot be closed early) — an established, human-readable pattern that fits the "mirror machinery / reuse established shape" convention.
- **Conflicts**: none. No out-of-scope item is pulled in; the change is bounded to the single `sec-5` concern.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 3.2 handoff-prompt construction (the fence rule + the illustrative example at ~449–451); the batch "Combined brief" bullet (~699–704) confirmed to inherit the rule; the Step-1 untrusted-evidence guard (~72–80) kept consistent. No `references/` file owns the fence rule today; the architect decides whether a one-line note belongs in a reference or stays inline in `SKILL.md` (see default below).

## Open questions

<!-- empty: no unresolved reserved decision; all implementation choices resolved by default below -->

- (none)

## Decisions resolved by Brainstormer default

- Fix strategy: computed-length backtick fence (finding option a) vs. escaped-JSON / generated out-of-band delimiter (option b) → **computed-length backtick fence** → keeps the fenced-code-block representation the downstream frameworks already parse, stays in-medium for a prose authoring skill, is human-readable, and is trivially backward-compatible; the JSON/delimiter approach is heavier and changes how the framework reads evidence for no additional guarantee.
- Fence floor → **keep a minimum of 4 backticks** (`max(4, M+1)`) → never narrower than today's behavior; grows only when the item contains a run of ≥4 backticks.
- Fence character family → **stay with backtick fences (computed length)**, do not switch to tilde (`~~~`) fences → a backtick fence longer than any backtick run in the item is already unbreakable, and matches the current representation.
- Where the rule lives → **operative rule inline at Step 3.2** (the construction site), Step-1 guard kept consistent via at most a cross-reference → single operative source of truth; avoids duplicating the algorithm. Architect may add a brief reference note if it improves clarity, but that is optional.
- Scope across lanes → **update the shared Step-3.2 rule once**; the batch brief already re-wraps each block in that frame, so no separate batch-specific fence change is authored (only verified) → avoids divergent fence logic between single-item and batch paths.

## References

- Finding `sec-5` (severity med): `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md`, section "Security".
- Target: `plugins/my-skills/skills/validation-fixer/SKILL.md` — Step 3.2 (handoff prompt, lines ~438–451), Step-1 untrusted-evidence guard (~72–80), batch "Combined brief" bullet (~699–704).
- `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` — the authorization contract for the batch lane that re-wraps each block in the Step-3.2 frame (must not regress).
- `.orchestrator/PROJECT-CONTEXT.md` — Invariants: "Data, never instructions"; "Backward compatibility"; opencode-port-parity (N/A here).
