---
id: SPEC-20260722T041544Z-a3f5
title: Resolve collapse-all (Q3) vs. no-cross-file (Q4) conflict in validation-fixer directory mode
status: READY_FOR_PLANNING
created_at: 2026-07-22T04:15:44Z
updated_at: 2026-07-22T04:15:44Z
cycle: 0
related_to: SPEC-20260721T181347Z-1089, SPEC-20260721T215726Z-b751, ADR-0008
---

## Summary

The `validation-fixer` severity-routing rules contain a latent contradiction that
surfaces only in **directory mode** (a run over ≥2 validation files). Routing rule **Q3**
lets the user "collapse everything into a single batch" — one batch run, one shared
commit, "overriding all lane defaults" (SKILL.md line 311-312) — while routing rule **Q4**
states categorically that "Batches never span files… A batch never spans files" (line
313-315). When a directory holds items in more than one file, "collapse everything" and
"a batch never spans files" cannot both hold, and the text never states which wins, so the
approved routing choice has **no deterministic execution**. This spec closes that gap by
making **Q4 the hard invariant** and redefining "collapse everything" in directory mode as
**one collapsed batch per file** (one shared commit per file), with the commit, rollback,
recording, and per-file-summary semantics stated explicitly. Scope is exactly this one
conflict (bug-2); no other routing behavior changes.

## Goals

- The Q3 "collapse everything into a single batch" user edit has a **single, deterministic**
  meaning in both single-file and directory mode, with no rule contradicting another.
- **Q4 ("a batch never spans files") remains a true invariant** — no rule, including Q3,
  ever produces a batch whose members come from more than one validation file.
- In directory mode, "collapse everything" resolves to **one collapsed batch per file**:
  each file's open items form one batch (one combined orchestrator run, one shared commit
  scoped to that file); N files with collapse-all yield N batches and N shared commits.
- The commit-ownership, whole-batch rollback, shared-SHA recording, and Step-6 per-file
  summary semantics for the collapse-all case are stated explicitly and stay consistent
  with ADR-0008's work-unit contract (each work unit = one shared commit; the approved
  batch is the atomic revertible unit) and the existing per-file recording model.
- A worked directory-mode note (mirroring the existing bug-6 / bug-11 traces) shows the
  collapse-all path so the next author cannot re-introduce the ambiguity.

## Non-goals

- **No change to single-file-mode behavior.** In single-file mode "collapse everything" is
  already unambiguous (one file → one batch) and stays exactly as-is.
- **Not touching bug-3** (main-agent-lane binding) or any other backlog finding — this spec
  is scoped to the bug-2 Q3-vs-Q4 conflict only.
- **Not reverting** any sec-1..sec-6 / bug-1 fix landed earlier this run, nor the
  ADR-0007→ADR-0008 supersession (that is SPEC-...-b751's territory).
- **No new lane, no new severity, no change to Q1 (severity-descending order) or Q2
  (batch-of-one collapse).** Q2's collapse-to-dedicated for a single-member group is
  unaffected.
- **No `.opencode` port work** — `validation-fixer` ships a single copy with no override
  port (confirmed; PROJECT-CONTEXT §Invariants opencode-port-parity does not list it).
- **No touching of the `validation-fixer.bak-*` backup skill.**

## Users and use cases

- **Skill author / maintainer (this repo):** reads SKILL.md as the normative spec of the
  skill's behavior; needs Q3 and Q4 to be mutually consistent so the routing plan they
  document/execute is deterministic.
- **`validation-fixer` at runtime (the host main agent executing the skill):** when a user
  in checkpoint mode edits the routing plan to "collapse everything" over a directory of
  validation files, the skill must have exactly one defined execution — not two conflicting
  rules — for how many batches and commits result and how rollback/recording behave.

## Functional requirements

1. **Q4 is stated as the governing invariant over Q3.** SKILL.md must state that the
   file boundary is a hard invariant: no user edit, including Q3's "collapse everything,"
   ever forms a batch spanning more than one validation file. Q3's "overriding all lane
   defaults" is clarified to override severity **lane defaults** (which items batch / at what
   granularity), **not** the Q4 file boundary.
