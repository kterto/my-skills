'use strict';
// `sweep` (§7): guards read from the anchored registry and run repo-wide, one
// status per guard kind, the five modes, and the proof end to end. Each test
// builds a tiny git repo whose base commit declares the guards, then edits the
// working tree the way a branch would.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ignoreDesktopLitter } = require('./helpers/git-fixture.cjs');

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_CEILING_DIRECTORIES = `${os.tmpdir()}:${fs.realpathSync(os.tmpdir())}`;

const { run } = require('../src/instruments/sweep.cjs');
const { resolveBase } = require('../src/instruments/git.cjs');
const { loadInstruments } = require('../src/instruments/anchor.cjs');

const ENV = { ...process.env, GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@example.test',
  GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@example.test' };
delete ENV.NODE_TEST_CONTEXT;
const NODE = `'${process.execPath}'`;
const CLASS = { shape: 'a widget rule read by code it never told', pattern: 'importers of the rule', confirm: 'run the importer' };

const GUARDS = [
  { id: 'widget-fields', kind: 'shape', class: CLASS,
    shape: { type: 'decorated-fields', files: ['src/**/*.ts'], exclude: ['**/*.spec.ts'], classes: ['InputType'], field: 'Field',
      validators_from: ['class-validator'], checks: ['undecorated', 'nullable-without-optional'], optional: ['IsOptional'] },
    plants: [
      { name: 'undecorated field', file: 'src/widgets/create-widget.input.ts', find: '  name: string;\n',
        replace: '  name: string;\n  @Field()\n  probe: string;\n', expect: 'red' },
      { name: 'optional made required', file: 'src/widgets/create-widget.input.ts', find: '  @IsOptional()\n', replace: '', expect: 'red' },
    ] },
  { id: 'no-todo', kind: 'shape', class: CLASS, shape: { type: 'regex', files: ['src/**'], pattern: 'TODO', flags: '' } },
  { id: 'rule-consumers', kind: 'consumers', class: CLASS,
    consumers: { trigger: ['src/rules/widget.rule.ts'], files: ['src/**/*.ts'], exclude: ['**/*.spec.ts'], patterns: ['widgetLimit\\s*<'] } },
  { id: 'rule-check', kind: 'command', class: CLASS, command: { cwd: '.', run: `${NODE} check.cjs`, bound_minutes: 1 },
    plants: [{ name: 'the fix', file: 'src/rules/widget.rule.ts', find: 'BUG', replace: 'FIX', expect: 'green' }] },
];

const FILES = {
  'check.cjs': "process.exit(require('node:fs').readFileSync('src/rules/widget.rule.ts', 'utf8').includes('BUG') ? 1 : 0);\n",
  'src/rules/widget.rule.ts': '// BUG: off by one\nexport const widgetLimit = 3;\n',
  'src/widgets/widget.service.ts': [
    "import { widgetLimit } from '../rules/widget.rule';",
    '',
    'export class WidgetService {',
    '  tooMany(n: number): boolean {',
    '    return widgetLimit < n;',
    '  }',
    '}',
    '',
  ].join('\n'),
  'src/widgets/widget.controller.ts': "import { WidgetService } from './widget.service';\nexport class WidgetController {}\n",
  'src/widgets/widget.service.spec.ts': "import { widgetLimit } from '../rules/widget.rule';\nit('caps', () => widgetLimit < 9);\n",
  'src/orders/order.util.ts': 'export const orderLimit = 5;\nexport const tooMany = (widgetLimit: number) => widgetLimit < orderLimit;\n',
  'src/widgets/create-widget.input.ts': [
    "import { Field, InputType, Int } from '@nestjs/graphql';",
    "import { IsInt, IsOptional, IsString } from 'class-validator';",
    '',
    '@InputType()',
    'export class CreateWidgetInput {',
    '  @Field()',
    '  @IsString()',
    '  name: string;',
    '',
    '  @Field(() => Int, { nullable: true })',
    '  @IsOptional()',
    '  @IsInt()',
    '  size?: number;',
    '}',
    '',
  ].join('\n'),
  'src/widgets/update-widget.input.ts': [
    "import { Field, InputType } from '@nestjs/graphql';",
    '',
    '@InputType()',
    'export class UpdateWidgetInput {',
    '  @Field()',
    '  color: string;',
    '}',
    '',
  ].join('\n'),
};

function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

/** A repo whose one commit on main declares `guards`; the working tree then takes `edits`. */
function repo(t, { guards = GUARDS, files = FILES, edits = {} } = {}) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-sweep-')));
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 5 }));
  const git = (...args) => cp.execFileSync('git', ['-C', dir, ...args], { env: ENV, encoding: 'utf8' }).trim();
  git('init', '-q', '--template=', '-b', 'main');
  git('config', 'commit.gpgsign', 'false');
  ignoreDesktopLitter(dir);
  write(dir, { ...files, '.gitignore': '.cleancode/\n', '.cleancode-gates.json': `${JSON.stringify({ guards }, null, 2)}\n` });
  git('add', '-A');
  git('commit', '-qm', 'base');
  write(dir, edits);
  return dir;
}

