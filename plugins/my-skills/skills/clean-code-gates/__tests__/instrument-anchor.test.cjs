const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadConfig } = require('../src/config.cjs');
const { formatInstrumentLine } = require('../src/instrument.cjs');

// The instrument lives inside the tree it measures. `.cleancode-gates.json` is
// deep-merged user-wins and auto-written into the repo, so a branch can widen
// `exempt`, drop a root, or lower a threshold as part of the very change under
// review and the gates report a green it did not earn. These tests pin the
// merge-base anchor: the anchored fields are read from `$mb`, the run happens
// on those values, and every move is named out loud.

function tmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-anchor-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  return d;
}

function writeWorking(d, cfg) {
  fs.writeFileSync(path.join(d, '.cleancode-gates.json'), JSON.stringify(cfg));
}

/** A `git show <ref>:<file>` stand-in: the merge-base copy, or null when absent there. */
function base(cfg) {
  return () => (cfg === null ? null : JSON.stringify(cfg));
}

const NODE = (gates, extra = {}) => ({
  schemaVersion: '1.0',
  stacks: { 'node-ts': { gates, ...extra } },
});

test('without a base ref nothing is anchored and the config resolves exactly as before', () => {
  const d = tmp();
  writeWorking(d, NODE({ G1: { thresholds: { statements: 60 } } }));
  const cfg = loadConfig(d, ['node-ts']);
  assert.strictEqual(cfg.stacks['node-ts'].gates.G1.thresholds.statements, 60);
  assert.strictEqual(cfg.instrument.anchored, false);
  assert.deepStrictEqual(cfg.instrument.moves, []);
});

test('a lowered coverage threshold runs on the merge-base value and is reported as loosening', () => {
  const d = tmp();
  writeWorking(d, NODE({ G1: { thresholds: { statements: 60 } } }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: base(NODE({ G1: { thresholds: { statements: 85 } } })),
  });
  assert.strictEqual(cfg.stacks['node-ts'].gates.G1.thresholds.statements, 85);
  assert.deepStrictEqual(cfg.instrument.moves, [{
    key: 'node-ts.gates.G1.thresholds.statements',
    from: 85, to: 60, direction: 'loosening',
  }]);
});

test('a raised complexity ceiling is loosening; a lowered one is tightening', () => {
  const d = tmp();
  writeWorking(d, NODE({ G2: { thresholds: { complexity: 20, maxDepth: 1 } } }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: base(NODE({ G2: { thresholds: { complexity: 8, maxDepth: 2 } } })),
  });
  const dirs = Object.fromEntries(cfg.instrument.moves.map(m => [m.key, m.direction]));
  assert.strictEqual(dirs['node-ts.gates.G2.thresholds.complexity'], 'loosening');
  assert.strictEqual(dirs['node-ts.gates.G2.thresholds.maxDepth'], 'tightening');
  assert.strictEqual(cfg.stacks['node-ts'].gates.G2.thresholds.complexity, 8);
  assert.strictEqual(cfg.stacks['node-ts'].gates.G2.thresholds.maxDepth, 2);
});

test('exemptions added on the branch are not honoured and are counted in the move', () => {
  const d = tmp();
  writeWorking(d, NODE({ G2: { exempt: ['src/a.ts', 'src/b.ts', 'src/c.ts'] } }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: base(NODE({ G2: { exempt: [] } })),
  });
  assert.deepStrictEqual(cfg.stacks['node-ts'].gates.G2.exempt, []);
  const move = cfg.instrument.moves.find(m => m.key === 'node-ts.gates.G2.exempt');
  assert.deepStrictEqual(move, {
    key: 'node-ts.gates.G2.exempt', added: 3, removed: 0, direction: 'loosening',
  });
});

test('a stack-wide exclude added on the branch is refused the same way', () => {
  const d = tmp();
  writeWorking(d, NODE({}, { exclude: ['**/*.d.ts', 'src/legacy/**'] }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: base(NODE({}, { exclude: ['**/*.d.ts'] })),
  });
  assert.ok(!cfg.stacks['node-ts'].exclude.includes('src/legacy/**'));
  const move = cfg.instrument.moves.find(m => m.key === 'node-ts.exclude');
  assert.strictEqual(move.direction, 'loosening');
  assert.strictEqual(move.added, 1);
});

