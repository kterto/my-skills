'use strict';
// The bounded runner (contract §4.4). Every case runs real processes: the
// claims are about process groups, and an injected fake cannot fail them.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const PROC = path.join(__dirname, '..', 'src', 'instruments', 'proc.cjs');
const { runBounded, childEnv, parseLeaderMarkers, leaderArgv, LEADER_TIMEOUT_EXIT } = require(PROC);

// A grandchild that ignores SIGTERM, so only the SIGKILL after the grace stops it.
const STUBBORN = "(trap '' TERM; exec sleep 60) & echo $! > gc";

function tmp(t) {
  const d = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-proc-')));
  t.after(() => fs.promises.rm(d, { recursive: true, force: true, maxRetries: 5 }));
  return d;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const NONCE = crypto.randomBytes(8).toString('hex');
/** The nonce a run's leader wrote its markers with, read back from the log. */
const nonceIn = (log) => /ccg-proc\[([0-9a-f]{16})\]: /.exec(log)[1];
const readPid = (d, name) => Number(fs.readFileSync(path.join(d, name), 'utf8').trim());

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code !== 'ESRCH'; }
}

function killQuietly(pid) {
  try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ }
}

const groupRows = (pgid) => cp.execFileSync('ps', ['-A', '-o', 'pgid=,stat='], { encoding: 'utf8' })
  .split('\n').map((l) => l.trim().split(/\s+/)).filter(([g]) => Number(g) === pgid);

async function waitFor(pred, ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (pred()) return true;
    await sleep(25);
  }
  return pred();
}

/** 1 when no process is left in the group, the way §4.3 states the check. */
const pgrepGroup = (pgid) => cp.spawnSync('pgrep', ['-g', String(pgid)]).status;

/** A node process that calls runBounded, the way barrier, sweep and live do. */
function harness(t, d, command, spawnOpts = {}, runOpts = {}) {
  const file = path.join(d, 'harness.cjs');
  fs.writeFileSync(file, `
    const { runBounded } = require(${JSON.stringify(PROC)});
    runBounded({ command: ${JSON.stringify(command)}, cwd: ${JSON.stringify(d)}, boundMs: 60000,
                 graceMs: 300, logFile: ${JSON.stringify(path.join(d, 'run.log'))}, ...${JSON.stringify(runOpts)} });
  `);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const h = cp.spawn(process.execPath, [file], { env, stdio: 'ignore', ...spawnOpts });
  const exited = new Promise((r) => h.on('exit', (code, signal) => r({ code, signal })));
  t.after(() => killQuietly(h.pid));
  return { h, exited };
}

async function startedGroup(t, d) {
  assert.ok(await waitFor(() => fs.existsSync(path.join(d, 'gc')), 5000), 'the command never started');
  const pgid = readPid(d, 'g');
  const gc = readPid(d, 'gc');
  t.after(() => killQuietly(gc));
  assert.ok(alive(gc));
  return { pgid, gc };
}

test('a hung command is stopped at its bound, grandchild included, and the survivors are counted', async (t) => {
  const d = tmp(t);
  const r = await runBounded({
    command: `echo $$ > g; ${STUBBORN}; wait`, cwd: d, boundMs: 1000, graceMs: 300, logFile: path.join(d, 'run.log'),
  });
  const gc = readPid(d, 'gc');
  t.after(() => killQuietly(gc));
  assert.equal(r.timedOut, true);
  assert.equal(r.exitCode, LEADER_TIMEOUT_EXIT);
  assert.equal(r.signal, null, 'a bound is not a signal death');
  assert.strictEqual(r.survivors, 0);
  assert.ok(await waitFor(() => !alive(gc), 2000), 'the grandchild outlived the bound');
  assert.equal(pgrepGroup(readPid(d, 'g')), 1);
  assert.ok(r.ms >= 1000 && r.ms < 10000, `took ${r.ms} ms`);
});

test('a clean exit reaps the background grandchild it left behind', async (t) => {
  const d = tmp(t);
  const r = await runBounded({
    command: 'sleep 30 & echo $! > gc', cwd: d, boundMs: 20000, logFile: path.join(d, 'run.log'),
  });
  const gc = readPid(d, 'gc');
  t.after(() => killQuietly(gc));
  assert.equal(r.exitCode, 0);
  assert.equal(r.timedOut, false);
  assert.strictEqual(r.survivors, 0);
  assert.ok(await waitFor(() => !alive(gc), 2000), 'reap left the orphan running');
});

