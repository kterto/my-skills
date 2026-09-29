#!/usr/bin/env node
'use strict';
/**
 * Contract tests for `run-state.cjs`, the run state the orchestrator's watchdog, its
 * resume header and its in-session budget raises all stand on. Each case drives the
 * real script as a subprocess against a temp project named with `--root`, and runs it
 * from inside that project as well, so no case can reach this repository's own
 * `.orchestrator/`.
 *
 * The cases pinned here are the ones a wrong implementation reads as working: a
 * `start` that silently takes ACTIVE from a live run, a `next` that leaves the hook's
 * block counter or a stale `pending_decision` behind, a raise that records a lowered
 * or unbounded cap, a lookup that misses the answer an earlier run already recorded,
 * a notifier that hands the run's free text to a shell, and an output line that
 * would plant the Stop hook's ownership evidence in whichever session read it.
 *
 *   node --test scripts/run-state.test.cjs
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, 'run-state.cjs');
const { RAISABLE, splitCommand, watcher } = require('./run-state.cjs');

/** Run `fn` against a fresh temp project, removed afterwards whether or not it passed. */
const withRoot = (fn) => async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-state-'));
  try {
    await fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const cli = (root, args, opts = {}) =>
  spawnSync(process.execPath, [SCRIPT, '--root', root, ...args], { cwd: root, encoding: 'utf8', ...opts });

/** Run a command that must succeed, and return its result. */
function ok(root, args) {
  const r = cli(root, args);
  assert.equal(r.status, 0, `${args.join(' ')}: ${r.stderr}`);
  return r;
}

const runsDir = (root) => path.join(root, '.orchestrator', 'runs');
const fileOf = (root, run, name) => path.join(runsDir(root), run, name);
const read = (file) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null);
const leaseOf = (root, run) => JSON.parse(read(fileOf(root, run, 'lease.json')));
const patchLease = (root, run, fields) =>
  fs.writeFileSync(fileOf(root, run, 'lease.json'), JSON.stringify({ ...leaseOf(root, run), ...fields }, null, 2));
const active = (root) => read(path.join(runsDir(root), 'ACTIVE'));
const minutesAgo = (m) => new Date(Date.now() - m * 60000).toISOString();
const jsonl = (file) => read(file).trim().split('\n').map((l) => JSON.parse(l));

/** Every file under `dir`, recursively, so a leftover temp file has nowhere to hide. */
function allFiles(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...allFiles(abs));
    else out.push(abs);
  }
  return out;
}

/** A notifier stub: appends its own argv, one JSON line per call, to a marker file. */
function stubNotifier(root) {
  const stub = path.join(root, 'notify-stub.cjs');
  const marker = path.join(root, 'notified.jsonl');
  const append = `require('fs').appendFileSync(${JSON.stringify(marker)}, JSON.stringify(process.argv.slice(2)) + '\\n');`;
  fs.writeFileSync(stub, `${append}\n`);
  return {
    notify: `${JSON.stringify(process.execPath)} ${JSON.stringify(stub)}`,
    calls: () => (fs.existsSync(marker) ? jsonl(marker) : []),
  };
}

// ---------- start ----------

test('start writes the lease, NEXT and ACTIVE in the contract shape', withRoot((root) => {
  const r = ok(root, ['start', 'run-a', '--host', 'claude-code']);
  assert.match(r.stdout, /started run-a/);
  const lease = leaseOf(root, 'run-a');
  assert.deepEqual(Object.keys(lease), [
    'run', 'run_dir', 'host', 'session_id', 'state', 'started_at', 'heartbeat_at', 'blocks', 'last_block_next', 'version',
  ]);
  assert.equal(lease.run, 'run-a');
  assert.equal(lease.run_dir, 'plans/run-a');
  assert.equal(lease.host, 'claude-code');
  assert.equal(lease.session_id, null);
  assert.equal(lease.state, 'active');
  assert.match(lease.started_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.equal(lease.heartbeat_at, lease.started_at);
  assert.equal(lease.blocks, 0);
  assert.equal(lease.last_block_next, null);
  assert.equal(lease.version, 1);
  assert.equal(read(fileOf(root, 'run-a', 'NEXT')), 'Step 0 — preflight\n');
  assert.equal(active(root), 'run-a\n');
  // Every write went through a temp file and a rename, and none may be left behind.
  assert.deepEqual(allFiles(runsDir(root)).filter((f) => f.endsWith('.tmp')), []);
}));

test('start refuses while another run is live, names it, and --force overrides', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  let r = cli(root, ['start', 'run-b']);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /another run is active: run-a/);
  assert.equal(active(root), 'run-a\n');
  assert.ok(!fs.existsSync(path.join(runsDir(root), 'run-b')), 'a refused start created its run dir');

  // A run waiting for the operator is alive: that stop is on purpose, not abandonment.
  ok(root, ['wait', 'run-a', 'Status: STALLED — review budget']);
  r = cli(root, ['start', 'run-b']);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /run-a \(state waiting/);

  r = ok(root, ['start', 'run-b', '--force']);
  assert.match(r.stdout, /ACTIVE named run-a/);
  assert.equal(active(root), 'run-b\n');
  assert.equal(leaseOf(root, 'run-a').state, 'waiting', '--force must not rewrite the run it supersedes');
}));

