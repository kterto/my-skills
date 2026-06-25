# Evaluation — ASSUMED P0: product-manager autonomous roadmap executor

**Feature**: `product-manager` skill
**Source of truth**: `docs/superpowers/specs/2026-06-23-product-manager-skill-design.md`
**AC baseline**: `docs/superpowers/specs/evaluations/_ac-baseline.md`
**Judge model**: `openai/gpt-5.5` (author model: unknown; self-preference status unknown)
**Module / paths**: `plugins/my-skills/skills/product-manager/**`, `README.md`, `.claude-plugin/marketplace.json`, `plugins/my-skills/.claude-plugin/plugin.json`
**Diff surface**: feature range `29a2482^..HEAD`: `.claude-plugin/marketplace.json`, `README.md`, `plugins/my-skills/.claude-plugin/plugin.json`, `plugins/my-skills/skills/product-manager/SKILL.md`, `plugins/my-skills/skills/product-manager/references/git-flow.md`, `plugins/my-skills/skills/product-manager/references/human-validation.md`, `plugins/my-skills/skills/product-manager/references/resume-and-logging.md`, `plugins/my-skills/skills/product-manager/references/scope-resolution.md`, `plugins/my-skills/skills/product-manager/templates/pm-progress-entry.template.md`, `plugins/my-skills/skills/product-manager/templates/pr-body.template.md`

## Assumptions
- The PRD has no explicit story priorities, so the single feature story is marked `ASSUMED P0`.
- No `spec.md` or `tasks.md` artifacts were found by `**/{spec.md,tasks.md,SPEC.md,TASKS.md}`. Per skill rules, `E` and `S` are `n/a — no derived spec`; the implementation plan and SDD task reports are used only as test/verification evidence.
- This is a Markdown/action-skill implementation, not executable application code. Structural grep checks and walkthrough reports are the available harness evidence.

## Acceptance Criteria
- AC1 — Purpose, invocation, config, and boundaries.
- AC2 — Pre-flight and run authorization.
- AC3 — Scope resolution and ordering.
- AC4 — Per-story orchestration and git/PR flow.
- AC5 — Human validation handling.
- AC6 — Logging and resume.
- AC7 — File layout, discoverability, and compatibility.

