'use strict';
// The bounded runner (contract §4). A leader process owns each command's
// process group, so a bound, a forwarded signal or the engine's own death
// reaches every grandchild, and the survivors are counted, never assumed.
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { StringDecoder } = require('node:string_decoder');

const LEADER_TIMEOUT_EXIT = 124;
const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];
const MAX_TIMER = 2 ** 31 - 1; // Node fires a longer timer at once, so a longer bound re-arms until it has elapsed
const TAIL_BYTES = 1 << 20;
const LINE_CAP = 2000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const signum = (name) => os.constants.signals[name] || 0;
// The leader's markers carry a per-run nonce, so a runner that prints the marker text cannot forge a bound or a signal.
const newNonce = () => crypto.randomBytes(8).toString('hex');

/** A nested `node --test` that inherits NODE_TEST_CONTEXT writes no report and exits 0, so no spawn keeps it. */
const childEnv = (baseEnv, extra) => { const env = { ...baseEnv, ...extra }; delete env.NODE_TEST_CONTEXT; return env; };

function leaderArgv({ boundSeconds, graceSeconds = 5, reap = true, watchStdin = false, tail = false, nonce }, argv) {
  return [__filename, '--leader', '--bound', String(boundSeconds), '--grace', String(graceSeconds), '--nonce', String(nonce),
    ...(reap ? ['--reap'] : []), ...(watchStdin ? ['--watch-stdin'] : []), ...(tail ? ['--tail'] : []), '--', ...argv];
}

// A marker may follow a runner's unterminated last line, so it is found anywhere in a line: only the leader knows the nonce.
function parseLeaderMarkers(text, nonce) {
  const last = (re) => [...String(text || '').matchAll(new RegExp(`ccg-proc\\[${nonce}\\]: ${re}$`, 'gm'))].pop();
  const [n, s] = [last('survivors=(\\d+)'), last('signal=(SIG[A-Z0-9]+)')];
  return { timedOut: !!last('timeout after .*'), survivors: n ? Number(n[1]) : null, signal: s ? s[1] : null };
}

const killGroup = (pgid, sig) => { if (pgid > 1) try { process.kill(-pgid, sig); } catch { /* ESRCH, or EPERM on a zombie-only group */ } };

// "<pid> (<comm>) <state> <ppid> <pgrp> …": comm may hold spaces and parentheses, so fields count from its last ")".
const procGroupSize = (pgid) => fs.readdirSync('/proc').filter((d) => {
  try { const [state, , g] = fs.readFileSync(`/proc/${d}/stat`, 'utf8').replace(/^[\s\S]*\) /, '').split(' '); return /^\d+$/.test(d) && Number(g) === pgid && state !== 'Z'; }
  catch { return false; }
}).length;

/** Live members of the group; a zombie (`Z`) is dead. Without ps, Linux's /proc tells the same; elsewhere a probe does. */
function groupSize(pgid) {
  try {
    return cp.execFileSync('ps', ['-A', '-o', 'pid=,pgid=,stat='], { encoding: 'utf8' }).split('\n')
      .map((l) => l.trim().split(/\s+/))
      .filter(([, g, stat]) => Number(g) === pgid && stat && !stat.startsWith('Z')).length;
  } catch {
    if (fs.existsSync('/proc/self/stat')) return procGroupSize(pgid);
    try { process.kill(-pgid, 0); return 1; } catch { return 0; }
  }
}

/** Waits up to `ms` for the group to empty, and returns what is left. */
async function settle(pgid, ms) {
  for (const until = Date.now() + ms; ; await sleep(100)) { const n = groupSize(pgid); if (!n || Date.now() >= until) return n; }
}

/** The last TAIL_BYTES of a stream, once it ends (or a second after the group is gone: an escaped writer may hold it). */
function keepTail(stream) {
  const chunks = [];
  let size = 0;
  const ended = new Promise((r) => stream.on('end', r).on('error', r));
  stream.on('data', (b) => {
    for (chunks.push(b), size += b.length; size - chunks[0].length >= TAIL_BYTES;) size -= chunks.shift().length;
  });
  return async () => { await Promise.race([ended, sleep(1000)]); return Buffer.concat(chunks).subarray(-TAIL_BYTES); };
}

