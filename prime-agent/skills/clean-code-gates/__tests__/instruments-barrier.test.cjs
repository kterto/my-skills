'use strict';
// barrier (contract §5.6), over temp git repos. Tiers run a small node runner that
// writes jest-json from ./results.json, or Node's own runner with the junit reporter.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ignoreDesktopLitter } = require('./helpers/git-fixture.cjs');

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

const SRC = path.join(__dirname, '..', 'src', 'instruments');
const barrier = require(path.join(SRC, 'barrier.cjs'));
const { validateTier } = require(path.join(SRC, 'anchor.cjs'));
const { summarize } = require(path.join(SRC, 'envelope.cjs'));

const HELPER = path.join(__dirname, 'helpers', 'schema-validate.cjs');
const CLI = path.join(SRC, 'cli.cjs');
const SCHEMA = path.join(__dirname, '..', 'schema', 'barrier.schema.json');
const reports = [];

const GIT_ENV = { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.test',
  GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.test' };
const q = (s) => `'${s.replace(/'/g, "'\\''")}'`;
const NODE = q(process.execPath);

const RUNNER = `
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const [out, ...picked] = process.argv.slice(2);
const spec = JSON.parse(fs.readFileSync(process.env.RESULTS || 'results.json', 'utf8'));
if (process.env.ARGS_FILE) fs.appendFileSync(process.env.ARGS_FILE, JSON.stringify(picked) + '\\n');
if (spec.print) console.log(spec.print);
if (spec.hang) {
  const gc = cp.spawn('sleep', ['60'], { stdio: 'ignore' });
  const pgid = cp.execFileSync('ps', ['-o', 'pgid=', '-p', String(process.pid)], { encoding: 'utf8' }).trim();
  fs.appendFileSync(process.env.GC_FILE, gc.pid + ' ' + pgid + '\\n');
  fs.appendFileSync(process.env.SEQ_FILE, 'run\\n');
  setInterval(() => {}, 1000);
} else {
  const first = !process.env.COUNTER || !fs.existsSync(process.env.COUNTER);
  const root = process.env.RUNNER_ROOT || process.cwd();
  const one = (fullName, status, msg) => ({ fullName, status, failureMessages: msg ? [msg] : [] });
  const ran = ([f]) => (!picked.length || picked.includes(f)) && !(spec.skipFiles || []).includes(f);
  const testResults = Object.entries(spec.suites || {}).filter(ran).map(([f, s]) => {
    const wobbly = s.flakyOnce || [];
    const fail = [...(s.fail || []), ...(first ? wobbly : [])];
    const pass = [...(s.pass || []), ...(first ? [] : wobbly)];
    return { name: path.join(root, f), status: s.error || fail.length ? 'failed' : 'passed', message: s.error || '',
      assertionResults: s.error ? [] : [...pass.map((n) => one(n, 'passed')), ...(s.skip || []).map((n) => one(n, 'pending')),
        ...fail.map((n) => one(n, 'failed', s.msg || n + ' failed'))] };
  });
  if (!spec.noReport) fs.writeFileSync(out, JSON.stringify({ testResults }));
  if (process.env.COUNTER) fs.writeFileSync(process.env.COUNTER, '1');
  process.exitCode = spec.exit ?? (testResults.some((r) => r.status === 'failed') ? 1 : 0);
}
`;

function tmp(t, prefix) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.promises.rm(d, { recursive: true, force: true, maxRetries: 5 }));
  return d;
}

function write(dir, files) {
  for (const [rel, body] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), typeof body === 'string' ? body : `${JSON.stringify(body)}\n`);
  }
}

function repo(t, files) {
  const dir = tmp(t, 'ccg-barrier-');
  const git = (...args) => cp.execFileSync('git', ['-C', dir, ...args], { env: GIT_ENV, encoding: 'utf8' }).trim();
  git('init', '-q', '--template=', '-b', 'main');
  git('config', 'commit.gpgsign', 'false');
  ignoreDesktopLitter(dir);
  write(dir, { 'app/runner.cjs': RUNNER, ...files });
  const commit = (msg) => { git('add', '-A'); git('commit', '-qm', msg); return git('rev-parse', 'HEAD'); };
  return { dir, git, commit, sha: commit('base') };
}

const tier = (over = {}) => ({ id: 'e2e', cwd: 'app', run: `${NODE} runner.cjs $REPORT $SELECT`, report: 'jest-json',
  scope: 'whole', bound_minutes: 1, ...over });

const selected = (over = {}) => tier({ id: 'mobile', scope: 'change-selected', whole_run: 'nightly on main',
  select: { tests: ['app/*.spec.js'], sources: ['app/lib/*.js'] }, ...over });

function barrierCtx(t, dir, sha, tiers, { args = [], onTimeout = 'not-done', env = {}, io = {} } = {}) {
  return {
    root: dir, args, base: { ref: 'main', sha },
    instruments: { source: 'defaults', from: null, digest: '0'.repeat(64), moves: [], barrier: { on_timeout: onTimeout, tiers },
      guards: [], live: null },
    outDir: path.join(dir, '.cleancode'), now: '2026-01-01T00:00:00Z', version: '0.0.0',
    env: { ...process.env, CCG_WORKTREE_DIR: tmp(t, 'ccg-wt-'), ...env }, io, signal: new AbortController().signal,
  };
}

async function runBarrier(t, dir, sha, tiers, opts = {}) {
  for (const x of tiers) assert.equal(validateTier(x, `barrier.tiers.${x.id}`), null, 'the fixture tier must be valid');
  const r = await barrier.run(barrierCtx(t, dir, sha, tiers, opts));
  reports.push(r.report);
  return r;
}

const suites = (map) => ({ suites: map });
const GREEN = suites({ 'a.spec.js': { pass: ['a works'] }, 'b.spec.js': { pass: ['b works'] } });
const B_RED = suites({ 'a.spec.js': { pass: ['a works'] }, 'b.spec.js': { fail: ['b works'] } });

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
}

// ---- classification against base ------------------------------------------

test('a suite red at the candidate and green at a worktree base is newly red, and fails the tier', async (t) => {
  const { dir, sha, git } = repo(t, { 'app/results.json': GREEN });
  write(dir, { 'app/results.json': B_RED });
  const r = await runBarrier(t, dir, sha, [tier({ base: { mode: 'worktree' } })]);
  const [e2e] = r.report.tiers;
  assert.equal(r.report.status, 'red');
  assert.equal(r.exitCode, 1);
  assert.deepEqual([e2e.result, e2e.reason], ['fail', 'assertion']);
  assert.deepEqual(e2e.newly_red, [{ file: 'app/b.spec.js', basis: 'base', failing: ['b works'], reproduced: false }]);
  assert.deepEqual(e2e.base, { source: 'worktree', tree: r.report.tree.baseTree, result: 'pass', reason: null,
    tests: { executed: 2, passed: 2, failed: 0, skipped: 0 } });
  assert.deepEqual(e2e.candidate.tests, { executed: 2, passed: 1, failed: 1, skipped: 0 });
  assert.deepEqual(e2e.candidate.suites, [{ file: 'app/b.spec.js', result: 'fail', executed: 1, failed: 1,
    failures: [{ name: 'b works', message: 'b works failed' }] }]);
  assert.equal(e2e.command, `${NODE} runner.cjs .cleancode/barrier/e2e.candidate.json `);
  assert.match(r.lines[0], /^BARRIER red · e2e fail \d+s \(newly red: app\/b\.spec\.js 1\/1\)$/);
  assert.ok(r.lines.includes('newly red: app/b.spec.js 1/1 — b works'));
  assert.ok(r.lines.includes('base: e2e worktree'));
  assert.equal(git('worktree', 'list').split('\n').length, 1, 'the base worktree was left behind');
});

test('a suite red by the same assertion at base is carried with its first red tree, and does not fail the tier', async (t) => {
  const red = suites({ 'a.spec.js': { pass: ['a works'], fail: ['a breaks'] } });
  const { dir, sha } = repo(t, { 'app/results.json': red });
  write(dir, { 'app/notes.txt': 'the candidate tree differs from the base tree\n' });
  const r = await runBarrier(t, dir, sha, [tier({ base: { mode: 'worktree' } })]);
  const [e2e] = r.report.tiers;
  assert.notEqual(r.report.tree.candidateTree, r.report.tree.baseTree);
  assert.deepEqual([r.report.status, r.exitCode, e2e.result, e2e.reason], ['pass', 0, 'pass', null]);
  assert.deepEqual(e2e.carried, [{ file: 'app/a.spec.js', failing: ['a breaks'], first_seen: r.report.tree.baseTree, owner: null }]);
  assert.deepEqual(e2e.newly_red, []);
  assert.ok(r.lines.includes(`carried: app/a.spec.js (since ${r.report.tree.baseTree.slice(0, 8)}, owner unassigned)`));
});

