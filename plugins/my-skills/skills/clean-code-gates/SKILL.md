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
- `--base-ref <ref>` — anchor the instrument to `<ref>` (see *The instrument is merge-base anchored*). A `diff` scope anchors to its own base automatically; this flag sets it explicitly and outranks the scope.
- `--rigor <sketch|delivery|hardened>` — how hard this run's verdict is (see *Rigor*). Default `hardened`, which is the pre-rigor behaviour: every gate blocks.
- `--scaffold` — advice mode: detect stacks and print the exact install commands for any missing gate tooling, then exit 0 (read-only, changes nothing)

### Exit codes
`0` pass · `1` blockers found · `2` missing tools (with `--require-tools`) · `3` usage/config error, including a scope that resolved to zero gateable files (nothing measured, so no verdict) · `4` a gate errored and produced no verdict (independent of `--require-tools`)

## Capability

All gates G1–G7 are implemented for both stacks:

- **G5 (no-comments)** — built-in, **zero external tooling**. Detects comments at **any column**, not only at the start of a line, and is string-aware (delimiters inside string, template, triple-quoted, and regex literals are not comments). It scans only source files of the detected stack (`.ts`/`.tsx`, `.dart`). Allowances are position-sensitive: `///` and `/** */` doc comments must lead the line; plan-ID citations, `TODO(REF)`, and Dart analyzer directives are allowed anywhere on the line; an unindented licence banner is allowed in the first 5 lines. **Deliberate strictness increase:** a repo that passed G5 on inline trailing comments will now report them as blockers.
- **node-ts** — G1 coverage (jest **or** vitest), G2 complexity + G4 naming (ESLint + typescript-eslint), G6 mutation (Stryker, jest/vitest runner), G7 dependency-structure (dependency-cruiser).
- **dart-flutter** — G1 coverage (flutter), G2 complexity + G4 naming (dart_code_linter), G6 mutation (`mutation_test`; `dart_mutant` opt-in), G7 dependency-structure (built-in).
- **G3 (length/nesting)** is folded into G2 (same thresholds and tools) — it is not a separate runtime gate.

A gate reports `status: "missing_tool"` with an install hint (never crashes) when its per-stack tooling isn't present in the target project. Run `--scaffold` to print the exact install commands for whatever is missing, or `--require-tools` to make `missing_tool` a hard failure (exit 2) in CI.

## Config

On first run it auto-creates `.cleancode-gates.json` in the target project root from detected stacks (per-stack gate commands + thresholds: coverage 85/80, complexity 8, length 30, nesting 2, mutation 70). Edit it to override roots, thresholds, commands, or exemptions. Delete it to regenerate.

### Rigor — what a green run at this level claims

`--rigor` (or a top-level `"rigor"` in `.cleancode-gates.json`) selects one of three levels. Each is named by what a green run at that level **claims**, not by how much effort it spent:

| Level | The promise | G1 | G2 · G4 · G5 · G7 | G6 |
|---|---|---|---|---|
| `sketch` | It runs. Nothing is claimed about quality. | report | report | skipped |
| `delivery` | It does what the Acceptance says, and the happy path is proven. | **blocks** | report | skipped |
| `hardened` (default) | Plus: the gates hold and the mutants die. | **blocks** | **blocks** | **blocks** |

**Rigor scales the work, never the disclosure.** Every gate still runs at every level and every finding is still reported — what moves is whether a finding *blocks*:

- A **report-only** gate's blockers are **demoted, not deleted**. Each keeps its file, line, rule and fix hint, and gains `demotedFrom: "blocker"` plus the level that demoted it. The gate's `status` falls from `fail` to `warn`; the finding is still in `report.gates[].findings[]` for a fixer to act on.
- **G6 is the one gate a lower level skips**, because its cost is prohibitive rather than merely real. A skipped gate is `status: "skipped"` with `measurement.state: "unmeasured"` and `reason: "rigor-<level>"` — it is never reported as a pass.
- A run whose exit code is `0` **because of its level** says so, on stderr and in `report.md`: `RIGOR sketch — 1 blocker demoted to warning (G5); G6 skipped`. A `hardened` run prints nothing, because nothing about its exit code needs explaining.
- `report.rigor` carries `{ level, source, demoted, reportOnly, skipped }` on **every** report, `hardened` included — a reader must never infer the level from a missing line.

