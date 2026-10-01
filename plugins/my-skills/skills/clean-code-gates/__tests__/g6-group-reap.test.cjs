'use strict';
// D9 (contract §4.3): G6's bound reaches the runner's whole process group. Real
// runs, nothing injected: a stub runner forks a `sleep 60` grandchild and hangs,
// and the budget is 2 s. Before the fix the bound killed only the direct child.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const nodeTs = require('../src/adapters/node-ts.cjs');
const dart = require('../src/adapters/dart-flutter.cjs');
const { defaultStackConfig } = require('../defaults.cjs');

// Writes its process group id and its grandchild's pid, then hangs.
const HANG = (d) => `#!/bin/sh\nps -o pgid= -p $$ > '${d}/g'\nsleep 60 &\necho $! > '${d}/gc'\nwait\n`;

function tmp(t) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-g6-reap-')));
  t.after(() => fs.promises.rm(d, { recursive: true, force: true, maxRetries: 5 }));
  return d;
}

function stub(dir, name, body) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, name), body, { mode: 0o755 });
}

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
}

async function gone(pid, ms) {
  const until = Date.now() + ms;
  while (alive(pid) && Date.now() < until) await new Promise((r) => setTimeout(r, 25));
  return !alive(pid);
}

const withBudget = (cfg, g6) => ({ ...cfg, gates: { ...cfg.gates, G6: { ...cfg.gates.G6, ...g6, budget: { totalSeconds: 2 } } } });

function onPath(t, dir) {
  const before = process.env.PATH;
  process.env.PATH = `${dir}:${before}`;
  t.after(() => { process.env.PATH = before; });
}

// A run whose stub never forked its grandchild (a host stalled past the 2 s budget before the stub's
// first lines ran) proves nothing about the reap either way, so it runs again, at most three times.
async function reaped(t, d, run) {
  let r;
  for (let attempt = 0; attempt < 3; attempt++) {
    r = run();
    if (fs.existsSync(path.join(d, 'gc'))) return assertReaped(t, d, r);
  }
  return assert.fail(`the stub never forked its grandchild inside the budget in 3 runs; last: ${JSON.stringify(r.measurement)}`);
}

async function assertReaped(t, d, r) {
  const g = Number(fs.readFileSync(path.join(d, 'g'), 'utf8'));
  const gc = Number(fs.readFileSync(path.join(d, 'gc'), 'utf8'));
  t.after(() => { try { process.kill(gc, 'SIGKILL'); } catch { /* gone */ } });
  assert.equal(r.status, 'error');
  assert.equal(r.measurement.state, 'unmeasured');
  assert.equal(r.measurement.reason, 'bounded');
  assert.equal(cp.spawnSync('pgrep', ['-g', String(g)]).status, 1, 'a process of the runner\'s group survived');
  assert.ok(await gone(gc, 3000), 'the runner\'s grandchild outlived the bound');
  return r;
}

/** A node-ts project whose Stryker is `script`, with a vitest runner installed. */
function strykerProject(d, script) {
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  const bin = path.join(d, 'node_modules', '.bin');
  stub(bin, 'stryker', script);
  stub(bin, 'vitest', '#!/bin/sh\nexit 0\n');
  const runner = path.join(d, 'node_modules', '@stryker-mutator', 'vitest-runner');
  fs.mkdirSync(runner, { recursive: true });
  fs.writeFileSync(path.join(runner, 'package.json'), '{"name":"@stryker-mutator/vitest-runner","main":"index.js"}');
  fs.writeFileSync(path.join(runner, 'index.js'), 'module.exports = {};\n');
  fs.mkdirSync(path.join(d, 'src'));
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  return () => nodeTs._internals.runG6(['src/a.ts'], withBudget(defaultStackConfig('node-ts')), { root: d });
}

test('node-ts: the Stryker bound kills the runner\'s grandchildren', async (t) => {
  const d = tmp(t);
  await reaped(t, d, strykerProject(d, HANG(d)));
});

test('node-ts: 20 MB of runner stderr never fills the buffer, so the bound holds and nothing reads as killed', async (t) => {
  // Past the 16 MiB buffer: a leader relaying all of it would be SIGKILLed by Node, its group left running unbounded.
  const d = tmp(t);
  await reaped(t, d, strykerProject(d, HANG(d).replace('\n', '\nhead -c 20971520 /dev/zero >&2\n')));
});

test('dart-flutter: the mutation_test bound kills the runner\'s grandchildren', async (t) => {
  const d = tmp(t);
  stub(path.join(d, 'bin'), 'dart', HANG(d));
  onPath(t, path.join(d, 'bin'));
  fs.mkdirSync(path.join(d, 'lib'));
  fs.writeFileSync(path.join(d, 'lib', 'calc.dart'), 'int f(int a) => a + 1;\n');
  await reaped(t, d, () => dart._internals.runG6(['lib/calc.dart'], withBudget(defaultStackConfig('dart-flutter')), { root: d }, {
    resolveFlutter: () => ({ cmd: 'flutter', pre: [] }), mutationTestAvailable: () => true,
  }));
});

test('dart-flutter: dart_mutant is bounded now, and its bound kills the grandchildren too', async (t) => {
  const d = tmp(t);
  stub(path.join(d, 'bin'), 'dart_mutant', HANG(d));
  onPath(t, path.join(d, 'bin'));
  fs.mkdirSync(path.join(d, 'lib'));
  fs.writeFileSync(path.join(d, 'lib', 'calc.dart'), 'int f(int a) => a + 1;\n');
  const cfg = withBudget(defaultStackConfig('dart-flutter'), { tool: 'dart_mutant' });
  const r = await reaped(t, d, () => dart._internals.runG6(['lib/calc.dart'], cfg, { root: d }, {
    resolveFlutter: () => ({ cmd: 'flutter', pre: [] }), commandExists: () => true,
  }));
  assert.equal(r.tool, 'dart_mutant');
});

test('dart-flutter: a dart_mutant runner killed inside its budget reads killed (SIGKILL), never a score or a bound', (t) => {
  const d = tmp(t);
  stub(path.join(d, 'bin'), 'dart_mutant', '#!/bin/sh\nkill -KILL $$\n');
  onPath(t, path.join(d, 'bin'));
  fs.mkdirSync(path.join(d, 'lib'));
  fs.writeFileSync(path.join(d, 'lib', 'calc.dart'), 'int f(int a) => a + 1;\n');
  const cfg = withBudget(defaultStackConfig('dart-flutter'), { tool: 'dart_mutant' });
  const r = dart._internals.runG6(['lib/calc.dart'], cfg, { root: d }, {
    resolveFlutter: () => ({ cmd: 'flutter', pre: [] }), commandExists: () => true,
  });
  assert.equal(r.status, 'error');
  assert.equal(r.measurement.reason, 'killed');
  assert.match(r.findings[0].message, /killed by SIGKILL/);
});