function ctxFor(root, args) {
  const base = resolveBase(root, 'main');
  return { root, args, base, instruments: loadInstruments(root, { baseSha: base.sha }), outDir: path.join(root, '.cleancode'),
    now: '2026-01-02T03:04:05Z', version: '0.0.0-test', env: ENV, io: {} };
}

const sweep = (root, ...args) => run(ctxFor(root, args));
const entry = (res, id) => res.report.guards.find((g) => g.id === id);
const BIN = path.join(__dirname, '..', 'bin', 'gates.cjs');
const gates = (root, ...args) => cp.spawnSync(process.execPath, [BIN, 'sweep', ...args], { cwd: root, env: ENV, encoding: 'utf8' });
const JOURNAL = path.join('.cleancode', 'plant-journal.json');

/** A command guard that exits 1 on the unplanted rule, and hangs once the fix is planted. */
const HANG = {
  guard: { ...GUARDS[3], id: 'hang-check', command: { cwd: '.', run: `${NODE} hang.cjs`, bound_minutes: 1 } },
  script: [
    "const fs = require('node:fs');",
    "if (fs.readFileSync('src/rules/widget.rule.ts', 'utf8').includes('BUG')) process.exit(1);",
    "fs.writeFileSync('planted.pid', String(process.pid));",
    'setTimeout(() => {}, 60000);',
  ].join('\n'),
};

/** What a proof killed mid-plant leaves behind: the planted rule on disk and its journal. */
function leftBehind(root) {
  const sha = (s) => require('node:crypto').createHash('sha256').update(s).digest('hex');
  const original = FILES['src/rules/widget.rule.ts'];
  const planted = original.replace('BUG', 'FIX');
  write(root, { 'src/rules/widget.rule.ts': planted, [JOURNAL]: JSON.stringify([{ file: 'src/rules/widget.rule.ts',
    sha256_original: sha(original), original_base64: Buffer.from(original).toString('base64'), sha256_planted: sha(planted) }]) });
  return original;
}

async function gone(pid) {
  for (let i = 0; i < 100; i++) {
    try { process.kill(pid, 0); } catch { return true; }
    await new Promise((r) => setTimeout(r, 50));
  }
  return false;
}

test('--all runs every guard repo-wide, sorted by id, each with its status and the envelope first', async (t) => {
  const root = repo(t);
  const res = await sweep(root, '--all');
  const { report } = res;
  assert.deepEqual(Object.keys(report), ['schemaVersion', 'kind', 'mode', 'generatedAt', 'tool', 'tree', 'instruments',
    'isolation', 'status', 'timing', 'guards']);
  assert.equal(report.kind, 'sweep');
  assert.equal(report.mode, 'all');
  assert.equal(report.isolation, null);
  assert.deepEqual(report.guards.map((g) => `${g.id} ${g.status}`),
    ['no-todo green', 'rule-check red', 'rule-consumers quiet', 'widget-fields red']);
  assert.deepEqual(Object.keys(entry(res, 'widget-fields')), ['id', 'kind', 'class', 'status', 'reason', 'visited', 'hits', 'consumers']);
  assert.deepEqual(entry(res, 'widget-fields'), {
    id: 'widget-fields', kind: 'shape', class: CLASS, status: 'red', reason: null, visited: 6,
    hits: [{ file: 'src/widgets/update-widget.input.ts', line: 6, text: 'UpdateWidgetInput.color', check: 'undecorated' }],
    consumers: null,
  });
  assert.equal(entry(res, 'no-todo').visited, 7);
  assert.deepEqual(Object.keys(report.timing.guards).sort(), ['no-todo_ms', 'rule-check_ms', 'rule-consumers_ms', 'widget-fields_ms']);
  assert.equal(report.status, 'red');
  assert.equal(res.exitCode, 1);
  assert.equal(res.lines[0],
    'SWEEP red · no-todo green (7 files) · rule-check red (exit 1) · rule-consumers quiet · widget-fields red (1 hit in 1 class)');
  assert.ok(res.lines.includes('widget-fields: src/widgets/update-widget.input.ts:6 UpdateWidgetInput.color (undecorated)'));
});

test('two runs over one tree give byte-identical JSON once the clock-bound fields are removed', async (t) => {
  const root = repo(t, { edits: { 'src/rules/widget.rule.ts': '// BUG: off by one\nexport const widgetLimit = 4;\n' } });
  const scrub = (report) => {
    const r = JSON.parse(JSON.stringify(report));
    delete r.generatedAt;
    delete r.timing;
    for (const g of r.guards) if (g.evidence) for (const k of ['log_sha256', 'head', 'tail']) delete g.evidence[k];
    return `${JSON.stringify(r, null, 2)}\n`;
  };
  const first = (await run({ ...ctxFor(root, ['--all']), now: '2026-01-02T03:04:05Z' })).report;
  const second = (await run({ ...ctxFor(root, ['--all']), now: '2027-06-07T08:09:10Z' })).report;
  assert.notEqual(first.generatedAt, second.generatedAt);
  assert.equal(scrub(first), scrub(second));
});

