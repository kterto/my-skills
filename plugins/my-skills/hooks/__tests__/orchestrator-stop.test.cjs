const { test, after } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  RUN, STEP, project, writeRun, v2, writeInFlight, tempDir, cleanup, childEnv, readLease, writeFinal, PENDING_LINE,
} = require('./fixtures/run.cjs');

const HOOK = path.join(__dirname, '..', 'orchestrator-stop.cjs');
const HOOKS_JSON = path.join(__dirname, '..', 'hooks.json');
// The hook as it shipped before lease v2, byte for byte: what a plugin cache that has not
// updated yet still runs against a project whose run-state.cjs already writes v2.
const HOOK_BEFORE_V2 = path.join(__dirname, 'fixtures', 'orchestrator-stop-v1.cjs');
const { CHUNK_BYTES, SCAN_CAP_BYTES, activeRuns, recordBlock, blockReason, runStateCalls, willResume } = require(HOOK);

after(cleanup);

// Every case spawns the hook the way Claude Code does: one JSON object on stdin, the
// verdict on stdout, and exit 0 whatever happens. A stop that is not blocked must
// leave no trace at all, so those cases also assert that the lease is untouched.

// The two reasons, verbatim; `<run>` is the run's name, `<what>` and `<question>` stay as written.
const STALL = 'Orchestrator watchdog: the run is active with no FINAL, no pending decision and nothing in flight; nothing will '
  + 'resume it. Dispatch the NEXT step `node .orchestrator/run-state.cjs status` prints, then record it: '
  + "`node .orchestrator/run-state.cjs dispatch <run> '<what>'`. Use `wait <run> '<Status line or question>'` for a "
  + 'STALLED stop or an operator question (AskUserQuestion / question first), `done <run>` when over.';
const RETURNED = 'Orchestrator watchdog: the work recorded with dispatch has reported back and nothing is in flight, so '
  + 'nothing will resume the run. Act on the hand-back now: record the step you move to with `next` and dispatch it, run '
  + "`wait <run> '<question>'` if the operator must answer, or `done <run>` if the run is over.";
const stall = (run = RUN) => STALL.replaceAll('<run>', run);
const returned = (run = RUN) => RETURNED.replaceAll('<run>', run);

/** A Bash tool call, serialized the way Claude Code writes it into the transcript. */
function bashLine(command) {
  const content = [{ type: 'tool_use', id: 'toolu_01', name: 'Bash', input: { command, description: 'Run state' } }];
  return `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', content } })}\n`;
}

const NEXT_CALL = bashLine(`node .orchestrator/run-state.cjs next ${RUN} "${STEP}" --note "cycle 2 of 4"`);

function transcript(root, text) {
  fs.writeFileSync(path.join(root, 'transcript.jsonl'), text);
}

function stop(root, input = {}, env = { CLAUDE_PROJECT_DIR: root }, hook = HOOK) {
  const hookEnv = childEnv(env);
  if (!('CLAUDE_PROJECT_DIR' in env)) delete hookEnv.CLAUDE_PROJECT_DIR;
  return cp.spawnSync(process.execPath, [hook], {
    input: JSON.stringify({
      session_id: 'session-1',
      transcript_path: path.join(root, 'transcript.jsonl'),
      cwd: root,
      hook_event_name: 'Stop',
      stop_hook_active: false,
      ...input,
    }),
    encoding: 'utf8',
    env: hookEnv,
  });
}

function assertBlocked(r) {
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stderr, '');
  assert.strictEqual(r.stdout.trim().split('\n').length, 1, 'exactly one JSON object on stdout');
  const verdict = JSON.parse(r.stdout);
  assert.deepStrictEqual(Object.keys(verdict), ['decision', 'reason']);
  assert.strictEqual(verdict.decision, 'block');
  return verdict.reason;
}

function assertAllowed(r) {
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stdout, '');
  assert.strictEqual(r.stderr, '');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
const task = (type, status = 'running') => ({ id: `t-${type}`, type, status, description: `a ${type}` });
// A lease v2 conducted by the session the stop comes from: ownership by id, no transcript needed.
const conducted = (fields = {}) => ({ lease: v2({ conductor_session: 'session-1', ...fields }) });

test('blocks a proved conductor stop and tells it to dispatch the NEXT step and record it', () => {
  const { root, dir } = project();
  transcript(root, NEXT_CALL);

  const reason = assertBlocked(stop(root));

  assert.strictEqual(reason, stall());
  assert.ok(reason.length <= 600, `reason is ${reason.length} characters`);
  const lease = JSON.parse(readLease(dir));
  assert.strictEqual(lease.blocks, 1);
  assert.strictEqual(lease.last_block_next, STEP);
  assert.strictEqual(lease.session_id, 'session-1');
  assert.strictEqual(lease.state, 'active');
  assert.match(lease.last_block_at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['NEXT', 'lease.json'], 'no temp file left behind');
});

test('the two reasons are exact, fit 600 characters at a 64-character run, and are no ownership evidence', () => {
  const longest = `20261007T101500Z-a1b2-${'x'.repeat(42)}`;
  assert.strictEqual(longest.length, 64);
  assert.strictEqual(blockReason(longest), stall(longest));
  assert.strictEqual(blockReason(longest, 'stall'), stall(longest));
  assert.strictEqual(blockReason(longest, 'returned'), returned(longest));
  assert.strictEqual(blockReason(longest).length, 596);
  assert.strictEqual(blockReason(longest, 'returned').length, 426);
  for (const reason of [blockReason(longest), blockReason(longest, 'returned')]) {
    assert.doesNotMatch(reason, /run-state\.cjs\s+(start|next)\s+\S/);
  }
});

test('the session that started the run owns it before its first next', () => {
  const { root } = project({ next: 'Step 0 — preflight' });
  transcript(root, bashLine(`node .orchestrator/run-state.cjs start ${RUN} --host claude-code`));
  assertBlocked(stop(root));
});

