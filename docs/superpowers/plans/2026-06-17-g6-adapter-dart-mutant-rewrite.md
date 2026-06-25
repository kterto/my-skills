# G6 Adapter `dart_mutant` Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Swap the dart-flutter G6 (mutation) gate from the `mutation_test` pub package to the `dart_mutant` CLI binary, parsing its Stryker-compatible JSON instead of `mutation_test`'s XML.

**Architecture:** `runG6` stops cloning the repo into an isolated git worktree (the entire `setupWorktree` apparatus is deleted, since `dart_mutant` sandboxes its own mutations) and instead runs the `dart_mutant` binary against the live tree, points `--output` at a temp dir, reads the top-level `mutationScore` float for the verdict, and emits per-survivor findings from `files[*].mutants[]`. Detection switches from a pub-package check (`hasPkg`) to a PATH check (`commandExists('dart_mutant')`).

**Tech Stack:** Node.js CommonJS (`.cjs`), `node:test` test runner (`npm test` → `node --test`), `dart_mutant 0.4.0` external binary, Flutter/FVM for the kill command.

## Global Constraints

- **Source of truth is the repo, not the deployed copy.** All edits go to `plugins/my-skills/skills/clean-code-gates/` inside this repo (`/Volumes/ssd/Developer/my-skills`). The spec names `~/.claude/skills/clean-code-gates/` because that is the *deployed* location; `sync.sh` propagates the repo copy there. Do not edit `~/.claude/...` directly.
- **Test runner is `node:test`, not Jest.** The spec says "Jest-style suite"; the real suite uses `const { test } = require('node:test')` + `node:assert`. Match the existing `__tests__/dart-flutter.test.cjs` style. Run with `npm test` from the skill dir.
- **Parse `status`/`mutatorName` case-insensitively.** Lowercase before comparing; do not hard-depend on `dart_mutant`'s exact casing across versions.
- **`mutationScore` is a top-level float (0–100).** Read it directly for the verdict — never recompute from mutant counts.
- **Keep `--ai none`.** AI mutation placement is nondeterministic → unstable score. Never enable it for the gate.
- **Threshold default is 70** (`THRESHOLDS.G6.mutationScore`).
- All shell-outs use `execFileSync` (no shell), matching the rest of the adapter.

---

## File Structure

| File | Responsibility | Change |
|---|---|---|
| `plugins/my-skills/skills/clean-code-gates/src/adapters/dart-flutter.cjs` | dart-flutter gate implementations | Add `parseDartMutantReport` + `g6Glob`; rewrite `runG6`; delete `escapeXml`, `writeMutationConfig`, `parseMutationReport`, `setupWorktree`, `git`, `gitRoot`; update `GATE_META.G6`; update `_internals` exports; update G6 JSDoc comment |
| `plugins/my-skills/skills/clean-code-gates/defaults.cjs` | per-stack default config | `G6.tool`: `'mutation_test'` → `'dart_mutant'` (line ~39) |
| `plugins/my-skills/skills/clean-code-gates/__tests__/dart-flutter.test.cjs` | adapter unit tests | Add `parseDartMutantReport` + `g6Glob` cases; remove `parseMutationReport` cases + import |
| `plugins/my-skills/skills/clean-code-gates/README.md` | user docs | G6 tooling note: dart-flutter mutation engine is `dart_mutant` |

Out of scope for v1 (spec "Out of scope"): `--incremental`/`--coverage-file`/brace-glob narrow-scope scoring/`--ai`. The `node-ts` G6 (`stryker`) is untouched.

---

### Task 1: Pure parsing + glob helpers (`parseDartMutantReport`, `g6Glob`)

These are side-effect-free functions extracted from the spec's reference implementation. They carry the entire test burden of the rewrite (the spawning `runG6` is covered by a manual smoke in Task 2). Adding them and exporting them does not break the existing suite — `parseMutationReport` and its tests stay until Task 2.

