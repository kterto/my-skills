const { test, after } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const {
  RUN, STEP, project, v2, writeInFlight, tempDir, cleanup, childEnv, readLease, writeFinal, PENDING_LINE,
} = require('./fixtures/run.cjs');
const { blockReason } = require('../orchestrator-stop.cjs');

after(cleanup);

const PLUGIN = pathToFileURL(path.join(__dirname, '..', 'opencode', 'orchestrator-watchdog.js')).href;
const CONDUCTOR = 'ses_conductor';
const RESUME_LINE = `An orchestrator run is active: resume from .orchestrator/runs/${RUN}/NEXT (run-state.cjs status).`;

// opencode hands the plugin a v1 SDK client whose calls take `{ path: { id } }` and
// resolve to `{ data }` (or `{ error }`) rather than throwing. The double keeps those
// shapes, records every call, and can be told to throw from any one method.

function fakeClient({ parentID, messages = [], throws } = {}) {
  const calls = { get: 0, messages: [], prompts: [] };
  const maybeThrow = (name) => {
    if (throws === name) throw new Error(`${name}: connection refused`);
  };
  return {
    calls,
    session: {
      get: async ({ path: { id } }) => {
        calls.get++;
        maybeThrow('get');
        return { data: { id, parentID, title: 'orchestrator run' } };
      },
      messages: async ({ query }) => {
        calls.messages.push(query);
        maybeThrow('messages');
        return { data: messages };
      },
      promptAsync: async (request) => {
        maybeThrow('promptAsync');
        calls.prompts.push(request);
        return { data: undefined };
      },
    },
  };
}

const USER = {
  info: { id: 'msg_01', role: 'user', agent: 'build', model: { providerID: 'anthropic', modelID: 'claude-opus-5-5' } },
  parts: [{ type: 'text', text: '/orchestrator add the watchdog' }],
};

function bashCall(command) {
  return {
    info: { id: 'msg_02', role: 'assistant' },
    parts: [{ type: 'tool', tool: 'bash', callID: 'call_01', state: { status: 'completed', input: { command, description: 'Run state' }, output: '' } }],
  };
}

const OWNED = [
  USER,
  bashCall(`node .orchestrator/run-state.cjs next ${RUN} "${STEP}" --note "cycle 2 of 4"`),
  { info: { id: 'msg_03', role: 'assistant' }, parts: [{ type: 'text', text: 'Now Step 5 — QA.' }] },
];

async function watchdog(client, { directory, worktree }) {
  const { OrchestratorWatchdog } = await import(PLUGIN);
  return OrchestratorWatchdog({ client, directory, worktree });
}

function idle(sessionID = CONDUCTOR) {
  return { event: { type: 'session.idle', properties: { sessionID } } };
}

async function compact(hooks, sessionID = CONDUCTOR) {
  const output = { context: [] };
  await hooks['experimental.session.compacting']({ sessionID }, output);
  return output.context;
}

test('the module exports exactly one plugin, because opencode calls every export', async () => {
  const mod = await import(PLUGIN);
  assert.deepStrictEqual(Object.keys(mod), ['OrchestratorWatchdog']);
  assert.strictEqual(typeof mod.OrchestratorWatchdog, 'function');
});

test('an idle conductor is re-prompted with the Stop hook reason', async () => {
  const { root, dir } = project();
  const client = fakeClient({ messages: OWNED });
  const hooks = await watchdog(client, { directory: root, worktree: root });

  await hooks.event(idle());

  assert.deepStrictEqual(client.calls.messages, [{ limit: 200 }]);
  assert.deepStrictEqual(client.calls.prompts, [{
    path: { id: CONDUCTOR },
    body: {
      parts: [{ type: 'text', text: blockReason(RUN) }],
      agent: 'build',
      model: { providerID: 'anthropic', modelID: 'claude-opus-5-5' },
    },
  }]);
  const lease = JSON.parse(readLease(dir));
  assert.strictEqual(lease.blocks, 1);
  assert.strictEqual(lease.last_block_next, STEP);
  assert.strictEqual(lease.session_id, CONDUCTOR);
});

test('a subagent session going idle is ignored', async () => {
  const { root, dir } = project();
  const client = fakeClient({ parentID: CONDUCTOR, messages: OWNED });
  const hooks = await watchdog(client, { directory: root, worktree: root });
  const before = readLease(dir);

  await hooks.event(idle('ses_coder'));

  assert.strictEqual(client.calls.messages.length, 0);
  assert.strictEqual(client.calls.prompts.length, 0);
  assert.strictEqual(readLease(dir), before);
});

