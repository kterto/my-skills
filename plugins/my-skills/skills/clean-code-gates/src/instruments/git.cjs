'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { assertBaseRefShape } = require('../baseref.cjs');

const OPTS = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 };
const fail = (message) => { throw new Error(message); };
function git(root, args, env = process.env) {
  try { return cp.execFileSync('git', ['-C', root, ...args], { ...OPTS, env }); }
  catch (e) { return fail(`git ${args.join(' ')} failed: ${String(e.stderr || e.message).trim()}`); }
}
const probe = (root, args) => { try { return git(root, args).trim(); } catch { return ''; } };

// Never measured: every .cleancode/, and the engine's own output cli.cjs names (an --out or --cache inside the repo).
let own = ['**/.cleancode/**'];
const excludeOutputs = (globs) => { own = ['**/.cleancode/**', ...globs]; };
// NUL-separated, so no quoting applies; sort() orders strings by UTF-16 code unit.
const paths = (out) => [...new Set(out.split('\0').filter(Boolean))].filter((f) => !matchesAny(f, own)).sort();
const repoRoot = (cwd) => probe(cwd, ['rev-parse', '--show-toplevel']) || fail(`not a git repository: ${cwd}`);

// Never falls back to HEAD: a committed change would diff to nothing there, and
// every change-selected tier would pass having run nothing.
function resolveBase(root, ref) {
  if (ref != null) {
    const sha = probe(root, ['rev-parse', '--verify', '--quiet', `${assertBaseRefShape(ref)}^{commit}`]);
    return { ref, sha: sha || fail(`invalid base ref — "${ref}" does not resolve in this repository`) };
  }
  for (const candidate of ['origin/main', 'main']) {
    const sha = probe(root, ['merge-base', 'HEAD', candidate]);
    if (sha) return { ref: candidate, sha };
  }
  return fail('no base ref: pass --base <ref>');
}
const treeOf = (root, sha) => git(root, ['rev-parse', `${assertBaseRefShape(sha)}^{tree}`]).trim();
// One folder of a tree as its own tree object; null where no folder is there: absent, a file, or a symlink,
// whose blob would not change with what it points to.
const subtreeOf = (root, tree, rel) => {
  if (rel === '.') return tree;
  const m = /^040000 tree ([0-9a-f]+)\t/.exec(probe(root, ['ls-tree', '-d', tree, '--', rel]));
  return m ? m[1] : null;
};

// The working tree as a tree object, untracked files in and every .cleancode/ out (glob magic: `**/` matches zero dirs).
// The temp index copies the real one, mtime too (racy-entry checks), so its stat cache spares unchanged files; excluded
// paths then go back to HEAD. A reset, as an exclude pathspec naming an ignored directory by its prefix fails `git add`.
function candidateTree(root) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccg-index-'));
  const env = { ...process.env, GIT_INDEX_FILE: path.join(dir, 'index') };
  const real = path.resolve(root, probe(root, ['rev-parse', '--git-path', 'index']) || '.git/index');
  const copy = () => { fs.copyFileSync(real, env.GIT_INDEX_FILE); fs.utimesSync(env.GIT_INDEX_FILE, fs.statSync(real).atime, fs.statSync(real).mtime); };
  try {
    if (fs.existsSync(real)) copy(); else git(root, ['read-tree', 'HEAD'], env);
    git(root, ['add', '-A', '--', '.', ':(exclude,glob)**/.cleancode/**'], env);
    git(root, ['reset', '-q', 'HEAD', '--', ...own.map((g) => `:(glob)${g}`)], env);
    return git(root, ['write-tree'], env).trim();
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function changedFiles(root, baseSha) {
  probe(root, ['update-index', '-q', '--refresh']);
  return paths(git(root, ['diff', '--name-only', '--no-renames', '-z', assertBaseRefShape(baseSha), '--'])
    + git(root, ['ls-files', '-z', '--others', '--exclude-standard']));
}
const listFiles = (root) => paths(git(root, ['ls-files', '-z', '-co', '--exclude-standard']))
  .filter((f) => { try { return fs.statSync(path.join(root, f)).isFile(); } catch { return false; } });
function showFile(root, ref, rel) {
  const spec = `${assertBaseRefShape(ref)}:${rel}`;
  try { return git(root, ['show', spec]); } catch { return null; }
}
// The files of a list that git holds at a commit, in list order: ls-tree reads each path literally, never as a glob.
function filesAt(root, sha, files) {
  const held = new Set(git(root, ['ls-tree', '-r', '-z', '--name-only', assertBaseRefShape(sha), '--', ...files]).split('\0'));
  return files.filter((f) => held.has(f));
}
// Whether git holds a path (a file, or a folder with one) at a commit, or in the index by any letter case.
const isTracked = (root, sha, rel) => probe(root, ['ls-tree', assertBaseRefShape(sha), '--', rel]) !== ''
  || probe(root, ['ls-files', '--error-unmatch', '--', `:(icase,literal)${rel}`]) !== '';

// Unlike scope.cjs: `**/` is zero or more whole directories, a trailing `/**` all below,
// `*` stays within one segment, and a glob with no `/` matches the basename at any depth.
const WILD = { '**/': '(?:[^/]+/)*', '/**': '/.*', '**': '.*', '*': '[^/]*', '?': '[^/]' };
function globToRe(glob) {
  const body = glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*\/|\/\*\*$|\*\*|\*|\?/g, (m) => WILD[m]);
  return new RegExp(`^${glob.includes('/') ? '' : '(?:[^/]+/)*'}${body}$`);
}
const compiled = new Map();
const matchesAny = (file, globs) => globs.some((g) => (compiled.get(g) || compiled.set(g, globToRe(g)).get(g)).test(file));

// No hooks: a post-checkout hook would run at base outside every bound; `base.prepare` is the bounded setup step.
const worktreeAdd = (root, sha, dir) => { git(root, ['-c', 'core.hooksPath=/dev/null', 'worktree', 'add', '--detach', dir, assertBaseRefShape(sha)]); };
// Ours only, by its path (a prune would drop every stale registration, others' too); the second --force takes a locked one.
function worktreeRemove(root, dir) {
  probe(root, ['worktree', 'remove', '--force', '--force', dir]);
  fs.rmSync(dir, { recursive: true, force: true });
}

module.exports = { repoRoot, resolveBase, treeOf, subtreeOf, candidateTree, changedFiles, listFiles, showFile, filesAt, isTracked,
  globToRe, matchesAny, worktreeAdd, worktreeRemove, excludeOutputs };