test('start does not refuse over a stale, finished or unreadable run', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  patchLease(root, 'run-a', { heartbeat_at: minutesAgo(13 * 60) });
  ok(root, ['start', 'run-b']);
  assert.equal(active(root), 'run-b\n');

  // A done run that ACTIVE still names.
  patchLease(root, 'run-b', { state: 'done' });
  ok(root, ['start', 'run-c']);

  // An unreadable lease is no proof of life.
  fs.writeFileSync(fileOf(root, 'run-c', 'lease.json'), '{ torn');
  ok(root, ['start', 'run-d']);
  assert.equal(active(root), 'run-d\n');
}));

test('start is idempotent for the run ACTIVE already names, and keeps what it knew', withRoot((root) => {
  ok(root, ['start', 'run-a', '--host', 'opencode']);
  patchLease(root, 'run-a', { started_at: '2026-01-01T00:00:00Z', session_id: 'ses_1', blocks: 2 });
  ok(root, ['wait', 'run-a', 'a question']);
  ok(root, ['start', 'run-a']);
  const lease = leaseOf(root, 'run-a');
  assert.equal(lease.started_at, '2026-01-01T00:00:00Z');
  assert.equal(lease.session_id, 'ses_1');
  assert.equal(lease.host, 'opencode');
  assert.equal(lease.state, 'active');
  assert.equal(lease.blocks, 0);
  assert.equal(read(fileOf(root, 'run-a', 'pending_decision')), null);
  assert.equal(read(fileOf(root, 'run-a', 'NEXT')), 'Step 0 — preflight\n');

  // A run started without --host records that it does not know.
  ok(root, ['start', 'run-b', '--force']);
  assert.equal(leaseOf(root, 'run-b').host, 'unknown');
}));

// ---------- next, wait, done ----------

test('next overwrites NEXT, sets the run active, resets blocks and removes pending_decision', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  // The Stop hook's own writes: two consecutive blocks on one step.
  patchLease(root, 'run-a', { blocks: 2, last_block_next: 'Step 0 — preflight', session_id: 'ses_1' });
  ok(root, ['wait', 'run-a', 'Status: STALLED — review budget reached']);
  assert.match(
    read(fileOf(root, 'run-a', 'pending_decision')),
    /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ Status: STALLED — review budget reached\n$/,
  );
  assert.equal(leaseOf(root, 'run-a').state, 'waiting');

  const note = 'read CR-20260929T101500Z-a1b2\nin flight: FR-3, FR-4';
  ok(root, ['next', 'run-a', 'Step 4 — reviewer, cycle 2', '--note', note]);
  assert.equal(
    read(fileOf(root, 'run-a', 'NEXT')),
    'Step 4 — reviewer, cycle 2\nread CR-20260929T101500Z-a1b2\nin flight: FR-3, FR-4\n',
  );
  assert.equal(read(fileOf(root, 'run-a', 'pending_decision')), null);
  const lease = leaseOf(root, 'run-a');
  assert.equal(lease.state, 'active');
  assert.equal(lease.blocks, 0);
  assert.equal(lease.session_id, 'ses_1', 'next must keep what the hook wrote');

  // Idempotent: the same step twice is the same state.
  ok(root, ['next', 'run-a', 'Step 4 — reviewer, cycle 2']);
  ok(root, ['next', 'run-a', 'Step 4 — reviewer, cycle 2']);
  assert.equal(read(fileOf(root, 'run-a', 'NEXT')), 'Step 4 — reviewer, cycle 2\n');
}));

test('next at the step an active run is already at keeps the block count', withRoot((root) => {
  // A conductor that re-records its step on every re-prompt and stops again has made no
  // progress; resetting the count then would keep the three-block guard from ever tripping.
  ok(root, ['start', 'run-a']);
  ok(root, ['next', 'run-a', 'Step 4 — reviewer', '--note', 'cycle 1']);
  patchLease(root, 'run-a', { blocks: 2, last_block_next: 'Step 4 — reviewer' });
  ok(root, ['next', 'run-a', 'Step 4 — reviewer', '--note', 'cycle 1, again']);
  assert.equal(leaseOf(root, 'run-a').blocks, 2);
  assert.equal(read(fileOf(root, 'run-a', 'NEXT')), 'Step 4 — reviewer\ncycle 1, again\n');

  // A new step is progress.
  ok(root, ['next', 'run-a', 'Step 4a — architect fix']);
  assert.equal(leaseOf(root, 'run-a').blocks, 0);

  // So is a resume after the operator answered, even at the same step.
  patchLease(root, 'run-a', { blocks: 3, last_block_next: 'Step 4a — architect fix' });
  ok(root, ['wait', 'run-a', 'watchdog: 3 blocks without progress']);
  ok(root, ['next', 'run-a', 'Step 4a — architect fix']);
  assert.equal(leaseOf(root, 'run-a').blocks, 0);
  assert.equal(leaseOf(root, 'run-a').state, 'active');
}));

