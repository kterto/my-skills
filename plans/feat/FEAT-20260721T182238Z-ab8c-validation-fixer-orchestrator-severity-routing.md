---
id: FEAT-20260721T182238Z-ab8c
title: validation-fixer — orchestrator-is-a-skill fix + severity-triaged routing
type: feat
status: DONE
created_at: 2026-07-21T18:23:35Z
updated_at: 2026-07-21T18:41:49Z
cycle: 0
related_to: SPEC-20260721T181347Z-1089
---

**Related:** [SPEC-20260721T181347Z-1089](../specs/SPEC-20260721T181347Z-1089-orchestrator-skill-severity-routing.md)

## Overview

Amend the single dual-host file `plugins/my-skills/skills/validation-fixer/SKILL.md` with two documentation changes from SPEC-20260721T181347Z-1089. **Change A** corrects a factual error — `my-skills:orchestrator` is a host **Skill** that runs in the caller session and spawns its own role subagents, not itself a subagent; the current Step 2 bullet, Step 2 autonomous warning, and Step 3.3 invocation row wrongly invoke it as one. **Change B** adds an orchestrator-only **Step 2.5 routing plan** that reads each open item's severity, proposes a three-lane routing plan (main-agent / batch / dedicated) for one-time approval, and generalizes Step 3's loop from per-item to per-**work-unit**. This is a prose-only edit to one Markdown skill; there is no code test suite, so "tests" here mean **structural self-consistency verification** of the edited `SKILL.md` (step numbers, invariant names, worked examples, and cross-references all reconcile) per the repo's no-suite doc-skill posture.

## Acceptance Criteria

