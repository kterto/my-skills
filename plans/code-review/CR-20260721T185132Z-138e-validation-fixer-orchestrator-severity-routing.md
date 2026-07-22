---
id: CR-20260721T185132Z-138e
plan: FEAT-20260721T182238Z-ab8c
title: Review of validation-fixer — orchestrator-is-a-skill fix + severity-triaged routing
status: REQUEST_CHANGES
created_at: 2026-07-21T18:51:32Z
reviewer: reviewer-agent
cycle: 0
must_fix_count: 1
should_fix_count: 2
---

**Related:** [FEAT-20260721T182238Z-ab8c](../feat/FEAT-20260721T182238Z-ab8c-validation-fixer-orchestrator-severity-routing.md)

## Summary

Prose-only review of one dual-host Markdown skill (`plugins/my-skills/skills/validation-fixer/SKILL.md`) against SPEC-20260721T181347Z-1089. Change A (orchestrator documented as a host **Skill**, not a subagent) is clean and complete — no residual subagent-hood wording, dual-host phrasing intact, invocation table row reshaped to match superpowers/gsd. Change B (Step 2.5 severity routing + three lanes + Step 3 work-unit generalization) is faithful, reconciles correctly with the load-bearing invariants (bug-6/7/11/12/15, sec-3, ADR-0007), and reads the severity token from the correct second bracket per the findings-md-schema. **One blocker:** the load-bearing "never fabricates a fix" guard was not generalized to the new no-framework main-agent lane, so a whole-file invariant now contradicts that lane. Verdict: REQUEST_CHANGES.

## Acceptance Criteria Check

| # | Criterion | Met? | Notes |
|---|-----------|------|-------|
| 1 | Step 2 bullet: orchestrator = host Skill, spawns own subagents, stops at READY_TO_COMMIT, no "Runs as a subagent" | ✅ | Lines 93–98 |
| 2 | Step 2 autonomous warning no longer calls orchestrator a subagent | ✅ | Lines 109–113 |
| 3 | Step 3.3 orchestrator row uses host-skill-tool column shape; Agent/task removed; intro sentence unchanged | ✅ | Line 306 |
| 4 | Full-file sweep: no orchestrator-as-subagent wording; Step 3.4 READY_TO_COMMIT substance intact | ✅ | Only correct "spawns its own role subagents" usages remain |
| 5 | Frontmatter allowed-tools retains Read/Edit/Bash/Grep/Glob | ✅ | Lines 4–15 (Agent/task retained, permitted by FR5) |
| 6 | Step 2.5 inserted after Step 2 / before Step 3; orchestrator-only + explicit sp/gsd skip | ✅ | Lines 137–143 |
| 7 | Severity read from `[<ID>|<sev>]` second bracket; missing → unknown; one line = one item | ✅ | Lines 151–162; matches findings-md-schema §Severity |
| 8 | Default lanes: main-agent←low/info; batch←med (by lens); dedicated←crit/high/unknown | ✅ | Lines 168–172 |
| 9 | Plan grouped by lane, approval exactly once via host structured-question; autonomous auto-accepts, checkpoint waits | ✅ | Lines 178–189 |
| 10 | User edits unrestricted; "collapse everything" → single batch, one shared commit | ✅ | Q3, lines 200–203 |
| 11 | Processing order severity-descending; document/section order within lane | ✅ | Q1, lines 193–195; restated line 216 |
| 12 | Batch-of-one collapses to dedicated path; shared-commit machinery only ≥2 | ✅ | Q2 line 196; lanes 403–405, 439 |
| 13 | Directory-mode grouping keys on (file, section); batches never span files | ✅ | Q4, lines 204–206 |
| 14 | Step 3 preamble defines work unit; bug-6 gate + BEFORE/AFTER SHA + untracked baseline per work unit | ✅ | Lines 210–228 |
| 15 | Main-agent lane: inline fix, no framework, bounded low/info exception to "does NOT fix bugs itself" | ✅ | Invariant site updated (26–34); lane 407–412 |
| 16 | Main-agent item consumed inside Step-3.2 untrusted-evidence frame | ✅ | Lines 414–417 |
| 17 | Main-agent commits via Step-3.4 commit-ownership (ADR-0007, sec-3, protected-branch re-assert) | ✅ | Lines 422–428 |
| 18 | Main-agent checkpoint diff-approval IS the per-item gate (Step-5 dedup) | ✅ | Lines 429–432, 517–521 |
| 19 | Main-agent failure → bug-11/bug-15 rollback + `- [~]` | ✅ | Lines 433–435 |
| 20 | "Run relevant tests" best-effort; no suite is not a failure | ✅ | Lines 418–421 |
| 21 | Batch: verbatim blocks each individually wrapped; independent evidence; trust never merged | ✅ | Lines 442–447 |
| 22 | Batch: one shared commit, every member `- [x]` with same shared SHA(s) | ✅ | Lines 448–456, 484–490 |
| 23 | Batch commit message = joined summary under full sec-3 rule | ✅ | Lines 450–453 |
| 24 | Batch failure → whole-batch rollback (bug-11/15, bug-12), every member `- [~]` | ✅ | Lines 457–461 |
| 25 | Dedicated lane preserves per-item behavior incl. collapsed batch-of-one | ✅ | Lines 398–405 |
| 26 | Step 4 per work unit; batch shared SHA; bug-12 per work unit; edit dirties only validation file, never committed | ✅ | Lines 484–508 |
| 27 | bug-6 & bug-11 worked examples intact + one-line batch note | ✅ | Lines 554–556, 583–584 |
| 28 | Frontmatter description: orchestrator severity-routed; sp/gsd still one at a time | ✅ | Line 3 |
| 29 | Whole-file structural self-consistency; invariants used consistently; no dangling refs | ❌ | Step refs and invariant tags resolve, BUT the "never fabricates a fix" guard (Notes, 615–618) and the Step-4 leading success condition (467) are stated in framework-only terms that contradict the new no-framework main-agent lane — see MF-1 |