test('every red suite lands in exactly one list: error over fail, fail over error, new tests and new suites are newly red', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': suites({
    's1.spec.js': { fail: ['s1 x'] },
    's2.spec.js': { fail: ['s2 y'] },
    's3.spec.js': { error: 'Test suite failed to run: cannot load' },
    's4.spec.js': { fail: ['s4 p'], pass: ['s4 q'] },
    's6.spec.js': { pass: ['s6 f'] },
    's7.spec.js': { pass: ['s7 ok'] },
    's8.spec.js': { skip: ['s8 later'] },
  }) });
  write(dir, { 'app/results.json': suites({
    's1.spec.js': { fail: ['s1 x'] },
    's2.spec.js': { error: 'Test suite failed to run: boom' },
    's3.spec.js': { fail: ['s3 z'] },
    's4.spec.js': { fail: ['s4 p', 's4 q'] },
    's5.spec.js': { fail: ['s5 r'] },
    's6.spec.js': { fail: ['s6 f'] },
    's7.spec.js': { pass: ['s7 ok'] },
    's8.spec.js': { fail: ['s8 later'] },
  }) });
  const r = await runBarrier(t, dir, sha, [tier({ base: { mode: 'worktree' } })]);
  const [e2e] = r.report.tiers;
  assert.deepEqual(e2e.carried.map((c) => c.file), ['app/s1.spec.js']);
  assert.deepEqual(e2e.newly_red.map((n) => [n.file, n.basis]),
    ['s2', 's3', 's4', 's5', 's6', 's8'].map((s) => [`app/${s}.spec.js`, 'base']));
  assert.deepEqual(e2e.newly_red.find((n) => n.file === 'app/s2.spec.js').failing, [], 'an error suite has no failing test names');
  assert.equal(e2e.candidate.suites.find((s) => s.file === 'app/s2.spec.js').message, 'Test suite failed to run: boom');
  const listed = [...e2e.newly_red, ...e2e.carried].map((n) => n.file).concat(e2e.flaky);
  for (const s of e2e.candidate.suites) assert.equal(listed.filter((f) => f === s.file).length, 1, s.file);
  assert.equal(listed.length, e2e.candidate.suites.length);
  assert.equal(e2e.result, 'fail');
});

test('red suites and their lists sort by UTF-16 code unit, never by locale', async (t) => {
  const red = (n) => ({ fail: [`${n} breaks`] });
  const { dir, sha } = repo(t, { 'app/results.json': suites({ 'é.spec.js': red('é'), 'b.spec.js': red('b'),
    'B.spec.js': red('B'), 'a.spec.js': red('a') }) });
  const [e2e] = (await runBarrier(t, dir, sha, [tier()])).report.tiers;
  const order = ['app/B.spec.js', 'app/a.spec.js', 'app/b.spec.js', 'app/é.spec.js'];
  assert.deepEqual(e2e.candidate.suites.map((s) => s.file), order);
  assert.deepEqual(e2e.newly_red.map((n) => n.file), order);
});

// ---- base inheritance -------------------------------------------------------

test('a pass cached for the base tree is inherited through --cache, keyed without the base block, and the base never runs', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': GREEN });
  const cache = path.join(tmp(t, 'ccg-barrier-cache-'), 'shared', 'barrier-cache.json');
  const onMain = await runBarrier(t, dir, sha, [tier({ base: { mode: 'worktree' } })], { args: ['--cache', cache] });
  assert.equal(onMain.report.tree.candidateTree, onMain.report.tree.baseTree, 'the clean main tree');
  assert.deepEqual([onMain.report.tiers[0].result, onMain.report.tiers[0].base], ['pass', null], 'a green candidate needs no base');
  assert.ok(fs.existsSync(cache), 'the pass was not written to --cache');
  assert.ok(!fs.existsSync(path.join(dir, '.cleancode', 'barrier-cache.json')), 'the default cache was written despite --cache');
  write(dir, { 'app/results.json': B_RED });
  fs.rmSync(path.join(dir, '.cleancode', 'logs'), { recursive: true, force: true });
  // Only `base` changed, and its prepare would fail: the key must not see it, or the base runs and goes vacuous.
  const r = await runBarrier(t, dir, sha, [tier({ base: { mode: 'worktree', prepare: 'exit 9' } })], { args: ['--cache', cache] });
  const [e2e] = r.report.tiers;
  assert.deepEqual([e2e.base.source, e2e.base.result, e2e.newly_red[0].basis], ['inherited', 'pass', 'base']);
  assert.deepEqual(e2e.base.tests, { executed: 2, passed: 2, failed: 0, skipped: 0 });
  assert.ok(!fs.existsSync(path.join(dir, '.cleancode', 'logs', 'barrier-e2e-base.log')), 'the base ran anyway');
  assert.equal(r.report.timing.tiers.e2e.base_ms, undefined);
  assert.ok(r.lines.includes('base: e2e inherited'));
});

test('a cached fail is never inherited, and inherit-only with nothing to inherit is an unmeasured base', async (t) => {
  const red = suites({ 'a.spec.js': { fail: ['a breaks'] } });
  const { dir, sha } = repo(t, { 'app/results.json': red });
  const first = await runBarrier(t, dir, sha, [tier()]);
  const cache = JSON.parse(fs.readFileSync(path.join(dir, '.cleancode', 'barrier-cache.json'), 'utf8'));
  assert.ok(Object.values(cache.records).some((x) => x.tree === first.report.tree.baseTree && x.result === 'fail'));
  for (const r of [first, await runBarrier(t, dir, sha, [tier()])]) {
    const [e2e] = r.report.tiers;
    assert.deepEqual(e2e.base, { source: 'none', tree: r.report.tree.baseTree, result: 'not-run', reason: 'unmeasured', tests: null });
    assert.deepEqual(e2e.newly_red.map((n) => n.basis), ['no-base']);
  }
});

test('a pass recorded for selection {a} is inherited for {a} and never for {b}', async (t) => {
  const { dir, git, commit } = repo(t, {
    'app/lib/a.js': 'module.exports = 1;\n', 'app/lib/b.js': 'module.exports = 2;\n',
    'app/a.spec.js': "require('./lib/a.js');\n", 'app/b.spec.js': "require('./lib/b.js');\n",
    'app/results.json': GREEN,
  });
  const c0 = git('rev-parse', 'HEAD');
  write(dir, { 'app/lib/a.js': 'module.exports = 10;\n' });
  const c1 = commit('change a');
  const onMain = await runBarrier(t, dir, c0, [selected()]);
  assert.deepEqual([onMain.report.tiers[0].selection, onMain.report.tiers[0].result], [['app/a.spec.js'], 'pass']);
  write(dir, { 'app/lib/b.js': 'module.exports = 20;\n', 'app/results.json': B_RED });
  const forB = (await runBarrier(t, dir, c1, [selected()])).report.tiers[0];
  assert.deepEqual(forB.selection, ['app/b.spec.js']);
  assert.equal(forB.command, `${NODE} runner.cjs .cleancode/barrier/mobile.candidate.json 'b.spec.js'`);
  assert.deepEqual([forB.base.source, forB.newly_red[0].basis], ['none', 'no-base']);
  git('checkout', '--', 'app/lib/b.js');
  write(dir, { 'app/lib/a.js': 'module.exports = 11;\n', 'app/results.json': suites({ 'a.spec.js': { fail: ['a works'] } }) });
  const forA = (await runBarrier(t, dir, c1, [selected()])).report.tiers[0];
  assert.deepEqual(forA.selection, ['app/a.spec.js']);
  assert.deepEqual([forA.base.source, forA.newly_red[0].basis], ['inherited', 'base']);
});

