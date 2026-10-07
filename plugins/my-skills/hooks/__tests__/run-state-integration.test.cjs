const { test, after } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { RUN, PENDING_LINE, tempDir, cleanup, childEnv } = require('./fixtures/run.cjs');

after(cleanup);

// The hook and the plugin read files that orchestrator/scripts/run-state.cjs writes, and
// each side's own suite checks it against a hand-written copy of the other. These cases
// drive the real script and the real hook together, so a format that drifts on either
// side fails here rather than in a run.

const RUN_STATE = path.join(__dirname, '..', '..', 'skills', 'orchestrator', 'scripts', 'run-state.cjs');
const HOOK = path.join(__dirname, '..', 'orchestrator-stop.cjs');
const PLUGIN = pathToFileURL(path.join(__dirname, '..', 'opencode', 'orchestrator-watchdog.js')).href;

const tempRoot = () => tempDir('orch-run-state-');

// The conductor's session, as Claude Code hands it to every command and to the hook.
const CONDUCTOR = { CLAUDE_CODE_SESSION_ID: 'session-1' };

function runStateIn(env, root, ...args) {
  return cp.spawnSync(process.execPath, [RUN_STATE, '--root', root, ...args], { cwd: root, encoding: 'utf8', env: childEnv(env) });
}

const runState = (root, ...args) => runStateIn({}, root, ...args);

function ok(r) {
  assert.strictEqual(r.status, 0, `exit ${r.status}: ${r.stderr}`);
  return r.stdout;
}

/** A Bash tool call, serialized the way Claude Code writes it into the transcript. */
function bashLine(command) {
  const content = [{ type: 'tool_use', id: 'toolu_01', name: 'Bash', input: { command } }];
  return `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', content } })}\n`;
}

/** Run the hook on one event; the verdict as `{ decision, reason }`, both null for a stop let through. */
function hook(root, input = {}, transcript = '') {
  fs.writeFileSync(path.join(root, 'transcript.jsonl'), transcript);
  const r = cp.spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      session_id: 'session-1',
      transcript_path: path.join(root, 'transcript.jsonl'),
      cwd: root,
      hook_event_name: 'Stop',
      stop_hook_active: false,
      ...input,
    }),
    encoding: 'utf8',
    env: childEnv({ CLAUDE_PROJECT_DIR: root }),
  });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stderr, '');
  return r.stdout === '' ? { decision: null, reason: null } : JSON.parse(r.stdout);
}

const stop = (root, transcript) => hook(root, {}, transcript).decision;

const runDir = (root) => path.join(root, '.orchestrator', 'runs', RUN);
const lease = (root) => JSON.parse(fs.readFileSync(path.join(runDir(root), 'lease.json'), 'utf8'));
const leaseText = (root) => fs.readFileSync(path.join(runDir(root), 'lease.json'), 'utf8');
const subagent = { id: 'a1', type: 'subagent', status: 'running', description: 'reviewer', agent_type: 'reviewer' };

test('Claude Code: the Stop hook follows a run through every run-state.cjs transition', () => {
  const root = tempRoot();
  const started = ok(runState(root, 'start', RUN, '--host', 'claude-code'));
  assert.strictEqual(stop(root, `${JSON.stringify({ type: 'user', content: started })}\n`), null, "start's own output is not evidence");

  const startCall = bashLine(`node .orchestrator/run-state.cjs start ${RUN} --host claude-code`);
  for (let blocks = 1; blocks <= 3; blocks++) {
    assert.strictEqual(stop(root, startCall), 'block');
    assert.strictEqual(lease(root).blocks, blocks);
    assert.strictEqual(lease(root).last_block_next, 'Step 0 — preflight');
  }
  assert.strictEqual(stop(root, startCall), null, 'the guard trips without blocking');
  assert.match(fs.readFileSync(path.join(runDir(root), 'pending_decision'), 'utf8'), PENDING_LINE);
  const parked = JSON.parse(ok(runState(root, 'status', '--json')));
  assert.strictEqual(parked.state, 'waiting');
  assert.match(parked.pending_decision, /watchdog: 3 blocks without progress/);
  const notify = `${JSON.stringify(process.execPath)} -e 0`;
  assert.strictEqual(runState(root, 'watch', '--once', '--notify', notify).status, 4, 'the watcher reports the parked run');

  ok(runState(root, 'next', RUN, 'Step 1 — brainstormer', '--note', 'read the brief'));
  assert.strictEqual(lease(root).state, 'active');
  assert.strictEqual(lease(root).blocks, 0);
  assert.ok(!fs.existsSync(path.join(runDir(root), 'pending_decision')));
  const nextCall = bashLine(`node .orchestrator/run-state.cjs next ${RUN} "Step 1 — brainstormer" --note "read the brief"`);
  assert.strictEqual(stop(root, nextCall), 'block');
  assert.strictEqual(lease(root).last_block_next, 'Step 1 — brainstormer');

  ok(runState(root, 'wait', RUN, 'Status: STALLED — human intervention required'));
  assert.strictEqual(stop(root, nextCall), null, 'a deliberate wait is never pushed past');

  ok(runState(root, 'next', RUN, 'Step 7 — final report'));
  assert.strictEqual(stop(root, nextCall), 'block');
  fs.mkdirSync(path.join(root, 'plans', RUN), { recursive: true });
  fs.writeFileSync(path.join(root, 'plans', RUN, 'FINAL-001-watchdog.md'), '# Final\n');
  assert.strictEqual(stop(root, nextCall), null, 'a written FINAL ends the watch');
  assert.match(JSON.parse(ok(runState(root, 'status', '--json'))).final, /FINAL-001-watchdog\.md$/);

  ok(runState(root, 'done', RUN));
  assert.ok(!fs.existsSync(path.join(root, '.orchestrator', 'runs', 'ACTIVE')));
  assert.strictEqual(stop(root, nextCall), null);
  assert.strictEqual(runState(root, 'status').status, 1);
});

