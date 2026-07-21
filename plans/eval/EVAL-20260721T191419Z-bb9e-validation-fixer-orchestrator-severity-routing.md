---
id: EVAL-20260721T191419Z-bb9e
status: PASS
plan: FEAT-20260721T182238Z-ab8c
created_at: 2026-07-21
---

# Spec-Driven Eval — validation-fixer orchestrator-is-a-skill + severity-triaged routing

**Spec:** `plans/specs/SPEC-20260721T181347Z-1089-orchestrator-skill-severity-routing.md`
**Subject:** working-tree change to `plugins/my-skills/skills/validation-fixer/SKILL.md`
**Nature:** prose-only amendment to one Markdown skill. Per the spec, "implementation"
is the prose and "tests" are structural self-consistency (no code suite exists).

## Method note (why the standard I/T split is adapted)

This is a documentation change, so the skill's `I = production behavior` /
`T = automated assertions` model is remapped, as the invoking task directs:

- **Implementation (`I`)** = the required prose is present and factually correct in
  `SKILL.md` (evidenced by `file:line`).
- **Structural self-consistency (`T`)** = the prose reconciles with the rest of the
  file — step numbers, invariant names (bug-6/7/11/12/15, sec-3, ADR-0007), the
  referenced `findings-md-schema` severity-token contract, and the worked-example
  traces all agree.

Since the two collapse onto the same artifact here, an FR is scored **met** only when
both hold, **partial** when the prose is present but a cross-reference or detail is
incomplete, **missing** when absent. Grade uses the skill's `AC_score = 0.6·I + 0.4·T`.

## Diff surface

`git diff HEAD -- plugins/my-skills/skills/validation-fixer/SKILL.md` — one file,
+229 / −28. Read-only reference consulted for the severity-token contract:
`plugins/my-skills/skills/pr-review-report/references/findings-md-schema.md`.

## Per-requirement scores

### Change A — orchestrator is a Skill, not a subagent

| FR | Requirement | I | T | Verdict | Evidence |
|----|-------------|---|---|---------|----------|
| 1 | Step 2 orchestrator bullet: host **Skill**, runs in caller session, spawns own role subagents, stops at `READY_TO_COMMIT`/never commits, unattended-friendly; "Runs as a subagent" removed | ✓ | ✓ | **met** | SKILL.md:93–98 |
| 2 | Autonomous-mode warning reworded — no longer "subagent", still names it unattended-friendly | ✓ | ✓ | **met** | SKILL.md:111–113 |
| 3 | Step 3.3 table orchestrator row → **host skill tool** column shape, `my-skills:orchestrator`, args; `Agent`/`task`+`subagent_type` removed | ✓ | ✓ | **met** | SKILL.md:305–309 |
| 4 | Whole-file sweep for stray "orchestrator = subagent" | ✓ | ✓ | **met** | grep: only "its own role subagents" survive (SKILL.md:97,112,309); Step 3.4 (313–316) correct |
| 5 | `allowed-tools` left as-is (removal optional) | ✓ | ✓ | **met** | SKILL.md:4–15 (Agent/task/Skill/AskUserQuestion/question all retained) |

### Change B — Step 2.5 routing plan (orchestrator-only)

| FR | Requirement | I | T | Verdict | Evidence |
|----|-------------|---|---|---------|----------|
| 6 | New Step 2.5 after Step 2, before Step 3; orchestrator-only, skipped for superpowers/gsd | ✓ | ✓ | **met** | SKILL.md:137–147 |
| 7 | Severity read from `[<ID>\|<sev>]` token; no token → `unknown`; never re-parses/splits | ✓ | ✓ | **met** | SKILL.md:149–162; matches findings-md-schema §Severity abbreviations |
| 8 | Default lanes: main-agent←low/info, batch←med (BY LENS), dedicated←crit/high/unknown | ✓ | ✓ | **met** | SKILL.md:168–172 |
| 9 | Propose-and-approve exactly once via structured-question tool; autonomous auto-accepts, checkpoint waits; edits allowed | ✓ | ✓ | **met** | SKILL.md:178–189 |
| 10 | Q3 unrestricted edits; "collapse everything" → one batch, one shared commit, overrides defaults | ✓ | ✓ | **met** | SKILL.md:200–203 |
| 11 | Q1 severity-descending order (dedicated→med batches→main-agent); doc order within lane | ✓ | ✓ | **met** | SKILL.md:193–195 |
| 12 | Q2 batch-of-one collapses to dedicated; shared-commit only at ≥2 | ✓ | ✓ | **met** | SKILL.md:196–199 |
| 13 | Q4 batches never span files; key `(file, section)` | ✓ | ✓ | **met** | SKILL.md:204–206 |

### Work-unit loop generalization (Step 3)

| FR | Requirement | I | T | Verdict | Evidence |
|----|-------------|---|---|---------|----------|
| 14 | Step 3 iterates work units (item, or batch ≥2 → one shared commit); clean-tree gate + BEFORE/AFTER_SHA + untracked baseline per work unit; existing mechanics at work-unit granularity | ✓ | ✓ | **met** | SKILL.md:210–230 |

### main-agent lane

