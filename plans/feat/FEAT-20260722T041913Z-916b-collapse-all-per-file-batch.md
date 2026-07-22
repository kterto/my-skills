---
id: FEAT-20260722T041913Z-916b
title: Resolve collapse-all (Q3) vs. no-cross-file (Q4) conflict in validation-fixer directory mode
type: feat
status: DONE
created_at: 2026-07-22T04:19:13Z
updated_at: 2026-07-22T04:25:59Z
cycle: 0
related_to: SPEC-20260722T041544Z-a3f5, SPEC-20260721T215726Z-b751, SPEC-20260721T181347Z-1089, ADR-0008
---

**Related:** [SPEC-20260722T041544Z-a3f5](../specs/SPEC-20260722T041544Z-a3f5-collapse-all-cross-file-batch.md) · [ADR-0008](../../docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md)

## Overview

The `validation-fixer` severity-routing rules contain a latent contradiction that
surfaces only in **directory mode** (a run over ≥2 validation files): routing rule **Q3**
lets the user "collapse everything into a single batch" with one shared commit "overriding
all lane defaults," while routing rule **Q4** states "a batch never spans files." When a
directory holds items across multiple files these cannot both hold, and the text never says
which wins — the approved routing choice has no deterministic execution. This plan
implements SPEC-...-a3f5's resolution: make **Q4 the hard invariant** and redefine
"collapse everything" in directory mode as **one collapsed batch per file** (one shared
commit per file), stating commit, rollback, recording, and Step-6 per-file-summary
semantics explicitly and consistently with ADR-0008's work-unit contract. This is a
doc-only prose change to one `SKILL.md` (plus an optional one-line ADR-0008 note); scope is
exactly the bug-2 Q3-vs-Q4 conflict — no other routing behavior changes.

## Acceptance Criteria

1. Q4 is stated in `SKILL.md` as the governing invariant over Q3: no user edit — including
   Q3's "collapse everything" — ever forms a batch spanning more than one validation file;
   Q3's "overriding all lane defaults" is clarified to override severity **lane defaults**
   (which items batch / at what granularity), **not** the Q4 file boundary.
2. Q3's "collapse everything into a single batch," when a run spans ≥2 files, is defined as
   producing **one collapsed batch per file** (each file's open items → one batch → one
   combined orchestrator run → one shared commit scoped to that file); N collapse-all files
   yield N batches and N shared commits.
3. The text explicitly notes single-file mode is the degenerate case — "one batch per file"
   reduces to the existing single-batch behavior — so the wording is a superset, not a
   change, of current single-file semantics.
4. Commit semantics for collapse-all are stated: each per-file collapsed batch lands **one
   shared commit** covering only that file's items' code paths; no commit spans two files;
   the message is the joined batch summary for that file's members under the existing sec-3
   shell-safe construction (unchanged).
5. Rollback semantics for collapse-all are stated: a rejected/`BLOCKED`/errored per-file
   collapsed batch rolls back as a **whole batch** to its `$BEFORE_SHA` via the existing
   validation-file-preserving rollback (bug-11, bug-15), marks every member `- [~]`, and —
   because batches never span files — one file's failure never rolls back another file's
   already-committed batch (each per-file batch is an independent revertible unit).
6. Recording semantics for collapse-all are stated: every member of a per-file collapsed
   batch is marked `- [x]` in **its own** validation file carrying that file's shared SHA(s)
   in its `_fixed via orchestrator · <shared-sha(s)> · <date>_` line; no shared SHA is
   written across files.
7. The Step-6 per-file summary text is consistent: each file reports its own `[x]`/`[~]`/`[ ]`
   counts and its own single shared SHA across its members; no cross-file aggregation of SHAs
   is introduced.
8. A short worked directory-mode trace (in the style of the existing bug-6 / bug-11 traces)
   demonstrates collapse-all over a 2-file directory: two per-file batches, two shared
   commits, and independent whole-batch rollback per file.
9. Q1/Q2 interaction is preserved in prose: processing order stays severity-descending (Q1);
   a per-file collapsed group that resolves to a single member still collapses to the
   dedicated path (Q2); collapse-all changes grouping only, not ordering or the batch-of-one
   rule.
