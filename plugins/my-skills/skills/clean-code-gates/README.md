# clean-code-gates

Portable Clean Code gate runner (G1–G7). Produces a stack-agnostic JSON + Markdown report with no build-system coupling.

---

## Install / usage

No npm install required. Run directly with Node.js (v18+) from a project root:

```
node ~/.claude/skills/clean-code-gates/bin/gates.cjs [flags]
```

All flags consume the next positional argument as their value unless noted.

---

## Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--scope project\|diff[:<base-ref>]\|module:<path\|glob>\|files:a,b,c` | `project` | What files to analyse. `project` walks all stack roots. `diff` uses `git diff --name-only <base-ref>..HEAD`; if `<base-ref>` is omitted the merge-base against `origin/main` is used. `module:<path>` recursively lists a sub-tree. `files:a,b,c` accepts an explicit comma-separated list. |
| `--gates G1,G5` | all applicable | Allow-list of gates to run (comma-separated). Gates not supported by the detected stack are silently dropped. |
| `--skip G6` | none | Comma-separated gates to exclude, applied after `--gates`. |
| `--out <dir\|->` | `./.cleancode` | Output directory for `report.json` and `report.md`. Pass `-` to write JSON to stdout instead. |
| `--scaffold` | false | Plan 4 — not yet implemented. Flag is parsed and recorded but has no effect. |
| `--require-tools` | false | Exit 2 (instead of 0) when any gate reports `missing_tool`. Useful for CI hard-gates. |

---

## Gates

| ID | Name | What it checks | Status |
|----|------|----------------|--------|
| G1 | coverage | Statement ≥ 85 % · Branch ≥ 80 % | `missing_tool` — requires node-ts (Plan 2) or dart-flutter (Plan 3) adapter |
| G2 | cyclomatic-complexity | Cyclomatic complexity ≤ 8, max depth ≤ 2, max lines/fn ≤ 30, max params ≤ 4, max statements ≤ 15 | `missing_tool` — same adapters |
| G3 | length-nesting | File/function length and nesting limits (same thresholds as G2) | `missing_tool` — same adapters |
| G4 | naming | Naming-convention lint rules | `missing_tool` — same adapters |
| **G5** | **no-comments** | **Disallows what-comments inside code bodies. Allows: `///` Dart doc, `/** */` TS doc blocks, plan-ID citations (`SPEC-N`, `FEAT-N`, etc.), `TODO(REF)`, and unindented licence banners in the first 5 lines.** | **Implemented — runs with zero external tooling (builtin)** |
| G6 | mutation | Mutation score ≥ 70 % | `missing_tool` — same adapters |
| G7 | dependency-structure | Enforces import / dependency layer rules | `missing_tool` — same adapters |

G1/G2/G3/G4/G6/G7 produce a `missing_tool` result and do not crash. `--scaffold` (Plan 4) is not yet implemented; the flag is accepted but does nothing.

**G6 tooling (dart-flutter):** the mutation gate invokes the external `dart_mutant` binary and parses its Stryker-compatible JSON (`--json`). The pass/fail verdict is the report's top-level `mutationScore` vs the gate threshold (default 70); surviving mutants (`status` ∈ {Survived, NoCoverage}) are reported as warnings. `dart_mutant` must be installed on PATH (e.g. `brew install dart_mutant`) — it is a standalone CLI, not a pub dev-dependency. Runs against the live tree with no `mutation-reports/`, worktree, or `pub get` side effects (the report is written to a temp dir and removed after parsing).

---

## Stack detection and config

On first run the CLI detects stacks from the project root:

- **node-ts** — detected when `package.json` + `tsconfig.json` are present.
- **dart-flutter** — detected when `pubspec.yaml` is present.

Detection results are used to auto-create `.cleancode-gates.json` in the project root with per-stack gate commands and thresholds. The file is user-editable; user values are deep-merged over defaults (user wins on every key). Example of what is written for a node-ts project:

