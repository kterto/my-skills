const { test } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { realGitDiff } = require('../src/scope.cjs');
const { parseArgs, parseScope } = require('../src/args.cjs');

const BIN = path.join(__dirname, '..', 'bin', 'gates.cjs');

function repo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-baseref-'));
  const git = (args) => cp.execFileSync('git', ['-C', d, ...args], { stdio: 'ignore' });
  git(['init', '-q']);
  git(['config', 'user.email', 't@t.t']);
  git(['config', 'user.name', 't']);
  fs.mkdirSync(path.join(d, 'src'), { recursive: true });
  fs.writeFileSync(path.join(d, 'package.json'), '{}');
  fs.writeFileSync(path.join(d, 'tsconfig.json'), '{}');
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 1;\n');
  git(['add', '-A']);
  git(['commit', '-qm', 'base']);
  return d;
}

test('a command-substitution base ref executes nothing and is rejected', () => {
  const d = repo();
  const sentinel = path.join(d, 'PWNED');
  const payload = `$(touch ${sentinel})`;
  assert.throws(() => realGitDiff(d)(payload), /base ref/i);
  assert.strictEqual(fs.existsSync(sentinel), false, 'the injected command must never run');
});

test('a backtick base ref executes nothing and is rejected', () => {
  const d = repo();
  const sentinel = path.join(d, 'PWNED2');
  assert.throws(() => realGitDiff(d)('HEAD`touch ' + sentinel + '`'), /base ref/i);
  assert.strictEqual(fs.existsSync(sentinel), false, 'the injected command must never run');
});

test('parseScope rejects a base ref carrying shell metacharacters', () => {
  assert.throws(() => parseScope('diff:$(id)'), /base ref/i);
  assert.throws(() => parseArgs(['--scope', 'diff:a;rm -rf /']), /base ref/i);
  assert.throws(() => parseArgs(['--scope', 'diff:a b']), /base ref/i);
});

test('parseScope rejects a base ref with a leading dash', () => {
  assert.throws(() => parseScope('diff:--upload-pack=evil'), /base ref/i);
});

test('parseScope accepts ordinary git revision syntax', () => {
  assert.deepStrictEqual(parseScope('diff:origin/main'), { kind: 'diff', baseRef: 'origin/main' });
  assert.deepStrictEqual(parseScope('diff:HEAD~2'), { kind: 'diff', baseRef: 'HEAD~2' });
  assert.deepStrictEqual(parseScope('diff:v1.0.0^'), { kind: 'diff', baseRef: 'v1.0.0^' });
  assert.deepStrictEqual(parseScope('diff:@{u}'), { kind: 'diff', baseRef: '@{u}' });
});

test('a base ref that does not resolve throws instead of yielding an empty scope', () => {
  const d = repo();
  assert.throws(() => realGitDiff(d)('no/such/ref'), /base ref/i);
});

// The failure must be a usage/config error, not a green run over zero files.
test('an unresolvable base ref exits 3 and never reports a green pass', () => {
  const d = repo();
  const r = cp.spawnSync(process.execPath, [BIN, '--scope', 'diff:no/such/ref', '--out', '-'],
    { cwd: d, encoding: 'utf8' });
  assert.strictEqual(r.status, 3);
  assert.match(r.stderr, /base ref/i);
  assert.doesNotMatch(r.stdout, /"status": "pass"/);
});

test('a tainted base ref exits 3 at argument parsing', () => {
  const d = repo();
  const r = cp.spawnSync(process.execPath, [BIN, '--scope', 'diff:$(touch PWNED3)', '--out', '-'],
    { cwd: d, encoding: 'utf8' });
  assert.strictEqual(r.status, 3);
  assert.strictEqual(fs.existsSync(path.join(d, 'PWNED3')), false);
});

test('a valid base ref still resolves the diff scope', () => {
  const d = repo();
  fs.writeFileSync(path.join(d, 'src', 'a.ts'), 'export const a = 2;\n');
  const head = cp.execFileSync('git', ['-C', d, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.ok(realGitDiff(d)(head).includes('src/a.ts'));
});
