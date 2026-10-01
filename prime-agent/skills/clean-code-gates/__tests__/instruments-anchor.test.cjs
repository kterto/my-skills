'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ignoreDesktopLitter } = require('./helpers/git-fixture.cjs');

process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';

const A = require('../src/instruments/anchor.cjs');
const { stableJson } = require('../src/instruments/envelope.cjs');

const ENV = { ...process.env, GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@example.test',
  GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@example.test' };

function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    if (text === null) { fs.rmSync(path.join(dir, rel), { force: true }); continue; }
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

function repo(t, files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-anchor-')));
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 5 }));
  const git = (...args) => cp.execFileSync('git', ['-C', dir, ...args], { env: ENV, encoding: 'utf8' }).trim();
  git('init', '-q', '--template=', '-b', 'main');
  git('config', 'commit.gpgsign', 'false');
  ignoreDesktopLitter(dir);
  write(dir, { 'readme.md': 'a widget shop\n', ...files });
  git('add', '-A');
  git('commit', '-qm', 'base');
  return { dir, git, sha: git('rev-parse', 'HEAD') };
}

// Stands in for P4's liveblock.cjs: `key: <JSON>` at column 0, and a bare `key:`
// opening a mapping of two-space-indented `name: <JSON>` entries.
const stub = {
  extractLiveBlock(text) {
    const m = /^```live\n([\s\S]*?)^```/m.exec(text);
    return m ? m[1] : null;
  },
  parseLiveBlock(text) {
    try {
      const block = {};
      let open = null;
      for (const line of text.split('\n').filter((l) => l.trim())) {
        const [, indent, key, value] = /^( {2})?([\w-]+):\s*(.*)$/.exec(line);
        if (indent) open[key] = JSON.parse(value);
        else if (value === '') open = block[key] = {};
        else block[key] = JSON.parse(value);
      }
      return { block, error: null };
    } catch (e) {
      return { block: null, error: e.message };
    }
  },
};

const CONFIG = '.cleancode-gates.json';
const CONTEXT = '.orchestrator/PROJECT-CONTEXT.md';
const json = (o) => `${JSON.stringify(o, null, 2)}\n`;
const context = (body) => `# Context\n\n## Test tooling\n\n\`\`\`live\n${body}\`\`\`\n\n## Commands\n\nnone\n`;
const LIVE = 'version: 1\nisolation: "ephemeral"\nservices:\n  api: {"up": "true", "ready": "cmd:true", "bound_minutes": 5}\n';
const CONSENT = 'consent:\n  prisma_reset: {"url": "postgresql://127.0.0.1:55432/widgets", "container": "widget-db"}\n';

const tier = (id, over = {}) => ({ id, cwd: '.', run: `node run-${id}.cjs`, report: 'exit-code',
  scope: 'whole', bound_minutes: 5, ...over });
const CLASS = { shape: 'a TODO left in source', pattern: 'regex over src', confirm: 'read the line' };
const guard = (id, over = {}) => ({ id, kind: 'shape', class: CLASS,
  shape: { type: 'regex', files: ['src/**/*.ts'], pattern: 'TODO' }, ...over });
const move = (key, change, direction) => ({ key, change, direction });

function anchored(t, base, work) {
  const { dir, git, sha } = repo(t, base);
  write(dir, work);
  return { dir, git, sha, inst: A.loadInstruments(dir, { baseSha: sha, from: null, liveblock: stub }) };
}

test('the base definition wins, and a branch edit to it is a changed move', (t) => {
  const { inst } = anchored(t, { [CONFIG]: json({ barrier: { tiers: [tier('unit')] } }) },
    { [CONFIG]: json({ barrier: { tiers: [tier('unit', { run: 'true' })] } }) });
  assert.equal(inst.source, 'merge-base');
  assert.equal(inst.from, null);
  assert.deepEqual(inst.barrier, { on_timeout: 'not-done', tiers: [tier('unit')] });
  assert.deepEqual(inst.moves, [move('barrier.tiers.unit', 'changed', 'changed')]);
});

test('the effective set is every base entry plus the working entries with new ids, sorted by id', (t) => {
  const { inst } = anchored(t,
    { [CONFIG]: json({ barrier: { tiers: [tier('b'), tier('a')] }, guards: [guard('old')] }) },
    { [CONFIG]: json({ barrier: { tiers: [tier('c'), tier('b')] }, guards: [guard('new')] }) });
  assert.deepEqual(inst.barrier.tiers.map((x) => x.id), ['a', 'b', 'c']);
  assert.deepEqual(inst.guards.map((x) => x.id), ['new', 'old']);
  assert.deepEqual(inst.moves, [
    move('barrier.tiers.a', 'removed', 'loosening'),
    move('barrier.tiers.c', 'added', 'tightening'),
    move('guards.new', 'added', 'tightening'),
    move('guards.old', 'removed', 'loosening'),
  ]);
});