test('no ACTIVE file: exits at once and writes nothing', () => {
  const root = tempDir('orch-stop-');
  transcript(root, NEXT_CALL);
  assertAllowed(stop(root));
  assert.deepStrictEqual(fs.readdirSync(root), ['transcript.jsonl']);
});

test('a waiting or done run is not pushed', () => {
  for (const state of ['waiting', 'done']) {
    const { root, dir } = project({ lease: { state } });
    transcript(root, NEXT_CALL);
    const before = readLease(dir);
    assertAllowed(stop(root));
    assert.strictEqual(readLease(dir), before, state);
  }
});

test('a run with a FINAL is over, whatever the lease says', () => {
  const { root, dir } = project();
  transcript(root, NEXT_CALL);
  writeFinal(root);
  const before = readLease(dir);
  assertAllowed(stop(root));
  assert.strictEqual(readLease(dir), before);
});

test('a pending_decision is a deliberate stop and is never pushed past', () => {
  const { root, dir } = project();
  transcript(root, NEXT_CALL);
  fs.writeFileSync(path.join(dir, 'pending_decision'), '2026-09-29T10:20:00.000Z Status: STALLED — contract amendment budget\n');
  const before = readLease(dir);
  assertAllowed(stop(root));
  assert.strictEqual(readLease(dir), before);
});

test('stop_hook_active: the turn already continued once on a block, and made no progress', () => {
  const { root, dir } = project({ lease: { blocks: 1, last_block_next: STEP } });
  transcript(root, NEXT_CALL);
  const before = readLease(dir);
  assertAllowed(stop(root, { stop_hook_active: true }));
  assert.strictEqual(readLease(dir), before);
});

test('stop_hook_active: progress since the last block re-arms the watchdog for the rest of the turn', () => {
  // Claude Code keeps stop_hook_active set until the operator's next message, so an
  // unattended run that got one rescue must still get the next one, on a later step.
  const moved = project({ lease: { blocks: 1, last_block_next: 'Step 3 — coder' } });
  transcript(moved.root, NEXT_CALL);
  assertBlocked(stop(moved.root, { stop_hook_active: true }));
  assert.strictEqual(JSON.parse(readLease(moved.dir)).last_block_next, STEP);

  // Away and back to the same label: `next` reset the count when the step changed.
  const cycled = project({ lease: { blocks: 0, last_block_next: STEP } });
  transcript(cycled.root, NEXT_CALL);
  assertBlocked(stop(cycled.root, { stop_hook_active: true }));

  // A first stop in the turn is blocked whatever the count says, up to the guard.
  const fresh = project({ lease: { blocks: 1, last_block_next: STEP } });
  transcript(fresh.root, NEXT_CALL);
  assertBlocked(stop(fresh.root, { stop_hook_active: false }));
  assert.strictEqual(JSON.parse(readLease(fresh.dir)).blocks, 2);
});

test('a heartbeat older than 12 h marks an abandoned run', () => {
  const { root, dir } = project({ lease: { heartbeat_at: hoursAgo(13) } });
  transcript(root, NEXT_CALL);
  const before = readLease(dir);
  assertAllowed(stop(root));
  assert.strictEqual(readLease(dir), before);
});

test('a missing transcript proves nothing', () => {
  const { root, dir } = project();
  const before = readLease(dir);
  assertAllowed(stop(root));
  assert.strictEqual(readLease(dir), before);
});

test('an unrelated session in the same project is never blocked', () => {
  const { root, dir } = project();
  transcript(root, [
    bashLine('node .orchestrator/run-state.cjs status'),
    bashLine(`cat .orchestrator/runs/${RUN}/NEXT`),
    bashLine(`node .orchestrator/run-state.cjs raises ${RUN}`),
    bashLine(`node .orchestrator/run-state.cjs lookup ${RUN} FR-3 --spec SPEC-20260929T101500Z-a1b2 --all`),
    bashLine(`node .orchestrator/run-state.cjs dispatch ${RUN} 'reviewer'`),
    bashLine(`grep -n "run-state.cjs next ${RUN}" notes.md`),
    bashLine('node .orchestrator/run-state.cjs next 20260928T090000Z-ffff-other-run "Step 2 — architect"'),
    bashLine(`node .orchestrator/run-state.cjs next ${RUN}-other "Step 2 — architect"`),
  ].join(''));
  const before = readLease(dir);
  assertAllowed(stop(root));
  assert.strictEqual(readLease(dir), before);
});

test('only the session\'s own commands prove ownership, never output or prose that quotes one', () => {
  // `status` prints NEXT's note verbatim, and a note may quote the command itself.
  const quoted = `node .orchestrator/run-state.cjs next ${RUN} "Step 5 — QA"`;
  const { root, dir } = project();
  transcript(root, [
    bashLine('node .orchestrator/run-state.cjs status'),
    `${JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'toolu_01', content: `next: ${STEP}\n  after the CR: ${quoted}` }] } })}\n`,
    `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: `I will run ${quoted} next.` }] } })}\n`,
    bashLine(`node .orchestrator/run-state.cjs wait other-run "blocked on: ${quoted}"`),
  ].join(''));
  const before = readLease(dir);
  assertAllowed(stop(root));
  assert.strictEqual(readLease(dir), before);

  // Nor does a --note that quotes it: the note is one word of the conductor's own `next`.
  const noted = project();
  transcript(noted.root, bashLine(`node .orchestrator/run-state.cjs next other-run "Step 2" --note "then: ${quoted.replace(/"/g, '\\"')}"`));
  assertAllowed(stop(noted.root));
});

test('ownership reads the command as a shell would: quotes, flags and spacing do not hide it', () => {
  for (const command of [
    `node .orchestrator/run-state.cjs next "${RUN}" "${STEP}"`,
    `node .orchestrator/run-state.cjs next '${RUN}' '${STEP}'`,
    `node .orchestrator/run-state.cjs --root . next ${RUN} "${STEP}"`,
    `node  .orchestrator/run-state.cjs  next  ${RUN}  "${STEP}"`,
    `cd app && node ./.orchestrator/run-state.cjs next ${RUN} "${STEP}" --note "cycle 2" && echo ok`,
    // --take-over takes no value, so it never swallows the run that follows it.
    `node .orchestrator/run-state.cjs next --take-over ${RUN} "${STEP}"`,
    `node .orchestrator/run-state.cjs next ${RUN} "${STEP}" --take-over`,
  ]) {
    const { root } = project();
    transcript(root, bashLine(command));
    assertBlocked(stop(root));
  }
  assert.deepStrictEqual(runStateCalls(`node .orchestrator/run-state.cjs start --take-over ${RUN}`, RUN), [{ command: 'start', label: null }]);
});

