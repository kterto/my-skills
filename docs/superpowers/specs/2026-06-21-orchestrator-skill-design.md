# Orchestrator Skill — Project-Agnostic Pipeline Generator

**Date:** 2026-06-21
**Status:** Approved design, pending implementation plan
**Source:** `docs/orchestrator/orchestrator-skill-prd.md` (+ existing TOODLS reference copies in `docs/orchestrator/`)

## Problem

The orchestrator skill and its role agents (brainstormer, architect, coder, reviewer, qa)
currently carry TOODLS-specific project facts baked into every file. Reusing them in a new
project means copy/pasting all six files and asking the main agent to refit them by hand.

We want a single installable skill that, in any new project, gathers project context, generates
project-customized role agents, runs the full delivery pipeline, validates the result against the
project spec, and emits a final report — with no manual refitting.

## Goals

- Reuse the skill across projects with zero hand-editing of agent files.
- Keep project-specific facts in exactly one place per project.
- Add a `tester` agent that proves "it's all built" (selective e2e + coverage floor).
- Validate finished work against the project spec via the external `spec-driven-eval` skill.
- Emit a final report with validation results, commit message, and PR message.
- Expose four configurable variables (threshold, output format, two cycle caps).

## Non-Goals

- Auto-committing or pushing. The skill outputs a proposed commit/PR message; the human commits.
- Replacing the existing pipeline state machine. The brainstorm→…→qa loop is preserved.
- Migrating the live TOODLS project. Its files under `docs/orchestrator/` are reference inputs only.

## Architecture

One skill at `plugins/my-skills/skills/orchestrator/`, project-agnostic. It ships the six role
**templates** as bundled resources and contains the generic pipeline logic. Per project it
materializes thin agents plus one facts document.

### Per-project on-disk layout (generated)

```
target-project/
  .claude/agents/
    brainstormer.md   # generic workflow + "read .orchestrator/PROJECT-CONTEXT.md"
    architect.md
    coder.md
    tester.md         # NEW
    reviewer.md
    qa.md
  .orchestrator/
    PROJECT-CONTEXT.md   # the ONLY per-project facts (95%-gated)
    config.json
```

The six agent files are thin: generic role workflow, the stdout output-summary contract, and
`model:` frontmatter, with every project-fact paragraph replaced by an instruction to read
`.orchestrator/PROJECT-CONTEXT.md`. That doc is the single source of project truth.

### Lifecycle — one skill, auto-detect

`/orchestrator "<description>"`:

- `.orchestrator/` **missing** → run **Bootstrap**, then **Pipeline**.
- `.orchestrator/` **present** → go straight to **Pipeline**.
- `--setup` flag → force re-bootstrap (regenerate context + agents).

## Bootstrap Phase

### Step B1 — Context gate (inline, with a scan subagent)

Runs **inline in the skill's caller session**, because interview-led gathering needs live user
Q&A and subagents cannot pause for user input.

1. Spawn an `Explore` subagent to scan the repo (CLAUDE.md, AGENTS.md, README, file layout,
   test/lint/build tooling) and return a structured digest — this *informs* the questions; it is
   the only part that runs as a subagent.
2. Interview the user with `AskUserQuestion`, asking only about what the scan left ambiguous.
3. Self-rate holistic confidence that the context is clear and complete (no rigid checklist —
   a holistic judgement).
4. Loop steps 2–3 until confidence `>= config.context_threshold` (default 0.95).
5. Write `.orchestrator/PROJECT-CONTEXT.md`.

`PROJECT-CONTEXT.md` captures: project name & one-line description; tech stack; build / test /
lint / per-phase gate commands; **e2e framework + run command**; **coverage tool + command**;
file/dir layout; ID & naming conventions (plan prefixes, slug rules); domain invariants;
**critical flows / user stories** (for the tester); explicit out-of-scope items.

### Step B2 — Dependency check: spec-driven-eval

Check whether the `spec-driven-eval` skill is available. If not, offer to run
`npx @tech-leads-club/agent-skills install --skill spec-driven-eval` (external install — confirm
with the user before running), or instruct the user to run it themselves. Done at bootstrap so the
dependency fails early, not after the whole pipeline.

### Step B3 — Materialize agents + config

Render the six bundled templates into `target/.claude/agents/`. Write `.orchestrator/config.json`
with defaults:

```json
{
  "context_threshold": 0.95,
  "output_format": "md",
  "max_review_cycles": 10,
  "max_qa_cycles": 5
}
```

Config precedence: per-run CLI args > persisted `config.json` > defaults.

## Pipeline Phase

Preserves the existing state machine (including Step 0 pre-flight: clean isolated branch/worktree,
never run on a protected branch or dirty tree). Cycle caps come from config. Artifact file
extension follows `output_format`.

