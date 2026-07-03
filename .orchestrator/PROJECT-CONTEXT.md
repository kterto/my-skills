# PROJECT-CONTEXT

## Project

**my-skills** — a Claude Code plugin marketplace of authoring skills. This pipeline targets the **clean-code-gates** skill: a portable, dependency-free Node CLI that runs Clean Code quality gates (G1–G7) against target projects. Current task scope is its `dart-flutter` adapter's **G6 mutation gate**, rewriting it from the `mutation_test` pub package to the `dart_mutant` binary (Stryker-JSON output).

## Stack

- **Language:** JavaScript (Node.js), CommonJS (`"type": "commonjs"`, all files `.cjs`).
- **Runtime deps:** zero — uses only `node:fs`, `node:os`, `node:path`, `node:child_process`. No `node_modules`, no lockfile.
- **Node:** not pinned (no `engines`/`.nvmrc`); local runtime Node v22. Test runner (`node:test`) needs Node ≥ 18.
- The skill *analyzes* two external stacks at runtime (`node-ts`, `dart-flutter`) but its own code is plain Node CJS.

## Commands

All commands run from the skill dir `plugins/my-skills/skills/clean-code-gates/`:

- **Test (all):** `cd plugins/my-skills/skills/clean-code-gates && node --test`
- **Test (single file):** `cd plugins/my-skills/skills/clean-code-gates && node --test __tests__/dart-flutter.test.cjs`
- **Build:** none (no build step — plain `.cjs`).
- **Lint:** none configured for the skill's own JS (no ESLint config in-repo).
- **CLI entry (manual gate run):** `node bin/gates.cjs [flags]` from a target project root.

## Test tooling

- **Test framework:** Node's built-in test runner (`node --test`, `scripts.test = "node --test"`). No Jest/Mocha/custom runner.
- **e2e:** none. The skill has unit tests only (pure helpers exercised via each module's exported `_internals`).
- **Coverage:** none wired up (Node's `--experimental-test-coverage` exists but is not configured). There is **no coverage floor tooling** — the tester role should treat coverage as not-measured/advisory, not a hard block.
- **Fixtures:** `__tests__/fixtures/` exists but is empty; existing tests build fixtures inline via `fs.mkdtempSync` in `os.tmpdir()`. The G6 rewrite adds captured JSON fixtures under `__tests__/fixtures/` per the spec.

## Layout

Repo root `/Volumes/ssd/Developer/my-skills/`:
- `.claude-plugin/marketplace.json` — marketplace manifest → plugin at `./plugins/my-skills`.
- `plugins/my-skills/.claude-plugin/plugin.json` — plugin manifest.
- `plugins/my-skills/skills/` — 8 skills incl. `clean-code-gates`, `orchestrator`.
- `docs/`, `scripts/`, `README.md`, `sync.sh`, `.gitignore`.

clean-code-gates skill (`plugins/my-skills/skills/clean-code-gates/`):
- `bin/gates.cjs` — CLI entry.
- `defaults.cjs` — gate/tool/threshold defaults (G6 tool set here).
- `src/` — `args.cjs`, `config.cjs`, `detect.cjs`, `report.cjs`, `run.cjs`, `scope.cjs`.
- `src/adapters/` — `dart-flutter.cjs` (**G6 lives here**), `node-ts.cjs`.
- `src/gates/` — `g5-no-comments.cjs`, `registry.cjs`.
- `schema/report.schema.json` — report JSON contract.
- `__tests__/` — `*.test.cjs` mirroring modules (`dart-flutter.test.cjs`), `fixtures/`.
- `SKILL.md`, `README.md`, `package.json`, `.cleancode-gates.json`.

## Conventions

- **Files:** `.cjs`, lowercase-hyphenated (`dart-flutter.cjs`).
- **Tests:** `<module>.test.cjs` under `__tests__/`, auto-discovered by `node --test`. Internals tested via the module's exported `_internals` object (a rewrite that unit-tests new helpers must add them to `_internals`).
- **Gate IDs:** `G1`–`G7`. Finding IDs: `G<n>-<relpath>:<line>` (e.g. `G6-lib/a.dart:12`), rules like `mutation/score`, `mutation/survived`.
- **Plan artifacts (this pipeline):** live under `plans/` per the orchestrator allow-list — `plans/specs/` (SPEC), `plans/feat/` (FEAT), `plans/code-review/` (FIX, CR), `plans/qa/` (QAF, QA), `plans/test/` (TEST), `plans/eval/` (EVAL), `plans/final/` (FINAL). Slug = kebab-case of the title.
- **Skill sync:** `sync.sh` symlinks in-repo `plugins/my-skills/skills/*` into global `~/.claude/skills/`. The in-repo source is the source of truth; the spec's "target: global skill" refers to the synced copy.

## Invariants

- **Zero runtime dependencies** — the CLI must stay dependency-free (only `node:*` builtins). Do not add npm packages.
- **CommonJS only** — `require`/`module.exports`, `.cjs` extension.
- **Report contract** — findings must conform to `schema/report.schema.json` (`{file,line,rule,message,fixHint,severity}`); reuse existing rule values `mutation/score` + `mutation/survived` (no new rule registration needed).
- **No side effects on the target tree** — the `dart_mutant` rewrite must leave no `mutation-reports/`, worktree, or `pub get` litter; write reports to a temp dir and clean up.
- **Parse `dart_mutant` `status`/`mutatorName` case-insensitively** (per spec).
- **Reusable infra** (`resolveDart`, `resolveFlutter`, `isExempt`, `gateResult`, `missingTool`, `commandExists`, `DART_FILE_RE`) stays; delete only the `mutation_test`-specific helpers (`escapeXml`, `writeMutationConfig`, `parseMutationReport`, `setupWorktree`, and `git`/`gitRoot` if unreferenced).
- Update `SKILL.md`/`README.md` G6 tooling note to reflect `dart_mutant`.

## Critical flows

The gate is a CLI, not a UI — "flows" are CLI behaviors verified by unit tests + a manual smoke run:
1. `node bin/gates.cjs --scope project --gates G6` in a Flutter project with `dart_mutant` installed → runs `dart_mutant`, parses JSON, returns `pass` when `mutationScore ≥ threshold`.
2. Below threshold → `fail` with one `mutation/score` blocker + per-line `mutation/survived` warnings.
3. `dart_mutant` absent on PATH → `missing_tool`.
4. Unparseable/empty/`mutationScore`-absent report → `error`.
5. `files` present but 0 mutants total → `pass` (nothing to verify).
6. No leftover `mutation-reports/`/worktree litter after a run.

## Out of scope

- `--incremental` / `--base-ref` / `--cache-file` wiring.
- `--coverage-file` (mutate only covered lines).
- Brace-glob / per-file narrow-scope mutation scoring (v1 uses root-glob + post-filter; document the score-vs-scope caveat).
- AI mutation placement (`--ai`) — intentionally never enabled for the gate.
- Any change outside the clean-code-gates skill.