2. **Collapse-all in directory mode = one batch per file.** The Q3 text must define
   "collapse everything into a single batch," when a run spans ≥2 files, as producing **one
   collapsed batch per file** — each file's open items become one batch (a work unit of size
   ≥2, or size 1 which then collapses to dedicated per Q2), yielding one combined
   orchestrator run and **one shared commit per file**.
3. **Single-file mode is explicitly the degenerate case.** The text must note that in
   single-file mode "one batch per file" reduces to the existing single-batch behavior, so
   the wording is a superset, not a change, of current single-file semantics.
4. **Commit semantics stated for collapse-all.** Each per-file collapsed batch lands **one
   shared commit** covering only that file's items' code paths (ADR-0008 §Decision, one work
   unit = one commit). No commit spans two files' worth of items. The commit message is the
   joined batch summary for that file's members, built under the existing sec-3 shell-safe
   construction (no change to message construction).
5. **Rollback semantics stated for collapse-all.** A per-file collapsed batch that is
   rejected / `BLOCKED` / errored rolls back as a **whole batch** to its `$BEFORE_SHA` via
   the existing validation-file-preserving rollback (bug-11, bug-15), discarding that
   file's batch delta and marking **every** member of that file's batch `- [~]`. Because
   batches never span files, one file's collapsed-batch failure never rolls back another
   file's already-committed batch — each per-file batch is an independent revertible unit.
6. **Recording semantics stated for collapse-all.** Every member of a per-file collapsed
   batch is marked `- [x]` in **its own** validation file carrying that file's batch shared
   SHA(s) in its `_fixed via orchestrator · <shared-sha(s)> · <date>_` line (the ADR-0008
   N-findings→1-commit mapping, scoped per file). No shared SHA is written across files.
7. **Step-6 per-file summary is consistent.** The final per-file summary continues to report
   each file's `[x]`/`[~]`/`[ ]` counts and SHAs; with collapse-all each file reports its own
   single shared SHA across its members. No cross-file aggregation of SHAs is introduced.
8. **Worked directory-mode note.** Add (or extend) a short worked trace — in the style of
   the existing bug-6 / bug-11 traces — demonstrating collapse-all over a 2-file directory:
   two per-file batches, two shared commits, and independent whole-batch rollback per file.
9. **Q1/Q2 interaction preserved.** Processing order stays severity-descending (Q1); a
   per-file collapsed group that resolves to a single member still collapses to the dedicated
   path (Q2). The collapse-all edit changes grouping, not ordering or the batch-of-one rule.

## Non-functional requirements

- **Performance**: —
- **Security / auth**: The untrusted-evidence frame, one-line-per-concern trust rule, and
  sec-3 shell-safe commit-message construction are unchanged; a per-file collapsed batch's
  combined brief still wraps each member's evidence block individually and never merges trust
  across items or files. No new trust surface is introduced.
- **Localization**: —
- **Accessibility**: —
- **Geospatial / geofence**: —
- **Trust / moderation**: —
- **Privacy / compliance**: —
- **Monetization tier**: —

## Project-context fit

- **Layers touched:** documentation/prose only — a single normative `SKILL.md` (plus an
  optional one-line clarifying note in ADR-0008). No runtime code, no build/test tooling
  (this is not `clean-code-gates`). Verification is structural review per PROJECT-CONTEXT
  §Test tooling.
- **Depends on / extends:** the severity-routing feature (SPEC-...-1089) and the batch-commit
  reconciliation (SPEC-...-b751 → ADR-0008). This spec resolves a residual directory-mode
  edge those two did not address — both frame a batch as a same-lens-section group and neither
  states what "collapse everything" does across files.
- **Invariant that shapes the fix:** ADR-0008's work-unit contract — one work unit = one
  shared commit = one atomic revertible unit — is preserved by keeping every collapsed batch
  within a file boundary; this avoids a cross-file shared commit that would stretch the
  documented N-findings→1-commit provenance and the per-file recording/summary model. It also
  honors ADR-0008's own Context warning that "an invariant with an unwritten or contradicted
  exception is a trap for the next author" — Q4 stays a real invariant rather than one Q3
  silently overrides.