test('a guard deleted on the branch, config and all, still runs from base', (t) => {
  const { inst } = anchored(t, { [CONFIG]: json({ guards: [guard('no-todo')] }) }, { [CONFIG]: null });
  assert.deepEqual(inst.guards, [guard('no-todo')]);
  assert.equal(inst.barrier, null);
  assert.deepEqual(inst.moves, [move('guards.no-todo', 'removed', 'loosening')]);
});

test('time bounds take max(base, working): a raise applies, a lowering is ignored, both are moves', (t) => {
  const base = { mode: 'inherit-only', prepare: 'true', prepare_minutes: 10 };
  const command = (bound) => guard('cmd', { kind: 'command', shape: undefined,
    command: { cwd: '.', run: 'true', bound_minutes: bound } });
  const { inst } = anchored(t,
    { [CONFIG]: json({ barrier: { tiers: [tier('up', { base }), tier('down')] }, guards: [command(5)] }) },
    { [CONFIG]: json({ barrier: { tiers: [tier('up', { bound_minutes: 20, base: { ...base, prepare_minutes: 30 } }),
      tier('down', { bound_minutes: 2 })] }, guards: [command(9)] }) });
  const [down, up] = inst.barrier.tiers;
  assert.equal(up.bound_minutes, 20);
  assert.equal(up.base.prepare_minutes, 30);
  assert.equal(down.bound_minutes, 5, 'a lowered bound is ignored');
  assert.equal(inst.guards[0].command.bound_minutes, 9);
  assert.deepEqual(inst.moves, [
    move('barrier.tiers.down.bound_minutes', 'changed', 'changed'),
    move('barrier.tiers.up.bound_minutes', 'changed', 'changed'),
    move('guards.cmd.bound_minutes', 'changed', 'changed'),
  ]);
});

test('whole_minutes is a time bound too: a branch may lengthen it, never shorten it', (t) => {
  const sel = (id, over) => tier(id, { scope: 'change-selected', whole_run: 'nightly', select: { tests: ['*.t'], sources: ['*.s'] }, ...over });
  const { inst } = anchored(t,
    { [CONFIG]: json({ barrier: { tiers: [sel('down', { whole_minutes: 30 }), sel('new'), sel('up', { whole_minutes: 30 })] } }) },
    { [CONFIG]: json({ barrier: { tiers: [sel('down', { whole_minutes: 15 }), sel('new', { whole_minutes: 3 }),
      sel('up', { whole_minutes: 60 })] } }) });
  assert.deepEqual(inst.barrier.tiers.map((x) => [x.id, x.whole_minutes]), [['down', 30], ['new', 3], ['up', 60]],
    'absent at base is no bound at all, so the branch\'s 3 stands (and side() never goes below bound_minutes)');
  assert.deepEqual(inst.moves.map((m) => m.key), ['barrier.tiers.down.bound_minutes', 'barrier.tiers.new.bound_minutes',
    'barrier.tiers.up.bound_minutes']);
});

test('barrier.on_timeout: the base wins, and a difference is a move', (t) => {
  const { inst } = anchored(t, { [CONFIG]: json({ barrier: { tiers: [tier('unit')] } }) },
    { [CONFIG]: json({ barrier: { on_timeout: 'retry-2x', tiers: [tier('unit')] } }) });
  assert.equal(inst.barrier.on_timeout, 'not-done');
  assert.deepEqual(inst.moves, [move('barrier.on_timeout', 'changed', 'changed')]);
});

test('with neither file at base the source is defaults, and every working entry is added', (t) => {
  const empty = anchored(t, {}, {});
  assert.deepEqual({ ...empty.inst, digest: null },
    { source: 'defaults', from: null, digest: null, moves: [], barrier: null, guards: [], live: null });
  const { inst } = anchored(t, {}, { [CONFIG]: json({ barrier: { tiers: [tier('unit')] } }) });
  assert.equal(inst.source, 'defaults');
  assert.deepEqual(inst.barrier.tiers, [tier('unit')]);
  assert.deepEqual(inst.moves, [move('barrier.tiers.unit', 'added', 'tightening')]);
});

