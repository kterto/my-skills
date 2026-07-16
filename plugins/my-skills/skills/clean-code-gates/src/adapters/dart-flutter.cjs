'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { G1_EXEMPTIONS } = require('../../defaults.cjs');
const { toPosix } = require('../scope.cjs');

/**
 * dart-flutter adapter.
 *  - G1 (coverage): runs `flutter test --coverage` (via FVM when the project
 *    pins it) and parses the emitted lcov.info. Dart lcov reports line and
 *    function hits per file; the config's `statements` threshold maps to line
 *    coverage and `branches` is only checked when the report carries branch
 *    data (Dart lcov usually omits it, so it is skipped rather than failed).
 *  - G2 (complexity/nesting/params/length): runs `dart_code_linter:metrics`
 *    with the gate thresholds passed as CLI flags, then compares each raw
 *    metric value against its threshold (DCL's own `level` bands don't match
 *    the gate limits, so we never trust them). Needs dart_code_linter as a
 *    project dev_dependency.
 *  - G4 (naming): runs `dart analyze --format=machine` and keeps the canonical
 *    Dart naming lints. Uses the SDK analyzer (via FVM) — no extra install —
 *    so enablement follows the project's lint set (flutter_lints provides the
 *    naming lints by default).
 *  - G6 (mutation): runs the external `dart_mutant` binary over the stack root
 *    glob with the project's `flutter test` as the kill command and the gate's
 *    mutationScore as the `--threshold`. Reads the pass/fail verdict from the
 *    Stryker JSON report's top-level `mutationScore` and lists surviving mutants
 *    (`status` ∈ {Survived, NoCoverage}) as findings. dart_mutant sandboxes its
 *    own mutations (no in-place edits, no worktree, no `pub get`); the report is
 *    written to a temp dir and removed after parsing. Needs `dart_mutant` on
 *    PATH — it is an external CLI, not a pub dependency.
 *  - G7 (dependency-structure): built-in, zero-tool circular-import detector.
 *    Parses Dart imports across the source roots (resolving `package:<self>/`
 *    and relative imports to files) and reports any import cycle — the Dart
 *    analogue of dependency-cruiser's no-circular rule.
 * Unsupported gates fall through to run.cjs's missing_tool handling.
 */

const GATE_META = {
  G1: { name: 'coverage', tool: 'flutter' },
  G2: { name: 'cyclomatic-complexity', tool: 'dart_code_linter' },
  G4: { name: 'naming', tool: 'dart analyze' },
  G6: { name: 'mutation', tool: 'dart_mutant' },
  G7: { name: 'dependency-structure', tool: 'builtin' },
};

const G2_THRESHOLD_FLAG = {
  'cyclomatic-complexity': 'cyclomatic-complexity',
  'maximum-nesting-level': 'maximum-nesting-level',
  'number-of-parameters': 'number-of-parameters',
  'source-lines-of-code': 'source-lines-of-code',
};
const G2_DEFAULTS = {
  'cyclomatic-complexity': 8,
  'maximum-nesting-level': 2,
  'number-of-parameters': 4,
  'source-lines-of-code': 30,
};
const G4_NAMING_CODES = new Set([
  'CAMEL_CASE_TYPES',
  'CAMEL_CASE_EXTENSIONS',
  'CONSTANT_IDENTIFIER_NAMES',
  'NON_CONSTANT_IDENTIFIER_NAMES',
  'LIBRARY_NAMES',
  'LIBRARY_PREFIXES',
  'FILE_NAMES',
  'PACKAGE_NAMES',
]);

const TEST_FILE_RE = /_test\.dart$/;
const DART_FILE_RE = /\.dart$/;

function globToRe(glob) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0')
    .replace(/\*/g, '[^/]*')
    .replace(/\0/g, '.*');
  return new RegExp('^' + re + '$');
}

