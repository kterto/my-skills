const { test } = require('node:test');
const assert = require('node:assert');
const { scanNoComments } = require('../src/gates/g5-no-comments.cjs');

test('flags a what-comment inside a function body', () => {
  const f = scanNoComments({ file: 'x.ts', content: 'function a(){\n  // increment the counter\n  i++;\n}\n' });
  assert.strictEqual(f.length, 1);
  assert.strictEqual(f[0].line, 2);
  assert.strictEqual(f[0].severity, 'blocker');
});

test('allows /// doc comment (Dart) and /** */ (TS)', () => {
  assert.deepStrictEqual(scanNoComments({ file: 'x.dart', content: '/// A widget.\nclass W {}\n' }), []);
  assert.deepStrictEqual(scanNoComments({ file: 'x.ts', content: '/** Public API. */\nexport function f(){}\n' }), []);
});

test('allows plan-ID citations and TODO(REF)', () => {
  const ok = '  // FEAT-010 / SPEC-009: dispatch\n  // TODO(REF): FIX-003\n';
  assert.deepStrictEqual(scanNoComments({ file: 'x.ts', content: ok }), []);
});

test('allows Dart analyzer ignore directives past the header zone', () => {
  const content = [
    'final a = 1;', 'final b = 2;', 'final c = 3;', 'final d = 4;', 'final e = 5;',
    '  // ignore: invalid_use_of_protected_member',
    '  foo();',
    '// ignore_for_file: type=lint',
  ].join('\n') + '\n';
  assert.deepStrictEqual(scanNoComments({ file: 'x.dart', content }), []);
});

test('allows a top license/header banner (<=5 lines)', () => {
  assert.deepStrictEqual(scanNoComments({ file: 'x.ts', content: '// Copyright 2026 Opus\n// MIT\nexport const a = 1;\n' }), []);
});

test('flags a block /* */ comment in a body', () => {
  const f = scanNoComments({ file: 'x.ts', content: 'const a = 1;\n/* explain */\nconst b = 2;\n' });
  assert.strictEqual(f.length, 1);
});

test('multi-line plain block comment: exactly 1 finding (open line only); interior // and body not double-flagged', () => {
  // Enough leading code lines so we are PAST the 5-line header zone (idx < 5).
  // The /* opens at line 6 (idx=5). Interior line 7 starts with // which would be
  // a LINE_COMMENT hit if inDocBlock is incorrectly left false after pushing the finding.
  const content = [
    'const a = 1;',
    'const b = 2;',
    'const c = 3;',
    'const d = 4;',
    'const e = 5;',
    '/* line A',
    '// inner comment that must not be flagged',
    'done */',
    'const x = 1;',
  ].join('\n') + '\n';
  const findings = scanNoComments({ file: 'x.ts', content });
  assert.strictEqual(findings.length, 1, `expected 1 finding but got ${findings.length}: ${JSON.stringify(findings)}`);
  assert.strictEqual(findings[0].line, 6, 'finding should be on the /* open line');
});