test('a wait after done points ACTIVE back at the run, so status and watch still see it', withRoot((root) => {
  const stub = stubNotifier(root);
  ok(root, ['start', 'run-a']);
  ok(root, ['done', 'run-a']);
  assert.equal(active(root), null);

  // A stop after the FINAL that waits for the operator.
  ok(root, ['wait', 'run-a', 'Status: STALLED — human intervention required']);
  assert.equal(active(root), 'run-a\n');
  assert.equal(JSON.parse(ok(root, ['status', '--json']).stdout).state, 'waiting');
  assert.equal(cli(root, ['watch', '--once', '--notify', stub.notify]).status, 4);
  assert.match(stub.calls()[0][0], /run-a is waiting for your decision: Status: STALLED/);

  // ACTIVE that names another run is never taken.
  ok(root, ['start', 'run-b', '--force']);
  ok(root, ['done', 'run-a']);
  const r = ok(root, ['wait', 'run-a', 'another question']);
  assert.equal(active(root), 'run-b\n');
  assert.match(r.stderr, /ACTIVE names run-b, so the watchdog does not follow run-a/);
}));

test('a label or reason with newlines still leaves a one-line NEXT label and pending_decision', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  ok(root, ['next', 'run-a', 'Step 5 —\nQA']);
  assert.equal(read(fileOf(root, 'run-a', 'NEXT')), 'Step 5 — QA\n');
  ok(root, ['wait', 'run-a', 'Status: STALLED\n  gate G6 hung']);
  assert.match(read(fileOf(root, 'run-a', 'pending_decision')), /^\S+ Status: STALLED gate G6 hung\n$/);
}));

test('done marks the run done, and removes ACTIVE only when it names the run', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  ok(root, ['start', 'run-b', '--force']);
  // The superseded run is still writable, and the conductor is told the watchdog left it.
  const r = ok(root, ['next', 'run-a', 'Step 7 — final']);
  assert.match(r.stderr, /ACTIVE names run-b, so the watchdog does not follow run-a/);
  ok(root, ['done', 'run-a']);
  assert.equal(leaseOf(root, 'run-a').state, 'done');
  assert.equal(active(root), 'run-b\n');
  ok(root, ['done', 'run-b']);
  assert.equal(active(root), null);
  assert.equal(cli(root, ['status']).status, 1);
}));

test('every write command bumps heartbeat_at', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  for (const args of [
    ['next', 'run-a', 'Step 1 — brainstormer'],
    ['wait', 'run-a', 'a question'],
    ['decide', 'run-a', 'FR-1', '--question', 'q', '--answer', 'a'],
    ['raise', 'run-a', 'max_qa_cycles', '3', '--from', '2', '--approval', 'yes'],
    ['done', 'run-a'],
  ]) {
    const old = minutesAgo(90);
    patchLease(root, 'run-a', { heartbeat_at: old });
    ok(root, args);
    assert.ok(Date.parse(leaseOf(root, 'run-a').heartbeat_at) > Date.parse(old), `${args[0]} did not bump heartbeat_at`);
  }
  assert.deepEqual(allFiles(runsDir(root)).filter((f) => f.endsWith('.tmp')), []);
}));

test('a write to a run that was never started exits 1 and creates nothing', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  for (const args of [
    ['next', 'run-typo', 'Step 1 — brainstormer'],
    ['wait', 'run-typo', 'a question'],
    ['done', 'run-typo'],
    ['decide', 'run-typo', 'FR-1', '--question', 'q', '--answer', 'a'],
    ['raise', 'run-typo', 'max_qa_cycles', '3', '--from', '2', '--approval', 'yes'],
  ]) {
    const r = cli(root, args);
    assert.equal(r.status, 1, `${args[0]}: ${r.stderr}`);
    assert.match(r.stderr, /no lease for run run-typo/);
  }
  assert.deepEqual(fs.readdirSync(runsDir(root)).sort(), ['ACTIVE', 'run-a']);
}));

// ---------- status ----------

test('status reports the active run, and FINAL presence from plans/<run>/', withRoot((root) => {
  let r = cli(root, ['status']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /no active run/);
  r = cli(root, ['status', '--json']);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');

  ok(root, ['start', 'run-a', '--host', 'prime']);
  ok(root, ['next', 'run-a', 'Step 3 — coder', '--note', 'plan FEAT-20260929T101500Z-a1b2']);
  const beat = minutesAgo(45);
  patchLease(root, 'run-a', { heartbeat_at: beat });
  let s = JSON.parse(ok(root, ['status', '--json']).stdout);
  assert.equal(s.run, 'run-a');
  assert.equal(s.run_dir, 'plans/run-a');
  assert.equal(s.host, 'prime');
  assert.equal(s.state, 'active');
  assert.equal(s.next, 'Step 3 — coder');
  assert.equal(s.note, 'plan FEAT-20260929T101500Z-a1b2');
  assert.equal(s.pending_decision, null);
  assert.ok(s.idle_minutes >= 45 && s.idle_minutes < 47, `idle_minutes ${s.idle_minutes}`);
  assert.equal(s.final, null);
  assert.equal(leaseOf(root, 'run-a').heartbeat_at, beat, 'status is a read and must not count as activity');

  const finalName = 'FINAL-20260929T111500Z-c3d4-run-a.md';
  fs.mkdirSync(path.join(root, 'plans', 'run-a'), { recursive: true });
  fs.writeFileSync(path.join(root, 'plans', 'run-a', finalName), '# final\n');
  s = JSON.parse(ok(root, ['status', '--json']).stdout);
  assert.equal(s.final, `plans/run-a/${finalName}`);

  ok(root, ['wait', 'run-a', 'Status: STALLED — family budget']);
  r = ok(root, ['status']);
  assert.match(r.stdout, /^run: run-a$/m);
  assert.match(r.stdout, /^state: waiting$/m);
  assert.match(r.stdout, /^next: Step 3 — coder$/m);
  assert.match(r.stdout, /^ {2}plan FEAT-20260929T101500Z-a1b2$/m);
  assert.match(r.stdout, /^pending_decision: \S+ Status: STALLED — family budget$/m);
  assert.ok(r.stdout.includes(`\nfinal: plans/run-a/${finalName}\n`), r.stdout);
}));

