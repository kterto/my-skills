'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ignoreDesktopLitter } = require('./helpers/git-fixture.cjs');
const { validate } = require('./helpers/schema-validate.cjs');

const { run, selectTests, selectFlows } = require('../src/instruments/select.cjs');
const { controllerRoutes, callSites, matchRoute } = require('../src/instruments/routes.cjs');

const BIN = path.join(__dirname, '..', 'bin', 'gates.cjs');
const GIT_ENV = {
  ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@t.t', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@t.t',
};
// §0.11: a child that inherits NODE_TEST_CONTEXT from `node --test` would run as a silent nested runner.
delete GIT_ENV.NODE_TEST_CONTEXT;

function write(root, files) {
  for (const [rel, text] of Object.entries(files)) {
    const abs = path.join(root, rel);
    if (text === null) { fs.rmSync(abs); continue; }
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, text);
  }
}

/** A repo whose first commit is `base` and whose second applies `change` (null deletes a file). */
function repo(t, base, change) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-select-')));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5 }));
  const git = (...args) => cp.execFileSync('git', ['-C', root, ...args], { env: GIT_ENV, encoding: 'utf8' }).trim();
  git('init', '-q', '--template=');
  git('config', 'commit.gpgsign', 'false');
  ignoreDesktopLitter(root);
  write(root, base);
  git('add', '-A');
  git('commit', '-qm', 'base');
  const baseSha = git('rev-parse', 'HEAD');
  write(root, change);
  git('add', '-A');
  git('commit', '-qm', 'change');
  return { root, baseSha };
}

function ctxFor({ root, baseSha }, args, instruments = {}) {
  return {
    root, args, base: { ref: baseSha, sha: baseSha },
    instruments: { source: 'defaults', from: null, digest: '0'.repeat(64), moves: [], barrier: null, guards: [], live: null, ...instruments },
    outDir: path.join(root, '.cleancode'), now: '2026-01-02T03:04:05Z', version: '0.0.0', env: {}, io: {},
  };
}

const lines = (...l) => l.join('\n') + '\n';

// ── A Dart workspace: two packages, tests that import lib code through package: URIs ──

const DART = {
  'pkgs/core/pubspec.yaml': 'name: widget_core\n',
  'pkgs/core/lib/order.dart': 'class Order {}\n',
  'pkgs/app/pubspec.yaml': 'name: widget_app\n',
  'pkgs/app/lib/src/widget.dart': lines("import 'package:widget_core/order.dart';", 'class Widget {}'),
  'pkgs/app/lib/src/note.dart': 'class Note {}\n',
  'pkgs/app/test/widget_test.dart': lines("import 'package:widget_app/src/widget.dart';", "import 'support/harness.dart';"),
  'pkgs/app/test/note_test.dart': lines("import 'package:widget_app/src/note.dart';", "import 'support/harness.dart';"),
  'pkgs/app/test/plain_test.dart': lines("import 'package:widget_app/src/note.dart';"),
  'pkgs/app/test/support/harness.dart': 'void pump() {}\n',
};
const DART_SELECT = { tests: ['pkgs/app/test/**/*_test.dart'], sources: ['pkgs/**/lib/**/*.dart'], by: ['imports'] };

function dartSelect(t, change) {
  const r = repo(t, DART, change);
  const changed = Object.keys(change);
  return selectTests(r.root, { changed, ...DART_SELECT });
}

test('imports: a changed lib file selects exactly the tests that reach it, across packages', (t) => {
  const s = dartSelect(t, { 'pkgs/core/lib/order.dart': 'class Order { int n = 1; }\n' });
  assert.deepEqual(s.selected, [{ file: 'pkgs/app/test/widget_test.dart', reasons: [
    'imports pkgs/app/test/widget_test.dart:1 → pkgs/app/lib/src/widget.dart → pkgs/core/lib/order.dart (changed)'] }]);
  assert.equal(s.tests_total, 3);
  assert.equal(s.size, 1);
});