**Files:**
- Modify: `plugins/my-skills/skills/clean-code-gates/src/adapters/dart-flutter.cjs` (add two functions near the G6 section ~line 425; add both to the `_internals` export object ~line 771)
- Test: `plugins/my-skills/skills/clean-code-gates/__tests__/dart-flutter.test.cjs`

**Interfaces:**
- Consumes: nothing (pure functions over their args).
- Produces:
  - `parseDartMutantReport(json: string) => { score: number|null, total: number, byFile: { [name: string]: number[] } } | null` — returns `null` only when `json` is not parseable JSON; `score` is `null` when `mutationScore` is absent/non-numeric; `total` is the count of *all* mutants seen; `byFile` maps each file name (verbatim report key) to the start lines of its `Survived`/`NoCoverage` mutants, omitting files with no survivors.
  - `g6Glob(stackCfg: { roots?: string[] }) => string` — a single wildcard glob covering the stack roots: one root → `'<root>/**/*.dart'`; multiple → `'{<r1>,<r2>}/**/*.dart'`; missing/empty roots default to `'lib/**/*.dart'`.

- [ ] **Step 1: Write the failing tests**

Add these tests to `__tests__/dart-flutter.test.cjs`. First extend the destructured import on line 4 to pull the two new names (leave `parseMutationReport` in place for now):

```js
const { parseLcov, fileMetrics, coverageFindings, parseDclJson, g2Findings, parseAnalyzeLine, parseMutationReport, parseDartMutantReport, g6Glob, resolveImport, buildImportGraph, findCycles } = adapter._internals;
```

Then append these test blocks to the end of the file:

```js
// ---- G6: dart_mutant JSON parsing -------------------------------------

const DM_PASS = JSON.stringify({
  schemaVersion: '1',
  mutationScore: 82.5,
  files: {
    'lib/src/a.dart': {
      language: 'dart',
      mutants: [
        { id: '1', mutatorName: 'Arithmetic Operator', status: 'Killed', location: { start: { line: 3, column: 1 } } },
        { id: '2', mutatorName: 'Comparison Operator', status: 'Killed', location: { start: { line: 7, column: 5 } } },
      ],
    },
  },
});

const DM_FAIL = JSON.stringify({
  schemaVersion: '1',
  mutationScore: 41.0,
  files: {
    'lib/src/a.dart': {
      mutants: [
        { id: '1', mutatorName: 'Logical Operator', status: 'Survived', location: { start: { line: 12, column: 3 } } },
        { id: '2', mutatorName: 'Boolean Literal', status: 'Killed', location: { start: { line: 14, column: 1 } } },
        { id: '3', mutatorName: 'Return Statement', status: 'NoCoverage', location: { start: { line: 20, column: 2 } } },
      ],
    },
    'lib/src/b.dart': {
      mutants: [
        { id: '4', mutatorName: 'Conditional', status: 'no_coverage', location: { start: { line: 5, column: 1 } } },
      ],
    },
  },
});

const DM_EMPTY = JSON.stringify({ schemaVersion: '1', mutationScore: 0.0, files: {} });

const DM_NO_SCORE = JSON.stringify({
  schemaVersion: '1',
  files: { 'lib/a.dart': { mutants: [{ id: '1', status: 'Killed', location: { start: { line: 1 } } }] } },
});

test('parseDartMutantReport: passing report → score, total, no survivors', () => {
  const r = parseDartMutantReport(DM_PASS);
  assert.strictEqual(r.score, 82.5);
  assert.strictEqual(r.total, 2);
  assert.deepStrictEqual(r.byFile, {});
});

test('parseDartMutantReport: failing report → survivor lines per file, case-insensitive status', () => {
  const r = parseDartMutantReport(DM_FAIL);
  assert.strictEqual(r.score, 41.0);
  assert.strictEqual(r.total, 4);
  assert.deepStrictEqual(r.byFile['lib/src/a.dart'], [12, 20]); // Survived + NoCoverage, Killed skipped
  assert.deepStrictEqual(r.byFile['lib/src/b.dart'], [5]);       // 'no_coverage' lowercased variant
});

test('parseDartMutantReport: malformed JSON → null', () => {
  assert.strictEqual(parseDartMutantReport('not json {'), null);
  assert.strictEqual(parseDartMutantReport(''), null);
});

test('parseDartMutantReport: missing mutationScore → score null (total still counted)', () => {
  const r = parseDartMutantReport(DM_NO_SCORE);
  assert.strictEqual(r.score, null);
  assert.strictEqual(r.total, 1);
  assert.deepStrictEqual(r.byFile, {});
});

test('parseDartMutantReport: files present but 0 mutants → total 0, score read', () => {
  const r = parseDartMutantReport(DM_EMPTY);
  assert.strictEqual(r.score, 0);
  assert.strictEqual(r.total, 0);
  assert.deepStrictEqual(r.byFile, {});
});

test('g6Glob: single root, multi root, and default', () => {
  assert.strictEqual(g6Glob({ roots: ['lib'] }), 'lib/**/*.dart');
  assert.strictEqual(g6Glob({ roots: ['lib', 'src'] }), '{lib,src}/**/*.dart');
  assert.strictEqual(g6Glob({}), 'lib/**/*.dart');
  assert.strictEqual(g6Glob({ roots: [] }), 'lib/**/*.dart');
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd plugins/my-skills/skills/clean-code-gates && npm test`
Expected: FAIL — `parseDartMutantReport is not a function` / `g6Glob is not a function` (they are `undefined` in the destructure from `_internals`).