test('a worktree base whose prepare overruns prepare_minutes is not-run (vacuous), and base.env overrides env at base', async (t) => {
  const { dir, sha, git } = repo(t, { 'app/results.json': GREEN, 'app/base-results.json': B_RED });
  write(dir, { 'app/results.json': B_RED });
  const hung = await runBarrier(t, dir, sha, [tier({ base: { mode: 'worktree', prepare: 'sleep 30', prepare_minutes: 0.02 } })]);
  const [e2e] = hung.report.tiers;
  assert.deepEqual(e2e.base, { source: 'worktree', tree: hung.report.tree.baseTree, result: 'not-run', reason: 'vacuous', tests: null,
    detail: 'prepare timed out' });
  assert.deepEqual(e2e.newly_red.map((n) => [n.file, n.basis]), [['app/b.spec.js', 'no-base']]);
  assert.equal(git('worktree', 'list').split('\n').length, 1, 'the base worktree was left behind');
  // At base, base.env points the runner at a results file where b fails the same way, so b is carried.
  const over = await runBarrier(t, dir, sha, [tier({ env: { RESULTS: 'results.json' },
    base: { mode: 'worktree', prepare: 'true', env: { RESULTS: 'base-results.json' } } })]);
  assert.deepEqual([over.report.tiers[0].base.result, over.report.tiers[0].carried.map((c) => c.file)], ['fail', ['app/b.spec.js']]);
});

// ---- non-results ---------------------------------------------------------

test('a runner that writes no report, or a report of 0 tests, is not-run (vacuous) with its boot evidence', async (t) => {
  const { dir, sha } = repo(t, {
    'app/broken.json': { noReport: true, exit: 1, print: 'Error: cannot boot the widget module' },
    'app/empty.json': { suites: {} },
  });
  // A passing report a crashed earlier run left behind: read as this run's, it would pass a runner that wrote none.
  const stale = path.join(dir, 'app', '.cleancode', 'barrier', 'broken.candidate.json');
  write(dir, { 'app/.cleancode/barrier/broken.candidate.json': { testResults: [{ name: path.join(dir, 'app', 'a.spec.js'),
    status: 'passed', message: '', assertionResults: [{ fullName: 'a works', status: 'passed', failureMessages: [] }] }] } });
  const r = await runBarrier(t, dir, sha, [tier({ id: 'broken', isolation: 'ephemeral', env: { RESULTS: 'broken.json' } }),
    tier({ id: 'empty', isolation: 'shared-dev', env: { RESULTS: 'empty.json' } })]);
  assert.deepEqual([r.report.status, r.exitCode, r.report.isolation], ['not-run', 4, 'shared-dev']);
  assert.ok(!fs.existsSync(stale), 'the stale report survived the run');
  const [broken, empty] = r.report.tiers;
  assert.deepEqual([broken.result, broken.reason, broken.candidate.result, broken.candidate.reason],
    ['not-run', 'vacuous', 'not-run', 'vacuous']);
  assert.equal(broken.candidate.tests, null);
  assert.equal(broken.candidate.evidence.exit, 1);
  assert.deepEqual(broken.candidate.evidence.head, ['Error: cannot boot the widget module']);
  assert.equal(broken.base, null);
  assert.deepEqual([empty.result, empty.reason], ['not-run', 'vacuous']);
  assert.deepEqual(empty.candidate.tests, { executed: 0, passed: 0, failed: 0, skipped: 0 });
});

test('an exit-code tier is weak evidence: unknown counts are not vacuous, a fail is newly red, and the summary says so', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': GREEN });
  const r = await runBarrier(t, dir, sha, [tier({ id: 'smoke', run: 'exit 3', report: 'exit-code' }),
    tier({ id: 'boot', run: 'exit 0', report: 'exit-code' })]);
  const [boot, smoke] = r.report.tiers;
  const unknown = { executed: null, passed: null, failed: null, skipped: null };
  assert.deepEqual([boot.result, boot.candidate.tests], ['pass', unknown], 'an unknown count is not 0 executed');
  assert.deepEqual([smoke.result, smoke.candidate.tests], ['fail', unknown]);
  assert.deepEqual(smoke.newly_red, [{ file: 'smoke', basis: 'no-base', failing: [], reproduced: false }]);
  assert.match(r.lines[0], /^BARRIER red · boot pass \d+s \(exit-code only\) · smoke fail \d+s \(newly red: smoke \?\/\?\) \(exit-code only\)$/);
  assert.ok(r.lines.includes('newly red: smoke ?/? — exit 3'));
});

test('a change-selected tier with an empty selection is not-run (empty-scope), runs nothing, and the barrier passes', async (t) => {
  const { dir, sha } = repo(t, { 'app/lib/a.js': 'module.exports = 1;\n', 'app/a.spec.js': "require('./lib/a.js');\n",
    'app/results.json': GREEN });
  // Its isolation does not count: only a tier that ran sets the report's.
  const r = await runBarrier(t, dir, sha, [selected({ isolation: 'shared-dev' })]);
  const [mobile] = r.report.tiers;
  assert.deepEqual([r.report.status, r.exitCode, mobile.result, mobile.reason], ['pass', 0, 'not-run', 'empty-scope']);
  assert.deepEqual([mobile.selection, mobile.candidate, mobile.base, r.report.isolation], [[], null, null, null]);
  assert.deepEqual(r.report.timing.tiers.mobile, {});
  assert.equal(r.lines[0], 'BARRIER pass · mobile change-selected not-run (empty-scope)');
  assert.ok(!fs.existsSync(path.join(dir, '.cleancode', 'logs')), 'an empty scope ran something');
});

test('a hung tier is not-run (timeout) with 0 survivors in its group, and cleanup runs after every timed-out attempt', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': { hang: true } });
  let pids = [];
  t.after(() => pids.forEach((pid) => { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }));
  const scratch = tmp(t, 'ccg-barrier-hang-');
  const [gcFile, seqFile] = [path.join(scratch, 'gc'), path.join(scratch, 'seq')];
  const r = await runBarrier(t, dir, sha, [tier({ bound_minutes: 0.02, isolation: 'ephemeral',
    cleanup: `echo cleanup >> ${q(seqFile)}`, env: { GC_FILE: gcFile, SEQ_FILE: seqFile } })], { onTimeout: 'retry-2x' });
  const groups = fs.readFileSync(gcFile, 'utf8').trim().split('\n').map((line) => line.split(' ').map(Number));
  pids = groups.map(([gc]) => gc);
  const [e2e] = r.report.tiers;
  assert.deepEqual([r.report.status, r.exitCode, e2e.result, e2e.reason], ['not-run', 4, 'not-run', 'timeout']);
  assert.deepEqual(e2e.candidate.bounded, { bound_minutes: 0.04, timed_out: true, survivors: 0 });
  assert.equal(e2e.candidate.evidence.exit, 124);
  assert.equal(fs.readFileSync(seqFile, 'utf8'), 'run\ncleanup\nrun\ncleanup\n', 'cleanup must run before the retry and after it');
  assert.deepEqual(e2e.cleanup, [{ side: 'candidate', exit: 0 }, { side: 'candidate', exit: 0 }]);
  assert.equal(groups.length, 2, 'both attempts ran');
  for (const [gc, pgid] of groups) {
    assert.ok(!alive(gc), 'the hung runner\'s grandchild survived');
    assert.equal(cp.spawnSync('pgrep', ['-g', String(pgid)]).status, 1, 'a process of the tier\'s group survived');
  }
  assert.equal(r.report.isolation, 'ephemeral');
  assert.match(r.lines[0], /^BARRIER not-run · e2e not-run \(timeout\) \d+s · isolation: ephemeral$/);
  assert.ok(r.lines.includes('timeout: e2e after 0.04m, survivors 0'));
  assert.ok(r.report.timing.tiers.e2e.cleanup_ms >= 0);
});

// ---- the rest ------------------------------------------------------------

test('runner_cwd maps a container\'s report paths into the repo, and a path outside it is vacuous', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': B_RED });
  const mapped = await runBarrier(t, dir, sha, [tier({ runner_cwd: '/srv/app', env: { RUNNER_ROOT: '/srv/app' } })]);
  assert.deepEqual(mapped.report.tiers[0].newly_red.map((n) => n.file), ['app/b.spec.js']);
  const outside = await runBarrier(t, dir, sha, [tier({ runner_cwd: '/srv/app', env: { RUNNER_ROOT: '/srv/other' } })]);
  assert.deepEqual([outside.report.tiers[0].result, outside.report.tiers[0].reason], ['not-run', 'vacuous']);
});

test('runner_cwd with a worktree base is a config error (exit 3)', async (t) => {
  const { dir } = repo(t, { 'app/results.json': GREEN });
  const file = path.join(tmp(t, 'ccg-barrier-from-'), 'instruments.json');
  write(path.dirname(file), { 'instruments.json': { barrier: { tiers: [tier({ runner_cwd: '/srv/app', base: { mode: 'worktree' } })] },
    guards: [], live: null } });
  let stderr = '';
  const code = await require(CLI).main('barrier', ['--base', 'main', '--instruments-from', `file:${file}`],
    { cwd: dir, stdout: () => {}, stderr: (s) => { stderr += s; } });
  assert.equal(code, 3);
  assert.match(stderr, /runner_cwd/);
});