test('imports: an edited test selects itself', (t) => {
  const s = dartSelect(t, { 'pkgs/app/test/note_test.dart': lines("import 'package:widget_app/src/note.dart';", '// edited') });
  assert.deepEqual(s.selected, [{ file: 'pkgs/app/test/note_test.dart', reasons: ['changed pkgs/app/test/note_test.dart'] }]);
});

test('imports: an edited support harness selects the tests that import it', (t) => {
  const s = dartSelect(t, { 'pkgs/app/test/support/harness.dart': 'void pump() { pump(); }\n' });
  assert.deepEqual(s.selected.map(x => x.file), ['pkgs/app/test/note_test.dart', 'pkgs/app/test/widget_test.dart']);
  assert.deepEqual(s.selected[1].reasons, ['imports pkgs/app/test/widget_test.dart:2 → pkgs/app/test/support/harness.dart (changed)']);
});

test('imports: unresolved counts what the tests reach; a dangling import in a file no test reaches does not count', (t) => {
  const s = dartSelect(t, {
    'pkgs/app/test/support/harness.dart': "import 'gone.dart';\nvoid pump() {}\n",
    'pkgs/app/lib/src/orphan.dart': "import 'nowhere.dart';\n",
  });
  assert.equal(s.unresolved, 1);
});

test('whole_on: a changed file matching it selects every test; a changed file nothing maps is listed unmapped', (t) => {
  const r = repo(t, DART, { 'pkgs/app/pubspec.yaml': 'name: widget_app\nversion: 2.0.0\n', 'pkgs/app/README.md': 'notes\n',
    'pkgs/core/data.json': '{}\n', 'pkgs/app/test/support/data.json': '{}\n' });
  const changed = ['pkgs/app/README.md', 'pkgs/app/pubspec.yaml', 'pkgs/app/test/support/data.json', 'pkgs/core/data.json'];
  const plain = selectTests(r.root, { changed, ...DART_SELECT, sources: [...DART_SELECT.sources, 'pkgs/app/test/**/*.json'] });
  assert.deepEqual([plain.size, plain.whole], [0, false]);
  assert.deepEqual(plain.unmapped, ['pkgs/app/README.md', 'pkgs/app/pubspec.yaml', 'pkgs/core/data.json'],
    'neither a graph node nor matched by tests, sources or whole_on');
  const whole = selectTests(r.root, { changed, ...DART_SELECT, whole_on: ['pkgs/app/pubspec.yaml', '**/flutter_test_config.dart'], cwd: 'pkgs/app' });
  assert.equal(whole.whole, true);
  assert.deepEqual(whole.selected.map((x) => x.file), ['pkgs/app/test/note_test.dart', 'pkgs/app/test/plain_test.dart', 'pkgs/app/test/widget_test.dart']);
  assert.deepEqual(whole.selected[0].reasons, ['whole_on pkgs/app/pubspec.yaml']);
  assert.deepEqual(whole.unmapped, ['pkgs/app/README.md', 'pkgs/app/test/support/data.json'], 'only under the tier cwd');
});

test('whole_on and unmapped reach select --tier: the report carries them and the summary counts the unmapped', async (t) => {
  const r = repo(t, DART, { 'pkgs/app/pubspec.yaml': 'name: widget_app\nversion: 2.0.0\n', 'pkgs/app/CHANGELOG.md': 'v2\n' });
  const tier = (whole_on) => ({ id: 'app', cwd: 'pkgs/app', scope: 'change-selected', whole_run: 'nightly',
    select: { ...DART_SELECT, ...(whole_on ? { whole_on } : {}) } });
  const plain = await run(ctxFor(r, ['--tier', 'app'], { barrier: { on_timeout: 'not-done', tiers: [tier(null)] } }));
  assert.deepEqual([plain.report.selection.whole, plain.report.selection.unmapped], [false, ['pkgs/app/CHANGELOG.md', 'pkgs/app/pubspec.yaml']]);
  assert.equal(plain.lines[0], 'SELECT pass · 0/3 selected · by imports · 0 unresolved · unmapped: 2');
  const whole = await run(ctxFor(r, ['--tier', 'app'], { barrier: { on_timeout: 'not-done', tiers: [tier(['**/pubspec.yaml'])] } }));
  assert.deepEqual([whole.report.selection.whole, whole.report.selection.size, whole.report.selection.unmapped], [true, 3, ['pkgs/app/CHANGELOG.md']]);
  assert.equal(whole.lines[1], 'pkgs/app/test/note_test.dart: whole_on **/pubspec.yaml');
});