**Precedence: `--rigor` > the config's `rigor` > `hardened`.** An unrecognised value in the config fails closed to `hardened`, never to the lowest bar. The config field is **merge-base anchored** like the thresholds below it, so a branch that sets itself to `sketch` prints `INSTRUMENT MOVED — rigor hardened → sketch (loosening)` and runs at the merge-base level. `docs/adr/0024` in the authoring repo is normative for the level contract.

### The instrument is merge-base anchored

The config lives inside the tree it measures, so the cheapest path to a green gate runs through the config rather than through the code: widen `exempt`, drop a `root`, lower a threshold — all inside the change under review, all silent.

When the run knows a base ref — any `diff` scope, or an explicit `--base-ref` — four field families are read from **that ref's** copy of `.cleancode-gates.json` and the gates run on those values:

| Anchored | Left to the working tree |
|---|---|
| `rigor` · `stacks.<s>.roots` · `stacks.<s>.exclude` · `gates.<id>.exempt` · `gates.<id>.thresholds` | `tool` · `runner` · `budget` · `baseline` · everything else |

The split is *what is measured and how hard* versus *how the measurement is performed*. A branch legitimately swaps a runner or raises a G6 budget; a branch that lowers `mutationScore` is changing the verdict it is about to be judged by.

Every field that disagrees is named once, on stderr and in `report.md`, and the line cannot be suppressed:

```
INSTRUMENT MOVED — node-ts.gates.G2.exempt +3 globs (loosening), node-ts.gates.G1.thresholds.statements 85 → 60 (loosening) — measured against merge-base (origin/main) values
```

`report.instrument` carries the same as data: `{ anchored, baseRef, source, moves[] }`, present on every report including `anchored: false`. Direction is derived per key — a floor (`statements`, `branches`, `mutationScore`) loosens when it falls, a ceiling (`complexity`, `maxDepth`, `source-lines-of-code`, …) loosens when it rises, and a key neither table knows is reported `changed` with both values rather than guessed at.

**No config at the base ref anchors to the built-in defaults, never to the working-tree copy** — that is also what the merge-base measured at, since the file is auto-created from those defaults. The same applies when it is unparseable there.

A legitimate threshold change still works: land it in its own commit, where the moved line is informative rather than damning. Project, module and files scopes have no base, report `anchored: false`, and claim nothing.

## Reading the report (for agents/orchestrators)

`<out>/report.json` (schema: `schema/report.schema.json` in this skill dir) is the contract. Iterate `report.gates[].findings[]`; each finding carries `{ file, line, rule, message, fixHint, severity }` — enough to fix without re-deriving. `report.summary.status` is `pass | warn | blocked | error`; `report.summary.gatesMissingTool` lists gates whose tooling is absent, and `report.summary.gatesErrored` lists gates whose run failed outright — those measured nothing, so `error` must never be read as `pass`. A human-readable `<out>/report.md` mirrors it.

## Example

```bash
cd /path/to/project
node <skill-dir>/bin/gates.cjs --scope diff --gates G5 --out -
```

