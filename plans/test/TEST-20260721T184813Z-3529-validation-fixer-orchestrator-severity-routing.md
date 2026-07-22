---
id: TEST-20260721T184813Z-3529
plan: FEAT-20260721T182238Z-ab8c
title: Test Report — validation-fixer orchestrator-is-a-skill fix + severity-triaged routing
status: PASS
created_at: 2026-07-21T18:49:53Z
cycle: 0
---

**Related:** [FEAT-20260721T182238Z-ab8c](../feat/FEAT-20260721T182238Z-ab8c-validation-fixer-orchestrator-severity-routing.md)

## Summary

This plan is a prose-only edit to a single dual-host Markdown skill file
(`plugins/my-skills/skills/validation-fixer/SKILL.md`). Per PROJECT-CONTEXT
(`## Commands`, `## Test tooling`) there is **no build/test/lint/coverage suite**
for Markdown doc skills, and the `clean-code-gates` JS suite is scoped to that
skill only and must not run here. "Tests" for this change are therefore
**structural self-consistency verification** of the edited `SKILL.md` against the
plan's 29 acceptance criteria — verified via `Read` + `grep`. All structural
criteria hold: **PASS**.

## Flows Triaged

Flows here are the skill behaviors documented in prose; verification is structural
review, not execution.

| Flow / criterion group | Criticality | Decision | Rationale |
|---|---|---|---|
| Change A — orchestrator is a Skill, not a subagent (FR1–FR5) | High | Verify (structural) | Factual-correctness fix; wrong invocation shape would misroute the orchestrator. |
| Step 2.5 routing plan — gate, severity read, lanes, approve-once, Q1–Q4 (FR6–FR13) | High | Verify (structural) | New control-flow surface; the whole feature. |
| Step 3 work-unit generalization + three lanes (FR14–FR25) | High | Verify (structural) | Reconciliation with bug-6/7/11/12/15, sec-3, ADR-0007 is the correctness core. |
| Step 4 per-work-unit recording + worked-example batch notes (FR26–FR27) | Med | Verify (structural) | Recording/regression traces must stay valid. |
| Frontmatter description (FR28) | Low | Verify (structural) | Discoverability/accuracy; low breakage risk. |
| Whole-file cross-reference resolution (FR29) | High | Verify (structural) | Dangling step/invariant refs would break the doc's internal logic. |
| **e2e automation** | — | **Excluded** | No e2e framework for doc skills (PROJECT-CONTEXT: "e2e: none — flows are skill behaviors described in prose"). Nothing executable to drive. |
| **`clean-code-gates` JS suite** | — | **Excluded** | Explicitly out of scope; scoped to that skill only, must not run against `validation-fixer/SKILL.md`. |

## E2E Tests Added

**None** — and correctly so. This repo has no e2e/runtime harness for Markdown doc
skills; the plan's own `## Verification (per phase)` mandates structural checks and
forbids running any automated suite. Adding e2e would be inventing tooling the
project does not have. Verification was performed as `grep`/`Read` assertions
against the edited file.

## Coverage

- **Before:** N/A (not measured — no coverage tooling for doc skills; PROJECT-CONTEXT
  `## Test tooling`: "Coverage: not measured except within `clean-code-gates`").
- **After:** N/A.
- Coverage floor (70%) is **not applicable** to a Markdown-only change with no
  instrumented code paths; this is not a `BELOW_FLOOR` condition.

## Test-Quality Audit — structural assertions run

Each check below was executed against
`plugins/my-skills/skills/validation-fixer/SKILL.md`.

**Change A (orchestrator = Skill, not subagent):**
- `grep -i 'Runs as a subagent'` → **0 hits** (FR1/FR2 satisfied).
- `grep 'subagent_type: orchestrator'` → **0 hits** (FR3 satisfied).
- Every remaining `subagent` occurrence (lines 97, 112, 306) is the correct
  "spawns its own **role subagents**" framing for the orchestrator. (FR4)
- `my-skills:orchestrator` is invoked via the host **Skill** tool in both the Step 2
  bullet (line 93–98) and the Step 3.3 invocation row (line 306), dual-host phrasing
  intact (`Skill` in Claude Code; opencode skill mechanism). (FR1/FR3)
- Frontmatter `allowed-tools` retains Read/Edit/Bash/Grep/Glob (plus pre-existing
  Write/Agent/task/Skill/AskUserQuestion/question); none removed. (FR5)

**Change B (Step 2.5 + lanes):**
- `## Step 2.5 — Routing plan (orchestrator only)` sits between Step 2 (line 82) and
  Step 3 (line 208), at line 137. (FR6)
