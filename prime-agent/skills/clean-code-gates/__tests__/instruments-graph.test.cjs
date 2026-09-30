'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildGraph, shortestChain, importersOf } = require('../src/instruments/graph.cjs');

// Builds a throwaway tree and hands buildGraph exactly the files written,
// plus any `extra` paths (a path listed but absent on disk is a deleted file).
function graphOf(t, files, extra = []) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-graph-'));
  t.after(() => fs.promises.rm(root, { recursive: true, force: true, maxRetries: 5 }));
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.join(root, path.dirname(rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), text);
  }
  return buildGraph(root, [...Object.keys(files), ...extra].sort());
}

const edgesOf = (g, file) => g.edges.get(file) || [];

test('relative imports and re-exports become edges carrying the line of their statement', (t) => {
  const g = graphOf(t, {
    'src/a.ts': "import { b } from './b';\nimport './side';\nexport { c } from '../lib/c';\nimport {\n  d,\n} from './d';\n",
    'src/b.ts': '', 'src/side.ts': '', 'lib/c.ts': '', 'src/d.ts': '',
  });
  assert.deepEqual(edgesOf(g, 'src/a.ts'), [
    { to: 'lib/c.ts', line: 3 }, { to: 'src/b.ts', line: 1 }, { to: 'src/d.ts', line: 4 }, { to: 'src/side.ts', line: 2 },
  ]);
  assert.deepEqual(g.rev.get('src/b.ts'), [{ from: 'src/a.ts', line: 1 }]);
});

test('tsconfig paths come from JSONC through one level of extends, and baseUrl resolves the rest', (t) => {
  const g = graphOf(t, {
    'api/tsconfig.base.json': '{\n  "$schema": "https://json.schemastore.org/tsconfig", // shared\n  "compilerOptions": {\n'
      + '    "baseUrl": "./",\n    /* alias */\n    "paths": { "@/*": ["./src/*"], },\n    /* end */\n  },\n}\n',
    'api/tsconfig.json': '{ "extends": "./tsconfig.base", "compilerOptions": { "strict": true, }, }\n',
    'api/src/widgets/widget.ts': '', 'api/src/widgets/view.ts': '',
    'api/test/widget.spec.ts': "import { W } from '@/widgets/widget';\nimport { V } from 'src/widgets/view';\nimport { I } from '@nestjs/common';\n",
  });
  assert.deepEqual(edgesOf(g, 'api/test/widget.spec.ts'), [
    { to: 'api/src/widgets/view.ts', line: 2 }, { to: 'api/src/widgets/widget.ts', line: 1 },
  ]);
  assert.equal(g.unresolved.get('api/test/widget.spec.ts') || 0, 0, 'a bare package is ignored, not unresolved');
});

test("an extended tsconfig's baseUrl resolves against that file's own directory", (t) => {
  const g = graphOf(t, {
    'shared/tsconfig.paths.json': '{ "compilerOptions": { "baseUrl": ".", "paths": { "@shared/*": ["lib/*"] } } }',
    'shared/lib/clock.ts': '',
    'web/tsconfig.json': '{ "extends": "../shared/tsconfig.paths.json" }',
    'web/src/app.ts': "import { now } from '@shared/clock';\n",
  });
  assert.deepEqual(edgesOf(g, 'web/src/app.ts'), [{ to: 'shared/lib/clock.ts', line: 1 }]);
});

test('paths resolve as tsc does: an exact pattern first, else the longest prefix, its substitutions tried in order', (t) => {
  const g = graphOf(t, {
    'tsconfig.json': '{ "compilerOptions": { "paths": { "*": ["types/*"], "@app/*": ["gen/*", "src/*"], "@app/widgets/*": ["legacy/*"],'
      + ' "@app/widgets/main": ["entry/main"] } } }',
    'gen/order.ts': '', 'src/order.ts': '', 'src/widgets/view.ts': '', 'legacy/view.ts': '', 'legacy/main.ts': '', 'entry/main.ts': '',
    'types/note.ts': '',
    'x.ts': "import '@app/order';\nimport '@app/widgets/view';\nimport '@app/widgets/main';\nimport 'note';\n",
  });
  assert.deepEqual(edgesOf(g, 'x.ts'), [{ to: 'entry/main.ts', line: 3 }, { to: 'gen/order.ts', line: 1 }, { to: 'legacy/view.ts', line: 2 },
    { to: 'types/note.ts', line: 4 }]);
});

