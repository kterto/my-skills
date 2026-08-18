'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { detectStacks } = require('./detect.cjs');
const { loadConfig } = require('./config.cjs');
const { resolveScope, fileStack } = require('./scope.cjs');
const { selectGates } = require('./gates/registry.cjs');
const { scanNoComments } = require('./gates/g5-no-comments.cjs');
const { buildReport } = require('./report.cjs');
/** Plan 2/3: register real adapters here. */
let ADAPTERS = {};
function registerAdapter(stack, adapter) { ADAPTERS[stack] = adapter; }
registerAdapter('node-ts', require('./adapters/node-ts.cjs'));
registerAdapter('dart-flutter', require('./adapters/dart-flutter.cjs'));

function runGate(gate, stack, files, stackCfg, io) {
  if (gate === 'G5') {
    const findings = files.flatMap(rel => {
      const content = fs.readFileSync(path.join(io.root, rel), 'utf8');
      return scanNoComments({ file: rel, content });
    });
    return { gate, name: 'no-comments', stack, status: findings.length ? 'fail' : 'pass', tool: 'builtin', findings };
  }
  const adapter = ADAPTERS[stack];
  if (adapter && adapter.supports(gate)) return adapter.run(gate, files, stackCfg, io);
  return { gate, name: gate, stack, status: 'missing_tool', tool: (stackCfg.gates[gate] || {}).tool || 'unknown',
           findings: [], installHint: `adapter for ${stack} ${gate} not installed — run with --scaffold` };
}

function run({ root, options, io }) {
  io = { root, ...io };
  const detected = detectStacks(root);
  const cfg = loadConfig(root, detected);
  const scope = resolveScope(options, cfg, { root, gitDiff: io.gitDiff, listFiles: io.listFiles });
  const gateResults = [];
  for (const stack of scope.stacks) {
    const stackCfg = cfg.stacks[stack];
    const stackFiles = scope.files.filter(f => fileStack(f, cfg) === stack);
    for (const gate of selectGates(options, stackCfg)) gateResults.push(runGate(gate, stack, stackFiles, stackCfg, io));
  }
  const report = buildReport({ scope, gateResults, now: io.now || new Date().toISOString(), version: io.version || '0.1.0' });
  const exitCode = report.summary.status === 'blocked' ? 1
    : (options.requireTools && report.summary.gatesMissingTool.length ? 2 : 0);
  return { report, exitCode };
}

module.exports = { run, registerAdapter };