test('a live block added on the branch loses its consent, in the parse and in the text', (t) => {
  const { inst } = anchored(t, { [CONTEXT]: '# Context\n\n## Test tooling\n\nnone yet\n' },
    { [CONTEXT]: context(`${LIVE}${CONSENT}readback:\n  pg: {"run": "true", "read_only": true}\n`) });
  assert.deepEqual(inst.moves, [move('live', 'added', 'tightening')]);
  assert.equal(inst.live.error, null);
  assert.equal(inst.live.block.consent, undefined);
  assert.deepEqual(Object.keys(inst.live.block), ['version', 'isolation', 'services', 'readback']);
  assert.doesNotMatch(inst.live.text, /consent|prisma_reset/);
  assert.deepEqual(stub.parseLiveBlock(inst.live.text).block, inst.live.block);
});

test('an anchored live block keeps its consent, wins over a branch edit, and its bounds take the max', (t) => {
  const baseText = `${LIVE}${CONSENT}`;
  const { inst } = anchored(t, { [CONTEXT]: context(baseText) },
    { [CONTEXT]: context(LIVE.replace('"ephemeral"', '"shared-dev"').replace('"bound_minutes": 5', '"bound_minutes": 20')) });
  assert.equal(inst.live.block.isolation, 'ephemeral');
  assert.equal(inst.live.block.services.api.bound_minutes, 20);
  assert.deepEqual(inst.live.block.consent, stub.parseLiveBlock(CONSENT).block.consent);
  assert.equal(inst.live.text, baseText);
  assert.deepEqual(inst.moves, [move('live', 'changed', 'changed'), move('live.bound_minutes', 'changed', 'changed')]);
});

test('a live block dropped on the branch still runs from base', (t) => {
  const { inst } = anchored(t, { [CONTEXT]: context(LIVE) }, { [CONTEXT]: null });
  assert.equal(inst.live.text, LIVE);
  assert.deepEqual(inst.moves, [move('live', 'removed', 'loosening')]);
});

test('--instruments-from <ref> reads both files at that ref, with no moves', (t) => {
  const { dir, git, sha } = repo(t, { [CONFIG]: json({ barrier: { tiers: [tier('old')] } }), [CONTEXT]: context(LIVE) });
  write(dir, { [CONFIG]: json({ barrier: { tiers: [tier('new')] } }), [CONTEXT]: null });
  git('commit', '-qam', 'replace');
  write(dir, { [CONFIG]: json({ guards: [guard('local')] }) });
  const inst = A.loadInstruments(dir, { baseSha: git('rev-parse', 'HEAD'), from: sha, liveblock: stub });
  assert.equal(inst.source, 'instruments-from');
  assert.equal(inst.from, sha);
  assert.deepEqual(inst.barrier.tiers.map((x) => x.id), ['old']);
  assert.deepEqual(inst.guards, []);
  assert.equal(inst.live.text, LIVE);
  assert.deepEqual(inst.moves, []);
  assert.throws(() => A.loadInstruments(dir, { baseSha: sha, from: 'nope', liveblock: stub }), /"nope" does not resolve/);
});

test('--instruments-from file:<path> reads that JSON, with no moves, and refuses a bad file', (t) => {
  const { dir, sha } = repo(t, { [CONFIG]: json({ guards: [guard('base-only')] }) });
  write(dir, { 'replay/i.json': json({ barrier: { tiers: [tier('e2e')] }, guards: [guard('g')], live: `${LIVE}${CONSENT}` }) });
  const inst = A.loadInstruments(dir, { baseSha: sha, from: 'file:replay/i.json', liveblock: stub });
  assert.equal(inst.source, 'instruments-from');
  assert.equal(inst.from, 'file:replay/i.json');
  assert.deepEqual(inst.barrier, { on_timeout: 'not-done', tiers: [tier('e2e')] });
  assert.deepEqual(inst.guards, [guard('g')]);
  assert.equal(inst.live.text, `${LIVE}${CONSENT}`);
  assert.equal(inst.live.block.consent.prisma_reset.container, 'widget-db');
  assert.deepEqual(inst.moves, []);
  const load = (from) => () => A.loadInstruments(dir, { baseSha: sha, from, liveblock: stub });
  assert.throws(load('file:replay/missing.json'), /file:replay\/missing\.json/);
  write(dir, { 'replay/bad.json': '{ not json' });
  assert.throws(load('file:replay/bad.json'), /file:replay\/bad\.json/);
  write(dir, { 'replay/extra.json': json({ guards: [], colour: 'blue' }) });
  assert.throws(load('file:replay/extra.json'), /colour: unknown key/);
  write(dir, { 'replay/tier.json': json({ barrier: { tiers: [tier('e2e', { bound_minutes: 0 })] } }) });
  assert.throws(load('file:replay/tier.json'), /barrier\.tiers\[0\]\.bound_minutes/);
});

