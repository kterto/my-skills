'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ignoreDesktopLitter } = require('./helpers/git-fixture.cjs');
const { pathToFileURL } = require('node:url');

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_CEILING_DIRECTORIES = `${os.tmpdir()}:${fs.realpathSync(os.tmpdir())}`;

const E = require('../src/instruments/envelope.cjs');

const ENV = { ...process.env, GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@example.test',
  GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@example.test' };
delete ENV.NODE_TEST_CONTEXT;

function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

function tmp(t, prefix = 'ccg-cli-') {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 5 }));
  return dir;
}

function repo(t, files, branch = 'main') {
  const dir = tmp(t, 'ccg-cli-repo-');
  const git = (...args) => cp.execFileSync('git', ['-C', dir, ...args], { env: ENV, encoding: 'utf8' }).trim();
  git('init', '-q', '--template=', '-b', branch);
  git('config', 'commit.gpgsign', 'false');
  ignoreDesktopLitter(dir);
  write(dir, files);
  git('add', '-A');
  git('commit', '-qm', 'base');
  return { dir, git };
}

test('stableJson sorts keys at every depth, so insertion order never changes a digest', () => {
  const a = { b: 1, a: { d: [{ z: 1, y: 2 }], c: null } };
  const b = { a: { c: null, d: [{ y: 2, z: 1 }] }, b: 1 };
  assert.equal(E.stableJson(a), '{"a":{"c":null,"d":[{"y":2,"z":1}]},"b":1}');
  assert.equal(E.stableJson(b), E.stableJson(a));
  assert.equal(E.stableJson([3, 1]), '[3,1]');
});

test('byCodeUnit orders by UTF-16 code unit, never by locale', () => {
  assert.deepEqual(['b', 'a', 'B', 'é', 'Z'].sort(E.byCodeUnit), ['B', 'Z', 'a', 'b', 'é']);
  assert.equal(E.byCodeUnit('a', 'a'), 0);
});

test('fmtDuration prints seconds under a minute, else minutes and zero-padded seconds', () => {
  assert.equal(E.fmtDuration(0), '0s');
  assert.equal(E.fmtDuration(12_000), '12s');
  assert.equal(E.fmtDuration(59_400), '59s');
  assert.equal(E.fmtDuration(60_000), '1m00s');
  assert.equal(E.fmtDuration(125_000), '2m05s');
  assert.equal(E.fmtDuration(3_725_000), '62m05s');
});

test('redact hides secret assignments, URL passwords and bearer tokens, and strips ANSI codes', () => {
  assert.equal(E.redact('failed at postgresql://app:synthetic-pw-1@db.example.test:5432/widgets'),
    'failed at postgresql://app:<redacted>@db.example.test:5432/widgets');
  assert.equal(E.redact('redis://default:synthetic-pw-2@127.0.0.1:6379/0'), 'redis://default:<redacted>@127.0.0.1:6379/0');
  assert.equal(E.redact('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.e30.synthetic'), 'Authorization: Bearer <redacted>');
  assert.equal(E.redact('https://widgets.example.test/orders?id=1 and git@example.test:a/b'),
    'https://widgets.example.test/orders?id=1 and git@example.test:a/b', 'a URL with no password is left alone');
  assert.equal(E.redact('db password=hunter2 ok'), 'db <redacted> ok');
  assert.equal(E.redact('API_KEY: abc123'), '<redacted>');
  assert.equal(E.redact('export WIDGET_SECRET_KEY=abc'), 'export WIDGET_<redacted>');
  assert.equal(E.redact('\x1b[31mfail\x1b[0m token=abc'), 'fail <redacted>');
  assert.equal(E.redact('no secrets here'), 'no secrets here');
});

test('writeReport writes <kind>.json as two-space JSON with a final newline, and returns its path', (t) => {
  const dir = tmp(t);
  const file = E.writeReport(path.join(dir, 'a', 'b'), 'select', { z: 1, a: [2] });
  assert.equal(file, path.join(dir, 'a', 'b', 'select.json'));
  assert.equal(fs.readFileSync(file, 'utf8'), '{\n  "z": 1,\n  "a": [\n    2\n  ]\n}\n');
});