test('a root removed on the branch is restored — dropping a root drops the code from measurement', () => {
  const d = tmp();
  writeWorking(d, NODE({}, { roots: ['src'] }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: base(NODE({}, { roots: ['src', 'packages/api/src'] })),
  });
  assert.deepStrictEqual(cfg.stacks['node-ts'].roots, ['src', 'packages/api/src']);
  const move = cfg.instrument.moves.find(m => m.key === 'node-ts.roots');
  assert.deepStrictEqual(move, { key: 'node-ts.roots', added: 0, removed: 1, direction: 'loosening' });
});

test('a root added on the branch is honoured at the base value and reported as tightening', () => {
  const d = tmp();
  writeWorking(d, NODE({}, { roots: ['src', 'tools/src'] }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: base(NODE({}, { roots: ['src'] })),
  });
  assert.deepStrictEqual(cfg.stacks['node-ts'].roots, ['src']);
  assert.strictEqual(cfg.instrument.moves.find(m => m.key === 'node-ts.roots').direction, 'tightening');
});

test('keys that are not instruments keep reading from the working tree', () => {
  const d = tmp();
  writeWorking(d, NODE({ G6: { tool: 'stryker', runner: 'vitest', budget: { totalSeconds: 90 } } },
    { baseline: '.eslint-baseline.json' }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: base(NODE({ G6: { tool: 'stryker', runner: 'jest' } })),
  });
  assert.strictEqual(cfg.stacks['node-ts'].gates.G6.runner, 'vitest');
  assert.strictEqual(cfg.stacks['node-ts'].gates.G6.budget.totalSeconds, 90);
  assert.strictEqual(cfg.instrument.moves.length, 0);
});

test('no config at the merge-base anchors to the built-in defaults, never to the working tree', () => {
  const d = tmp();
  writeWorking(d, NODE({ G1: { thresholds: { statements: 10 } } }));
  const cfg = loadConfig(d, ['node-ts'], { baseRef: 'mb', readBase: base(null) });
  assert.strictEqual(cfg.instrument.source, 'defaults');
  assert.strictEqual(cfg.stacks['node-ts'].gates.G1.thresholds.statements, 85);
  assert.strictEqual(cfg.instrument.moves[0].direction, 'loosening');
});

test('an unparseable config at the merge-base fails closed to the defaults, not to the branch', () => {
  const d = tmp();
  writeWorking(d, NODE({ G1: { thresholds: { statements: 10 } } }));
  const cfg = loadConfig(d, ['node-ts'], { baseRef: 'mb', readBase: () => '{ not json' });
  assert.strictEqual(cfg.instrument.source, 'defaults');
  assert.strictEqual(cfg.stacks['node-ts'].gates.G1.thresholds.statements, 85);
});

test('an instrument that did not move produces no line at all', () => {
  const d = tmp();
  writeWorking(d, NODE({ G1: { thresholds: { statements: 85 } } }));
  const cfg = loadConfig(d, ['node-ts'], {
    baseRef: 'mb', readBase: base(NODE({ G1: { thresholds: { statements: 85 } } })),
  });
  assert.deepStrictEqual(cfg.instrument.moves, []);
  assert.strictEqual(formatInstrumentLine(cfg.instrument), null);
});

test('the moved line names every key, its direction, and what the run was measured against', () => {
  const line = formatInstrumentLine({
    anchored: true, baseRef: 'origin/main', source: 'merge-base',
    moves: [
      { key: 'node-ts.gates.G2.exempt', added: 3, removed: 0, direction: 'loosening' },
      { key: 'node-ts.gates.G1.thresholds.statements', from: 85, to: 60, direction: 'loosening' },
    ],
  });
  assert.strictEqual(line,
    'INSTRUMENT MOVED — node-ts.gates.G2.exempt +3 globs (loosening), '
    + 'node-ts.gates.G1.thresholds.statements 85 → 60 (loosening) '
    + '— measured against merge-base (origin/main) values');
});