// ---------- decisions ----------

test('decide appends to decisions.jsonl, and lookup returns the latest answer for the id', withRoot((root) => {
  ok(root, ['start', 'run-a', '--host', 'opencode']);
  ok(root, ['decide', 'run-a', 'FR-11', '--question', 'Offline mode?', '--answer', 'no']);
  ok(root, [
    'decide', 'run-a', 'FR-11', '--spec', 'SPEC-20260929T101500Z-a1b2', '--question', 'Offline mode?', '--answer', 'read-only',
    '--by', 'default', '--host', 'claude-code',
  ]);
  const records = jsonl(fileOf(root, 'run-a', 'decisions.jsonl'));
  assert.equal(records.length, 2);
  assert.deepEqual(Object.keys(records[0]), ['id', 'spec', 'question', 'answer', 'by', 'host', 'at']);
  assert.equal(records[0].spec, null, 'without --spec the record says it has none');
  assert.equal(records[0].by, 'human');
  assert.equal(records[0].host, 'opencode', 'without --host the record carries the host the run started on');
  assert.equal(records[1].spec, 'SPEC-20260929T101500Z-a1b2');
  assert.equal(records[1].by, 'default');
  assert.equal(records[1].host, 'claude-code');

  const found = JSON.parse(ok(root, ['lookup', 'run-a', 'FR-11']).stdout);
  assert.equal(found.answer, 'read-only');
  assert.equal(found.question, 'Offline mode?');
  assert.equal(found.run, 'run-a');
  const r = cli(root, ['lookup', 'run-a', 'FR-99']);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
}));

const SPEC = 'SPEC-20260929T101500Z-a1b2';

test('lookup --all searches every run dir for the same spec and takes the latest answer by time', withRoot((root) => {
  const record = (run, lines) => {
    fs.mkdirSync(path.join(runsDir(root), run), { recursive: true });
    const text = lines.map((l) => (typeof l === 'string' ? l : JSON.stringify(l))).join('\n');
    fs.writeFileSync(fileOf(root, run, 'decisions.jsonl'), `${text}\n`);
  };
  const d = (id, answer, at) => ({ id, spec: SPEC, question: `${id}?`, answer, by: 'human', host: 'claude-code', at });
  record('run-a', [
    d('FR-2', 'from a', '2026-09-20T10:00:00Z'),
    '{ a hand-edited, torn line',
    d('GAP-1', 'gap answer', '2026-09-01T10:00:00Z'),
    d('FR-3', 'tie in a', '2026-09-15T10:00:00Z'),
  ]);
  record('run-b', [d('FR-2', 'from b', '2026-09-10T10:00:00Z'), d('FR-3', 'tie in b', '2026-09-15T10:00:00Z')]);
  const all = (run, id) => ['lookup', run, id, '--spec', SPEC, '--all'];

  assert.equal(JSON.parse(ok(root, ['lookup', 'run-b', 'FR-2']).stdout).answer, 'from b');
  const across = JSON.parse(ok(root, all('run-b', 'FR-2')).stdout);
  assert.equal(across.answer, 'from a');
  assert.equal(across.run, 'run-a');

  assert.equal(cli(root, ['lookup', 'run-b', 'GAP-1']).status, 1);
  assert.equal(JSON.parse(ok(root, all('run-b', 'GAP-1')).stdout).answer, 'gap answer');

  // On a timestamp tie the named run's own answer wins.
  assert.equal(JSON.parse(ok(root, all('run-b', 'FR-3')).stdout).answer, 'tie in b');
  assert.equal(JSON.parse(ok(root, all('run-a', 'FR-3')).stdout).answer, 'tie in a');

  // A new run with no state of its own still finds what earlier runs decided.
  assert.equal(JSON.parse(ok(root, all('run-new', 'FR-2')).stdout).answer, 'from a');
  const r = cli(root, all('run-new', 'FR-404'));
  assert.equal(r.status, 1);
  assert.match(r.stderr, new RegExp(`no decision recorded for FR-404 in any run for ${SPEC}`));
}));

