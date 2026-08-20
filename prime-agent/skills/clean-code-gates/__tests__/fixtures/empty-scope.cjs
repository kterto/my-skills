'use strict';
const cp = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CSS = ':root { --gap: 1px; }\n';

/**
 * The two shapes no suite covered, in one project.
 *
 * `src/a.ts` makes the stack detectable so an emptiness always comes from the
 * scope alone. `docs/note.md` sits outside every stack root, so a scope that
 * resolves to it holds zero files. `src/theme.css` and `src/styles/tokens.css`
 * sit INSIDE a stack root but match no adapter's `SOURCE_FILE_RE`, so a scope
 * that resolves to them is non-empty yet still measured by nothing — the
 * distinction the gateable-scope guard exists to make.
 */
function projectWithDocs(prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(dir, 'package.json'), '{}');
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), '{}');
  fs.mkdirSync(path.join(dir, 'src', 'styles'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src', 'a.ts'), 'export const a = 1;\n');
  fs.writeFileSync(path.join(dir, 'src', 'theme.css'), CSS);
  fs.writeFileSync(path.join(dir, 'src', 'styles', 'tokens.css'), CSS);
  fs.mkdirSync(path.join(dir, 'docs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'docs', 'note.md'), 'A note.\n');
  return dir;
}

/**
 * A repo whose second commit touched exactly one file, so `--scope diff:HEAD~1`
 * resolves to that file and nothing else. The tree is left clean because
 * `realGitDiff` also reports untracked work.
 */
function oneFileCommitRepo(prefix, rel, content) {
  const dir = projectWithDocs(prefix);
  const abs = path.join(dir, ...rel.split('/'));
  // A developer with `core.hooksPath` or `init.templateDir` set globally would
  // otherwise have their own hooks and templates run inside these repos, which
  // can fail the commit and flake every test that depends on the fixture.
  const env = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' };
  const git = (args) => cp.execFileSync('git', ['-C', dir, ...args], { stdio: 'ignore', env });
  git(['init', '-q', '--template=']);
  git(['config', 'user.email', 't@t.t']);
  git(['config', 'user.name', 't']);
  git(['config', 'commit.gpgsign', 'false']);
  fs.rmSync(abs);
  git(['add', '-A']);
  git(['commit', '-qm', 'base']);
  fs.writeFileSync(abs, content);
  git(['add', '-A']);
  git(['commit', '-qm', 'one file']);
  return dir;
}

/** The CR's first reproduction: a diff scope that resolves to zero files. */
function docsOnlyCommitRepo() {
  return oneFileCommitRepo('ccg-empty-diff-', 'docs/note.md', 'A note.\n');
}

/** The CR's second reproduction: a diff scope that resolves to one ungateable file. */
function cssOnlyCommitRepo() {
  return oneFileCommitRepo('ccg-css-diff-', 'src/theme.css', CSS);
}

/** A project for the scope kinds that reach an unmeasurable scope without Git. */
function docsOnlyProject() {
  return projectWithDocs('ccg-empty-scope-');
}

const EMPTY_FILES_SCOPE = { kind: 'files', files: [] };
const EMPTY_MODULE_SCOPE = { kind: 'module', target: 'docs' };
const UNGATEABLE_FILES_SCOPE = { kind: 'files', files: ['src/theme.css'] };
const UNGATEABLE_MODULE_SCOPE = { kind: 'module', target: 'src/styles' };

module.exports = {
  docsOnlyCommitRepo,
  cssOnlyCommitRepo,
  docsOnlyProject,
  EMPTY_FILES_SCOPE,
  EMPTY_MODULE_SCOPE,
  UNGATEABLE_FILES_SCOPE,
  UNGATEABLE_MODULE_SCOPE,
};