test('imports: a deleted lib file selects the tests that still import it', (t) => {
  const s = dartSelect(t, { 'pkgs/app/lib/src/note.dart': null });
  assert.deepEqual(s.selected.map(x => x.file), ['pkgs/app/test/note_test.dart', 'pkgs/app/test/plain_test.dart']);
  assert.match(s.selected[1].reasons[0], /→ pkgs\/app\/lib\/src\/note\.dart \(deleted\)$/);
});

// ── A NestJS-shaped API: every spec boots the app module; only the widgets route chain changes ──

const NEST = {
  'api/tsconfig.json': '{ "compilerOptions": { "baseUrl": "./", "paths": { "@/*": ["./src/*"], }, }, }\n',
  'api/src/app.module.ts': lines(
    "import { Module } from '@nestjs/common';",
    "import { WidgetsModule } from './widgets/widgets.module';",
    "import { OrdersModule } from './orders/orders.module';",
    '@Module({ imports: [WidgetsModule, OrdersModule] })',
    'export class AppModule {}'),
  'api/src/widgets/widgets.module.ts': lines(
    "import { Module } from '@nestjs/common';",
    "import { WidgetsController } from './widgets.controller';",
    "import { WidgetsService } from './widgets.service';",
    "import { WidgetsRepository } from './widgets.repository';",
    '@Module({ controllers: [WidgetsController], providers: [WidgetsService, WidgetsRepository] })',
    'export class WidgetsModule {}'),
  'api/src/widgets/widgets.controller.ts': lines(
    "import { Controller, Get, Patch } from '@nestjs/common';",
    "import { WidgetsService } from './widgets.service';",
    "@Controller('widgets')",
    'export class WidgetsController {',
    '  constructor(private readonly widgets: WidgetsService) {}',
    '  @Get()',
    '  list() { return this.widgets.list(); }',
    "  @Get(':id')",
    '  one() { return null; }',
    "  @Patch(':id')",
    '  update() { return this.widgets.update(); }',
    '}'),
  'api/src/widgets/widgets.service.ts': lines(
    "import { WidgetsRepository } from '@/widgets/widgets.repository';",
    'export class WidgetsService { constructor(private readonly repo: WidgetsRepository) {} list() { return []; } update() { return this.repo.update(); } }'),
  'api/src/widgets/widgets.repository.ts': 'export class WidgetsRepository { update() { return 1; } }\n',
  'api/src/orders/orders.module.ts': lines(
    "import { Module } from '@nestjs/common';",
    "import { OrdersController } from './orders.controller';",
    "import { OrdersService } from './orders.service';",
    '@Module({ controllers: [OrdersController], providers: [OrdersService] })',
    'export class OrdersModule {}'),
  'api/src/orders/orders.controller.ts': lines(
    "import { Controller, Get, Post } from '@nestjs/common';",
    "import { OrdersService } from './orders.service';",
    "@Controller({ path: 'orders' })",
    'export class OrdersController {',
    '  constructor(private readonly orders: OrdersService) {}',
    '  @Get()',
    '  list() { return this.orders.list(); }',
    '  @Post()',
    '  create() { return this.orders.list(); }',
    '}'),
  'api/src/orders/orders.service.ts': 'export class OrdersService { list() { return []; } }\n',
  'api/test/widgets-patch.e2e-spec.ts': lines(
    "import { AppModule } from '../src/app.module';",
    "const id = 'w-1';",
    "it('updates a widget', () => request(app.getHttpServer())",
    '  .patch(`/widgets/${id}`)',
    "  .send({ name: 'n' }));"),
  'api/test/orders.e2e-spec.ts': lines(
    "import { AppModule } from '../src/app.module';",
    "it('lists orders', () => request(app.getHttpServer()).get('/orders'));",
    "it('creates an order', () => request(app.getHttpServer())",
    '  .post(',
    "    '/orders'));"),
  'api/test/widgets-base.e2e-spec.ts': lines(
    "import { AppModule } from '../src/app.module';",
    "const BASE = '/widgets';",
    "it('renames through the base path', () => request(app.getHttpServer()).patch(`${BASE}/${id}`));"),
  'api/test/widgets-query.e2e-spec.ts': lines(
    "import { AppModule } from '../src/app.module';",
    "it('pages widgets', () => request(app.getHttpServer()).get('/widgets?limit=10#top'));"),
  'api/test/orders-dynamic.e2e-spec.ts': lines(
    "import { AppModule } from '../src/app.module';",
    'const fetchOrders = (base: string) => request(app.getHttpServer()).get(`${base}/orders`);',
    "import { seedOrders } from './support/absent';"),
  'api/scripts/seed.ts': "import './gone';\n",
};
const REPO_CHANGE = { 'api/src/widgets/widgets.repository.ts': 'export class WidgetsRepository { update() { return 2; } }\n' };
const NEST_ARGS = ['--tests', 'api/test/**/*.e2e-spec.ts', '--sources', 'api/src/**/*.ts', '--by', 'routes'];
const CHAIN = 'api/src/widgets/widgets.service.ts → api/src/widgets/widgets.repository.ts (changed)';
const PATCH_ROUTE = `route PATCH /widgets/:id (api/src/widgets/widgets.controller.ts:10) → ${CHAIN}`;
const LIST_ROUTE = `route GET /widgets (api/src/widgets/widgets.controller.ts:6) → ${CHAIN}`;