test('a session without run-state evidence is never re-prompted', async () => {
  const { root, dir } = project();
  const client = fakeClient({
    messages: [
      USER,
      bashCall('node .orchestrator/run-state.cjs status'),
      bashCall('node .orchestrator/run-state.cjs next 20260928T090000Z-ffff-other-run "Step 2 — architect"'),
      { info: { id: 'msg_04', role: 'assistant' }, parts: [{ type: 'text', text: `I would run run-state.cjs next ${RUN} now.` }] },
    ],
  });
  const hooks = await watchdog(client, { directory: root, worktree: root });
  const before = readLease(dir);

  await hooks.event(idle());

  assert.strictEqual(client.calls.prompts.length, 0);
  assert.strictEqual(readLease(dir), before);
});

test('a session that only read the run is not its conductor: the Stop hook\'s own test', async () => {
  // Every one of these names both run-state.cjs and the run, and none of them is a start or a next.
  for (const command of [
    `node .orchestrator/run-state.cjs raises ${RUN}`,
    `node .orchestrator/run-state.cjs budget ${RUN} max_review_cycles`,
    `node .orchestrator/run-state.cjs lookup ${RUN} FR-3 --spec SPEC-20260929T101500Z-a1b2 --all`,
    `cat .orchestrator/runs/${RUN}/NEXT; node .orchestrator/run-state.cjs status`,
    `node .orchestrator/run-state.cjs wait other-run "after ${RUN}: run-state.cjs next ${RUN}"`,
  ]) {
    const { root, dir } = project();
    const client = fakeClient({ messages: [USER, bashCall(command)] });
    const hooks = await watchdog(client, { directory: root, worktree: root });
    const before = readLease(dir);
    await hooks.event(idle());
    assert.strictEqual(client.calls.prompts.length, 0, command);
    assert.strictEqual(readLease(dir), before, command);
  }
});

test('a session the run has moved on from is not re-prompted into conducting it', async () => {
  const { root, dir } = project({ lease: { session_id: 'ses_resumed', blocks: 1, last_block_next: STEP } });
  const superseded = fakeClient({ messages: [USER, bashCall(`node .orchestrator/run-state.cjs next ${RUN} "Step 3 — coder"`)] });
  const before = readLease(dir);
  await (await watchdog(superseded, { directory: root, worktree: root })).event(idle('ses_old'));
  assert.strictEqual(superseded.calls.prompts.length, 0);
  assert.strictEqual(readLease(dir), before);

  // The session that re-recorded the current step is the conductor, and takes the lease.
  const taking = fakeClient({ messages: OWNED });
  await (await watchdog(taking, { directory: root, worktree: root })).event(idle('ses_new'));
  assert.strictEqual(taking.calls.prompts.length, 1);
  assert.strictEqual(JSON.parse(readLease(dir)).session_id, 'ses_new');
});

test('a wait that lands while the plugin awaits the client is never reverted or pushed past', async () => {
  const RUN_STATE = path.join(__dirname, '..', '..', 'skills', 'orchestrator', 'scripts', 'run-state.cjs');
  const { root, dir } = project();
  const client = fakeClient({ messages: OWNED });
  const listed = client.session.messages;
  client.session.messages = async (request) => {
    const r = cp.spawnSync(process.execPath, [RUN_STATE, '--root', root, 'wait', RUN, 'Status: STALLED — which auth provider?'], { encoding: 'utf8', env: childEnv() });
    assert.strictEqual(r.status, 0, r.stderr);
    return listed(request);
  };
  const hooks = await watchdog(client, { directory: root, worktree: root });

  await hooks.event(idle());

  assert.strictEqual(client.calls.prompts.length, 0, 'a waiting run was re-prompted');
  const lease = JSON.parse(readLease(dir));
  assert.strictEqual(lease.state, 'waiting', 'the wait was reverted');
  assert.strictEqual(lease.blocks, 0);
  assert.ok(fs.existsSync(path.join(dir, 'pending_decision')));
});

