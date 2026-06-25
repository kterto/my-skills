# Clean Code Gates G6 — Swap `mutation_test` → `dart_mutant`

**Date:** 2026-06-15
**Target:** the **global** skill `~/.claude/skills/clean-code-gates/` (affects every project that runs the gates), driven by the toodls Flutter project's G6 needs.
**Status:** design — implementation deferred until approved.

## Problem

`/clean-code-gates` G6 (mutation, threshold 70) is hardwired to the `mutation_test` pub package. We removed `mutation_test` from `apps/flutter/pubspec.yaml` and chose `dart_mutant` (AST-based, parallel, faster) as the engine. The adapter must be rewritten to invoke `dart_mutant` and parse its Stryker-compatible JSON instead of `mutation_test`'s XML.

## Facts established (verified against `dart_mutant 0.4.0`, `/opt/homebrew/bin/dart_mutant`)

### Invocation surface
`dart_mutant [OPTIONS]` — flags relevant to the adapter (from `--help` + the binary's embedded option table):

| Flag | Default | Use in adapter |
|---|---|---|
| `--path <PATH>` | `.` | project root (the app dir) |
| `--glob <GLOB>` | `lib/**/*.dart` | scope of files to mutate — **must be a wildcard pattern**; an exact file path matches nothing |
| `--exclude <GLOB...>` | `**/*.g.dart **/*.freezed.dart **/*.mocks.dart **/generated/** **/test/** **/*_test.dart` | align with the gate config's `exclude` |
| `--test-command <CMD>` | **`dart test`** | **MUST override** — Flutter projects need `flutter test` / `fvm flutter test`, else every mutant fails to compile |
| `--threshold <0-100>` | `0` | the gate's `mutationScore` |
| `--parallel <N>` | `8` | parallelism |
| `--timeout <SEC>` | `30` | per-mutant timeout |
| `--output <DIR>` | `./mutation-reports` | report dir — point at a temp dir |
| `--json` | off | emit `mutation-report.json` (Stryker schema) |
| `--coverage-file <lcov>` | — | optional: mutate only covered lines (speed) |
| `--incremental` + `--base-ref <ref>` + `--cache-file <path>` | `.dart_mutant_cache` | optional incremental mode |
| `--sample <N>` | `0` (all) | optional quick-feedback sampling |
| `--operators <...>` | all | optional operator selection |
| `--ai <none\|anthropic\|openai\|ollama>` | `none` | **keep `none` for the gate** (AI placement is nondeterministic → unstable score) |
| `--dry-run` | off | generate mutations without testing — **broken in 0.4.0 (emits 0 mutants); do not use for detection** |
| `--quiet` | off | minimal stdout |

Reports are written to `<output>/mutation-report.json` (+ `.html`, `-ai.md`).

### JSON report schema (verified)
Top level (Stryker `mutation-testing-report-schema`, `schemaVersion: "1"`):
```json
{
  "schemaVersion": "1",
  "thresholds": { "high": 80, "low": 60 },
  "projectRoot": "/abs/path",
  "mutationScore": 73.4,
  "files": {
    "<relative-or-abs path>": {
      "language": "dart",
      "source": "<full source text>",
      "mutants": [
        {
          "id": "<id>",
          "mutatorName": "Arithmetic Operator | Comparison Operator | Logical Operator | Boolean Literal | Unary Operator | Assignment Operator | Null Safety Operator | String Literal | Collection Operation | Conditional | Return Statement | Async Operation | Literal Value | Bitwise Operator | Other",
          "replacement": "<mutated text>",
          "location": { "start": {"line": L, "column": C}, "end": {"line": L, "column": C} },
          "status": "Killed | Survived | NoCoverage | Timeout | CompileError | RuntimeError | Ignored"
        }
      ]
    }
  }
}
```
**Key wins for the adapter:** `mutationScore` is a **top-level float (0–100)** — read it directly for the verdict, no need to compute from mutant counts. Survivor findings come from `files[*].mutants[]` where `status ∈ {Survived, NoCoverage}`, using `location.start.line`. Parse `status`/`mutatorName` **case-insensitively** (don't hard-depend on exact casing across `dart_mutant` versions).

### Behavioral differences from `mutation_test` that simplify the adapter
- **No in-place file mutation.** `dart_mutant` sandboxes its own mutations, so the entire `setupWorktree` apparatus (isolated git worktree + uncommitted-patch replay + untracked-file copy + `pub get` in the copy) is **deleted**. G6 runs against the live tree, reusing the already-resolved `.dart_tool` — faster, and it reflects the working tree (which is what the user wants from a gate).
- **Top-level score** replaces XML `<result success>` parsing + the threshold-in-config XML.
- **Parallel + AST** — fewer wasted runs (no invalid-syntax mutants), so no per-mutant full-suite serial penalty.

## Files to change (all under `~/.claude/skills/clean-code-gates/`)

1. `src/adapters/dart-flutter.cjs`
2. `defaults.cjs`
3. (docs) `SKILL.md` / `README.md` G6 mention — update the tooling note.
4. (optional) `schema/report.schema.json` — only if a new finding `rule` value needs registering (it doesn't; `mutation/score` + `mutation/survived` are reused).

### `defaults.cjs`
- Line ~26: `G6: { tool: 'mutation_test', thresholds: THRESHOLDS.G6 }` → `G6: { tool: 'dart_mutant', thresholds: THRESHOLDS.G6 }`.

### `src/adapters/dart-flutter.cjs`
- `GATE_META.G6` (line ~41): `{ name: 'mutation', tool: 'mutation_test' }` → `{ name: 'mutation', tool: 'dart_mutant' }`.
- **Delete** (G6-only, now dead): `escapeXml`, `writeMutationConfig`, `parseMutationReport`, `setupWorktree`. Keep `git`/`gitRoot` **only if** the incremental option (below) uses them; otherwise delete those too (verify no other gate references them — G7 does not).
- **Rewrite `runG6`** as below.

#### New `runG6` (reference implementation)
```js
// ---- G6: mutation (dart_mutant) ----------------------------------------

/** Parse dart_mutant's Stryker JSON into { score, byFile: { rel: [lines] } }. */
function parseDartMutantReport(json) {
  let report;
  try { report = JSON.parse(json); } catch { return null; }
  const score = typeof report.mutationScore === 'number' ? report.mutationScore : null;
  const SURVIVED = new Set(['survived', 'nocoverage', 'no_coverage']);
  const byFile = {};
  let total = 0;
  for (const [name, fobj] of Object.entries(report.files || {})) {
    const lines = [];
    for (const m of fobj.mutants || []) {
      total += 1;
      const status = String(m.status || '').toLowerCase();
      if (!SURVIVED.has(status)) continue;
      const line = m.location && m.location.start && m.location.start.line;
      if (line) lines.push(line);
    }
    if (lines.length) byFile[name] = lines;
  }
  return { score, total, byFile };
}

function runG6(files, stackCfg, io) {
  const flutter = resolveFlutter(io.root);
  if (!flutter || !commandExists('dart_mutant')) {
    return missingTool('G6', stackCfg);
  }

  const threshold = ((stackCfg.gates.G6 || {}).thresholds || {}).mutationScore ?? 70;
  const thresholds = { mutationScore: threshold };
  const command = 'dart_mutant --json --test-command "<flutter test>"';

  const targets = files.filter(
    (rel) => DART_FILE_RE.test(rel) && !isExempt(rel, stackCfg, 'G6'),
  );
  if (!targets.length) return gateResult('G6', 'pass', { command, thresholds });

  const testCommand = [flutter.cmd, ...flutter.pre, 'test'].join(' ');
  const excludeGlobs = stackCfg.exclude || [];
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-g6-'));

  const args = [
    '--path', io.root,
    '--glob', g6Glob(stackCfg),          // see note below
    '--test-command', testCommand,
    '--threshold', String(threshold),
    '--json', '--quiet',
    '--ai', 'none',
    '--output', outDir,
  ];
  for (const ex of excludeGlobs) args.push('--exclude', ex);

  try {
    execFileSync('dart_mutant', args, {
      cwd: io.root,
      stdio: ['ignore', 'ignore', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    // dart_mutant exits non-zero when the score is below --threshold; the
    // report is still written. A missing report (below) is the real failure.
  }

  const reportPath = path.join(outDir, 'mutation-report.json');
  let parsed = null;
  if (fs.existsSync(reportPath)) {
    parsed = parseDartMutantReport(fs.readFileSync(reportPath, 'utf8'));
  }
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch { /* ignore */ }

  if (!parsed || parsed.score == null) return gateResult('G6', 'error', { command, thresholds });

  // No mutants generated (too-simple code) → nothing to verify, not a failure.
  // dart_mutant reports mutationScore 0.0 in this case, so guard on the count.
  if (parsed.total === 0) return gateResult('G6', 'pass', { command, thresholds });

  const findings = [];
  const failed = parsed.score < threshold;
  if (failed) {
    findings.push({
      id: 'G6:score',
      severity: 'blocker',
      file: targets[0],
      line: 1,
      rule: 'mutation/score',
      message: `mutation score ${parsed.score.toFixed(1)}% below the ${threshold}% quality gate`,
      metric: { value: parsed.score, limit: threshold, unit: 'percent' },
      fixHint: 'Strengthen tests to kill the surviving mutants listed below',
    });
  }
  for (const name of Object.keys(parsed.byFile)) {
    const rel = path.isAbsolute(name) ? path.relative(io.root, name) : name;
    if (isExempt(rel, stackCfg, 'G6')) continue;
    for (const line of parsed.byFile[name]) {
      findings.push({
        id: `G6-${rel}:${line}`,
        severity: 'warning',
        file: rel,
        line,
        rule: 'mutation/survived',
        message: `surviving mutant at ${rel}:${line}`,
        fixHint: `Add an assertion that fails when the code at line ${line} is mutated`,
      });
    }
  }

  return gateResult('G6', failed ? 'fail' : 'pass', { command, thresholds, findings });
}
```

#### `g6Glob(stackCfg)` — scope mapping (the one design wrinkle)
`dart_mutant` takes a single `--glob` wildcard, not a file list. The gate runner already filters findings to the in-scope `files` set after the fact (the `byFile` loop honors `targets`/exempt), so the glob only needs to be a **superset** of the scope:
- Map the stack `roots` (default `['lib']`) to `--glob '{root}/**/*.dart'`. For the common `--scope project` this is exactly right.
- For narrow scopes (`--scope files:`/`diff:`/`module:`), the simplest correct behavior is to still mutate the whole root glob but **report only the in-scope survivors** — which the `byFile`/`isExempt`/`targets` filter already does — at the cost of mutating out-of-scope files too. If that wastefulness matters, a follow-up can pass the narrowed set as a brace glob `lib/{a,b,c}.dart`; verify `dart_mutant`'s matcher supports brace expansion before relying on it. **Recommended v1: root-glob + post-filter** (simple, correct verdict scoping via the score caveat below).

> **Score-vs-scope caveat (call out in the impl):** `mutationScore` is computed by `dart_mutant` over everything its glob mutated. With the root-glob approach the score reflects the whole root, not a narrow `files:` scope. For the **project** scope (the real G6 use, and how the gate is run in CI) this is exactly correct. For narrow scopes the per-file survivor findings are still correctly scoped, but the pass/fail score is root-wide. Document this; do not silently present a root-wide score as a per-file score. If narrow-scope scoring is ever required, switch to the brace-glob or per-file-loop variant and recompute the score from the in-scope mutants.

### `commandExists` reuse
`commandExists('dart_mutant')` already works (`dart_mutant --version` → `dart_mutant 0.4.0`, exit 0). Detection switches from `hasPkg(io.root, 'mutation_test')` (a pub-package check) to `commandExists('dart_mutant')` (a PATH check) — correct, since `dart_mutant` is an external binary, not a dependency. `missingTool`'s existing hint ("needs `dart_mutant` on PATH") already reads correctly; optionally enrich it to mention `brew install` / `cargo install`.

## Config + project impact (toodls)
- `apps/flutter/.cleancode-gates.json` `gates.G6.tool`: `"mutation_test"` → `"dart_mutant"` (cosmetic — the adapter ignores it, but keep it truthful). Thresholds (`mutationScore: 70`) unchanged. The existing `exclude` globs (`*.g.dart`, `*.freezed.dart`, `*.gql.dart`, `*.config.dart`, `__generated__`, `firebase_options.dart`) are forwarded to `--exclude`, so G6 mutates the same surface G1/G2 measure.
- No pubspec entry for `dart_mutant` (it is a CLI binary). **CI must install it** (`brew install dart_mutant` or the project's documented method) and **pin the version** (it is pre-1.0). Add this to the CI setup + a note in the backend/flutter README.
- `apps/flutter/.dart_mutant_cache` (incremental cache, if `--incremental` is later enabled) and any stray `mutation-reports/` dir should be git-ignored.

## Testing the rewrite (adapter is a Node CLI with a Jest-style suite)
- Unit-test `parseDartMutantReport` against captured fixture JSONs: (a) score ≥ threshold + some `Killed` → pass, no findings; (b) score < threshold + `Survived`/`NoCoverage` mutants → one `mutation/score` blocker + per-line `mutation/survived` warnings; (c) malformed/empty JSON → `null` → `error`; (d) `mutationScore` absent → `error`; (e) `files` present but **0 mutants total** (score `0.0`) → `pass` (nothing to verify, not a failure). Add fixtures under the skill's `__tests__/fixtures/`.
- Integration smoke (manual, slow): run `node bin/gates.cjs --scope files:lib/<small-file>.dart --gates G6 --out -` inside `apps/flutter` with `dart_mutant` installed; confirm JSON gate output and that no `mutation-reports/`/worktree litter remains.
- Regression: the existing `__tests__/dart-flutter.test.cjs` G6 cases that assert `mutation_test` invocation/XML parsing must be replaced with `dart_mutant`/JSON equivalents.

## Out of scope (follow-ups, not v1)
- `--incremental`/`--base-ref`/`--cache-file` wiring for fast local diffs.
- `--coverage-file` (feed G1's lcov to mutate only covered lines).
- Brace-glob / per-file narrow-scope scoring.
- AI mutation placement (`--ai`) — intentionally never enabled for the gate.

## Success criteria
- `node bin/gates.cjs --scope project --gates G6` inside a Flutter project with `dart_mutant` installed runs `dart_mutant` (not `mutation_test`), parses the JSON, and returns `pass` when `mutationScore ≥ threshold`, `fail` (with score blocker + survivor warnings) when below, `missing_tool` when `dart_mutant` is absent, `error` on unparseable/empty report.
- No git worktree / in-place mutation / `pub get` side effects; no `mutation-reports/` left in the project.
- The `mutation_test`-specific code (`escapeXml`, `writeMutationConfig`, `parseMutationReport`, `setupWorktree`) is removed and its tests updated.