```
brainstormer → architect → coder → tester → reviewer → qa
   → READY_TO_COMMIT → spec-driven-eval → final report
         ↑                      │
         └──(REQUEST_CHANGES)────┘   review fix loop: architect→coder→reviewer  [cap = max_review_cycles]
         └──────(qa BLOCKED)─────────┘ qa remediation loop                       [cap = max_qa_cycles]
```

### Tester (new) — placement coder → tester → reviewer

After coder reports DONE, tester runs before the reviewer:

- Evaluates which main flows / user stories (from `PROJECT-CONTEXT.md`) are critical enough to
  warrant e2e tests — selective, because e2e is expensive to write and run.
- Implements e2e tests for those flows only.
- Audits the coder's test quality; if coverage is `< 70%`, writes additional tests to reach the
  floor.
- The reviewer then reviews production code **and** tester's test code together in one pass.

**Re-run policy in fix loops:** tester runs once in the forward path. It is re-invoked during a
review fix loop only if the fix touched production code or the reviewer flagged a test gap — e2e
runs are not repeated blindly.

### Scope split — tester vs qa (no overlap)

- **tester** — behavioral proof: e2e on critical flows, 70% coverage-floor enforcement (it
  *produces* tests), test-quality audit.
- **qa** — static/unit gate suite: lint, build, G1 coverage, G6 mutation, complexity (it
  *verifies*). qa's G1 verifies the coverage tester already raised — ordered, not duplicated.

### Post-pipeline — spec-driven-eval + report

On `READY_TO_COMMIT`:

1. Invoke `spec-driven-eval`, passing the brainstormer's `SPEC-NNN` and the accumulated diff;
   validate the implementation against the project spec.
2. Compose and output a **final report** (inline in the orchestrator):
   - spec-driven-eval validation results + any issues found
   - a proposed Conventional-Commit **commit message**
   - a **PR message** (summary + test plan)
   - Output only — the skill does not commit or push.

## Output Format (md | html)

`output_format` drives how every agent emits its handoff artifacts (spec, plan, CR, QA report,
tester report). All six templates are **dual-branch**:

- `md` — current behavior; one `.md` per artifact.
- `html` — one self-contained interactive `.html` per artifact (collapsible sections, task
  checklists, `data-status` / cycle badges), no external assets.

Pipeline control flow is **format-independent**: the orchestrator keys off each agent's **stdout
structured summary** (`AGENT — ID created`, `Status: …`, `Path: …`), which is identical in both
modes. Only the file-verification reads learn the `.md | .html` extension from config.

## Components & Boundaries

| Unit | Responsibility | Reads | Writes |
| --- | --- | --- | --- |
| `SKILL.md` (orchestrator) | auto-detect, bootstrap, drive pipeline, eval, report | config, agent stdout | PROJECT-CONTEXT.md, config.json, agents/ |
| Context gate (inline + Explore) | reach threshold, capture facts | repo, user | PROJECT-CONTEXT.md |
| 6 agent templates (bundled) | generic role workflow | PROJECT-CONTEXT.md, config | role artifacts |
| PROJECT-CONTEXT.md | single per-project facts source | — | — |
| config.json | tunable variables | — | — |

## Error Handling

- Context gate never reaches threshold → stop, report what's still ambiguous; offer to lower
  `context_threshold` or continue manually.
- `spec-driven-eval` missing and user declines install → stop before the eval stage; pipeline
  result still stands, report notes eval was skipped.
- Cycle caps hit (review ≥ max_review_cycles, qa ≥ max_qa_cycles) → STALLED, human intervention,
  same as today.
- Any subagent returns an unexpected/missing status → re-read the artifact file to determine
  state before continuing; if still ambiguous, stop and report last known state.

## Testing Strategy

- Bootstrap idempotency: second invoke with `.orchestrator/` present skips straight to pipeline;
  `--setup` regenerates.
- Template rendering: generated agents contain no hard-coded project facts; all facts resolve via
  PROJECT-CONTEXT.md.
- Config precedence: CLI arg > config.json > default, verified for each variable.
- Format parity: md and html runs produce identical pipeline control flow (same stdout parsing).
- Pipeline integration: a small fixture project runs brainstorm→…→report end to end.

## Open Risks / Assumptions to Verify During Implementation

- **spec-driven-eval input contract:** the brainstormer's `SPEC-NNN` format may not match what
  `spec-driven-eval` expects as a project spec. Verify the skill's expected input early; an
  adapter step may be needed between SPEC-NNN and the eval's input.
- **Plugin-shipped templates path:** confirm how the skill resolves its bundled template files at
  runtime (plugin cache path) when rendering into a target project.
- **Coverage tool discovery:** the 70% floor assumes the context gate captured a working coverage
  command; if absent, tester must surface that as a blocker rather than guess.
