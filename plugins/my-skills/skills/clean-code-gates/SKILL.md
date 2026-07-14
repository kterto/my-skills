---
name: clean-code-gates
description: Run Clean Code quality gates (G1-G7 — coverage, complexity, length/nesting, naming, no-comments, mutation, dependency-structure) over a configurable scope and produce an agnostic JSON + Markdown report for fixer agents/orchestrators. Use when the user asks to run code-quality gates, check Clean Code metrics, audit complexity/coverage/comments, run the qa gates programmatically, or invokes /clean-code-gates. Portable across projects (node-ts, dart-flutter). All gates G1–G7 are implemented for both stacks; G5 (no-comments) runs with zero setup, the rest use per-stack tooling installed in the target project (run `--scaffold` to print what to install).
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
- `--scaffold` — advice mode: detect stacks and print the exact install commands for any missing gate tooling, then exit 0 (read-only, changes nothing)

### Exit codes
`0` pass · `1` blockers found · `2` missing tools (with `--require-tools`) · `3` usage/config error

## Capability

All gates G1–G7 are implemented for both stacks:

- **G5 (no-comments)** — built-in, **zero external tooling**.
- **node-ts** — G1 coverage (jest **or** vitest), G2 complexity + G4 naming (ESLint + typescript-eslint), G6 mutation (Stryker, jest/vitest runner), G7 dependency-structure (dependency-cruiser).
- **dart-flutter** — G1 coverage (flutter), G2 complexity + G4 naming (dart_code_linter), G6 mutation (external `dart_mutant`), G7 dependency-structure (built-in).
- **G3 (length/nesting)** is folded into G2 (same thresholds and tools) — it is not a separate runtime gate.

A gate reports `status: "missing_tool"` with an install hint (never crashes) when its per-stack tooling isn't present in the target project. Run `--scaffold` to print the exact install commands for whatever is missing, or `--require-tools` to make `missing_tool` a hard failure (exit 2) in CI.

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
- **G1 / G6 test runner (node-ts)** — the coverage (G1) and mutation (G6) gates work with **Jest or Vitest**, auto-detected from `node_modules/.bin` (both present → jest, for back-compat). Vitest emits the same Istanbul `coverage-summary.json`, so only the invocation differs. Override auto-detection with `gates.G1.tool: "jest" | "vitest"` (coverage) and `gates.G6.runner: "jest" | "vitest"` (mutation) in `.cleancode-gates.json`. Vitest coverage needs a provider (`@vitest/coverage-v8` or `-istanbul`); Vitest mutation needs `@stryker-mutator/vitest-runner`. When the chosen runner or its plugin is absent, the gate reports `missing_tool` with an install hint.
- **G6 (mutation, dart-flutter)** shells out to the external `dart_mutant` binary and reads its Stryker-compatible JSON report (`--json`): the verdict is the report's top-level `mutationScore` vs the gate threshold (default 70), and surviving mutants (`status` ∈ {Survived, NoCoverage}) become warnings. `dart_mutant` must be on PATH (e.g. `brew install dart_mutant`) — it is an external CLI, not a pub dev-dependency. The gate sandboxes to a temp report dir, so a run leaves no `mutation-reports/`, git worktree, or `pub get` artifacts on the project.
- Mirrors the gate semantics in a project's qa agent (`.claude/agents/qa.md` in GSD repos) but decoupled from any plan/CR/QA flow. G8 (rework ratio) is intentionally out of scope — it's a plan-tree metric, not a code property.
- Tests: `cd <skill-dir> && node --test`.
- Common skill dirs: Claude Code personal install `~/.claude/skills/clean-code-gates`; opencode local installer `~/.config/opencode/my-skills/plugins/my-skills/skills/clean-code-gates`; opencode remote install cache location is shown in the loaded skill's location.
