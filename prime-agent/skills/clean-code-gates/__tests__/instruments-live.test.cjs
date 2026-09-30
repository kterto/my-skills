'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { ignoreDesktopLitter } = require('./helpers/git-fixture.cjs');

const { run, classify, readOnlyViolation } = require('../src/instruments/live.cjs');
const { parseLiveBlock } = require('../src/instruments/liveblock.cjs');

const SKILL = path.join(__dirname, '..');
const HEAD = 'version: 1\nisolation: shared-dev\n';
const CONSENT_URL = 'postgresql://app:pw@127.0.0.1:55499/app';

// §0.8: a hardened git env, so a developer's global hooks or signing never reach these repos.
const GIT_ENV = {
  ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t.t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t.t',
};
const git = (root, ...args) => cp.execFileSync('git', ['-C', root, ...args], { env: GIT_ENV, encoding: 'utf8' }).trim();

function repo(t, files = {}) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-live-')));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5 }));
  git(root, 'init', '-q', '--template=', '-b', 'main');
  git(root, 'config', 'commit.gpgsign', 'false');
  ignoreDesktopLitter(root);
  write(root, { 'README.md': 'fixture\n', ...files });
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'base');
  return { root, sha: git(root, 'rev-parse', 'HEAD') };
}

function write(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text, { mode: rel.endsWith('.sh') || !rel.includes('.') ? 0o755 : 0o644 });
  }
}

function ctx({ root, sha }, blockText, args, { io = {}, env = process.env, instruments } = {}) {
  const live = blockText === null ? null : { text: blockText, ...parseLiveBlock(blockText) };
  return {
    root, args, base: { ref: 'HEAD', sha },
    instruments: instruments || { source: 'merge-base', from: null, digest: 'd'.repeat(64), moves: [], barrier: null, guards: [], live },
    outDir: path.join(root, '.cleancode'), now: '2026-10-01T00:00:00Z', version: '0.0.0', env, io,
  };
}

const read = (root, rel) => (fs.existsSync(path.join(root, rel)) ? fs.readFileSync(path.join(root, rel), 'utf8') : null);