test('consumers, triggered: import chains, pattern hits, changed_in_diff, and the trigger and excluded files left out', async (t) => {
  // The trigger matches a pattern itself, and the excluded spec both imports it and matches: neither is a consumer.
  const root = repo(t, { edits: {
    'src/rules/widget.rule.ts': '// BUG: off by one\nexport const widgetLimit = 4;\nexport const over = (n: number) => widgetLimit < n;\n',
    'src/widgets/widget.service.ts': `${FILES['src/widgets/widget.service.ts']}// touched\n`,
  } });
  const res = await sweep(root, '--guard', 'rule-consumers');
  const g = entry(res, 'rule-consumers');
  assert.equal(g.status, 'listed');
  assert.equal(g.visited, 5);
  assert.deepEqual(g.hits, []);
  assert.deepEqual(g.consumers, [
    { file: 'src/orders/order.util.ts', via: 'pattern', changed_in_diff: false,
      hits: [{ line: 2, text: 'export const tooMany = (widgetLimit: number) => widgetLimit < orderLimit;' }] },
    { file: 'src/widgets/widget.service.ts', via: 'imports src/widgets/widget.service.ts → src/rules/widget.rule.ts', changed_in_diff: true,
      hits: [{ line: 1, text: "import { widgetLimit } from '../rules/widget.rule';" }, { line: 5, text: 'return widgetLimit < n;' }] },
    { file: 'src/widgets/widget.controller.ts',
      via: 'imports src/widgets/widget.controller.ts → src/widgets/widget.service.ts → src/rules/widget.rule.ts', changed_in_diff: false,
      hits: [{ line: 1, text: "import { WidgetService } from './widget.service';" }] },
  ]);
  assert.equal(res.report.status, 'pass', 'listed never fails the sweep in this increment');
  assert.equal(res.exitCode, 0);
  assert.equal(res.lines[0], 'SWEEP pass · rule-consumers listed (3 files)');
});

test('a deleted trigger still lists every file that imports it, through the now-missing import', async (t) => {
  const root = repo(t);
  fs.rmSync(path.join(root, 'src/rules/widget.rule.ts'));
  const g = entry(await sweep(root, '--guard', 'rule-consumers'), 'rule-consumers');
  assert.equal(g.status, 'listed');
  assert.deepEqual(g.consumers.map((c) => `${c.file} ${c.via} ${c.hits.map((h) => h.line).join(',')}`), [
    'src/orders/order.util.ts pattern 2',
    'src/widgets/widget.service.ts imports src/widgets/widget.service.ts → src/rules/widget.rule.ts 1,5',
    'src/widgets/widget.controller.ts imports src/widgets/widget.controller.ts → src/widgets/widget.service.ts → src/rules/widget.rule.ts 1',
  ]);
});

test('consumers with pattern hits come first, the most hits first, then by file; import-only consumers follow by file', async (t) => {
  const importer = (n) => `import { widgetLimit } from '../rules/widget.rule';\n${'export const f = (n: number) => widgetLimit < n;\n'.repeat(n)}`;
  const root = repo(t, { edits: { 'src/rules/widget.rule.ts': '// BUG: off by one\nexport const widgetLimit = 4;\n',
    'src/a/one.ts': importer(1), 'src/b/three.ts': importer(3), 'src/c/two.ts': importer(2), 'src/c/zero.ts': importer(0) } });
  const res = await sweep(root, '--changed');
  assert.deepEqual(entry(res, 'rule-consumers').consumers.map((c) => c.file), ['src/b/three.ts', 'src/c/two.ts', 'src/a/one.ts',
    'src/orders/order.util.ts', 'src/widgets/widget.service.ts', 'src/c/zero.ts', 'src/widgets/widget.controller.ts']);
  assert.equal(res.lines[1], 'rule-consumers: src/b/three.ts via imports src/b/three.ts → src/rules/widget.rule.ts (changed in diff)');
});

test('hit text and consumer text are redacted, in the report and the summary', async (t) => {
  const guards = [{ id: 'no-secret', kind: 'shape', class: CLASS, shape: { type: 'regex', files: ['src/**'], pattern: 'API_KEY\\s*=.*' } },
    { ...GUARDS[2], consumers: { ...GUARDS[2].consumers, patterns: ['https?://'] } }];
  const root = repo(t, { guards, edits: { 'src/rules/widget.rule.ts': '// BUG: off by one\nexport const widgetLimit = 4;\n',
    'src/pay.ts': "const API_KEY = 'synthetic-secret-5';\nconst url = 'https://widget:synthetic-secret-6@example.test/orders';\n" } });
  const res = await sweep(root, '--all');
  const json = JSON.stringify(res.report);
  assert.doesNotMatch(json, /synthetic-secret-[56]/);
  assert.doesNotMatch(res.lines.join('\n'), /synthetic-secret-[56]/);
  assert.deepEqual(entry(res, 'no-secret').hits.map((h) => h.text), ['<redacted>'], 'a regex hit is its match, redacted');
  assert.deepEqual(entry(res, 'rule-consumers').consumers.find((c) => c.file === 'src/pay.ts').hits,
    [{ line: 2, text: "const url = 'https://widget:<redacted>@example.test/orders';" }]);
});