test('routes: specs are selected by the changed route they call, and only those', async (t) => {
  const { report, exitCode, lines: out } = await run(ctxFor(repo(t, NEST, REPO_CHANGE), NEST_ARGS));
  const byFile = Object.fromEntries(report.selection.selected.map(s => [s.file, s.reasons]));
  assert.deepEqual(byFile['api/test/widgets-patch.e2e-spec.ts'], [`${PATCH_ROUTE} · called at api/test/widgets-patch.e2e-spec.ts:4`]);
  assert.ok(!('api/test/orders.e2e-spec.ts' in byFile), 'a spec calling only /orders is excluded');
  assert.ok(!('api/test/orders-dynamic.e2e-spec.ts' in byFile));
  assert.ok(byFile['api/test/widgets-base.e2e-spec.ts'].includes(`${PATCH_ROUTE} · called at api/test/widgets-base.e2e-spec.ts:3`),
    'a ${BASE} constant is resolved');
  assert.deepEqual(byFile['api/test/widgets-query.e2e-spec.ts'], [`${LIST_ROUTE} · called at api/test/widgets-query.e2e-spec.ts:2`],
    'the query string and fragment are stripped');
  assert.equal(report.selection.unresolved, 2,
    'the ${base} template, plus the tests\' own dangling import; a script no test reaches does not count');
  assert.deepEqual(report.changed, ['api/src/widgets/widgets.repository.ts']);
  assert.equal(report.status, 'pass');
  assert.equal(exitCode, 0);
  assert.equal(out[0], 'SELECT pass · 3/5 selected · by routes · 2 unresolved');
});

