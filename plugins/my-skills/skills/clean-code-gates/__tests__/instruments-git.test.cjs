'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { ignoreDesktopLitter } = require('./helpers/git-fixture.cjs');

// The helpers under test call git in this process: keep the developer's config
// out, and stop discovery at the temp dir so "not a repo" means not a repo.
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_CEILING_DIRECTORIES = `${os.tmpdir()}:${fs.realpathSync(os.tmpdir())}`;

const G = require('../src/instruments/git.cjs');

const ENV = { ...process.env, GIT_AUTHOR_NAME: 'a', GIT_AUTHOR_EMAIL: 'a@example.test',
  GIT_COMMITTER_NAME: 'a', GIT_COMMITTER_EMAIL: 'a@example.test' };

function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

function tmp(t, prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 5 }));
  return dir;
}

function repo(t, files, branch = 'main') {
  const dir = tmp(t, 'ccg-git-');
  const git = (...args) => cp.execFileSync('git', ['-C', dir, ...args], { env: ENV, encoding: 'utf8' }).trim();
  git('init', '-q', '--template=', '-b', branch);
  git('config', 'commit.gpgsign', 'false');
  ignoreDesktopLitter(dir);
  write(dir, files);
  git('add', '-A');
  git('commit', '-qm', 'base');
  return { dir, git };
}

const GLOB_CASES = [
  ['a/**/b.ts', 'a/b.ts', true],
  ['a/**/b.ts', 'a/x/y/b.ts', true],
  ['a/**/b.ts', 'b.ts', false],
  ['a/**/b.ts', 'ab/b.ts', false],
  ['a/**/b.ts', 'a/b.tsx', false],
  ['**/.cleancode/**', '.cleancode/x.json', true],
  ['**/.cleancode/**', 'apps/x/.cleancode/r.json', true],
  ['**/.cleancode/**', '.cleancode-gates.json', false],
  ['**/.cleancode/**', 'apps/x/.cleancode-gates.json', false],
  ['src/*.ts', 'src/a.ts', true],
  ['src/*.ts', 'src/x/a.ts', false],
  ['*.ts', 'a.ts', true],
  ['*.ts', 'src/deep/a.ts', true],
  ['*.ts', 'a.tsx', false],
  ['a/**', 'a/x', true],
  ['a/**', 'a/x/y', true],
  ['a/**', 'a', false],
  ['a/**', 'ab/x', false],
  ['src/**/*.ts', 'src/main.ts', true],
  ['test/**/*.e2e-spec.ts', 'test/widget.e2e-spec.ts', true],
  ['a.b', 'axb', false],
  ['a?.ts', 'ab.ts', true],
  ['a?.ts', 'a/.ts', false],
];

for (const [glob, file, expected] of GLOB_CASES) {
  test(`globToRe: ${glob} ${expected ? 'matches' : 'does not match'} ${file}`, () => {
    assert.equal(G.globToRe(glob).test(file), expected);
  });
}

test('matchesAny is true when one glob matches, and false for no globs', () => {
  assert.equal(G.matchesAny('src/a.ts', ['*.md', 'src/*.ts']), true);
  assert.equal(G.matchesAny('src/a.ts', ['*.md']), false);
  assert.equal(G.matchesAny('src/a.ts', []), false);
});

test('candidateTree is HEAD^{tree} on a clean checkout, whatever sits under any .cleancode/', (t) => {
  const { dir, git } = repo(t, { '.cleancode-gates.json': '{}\n', 'apps/x/a.ts': 'export const a = 1;\n' });
  write(dir, { '.cleancode/select.json': '{}', 'apps/x/.cleancode/barrier/unit.candidate.json': '{}' });
  const index = fs.readFileSync(path.join(dir, '.git', 'index'));
  assert.equal(G.candidateTree(dir), git('rev-parse', 'HEAD^{tree}'));
  assert.deepEqual(fs.readFileSync(path.join(dir, '.git', 'index')), index, 'the real index is untouched');
  assert.equal(git('status', '--porcelain', '--untracked-files=no'), '');
});