1. The Step 2 orchestrator bullet documents it as invoked via the host **Skill** tool (Claude Code `Skill` / opencode skill mechanism), running in the caller session and spawning its own `brainstormer→architect→coder→tester→reviewer→qa` subagents, stopping at `READY_TO_COMMIT` (never commits), and unattended-friendly; the phrase "Runs as a subagent" is gone. (FR1)
2. The Step 2 autonomous-mode warning still identifies the orchestrator as the unattended-friendly choice but no longer calls it a subagent. (FR2)
3. The Step 3.3 invocation table's orchestrator row uses the same "host skill tool" column shape as the superpowers/gsd rows (`Skill` with `my-skills:orchestrator` in Claude Code / opencode skill mechanism, handoff prompt as args); the `Agent`/`task` + `subagent_type: orchestrator` wording is removed and the intro sentence above the table is unchanged. (FR3)
4. A full-file sweep leaves **no** remaining spot (prose, notes, edge cases, Step 3.4 commit-ownership discussion) that calls the orchestrator a subagent; every such spot reads "Skill that spawns its own role subagents"; Step 3.4's "stops at `READY_TO_COMMIT` and never commits" substance is unchanged. (FR4)
5. Frontmatter `allowed-tools` retains all existing entries (Read/Edit/Bash/Grep/Glob); no entry is removed unless confirmed wholly unused, and the dual-host contract is not broken. (FR5)
6. A new **Step 2.5 — Routing plan** is inserted after Step 2 and before Step 3; it runs **only when framework = orchestrator** and is explicitly skipped (loop unchanged) for superpowers/gsd. (FR6)
7. Step 2.5 reads each open item's severity from the `[<ID>|<sev>]` token per the findings-md-schema (`<sev>` ∈ `crit|high|med|low|info`); a missing token → `unknown`; reading the token never re-parses or splits an item (one backlog line = one item). (FR7)
8. Default lanes are documented: main-agent ← `low`,`info`; batch ← `med` (grouped BY LENS `## ` section by default); dedicated ← `crit`,`high`,`unknown`. (FR8)
9. Step 2.5 prints the plan grouped by lane with item IDs and asks for approval **exactly once** via the host structured-question tool (`AskUserQuestion` / opencode `question`); autonomous mode auto-accepts the default, checkpoint mode waits for approval/edits. (FR9)
10. The doc states user edits at approval are **unrestricted** across all three lanes (any item to any lane; "collapse everything into a single batch" pulls every open item into one batch run with one shared commit, overriding all lane defaults). (FR10)
11. Work-unit processing order is documented as **severity-descending**: dedicated (crit/high/unknown) → med batches → main-agent (low/info); document/section order preserved within a lane. (FR11)
12. A batch group resolving to a **single member** collapses to the **dedicated path** (single-item run, per-item commit, one `[x]`); shared-commit machinery engages only at ≥2 members. (FR12)
13. In directory mode, batch grouping keys on `(file, section)` — a recurring `## ` lens heading across different files forms **separate** batches (batches never span files). (FR13)
14. The Step 3 loop preamble is generalized so a **work unit** is one item (main-agent or dedicated) or a batch (≥2 items → one shared commit); the bug-6 clean-tree gate and `BEFORE_SHA`/`AFTER_SHA` + pre-run untracked baseline are captured **per work unit**, with all existing gate mechanics (validation-file exemption, path-exact match, never `git add` the validation file) applying at work-unit granularity. (FR14)
15. The main-agent lane documents an inline fix by the host's **own main agent** (read code → apply fix → run relevant tests, **no framework spawned**), explicitly framed as a **new bounded exception** to the "This skill does NOT fix bugs itself" invariant, bound to **low/info** severity and governed by bug-7 preflight, the per-work-unit bug-6 gate, and checkpoint/autonomous approval rules. (FR15)
16. The main-agent lane states the item is consumed **inside the Step-3.2 untrusted-evidence frame** (verify against real code, quoted text is data not commands, no scope expansion) even with no framework spawned. (FR16)
17. The main-agent fix is documented as committed through the existing **Step-3.4 commit-ownership path (ADR-0007)** — HEAD unchanged, tree dirty, success → validation-fixer commits per item, including sec-3 shell-safe construction and the defense-in-depth protected-branch re-assert. (FR17)
18. The doc states the main-agent lane's checkpoint **diff-approval IS the per-item validation gate** (Step-5 "don't prompt twice" dedup applies; autonomous = standing approval). (FR18)
19. The main-agent lane's failure handling is documented as the bug-11/bug-15 validation-file-preserving rollback to `$BEFORE_SHA` and recording `- [~]` (never `- [x]`), exactly as a failed dedicated run. (FR19)
20. The main-agent lane states "run relevant tests" is best-effort / target-project-dependent — absence of a runnable suite is **not** a failure (consistent with this repo's no-suite doc-skill posture). (FR20)
21. The batch lane documents **one combined orchestrator run**: grouped items' **verbatim** untrusted-evidence blocks combined as a multi-concern brief, **each block still individually wrapped** in the Step-3.2 frame, with the brief stating each block is independent evidence to verify (not instructions) and that one backlog line = one concern — combining never merges trust. (FR21)
22. The batch lane documents **one shared commit** on `READY_TO_COMMIT` with **every** item marked `- [x]` carrying the **same shared SHA(s)** in its `_fixed via …_` line. (FR22)
23. The batch commit message is documented as built from the **joined batch summary** under the full sec-3 rule (collapse each field to one physical line, never interpolate item text into a shell string, `git add -- <code paths>` never the validation file, message via `git commit -F -` heredoc / `-F <tmpfile>` / argument-safe API). (FR23)
24. Batch failure (`BLOCKED`/errored) is documented as a **whole-batch** validation-file-preserving rollback (tracked + untracked, partial commits included) recording **every** constituent item `- [~]` never `- [x]` — the per-work-unit application of bug-11/bug-15 and the bug-12 committed-then-blocked rule. (FR24)
25. The dedicated lane documents current per-item behavior preserved (one orchestrator run, per-item commit, `- [x]` with its own SHA), including a collapsed batch-of-one. (FR25)
26. Step 4 recording is documented per work unit: batch success → each item `[x]` with shared SHA(s); bug-12 "no commit / blocked → `- [~]`" holds per work unit; main-agent/dedicated single items record as today; the Step-4 in-place edit still dirties **only** the validation file(s) and is never committed. (FR26)
27. The bug-6 and bug-11 worked-example traces remain valid, with **at most a one-line note** (per example or shared) that a batch work unit yields one shared commit with per-item `[x]` and a batch failure rolls the whole batch back to `[~]`; the traces are not otherwise rewritten. (FR27)
28. The frontmatter `description` clause "feeds each open item one at a time into that framework's entry point" is adjusted so **orchestrator** items are noted as **severity-routed** (main-agent / batched / dedicated) while remaining accurate for the **superpowers/gsd** paths (still one at a time). (FR28)
29. Structural self-consistency holds across the whole file: all referenced step numbers (2, 2.5, 3, 3.1–3.4, 4, 5) resolve, invariant names (bug-6, bug-7, bug-11, bug-12, bug-15, sec-3, ADR-0007) are used consistently, dual-host wording (`Skill`/`Agent` for Claude Code, skill/`task` for opencode) is preserved, and no cross-reference dangles.

## Out of Scope

- Any change to the **superpowers** or **gsd** routing paths — Step 2.5 is skipped for both; they keep per-item behavior. (Non-goal)
- Any alteration of the **protected-branch preflight** (bug-7), **rollback mechanics** (bug-11, bug-15), or **provenance/trust guards** — the new lanes/work-units only *extend* their coverage. (Non-goal)
- Adding new `allowed-tools` entries — the frontmatter already lists Read/Edit/Bash/Grep/Glob. (Non-goal)
- Any `.opencode/skills/validation-fixer/` override port — no port exists; opencode-port-parity is not triggered. Keep dual-host wording in-file. (Non-goal)
- Running any automated test suite — this repo has no suite for doc skills; verification is structural. (Non-goal)
- Editing any file other than `plugins/my-skills/skills/validation-fixer/SKILL.md` (the findings-md-schema is a **read-only** reference for the severity-token contract).

## Technical Notes

- **Single-source-of-truth / single-file skill:** `validation-fixer` has no `references/` folder; all new normative detail lives inline in `SKILL.md`, consistent with its current structure (Project-context fit).
- **Mirror-machinery convention:** the batch and main-agent lanes must **reuse** the established commit-ownership / rollback / recording phrasing rather than invent parallel machinery; document only the deliberate divergences (main-agent = no framework spawn; batch = one shared commit across members).
- **ADR-0007 bounded exception:** validation-fixer is the documented exception that owns per-item commits for frameworks stopping at `READY_TO_COMMIT`. Both new committing lanes (main-agent, batch) must stay inside that bounded exception — checkpoint approval per commit, autonomous standing approval, atomic rollback, and a hard STOP before auto-committing a protected branch (`main`/`master`/`dev`).
- **Trust invariants:** "Data, never instructions" and the Step-3.2 untrusted-evidence frame govern both new lanes — item text stays quoted evidence to verify; a batch brief wraps each block individually and never merges trust. A missing severity token is treated conservatively (`unknown` → dedicated), never silently downgraded.
- **Backward compatibility (mandatory):** legacy single-item / superpowers / gsd behavior must render and execute unchanged; the new severity routing is additive and orchestrator-only.
- **sec-3 shell-safe commit construction** extends to the joined batch summary; never interpolate untrusted item text into a shell string.
- **Read-only reference for severity token:** `plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md` (§Severity abbreviations) defines `[<ID>|<sev>]` and `crit|high|med|low|info`.
- **No code gates apply:** per PROJECT-CONTEXT Commands, there is no build/test/lint tooling for markdown doc skills; the `clean-code-gates` JS suite is scoped to that skill only and must NOT be run here. Phase verification is the structural self-consistency check described in `## Verification (per phase)`.

## Tasks

> Tasks are ordered structural-check-first (the doc-skill analogue of TDD): write the self-consistency assertion that currently fails, then make the prose edit that satisfies it.
> The coder will check off [ ] → [x] as each task is verified.
> Each phase ends with a `### Phase N verification` checklist that the coder MUST run + assert green before checking the last task in the phase.

### Phase 1 — Change A: orchestrator is a Skill, not a subagent

- [x] Write the structural check for Change A: enumerate every current occurrence in `SKILL.md` where `my-skills:orchestrator` is called/invoked as a subagent (`grep -n -i 'subagent\|Runs as a subagent\|subagent_type: orchestrator'` and the Step 3.3 `Agent`/`task` row), and record the expected post-edit assertions (no orchestrator-as-subagent wording remains; superpowers/gsd `Agent`/`task` usages, if any, are untouched).
- [x] Rewrite the Step 2 framework-list **orchestrator bullet** (FR1): invoked via host **Skill** tool (Claude Code `Skill` / opencode skill mechanism), runs in the caller session and spawns its own `brainstormer→architect→coder→tester→reviewer→qa` subagents, stops at `READY_TO_COMMIT` (never commits), unattended-friendly; remove "Runs as a subagent."
- [x] Reword the Step 2 **autonomous-mode warning** (FR2): keep it as the unattended-friendly choice, drop the "(a subagent)" characterization.
- [x] Rewrite the Step 3.3 invocation-table **orchestrator row** (FR3) to the "host skill tool" column shape matching superpowers/gsd (`Skill` with `my-skills:orchestrator` / opencode skill mechanism, handoff prompt as args); remove `Agent`/`task` + `subagent_type: orchestrator`; leave the intro sentence above the table unchanged.
- [x] Sweep the whole file (FR4) — prose, notes, edge cases, and the Step 3.4 commit-ownership discussion — replacing any remaining orchestrator-as-subagent wording with "Skill that spawns its own role subagents"; confirm Step 3.4's "stops at `READY_TO_COMMIT` and never commits" substance is unchanged.
- [x] Verify frontmatter `allowed-tools` (FR5): confirm all existing entries (Read/Edit/Bash/Grep/Glob) remain; remove none unless confirmed wholly unused; do not break the dual-host contract.
- [x] Run the Phase 1 structural check and confirm green.

### Phase 1 verification

- [x] `grep -n -i 'subagent' SKILL.md` shows no line attributing subagent-hood to `my-skills:orchestrator` (only the correct "spawns its own role subagents" framing and unrelated superpowers/gsd usages remain).
- [x] No occurrence of "Runs as a subagent" or `subagent_type: orchestrator` remains.
- [x] The Step 3.3 orchestrator row has the same column shape as the superpowers/gsd rows; the intro sentence above the table is byte-identical to before.
- [x] `allowed-tools` still lists Read/Edit/Bash/Grep/Glob.

### Phase 2 — Change B: Step 2.5 routing plan (orchestrator-only)

- [x] Write the structural check for Step 2.5: assert (currently failing) that a Step 2.5 exists between Step 2 and Step 3, is orchestrator-only with an explicit superpowers/gsd skip, references the findings-md-schema `[<ID>|<sev>]` token, documents the three lane defaults, the exactly-once approval, autonomous-vs-checkpoint behavior, and the Q1–Q4 rules.
- [x] Insert **Step 2.5 — Routing plan** after Step 2 / before Step 3 with the orchestrator-only gate + explicit superpowers/gsd skip (FR6).
- [x] Document the **severity read** (FR7): read `[<ID>|<sev>]` per findings-md-schema (`crit|high|med|low|info`), missing token → `unknown`, and that reading never re-parses/splits an item (one line = one item).
- [x] Document the **default lanes** (FR8): main-agent ← low/info; batch ← med (grouped BY LENS `## ` section by default); dedicated ← crit/high/unknown.
- [x] Document **propose-and-approve exactly once** (FR9) via the host structured-question tool (`AskUserQuestion` / opencode `question`), plan grouped by lane with item IDs; autonomous auto-accepts, checkpoint waits.
- [x] Document **unrestricted user edits** (FR10): any item to any lane; "collapse everything into a single batch" pulls every open item into one batch run with one shared commit, overriding defaults.
- [x] Document **work-unit processing order** (FR11): severity-descending (dedicated → med batches → main-agent), document/section order within a lane.
- [x] Document **batch-of-one** (FR12): single-member batch collapses to the dedicated path; shared-commit machinery only at ≥2 members.
- [x] Document **batches never span files** (FR13): directory-mode grouping keys on `(file, section)`; recurring `## ` lens across files → separate batches.
- [x] Run the Phase 2 structural check and confirm green.

### Phase 2 verification

- [x] Step 2.5 is present between Step 2 and Step 3 and states the orchestrator-only gate + superpowers/gsd skip.
- [x] Severity token contract, five severities, `unknown` fallback, three lane defaults, exactly-once approval, autonomous/checkpoint split, and Q1–Q4 (order / batch-of-one / unrestricted-edits / never-span-files) are all present.
- [x] The severity-token reference points at `pr-review-report/references/findings-md-schema.md`.

### Phase 3 — Step 3 work-unit generalization + three lanes

- [x] Write the structural check for Phase 3: assert (currently failing) that the Step 3 preamble defines a **work unit**, that the bug-6 gate + `BEFORE_SHA`/`AFTER_SHA` + untracked baseline are captured per work unit, and that main-agent / batch / dedicated lanes each document commit, tracking, rollback, and recording semantics reconciled with bug-6/7/11/12/15, sec-3, ADR-0007.
- [x] Generalize the **Step 3 loop preamble** (FR14): a work unit = one item (main-agent/dedicated) or a batch (≥2 items → one shared commit); bug-6 clean-tree gate and `BEFORE_SHA`/`AFTER_SHA` + pre-run untracked baseline captured per work unit; existing gate mechanics (validation-file exemption, path-exact match, never `git add` the validation file) apply at work-unit granularity.
- [x] Document the **main-agent lane** (FR15–FR20): inline fix by the host's own main agent (read → fix → best-effort tests, no framework spawned) as a bounded low/info exception to "does NOT fix bugs itself"; still inside the Step-3.2 untrusted-evidence frame; commits via Step-3.4 commit-ownership (ADR-0007, sec-3, protected-branch re-assert); checkpoint diff-approval IS the per-item gate (Step-5 dedup, autonomous = standing approval); failure → bug-11/bug-15 rollback + `- [~]`; no-suite is not a failure.
- [x] Document the **batch lane** (FR21–FR24): one combined orchestrator run of verbatim untrusted-evidence blocks each individually wrapped (brief states independent-evidence / one-line-one-concern / never-merge-trust); one shared commit with every item `- [x]` carrying the shared SHA(s); sec-3 shell-safe joined summary (`git add -- <code paths>`, `git commit -F -`); batch failure → whole-batch bug-11/bug-15 rollback recording every item `- [~]` (bug-12 committed-then-blocked).
- [x] Document the **dedicated lane** (FR25): current per-item behavior preserved (one run, per-item commit, `- [x]` with own SHA), including collapsed batch-of-one.
- [x] Update **Step 5 checkpoint dedup** (FR18) so the main-agent lane's commit-ownership commit uses the "don't prompt twice" dedup.
- [x] Run the Phase 3 structural check and confirm green.

### Phase 3 verification

- [x] The Step 3 preamble defines a work unit and locates the bug-6 gate + `BEFORE_SHA`/`AFTER_SHA` + untracked baseline per work unit.
- [x] Each lane (main-agent / batch / dedicated) documents commit + tracking + rollback + recording, reconciled with the named invariants (bug-6, bug-7, bug-11, bug-12, bug-15, sec-3, ADR-0007).
- [x] The "This skill does NOT fix bugs itself" invariant text now carries the explicit bounded low/info main-agent exception.
- [x] Step 5's dedup covers the main-agent lane.

### Phase 4 — Recording, worked examples, description, final sweep

- [x] Write the structural check for Phase 4: assert (currently failing) that Step 4 records per work unit (batch shared SHA), the bug-6 & bug-11 worked examples carry the one-line batch note, and the frontmatter `description` notes orchestrator severity-routing while staying accurate for superpowers/gsd.
- [x] Update **Step 4 recording** (FR26): batch success → each item `[x]` with shared SHA(s); bug-12 "no commit / blocked → `- [~]`" per work unit; main-agent/dedicated single items as today; the Step-4 in-place edit dirties only the validation file(s) and is never committed.
- [x] Add the **one-line batch note** to the bug-6 and bug-11 worked examples (FR27) — a batch yields one shared commit with per-item `[x]`; a batch failure rolls the whole batch back to `[~]`; do not otherwise rewrite the traces (a single item = the dedicated lane).
- [x] Adjust the frontmatter **`description`** (FR28): orchestrator items are severity-routed (main-agent / batched / dedicated); superpowers/gsd still feed items one at a time.
- [x] Run the **final full-file self-consistency sweep** (AC 29): all step numbers (2, 2.5, 3, 3.1–3.4, 4, 5) resolve, invariant names used consistently, dual-host wording preserved, no dangling cross-reference; confirm green.

### Phase 4 verification

- [x] Step 4 documents per-work-unit recording including the batch shared-SHA `[x]` rule.
- [x] The bug-6 and bug-11 example traces are intact except for the added one-line batch note.
- [x] The frontmatter `description` reflects orchestrator severity-routing and remains accurate for superpowers/gsd.
- [x] Final sweep: no dangling step/invariant reference; dual-host `Skill`/`Agent` + skill/`task` wording preserved.

## Verification (per phase)

> Before checking the LAST task in any phase, the coder runs the gate commands from the Commands section of PROJECT-CONTEXT.md that apply to the phase's touched paths and asserts each exits 0.

Applicable gate commands for this change: **none automated.** Per PROJECT-CONTEXT (`## Commands`, `## Test tooling`), there is no build/test/lint tooling for markdown doc skills, and the `clean-code-gates` JS suite is scoped to that skill only and MUST NOT be run against `validation-fixer/SKILL.md`. The phase exit criterion is therefore the **structural self-consistency check** defined in each `### Phase N verification` block above: the coder runs the listed `grep`/read assertions over the edited `SKILL.md` and asserts each is satisfied. A failed structural assertion routes through the coder's BLOCKED step, not a silent rewrite of the prose to paper over it.

G1 (coverage) and G6 (mutation) are QA-only and are not emitted here.

## Dependencies

- None. (SPEC-20260721T181347Z-1089 is READY_FOR_PLANNING; the read-only `findings-md-schema.md` reference already exists.)

## Progress Log

<!-- Agents append below. Never rewrite entries. Newest on top. -->

### 2026-07-21T18:51:32Z | REVIEWER

CR-20260721T185132Z-138e created. Status: REQUEST_CHANGES. Must Fix: 1. Should Fix: 2.

### 2026-07-21T18:49:53Z | TESTER

TEST-20260721T184813Z-3529 created. Status: PASS. Coverage: N/A → N/A (no coverage tooling for Markdown doc skills; structural self-consistency verification per project posture). All 29 acceptance criteria structurally satisfied in `SKILL.md`; e2e excluded (no doc-skill e2e harness).

### 2026-07-21T18:41:49Z | CODER

All 33 tasks complete (4 phases + per-phase verification). Plan status → DONE. Ready for reviewer.
Change A (orchestrator = Skill, not subagent), Change B (Step 2.5 routing plan + Step 3 work-unit generalization + three lanes), Step 4 per-work-unit recording, worked-example batch notes, and the frontmatter `description` all landed in `plugins/my-skills/skills/validation-fixer/SKILL.md`. All four phase structural self-consistency checks green; final full-file sweep green (step numbers, invariant names, dual-host wording all reconcile; no dangling cross-reference).

### 2026-07-21T18:26:14Z | CODER

Session started. Plan status → IN_PROGRESS. Beginning from first unchecked task.

### 2026-07-21T18:23:35Z | ARCHITECT

Plan `FEAT-20260721T182238Z-ab8c` created. Type: feat. Tasks: 33 (4 phases + per-phase verification checklists).
Status: PLANNED. Ready for coder.