test('reap: false leaves the daemon running, counts it, and still returns promptly', async (t) => {
  const d = tmp(t);
  const started = Date.now();
  const r = await runBounded({
    command: 'sleep 30 & echo $! > gc', cwd: d, boundMs: 20000, reap: false, logFile: path.join(d, 'run.log'),
  });
  const gc = readPid(d, 'gc');
  t.after(() => killQuietly(gc));
  assert.ok(Date.now() - started < 5000, 'the engine waited on the daemon');
  assert.equal(r.exitCode, 0);
  assert.equal(r.survivors, 1, 'the daemon is counted, so a 0 elsewhere is a count too');
  assert.ok(alive(gc), 'reap: false killed the daemon');
});

test('without ps the leader still counts, by probing the group: 0 after a bound, 1 for a daemon left running', async (t) => {
  const d = tmp(t);
  const env = { ...process.env, PATH: tmp(t) }; // an empty directory: no ps, and no sleep either
  const hung = await runBounded({
    command: "echo $$ > g; (trap '' TERM; exec /bin/sleep 60) & echo $! > gc; wait", cwd: d, env, boundMs: 1000, graceMs: 300,
    logFile: path.join(d, 'hung.log'),
  });
  const gc = readPid(d, 'gc');
  t.after(() => killQuietly(gc));
  assert.deepEqual([hung.timedOut, hung.survivors], [true, 0]);
  assert.ok(!alive(gc), 'the grandchild outlived the bound');
  const daemon = await runBounded({
    command: 'echo $$ > g; /bin/sleep 30 & echo $! > gc', cwd: d, env, boundMs: 20000, reap: false, logFile: path.join(d, 'daemon.log'),
  });
  const pgid = readPid(d, 'g');
  t.after(() => killQuietly(-pgid));
  assert.strictEqual(daemon.survivors, 1, 'a group the probe finds alive is never counted as empty');
});

test('a zombie in the group is dead: reap: false counts the live daemon and not its unreaped child', async (t) => {
  const d = tmp(t);
  // The inner sh forks a short sleep, then execs a long one, which never waits: the short one ends a zombie in the group.
  const r = await runBounded({
    command: "echo $$ > g; sh -c 'sleep 0.2 & exec sleep 30' & sleep 0.6", cwd: d, boundMs: 20000, reap: false,
    logFile: path.join(d, 'run.log'),
  });
  const pgid = readPid(d, 'g');
  t.after(() => killQuietly(-pgid));
  assert.ok(groupRows(pgid).some(([, stat]) => stat.startsWith('Z')), 'the fixture left no zombie, so this proves nothing');
  assert.strictEqual(r.survivors, 1);
});

test('reap: false hands a daemon the log file, not a pipe: the engine exits, and the daemon writes on without EPIPE', async (t) => {
  const d = tmp(t);
  const { exited } = harness(t, d, 'echo $$ > g; (sleep 1; echo late daemon line; exec sleep 30) & echo $! > gc', {}, { reap: false });
  let done = null;
  exited.then((r) => { done = r; });
  const ended = await waitFor(() => done !== null, 5000);
  const pgid = readPid(d, 'g');
  t.after(() => killQuietly(-pgid));
  assert.ok(ended, 'the daemon held the engine open');
  assert.deepEqual(done, { code: 0, signal: null });
  const log = () => fs.readFileSync(path.join(d, 'run.log'), 'utf8');
  assert.ok(await waitFor(() => /^late daemon line$/m.test(log()), 3000), 'the daemon\'s output never reached the log file');
  assert.ok(alive(readPid(d, 'gc')), 'the daemon died writing its output');
});