test('the flake rule reruns the newly red suites once: a pass is flaky, a second fail is reproduced', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': suites({
    'broken.spec.js': { fail: ['stays broken'] }, 'wobbly.spec.js': { flakyOnce: ['wobbles'] }, 'fine.spec.js': { pass: ['fine'] },
  }) });
  const counter = path.join(tmp(t, 'ccg-barrier-counter-'), 'ran-once');
  const r = await runBarrier(t, dir, sha, [tier({ rerun: `${NODE} runner.cjs $REPORT $SELECT`, env: { COUNTER: counter } })]);
  const [e2e] = r.report.tiers;
  assert.deepEqual(e2e.flaky, ['app/wobbly.spec.js']);
  assert.deepEqual(e2e.newly_red, [{ file: 'app/broken.spec.js', basis: 'no-base', failing: ['stays broken'], reproduced: true }]);
  assert.equal(e2e.result, 'fail');
  assert.ok(r.report.timing.tiers.e2e.rerun_ms >= 0);
  assert.ok(fs.existsSync(path.join(dir, '.cleancode', 'logs', 'barrier-e2e-rerun.log')), 'the rerun never ran');
  assert.ok(!fs.existsSync(path.join(dir, 'app', '.cleancode')), 'the rerun left its report directory behind');
});

test('Node\'s junit reporter in a nested runner: top-level cases join the tier\'s pseudo-suite, rerun without $SELECT', async (t) => {
  const ok = "const { test } = require('node:test');\ntest('adds', () => { if (1 + 1 !== 2) throw new Error('math'); });\n";
  const { dir, sha } = repo(t, { 'unit/math.test.cjs': ok });
  write(dir, { 'unit/math.test.cjs': `${ok}test('adds wrongly', () => { if (1 + 1 !== 3) throw new Error('expected 3'); });\n` });
  const run = `${NODE} --test --test-reporter=junit --test-reporter-destination=$REPORT`;
  const r = await runBarrier(t, dir, sha, [tier({ id: 'node', cwd: 'unit', run, rerun: `${run} $SELECT`, report: 'junit',
    base: { mode: 'worktree' } })], { env: { NODE_TEST_CONTEXT: 'child-v8' } });
  const [node] = r.report.tiers;
  assert.deepEqual(node.candidate.tests, { executed: 2, passed: 1, failed: 1, skipped: 0 }, 'the nested runner wrote its report');
  assert.deepEqual(node.base.tests, { executed: 1, passed: 1, failed: 0, skipped: 0 });
  assert.deepEqual(node.newly_red, [{ file: 'node', basis: 'base', failing: ['adds wrongly'], reproduced: true }]);
});

test('the engine deletes the reports and the directories it created, and keeps a .cleancode/ the project tracks', async (t) => {
  const { dir, sha, git } = repo(t, { 'app/results.json': GREEN, 'app/.cleancode/keep.txt': 'tracked\n', 'lib/results.json': GREEN,
    'lib/runner.cjs': RUNNER });
  await runBarrier(t, dir, sha, [tier({ base: { mode: 'worktree' } }), tier({ id: 'lib', cwd: 'lib' })]);
  assert.deepEqual(fs.readdirSync(path.join(dir, 'app', '.cleancode')), ['keep.txt']);
  assert.ok(!fs.existsSync(path.join(dir, 'lib', '.cleancode')));
  assert.equal(git('status', '--porcelain', '--untracked-files=all', '--', 'app', 'lib'), '');
});

test('secrets are redacted from the log head and tail and from failure messages', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': {
    print: 'booting with token=synthetic-secret-3',
    suites: { 'a.spec.js': { fail: ['a leaks'], msg: 'connect failed password=synthetic-secret-4' } },
  } });
  const r = await runBarrier(t, dir, sha, [tier()]);
  const json = JSON.stringify(r.report);
  assert.doesNotMatch(json, /synthetic-secret-3|synthetic-secret-4/);
  assert.match(r.report.tiers[0].candidate.evidence.head[0], /^booting with /);
  assert.match(r.report.tiers[0].candidate.suites[0].failures[0].message, /^connect failed /);
});

test('the summary stays within 2,048 bytes over 20 KB of details, keeping the verdict and the report path', async (t) => {
  const many = {};
  for (let i = 0; i < 300; i += 1) many[`widget-${String(i).padStart(3, '0')}-renders-every-state.spec.js`] = { fail: [`widget ${i} renders its state`] };
  many['widget-many.spec.js'] = { fail: Array.from({ length: 55 }, (_, i) => `widget case ${i}`) };
  const { dir, sha } = repo(t, { 'app/results.json': suites(many) });
  const r = await runBarrier(t, dir, sha, [tier()]);
  assert.ok(Buffer.byteLength(r.lines.join('\n')) >= 20 * 1024);
  const out = summarize(r.lines, '.cleancode/barrier.json');
  const lines = out.trimEnd().split('\n');
  assert.ok(Buffer.byteLength(out) <= 2048, `${Buffer.byteLength(out)} bytes`);
  assert.match(lines[0], /^BARRIER red · e2e fail \d+s \(newly red: app\/widget-000-renders-every-state\.spec\.js 1\/1, \+300 more\)$/);
  assert.equal(lines.at(-1), 'report → .cleancode/barrier.json');
  const big = r.report.tiers[0].candidate.suites.find((s) => s.file === 'app/widget-many.spec.js');
  assert.deepEqual([big.failed, big.failures.length, big.truncated], [55, 50, 5], 'failures are capped at 50 per suite');
});

test('no tiers, or an unknown --tier, is a config error the CLI turns into exit 3', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': GREEN });
  await assert.rejects(runBarrier(t, dir, sha, []), /^Error: no barrier tiers declared at main \(\.cleancode-gates\.json → barrier\.tiers\)$/);
  await assert.rejects(runBarrier(t, dir, sha, [tier()], { args: ['--tier', 'e2e,nope'] }), /no tier "nope"/);
  await assert.rejects(runBarrier(t, dir, sha, [tier()], { args: ['--tiers', 'e2e'] }), /unknown flag --tiers/);
  const only = await runBarrier(t, dir, sha, [tier(), tier({ id: 'other' })], { args: ['--tier', 'other'] });
  assert.deepEqual(only.report.tiers.map((x) => x.id), ['other']);
});

// ---- a runner killed mid-run, selected suites that never ran, what the selection could not prove ----------------

test('a runner that died mid-run is not-run (vacuous) whatever its report says: exit >= 128, or a signal', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': GREEN, 'app/exit137.json': { ...GREEN, exit: 137 } });
  const r = await runBarrier(t, dir, sha, [tier({ id: 'code', env: { RESULTS: 'exit137.json' } }),
    tier({ id: 'killed', run: `${NODE} runner.cjs $REPORT; kill -KILL $$` })]);
  const [code, killed] = r.report.tiers;
  assert.deepEqual([r.report.status, r.exitCode], ['not-run', 4]);
  assert.deepEqual([code.result, code.reason, code.detail, code.candidate.evidence.exit], ['not-run', 'vacuous', 'the runner died (exit 137)', 137]);
  assert.deepEqual([killed.result, killed.reason, killed.detail], ['not-run', 'vacuous', 'the runner died (exit 137, SIGKILL)']);
  assert.match(r.lines[0], /^BARRIER not-run · code not-run \(vacuous: the runner died \(exit 137\)\) \d+s · killed not-run/);
});

/** A repo whose change reaches both specs, so both are selected. */
function twoSelected(t, results) {
  const { dir, sha } = repo(t, { 'app/lib/a.js': 'module.exports = 1;\n', 'app/lib/b.js': 'module.exports = 2;\n',
    'app/a.spec.js': "require('./lib/a.js');\n", 'app/b.spec.js': "require('./lib/b.js');\n", 'app/results.json': results });
  write(dir, { 'app/lib/a.js': 'module.exports = 10;\n', 'app/lib/b.js': 'module.exports = 20;\n' });
  return { dir, sha };
}