## Implementation Checklist
| AC | I-check | Verdict | Evidence |
| --- | --- | --- | --- |
| AC1 | I1. Defines PM as glue/action skill that runs roadmap stories via orchestrator, then commits, syncs, pushes, and opens PRs. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:8-10` |
| AC1 | I2. Documents invocation with allowed scope forms. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:23-34` |
| AC1 | I3. Defines conservative default and documents `--base` and `--dry-run`. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:31-42` |
| AC1 | I4. Defines config precedence and keys. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:36-49` |
| AC1 | I5. Preserves non-goals. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:14-19` |
| AC2 | I1. Requires roadmap lock, orchestrator config, clean tree, and `gh`. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:53-60` |
| AC2 | I2. Resolves scope, filters done/superseded, and topo-sorts. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:61-63` |
| AC2 | I3. Prints queue/mode/git plan and asks one up-front confirmation. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:64` |
| AC2 | I4. Implements dry-run as print and exit without confirmation/execution. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:66` |
| AC2 | I5. Handles out-of-scope dependency behavior by mode. | MET | `plugins/my-skills/skills/product-manager/references/scope-resolution.md:63-73` |
| AC3 | I1. Reads lock plus user-story files/frontmatter for needed fields. | MET | `plugins/my-skills/skills/product-manager/references/scope-resolution.md:9-20` |
| AC3 | I2. Maps roadmap, milestone, ordinal, and phase scopes. | MET | `plugins/my-skills/skills/product-manager/references/scope-resolution.md:24-37` |
| AC3 | I3. Rejects unmatched scope and reports valid scopes. | MET | `plugins/my-skills/skills/product-manager/references/scope-resolution.md:33` |
| AC3 | I4. Topologically sorts, breaks ties by sequence, reports cycles. | MET | `plugins/my-skills/skills/product-manager/references/scope-resolution.md:49-59` |
| AC3 | I5. Checks dependencies outside resolved scope and records/warns/stops. | MET | `plugins/my-skills/skills/product-manager/references/scope-resolution.md:63-73` |
| AC4 | I1. Resolves story base from in-scope dependency or run base. | MET | `plugins/my-skills/skills/product-manager/references/git-flow.md:23-34` |
| AC4 | I2. Cuts deterministic `pm/<id>-<slug>` branch. | MET | `plugins/my-skills/skills/product-manager/references/git-flow.md:9-19`, `plugins/my-skills/skills/product-manager/references/git-flow.md:42-50` |
| AC4 | I3. Passes story `## Brief` verbatim to orchestrator. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:78-80` |
| AC4 | I4. Reads terminal output and proceeds/stops appropriately. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:82-84`, `plugins/my-skills/skills/product-manager/SKILL.md:109` |
| AC4 | I5. Commits implementation with proposed message and trailer. | MET | `plugins/my-skills/skills/product-manager/references/git-flow.md:58-74` |
| AC4 | I6. Runs `/roadmap sync` after trailer and guards mismatch. | MET | `plugins/my-skills/skills/product-manager/references/git-flow.md:76-79`, `plugins/my-skills/skills/product-manager/references/git-flow.md:126-128` |
| AC4 | I7. Commits sync docs separately with no story trailer and keeps tree clean. | MET | `plugins/my-skills/skills/product-manager/references/git-flow.md:81-93` |
| AC4 | I8. Pushes branch and opens PR with correct base/head/body. | MET | `plugins/my-skills/skills/product-manager/references/git-flow.md:95-122` |
| AC4 | I9. Opens stacked PRs in queue order and continues until stop/completion. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:74-99`, `plugins/my-skills/skills/product-manager/references/git-flow.md:138-140` |
| AC5 | I1. Scans `## Acceptance` for marker list before run. | MET | `plugins/my-skills/skills/product-manager/references/human-validation.md:13-19`, `plugins/my-skills/skills/product-manager/references/human-validation.md:39-58` |
| AC5 | I2. Scans orchestrator QA report after run. | MET | `plugins/my-skills/skills/product-manager/references/human-validation.md:21-27` |
| AC5 | I3. Flagged stories are still fully implemented and PR'd. | MET | `plugins/my-skills/skills/product-manager/references/human-validation.md:62-67` |
| AC5 | I4. Conservative mode halts with story id, PR link, and validation items. | MET | `plugins/my-skills/skills/product-manager/references/human-validation.md:70-80` |
| AC5 | I5. Autonomous mode appends queue, adds PR note, and continues. | MET | `plugins/my-skills/skills/product-manager/references/human-validation.md:84-100` |
| AC5 | I6. Validation queue entries and requests can include promised PR URL. | UNMET | Searched `SKILL.md`, `git-flow.md`, `human-validation.md`, `resume-and-logging.md` for PR URL timing. Queue row promises `(PR <url>)` at `plugins/my-skills/skills/product-manager/references/human-validation.md:88-96`, but queue/log writes are staged before push/`gh pr create` at `plugins/my-skills/skills/product-manager/SKILL.md:89-97` and `plugins/my-skills/skills/product-manager/references/git-flow.md:81-115`. No deterministic PR URL or post-PR append strategy found. |
| AC6 | I1. Maintains append-only `pm-progress.md` with actor and one row per attempt. | MET | `plugins/my-skills/skills/product-manager/references/resume-and-logging.md:9-15` |
| AC6 | I2. Defines all required log fields. | MET | `plugins/my-skills/skills/product-manager/references/resume-and-logging.md:19-33` |
| AC6 | I3. Provides feasible ordering for writing log row with actual PR URL. | UNMET | Searched `SKILL.md`, `git-flow.md`, `resume-and-logging.md` for PR URL generation/update. `pr` is defined as opened PR URL at `plugins/my-skills/skills/product-manager/references/resume-and-logging.md:31`, but log row is written and committed before push/PR creation at `plugins/my-skills/skills/product-manager/SKILL.md:90-93`, `plugins/my-skills/skills/product-manager/SKILL.md:99`, and `plugins/my-skills/skills/product-manager/references/resume-and-logging.md:15`. |
| AC6 | I4. Resumes without extra state by re-resolving and skipping done/superseded. | MET | `plugins/my-skills/skills/product-manager/references/resume-and-logging.md:37-46` |
| AC6 | I5. Reconstructs stacked branches and handles missing done predecessors. | MET | `plugins/my-skills/skills/product-manager/references/resume-and-logging.md:47-53` |
| AC7 | I1. Creates required skill root, references, and templates. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:118-132` plus file existence check output `STRUCTURAL_CHECKS_OK` |
| AC7 | I2. Makes skill discoverable or documents auto-discovery. | MET | `.superpowers/sdd/task-6-report.md:7-16`, `.claude-plugin/marketplace.json:8-13` |
| AC7 | I3. Documents roadmap/orchestrator compatibility contracts. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:8-10`, `plugins/my-skills/skills/product-manager/references/scope-resolution.md:9-20`, `plugins/my-skills/skills/product-manager/SKILL.md:82-84` |

