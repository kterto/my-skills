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
 *  - G6 (mutation): runs the `mutation_test` pub package by default, over
 *    exactly the in-scope files, via a generated config that also carries the
 *    project's `flutter test` as the kill command. The score comes from its
 *    junit report — `<testsuite tests= failures=>` sums to total/undetected and
 *    each failing `<testcase>` names its file and line — because junit is the
 *    only mutation_test format carrying both halves. `coverage/lcov.info` is
 *    passed with `-c` when present, so only covered statements are mutated.
 *    `gates.G6.tool: "dart_mutant"` selects the external CLI instead, scored
 *    from a Stryker JSON report over its whole --glob. Either way the threshold
 *    comparison is ours against .cleancode-gates.json; the tool's own quality
 *    gate and exit code are never read. Reports go to a temp dir that is removed
 *    after parsing, so no report directory, worktree or `pub get` litter is left.
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
  G6: { name: 'mutation', tool: 'mutation_test' },
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

/**
 * Install advice per tool. G6's two tools install in different ways — a pub
 * global package versus a standalone CLI — so the generic "install Flutter"
 * line is wrong for both and would send a reader down the wrong path.
 */
function g6InstallHint(gate, tool) {
  if (tool === 'mutation_test') {
    return `dart-flutter ${gate} needs the mutation_test package — run \`dart pub global activate mutation_test\` (or install the dart_mutant CLI, which ${gate} falls back to)`;
  }
  if (tool === 'dart_mutant') {
    return `dart-flutter ${gate} needs the dart_mutant CLI on PATH — e.g. \`brew install dart_mutant\``;
  }
  return `dart-flutter ${gate} needs ${tool} on PATH — install Flutter (or FVM) so \`${tool}\` resolves`;
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
    installHint: g6InstallHint(gate, tool),
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

/**
 * A scoped source file with no entry in the lcov report was never measured by
 * `flutter test --coverage`. Skipping it reports the gate as pass having scored
 * nothing, so it is scored as 0 % against every threshold instead — same finding
 * shape, same vocabulary, no new exemption mechanism. Files that are not Dart
 * source are genuinely unmeasurable and stay unscored.
 */
const ZERO_LCOV_ENTRY = { lh: 0, lf: 1, fnh: 0, fnf: 1, brh: 0, brf: 1 };

function fileCoverageFindings(rel, entry, thresholds, stackCfg) {
  if (!DART_FILE_RE.test(rel)) return [];
  if (isExempt(rel, stackCfg, 'G1')) return [];
  if (entry) return coverageFindings(rel, entry, thresholds);
  return coverageFindings(rel, ZERO_LCOV_ENTRY, thresholds);
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
    findings.push(...fileCoverageFindings(rel, byRel.get(rel), thresholds, stackCfg));
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

// ---- G6: mutation (mutation_test by default; dart_mutant opt-in) --------

/**
 * mutation_test's junit report, walked as elements rather than paired by
 * pattern, into { score, measuredScore, total, measured, counts, byFile,
 * byStatus } — the same shape parseDartMutantReport returns, so g6Verdict
 * stays tool-agnostic.
 *
 * Reading `xunit_report.dart` settles what the document means. Per suite,
 * `tests=` is mutationCount, `failures=` is undetectedCount and `errors=` is
 * blockedCount — and blockedCount is TIMEOUT plus NOT-COVERED summed together,
 * with no attribute anywhere separating them. So the suite attributes cannot
 * produce a score on their own, and the earlier `(tests - failures) / tests`
 * counted every mutant that never ran as a mutant the tests killed.
 *
 * The per-`<testcase>` elements carry the four outcomes individually, and they
 * are what we count. A DETECTED mutant is written with no child element, i.e.
 * self-closing; UNDETECTED carries `<failure type="undetected">`; TIMEOUT and
 * NOT-COVERED carry `<error>` with distinguishing `type` text. Detection is
 * therefore inferred from the ABSENCE of a child, which is only sound if the
 * element boundary is real — a paired-tag regex reads the next survivor's
 * failure body as the killed mutant's own and attributes it to the wrong file.
 * That is why this walks tags instead. Suite attributes are still read, as a
 * consistency check against the elements counted.
 *
 * mutation_test has its own `<threshold failure=...>` and sets its exit code
 * from it. We deliberately do not emit that element and never read that exit
 * code: the threshold lives in .cleancode-gates.json and the comparison happens
 * in g6Verdict, so the config stays the single source of every number.
 */

/**
 * Yield one record per markup tag: { name, attrs, close, selfClosing, start, end }.
 * Node ships no XML parser and this adapter takes no dependencies, so the
 * document is tokenised at the tag level. Comments, CDATA, PIs and doctypes are
 * skipped, and a `>` inside a quoted attribute value does not end a tag.
 */
function* xmlTags(src) {
  const n = src.length;
  let i = 0;
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt < 0) return;
    if (src.startsWith('<!--', lt)) { const e = src.indexOf('-->', lt + 4); i = e < 0 ? n : e + 3; continue; }
    if (src.startsWith('<![CDATA[', lt)) { const e = src.indexOf(']]>', lt + 9); i = e < 0 ? n : e + 3; continue; }
    if (src.startsWith('<?', lt)) { const e = src.indexOf('?>', lt + 2); i = e < 0 ? n : e + 2; continue; }
    if (src.startsWith('<!', lt)) { const e = src.indexOf('>', lt + 2); i = e < 0 ? n : e + 1; continue; }
    let j = lt + 1;
    let quote = null;
    for (; j < n; j += 1) {
      const c = src[j];
      if (quote) { if (c === quote) quote = null; continue; }
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === '>') break;
    }
    if (j >= n) return;
    const raw = src.slice(lt + 1, j);
    i = j + 1;
    const close = raw.charCodeAt(0) === 47; /* '/' */
    const selfClosing = !close && raw.charCodeAt(raw.length - 1) === 47;
    let k = close ? 1 : 0;
    while (k < raw.length && /\s/.test(raw[k])) k += 1;
    const nameStart = k;
    while (k < raw.length && !/[\s/>]/.test(raw[k])) k += 1;
    const name = raw.slice(nameStart, k);
    if (!name) continue;
    yield { name, attrs: raw.slice(k, selfClosing ? -1 : undefined), close, selfClosing, start: lt, end: i };
  }
}