test('a change-selected tier whose runner skipped a selected file is not-run (vacuous), naming the file', async (t) => {
  const { dir, sha } = twoSelected(t, { ...GREEN, skipFiles: ['b.spec.js'] });
  const r = await runBarrier(t, dir, sha, [selected()]);
  const [mobile] = r.report.tiers;
  assert.deepEqual(mobile.selection, ['app/a.spec.js', 'app/b.spec.js']);
  assert.deepEqual([mobile.result, mobile.reason, mobile.candidate.missing], ['not-run', 'vacuous', ['app/b.spec.js']]);
  assert.equal(r.lines[0].split(' · ')[1].replace(/ \d+s$/, ''), 'mobile change-selected not-run (vacuous: 1 selected file never ran)');
  assert.deepEqual([r.report.status, r.exitCode], ['not-run', 4]);
});

test('an empty selection with unresolved imports is not-run (unmeasured); every change-selected tier carries its count', async (t) => {
  const { dir, sha } = repo(t, { 'app/lib/a.js': 'module.exports = 1;\n', 'app/lib/c.js': 'module.exports = 3;\n',
    'app/a.spec.js': "require('./lib/a.js');\n", 'app/b.spec.js': "require('./lib/nowhere.js');\n", 'app/results.json': GREEN });
  write(dir, { 'app/lib/c.js': 'module.exports = 30;\n' });
  const r = await runBarrier(t, dir, sha, [selected()]);
  const [mobile] = r.report.tiers;
  assert.deepEqual([mobile.selection, mobile.unresolved, mobile.result, mobile.reason], [[], 1, 'not-run', 'unmeasured']);
  assert.deepEqual([r.report.status, r.exitCode, mobile.candidate], ['not-run', 4, null]);
  assert.equal(r.lines[0], 'BARRIER not-run · mobile change-selected not-run (unmeasured: 1 unresolved import)');
  write(dir, { 'app/lib/a.js': 'module.exports = 10;\n' });
  const ran = (await runBarrier(t, dir, sha, [selected(), tier({ id: 'whole' })])).report.tiers;
  assert.deepEqual(ran.map((x) => [x.id, x.selection, x.unresolved, x.result]),
    [['mobile', ['app/a.spec.js'], 1, 'pass'], ['whole', null, null, 'pass']]);
});

test('each change-selected tier records its whole_run, and a whole tier records null', async (t) => {
  const { dir, sha } = twoSelected(t, GREEN);
  const r = await runBarrier(t, dir, sha, [selected(), tier()]);
  assert.deepEqual(r.report.tiers.map((x) => [x.id, x.whole_run]), [['e2e', null], ['mobile', 'nightly on main']]);
});

test('a selection that names the whole tier runs it with $SELECT empty, skips the ran-every-file check, and keeps unmapped', async (t) => {
  const { dir, sha } = twoSelected(t, { suites: { 'a.spec.js': { pass: ['a works'] } } });
  const args = path.join(tmp(t, 'ccg-barrier-args-'), 'args');
  const selectTests = () => ({ selected: [{ file: 'app/a.spec.js' }, { file: 'app/b.spec.js' }], whole: 'whole_on app/package.json',
    unmapped: ['app/notes.txt'], unresolved: 0 });
  const r = await runBarrier(t, dir, sha, [selected({ env: { ARGS_FILE: args } })], { io: { selectTests } });
  const [mobile] = r.report.tiers;
  assert.equal(fs.readFileSync(args, 'utf8'), '[]\n', 'a whole selection still passed files to the runner');
  assert.equal(mobile.command, `${NODE} runner.cjs .cleancode/barrier/mobile.candidate.json `);
  assert.deepEqual([mobile.result, mobile.selection, mobile.unmapped], ['pass', ['app/a.spec.js', 'app/b.spec.js'], ['app/notes.txt']]);
});

test('a selected path with $&, $\' or $$ in its name reaches the runner byte for byte', async (t) => {
  const name = "w$&x$'y$$.spec.js";
  const { dir, sha } = repo(t, { 'app/lib/a.js': 'module.exports = 1;\n', [`app/${name}`]: "require('./lib/a.js');\n",
    'app/results.json': suites({ [name]: { pass: ['odd name works'] } }) });
  write(dir, { 'app/lib/a.js': 'module.exports = 10;\n' });
  const r = await runBarrier(t, dir, sha, [selected()]);
  const [mobile] = r.report.tiers;
  assert.equal(mobile.command, `${NODE} runner.cjs .cleancode/barrier/mobile.candidate.json ${q(name)}`);
  assert.deepEqual([mobile.result, mobile.candidate.tests.executed], ['pass', 1]);
});

// ---- a branch cannot take the barrier down ----------------------------------------------------

test('a tier whose cwd is missing, or whose tests glob matches nothing, is not-run (vacuous); the other tiers still run', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': GREEN });
  const nowhere = selected({ id: 'nowhere', select: { tests: ['app/none/*.spec.js'], sources: ['app/*.js'] } });
  const r = await runBarrier(t, dir, sha, [tier({ id: 'gone', cwd: 'moved' }), nowhere, tier()]);
  const byId = Object.fromEntries(r.report.tiers.map((x) => [x.id, [x.result, x.reason, x.detail, x.candidate]]));
  assert.deepEqual(byId, {
    e2e: ['pass', null, null, byId.e2e[3]],
    gone: ['not-run', 'vacuous', 'cwd missing', null],
    nowhere: ['not-run', 'vacuous', 'select: tests glob matches no file: app/none/*.spec.js', null],
  });
  assert.deepEqual([r.report.status, r.exitCode], ['not-run', 4]);
  assert.ok(r.lines[0].includes('gone not-run (vacuous: cwd missing)'), r.lines[0]);
});

// ---- the select interface, end to end ---------------------------------------------------------

const BIN = path.join(__dirname, '..', 'bin', 'gates.cjs');
function gates(dir, args) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return cp.spawnSync(process.execPath, [BIN, ...args], { cwd: dir, env, encoding: 'utf8' });
}

test('through the CLI: a change-selected tier selects within its cwd and from the base\'s routes, prints unmapped files, '
  + 'runs whole on whole_on, and a missing cwd, an empty glob or a forged marker cannot take the barrier down', (t) => {
  const args = path.join(tmp(t, 'ccg-barrier-e2e-'), 'args');
  const controller = (more) => "import { Controller, Delete, Get } from '@nestjs/common';\n@Controller('widgets')\n"
    + `export class WidgetsController {\n  @Get(':id')\n  one() { return 1; }\n${more}}\n`;
  const api = selected({ id: 'api', env: { ARGS_FILE: args }, select: { tests: ['app/test/*.e2e-spec.ts'],
    sources: ['app/src/**/*.ts'], by: ['routes'], whole_on: ['app/package.json'] } });
  // Not this run's nonce, and the pre-nonce form: a runner's own output that reads like the leader's.
  const forged = tier({ id: 'forged',
    run: `printf '%s\\n' 'ccg-proc[0123456789abcdef]: signal=SIGKILL' 'ccg-proc: timeout after 1s' >&2; ${NODE} runner.cjs $REPORT` });
  const gone = tier({ id: 'gone', cwd: 'old', run: 'true', report: 'exit-code' });
  const nowhere = selected({ id: 'nowhere', run: 'true', report: 'exit-code',
    select: { tests: ['app/none/*.spec.js'], sources: ['app/src/**/*.ts'] } });
  const { dir } = repo(t, {
    '.cleancode-gates.json': { barrier: { tiers: [api, forged, gone, nowhere] } },
    'app/src/widgets.controller.ts': controller("  @Delete(':id')\n  remove() { return 2; }\n"),
    'app/test/widgets.e2e-spec.ts': "it('removes a widget', () => request(app).delete('/widgets/1'));\n",
    'app/test/orders.e2e-spec.ts': "it('lists orders', () => request(app).get('/orders'));\n",
    'app/results.json': suites({ 'test/widgets.e2e-spec.ts': { pass: ['removes a widget'] },
      'test/orders.e2e-spec.ts': { pass: ['lists orders'] } }),
    'old/keep.txt': 'the gone tier\'s directory\n', 'docs/notes.txt': 'v1\n',
  });
  fs.rmSync(path.join(dir, 'old'), { recursive: true });
  write(dir, { 'app/src/widgets.controller.ts': controller(''), 'app/fixtures/widget.txt': 'a fixture a test reads\n',
    'docs/notes.txt': 'v2\n' });
  const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
  const { validate } = require(HELPER);
  const run = () => {
    const r = gates(dir, ['barrier', '--base', 'main']);
    const report = JSON.parse(fs.readFileSync(path.join(dir, '.cleancode', 'barrier.json'), 'utf8'));
    assert.deepEqual(validate(schema, report), []);
    return { ...r, report, byId: Object.fromEntries(report.tiers.map((x) => [x.id, x])) };
  };

  const r = run();
  assert.equal(r.status, 4, r.stdout + r.stderr);
  const { api: a, forged: f, gone: g, nowhere: n } = r.byId;
  assert.deepEqual([a.result, a.selection, a.unmapped, a.unresolved],
    ['pass', ['app/test/widgets.e2e-spec.ts'], ['app/fixtures/widget.txt'], 0], 'the removed DELETE route, and only app/');
  assert.equal(fs.readFileSync(args, 'utf8'), '["test/widgets.e2e-spec.ts"]\n');
  assert.deepEqual([f.result, f.reason, f.candidate.bounded.timed_out, f.candidate.bounded.survivors], ['pass', null, false, 0]);
  assert.deepEqual([g.result, g.reason, g.detail], ['not-run', 'vacuous', 'cwd missing']);
  assert.deepEqual([n.result, n.reason, n.detail], ['not-run', 'vacuous', 'select: tests glob matches no file: app/none/*.spec.js']);
  const lines = r.stdout.split('\n');
  assert.match(lines[0], new RegExp('^BARRIER not-run · api change-selected pass \\d+s · forged pass \\d+s · gone not-run '
    + '\\(vacuous: cwd missing\\) · nowhere change-selected not-run \\(vacuous: select: tests glob matches no file: app/none/\\*\\.spec\\.js\\)$'));
  assert.ok(lines.includes('unmapped: api 1 (app/fixtures/widget.txt)'), r.stdout);
  assert.equal(r.stderr, '');

  write(dir, { 'app/package.json': '{}\n' });
  const whole = run();
  assert.deepEqual([whole.byId.api.result, whole.byId.api.selection, whole.byId.api.unmapped],
    ['pass', ['app/test/orders.e2e-spec.ts', 'app/test/widgets.e2e-spec.ts'], ['app/fixtures/widget.txt']]);
  assert.equal(fs.readFileSync(args, 'utf8').split('\n').at(-2), '[]', 'a whole_on change runs the tier whole, $SELECT empty');
});