function gateResult(gate, status, extra = {}) {
  const meta = GATE_META[gate];
  return {
    gate,
    name: meta.name,
    stack: 'dart-flutter',
    status,
    tool: meta.tool,
    findings: [],
    ...extra,
  };
}

function missingTool(gate, stackCfg) {
  const meta = GATE_META[gate] || { name: gate, tool: 'unknown' };
  const tool = (stackCfg.gates[gate] || {}).tool || meta.tool;
  return {
    gate,
    name: meta.name,
    stack: 'dart-flutter',
    status: 'missing_tool',
    tool,
    findings: [],
    installHint: `dart-flutter ${gate} needs ${tool} on PATH — install Flutter (or FVM) so \`${tool}\` resolves`,
  };
}

function isExempt(rel, stackCfg, gate) {
  if (TEST_FILE_RE.test(rel)) return true;
  const perGate = ((stackCfg.gates && stackCfg.gates[gate]) || {}).exempt || [];
  const extra = gate === 'G1' ? G1_EXEMPTIONS : [];
  const globs = [...(stackCfg.exclude || []), ...extra, ...perGate];
  return globs.some((g) => globToRe(g).test(rel));
}

// ---- G1: coverage (flutter test --coverage) ----------------------------

/** Probe a command on PATH without a shell. */
function commandExists(cmd) {
  try {
    execFileSync(cmd, ['--version'], { stdio: 'ignore', timeout: 120000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Locate the Flutter package (the directory holding `pubspec.yaml`).
 *
 * In a monorepo the package is not the repo root — `flutter test` must run from
 * e.g. `apps/mobile`, and its lcov paths are relative to that directory, not to
 * the root. Derived by walking up from the configured roots; falls back to the
 * root for a single-package repo. Returns a path relative to `root` ('' = root).
 */
function resolvePackageDir(root, stackCfg) {
  const explicit = (stackCfg || {}).packageDir;
  if (explicit) return explicit;
  for (const r of (stackCfg || {}).roots || []) {
    let dir = r;
    while (dir && dir !== '.' && dir !== path.sep) {
      if (fs.existsSync(path.join(root, dir, 'pubspec.yaml'))) return dir;
      const parent = path.dirname(dir);
      if (parent === dir) break;
      dir = parent;
    }
  }
  return '';
}

/**
 * Resolve how to invoke Flutter. Prefer FVM when the project pins a version
 * (`.fvmrc`) and `fvm` is available, so the gate runs the same SDK as the app.
 * Returns `{ cmd, pre }` where the full argv is `[...pre, ...flutterArgs]`.
 */
function resolveFlutter(root) {
  const pinned = fs.existsSync(path.join(root, '.fvmrc'));
  if (pinned && commandExists('fvm')) return { cmd: 'fvm', pre: ['flutter'] };
  if (commandExists('flutter')) return { cmd: 'flutter', pre: [] };
  if (commandExists('fvm')) return { cmd: 'fvm', pre: ['flutter'] };
  return null;
}

function parseLcov(text) {
  const files = {};
  let cur = null;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line.startsWith('SF:')) {
      cur = { lf: 0, lh: 0, fnf: 0, fnh: 0, brf: 0, brh: 0 };
      files[line.slice(3)] = cur;
    } else if (!cur) {
      continue;
    } else if (line.startsWith('LF:')) cur.lf = Number(line.slice(3)) || 0;
    else if (line.startsWith('LH:')) cur.lh = Number(line.slice(3)) || 0;
    else if (line.startsWith('FNF:')) cur.fnf = Number(line.slice(4)) || 0;
    else if (line.startsWith('FNH:')) cur.fnh = Number(line.slice(4)) || 0;
    else if (line.startsWith('BRF:')) cur.brf = Number(line.slice(4)) || 0;
    else if (line.startsWith('BRH:')) cur.brh = Number(line.slice(4)) || 0;
    else if (line === 'end_of_record') cur = null;
  }
  return files;
}

function pct(hit, found) {
  return found ? Number(((100 * hit) / found).toFixed(2)) : 100;
}

function fileMetrics(entry) {
  return {
    statements: pct(entry.lh, entry.lf),
    lines: pct(entry.lh, entry.lf),
    functions: pct(entry.fnh, entry.fnf),
    branches: entry.brf > 0 ? pct(entry.brh, entry.brf) : null,
  };
}

function coverageFindings(rel, entry, thresholds) {
  const metrics = fileMetrics(entry);
  const findings = [];
  for (const metric of Object.keys(thresholds)) {
    const limit = thresholds[metric];
    const value = metrics[metric];
    if (limit == null || value == null) continue;
    if (value >= limit) continue;
    findings.push({
      id: `G1-${rel}:${metric}`,
      severity: 'blocker',
      file: rel,
      line: 1,
      rule: `coverage/${metric}`,
      message: `${metric} coverage ${value}% < ${limit}%`,
      metric: { value, limit, unit: 'percent' },
      fixHint: `Add tests covering ${rel} to reach ${limit}% ${metric}`,
    });
  }
  return findings;
}

/**
 * Map an lcov `SF:` key to a repo-relative path.
 *
 * `flutter test --coverage` emits paths relative to the package it ran in
 * (`lib/src/x.dart`), while scoped files are repo-relative
 * (`apps/mobile/lib/src/x.dart`). Without re-rooting, no key ever matches a
 * scoped file, every lookup misses, and the gate reports pass having measured
 * nothing.
 */
function lcovKeyToRepoRel(key, root, pkgDir) {
  const rel = path.isAbsolute(key) ? path.relative(root, key) : pkgDir ? path.join(pkgDir, key) : key;
  return toPosix(rel);
}

function runCoverage(flutter, root) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-dart-cov-'));
  const lcovPath = path.join(outDir, 'lcov.info');
  let failed = false;
  try {
    execFileSync(
      flutter.cmd,
      [...flutter.pre, 'test', '--coverage', `--coverage-path=${lcovPath}`],
      {
        cwd: root,
        stdio: ['ignore', 'ignore', 'ignore'],
        maxBuffer: 64 * 1024 * 1024,
      },
    );
  } catch {
    failed = true;
  }
  if (!fs.existsSync(lcovPath)) return { coverage: null, failed };
  return { coverage: parseLcov(fs.readFileSync(lcovPath, 'utf8')), failed };
}

function runG1(files, stackCfg, io) {
  const pkgDir = resolvePackageDir(io.root, stackCfg);
  const pkgRoot = path.join(io.root, pkgDir);
  const flutter = resolveFlutter(pkgRoot);
  if (!flutter) return missingTool('G1', stackCfg);

  const thresholds = (stackCfg.gates.G1 || {}).thresholds || {
    statements: 85,
    branches: 80,
  };
  const command = 'flutter test --coverage';
  const { coverage, failed } = runCoverage(flutter, pkgRoot);
  if (!coverage) return gateResult('G1', 'error', { command, thresholds });

  const byRel = new Map();
  for (const key of Object.keys(coverage)) {
    byRel.set(lcovKeyToRepoRel(key, io.root, pkgDir), coverage[key]);
  }

  const findings = [];
  for (const rel of files) {
    if (!DART_FILE_RE.test(rel) || isExempt(rel, stackCfg, 'G1')) continue;
    const entry = byRel.get(rel);
    if (!entry) continue;
    findings.push(...coverageFindings(rel, entry, thresholds));
  }

  return gateResult('G1', failed ? 'error' : findings.length ? 'fail' : 'pass', {
    command,
    thresholds,
    findings,
  });
}

// ---- G2: complexity / nesting / params / length (dart_code_linter) ------

/**
 * Resolve how to invoke the Dart CLI, mirroring resolveFlutter. Returns
 * `{ cmd, pre }` where the full argv is `[...pre, ...dartArgs]`.
 */
function resolveDart(root) {
  const pinned = fs.existsSync(path.join(root, '.fvmrc'));
  if (pinned && commandExists('fvm')) return { cmd: 'fvm', pre: ['dart'] };
  if (commandExists('dart')) return { cmd: 'dart', pre: [] };
  if (commandExists('fvm')) return { cmd: 'fvm', pre: ['dart'] };
  return null;
}

/** A pub package is usable only when resolved into the package config. */
function hasPkg(root, name) {
  const cfgPath = path.join(root, '.dart_tool', 'package_config.json');
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    return (cfg.packages || []).some((p) => p.name === name);
  } catch {
    return false;
  }
}

