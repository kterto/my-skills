---
id: FINAL-20260721T191419Z-707e
status: READY_TO_COMMIT
plan: FEAT-20260721T182238Z-ab8c
related_to: SPEC-20260721T181347Z-1089
created_at: 2026-07-21
---

# FINAL — validation-fixer: orchestrator-is-a-Skill + severity-triaged routing

Single-file documentation/prose change to `plugins/my-skills/skills/validation-fixer/SKILL.md`
(no opencode override port — ships via the shared `plugins/` path). Pipeline reached
`READY_TO_COMMIT`; the orchestrator never commits — review the diff and commit yourself.

## What changed

**Change A — orchestrator is a Skill, not a subagent (correctness).**
`my-skills:orchestrator` is now documented as a host **Skill** invoked via the `Skill`
tool (opencode: equivalent skill mechanism) that runs in the caller session and spawns its
own `brainstormer→architect→coder→tester→reviewer→qa` role subagents, stopping at
`READY_TO_COMMIT`. Removed all `subagent_type: orchestrator` / "Runs as a subagent"
wording (Step 2 bullet, autonomous warning, Step 3.3 table).

**Change B — severity-triaged routing (orchestrator only).**
New **Step 2.5 — Routing plan**: read each item's severity from the `[<ID>|<sev>]` token
(second bracket after the `- [ ]` checkbox; `unknown` fallback → dedicated), assign default
lanes, print the plan, approve exactly once (autonomous auto-accepts, checkpoint waits/edits;
Q1–Q4 rules). Three lanes:
- **main-agent** (low/info) — host's own main agent fixes inline, no framework spawned; a
  new **bounded exception** to "does NOT fix bugs itself", under the same bug-7 preflight +
  per-work-unit bug-6 gate + commit-ownership (Step 3.4 / ADR-0007). Provenance token
  `_fixed via main-agent_`.
- **batch** (med, grouped by lens; user may collapse-all) — grouped items' verbatim
  untrusted-evidence blocks combined into **one** orchestrator run (trust never merged; one
  line = one concern) → **one shared commit**, every member `[x]` with that SHA; whole-batch
  rollback → every member `[~]`.
- **dedicated** (crit/high/unknown) — one run per item, per-item commit (current behavior).

Step 3's loop generalized to iterate **work units** (one item, or a batch); clean-tree gate +
`BEFORE/AFTER_SHA` per work unit. Frontmatter description updated. All load-bearing invariants
(bug-6/7/11/12/15, sec-3, ADR-0007, untrusted-evidence frame) extended, none weakened.

## Pipeline results

| Stage | Artifact | Result |
|-------|----------|--------|
| Spec | SPEC-20260721T181347Z-1089 | READY_FOR_PLANNING (0 open Qs, 5 defaults) |
| Plan | FEAT-20260721T182238Z-ab8c | 33 tasks DONE |
| Simplify | — | 4 cleanup agents; token-position (HIGH), sec-3 re-list→refs ×2, minor |
| Tester | TEST-20260721T184813Z-3529 | PASS (structural; coverage N/A) |
| Reviewer (1) | CR-20260721T185132Z-138e | REQUEST_CHANGES (1 MF, 2 SF — main-agent lane vs success guards) |
| Fix | FIX-20260721T185705Z-a3ae | 6 tasks DONE |
| Tester (2) | TEST-20260721T190338Z-4d1c | PASS |
| Reviewer (2) | CR-20260721T190637Z-0819 | APPROVED |
| QA | QA-20260721T191039Z-8569 | READY_TO_COMMIT (structural gates S1–S13 green; G8 rework 0.0) |
| Spec eval | EVAL-20260721T191419Z-bb9e | PASS — 1.00 spec-complete (28/28 FRs) |

Review cycles: 2 / 10 · QA cycles: 1 / 5

## Issues found
- none (all resolved; MF-1/SF-1/SF-2 fixed and re-verified).

## Proposed commit message

```
docs(validation-fixer): orchestrator is a Skill + severity-triaged routing

Change A: document my-skills:orchestrator as a host Skill (invoked via the
Skill tool) that runs in the caller session and spawns its own role subagents,
not a subagent itself — remove subagent_type: orchestrator wording.

Change B: add Step 2.5 severity-triaged routing (orchestrator only). Read each
item's [<ID>|<sev>] token and route into three lanes — main-agent (low/info,
host agent fixes inline, a bounded exception to the never-fix rule), batch (med,
grouped by lens, one orchestrator run + one shared commit), dedicated (crit/high/
unknown, one run per item). Generalize Step 3's loop to per-work-unit; propose a
routing plan approved once (autonomous auto-accepts). All invariants
(bug-6/7/11/12/15, sec-3, ADR-0007, untrusted-evidence frame) extended, none
weakened.
```

## Proposed PR message

### Summary
Fixes validation-fixer's incorrect treatment of the orchestrator as a subagent (it is a
host Skill), and stops running a full orchestrator pipeline per finding: items are now
severity-routed into main-agent / batch / dedicated lanes via a once-approved routing plan.

### Test plan
Doc-only prose change to one Markdown skill file — no code suite. Verified by structural
self-consistency (tester PASS ×2, QA S1–S13 green) and spec-driven-eval (1.00, 28/28 FRs).
No residual subagent wording; all cross-references and invariants resolve.