function freePort() {
  return new Promise((resolve) => {
    const s = net.createServer().listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

function httpStatus(port) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${port}/`, { agent: false, timeout: 2000 }, (res) => { res.resume(); resolve(res.statusCode); })
      .on('error', () => resolve(null)).on('timeout', function onTimeout() { this.destroy(); });
  });
}

function killPidFile(root, rel) {
  const pid = Number(read(root, rel));
  if (pid > 1) { try { process.kill(pid, 'SIGKILL'); } catch { /* already gone */ } }
}

// A service that listens on the port it is given, redirects its own output (§8.3), and ends itself
// after a minute, so a regression that holds a pipe open cannot hang the suite forever.
const SERVER = "require('node:http').createServer((q, s) => s.end('ok')).listen(Number(process.argv[2]), '127.0.0.1');\n"
  + 'setTimeout(() => process.exit(0), 60000);\n';
const serviceBlock = (port, extra = '') => `${HEAD}services:\n`
  + `  web: { up: "node server.js ${port} >server.log 2>&1 & echo $! >server.pid", ready: "http://127.0.0.1:${port}/", `
  + `down: "kill $(cat server.pid)"${extra} }\n`;

// ---- check, and no block ---------------------------------------------------------------

test('check: a valid block passes and reports its facts, disclosing isolation', async (t) => {
  const r = repo(t);
  const block = `${HEAD}db_build: migrate-deploy\ndb: { build: "true" }\nservices:\n  web: { up: "true", ready: "cmd:true" }\n`
    + '  api: { up: "true", ready: "http://127.0.0.1:1/" }\nreadback:\n  pg: { run: psql, read_only: true }\n';
  const out = await run(ctx(r, block, ['check']));
  assert.equal(out.exitCode, 0);
  assert.equal(out.report.kind, 'live');
  assert.equal(out.report.mode, 'check');
  assert.equal(out.report.status, 'pass');
  assert.equal(out.report.isolation, 'shared-dev');
  assert.deepEqual(out.report.block, {
    version: 1, isolation: 'shared-dev', db_build: 'migrate-deploy', db: true, services: ['api', 'web'],
    allowed_repairs: 0, surfaces: [], flows: [], readback: ['pg'], consent: false,
  });
  assert.match(out.lines[0], /^LIVE pass · check · 2 services · .* · isolation: shared-dev$/);
});

test('services and stores list in UTF-16 code-unit order, never by locale, in check and in up', async (t) => {
  const r = repo(t);
  const svc = '{ up: "true", ready: "cmd:true" }';
  const block = `${HEAD}services:\n  web: ${svc}\n  Web: ${svc}\n  api: ${svc}\n`
    + 'readback:\n  pg: { run: psql, read_only: true }\n  Pg: { run: psql, read_only: true }\n';
  const checked = await run(ctx(r, block, ['check']));
  assert.deepEqual([checked.report.block.services, checked.report.block.readback], [['Web', 'api', 'web'], ['Pg', 'pg']]);
  const up = await run(ctx(r, block, ['up']));
  assert.deepEqual([up.report.status, up.report.services.map((s) => s.name)], ['pass', ['Web', 'api', 'web']]);
  assert.deepEqual(Object.keys(up.report.timing.services), ['Web', 'api', 'web']);
});

test('every mode with no block is not-run (no-live-recipe) and exits 4', async (t) => {
  const r = repo(t);
  for (const args of [['check'], ['up'], ['readback', 'pg', 'SELECT 1'], ['down']]) {
    const out = await run(ctx(r, null, args));
    assert.equal(out.exitCode, 4, args[0]);
    assert.equal(out.report.status, 'not-run');
    assert.equal(out.report.mode, args[0]);
    assert.deepEqual([out.report.result, out.report.reason], ['not-run', 'no-live-recipe']);
    assert.equal(out.report.isolation, null);
    assert.match(out.lines[0], /^LIVE not-run · \w+ · no-live-recipe/);
  }
});

test('an invalid block, an unknown mode and a bad argument are usage errors (exit 3)', async (t) => {
  const r = repo(t);
  const exit3 = (e) => e.exitCode === 3;
  await assert.rejects(run(ctx(r, 'version: 1\n', ['check'])), (e) => exit3(e) && /isolation: required/.test(e.message));
  await assert.rejects(run(ctx(r, HEAD, ['start'])), exit3);
  await assert.rejects(run(ctx(r, HEAD, [])), exit3);
  const block = `${HEAD}services:\n  web: { up: "true", ready: "cmd:true" }\n`;
  await assert.rejects(run(ctx(r, block, ['up', '--service', 'api'])), (e) => exit3(e) && /unknown service "api"/.test(e.message));
  await assert.rejects(run(ctx(r, block, ['down', '--svc', 'web'])), exit3);
  await assert.rejects(run(ctx(r, block, ['readback', 'pg'])), exit3);
  await assert.rejects(run(ctx(r, block, ['readback', 'constructor', 'SELECT 1'])), (e) => exit3(e) && /unknown store/.test(e.message));
});

test('a stray argument is a usage error (exit 3) that names it, whether or not there is a block', async (t) => {
  const r = repo(t);
  const block = `${HEAD}services:\n  web: { up: "true", ready: "cmd:true" }\nreadback:\n  pg: { run: "true", read_only: true }\n`;
  for (const text of [block, null]) {
    for (const args of [['check', '--colour', 'blue'], ['up', '--colour'], ['down', 'web'], ['up', '--service', 'web', 'extra'],
      ['readback', 'pg', 'SELECT 1', '--colour'], ['readback']]) {
      await assert.rejects(run(ctx(r, text, args)), (e) => e.exitCode === 3 && e.message.endsWith(`(got: ${args.join(' ')})`),
        `${args.join(' ')} (${text ? 'block' : 'no block'})`);
    }
  }
});

// ---- up and down -----------------------------------------------------------------------

test('up: a node service on an ephemeral port is ready by URL and keeps running; down stops it', async (t) => {
  const port = await freePort();
  const r = repo(t, { 'server.js': SERVER });
  t.after(() => killPidFile(r.root, 'server.pid'));
  const block = serviceBlock(port);
  const out = await run(ctx(r, block, ['up']));
  assert.equal(out.exitCode, 0, out.lines.join('\n'));
  assert.equal(out.report.status, 'pass');
  assert.deepEqual(out.report.services.map((s) => [s.name, s.up.exit, s.ready, s.result, s.reason]),
    [['web', 0, { ok: true, probe: `http://127.0.0.1:${port}/` }, 'pass', null]]);
  assert.equal(out.report.services[0].up.evidence.log, '.cleancode/logs/live-up-web.log');
  assert.match(out.report.services[0].up.evidence.log_sha256, /^[0-9a-f]{64}$/);
  assert.equal(typeof out.report.timing.services.web.ready_ms, 'number');
  assert.equal(await httpStatus(port), 200, 'the service outlives the bring-up');

  const down = await run(ctx(r, block, ['down']));
  assert.equal(down.exitCode, 0, down.lines.join('\n'));
  assert.deepEqual(down.report.services.map((s) => [s.name, s.down.exit, s.result]), [['web', 0, 'pass']]);
  const deadline = Date.now() + 3000;
  while ((await httpStatus(port)) !== null && Date.now() < deadline) await new Promise((res) => setTimeout(res, 100));
  assert.equal(await httpStatus(port), null, 'down stopped the service');
});

test('gates.cjs live up, run through spawnSync, returns while its service keeps running',
  async (t) => {
    const port = await freePort();
    const context = `# Project context\n\n## Test tooling\n\n\`\`\`live\n${serviceBlock(port)}\`\`\`\n\n## Layout\n`;
    const r = repo(t, { 'server.js': SERVER, '.orchestrator/PROJECT-CONTEXT.md': context });
    t.after(() => killPidFile(r.root, 'server.pid'));
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const started = Date.now();
    const cli = cp.spawnSync(process.execPath, [path.join(SKILL, 'bin', 'gates.cjs'), 'live', 'up', '--base', 'HEAD'],
      { cwd: r.root, env, encoding: 'utf8', timeout: 90_000 });
    assert.equal(cli.status, 0, `${cli.stdout}\n${cli.stderr}`);
    assert.ok(Date.now() - started < 30_000, 'the CLI returned without waiting for its daemon');
    assert.match(cli.stdout, /^LIVE pass · up · web ready · isolation: shared-dev$/m);
    assert.equal(await httpStatus(port), 200, 'the service keeps running after the CLI exited');
    assert.equal(JSON.parse(read(r.root, '.cleancode/live.json')).status, 'pass');
  });

test('up: a readiness timeout is blocked-env (not-run, exit 4), with no retry when no repair is listed', async (t) => {
  const port = await freePort();
  const r = repo(t);
  const block = `${HEAD}services:\n  web: { up: "echo up >>attempts", ready: "http://127.0.0.1:${port}/", bound_minutes: 0.02 }\n`;
  const out = await run(ctx(r, block, ['up']));
  assert.equal(out.exitCode, 4);
  assert.equal(out.report.status, 'not-run');
  assert.deepEqual([out.report.result, out.report.reason], ['not-run', 'blocked-env']);
  assert.deepEqual(out.report.services[0].ready, { ok: false, probe: `http://127.0.0.1:${port}/` });
  assert.deepEqual([out.report.services[0].result, out.report.services[0].reason], ['not-run', 'blocked-env']);
  assert.deepEqual(out.report.repairs, []);
  assert.equal(read(r.root, 'attempts'), 'up\n');
});

test('up: an up printing "port is already allocated" is blocked-env, and later services and the db never start', async (t) => {
  const r = repo(t, { 'up.sh': 'echo "Bind for 0.0.0.0:5432 failed: port is already allocated" >&2\nexit 1\n' });
  const block = `${HEAD}db: { build: "touch built" }\nservices:\n  a: { up: "sh up.sh", ready: "cmd:true" }\n`
    + '  b: { up: "touch b-started", ready: "cmd:true" }\n';
  const out = await run(ctx(r, block, ['up']));
  assert.equal(out.exitCode, 4);
  assert.deepEqual([out.report.result, out.report.reason], ['not-run', 'blocked-env']);
  assert.deepEqual(out.report.services.map((s) => [s.name, s.up.exit, s.ready, s.reason]), [['a', 1, null, 'blocked-env']]);
  assert.ok(out.report.services[0].up.evidence.tail.some((l) => l.includes('port is already allocated')));
  assert.equal(out.report.db, null);
  assert.equal(read(r.root, 'b-started'), null);
  assert.equal(read(r.root, 'built'), null);
});

test('up: readiness is typed from its own probe, never the up log: benign "already exists" lines leave a timeout blocked-env', async (t) => {
  const port = await freePort();
  const r = repo(t, { 'up.sh': 'echo "4f4fb700ef54: Already exists"\necho \'NOTICE:  relation "widgets" already exists, skipping\' >&2\n' });
  const block = `${HEAD}services:\n  web: { up: "sh up.sh", ready: "http://127.0.0.1:${port}/", bound_minutes: 0.02 }\n`
    + 'allowed_repairs: ["touch repaired"]\n';
  const out = await run(ctx(r, block, ['up']));
  assert.equal(out.exitCode, 4, out.lines.join('\n'));
  assert.deepEqual([out.report.status, out.report.result, out.report.reason], ['not-run', 'not-run', 'blocked-env']);
  assert.deepEqual([out.report.services[0].up.exit, out.report.services[0].ready.ok], [0, false]);
  assert.deepEqual(out.report.repairs, [{ command: 'touch repaired', exit: 0 }], 'an env failure gets its repair');
});

test('up: a readiness probe whose own output carries a repo-defect error line is repo-defect, and gets no repair', async (t) => {
  const r = repo(t, { 'probe.sh': 'echo \'ERROR:  relation "widgets" does not exist\' >&2\nexit 1\n' });
  const block = `${HEAD}services:\n  web: { up: "true", ready: "cmd:sh probe.sh", bound_minutes: 0.02 }\nallowed_repairs: ["touch repaired"]\n`;
  const out = await run(ctx(r, block, ['up']));
  assert.equal(out.exitCode, 1, out.lines.join('\n'));
  assert.deepEqual([out.report.services[0].ready.ok, out.report.services[0].reason], [false, 'repo-defect']);
  assert.deepEqual(out.report.repairs, []);
  assert.equal(read(r.root, 'repaired'), null);
});

test('up: a failed up is typed from error lines only: a pulled layer that "Already exists" beside a port clash is env', async (t) => {
  const r = repo(t, { 'up.sh': 'echo "4f4fb700ef54: Already exists"\necho "volume \\"app_data\\" already exists but was not created by compose"\n'
    + 'echo "Error response from daemon: Bind for 127.0.0.1:55481 failed: port is already allocated" >&2\nexit 1\n' });
  const out = await run(ctx(r, `${HEAD}services:\n  db: { up: "sh up.sh", ready: "cmd:true" }\n`, ['up']));
  assert.equal(out.exitCode, 4, out.lines.join('\n'));
  assert.deepEqual([out.report.services[0].result, out.report.services[0].reason], ['not-run', 'blocked-env']);
});

test('up: a URL that answers 404 is not ready: readiness wants 2xx or 3xx', async (t) => {
  const port = await freePort();
  const r = repo(t, { 'server.js': "require('node:http').createServer((q, s) => { s.statusCode = 404; s.end('no'); })"
    + ".listen(Number(process.argv[2]), '127.0.0.1');\nsetTimeout(() => process.exit(0), 60000);\n" });
  const block = `${HEAD}services:\n  web: { up: "node server.js ${port} >server.log 2>&1 & echo $! >server.pid", `
    + `ready: "http://127.0.0.1:${port}/", bound_minutes: 0.03 }\n`;
  t.after(() => killPidFile(r.root, 'server.pid'));
  const out = await run(ctx(r, block, ['up']));
  assert.equal(await httpStatus(port), 404, 'the fixture server never answered');
  assert.equal(out.exitCode, 4, out.lines.join('\n'));
  assert.deepEqual([out.report.services[0].ready.ok, out.report.services[0].reason], [false, 'blocked-env']);
});

test('up: services run sorted by name, whatever the block order', async (t) => {
  const r = repo(t);
  const block = `${HEAD}services:\n  zeta: { up: "echo zeta >>order", ready: "cmd:true" }\n  alpha: { up: "echo alpha >>order", ready: "cmd:true" }\n`;
  const out = await run(ctx(r, block, ['up']));
  assert.equal(out.exitCode, 0, out.lines.join('\n'));
  assert.deepEqual(out.report.services.map((s) => s.name), ['alpha', 'zeta']);
  assert.equal(read(r.root, 'order'), 'alpha\nzeta\n');
});

test('down: a failing down is red and names the service; the other downs still run', async (t) => {
  const r = repo(t);
  const block = `${HEAD}services:\n  a: { up: "true", ready: "cmd:true", down: "echo stuck >&2; exit 2" }\n`
    + '  b: { up: "true", ready: "cmd:true", down: "touch b-down" }\n  c: { up: "true", ready: "cmd:true" }\n';
  const out = await run(ctx(r, block, ['down']));
  assert.equal(out.exitCode, 1);
  assert.equal(out.report.status, 'red');
  assert.deepEqual(out.report.services.map((s) => [s.name, s.down.exit, s.result, s.reason]),
    [['a', 2, 'fail', 'repo-defect'], ['b', 0, 'pass', null]]);
  assert.equal(read(r.root, 'b-down'), '');
  assert.match(out.lines[0], /^LIVE red · down · a repo-defect · b down/);
  const one = await run(ctx(r, block, ['down', '--service', 'b']));
  assert.deepEqual([one.exitCode, one.report.services.map((s) => s.name)], [0, ['b']]);
});

// ---- typing the db build ---------------------------------------------------------------

test('db build: a psql "already exists" / SQLSTATE 42701 is repo-defect (red, exit 1), never blocked-env', async (t) => {
  const r = repo(t, { 'db.sh': 'echo "connecting with password=hunter2" >&2\n'
    + 'echo \'psql:chain.sql:2: ERROR:  column "x" of relation "y" already exists\' >&2\necho "SQLSTATE 42701" >&2\nexit 3\n' });
  const out = await run(ctx(r, `${HEAD}db_build: migrate-deploy\ndb: { build: "sh db.sh" }\n`, ['up']));
  assert.equal(out.exitCode, 1);
  assert.equal(out.report.status, 'red');
  assert.deepEqual([out.report.result, out.report.reason], ['fail', 'repo-defect']);
  assert.deepEqual([out.report.db.build, out.report.db.exit, out.report.db.result, out.report.db.reason], ['sh db.sh', 3, 'fail', 'repo-defect']);
  assert.ok(out.report.db.evidence.tail.some((l) => l.includes('42701')));
  assert.equal(typeof out.report.timing.db_ms, 'number');
  // The boot evidence is redacted, in the report and in the summary lines.
  assert.ok(out.report.db.evidence.head.some((l) => l.includes('<redacted>')));
  assert.ok(![...out.report.db.evidence.head, ...out.report.db.evidence.tail, ...out.lines].some((l) => l.includes('hunter2')));
});

test('db build: P1001 is blocked-env (not-run, exit 4)', async (t) => {
  const r = repo(t, { 'db.sh': 'echo "Error: P1001: Can\'t reach database server at 127.0.0.1:55432" >&2\nexit 1\n' });
  const out = await run(ctx(r, `${HEAD}db: { build: "sh db.sh" }\n`, ['up']));
  assert.equal(out.exitCode, 4);
  assert.deepEqual([out.report.db.result, out.report.db.reason], ['not-run', 'blocked-env']);
});

test('classify: a repo-defect signature always wins, db failures default to repo-defect, up and ready to env', () => {
  assert.equal(classify('db', { log: 'ERROR:  relation "widgets" does not exist' }), 'repo-defect');
  assert.equal(classify('db', { log: 'boom' }), 'repo-defect');
  assert.equal(classify('db', { log: 'connect ECONNREFUSED 127.0.0.1:5432' }), 'blocked-env');
  assert.equal(classify('db', { log: 'P1001 then P3018' }), 'repo-defect');
  assert.equal(classify('up', { log: 'boom' }), 'blocked-env');
  assert.equal(classify('ready', {}), 'blocked-env');
  assert.equal(classify('up', { log: 'error: address already in use' }), 'blocked-env');
  assert.equal(classify('up', { log: 'Error: P3009 migrate found failed migrations' }), 'repo-defect');
  for (const sig of ['Cannot connect to the Docker daemon', 'is the docker daemon running?', 'EADDRINUSE', 'getaddrinfo ENOTFOUND db',
    "Can't reach database server", 'No space left on device', 'permission denied while trying to connect to the Docker daemon socket']) {
    assert.equal(classify('db', { log: sig }), 'blocked-env', sig);
  }
  for (const sig of ['P3018', 'P3006', 'P3005', 'ERROR: duplicate key value', 'ERROR: syntax error at or near "x"', 'code 42P07',
    'SQLSTATE 42710', '42P01', '42703', '42601', 'FATAL: table "t" already exists']) {
    assert.equal(classify('up', { log: sig }), 'repo-defect', sig);
  }
  assert.equal(classify('up', { log: 'pid 142701 started, error:  lowercase' }), 'blocked-env');
});

test('classify: an unreachable database or container is env, in libpq\'s and docker\'s own words, on a failed db build', async (t) => {
  const outages = ['psql: error: connection to server at "127.0.0.1", port 55489 failed: Connection refused',
    'psql: could not connect to server: No such file or directory', '\tIs the server running on that host and accepting TCP/IP connections?',
    'Error response from daemon: No such container: widgets-db', 'error during connect: Get "http://%2Fvar%2Frun%2Fdocker.sock/v1.47/containers/json"',
    'Cannot connect: /var/run/docker.sock is absent', 'psql: error: timeout expired'];
  for (const log of outages) assert.equal(classify('db', { log }), 'blocked-env', log);
  const r = repo(t, { 'db.sh': `echo '${outages[0]}' >&2\nexit 2\n` });
  const out = await run(ctx(r, `${HEAD}db: { build: "sh db.sh" }\n`, ['up']));
  assert.equal(out.exitCode, 4, out.lines.join('\n'));
  assert.deepEqual([out.report.db.result, out.report.db.reason], ['not-run', 'blocked-env']);
});

// §8.3's two lists, each signature alone: an env one flips the db default, a defect one flips the up and ready default.
const ENV_SIGNATURES = ['Cannot connect to the Docker daemon', 'Is the docker daemon running', 'port is already allocated',
  'permission denied while trying to connect to the Docker daemon', 'address already in use', 'EADDRINUSE', 'ECONNREFUSED', 'P1001',
  "Can't reach database server", 'getaddrinfo ENOTFOUND', 'no space left on device'];
const DEFECT_SIGNATURES = ['P3018', 'P3009', 'P3006', 'P3005', 'already exists', 'does not exist', 'duplicate key', 'syntax error at or near',
  'psql:chain.sql:4: ERROR:  permission denied for table widgets', '42701', '42P07', '42710', '42P01', '42703', '42601'];

test('classify: every env signature, in any case, types a db failure blocked-env', () => {
  for (const sig of ENV_SIGNATURES) {
    for (const log of [`x ${sig} y`, sig.toUpperCase(), sig.toLowerCase()]) assert.equal(classify('db', { log }), 'blocked-env', log);
  }
});

test('classify: every repo-defect signature on an error line types any step repo-defect, even beside an env signature', () => {
  for (const sig of DEFECT_SIGNATURES) {
    for (const step of ['up', 'ready', 'db']) {
      assert.equal(classify(step, { log: `ERROR: x ${sig} y` }), 'repo-defect', `${step}: ${sig}`);
      assert.equal(classify(step, { log: `ECONNREFUSED\nFATAL: ${sig}\nport is already allocated` }), 'repo-defect', `${step}: ${sig} beside env`);
    }
  }
});

test('classify: off an error line a signature types up and ready nothing; a db build keeps its codes, never generic phrases', () => {
  for (const line of ['4f4fb700ef54: Already exists', 'NOTICE:  relation "widgets" already exists, skipping', 'the note does not exist yet',
    'duplicate key value', 'syntax error at or near "x"']) {
    for (const step of ['up', 'ready']) assert.equal(classify(step, { log: `${line}\nport is already allocated` }), 'blocked-env', `${step}: ${line}`);
  }
  assert.equal(classify('db', { log: 'widgets: Already exists\nconnection refused' }), 'blocked-env');
  assert.equal(classify('db', { log: 'duplicate key value\nconnection refused' }), 'repo-defect');
  assert.equal(classify('db', { log: 'Database error code: 42P07\nECONNREFUSED' }), 'repo-defect');
});

// ---- repairs ---------------------------------------------------------------------------

test('repairs: on an env failure an allowed repair runs once, in order, and the retry passes', async (t) => {
  const r = repo(t, { 'up.sh': 'echo attempt >>attempts\ntest -f repaired || { echo "address already in use" >&2; exit 1; }\n' });
  const block = `${HEAD}services:\n  web: { up: "sh up.sh", ready: "cmd:true" }\n`
    + 'allowed_repairs: ["echo first >>repairs.log", "echo second >>repairs.log; touch repaired"]\n';
  const out = await run(ctx(r, block, ['up']));
  assert.equal(out.exitCode, 0, out.lines.join('\n'));
  assert.deepEqual(out.report.repairs, [
    { command: 'echo first >>repairs.log', exit: 0 },
    { command: 'echo second >>repairs.log; touch repaired', exit: 0 },
  ]);
  assert.equal(read(r.root, 'repairs.log'), 'first\nsecond\n');
  assert.equal(read(r.root, 'attempts'), 'attempt\nattempt\n');
  assert.equal(out.report.services[0].up.evidence.log, '.cleancode/logs/live-up-web-retry.log');
  assert.equal(typeof out.report.timing.repairs_ms, 'number');
});

test('repairs: only a string listed in allowed_repairs runs, the block\'s other commands never do', async (t) => {
  const r = repo(t, { 'up.sh': 'echo attempt >>attempts\necho "port is already allocated" >&2\nexit 1\n' });
  const block = `${HEAD}services:\n  web: { up: "sh up.sh", ready: "cmd:true", down: "touch down-ran" }\n`
    + 'surfaces:\n  web: { kind: script, run: "touch surface-ran" }\nallowed_repairs: ["touch listed-ran"]\n';
  const out = await run(ctx(r, block, ['up']));
  assert.equal(out.exitCode, 4);
  assert.deepEqual(out.report.repairs, [{ command: 'touch listed-ran', exit: 0 }]);
  assert.equal(read(r.root, 'listed-ran'), '');
  assert.equal(read(r.root, 'down-ran'), null);
  assert.equal(read(r.root, 'surface-ran'), null);
  assert.equal(read(r.root, 'attempts'), 'attempt\nattempt\n', 'one retry after the one repair round');
});

test('repairs: one round per run: a second env failure gets no second round, and fails blocked-env', async (t) => {
  const r = repo(t, { 'a.sh': 'test -f repaired || { echo "address already in use" >&2; exit 1; }\n',
    'b.sh': 'echo "port is already allocated" >&2\nexit 1\n' });
  const block = `${HEAD}services:\n  a: { up: "sh a.sh", ready: "cmd:true" }\n  b: { up: "sh b.sh", ready: "cmd:true" }\n`
    + 'allowed_repairs: ["echo round >>rounds; touch repaired"]\n';
  const out = await run(ctx(r, block, ['up']));
  assert.equal(out.exitCode, 4, out.lines.join('\n'));
  assert.deepEqual(out.report.services.map((x) => [x.name, x.reason]), [['a', null], ['b', 'blocked-env']]);
  assert.equal(read(r.root, 'rounds'), 'round\n', 'the repairs ran more than once in one run');
  assert.equal(out.report.repairs.length, 1);
});

test('repairs never run on a repo defect', async (t) => {
  const r = repo(t, { 'db.sh': 'echo \'ERROR:  syntax error at or near "x"\' >&2\nexit 1\n' });
  const out = await run(ctx(r, `${HEAD}db: { build: "sh db.sh" }\nallowed_repairs: ["touch repaired"]\n`, ['up']));
  assert.equal(out.exitCode, 1);
  assert.deepEqual(out.report.repairs, []);
  assert.equal(read(r.root, 'repaired'), null);
});

// ---- the Prisma consent rule -------------------------------------------------------------

test('readback: a read-back past its bound is not-run (timeout), exit 4, never a verdict', async (t) => {
  const r = repo(t);
  const block = `${HEAD}readback:\n  pg: { run: "sleep 30; echo", read_only: false }\n`;
  const out = await run({ ...ctx(r, block, ['readback', 'pg', 'SELECT 1']), io: { readbackMs: 500 } });
  assert.equal(out.exitCode, 4, out.lines.join('\n'));
  assert.deepEqual([out.report.status, out.report.result, out.report.reason], ['not-run', 'not-run', 'timeout']);
});

const PRISMA = '#!/bin/sh\necho "$@" >>prisma.calls\nprintf %s "$PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION" >prisma.consent\n';
const RESET = './prisma migrate reset --force';
const consentBlock = (isolation, consent = true, build = RESET) => `version: 1\nisolation: ${isolation}\n`
  + `db: { build: "${build}" }\nservices:\n  web: { up: "printf %s \\"$PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION\\" >up.consent", ready: "cmd:true" }\n`
  + (consent ? `consent:\n  prisma_reset: { url: "${CONSENT_URL}", container: ccg-live-db }\n` : '');
const container = (over = {}) => ({
  State: { Running: true, Status: 'running' },
  Config: { Labels: { 'ccg.ephemeral': 'true' } },
  NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '127.0.0.1', HostPort: '55499' }] } },
  Mounts: [{ Type: 'volume', Name: 'a'.repeat(64), Destination: '/var/lib/postgresql/data' }, { Type: 'tmpfs', Destination: '/tmp' }],
  ...over,
});
const inspector = (info) => {
  const calls = [];
  return { calls, io: { dockerInspect: async (argv) => { calls.push(argv); return JSON.stringify(info === null ? [] : [info]); } } };
};