test('lookup --all never answers one spec\'s id with another spec\'s decision', withRoot((root) => {
  // One run per user story, each with its own spec: both number their requirements from FR-1.
  ok(root, ['start', 'story-auth']);
  ok(root, [
    'decide', 'story-auth', 'FR-3', '--spec', 'SPEC-20260929T090000Z-aaaa', '--question', 'FR-3: which auth provider?',
    '--answer', 'Supabase',
  ]);
  ok(root, ['start', 'story-export', '--force']);
  const r = cli(root, ['lookup', 'story-export', 'FR-3', '--spec', 'SPEC-20260930T090000Z-cccc', '--all']);
  assert.equal(r.status, 1, `another spec's FR-3 was reused: ${r.stdout}`);
  assert.equal(r.stdout, '');

  // The same spec, reused by a later run, does find it.
  const hit = JSON.parse(ok(root, ['lookup', 'story-export', 'FR-3', '--spec', 'SPEC-20260929T090000Z-aaaa', '--all']).stdout);
  assert.equal(hit.answer, 'Supabase');
  assert.equal(hit.run, 'story-auth');

  // A decision recorded without a spec is never reused across runs, and --all without --spec is refused.
  ok(root, ['decide', 'story-auth', 'FR-4', '--question', 'q', '--answer', 'a']);
  assert.equal(cli(root, ['lookup', 'story-export', 'FR-4', '--spec', 'SPEC-20260929T090000Z-aaaa', '--all']).status, 1);
  assert.equal(cli(root, ['lookup', 'story-export', 'FR-3', '--all']).status, 64);
  assert.equal(cli(root, ['lookup', 'story-export', 'FR-3', '--spec', '  ', '--all']).status, 64);
}));

test('decide refuses a missing answer, an unknown --by and an unknown --host with exit 64', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  for (const extra of [
    ['--question', 'q'],
    ['--question', 'q', '--answer', '   '],
    ['--answer', 'a'],
    ['--question', 'q', '--answer', 'a', '--by', 'robot'],
    ['--question', 'q', '--answer', 'a', '--host', 'vscode'],
  ]) {
    assert.equal(cli(root, ['decide', 'run-a', 'FR-1', ...extra]).status, 64, extra.join(' '));
  }
  assert.equal(read(fileOf(root, 'run-a', 'decisions.jsonl')), null);
}));

// ---------- budgets ----------

test('raise refuses lowering, equal, from 0, an unknown key and a missing approval, recording nothing', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  const cases = {
    lowering: ['max_review_cycles', '3', '--from', '4', '--approval', 'yes'],
    equal: ['max_review_cycles', '4', '--from', '4', '--approval', 'yes'],
    'from 0, meaning unbounded or disabled': ['max_run_minutes', '60', '--from', '0', '--approval', 'yes'],
    'an anchored instrument': ['max_eval_cycles', '3', '--from', '2', '--approval', 'yes'],
    'an unknown key': ['max_everything', '3', '--from', '2', '--approval', 'yes'],
    'a missing approval': ['max_review_cycles', '6', '--from', '4'],
    'a blank approval': ['max_review_cycles', '6', '--from', '4', '--approval', '  '],
    'a missing --from': ['max_review_cycles', '6', '--approval', 'yes'],
    'a negative --from': ['max_review_cycles', '6', '--from', '-1', '--approval', 'yes'],
    'a fractional <to>': ['max_review_cycles', '6.5', '--from', '4', '--approval', 'yes'],
  };
  for (const [label, args] of Object.entries(cases)) {
    const r = cli(root, ['raise', 'run-a', ...args]);
    assert.equal(r.status, 2, `${label}: ${r.stderr}`);
    assert.match(r.stderr, /raise refused/, label);
    assert.equal(r.stdout, '', label);
  }
  assert.equal(read(fileOf(root, 'run-a', 'budget-raises.jsonl')), null);
  assert.equal(cli(root, ['budget', 'run-a', 'max_review_cycles']).status, 1);
}));

test('raise records the approval verbatim, and budget and raises report it for the FINAL', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  assert.equal(ok(root, ['raises', 'run-a']).stdout, '', 'no raises prints nothing, and the FINAL says none');
  const r = ok(root, ['raise', 'run-a', 'max_review_cycles', '6', '--from', '4', '--approval', 'Yes — raise it to 6']);
  assert.equal(r.stdout, 'BUDGET RAISED max_review_cycles 4→6\n');
  ok(root, ['raise', 'run-a', 'max_review_cycles', '8', '--from', '6', '--approval', 'ok, "8" then\nand stop there']);
  ok(root, ['raise', 'run-a', 'gate_wall_clock_minutes', '30', '--from', '15', '--approval', 'fine']);

  const records = jsonl(fileOf(root, 'run-a', 'budget-raises.jsonl'));
  assert.deepEqual(Object.keys(records[0]), ['key', 'from', 'to', 'approval', 'at']);
  assert.deepEqual([records[0].from, records[0].to], [4, 6]);
  assert.equal(records[1].approval, 'ok, "8" then\nand stop there');

  assert.equal(ok(root, ['budget', 'run-a', 'max_review_cycles']).stdout, '8\n');
  assert.equal(ok(root, ['budget', 'run-a', 'gate_wall_clock_minutes']).stdout, '30\n');
  assert.equal(cli(root, ['budget', 'run-a', 'max_qa_cycles']).status, 1);

  assert.equal(ok(root, ['raises', 'run-a']).stdout, [
    'max_review_cycles 4→6 (approved: "Yes — raise it to 6")',
    'max_review_cycles 6→8 (approved: "ok, \\"8\\" then\\nand stop there")',
    'gate_wall_clock_minutes 15→30 (approved: "fine")',
    '',
  ].join('\n'));
}));