test('candidateTree counts untracked and edited files, .cleancode-gates.json included, but not ignored ones', (t) => {
  const { dir, git } = repo(t, { '.gitignore': 'dist/\n', '.cleancode-gates.json': '{}\n', 'a.ts': 'x\n' });
  const head = git('rev-parse', 'HEAD^{tree}');
  write(dir, { 'dist/out.js': 'ignored\n' });
  assert.equal(G.candidateTree(dir), head);
  write(dir, { 'new.ts': 'y\n' });
  const withNew = G.candidateTree(dir);
  assert.notEqual(withNew, head);
  assert.deepEqual(git('ls-tree', '-r', '--name-only', withNew).split('\n'),
    ['.cleancode-gates.json', '.gitignore', 'a.ts', 'new.ts']);
  fs.rmSync(path.join(dir, 'new.ts'));
  write(dir, { '.cleancode-gates.json': '{"guards": []}\n' });
  assert.notEqual(G.candidateTree(dir), head);
});

test('candidateTree removes its temp index on success and on failure', (t) => {
  const { dir } = repo(t, { 'a.ts': 'x\n' });
  const unborn = tmp(t, 'ccg-unborn-');
  cp.execFileSync('git', ['init', '-q', '--template=', unborn], { env: ENV });
  const made = [];
  const original = fs.mkdtempSync;
  fs.mkdtempSync = (...args) => { const d = original(...args); made.push(d); return d; };
  t.after(() => { fs.mkdtempSync = original; });
  G.candidateTree(dir);
  assert.throws(() => G.candidateTree(unborn), /git read-tree HEAD failed/);
  assert.equal(made.length, 2);
  for (const d of made) assert.equal(fs.existsSync(d), false, `${d} left behind`);
});

// B13: the temp index starts as a copy of the real one, so these are the cases a stale copy could get wrong.
test('candidateTree seeded from the real index still hashes a clean checkout to HEAD^{tree}: stat-dirty, staged then undone, staged under .cleancode/', (t) => {
  const { dir, git } = repo(t, { 'a.ts': 'a\n', 'b.ts': 'b\n', '.cleancode/kept.json': '{}\n' });
  const head = git('rev-parse', 'HEAD^{tree}');
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(dir, 'a.ts'), later, later);
  write(dir, { 'b.ts': 'edited\n' });
  git('add', 'b.ts');
  write(dir, { 'b.ts': 'b\n', '.cleancode/kept.json': '{ "x": 1 }\n' });
  git('add', '.cleancode/kept.json');
  assert.match(git('diff', '--cached', '--name-only'), /b\.ts/, 'the real index holds staged edits');
  assert.equal(G.candidateTree(dir), head);
  write(dir, { 'b.ts': 'edited\n' });
  assert.notEqual(G.candidateTree(dir), head, 'and an edit on disk still counts');
});

// B12: code-unit order, which a locale sort would get wrong: upper case first, then lower, then accents.
test('listFiles and changedFiles sort by UTF-16 code unit, never by locale', (t) => {
  const names = ['B.ts', 'Z/z.ts', 'a.ts', 'c.ts', 'ä.ts', 'é.ts', 'Ω.ts'];
  const { dir, git } = repo(t, Object.fromEntries(names.map((n) => [n, '1\n'])));
  const base = git('rev-parse', 'HEAD');
  write(dir, Object.fromEntries(names.map((n) => [n, '2\n'])));
  assert.notDeepEqual([...names].sort((x, y) => x.localeCompare(y)), names, 'the fixture tells the two orders apart');
  assert.deepEqual(G.listFiles(dir), names);
  assert.deepEqual(G.changedFiles(dir, base), names);
});

