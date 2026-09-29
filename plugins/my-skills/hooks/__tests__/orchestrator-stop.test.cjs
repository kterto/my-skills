const { test, after } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const { RUN, STEP, project, writeRun, tempDir, cleanup, readLease, writeFinal, PENDING_LINE } = require('./fixtures/run.cjs');

const HOOK = path.join(__dirname, '..', 'orchestrator-stop.cjs');
const { CHUNK_BYTES, SCAN_CAP_BYTES, activeRuns, recordBlock } = require(HOOK);

after(cleanup);

// Every case spawns the hook the way Claude Code does: one JSON object on stdin, the
// verdict on stdout, and exit 0 whatever happens. A stop that is not blocked must
// leave no trace at all, so those cases also assert that the lease is untouched.

/** A Bash tool call, serialized the way Claude Code writes it into the transcript. */
function bashLine(command) {
  const content = [{ type: 'tool_use', id: 'toolu_01', name: 'Bash', input: { command, description: 'Run state' } }];
  return `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', content } })}\n`;
}

const NEXT_CALL = bashLine(`node .orchestrator/run-state.cjs next ${RUN} "${STEP}" --note "cycle 2 of 4"`);

function transcript(root, text) {
  fs.writeFileSync(path.join(root, 'transcript.jsonl'), text);
}

function stop(root, input = {}, env = { CLAUDE_PROJECT_DIR: root }) {
  const childEnv = { ...process.env, ...env };
  if (!('CLAUDE_PROJECT_DIR' in env)) delete childEnv.CLAUDE_PROJECT_DIR;
  return cp.spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      session_id: 'session-1',
      transcript_path: path.join(root, 'transcript.jsonl'),
      cwd: root,
      hook_event_name: 'Stop',
      stop_hook_active: false,
      ...input,
    }),
    encoding: 'utf8',
    env: childEnv,
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

test('blocks a proved conductor stop and says how to move on', () => {
  const { root, dir } = project();
  transcript(root, NEXT_CALL);

  const reason = assertBlocked(stop(root));

  assert.ok(reason.length <= 600, `reason is ${reason.length} characters`);
  assert.match(reason, /still active, with no FINAL and no pending decision/);
  assert.ok(reason.includes(`Read .orchestrator/runs/${RUN}/NEXT and dispatch that step now`));
  assert.match(reason, /AskUserQuestion/);
  assert.ok(reason.includes(`node .orchestrator/run-state.cjs wait ${RUN} '<reason>'`), 'free text goes in single quotes');
  assert.ok(reason.includes(`node .orchestrator/run-state.cjs done ${RUN}`));
  const lease = JSON.parse(readLease(dir));
  assert.strictEqual(lease.blocks, 1);
  assert.strictEqual(lease.last_block_next, STEP);
  assert.strictEqual(lease.session_id, 'session-1');
  assert.strictEqual(lease.state, 'active');
  assert.deepStrictEqual(fs.readdirSync(dir).sort(), ['NEXT', 'lease.json'], 'no temp file left behind');
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
  const { root, dir } = project({ lease: { heartbeat_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() } });
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
  ]) {
    const { root } = project();
    transcript(root, bashLine(command));
    assertBlocked(stop(root));
  }
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

test('the block reason itself is not ownership evidence', () => {
  const { root } = project();
  transcript(root, NEXT_CALL);
  const reason = assertBlocked(stop(root));

  // Claude Code records the reason in the transcript it feeds back. Were it to carry
  // `run-state.cjs next <run>`, one block would hand ownership to any session that saw it.
  const other = project();
  transcript(other.root, `${JSON.stringify({ type: 'user', message: { role: 'user', content: `Stop hook feedback:\n${reason}` } })}\n`);
  assertAllowed(stop(other.root));
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
      env: { ...process.env, CLAUDE_PROJECT_DIR: root },
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

test('a wait that lands while a stop is being proved wins: the lease is re-read before the write', () => {
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
});

test('only the Stop event is handled', () => {
  const { root, dir } = project();
  transcript(root, NEXT_CALL);
  const before = readLease(dir);
  assertAllowed(stop(root, { hook_event_name: 'SubagentStop' }));
  assert.strictEqual(readLease(dir), before);
});

test('unparseable stdin fails open', () => {
  const r = cp.spawnSync(process.execPath, [HOOK], { input: 'not json', encoding: 'utf8' });
  assertAllowed(r);
});