function xmlUnescape(s) {
  return String(s)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&amp;/g, '&');
}

/** Attributes of one already-delimited tag. */
function xmlAttrs(s) {
  const out = {};
  const re = /([A-Za-z_:][-\w.:]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(s))) out[m[1]] = xmlUnescape(m[2] !== undefined ? m[2] : m[3]);
  return out;
}

/**
 * Which of mutation_test's outcomes a `<testcase>` child names. The `type`
 * strings are free text from the writer, not a schema, so anything
 * unrecognised lands in `blocked` — counted, never scored as a kill. A future
 * version that adds a fifth outcome degrades to "not measured", not to "passed".
 */
function junitCaseStatus(tagName, typeAttr) {
  if (tagName === 'failure') return 'survived';
  const t = String(typeAttr || '').toLowerCase();
  if (t.includes('timeout')) return 'timeout';
  if (t.includes('not covered')) return 'notCovered';
  return 'blocked';
}

const G6_UNRUN = new Set(['timeout', 'blocked']);

function parseMutationTestJunit(xml) {
  // Guard on the document element, not on `<testsuite`: a scope that yields no
  // mutants is written as a bare `<testsuites/>`, which is a legitimate report
  // of nothing to verify rather than a malformed one.
  if (typeof xml !== 'string' || !/<testsuites\b/.test(xml)) return null;

  const counts = { detected: 0, survived: 0, timeout: 0, notCovered: 0, blocked: 0 };
  const byStatus = { survived: {}, timeout: {}, notCovered: {}, blocked: {} };
  const byFile = {};

  let declared = 0;
  let declaredUndetected = 0;
  let declaredBlocked = 0;
  let open = null;

  const lineOf = (nameAttr, text) => {
    const fromName = /^Line(\d+)_/.exec(nameAttr || '');
    if (fromName) return Number(fromName[1]);
    const fromText = /\bLine:\s*(\d+)/.exec(text || '');
    return fromText ? Number(fromText[1]) : null;
  };
  const commit = (tc) => {
    counts[tc.status] += 1;
    if (tc.status === 'detected' || !tc.file || tc.line == null) return;
    (byStatus[tc.status][tc.file] = byStatus[tc.status][tc.file] || []).push(tc.line);
    // byFile is what a fixer acts on: a surviving mutant and an uncovered line
    // are both real test debt. A timed-out mutant is neither — it is unmeasured,
    // and blaming a test's assertions for it sends the fixer after the wrong thing.
    if (!G6_UNRUN.has(tc.status)) (byFile[tc.file] = byFile[tc.file] || []).push(tc.line);
  };

  for (const t of xmlTags(xml)) {
    if (t.name === 'testsuite' && !t.close) {
      const a = xmlAttrs(t.attrs);
      if (/^\d+$/.test(a.tests || '')) declared += Number(a.tests);
      if (/^\d+$/.test(a.failures || '')) declaredUndetected += Number(a.failures);
      if (/^\d+$/.test(a.errors || '')) declaredBlocked += Number(a.errors);
      continue;
    }
    if (t.name === 'testcase') {
      if (t.close) {
        if (open) { open.line = lineOf(open.nameAttr, xml.slice(open.bodyFrom, t.start)); commit(open); open = null; }
        continue;
      }
      if (open) { open.line = lineOf(open.nameAttr, ''); commit(open); open = null; }
      const a = xmlAttrs(t.attrs);
      const tc = { file: a.classname || '', nameAttr: a.name || '', status: 'detected', line: null, bodyFrom: t.end };
      if (t.selfClosing) { tc.line = lineOf(tc.nameAttr, ''); commit(tc); } else { open = tc; }
      continue;
    }
    if (open && !t.close && (t.name === 'failure' || t.name === 'error')) {
      open.status = junitCaseStatus(t.name, xmlAttrs(t.attrs).type);
    }
  }
  if (open) { open.line = lineOf(open.nameAttr, ''); commit(open); }

  const total = counts.detected + counts.survived + counts.timeout + counts.notCovered + counts.blocked;
  // The writer sums every suite attribute from the very lists that produce these
  // elements, so all three must agree with what we counted: tests= is
  // mutationCount, failures= is undetectedCount, errors= is timeout plus
  // not-covered. When they disagree the document is truncated, or is not this
  // writer's — an error, never "nothing to measure" and never a score we invent.
  if (declared !== total) return null;
  if (declaredUndetected !== counts.survived) return null;
  if (declaredBlocked !== counts.timeout + counts.notCovered + counts.blocked) return null;
  if (total === 0) {
    return { score: 0, measuredScore: 0, total: 0, measured: 0, counts, byFile: {}, byStatus };
  }
  const measured = counts.detected + counts.survived;
  return {
    // `score` is the pessimistic bound the gate compares: a mutant that was not
    // run is not a mutant the tests killed, so it counts against the code.
    // `measuredScore` is the same ratio over only the mutants that actually ran,
    // reported beside it so a run full of timeouts reads as unmeasured rather
    // than merely bad.
    score: measured === 0 ? null : (counts.detected / total) * 100,
    measuredScore: measured === 0 ? null : (counts.detected / measured) * 100,
    total,
    measured,
    counts,
    byFile,
    byStatus,
  };
}