test('a shape guard that scans no file measured nothing: not-run (vacuous), and the sweep is not-run', async (t) => {
  const moved = [{ ...GUARDS[1], shape: { ...GUARDS[1].shape, files: ['apps/api/src/**'] } }];
  const root = repo(t, { guards: moved });
  const res = await sweep(root, '--all');
  assert.deepEqual([entry(res, 'no-todo').status, entry(res, 'no-todo').reason, entry(res, 'no-todo').visited], ['not-run', 'vacuous', 0]);
  assert.deepEqual([res.report.status, res.exitCode], ['not-run', 4]);
  assert.equal(res.lines[0], 'SWEEP not-run · no-todo not-run (vacuous)');
  const proof = await sweep(repo(t, { guards: [{ ...moved[0], plants: [{ name: 'p', file: 'src/rules/widget.rule.ts', find: 'BUG', replace: 'TODO', expect: 'red' }] }] }), '--prove', 'no-todo');
  assert.deepEqual([proof.report.proof.unplanted, proof.report.proof.proven], ['not-run', false]);
});

test('a sweep with nothing to measure refuses: --all with no guards, --changed with no consumers guard', async (t) => {
  await assert.rejects(sweep(repo(t, { guards: [] }), '--all'), (e) => e.exitCode === 3 && e.message === 'no guards declared at main (.cleancode-gates.json → guards)');
  await assert.rejects(sweep(repo(t, { guards: [] }), '--changed', '--all'), (e) => e.exitCode === 3 && /^no guards declared at main/.test(e.message));
  const shapes = repo(t, { guards: [GUARDS[0], GUARDS[1]] });
  await assert.rejects(sweep(shapes, '--changed'), (e) => e.exitCode === 3 && e.message === 'no consumers guards declared at main (.cleancode-gates.json → guards)');
  assert.equal((await sweep(shapes, '--changed', '--all')).report.guards.length, 2);
  const cli = gates(repo(t, { guards: [] }), '--all');
  assert.deepEqual([cli.status, cli.stderr], [3, 'error: no guards declared at main (.cleancode-gates.json → guards)\n']);
});

test("the measured tree is the one before any guard ran, and the engine's own --out never enters it", (t) => {
  const stamp = { id: 'stamp', kind: 'command', class: CLASS, command: { cwd: '.', run: `${NODE} -e "require('fs').writeFileSync('stamp.txt', String(Date.now()))"`, bound_minutes: 1 } };
  const consumers = { ...GUARDS[2], consumers: { ...GUARDS[2].consumers, trigger: ['**/*.json'], files: ['**/*.ts'] } };
  const root = repo(t, { guards: [stamp, consumers] });
  const head = cp.execFileSync('git', ['-C', root, 'rev-parse', 'HEAD^{tree}'], { env: ENV, encoding: 'utf8' }).trim();
  for (const round of [1, 2]) {
    const r = gates(root, '--all', '--out', 'reports/sweep');
    assert.equal(r.status, 0, r.stderr);
    const report = JSON.parse(fs.readFileSync(path.join(root, 'reports', 'sweep', 'sweep.json'), 'utf8'));
    assert.equal(report.tree.candidateTree, head, `round ${round}: the stamp the guard wrote, and the last report, stay out`);
    assert.equal(entry({ report }, 'rule-consumers').status, 'quiet', `round ${round}: no report counts as a change`);
    assert.ok(fs.existsSync(path.join(root, 'stamp.txt')));
    fs.rmSync(path.join(root, 'stamp.txt'));
  }
});

test('consumers stay quiet when no changed file matches a trigger', async (t) => {
  const root = repo(t, { edits: { 'src/orders/order.util.ts': `${FILES['src/orders/order.util.ts']}// touched\n` } });
  const g = entry(await sweep(root, '--guard', 'rule-consumers'), 'rule-consumers');
  assert.deepEqual([g.status, g.visited, g.consumers], ['quiet', null, []]);
});

test('--changed runs only consumers guards, and --changed --all runs them all', async (t) => {
  const root = repo(t);
  const only = await sweep(root, '--changed');
  assert.equal(only.report.mode, 'changed');
  assert.deepEqual(only.report.guards.map((g) => g.id), ['rule-consumers']);
  const every = await sweep(root, '--changed', '--all');
  assert.equal(every.report.mode, 'changed');
  assert.deepEqual(every.report.guards.map((g) => g.id), ['no-todo', 'rule-check', 'rule-consumers', 'widget-fields']);
});