- [ ] **Step 3: Implement the two helpers**

In `src/adapters/dart-flutter.cjs`, immediately above the `// ---- G6: mutation (mutation_test) ----` comment (line ~425), insert:

```js
// ---- G6: mutation (dart_mutant) ----------------------------------------

/** Parse dart_mutant's Stryker JSON into { score, total, byFile: { name: [lines] } }. */
function parseDartMutantReport(json) {
  let report;
  try {
    report = JSON.parse(json);
  } catch {
    return null;
  }
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

/**
 * dart_mutant takes a single `--glob` wildcard, not a file list, so map the
 * stack roots to a glob that is a *superset* of the scope. The gate runner
 * post-filters survivor findings to the in-scope `files`, so over-mutating is
 * only a speed cost, never a correctness one. (Score-vs-scope caveat: for
 * narrow scopes the per-file survivor findings stay correctly scoped, but the
 * pass/fail score is computed over the whole glob — correct for the `project`
 * scope, which is the real G6 use.)
 */
function g6Glob(stackCfg) {
  const roots = stackCfg.roots && stackCfg.roots.length ? stackCfg.roots : ['lib'];
  const body = roots.length === 1 ? roots[0] : `{${roots.join(',')}}`;
  return `${body}/**/*.dart`;
}
```

Then add both names to the `_internals` export object (~line 771), e.g. after `parseAnalyzeLine,`:

```js
    parseAnalyzeLine,
    parseDartMutantReport,
    g6Glob,
    parseMutationReport,
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd plugins/my-skills/skills/clean-code-gates && npm test`
Expected: PASS — all new `parseDartMutantReport` + `g6Glob` tests green; existing tests (including `parseMutationReport`) still green.

- [ ] **Step 5: Commit**

```bash
git add plugins/my-skills/skills/clean-code-gates/src/adapters/dart-flutter.cjs plugins/my-skills/skills/clean-code-gates/__tests__/dart-flutter.test.cjs
git commit -m "feat(g6): add dart_mutant JSON parser and root-glob helper"
```

---

### Task 2: Rewrite `runG6`, delete `mutation_test` code, flip config

Swaps the engine. `runG6` now spawns `dart_mutant` against the live tree; the worktree/XML/in-place-mutation machinery is deleted; `GATE_META.G6` and `defaults.cjs` advertise `dart_mutant`; the now-dead `parseMutationReport` and its tests are removed. This is one reviewable unit — you cannot delete `parseMutationReport` without also removing its tests and import, and the new `runG6` depends on the helpers from Task 1.