test('the changed files are read before any tier runs, so a file an earlier tier writes is never the branch\'s change', async (t) => {
  const { dir, sha } = twoSelected(t, GREEN);
  const writer = tier({ id: 'a-writer', run: `echo stray > stray.txt && ${NODE} runner.cjs $REPORT` });
  const r = await runBarrier(t, dir, sha, [writer, selected()]);
  const mobile = r.report.tiers.find((x) => x.id === 'mobile');
  assert.ok(fs.existsSync(path.join(dir, 'app', 'stray.txt')), 'the writing tier did not run first');
  assert.deepEqual([mobile.result, mobile.selection, mobile.unmapped], ['pass', ['app/a.spec.js', 'app/b.spec.js'], []]);
});

test('a tier that selected nothing still prints the unmapped files a change left under its cwd', async (t) => {
  const { dir, sha } = repo(t, { 'app/lib/a.js': 'module.exports = 1;\n', 'app/a.spec.js': "require('./lib/a.js');\n",
    'app/results.json': GREEN });
  write(dir, { 'app/notes.txt': 'read at run time\n', 'app/data.json': '{}\n', 'other/x.txt': 'outside the tier\n' });
  const r = await runBarrier(t, dir, sha, [selected()]);
  const [mobile] = r.report.tiers;
  assert.deepEqual([mobile.result, mobile.reason, mobile.unmapped], ['not-run', 'empty-scope', ['app/data.json', 'app/notes.txt']]);
  assert.deepEqual(r.lines, ['BARRIER pass · mobile change-selected not-run (empty-scope)',
    'unmapped: mobile 2 (app/data.json, +1 more)']);
});

/** A post-checkout hook: `git worktree add` would run it at base, outside every bound. */
function hook(dir, body) {
  fs.mkdirSync(path.join(dir, '.git', 'hooks'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.git', 'hooks', 'post-checkout'), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
}

/** A checkout (smudge) filter on app/results.json, which `git worktree add` does run; `required` makes its failure the add's. */
const SEAM = { '.gitattributes': 'app/results.json filter=seam\n' };
function seam(git, smudge, required = false) {
  git('config', 'filter.seam.smudge', smudge);
  git('config', 'filter.seam.clean', 'cat');
  if (required) git('config', 'filter.seam.required', 'true');
}

test('the base worktree runs none of the repository\'s hooks, which no bound would cover', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': GREEN });
  write(dir, { 'app/results.json': B_RED });
  const marker = path.join(tmp(t, 'ccg-barrier-hook-'), 'ran');
  hook(dir, `touch ${q(marker)}`);
  const [e2e] = (await runBarrier(t, dir, sha, [tier({ base: { mode: 'worktree' } })])).report.tiers;
  assert.deepEqual([e2e.base.source, e2e.base.result, e2e.newly_red.map((n) => n.basis)], ['worktree', 'pass', ['base']]);
  assert.equal(fs.existsSync(marker), false, 'git worktree add ran the post-checkout hook');
});

test('a failing worktree add is a vacuous base with its error, and the candidate\'s red suites stay newly red (exit 1)', async (t) => {
  const { dir, sha, git } = repo(t, { 'app/results.json': GREEN, ...SEAM });
  write(dir, { 'app/results.json': B_RED });
  seam(git, 'echo "the checkout filter refused" >&2; exit 1', true);
  const r = await runBarrier(t, dir, sha, [tier({ base: { mode: 'worktree' } })]);
  const [e2e] = r.report.tiers;
  assert.deepEqual([r.exitCode, e2e.result, e2e.base.source, e2e.base.result, e2e.base.reason], [1, 'fail', 'worktree', 'not-run', 'vacuous']);
  assert.match(e2e.base.detail, /^git -c core\.hooksPath=\/dev\/null worktree add --detach <worktree> [0-9a-f]{40} failed: .*the checkout filter refused/);
  assert.deepEqual(e2e.newly_red.map((n) => [n.file, n.basis]), [['app/b.spec.js', 'no-base']]);
  assert.equal(git('worktree', 'list').split('\n').length, 1, 'the half-added worktree was left behind');
  assert.ok(r.lines.some((l) => l.startsWith('base: e2e worktree (vacuous: ')), r.lines.join('\n'));
});

/** A child node process running barrier.run over `tiers`, the way the CLI does. */
function barrierProcess(t, dir, sha, tiers, env) {
  const file = path.join(tmp(t, 'ccg-barrier-proc-'), 'run.cjs');
  const ctx = { ...barrierCtx(t, dir, sha, tiers), env: { ...process.env, ...env } };
  fs.writeFileSync(file, `require(${JSON.stringify(path.join(SRC, 'barrier.cjs'))}).run(${JSON.stringify(ctx)});\n`);
  const cleanEnv = { ...process.env };
  delete cleanEnv.NODE_TEST_CONTEXT;
  const h = cp.spawn(process.execPath, [file], { env: cleanEnv, stdio: 'ignore' });
  t.after(() => { try { process.kill(h.pid, 'SIGKILL'); } catch { /* gone */ } });
  return { h, exited: new Promise((r) => h.on('exit', (code, signal) => r({ code, signal }))) };
}

async function waitForFile(file, ms) {
  for (const until = Date.now() + ms; Date.now() < until; await new Promise((r) => setTimeout(r, 25))) if (fs.existsSync(file)) return true;
  return fs.existsSync(file);
}

test('a signal during the synchronous worktree add removes the worktree before the engine re-raises it', async (t) => {
  const { dir, sha, git } = repo(t, { 'app/results.json': GREEN, ...SEAM });
  write(dir, { 'app/results.json': B_RED });
  const scratch = tmp(t, 'ccg-barrier-sig-');
  seam(git, `touch ${q(path.join(scratch, 'adding'))}; sleep 1; cat`);
  const wt = tmp(t, 'ccg-wt-');
  const { h, exited } = barrierProcess(t, dir, sha, [tier({ base: { mode: 'worktree' } })], { CCG_WORKTREE_DIR: wt });
  assert.ok(await waitForFile(path.join(scratch, 'adding'), 20000), 'the worktree add never started');
  h.kill('SIGTERM');
  assert.equal((await exited).signal, 'SIGTERM', 'the engine must die of the signal it caught');
  assert.equal(git('worktree', 'list').split('\n').length, 1, 'the base worktree was left registered');
  assert.deepEqual(fs.readdirSync(wt), [], 'the base worktree was left on disk');
});

test('a tier interrupted mid-run gets its cleanup before the engine re-raises the signal', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': { hang: true } });
  const scratch = tmp(t, 'ccg-barrier-int-');
  const [gcFile, seqFile] = [path.join(scratch, 'gc'), path.join(scratch, 'seq')];
  t.after(() => { try { process.kill(Number(fs.readFileSync(gcFile, 'utf8').split(' ')[0]), 'SIGKILL'); } catch { /* gone */ } });
  const { h, exited } = barrierProcess(t, dir, sha, [tier({ cleanup: `echo cleanup >> ${q(seqFile)}` })],
    { GC_FILE: gcFile, SEQ_FILE: seqFile });
  assert.ok(await waitForFile(seqFile, 20000), 'the tier never started'); // the runner writes it after forking its grandchild
  h.kill('SIGTERM');
  assert.equal((await exited).signal, 'SIGTERM');
  assert.equal(fs.readFileSync(seqFile, 'utf8'), 'run\ncleanup\n', 'the interrupted tier\'s cleanup never ran');
});