test('a session the run has moved on from is not pushed back into conducting it', () => {
  // S2 took the run over and is conducting STEP; S1's last step was the one before.
  const { root, dir } = project({ lease: { session_id: 'S2', blocks: 1, last_block_next: 'Step 3 — coder' } });
  const s1 = path.join(root, 'S1.jsonl');
  fs.writeFileSync(s1, bashLine(`node .orchestrator/run-state.cjs next ${RUN} "Step 3 — coder"`));
  const before = readLease(dir);
  assertAllowed(stop(root, { session_id: 'S1', transcript_path: s1 }));
  assert.strictEqual(readLease(dir), before, 'the superseded session took the lease back');

  // The recorded conductor is blocked on any evidence of the run.
  const s2 = path.join(root, 'S2.jsonl');
  fs.writeFileSync(s2, bashLine(`node .orchestrator/run-state.cjs next ${RUN} "Step 3 — coder"`));
  assertBlocked(stop(root, { session_id: 'S2', transcript_path: s2 }));

  // A new session that resumes by re-recording the current step takes the run over.
  const s3 = path.join(root, 'S3.jsonl');
  fs.writeFileSync(s3, [bashLine('node .orchestrator/run-state.cjs status'), NEXT_CALL].join(''));
  assertBlocked(stop(root, { session_id: 'S3', transcript_path: s3 }));
  assert.strictEqual(JSON.parse(readLease(dir)).session_id, 'S3');
  assertAllowed(stop(root, { session_id: 'S1', transcript_path: s1 }));

  // At Step 0, the start that wrote NEXT is the evidence.
  const started = project({ next: 'Step 0 — preflight', lease: { session_id: 'S2' } });
  transcript(started.root, bashLine(`node .orchestrator/run-state.cjs start ${RUN} --host claude-code`));
  assertBlocked(stop(started.root, { session_id: 'S4' }));
});

test('a lease that names its conductor settles ownership by id: the conductor needs no evidence, nobody else is blocked', () => {
  const { root, dir } = project(conducted());
  transcript(root, bashLine('node .orchestrator/run-state.cjs status'));
  assert.strictEqual(assertBlocked(stop(root, { background_tasks: [] })), stall());

  // Another session, even one whose own commands would prove the run, is let stop untouched.
  const other = project(conducted({ conductor_session: 'session-2' }));
  transcript(other.root, NEXT_CALL);
  const before = readLease(other.dir);
  assertAllowed(stop(other.root, { background_tasks: [] }));
  assert.strictEqual(readLease(other.dir), before);
  assert.strictEqual(JSON.parse(readLease(dir)).session_id, 'session-1');
});

test('a stall in a session that named its run through a variable is still blocked, with the stall reason', () => {
  // `$R` never proved anything as evidence; the conductor on record does.
  const byVariable = bashLine(`R=${RUN}; node .orchestrator/run-state.cjs next "$R" "${STEP}"`);
  const { root } = project(conducted());
  transcript(root, byVariable);
  assert.strictEqual(assertBlocked(stop(root, { background_tasks: [] })), stall());

  const legacy = project();
  transcript(legacy.root, byVariable);
  assertAllowed(stop(legacy.root, { background_tasks: [] }));
});

test('the block reason itself is not ownership evidence', () => {
  const { root } = project();
  transcript(root, NEXT_CALL);
  const reason = assertBlocked(stop(root));

  // Claude Code records the reason in the transcript it feeds back. Were it to carry
  // `run-state.cjs next <run>`, one block would hand ownership to any session that saw it.
  for (const text of [reason, returned()]) {
    const other = project();
    transcript(other.root, `${JSON.stringify({ type: 'user', message: { role: 'user', content: `Stop hook feedback:\n${text}` } })}\n`);
    assertAllowed(stop(other.root));
  }
});

test('a malformed lease or ACTIVE fails open, silently', () => {
  const broken = project();
  transcript(broken.root, NEXT_CALL);
  fs.writeFileSync(path.join(broken.dir, 'lease.json'), '{"run": "20260929T101500Z-a1b2-watch');
  assertAllowed(stop(broken.root));

  const noLease = project();
  transcript(noLease.root, NEXT_CALL);
  fs.rmSync(path.join(noLease.dir, 'lease.json'));
  assertAllowed(stop(noLease.root));
});

test('an ACTIVE that climbs out of runs/ is never followed, even to a lease that would block', () => {
  // `<root>/.orchestrator/runs/../../victim` is `<root>/victim`: a live lease and matching
  // evidence wait there, so only the run-name check stands between the hook and a write.
  const { root } = project();
  const victim = path.join(root, 'victim');
  const escape = '../../victim';
  writeRun(root, { run: escape });
  fs.writeFileSync(path.join(root, '.orchestrator', 'runs', 'ACTIVE'), `${escape}\n`);
  assert.ok(fs.existsSync(path.join(victim, 'lease.json')));
  transcript(root, bashLine(`node .orchestrator/run-state.cjs next ${escape} "${STEP}"`));
  const before = readLease(victim);

  assertAllowed(stop(root));

  assert.strictEqual(readLease(victim), before);
  assert.deepStrictEqual(fs.readdirSync(victim).sort(), ['NEXT', 'lease.json']);
});