test('routes: every route reason is kept, by method then path, then at most three others; the selection is sorted by file', async (t) => {
  const verbs = [['Put', 'a'], ['Get', 'b-c'], ['Get', 'b/c'], ['Delete', 'd'], ['Get', 'b'], ['Post', 'e'], ['Get', 'f'], ['Get', 'g'], ['Get', 'h']];
  const calls = (n) => verbs.slice(0, n).map(([m, x]) => `request(app).${m.toLowerCase()}('/notes/${x}');`);
  const svc = {
    'svc/src/notes.controller.ts': lines("@Controller('notes')", 'export class NotesController {',
      ...verbs.map(([m, x]) => `  @${m}('${x}') h${x.replace(/\W/g, '')}() {}`), '}'),
    'svc/src/clock.ts': 'export const now = 1;\n',
    'svc/test/notes.e2e-spec.ts': lines("import { now } from '../src/clock';", ...calls(6)),
    'svc/test/many.e2e-spec.ts': lines(...calls(9)),
    'svc/test/zzz.e2e-spec.ts': 'const n = 1;\n',
  };
  const change = { 'svc/src/notes.controller.ts': svc['svc/src/notes.controller.ts'] + '// touched\n', 'svc/src/clock.ts': 'export const now = 2;\n',
    'svc/test/notes.e2e-spec.ts': svc['svc/test/notes.e2e-spec.ts'] + '// edited\n', 'svc/test/zzz.e2e-spec.ts': 'const n = 2;\n' };
  const { report } = await run(ctxFor(repo(t, svc, change), ['--tests', 'svc/test/**/*.e2e-spec.ts', '--sources', 'svc/src/**/*.ts', '--by', 'routes,imports']));
  assert.deepEqual(report.selection.selected.map(s => s.file), ['svc/test/many.e2e-spec.ts', 'svc/test/notes.e2e-spec.ts', 'svc/test/zzz.e2e-spec.ts']);
  const at = (spec, offset) => (m, x) => `route ${m.toUpperCase()} /notes/${x} (svc/src/notes.controller.ts:${verbs.findIndex(v => v[1] === x) + 3}) (changed) · called at svc/test/${spec}.e2e-spec.ts:${verbs.findIndex(v => v[1] === x) + offset}`;
  const notes = at('notes', 2);
  assert.deepEqual(report.selection.selected[1].reasons, [
    notes('Delete', 'd'), notes('Get', 'b'), notes('Get', 'b-c'), notes('Get', 'b/c'), notes('Post', 'e'), notes('Put', 'a'),
    'changed svc/test/notes.e2e-spec.ts',
  ], 'all six route reasons survive, ahead of the others');
  const many = at('many', 1);
  assert.deepEqual(report.selection.selected[0].reasons, [many('Delete', 'd'), many('Get', 'b'), many('Get', 'b-c'), many('Get', 'b/c'),
    many('Get', 'f'), many('Get', 'g'), many('Get', 'h'), many('Post', 'e'), many('Put', 'a')], 'every route a test calls through the change stays: capping them hid the one that failed');
});

test('routes: a changed feature module selects every test that reaches it', async (t) => {
  const change = { 'api/src/widgets/widgets.module.ts': NEST['api/src/widgets/widgets.module.ts'] + '// rewired\n' };
  const { report } = await run(ctxFor(repo(t, NEST, change), NEST_ARGS));
  assert.equal(report.selection.size, 5);
  assert.deepEqual(report.selection.selected[0], { file: 'api/test/orders-dynamic.e2e-spec.ts', reasons: [
    'imports api/test/orders-dynamic.e2e-spec.ts:1 → api/src/app.module.ts → api/src/widgets/widgets.module.ts (changed)'] });
});

// The controller as the base had it: a branch that removes, re-verbs or re-prefixes an endpoint still selects its callers.
const CONTROLLER = 'api/src/widgets/widgets.controller.ts';
const controllerWith = (...decorators) => lines("import { Controller, Get, Patch, Put } from '@nestjs/common';",
  ...decorators.flatMap((d, i) => (i ? [`  ${d}`, `  h${i}() {}`] : [d, 'export class WidgetsController {'])), '}');