// ---- behaviours a mutation once survived ------------------------------------------------------

test('the flake rerun hands the runner exactly the newly red suite files through $SELECT', async (t) => {
  const { dir, sha } = repo(t, { 'app/results.json': suites({
    'broken.spec.js': { fail: ['stays broken'] }, 'wobbly.spec.js': { flakyOnce: ['wobbles'] }, 'fine.spec.js': { pass: ['fine'] },
  }) });
  const scratch = tmp(t, 'ccg-barrier-rerun-');
  const env = { COUNTER: path.join(scratch, 'ran-once'), ARGS_FILE: path.join(scratch, 'args') };
  const r = await runBarrier(t, dir, sha, [tier({ rerun: `${NODE} runner.cjs $REPORT $SELECT`, env })]);
  assert.deepEqual(r.report.tiers[0].flaky, ['app/wobbly.spec.js']);
  assert.equal(fs.readFileSync(env.ARGS_FILE, 'utf8'), '[]\n["broken.spec.js","wobbly.spec.js"]\n');
  assert.ok(r.lines.includes('flaky: app/wobbly.spec.js 1/1 (green on rerun)'), r.lines.join('\n'));
});

test('carried needs a base suite red by assertion: the same test erroring at base leaves the candidate\'s fail newly red', async (t) => {
  const xml = (outcome) => `<testsuites><testsuite name="widgets" file="widget.test.js"><testcase name="widget saves">${outcome}`
    + '</testcase></testsuite></testsuites>';
  const { dir, sha } = repo(t, { 'app/junit.xml': xml('<error message="cannot boot"/>') });
  write(dir, { 'app/junit.xml': xml('<failure message="expected saved"/>') });
  const r = await runBarrier(t, dir, sha, [tier({ run: 'cp junit.xml $REPORT', report: 'junit', base: { mode: 'worktree' } })]);
  const [e2e] = r.report.tiers;
  assert.equal(e2e.base.result, 'fail', 'the base suite is red, by an error');
  assert.deepEqual(e2e.carried, []);
  assert.deepEqual(e2e.newly_red, [{ file: 'app/widget.test.js', basis: 'base', failing: ['widget saves'], reproduced: false }]);
});

// ---- scheduled whole runs: --whole, --if-changed and cache_scope ------------------------------

const lines = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : []);
const WHOLE_FILES = { 'app/lib/a.js': 'module.exports = 1;\n', 'app/a.spec.js': "require('./lib/a.js');\n",
  'app/b.spec.js': '// imports nothing\n', 'other/notes.txt': 'x\n' };

test('--whole runs a change-selected tier in full with $SELECT empty, compares nothing, and records a whole run', async (t) => {
  const { dir, sha } = repo(t, { ...WHOLE_FILES, 'app/results.json': B_RED });
  const argsFile = path.join(tmp(t, 'ccg-whole-'), 'args');
  const r = await runBarrier(t, dir, sha, [selected()], { args: ['--whole'], env: { ARGS_FILE: argsFile } });
  const [m] = r.report.tiers;
  assert.deepEqual(lines(argsFile), [[]], 'the runner was handed no selected path, so it ran every test');
  assert.deepEqual([m.whole, m.selection, m.inherited], [true, null, null]);
  assert.deepEqual([m.base.source, m.base.result, m.base.reason], ['none', 'not-run', 'unmeasured'], 'a whole run compares nothing');
  assert.deepEqual(m.newly_red.map((n) => [n.file, n.basis]), [['app/b.spec.js', 'no-base']], 'a red main is red: nothing carries it');
  assert.deepEqual([r.report.status, r.exitCode], ['red', 1]);
  assert.ok(r.lines[0].startsWith('BARRIER red · mobile whole fail'), r.lines[0]);
  const cache = JSON.parse(fs.readFileSync(path.join(dir, '.cleancode', 'barrier-cache.json'), 'utf8'));
  assert.deepEqual(Object.values(cache.records).map((x) => [x.selection, x.result]), [[null, 'fail']]);
});

test('--if-changed skips a tier whose folder already has a whole-run result, pass or fail, and runs once the folder changes', async (t) => {
  const { dir, sha, commit } = repo(t, { ...WHOLE_FILES, 'app/results.json': GREEN });
  const argsFile = path.join(tmp(t, 'ccg-ifchanged-'), 'args');
  const tiers = [selected({ cache_scope: 'cwd' })];
  const nightly = async (base) => {
    const r = await runBarrier(t, dir, base, tiers, { args: ['--whole', '--if-changed'], env: { ARGS_FILE: argsFile } });
    return { r, t: r.report.tiers[0], runs: lines(argsFile).length };
  };
  const first = await nightly(sha);
  assert.deepEqual([first.runs, first.t.result, first.t.inherited, first.r.exitCode], [1, 'pass', null, 0]);
  const again = await nightly(sha);
  assert.equal(again.runs, 1, 'an unchanged folder is not run again');
  assert.deepEqual([again.t.result, again.r.exitCode, again.t.candidate], ['pass', 0, null]);
  assert.match(again.t.inherited, /^[0-9a-f]{40}$/);
  assert.ok(again.r.lines[0].includes(`mobile whole pass (unchanged since a whole run at ${again.t.inherited.slice(0, 8)})`), again.r.lines[0]);
  write(dir, { 'other/notes.txt': 'y\n' });
  const outside = await nightly(commit('outside the folder'));
  assert.deepEqual([outside.runs, outside.t.inherited], [1, again.t.inherited], 'a commit outside the folder keeps its key');
  write(dir, { 'app/lib/a.js': 'module.exports = 2;\n', 'app/results.json': B_RED });
  const inside = await nightly(commit('inside the folder'));
  assert.deepEqual([inside.runs, inside.t.result, inside.t.inherited], [2, 'fail', null]);
  const redAgain = await nightly(inside.r.report.tree.base);
  assert.equal(redAgain.runs, 2, 'a cached fail at the same folder is reported again, never re-run until the inputs change');
  assert.deepEqual([redAgain.t.result, redAgain.r.exitCode, redAgain.t.newly_red.map((n) => n.file)], ['fail', 1, ['app/b.spec.js']]);
  assert.notEqual(redAgain.t.inherited, null);
  assert.ok(redAgain.r.lines.includes('newly red: app/b.spec.js (unchanged)'), redAgain.r.lines.join('\n'));
});

test('--if-changed repeats only a --whole run\'s record: a compared run at the same tree, selection null, is run again', async (t) => {
  const { dir, sha } = repo(t, { ...WHOLE_FILES, 'app/results.json': B_RED });
  const argsFile = path.join(tmp(t, 'ccg-provenance-'), 'args');
  const tiers = [tier({ id: 'unit' })];
  const qa = await runBarrier(t, dir, sha, tiers, { env: { ARGS_FILE: argsFile } });
  assert.equal(qa.report.tiers[0].result, 'fail');
  const nightly = await runBarrier(t, dir, sha, tiers, { args: ['--whole', '--if-changed'], env: { ARGS_FILE: argsFile } });
  assert.deepEqual([lines(argsFile).length, nightly.report.tiers[0].inherited], [2, null], 'QA\'s record is not a whole run\'s verdict');
  const cache = JSON.parse(fs.readFileSync(path.join(dir, '.cleancode', 'barrier-cache.json'), 'utf8'));
  assert.deepEqual(Object.values(cache.records).map((x) => [x.whole, x.result]), [[true, 'fail']]);
});