test('the digest is the sha256 of the canonical resolution: stable across runs and key order, moved by content', (t) => {
  const { dir, sha } = repo(t, {});
  const files = {
    'a.json': json({ guards: [guard('g')], barrier: { tiers: [tier('e2e')] }, live: LIVE }),
    'b.json': JSON.stringify({ live: LIVE, barrier: { tiers: [Object.fromEntries(Object.entries(tier('e2e')).reverse())] },
      guards: [guard('g')] }),
    'c.json': json({ guards: [guard('g')], barrier: { tiers: [tier('e2e', { run: 'true' })] }, live: LIVE }),
  };
  write(dir, files);
  const digest = (f) => A.loadInstruments(dir, { baseSha: sha, from: `file:${f}`, liveblock: stub }).digest;
  const inst = A.loadInstruments(dir, { baseSha: sha, from: 'file:a.json', liveblock: stub });
  const expected = crypto.createHash('sha256')
    .update(stableJson({ barrier: inst.barrier, guards: inst.guards, live: LIVE })).digest('hex');
  assert.equal(inst.digest, expected);
  assert.equal(digest('a.json'), expected);
  assert.equal(digest('b.json'), expected);
  assert.notEqual(digest('c.json'), expected);
});

test('an invalid config at base fails closed, naming where', (t) => {
  const load = (base) => () => anchored(t, base, {});
  assert.throws(load({ [CONFIG]: '{ nope' }), /\.cleancode-gates\.json at base [0-9a-f]{12}: invalid JSON/);
  assert.throws(load({ [CONFIG]: json({ barrier: { tiers: [tier('unit'), tier('unit')] } }) }), /at base.*barrier\.tiers: duplicate id "unit"/);
  assert.throws(load({ [CONFIG]: json({ guards: [guard('g'), guard('g')] }) }), /guards: duplicate id "g"/);
  assert.throws(load({ [CONFIG]: json({ guards: {} }) }), /guards: must be an array/);
  assert.throws(load({ [CONFIG]: json({ barrier: { tiers: [], colour: 1 } }) }), /barrier\.colour: unknown key/);
  assert.throws(load({ [CONFIG]: json({ barrier: { on_timeout: 'wait', tiers: [] } }) }), /barrier\.on_timeout/);
  assert.throws(load({ [CONFIG]: json({ barrier: { tiers: {} } }) }), /barrier\.tiers: invalid/);
  assert.throws(load({ [CONFIG]: json({ barrier: { tiers: [tier('unit', { colour: 1 })] } }) }), /barrier\.tiers\[0\]\.colour: unknown key/);
});

// A branch cannot take the instruments down (B1): whatever the working tree's config holds, the base's instruments run.
const BASE_CONFIG = { barrier: { tiers: [tier('unit')] }, guards: [guard('no-todo')] };
const INVALID = move('config', 'invalid', 'changed');
function degraded(t, work) {
  const warnings = [];
  const { dir, sha } = repo(t, { [CONFIG]: json(BASE_CONFIG) });
  write(dir, { [CONFIG]: work });
  return { inst: A.loadInstruments(dir, { baseSha: sha, from: null, liveblock: stub, warn: (w) => warnings.push(w) }), warnings };
}