test('a command guard: exit 0 is green, any other exit red, and a timeout not-run with its survivors counted', async (t) => {
  const command = (id, run, bound = 1) => ({ id, kind: 'command', class: CLASS, command: { cwd: 'src', run, bound_minutes: bound } });
  const root = repo(t, { guards: [command('exits-zero', 'echo widget-ok; pwd'), command('exits-one', 'exit 3'), command('hangs', 'sleep 30', 0.02)] });
  const res = await sweep(root, '--all');
  const ok = entry(res, 'exits-zero');
  assert.deepEqual([ok.status, ok.reason, ok.visited, ok.hits, ok.consumers], ['green', null, null, [], null]);
  assert.deepEqual(Object.keys(ok.evidence), ['exit', 'bound_minutes', 'timed_out', 'survivors', 'log', 'log_sha256', 'head', 'tail']);
  assert.deepEqual(ok.evidence.head, ['widget-ok', path.join(root, 'src')]);
  assert.equal(ok.evidence.log, '.cleancode/logs/sweep-exits-zero.log');
  assert.ok(fs.existsSync(path.join(root, ok.evidence.log)));
  assert.deepEqual([entry(res, 'exits-one').status, entry(res, 'exits-one').evidence.exit], ['red', 3]);
  const hung = entry(res, 'hangs');
  assert.deepEqual([hung.status, hung.reason, hung.evidence.timed_out, hung.evidence.survivors], ['not-run', 'timeout', true, 0]);
  assert.equal(res.report.status, 'red', 'a red guard outranks a not-run one');
  assert.ok(res.lines.includes('timeout: hangs after 0.02m, survivors 0'));
  const alone = await sweep(root, '--guard', 'hangs');
  assert.deepEqual([alone.report.mode, alone.report.status, alone.exitCode], ['guard', 'not-run', 4]);
  assert.equal(alone.lines[0], 'SWEEP not-run · hangs not-run (timeout)');
  const green = await sweep(root, '--guard', 'exits-zero');
  assert.deepEqual([green.report.status, green.exitCode], ['pass', 0]);
});

test('a guard removed in the branch still runs from base, and the removal is a move', async (t) => {
  const root = repo(t, { edits: {
    '.cleancode-gates.json': JSON.stringify({ guards: GUARDS.filter((g) => g.id !== 'no-todo') }),
    'src/orders/order.util.ts': `${FILES['src/orders/order.util.ts']}// TODO widen the limit\n`,
  } });
  const res = await sweep(root, '--guard', 'no-todo');
  assert.deepEqual(res.report.instruments.moves, [{ key: 'guards.no-todo', change: 'removed', direction: 'loosening' }]);
  assert.deepEqual(entry(res, 'no-todo').hits, [{ file: 'src/orders/order.util.ts', line: 3, text: 'TODO', check: 'regex' }]);
  assert.equal(res.report.status, 'red');
});

test('--shape runs an ad hoc shape with no registry: red with hits, pass without, from JSON or @file', async (t) => {
  const root = repo(t);
  const red = await sweep(root, '--shape', JSON.stringify({ type: 'regex', files: ['src/orders/**'], pattern: 'widgetLimit\\s*<' }));
  assert.deepEqual(Object.keys(red.report).slice(-3), ['timing', 'guards', 'shape_result']);
  assert.equal(red.report.mode, 'shape');
  assert.deepEqual(red.report.guards, []);
  assert.deepEqual(red.report.shape_result, { visited: 1,
    hits: [{ file: 'src/orders/order.util.ts', line: 2, text: 'widgetLimit <', check: 'regex' }] });
  assert.deepEqual([red.report.status, red.exitCode], ['red', 1]);
  assert.equal(red.lines[0], 'SWEEP red · shape regex red (1 hit in 1 file)');
  write(root, { 'shape.json': JSON.stringify({ type: 'regex', files: ['src/**'], pattern: 'nothing-matches-this' }) });
  const clean = await sweep(root, '--shape', '@shape.json');
  assert.deepEqual([clean.report.status, clean.exitCode, clean.report.shape_result.visited], ['pass', 0, 7]);
});

test('an ad hoc shape is validated, and a bad one is a usage error', async (t) => {
  const root = repo(t);
  await assert.rejects(sweep(root, '--shape', '{"type":"regex","files":["src/**"]}'), (e) => e.exitCode === 3 && /pattern/.test(e.message));
  await assert.rejects(sweep(root, '--shape', '{not json'), (e) => e.exitCode === 3);
  await assert.rejects(sweep(root, '--shape', '@missing.json'), (e) => e.exitCode === 3);
});

test('hits are capped at 200, with the rest counted in truncated', async (t) => {
  const root = repo(t, { edits: { 'src/notes/many.ts': 'TODO\n'.repeat(250) } });
  const g = entry(await sweep(root, '--guard', 'no-todo'), 'no-todo');
  assert.equal(g.hits.length, 200);
  assert.equal(g.truncated, 50);
  assert.deepEqual(Object.keys(g), ['id', 'kind', 'class', 'status', 'reason', 'visited', 'hits', 'truncated', 'consumers']);
});