async function refused(t, block, info, command = RESET) {
  const r = repo(t, { prisma: PRISMA });
  const { io, calls } = inspector(info);
  const out = await run(ctx(r, block, ['up'], { io }));
  assert.equal(out.exitCode, 1, out.lines.join('\n'));
  assert.equal(out.report.status, 'red');
  assert.deepEqual([out.report.result, out.report.reason], ['fail', 'repo-defect']);
  assert.deepEqual(out.report.refused, [command]);
  assert.deepEqual([out.report.db.exit, out.report.db.result, out.report.db.reason], [null, 'fail', 'repo-defect']);
  assert.equal(read(r.root, 'prisma.calls'), null, 'the refused command never ran');
  assert.ok(out.lines.some((l) => l.startsWith('refused: destructive Prisma command without anchored consent')));
  return { out, calls };
}

test('consent: always refused in shared-dev, before any docker inspect', async (t) => {
  const { calls } = await refused(t, consentBlock('shared-dev'), container());
  assert.deepEqual(calls, []);
});

test('consent: refused in ephemeral without consent in the block', async (t) => {
  await refused(t, consentBlock('ephemeral', false), container());
});

for (const [name, info] of [
  ['publishes another port', container({ NetworkSettings: { Ports: { '5432/tcp': [{ HostIp: '0.0.0.0', HostPort: '5432' }] } } })],
  ['lacks the ccg.ephemeral label', container({ Config: { Labels: { 'com.docker.compose.project': 'app' } } })],
  ['has a bind mount', container({ Mounts: [{ Type: 'bind', Source: '/srv/data', Destination: '/var/lib/postgresql/data' }] })],
  ['has a named volume', container({ Mounts: [{ Type: 'volume', Name: 'app_pgdata', Destination: '/var/lib/postgresql/data' }] })],
  ['is not running', container({ State: { Running: false, Status: 'exited' } })],
  ['does not exist', null],
]) {
  test(`consent: refused when the inspected container ${name}`, async (t) => {
    const { calls } = await refused(t, consentBlock('ephemeral'), info);
    assert.deepEqual(calls, [['docker', 'inspect', '--type', 'container', 'ccg-live-db']]);
  });
}