test('envelope builds the documented keys in order, from the repo and the resolved instruments', (t) => {
  const { dir, git } = repo(t, { 'a.ts': 'x\n' });
  const sha = git('rev-parse', 'HEAD');
  write(dir, { 'b.ts': 'y\n' });
  const instruments = { source: 'merge-base', from: null, digest: 'd'.repeat(64), moves: [],
    barrier: null, guards: [], live: null };
  const env = E.envelope({ kind: 'select', mode: 'adhoc', root: dir, base: { ref: 'main', sha }, instruments,
    isolation: null, now: '2026-01-02T03:04:05Z', version: '9.9.9' });
  assert.deepEqual(Object.keys(env), ['schemaVersion', 'kind', 'mode', 'generatedAt', 'tool', 'tree',
    'instruments', 'isolation', 'status', 'timing']);
  const { candidateTree } = env.tree;
  assert.deepEqual(env, {
    schemaVersion: '1.0', kind: 'select', mode: 'adhoc', generatedAt: '2026-01-02T03:04:05Z',
    tool: { name: 'clean-code-gates', version: '9.9.9' },
    tree: { base: sha, baseTree: git('rev-parse', 'HEAD^{tree}'), candidateTree },
    instruments: { source: 'merge-base', from: null, digest: 'd'.repeat(64), moves: [] },
    isolation: null, status: 'not-run', timing: {},
  });
  assert.deepEqual(git('ls-tree', '-r', '--name-only', candidateTree).split('\n'), ['a.ts', 'b.ts']);
});

test('summarize passes a short summary through and ends with the report path', () => {
  assert.equal(E.summarize(['SELECT pass · 1/2 selected', 'spec/a.spec.ts changed'], '/r/select.json'),
    'SELECT pass · 1/2 selected\nspec/a.spec.ts changed\nreport → /r/select.json\n');
});

test('summarize caps 20 KB of details at 2,048 bytes, keeping line 1 and the last line', () => {
  const details = Array.from({ length: 400 }, (_, i) => `detail ${String(i).padStart(3, '0')} ${'x'.repeat(50)}`);
  assert.ok(Buffer.byteLength(details.join('\n')) >= 20 * 1024);
  const out = E.summarize(['BARRIER red · unit fail 3s', ...details], '/r/barrier.json');
  const size = Buffer.byteLength(out);
  assert.ok(size <= 2048 && size > 2048 - 70, `${size} bytes: capped, and filled up to the cap`);
  const lines = out.split('\n');
  assert.equal(lines[0], 'BARRIER red · unit fail 3s');
  assert.equal(lines.at(-1), '');
  assert.equal(lines.at(-2), 'report → /r/barrier.json');
  const kept = lines.slice(1, -3);
  assert.deepEqual(kept, details.slice(0, kept.length), 'details drop from the end');
  assert.equal(lines.at(-3), `… +${400 - kept.length} more lines`, 'the last line already names the report');
});

test('summarize stays within 2,048 bytes with a long line 1 and a long report path, cutting the path from its left', () => {
  const details = Array.from({ length: 400 }, (_, i) => `detail ${i} ${'x'.repeat(50)}`);
  const verdict = `BARRIER red · ${'y'.repeat(2000)}`;
  const mid = `/r/${'p'.repeat(600)}/barrier.json`;
  const midOut = E.summarize([verdict, ...details], mid);
  assert.ok(Buffer.byteLength(midOut) <= 2048, `${Buffer.byteLength(midOut)} bytes with a 600-byte path`);
  assert.equal(midOut.split('\n').at(-2), `report → ${mid}`, 'a path that fits is never cut');
  const long = `/r/${'q'.repeat(1500)}/barrier.json`;
  for (const lines of [[verdict, ...details], [verdict]]) {
    const out = E.summarize(lines, long);
    assert.ok(Buffer.byteLength(out) <= 2048, `${Buffer.byteLength(out)} bytes with a 1,500-byte path`);
    const last = out.split('\n').at(-2);
    assert.match(last, /^report → …q+\/barrier\.json$/, 'the path keeps its end');
    assert.ok(Buffer.byteLength(last) > 900, 'and as much of it as fits');
  }
  const wide = E.summarize([verdict, 'one detail'], `/r/${'é'.repeat(800)}/x.json`).split('\n').at(-2);
  assert.match(wide, /^report → …é+\/x\.json$/, 'never splitting a character');
});

test('summarize cuts line 1 to 1,024 bytes with an ellipsis, never splitting a character', () => {
  const verdict = `SWEEP red · ${'é'.repeat(2000)}`;
  const [first, last] = E.summarize([verdict], '/r/sweep.json').split('\n');
  assert.ok(Buffer.byteLength(first) <= 1024 && Buffer.byteLength(first) >= 1020);
  assert.ok(first.endsWith('…'));
  assert.ok(verdict.startsWith(first.slice(0, -1)));
  assert.equal(last, 'report → /r/sweep.json');
});

const BIN = path.join(__dirname, '..', 'bin', 'gates.cjs');
const VERSION = require('../package.json').version;
const cli = () => require('../src/instruments/cli.cjs');
const spawn = (cwd, args) => cp.spawnSync(process.execPath, [BIN, ...args], { cwd, env: ENV, encoding: 'utf8' });
const EXIT = { pass: 0, red: 1, 'not-run': 4 };
const CLASS = { shape: 'a TODO left in source', pattern: 'regex over src', confirm: 'read the line' };
const GUARD = { id: 'no-todo', kind: 'shape', class: CLASS, shape: { type: 'regex', files: ['src/**/*.ts'], pattern: 'TODO' } };