/** Strip the progress-spinner preamble DCL writes before the JSON document. */
function parseDclJson(raw) {
  if (!raw) return null;
  const start = raw.indexOf('{');
  if (start < 0) return null;
  try {
    return JSON.parse(raw.slice(start));
  } catch {
    return null;
  }
}

function g2Findings(record, thresholds) {
  const rel = record.path;
  const findings = [];
  for (const sig of Object.keys(record.functions || {})) {
    const fn = record.functions[sig];
    const line = (fn.codeSpan && fn.codeSpan.start && fn.codeSpan.start.line) || 1;
    for (const m of fn.metrics || []) {
      const limit = thresholds[m.metricsId];
      if (limit == null || m.value <= limit) continue;
      findings.push({
        id: `G2-${rel}:${line}:${m.metricsId}`,
        severity: 'blocker',
        file: rel,
        line,
        rule: m.metricsId,
        message: `${sig} has ${m.metricsId} ${m.value} (max ${limit})`,
        metric: { value: m.value, limit },
        fixHint: `Refactor ${sig} in ${rel} to satisfy ${m.metricsId} (limit ${limit})`,
      });
    }
  }
  return findings;
}

function runG2(files, stackCfg, io) {
  const dart = resolveDart(io.root);
  if (!dart || !hasPkg(io.root, 'dart_code_linter')) return missingTool('G2', stackCfg);

  const thresholds = { ...G2_DEFAULTS, ...((stackCfg.gates.G2 || {}).thresholds || {}) };
  const roots = (
    stackCfg.roots && stackCfg.roots.length ? stackCfg.roots : ['lib']
  ).filter((r) => fs.existsSync(path.join(io.root, r)));
  const command = 'dart run dart_code_linter:metrics analyze --reporter=json';
  if (!roots.length) return gateResult('G2', 'pass', { command, thresholds });

  const flagArgs = [];
  for (const id of Object.keys(thresholds)) {
    if (G2_THRESHOLD_FLAG[id]) flagArgs.push(`--${G2_THRESHOLD_FLAG[id]}=${thresholds[id]}`);
  }
  const excludeGlobs = stackCfg.exclude || [];
  const args = [
    ...dart.pre,
    'run',
    'dart_code_linter:metrics',
    'analyze',
    ...roots,
    '--reporter=json',
    ...flagArgs,
  ];
  if (excludeGlobs.length) args.push(`--exclude={${excludeGlobs.join(',')}}`);

  let raw;
  try {
    raw = execFileSync(dart.cmd, args, {
      cwd: io.root,
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    raw = error.stdout ? error.stdout.toString() : null;
  }
  const report = parseDclJson(raw);
  if (!report) return gateResult('G2', 'error', { command, thresholds });

  const inScope = new Set(
    files.filter((rel) => DART_FILE_RE.test(rel) && !isExempt(rel, stackCfg, 'G2')),
  );
  const findings = [];
  for (const record of report.records || []) {
    const rel = toPosix(
      path.isAbsolute(record.path) ? path.relative(io.root, record.path) : record.path,
    );
    if (!inScope.has(rel)) continue;
    findings.push(...g2Findings({ ...record, path: rel }, thresholds));
  }

  return gateResult('G2', findings.length ? 'fail' : 'pass', {
    command,
    thresholds,
    findings,
  });
}

// ---- G4: naming (dart analyze) -----------------------------------------

/** Parse one `dart analyze --format=machine` line into a finding-ish record. */
function parseAnalyzeLine(line) {
  const parts = line.split('|');
  if (parts.length < 8) return null;
  const [severity, type, code, file, lineNo, , , ...msg] = parts;
  return { severity, type, code, file, line: Number(lineNo) || 1, message: msg.join('|') };
}

function runG4(files, stackCfg, io) {
  const dart = resolveDart(io.root);
  if (!dart) return missingTool('G4', stackCfg);

  const targets = files.filter(
    (rel) => DART_FILE_RE.test(rel) && !isExempt(rel, stackCfg, 'G4'),
  );
  const command = 'dart analyze --format=machine';
  if (!targets.length) return gateResult('G4', 'pass', { command });

  let raw;
  try {
    raw = execFileSync(dart.cmd, [...dart.pre, 'analyze', '--format=machine', ...targets], {
      cwd: io.root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch (error) {
    // `dart analyze` exits non-zero when issues are present; output is on stdout.
    raw = error.stdout != null ? error.stdout.toString() : null;
  }
  if (raw == null) return gateResult('G4', 'error', { command });

  const findings = [];
  for (const line of raw.split('\n')) {
    if (!line.includes('|')) continue;
    const rec = parseAnalyzeLine(line.trim());
    if (!rec || rec.type !== 'LINT' || !G4_NAMING_CODES.has(rec.code)) continue;
    const rel = toPosix(path.isAbsolute(rec.file) ? path.relative(io.root, rec.file) : rec.file);
    findings.push({
      id: `G4-${rel}:${rec.line}:${rec.code}`,
      severity: 'blocker',
      file: rel,
      line: rec.line,
      rule: rec.code.toLowerCase(),
      message: rec.message,
      fixHint: `Rename to match the convention — ${rec.message}`,
    });
  }

  return gateResult('G4', findings.length ? 'fail' : 'pass', { command, findings });
}

// ---- G6: mutation (dart_mutant) ----------------------------------------

/** Parse dart_mutant's Stryker JSON into { score, total, byFile: { name: [lines] } }. */
function parseDartMutantReport(json) {
  let report;
  try {
    report = JSON.parse(json);
  } catch {
    return null;
  }
  // JSON.parse('null'/'42'/'"x"'/'[]') succeeds without throwing; guard so a
  // non-object report becomes error (null), never a property-access crash.
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null;
  const score = typeof report.mutationScore === 'number' ? report.mutationScore : null;
  const SURVIVED = new Set(['survived', 'nocoverage']);
  const byFile = {};
  let total = 0;
  for (const [name, fobj] of Object.entries(report.files || {})) {
    const lines = [];
    for (const m of fobj.mutants || []) {
      total += 1;
      // Normalize away casing and the underscore variant (No_Coverage / NoCoverage).
      const status = String(m.status || '').toLowerCase().replace(/_/g, '');
      if (!SURVIVED.has(status)) continue;
      const line = m.location && m.location.start && m.location.start.line;
      if (line) lines.push(line);
    }
    if (lines.length) byFile[name] = lines;
  }
  return { score, total, byFile };
}

/**
 * Map the stack roots (default ['lib']) to the single `--glob` wildcard
 * dart_mutant mutates. dart_mutant takes one wildcard glob (an exact file path
 * matches nothing), so multiple roots collapse into a brace group. This glob is
 * a superset of the scope; survivor findings are still post-filtered to the
 * in-scope targets, and the score-vs-scope caveat below applies for narrow scopes.
 */
function g6Glob(stackCfg) {
  const roots = stackCfg.roots && stackCfg.roots.length ? stackCfg.roots : ['lib'];
  const rootGlob = roots.length === 1 ? roots[0] : `{${roots.join(',')}}`;
  return `${rootGlob}/**/*.dart`;
}

/**
 * Turn a parsed dart_mutant report + the in-scope targets into a gate result.
 *
 * Verdict matrix:
 *  - no in-scope targets            → pass (caller skips invoking dart_mutant)
 *  - report absent / no score       → error
 *  - files present but 0 mutants     → pass (nothing to verify, not a failure;
 *                                       dart_mutant reports score 0.0 here, so we
 *                                       guard on the mutant count, not the score)
 *  - score >= threshold             → pass, no findings
 *  - score <  threshold             → fail: one mutation/score blocker plus one
 *                                       mutation/survived warning per surviving
 *                                       mutant (relativized + exempt-filtered)
 *
 * Score-vs-scope caveat: dart_mutant computes mutationScore over everything its
 * --glob mutated (the whole root). For --scope project (G6's real use) that is
 * exactly right; for narrow scopes the survivor findings are still correctly
 * scoped, but the pass/fail score is root-wide — it is never presented as a
 * per-file score.
 */
function g6Verdict(parsed, { targets, threshold, command, stackCfg, io }) {
  const thresholds = { mutationScore: threshold };
  if (!targets.length) return gateResult('G6', 'pass', { command, thresholds });
  if (!parsed || parsed.score == null) return gateResult('G6', 'error', { command, thresholds });
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
    const rel = toPosix(path.isAbsolute(name) ? path.relative(io.root, name) : name);
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

/**
 * Invoke dart_mutant against the live tree and return its Stryker JSON report as
 * a string, or null when no report was written. dart_mutant sandboxes its own
 * mutations (no in-place edits) and writes to a temp --output dir that is removed
 * afterwards, so a run leaves no mutation-reports/, worktree, or pub-get litter
 * on the target tree. A non-zero exit (dart_mutant exits non-zero when the score
 * is below --threshold) is tolerated; the verdict keys off the report file.
 */
function runMutant(flutter, stackCfg, io, threshold) {
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
    // Non-zero exit means the quality gate failed; the report is still written.
  }

  const reportPath = path.join(outDir, 'mutation-report.json');
  let json = null;
  if (fs.existsSync(reportPath)) json = fs.readFileSync(reportPath, 'utf8');
  try {
    fs.rmSync(outDir, { recursive: true, force: true });
  } catch {
    /* ignore */
  }
  return json;
}

function runG6(files, stackCfg, io, deps = {}) {
  const resolveF = deps.resolveFlutter || resolveFlutter;
  const hasCmd = deps.commandExists || commandExists;
  const runner = deps.runMutant || runMutant;

  const flutter = resolveF(io.root);
  if (!flutter || !hasCmd('dart_mutant')) return missingTool('G6', stackCfg);

  const threshold = ((stackCfg.gates.G6 || {}).thresholds || {}).mutationScore ?? 70;
  const command = 'dart_mutant --json --quiet --ai none';
  const targets = files.filter(
    (rel) => DART_FILE_RE.test(rel) && !isExempt(rel, stackCfg, 'G6'),
  );
  const opts = { targets, threshold, command, stackCfg, io };
  if (!targets.length) return g6Verdict(null, opts);

  const json = runner(flutter, stackCfg, io, threshold);
  const parsed = json == null ? null : parseDartMutantReport(json);
  return g6Verdict(parsed, opts);
}

// ---- G7: dependency-structure (built-in circular-import detector) -------

const IMPORT_RE = /^\s*(?:import|export)\s+['"]([^'"]+)['"]/gm;

function packageName(root) {
  try {
    const m = /^name:\s*(\S+)/m.exec(fs.readFileSync(path.join(root, 'pubspec.yaml'), 'utf8'));
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** Resolve an import URI from `fromRel` to a repo-relative dart file, or null. */
function resolveImport(uri, fromRel, pkg) {
  let target;
  if (pkg && uri.startsWith(`package:${pkg}/`)) {
    target = path.join('lib', uri.slice(`package:${pkg}/`.length));
  } else if (!uri.includes(':')) {
    target = path.join(path.dirname(fromRel), uri);
  } else {
    return null; // dart:, package:<other>, etc.
  }
  return target.split(path.sep).join('/');
}

function buildImportGraph(files, root, pkg) {
  const graph = new Map();
  const set = new Set(files);
  for (const rel of files) {
    const deps = new Set();
    let content;
    try {
      content = fs.readFileSync(path.join(root, rel), 'utf8');
    } catch {
      content = '';
    }
    let m;
    IMPORT_RE.lastIndex = 0;
    while ((m = IMPORT_RE.exec(content))) {
      const dep = resolveImport(m[1], rel, pkg);
      if (dep && dep !== rel && set.has(dep)) deps.add(dep);
    }
    graph.set(rel, deps);
  }
  return graph;
}

/** Return one representative cycle per strongly cyclic entry (deduped). */
function findCycles(graph) {
  const cycles = [];
  const seen = new Set();
  const state = new Map(); // 0 visiting, 1 done
  function dfs(node, stack) {
    state.set(node, 0);
    stack.push(node);
    for (const next of graph.get(node) || []) {
      if (state.get(next) === 0) {
        const at = stack.indexOf(next);
        const cycle = stack.slice(at).concat(next);
        const key = [...cycle].sort().join('|');
        if (!seen.has(key)) {
          seen.add(key);
          cycles.push(cycle);
        }
      } else if (state.get(next) === undefined) {
        dfs(next, stack);
      }
    }
    stack.pop();
    state.set(node, 1);
  }
  for (const node of graph.keys()) if (state.get(node) === undefined) dfs(node, []);
  return cycles;
}

function listDartFiles(root, roots, excludeGlobs) {
  const out = [];
  const isExcluded = (rel) =>
    TEST_FILE_RE.test(rel) || excludeGlobs.some((g) => globToRe(g).test(rel));
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const abs = path.join(dir, e.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (e.isDirectory()) walk(abs);
      else if (DART_FILE_RE.test(e.name) && !isExcluded(rel)) out.push(rel);
    }
  };
  for (const r of roots) walk(path.join(root, r));
  return out;
}

function runG7(_files, stackCfg, io) {
  const command = 'builtin circular-import scan';
  const roots = (
    stackCfg.roots && stackCfg.roots.length ? stackCfg.roots : ['lib']
  ).filter((r) => fs.existsSync(path.join(io.root, r)));
  if (!roots.length) return gateResult('G7', 'pass', { command });

  const pkg = packageName(io.root);
  const dartFiles = listDartFiles(io.root, roots, stackCfg.exclude || []);
  const graph = buildImportGraph(dartFiles, io.root, pkg);
  const cycles = findCycles(graph);

  const findings = cycles.map((cycle) => ({
    id: `G7-${[...cycle].sort().join('|')}`,
    severity: 'blocker',
    file: cycle[0],
    line: 1,
    rule: 'no-circular',
    message: `circular dependency: ${cycle.join(' → ')}`,
    fixHint: 'Break the import cycle — extract shared code or invert the dependency',
  }));

  return gateResult('G7', findings.length ? 'fail' : 'pass', { command, findings });
}

module.exports = {
  resolvePackageDir,
  lcovKeyToRepoRel,
  supports(gate) {
    return ['G1', 'G2', 'G4', 'G6', 'G7'].includes(gate);
  },
  run(gate, files, stackCfg, io) {
    if (gate === 'G1') return runG1(files, stackCfg, io);
    if (gate === 'G2') return runG2(files, stackCfg, io);
    if (gate === 'G4') return runG4(files, stackCfg, io);
    if (gate === 'G6') return runG6(files, stackCfg, io);
    if (gate === 'G7') return runG7(files, stackCfg, io);
    return missingTool(gate, stackCfg);
  },
  // exported for unit tests
  _internals: {
    parseLcov,
    fileMetrics,
    coverageFindings,
    parseDclJson,
    g2Findings,
    parseAnalyzeLine,
    parseDartMutantReport,
    g6Glob,
    g6Verdict,
    runG6,
    resolveImport,
    buildImportGraph,
    findCycles,
  },
};