test('a raise from a --from below an earlier raise is refused and names the cap in force', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  ok(root, ['raise', 'run-a', 'max_family_cycles', '9', '--from', '6', '--approval', 'nine']);
  // A resumed conductor that shows the operator the resolved value, not the raised one,
  // asks for an approval that would change nothing.
  const r = cli(root, ['raise', 'run-a', 'max_family_cycles', '7', '--from', '6', '--approval', 'seven']);
  assert.equal(r.status, 2, r.stderr);
  assert.match(r.stderr, /raise refused: max_family_cycles is already 9/);
  assert.equal(r.stdout, '');
  assert.equal(jsonl(fileOf(root, 'run-a', 'budget-raises.jsonl')).length, 1);
  // Raising from the cap in force is fine, and another key is unaffected.
  ok(root, ['raise', 'run-a', 'max_family_cycles', '11', '--from', '9', '--approval', 'eleven']);
  ok(root, ['raise', 'run-a', 'max_qa_cycles', '4', '--from', '3', '--approval', 'four']);
  assert.equal(ok(root, ['budget', 'run-a', 'max_family_cycles']).stdout, '11\n');
  assert.equal(ok(root, ['raises', 'run-a']).stdout.split('\n').filter(Boolean).length, 3);
}));

test('the six execution budgets, and only those, are raisable', withRoot((root) => {
  assert.deepEqual(RAISABLE.slice().sort(), [
    'gate_wall_clock_minutes', 'max_contract_amendments', 'max_family_cycles',
    'max_qa_cycles', 'max_review_cycles', 'max_run_minutes',
  ]);
  ok(root, ['start', 'run-a']);
  for (const key of RAISABLE) ok(root, ['raise', 'run-a', key, '2', '--from', '1', '--approval', 'yes']);
  assert.equal(jsonl(fileOf(root, 'run-a', 'budget-raises.jsonl')).length, 6);
}));

// ---------- watch ----------

test('watch --once notifies an idle run through --notify, with the message as one argument', withRoot((root) => {
  const stub = stubNotifier(root);
  const label = 'Step 5 — QA "$(touch PWNED)"; `touch PWNED` \'x\'';
  ok(root, ['start', 'run-a']);
  ok(root, ['next', 'run-a', label]);
  patchLease(root, 'run-a', { heartbeat_at: minutesAgo(45) });
  const r = cli(root, ['watch', '--once', '--notify', stub.notify]);
  assert.equal(r.status, 4, r.stderr);
  const calls = stub.calls();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].length, 1, 'the message must arrive as exactly one argv element');
  assert.match(calls[0][0], /^orchestrator run run-a has been idle 4[56] min at /);
  assert.ok(calls[0][0].endsWith(label), `the label must arrive verbatim: ${calls[0][0]}`);
  assert.ok(!fs.existsSync(path.join(root, 'PWNED')), 'a shell evaluated the label');
  assert.match(r.stdout, /has been idle/, 'the watcher logs what it said');
}));

test('watch --once stays quiet: no active run, a fresh run, idle under the threshold, a FINAL, done', withRoot((root) => {
  const stub = stubNotifier(root);
  const once = (...extra) => cli(root, ['watch', '--once', '--notify', stub.notify, ...extra]);
  assert.equal(once().status, 0, 'no ACTIVE');
  ok(root, ['start', 'run-a']);
  assert.equal(once().status, 0, 'fresh');
  patchLease(root, 'run-a', { heartbeat_at: minutesAgo(45) });
  assert.equal(once('--idle-minutes', '60').status, 0, 'idle under the threshold');

  const plans = path.join(root, 'plans', 'run-a');
  fs.mkdirSync(plans, { recursive: true });
  fs.writeFileSync(path.join(plans, 'FINAL-20260929T111500Z-c3d4-run-a.md'), '# final\n');
  assert.equal(once().status, 0, 'a FINAL means the run finished');
  fs.rmSync(plans, { recursive: true });

  ok(root, ['done', 'run-a']);
  assert.equal(once().status, 0, 'done removed ACTIVE');
  // Even if ACTIVE still named it, a done run is not idle.
  fs.writeFileSync(path.join(runsDir(root), 'ACTIVE'), 'run-a\n');
  patchLease(root, 'run-a', { heartbeat_at: minutesAgo(45) });
  assert.equal(once().status, 0, 'done');
  assert.deepEqual(stub.calls(), []);
}));

test('watch --once reports a pending decision, whatever the idle time', withRoot((root) => {
  const stub = stubNotifier(root);
  ok(root, ['start', 'run-a']);
  ok(root, ['wait', 'run-a', 'Status: STALLED — family budget reached']);
  const r = cli(root, ['watch', '--once', '--notify', stub.notify]);
  assert.equal(r.status, 4, r.stderr);
  const waiting = 'orchestrator run run-a is waiting for your decision: ';
  assert.deepEqual(stub.calls(), [[`${waiting}Status: STALLED — family budget reached`]]);

  // The Stop hook's guard writes the same file with a millisecond timestamp.
  const guard = `${new Date().toISOString()} watchdog: 3 blocks without progress\n`;
  fs.writeFileSync(fileOf(root, 'run-a', 'pending_decision'), guard);
  assert.equal(cli(root, ['watch', '--once', '--notify', stub.notify]).status, 4);
  assert.equal(stub.calls()[1][0], `${waiting}watchdog: 3 blocks without progress`);
}));

