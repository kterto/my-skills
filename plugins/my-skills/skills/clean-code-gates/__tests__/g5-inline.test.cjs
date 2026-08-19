const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { scanNoComments } = require('../src/gates/g5-no-comments.cjs');
const { run } = require('../src/run.cjs');

const scan = (content, file = 'src/x.ts') => scanNoComments({ file, content });
const pad = (lines) => ['const p1 = 1;', 'const p2 = 2;', 'const p3 = 3;', 'const p4 = 4;', 'const p5 = 5;', ...lines].join('\n') + '\n';

// Every recogniser was ^-anchored, so a comment that did not start the line was
// invisible — the most common shape a what-comment actually takes.
test('flags an inline trailing // comment', () => {
  const f = scan(pad(['const a = 1; // increment']));
  assert.strictEqual(f.length, 1, JSON.stringify(f));
  assert.strictEqual(f[0].line, 6);
});

test('flags an inline /* */ comment', () => {
  const f = scan(pad(['const a = 1; /* why */ const b = 2;']));
  assert.strictEqual(f.length, 1, JSON.stringify(f));
});

test('flags an inline /** */ block that is not a leading doc comment', () => {
  const f = scan(pad(['const a = 1; /** not a doc block */']));
  assert.strictEqual(f.length, 1, JSON.stringify(f));
});

test('flags an inline /// that is not a leading Dart doc comment', () => {
  const f = scan(pad(['final a = 1; /// not a doc comment']), 'lib/x.dart');
  assert.strictEqual(f.length, 1, JSON.stringify(f));
});

// --- string awareness ---------------------------------------------------

test('comment delimiters inside a single-quoted string are not comments', () => {
  assert.deepStrictEqual(scan(pad(["const url = 'https://example.com/a';"])), []);
});

test('comment delimiters inside a double-quoted string are not comments', () => {
  assert.deepStrictEqual(scan(pad(['const s = "a // b /* c */ d";'])), []);
});

test('comment delimiters inside a template literal are not comments', () => {
  assert.deepStrictEqual(scan(pad(['const s = `a // b`;'])), []);
});

test('a template literal spanning lines shields its contents', () => {
  assert.deepStrictEqual(scan(pad(['const s = `line one', '// still inside the template', '`;'])), []);
});

test('comment delimiters inside a Dart character/raw string are not comments', () => {
  assert.deepStrictEqual(scan(pad(["final s = r'a // b';"]), 'lib/x.dart'), []);
});

test("a Dart triple-quoted string spanning lines shields its contents", () => {
  assert.deepStrictEqual(scan(pad(["final s = '''", '// inside', "''';"]), 'lib/x.dart'), []);
});

test('an escaped quote does not end the string early', () => {
  assert.deepStrictEqual(scan(pad(['const s = "a \\" // still a string";'])), []);
});

test('a regex literal containing slashes is not a comment', () => {
  assert.deepStrictEqual(scan(pad(['const re = /a\\/\\/b/;'])), []);
});

test('a division is not mistaken for a regex', () => {
  const f = scan(pad(['const a = b / c; // ratio']));
  assert.strictEqual(f.length, 1, JSON.stringify(f));
});

// `+` and `-` legitimately precede a regex (`a + /re/.test(s)`), so they stay in
// REGEX_PRECEDERS — but after a postfix `++`/`--` the operand is complete and the
// `/` is division. Lexed as a regex opener it swallowed the trailing `//`, and
// the comment was never seen.
test('a division after a postfix ++ does not swallow the trailing comment', () => {
  const f = scan(pad(['i++ / 2; // c']));
  assert.strictEqual(f.length, 1, JSON.stringify(f));
});

test('a division after a postfix -- does not swallow the trailing comment', () => {
  const f = scan(pad(['i-- / 2; // c']));
  assert.strictEqual(f.length, 1, JSON.stringify(f));
});

test('a regex after a binary + is still a regex, not a division', () => {
  assert.deepStrictEqual(scan(pad(['const ok = a + /re/.test(s);'])), []);
});

test('a trailing comment after a + division is still flagged', () => {
  assert.strictEqual(scan(pad(['const x = a + b / c; // c'])).length, 1);
});

test('a trailing comment after a - division is still flagged', () => {
  assert.strictEqual(scan(pad(['const x = a - b / c; // c'])).length, 1);
});

test('a trailing comment after a * division is still flagged', () => {
  assert.strictEqual(scan(pad(['const t = a * b / c; // m'])).length, 1);
});

// --- allowances, position-sensitive ------------------------------------

test('a leading /// Dart doc is still allowed', () => {
  assert.deepStrictEqual(scan(pad(['  /// A widget.', 'class W {}']), 'lib/x.dart'), []);
});

test('a leading /** */ doc block is still allowed, including multi-line', () => {
  assert.deepStrictEqual(scan(pad(['/** Public API.', ' * More.', ' */', 'export function f(){}'])), []);
});

test('plan-ID citations and TODO(REF) are allowed anywhere on the line', () => {
  assert.deepStrictEqual(scan(pad(['  // FEAT-010 / SPEC-009: dispatch', '  // TODO(REF): FIX-003'])), []);
  assert.deepStrictEqual(scan(pad(['const a = 1; // FEAT-20260819T001630Z-be84 pins this'])), []);
});

test('analyzer directives are allowed anywhere on the line', () => {
  assert.deepStrictEqual(scan(pad(['  // ignore: invalid_use_of_protected_member', '// ignore_for_file: type=lint']), 'lib/x.dart'), []);
  assert.deepStrictEqual(scan(pad(['final a = 1; // ignore: foo']), 'lib/x.dart'), []);
});

test('an unindented licence banner in the first 5 lines is allowed', () => {
  assert.deepStrictEqual(scan('// Copyright 2026 Opus\n// MIT\nexport const a = 1;\n'), []);
});

test('an indented banner-shaped comment in the header zone is still a finding', () => {
  assert.strictEqual(scan('  // not a banner\nexport const a = 1;\n').length, 1);
});

test('an unindented // past the header zone is a finding', () => {
  assert.strictEqual(scan(pad(['// too late for a banner'])).length, 1);
});

// --- G5 runs only over source files of the detected stack ---------------

test('G5 skips files that are not source files of the detected stack', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-g5-'));
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'src', 'notes.md'), 'Run `a // b` and /* c */\n');
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  const { report, exitCode } = run({
    root: d,
    options: { scope: { kind: 'files', files: ['src/notes.md', 'src/a.ts'] }, gates: ['G5'], skip: [], out: '-', scaffold: false, requireTools: false },
    io: { now: 'n', version: 'v' },
  });
  assert.deepStrictEqual(report.gates.find((g) => g.gate === 'G5').findings, []);
  assert.strictEqual(exitCode, 0);
});