10. Backward compatibility holds in prose: single-file runs, existing `[x]`/`[~]` records,
    and legacy single-SHA lines all behave identically; the change is additive/clarifying,
    no migration.

## Out of Scope

- Any change to single-file-mode behavior (already unambiguous: one file → one batch).
- bug-3 (main-agent-lane binding) or any other backlog finding beyond bug-2.
- Reverting any sec-1..sec-6 / bug-1 fix from this run, or the ADR-0007→ADR-0008
  supersession (SPEC-...-b751's territory).
- Any new lane, new severity, or change to Q1 (severity-descending order) or Q2 (batch-of-one
  collapse).
- `.opencode` port work — `validation-fixer` ships a single copy with **no** override port
  (PROJECT-CONTEXT §Invariants opencode-port-parity does not list it).
- Touching `validation-fixer.bak-*` backup skills.
- Any runtime code / build / test tooling (this is not `clean-code-gates`).

## Technical Notes

- **Single normative surface:** `plugins/my-skills/skills/validation-fixer/SKILL.md`. Confirmed
  current anchors (line numbers shifted after this run's sec-fixes, per the spec's warning):
  - Q1–Q4 routing rules: **lines 300–315** (Q3 = 309–312, Q4 = 313–315).
  - Batch lane: **lines 697–731** (`#### Batch lane (med, grouped by ## lens section)`).
  - Worked-trace batch note: **~lines 860–864**; the bug-6 / bug-11 traces precede it (~800–864).
  - Step 6 — Final summary: **lines 866–873**.
  - The coder MUST re-confirm exact lines before editing (they may shift again as edits land).
- **Q3 currently asserts** "pulls *every* open item into one batch run with **one shared
  commit**, overriding all lane defaults" (311–312) — this is the cross-directory phrasing to
  reword. **Q4 currently ends** "A batch never spans files." (315) — keep it, and make it
  explicitly govern Q3.
- **ADR-0008 contract to preserve:** one work unit = one shared commit = one atomic revertible
  unit. Keeping every collapsed batch within a file boundary preserves this and the same-file
  N-findings→1-commit provenance; it also honors ADR-0008's own Context warning that "an
  invariant with an unwritten or contradicted exception is a trap for the next author."
- **Trust surface unchanged:** the per-file collapsed batch's combined brief still wraps each
  member's untrusted-evidence block individually (Step-3.2 frame) and never merges trust across
  items or files; sec-3 shell-safe commit-message construction is untouched. No new trust
  surface.
- **Mirror machinery convention:** reuse the established phrasing/shape of the existing Batch
  lane bullets (Combined brief / One shared commit / Recording / Failure = whole-batch
  rollback) and the bug-6 / bug-11 worked-trace style; document only the deliberate per-file
  scoping addition.
- **ADR-0008 note is the architect-deferred call (FR spec §Candidate ADR touch):** a one-line
  clarifying note in ADR-0008 ("the file boundary caps collapse-all: one shared commit per
  file, never across files") is **warranted and recommended** because ADR-0008 currently
  assumes same-lens-section batches and a future ADR reader benefits from the file-boundary
  cap being visible there — but it is a single optional line, kept light; SKILL.md remains the
  normative surface. Task 3.2 carries it as `(optional)`.

## Tasks

> Tasks are ordered verification-first: for this doc-only skill "verification" is the
> structural assertion each edit must satisfy (PROJECT-CONTEXT §Test tooling — no automated
> test framework for doc-skill changes; verification is structural review). Each task names
> the assertion before the prose edit that satisfies it. The coder checks off [ ] → [x] as
> each edit is written and its structural assertion re-read as satisfied.

### Phase 1 — Reconcile routing rules Q3 / Q4 (FR1, FR2, FR3, FR9)

- [x] Re-confirm current line anchors for Q1–Q4 (300–315) and record any drift from the
  Technical Notes before editing.
- [x] Reword Q3 (309–312): define "collapse everything into a single batch" as **one
  collapsed batch per file** in directory mode (each file's open items → one batch → one
  combined run → one shared commit scoped to that file; N files → N batches/commits); clarify
  "overriding all lane defaults" to override **severity lane defaults** (which items batch /
  at what granularity), **not** the Q4 file boundary; note single-file mode is the degenerate
  one-batch case so the wording is a superset (satisfies AC-2, AC-3, partial AC-1).
- [x] Reword/annotate Q4 (313–315) so the file boundary is stated as a **hard invariant that
  governs Q3** — no user edit, including collapse-all, ever forms a batch spanning >1 file
  (satisfies AC-1).
- [x] Add the Q1/Q2-preservation clause: collapse-all changes **grouping**, not ordering (Q1
  severity-descending) nor the batch-of-one rule (Q2 — a per-file collapsed group of a single
  member still collapses to the dedicated path); confirm Q1 and Q2 wording is otherwise
  unchanged in meaning (satisfies AC-9).

### Phase 1 verification

- Structural review per `## Verification (per phase)` below: Q3 and Q4 now agree (no clause
  contradicts another); "one collapsed batch per file" appears; the "lane defaults ≠ file
  boundary" clarification is present; Q1/Q2 wording unchanged in meaning; cross-references
  within the routing section still resolve.

### Phase 2 — State collapse-all commit / rollback / recording / summary semantics (FR4, FR5, FR6, FR7)

- [x] Extend the Batch lane section (697–731) — "One shared commit" bullet — to state the
  collapse-all case: each **per-file** collapsed batch lands **one shared commit** covering
  only that file's items' code paths; no commit spans two files; the message is the **joined
  batch summary for that file's members** under the existing sec-3 shell-safe construction
  (message construction unchanged) (satisfies AC-4).
- [x] Extend the "Failure = whole-batch rollback" bullet (727–731) for collapse-all: a
  rejected/`BLOCKED`/errored per-file collapsed batch rolls back **whole** to its
  `$BEFORE_SHA` via the validation-file-preserving rollback (bug-11, bug-15), marks every
  member `- [~]`; because batches never span files, one file's failure never rolls back
  another file's already-committed batch — each per-file batch is an **independent revertible
  unit** (satisfies AC-5).
- [x] Extend the "Recording (Step 4)" bullet (722–726) for collapse-all: every member of a
  per-file collapsed batch is marked `- [x]` in **its own** validation file carrying **that
  file's** shared SHA(s) in its `_fixed via orchestrator · <shared-sha(s)> · <date>_` line; no
  shared SHA is written across files (satisfies AC-6).
- [x] Update the Step-6 Final summary text (866–873) to state the collapse-all case: each file
  reports its own `[x]`/`[~]`/`[ ]` counts and its own single shared SHA across its members; no
  cross-file aggregation of SHAs (add a clarifying line only if the existing per-file wording
  does not already carry it) (satisfies AC-7).

### Phase 2 verification

- Structural review per `## Verification (per phase)` below: commit / rollback / recording /
  Step-6 wording is consistent with Phase 1's Q3/Q4 text and with ADR-0008 (one work unit =
  one shared commit = one atomic revertible unit); no clause implies a cross-file commit,
  cross-file rollback, or cross-file shared SHA; sec-3 and the untrusted-evidence frame are
  referenced as unchanged; cross-references (bug-11/bug-15, ADR-0008, Step 3.4, Step 4) resolve.

### Phase 3 — Worked directory-mode trace + optional ADR note (FR8)

- [x] Add a short worked trace near the existing bug-6 / bug-11 traces (~800–864), in the same
  style, demonstrating collapse-all over a **2-file** directory: two per-file batches, two
  shared commits, and independent whole-batch rollback per file (one file's batch failing
  leaves the other file's committed batch intact) (satisfies AC-8).
- [x] (optional) Add a one-line clarifying note to
  `docs/adr/0008-work-unit-commit-ownership-and-batch-atomicity.md`: the file boundary caps
  collapse-all — one shared commit per file, never across files — so ADR-0008's same-lens
  batch model reads consistently with the file-boundary edge. Keep it to a single line;
  SKILL.md remains normative.
- [x] Final structural review: re-read AC-1..AC-10 against the edited `SKILL.md`; confirm
  backward-compat prose holds (single-file, legacy single-SHA lines, existing `[x]`/`[~]`
  records unchanged), no `.opencode` port exists to mirror, no `validation-fixer.bak-*` file
  was touched, and all internal cross-references resolve.

### Phase 3 verification

- Structural review per `## Verification (per phase)` below: the worked trace is internally
  consistent with Q3/Q4 and the Batch-lane semantics; AC-8 and AC-10 satisfied; the optional
  ADR line (if added) matches SKILL.md and introduces no new claim beyond the file-boundary cap.

## Verification (per phase)

> This repo has **no automated build / test / lint gates for markdown doc-skill authoring**
> (PROJECT-CONTEXT §Commands: Build none, Test none automated for doc skills, Lint none;
> §Test tooling: verification is **structural review**). The `clean-code-gates` JS suite is
> the lone runtime gate and is scoped to that skill only — it MUST NOT be run against this
> change (Invariant). G1 (coverage) and G6 (mutation) are QA-only and not emitted here.
>
> The per-phase gate for this doc change is therefore **structural review**, applied at the
> end of each phase before its last task is checked. No source is silently rewritten to pass
> a check; a failed assertion routes through the coder's BLOCKED step.

Per-phase structural gate (all must hold on the changed set for the phase to exit):

1. **Internal consistency** — no clause in the edited region contradicts another (the whole
   point of bug-2); Q3 and Q4 agree, and the Batch-lane / Step-6 semantics agree with them.
2. **Cross-references resolve** — every referenced anchor (Q1–Q4, ADR-0008, sec-3, bug-11,
   bug-15, bug-12, Step 3.2, Step 3.4, Step 4, Step 6) still points at existing text.
3. **Invariant-preservation prose** — Q4 file boundary stated as governing; ADR-0008 work-unit
   contract preserved; trust frame and sec-3 construction stated as unchanged.
4. **Backward-compat prose** — single-file behavior, legacy single-SHA lines, and existing
   `[x]`/`[~]` records described as unchanged; no migration implied.
5. **Scope containment** — only `SKILL.md` (and optionally the one ADR-0008 line) changed; no
   `.opencode` port, no `templates/`, no JS, no `.bak-*` file touched.

Phase exit criterion: all five hold for the phase's diff. No automated command gate applies to
these paths.

## Dependencies

- None. (Depends conceptually on SPEC-...-1089 severity-routing and SPEC-...-b751 → ADR-0008,
  both already landed in-tree; no plan is blocking.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-22T04:34:25Z | QA

QA-20260722T043201Z-0f39 created. Status: READY_TO_COMMIT. Failures: 0. Lint/type errors: 0.

### 2026-07-22T04:30:57Z | REVIEWER

CR-20260722T042857Z-6f19 created. Status: APPROVED. Must Fix: 0. Should Fix: 1.

### 2026-07-22T04:27:53Z | TESTER

TEST-20260722T042642Z-cad4 created. Status: PASS. Coverage: N/A% → N/A% (doc-only; no
coverage instrument for markdown skills — floor inapplicable). Structural review green on all
five per-phase gates and AC-1..AC-10; cross-refs resolve; scope contained to SKILL.md + ADR-0008.

### 2026-07-22T04:25:59Z | CODER

All 11 tasks complete (10 required + 1 optional ADR note). Plan status → DONE. Ready for
reviewer. Doc-only edits to `plugins/my-skills/skills/validation-fixer/SKILL.md` (Q3/Q4
routing reconciliation, Batch-lane commit/rollback/recording collapse-all semantics, Step-6
per-file summary, new 2-file collapse-all worked trace) plus a one-line file-boundary-cap
note in `docs/adr/0008-...md`. Verification = structural review (no automated gates for doc
skills); all five per-phase structural gates held for each phase's diff. No `.opencode` port,
no `.bak-*` file touched.

### 2026-07-22T04:22:54Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-22T04:19:13Z | ARCHITECT

Plan `FEAT-20260722T041913Z-916b` created. Type: feat. Tasks: 11 (10 required + 1 optional).
Status: PLANNED. Ready for coder.