| FR | Requirement | I | T | Verdict | Evidence |
|----|-------------|---|---|---------|----------|
| 15 | Inline fix by host's own main agent, no framework; bounded exception to "does NOT fix bugs", low/info; preflight+bug-6 gate govern | ✓ | ✓ | **met** | SKILL.md:26–34, 410–415 |
| 16 | Q5d untrusted-evidence frame (Step 3.2) still applies | ✓ | ✓ | **met** | SKILL.md:417–420 |
| 17 | Commits via Step-3.4 commit-ownership (ADR-0007), sec-3, protected-branch re-assert | ✓ | ✓ | **met** | SKILL.md:425–431 |
| 18 | Q5c checkpoint diff-approval IS the per-item gate; Step-5 dedup; autonomous = standing approval | ✓ | ✓ | **met** | SKILL.md:432–435, 526–529 |
| 19 | Q5a failure → bug-11/bug-15 rollback to BEFORE_SHA, record `[~]`, never `[x]` | ✓ | ✓ | **met** | SKILL.md:436–438 |
| 20 | Q5b tests best-effort/target-dependent; no suite is not a failure | ✓ | ✓ | **met** | SKILL.md:421–424 |

### batch lane

| FR | Requirement | I | T | Verdict | Evidence |
|----|-------------|---|---|---------|----------|
| 21 | One combined orchestrator run; each block individually wrapped in Step-3.2 frame; brief states independent-evidence / one-line-one-concern / trust never merged | ✓ | ✓ | **met** | SKILL.md:445–450 |
| 22 | One shared commit; every member `[x]` with same shared SHA(s) | ✓ | ✓ | **met** | SKILL.md:451–459 |
| 23 | Shell-safe joined summary (sec-3): one-physical-line, no interpolation, `git add -- <code>`, `commit -F -` | ✓ | ✓ | **met** | SKILL.md:451–457 (names joined-summary + one-line + no-interpolate; staging/heredoc via the referenced full 3.4 sec-3 recipe) |
| 24 | Batch failure → whole-batch rollback (bug-11/15, incl. partial commits/bug-12); every member `[~]` | ✓ | ✓ | **met** | SKILL.md:460–464 |

### dedicated lane

| FR | Requirement | I | T | Verdict | Evidence |
|----|-------------|---|---|---------|----------|
| 25 | Current behavior preserved; single-item (incl. collapsed batch-of-one) records `[x]` with own SHA | ✓ | ✓ | **met** | SKILL.md:401–408 |

### Recording, examples, description

| FR | Requirement | I | T | Verdict | Evidence |
|----|-------------|---|---|---------|----------|
| 26 | Step 4 recording per work unit; batch→shared SHA; bug-12 per work unit; in-place edit never committed | ✓ | ✓ | **met** | SKILL.md:466–516 |
| 27 | bug-6 & bug-11 traces stay valid; ≤1-line batch note each; traces not otherwise rewritten | ✓ | ✓ | **met** | SKILL.md:562–564, 591–592 (notes added; traces intact) |
| 28 | Frontmatter description notes orchestrator items severity-routed, still accurate for superpowers/gsd one-at-a-time | ✓ | ✓ | **met** | SKILL.md:3 |

## Score roll-up

- One story (the whole amendment), 28 equally-weighted requirements, priority P0
  (core deliverable — unlabeled in a SPEC-format doc, so `ASSUMED P0`; weight is
  immaterial to the result since there is a single story).
- `I` met: 28/28 = 1.00. `T` (structural self-consistency) met: 28/28 = 1.00.
- `AC_score` for every FR = 0.6·1 + 0.4·1 = 1.00.
- `Story_score = mean = 1.00`. `Final = Σ(w·Story)/Σw = 1.00`.

**Final grade: 1.00 — Spec-complete.**

### Engineering gates `G`

`build` / `lint` / `unit` / `e2e` = **n/a (doc-only skill, no runnable suite)** — the
repo has no test harness for prose skills, matching the spec's stated no-suite posture
(Non-goals: "No automated test run … verification is structural"). The executed
verification was the **structural self-consistency check** (step-number continuity
2→2.5→3→4→5→6; invariant-name reconciliation for bug-6/7/11/12/15, sec-3, ADR-0007;
severity-token contract vs. `findings-md-schema`; worked-example integrity), which
**passes**. No confirmed-red gate ⇒ no `Adjusted Final`.

### Scope adherence `S`: **pass**

Every changed line traces to a spec FR (Change A: FR1–5; Step 2.5: FR6–13; Step 3
generalization: FR14; lanes: FR15–25; recording/examples/description: FR26–28). No
out-of-scope edits: superpowers/gsd per-item paths untouched, preflight/rollback
mechanics extended (not altered), no new `allowed-tools`, no opencode port added — all
consistent with the spec's Non-goals.

## Gaps

- **No hard gaps.** All 28 functional requirements are met on both prose and structural
  self-consistency; the file reconciles internally and against the referenced schema.
- **Single soft observation (not a deduction):** FR23's batch-lane shell-safety leans on
  a cross-reference to the Step-3.4 sec-3 recipe for the `git add -- <code paths>` /
  `git commit -F -` staging specifics rather than restating them inline. This is the
  spec's own intended "mirror-machinery" convention (document only the divergences), so
  it is correct as written — noted only as the one place completeness depends on the
  reader following the 3.4 pointer.
- **Assumption:** priority marked `ASSUMED P0` (SPEC format carries no P0/P1 label); it
  does not affect the grade with a single story.