test('a NodeNext specifier names the emitted file: ./x.js reaches x.ts or x.tsx, .mjs reaches .mts, .cjs reaches .cts', (t) => {
  const g = graphOf(t, {
    'src/a.ts': "import './b.js';\nimport './c.js';\nimport './d.mjs';\nimport './e.cjs';\nimport './f.js';\n",
    'src/b.ts': '', 'src/c.tsx': '', 'src/d.mts': '', 'src/e.cts': '', 'src/f.js': '', 'src/f.ts': '',
  });
  assert.deepEqual(edgesOf(g, 'src/a.ts'), [{ to: 'src/b.ts', line: 1 }, { to: 'src/c.tsx', line: 2 }, { to: 'src/d.mts', line: 3 },
    { to: 'src/e.cts', line: 4 }, { to: 'src/f.js', line: 5 }]);
  assert.equal(g.unresolved.get('src/a.ts') || 0, 0);
});

test('a tsconfig saved with a UTF-8 BOM still resolves its paths', (t) => {
  const g = graphOf(t, {
    'tsconfig.json': '﻿{ "compilerOptions": { "baseUrl": ".", "paths": { "@/*": ["src/*"] } } }',
    'src/widget.ts': '', 'test/widget.spec.ts': "import { w } from '@/widget';\n",
  });
  assert.deepEqual(edgesOf(g, 'test/widget.spec.ts'), [{ to: 'src/widget.ts', line: 1 }]);
});

test('a bare specifier naming a workspace package counts as unresolved; a third-party package is still ignored', (t) => {
  const g = graphOf(t, {
    'packages/shared/package.json': '{ "name": "@acme/shared", "main": "src/money.js" }', 'packages/shared/src/money.js': '',
    'packages/util/package.json': '{ "name": "widget-util" }',
    'apps/web/test/money.test.js': "const m = require('@acme/shared');\nimport 'widget-util/lib/x';\nimport 'lodash';\nimport '@nestjs/common';\n",
  });
  assert.equal(g.unresolved.get('apps/web/test/money.test.js'), 2);
});

test('a directory specifier resolves to its index file', (t) => {
  const g = graphOf(t, { 'src/a.ts': "import { x } from './lib';\n", 'src/lib/index.ts': '' });
  assert.deepEqual(edgesOf(g, 'src/a.ts'), [{ to: 'src/lib/index.ts', line: 1 }]);
});

test('require, dynamic import and jest.mock are specifiers too', (t) => {
  const g = graphOf(t, {
    'src/a.spec.ts': "const a = require('./a');\njest.mock('./b', () => ({}));\nconst c = await import('./c');\n",
    'src/a.ts': '', 'src/b.ts': '', 'src/c.js': '',
  });
  assert.deepEqual(edgesOf(g, 'src/a.spec.ts'), [
    { to: 'src/a.ts', line: 1 }, { to: 'src/b.ts', line: 2 }, { to: 'src/c.js', line: 3 },
  ]);
});

test('Dart package: imports and exports resolve across the repo packages named by their pubspec', (t) => {
  const g = graphOf(t, {
    'core/pubspec.yaml': 'name: widget_core\n',
    'core/lib/order.dart': '', 'core/lib/src/money.dart': '',
    'app/pubspec.yaml': 'name: widget_app\ndependencies:\n  widget_core:\n    path: ../core\n',
    'app/lib/widget.dart': "import 'package:widget_core/order.dart';\nimport 'package:flutter/material.dart';\nimport 'dart:async';\n"
      + "export 'package:widget_core/src/money.dart' show Money;\n",
    'app/test/widget_test.dart': "import 'package:widget_app/widget.dart';\nimport \"support/harness.dart\" as h;\n",
    'app/test/support/harness.dart': '',
  });
  assert.deepEqual(edgesOf(g, 'app/lib/widget.dart'), [{ to: 'core/lib/order.dart', line: 1 }, { to: 'core/lib/src/money.dart', line: 4 }]);
  assert.deepEqual(edgesOf(g, 'app/test/widget_test.dart'), [
    { to: 'app/lib/widget.dart', line: 1 }, { to: 'app/test/support/harness.dart', line: 2 },
  ]);
  assert.equal(g.unresolved.get('app/lib/widget.dart') || 0, 0, 'an SDK or third-party package is ignored');
});