Per-AC implementation: AC1 `5/5=1.00`, AC2 `5/5=1.00`, AC3 `5/5=1.00`, AC4 `9/9=1.00`, AC5 `5/6=0.83`, AC6 `4/5=0.80`, AC7 `3/3=1.00`.

---
# FRAMEWORK — Extract & Respect

## Elicitation E
`E = n/a — no derived spec`. No `spec.md` or `tasks.md` artifacts were found by glob. The PRD remains the source of truth; no derived requirement ledger is scored.

## Scope S
`S = n/a — no derived spec`. Without `spec.md`/`tasks.md`, the skill requires reporting `S` as n/a rather than grading plan drift. Informational note: all scored implementation behaviors above trace to PRD clauses or the product-manager implementation plan, except the PR URL timing conflict, which is reported as an implementation gap rather than rogue scope.

---
# HARNESS — Ensure All Implemented

## Test Checklist
| Requirement | Source | Level | T-check | Verdict | Evidence |
| --- | --- | --- | --- | --- | --- |
| AC1 | PRD | structural | T1. Frontmatter/name and invocation/config text asserted. | MET | `.superpowers/sdd/task-5-report.md:12-18`, fresh command output `STRUCTURAL_CHECKS_OK` |
| AC1 | PRD | structural | T2. Non-goal/boundary text asserted. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:14-19`; task-5 report says required sections passed at `.superpowers/sdd/task-5-report.md:14-18` |
| AC2 | PRD | structural | T1. Pre-flight required terms and confirmation text asserted. | MET | `plugins/my-skills/skills/product-manager/SKILL.md:53-66`, fresh command output `STRUCTURAL_CHECKS_OK` |
| AC2 | PRD | walkthrough | T2. Dry-run reaches printed plan and stops before mutation. | MET | `.superpowers/sdd/task-6-report.md:77-87` |
| AC2 | PRD | structural | T3. Out-of-scope dependency behavior specified. | MET | `plugins/my-skills/skills/product-manager/references/scope-resolution.md:63-73` |
| AC3 | PRD | structural | T1. Scope-resolution reference contains key scope/order/status terms. | MET | `.superpowers/sdd/task-1-report.md:1-8` |
| AC3 | PRD | walkthrough | T2. Milestone dry-run path verified. | MET | `.superpowers/sdd/task-6-report.md:77-87` |
| AC3 | PRD | structural | T3. Unmatched scope/cycle/out-of-scope behavior specified. | MET | `plugins/my-skills/skills/product-manager/references/scope-resolution.md:33`, `plugins/my-skills/skills/product-manager/references/scope-resolution.md:49-73` |
| AC4 | PRD | structural | T1. Branch naming, trailer, sync, and `gh pr create --base` asserted. | MET | `.superpowers/sdd/task-2-report.md:17-28`, fresh command output `STRUCTURAL_CHECKS_OK` |
| AC4 | PRD | structural | T2. Pointer audit verifies git-flow sections referenced by loop. | MET | `.superpowers/sdd/task-6-report.md:47-70` |
| AC4 | PRD | walkthrough | T3. Full success path including sync, log writes, push, and PR creation verified. | UNMET | Searched `.superpowers/sdd/task-*-report.md`, `.superpowers/sdd/final-review-report.md`, and product-manager docs for success-path walkthrough evidence. Only dry-run walkthrough exists and it explicitly stops before mutation at `.superpowers/sdd/task-6-report.md:85-87`. |
| AC5 | PRD | structural | T1. Marker list, invariant, queue path, and autonomous flag asserted. | MET | `.superpowers/sdd/task-3-report.md:1-6`, `plugins/my-skills/skills/product-manager/references/human-validation.md:39-66`, `plugins/my-skills/skills/product-manager/references/human-validation.md:84-98` |
| AC5 | PRD | walkthrough | T2. Conservative flagged-story behavior verified. | UNMET | Searched `.superpowers/sdd/task-*-report.md` and product-manager docs for a conservative flagged-story walkthrough; found structural prose only, no scenario verification. |
| AC5 | PRD | walkthrough | T3. Autonomous flagged-story behavior and PR-note rendering verified. | UNMET | Searched `.superpowers/sdd/task-*-report.md`, `human-validation.md`, `pr-body.template.md`; no autonomous scenario verifies queue row plus PR note, and I6 timing is internally inconsistent. |
| AC6 | PRD | structural | T1. Log path, actor, restart-safe text, and template tokens asserted. | MET | `.superpowers/sdd/task-4-report.md:12-25`, `plugins/my-skills/skills/product-manager/templates/pm-progress-entry.template.md:1-11` |
| AC6 | PRD | walkthrough | T2. Rendered log row field values verified. | UNMET | Searched `.superpowers/sdd/task-*-report.md` and templates; found token/column checks but no rendered row walkthrough with expected values or actual PR URL. |
| AC6 | PRD | walkthrough | T3. Resume after partial run verified. | UNMET | Searched `.superpowers/sdd/task-*-report.md` and `final-review-report.md`; found structural resume text and a fix note at `.superpowers/sdd/final-review-report.md:44-49`, but no partial-run scenario walkthrough. |
| AC7 | PRD | structural | T1. Required files exist. | MET | `.superpowers/sdd/task-6-report.md:95-109`, fresh command output `STRUCTURAL_CHECKS_OK` |
| AC7 | PRD | structural | T2. SKILL.md references resolve to real sections/files. | MET | `.superpowers/sdd/task-6-report.md:47-70` |
| AC7 | PRD | structural | T3. Discovery check verifies no manifest entry required or manifests updated. | MET | `.superpowers/sdd/task-6-report.md:7-25`, `.claude-plugin/marketplace.json:8-13`, `plugins/my-skills/.claude-plugin/plugin.json:1-3` |

Per-AC tests: AC1 `2/2=1.00`, AC2 `3/3=1.00`, AC3 `3/3=1.00`, AC4 `2/3=0.67`, AC5 `1/3=0.33`, AC6 `1/3=0.33`, AC7 `3/3=1.00`.

Harness completeness over sanctioned set: `15/20 = 0.75`. No valid E-additions were scored because there is no derived spec.

## Extra Tests
| # | Extra test | Level | Evidence | Value |
| --- | --- | --- | --- | --- |
| R1 | Defensive stale-regression scan after final review: no stale auto-select claim, no `/tmp/` scratch path, no stale terminal-state examples. | structural | `.superpowers/sdd/final-review-report.md:78-82` | Med `0.5` |

Robustness Index `R = 0.5`.

## Test Distribution D
Because this is a Markdown skill, counts classify recorded verification items/commands, not test functions.

| Tier | Count | % | Evidence |
| --- | ---: | ---: | --- |
| Necessary (P0 primary happy path) | 4 | 31% | task-2 git-flow checks, task-5 entrypoint checks, task-6 dry-run walkthrough, fresh structural command |
| Secondary (important) | 6 | 46% | task-1 scope checks, task-3 human-validation checks, task-4 logging checks, task-5 cross-ref check, task-6 pointer audit, task-6 file check |
| Nice-to-have | 3 | 23% | final-review stale-regression checks in `.superpowers/sdd/final-review-report.md:78-82` |
| **Total feature verification items** | 13 | 100% | — |

**Shape**: structurally broad but scenario-thin. Core docs are covered; human-validation, logging, resume, and full success-path behavior lack scenario walkthroughs.

## Engineering Gates G
| Gate | Verdict | Command / attempt | Evidence |
| --- | --- | --- | --- |
| build | not-run | `test -f package.json && npm run build` plus `test -f package.json` probe | Probe output: `NO_ROOT_PACKAGE_JSON`; implementation plan states no build step at `docs/superpowers/plans/2026-06-23-product-manager-skill.md:9` |
| lint | not-run | `test -f package.json && npm run lint` plus root package probe | Probe output: `NO_ROOT_PACKAGE_JSON`; no canonical root lint command |
| unit | ✓ | Fresh structural command using `grep` after `rg` was unavailable | Output: `STRUCTURAL_CHECKS_OK`; initial `rg` attempt failed with `zsh:1: command not found: rg` and was rerun with `grep` |
| e2e | not-run | `test -f package.json && npm run e2e` plus root package probe | Probe output: `NO_ROOT_PACKAGE_JSON`; only recorded dry-run walkthrough exists, not executable e2e |

No gate is confirmed red, so no adjusted-final penalty applies.

## Result
| AC | I | T | AC_score = 0.6*I + 0.4*T |
| --- | --- | --- | ---: |
| AC1 | 5/5 | 2/2 | 1.00 |
| AC2 | 5/5 | 3/3 | 1.00 |
| AC3 | 5/5 | 3/3 | 1.00 |
| AC4 | 9/9 | 2/3 | 0.87 |
| AC5 | 5/6 | 1/3 | 0.63 |
| AC6 | 4/5 | 1/3 | 0.61 |
| AC7 | 3/3 | 3/3 | 1.00 |

Script output used for roll-up:

```json
{
  "rows": [
    { "id": "AC1", "I": "5/5", "T": "2/2", "AC_score": 1 },
    { "id": "AC2", "I": "5/5", "T": "3/3", "AC_score": 1 },
    { "id": "AC3", "I": "5/5", "T": "3/3", "AC_score": 1 },
    { "id": "AC4", "I": "9/9", "T": "2/3", "AC_score": 0.8667 },
    { "id": "AC5", "I": "5/6", "T": "1/3", "AC_score": 0.6333 },
    { "id": "AC6", "I": "4/5", "T": "1/3", "AC_score": 0.6133 },
    { "id": "AC7", "I": "3/3", "T": "3/3", "AC_score": 1 }
  ],
  "story_score": 0.8733,
  "priority_weights": { "P0": 3, "P1": 2, "P2": 0 },
  "sumW": 3,
  "final": 0.8733,
  "reported_final": 0.87,
  "harnessT": "15/20",
  "harnessT_fraction": 0.75
}
```

| Dimension | Subject | Value |
| --- | --- | --- |
| Story_score / Final (PRD fidelity) | framework+harness | `0.87` |
| Elicitation E (recall / precision / justified) | framework | `n/a / n/a / n/a` — no derived spec |
| Scope Adherence S | framework | `n/a` — no derived spec |
| Harness completeness (T over sanctioned set) | harness | `15/20 = 0.75` |
| Engineering Gates G | harness | build/lint/unit/e2e: `not-run / not-run / ✓ / not-run` |
| Robustness Index R | harness | `0.5` |
| Test Distribution D | harness | Necessary `31%` / Secondary `46%` / Nice-to-have `23%` (13 verification items) |
| Adjusted Final | — | n/a; no confirmed-red gate |
| k=3 disagreements | — | none in final MET/UNMET counts; all passes noted AC4 terminal-state wording as borderline but MET |

**Verdict**: Strong (minor gaps), `0.87`. The docs implement most PRD behavior, but the PR URL timing conflict weakens the success-path/logging contract and the harness lacks scenario coverage for the highest-risk flows.

## PRD Final Grade
| Story | Priority | Weight | Story_score |
| --- | --- | ---: | ---: |
| product-manager autonomous roadmap executor | ASSUMED P0 | 3 | 0.87 |

**Final = Σ(w*Story)/Σ(w) = 0.87 → Strong (minor gaps)**

## Gaps And Fixes To Reach 1.00
1. AC6 I3 and AC5 I6 — PR URL timing is infeasible: `pm-progress.md` and autonomous validation queue rows are committed before `gh pr create` returns a URL. Fix by changing the sequence so PR creation happens before writing the PR-URL-bearing rows, or by explicitly using deterministic PR URL lookup/update while preserving append-only/clean-tree constraints.
2. AC4 T3 — no full success-path walkthrough exists. Add a documented scenario covering commit with trailer, `/roadmap sync`, sync-doc commit, push, PR creation, and next-story clean-tree handoff.
3. AC5 T2/T3 — no flagged-story scenario coverage exists. Add conservative and autonomous walkthroughs, including PR-body note rendering and validation queue/log behavior.
4. AC6 T2/T3 — no rendered log row or partial-run resume scenario exists. Add walkthroughs proving all log field values and resume after a completed predecessor branch is deleted.