test('watch without --once polls at once and keeps running', withRoot(async (root) => {
  const stub = stubNotifier(root);
  ok(root, ['start', 'run-a']);
  patchLease(root, 'run-a', { heartbeat_at: minutesAgo(45) });
  const args = [SCRIPT, '--root', root, 'watch', '--notify', stub.notify];
  const child = spawn(process.execPath, args, { cwd: root, stdio: 'ignore' });
  try {
    for (let waited = 0; stub.calls().length === 0 && waited < 10000; waited += 50) await sleep(50);
    assert.equal(stub.calls().length, 1, 'the first poll runs at startup, not after the first 60 s');
    await sleep(500);
    assert.equal(child.exitCode, null, 'the watcher exited instead of polling on');
  } finally {
    child.kill();
    if (child.exitCode === null && child.signalCode === null) await new Promise((resolve) => child.once('exit', resolve));
  }
}));

test('the long-running watcher notifies once per idle episode and once per pending decision', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  const said = [];
  const tick = watcher(root, 30, (message) => said.push(message));
  assert.equal(tick(Date.now()), false, 'a fresh run is not idle');

  patchLease(root, 'run-a', { heartbeat_at: minutesAgo(45) });
  assert.equal(tick(Date.now()), true);
  assert.equal(tick(Date.now()), false, 'an episode is announced once');
  assert.equal(tick(Date.now() + 60 * 60000), false, 'an hour later it is still the same episode');

  // Progress ends the episode, and going quiet again starts a new one.
  ok(root, ['next', 'run-a', 'Step 2 — architect']);
  assert.equal(tick(Date.now()), false);
  assert.equal(tick(Date.now() + 31 * 60000), true);

  ok(root, ['wait', 'run-a', 'first question']);
  assert.equal(tick(Date.now()), true);
  assert.equal(tick(Date.now()), false, 'one pending decision is announced once');
  ok(root, ['wait', 'run-a', 'second question']);
  assert.equal(tick(Date.now()), true);
  assert.equal(said.length, 4);
}));

test('a failing notifier is reported, falls back to the bell, and --once still exits 4', withRoot((root) => {
  ok(root, ['start', 'run-a']);
  ok(root, ['wait', 'run-a', 'a question']);
  let r = cli(root, ['watch', '--once', '--notify', `${JSON.stringify(process.execPath)} -e "process.exit(3)"`]);
  assert.equal(r.status, 4);
  assert.match(r.stderr, /notifier .+ failed \(exit 3\)/);
  assert.ok(r.stdout.startsWith('\x07'), 'a failed notifier falls back to the bell');
  r = cli(root, ['watch', '--once', '--notify', path.join(root, 'no-such-notifier')]);
  assert.equal(r.status, 4);
  assert.match(r.stderr, /failed \(ENOENT\)/);
}));

test('watch refuses a bad --idle-minutes or --notify with exit 64', withRoot((root) => {
  for (const extra of [
    ['--idle-minutes', '0'],
    ['--idle-minutes', 'soon'],
    ['--notify', ''],
    ['--notify', '"unterminated'],
  ]) {
    assert.equal(cli(root, ['watch', '--once', ...extra]).status, 64, extra.join(' '));
  }
}));

test('splitCommand splits a --notify command the way a shell splits words, and evaluates nothing', () => {
  assert.deepEqual(splitCommand('say  -v Alex'), ['say', '-v', 'Alex']);
  assert.deepEqual(splitCommand(`"/Apps/My Tools/notify" 'a b' c\\ d`), ['/Apps/My Tools/notify', 'a b', 'c d']);
  assert.deepEqual(splitCommand(`"say \\"hi\\"" '$HOME'`), ['say "hi"', '$HOME']);
  assert.deepEqual(splitCommand('echo $(id) ; `id`'), ['echo', '$(id)', ';', '`id`']);
  assert.deepEqual(splitCommand(`osascript -e 'display notification "x"'`), ['osascript', '-e', 'display notification "x"']);
  assert.deepEqual(splitCommand(''), []);
  assert.equal(splitCommand('"unterminated'), null);
  assert.equal(splitCommand("'unterminated"), null);
});

// ---------- the command line ----------

test('an unknown command prints usage and exits 64, and help exits 0', withRoot((root) => {
  let r = cli(root, ['frobnicate']);
  assert.equal(r.status, 64);
  assert.match(r.stderr, /unknown command: "frobnicate"/);
  assert.match(r.stderr, /usage: node \.orchestrator\/run-state\.cjs/);
  r = cli(root, []);
  assert.equal(r.status, 64);
  assert.match(r.stderr, /no command given/);
  r = spawnSync(process.execPath, [SCRIPT, '--help'], { cwd: root, encoding: 'utf8' });
  assert.equal(r.status, 0);
  assert.match(r.stdout, /usage:/);
}));