test('three re-prompts on one step, then the guard parks the run', async () => {
  const { root, dir } = project();
  const client = fakeClient({ messages: OWNED });
  const hooks = await watchdog(client, { directory: root, worktree: root });

  for (let n = 1; n <= 4; n++) await hooks.event(idle());

  assert.strictEqual(client.calls.prompts.length, 3);
  assert.strictEqual(JSON.parse(readLease(dir)).state, 'waiting');
  assert.match(fs.readFileSync(path.join(dir, 'pending_decision'), 'utf8'), PENDING_LINE);
  await hooks.event(idle());
  assert.strictEqual(client.calls.prompts.length, 3);
});

test('a doubled idle event re-prompts once', async () => {
  const { root } = project();
  const client = fakeClient({ messages: OWNED });
  const hooks = await watchdog(client, { directory: root, worktree: root });

  await Promise.all([hooks.event(idle()), hooks.event(idle())]);

  assert.strictEqual(client.calls.prompts.length, 1);
});

test('a turn the operator aborted is left alone', async () => {
  const { root, dir } = project();
  const aborted = { info: { id: 'msg_05', role: 'assistant', error: { name: 'MessageAbortedError', data: { message: 'aborted' } } }, parts: [] };
  const client = fakeClient({ messages: [...OWNED, aborted] });
  const hooks = await watchdog(client, { directory: root, worktree: root });
  const before = readLease(dir);

  await hooks.event(idle());

  assert.strictEqual(client.calls.prompts.length, 0);
  assert.strictEqual(readLease(dir), before);
});

test('the Stop hook conditions hold before any client call', async () => {
  const pending = project();
  fs.writeFileSync(path.join(pending.dir, 'pending_decision'), '2026-09-29T10:20:00.000Z Status: STALLED — review budget\n');
  const finished = project();
  writeFinal(finished.root);
  const cases = [
    ['no ACTIVE', tempDir()],
    ['waiting', project({ lease: { state: 'waiting' } }).root],
    ['stale heartbeat', project({ lease: { heartbeat_at: new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString() } }).root],
    ['pending_decision', pending.root],
    ['FINAL', finished.root],
  ];
  for (const [label, root] of cases) {
    const client = fakeClient({ messages: OWNED });
    const hooks = await watchdog(client, { directory: root, worktree: root });
    await hooks.event(idle());
    assert.strictEqual(client.calls.get, 0, label);
    assert.strictEqual(client.calls.prompts.length, 0, label);
  }
});

test('the root is the worktree, else the directory', async () => {
  const { root } = project();
  const client = fakeClient({ messages: OWNED });
  // A directory outside git gets `/` as its worktree.
  const hooks = await watchdog(client, { directory: root, worktree: path.parse(root).root });

  await hooks.event(idle());

  assert.strictEqual(client.calls.prompts.length, 1);
});

test('only session.idle is handled', async () => {
  const { root } = project();
  const client = fakeClient({ messages: OWNED });
  const hooks = await watchdog(client, { directory: root, worktree: root });

  await hooks.event({ event: { type: 'session.status', properties: { sessionID: CONDUCTOR, status: { type: 'idle' } } } });
  await hooks.event({ event: { type: 'message.updated', properties: { info: USER.info } } });
  await hooks.event({ event: { type: 'session.idle', properties: {} } });

  assert.strictEqual(client.calls.get, 0);
});

test('compaction carries the resume line into the owning session', async () => {
  const active = project();
  const hooks = await watchdog(fakeClient({ messages: OWNED }), { directory: active.root, worktree: active.root });
  assert.deepStrictEqual(await compact(hooks), [RESUME_LINE]);

  // A run waiting on the operator still has to be found again after the answer.
  const waiting = project({ lease: { state: 'waiting' } });
  const waitingHooks = await watchdog(fakeClient({ messages: OWNED }), { directory: waiting.root, worktree: waiting.root });
  assert.deepStrictEqual(await compact(waitingHooks), [RESUME_LINE]);
});

test('compaction leaves other sessions and finished runs alone', async () => {
  const { root } = project();
  const subagent = await watchdog(fakeClient({ parentID: CONDUCTOR, messages: OWNED }), { directory: root, worktree: root });
  assert.deepStrictEqual(await compact(subagent, 'ses_coder'), []);

  const unrelated = await watchdog(fakeClient({ messages: [USER] }), { directory: root, worktree: root });
  assert.deepStrictEqual(await compact(unrelated, 'ses_other'), []);

  const done = project({ lease: { state: 'done' } });
  const doneHooks = await watchdog(fakeClient({ messages: OWNED }), { directory: done.root, worktree: done.root });
  assert.deepStrictEqual(await compact(doneHooks), []);

  const empty = tempDir();
  const emptyHooks = await watchdog(fakeClient({ messages: OWNED }), { directory: empty, worktree: empty });
  assert.deepStrictEqual(await compact(emptyHooks), []);
});