test('--prove on shape plants: unplanted green, both kinds red, proven in memory', async (t) => {
  const root = repo(t, { edits: { 'src/widgets/update-widget.input.ts': FILES['src/widgets/update-widget.input.ts']
    .replace("import { Field, InputType } from '@nestjs/graphql';", "import { Field, InputType } from '@nestjs/graphql';\nimport { IsString } from 'class-validator';")
    .replace('  color: string;', '  @IsString()\n  color: string;') } });
  const before = fs.readFileSync(path.join(root, 'src/widgets/create-widget.input.ts'));
  const res = await sweep(root, '--prove', 'widget-fields');
  assert.deepEqual(Object.keys(res.report).slice(-3), ['timing', 'guards', 'proof']);
  assert.deepEqual(res.report.proof, { guard: 'widget-fields', unplanted: 'green',
    plants: [{ name: 'optional made required', expect: 'red', got: 'red', ok: true }, { name: 'undecorated field', expect: 'red', got: 'red', ok: true }],
    proven: true });
  assert.deepEqual(res.report.guards.map((g) => `${g.id} ${g.status}`), ['widget-fields green']);
  assert.deepEqual([res.report.mode, res.report.status, res.exitCode], ['prove', 'pass', 0]);
  assert.deepEqual(fs.readFileSync(path.join(root, 'src/widgets/create-widget.input.ts')), before);
  assert.equal(res.lines[0], 'SWEEP pass · widget-fields green (6 files) · proof proven (unplanted green, 2/2 plants ok)');
});

test('--prove on a red command guard with a green fix plant: planted on disk, proven, restored byte for byte', async (t) => {
  const root = repo(t);
  const rule = path.join(root, 'src/rules/widget.rule.ts');
  const before = fs.readFileSync(rule);
  const res = await sweep(root, '--prove', 'rule-check');
  assert.deepEqual(res.report.proof, { guard: 'rule-check', unplanted: 'red',
    plants: [{ name: 'the fix', expect: 'green', got: 'green', ok: true }], proven: true });
  assert.deepEqual([res.report.status, res.exitCode], ['pass', 0]);
  assert.deepEqual(fs.readFileSync(rule), before);
  assert.equal(fs.existsSync(path.join(root, '.cleancode', 'plant-journal.json')), false);
  assert.ok(fs.existsSync(path.join(root, '.cleancode', 'logs', 'sweep-rule-check.plant1.log')));
});

test('--prove does not prove a guard that is red with or without its plant', async (t) => {
  const always = { ...GUARDS[3], id: 'always-red', command: { cwd: '.', run: 'exit 1', bound_minutes: 1 },
    plants: [{ name: 'anything', file: 'src/rules/widget.rule.ts', find: 'BUG', replace: 'FIX', expect: 'red' }] };
  const root = repo(t, { guards: [always] });
  const res = await sweep(root, '--prove', 'always-red');
  assert.deepEqual(res.report.proof.plants, [{ name: 'anything', expect: 'red', got: 'red', ok: false }]);
  assert.deepEqual([res.report.proof.proven, res.report.status, res.exitCode], [false, 'red', 1]);
});

test('every sweep first restores a plant left on disk by a killed proof, and warns', async (t) => {
  const root = repo(t);
  const original = leftBehind(root);
  const res = gates(root, '--guard', 'no-todo');
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stderr, 'warning: restored src/rules/widget.rule.ts: a planted-offender proof was interrupted\n');
  assert.equal(fs.readFileSync(path.join(root, 'src/rules/widget.rule.ts'), 'utf8'), original);
  assert.equal(fs.existsSync(path.join(root, '.cleancode', 'plant-journal.json')), false);
});

test('a working config the branch broke is ignored: the base guards run, and a warning and a moved line say so', (t) => {
  const root = repo(t, { edits: { '.cleancode-gates.json': '{ "guards": 3 }\n' } });
  const res = gates(root, '--all');
  assert.equal(res.status, 1, res.stderr);
  assert.match(res.stdout, /^SWEEP red · no-todo green \(7 files\) · rule-check red \(exit 1\) · rule-consumers quiet · widget-fields red/);
  assert.equal(res.stderr, "warning: .cleancode-gates.json in the working tree is invalid (guards: must be an array); its additions are ignored, "
    + "and the base's instruments run\nINSTRUMENT MOVED — config invalid (changed) — measured against merge-base (main) values\n");
});