test('Claude Code, lease v2: a dispatch, a stop while it runs, the hand-back, and done', () => {
  const root = tempRoot();
  const { blockReason } = require(HOOK);
  ok(runStateIn(CONDUCTOR, root, 'start', RUN, '--host', 'claude-code'));
  ok(runStateIn(CONDUCTOR, root, 'next', RUN, 'Step 4 — reviewer'));
  ok(runStateIn(CONDUCTOR, root, 'dispatch', RUN, 'reviewer, cycle 1'));
  assert.strictEqual(lease(root).conductor_session, 'session-1');

  // The stop that follows the dispatch, with the subagent still running, is let through untouched.
  // No transcript holds any evidence: the conductor on record is the proof.
  const before = leaseText(root);
  assert.deepStrictEqual(hook(root, { background_tasks: [subagent] }), { decision: null, reason: null });
  assert.strictEqual(leaseText(root), before);

  // The hand-back: nothing in flight any more, and the run still at the step.
  const back = hook(root, { background_tasks: [] });
  assert.deepStrictEqual(back, { decision: 'block', reason: blockReason(RUN, 'returned') });

  // Another session in the same project is never blocked, and cannot write the run.
  const other = hook(root, { session_id: 'session-2', background_tasks: [] }, bashLine(`node .orchestrator/run-state.cjs next ${RUN} "Step 4 — reviewer"`));
  assert.strictEqual(other.decision, null);
  assert.strictEqual(runStateIn({ CLAUDE_CODE_SESSION_ID: 'session-2' }, root, 'wait', RUN, 'a question').status, 5);

  // done clears the resume state, and nothing else.
  fs.mkdirSync(path.join(runDir(root), 'barrier'));
  fs.writeFileSync(path.join(runDir(root), 'barrier', 'barrier.json'), '{}\n');
  ok(runStateIn(CONDUCTOR, root, 'wait', RUN, 'qa running'));
  ok(runStateIn(CONDUCTOR, root, 'done', RUN));
  for (const name of ['NEXT', 'pending_decision', 'in_flight']) assert.ok(!fs.existsSync(path.join(runDir(root), name)), name);
  assert.ok(fs.existsSync(path.join(runDir(root), 'barrier', 'barrier.json')));
  assert.ok(!fs.existsSync(path.join(root, '.orchestrator', 'runs', 'ACTIVE')));
  assert.strictEqual(hook(root, { background_tasks: [] }).decision, null);
});