test('consent: refused when the consent url is not local, or names no port', async (t) => {
  for (const url of ['postgresql://app:pw@db.internal:55499/app', 'postgresql://app:pw@127.0.0.1/app']) {
    await refused(t, consentBlock('ephemeral').replace(CONSENT_URL, url), container());
  }
});

test('consent: allowed when every condition holds, and the consent reaches only that one command', async (t) => {
  const r = repo(t, { prisma: PRISMA });
  const { io, calls } = inspector(container());
  const out = await run(ctx(r, consentBlock('ephemeral'), ['up'], { io }));
  assert.equal(out.exitCode, 0, out.lines.join('\n'));
  assert.deepEqual(out.report.refused, []);
  assert.deepEqual(calls, [['docker', 'inspect', '--type', 'container', 'ccg-live-db']]);
  assert.equal(read(r.root, 'prisma.calls'), 'migrate reset --force\n');
  assert.equal(read(r.root, 'prisma.consent'), CONSENT_URL);
  assert.equal(read(r.root, 'up.consent'), '', 'the service up ran without the consent variable');
});

test('consent: a consented reset runs with DATABASE_URL pinned to the consent url, over the environment\'s', async (t) => {
  const r = repo(t, { prisma: `${PRISMA}printf %s "$DATABASE_URL" >prisma.url\n` });
  const env = { ...process.env, DATABASE_URL: 'postgresql://app:pw@127.0.0.1:5432/dev' };
  const out = await run(ctx(r, consentBlock('ephemeral'), ['up'], { io: inspector(container()).io, env }));
  assert.equal(out.exitCode, 0, out.lines.join('\n'));
  assert.equal(read(r.root, 'prisma.url'), CONSENT_URL);
});