test('three blocks on the same step trip the guard: the run parks as waiting', () => {
  const { root, dir } = project();
  transcript(root, NEXT_CALL);
  for (let n = 1; n <= 3; n++) {
    assertBlocked(stop(root));
    assert.strictEqual(JSON.parse(readLease(dir)).blocks, n);
  }

  assertAllowed(stop(root));

  const lease = JSON.parse(readLease(dir));
  assert.strictEqual(lease.state, 'waiting');
  assert.match(fs.readFileSync(path.join(dir, 'pending_decision'), 'utf8'), PENDING_LINE);
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['NEXT', 'lease.json', 'pending_decision']);
  assertAllowed(stop(root));
});

test('a new NEXT step restarts the count', () => {
  const { root, dir } = project();
  transcript(root, NEXT_CALL);
  assertBlocked(stop(root));
  assertBlocked(stop(root));
  fs.writeFileSync(path.join(dir, 'NEXT'), 'Step 4a — coder fix-up, cycle 2\n');

  assertBlocked(stop(root));

  const lease = JSON.parse(readLease(dir));
  assert.strictEqual(lease.blocks, 1);
  assert.strictEqual(lease.last_block_next, 'Step 4a — coder fix-up, cycle 2');
});

// ---------- will something resume the session? ----------

test('what wakes the session by itself lets the stop through, active or dispatched, and writes nothing', () => {
  for (const state of ['active', 'dispatched']) {
    for (const type of ['subagent', 'local_agent', 'workflow', 'local_workflow', 'cloud session', 'remote_agent', 'MCP task', 'mcp_task']) {
      for (const status of ['running', 'pending']) {
        const { root, dir } = project(conducted({ state }));
        // Evidence as well as the conductor on record: a hook that ignored the list would block here.
        transcript(root, NEXT_CALL);
        const before = readLease(dir);
        assertAllowed(stop(root, { background_tasks: [task('dream'), task(type, status)] }));
        assert.strictEqual(readLease(dir), before, `${state} ${type} ${status}`);
      }
    }
  }
});

test('an active run is blocked beside a shell, a monitor, an idle teammate, an unknown task or a recurring wakeup', () => {
  for (const [label, input] of [
    ['a background shell', { background_tasks: [task('shell')] }],
    ['a monitor', { background_tasks: [task('monitor')] }],
    ['an idle teammate', { background_tasks: [task('teammate')] }],
    ['an unknown type', { background_tasks: [task('something new')] }],
    ['a recurring wakeup', { background_tasks: [], session_crons: [{ id: 'c1', schedule: '*/5 * * * *', recurring: true, prompt: '/loop' }] }],
  ]) {
    const { root, dir } = project(conducted());
    assert.strictEqual(assertBlocked(stop(root, input)), stall(), label);
    assert.strictEqual(JSON.parse(readLease(dir)).blocks, 1, label);
  }
});

test('a dispatched run is let through beside a shell, a monitor, a teammate, an unknown task or a recurring wakeup', () => {
  for (const input of [
    { background_tasks: [task('shell')] },
    { background_tasks: [task('monitor')] },
    { background_tasks: [task('teammate')] },
    { background_tasks: [task('something new')] },
    { background_tasks: [], session_crons: [{ id: 'c1', schedule: '*/5 * * * *', recurring: true, prompt: '/loop' }] },
  ]) {
    const { root, dir } = project(conducted({ state: 'dispatched' }));
    writeInFlight(dir, 'reviewer');
    const before = readLease(dir);
    assertAllowed(stop(root, input));
    assert.strictEqual(readLease(dir), before, JSON.stringify(input));
  }
});

test('a one-shot wakeup lets an active run stop', () => {
  const { root, dir } = project(conducted());
  transcript(root, NEXT_CALL);
  const before = readLease(dir);
  assertAllowed(stop(root, { background_tasks: [], session_crons: [{ id: 'c1', schedule: '2026-10-07T12:00', recurring: false, prompt: 'check' }] }));
  assert.strictEqual(readLease(dir), before);
});

test('housekeeping and finished tasks never count, whatever the state', () => {
  const quiet = [task('dream'), task('auto-mode scan'), task('memory import'), task('auto_mode_scan'), task('local_memory_import'),
    task('subagent', 'completed'), task('subagent', 'failed'), task('workflow', 'killed'), null, 'subagent'];
  const active = project(conducted());
  assert.strictEqual(assertBlocked(stop(active.root, { background_tasks: quiet })), stall());
  const dispatched = project(conducted({ state: 'dispatched' }));
  writeInFlight(dispatched.dir, 'reviewer');
  assert.strictEqual(assertBlocked(stop(dispatched.root, { background_tasks: quiet })), returned());
});

test('a host that sends no task list: a dispatched run will resume, an active one will not', () => {
  const dispatched = project(conducted({ state: 'dispatched' }));
  const before = readLease(dispatched.dir);
  assertAllowed(stop(dispatched.root));
  assert.strictEqual(readLease(dispatched.dir), before);
  for (const garbage of [undefined, null, 'subagent', { running: 1 }]) {
    const active = project(conducted());
    assert.strictEqual(assertBlocked(stop(active.root, { background_tasks: garbage })), stall(), String(garbage));
  }
});

test('willResume reads the host\'s lists as documented', () => {
  const at = (state) => ({ lease: { state } });
  assert.strictEqual(willResume(at('active'), { background_tasks: [task('subagent')] }), true);
  assert.strictEqual(willResume(at('active'), { background_tasks: [task('shell')] }), false);
  assert.strictEqual(willResume(at('dispatched'), { background_tasks: [task('shell')] }), true);
  assert.strictEqual(willResume(at('dispatched'), { background_tasks: [task('dream')] }), false);
  assert.strictEqual(willResume(at('dispatched'), { background_tasks: [] }), false);
  assert.strictEqual(willResume(at('dispatched'), {}), true);
  assert.strictEqual(willResume(at('active'), {}), false);
  assert.strictEqual(willResume(at('active'), { session_crons: [{ recurring: false }] }), true);
  assert.strictEqual(willResume(at('active'), { session_crons: [{ recurring: true }], background_tasks: [] }), false);
  assert.strictEqual(willResume(at('active'), { session_crons: [{}], background_tasks: [] }), false, 'a wakeup not said to be one-shot');
  assert.strictEqual(willResume(at('dispatched'), { session_crons: [{ recurring: true }], background_tasks: [] }), true);
  assert.strictEqual(willResume(at('active'), { background_tasks: [{ ...task('MCP TASK') }] }), true, 'labels are compared without case');
});

