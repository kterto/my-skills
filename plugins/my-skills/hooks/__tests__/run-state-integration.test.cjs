const { test, after } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const { RUN, PENDING_LINE, tempDir, cleanup } = require('./fixtures/run.cjs');

after(cleanup);

// The hook and the plugin read files that orchestrator/scripts/run-state.cjs writes, and
// each side's own suite checks it against a hand-written copy of the other. These cases
// drive the real script and the real hook together, so a format that drifts on either
// side fails here rather than in a run.

const RUN_STATE = path.join(__dirname, '..', '..', 'skills', 'orchestrator', 'scripts', 'run-state.cjs');
const HOOK = path.join(__dirname, '..', 'orchestrator-stop.cjs');
const PLUGIN = pathToFileURL(path.join(__dirname, '..', 'opencode', 'orchestrator-watchdog.js')).href;

const tempRoot = () => tempDir('orch-run-state-');

function runState(root, ...args) {
  return cp.spawnSync(process.execPath, [RUN_STATE, '--root', root, ...args], { cwd: root, encoding: 'utf8' });
}

function ok(r) {
  assert.strictEqual(r.status, 0, `exit ${r.status}: ${r.stderr}`);
  return r.stdout;
}

/** A Bash tool call, serialized the way Claude Code writes it into the transcript. */
function bashLine(command) {
  const content = [{ type: 'tool_use', id: 'toolu_01', name: 'Bash', input: { command } }];
  return `${JSON.stringify({ type: 'assistant', message: { role: 'assistant', content } })}\n`;
}

function stop(root, transcript) {
  fs.writeFileSync(path.join(root, 'transcript.jsonl'), transcript);
  const r = cp.spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({
      session_id: 'session-1',
      transcript_path: path.join(root, 'transcript.jsonl'),
      cwd: root,
      hook_event_name: 'Stop',
      stop_hook_active: false,
    }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
  });
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.stderr, '');
  return r.stdout === '' ? null : JSON.parse(r.stdout).decision;
}

const runDir = (root) => path.join(root, '.orchestrator', 'runs', RUN);
const lease = (root) => JSON.parse(fs.readFileSync(path.join(runDir(root), 'lease.json'), 'utf8'));

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

const SKILL = path.join(__dirname, '..', '..', 'skills', 'orchestrator', 'SKILL.md');
const GIT_ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
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
  git(main, 'init', '-q', '-b', 'main');
  git(main, 'add', '-A');
  git(main, 'commit', '-qm', 'bootstrap');
  const wt = path.join(main, '.worktrees', 'feat');
  git(main, 'worktree', 'add', '-q', wt, '-b', 'orch/feat');
  assert.ok(!fs.existsSync(path.join(wt, '.orchestrator', 'run-state.cjs')), 'a checkout holds only tracked files');

  // Step 0a's own command, as SKILL.md writes it.
  const copy = /`(mkdir -p \{path\}\/\.orchestrator && cp -R [^`]+)`/.exec(fs.readFileSync(SKILL, 'utf8'));
  assert.ok(copy, 'SKILL.md Step 0a copies the untracked materialized files into a new worktree');
  const r = cp.spawnSync('bash', ['-c', copy[1].replaceAll('{path}', wt)], { cwd: main, encoding: 'utf8' });
  assert.strictEqual(r.status, 0, r.stderr);
  for (const name of ['run-state.cjs', 'gate-config.md', 'artifact-format-html.md', 'html-templates/spec.template.html']) {
    assert.ok(fs.existsSync(path.join(wt, '.orchestrator', name)), name);
  }
  assert.strictEqual(fs.readFileSync(path.join(wt, '.orchestrator', 'PROJECT-CONTEXT.md'), 'utf8'), '# context\n');

  ok(cp.spawnSync(process.execPath, [path.join(wt, '.orchestrator', 'run-state.cjs'), 'start', RUN, '--host', 'opencode'], { cwd: wt, encoding: 'utf8' }));
  assert.ok(fs.existsSync(path.join(wt, '.orchestrator', 'runs', RUN, 'lease.json')), 'the run state lives in the worktree');

  // Claude Code: the session's shell went back to the project root, and the hook still finds the run.
  const transcript = path.join(main, 'transcript.jsonl');
  fs.writeFileSync(transcript, bashLine(`cd ${wt} && node .orchestrator/run-state.cjs start ${RUN} --host claude-code`));
  const hook = cp.spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ session_id: 'session-1', transcript_path: transcript, cwd: main, hook_event_name: 'Stop', stop_hook_active: false }),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: main },
  });
  assert.strictEqual(JSON.parse(hook.stdout).decision, 'block');

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