/** `dart` the same way resolveFlutter resolved `flutter` (FVM-aware). */
function dartInvocation(flutter) {
  return flutter.cmd === 'fvm' ? { cmd: 'fvm', pre: ['dart'] } : { cmd: 'dart', pre: [] };
}

/** True when `mutation_test` is activated for this SDK. */
function mutationTestAvailable(flutter) {
  const dart = dartInvocation(flutter);
  try {
    execFileSync(dart.cmd, [...dart.pre, 'pub', 'global', 'run', 'mutation_test', '--version'], {
      stdio: 'ignore',
      timeout: 120000,
    });
    return true;
  } catch {
    return false;
  }
}

function xmlEscape(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Invoke mutation_test over exactly the in-scope targets and return its junit
 * report as a string, or null when none was written.
 *
 * The target list is written into a generated config because a bare source-file
 * argument carries no test command. Listing files explicitly also makes the
 * score scope-exact, which dart_mutant cannot be (it scores whatever its single
 * --glob mutated). Coverage is passed when lcov exists: mutation_test only runs
 * mutants on covered statements, which is the difference between a run that
 * finishes and one that does not. Everything is written to a temp dir that is
 * removed afterwards, so no mutation-test-report/ litter reaches the tree.
 */
const G6_BUDGET_DEFAULTS = { perMutantSeconds: 120, totalSeconds: 1800, maxMutants: 400 };

function g6Budget(g6cfg) {
  const b = (g6cfg && g6cfg.budget) || {};
  const num = (v, d) => (Number.isFinite(v) && v > 0 ? v : d);
  return {
    perMutantSeconds: num(b.perMutantSeconds, G6_BUDGET_DEFAULTS.perMutantSeconds),
    totalSeconds: num(b.totalSeconds, G6_BUDGET_DEFAULTS.totalSeconds),
    maxMutants: num(b.maxMutants, G6_BUDGET_DEFAULTS.maxMutants),
  };
}

function runMutationTest(flutter, stackCfg, io, targets, g6cfg = {}, deps = {}) {
  const exec = deps.execFileSync || execFileSync;
  const dart = dartInvocation(flutter);
  const testCommand = [flutter.cmd, ...flutter.pre, 'test'].join(' ');
  const budget = g6Budget(g6cfg);
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-g6-'));
  const cfgPath = path.join(outDir, 'targets.xml');

  const fileEls = targets.map((rel) => `    <file>${xmlEscape(rel)}</file>`).join('\n');
  fs.writeFileSync(
    cfgPath,
    `<?xml version="1.0" encoding="UTF-8"?>
<mutations version="1.2">
  <files>
${fileEls}
  </files>
  <commands>
    <command group="test" expected="0" working-directory="." timeout="${budget.perMutantSeconds}">${xmlEscape(testCommand)}</command>
  </commands>
</mutations>
`,
    'utf8',
  );

  const args = [...dart.pre, 'pub', 'global', 'run', 'mutation_test', '-f', 'junit', '-o', outDir, '-q'];
  const lcov = path.join(io.root, 'coverage', 'lcov.info');
  if (fs.existsSync(lcov)) args.push('-c', lcov);
  args.push(cfgPath);

  const reportPath = path.join(outDir, 'mutation-test.junit.xml');
  const readReport = deps.readReport
    || (() => (fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : null));
  // The preflight and the scoring run write the same path. Clear it between
  // them: a scoring run that dies without writing would otherwise be scored
  // from the dry run's document, which lists every mutant as undetected because
  // no test was ever executed.
  const dropReport = deps.dropReport
    || (() => { try { fs.rmSync(reportPath, { force: true }); } catch { /* ignore */ } });

  // mutation_test edits the target files IN PLACE and restores them when it
  // finishes. dart_mutant sandboxes instead, so this is the one tool that can
  // leave a live mutation in the tree — an interrupted or crashed run corrupts
  // source, and a project whose files are untracked has nothing to restore
  // from. Snapshot the bytes ourselves and put back anything that differs.
  const snapDir = path.join(outDir, 'snapshot');
  const snapshots = [];
  try {
    fs.mkdirSync(snapDir, { recursive: true });
    targets.forEach((rel, i) => {
      const abs = path.join(io.root, rel);
      if (!fs.existsSync(abs)) return;
      const keep = path.join(snapDir, String(i));
      fs.copyFileSync(abs, keep);
      snapshots.push({ abs, keep });
    });
  } catch {
    // A snapshot we could not take is one we must not pretend to have.
    snapshots.length = 0;
  }

  // Reachable from `finally`, from a signal handler, and from process exit, so
  // it must be harmless when more than one of those fires.
  let restored = false;
  const restore = () => {
    if (restored) return;
    restored = true;
    for (const { abs, keep } of snapshots) {
      try {
        if (!fs.existsSync(keep)) continue;
        const now = fs.readFileSync(abs);
        const then = fs.readFileSync(keep);
        if (!now.equals(then)) fs.copyFileSync(keep, abs);
      } catch {
        /* a file we cannot compare is one we cannot safely rewrite */
      }
    }
  };
  const cleanup = () => {
    try { fs.rmSync(outDir, { recursive: true, force: true }); } catch { /* ignore */ }
  };

  // Node runs NEITHER `finally` NOR 'exit' handlers when SIGINT/SIGTERM/SIGHUP
  // arrive with their default disposition — the process is simply gone and the
  // mutated file stays mutated in the user's tree. Registering a listener is
  // what changes that: it makes the signal non-fatal, so the blocking exec
  // below returns, `finally` runs, and the snapshot goes back. The handler body
  // only covers the case where the loop turns again before we exit.
  //
  // The cost is that a signal no longer stops the gate promptly, which is why
  // the exec timeout below is load-bearing for this: without it an interrupted
  // run would wait out a hang it can no longer be killed out of.
  const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  const handlers = {};
  const onExit = () => restore();
  const disarm = () => {
    for (const sig of SIGNALS) process.removeListener(sig, handlers[sig]);
    process.removeListener('exit', onExit);
  };
  for (const sig of SIGNALS) {
    handlers[sig] = () => {
      restore();
      cleanup();
      disarm();
      process.kill(process.pid, sig); // re-raise so the exit status stays 128+n
    };
    process.on(sig, handlers[sig]);
  }
  process.on('exit', onExit);

  // Keep the tool's own words. When mutation_test aborts it says exactly why on
  // stdout, and discarding that turns a one-line diagnosis into an
  // investigation — the gate then reports only that no report appeared, which
  // is the symptom rather than the cause.
  const BASELINE_RED = /failed with unmodified code/i;
  const invoke = (extra) => {
    try {
      exec(dart.cmd, extra ? [...args.slice(0, -1), extra, args[args.length - 1]] : args, {
        cwd: io.root,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        // Without this the 43-minute-hang class that motivated this gate is
        // unmitigated. SIGKILL rather than the default SIGTERM because a wedged
        // Dart VM is exactly what SIGTERM is already failing to stop.
        timeout: budget.totalSeconds * 1000,
        killSignal: 'SIGKILL',
      });
      return null;
    } catch (err) {
      // Three different failures arrive here. ETIMEDOUT means we killed it
      // mid-run, so whatever is on disk covers an arbitrary prefix of the scope
      // — a partial measurement, never a score. An abort on the unmodified
      // baseline means the project's own suite is red before any mutation, which
      // is a precondition failure and not a mutation result. Anything else is
      // mutation_test's own quality gate firing: the report is complete and our
      // threshold comparison is the one that counts.
      if (err && err.code === 'ETIMEDOUT') return { reason: 'run-timeout' };
      const out = `${(err && err.stdout) || ''}${(err && err.stderr) || ''}`.trim();
      if (BASELINE_RED.test(out)) {
        return {
          reason: 'baseline-suite-red',
          detail: out.split('\n').filter(Boolean).slice(-2).join(' ').slice(0, 300),
        };
      }
      return null;
    }
  };

  try {
    // Cost is (chargeable mutants) x (one full suite run), so it has to be known
    // before it is spent. `-d` loads the same config and the same lcov and runs
    // no tests, returning the exact count the scoring run would produce. Mutants
    // on uncovered lines cost no suite run at all, so they are counted but not
    // charged. The admission test multiplies by the per-mutant CAP, not a mean:
    // on a measured sample the mean was 0.85 s while two mutants cost 30.8 s
    // each, so only the cap is an estimate the budget can honour.
    const dryFail = invoke('-d');
    if (dryFail) return { unmeasured: true, ...dryFail, budget };
    const dryXml = readReport();
    const dry = parseMutationTestJunit(dryXml);
    if (!dry) return { unmeasured: true, reason: 'preflight-failed', budget };
    // Nothing to mutate is a complete answer, and a common one — on a real
    // Flutter project a third of the files are enums, interfaces and generated
    // shells. Running the suite to rediscover that costs a full test start per
    // file and can only reproduce the document the preflight already holds.
    if (dry.total === 0) return { xml: dryXml, budget };

    const chargeable = dry.total - dry.counts.notCovered;
    const worstCaseSeconds = chargeable * budget.perMutantSeconds;
    if (dry.total > budget.maxMutants || worstCaseSeconds > budget.totalSeconds) {
      return {
        unmeasured: true,
        reason: dry.total > budget.maxMutants ? 'mutant-cap' : 'time-budget',
        mutants: dry.total,
        chargeable,
        worstCaseSeconds,
        budget,
      };
    }

    dropReport();
    const runFail = invoke(null);
    if (runFail) return { unmeasured: true, ...runFail, budget };
    const xml = readReport();
    if (xml == null) return { unmeasured: true, reason: 'no-report', budget };
    return { xml, budget };
  } finally {
    // Runs on the success path too: a clean mutation_test restores its own
    // edits, so this is normally a no-op comparison, and the one time it is not
    // is the time it matters. It cannot help against SIGKILL, which kills this
    // process as well — that residual is documented, not defended.
    restore();
    disarm();
    cleanup();
  }
}

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
  // Stryker's statuses map onto the same four outcomes mutation_test reports, so
  // g6Verdict can file the same four rules whichever tool ran. Collapsing
  // NoCoverage into "survived" — as this did — hides the difference between a
  // test that asserts too little and a line no test reaches at all.
  const STATUS = {
    survived: 'survived',
    nocoverage: 'notCovered',
    timeout: 'timeout',
    runtimeerror: 'blocked',
    compileerror: 'blocked',
    ignored: 'blocked',
  };
  const counts = { detected: 0, survived: 0, timeout: 0, notCovered: 0, blocked: 0 };
  const byStatus = { survived: {}, timeout: {}, notCovered: {}, blocked: {} };
  const byFile = {};
  let total = 0;
  for (const [name, fobj] of Object.entries(report.files || {})) {
    for (const m of fobj.mutants || []) {
      total += 1;
      // Normalize away casing and the underscore variant (No_Coverage / NoCoverage).
      const raw = String(m.status || '').toLowerCase().replace(/_/g, '');
      const status = STATUS[raw] || 'detected';
      counts[status] += 1;
      if (status === 'detected') continue;
      const line = m.location && m.location.start && m.location.start.line;
      if (!line) continue;
      (byStatus[status][name] = byStatus[status][name] || []).push(line);
      if (!G6_UNRUN.has(status)) (byFile[name] = byFile[name] || []).push(line);
    }
  }
  const measured = counts.detected + counts.survived;
  return { score, total, measured, counts, byFile, byStatus };
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
const G6_RULES = {
  survived: {
    rule: 'mutation/survived',
    label: 'surviving mutant',
    hint: (l) => `Add an assertion that fails when the code at line ${l} is mutated`,
  },
  notCovered: {
    rule: 'mutation/not-covered',
    label: 'mutant on a line no test covers',
    hint: (l) => `Line ${l} is not executed by any test; cover it before it can be mutation-tested`,
  },
  timeout: {
    rule: 'mutation/timeout',
    label: 'mutant timed out (unmeasured)',
    hint: (l) => `The suite did not terminate with line ${l} mutated; this mutant was not measured`,
  },
  blocked: {
    rule: 'mutation/blocked',
    label: 'mutant blocked (unmeasured)',
    hint: (l) => `The tool could not run the mutant at line ${l}`,
  },
};

/**
 * A gate result for a scope that was not measured. Never `pass` and never
 * `fail`: a scope nothing ran against has no score to compare, and the repo's
 * own rule is that a pass which measured nothing must not be byte-identical to
 * a pass that did. `measurement.reason` is what tells an operator whether the
 * run was declined, killed, or never produced a report.
 */
function g6Unmeasured(run, { targets, threshold, command, tool }) {
  const b = run.budget || {};
  // Prefer the tool's own words when it gave any: "no report appeared" is the
  // symptom, and the cause is usually one line the tool already printed.
  let detail;
  if (run.worstCaseSeconds != null) {
    detail = `${run.chargeable ?? '?'} chargeable mutants x ${b.perMutantSeconds ?? '?'}s cap = ${run.worstCaseSeconds}s exceeds the ${b.totalSeconds ?? '?'}s budget`;
  } else if (run.detail) {
    detail = `${run.reason} — ${run.detail}`;
  } else {
    detail = `the run did not produce a scorable report (${run.reason})`;
  }
  return gateResult('G6', 'error', {
    command,
    tool,
    thresholds: { mutationScore: threshold },
    measurement: {
      state: 'unmeasured',
      reason: run.reason || 'no-report',
      mutants: run.mutants ?? null,
      chargeable: run.chargeable ?? null,
      worstCaseSeconds: run.worstCaseSeconds ?? null,
      budgetSeconds: b.totalSeconds ?? null,
    },
    findings: [{
      id: 'G6:unmeasured',
      severity: 'blocker',
      file: targets[0],
      line: 1,
      rule: 'mutation/unmeasured',
      message: `mutation testing did not run: ${detail}`,
      fixHint: run.reason === 'baseline-suite-red'
        ? 'The project test suite fails before any mutation is applied. Make it green, then re-run G6'
        : 'Narrow the G6 scope, raise gates.G6.budget, or run G6 on a schedule rather than per change',
    }],
  });
}

function g6Verdict(parsed, opts) {
  const { targets, threshold, command, stackCfg, io, tool } = opts;
  const thresholds = { mutationScore: threshold };
  // gateResult defaults `tool` to GATE_META's, which names the stack default.
  // G6 is the one gate a project can retarget, so the report must name the tool
  // that actually ran — otherwise a dart_mutant-pinned project reads as if
  // mutation_test produced the verdict.
  const ran = tool || (stackCfg.gates.G6 || {}).tool || GATE_META.G6.tool;
  if (!targets.length) {
    return gateResult('G6', 'pass', {
      command, thresholds, tool: ran, measurement: { state: 'empty', mutants: 0 },
    });
  }
  if (!parsed) return g6Unmeasured({ reason: 'no-report' }, { ...opts, tool: ran });
  if (parsed.total === 0) {
    return gateResult('G6', 'pass', {
      command, thresholds, tool: ran, measurement: { state: 'empty', mutants: 0 },
    });
  }
  // Mutants exist but none of them ran: every one timed out or was blocked.
  // There is no ratio to compare, so this is unmeasured rather than a zero.
  if (parsed.score == null) {
    return g6Unmeasured(
      { reason: 'nothing-ran', mutants: parsed.total, chargeable: parsed.total },
      { ...opts, tool: ran },
    );
  }

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
  // Four outcomes, four rules. A survivor and an uncovered line are both real
  // debt but the fix differs — write a stronger assertion, versus write any test
  // at all — and a timed-out mutant is neither, so blaming it on the test's
  // assertions sends a fixer after the wrong thing. The dart_mutant path
  // supplies the same buckets, so both tools report the same shape.
  const buckets = parsed.byStatus || { survived: parsed.byFile || {} };
  for (const status of Object.keys(G6_RULES)) {
    const meta = G6_RULES[status];
    for (const name of Object.keys(buckets[status] || {})) {
      const rel = toPosix(path.isAbsolute(name) ? path.relative(io.root, name) : name);
      if (isExempt(rel, stackCfg, 'G6')) continue;
      for (const line of buckets[status][name]) {
        findings.push({
          id: `G6-${status}-${rel}:${line}`,
          severity: 'warning',
          file: rel,
          line,
          rule: meta.rule,
          message: `${meta.label} at ${rel}:${line}`,
          fixHint: meta.hint(line),
        });
      }
    }
  }

  const measurement = parsed.counts
    ? {
      state: parsed.measured === parsed.total ? 'measured' : 'partial',
      mutants: parsed.total,
      measured: parsed.measured,
      measuredScore: parsed.measuredScore,
      ...parsed.counts,
    }
    : { state: 'measured', mutants: parsed.total, measured: parsed.total };

  return gateResult('G6', failed ? 'fail' : 'pass', {
    command, thresholds, findings, tool: ran, measurement,
  });
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

/**
 * G6 runs mutation_test by default and dart_mutant only when the config asks
 * for it (`gates.G6.tool: "dart_mutant"`). Both produce the same verdict shape,
 * so the choice changes only which binary runs and which report is parsed.
 */
function runG6(files, stackCfg, io, deps = {}) {
  const resolveF = deps.resolveFlutter || resolveFlutter;
  const hasCmd = deps.commandExists || commandExists;
  const hasMutationTest = deps.mutationTestAvailable || mutationTestAvailable;
  const runMutantFn = deps.runMutant || runMutant;
  const runMutationTestFn = deps.runMutationTest || runMutationTest;

  const flutter = resolveF(io.root);
  if (!flutter) return missingTool('G6', stackCfg);

  const g6 = stackCfg.gates.G6 || {};
  const threshold = (g6.thresholds || {}).mutationScore ?? 70;
  const targets = files.filter(
    (rel) => DART_FILE_RE.test(rel) && !isExempt(rel, stackCfg, 'G6'),
  );
  const tool = g6.tool || GATE_META.G6.tool;

  const viaDartMutant = () => {
    const command = 'dart_mutant --json --quiet --ai none';
    const opts = { targets, threshold, command, stackCfg, io, tool: 'dart_mutant' };
    if (!targets.length) return g6Verdict(null, opts);
    const json = runMutantFn(flutter, stackCfg, io, threshold);
    return g6Verdict(json == null ? null : parseDartMutantReport(json), opts);
  };

  const viaMutationTest = () => {
    const command = 'dart pub global run mutation_test -f junit';
    const opts = { targets, threshold, command, stackCfg, io, tool: 'mutation_test' };
    if (!targets.length) return g6Verdict(null, opts);
    const run = runMutationTestFn(flutter, stackCfg, io, targets, g6);
    if (!run) return g6Verdict(null, opts);
    // A refused run and a run we killed on the clock are both unmeasured, and
    // runMutationTest reports both the same way: the report on disk after a kill
    // covers an arbitrary prefix of the scope, so it is discarded, not scored.
    if (run.unmeasured) return g6Unmeasured(run, opts);
    return g6Verdict(run.xml == null ? null : parseMutationTestJunit(run.xml), opts);
  };

  // `dart_mutant` is never a default — defaults.cjs writes `mutation_test`, so
  // the only way that value appears is a human choosing it. An explicit choice
  // is not a preference: never silently run a tool the config did not name.
  if (tool === 'dart_mutant') {
    return hasCmd('dart_mutant') ? viaDartMutant() : missingTool('G6', stackCfg);
  }
  if (tool !== 'mutation_test') return missingTool('G6', stackCfg);

  // The documented default: mutation_test, falling back to dart_mutant so a
  // project that has one but not the other still gets a gate. g6Verdict is told
  // which one actually ran, so the report never attributes one tool's score to
  // the other.
  if (hasMutationTest(flutter)) return viaMutationTest();
  if (hasCmd('dart_mutant')) return viaDartMutant();
  return missingTool('G6', stackCfg);
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
  DART_FILE_RE,
  SOURCE_FILE_RE: DART_FILE_RE,
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
    fileCoverageFindings,
    parseDclJson,
    g2Findings,
    parseAnalyzeLine,
    parseDartMutantReport,
    g6Glob,
    g6Verdict,
    parseMutationTestJunit,
    runMutationTest,
    mutationTestAvailable,
    runG6,
    resolveImport,
    buildImportGraph,
    findCycles,
  },
};