test('client errors are swallowed and never re-prompt', async () => {
  for (const method of ['get', 'messages', 'promptAsync']) {
    const { root } = project();
    const client = fakeClient({ messages: OWNED, throws: method });
    const hooks = await watchdog(client, { directory: root, worktree: root });
    await assert.doesNotReject(hooks.event(idle()), method);
    assert.strictEqual(client.calls.prompts.length, 0, method);
    await assert.doesNotReject(compact(hooks), method);
  }

  // A non-2xx answer resolves to `{ error }` with no `data`.
  const { root } = project();
  const client = fakeClient({ messages: OWNED });
  client.session.get = async () => ({ error: { name: 'NotFoundError', data: { message: 'session not found' } } });
  const hooks = await watchdog(client, { directory: root, worktree: root });
  await hooks.event(idle());
  assert.strictEqual(client.calls.prompts.length, 0);
});

test('malformed run state and malformed input fail open', async () => {
  const { root, dir } = project();
  fs.writeFileSync(path.join(dir, 'lease.json'), 'not json');
  const client = fakeClient({ messages: OWNED });
  const hooks = await watchdog(client, { directory: root, worktree: root });

  await assert.doesNotReject(hooks.event(idle()));
  await assert.doesNotReject(hooks.event(undefined));
  await assert.doesNotReject(hooks['experimental.session.compacting'](undefined, undefined));
  await assert.doesNotReject(hooks['experimental.session.compacting']({ sessionID: CONDUCTOR }, {}));
  assert.strictEqual(client.calls.prompts.length, 0);
});

// ---------- lease v2: the conductor, work in flight, and the session id ----------

const RUN_STATE = path.join(__dirname, '..', '..', 'skills', 'orchestrator', 'scripts', 'run-state.cjs');
const FLAGS = ['OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS', 'OPENCODE_EXPERIMENTAL'];

/** Run `fn` with opencode's background-subagent flags set as given, in this process, where the plugin reads them. */
async function withFlags(flags, fn) {
  const saved = Object.fromEntries(FLAGS.map((key) => [key, process.env[key]]));
  const set = (values) => {
    for (const key of FLAGS) {
      if (values[key] === undefined) delete process.env[key];
      else process.env[key] = values[key];
    }
  };
  set(flags);
  try {
    return await fn();
  } finally {
    set(saved);
  }
}

test('shell.env gives every command a session runs that session\'s id, and leaves a call without one alone', async () => {
  const { root } = project();
  const hooks = await watchdog(fakeClient({ messages: OWNED }), { directory: root, worktree: root });
  const output = { env: { LANG: 'C' } };
  await hooks['shell.env']({ cwd: root, sessionID: CONDUCTOR, callID: 'call_01' }, output);
  assert.deepStrictEqual(output.env, { LANG: 'C', ORCHESTRATOR_SESSION_ID: CONDUCTOR });

  // The terminal pane fires it with the cwd alone.
  const pty = { env: {} };
  await hooks['shell.env']({ cwd: root }, pty);
  assert.deepStrictEqual(pty.env, {});
  for (const [input, out] of [[undefined, undefined], [{ sessionID: CONDUCTOR }, {}], [{ sessionID: CONDUCTOR }, { env: null }], [{ sessionID: 7 }, { env: {} }]]) {
    await assert.doesNotReject(hooks['shell.env'](input, out));
  }

  // The id it sets is the one run-state.cjs records as the conductor.
  const r = cp.spawnSync(process.execPath, [RUN_STATE, '--root', root, 'next', RUN, STEP], { encoding: 'utf8', env: childEnv(output.env) });
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(JSON.parse(readLease(path.join(root, '.orchestrator', 'runs', RUN))).conductor_session, CONDUCTOR);
});

test('the conductor the lease names owns the run: it needs no evidence, and another session is never re-prompted', async () => {
  const { root } = project({ lease: v2({ conductor_session: CONDUCTOR }) });
  const named = fakeClient({ messages: [USER] });
  await (await watchdog(named, { directory: root, worktree: root })).event(idle());
  assert.strictEqual(named.calls.prompts.length, 1);
  assert.strictEqual(named.calls.prompts[0].body.parts[0].text, blockReason(RUN));

  const other = project({ lease: v2({ conductor_session: 'ses_other' }) });
  const evidence = fakeClient({ messages: OWNED });
  const before = readLease(other.dir);
  await (await watchdog(evidence, { directory: other.root, worktree: other.root })).event(idle());
  assert.strictEqual(evidence.calls.prompts.length, 0);
  assert.strictEqual(readLease(other.dir), before);
});