test('an unparseable working config, or an invalid entry it adds, is ignored whole: the base runs, a move and a warning say so', (t) => {
  const cases = [
    ['{ nope', /invalid JSON/],
    [json({ ...BASE_CONFIG, barrier: { tiers: [tier('unit'), tier('new', { colour: 1 })] } }), /barrier\.tiers\[1\]\.colour: unknown key/],
    [json({ ...BASE_CONFIG, barrier: { tiers: [tier('unit'), tier('x'), tier('x')] } }), /barrier\.tiers: duplicate id "x"/],
    [json({ ...BASE_CONFIG, guards: [guard('no-todo'), { id: 'Bad Id' }] }), /guards\[1\]\.id: invalid/],
    [json({ ...BASE_CONFIG, guards: {} }), /guards: must be an array/],
    [json({ ...BASE_CONFIG, barrier: { tiers: [tier('unit')], colour: 1 } }), /barrier\.colour: unknown key/],
    [json({ ...BASE_CONFIG, barrier: { on_timeout: 'wait', tiers: [tier('unit')] } }), /barrier\.on_timeout/],
    [json({ barrier: { tiers: [tier('unit'), tier('slow', { bound_minutes: 20000 })] } }), /barrier\.tiers\[1\]\.bound_minutes: invalid/],
  ];
  for (const [work, why] of cases) {
    const { inst, warnings } = degraded(t, work);
    assert.deepEqual([inst.barrier.tiers, inst.guards], [BASE_CONFIG.barrier.tiers, BASE_CONFIG.guards], work);
    assert.deepEqual(inst.moves, [INVALID], work);
    assert.equal(warnings.length, 1, work);
    assert.match(warnings[0], /^\.cleancode-gates\.json in the working tree is invalid \(.*\); its additions are ignored, and the base's instruments run$/);
    assert.match(warnings[0], why);
  }
});

test('an invalid edit to an anchored entry is only a changed move: the base definition runs, and its bound never takes an invalid value', (t) => {
  const { inst, warnings } = degraded(t, json({ barrier: { tiers: [tier('unit', { note: 'x', bound_minutes: 99999 })] },
    guards: [guard('no-todo', { kind: 'nope' })] }));
  assert.deepEqual(inst.barrier.tiers, [tier('unit')]);
  assert.deepEqual(inst.guards, [guard('no-todo')]);
  assert.deepEqual(inst.moves, [move('barrier.tiers.unit', 'changed', 'changed'), move('barrier.tiers.unit.bound_minutes', 'changed', 'changed'),
    move('guards.no-todo', 'changed', 'changed')]);
  assert.deepEqual(warnings, []);
});

test("a tier whose cwd the working tree lacks still loads: every kind keeps its verdict, and the barrier types that tier at run time", (t) => {
  const { inst } = anchored(t, { [CONFIG]: json({ barrier: { tiers: [tier('unit', { cwd: 'apps/missing' })] } }) }, {});
  assert.deepEqual(inst.barrier.tiers.map((x) => x.cwd), ['apps/missing']);
  assert.deepEqual(inst.moves, []);
});

test('legacy per-stack keys ride along untouched and unvalidated', (t) => {
  const { inst } = anchored(t, {}, { [CONFIG]: json({ schemaVersion: '1.0', stacks: { 'node-ts': { roots: ['src'] } } }) });
  assert.deepEqual([inst.barrier, inst.guards, inst.moves], [null, [], []]);
});

const TIER_OK = { id: 'e2e', cwd: 'apps/api', run: 'x', report: 'jest-json', scope: 'whole', bound_minutes: 0.02 };
const TIER_FULL = { ...TIER_OK, isolation: 'shared-dev', env: { A: 'b' }, rerun: 'y', cleanup: 'z',
  runner_cwd: '/app', base: { mode: 'inherit-only', prepare: 'p', prepare_minutes: 15, env: {} } };
const SELECTED = { ...TIER_OK, id: 'mobile', scope: 'change-selected', whole_run: 'nightly on main',
  select: { tests: ['apps/mobile/test/**/*_test.dart'], sources: ['apps/mobile/lib/**/*.dart'], by: ['imports'], max: 60,
    whole_on: ['apps/mobile/pubspec.*', 'apps/mobile/test/flutter_test_config.dart'] } };
const without = (o, key) => Object.fromEntries(Object.entries(o).filter(([k]) => k !== key));

const TIER_BAD = [
  ['not an object', 'x', /^t: must be an object$/],
  ['an unknown key', { ...TIER_OK, colour: 'x' }, /^t\.colour: unknown key$/],
  ...['id', 'cwd', 'run', 'report', 'scope', 'bound_minutes'].map((k) => [`no ${k}`, without(TIER_OK, k), new RegExp(`^t\\.${k}: required$`)]),
  ['an upper-case id', { ...TIER_OK, id: 'E2E' }, /^t\.id: invalid/],
  ['an id starting with -', { ...TIER_OK, id: '-e2e' }, /^t\.id: invalid/],
  ['a 64-character id', { ...TIER_OK, id: 'a'.repeat(64) }, /^t\.id: invalid/],
  ['an absolute cwd', { ...TIER_OK, cwd: '/apps/api' }, /^t\.cwd: invalid/],
  ['a cwd through ..', { ...TIER_OK, cwd: 'apps/../..' }, /^t\.cwd: invalid/],
  ['an empty run', { ...TIER_OK, run: '' }, /^t\.run: invalid/],
  ['an unknown report', { ...TIER_OK, report: 'tap' }, /^t\.report: invalid/],
  ['an unknown scope', { ...TIER_OK, scope: 'some' }, /^t\.scope: invalid/],
  ['a zero bound', { ...TIER_OK, bound_minutes: 0 }, /^t\.bound_minutes: invalid/],
  ['a string bound', { ...TIER_OK, bound_minutes: '5' }, /^t\.bound_minutes: invalid/],
  ['a bound over a week', { ...TIER_OK, bound_minutes: 10081 }, /^t\.bound_minutes: invalid/],
  ['a prepare bound over a week', { ...TIER_OK, base: { prepare_minutes: 10081 } }, /^t\.base\.prepare_minutes: invalid/],
  ['a non-string whole_on glob', { ...SELECTED, select: { ...SELECTED.select, whole_on: [3] } }, /^t\.select\.whole_on: invalid/],
  ['an unknown isolation', { ...TIER_OK, isolation: 'shared' }, /^t\.isolation: invalid/],
  ['a non-string env value', { ...TIER_OK, env: { A: 1 } }, /^t\.env: invalid/],
  ['a non-string rerun', { ...TIER_OK, rerun: 3 }, /^t\.rerun: invalid/],
  ['an empty cleanup', { ...TIER_OK, cleanup: '' }, /^t\.cleanup: invalid/],
  ['a relative runner_cwd', { ...TIER_OK, runner_cwd: 'app' }, /^t\.runner_cwd: invalid/],
  ['an unknown base mode', { ...TIER_OK, base: { mode: 'clone' } }, /^t\.base\.mode: invalid/],
  ['a zero prepare bound', { ...TIER_OK, base: { prepare_minutes: 0 } }, /^t\.base\.prepare_minutes: invalid/],
  ['an empty base prepare', { ...TIER_OK, base: { prepare: '' } }, /^t\.base\.prepare: invalid/],
  ['a non-string base env value', { ...TIER_OK, base: { env: { A: true } } }, /^t\.base\.env: invalid/],
  ['an unknown base key', { ...TIER_OK, base: { extra: 1 } }, /^t\.base\.extra: unknown key$/],
  ['a non-string whole_run', { ...SELECTED, whole_run: 7 }, /^t\.whole_run: invalid/],
  ['select on a whole tier', { ...TIER_OK, select: SELECTED.select }, /^t\.select: only allowed/],
  ['whole_minutes on a whole tier', { ...TIER_OK, whole_minutes: 30 }, /^t\.whole_minutes: only allowed/],
  ['a whole bound over a week', { ...SELECTED, whole_minutes: 10081 }, /^t\.whole_minutes: invalid/],
  ['an unknown cache_scope', { ...TIER_OK, cache_scope: 'repo' }, /^t\.cache_scope: invalid/],
  ['change-selected without select', without(SELECTED, 'select'), /^t\.select: required when/],
  ['change-selected without whole_run', without(SELECTED, 'whole_run'), /^t\.whole_run: required when/],
  ['an unknown select key', { ...SELECTED, select: { ...SELECTED.select, colour: 1 } }, /^t\.select\.colour: unknown key$/],
  ['no select tests', { ...SELECTED, select: { ...SELECTED.select, tests: [] } }, /^t\.select\.tests: invalid/],
  ['no select sources', { ...SELECTED, select: without(SELECTED.select, 'sources') }, /^t\.select\.sources: required$/],
  ['an unknown select by', { ...SELECTED, select: { ...SELECTED.select, by: ['calls'] } }, /^t\.select\.by: invalid/],
  ['a fractional select max', { ...SELECTED, select: { ...SELECTED.select, max: 1.5 } }, /^t\.select\.max: invalid/],
  ['runner_cwd with a worktree base', { ...TIER_OK, runner_cwd: '/app', base: { mode: 'worktree' } }, /^t\.runner_cwd: /],
];

test('validateTier accepts every documented key, and a bound of exactly a week', () => {
  for (const ok of [TIER_OK, TIER_FULL, SELECTED, { ...SELECTED, cache_scope: 'cwd', whole_minutes: 10080 },
    { ...TIER_OK, bound_minutes: 10080, base: { prepare_minutes: 10080 } }]) {
    assert.equal(A.validateTier(ok, 't'), null);
  }
});

for (const [label, value, expected] of TIER_BAD) {
  test(`validateTier rejects ${label}, naming the path`, () => assert.match(String(A.validateTier(value, 't')), expected));
}

const SHAPE_OK = { type: 'regex', files: ['src/**/*.ts'], exclude: ['**/*.spec.ts'], pattern: 'TODO', flags: 'gi' };
const DECORATED = { type: 'decorated-fields', files: ['src/**/*.ts'], exclude: [], classes: ['InputType'], field: 'Field',
  validators_from: ['class-validator'], validator_markers: ['registerDecorator('], inherit: ['PartialType'],
  checks: ['undecorated', 'nullable-without-optional'], optional: ['IsOptional'] };

const SHAPE_BAD = [
  ['not an object', [], /^s: must be an object$/],
  ['an unknown type', { ...SHAPE_OK, type: 'ast' }, /^s\.type: /],
  ['a key of the other type', { ...SHAPE_OK, classes: ['X'] }, /^s\.classes: unknown key$/],
  ['no pattern', without(SHAPE_OK, 'pattern'), /^s\.pattern: required$/],
  ['no files key', without(SHAPE_OK, 'files'), /^s\.files: required$/],
  ['a non-string validators_from', { ...DECORATED, validators_from: [1] }, /^s\.validators_from: invalid/],
  ['a pattern that does not compile', { ...SHAPE_OK, pattern: '(' }, /^s\.pattern: invalid/],
  ['a pattern that compiles only without its u flag', { ...SHAPE_OK, pattern: 'a{', flags: 'u' }, /^s\.pattern: .*Incomplete quantifier/],
  ['an escape the u flag refuses', { ...SHAPE_OK, pattern: '\\-', flags: 'iu' }, /^s\.pattern: .*Invalid escape/],
  ['an unknown flag', { ...SHAPE_OK, flags: 'x' }, /^s\.flags: invalid/],
  ['a repeated flag', { ...SHAPE_OK, flags: 'gg' }, /^s\.flags: /],
  ['no files', { ...SHAPE_OK, files: [] }, /^s\.files: invalid/],
  ['a non-string exclude', { ...SHAPE_OK, exclude: [1] }, /^s\.exclude: invalid/],
  ['no classes', without(DECORATED, 'classes'), /^s\.classes: required$/],
  ['an empty field', { ...DECORATED, field: '' }, /^s\.field: invalid/],
  ['an unknown check', { ...DECORATED, checks: ['typo'] }, /^s\.checks: invalid/],
  ['no checks', { ...DECORATED, checks: [] }, /^s\.checks: invalid/],
  ['a string inherit', { ...DECORATED, inherit: 'PartialType' }, /^s\.inherit: invalid/],
  ['nullable-without-optional with no optional list', without(DECORATED, 'optional'),
    /^s\.optional: required when checks include nullable-without-optional$/],
  ['nullable-without-optional with an empty optional list', { ...DECORATED, optional: [] },
    /^s\.optional: required when checks include nullable-without-optional$/],
];

test('optional may be left out when checks omit nullable-without-optional', () => {
  assert.equal(A.validateShape({ ...without(DECORATED, 'optional'), checks: ['undecorated'] }, 's'), null);
});

test('validateShape accepts both shape types', () => {
  assert.equal(A.validateShape(SHAPE_OK, 's'), null);
  assert.equal(A.validateShape(DECORATED, 's'), null);
});

for (const [label, value, expected] of SHAPE_BAD) {
  test(`validateShape rejects ${label}, naming the path`, () => assert.match(String(A.validateShape(value, 's')), expected));
}

const GUARD_OK = { ...guard('no-todo'), shape: SHAPE_OK, added: '2026-01-01', by: 'a reviewer',
  plants: [{ name: 'a todo', file: 'src/a.ts', find: 'x', replace: 'x // TODO', expect: 'red' }] };
const COMMAND = { id: 'cmd', kind: 'command', class: CLASS, command: { cwd: '.', run: 'node check.cjs', bound_minutes: 1 } };
const CONSUMERS = { id: 'rule-users', kind: 'consumers', class: CLASS,
  consumers: { trigger: ['src/rule.ts'], files: ['src/**/*.ts'], exclude: ['**/*.spec.ts'], patterns: ['widgetLimit\\s*<'] } };

const GUARD_BAD = [
  ['not an object', null, /^g: must be an object$/],
  ['an unknown key', { ...GUARD_OK, colour: 1 }, /^g\.colour: unknown key$/],
  ...['id', 'kind', 'class'].map((k) => [`no ${k}`, without(GUARD_OK, k), new RegExp(`^g\\.${k}: required$`)]),
  ['a bad id', { ...GUARD_OK, id: 'No Todo' }, /^g\.id: invalid/],
  ['an unknown kind', { ...GUARD_OK, kind: 'script' }, /^g\.kind: invalid/],
  ['a class without confirm', { ...GUARD_OK, class: without(CLASS, 'confirm') }, /^g\.class\.confirm: required$/],
  ['an empty class shape', { ...GUARD_OK, class: { ...CLASS, shape: '' } }, /^g\.class\.shape: invalid/],
  ['a class with an unknown key', { ...GUARD_OK, class: { ...CLASS, colour: 'x' } }, /^g\.class\.colour: unknown key$/],
  ['consumers without files', { ...CONSUMERS, consumers: without(CONSUMERS.consumers, 'files') }, /^g\.consumers\.files: required$/],
  ['a plant without a name', { ...GUARD_OK, plants: [without(GUARD_OK.plants[0], 'name')] }, /^g\.plants\[0\]\.name: required$/],
  ['a plant at an absolute path', { ...GUARD_OK, plants: [{ ...GUARD_OK.plants[0], file: '/src/a.ts' }] },
    /^g\.plants\[0\]\.file: invalid/],
  ['a plant with a non-string replace', { ...GUARD_OK, plants: [{ ...GUARD_OK.plants[0], replace: null }] },
    /^g\.plants\[0\]\.replace: invalid/],
  ['no block for its kind', without(GUARD_OK, 'shape'), /^g\.shape: required$/],
  ['a block for another kind', { ...GUARD_OK, command: COMMAND.command }, /^g\.command: unknown key$/],
  ['an invalid shape', { ...GUARD_OK, shape: { ...SHAPE_OK, pattern: '(' } }, /^g\.shape\.pattern: invalid/],
  ['a command without run', { ...COMMAND, command: without(COMMAND.command, 'run') }, /^g\.command\.run: required$/],
  ['a command without cwd', { ...COMMAND, command: without(COMMAND.command, 'cwd') }, /^g\.command\.cwd: required$/],
  ['a zero command bound', { ...COMMAND, command: { ...COMMAND.command, bound_minutes: 0 } }, /^g\.command\.bound_minutes: invalid/],
  ['a command bound over a week', { ...COMMAND, command: { ...COMMAND.command, bound_minutes: 10081 } },
    /^g\.command\.bound_minutes: invalid/],
  ['a command cwd through ..', { ...COMMAND, command: { ...COMMAND.command, cwd: '../x' } }, /^g\.command\.cwd: invalid/],
  ['no consumers trigger', { ...CONSUMERS, consumers: { ...CONSUMERS.consumers, trigger: [] } }, /^g\.consumers\.trigger: invalid/],
  ['a consumers pattern that does not compile', { ...CONSUMERS, consumers: { ...CONSUMERS.consumers, patterns: ['('] } },
    /^g\.consumers\.patterns: invalid/],
  ['plants that are not a list', { ...GUARD_OK, plants: {} }, /^g\.plants: invalid/],
  ['a plant expecting neither red nor green', { ...GUARD_OK, plants: [{ ...GUARD_OK.plants[0], expect: 'blue' }] },
    /^g\.plants\[0\]\.expect: invalid/],
  ['a plant without find', { ...GUARD_OK, plants: [without(GUARD_OK.plants[0], 'find')] }, /^g\.plants\[0\]\.find: required$/],
  ['a plant with an unknown key', { ...GUARD_OK, plants: [{ ...GUARD_OK.plants[0], colour: 1 }] },
    /^g\.plants\[0\]\.colour: unknown key$/],
  ['a non-string added', { ...GUARD_OK, added: 5 }, /^g\.added: invalid/],
];

test('validateGuard accepts each kind with every documented key', () => {
  for (const ok of [GUARD_OK, COMMAND, CONSUMERS, { ...guard('d'), shape: DECORATED }]) {
    assert.equal(A.validateGuard(ok, 'g'), null);
  }
});

for (const [label, value, expected] of GUARD_BAD) {
  test(`validateGuard rejects ${label}, naming the path`, () => assert.match(String(A.validateGuard(value, 'g')), expected));
}

test('with the real live-block parser, a branch-added block loses its consent', (t) => {
  const block = 'version: 1\nisolation: ephemeral\nconsent:\n  prisma_reset: { url: "postgresql://127.0.0.1:55432/widgets", container: widget-db }\n';
  const { dir, sha } = repo(t, {});
  write(dir, { [CONTEXT]: context(block) });
  const inst = A.loadInstruments(dir, { baseSha: sha, from: null });
  assert.equal(inst.live.error, null);
  assert.equal(inst.live.block.isolation, 'ephemeral');
  assert.equal(inst.live.block.consent, undefined);
  assert.doesNotMatch(inst.live.text, /consent/);
  assert.deepEqual(inst.moves, [move('live', 'added', 'tightening')]);
});