test('the log carries the output, its hash, and a head and tail without the leader lines', async (t) => {
  const d = tmp(t);
  const logFile = path.join(d, 'run.log');
  const r = await runBounded({
    command: 'i=1; while [ $i -le 70 ]; do echo "line $i"; i=$((i+1)); done; exit 3', cwd: d, boundMs: 20000, logFile,
  });
  assert.equal(r.exitCode, 3);
  const buf = fs.readFileSync(logFile);
  assert.equal(r.logSha256, crypto.createHash('sha256').update(buf).digest('hex'));
  assert.match(buf.toString(), /^ccg-proc\[[0-9a-f]{16}\]: survivors=0$/m);
  assert.equal(r.head.length, 20);
  assert.equal(r.head[0], 'line 1');
  assert.equal(r.tail.length, 40);
  assert.equal(r.tail[39], 'line 70');
  assert.ok(![...r.head, ...r.tail].some((l) => l.startsWith('ccg-proc')));
  assert.equal(fs.statSync(logFile).mode & 0o777, 0o600);
});

test('a command that dies on a signal leaves the signal marker', async (t) => {
  const d = tmp(t);
  const r = await runBounded({ command: 'kill -KILL $$', cwd: d, boundMs: 20000, logFile: path.join(d, 'run.log') });
  assert.equal(r.signal, 'SIGKILL');
  assert.equal(r.exitCode, 137);
  assert.equal(r.timedOut, false);
  assert.strictEqual(r.survivors, 0);
});

test('parseLeaderMarkers reads the last of each marker carrying the run\'s nonce, and defaults to unknown', () => {
  const m = (line) => `ccg-proc[${NONCE}]: ${line}`;
  assert.deepEqual(parseLeaderMarkers(`noise\n${m('survivors=2')}\n${m('timeout after 1.5s')}\n${m('survivors=0')}\n`, NONCE),
    { timedOut: true, survivors: 0, signal: null });
  assert.deepEqual(parseLeaderMarkers(`${m('survivors=1')}\n${m('signal=SIGKILL')}\n`, NONCE),
    { timedOut: false, survivors: 1, signal: 'SIGKILL' });
  assert.deepEqual(parseLeaderMarkers(`a runner's unterminated line${m('timeout after 2s')}\n`, NONCE).timedOut, true);
  // A runner can print the marker text, but not the nonce: the old form and another run's nonce are only output.
  const forged = `ccg-proc: timeout after 1s\nccg-proc: signal=SIGKILL\nccg-proc[${'0'.repeat(16)}]: survivors=3\n`;
  assert.deepEqual(parseLeaderMarkers(forged, NONCE), { timedOut: false, survivors: null, signal: null });
  assert.deepEqual(parseLeaderMarkers('', NONCE), { timedOut: false, survivors: null, signal: null });
  assert.deepEqual(parseLeaderMarkers(undefined, NONCE), { timedOut: false, survivors: null, signal: null });
});

