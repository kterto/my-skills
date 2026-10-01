'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ignoreDesktopLitter } = require('./helpers/git-fixture.cjs');
const { validate } = require('./helpers/schema-validate.cjs');

const SKILL = path.join(__dirname, '..');
const BIN = path.join(SKILL, 'bin', 'gates.cjs');
// A nested runner that inherits NODE_TEST_CONTEXT writes no report; the CLI's tiers must not see it.
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1',
  GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@example.test', GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@example.test' };
delete ENV.NODE_TEST_CONTEXT;

function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

function repo(t, files) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-det-')));
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 5 }));
  const git = (...args) => cp.execFileSync('git', ['-C', dir, ...args], { env: ENV, encoding: 'utf8' });
  git('init', '-q', '--template=', '-b', 'main');
  git('config', 'commit.gpgsign', 'false');
  ignoreDesktopLitter(dir);
  write(dir, files);
  git('add', '-A');
  git('commit', '-qm', 'base');
  return dir;
}

const json = (o) => `${JSON.stringify(o, null, 2)}\n`;
const CLASS = { shape: 'a TODO left in source', pattern: 'regex over src', confirm: 'read the line' };

// Prints the time, so the tier's log (and its evidence digest) differs on every run.
const EMIT = `const fs = require('node:fs');
const path = require('node:path');
console.log('started at ' + new Date().toISOString() + ' ' + process.hrtime.bigint());
fs.writeFileSync(process.argv[2], JSON.stringify({ numTotalTests: 1, testResults: [{
  name: path.resolve('widget.spec.cjs'), status: 'passed', message: '',
  assertionResults: [{ fullName: 'widget renders', status: 'passed', failureMessages: [] }] }] }));
`;

const LIVE = '```live\nversion: 1\nisolation: ephemeral\ndb_build: none\n'
  + 'services:\n  api: { up: "true", ready: "cmd:true" }\n```\n';

// One fixture tree per kind (§5.1, §6.1, §7.1, §8.1): the base commit, then a working-tree edit.
const FIXTURES = {
  barrier: {
    files: {
      '.cleancode-gates.json': json({ barrier: { tiers: [{ id: 'unit', cwd: '.', run: `"${process.execPath}" emit.cjs $REPORT`,
        report: 'jest-json', scope: 'whole', bound_minutes: 1 }] } }),
      'emit.cjs': EMIT, 'widget.cjs': 'module.exports = 1;\n',
    },
    work: { 'widget.cjs': 'module.exports = 2;\n' }, args: [], exit: 0,
  },
  select: {
    files: {
      'src/widget.ts': 'export const widget = 1;\n', 'src/order.ts': 'export const order = 1;\n',
      'spec/widget.spec.ts': "import { widget } from '../src/widget';\n", 'spec/order.spec.ts': "import { order } from '../src/order';\n",
    },
    work: { 'src/widget.ts': 'export const widget = 2;\n' }, args: ['--tests', 'spec/**/*.spec.ts', '--sources', 'src/**/*.ts'], exit: 0,
  },
  sweep: {
    files: {
      '.cleancode-gates.json': json({ guards: [{ id: 'no-todo', kind: 'shape', class: CLASS,
        shape: { type: 'regex', files: ['src/**/*.ts'], exclude: [], pattern: 'TODO', flags: '' } }] }),
      'src/widget.ts': 'export const widget = 1; // TODO: price\n', 'src/order.ts': 'export const order = 1;\n',
    },
    work: { 'src/order.ts': 'export const order = 2; // TODO: tax\n' }, args: ['--all'], exit: 1,
  },
  live: {
    files: { '.orchestrator/PROJECT-CONTEXT.md': `# Project context\n\n## Test tooling\n\n${LIVE}\n## Commands\n\nnone\n` },
    work: { 'notes.md': 'a note\n' }, args: ['check'], exit: 0,
  },
};

// §1 deviation 1: generatedAt, timing, and every evidence object's log digest, head and tail.
function strip(text, { evidence = true } = {}) {
  const report = JSON.parse(text);
  delete report.generatedAt;
  delete report.timing;
  (function walk(v) {
    if (!v || typeof v !== 'object') return;
    if (evidence && v.evidence && typeof v.evidence === 'object') {
      for (const key of ['log_sha256', 'head', 'tail']) delete v.evidence[key];
    }
    Object.values(v).forEach(walk);
  })(report);
  return JSON.stringify(report, null, 2);
}

test('the fixtures cover every kind', () => {
  assert.deepEqual(Object.keys(FIXTURES), [...require('../src/instruments/vocab.cjs').KINDS]);
});