**Files:**
- Modify: `plugins/my-skills/skills/clean-code-gates/src/adapters/dart-flutter.cjs` (`GATE_META.G6` ~line 41; replace `runG6` and delete `escapeXml`/`writeMutationConfig`/`parseMutationReport`/`git`/`gitRoot`/`setupWorktree` ~lines 425–633; drop `parseMutationReport` from `_internals` ~line 771; rewrite the G6 JSDoc bullet ~lines 24–29)
- Modify: `plugins/my-skills/skills/clean-code-gates/defaults.cjs` (line ~39)
- Test: `plugins/my-skills/skills/clean-code-gates/__tests__/dart-flutter.test.cjs` (remove two `parseMutationReport` tests + the name from the import)

**Interfaces:**
- Consumes: `parseDartMutantReport`, `g6Glob` (Task 1); existing `resolveFlutter(root) => { cmd, pre } | null`, `commandExists(cmd) => bool`, `isExempt(rel, stackCfg, gate) => bool`, `gateResult(gate, status, extra)`, `missingTool(gate, stackCfg)`, `DART_FILE_RE`.
- Produces: `runG6(files, stackCfg, io) => gateResult` with `status ∈ {pass, fail, error, missing_tool}`. No worktree/`git`/`gitRoot`/`setupWorktree`/`escapeXml`/`writeMutationConfig`/`parseMutationReport` symbols remain in the module.

- [ ] **Step 1: Update the failing tests (remove dead `parseMutationReport` cases)**

In `__tests__/dart-flutter.test.cjs`, remove `parseMutationReport` from the line-4 destructure:

```js
const { parseLcov, fileMetrics, coverageFindings, parseDclJson, g2Findings, parseAnalyzeLine, parseDartMutantReport, g6Glob, resolveImport, buildImportGraph, findCycles } = adapter._internals;
```

Then delete these two now-obsolete test blocks entirely:

```js
test('parseMutationReport extracts success verdict + undetected mutation lines', () => {
  // ... (the whole block, lines ~94-109)
});

test('parseMutationReport reads success=true', () => {
  assert.strictEqual(parseMutationReport('<result rating="A" success="true"/>').success, true);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd plugins/my-skills/skills/clean-code-gates && npm test`
Expected: FAIL — the suite still imports/exports `parseMutationReport` from `_internals` (defined in the adapter), but with the tests removed the failure to expect here is that the *adapter still compiles and other suites pass*; the real red comes next once we delete the function while `_internals` still lists it. If green, that is also acceptable — proceed; the deletion in Step 3 is the substantive change.

- [ ] **Step 3: Rewrite the adapter**

In `src/adapters/dart-flutter.cjs`:

**(3a)** Change `GATE_META.G6` (line ~41) from:

```js
  G6: { name: 'mutation', tool: 'mutation_test' },
```

to:

```js
  G6: { name: 'mutation', tool: 'dart_mutant' },
```

**(3b)** Replace the G6 JSDoc bullet in the top-of-file doc comment (lines ~24–29) from:

```js
 *  - G6 (mutation): runs `mutation_test` over the scoped source files with the
 *    project's `flutter test` as the kill command and the gate's mutationScore
 *    as the failure threshold. Parses the XML report's `<result success>` for
 *    the verdict and lists surviving (undetected) mutations as findings. SLOW
 *    — runs the full test suite once per mutant; skip with `--skip G6`. Needs
 *    mutation_test as a project dev_dependency.
```

to:

```js
 *  - G6 (mutation): runs the `dart_mutant` CLI over the root glob with the
 *    project's `flutter test` as the kill command and the gate's mutationScore
 *    as the failure threshold. dart_mutant sandboxes its own mutations (no
 *    in-place edits), so G6 runs against the live tree — no git worktree. Reads
 *    the top-level `mutationScore` float for the verdict and lists surviving
 *    (Survived/NoCoverage) mutants as findings. SLOW — skip with `--skip G6`.
 *    Needs the `dart_mutant` binary on PATH (e.g. `brew install dart_mutant`).
```