test('consent: a reset whose command names another database url is refused, even with every other condition met', async (t) => {
  const other = `DATABASE_URL=postgresql://app:pw@127.0.0.1:55483/app ${RESET}`;
  const { out } = await refused(t, consentBlock('ephemeral', true, other), container(), other);
  assert.ok(out.lines.some((l) => l.includes('a database url other than the consent url')), out.lines.join('\n'));
  assert.ok(!out.lines.some((l) => l.includes(':pw@')), 'the refusal line printed the url\'s password');
  const same = repo(t, { prisma: PRISMA });
  const ok = await run(ctx(same, consentBlock('ephemeral', true, `DATABASE_URL=${CONSENT_URL} ${RESET}`), ['up'], { io: inspector(container()).io }));
  assert.equal(ok.exitCode, 0, ok.lines.join('\n'));
});

test('consent: a pinned or quoted Prisma reset is still a reset, and refused in shared-dev', async (t) => {
  for (const reset of ['npx prisma@6 migrate reset --force', 'npx prisma@6.16.2 db push --force-reset', "npx prisma migrate 'reset' --force",
    'pnpm dlx prisma@latest migrate reset -f', 'npx "prisma" "migrate" "reset"']) {
    await refused(t, consentBlock('shared-dev', true, reset.replace(/"/g, '\\"')), container(), reset);
  }
});

test('consent: db push --force-reset is covered too, and plain migrate deploy needs no consent', async (t) => {
  const push = './prisma db push --accept-data-loss --force-reset';
  await refused(t, consentBlock('shared-dev', true, push), container(), push);
  const r = repo(t, { prisma: PRISMA });
  const out = await run(ctx(r, consentBlock('shared-dev', true, './prisma migrate deploy'), ['up']));
  assert.equal(out.exitCode, 0, out.lines.join('\n'));
  assert.equal(read(r.root, 'prisma.calls'), 'migrate deploy\n');
});

test('consent: an ambient consent variable reaches no command; only the consented one gets the anchored url', async (t) => {
  const env = { ...process.env, PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION: 'ambient' };
  const r = repo(t, { prisma: PRISMA });
  const out = await run(ctx(r, consentBlock('ephemeral'), ['up'], { io: inspector(container()).io, env }));
  assert.equal(out.exitCode, 0, out.lines.join('\n'));
  assert.deepEqual([read(r.root, 'up.consent'), read(r.root, 'prisma.consent')], ['', CONSENT_URL]);
  const s = repo(t, { prisma: PRISMA });
  const plain = await run(ctx(s, consentBlock('shared-dev', true, './prisma migrate deploy'), ['up'], { env }));
  assert.equal(plain.exitCode, 0, plain.lines.join('\n'));
  assert.deepEqual([read(s.root, 'up.consent'), read(s.root, 'prisma.consent')], ['', ''], 'no command in shared-dev sees consent');
});

test('consent: a block read through --instruments-from is not the anchored block, so its consent is not honoured', async (t) => {
  for (const from of ['file:instruments.json', 'main']) {
    const r = repo(t, { prisma: PRISMA });
    const text = consentBlock('ephemeral');
    const instruments = { source: 'instruments-from', from, digest: 'd'.repeat(64), moves: [], barrier: null, guards: [],
      live: { text, ...parseLiveBlock(text) } };
    const { io, calls } = inspector(container());
    const out = await run(ctx(r, null, ['up'], { io, instruments }));
    assert.equal(out.exitCode, 1, out.lines.join('\n'));
    assert.deepEqual([out.report.refused, calls], [[RESET], []], from);
    assert.equal(read(r.root, 'prisma.calls'), null, from);
  }
});

test('consent: a branch-added block\'s consent is ignored (via P5 anchoring)',
  async (t) => {
    const { loadInstruments } = require('../src/instruments/anchor.cjs');
    const r = repo(t, { prisma: PRISMA, '.orchestrator/PROJECT-CONTEXT.md': '# Project context\n\n## Test tooling\n\nnone\n' });
    const context = `# Project context\n\n## Test tooling\n\n\`\`\`live\n${consentBlock('ephemeral')}\`\`\`\n`;
    write(r.root, { '.orchestrator/PROJECT-CONTEXT.md': context });
    const instruments = loadInstruments(r.root, { baseSha: r.sha, from: null });
    assert.equal(instruments.live.block.consent, undefined);
    const { io } = inspector(container());
    const out = await run(ctx(r, null, ['up'], { io, instruments }));
    assert.equal(out.exitCode, 1, out.lines.join('\n'));
    assert.deepEqual(out.report.refused, [RESET]);
    assert.equal(read(r.root, 'prisma.calls'), null);
  });

// ---- read-back -------------------------------------------------------------------------------

const FORBIDDEN = ['INSERT', 'UPDATE', 'DELETE', 'MERGE', 'CREATE', 'ALTER', 'DROP', 'TRUNCATE', 'GRANT', 'REVOKE',
  'COPY', 'CALL', 'DO', 'LOCK', 'VACUUM', 'INTO'];

test('read-only: every forbidden form is refused', () => {
  const refusals = [
    'DELETE FROM widgets', 'update widgets set a = 1', '  -- a note\nINSERT INTO t VALUES (1)', 'BEGIN', '(SELECT 1)', '',
    'SELECT 1; SELECT 2', 'SELECT 1;;', 'SELECT 1; -- after', "SELECT ';'",
    ...FORBIDDEN.map((w) => `SELECT 1 FROM t WHERE x IN (SELECT ${w.toLowerCase()} FROM u)`),
    'WITH d AS (DELETE FROM t RETURNING *) SELECT * FROM d', 'EXPLAIN ANALYZE DELETE FROM t', 'SELECT * INTO copy FROM t',
    'SELECT 1 -- drop it later', 'SELECT 1 /* DROP */',
    "SELECT E'\\'', 1", "SELECT 'unterminated", 'SELECT "unterminated', 'SELECT $$ x $$', 'SELECT 1 \\gexec', '\\! rm -rf x',
    'SELECT 1 /* a /* nested */ DROP */',
  ];
  for (const sql of refusals) assert.equal(typeof readOnlyViolation(sql), 'string', sql);
});

test('read-only: reads pass, with forbidden words only inside quotes, leading comments, and one trailing ;', () => {
  for (const sql of [
    'SELECT 1', 'select * from widgets where note = \'please delete me\'', '-- a note\n/* another */ SELECT 1;',
    'WITH x AS (SELECT 1) SELECT * FROM x', 'SHOW search_path', 'EXPLAIN SELECT 1', 'VALUES (1), (2)', 'TABLE widgets',
    'SELECT "update", last_update, updated_at FROM t', "SELECT 'it''s fine -- really' ;  ", 'SELECT \'$(touch x)\', "a""b"',
  ]) {
    assert.equal(readOnlyViolation(sql), null, sql);
  }
});

const ARGV_JS = "console.log(JSON.stringify(process.argv.slice(2)));\nfor (let i = 0; i < Number(process.env.EXTRA || 0); i++) console.log('row ' + i);\n"
  + "console.error('a warning on stderr');\n";

test('readback: a refused SQL on a read-only store exits 3 with "refused: read-only store", and nothing runs', async (t) => {
  const r = repo(t);
  const block = `${HEAD}readback:\n  pg: { run: "touch ran; echo", read_only: true }\n`;
  await assert.rejects(run(ctx(r, block, ['readback', 'pg', 'DROP TABLE widgets'])),
    (e) => e.exitCode === 3 && /^refused: read-only store/.test(e.message));
  assert.equal(read(r.root, 'ran'), null);
});

test('readback: the SQL reaches the command as one argument, even with $(…) and quotes inside', async (t) => {
  const r = repo(t, { 'argv.js': ARGV_JS });
  const sql = "SELECT '$(touch pwned)', \"a\"\"b\", 'it''s' -- `touch pwned2` $(touch pwned3) \"$1\"";
  const out = await run(ctx(r, `${HEAD}readback:\n  pg: { run: "node argv.js", read_only: true }\n`, ['readback', 'pg', sql]));
  assert.equal(out.exitCode, 0, out.lines.join('\n'));
  assert.deepEqual(JSON.parse(out.report.readback.rows[0]), [sql]);
  assert.deepEqual(out.report.readback.rows, [JSON.stringify([sql])], 'stderr stays out of the rows');
  assert.deepEqual([out.report.readback.store, out.report.readback.sql, out.report.readback.exit, out.report.readback.truncated],
    ['pg', sql, 0, false]);
  for (const f of ['pwned', 'pwned2', 'pwned3']) assert.equal(read(r.root, f), null, f);
  assert.ok(read(r.root, out.report.readback.evidence.log).includes('a warning on stderr'));
});

test('readback: rows cap at 200 with truncated; a failing command is red; a writable store takes any SQL', async (t) => {
  const r = repo(t, { 'argv.js': ARGV_JS });
  const block = `${HEAD}readback:\n  pg: { run: "node argv.js", read_only: false }\n  bad: { run: "exit 5; echo", read_only: false }\n`;
  const many = await run(ctx(r, block, ['readback', 'pg', 'DELETE FROM widgets'], { env: { ...process.env, EXTRA: '250' } }));
  assert.equal(many.exitCode, 0);
  assert.equal(many.report.readback.rows.length, 200);
  assert.equal(many.report.readback.truncated, true);
  const bad = await run(ctx(r, block, ['readback', 'bad', 'SELECT 1']));
  assert.deepEqual([bad.exitCode, bad.report.status, bad.report.readback.exit], [1, 'red', 5]);
});

test('every mode\'s report conforms to schema/live.schema.json',
  async (t) => {
    const { validate, unhandledKeywords, unsupportedKeywordForms } = require('./helpers/schema-validate.cjs');
    const schema = JSON.parse(fs.readFileSync(path.join(SKILL, 'schema', 'live.schema.json'), 'utf8'));
    assert.deepEqual(unhandledKeywords(schema), []);
    assert.deepEqual(unsupportedKeywordForms(schema), []);
    const r = repo(t, { 'argv.js': ARGV_JS, 'db.sh': 'echo "ERROR:  x already exists" >&2\nexit 1\n' });
    const block = `${HEAD}db: { build: "sh db.sh" }\nservices:\n  web: { up: "true", ready: "cmd:true", down: "true" }\n`
      + 'readback:\n  pg: { run: "node argv.js", read_only: true }\n  slow: { run: "sleep 30; echo", read_only: false }\n';
    for (const [text, args, opts] of [[block, ['check']], [block, ['up']], [block, ['down']], [block, ['readback', 'pg', 'SELECT 1']],
      [block, ['readback', 'slow', 'SELECT 1'], { io: { readbackMs: 300 } }], [null, ['up']], [consentBlock('shared-dev'), ['up']]]) {
      const { report } = await run(ctx(r, text, args, opts));
      assert.deepEqual(validate(schema, report), [], `${args[0]}: ${JSON.stringify(report)}`);
      const broken = { ...report };
      delete broken.status;
      assert.notDeepEqual(validate(schema, broken), []);
    }
  });
