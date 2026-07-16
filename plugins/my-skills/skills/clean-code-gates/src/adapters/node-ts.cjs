'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { G1_EXEMPTIONS } = require('../../defaults.cjs');
const { toPosix } = require('../scope.cjs');

/**
 * node-ts adapter.
 *  - G1 (coverage): runs the project's Jest and parses a json-summary report.
 *  - G2 (complexity): runs the project's ESLint with a gate-owned flat config
 *    enforcing complexity / max-depth / max-lines-per-function / max-params /
 *    max-statements at the configured thresholds.
 * Unsupported gates fall through to run.cjs's missing_tool handling.
 */

const GATE_META = {
  G1: { name: 'coverage', tool: 'jest' },
  G2: { name: 'cyclomatic-complexity', tool: 'eslint' },
  G4: { name: 'naming', tool: 'eslint' },
  G6: { name: 'mutation', tool: 'stryker' },
  G7: { name: 'dependency-structure', tool: 'dependency-cruiser' },
};

const MUTATION_KILLED = new Set(['Killed', 'Timeout']);
const MUTATION_UNDETECTED = new Set(['Survived', 'NoCoverage']);

/**
 * Default @typescript-eslint/naming-convention policy: camelCase identifiers,
 * PascalCase types/classes, UPPER_CASE/PascalCase consts, and lenient
 * object/type properties (DB rows and JSON payloads legitimately use other
 * casings). Override per project via `gates.G4.namingRule` in the config.
 */
const G4_NAMING_RULE = [
  'error',
  {
    selector: 'default',
    format: ['camelCase'],
    leadingUnderscore: 'allow',
    trailingUnderscore: 'allow',
  },
  {
    selector: 'variable',
    format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
    leadingUnderscore: 'allow',
  },
  { selector: 'parameter', format: ['camelCase'], leadingUnderscore: 'allow' },
  {
    selector: 'parameterProperty',
    format: ['camelCase'],
    leadingUnderscore: 'allow',
  },
  { selector: 'function', format: ['camelCase', 'PascalCase'] },
  {
    selector: 'classProperty',
    format: ['camelCase', 'UPPER_CASE'],
    leadingUnderscore: 'allow',
  },
  { selector: 'classMethod', format: ['camelCase'], leadingUnderscore: 'allow' },
  { selector: 'typeLike', format: ['PascalCase'] },
  { selector: 'enumMember', format: ['PascalCase', 'UPPER_CASE'] },
  { selector: 'import', format: ['camelCase', 'PascalCase'] },
  { selector: ['objectLiteralProperty', 'typeProperty'], format: null },
];

const COVERAGE_METRICS = ['statements', 'branches', 'functions', 'lines'];
// Accepts both separators: `auth.service.spec.ts` and NestJS's scaffolded
// `app.e2e-spec.ts`. Requiring a dot silently reclassified every e2e file as
// production code once `test/` entered roots.
const TEST_FILE_RE = /[.-](spec|test)\.[cm]?[jt]sx?$/;
const TS_FILE_RE = /\.tsx?$/;

const G2_LIMIT_KEY = {
  complexity: 'complexity',
  'max-depth': 'maxDepth',
  'max-lines-per-function': 'maxLinesPerFunction',
  'max-params': 'maxParams',
  'max-statements': 'maxStatements',
};
const G2_DEFAULTS = {
  complexity: 8,
  maxDepth: 2,
  maxLinesPerFunction: 30,
  maxParams: 4,
  maxStatements: 15,
};

function globToRe(glob) {
  const re = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '\0')
    .replace(/\*/g, '[^/]*')
    .replace(/\0/g, '.*');
  return new RegExp('^' + re + '$');
}

function binPath(root, name) {
  const bin = path.join(root, 'node_modules', '.bin', name);
  return fs.existsSync(bin) ? bin : null;
}