test('routes: a removed, re-verbed or re-prefixed endpoint still selects the specs that call it, by its base route', async (t) => {
  const patch = (spec) => (s) => s.file === spec;
  const cases = [
    ['removed', controllerWith("@Controller('widgets')", '@Get()', "@Get(':id')"), 'api/test/widgets-patch.e2e-spec.ts'],
    ['re-verbed', controllerWith("@Controller('widgets')", '@Get()', "@Get(':id')", "@Put(':id')"), 'api/test/widgets-patch.e2e-spec.ts'],
    ['re-prefixed', controllerWith("@Controller('gadgets')", '@Get()', "@Get(':id')", "@Patch(':id')"), 'api/test/widgets-query.e2e-spec.ts'],
  ];
  for (const [label, text, spec] of cases) {
    const { report } = await run(ctxFor(repo(t, NEST, { [CONTROLLER]: text }), NEST_ARGS));
    const hit = report.selection.selected.find(patch(spec));
    assert.ok(hit, `${label}: ${JSON.stringify(report.selection.selected)}`);
    assert.match(hit.reasons[0], new RegExp(`^route (PATCH /widgets/:id|GET /widgets) \\(${CONTROLLER}:\\d+ at base\\) \\(changed\\) · called at ${spec}:\\d+$`), label);
  }
  const deleted = await run(ctxFor(repo(t, NEST, { [CONTROLLER]: null }), NEST_ARGS));
  assert.match(deleted.report.selection.selected.find(patch('api/test/widgets-patch.e2e-spec.ts')).reasons[0],
    /^route PATCH \/widgets\/:id \(api\/src\/widgets\/widgets\.controller\.ts:10 at base\) \(deleted\) · called at /);
});

test('routes: a provider only its unchanged module wires falls back to that module, and selects the tests that reach it', async (t) => {
  const store = 'api/src/widgets/widgets.store.ts';
  const wired = { ...NEST, [store]: 'export class WidgetsStore {}\n',
    'api/src/widgets/widgets.module.ts': NEST['api/src/widgets/widgets.module.ts'].replace("import { Module } from '@nestjs/common';\n",
      "import { Module } from '@nestjs/common';\nimport { WidgetsStore } from './widgets.store';\n") };
  const { report } = await run(ctxFor(repo(t, wired, { [store]: 'export class WidgetsStore { ready = true; }\n' }), NEST_ARGS));
  assert.equal(report.selection.size, 5);
  assert.deepEqual(report.selection.selected[0].reasons, [`wired by api/src/widgets/widgets.module.ts → ${store} (changed)`]);
  const reached = await run(ctxFor(repo(t, NEST, REPO_CHANGE), NEST_ARGS));
  assert.equal(reached.report.selection.size, 3, 'a change a controller reaches is not widened');
});

test('routes: an unchanged module still blocks the walk, so imports alone would select everything', async (t) => {
  const r = repo(t, NEST, REPO_CHANGE);
  const routes = await run(ctxFor(r, NEST_ARGS));
  const imports = await run(ctxFor(r, NEST_ARGS.slice(0, -2)));
  const both = await run(ctxFor(r, [...NEST_ARGS.slice(0, -2), '--by', 'routes,imports']));
  assert.equal(routes.report.selection.size, 3);
  assert.equal(imports.report.selection.size, 5);
  assert.deepEqual(imports.report.selection.by, ['imports']);
  assert.deepEqual(both.report.selection.by, ['imports', 'routes']);
});

// ── Limits and inputs ──

test('--max exceeded is status red, exit 1; a selection at the max passes', async (t) => {
  const r = repo(t, NEST, REPO_CHANGE);
  const over = await run(ctxFor(r, [...NEST_ARGS, '--max', '2']));
  assert.deepEqual([over.report.status, over.exitCode, over.report.selection.max, over.report.selection.within_max], ['red', 1, 2, false]);
  const at = await run(ctxFor(r, [...NEST_ARGS, '--max', '3']));
  assert.deepEqual([at.report.status, at.exitCode, at.report.selection.within_max], ['pass', 0, true]);
  assert.match(at.lines[0], /^SELECT pass · 3\/5 selected \(max 3\) · /);
});