test('blocked at a step, the conductor dispatches, the work comes back in the same turn: the returned reason, and the guard still counts', () => {
  const root = tempRoot();
  const { blockReason } = require(HOOK);
  ok(runStateIn(CONDUCTOR, root, 'start', RUN, '--host', 'claude-code'));
  ok(runStateIn(CONDUCTOR, root, 'next', RUN, 'Step 4 — reviewer'));
  assert.deepStrictEqual(hook(root, { background_tasks: [] }), { decision: 'block', reason: blockReason(RUN) });

  ok(runStateIn(CONDUCTOR, root, 'dispatch', RUN, 'reviewer'));
  const rescued = hook(root, { stop_hook_active: true, background_tasks: [] });
  assert.deepStrictEqual(rescued, { decision: 'block', reason: blockReason(RUN, 'returned') });
  assert.strictEqual(lease(root).blocks, 2, 'the dispatch did not reset the count');

  // Leaving dispatched at the same label is no progress either.
  ok(runStateIn(CONDUCTOR, root, 'next', RUN, 'Step 4 — reviewer'));
  assert.strictEqual(lease(root).blocks, 2);
  assert.strictEqual(hook(root, { stop_hook_active: true, background_tasks: [] }).decision, null, 'no progress since the last block');
  assert.strictEqual(hook(root, { background_tasks: [] }).decision, 'block');
  assert.strictEqual(lease(root).blocks, 3);
  assert.strictEqual(hook(root, { background_tasks: [] }).decision, null, 'the guard parks the run');
  assert.strictEqual(lease(root).state, 'waiting');
});

test('StopFailure: the hook records the failed turn, watch reports it in the same words, and the next write clears it', () => {
  const root = tempRoot();
  const hookRules = require(HOOK);
  const { stopFailureMessage } = require(RUN_STATE);
  ok(runStateIn(CONDUCTOR, root, 'start', RUN, '--host', 'claude-code'));
  ok(runStateIn(CONDUCTOR, root, 'dispatch', RUN, 'coder, lane A'));

  assert.strictEqual(hook(root, { hook_event_name: 'StopFailure', error: 'rate_limit', error_details: 'usage limit reached' }).decision, null);
  const failure = lease(root).stop_failure;
  assert.strictEqual(failure.error, 'rate_limit');
  assert.strictEqual(failure.details, 'usage limit reached');

  // A shell stub, not a node one: under a loaded full-suite run a node stub can outlast the
  // notifier's 10 s bound, and the marker would be empty for a reason that is not the hook's.
  const marker = path.join(root, 'notified.txt');
  const stub = path.join(root, 'stub.sh');
  fs.writeFileSync(stub, `printf '%s\\n' "$1" >> ${JSON.stringify(marker)}\n`);
  const notify = `/bin/sh ${JSON.stringify(stub)}`;
  assert.strictEqual(runState(root, 'watch', '--once', '--notify', notify).status, 4);
  const said = fs.readFileSync(marker, 'utf8').trim();
  assert.strictEqual(said, stopFailureMessage(RUN, failure));
  assert.strictEqual(said, hookRules.stopFailureMessage(RUN, failure));
  assert.match(JSON.parse(ok(runState(root, 'status', '--json'))).stop_failure.error, /^rate_limit$/);

  ok(runStateIn(CONDUCTOR, root, 'next', RUN, 'Step 3 — coder'));
  assert.strictEqual(lease(root).stop_failure, null);
  assert.strictEqual(runState(root, 'watch', '--once', '--notify', notify).status, 0);
});

test('the hook\'s copies of the notifier split and the failure message say what run-state.cjs says', () => {
  const hookRules = require(HOOK);
  const runStateRules = require(RUN_STATE);
  for (const line of ['say  -v Alex', `"/Apps/My Tools/notify" 'a b' c\\ d`, `"say \\"hi\\"" '$HOME'`, 'echo $(id) ; `id`', '', '"open', "'open"]) {
    assert.deepStrictEqual(hookRules.splitCommand(line), runStateRules.splitCommand(line), line);
  }
  for (const failure of [
    { at: '2026-10-07T10:15:30.123Z', error: 'rate_limit', details: 'usage limit reached' },
    { at: '2026-10-07T23:59:59Z', error: 'overloaded', details: null },
    { at: 'not a time', error: 'unknown', details: '' },
  ]) {
    assert.strictEqual(hookRules.stopFailureMessage(RUN, failure), runStateRules.stopFailureMessage(RUN, failure));
  }
});

test('a conductor that re-records its step on every re-prompt still trips the guard', () => {
  // The stuck shape: blocked, it runs `next` on the same step and stops again. Only a new
  // step is progress, so the three-block guard parks the run instead of looping forever.
  const root = tempRoot();
  ok(runState(root, 'start', RUN, '--host', 'opencode'));
  const label = 'Step 4 — reviewer';
  const call = bashLine(`node .orchestrator/run-state.cjs next ${RUN} "${label}"`);
  const verdicts = [];
  for (let stops = 0; stops < 4; stops++) {
    ok(runState(root, 'next', RUN, label));
    verdicts.push(stop(root, call));
  }
  assert.deepStrictEqual(verdicts, ['block', 'block', 'block', null]);
  assert.strictEqual(lease(root).state, 'waiting');
  assert.match(fs.readFileSync(path.join(runDir(root), 'pending_decision'), 'utf8'), PENDING_LINE);
  // The `next` that resumes the parked run, once the operator answered, counts from zero.
  ok(runState(root, 'next', RUN, label));
  assert.strictEqual(lease(root).blocks, 0);
});