```json
{
  "schemaVersion": "1.0",
  "stacks": {
    "node-ts": {
      "roots": ["src"],
      "gates": {
        "G1": { "tool": "jest", "thresholds": { "statements": 85, "branches": 80 } },
        "G2": { "tool": "eslint", "thresholds": { "complexity": 8, "maxDepth": 2, "maxLinesPerFunction": 30, "maxParams": 4, "maxStatements": 15 } },
        "G4": { "tool": "eslint" },
        "G5": { "tool": "builtin" },
        "G6": { "tool": "stryker", "thresholds": { "mutationScore": 70 } },
        "G7": { "tool": "dependency-cruiser" }
      },
      "baseline": ".eslint-baseline.json"
    }
  }
}
```

Only files under the configured `roots` are scored. Files outside any known stack root are silently dropped from the scope.

---

## Report

Unless `--out -` is used, two files are written:

```
<out>/report.json   — machine-readable; conforms to schema/report.schema.json
<out>/report.md     — human-readable summary
```

### JSON schema

Full schema at `schema/report.schema.json`. Top-level shape:

```
{
  "schemaVersion": "1.0",
  "generatedAt": "<ISO-8601>",
  "tool": { "name": "clean-code-gates", "version": "0.1.0" },
  "scope": { "kind": "project|diff|module|files", "files": [...], "stacks": [...] },
  "summary": {
    "status": "pass|warn|blocked",
    "gatesRun": [...],
    "gatesMissingTool": [...],
    "blockers": 0,
    "warnings": 0
  },
  "gates": [ <gate-result>, ... ]
}
```

Each gate result:

```
{
  "gate": "G5",
  "name": "no-comments",
  "stack": "node-ts",
  "status": "pass|fail|warn|missing_tool|skipped|error",
  "tool": "builtin",
  "findings": [ <finding>, ... ],
  "installHint": null            // set when status=missing_tool
}
```

Each finding:

```
{
  "id": "G5-src/foo.ts:12",
  "severity": "blocker|warning",
  "file": "src/foo.ts",
  "line": 12,
  "rule": "no-comments",
  "message": "disallowed comment: ...",
  "fixHint": "remove the comment or convert to an exported doc comment / plan-ID citation"
}
```

### Exit codes

| Code | Meaning |
|------|---------|
| 0 | All gates pass (or only `missing_tool` and `--require-tools` not set) |
| 1 | One or more findings with `severity: blocker` |
| 2 | One or more `missing_tool` gates and `--require-tools` was passed |
| 3 | Usage or config error (bad flag, invalid JSON config) |

---

## Consuming the report in orchestrators and fixer agents

Read `<out>/report.json`. The canonical iteration pattern:

```js
const report = JSON.parse(fs.readFileSync('.cleancode/report.json', 'utf8'));
if (report.summary.status === 'blocked') {
  for (const gate of report.gates) {
    for (const finding of gate.findings) {
      // finding.file      — relative path to the offending file
      // finding.line      — 1-based line number
      // finding.rule      — machine-readable rule name (e.g. "no-comments")
      // finding.message   — human description of the violation
      // finding.fixHint   — actionable instruction for an automated fixer
      // finding.severity  — "blocker" or "warning"
    }
  }
}
```

Gates with `status: "missing_tool"` have an `installHint` string on the gate object describing what to install or run. They have an empty `findings` array.

---

## Implementation status (Plan 1 / engine state)

- **Done**: CLI (`bin/gates.cjs`), arg parsing, stack detection, config load/merge, scope resolution (project / diff / module / files), G5 no-comments gate (builtin, no external tools), report builder (JSON + Markdown), exit codes, JSON schema.
- **Pending Plan 2**: node-ts adapters (jest/eslint/stryker/dependency-cruiser) enabling G1/G2/G3/G4/G6/G7.
- **Pending Plan 3**: dart-flutter adapters (flutter/dart_code_linter/dart_mutant/import_lint).
- **Pending Plan 4**: `--scaffold` auto-generates boilerplate gate configs for a project.