/**
 * Which JS test runner backs G1 (coverage) and G6 (mutation). Both present with
 * no explicit override resolves to jest for back-compat (noted in the command).
 */
function detectRunner(root) {
  const hasJest = !!binPath(root, 'jest');
  const hasVitest = !!binPath(root, 'vitest');
  if (hasJest && hasVitest) return 'jest';
  if (hasVitest) return 'vitest';
  if (hasJest) return 'jest';
  return null;
}

/** Explicit `jest`/`vitest` override wins; `auto`/undefined falls back to detection. */
function resolveRunner(root, override) {
  if (override === 'jest' || override === 'vitest') return override;
  return detectRunner(root);
}

function resolvableFrom(root, pkg) {
  try {
    require.resolve(pkg, { paths: [root] });
    return true;
  } catch {
    return false;
  }
}

function hasVitestCoverageProvider(root) {
  return (
    resolvableFrom(root, '@vitest/coverage-v8') ||
    resolvableFrom(root, '@vitest/coverage-istanbul')
  );
}

function hasStrykerVitestRunner(root) {
  return resolvableFrom(root, '@stryker-mutator/vitest-runner');
}

/** missing_tool result with an explicit tool label + install hint. */
function missingToolMsg(gate, tool, installHint) {
  const meta = GATE_META[gate] || { name: gate };
  return {
    gate,
    name: meta.name,
    stack: 'node-ts',
    status: 'missing_tool',
    tool,
    findings: [],
    installHint,
  };
}

function gateResult(gate, status, extra = {}) {
  const meta = GATE_META[gate];
  return {
    gate,
    name: meta.name,
    stack: 'node-ts',
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
    stack: 'node-ts',
    status: 'missing_tool',
    tool,
    findings: [],
    installHint: `node-ts ${gate} needs ${tool} — install it in the project (no ${tool} at node_modules/.bin/${tool})`,
  };
}

function isExempt(rel, stackCfg, gate) {
  if (TEST_FILE_RE.test(rel)) return true;
  const perGate = ((stackCfg.gates && stackCfg.gates[gate]) || {}).exempt || [];
  const extra = gate === 'G1' ? G1_EXEMPTIONS : [];
  const globs = [...(stackCfg.exclude || []), ...extra, ...perGate];
  return globs.some((g) => globToRe(g).test(rel));
}

// ---- G1: coverage -------------------------------------------------------

function readSummary(outDir, failed) {
  const summaryPath = path.join(outDir, 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) return { summary: null, failed };
  return { summary: JSON.parse(fs.readFileSync(summaryPath, 'utf8')), failed };
}