test('through the CLI: report file, summary, exit by status, the moved guard and the restored plant on stderr', async (t) => {
  const crypto = require('node:crypto');
  const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');
  const original = FILES['src/rules/widget.rule.ts'];
  const planted = original.replace('BUG', 'FIX');
  const root = repo(t, { edits: {
    '.cleancode-gates.json': JSON.stringify({ guards: GUARDS.filter((g) => g.id !== 'no-todo') }),
    'src/orders/order.util.ts': `${FILES['src/orders/order.util.ts']}// TODO widen the limit\n`,
    'src/rules/widget.rule.ts': planted,
    '.cleancode/plant-journal.json': JSON.stringify([{ file: 'src/rules/widget.rule.ts', sha256_original: sha(original),
      original_base64: Buffer.from(original).toString('base64'), sha256_planted: sha(planted) }]),
  } });
  const bin = path.join(__dirname, '..', 'bin', 'gates.cjs');
  const cli = (...args) => cp.spawnSync(process.execPath, [bin, 'sweep', ...args], { cwd: root, env: ENV, encoding: 'utf8' });
  const red = cli('--guard', 'no-todo', '--now', '2026-01-02T03:04:05Z');
  assert.equal(red.status, 1, red.stderr);
  const out = red.stdout.trimEnd().split('\n');
  assert.equal(out[0], 'SWEEP red · no-todo red (1 hit in 1 file)');
  assert.equal(out.at(-1), `report → ${path.join(root, '.cleancode', 'sweep.json')}`);
  const report = JSON.parse(fs.readFileSync(path.join(root, '.cleancode', 'sweep.json'), 'utf8'));
  assert.deepEqual([report.kind, report.mode, report.status, report.generatedAt], ['sweep', 'guard', 'red', '2026-01-02T03:04:05Z']);
  assert.match(red.stderr, /^warning: restored src\/rules\/widget\.rule\.ts/m);
  assert.match(red.stderr, /^INSTRUMENT MOVED — guards\.no-todo removed \(loosening\) — measured against merge-base \(main\) values$/m);
  assert.equal(fs.readFileSync(path.join(root, 'src/rules/widget.rule.ts'), 'utf8'), original);
  const bad = cli('--all', '--prove', 'rule-check');
  assert.equal(bad.status, 3);
  assert.match(bad.stderr, /sweep takes one of/);
});