test('changedFiles is base vs working tree plus untracked: sorted, deletions kept, .cleancode/ dropped', (t) => {
  const { dir, git } = repo(t, { 'a.ts': '1\n', 'b.ts': '1\n', 'gone.ts': '1\n', 'sub/c.ts': '1\n' });
  const base = git('rev-parse', 'HEAD');
  write(dir, { 'b.ts': '2\n' });
  git('commit', '-qam', 'b');
  write(dir, { 'sub/c.ts': '2\n', 'new file.ts': 'n\n', 'widgé.ts': 'n\n',
    '.cleancode/select.json': '{}', 'apps/x/.cleancode/r.json': '{}' });
  fs.rmSync(path.join(dir, 'gone.ts'));
  const later = new Date(Date.now() + 5000);
  fs.utimesSync(path.join(dir, 'a.ts'), later, later);
  assert.deepEqual(G.changedFiles(dir, base), ['b.ts', 'gone.ts', 'new file.ts', 'sub/c.ts', 'widgé.ts']);
});

test('listFiles is tracked plus untracked, sorted, on disk only, without .cleancode/ or ignored files', (t) => {
  const { dir } = repo(t, { '.gitignore': 'dist/\n', 'b.ts': '1\n', 'a/x.ts': '1\n', 'gone.ts': '1\n' });
  write(dir, { 'c.ts': 'n\n', 'dist/o.js': 'i\n', '.cleancode/s.json': '{}', 'a/.cleancode/r.json': '{}' });
  fs.rmSync(path.join(dir, 'gone.ts'));
  assert.deepEqual(G.listFiles(dir), ['.gitignore', 'a/x.ts', 'b.ts', 'c.ts']);
});

test('showFile reads a file at a ref, returns null when it is absent there, and shape-checks the ref', (t) => {
  const { dir } = repo(t, { 'a.txt': 'one\n' });
  write(dir, { 'a.txt': 'two\n' });
  assert.equal(G.showFile(dir, 'HEAD', 'a.txt'), 'one\n');
  assert.equal(G.showFile(dir, 'HEAD', 'missing.txt'), null);
  assert.throws(() => G.showFile(dir, '--output=x', 'a.txt'), /invalid base ref/);
});

test('resolveBase: the merge-base with main by default, an explicit ref as given, treeOf its tree', (t) => {
  const { dir, git } = repo(t, { 'a.txt': '1\n' });
  const mainSha = git('rev-parse', 'HEAD');
  git('checkout', '-qb', 'feature');
  write(dir, { 'a.txt': '2\n' });
  git('commit', '-qam', 'f');
  assert.deepEqual(G.resolveBase(dir, null), { ref: 'main', sha: mainSha });
  assert.deepEqual(G.resolveBase(dir, 'HEAD~1'), { ref: 'HEAD~1', sha: mainSha });
  assert.equal(G.treeOf(dir, mainSha), git('rev-parse', `${mainSha}^{tree}`));
  assert.throws(() => G.resolveBase(dir, 'nope'), /"nope" does not resolve/);
  assert.throws(() => G.resolveBase(dir, '-x'), /invalid base ref/);
});

test('resolveBase prefers the merge-base with origin/main over main', (t) => {
  const { dir, git } = repo(t, { 'a.txt': '1\n' });
  const first = git('rev-parse', 'HEAD');
  write(dir, { 'a.txt': '2\n' });
  git('commit', '-qam', 'second');
  git('update-ref', 'refs/remotes/origin/main', first);
  assert.deepEqual(G.resolveBase(dir, null), { ref: 'origin/main', sha: first });
});

test('resolveBase with neither origin/main nor main refuses rather than falling back to HEAD', (t) => {
  const { dir } = repo(t, { 'a.txt': '1\n' }, 'trunk');
  assert.throws(() => G.resolveBase(dir, null), { message: 'no base ref: pass --base <ref>' });
});

test('repoRoot is the top level from any subdirectory, and refuses a directory outside git', (t) => {
  const { dir } = repo(t, { 'sub/a.txt': '1\n' });
  assert.equal(G.repoRoot(path.join(dir, 'sub')), dir);
  const outside = tmp(t, 'ccg-nogit-');
  assert.throws(() => G.repoRoot(outside), /not a git repository/);
});