function execCoverage(bin, args, root) {
  let failed = false;
  try {
    execFileSync(bin, args, {
      cwd: root,
      stdio: ['ignore', 'ignore', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    failed = true;
  }
  return failed;
}

/** Jest and Vitest both emit the identical Istanbul `coverage-summary.json`. */
function runCoverage(root, runner) {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-cov-'));
  const args =
    runner === 'vitest'
      ? [
          'run',
          '--coverage',
          '--coverage.enabled',
          '--coverage.reporter=json-summary',
          `--coverage.reportsDirectory=${outDir}`,
        ]
      : [
          '--coverage',
          '--coverageReporters=json-summary',
          `--coverageDirectory=${outDir}`,
          '--silent',
          '--ci',
        ];
  const failed = execCoverage(binPath(root, runner), args, root);
  return readSummary(outDir, failed);
}

function coverageFindings(rel, entry, thresholds) {
  const findings = [];
  for (const metric of COVERAGE_METRICS) {
    const limit = thresholds[metric];
    if (limit == null || !entry[metric]) continue;
    const value = entry[metric].pct;
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

function runG1(files, stackCfg, io) {
  const runner = resolveRunner(io.root, (stackCfg.gates.G1 || {}).tool);
  if (!runner) {
    return missingToolMsg(
      'G1',
      'jest|vitest',
      'node-ts G1 needs a test runner — install jest or vitest (none at node_modules/.bin/)',
    );
  }
  if (runner === 'vitest' && !hasVitestCoverageProvider(io.root)) {
    return missingToolMsg(
      'G1',
      'vitest',
      'node-ts G1 (vitest) needs a coverage provider — install @vitest/coverage-v8 (or @vitest/coverage-istanbul)',
    );
  }

  const thresholds = (stackCfg.gates.G1 || {}).thresholds || {
    statements: 85,
    branches: 80,
  };
  const command =
    runner === 'vitest'
      ? 'vitest run --coverage --coverage.reporter=json-summary'
      : 'jest --coverage --coverageReporters=json-summary';
  const { summary, failed } = runCoverage(io.root, runner);
  if (!summary) return gateResult('G1', 'error', { command, thresholds, tool: runner });

  const byRel = new Map();
  for (const key of Object.keys(summary)) {
    if (key === 'total') continue;
    byRel.set(toPosix(path.relative(io.root, key)), summary[key]);
  }

  const findings = [];
  for (const rel of files) {
    if (isExempt(rel, stackCfg, 'G1')) continue;
    const entry = byRel.get(rel);
    if (!entry) continue;
    findings.push(...coverageFindings(rel, entry, thresholds));
  }

  return gateResult('G1', failed ? 'error' : findings.length ? 'fail' : 'pass', {
    command,
    thresholds,
    findings,
    tool: runner,
  });
}

// ---- G2: complexity (eslint) -------------------------------------------

function resolvedThresholds(stackCfg) {
  return { ...G2_DEFAULTS, ...((stackCfg.gates.G2 || {}).thresholds || {}) };
}

/**
 * Locate a TypeScript parser entry resolvable from the project. Prefers the
 * `typescript-eslint` umbrella (which exposes `.parser`) and falls back to the
 * standalone `@typescript-eslint/parser`. Returns an absolute entry path so the
 * generated (tmp) config can require it regardless of its own location.
 */
function resolveTsParser(root) {
  try {
    return { entry: require.resolve('typescript-eslint', { paths: [root] }), prop: 'parser' };
  } catch {
    /* try standalone next */
  }
  try {
    return { entry: require.resolve('@typescript-eslint/parser', { paths: [root] }), prop: null };
  } catch {
    return null;
  }
}

function writeEslintConfig(parserRef, t) {
  const rules = {
    complexity: ['error', t.complexity],
    'max-depth': ['error', t.maxDepth],
    'max-lines-per-function': [
      'error',
      { max: t.maxLinesPerFunction, skipBlankLines: true, skipComments: true },
    ],
    'max-params': ['error', t.maxParams],
    'max-statements': ['error', t.maxStatements],
  };
  const parserExpr = parserRef.prop
    ? `require(${JSON.stringify(parserRef.entry)}).${parserRef.prop}`
    : `(() => { const m = require(${JSON.stringify(parserRef.entry)}); return m.default || m; })()`;
  const body = `const parser = ${parserExpr};
module.exports = [{ files: ['**/*.ts', '**/*.tsx'], languageOptions: { parser }, rules: ${JSON.stringify(
    rules,
  )} }];
`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-eslint-'));
  const cfgPath = path.join(dir, 'eslint.config.cjs');
  fs.writeFileSync(cfgPath, body);
  return cfgPath;
}

function runEslint(eslintBin, cfgPath, targets, root) {
  const args = ['--no-config-lookup', '--config', cfgPath, '-f', 'json', ...targets];
  try {
    return execFileSync(eslintBin, args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // ESLint exits 1 when it reports lint errors; the JSON is still on stdout.
    // A config/parse failure exits 2 with empty stdout → signal error upstream.
    return error.stdout ? error.stdout.toString() : null;
  }
}

/** Run ESLint and return the parsed JSON report, or null on hard failure. */
function lintTargets(eslintBin, cfgPath, targets, root) {
  const raw = runEslint(eslintBin, cfgPath, targets, root);
  if (raw == null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function scopedTargets(files, stackCfg, gate) {
  return files.filter(
    (rel) => TS_FILE_RE.test(rel) && !isExempt(rel, stackCfg, gate),
  );
}

function runG2(files, stackCfg, io) {
  const eslintBin = binPath(io.root, 'eslint');
  const parserRef = resolveTsParser(io.root);
  if (!eslintBin || !parserRef) {
    return missingTool('G2', stackCfg);
  }

  const thresholds = resolvedThresholds(stackCfg);
  const targets = scopedTargets(files, stackCfg, 'G2');
  const command = 'eslint --config <gate-thresholds> -f json';
  if (!targets.length) {
    return gateResult('G2', 'pass', { command, thresholds });
  }

  const cfgPath = writeEslintConfig(parserRef, thresholds);
  const report = lintTargets(eslintBin, cfgPath, targets, io.root);
  if (!report) return gateResult('G2', 'error', { command, thresholds });

  const findings = [];
  for (const file of report) {
    const rel = toPosix(path.relative(io.root, file.filePath));
    for (const m of file.messages || []) {
      if (!m.ruleId || !(m.ruleId in G2_LIMIT_KEY)) continue;
      const finding = {
        id: `G2-${rel}:${m.line}:${m.ruleId}`,
        severity: 'blocker',
        file: rel,
        line: m.line || 1,
        rule: m.ruleId,
        message: m.message,
        metric: { limit: thresholds[G2_LIMIT_KEY[m.ruleId]] },
        fixHint: `Refactor ${rel} to satisfy ${m.ruleId} (limit ${thresholds[G2_LIMIT_KEY[m.ruleId]]})`,
      };
      if (Number.isInteger(m.endLine)) finding.endLine = m.endLine;
      findings.push(finding);
    }
  }

  return gateResult('G2', findings.length ? 'fail' : 'pass', {
    command,
    thresholds,
    findings,
  });
}

// ---- G4: naming (eslint) -----------------------------------------------

/** The umbrella `typescript-eslint` package exposes both `.parser` and `.plugin`. */
function resolveTsUmbrella(root) {
  try {
    return require.resolve('typescript-eslint', { paths: [root] });
  } catch {
    return null;
  }
}

function writeNamingConfig(umbrellaEntry, namingRule) {
  const body = `const tseslint = require(${JSON.stringify(umbrellaEntry)});
module.exports = [{
  files: ['**/*.ts', '**/*.tsx'],
  languageOptions: { parser: tseslint.parser },
  plugins: { '@typescript-eslint': tseslint.plugin },
  rules: { '@typescript-eslint/naming-convention': ${JSON.stringify(namingRule)} },
}];
`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-naming-'));
  const cfgPath = path.join(dir, 'eslint.config.cjs');
  fs.writeFileSync(cfgPath, body);
  return cfgPath;
}

function runG4(files, stackCfg, io) {
  const eslintBin = binPath(io.root, 'eslint');
  const umbrella = resolveTsUmbrella(io.root);
  if (!eslintBin || !umbrella) return missingTool('G4', stackCfg);

  const namingRule = (stackCfg.gates.G4 || {}).namingRule || G4_NAMING_RULE;
  const targets = scopedTargets(files, stackCfg, 'G4');
  const command = 'eslint @typescript-eslint/naming-convention -f json';
  if (!targets.length) return gateResult('G4', 'pass', { command });

  const cfgPath = writeNamingConfig(umbrella, namingRule);
  const report = lintTargets(eslintBin, cfgPath, targets, io.root);
  if (!report) return gateResult('G4', 'error', { command });

  const findings = [];
  for (const file of report) {
    const rel = toPosix(path.relative(io.root, file.filePath));
    for (const m of file.messages || []) {
      if (m.ruleId !== '@typescript-eslint/naming-convention') continue;
      const finding = {
        id: `G4-${rel}:${m.line}:${m.column}`,
        severity: 'blocker',
        file: rel,
        line: m.line || 1,
        rule: 'naming-convention',
        message: m.message,
        fixHint: `Rename to match the convention — ${m.message}`,
      };
      if (Number.isInteger(m.endLine)) finding.endLine = m.endLine;
      findings.push(finding);
    }
  }

  return gateResult('G4', findings.length ? 'fail' : 'pass', {
    command,
    findings,
  });
}

// ---- G6: mutation (stryker) --------------------------------------------

function writeStrykerConfig(targets, reportPath, excludedMutations, runner) {
  const cfg = {
    testRunner: runner,
    coverageAnalysis: 'perTest',
    mutate: targets,
    reporters: ['json'],
    jsonReporter: { fileName: reportPath },
  };
  if (runner === 'jest') {
    cfg.jest = { configFile: 'package.json', enableFindRelatedTests: true };
  }
  if (excludedMutations && excludedMutations.length) {
    cfg.mutator = { excludedMutations };
  }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-stryker-'));
  const cfgPath = path.join(dir, 'stryker.conf.json');
  fs.writeFileSync(cfgPath, JSON.stringify(cfg));
  return cfgPath;
}

function fileMutationScore(mutants) {
  let killed = 0;
  let undetected = 0;
  const survivors = [];
  for (const m of mutants) {
    if (MUTATION_KILLED.has(m.status)) killed++;
    else if (MUTATION_UNDETECTED.has(m.status)) {
      undetected++;
      survivors.push(m);
    }
  }
  const denom = killed + undetected;
  return { score: denom ? (100 * killed) / denom : 100, undetected, survivors };
}

function mutationFindings(rel, mutants, threshold) {
  const { score, undetected, survivors } = fileMutationScore(mutants);
  if (score >= threshold) return [];

  const findings = [
    {
      id: `G6-${rel}:score`,
      severity: 'blocker',
      file: rel,
      line: 1,
      rule: 'mutation/score',
      message: `mutation score ${score.toFixed(1)}% < ${threshold}% (${undetected} undetected)`,
      metric: { value: Number(score.toFixed(1)), limit: threshold, unit: 'percent' },
      fixHint: `Strengthen tests for ${rel} to kill surviving mutants`,
    },
  ];
  for (const m of survivors) {
    const line = (m.location && m.location.start && m.location.start.line) || 1;
    findings.push({
      id: `G6-${rel}:${line}:${m.id}`,
      severity: 'warning',
      file: rel,
      line,
      rule: `mutation/${m.mutatorName}`,
      message: `${m.status} mutant: ${m.mutatorName}`,
      fixHint: `Add an assertion that fails when ${m.mutatorName} is applied at line ${line}`,
    });
  }
  return findings;
}

function runG6(files, stackCfg, io) {
  const strykerBin = binPath(io.root, 'stryker');
  if (!strykerBin) return missingTool('G6', stackCfg);

  const runner = resolveRunner(io.root, (stackCfg.gates.G6 || {}).runner);
  if (!runner) {
    return missingToolMsg(
      'G6',
      'stryker',
      'node-ts G6 needs a test runner — install jest or vitest (none at node_modules/.bin/)',
    );
  }
  if (runner === 'vitest' && !hasStrykerVitestRunner(io.root)) {
    return missingToolMsg(
      'G6',
      'stryker',
      'node-ts G6 (vitest) needs @stryker-mutator/vitest-runner — install it in the project',
    );
  }

  const g6Cfg = stackCfg.gates.G6 || {};
  const threshold = (g6Cfg.thresholds || {}).mutationScore ?? 70;
  const thresholds = { mutationScore: threshold };
  const excludedMutations = g6Cfg.excludedMutations || [];
  const targets = scopedTargets(files, stackCfg, 'G6');
  const command = 'stryker run';
  if (!targets.length) return gateResult('G6', 'pass', { command, thresholds });

  const reportDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-mutation-'));
  const reportPath = path.join(reportDir, 'mutation.json');
  const cfgPath = writeStrykerConfig(targets, reportPath, excludedMutations, runner);

  try {
    execFileSync(strykerBin, ['run', cfgPath], {
      cwd: io.root,
      stdio: ['ignore', 'ignore', 'ignore'],
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    // Stryker exits non-zero only when a break threshold is hit; the report is
    // still written. A missing report (below) is the real failure signal.
  }

  if (!fs.existsSync(reportPath)) return gateResult('G6', 'error', { command, thresholds });
  let report;
  try {
    report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch {
    return gateResult('G6', 'error', { command, thresholds });
  }

  const findings = [];
  for (const key of Object.keys(report.files || {})) {
    const rel = toPosix(path.isAbsolute(key) ? path.relative(io.root, key) : key);
    findings.push(...mutationFindings(rel, report.files[key].mutants, threshold));
  }

  const blocked = findings.some((f) => f.severity === 'blocker');
  return gateResult('G6', blocked ? 'fail' : 'pass', {
    command,
    thresholds,
    findings,
  });
}

// ---- G7: dependency structure (dependency-cruiser) ---------------------

function writeDepcruiseConfig() {
  const cfg = `module.exports = {
  forbidden: [
    { name: 'no-circular', severity: 'error', from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(node_modules|/prisma/generated/|\\\\.spec\\\\.ts$)' },
    tsConfig: { fileName: 'tsconfig.json' },
    tsPreCompilationDeps: true,
  },
};
`;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-depcruise-'));
  const cfgPath = path.join(dir, 'dependency-cruiser.config.cjs');
  fs.writeFileSync(cfgPath, cfg);
  return cfgPath;
}

function cyclePath(v) {
  const names = (v.cycle || []).map((c) => (typeof c === 'string' ? c : c.name));
  return [v.from, ...names].join(' → ');
}

function runG7(files, stackCfg, io) {
  const bin = binPath(io.root, 'depcruise');
  if (!bin) return missingTool('G7', stackCfg);

  const roots = (
    stackCfg.roots && stackCfg.roots.length ? stackCfg.roots : ['src']
  ).filter((r) => fs.existsSync(path.join(io.root, r)));
  const command = 'depcruise <roots> --output-type json';
  if (!roots.length) return gateResult('G7', 'pass', { command });

  const cfgPath = writeDepcruiseConfig();
  const args = [...roots, '--config', cfgPath, '--output-type', 'json'];
  let raw;
  try {
    raw = execFileSync(bin, args, {
      cwd: io.root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    // depcruise exits 1 when violations are found; the JSON is still on stdout.
    raw = error.stdout ? error.stdout.toString() : null;
  }
  if (raw == null) return gateResult('G7', 'error', { command });

  let report;
  try {
    report = JSON.parse(raw);
  } catch {
    return gateResult('G7', 'error', { command });
  }

  const violations = (report.summary && report.summary.violations) || [];
  const findings = violations.map((v) => ({
    id: `G7-${v.from}:${v.rule.name}`,
    severity: v.rule.severity === 'error' ? 'blocker' : 'warning',
    file: v.from,
    line: 1,
    rule: v.rule.name,
    message: v.cycle
      ? `circular dependency: ${cyclePath(v)}`
      : `${v.rule.name}: ${v.from} → ${(v.to && (v.to.resolved || v.to.module)) || ''}`,
    fixHint:
      'Break the dependency cycle — extract shared code or invert the dependency',
  }));

  const blocked = findings.some((f) => f.severity === 'blocker');
  return gateResult('G7', blocked ? 'fail' : 'pass', { command, findings });
}

module.exports = {
  detectRunner,
  resolveRunner,
  isExempt,
  TEST_FILE_RE,
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
};