test('SIGTERM to the CLI mid-proof: the runner stops the planted run, and the file comes back byte for byte', async (t) => {
  const hang = { ...GUARDS[3], id: 'hang-check', command: { cwd: '.', run: `${NODE} hang.cjs`, bound_minutes: 1 } };
  const root = repo(t, { guards: [hang], files: { ...FILES, 'hang.cjs': [
    "const fs = require('node:fs');",
    "if (fs.readFileSync('src/rules/widget.rule.ts', 'utf8').includes('BUG')) process.exit(1);",
    "fs.writeFileSync('planted.pid', String(process.pid));",
    'setTimeout(() => {}, 60000);',
  ].join('\n') } });
  const rule = path.join(root, 'src/rules/widget.rule.ts');
  const before = fs.readFileSync(rule);
  const child = cp.spawn(process.execPath, [path.join(__dirname, '..', 'bin', 'gates.cjs'), 'sweep', '--prove', 'hang-check'],
    { cwd: root, env: ENV, stdio: 'ignore' });
  t.after(() => child.kill('SIGKILL'));
  const exited = new Promise((r) => child.on('exit', (code, signal) => r({ code, signal })));
  const pidFile = path.join(root, 'planted.pid');
  for (let i = 0; i < 400 && !fs.existsSync(pidFile); i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(fs.existsSync(pidFile), 'the planted run never started');
  assert.equal(fs.readFileSync(rule, 'utf8'), before.toString().replace('BUG', 'FIX'));
  child.kill('SIGTERM');
  const { code, signal } = await exited;
  assert.ok(signal === 'SIGTERM' || code !== 0, `the CLI must not report success (code ${code}, signal ${signal})`);
  assert.deepEqual(fs.readFileSync(rule), before);
  assert.equal(fs.existsSync(path.join(root, '.cleancode', 'plant-journal.json')), false);
  const pid = Number(fs.readFileSync(pidFile, 'utf8'));
  let alive = true;
  for (let i = 0; i < 60 && alive; i++) {
    try { process.kill(pid, 0); await new Promise((r) => setTimeout(r, 50)); } catch { alive = false; }
  }
  assert.equal(alive, false, 'the planted command outlived the proof');
});

test('a proof killed with SIGKILL leaves its plant on disk, and the next invocation puts it back and says so', async (t) => {
  const root = repo(t, { guards: [HANG.guard], files: { ...FILES, 'hang.cjs': HANG.script } });
  const rule = path.join(root, 'src/rules/widget.rule.ts');
  const before = fs.readFileSync(rule);
  const child = cp.spawn(process.execPath, [BIN, 'sweep', '--prove', 'hang-check'], { cwd: root, env: ENV, stdio: 'ignore' });
  const exited = new Promise((r) => child.on('exit', (code, signal) => r({ code, signal })));
  const pidFile = path.join(root, 'planted.pid');
  t.after(() => { try { process.kill(Number(fs.readFileSync(pidFile, 'utf8')), 'SIGKILL'); } catch { /* already gone */ } });
  for (let i = 0; i < 400 && !fs.existsSync(pidFile); i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(fs.existsSync(pidFile), 'the planted run never started');
  child.kill('SIGKILL');
  assert.equal((await exited).signal, 'SIGKILL');
  assert.equal(fs.readFileSync(rule, 'utf8'), before.toString().replace('BUG', 'FIX'), 'nothing can restore on SIGKILL');
  assert.ok(fs.existsSync(path.join(root, JOURNAL)));
  assert.ok(await gone(Number(fs.readFileSync(pidFile, 'utf8'))), 'the planted command outlived its killed proof');
  const next = gates(root, '--guard', 'hang-check');
  assert.equal(next.status, 1, `the guard ran on the restored rule: ${next.stderr}`);
  assert.match(next.stderr, /^warning: restored src\/rules\/widget\.rule\.ts: a planted-offender proof was interrupted$/m);
  assert.deepEqual(fs.readFileSync(rule), before);
  assert.equal(fs.existsSync(path.join(root, JOURNAL)), false);
});

test('an invocation that stops on a usage error still restores a left-behind plant first, and warns', async (t) => {
  const root = repo(t);
  const original = leftBehind(root);
  const res = gates(root, '--bogus');
  assert.equal(res.status, 3);
  assert.match(res.stderr, /unknown flag or missing value: --bogus/);
  assert.match(res.stderr, /^warning: restored src\/rules\/widget\.rule\.ts/m);
  assert.equal(fs.readFileSync(path.join(root, 'src/rules/widget.rule.ts'), 'utf8'), original);
  assert.equal(fs.existsSync(path.join(root, JOURNAL)), false);
  leftBehind(root);
  const nope = gates(root, '--guard', 'nope');
  assert.equal(nope.status, 3);
  assert.match(nope.stderr, /^warning: restored src\/rules\/widget\.rule\.ts[^]*^error: sweep: no guard "nope"/m, 'the restore comes first');
  assert.equal(fs.readFileSync(path.join(root, 'src/rules/widget.rule.ts'), 'utf8'), original);
});

// §7.5.3 says every sweep invocation: the CLI refuses these before the kind ever runs.
test('a sweep the CLI refuses first (a bad common flag, a base that does not resolve, an invalid registry) still restores the plant', (t) => {
  const root = repo(t);
  const cases = [[['--now', 'soon', '--all'], /--now/], [['--base', 'no-such-ref', '--all'], /no-such-ref/],
    [['--all', '--instruments-from', 'file:bad.json'], /guards: must be an array/, { 'bad.json': '{ "guards": 3 }\n' }]];
  for (const [args, refusal, edits = {}] of cases) {
    const original = leftBehind(root);
    write(root, edits);
    const res = gates(root, ...args);
    assert.equal(res.status, 3, res.stderr);
    assert.match(res.stderr, refusal);
    assert.match(res.stderr, /^warning: restored src\/rules\/widget\.rule\.ts: a planted-offender proof was interrupted$/m, args.join(' '));
    assert.equal(fs.readFileSync(path.join(root, 'src/rules/widget.rule.ts'), 'utf8'), original, args.join(' '));
    assert.equal(fs.existsSync(path.join(root, JOURNAL)), false, args.join(' '));
  }
});

test('usage errors exit 3: no mode, two modes, a missing value, an unknown flag or guard, an invalid plant', async (t) => {
  const root = repo(t, { edits: { 'src/rules/widget.rule.ts': '// BUG BUG\nexport const widgetLimit = 3;\n' } });
  for (const args of [[], ['--all', '--guard', 'no-todo'], ['--guard', 'no-todo', '--prove', 'no-todo'], ['--prove'],
    ['--bogus'], ['--guard', 'nope'], ['--prove', 'nope'], ['--prove', 'rule-check']]) {
    await assert.rejects(sweep(root, ...args), (e) => e.exitCode === 3, `sweep ${args.join(' ')} must be a usage error`);
  }
  assert.equal(fs.readFileSync(path.join(root, 'src/rules/widget.rule.ts'), 'utf8'), '// BUG BUG\nexport const widgetLimit = 3;\n');
});

test('every mode writes a report its schema accepts', async (t) => {
  const { validate } = require('./helpers/schema-validate.cjs');
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schema', 'sweep.schema.json'), 'utf8'));
  const root = repo(t, { edits: { 'src/rules/widget.rule.ts': '// BUG: off by one\nexport const widgetLimit = 4;\n' } });
  for (const args of [['--all'], ['--prove', 'rule-check'], ['--shape', '{"type":"regex","files":["src/**"],"pattern":"TODO"}']]) {
    const { report } = await sweep(root, ...args);
    assert.deepEqual(validate(schema, report), [], `sweep ${args.join(' ')}`);
    const broken = { ...report };
    delete broken.status;
    assert.notDeepEqual(validate(schema, broken), [], 'a report without status is rejected');
  }
});