test('a malformed invocation exits 64 before it touches anything', withRoot((root) => {
  for (const args of [
    ['start'],
    ['start', 'run-a', '--json'],
    ['start', 'run-a', '--bogus'],
    ['start', 'run-a', '--host'],
    ['start', 'run-a', '--host', 'vscode'],
    ['next', 'run-a'],
    ['next', 'run-a', 'Step', '4'],
    ['next', 'run-a', '   '],
    ['wait', 'run-a', ''],
    ['lookup', 'run-a'],
    ['raise', 'run-a', 'max_qa_cycles'],
    ['status', 'run-a'],
  ]) {
    const r = cli(root, args);
    assert.equal(r.status, 64, `${JSON.stringify(args)}: ${r.stderr}`);
  }
  assert.ok(!fs.existsSync(path.join(root, '.orchestrator')), 'a usage error created state');
}));

test('a run name that could leave .orchestrator/runs/ is refused', withRoot((root) => {
  // 65 characters is past the Stop hook's own cap, so the hook would never follow it.
  const tooLong = `r${'x'.repeat(64)}`;
  for (const name of ['../escape', 'a/b', 'a\\b', '..', '.', '.hidden', '-flag', 'a b', '', 'ACTIVE', 'active', tooLong]) {
    const r = cli(root, ['start', name]);
    assert.equal(r.status, 64, `${JSON.stringify(name)}: ${r.stderr}`);
    assert.match(r.stderr, /invalid run name/, JSON.stringify(name));
  }
  assert.ok(!fs.existsSync(path.join(root, '.orchestrator')));
  assert.ok(!fs.existsSync(path.join(root, 'escape')));
  // A real run folder name passes, up to the longest one the mint recipe can produce.
  ok(root, ['start', '20260924T104209Z-81c3-events-follow-ups']);
  ok(root, ['start', `20260924T104209Z-81c3-${'s'.repeat(40)}`, '--force']);
}));

const gitOk = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;

test('without --root the root is the git top level', { skip: !gitOk && 'git unavailable' }, withRoot((root) => {
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root, env }).status, 0);
  const sub = path.join(root, 'packages', 'app');
  fs.mkdirSync(sub, { recursive: true });
  const r = spawnSync(process.execPath, [SCRIPT, 'start', 'run-a'], { cwd: sub, encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(fileOf(root, 'run-a', 'lease.json')));
  assert.ok(!fs.existsSync(path.join(sub, '.orchestrator')));
}));

test('the materialized copy roots at the directory holding .orchestrator/, as its siblings do', { skip: !gitOk && 'git unavailable' }, withRoot((root) => {
  // A package in a monorepo: `.orchestrator/` and `plans/` sit in app/, below the git top level.
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  assert.equal(spawnSync('git', ['init', '-q'], { cwd: root, env }).status, 0);
  const app = path.join(root, 'app');
  fs.mkdirSync(path.join(app, '.orchestrator'), { recursive: true });
  fs.mkdirSync(path.join(app, 'src'));
  const copy = path.join(app, '.orchestrator', 'run-state.cjs');
  fs.copyFileSync(SCRIPT, copy);
  const run = (cwd, ...args) => spawnSync(process.execPath, [copy, ...args], { cwd, encoding: 'utf8', env });

  assert.equal(run(path.join(app, 'src'), 'start', 'run-a').status, 0);
  assert.ok(fs.existsSync(fileOf(app, 'run-a', 'lease.json')));
  assert.ok(!fs.existsSync(path.join(root, '.orchestrator')), 'the run state landed at the git top level');
  fs.mkdirSync(path.join(app, 'plans', 'run-a'), { recursive: true });
  fs.writeFileSync(path.join(app, 'plans', 'run-a', 'FINAL-001-x.md'), '# final\n');
  const s = run(root, 'status', '--json');
  assert.equal(s.status, 0, s.stderr);
  assert.equal(JSON.parse(s.stdout).final, 'plans/run-a/FINAL-001-x.md');
}));

test('outside any repository the root is the cwd', withRoot((root) => {
  const env = { ...process.env, GIT_DIR: path.join(root, 'no-such-repo') };
  const r = spawnSync(process.execPath, [SCRIPT, 'start', 'run-a'], { cwd: root, encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(fileOf(root, 'run-a', 'lease.json')));
}));

test('no output hands a run to the session that reads it', withRoot((root) => {
  // The Stop hook takes `run-state.cjs start <run>` or `run-state.cjs next <run>` in a
  // session's transcript as evidence that the session conducts that run. Only the
  // command a conductor runs may carry it, never what this script prints back.
  const evidence = /run-state\.cjs\s+(start|next)\s+run-/;
  const outputs = [];
  for (const args of [
    ['start', 'run-a'],
    ['start', 'run-b'],
    ['next', 'run-a', 'Step 1 — brainstormer'],
    ['status'],
    ['status', '--json'],
    ['next', 'run-typo', 'Step 1 — brainstormer'],
    ['start', 'run-b', '--force'],
    ['next', 'run-a', 'Step 2 — architect'],
    ['wait', 'run-a', 'a question'],
    ['frobnicate'],
  ]) {
    const r = cli(root, args);
    outputs.push(r.stdout, r.stderr);
  }
  for (const out of outputs) assert.doesNotMatch(out, evidence);
}));