test('opencode: the plugin re-prompts, and resumes compaction, on a run run-state.cjs started', async () => {
  const root = tempRoot();
  ok(runState(root, 'start', RUN, '--host', 'opencode'));
  const prompts = [];
  const client = {
    session: {
      get: async ({ path: { id } }) => ({ data: { id } }),
      messages: async () => ({
        data: [
          { info: { role: 'user', agent: 'build' }, parts: [{ type: 'text', text: '/orchestrator add the watchdog' }] },
          { info: { role: 'assistant' }, parts: [{ type: 'tool', tool: 'bash', state: { input: { command: `node .orchestrator/run-state.cjs start ${RUN} --host opencode` } } }] },
        ],
      }),
      promptAsync: async (request) => {
        prompts.push(request);
        return { data: undefined };
      },
    },
  };
  const { OrchestratorWatchdog } = await import(PLUGIN);
  const hooks = await OrchestratorWatchdog({ client, directory: root, worktree: root });

  await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'ses_conductor' } } });
  assert.strictEqual(prompts.length, 1);
  assert.strictEqual(prompts[0].body.agent, 'build');
  assert.strictEqual(lease(root).blocks, 1);
  assert.strictEqual(lease(root).last_block_next, 'Step 0 — preflight');

  const output = { context: [] };
  await hooks['experimental.session.compacting']({ sessionID: 'ses_conductor' }, output);
  assert.deepStrictEqual(output.context, [`An orchestrator run is active: resume from .orchestrator/runs/${RUN}/NEXT (run-state.cjs status).`]);

  ok(runState(root, 'wait', RUN, 'which auth provider?'));
  await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'ses_conductor' } } });
  assert.strictEqual(prompts.length, 1, 'a waiting run is not re-prompted');
});

test('opencode: the session id shell.env exports makes the session the conductor run-state.cjs records and checks', async () => {
  const root = tempRoot();
  const { OrchestratorWatchdog } = await import(PLUGIN);
  const prompts = [];
  const client = {
    session: {
      get: async ({ path: { id } }) => ({ data: { id } }),
      messages: async () => ({ data: [] }),
      promptAsync: async (request) => { prompts.push(request); },
    },
  };
  const hooks = await OrchestratorWatchdog({ client, directory: root, worktree: root });
  const shell = { env: {} };
  await hooks['shell.env']({ cwd: root, sessionID: 'ses_conductor', callID: 'call_01' }, shell);
  ok(runStateIn(shell.env, root, 'start', RUN, '--host', 'opencode'));
  assert.strictEqual(lease(root).conductor_session, 'ses_conductor');

  // The conductor is re-prompted with no evidence in its messages; another session's write is refused.
  await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'ses_conductor' } } });
  assert.strictEqual(prompts.length, 1);
  assert.strictEqual(runStateIn({ ORCHESTRATOR_SESSION_ID: 'ses_other' }, root, 'dispatch', RUN, 'coder').status, 5);
});

const SKILL = path.join(__dirname, '..', '..', 'skills', 'orchestrator', 'SKILL.md');
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(childEnv()).filter(([key]) => !key.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};
const gitOk = cp.spawnSync('git', ['--version']).status === 0;
const git = (cwd, ...args) => cp.execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, env: GIT_ENV, stdio: 'ignore' });