async function inProcess(cwd, kind, args, io = {}) {
  const got = { stdout: '', stderr: '' };
  got.code = await cli().main(kind, args, { cwd, stdout: (s) => { got.stdout += s; }, stderr: (s) => { got.stderr += s; }, ...io });
  return got;
}

// A kind that reports `status` over the real envelope, and remembers what it was handed.
function stubKind(status, { lines, warnings = [], exitCode = EXIT[status], seen = {} } = {}) {
  return { kinds: { select: { async run(ctx) {
    seen.ctx = ctx;
    seen.report = { ...E.envelope({ kind: 'select', mode: 'adhoc', root: ctx.root, base: ctx.base,
      instruments: ctx.instruments, now: ctx.now, version: ctx.version }), status };
    return { report: seen.report, lines: lines || [`SELECT ${status} · stub`], exitCode, warnings };
  } } } };
}

test('vocab exports the frozen §2.3 arrays and nothing else', () => {
  const vocab = require('../src/instruments/vocab.cjs');
  assert.ok(Object.isFrozen(vocab));
  for (const values of Object.values(vocab)) assert.ok(Object.isFrozen(values));
  assert.deepEqual({ ...vocab }, {
    KINDS: ['barrier', 'select', 'sweep', 'live'],
    MODES: ['select:tier', 'select:adhoc', 'sweep:guard', 'sweep:all', 'sweep:changed', 'sweep:shape', 'sweep:prove',
      'live:check', 'live:up', 'live:readback', 'live:down'],
    RESULTS: ['pass', 'fail', 'not-run'],
    REASONS: ['assertion', 'timeout', 'vacuous', 'empty-scope', 'flaky', 'unmeasured', 'blocked-env', 'repo-defect',
      'no-live-recipe'],
    STATUSES: ['pass', 'red', 'not-run'],
    SUITE_RESULTS: ['pass', 'fail', 'error', 'skipped'],
    BASE_SOURCES: ['inherited', 'worktree', 'none'],
    GUARD_KINDS: ['shape', 'command', 'consumers'],
    SHAPE_TYPES: ['regex', 'decorated-fields'],
    GUARD_STATUSES: ['green', 'red', 'not-run', 'quiet', 'listed'],
    ON_TIMEOUT: ['not-done', 'retry-2x'],
    ISOLATION: ['shared-dev', 'ephemeral'],
  });
});

test('vocab: an ES module can import every array by name, as the admission test does', async () => {
  const vocab = require('../src/instruments/vocab.cjs');
  const ns = await import(pathToFileURL(require.resolve('../src/instruments/vocab.cjs')).href);
  assert.deepEqual(Object.keys(ns).filter((k) => k !== 'default').sort(), Object.keys(vocab).sort());
  for (const [name, values] of Object.entries(vocab)) assert.equal(ns[name], values, name);
  assert.equal(ns.default, vocab);
});

test('bin: every instrument kind reaches the instruments CLI, whose usage errors exit 3 naming the flag', (t) => {
  const { dir } = repo(t, { 'a.ts': 'x\n' });
  for (const kind of ['barrier', 'select', 'sweep', 'live']) {
    const r = spawn(dir, [kind, '--now', 'yesterday']);
    assert.equal(r.status, 3, kind);
    assert.equal(r.stderr, 'usage error: --now: not an ISO 8601 date-time: yesterday\n', kind);
    assert.equal(r.stdout, '');
  }
});

test('bin: the legacy path is untouched, and only argv[0] can name an instrument', (t) => {
  const dir = tmp(t);
  // The legacy engine ignores the two engine keys, even an entry the engine would refuse, and never rewrites them.
  const config = `${JSON.stringify({ barrier: { tiers: [] }, guards: [{ id: 'Not Valid' }] })}\n`;
  write(dir, { 'package.json': '{}', 'tsconfig.json': '{}', 'src/a.ts': 'export const a = 1;\n', '.cleancode-gates.json': config });
  const legacy = spawn(dir, ['--scope', 'files:src/a.ts', '--gates', 'G5', '--out', '-']);
  assert.equal(legacy.status, 0, legacy.stderr);
  assert.equal(JSON.parse(legacy.stdout).summary.status, 'pass');
  assert.equal(fs.readFileSync(path.join(dir, '.cleancode-gates.json'), 'utf8'), config);
  const later = spawn(dir, ['--scope', 'files:src/a.ts', 'barrier']);
  assert.equal(later.status, 3);
  assert.equal(later.stderr, 'usage error: unknown argument: barrier\n');
});