async function leader(args) {
  const at = args.indexOf('--');
  const flag = (f) => args.slice(0, at).includes(f);
  const opt = (f) => args[args.indexOf(f) + 1];
  const [bound, grace, id, cmd] = [Number(opt('--bound')), Number(opt('--grace')), opt('--nonce'), args.slice(at + 1)];
  const put = (fd, buf) => { for (let o = 0; o < buf.length;) try { o += fs.writeSync(fd, buf, o); } catch (e) { if (e.code !== 'EAGAIN') return; } };
  const say = (line) => put(2, Buffer.from(`ccg-proc[${id}]: ${line}\n`));
  if (at < 0 || !cmd.length || !(bound > 0) || !(grace >= 0) || !/^[0-9a-f]{16}$/.test(id)) {
    say('usage: --leader --bound <s> --grace <s> --nonce <hex> [--reap] [--watch-stdin] [--tail] -- <argv…>');
    return 2;
  }
  // --tail (the synchronous G6 path) relays only the last TAIL_BYTES of each stream, at exit, so no caller's buffer fills.
  const io = flag('--tail') ? 'pipe' : 'inherit';
  const child = cp.spawn(cmd[0], cmd.slice(1), { detached: true, stdio: ['ignore', io, io], env: childEnv(process.env) });
  const tails = io === 'pipe' ? [child.stdout, child.stderr].map(keepTail) : [];
  const G = child.pid;
  const exited = new Promise((resolve) => {
    child.on('exit', (code, signal) => resolve({ code, signal }));
    child.on('error', (e) => { say(`spawn failed: ${e.message}`); resolve({ code: 127, signal: null }); });
  });
  let [cause, stopping] = [null, null];
  const stop = (why, first) => {
    if (stopping) return;
    cause = why;
    stopping = (async () => { killGroup(G, first); if (first !== 'SIGKILL') await settle(G, grace * 1000); killGroup(G, 'SIGKILL'); })();
  };
  let timer;
  const arm = (left) => { timer = setTimeout(() => (left > MAX_TIMER ? arm(left - MAX_TIMER) : stop('timeout', 'SIGTERM')), Math.min(left, MAX_TIMER)); };
  arm(bound * 1000);
  for (const s of SIGNALS) process.on(s, () => stop(s, s));
  const ppid = process.ppid;
  const watch = setInterval(() => { if (process.ppid !== ppid) stop('orphaned', 'SIGKILL'); }, 250);
  if (flag('--watch-stdin')) process.stdin.on('end', () => stop('orphaned', 'SIGKILL')).on('error', () => stop('orphaned', 'SIGKILL')).resume();
  const { code, signal } = await exited;
  clearTimeout(timer);
  if (!stopping && flag('--reap')) killGroup(G, 'SIGKILL');
  await stopping;
  const survivors = stopping || flag('--reap') ? await settle(G, 2000) : groupSize(G);
  clearInterval(watch);
  for (const [i, tail] of tails.entries()) put(i + 1, await tail());
  if (cause === 'timeout') say(`timeout after ${bound}s`);
  say(`survivors=${survivors}`);
  if (cause === 'timeout') return LEADER_TIMEOUT_EXIT;
  if (signal) say(`signal=${signal}`);
  if (SIGNALS.includes(cause)) return 128 + signum(cause);
  return signal ? 128 + signum(signal) : code;
}

// ---- the engine side --------------------------------------------------------

const live = new Map(); // leader → its grace, while it runs
const stops = []; // what a signal undoes before the engine re-raises it: a base worktree, a tier's cleanup
let [holds, forwarding, listening] = [0, false, false];

// Signals are caught while a leader runs or the engine holds them (a whole barrier run), and while forwarding one.
function listen() {
  const want = live.size + holds > 0 || forwarding;
  if (want !== listening) for (const s of SIGNALS) process[want ? 'on' : 'removeListener'](s, onSignal);
  listening = want;
}

async function onSignal(sig) {
  if (forwarding) return;
  forwarding = true;
  const waits = [...live.keys()].map((l) => new Promise((r) => l.once('exit', r)));
  for (const l of live.keys()) l.kill(sig);
  await Promise.race([Promise.all(waits), sleep(Math.max(0, ...live.values()) + 2000)]);
  // Newest first. Popping means a step that finishes meanwhile cannot skip one, and what it registers is undone too.
  for (let undo = stops.pop(); undo; undo = stops.pop()) await Promise.resolve().then(undo).catch(() => { /* undo the rest */ });
  for (const s of SIGNALS) process.removeListener(s, onSignal);
  process.kill(process.pid, sig);
}

/** Keeps SIGINT, SIGTERM and SIGHUP caught until the returned release runs, leader or not. */
const hold = () => { holds += 1; listen(); return () => { holds -= 1; listen(); }; };
/** Registers what a signal must undo before the engine re-raises it (newest first); returns its unregister. */
const atStop = (undo) => { stops.push(undo); return () => { if (stops.includes(undo)) stops.splice(stops.indexOf(undo), 1); }; };

/**
 * Streams the log once, never holding it whole (a runner may print gigabytes): its hash, the first 20 and last 40
 * lines (each cut to LINE_CAP, redacted, the leader's own markers out), those markers, and the lines `keep` wants.
 */