test('a run in a new worktree: the copy Step 0a makes lets it start there, and both hosts follow it', { skip: !gitOk && 'git unavailable' }, async () => {
  // A bootstrapped project: three tracked files under the allow-list, the rest untracked copies.
  const main = tempRoot();
  const orch = path.join(main, '.orchestrator');
  fs.mkdirSync(path.join(orch, 'html-templates'), { recursive: true });
  fs.writeFileSync(path.join(orch, '.gitignore'), '*\n!*/\n!.gitignore\n!config.json\n!PROJECT-CONTEXT.md\n');
  fs.writeFileSync(path.join(orch, 'config.json'), '{}\n');
  fs.writeFileSync(path.join(orch, 'PROJECT-CONTEXT.md'), '# context\n');
  fs.copyFileSync(RUN_STATE, path.join(orch, 'run-state.cjs'));
  for (const name of ['artifact-format.md', 'artifact-format-html.md', 'config.md', 'gate-config.md', 'lane-protocol.md']) {
    fs.writeFileSync(path.join(orch, name), `# ${name}\n`);
  }
  fs.writeFileSync(path.join(orch, 'html-templates', 'spec.template.html'), '<html></html>\n');
  // The pinned engine, which bootstrap copies in with its own `.gitignore`.
  fs.mkdirSync(path.join(orch, 'engine', 'bin'), { recursive: true });
  fs.writeFileSync(path.join(orch, 'engine', '.gitignore'), '*\n');
  fs.writeFileSync(path.join(orch, 'engine', 'bin', 'gates.cjs'), '#!/usr/bin/env node\n');
  git(main, 'init', '-q', '-b', 'main');
  git(main, 'add', '-A');
  git(main, 'commit', '-qm', 'bootstrap');
  const wt = path.join(main, '.worktrees', 'feat');
  git(main, 'worktree', 'add', '-q', wt, '-b', 'orch/feat');
  assert.ok(!fs.existsSync(path.join(wt, '.orchestrator', 'run-state.cjs')), 'a checkout holds only tracked files');

  // Step 0a's own command, as SKILL.md writes it.
  const copy = /`(mkdir -p \{path\}\/\.orchestrator && cp -R [^`]+)`/.exec(fs.readFileSync(SKILL, 'utf8'));
  assert.ok(copy, 'SKILL.md Step 0a copies the untracked materialized files into a new worktree');
  const r = cp.spawnSync('bash', ['-c', copy[1].replaceAll('{path}', wt)], { cwd: main, encoding: 'utf8', env: childEnv() });
  assert.strictEqual(r.status, 0, r.stderr);
  for (const name of ['run-state.cjs', 'gate-config.md', 'artifact-format-html.md', 'html-templates/spec.template.html', 'engine/bin/gates.cjs']) {
    assert.ok(fs.existsSync(path.join(wt, '.orchestrator', name)), name);
  }
  assert.strictEqual(fs.readFileSync(path.join(wt, '.orchestrator', 'PROJECT-CONTEXT.md'), 'utf8'), '# context\n');

  ok(cp.spawnSync(process.execPath, [path.join(wt, '.orchestrator', 'run-state.cjs'), 'start', RUN, '--host', 'opencode'], { cwd: wt, encoding: 'utf8', env: childEnv() }));
  assert.ok(fs.existsSync(path.join(wt, '.orchestrator', 'runs', RUN, 'lease.json')), 'the run state lives in the worktree');

  // Claude Code: the session's shell went back to the project root, and the hook still finds the run.
  const transcript = path.join(main, 'transcript.jsonl');
  fs.writeFileSync(transcript, bashLine(`cd ${wt} && node .orchestrator/run-state.cjs start ${RUN} --host claude-code`));
  const verdict = cp.spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: 'session-1', transcript_path: transcript, cwd: main, hook_event_name: 'Stop', stop_hook_active: false }),
    encoding: 'utf8',
    env: childEnv({ CLAUDE_PROJECT_DIR: main }),
  });
  assert.strictEqual(JSON.parse(verdict.stdout).decision, 'block');

  // opencode: the plugin is rooted at the project, and each command runs there too.
  const prompts = [];
  const client = {
    session: {
      get: async ({ path: { id } }) => ({ data: { id } }),
      messages: async () => ({
        data: [{ info: { role: 'assistant' }, parts: [{ type: 'tool', tool: 'bash', state: { input: { command: `cd ${wt} && node .orchestrator/run-state.cjs start ${RUN} --host opencode` } } }] }],
      }),
      promptAsync: async (request) => { prompts.push(request); },
    },
  };
  const { OrchestratorWatchdog } = await import(PLUGIN);
  const hooks = await OrchestratorWatchdog({ client, directory: main, worktree: main });
  await hooks.event({ event: { type: 'session.idle', properties: { sessionID: 'ses_conductor' } } });
  assert.strictEqual(prompts.length, 1);

  // git's registry is read from either side: the main checkout lists the worktree, and the
  // worktree, whose `.git` is a file, leads back to the same list and to the main checkout.
  const { linkedWorktrees } = require(HOOK);
  const real = (list) => list.map((dir) => fs.realpathSync(dir)).sort();
  assert.deepStrictEqual(real(linkedWorktrees(main)), [fs.realpathSync(wt)]);
  assert.deepStrictEqual(real(linkedWorktrees(wt)), [fs.realpathSync(main), fs.realpathSync(wt)].sort());
  assert.deepStrictEqual(linkedWorktrees(tempRoot()), [], 'no .orchestrator/, no lookup');
});
