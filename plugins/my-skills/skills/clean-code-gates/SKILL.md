---
name: clean-code-gates
description: Run Clean Code quality gates (G1-G7 — coverage, complexity, length/nesting, naming, no-comments, mutation, dependency-structure) over a configurable scope and produce an agnostic JSON + Markdown report for fixer agents/orchestrators. Use when the user asks to run code-quality gates, check Clean Code metrics, audit complexity/coverage/comments, run the qa gates programmatically, or invokes /clean-code-gates. Portable across projects (node-ts, dart-flutter). G5 (no-comments) runs with zero setup; other gates need their per-stack tooling (adapters/scaffold pending).
---

# clean-code-gates

A portable, dependency-free CLI that runs Clean Code quality gates over a scope and emits a machine-agnostic report. It lives inside this skill directory. Not coupled to GSD — usable by any project, orchestrator, or directly by the main agent.

## How to invoke

Run the CLI from the **target project's root**:

```bash
node <skill-dir>/bin/gates.cjs [flags]
```

(If `npm link` / on PATH, `clean-code-gates [flags]` also works — but the absolute `node …/bin/gates.cjs` form always works.)

### Flags
- `--scope <form>` (default `project`):
  - `project` — all configured source roots
  - `diff[:<base-ref>]` — git changed files vs base (default `merge-base origin/main HEAD`); this is "current branch/phase"
  - `module:<path|glob>` — a path or glob
  - `files:a,b,c` — explicit comma-separated files
- `--gates G1,G5` — allow-list (default: all gates applicable to the detected stacks)
- `--skip G6` — exclude gates (G6 mutation is slow)
- `--out <dir|->` — report dir (default `./.cleancode`); `-` prints JSON to stdout
- `--require-tools` — exit 2 if any gate is `missing_tool`
- `--scaffold` — (PENDING, Plan 4 — not implemented yet) auto-wire missing gate tooling

### Exit codes
`0` pass · `1` blockers found · `2` missing tools (with `--require-tools`) · `3` usage/config error

## Current capability (honest status)

- **G5 (no-comments)** — fully implemented, built-in, runs with **zero external tooling** on node-ts and dart-flutter source.
- **G1/G2/G3/G4/G6/G7** — currently report `status: "missing_tool"` with an install hint, until the per-stack adapters land (node-ts adapter = Plan 2, dart-flutter adapter = Plan 3) and `--scaffold` (Plan 4) wires the tooling (jest coverage, ESLint complexity/naming, Stryker / dart_mutant mutation, dependency-cruiser / import_lint).

So today this reliably enforces the no-comments gate and produces a complete report skeleton; the rest are stubs reporting `missing_tool`.

## Config

On first run it auto-creates `.cleancode-gates.json` in the target project root from detected stacks (per-stack gate commands + thresholds: coverage 85/80, complexity 8, length 30, nesting 2, mutation 70). Edit it to override roots, thresholds, commands, or exemptions. Delete it to regenerate.

## Reading the report (for agents/orchestrators)

`<out>/report.json` (schema: `schema/report.schema.json` in this skill dir) is the contract. Iterate `report.gates[].findings[]`; each finding carries `{ file, line, rule, message, fixHint, severity }` — enough to fix without re-deriving. `report.summary.status` is `pass | warn | blocked`; `report.summary.gatesMissingTool` lists gates whose tooling is absent. A human-readable `<out>/report.md` mirrors it.

## Example

```bash
cd /path/to/project
node <skill-dir>/bin/gates.cjs --scope diff --gates G5 --out -
```

## Notes
- Mirrors the gate semantics in a project's qa agent (`.claude/agents/qa.md` in GSD repos) but decoupled from any plan/CR/QA flow. G8 (rework ratio) is intentionally out of scope — it's a plan-tree metric, not a code property.
- Tests: `cd <skill-dir> && node --test`.
- Common skill dirs: Claude Code personal install `~/.claude/skills/clean-code-gates`; opencode local installer `~/.config/opencode/my-skills/plugins/my-skills/skills/clean-code-gates`; opencode remote install cache location is shown in the loaded skill's location.