for (const [kind, fixture] of Object.entries(FIXTURES)) {
  test(`${kind}: two runs over one tree are byte-identical once the excluded fields are removed`, (t) => {
    const dir = repo(t, fixture.files);
    write(dir, fixture.work);
    const out = path.join(dir, '.cleancode', 'det');
    const run = (now) => {
      const r = cp.spawnSync(process.execPath, [BIN, kind, ...fixture.args, '--now', now, '--out', '.cleancode/det'],
        { cwd: dir, env: ENV, encoding: 'utf8', timeout: 120_000 });
      assert.equal(r.status, fixture.exit, `${kind} exited ${r.status}\n${r.stdout}\n${r.stderr}`);
      return fs.readFileSync(path.join(out, `${kind}.json`), 'utf8');
    };
    const first = run('2026-01-01T00:00:00Z');
    if (kind === 'barrier') fs.rmSync(path.join(out, 'barrier-cache.json'));
    const second = run('2026-01-02T00:00:00Z');
    assert.deepEqual([JSON.parse(first).generatedAt, JSON.parse(second).generatedAt],
      ['2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z']);
    assert.equal(strip(second), strip(first));
    if (kind === 'barrier') {
      assert.notEqual(strip(second, { evidence: false }), strip(first, { evidence: false }),
        'the tier log differs run to run, so the evidence exclusion is what makes the runs identical');
    }
    const schema = JSON.parse(fs.readFileSync(path.join(SKILL, 'schema', `${kind}.schema.json`), 'utf8'));
    assert.deepEqual(validate(schema, JSON.parse(first)), []);
  });
}

// B12: two runs that agree prove nothing about order, and a guard that writes, or a report kept in the
// repo, is exactly what could move the measured tree between runs. Names that a locale sort would order
// differently pin code-unit order in each kind's JSON; the command guard writes a new stamp on every run,
// and --out puts the report at the repo root.
const NAMES = ['B', 'Z', 'a', 'é'];
test('select and sweep list paths in code-unit order, and a writing guard or an --out at the repo root never moves the tree', (t) => {
  const stamp = `"${process.execPath}" -e "require('node:fs').writeFileSync('stamp.txt', String(process.hrtime.bigint()))"`;
  const dir = repo(t, {
    '.cleancode-gates.json': json({ guards: [
      { id: 'no-todo', kind: 'shape', class: CLASS, shape: { type: 'regex', files: ['src/**/*.ts'], pattern: 'TODO' } },
      { id: 'stamp', kind: 'command', class: CLASS, command: { cwd: '.', run: stamp, bound_minutes: 1 } }] }),
    ...Object.fromEntries(NAMES.flatMap((n) => [[`src/${n}.ts`, 'export const v = 1;\n'], [`spec/${n}.spec.ts`, `import { v } from '../src/${n}';\n`]])),
  });
  write(dir, Object.fromEntries(NAMES.map((n) => [`src/${n}.ts`, 'export const v = 2; // TODO\n'])));
  const head = cp.execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { env: ENV, encoding: 'utf8' }).trim();
  const run = (kind, args, now) => {
    const r = cp.spawnSync(process.execPath, [BIN, kind, ...args, '--now', now, '--out', '.'], { cwd: dir, env: ENV, encoding: 'utf8' });
    assert.equal(r.status, kind === 'sweep' ? 1 : 0, `${kind}: ${r.stdout}${r.stderr}`);
    fs.rmSync(path.join(dir, 'stamp.txt'), { force: true });
    return fs.readFileSync(path.join(dir, `${kind}.json`), 'utf8');
  };
  const select = ['--tests', 'spec/**/*.spec.ts', '--sources', 'src/**/*.ts'];
  const [sweep1, select1] = [run('sweep', ['--all'], '2026-01-01T00:00:00Z'), run('select', select, '2026-01-01T00:00:00Z')];
  const [sweep2, select2] = [run('sweep', ['--all'], '2026-01-02T00:00:00Z'), run('select', select, '2026-01-02T00:00:00Z')];
  assert.equal(strip(sweep2), strip(sweep1), 'neither the stamp nor the previous report is in the second run\'s tree');
  assert.equal(strip(select2), strip(select1));
  const [sw, se] = [JSON.parse(sweep1), JSON.parse(select1)];
  assert.equal(sw.tree.candidateTree, se.tree.candidateTree);
  assert.deepEqual(se.changed, NAMES.map((n) => `src/${n}.ts`));
  assert.deepEqual(se.selection.selected.map((s) => s.file), NAMES.map((n) => `spec/${n}.spec.ts`));
  assert.deepEqual(sw.guards.find((g) => g.id === 'no-todo').hits.map((h) => h.file), NAMES.map((n) => `src/${n}.ts`));
  assert.notDeepEqual([...NAMES].sort((x, y) => x.localeCompare(y)), NAMES);
  write(dir, { 'stamp.txt': 'x' });
  assert.notEqual(JSON.parse(run('select', select, '2026-01-03T00:00:00Z')).tree.candidateTree, se.tree.candidateTree,
    'a file the runs did not write still counts');
  assert.ok(head);
});
