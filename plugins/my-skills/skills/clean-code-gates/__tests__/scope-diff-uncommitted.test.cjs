const { test } = require('node:test');
const assert = require('node:assert');
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { realGitDiff } = require('../src/scope.cjs');

/** A real repo with one commit, then uncommitted work on top. */
function repoWithUncommittedWork() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-scope-'));
  const git = (args) => cp.execSync(`git -C "${d}" ${args}`, { stdio: 'ignore' });
  git('init -q');
  git('config user.email t@t.t');
  git('config user.name t');
  fs.writeFileSync(path.join(d, 'base.ts'), 'export const a = 1;\n');
  git('add -A');
  git('commit -qm base');
  const base = cp.execSync(`git -C "${d}" rev-parse HEAD`, { encoding: 'utf8' }).trim();

  fs.writeFileSync(path.join(d, 'base.ts'), 'export const a = 2;\n'); // modified, uncommitted
  fs.writeFileSync(path.join(d, 'brand-new.ts'), 'export const b = 3;\n'); // untracked
  return { d, base };
}

// The tree an agent works on is uncommitted, and HEAD is often the base itself.
// `git diff base..HEAD` sees only committed history, so it returns nothing and
// the run reports pass having gated no files at all.
test('diff scope sees uncommitted modifications', () => {
  const { d, base } = repoWithUncommittedWork();
  assert.ok(realGitDiff(d)(base).includes('base.ts'));
});

test('diff scope sees untracked new files', () => {
  const { d, base } = repoWithUncommittedWork();
  assert.ok(realGitDiff(d)(base).includes('brand-new.ts'));
});

test('diff scope is not empty when HEAD equals the base', () => {
  const { d, base } = repoWithUncommittedWork();
  const head = cp.execSync(`git -C "${d}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
  assert.strictEqual(head, base, 'precondition: HEAD is the base');
  assert.notStrictEqual(realGitDiff(d)(base).length, 0);
});

// A null baseRef resolves the base in Node via `git merge-base`, not shell
// `$(...)` substitution (which cmd.exe cannot run). With no origin/main the
// merge-base fails and the base must fall back to HEAD, still scoping the
// uncommitted work rather than throwing or returning nothing.
test('diff scope with no base falls back to HEAD and sees uncommitted work', () => {
  const { d } = repoWithUncommittedWork();
  const files = realGitDiff(d)(null);
  assert.ok(files.includes('base.ts'));
  assert.ok(files.includes('brand-new.ts'));
});

test('diff scope reports nothing on a genuinely clean tree', () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-scope-clean-'));
  const git = (args) => cp.execSync(`git -C "${d}" ${args}`, { stdio: 'ignore' });
  git('init -q');
  git('config user.email t@t.t');
  git('config user.name t');
  fs.writeFileSync(path.join(d, 'base.ts'), 'export const a = 1;\n');
  git('add -A');
  git('commit -qm base');
  const base = cp.execSync(`git -C "${d}" rev-parse HEAD`, { encoding: 'utf8' }).trim();
  assert.deepStrictEqual(realGitDiff(d)(base), []);
});