- Orchestrator-only gate + explicit "skip Step 2.5 entirely" for superpowers/gsd
  (lines 139–140). (FR6)
- Severity read from the `[<ID>|<sev>]` token **immediately after the `- [ ]`
  checkbox** (second bracket), referencing
  `pr-review-report/references/findings-md-schema.md` §Severity abbreviations, with
  `<sev> ∈ crit | high | med | low | info` (lines 151–162). (FR7)
- Missing/unparseable token → `unknown` → conservatively dedicated, never downgraded
  (lines 157–158, 172). (FR7/FR8)
- Default lanes table: main-agent ← low/info, batch ← med (by `## ` lens section),
  dedicated ← crit/high/unknown (lines 168–172). (FR8)
- Propose-and-approve **exactly once** via `AskUserQuestion`/`question`; autonomous
  auto-accepts, checkpoint waits (lines 178–189). (FR9)
- Q1 severity-descending order, Q2 batch-of-one → dedicated, Q3 unrestricted edits /
  "collapse everything into a single batch", Q4 batches never span files
  (`(file, section)` key) — all present (lines 193–206). (FR10–FR13)

**Step 3 work-unit generalization + lanes:**
- Work-unit preamble defines a work unit as one item or a ≥2-member batch; bug-6
  clean-tree gate + `BEFORE_SHA`/`AFTER_SHA` + pre-run untracked baseline captured
  **per work unit**; validation-file exemption / path-exact match / never-`git add`
  the validation file apply at work-unit granularity (lines 210–228, 232–265). (FR14)
- Main-agent lane (lines 407–435): inline fix by host's own main agent, no framework
  spawned, framed as the **new bounded exception** to "does NOT fix bugs itself"
  (also flagged at lines 26–34); inside Step-3.2 untrusted-evidence frame; commits via
  Step-3.4 ADR-0007 path with sec-3 shell-safe construction + protected-branch
  re-assert; checkpoint diff-approval IS the per-item gate (Step-5 dedup); best-effort
  tests, no-suite is **not** a failure; failure → bug-11/bug-15 rollback + `- [~]`.
  (FR15–FR20)
- Batch lane (lines 437–461): one combined orchestrator run, each block individually
  wrapped in the Step-3.2 frame / trust never merged / one line = one concern; one
  shared commit with every member `- [x]` carrying the shared SHA(s); sec-3 joined
  summary; whole-batch bug-11/bug-15/bug-12 rollback → every member `- [~]`.
  (FR21–FR24)
- Dedicated lane (lines 398–405): current per-item behavior preserved, incl. collapsed
  batch-of-one. (FR25)
- Step 5 dedup explicitly covers the main-agent lane's commit-ownership commit
  (lines 517–521). (FR18)

**Step 4, worked examples, description, final sweep:**
- Step 4 documents per-work-unit recording incl. batch shared-SHA `[x]` and per-work-unit
  bug-12 (lines 484–490); the in-place edit dirties only the validation file, never
  committed (lines 504–508). (FR26)
- Both worked-example traces carry the one-line batch note (lines 554–556, 583–584)
  and are otherwise intact — single item = dedicated lane. (FR27)
- Frontmatter `description` notes orchestrator items are severity-routed (main-agent /
  batched / dedicated) while superpowers/gsd remain one-at-a-time (line 3). (FR28)
- **Cross-reference sweep (FR29):** all step references resolve within
  {1, 2, 2.5, 3, 3.1–3.4, 4, 5, 6} — no dangling step. Invariant tags all present and
  used consistently: bug-6 (8×), bug-7 (4×), bug-11 (11×), bug-12 (7×), bug-15 (7×),
  sec-3 (4×), sec-4 (1×), ADR-0007 (4×). Dual-host wording (`Skill`/`Agent`,
  skill/`task`, `AskUserQuestion`/`question`) preserved throughout.

**Weak tests found:** none applicable — verification is assertion-based `grep`/`Read`
over prose, no coder-authored unit tests exist to audit for empty/tautological asserts
(no code was written).

## Verdict

**PASS.** All 29 acceptance criteria are structurally satisfied in the edited
`SKILL.md`. Change A removes every orchestrator-as-subagent mischaracterization and
routes it via the host Skill tool with dual-host wording intact. Change B adds a
well-formed orchestrator-only Step 2.5 routing plan (severity read, three lane
defaults, exactly-once approval, Q1–Q4), generalizes Step 3 to work units, and
documents the three lanes reconciled with the shared bug-6/7/11/12/15, sec-3, and
ADR-0007 machinery. Step 4 recording, the two regression worked examples, and the
frontmatter description all reconcile. No dangling step or invariant reference. e2e
and coverage are N/A by project posture, not a floor miss.