## Notes
- **G1 / G6 test runner (node-ts)** — the coverage (G1) and mutation (G6) gates work with **Jest or Vitest**, auto-detected from `node_modules/.bin` (both present → jest, for back-compat). Vitest emits the same Istanbul `coverage-summary.json`, so only the invocation differs. Override auto-detection with `gates.G1.tool: "jest" | "vitest"` (coverage) and `gates.G6.runner: "jest" | "vitest"` (mutation) in `.cleancode-gates.json`. Vitest coverage needs a provider (`@vitest/coverage-v8` or `-istanbul`); Vitest mutation needs `@stryker-mutator/vitest-runner`. When the chosen runner or its plugin is absent, the gate reports `missing_tool` with an install hint.
- **G6 (mutation, dart-flutter)** runs the `mutation_test` pub package by default. It writes a
  generated config naming exactly the in-scope files plus the project's test command, runs
  `dart pub global run mutation_test -f junit`, and derives the score by walking the junit
  report's `<testcase>` elements. Each one carries exactly one of four outcomes: a killed
  mutant has no child element (it is self-closing), a survivor carries
  `<failure type="undetected">`, and a timed-out or never-executed mutant carries `<error>`
  with a distinguishing `type`. The score is `detected / total` — the pessimistic bound, since
  a mutant that never ran is not a mutant the tests killed — with `measuredScore` reported
  beside it over only the mutants that actually ran. The suite attributes are read solely as a
  consistency check (`tests=` is the mutation count, `failures=` the undetected count, and
  `errors=` fuses timeout with not-covered, which is why they cannot produce a score on their
  own); a report whose attributes disagree with its elements is an error, never a score. junit
  is the only format carrying the per-mutant outcomes — the plain `xml` report lists undetected
  mutations with no total. When
  `coverage/lcov.info` exists it is passed with `-c`, so only covered statements are mutated.
  Install with `dart pub global activate mutation_test`.
  Set `gates.G6.tool: "dart_mutant"` to use the external `dart_mutant` CLI instead, which
  reads a Stryker-compatible JSON report (`brew install dart_mutant`). Either way the pass/fail
  comparison happens against `.cleancode-gates.json`'s `mutationScore`; `mutation_test`'s own
  `<threshold>` element is never emitted and its exit code is never read, so the config stays
  the single source of every number. Neither tool leaves a report directory, worktree, or
  `pub get` litter behind.
  `dart_mutant` sandboxes its mutations; `mutation_test` edits target files **in place** and
  restores them on a clean exit. The adapter snapshots every target before the run, registers
  `SIGINT`/`SIGTERM`/`SIGHUP` handlers, and puts back anything that differs, so an interrupted
  run cannot leave a live mutation in the tree. Registering those handlers is what makes the
  restore reachable at all — Node runs neither `finally` nor `exit` handlers on a
  default-disposition signal — and it also means a signal no longer stops the gate instantly.
  **Wrap the gate as `timeout -k 30 <seconds>`, never bare `timeout`:** the plain form sends
  `SIGTERM`, which the gate now absorbs so it can restore. `SIGKILL` to the gate process is the
  one documented residual, and `gates.G6.budget.totalSeconds` should be lower than any outer
  wrapper's bound.

  **G6 is bounded and may decline.** `gates.G6.budget` takes `perMutantSeconds` (default 120,
  written into the generated config as the per-mutant `timeout`), `totalSeconds` (default 1800,
  the hard bound on the child process) and `maxMutants` (default 400). Before scoring anything
  the dart adapter runs `mutation_test -d`, which counts the mutations without running any test,
  and refuses the run when the mutant count or the worst-case wall clock exceeds the budget. A
  refused run — and a run killed on the clock — reports `status: error` with
  `measurement.state: "unmeasured"` and the arithmetic that caused it. **Never `pass`:** a scope
  nothing ran against has no score to compare. Every G6 result carries a `measurement` block
  (`empty` | `measured` | `partial` | `unmeasured`), so "did it pass" and "was it actually
  verified" are separate questions. Because each mutant re-runs the whole test command, G6 over
  a large project is a scheduled artifact, not a per-change gate — use `--scope diff` or a
  narrow module.

  **What each stack enforces, stated rather than assumed.** `perMutantSeconds` and
  `totalSeconds` are enforced on both stacks: the per-mutant cap is written into the generated
  tool config (Stryker's `timeoutMS`) and the child is spawned with a hard `timeout` and
  `SIGKILL`. `maxMutants` is enforced on dart-flutter only — Stryker exposes no count without
  running the mutants, so there is nothing to refuse *before* the spend, and a node-ts run is
  bounded by the clock instead of by the count. Stryker also classifies differently and
  correctly so: it counts a `Timeout` as **detected** (the suite caught a mutant that hangs),
  where `mutation_test`'s timeouts mean the mutant never ran and score as unmeasured. Each
  adapter follows its own tool; neither should be "fixed" into the other's semantics.
- Mirrors the gate semantics in a project's qa agent (`.claude/agents/qa.md` in GSD repos) but decoupled from any plan/CR/QA flow. G8 (rework ratio) is intentionally out of scope — it's a plan-tree metric, not a code property.
- Tests: `cd <skill-dir> && node --test`.
- Common skill dirs: Claude Code personal install `~/.claude/skills/clean-code-gates`; opencode local installer `~/.config/opencode/my-skills/plugins/my-skills/skills/clean-code-gates`; opencode remote install cache location is shown in the loaded skill's location.