test('without background subagents, a dispatched run has nothing in flight once idle: it is re-prompted with the returned reason, under the guard', async () => {
  for (const flags of [{}, { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: 'false', OPENCODE_EXPERIMENTAL: 'true' }, { OPENCODE_EXPERIMENTAL: '0' }]) {
    await withFlags(flags, async () => {
      const { root, dir } = project({ lease: v2({ state: 'dispatched' }) });
      writeInFlight(dir, 'reviewer');
      const client = fakeClient({ messages: OWNED });
      const hooks = await watchdog(client, { directory: root, worktree: root });
      await hooks.event(idle());
      assert.strictEqual(client.calls.prompts.length, 1, JSON.stringify(flags));
      assert.strictEqual(client.calls.prompts[0].body.parts[0].text, blockReason(RUN, 'returned'));
      assert.strictEqual(JSON.parse(readLease(dir)).blocks, 1);
      for (let n = 2; n <= 4; n++) await hooks.event(idle());
      assert.strictEqual(client.calls.prompts.length, 3, 'the three-block guard holds');
      assert.strictEqual(JSON.parse(readLease(dir)).state, 'waiting');
    });
  }
});

test('with background subagents on, a dispatched run is in flight and left alone; an active one is still re-prompted', async () => {
  for (const flags of [
    { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: 'true' },
    { OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: '1' },
    { OPENCODE_EXPERIMENTAL: 'TRUE' },
    { OPENCODE_EXPERIMENTAL: '1' },
  ]) {
    await withFlags(flags, async () => {
      const { root, dir } = project({ lease: v2({ state: 'dispatched' }) });
      writeInFlight(dir, 'reviewer');
      const client = fakeClient({ messages: OWNED });
      const before = readLease(dir);
      await (await watchdog(client, { directory: root, worktree: root })).event(idle());
      assert.strictEqual(client.calls.prompts.length, 0, JSON.stringify(flags));
      assert.strictEqual(client.calls.get, 0, 'nothing to check, so no client call');
      assert.strictEqual(readLease(dir), before);

      const activeRun = project();
      const stalled = fakeClient({ messages: OWNED });
      await (await watchdog(stalled, { directory: activeRun.root, worktree: activeRun.root })).event(idle());
      assert.deepStrictEqual(stalled.calls.prompts.map((p) => p.body.parts[0].text), [blockReason(RUN)]);
    });
  }
});

test('a dispatch that lands while the plugin awaits the client wins, when background subagents are on', async () => {
  await withFlags({ OPENCODE_EXPERIMENTAL_BACKGROUND_SUBAGENTS: 'true' }, async () => {
    const { root, dir } = project();
    const client = fakeClient({ messages: OWNED });
    const listed = client.session.messages;
    client.session.messages = async (request) => {
      const r = cp.spawnSync(process.execPath, [RUN_STATE, '--root', root, 'dispatch', RUN, 'reviewer'], { encoding: 'utf8', env: childEnv() });
      assert.strictEqual(r.status, 0, r.stderr);
      return listed(request);
    };
    await (await watchdog(client, { directory: root, worktree: root })).event(idle());
    assert.strictEqual(client.calls.prompts.length, 0);
    const lease = JSON.parse(readLease(dir));
    assert.strictEqual(lease.state, 'dispatched');
    assert.strictEqual(lease.blocks, 0);
  });
});

test('compaction carries the resume line into a dispatched run\'s session too', async () => {
  const dispatched = project({ lease: v2({ state: 'dispatched' }) });
  const hooks = await watchdog(fakeClient({ messages: OWNED }), { directory: dispatched.root, worktree: dispatched.root });
  assert.deepStrictEqual(await compact(hooks), [RESUME_LINE]);

  // By the conductor on record, with no evidence in the window.
  const named = project({ lease: v2({ state: 'dispatched', conductor_session: CONDUCTOR }) });
  const namedHooks = await watchdog(fakeClient({ messages: [USER] }), { directory: named.root, worktree: named.root });
  assert.deepStrictEqual(await compact(namedHooks), [RESUME_LINE]);
});