## Must Fix (Blockers)

### MF-1 — "Never fabricates a fix" invariant not reconciled with the no-framework main-agent lane

**File**: `plugins/my-skills/skills/validation-fixer/SKILL.md:615` (and related `:467`)
**Problem**: The main-agent lane (lines 407–435) fixes a `low`/`info` item **inline by the host's own main agent, with no framework spawned**, and on success records `- [x]` via the Step-3.4 commit-ownership commit. But the authoritative fabrication guard in **Notes** still conditions `[x]` exclusively on a *framework*:

> "an item is `[x]` only when the **framework signaled success** *and* a real commit exists for it — made by the framework, or by validation-fixer's commit-ownership step from **a framework's** approved / `READY_TO_COMMIT` output." (615–618)

The main-agent lane has no framework and no framework success signal, so this load-bearing guard — read literally — forbids marking a legitimate main-agent fix `[x]`. The file is elsewhere careful to distinguish "the host's own main agent" from "a framework spawned" (lines 30, 96, 306, 428), so "the framework signaled success" genuinely excludes this lane; this is a real contradiction, not loose wording. An executing agent that consults this guard (the file's fabrication authority) to decide recording for a low/info item would either under-record a real fix as `- [~]` or stall on the conflict. This breaches AC 29 (whole-file self-consistency) and the review's explicit charge that the main-agent exception not silently break the "does not fix bugs itself" family of invariants elsewhere in the file.

The Step-4 leading success condition (line 467, "the **framework signaled success** ... commit-ownership commit for **a `READY_TO_COMMIT` framework**") has the same framework-only framing; it is partially rescued by lines 484–485 ("A main-agent or dedicated single item records exactly as today"), but the Notes guard has no such rescue.

**Fix**: Generalize the success predicate to admit the main-agent path. In the Notes bullet (615–618), replace "the framework signaled success" with a phrasing that also covers the inline lane, e.g. "the fix producer signaled success — a framework's normal completion / `READY_TO_COMMIT`, **or the main-agent lane's completed inline fix** — *and* a real commit exists for it (the framework's own commit, or validation-fixer's commit-ownership commit)." Apply the same generalization to the Step-4 leading sentence (467) so its condition and the per-work-unit paragraph (484–485) agree. Do not weaken the bug-12 committed-then-blocked rule.

## Should Fix (Warnings)

### SF-1 — Main-agent lane's `_fixed via <framework>_` provenance label is undefined

**File**: `plugins/my-skills/skills/validation-fixer/SKILL.md:478`
**Problem**: The Step-4 status-line template is `_fixed via <framework>[/<sp-skill>] · <sha> · <date>_`. The batch/dedicated lanes resolve `<framework>` to `orchestrator` (lines 487, 540, 572), but the main-agent lane has **no framework**. Line 485 says it "records exactly as today — its own commit's sha," yet "today" had no main-agent lane, so the `<framework>` slot has no defined value. Recorded provenance lines will vary run-to-run (`main-agent`? `orchestrator`? blank?), weakening the `_fixed via …_` provenance contract this skill leans on for resumability.
**Fix**: Specify the provenance token for the main-agent lane in Step 4 — e.g. `_fixed via main-agent · <sha> · <date>_` — so the recorded label is deterministic.

### SF-2 — Step 3 sub-step 3 unconditionally says "invoke the chosen framework" with no main-agent carve-out

**File**: `plugins/my-skills/skills/validation-fixer/SKILL.md:297`
**Problem**: The per-work-unit loop's sub-step 3 reads "Invoke the chosen framework's entry point with that prompt." For a `low`/`info` main-agent work unit, no framework is invoked (the fix is inline). The divergence is flagged in the preamble (line 227) and fully documented in the main-agent lane (407–435), so a careful reader reconciles it, but the numbered loop itself (1→2→3→4) has no inline pointer, so an executor stepping through the loop for a main-agent item hits an instruction to invoke a framework that this lane explicitly does not spawn.
**Fix**: Add a half-sentence to sub-step 3 (or a parenthetical) noting that in the main-agent lane this step is the inline fix, not a framework invocation — pointing at the main-agent lane under "Orchestrator routing lanes."

## Verdict

**Status**: REQUEST_CHANGES

Change A and the bulk of Change B are faithful and correctly reconciled with every named invariant, but the "never fabricates a fix" guard (and the Step-4 leading success condition) still speak only of frameworks and therefore contradict the new no-framework main-agent lane — an AC-29 self-consistency breach on a load-bearing invariant.

Invoke `/architect` with this CR file path (`plans/code-review/CR-20260721T185132Z-138e-validation-fixer-orchestrator-severity-routing.md`) to generate a FIX plan. The Must Fix item will become a TDD task pair.