**(3c)** Delete the entire `// ---- G6: mutation (mutation_test) ----` section — the functions `escapeXml`, `writeMutationConfig`, `parseMutationReport`, `git`, `gitRoot`, `setupWorktree`, and the old `runG6` (lines ~425–633) — and replace the whole block (everything between the `parseDartMutantReport`/`g6Glob` helpers added in Task 1 and the `// ---- G7:` section header) with this single new `runG6`:

```js
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
    '--glob', g6Glob(stackCfg),
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
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }

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

**(3d)** Remove `parseMutationReport` from the `_internals` export object (~line 771). The block added in Task 1 had `parseMutationReport,` after `g6Glob,`; delete that one line so only the live helpers remain:

```js
    parseAnalyzeLine,
    parseDartMutantReport,
    g6Glob,
    resolveImport,
```

- [ ] **Step 4: Flip the default config**

In `defaults.cjs`, change the dart-flutter G6 line (~line 39) from:

```js
      G6: { tool: 'mutation_test', thresholds: THRESHOLDS.G6 },
```

to:

```js
      G6: { tool: 'dart_mutant', thresholds: THRESHOLDS.G6 },
```

- [ ] **Step 5: Verify no dead references remain**

Run: `cd plugins/my-skills/skills/clean-code-gates && grep -rn 'mutation_test\|setupWorktree\|writeMutationConfig\|parseMutationReport\|escapeXml\|gitRoot' src defaults.cjs __tests__`
Expected: no matches in `src/` or `defaults.cjs` or `__tests__/`. (A match anywhere here means a dangling reference — fix before continuing.) Note: `git`/`gitRoot` were G6-only; G7 does not use them, so their deletion is safe.

- [ ] **Step 6: Run the full suite**

Run: `cd plugins/my-skills/skills/clean-code-gates && npm test`
Expected: PASS — all suites green, no `parseMutationReport` references, `parseDartMutantReport`/`g6Glob` tests green.

- [ ] **Step 7: Manual integration smoke (optional — requires a Flutter project + `dart_mutant`)**

Skip if no Flutter project with `dart_mutant` installed is available; the unit tests above are the gating check. Otherwise, inside a Flutter app dir:

Run: `node /Volumes/ssd/Developer/my-skills/plugins/my-skills/skills/clean-code-gates/bin/gates.cjs --scope files:lib/<small-file>.dart --gates G6 --out -`
Expected: JSON gate output with `tool: "dart_mutant"`; `status` is `pass`/`fail`/`error`/`missing_tool` (never a crash); and **no** `mutation-reports/` dir, no `.ccg-*` litter, and no git worktree left behind (`git worktree list` shows only the main tree).

- [ ] **Step 8: Commit**

```bash
git add plugins/my-skills/skills/clean-code-gates/src/adapters/dart-flutter.cjs plugins/my-skills/skills/clean-code-gates/defaults.cjs plugins/my-skills/skills/clean-code-gates/__tests__/dart-flutter.test.cjs
git commit -m "feat(g6): run dart_mutant for dart-flutter mutation gate, drop mutation_test worktree path"
```

---

### Task 3: Docs — point the G6 tooling note at `dart_mutant`

The adapter JSDoc was updated in Task 2; this task fixes the user-facing README so the dart-flutter mutation engine reads as `dart_mutant`, and adds the install/pin note the spec calls for.

**Files:**
- Modify: `plugins/my-skills/skills/clean-code-gates/README.md`

**Interfaces:**
- Consumes: nothing. Produces: nothing (docs only).

- [ ] **Step 1: Read the current README G6 lines**

Run: `cd plugins/my-skills/skills/clean-code-gates && grep -n 'G6\|mutation\|dart_mutant\|stryker' README.md`
Expected: shows line ~41 (`| G6 | mutation | Mutation score ≥ 70 % | ... |`) and line ~178 (the dart-flutter "Pending Plan 3" note already naming `dart_mutant`).

- [ ] **Step 2: Add the dart-flutter G6 install/pin note**

The spec requires documenting that `dart_mutant` is an external CLI binary (no pubspec entry), that CI must install it (`brew install dart_mutant` or the project's documented method), and that the pre-1.0 version must be pinned. Append a short note in the README's dart-flutter / G6 area. Locate the line (from Step 1, ~line 178):

```markdown
- **Pending Plan 3**: dart-flutter adapters (flutter/dart_code_linter/dart_mutant/import_lint).
```

Immediately after it, add:

```markdown
- **G6 (dart-flutter) requires the `dart_mutant` CLI on PATH** — it is a standalone binary, not a pub dependency, so there is no `pubspec.yaml` entry. Install it in CI (`brew install dart_mutant`, or the project's documented method) and **pin the version** (it is pre-1.0). The gate detects it via a PATH check; when absent, G6 returns `missing_tool`. Git-ignore any stray `mutation-reports/` and `.dart_mutant_cache` artifacts.
```

- [ ] **Step 3: Verify the docs build / render sanity**

Run: `cd plugins/my-skills/skills/clean-code-gates && grep -n 'dart_mutant' README.md`
Expected: at least two matches, including the new install/pin note. No remaining claim that dart-flutter G6 uses `mutation_test`.

- [ ] **Step 4: Commit**

```bash
git add plugins/my-skills/skills/clean-code-gates/README.md
git commit -m "docs(g6): note dart_mutant CLI install + version pin for dart-flutter mutation gate"
```

---

## Self-Review

**1. Spec coverage:**
- Rewrite `runG6` to invoke `dart_mutant` + parse Stryker JSON → Task 2 Step 3c.
- `parseDartMutantReport` (top-level score, case-insensitive status, Survived/NoCoverage survivors) → Task 1.
- Delete `escapeXml`/`writeMutationConfig`/`parseMutationReport`/`setupWorktree` (+ `git`/`gitRoot`, G6-only) → Task 2 Step 3c, verified Step 5.
- `defaults.cjs` G6 tool rename → Task 2 Step 4.
- `GATE_META.G6` tool rename → Task 2 Step 3a.
- Detection via `commandExists('dart_mutant')` not `hasPkg` → Task 2 Step 3 (`runG6` body).
- `g6Glob` root-glob + post-filter, score-vs-scope caveat → Task 1 (function + JSDoc).
- Status matrix (pass/fail/error/missing_tool, 0-mutants→pass) → Task 2 `runG6` + Task 1 parser tests (cases a–e).
- Temp `--output` dir, no `mutation-reports/` litter, no worktree → Task 2 Step 3 (`mkdtempSync`+`rmSync`), Step 7 smoke.
- Test cases a–e + fixtures → Task 1 Step 1 (inlined as JSON strings, matching the existing suite's inline-fixture style rather than separate `fixtures/` files — DRY with how `parseMutationReport` was tested). Regression: old XML tests removed → Task 2 Step 1.
- Docs / CI install + version pin → Task 3.
- Schema `report.schema.json` — spec says *no* change needed (`mutation/score` + `mutation/survived` reused). No task — correct.
- Project `.cleancode-gates.json` (toodls) tool string — that file lives in the **toodls** repo, not this one; out of scope for edits here. The note is captured in Task 3's README install guidance.

**2. Placeholder scan:** No `TBD`/"add error handling"/"similar to Task N". All code blocks complete; the one `<small-file>.dart` placeholder is a user-supplied integration-smoke argument, not plan code.

**3. Type consistency:** `parseDartMutantReport` returns `{ score, total, byFile }` consistently in Task 1 (definition + tests) and Task 2 (`runG6` reads `parsed.score`/`parsed.total`/`parsed.byFile`). `g6Glob(stackCfg)` signature matches between definition, tests, and the `runG6` call site. `_internals` export names (`parseDartMutantReport`, `g6Glob`) match the test import in both tasks. `missingTool`/`gateResult`/`resolveFlutter`/`commandExists`/`isExempt`/`DART_FILE_RE` all reused with their existing signatures.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-06-17-g6-adapter-dart-mutant-rewrite.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