test('the CLI exits 1 over --max and 3 on a glob that matches nothing, and prints each selected test with its first reason', (t) => {
  const r = repo(t, NEST, REPO_CHANGE);
  const cli = (...args) => cp.spawnSync(process.execPath, [BIN, 'select', ...args, '--base', r.baseSha],
    { cwd: r.root, env: GIT_ENV, encoding: 'utf8' });
  const report = path.join(r.root, '.cleancode', 'select.json');
  const none = cli('--tests', 'api/nothing/**/*.ts', '--sources', 'api/src/**/*.ts');
  assert.equal(none.status, 3, none.stderr);
  assert.match(none.stderr, /tests glob matches no file: api\/nothing\/\*\*\/\*\.ts/);
  assert.equal(fs.existsSync(report), false, 'a config error writes no report');
  const over = cli(...NEST_ARGS, '--max', '2');
  assert.equal(over.status, 1, over.stderr);
  assert.equal(over.stdout, lines(
    'SELECT red · 3/5 selected (max 2) · by routes · 2 unresolved',
    `api/test/widgets-base.e2e-spec.ts: ${LIST_ROUTE} · called at api/test/widgets-base.e2e-spec.ts:2`,
    `api/test/widgets-patch.e2e-spec.ts: ${PATCH_ROUTE} · called at api/test/widgets-patch.e2e-spec.ts:4`,
    `api/test/widgets-query.e2e-spec.ts: ${LIST_ROUTE} · called at api/test/widgets-query.e2e-spec.ts:2`,
    `report → ${report}`));
  assert.equal(JSON.parse(fs.readFileSync(report, 'utf8')).status, 'red');
});

test('a tests glob that matches no file is a config error, exit 3, even beside one that matches', async (t) => {
  const r = repo(t, NEST, REPO_CHANGE);
  for (const tests of ['api/nothing/**/*.ts', 'api/test/**/*.e2e-spec.ts,api/nothing/**/*.ts']) {
    await assert.rejects(run(ctxFor(r, ['--tests', tests, '--sources', 'api/src/**/*.ts'])),
      e => e.exitCode === 3 && /api\/nothing/.test(e.message));
  }
});

test('usage errors name the flag and exit 3', async (t) => {
  const r = repo(t, NEST, REPO_CHANGE);
  for (const args of [['--bogus'], ['--tests'], ['--tests', 'a/**'], ['--tier', 'x', '--max', '2'], [...NEST_ARGS, '--max', 'many'], [...NEST_ARGS.slice(0, 4), '--by', 'names']]) {
    await assert.rejects(run(ctxFor(r, args)), e => e.exitCode === 3, args.join(' '));
  }
});

test('--tier reads the tier select block; the tier must be change-selected', async (t) => {
  const r = repo(t, NEST, REPO_CHANGE);
  const select = { tests: ['api/test/**/*.e2e-spec.ts'], sources: ['api/src/**/*.ts'], by: ['routes'], max: 10 };
  const tiers = [{ id: 'api-e2e', scope: 'change-selected', whole_run: 'nightly', select }, { id: 'api-unit', scope: 'whole', select }];
  const { report } = await run(ctxFor(r, ['--tier', 'api-e2e'], { barrier: { on_timeout: 'not-done', tiers } }));
  assert.equal(report.mode, 'tier');
  assert.deepEqual([report.selection.tier, report.selection.by, report.selection.max, report.selection.size], ['api-e2e', ['routes'], 10, 3]);
  for (const args of [['--tier', 'api-unit'], ['--tier', 'absent'], ['--tier', 'api-e2e', '--max', '2']]) {
    await assert.rejects(run(ctxFor(r, args, { barrier: { tiers } })), e => e.exitCode === 3, args.join(' '));
  }
});

test('--flows reports the live flows whose paths match a changed file, and warns without a block', async (t) => {
  const r = repo(t, NEST, REPO_CHANGE);
  const block = { flows: { checkout: { surface: 'web', paths: ['api/src/orders/**'] }, catalog: { surface: 'web', paths: ['api/src/widgets/**'] } } };
  const { report, lines: out } = await run(ctxFor(r, [...NEST_ARGS, '--flows'], { live: { text: '', block, error: null } }));
  assert.deepEqual(report.flows, [{ name: 'catalog', reasons: ['changed api/src/widgets/widgets.repository.ts matches api/src/widgets/**'] }]);
  assert.match(out[0], / · 1 flows$/);
  const bare = await run(ctxFor(r, [...NEST_ARGS, '--flows']));
  assert.deepEqual(bare.report.flows, []);
  assert.deepEqual(bare.warnings, ['select --flows: no live block; flows is []']);
  const invalid = await run(ctxFor(r, [...NEST_ARGS, '--flows'], { live: { text: 'version: 2', block: null, error: 'version: expected 1' } }));
  assert.deepEqual(invalid.report.flows, []);
  assert.deepEqual(invalid.warnings, ['select --flows: invalid live block (version: expected 1); flows is []']);
  assert.deepEqual(selectFlows(null, ['x']), []);
});