// B3: a plant a killed proof left on disk goes back before any kind measures, not only before a sweep.
test('every kind first restores a plant a killed proof left behind, and measures the restored tree (barrier, select)', (t) => {
  const sha = (text) => require('node:crypto').createHash('sha256').update(text).digest('hex');
  const [original, planted] = ['exports.size = () => 1;\n', 'exports.size = () => 2;\n'];
  const tier = { id: 'unit', cwd: '.', report: 'exit-code', scope: 'whole', bound_minutes: 1,
    run: `"${process.execPath}" -e "process.exit(require('./src/widget.js').size() === 1 ? 0 : 1)"` };
  const { dir, git } = repo(t, { '.gitignore': '.cleancode/\n', '.cleancode-gates.json': `${JSON.stringify({ barrier: { tiers: [tier] } })}\n`,
    'src/widget.js': original, 'spec/widget.spec.js': "require('../src/widget.js');\n" });
  const journal = JSON.stringify([{ file: 'src/widget.js', sha256_original: sha(original),
    original_base64: Buffer.from(original).toString('base64'), sha256_planted: sha(planted) }]);
  for (const args of [['barrier'], ['select', '--tests', 'spec/**/*.spec.js', '--sources', 'src/**/*.js']]) {
    write(dir, { 'src/widget.js': planted, '.cleancode/plant-journal.json': journal });
    const r = spawn(dir, args);
    assert.equal(r.status, 0, `${args[0]}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /^warning: restored src\/widget\.js: a planted-offender proof was interrupted$/m, args[0]);
    assert.equal(fs.readFileSync(path.join(dir, 'src/widget.js'), 'utf8'), original, args[0]);
    const report = JSON.parse(fs.readFileSync(path.join(dir, '.cleancode', `${args[0]}.json`), 'utf8'));
    assert.equal(report.tree.candidateTree, git('rev-parse', 'HEAD^{tree}'), `${args[0]} measured the restored tree`);
  }
});

test('bin: with neither origin/main nor main, and no --base, the CLI exits 3 and never falls back to HEAD', (t) => {
  const { dir } = repo(t, { 'a.ts': 'x\n' }, 'trunk');
  const r = spawn(dir, ['select', '--tests', 'a.ts', '--sources', 'a.ts']);
  assert.equal(r.status, 3);
  assert.equal(r.stderr, 'error: no base ref: pass --base <ref>\n');
  assert.equal(fs.existsSync(path.join(dir, '.cleancode')), false);
});

test('bin: a real kind runs, its report lands in <out>, and its exit code reaches the process', (t) => {
  const { dir } = repo(t, { 'a.ts': 'x\n' });
  const r = spawn(dir, ['live', 'check']);
  const file = path.join(dir, '.cleancode', 'live.json');
  assert.equal(r.status, 4, r.stderr);
  assert.match(r.stdout, /^LIVE not-run · /);
  assert.ok(r.stdout.endsWith(`\nreport → ${file}\n`), r.stdout);
  const report = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual([report.kind, report.status], ['live', 'not-run']);
});

// cli.cjs hands every flag it does not own to the kind, so each kind must refuse one it does not know.
const LIVE_CONTEXT = '# Context\n\n## Test tooling\n\n```live\nversion: 1\nisolation: ephemeral\n```\n';
for (const args of [['barrier'], ['select'], ['sweep'], ['live', 'check']]) {
  test(`bin: ${args.join(' ')} refuses an unknown flag with exit 3, naming it`, (t) => {
    const { dir } = repo(t, { '.orchestrator/PROJECT-CONTEXT.md': LIVE_CONTEXT });
    const r = spawn(dir, [...args, '--colour', 'blue']);
    assert.equal(r.status, 3, r.stderr);
    assert.match(r.stderr, /--colour/);
  });
}

test('bin: a working-tree config that does not parse is ignored with a warning and the move config invalid (changed), '
  + 'and every kind\'s report still validates against its schema', (t) => {
  const { validate } = require('./helpers/schema-validate.cjs');
  const unit = { id: 'unit', cwd: '.', run: 'true', report: 'exit-code', scope: 'whole', bound_minutes: 1 };
  const { dir } = repo(t, { '.cleancode-gates.json': `${JSON.stringify({ barrier: { tiers: [unit] }, guards: [GUARD] })}\n`,
    'src/a.ts': 'export const a = 1;\n', '.orchestrator/PROJECT-CONTEXT.md': LIVE_CONTEXT });
  write(dir, { '.cleancode-gates.json': '{ "barrier": \n' });
  const kinds = [['barrier'], ['select', '--tests', 'src/**/*.ts', '--sources', 'src/**/*.ts'], ['sweep', '--all'], ['live', 'check']];
  for (const args of kinds) {
    const r = spawn(dir, args);
    assert.equal(r.status, 0, `${args[0]}: ${r.stdout}${r.stderr}`);
    assert.match(r.stderr, /^warning: \.cleancode-gates\.json in the working tree is invalid \(invalid JSON \(.+\)\); its additions are ignored, and the base's instruments run$/m, args[0]);
    assert.match(r.stderr, /^INSTRUMENT MOVED — config invalid \(changed\) — measured against merge-base \(main\) values$/m, args[0]);
    const report = JSON.parse(fs.readFileSync(path.join(dir, '.cleancode', `${args[0]}.json`), 'utf8'));
    assert.deepEqual(report.instruments.moves, [{ key: 'config', change: 'invalid', direction: 'changed' }], args[0]);
    const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schema', `${args[0]}.schema.json`), 'utf8'));
    assert.deepEqual(validate(schema, report), [], `${args[0]}.json against its schema`);
  }
});

test('bin: outside a git repository the CLI exits 3', (t) => {
  const dir = tmp(t);
  const r = spawn(dir, ['sweep', '--all']);
  assert.equal(r.status, 3);
  assert.match(r.stderr, /^error: not a git repository: /);
});

test('a common flag without its value is a usage error that names it', async (t) => {
  const { dir } = repo(t, { 'a.ts': 'x\n' });
  for (const flag of ['--base', '--instruments-from', '--out', '--now']) {
    const r = await inProcess(dir, 'select', ['--tests', 'a.ts', flag], stubKind('pass'));
    assert.deepEqual([r.code, r.stderr], [3, `usage error: ${flag} needs a value\n`]);
  }
  const r = await inProcess(dir, 'select', ['--out', '--now', '2026-01-01T00:00:00Z'], stubKind('pass'));
  assert.deepEqual([r.code, r.stderr], [3, 'usage error: --out needs a value\n']);
  for (const flag of ['--base', '--instruments-from', '--out', '--now']) {
    const empty = await inProcess(dir, 'select', [flag, ''], stubKind('pass'));
    assert.deepEqual([empty.code, empty.stderr], [3, `usage error: ${flag} needs a value\n`], `${flag} ''`);
  }
  assert.equal(fs.existsSync(path.join(dir, 'select.json')), false, 'an empty --out never writes into the repo root');
  const unknown = await inProcess(dir, 'deploy', [], stubKind('pass'));
  assert.deepEqual([unknown.code, unknown.stderr], [3, 'usage error: unknown instrument: deploy\n']);
});

test('a malformed ref, an unresolvable ref and a bad --now all exit 3 before the kind runs', async (t) => {
  const { dir } = repo(t, { 'a.ts': 'x\n' });
  const seen = {};
  const cases = [
    [['--base', '-x'], /^usage error: --base: invalid base ref/],
    [['--instruments-from', 'a;b'], /^usage error: --instruments-from: invalid base ref/],
    [['--now', '2026-02-30T25:00:00Z'], /^usage error: --now: not an ISO 8601 date-time/],
    [['--now', '2026-01-01'], /^usage error: --now: not an ISO 8601 date-time/],
    [['--base', 'nope'], /^error: invalid base ref — "nope" does not resolve/],
    [['--instruments-from', 'nope'], /^error: invalid base ref — "nope" does not resolve/],
    [['--instruments-from', 'file:missing.json'], /^error: --instruments-from file:missing\.json: /],
  ];
  for (const [args, expected] of cases) {
    const r = await inProcess(dir, 'select', args, stubKind('pass', { seen }));
    assert.equal(r.code, 3, args.join(' '));
    assert.match(r.stderr, expected);
  }
  assert.equal(seen.ctx, undefined);
});

test('each status maps to its exit code, and a missing exit code falls back to the status, never to 0', async (t) => {
  const { dir } = repo(t, { 'a.ts': 'x\n' });
  for (const status of ['pass', 'red', 'not-run']) {
    assert.equal((await inProcess(dir, 'select', [], stubKind(status))).code, EXIT[status], status);
    assert.equal((await inProcess(dir, 'select', [], stubKind(status, { exitCode: undefined }))).code, EXIT[status], status);
  }
  const noReport = { kinds: { select: { run: async () => ({ report: null, lines: ['no verdict'], exitCode: undefined, warnings: [] }) } } };
  const r = await inProcess(dir, 'select', [], noReport);
  assert.deepEqual([r.code, r.stdout, r.stderr], [3, '', 'no verdict\n']);
});

test('a kind that throws exits 3, or the exit code its error carries, and writes no report', async (t) => {
  const { dir } = repo(t, { 'a.ts': 'x\n' });
  const throwing = (e) => ({ kinds: { select: { run: async () => { throw e; } } } });
  const plain = await inProcess(dir, 'select', [], throwing(new Error('boom')));
  assert.deepEqual([plain.code, plain.stdout, plain.stderr], [3, '', 'error: boom\n']);
  const carried = await inProcess(dir, 'select', [], throwing(Object.assign(new Error('refused: read-only store'), { exitCode: 3 })));
  assert.deepEqual([carried.code, carried.stderr], [3, 'error: refused: read-only store\n']);
  assert.equal(fs.existsSync(path.join(dir, '.cleancode')), false);
});

test('the report lands at <out>/<kind>.json, --out resolving against the repo root, and stdout is the summary', async (t) => {
  const { dir } = repo(t, { 'sub/a.ts': 'x\n' });
  const seen = {};
  const r = await inProcess(path.join(dir, 'sub'), 'select', ['--out', 'out/x'], stubKind('pass', { seen }));
  const file = path.join(dir, 'out', 'x', 'select.json');
  assert.equal(r.code, 0);
  assert.equal(r.stdout, `SELECT pass · stub\nreport → ${file}\n`);
  assert.equal(fs.readFileSync(file, 'utf8'), `${JSON.stringify(seen.report, null, 2)}\n`);
  const byDefault = await inProcess(dir, 'select', [], stubKind('pass'));
  assert.equal(byDefault.stdout, `SELECT pass · stub\nreport → ${path.join(dir, '.cleancode', 'select.json')}\n`);
});

test('the kind is handed the documented ctx, with its own arguments in order', async (t) => {
  const { dir, git } = repo(t, { 'a.ts': 'x\n' });
  const seen = {};
  const dockerInspect = () => '[]';
  await inProcess(dir, 'select', ['--tests', 'a,b', '--now', '2026-01-02T03:04:05Z', '--flows', '--base', 'main'],
    { ...stubKind('pass', { seen }), dockerInspect });
  const { ctx } = seen;
  assert.deepEqual(Object.keys(ctx), ['root', 'args', 'base', 'instruments', 'outDir', 'now', 'version', 'env', 'io', 'signal']);
  assert.equal(ctx.root, dir);
  assert.deepEqual(ctx.args, ['--tests', 'a,b', '--flows']);
  assert.deepEqual(ctx.base, { ref: 'main', sha: git('rev-parse', 'HEAD') });
  assert.equal(ctx.instruments.source, 'defaults');
  assert.equal(ctx.outDir, path.join(dir, '.cleancode'));
  assert.equal(ctx.now, '2026-01-02T03:04:05Z');
  assert.equal(ctx.version, VERSION);
  assert.equal(ctx.env, process.env);
  assert.equal(ctx.io.dockerInspect, dockerInspect);
  assert.ok(ctx.signal instanceof AbortSignal);
  await inProcess(dir, 'select', [], stubKind('pass', { seen }));
  assert.ok(Math.abs(Date.parse(seen.ctx.now) - Date.now()) < 60_000, 'without --now, generatedAt is the clock');
});

test('warnings and the INSTRUMENT MOVED line go to stderr, never stdout', async (t) => {
  const { dir } = repo(t, { '.cleancode-gates.json': `${JSON.stringify({ guards: [GUARD] })}\n` });
  fs.rmSync(path.join(dir, '.cleancode-gates.json'));
  const r = await inProcess(dir, 'select', [], stubKind('pass', { warnings: ['no live block: flows is []'] }));
  assert.equal(r.stderr, 'warning: no live block: flows is []\n'
    + 'INSTRUMENT MOVED — guards.no-todo removed (loosening) — measured against merge-base (main) values\n');
  assert.doesNotMatch(r.stdout, /INSTRUMENT|warning/);
  const fresh = repo(t, { 'a.ts': 'x\n' });
  write(fresh.dir, { '.cleancode-gates.json': `${JSON.stringify({ guards: [GUARD] })}\n` });
  const added = await inProcess(fresh.dir, 'select', [], stubKind('pass'));
  assert.equal(added.stderr, 'INSTRUMENT MOVED — guards.no-todo added (tightening) — measured against built-in defaults values\n');
});

test('stdout stays within 2,048 bytes over 20 KB of details, keeping the verdict and the report path', async (t) => {
  const { dir } = repo(t, { 'a.ts': 'x\n' });
  const details = Array.from({ length: 400 }, (_, i) => `spec/widget-${i}.spec.ts imports src/widget.ts ${'x'.repeat(20)}`);
  assert.ok(Buffer.byteLength(details.join('\n')) >= 20 * 1024);
  const r = await inProcess(dir, 'select', [], stubKind('red', { lines: ['SELECT red · 400/400 selected (max 20)', ...details] }));
  const lines = r.stdout.split('\n');
  assert.equal(r.code, 1);
  assert.ok(Buffer.byteLength(r.stdout) <= 2048, `${Buffer.byteLength(r.stdout)} bytes`);
  assert.equal(lines[0], 'SELECT red · 400/400 selected (max 20)');
  assert.equal(lines.at(-2), `report → ${path.join(dir, '.cleancode', 'select.json')}`);
  assert.match(lines.at(-3), /^… \+\d+ more lines$/);
});

// ---- barrier.frozen: paths that are not the product, held at HEAD in every kind's tree and changed set ----

const FROZEN_CONFIG = `${JSON.stringify({ barrier: { frozen: ['plans/**', '.orchestrator/**'] } })}\n`;
const SELECT = ['select', '--tests', 'spec/**/*.spec.ts', '--sources', 'src/**/*.ts'];
const PRODUCT = { 'src/a.ts': 'export const a = 1;\n', 'spec/a.spec.ts': "import { a } from '../src/a';\n" };
const reportOf = (dir, kind) => JSON.parse(fs.readFileSync(path.join(dir, '.cleancode', `${kind}.json`), 'utf8'));

test('barrier.frozen, declared with no tier, holds a run\'s plans and state at HEAD for every kind: the tree stays HEAD\'s', (t) => {
  const { dir, git } = repo(t, { '.cleancode-gates.json': FROZEN_CONFIG, ...PRODUCT, 'plans/kept.md': 'v1\n' });
  write(dir, { 'plans/run/QA.md': 'qa\n', '.orchestrator/runs/x/NEXT': 'coder\n', 'plans/kept.md': 'v2\n' });
  const head = git('rev-parse', 'HEAD^{tree}');
  for (const args of [SELECT, ['live', 'check']]) {
    const r = spawn(dir, args);
    assert.equal(reportOf(dir, args[0]).tree.candidateTree, head, `${args[0]}: ${r.stderr}`);
    assert.doesNotMatch(r.stderr, /INSTRUMENT MOVED/);
  }
  write(dir, { 'src/a.ts': 'export const a = 2;\n' });
  spawn(dir, SELECT);
  assert.deepEqual(reportOf(dir, 'select').changed, ['src/a.ts'], 'a frozen edit is no change');
  assert.notEqual(reportOf(dir, 'select').tree.candidateTree, head);
});

test('a barrier.frozen only the branch declares is ignored, with the move: its paths still count', (t) => {
  const { dir, git } = repo(t, PRODUCT);
  write(dir, { '.cleancode-gates.json': FROZEN_CONFIG, 'plans/run/QA.md': 'qa\n' });
  const r = spawn(dir, SELECT);
  assert.match(r.stderr, /^INSTRUMENT MOVED — barrier\.frozen changed \(changed\) — measured against built-in defaults values$/m);
  assert.deepEqual(reportOf(dir, 'select').changed, ['.cleancode-gates.json', 'plans/run/QA.md']);
  assert.notEqual(reportOf(dir, 'select').tree.candidateTree, git('rev-parse', 'HEAD^{tree}'));
});

// ---- --out -, --help and the report history ----------------------------------------------------------------------

/** A repo with one exit-code tier that prints mark.txt, an untracked file, so each run's tree (and log) is its own. */
function marked(t) {
  const unit = { id: 'unit', cwd: '.', run: 'cat mark.txt', report: 'exit-code', scope: 'whole', bound_minutes: 1 };
  return repo(t, { '.cleancode-gates.json': `${JSON.stringify({ barrier: { tiers: [unit] } })}\n` });
}

test('--out -: the report goes to stdout and the summary to stderr, ending report → stdout; logs and the default cache stay '
  + 'under .cleancode, and no folder named - appears', (t) => {
  const { dir, git } = marked(t);
  write(dir, { 'mark.txt': 'run 1\n' });
  const r = spawn(dir, ['barrier', '--out', '-']);
  assert.equal(r.status, 0, r.stderr);
  const report = JSON.parse(r.stdout);
  assert.deepEqual([report.kind, report.status, report.tiers[0].candidate.evidence.log], ['barrier', 'pass', '.cleancode/logs/barrier-unit-candidate.log']);
  assert.match(r.stderr, /^BARRIER pass · unit pass \d+s \(exit-code only\)\nreport → stdout\n$/);
  assert.equal(fs.existsSync(path.join(dir, '-')), false);
  assert.ok(fs.existsSync(path.join(dir, '.cleancode', 'barrier-cache.json')));
  assert.equal(fs.existsSync(path.join(dir, '.cleancode', 'barrier.json')), false, 'the report went to a file too');
  assert.notEqual(report.tree.candidateTree, git('rev-parse', 'HEAD^{tree}'), 'mark.txt counts');
  const select = spawn(dir, ['select', '--tests', 'mark.txt', '--sources', 'mark.txt', '--out', '-']);
  assert.deepEqual([select.status, JSON.parse(select.stdout).kind, select.stderr.split('\n').at(-2)], [0, 'select', 'report → stdout']);
});

test('--help and -h exit 0 before anything resolves, outside a repository and over a broken config: the usage, or the '
  + 'common flags and the kind\'s section of the reference, read from the engine\'s own copy', (t) => {
  const dir = tmp(t);
  write(dir, { '.cleancode-gates.json': '{ "barrier": \n' });
  for (const flag of ['--help', '-h']) {
    const usage = spawn(dir, ['--scope', 'diff', flag]);
    assert.deepEqual([usage.status, usage.stderr], [0, ''], flag);
    assert.match(usage.stdout, /^usage: gates\.cjs \[--scope /);
    assert.match(usage.stdout, /gates\.cjs <barrier\|select\|sweep\|live> /);
  }
  const ref = fs.readFileSync(path.join(__dirname, '..', 'references', 'instruments.md'), 'utf8');
  const heads = ['barrier', 'select', 'sweep', 'live'].map((k) => ref.indexOf(`\n## \`${k}\`\n`) + 1);
  heads.forEach((at, i) => {
    const kind = ['barrier', 'select', 'sweep', 'live'][i];
    const r = spawn(dir, [kind, '--tier', 'x', i % 2 ? '-h' : '--help']);
    assert.deepEqual([r.status, r.stderr], [0, ''], kind);
    assert.match(r.stdout, /^common flags: --base <ref> --instruments-from <ref>\|file:<path> --out <dir>\|- --now <ISO 8601>\n\n/);
    const section = ref.slice(at, i < 3 ? heads[i + 1] : ref.length).trimEnd();
    assert.ok(at > 0 && r.stdout.endsWith(`\n${section}\n`), kind);
  });
  const copy = tmp(t);
  for (const p of ['bin', 'src', 'defaults.cjs', 'package.json']) fs.cpSync(path.join(__dirname, '..', p), path.join(copy, p), { recursive: true });
  const bare = cp.spawnSync(process.execPath, [path.join(copy, 'bin', 'gates.cjs'), 'barrier', '--help'], { cwd: dir, env: ENV, encoding: 'utf8' });
  assert.equal(bare.status, 0, bare.stderr);
  assert.match(bare.stdout, /^common flags: .*\n\n\(kind reference not found\)\n$/);
});

test('a kind first moves its last report and that kind\'s logs to history/<generatedAt>/: the archive is that run\'s, the '
  + 'five newest stay per kind, and nothing moves for a report that does not parse or under --out -', async (t) => {
  const { dir } = marked(t);
  const out = path.join(dir, 'qa');
  const now = (i) => `2026-01-${String(i).padStart(2, '0')}T00:00:00Z`;
  const dirOf = (i) => path.join(out, 'history', now(i).replace(/:/g, '-'));
  const run = async (i, flag = ['--out', 'qa']) => {
    write(dir, { 'mark.txt': `run ${i}\n` });
    const r = await inProcess(dir, 'barrier', [...flag, '--now', now(i)]);
    assert.equal(r.code, 0, r.stderr);
  };
  await run(1);
  const first = fs.readFileSync(path.join(out, 'barrier.json'), 'utf8');
  write(out, { 'logs/sweep-other.log': 'another kind\'s log\n' });
  await run(2);
  assert.equal(fs.readFileSync(path.join(dirOf(1), 'barrier.json'), 'utf8'), first);
  assert.match(fs.readFileSync(path.join(dirOf(1), 'logs', 'barrier-unit-candidate.log'), 'utf8'), /^run 1$/m, 'the first run\'s log');
  assert.match(fs.readFileSync(path.join(out, 'logs', 'barrier-unit-candidate.log'), 'utf8'), /^run 2$/m);
  assert.deepEqual([JSON.parse(fs.readFileSync(path.join(out, 'barrier.json'), 'utf8')).generatedAt, fs.readdirSync(path.join(dirOf(1), 'logs'))],
    [now(2), ['barrier-unit-candidate.log']], 'the new report keeps its path; another kind\'s log stays put');
  write(dirOf(1), { 'select.json': '{}\n' });
  for (let i = 3; i <= 8; i += 1) await run(i);
  assert.deepEqual(fs.readdirSync(path.join(out, 'history')).sort(), [1, 3, 4, 5, 6, 7].map((i) => path.basename(dirOf(i))));
  assert.deepEqual(fs.readdirSync(dirOf(1)), ['select.json'], 'only the kind\'s own files leave an older folder');
  write(out, { 'barrier.json': 'not a report\n' });
  await run(9);
  assert.equal(fs.readdirSync(path.join(out, 'history')).length, 6, 'a report that does not parse is replaced, never moved');
  for (const generatedAt of ['../../escaped', '..', '.']) {
    write(out, { 'barrier.json': `${JSON.stringify({ generatedAt })}\n` });
    await run(9);
    assert.deepEqual([fs.readdirSync(path.join(out, 'history')).length, fs.existsSync(path.join(dir, 'escaped')),
      fs.existsSync(path.join(out, 'history', 'barrier.json'))], [6, false, false], `a generatedAt of ${generatedAt} names no folder`);
  }
  await run(10, []);
  await run(11, ['--out', '-']);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dir, '.cleancode', 'barrier.json'), 'utf8')).generatedAt, now(10));
  assert.equal(fs.existsSync(path.join(dir, '.cleancode', 'history')), false, 'something moved under --out -');
});

test('the engine is 0.2.0, so a report from an older engine sharing one cache tells itself apart (tool.version)', async (t) => {
  assert.equal(VERSION, '0.2.0');
  const { dir } = marked(t);
  write(dir, { 'mark.txt': 'run 1\n' });
  const r = await inProcess(dir, 'barrier', ['--out', '-']);
  assert.deepEqual([r.code, JSON.parse(r.stdout).tool], [0, { name: 'clean-code-gates', version: '0.2.0' }]);
});
