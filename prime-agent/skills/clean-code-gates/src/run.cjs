'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { detectPackages } = require('./detect.cjs');
const { loadConfig } = require('./config.cjs');
const { resolveScope, fileStack } = require('./scope.cjs');
const { selectGates, assertRequestedGates, assertResolvedGates } = require('./gates/registry.cjs');
const { scanNoComments } = require('./gates/g5-no-comments.cjs');
const { buildReport } = require('./report.cjs');
/** Plan 2/3: register real adapters here. */
let ADAPTERS = {};
function registerAdapter(stack, adapter) { ADAPTERS[stack] = adapter; }
registerAdapter('node-ts', require('./adapters/node-ts.cjs'));
registerAdapter('dart-flutter', require('./adapters/dart-flutter.cjs'));

/**
 * G5 reads file contents, so it must see only source of the detected stack —
 * the same `SOURCE_FILE_RE` gating every other gate applies. A markdown or JSON
 * file sitting under a stack root is prose, not code, and its slashes are not
 * comments. The regex is read from the adapter registry at call time, so a stack
 * is defined in exactly one place and a re-registered adapter cannot disagree
 * with a table snapshotted at module load.
 */
function runG5(stack, files, io) {
  const sourceRe = (ADAPTERS[stack] || {}).SOURCE_FILE_RE;
  const scanned = sourceRe ? files.filter(rel => sourceRe.test(rel)) : files;
  const findings = scanned.flatMap(rel =>
    scanNoComments({ file: rel, content: fs.readFileSync(path.join(io.root, rel), 'utf8') }));
  return { gate: 'G5', name: 'no-comments', stack, status: findings.length ? 'fail' : 'pass', tool: 'builtin', findings };
}

function runGate(gate, stack, files, stackCfg, io) {
  if (gate === 'G5') return runG5(stack, files, io);
  const adapter = ADAPTERS[stack];
  if (adapter && adapter.supports(gate)) return adapter.run(gate, files, stackCfg, io);
  return { gate, name: gate, stack, status: 'missing_tool', tool: (stackCfg.gates[gate] || {}).tool || 'unknown',
           findings: [], installHint: `adapter for ${stack} ${gate} not installed — run with --scaffold` };
}

/**
 * Which gates run against which stack. `--gates` is validated once against the
 * union of what the scoped stacks support rather than per stack, so a gate one
 * stack of a polyglot repo cannot run is not reported as a usage error while
 * another stack is happily running it.
 */
function resolveGatePlan(options, cfg, scope) {
  const plan = scope.stacks.map(stack => ({ stack, gates: selectGates(options, cfg.stacks[stack]) }));
  if (!plan.length) return plan;
  const supported = [...new Set(scope.stacks.flatMap(s => Object.keys((cfg.stacks[s] || {}).gates || {})))];
  assertRequestedGates(options, supported, scope.stacks);
  assertResolvedGates([...new Set(plan.flatMap(p => p.gates))], options);
  return plan;
}

/**
 * Whether a scoped file is one a gate would actually read. `resolveScope` keeps
 * every file under a stack root whatever its extension, but each gate then
 * filters that list against the stack's `SOURCE_FILE_RE`, so a scope of
 * `src/theme.css` reaches the gates and is discarded by all of them. The regex
 * is read from the registry at call time, and a stack whose adapter exports
 * none leaves its files counted — the same fallback `runG5` uses above, so a
 * third-party registered adapter keeps serving the runs it served before.
 */
function sourcePredicate(cfg) {
  return (rel) => {
    const sourceRe = (ADAPTERS[fileStack(rel, cfg)] || {}).SOURCE_FILE_RE;
    return sourceRe ? sourceRe.test(rel) : true;
  };
}

/**
 * A scope holding no file any scoped adapter considers source means no gate can
 * run, and a report built from no gate results is byte-identical to one where
 * every gate passed and found nothing. An unmeasured run has no verdict, so it
 * must never be handed the passing one — it is raised here, before gate
 * selection, so the message names the real cause (the scope) rather than
 * surfacing as a downstream gate-selection complaint.
 */
function assertNonEmptyScope(scope, isSource) {
  if (scope.files.some(isSource)) return;
  const ref = scope.baseRef ? ` ${scope.baseRef}` : '';
  throw new Error(`scope resolved to zero gateable files (${scope.kind}${ref}) — `
    + 'nothing was measured, so this run has no verdict');
}

function run({ root, options, io }) {
  io = { root, ...io };
  const detected = detectPackages(root);
  const cfg = loadConfig(root, detected);
  const scope = resolveScope(options, cfg, { root, gitDiff: io.gitDiff, listFiles: io.listFiles });
  assertNonEmptyScope(scope, sourcePredicate(cfg));
  const gateResults = [];
  for (const { stack, gates } of resolveGatePlan(options, cfg, scope)) {
    const stackCfg = cfg.stacks[stack];
    const stackFiles = scope.files.filter(f => fileStack(f, cfg) === stack);
    for (const gate of gates) gateResults.push(runGate(gate, stack, stackFiles, stackCfg, io));
  }
  const report = buildReport({ scope, gateResults, now: io.now || new Date().toISOString(), version: io.version || '0.1.0' });
  // A gate that could not execute produced no verdict at all. Folding that into
  // 0 makes "measured nothing" read exactly like "measured everything and found
  // it clean", so an errored gate gets its own code — and unlike missing_tool it
  // is not something the caller opted into, so `--require-tools` does not gate it.
  const exitCode = report.summary.status === 'blocked' ? 1
    : report.summary.status === 'error' ? 4
    : (options.requireTools && report.summary.gatesMissingTool.length ? 2 : 0);
  return { report, exitCode };
}

module.exports = { run, registerAdapter, assertNonEmptyScope, sourcePredicate };