test('two runs over one tree are byte-identical once generatedAt and timing are removed', async (t) => {
  const r = repo(t, NEST, REPO_CHANGE);
  const strip = ({ report }) => JSON.stringify({ ...report, generatedAt: undefined, timing: undefined });
  const first = await run(ctxFor(r, NEST_ARGS));
  const second = await run({ ...ctxFor(r, NEST_ARGS), now: '2027-06-07T08:09:10Z' });
  assert.equal(strip(first), strip(second));
  assert.deepEqual(Object.keys(first.report).slice(-5), ['status', 'timing', 'changed', 'selection', 'flows']);
});

test('the report satisfies schema/select.schema.json, with and without a max and flows', async (t) => {
  const schema = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'schema', 'select.schema.json'), 'utf8'));
  const r = repo(t, NEST, REPO_CHANGE);
  const live = { text: '', block: { flows: { catalog: { surface: 'web', paths: ['api/src/widgets/**'] } } }, error: null };
  for (const args of [[...NEST_ARGS, '--max', '9'], [...NEST_ARGS, '--flows']]) {
    const { report } = await run(ctxFor(r, args, { live }));
    assert.deepEqual(validate(schema, report), [], args.join(' '));
    assert.notDeepEqual(validate(schema, { ...report, status: undefined }), []);
  }
});

// ── Route and call-site extraction ──

test('controller prefixes: string, array, object path and empty, each owning the decorators below it', () => {
  const text = lines(
    "@Controller(['widgets', 'gadgets'])",
    'export class A {',
    "  @Get(':id') one() {}",
    '}',
    "@Controller({ path: 'orders', version: '1' })",
    'export class B {',
    '  @Post() create() {}',
    "  @Delete(':id/items/:item') drop() {}",
    '}',
    '@Controller()',
    'export class C {',
    "  @Get('notes/:id/history') history() {}",
    "  @All('ping') ping() {}",
    '}');
  assert.deepEqual(controllerRoutes('src/x.controller.ts', text).map(r => `${r.method} ${r.path} :${r.line}`), [
    'GET /widgets/:id :3', 'GET /gadgets/:id :3', 'POST /orders :7', 'DELETE /orders/:id/items/:item :8',
    'GET /notes/:id/history :12', '* /ping :13',
  ]);
});

test('call sites: the method comes from the call the literal opens, else it is any method', () => {
  const text = lines(
    "const NOTES = '/notes';",
    "const slug = `${prefix}-note`;",
    'request(app).get(`${NOTES}/${id}?full=1`);',
    'request(app)',
    '  .delete(',
    "    '/notes/7');",
    "const table = [['post', '/notes'], ['put', `/notes/${id}`]];",
    'request(app).get(`${root}/notes`);',
    "const label = 'plain words'; // don't call '/notes/archive'",
    "/* nor '/notes/old' */");
  const { sites, unresolved } = callSites(text);
  assert.deepEqual(sites.map(s => `${s.method} /${s.segs.join('/')} :${s.line}`), [
    '* /notes :1', 'GET /notes/: :3', 'DELETE /notes/7 :6', '* /notes :7', '* /notes/: :7',
  ]);
  assert.equal(unresolved, 1);
});

test('matching: equal lengths, parameter wildcards on either side, and * against any method', () => {
  const route = { method: 'PATCH', path: '/widgets/:id', file: 'f', line: 1 };
  assert.equal(matchRoute(route, { method: 'PATCH', segs: ['widgets', '7'] }), true);
  assert.equal(matchRoute(route, { method: '*', segs: ['widgets', ':'] }), true);
  assert.equal(matchRoute(route, { method: 'GET', segs: ['widgets', '7'] }), false);
  assert.equal(matchRoute(route, { method: 'PATCH', segs: ['widgets', '7', 'parts'] }), false);
  assert.equal(matchRoute(route, { method: 'PATCH', segs: ['orders', '7'] }), false);
});