test('a compared run at a whole run\'s key leaves its record: the schedule does not re-run or re-report an unchanged red', async (t) => {
  const { dir, sha: m0, commit } = repo(t, { ...WHOLE_FILES, 'app/results.json': GREEN });
  write(dir, { 'app/lib/a.js': 'module.exports = 2;\n', 'app/results.json': B_RED });
  const m1 = commit('main goes red in b');
  const argsFile = path.join(tmp(t, 'ccg-keep-whole-'), 'args');
  const tiers = [selected({ cache_scope: 'cwd' })];
  const nightly = () => runBarrier(t, dir, m1, tiers, { args: ['--whole', '--if-changed'], env: { ARGS_FILE: argsFile } });
  assert.equal((await nightly()).report.tiers[0].result, 'fail');
  const [qa] = (await runBarrier(t, dir, m0, tiers, { env: { ARGS_FILE: argsFile } })).report.tiers;
  assert.deepEqual([qa.selection, qa.result], [['app/a.spec.js'], 'pass'], 'a QA run over the same folder, compared with an older base');
  const again = (await nightly()).report.tiers[0];
  assert.deepEqual([lines(argsFile).length, again.result], [2, 'fail']);
  assert.notEqual(again.inherited, null, 'still the whole run\'s verdict: nothing re-ran');
});

test('with cache_scope cwd a folder git does not hold as a tree (a symlink) is never cached, so --if-changed always runs it', async (t) => {
  const { dir, sha, git } = repo(t, { 'pkg/runner.cjs': RUNNER, 'pkg/a.spec.js': '// a\n', 'pkg/results.json': GREEN });
  fs.symlinkSync('pkg', path.join(dir, 'lnk'));
  git('add', '-A');
  git('commit', '-qm', 'lnk is a symlink');
  const head = git('rev-parse', 'HEAD');
  assert.notEqual(head, sha);
  const argsFile = path.join(tmp(t, 'ccg-symlink-'), 'args');
  const tiers = [selected({ cwd: 'lnk', cache_scope: 'cwd', env: { RUNNER_ROOT: path.join(dir, 'lnk') },
    select: { tests: ['lnk/*.spec.js'], sources: ['lnk/lib/*.js'] } })];
  for (let n = 0; n < 2; n += 1) {
    const [m] = (await runBarrier(t, dir, head, tiers, { args: ['--whole', '--if-changed'], env: { ARGS_FILE: argsFile } })).report.tiers;
    assert.deepEqual([m.result, m.inherited], ['pass', null]);
  }
  assert.equal(lines(argsFile).length, 2, 'a link\'s blob does not change with what it points to, so it is no key');
  assert.equal(fs.existsSync(path.join(dir, '.cleancode', 'barrier-cache.json')), false);
});

test('cache_scope tree, the default, keys by the whole tree: a commit outside the folder runs --if-changed again', async (t) => {
  const { dir, sha, commit } = repo(t, { ...WHOLE_FILES, 'app/results.json': GREEN });
  const argsFile = path.join(tmp(t, 'ccg-treekey-'), 'args');
  const nightly = (base) => runBarrier(t, dir, base, [selected()], { args: ['--whole', '--if-changed'], env: { ARGS_FILE: argsFile } });
  await nightly(sha);
  write(dir, { 'other/notes.txt': 'y\n' });
  await nightly(commit('outside the folder'));
  assert.equal(lines(argsFile).length, 2);
});

test('with cache_scope cwd a later QA base comparison inherits the whole pass across commits outside the folder; with tree it cannot', async (t) => {
  for (const scope of ['cwd', 'tree']) {
    const { dir, sha, commit } = repo(t, { ...WHOLE_FILES, 'app/results.json': GREEN });
    const tiers = [selected({ cache_scope: scope })];
    await runBarrier(t, dir, sha, tiers, { args: ['--whole'] });
    write(dir, { 'other/notes.txt': 'y\n' });
    const c1 = commit('outside the folder');
    write(dir, { 'app/lib/a.js': 'module.exports = 2;\n', 'app/results.json': suites({ 'a.spec.js': { fail: ['a works'] } }) });
    const [m] = (await runBarrier(t, dir, c1, tiers)).report.tiers;
    assert.deepEqual(m.selection, ['app/a.spec.js'], scope);
    assert.deepEqual([m.base.source, m.newly_red[0].basis], scope === 'cwd' ? ['inherited', 'base'] : ['none', 'no-base'], scope);
  }
});

test('--if-changed needs --whole, both flags take no value, and cache_scope is tree or cwd', async (t) => {
  const { dir, sha } = repo(t, { ...WHOLE_FILES, 'app/results.json': GREEN });
  await assert.rejects(runBarrier(t, dir, sha, [selected()], { args: ['--if-changed'] }), /--if-changed needs --whole/);
  await assert.rejects(runBarrier(t, dir, sha, [selected()], { args: ['--whole', 'yes'] }), /unknown flag yes/);
  assert.equal(validateTier(selected({ cache_scope: 'cwd' }), 't'), null);
  assert.equal(validateTier(selected({ cache_scope: 'tree' }), 't'), null);
  assert.match(validateTier(selected({ cache_scope: 'repo' }), 't'), /^t\.cache_scope: invalid value "repo"$/);
});

test('whole_minutes bounds a change-selected tier run whole, never below bound_minutes; a selected run keeps bound_minutes', async (t) => {
  const { dir, sha } = repo(t, { ...WHOLE_FILES, 'app/results.json': GREEN });
  write(dir, { 'app/lib/a.js': 'module.exports = 2;\n' });
  const bound = async (over, args = []) => {
    const [m] = (await runBarrier(t, dir, sha, [selected(over)], { args })).report.tiers;
    return [m.selection && m.selection.length, m.candidate.bounded.bound_minutes];
  };
  assert.deepEqual(await bound({ whole_minutes: 5 }), [1, 1], 'a selected run keeps bound_minutes');
  assert.deepEqual(await bound({ whole_minutes: 5 }, ['--whole']), [null, 5]);
  const wholeOn = { tests: ['app/*.spec.js'], sources: ['app/lib/*.js'], whole_on: ['app/lib/a.js'] };
  assert.deepEqual(await bound({ whole_minutes: 5, select: wholeOn }), [2, 5], 'a whole selection runs under whole_minutes too');
  assert.deepEqual(await bound({ whole_minutes: 5, bound_minutes: 7 }, ['--whole']), [null, 7], 'never below bound_minutes');
  assert.deepEqual(await bound({}, ['--whole']), [null, 1], 'without whole_minutes, bound_minutes');
  write(dir, { 'app/b.spec.js': '// changed, so selected too\n' });
  const past = (max) => ({ tests: ['app/*.spec.js'], sources: ['app/lib/*.js'], max });
  assert.deepEqual(await bound({ whole_minutes: 5, select: past(1) }), [2, 5], 'a selection past max is nearly whole');
  assert.deepEqual(await bound({ whole_minutes: 5, select: past(2) }), [2, 1], 'one within max keeps bound_minutes');
  assert.equal(validateTier(tier({ whole_minutes: 5 }), 't'), 't.whole_minutes: only allowed when scope is change-selected');
  assert.match(validateTier(selected({ whole_minutes: 0 }), 't'), /^t\.whole_minutes: /);
});

test('--if-changed repeats the verdict the whole run gave: a suite its rerun excused as flaky stays excused', async (t) => {
  const { dir, sha } = repo(t, { ...WHOLE_FILES,
    'app/results.json': suites({ 'a.spec.js': { pass: ['a works'] }, 'b.spec.js': { flakyOnce: ['b works'] } }) });
  const tiers = [selected({ rerun: `${NODE} runner.cjs $REPORT $SELECT` })];
  const opts = { args: ['--whole', '--if-changed'], env: { COUNTER: path.join(tmp(t, 'ccg-flaky-'), 'counter') } };
  const [first] = (await runBarrier(t, dir, sha, tiers, opts)).report.tiers;
  assert.deepEqual([first.inherited, first.result, first.flaky, first.newly_red], [null, 'pass', ['app/b.spec.js'], []]);
  const again = await runBarrier(t, dir, sha, tiers, opts);
  const [m] = again.report.tiers;
  assert.notEqual(m.inherited, null, 'nothing ran');
  assert.deepEqual([m.result, m.flaky, m.newly_red, again.exitCode], ['pass', ['app/b.spec.js'], [], 0]);
});

test('every report above validates against barrier.schema.json, which rejects one without a status', () => {
  const { validate } = require(HELPER);
  const schema = JSON.parse(fs.readFileSync(SCHEMA, 'utf8'));
  assert.ok(reports.length >= 10);
  for (const report of reports) assert.deepEqual(validate(schema, report), [], JSON.stringify(report.tiers.map((x) => x.id)));
  const { status, ...noStatus } = reports[0];
  assert.notDeepEqual(validate(schema, noStatus), []);
});