test('worktreeAdd checks out a detached tree, and worktreeRemove leaves nothing behind', (t) => {
  const { dir, git } = repo(t, { 'a.txt': 'one\n' });
  const sha = git('rev-parse', 'HEAD');
  write(dir, { 'a.txt': 'two\n' });
  git('commit', '-qam', 'two');
  const holder = tmp(t, 'ccg-wt-');
  const wt = path.join(holder, 'base');
  G.worktreeAdd(dir, sha, wt);
  assert.equal(fs.readFileSync(path.join(wt, 'a.txt'), 'utf8'), 'one\n');
  write(wt, { 'scratch.txt': 'dirty\n' });
  G.worktreeRemove(dir, wt);
  assert.equal(fs.existsSync(wt), false);
  const listed = () => git('worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree '));
  assert.equal(listed().length, 1);
  G.worktreeAdd(dir, sha, wt);
  fs.rmSync(wt, { recursive: true, force: true });
  G.worktreeRemove(dir, wt);
  assert.equal(listed().length, 1, 'a worktree whose directory is already gone is unregistered by its path');
});

const registered = (git) => git('worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice(9));

test('worktreeRemove unregisters only its own worktree: a foreign one whose directory is gone stays registered', (t) => {
  const { dir, git } = repo(t, { 'a.txt': 'one\n' });
  const sha = git('rev-parse', 'HEAD');
  const holder = tmp(t, 'ccg-wt-');
  const [foreign, ours] = [path.join(holder, 'foreign'), path.join(holder, 'ours')];
  git('worktree', 'add', '-q', '--detach', foreign, sha);
  fs.rmSync(foreign, { recursive: true, force: true });
  assert.match(git('worktree', 'list', '--porcelain'), /\nprunable /, 'the foreign registration is stale before ours is touched');
  G.worktreeAdd(dir, sha, ours);
  G.worktreeRemove(dir, ours);
  assert.deepEqual(registered(git), [dir, foreign], 'only our registration may go');
  assert.deepEqual(fs.readdirSync(path.join(dir, '.git', 'worktrees')), ['foreign']);
});

test('worktreeRemove also removes a registration an interrupted add left locked', (t) => {
  const { dir, git } = repo(t, { 'a.txt': 'one\n' });
  const wt = path.join(tmp(t, 'ccg-wt-'), 'base');
  G.worktreeAdd(dir, git('rev-parse', 'HEAD'), wt);
  git('worktree', 'lock', '--reason', 'initializing', wt);
  G.worktreeRemove(dir, wt);
  assert.deepEqual([registered(git), fs.existsSync(wt)], [[dir], false]);
});

test('filesAt keeps, in list order, the files git holds at a commit, reading each path literally', (t) => {
  const { dir, git } = repo(t, { 'app/a[1].spec.js': 'a\n', 'app/b.spec.js': 'b\n', 'app/dir/c.spec.js': 'c\n' });
  const sha = git('rev-parse', 'HEAD');
  write(dir, { 'app/new.spec.js': 'n\n' });
  assert.deepEqual(G.filesAt(dir, sha, ['app/new.spec.js', 'app/b.spec.js', 'app/a[1].spec.js', 'app/dir', 'app/*.js']),
    ['app/b.spec.js', 'app/a[1].spec.js'], 'a new file, a folder and a glob are not files git holds');
  assert.throws(() => G.filesAt(dir, '-x', ['app/b.spec.js']), /invalid base ref/);
});

test('isTracked: a file or a folder git holds at the commit, or one only staged, is tracked; an ignored or untracked one is not', (t) => {
  const { dir, git } = repo(t, { '.gitignore': '.env\n', 'app/results.json': '{}\n', 'app/certs/c.pem': 'c\n' });
  const sha = git('rev-parse', 'HEAD');
  write(dir, { 'app/.env': 'A=1\n', 'app/new.json': '{}\n', 'app/staged.json': '{}\n', 'app/keys/k.pem': 'k\n' });
  git('add', 'app/staged.json');
  for (const [rel, expected] of [['app/results.json', true], ['app/certs', true], ['app/staged.json', true], ['app/.env', false],
    ['app/new.json', false], ['app/keys', false], ['app/none', false]]) {
    assert.equal(G.isTracked(dir, sha, rel), expected, rel);
  }
});