async function readLog(logFile, nonce, keep) {
  const { redact } = require('./envelope.cjs');
  const [hash, decoder, own] = [crypto.createHash('sha256'), new StringDecoder('utf8'), `ccg-proc[${nonce}]: `];
  const [head, ring, marks, kept] = [[], [], [], []];
  let [part, n] = ['', 0];
  const take = (raw) => {
    const at = raw.indexOf(own);
    if (at >= 0) marks.push(raw.slice(at));
    if (at === 0) return;
    const line = raw.slice(0, at < 0 ? LINE_CAP : Math.min(at, LINE_CAP));
    if (keep && kept.length < 1000 && keep(line)) kept.push(line);
    if (head.length < 20) head.push(line);
    ring[n++ % 40] = line;
  };
  for await (const chunk of fs.createReadStream(logFile)) {
    hash.update(chunk);
    const lines = decoder.write(chunk).split('\n');
    lines[0] = part + lines[0];
    part = lines.pop();
    if (part.length > LINE_CAP) part = part.slice(0, LINE_CAP) + part.slice(-64); // the end may hold a marker's start
    lines.forEach(take);
  }
  if ((part += decoder.end())) take(part);
  const tail = n <= 40 ? ring : [...ring.slice(n % 40), ...ring.slice(0, n % 40)];
  return { ...parseLeaderMarkers(marks.join('\n'), nonce), logSha256: hash.digest('hex'), head: head.map(redact), tail: tail.map(redact), kept };
}

/**
 * Runs `command` (via /bin/sh -c) or `argv` under a detached leader, so a SIGKILL
 * to the engine's own group cannot take the leader with it. The leader's output
 * goes to the log file's descriptor, not a pipe: a daemon left by `reap: false`
 * inherits a file, so it can neither hold the engine open nor get EPIPE.
 */
function runBounded({ command, argv, cwd, env, boundMs, graceMs = 5000, reap = true, logFile, keep }) {
  const [cmd, nonce] = [argv || ['/bin/sh', '-c', command], newNonce()];
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const fd = fs.openSync(logFile, 'w', 0o600);
  const started = Date.now();
  return new Promise((resolve) => {
    let l;
    try {
      l = cp.spawn(process.execPath, leaderArgv({ boundSeconds: boundMs / 1000, graceSeconds: graceMs / 1000, reap, watchStdin: true, nonce }, cmd),
        { cwd, env: childEnv(env || process.env), detached: true, stdio: ['pipe', fd, fd] });
    } finally {
      fs.closeSync(fd);
    }
    live.set(l, graceMs);
    listen();
    const finish = (exitCode) => {
      if (!live.delete(l)) return; // once: 'error' and 'exit' may both fire
      listen();
      l.stdin.destroy();
      const ms = Date.now() - started;
      readLog(logFile, nonce, keep).then((log) => resolve({ exitCode, ms, ...log }));
    };
    l.stdin.on('error', () => {});
    l.on('error', (e) => { fs.appendFileSync(logFile, `ccg-proc[${nonce}]: spawn failed: ${e.message}\n`); finish(127); });
    l.on('exit', (code, signal) => finish(code ?? 128 + signum(signal)));
  });
}

/**
 * §4.3, the synchronous G6 path: argv under a non-detached leader (a Ctrl-C to the foreground group still reaches it)
 * that relays only the tail of each stream, so the 16 MiB buffer never fills and Node never kills the leader itself.
 * `stop` is null, or `bounded` (the leader's own timeout, or the outer last resort) or `killed` (any other signal).
 */
function leaderSync(exec, argv, { boundSeconds, cwd, stdout = 'ignore' }) {
  const nonce = newNonce();
  try {
    exec(process.execPath, leaderArgv({ boundSeconds, tail: true, nonce }, argv), { cwd, stdio: ['ignore', stdout, 'pipe'],
      encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: (boundSeconds + 15) * 1000, killSignal: 'SIGKILL' });
    return { stop: null, output: '' };
  } catch (err) {
    const m = parseLeaderMarkers(err.stderr, nonce);
    const signal = m.signal || err.signal;
    const stop = err.code === 'ETIMEDOUT' || (err.status === LEADER_TIMEOUT_EXIT && m.timedOut)
      ? { reason: 'bounded', detail: `exceeded the ${boundSeconds}s budget` }
      : signal ? { reason: 'killed', detail: `the runner was killed by ${signal}, inside the ${boundSeconds}s budget` } : null;
    const own = `ccg-proc[${nonce}]: `;
    return { stop, output: `${err.stdout || ''}${err.stderr || ''}`.split('\n').map((l) => l.split(own)[0]).join('\n').trim() };
  }
}

if (require.main === module && process.argv[2] === '--leader') {
  leader(process.argv.slice(3)).then((code) => process.exit(code));
}

module.exports = { runBounded, leaderArgv, leaderSync, parseLeaderMarkers, childEnv, hold, atStop, LEADER_TIMEOUT_EXIT };