// ---------- the windows a background dispatch opens ----------

test('a stop right after a dispatch, with the subagent still running, is let through and leaves the lease untouched', () => {
  const { root, dir } = project(conducted({ state: 'dispatched', dispatched_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') }));
  writeInFlight(dir, 'reviewer, cycle 2');
  const before = readLease(dir);
  assertAllowed(stop(root, { background_tasks: [{ id: 'a1', type: 'subagent', status: 'running', description: 'reviewer', agent_type: 'reviewer' }] }));
  assert.strictEqual(readLease(dir), before);

  // The host's list wins over a declaration that was never made: a running subagent beside an active lease.
  const undeclared = project(conducted());
  transcript(undeclared.root, NEXT_CALL);
  const untouched = readLease(undeclared.dir);
  assertAllowed(stop(undeclared.root, { background_tasks: [task('subagent')] }));
  assert.strictEqual(readLease(undeclared.dir), untouched);
});

test('dispatched work that has reported back gets the returned reason, even right after a block at the same step', () => {
  const back = project(conducted({ state: 'dispatched' }));
  writeInFlight(back.dir, 'reviewer');
  assert.strictEqual(assertBlocked(stop(back.root, { background_tasks: [] })), returned());
  assert.strictEqual(JSON.parse(readLease(back.dir)).state, 'dispatched', 'a block is no transition');

  // Blocked at STEP, the conductor dispatches, the work comes back in the same turn, and it stops at STEP again.
  const { root, dir } = project(conducted());
  assert.strictEqual(assertBlocked(stop(root, { background_tasks: [] })), stall());
  const blocked = JSON.parse(readLease(dir));
  writeInFlight(dir, 'reviewer', new Date(Date.parse(blocked.last_block_at) + 1));
  fs.writeFileSync(path.join(dir, 'lease.json'), JSON.stringify({ ...blocked, state: 'dispatched' }));
  assert.strictEqual(assertBlocked(stop(root, { stop_hook_active: true, background_tasks: [] })), returned());
  assert.strictEqual(JSON.parse(readLease(dir)).blocks, 2, 'the dispatch did not reset the count');

  // With nothing dispatched since that block, the same stop is let through.
  const before = readLease(dir);
  assertAllowed(stop(root, { stop_hook_active: true, background_tasks: [] }));
  assert.strictEqual(readLease(dir), before);
});

test('a step gets three rescues in all, dispatch or not, then the guard parks the run', () => {
  const { root, dir } = project(conducted());
  const reasons = [];
  for (let stops = 0; stops < 4; stops++) {
    const r = stop(root, { stop_hook_active: stops > 0, background_tasks: [] });
    reasons.push(r.stdout ? JSON.parse(r.stdout).reason : null);
    const lease = JSON.parse(readLease(dir));
    if (lease.state === 'waiting') break;
    // The conductor answers every block with a dispatch whose work comes straight back.
    writeInFlight(dir, `attempt ${stops + 1}`, new Date(Date.parse(lease.last_block_at) + 1));
    fs.writeFileSync(path.join(dir, 'lease.json'), JSON.stringify({ ...lease, state: 'dispatched' }));
  }
  assert.deepStrictEqual(reasons, [stall(), returned(), returned(), null]);
  const lease = JSON.parse(readLease(dir));
  assert.strictEqual(lease.state, 'waiting');
  assert.match(fs.readFileSync(path.join(dir, 'pending_decision'), 'utf8'), PENDING_LINE);
});

// ---------- StopFailure ----------

/**
 * A notifier that appends its argv to `calls.jsonl`, and on PATH a fake `osascript` that
 * hands it its own — and a command named `0`, so that `ORCHESTRATOR_NOTIFY=0` run as a
 * command would be seen rather than fail quietly.
 */
function notifierBin() {
  const bin = tempDir('orch-notify-');
  const calls = path.join(bin, 'calls.jsonl');
  const stub = path.join(bin, 'stub.cjs');
  fs.writeFileSync(stub, `require('fs').appendFileSync(${JSON.stringify(calls)}, JSON.stringify(process.argv.slice(2)) + '\\n');\n`);
  for (const name of ['osascript', '0']) {
    fs.writeFileSync(path.join(bin, name), `#!/bin/sh\nexec ${JSON.stringify(process.execPath)} ${JSON.stringify(stub)} ${name} "$@"\n`, { mode: 0o755 });
  }
  const read = () => (fs.existsSync(calls) ? fs.readFileSync(calls, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : []);
  return { bin, stub, read, command: `${JSON.stringify(process.execPath)} ${JSON.stringify(stub)}` };
}

async function until(predicate, ms = 15000) {
  for (let waited = 0; waited < ms && !predicate(); waited += 50) await sleep(50);
  return predicate();
}

function stopFailure(root, input = {}, env = {}) {
  return stop(root, { hook_event_name: 'StopFailure', error: 'rate_limit', error_details: 'usage limit reached', ...input }, { CLAUDE_PROJECT_DIR: root, ...env });
}

const failureMessage = (at, detail = 'rate_limit: usage limit reached') =>
  `orchestrator run ${RUN}: the conductor's turn failed at ${at.slice(11, 16)}Z (${detail}); continue the session once it clears`;

test('StopFailure records the failure for a live run this session owns, then notifies with the message as one argument', async () => {
  const notifier = notifierBin();
  const { root, dir } = project(conducted({ state: 'dispatched' }));
  assertAllowed(stopFailure(root, {}, { ORCHESTRATOR_NOTIFY: notifier.command }));
  const lease = JSON.parse(readLease(dir));
  assert.deepStrictEqual(Object.keys(lease.stop_failure), ['at', 'error', 'details']);
  assert.match(lease.stop_failure.at, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/);
  assert.strictEqual(lease.stop_failure.error, 'rate_limit');
  assert.strictEqual(lease.stop_failure.details, 'usage limit reached');
  assert.strictEqual(lease.state, 'dispatched');
  assert.strictEqual(lease.blocks, 0);
  assert.ok(await until(() => notifier.read().length > 0), 'the notifier never ran');
  assert.deepStrictEqual(notifier.read(), [[failureMessage(lease.stop_failure.at)]]);

  // A waiting run and a v1 lease proved by evidence are live and owned too.
  const waiting = project(conducted({ state: 'waiting' }));
  assertAllowed(stopFailure(waiting.root));
  assert.strictEqual(JSON.parse(readLease(waiting.dir)).stop_failure.error, 'rate_limit');
  const legacy = project();
  transcript(legacy.root, NEXT_CALL);
  assertAllowed(stopFailure(legacy.root, { error: 'overloaded', error_details: undefined }));
  const recorded = JSON.parse(readLease(legacy.dir)).stop_failure;
  assert.strictEqual(recorded.error, 'overloaded');
  assert.strictEqual(recorded.details, null);
});

test('StopFailure keeps the record to one line of 200 characters, and names an error the host left out', () => {
  const { root, dir } = project(conducted());
  assertAllowed(stopFailure(root, { error: undefined, error_details: `first line\n\tsecond ${'y'.repeat(300)}` }));
  const { error, details } = JSON.parse(readLease(dir)).stop_failure;
  assert.strictEqual(error, 'unknown');
  assert.strictEqual(details.length, 200);
  assert.ok(details.startsWith('first line second yyy'), details);
});

test('StopFailure: ORCHESTRATOR_NOTIFY=0 sends nothing, and unset is a macOS notification on darwin only', async () => {
  const notifier = notifierBin();
  const PATH = `${notifier.bin}${path.delimiter}${process.env.PATH}`;

  const off = project(conducted());
  assertAllowed(stopFailure(off.root, {}, { PATH, ORCHESTRATOR_NOTIFY: '0' }));
  assert.strictEqual(JSON.parse(readLease(off.dir)).stop_failure.error, 'rate_limit', 'the failure is recorded either way');

  const unset = project(conducted());
  assertAllowed(stopFailure(unset.root, {}, { PATH, ORCHESTRATOR_NOTIFY: undefined }));
  const at = JSON.parse(readLease(unset.dir)).stop_failure.at;

  // The control: a notifier that always runs. Once its call lands, every earlier one has had its chance.
  const control = project(conducted());
  assertAllowed(stopFailure(control.root, { error: 'overloaded', error_details: '' }, { PATH, ORCHESTRATOR_NOTIFY: notifier.command }));
  assert.ok(await until(() => notifier.read().some((call) => call.length === 1)), 'the control notifier never ran');
  if (process.platform === 'darwin') await until(() => notifier.read().length === 2, 5000);
  await sleep(200);

  const osascript = [
    'osascript', '-e', 'on run argv', '-e', 'display notification (item 1 of argv) with title "orchestrator"', '-e', 'end run', failureMessage(at),
  ];
  const calls = notifier.read();
  const controlCall = calls.filter((call) => call.length === 1);
  assert.strictEqual(controlCall.length, 1);
  assert.match(controlCall[0][0], /\(overloaded\); continue the session once it clears$/);
  assert.deepStrictEqual(calls.filter((call) => call.length > 1), process.platform === 'darwin' ? [osascript] : []);
});

test('StopFailure records nothing for a run this session does not own, or one that is not live', () => {
  const cases = [
    ['another session\'s run', project(conducted({ conductor_session: 'session-2' }))],
    ['no evidence on a v1 lease', project()],
    ['a done run', project(conducted({ state: 'done' }))],
    ['a stale run', project(conducted({ heartbeat_at: hoursAgo(13) }))],
  ];
  const finished = project(conducted());
  writeFinal(finished.root);
  cases.push(['a run with a FINAL', finished]);
  for (const [label, { root, dir }] of cases) {
    transcript(root, bashLine('node .orchestrator/run-state.cjs status'));
    const before = readLease(dir);
    assertAllowed(stopFailure(root));
    assert.strictEqual(readLease(dir), before, label);
  }
});

test('a plain Stop never records a failure, and StopFailure never blocks', () => {
  const { root, dir } = project(conducted());
  transcript(root, NEXT_CALL);
  assertAllowed(stopFailure(root));
  assert.strictEqual(JSON.parse(readLease(dir)).blocks, 0);
  const other = project(conducted());
  assertBlocked(stop(other.root, { background_tasks: [] }));
  assert.strictEqual(JSON.parse(readLease(other.dir)).stop_failure, null);
});

test('hooks.json runs the same script for Stop and StopFailure, within the 10 s the host allows', () => {
  const { hooks } = JSON.parse(fs.readFileSync(HOOKS_JSON, 'utf8'));
  const commands = (event) => (hooks[event] ?? []).flatMap((entry) => entry.hooks);
  assert.deepStrictEqual(Object.keys(hooks).sort(), ['Stop', 'StopFailure']);
  assert.deepStrictEqual(commands('Stop'), [
    { type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/orchestrator-stop.cjs" || true', timeout: 10 },
  ]);
  assert.deepStrictEqual(commands('StopFailure'), commands('Stop'));
});

// ---------- ORCHESTRATOR_HOOK_DEBUG ----------

test('ORCHESTRATOR_HOOK_DEBUG appends each raw input as one line, and a sink that cannot be written changes nothing', () => {
  const { root, dir } = project(conducted());
  const sinkDir = tempDir('orch-debug-');
  const sink = path.join(sinkDir, 'inputs.jsonl');
  const run = (input, env) => cp.spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify(input, null, 2), // pretty-printed: newlines the dump must fold
    encoding: 'utf8',
    cwd: sinkDir,
    env: childEnv({ CLAUDE_PROJECT_DIR: root, ...env }),
  });
  const input = {
    session_id: 'session-1', transcript_path: path.join(root, 'transcript.jsonl'), cwd: root, hook_event_name: 'Stop',
    stop_hook_active: false, background_tasks: [task('subagent')], session_crons: [],
  };
  assertAllowed(run(input, { ORCHESTRATOR_HOOK_DEBUG: sink }));
  assertAllowed(run({ ...input, hook_event_name: 'SubagentStop' }, { ORCHESTRATOR_HOOK_DEBUG: sink }));
  const lines = fs.readFileSync(sink, 'utf8').split('\n');
  assert.strictEqual(lines.length, 3, 'one line per input, newline-terminated');
  assert.deepStrictEqual(JSON.parse(lines[0]), input);
  assert.strictEqual(JSON.parse(lines[1]).hook_event_name, 'SubagentStop');

  // A relative path is not a sink, and a directory cannot be one: the verdict is unchanged.
  assertAllowed(run(input, { ORCHESTRATOR_HOOK_DEBUG: 'relative.jsonl' }));
  assert.deepStrictEqual(fs.readdirSync(sinkDir), ['inputs.jsonl']);
  assert.strictEqual(fs.readFileSync(sink, 'utf8').split('\n').length, 3);
  assert.strictEqual(assertBlocked(run({ ...input, background_tasks: [] }, { ORCHESTRATOR_HOOK_DEBUG: sinkDir })), stall());
  assert.strictEqual(JSON.parse(readLease(dir)).blocks, 1);
});

// ---------- version skew ----------

const gitBlobId = (file) => {
  const bytes = fs.readFileSync(file);
  return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`), bytes])).digest('hex');
};

test('version skew: the old-hook fixture is the hook as it shipped before lease v2, byte for byte', () => {
  // `git rev-parse a92cf3a:plugins/my-skills/hooks/orchestrator-stop.cjs` names this blob.
  assert.strictEqual(gitBlobId(HOOK_BEFORE_V2), '91a6c9125004f1166637a48c76c860a33e34212c');
});

test('version skew: the old hook lets a dispatched run stop untouched, and still blocks an active one', () => {
  const dispatched = project(conducted({ state: 'dispatched' }));
  writeInFlight(dispatched.dir, 'reviewer');
  transcript(dispatched.root, NEXT_CALL);
  const before = readLease(dispatched.dir);
  assertAllowed(stop(dispatched.root, { background_tasks: [] }, undefined, HOOK_BEFORE_V2));
  assert.strictEqual(readLease(dispatched.dir), before);

  // The control: the same old hook, the same evidence, an active lease.
  const activeRun = project(conducted());
  transcript(activeRun.root, NEXT_CALL);
  assertBlocked(stop(activeRun.root, { background_tasks: [] }, undefined, HOOK_BEFORE_V2));
  const lease = JSON.parse(readLease(activeRun.dir));
  assert.strictEqual(lease.blocks, 1);
  assert.strictEqual(lease.conductor_session, 'session-1', 'the old hook writes the v2 fields back as it found them');
  assert.strictEqual(lease.version, 2);
});

test('version skew: on a v1 lease the new hook decides as the old one did, with or without a task list', () => {
  const s1 = (root) => {
    const file = path.join(root, 'S1.jsonl');
    fs.writeFileSync(file, bashLine(`node .orchestrator/run-state.cjs next ${RUN} "Step 3 — coder"`));
    return { session_id: 'S1', transcript_path: file };
  };
  const scenarios = [
    ['a proved stop', {}, () => ({})],
    ['a waiting run', { lease: { state: 'waiting' } }, () => ({})],
    ['a done run', { lease: { state: 'done' } }, () => ({})],
    ['an abandoned run', { lease: { heartbeat_at: hoursAgo(13) } }, () => ({})],
    ['a rescued turn that made no progress', { lease: { blocks: 1, last_block_next: STEP } }, () => ({ stop_hook_active: true })],
    ['a rescued turn on a new step', { lease: { blocks: 1, last_block_next: 'Step 3 — coder' } }, () => ({ stop_hook_active: true })],
    ['the guard', { lease: { blocks: 3, last_block_next: STEP } }, () => ({})],
    ['a session the run moved on from', { lease: { session_id: 'S2' } }, s1],
  ];
  const outcome = (r, dir) => {
    const lease = JSON.parse(readLease(dir));
    return {
      blocked: r.stdout !== '',
      state: lease.state,
      blocks: lease.blocks,
      last_block_next: lease.last_block_next,
      session_id: lease.session_id,
      parked: fs.existsSync(path.join(dir, 'pending_decision')),
    };
  };
  for (const [label, options, extra] of scenarios) {
    const old = project(options);
    transcript(old.root, NEXT_CALL);
    const expected = outcome(stop(old.root, extra(old.root), undefined, HOOK_BEFORE_V2), old.dir);
    for (const list of [{}, { background_tasks: [] }]) {
      const now = project(options);
      transcript(now.root, NEXT_CALL);
      const r = stop(now.root, { ...extra(now.root), ...list });
      assert.deepStrictEqual(outcome(r, now.dir), expected, `${label} ${JSON.stringify(list)}`);
      if (expected.blocked) assert.strictEqual(JSON.parse(r.stdout).reason, stall(), label);
    }
  }
});

// ---------- chunked reads, roots and races ----------

test('evidence split across a chunk boundary still counts', () => {
  const { root } = project();
  const needle = `run-state.cjs next ${RUN}`;
  const at = Buffer.byteLength(NEXT_CALL.slice(0, NEXT_CALL.indexOf(needle)));
  const split = 10;
  // Size the file so the newest chunk starts `split` bytes into the needle.
  const filler = 'x'.repeat(at + split + CHUNK_BYTES - Buffer.byteLength(NEXT_CALL) - 1);
  const bytes = Buffer.from(`${NEXT_CALL}${filler}\n`);
  const boundary = bytes.length - CHUNK_BYTES;
  assert.strictEqual(boundary, at + split);
  assert.ok(!bytes.subarray(boundary).includes(needle), 'the newest chunk alone must miss it');
  assert.ok(!bytes.subarray(0, boundary).includes(needle), 'the older chunk alone must miss it');
  fs.writeFileSync(path.join(root, 'transcript.jsonl'), bytes);

  assertBlocked(stop(root));
});

test('lines are read whole across chunk boundaries, whatever byte a chunk starts on', () => {
  // A newline as the first byte of the newest chunk, a tool result spanning three chunks,
  // and the evidence itself inside a call whose line spans two: each is a line the scan
  // must join or step past, and none may stop it early or keep it going.
  const huge = `${JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'r'.repeat(3 * CHUNK_BYTES) }] } })}\n`;
  const longCall = bashLine(`echo ${'c'.repeat(CHUNK_BYTES)}; node .orchestrator/run-state.cjs next ${RUN} "${STEP}"`);
  for (const [label, text] of [
    ['a chunk that starts with a newline', (() => {
      const head = `${NEXT_CALL}${'y'.repeat(2 * CHUNK_BYTES)}`;
      return `${head}\n${'z'.repeat(CHUNK_BYTES - 2)}\n`;
    })()],
    ['a newer line three chunks long', `${NEXT_CALL}${huge}`],
    ['evidence in a line two chunks long', `${longCall}${'w'.repeat(10)}\n`],
  ]) {
    const { root } = project();
    fs.writeFileSync(path.join(root, 'transcript.jsonl'), text);
    const r = cp.spawnSync(process.execPath, [HOOK], {
      input: JSON.stringify({ session_id: 'session-1', transcript_path: path.join(root, 'transcript.jsonl'), cwd: root, hook_event_name: 'Stop', stop_hook_active: false }),
      encoding: 'utf8',
      env: childEnv({ CLAUDE_PROJECT_DIR: root }),
      timeout: 10000,
    });
    assert.strictEqual(r.signal, null, `${label}: the scan never finished`);
    assert.strictEqual(JSON.parse(r.stdout).decision, 'block', label);
  }
});

test('evidence older than the last 64 MB is not scanned', () => {
  const { root, dir } = project();
  const file = path.join(root, 'transcript.jsonl');
  fs.writeFileSync(file, NEXT_CALL);
  // Sparse growth: the only evidence now sits one chunk before the scan window.
  fs.truncateSync(file, SCAN_CAP_BYTES + CHUNK_BYTES);
  const before = readLease(dir);
  assertAllowed(stop(root));
  assert.strictEqual(readLease(dir), before);
});

test('the root is CLAUDE_PROJECT_DIR, else the session cwd or the nearest directory above it', () => {
  const elsewhere = tempDir('orch-stop-cwd-');

  const byEnv = project();
  transcript(byEnv.root, NEXT_CALL);
  assertBlocked(stop(byEnv.root, { cwd: elsewhere }));

  const byCwd = project();
  transcript(byCwd.root, NEXT_CALL);
  assertBlocked(stop(byCwd.root, {}, {}));

  // A run started after `git worktree add` keeps its state in the worktree the
  // session moved into, not in the directory Claude Code was launched from.
  const worktree = project();
  transcript(worktree.root, NEXT_CALL);
  assertBlocked(stop(worktree.root, { cwd: worktree.root }, { CLAUDE_PROJECT_DIR: elsewhere }));

  // ...and the session may have moved further down, into a package of it.
  const nested = project();
  transcript(nested.root, NEXT_CALL);
  const pkg = path.join(nested.root, 'packages', 'api');
  fs.mkdirSync(pkg, { recursive: true });
  assertBlocked(stop(nested.root, { cwd: pkg }, { CLAUDE_PROJECT_DIR: elsewhere }));
});

test('a parked run in the project root does not hide the live run in the worktree', () => {
  // The project root still points ACTIVE at a run waiting on the operator.
  const parked = project({ run: '20260928T090000Z-ffff-parked', lease: { state: 'waiting' } });
  const worktree = path.join(parked.root, '.worktrees', 'feat');
  writeRun(worktree);
  transcript(parked.root, NEXT_CALL);

  assertBlocked(stop(parked.root, { cwd: worktree }, { CLAUDE_PROJECT_DIR: parked.root }));
  assert.strictEqual(JSON.parse(readLease(path.join(worktree, '.orchestrator', 'runs', RUN))).blocks, 1);
  assert.strictEqual(JSON.parse(readLease(parked.dir)).state, 'waiting');
});

test('a wait or a dispatch that lands while a stop is being proved wins: the lease is re-read before the write', () => {
  const { root, dir } = project();
  const [found] = activeRuns([root]);
  assert.strictEqual(found.run, RUN);
  // The conductor parks the run between the hook's first read and its write.
  fs.writeFileSync(path.join(dir, 'pending_decision'), '2026-09-29T10:20:00Z Status: STALLED — which auth provider?\n');
  fs.writeFileSync(path.join(dir, 'lease.json'), JSON.stringify({ ...found.lease, state: 'waiting' }));

  assert.strictEqual(recordBlock(found, 'session-1'), false);
  const lease = JSON.parse(readLease(dir));
  assert.strictEqual(lease.state, 'waiting');
  assert.strictEqual(lease.session_id, null);

  // Or it dispatches, and the work is in flight by the time the hook would write.
  const second = project();
  const [racing] = activeRuns([second.root]);
  fs.writeFileSync(path.join(second.dir, 'lease.json'), JSON.stringify({ ...racing.lease, state: 'dispatched' }));
  const before = readLease(second.dir);
  assert.strictEqual(recordBlock(racing, 'session-1', (now) => now.lease.state === 'dispatched'), false);
  assert.strictEqual(readLease(second.dir), before);
  assert.strictEqual(recordBlock(racing, 'session-1'), 'returned');
});

test('only Stop and StopFailure are handled', () => {
  const { root, dir } = project();
  transcript(root, NEXT_CALL);
  const before = readLease(dir);
  assertAllowed(stop(root, { hook_event_name: 'SubagentStop' }));
  assert.strictEqual(readLease(dir), before);
});

test('unparseable stdin fails open', () => {
  for (const input of ['not json', 'null', '"Stop"']) {
    const r = cp.spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8', env: childEnv() });
    assertAllowed(r);
  }
});