test('part links a library and its part both ways, with or without a part-of URI', (t) => {
  const g = graphOf(t, {
    'lib/model.dart': "import 'x.dart';\npart 'model.g.dart';\n",
    'lib/model.g.dart': "part of 'model.dart';\n",
    'lib/x.dart': '',
    'lib/legacy.dart': "part 'legacy.part.dart';\n",
    'lib/legacy.part.dart': 'part of legacy;\n',
  });
  assert.deepEqual(edgesOf(g, 'lib/model.dart'), [{ to: 'lib/model.g.dart', line: 2 }, { to: 'lib/x.dart', line: 1 }]);
  assert.deepEqual(edgesOf(g, 'lib/model.g.dart'), [{ to: 'lib/model.dart', line: 1 }]);
  assert.deepEqual(edgesOf(g, 'lib/legacy.part.dart').map(e => e.to), ['lib/legacy.dart']);
});

test('a listed file absent from disk is a deleted target: the edge to it is marked missing', (t) => {
  const g = graphOf(t, { 'src/a.ts': "import { gone } from './gone';\n" }, ['src/gone.ts']);
  assert.deepEqual(edgesOf(g, 'src/a.ts'), [{ to: 'src/gone.ts', line: 1, missing: true }]);
  assert.deepEqual(g.rev.get('src/gone.ts'), [{ from: 'src/a.ts', line: 1 }]);
});

test('a data file a test imports is a leaf target, not an unresolved specifier', (t) => {
  const g = graphOf(t, { 'src/a.ts': "import data from './fixtures/widgets.json';\n", 'src/fixtures/widgets.json': '{}' });
  assert.deepEqual(edgesOf(g, 'src/a.ts'), [{ to: 'src/fixtures/widgets.json', line: 1 }]);
});

test('specifiers that resolve nowhere are counted per file', (t) => {
  const g = graphOf(t, {
    'tsconfig.json': '{ "compilerOptions": { "paths": { "@/*": ["src/*"] } } }',
    'src/a.ts': "import './nope';\nimport { m } from '@/missing';\nimport _ from 'lodash';\n",
    'lib/w.dart': "import 'gone.dart';\n",
  });
  assert.deepEqual(edgesOf(g, 'src/a.ts'), []);
  assert.equal(g.unresolved.get('src/a.ts'), 2);
  assert.equal(g.unresolved.get('lib/w.dart'), 1);
});

// a → b → t, a → m → t2, m is skipped: the walks below pin the chain shape and the skip rule.
function chainGraph(t) {
  return graphOf(t, {
    'a.ts': "import './b';\nimport './m';\n",
    'b.ts': "import './t';\n",
    'm.ts': "import './t2';\n",
    't.ts': '', 't2.ts': '',
  });
}

test('shortestChain walks forward to the nearest target and refuses to pass a skipped file', (t) => {
  const g = chainGraph(t);
  assert.deepEqual(shortestChain(g, 'a.ts', new Set(['t.ts'])), ['a.ts', 'b.ts', 't.ts']);
  assert.deepEqual(shortestChain(g, 'a.ts', new Set(['t2.ts'])), ['a.ts', 'm.ts', 't2.ts']);
  assert.equal(shortestChain(g, 'a.ts', new Set(['t2.ts']), { skip: f => f === 'm.ts' }), null);
  assert.deepEqual(shortestChain(g, 'a.ts', new Set(['m.ts']), { skip: f => f === 'm.ts' }), ['a.ts', 'm.ts'],
    'skip never applies to a target');
  assert.deepEqual(shortestChain(g, 't.ts', new Set(['t.ts'])), ['t.ts']);
});

test('both walks keep the shortest chain when a longer one is met first', (t) => {
  const g = graphOf(t, { 'z.ts': "import './c';\nimport './t';\n", 'c.ts': "import './b';\n", 'b.ts': "import './t';\n", 't.ts': '' });
  assert.deepEqual(shortestChain(g, 'z.ts', new Set(['t.ts'])), ['z.ts', 't.ts']);
  assert.deepEqual(importersOf(g, new Set(['t.ts'])).get('z.ts'), ['z.ts', 't.ts']);
});

test('importersOf maps every importer to its chain, records a skipped importer, and walks no further', (t) => {
  const g = chainGraph(t);
  const all = importersOf(g, new Set(['t.ts', 't2.ts']));
  assert.deepEqual(all, new Map([['a.ts', ['a.ts', 'b.ts', 't.ts']], ['b.ts', ['b.ts', 't.ts']], ['m.ts', ['m.ts', 't2.ts']]]));
  const skipped = importersOf(g, new Set(['t2.ts']), { skip: f => f === 'm.ts' });
  assert.deepEqual(skipped, new Map([['m.ts', ['m.ts', 't2.ts']]]));
  const target = importersOf(g, new Set(['m.ts']), { skip: f => f === 'm.ts' });
  assert.deepEqual(target, new Map([['a.ts', ['a.ts', 'm.ts']]]), 'a skipped target is still walked from');
});