- **Backward compatibility:** the change is additive prose that makes an under-specified case
  deterministic; single-file runs, existing `[x]`/`[~]` records, and legacy single-SHA lines
  all behave identically. No migration.
- **Candidate ADR touch:** ADR-0008 assumes same-lens-section batches; the architect should
  decide whether a one-line note there ("the file boundary caps collapse-all: one shared
  commit per file, never across files") is warranted, or whether SKILL.md alone suffices. Not
  mandated by this spec.
- **Conflict for the architect to resolve:** the fix requires rewording Q3 (line 311-312,
  which currently asserts a single cross-directory batch and one shared commit) and clarifying
  Q4 (line 313-315) so the two agree. The architect must confirm the exact current line
  numbers (they shifted after this run's sec-1..sec-5 fixes) before editing.

## Affected surface

- **Backend**: —
- **Frontend / mobile**: —
- **Admin**: —
- **Shared**: `plugins/my-skills/skills/validation-fixer/SKILL.md` — Routing rules Q3 and Q4
  (approx. lines 305-315), the "Batch lane" section (approx. lines 697-731), and the worked
  traces / Step-6 summary region (approx. lines 829-869) for the directory-mode note.
  Optionally `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` (one clarifying
  line, architect's call). No `.opencode` port, no `templates/`, no JS.

## Open questions

- (none — the sole design choice is resolved by Brainstormer default below; not a reserved
  decision: in-scope doc change, reversible, no product/compliance/one-way-door dimension.)

## Decisions resolved by Brainstormer default

- **Which rule wins the Q3-vs-Q4 conflict in directory mode — cap collapse-all at one batch
  per file (Q4 wins), or let collapse-all span files with documented cross-file commit/rollback
  (Q3 wins)?** → **Q4 wins: "collapse everything" is capped at one collapsed batch per file
  (one shared commit per file, N files → N commits).** → Rationale: (a) keeps Q4 a genuine
  invariant instead of "invariant except when Q3 overrides it," avoiding exactly the
  contradicted-exception trap ADR-0008's own Context warns against; (b) keeps every commit,
  whole-batch rollback, `[x]` recording, and Step-6 summary scoped to a single validation file,
  so all of them stay unchanged and per-file-clean — no cross-file shared SHA to represent in
  multiple backlogs; (c) aligns with ADR-0008's atomicity model (each work unit = one shared
  commit within a coherent group) without stretching its documented same-file N→1 provenance;
  (d) it is the more conservative, backward-compatible reading and matches the report's first
  suggested fix ("define collapse-all as one batch per file"). The alternative (Q3 wins,
  cross-file batch) would require inventing and documenting new cross-file commit/rollback and
  cross-backlog shared-SHA semantics for marginal benefit.

## References

- `plugins/my-skills/skills/validation-fixer/SKILL.md` — Q1–Q4 routing rules (approx. lines
  300-315), Batch lane (approx. 697-731), worked traces + Step 6 (approx. 829-869).
- `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md` — work-unit = one shared
  commit = atomic revertible unit; same-lens-section batch model this spec extends to the
  file-boundary edge.
- `docs/reviews/feat-validation-fixer-severity-routing-345083349153-2026-07-21.md` §Bugs &
  Improvements — source finding bug-2 (fingerprint
  `bugs|plugins/my-skills/skills/validation-fixer/SKILL.md|collapseall-routing-conflicts-with-the-nocrossfile-rule`).
- `plans/specs/SPEC-20260721T215726Z-b751-validation-fixer-batch-commit-boundary.md` — the
  batch-commit-boundary reconciliation that produced ADR-0008 (related, upstream).
- `plans/specs/SPEC-20260721T181347Z-1089-orchestrator-skill-severity-routing.md` — the
  severity-routing feature that introduced Q1–Q4 and the batch lane.
- `.orchestrator/PROJECT-CONTEXT.md` §Invariants — commit-exception clause (ADR-0008),
  opencode-port-parity (validation-fixer has no port).