test('leaderArgv is the synchronous callers\' form of the same leader, and the leader refuses a run without a nonce', () => {
  const argv = leaderArgv({ boundSeconds: 90, reap: true, nonce: NONCE }, ['stryker', 'run', 'cfg.json']);
  assert.deepEqual(argv, [PROC, '--leader', '--bound', '90', '--grace', '5', '--nonce', NONCE, '--reap', '--', 'stryker', 'run', 'cfg.json']);
  const r = cp.spawnSync(process.execPath, leaderArgv({ boundSeconds: 0.5, graceSeconds: 0.2, nonce: NONCE }, ['/bin/sh', '-c', 'sleep 30']),
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'] });
  assert.equal(r.status, LEADER_TIMEOUT_EXIT);
  assert.deepEqual(parseLeaderMarkers(r.stderr, NONCE), { timedOut: true, survivors: 0, signal: null });
  const bare = cp.spawnSync(process.execPath, leaderArgv({ boundSeconds: 5 }, ['/bin/sh', '-c', 'exit 0']), { encoding: 'utf8', env: childEnv(process.env) });
  assert.equal(bare.status, 2);
  assert.match(bare.stderr, /usage: --leader/);
});

test('a bound past 2^31-1 ms is honoured: the leader re-arms its timer instead of firing at once', () => {
  const r = cp.spawnSync(process.execPath, leaderArgv({ boundSeconds: 40000 * 60, nonce: NONCE }, ['/bin/sh', '-c', 'sleep 0.5; exit 5']),
    { encoding: 'utf8', stdio: ['ignore', 'ignore', 'pipe'], env: childEnv(process.env) });
  assert.equal(r.status, 5, r.stderr);
  assert.deepEqual(parseLeaderMarkers(r.stderr, NONCE), { timedOut: false, survivors: 0, signal: null });
  assert.doesNotMatch(r.stderr, /TimeoutOverflowWarning/);
});

test('a runner printing the leader\'s markers forges nothing: its assertion exit stands, and the lines stay output', async (t) => {
  const d = tmp(t);
  const forged = 'echo "ccg-proc: timeout after 1s"; echo "ccg-proc: signal=SIGKILL"; echo "ccg-proc[0123456789abcdef]: survivors=7"; exit 3';
  const r = await runBounded({ command: forged, cwd: d, boundMs: 20000, logFile: path.join(d, 'run.log') });
  assert.deepEqual([r.exitCode, r.timedOut, r.signal, r.survivors], [3, false, null, 0]);
  assert.deepEqual(r.head, ['ccg-proc: timeout after 1s', 'ccg-proc: signal=SIGKILL', 'ccg-proc[0123456789abcdef]: survivors=7']);
});

test('a bound after an unterminated last line still reads as the bound, and the line stays output', async (t) => {
  const d = tmp(t);
  const r = await runBounded({ command: "printf 'half a line'; exec sleep 30", cwd: d, boundMs: 1000, graceMs: 300, logFile: path.join(d, 'run.log') });
  assert.deepEqual([r.timedOut, r.exitCode, r.survivors], [true, LEADER_TIMEOUT_EXIT, 0]);
  assert.deepEqual(r.tail, ['half a line']);
});

test('the log is streamed, never read whole: its hash, head and tail come through past every cap', async (t) => {
  const d = tmp(t);
  const logFile = path.join(d, 'run.log');
  const whole = [];
  for (const name of ['readFileSync', 'readFile']) {
    const real = fs[name];
    fs[name] = function guarded(file, ...rest) {
      if (String(file) === logFile) whole.push(name);
      return real.call(this, file, ...rest);
    };
    t.after(() => { fs[name] = real; });
  }
  // 100 lines, one of 300 KB (past the line cap and a read chunk), then an unterminated last line.
  const command = 'i=1; while [ $i -le 100 ]; do echo "line $i"; i=$((i+1)); done; head -c 300000 /dev/zero | tr "\\0" x; echo; printf last';
  const r = await runBounded({ command, cwd: d, boundMs: 20000, logFile });
  assert.deepEqual(whole, [], 'the log was read whole');
  const buf = fs.readFileSync(logFile);
  assert.ok(buf.length > 300000);
  assert.equal(r.logSha256, crypto.createHash('sha256').update(buf).digest('hex'));
  assert.deepEqual(r.head, Array.from({ length: 20 }, (_, i) => `line ${i + 1}`));
  assert.equal(r.tail.length, 40);
  assert.deepEqual([r.tail[37], r.tail[38], r.tail[39]], ['line 100', 'x'.repeat(2000), 'last']);
  assert.deepEqual([r.exitCode, r.survivors], [0, 0]);
});

test('the engine\'s SIGTERM reaches the whole group, and the engine re-raises it', async (t) => {
  const d = tmp(t);
  const { h, exited } = harness(t, d, `echo $$ > g; ${STUBBORN}; wait`);
  const { pgid, gc } = await startedGroup(t, d);
  h.kill('SIGTERM');
  const { signal } = await exited;
  assert.equal(signal, 'SIGTERM', 'the engine must die of the signal it forwarded');
  assert.ok(!alive(gc), 'the grandchild outlived the engine\'s forwarded SIGTERM');
  assert.equal(pgrepGroup(pgid), 1);
  const log = fs.readFileSync(path.join(d, 'run.log'), 'utf8');
  assert.equal(parseLeaderMarkers(log, nonceIn(log)).survivors, 0);
});

// The leader polls every 250 ms; on a loaded host its timer runs late, so the deadline only has to beat the 60 s bound.
const PARENT_DEATH_MS = 5000;

test('the leader notices its engine\'s death and kills the group long before its bound', async (t) => {
  const d = tmp(t);
  const { h, exited } = harness(t, d, `echo $$ > g; ${STUBBORN}; wait`);
  const { pgid, gc } = await startedGroup(t, d);
  h.kill('SIGKILL');
  await exited;
  assert.ok(await waitFor(() => !alive(gc) && pgrepGroup(pgid) === 1, PARENT_DEATH_MS), 'the group outlived its engine');
});

test('the leader notices its parent\'s death by ppid alone, the way the synchronous G6 sites run it', async (t) => {
  const d = tmp(t);
  const file = path.join(d, 'sync.cjs');
  // No --watch-stdin: execFileSync closes the leader's stdin at once, so only the ppid poll can notice.
  fs.writeFileSync(file, `
    const { leaderArgv } = require(${JSON.stringify(PROC)});
    const argv = leaderArgv({ boundSeconds: 60, graceSeconds: 0.3, nonce: '${NONCE}' }, ['/bin/sh', '-c', ${JSON.stringify(`echo $PPID > l; echo $$ > g; ${STUBBORN}; wait`)}]);
    require('node:child_process').execFileSync(process.execPath, argv, { cwd: ${JSON.stringify(d)}, stdio: ['ignore', 'ignore', 'pipe'] });
  `);
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const h = cp.spawn(process.execPath, [file], { env, stdio: 'ignore' });
  const exited = new Promise((r) => h.on('exit', r));
  t.after(() => killQuietly(h.pid));
  const { pgid, gc } = await startedGroup(t, d);
  const leaderPid = readPid(d, 'l');
  t.after(() => killQuietly(leaderPid));
  h.kill('SIGKILL');
  await exited;
  assert.ok(await waitFor(() => !alive(gc) && pgrepGroup(pgid) === 1, PARENT_DEATH_MS), 'the group outlived its engine');
});

/** Starts a leader over `script`, sends it `sig`, and returns its exit and markers. */
async function signalLeader(t, sig, script, graceSeconds = 0.3) {
  const d = tmp(t);
  const argv = leaderArgv({ boundSeconds: 60, graceSeconds, nonce: NONCE }, ['/bin/sh', '-c', `echo $$ > g; ${script}`]);
  const l = cp.spawn(process.execPath, argv, { cwd: d, stdio: ['ignore', 'ignore', 'pipe'] });
  let stderr = '';
  l.stderr.on('data', (b) => { stderr += b; });
  const closed = new Promise((r) => l.on('close', (code, signal) => r({ code, signal })));
  t.after(() => killQuietly(l.pid));
  const { pgid, gc } = await startedGroup(t, d);
  l.kill(sig);
  return { exit: await closed, markers: parseLeaderMarkers(stderr, NONCE), pgid, gc, d };
}

test('the leader forwards SIGHUP and SIGINT to its group, SIGKILLs what ignores them after the grace, and exits 128 + n', async (t) => {
  const hup = await signalLeader(t, 'SIGHUP', "(trap '' HUP TERM; exec sleep 60) & echo $! > gc; wait");
  assert.deepEqual(hup.exit, { code: 129, signal: null });
  assert.deepEqual(hup.markers, { timedOut: false, survivors: 0, signal: 'SIGHUP' }, 'the child died of the forwarded signal');
  assert.ok(!alive(hup.gc), 'the grandchild ignoring SIGHUP outlived the grace');
  assert.equal(pgrepGroup(hup.pgid), 1);
  // The whole group ignores it: the child dies of the SIGKILL, and the exit still names the forwarded signal.
  const ignored = await signalLeader(t, 'SIGHUP', "trap '' HUP; sleep 60 & echo $! > gc; wait");
  assert.deepEqual(ignored.exit, { code: 129, signal: null });
  assert.deepEqual(ignored.markers, { timedOut: false, survivors: 0, signal: 'SIGKILL' });
  assert.equal(pgrepGroup(ignored.pgid), 1);
  // sh starts a background job with SIGINT ignored, so only the SIGKILL after the grace stops it. The child
  // execs sleep, which dies of SIGINT under any shell (bash's `wait` would exit 130 instead of dying of it).
  const int = await signalLeader(t, 'SIGINT', 'sleep 60 & echo $! > gc; exec sleep 61');
  assert.deepEqual(int.exit, { code: 130, signal: null });
  assert.deepEqual(int.markers, { timedOut: false, survivors: 0, signal: 'SIGINT' });
  assert.ok(!alive(int.gc), 'the background job outlived the grace');
});

test('the leader grants SIGTERM its grace: a group that stops by itself within it is never SIGKILLed', async (t) => {
  // The child finishes its TERM handler 0.4 s in; a leader that skipped the grace would SIGKILL it first.
  const r = await signalLeader(t, 'SIGTERM', "trap 'sleep 0.4; echo graceful > done; exit 0' TERM; sleep 60 & echo $! > gc; wait", 5);
  assert.equal(fs.readFileSync(path.join(r.d, 'done'), 'utf8'), 'graceful\n', 'the TERM handler never finished');
  assert.deepEqual(r.exit, { code: 143, signal: null });
  assert.deepEqual(r.markers, { timedOut: false, survivors: 0, signal: null });
});

test('with --watch-stdin the leader kills its group as soon as its stdin closes, its parent still alive', async (t) => {
  const d = tmp(t);
  const argv = leaderArgv({ boundSeconds: 60, graceSeconds: 5, watchStdin: true, nonce: NONCE }, ['/bin/sh', '-c', `echo $$ > g; ${STUBBORN}; wait`]);
  const l = cp.spawn(process.execPath, argv, { cwd: d, stdio: ['pipe', 'ignore', 'ignore'], env: childEnv(process.env) });
  t.after(() => killQuietly(l.pid));
  const { pgid, gc } = await startedGroup(t, d);
  l.stdin.end();
  assert.ok(await waitFor(() => !alive(gc) && pgrepGroup(pgid) === 1, 1000), 'the group outlived the leader\'s closed stdin');
});

test('the engine waits at most grace + 2 s for a stuck leader, then re-raises; the leader cleans up when it resumes', async (t) => {
  const d = tmp(t);
  const { h, exited } = harness(t, d, `echo $PPID > l; echo $$ > g; ${STUBBORN}; wait`);
  const { pgid, gc } = await startedGroup(t, d);
  const leaderPid = readPid(d, 'l');
  t.after(() => { try { process.kill(leaderPid, 'SIGCONT'); } catch { /* gone */ } killQuietly(leaderPid); });
  process.kill(leaderPid, 'SIGSTOP');
  let done = null;
  exited.then((r) => { done = r; });
  const started = Date.now();
  h.kill('SIGTERM');
  const ended = await waitFor(() => done !== null, 5000);
  const waited = Date.now() - started;
  process.kill(leaderPid, 'SIGCONT');
  assert.ok(ended, 'the engine hung on a leader that never exits');
  assert.equal(done.signal, 'SIGTERM');
  assert.ok(waited >= 2000, `re-raised after ${waited} ms, before the leader's grace + 2 s`);
  assert.ok(await waitFor(() => !alive(gc) && pgrepGroup(pgid) === 1, 3000), 'the resumed leader left its group running');
});

test('a SIGKILL to the engine\'s whole group leaves the detached leader to clean up', async (t) => {
  const d = tmp(t);
  const { h, exited } = harness(t, d, `echo $$ > g; ${STUBBORN}; wait`, { detached: true });
  const { pgid, gc } = await startedGroup(t, d);
  process.kill(-h.pid, 'SIGKILL');
  await exited;
  assert.ok(await waitFor(() => !alive(gc) && pgrepGroup(pgid) === 1, 1000), 'the leader died with the engine\'s group');
});

test('childEnv drops NODE_TEST_CONTEXT, so a nested node --test tier writes its junit report', async (t) => {
  const d = tmp(t);
  fs.writeFileSync(path.join(d, 'sample.test.cjs'), "require('node:test').test('nested ok', () => {});\n");
  const env = { ...process.env, NODE_TEST_CONTEXT: 'child-v8' };
  assert.equal(childEnv(env, { EXTRA: '1' }).NODE_TEST_CONTEXT, undefined);
  assert.equal(childEnv(env, { EXTRA: '1' }).EXTRA, '1');
  const junit = (dest) => [process.execPath, '--test', '--test-reporter=junit', `--test-reporter-destination=${dest}`, 'sample.test.cjs'];
  // The control: the inherited variable really does silence a nested runner.
  const [bin, ...args] = junit('control.xml');
  cp.spawnSync(bin, args, { cwd: d, env, stdio: 'ignore' });
  assert.ok(!fs.existsSync(path.join(d, 'control.xml')), 'the control wrote a report, so this test proves nothing');
  const r = await runBounded({ argv: junit('out.xml'), cwd: d, env, boundMs: 60000, logFile: path.join(d, 'run.log') });
  assert.equal(r.exitCode, 0);
  assert.match(fs.readFileSync(path.join(d, 'out.xml'), 'utf8'), /<testcase name="nested ok"/);
});
