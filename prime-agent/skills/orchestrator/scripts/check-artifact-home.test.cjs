#!/usr/bin/env node
'use strict';
/**
 * Contract tests for `check-artifact-home.cjs` — the gate that answers a question
 * nothing has ever asked a machine: is this artifact in a directory the layout
 * allows? Every real `plans/` tree is mixed, so the gate has to accept two homes at
 * once — a legacy artifact directly inside one of the seven frozen kind directories,
 * and any artifact inside a `plans/<RUN-TOKEN>-<slug>/` run folder — while still
 * rejecting the shapes that would otherwise appear silently, because bootstrap runs
 * no `mkdir` and a directory is created by the first write into it.
 *
 * The cases pinned here are the ones a wrong gate reads as clean: a run folder whose
 * name is one character off the token grammar, a third level that breaks every
 * `../../docs/adr/…` href the corpus already carries, and a stray file at the
 * `plans/` root that no listing distinguishes from a convention.
 *
 * Each case drives the real gate as a subprocess against temp fixtures — a copy of
 * the gate plus `gate-scope.cjs` in `<tmp>/scripts/`, so `ROOT` is `<tmp>` and
 * `<tmp>/plans/` is a real, self-contained corpus.
 *
 *   node scripts/check-artifact-home.test.cjs
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const NODE = process.execPath;
const SRC = __dirname;

let failures = 0;
const fail = (m) => { failures++; console.error('FAIL: ' + m); };
const pass = (m) => console.log('pass: ' + m);

// A caller's MAESTRO_CR_TARGET_PATH must not leak into the fixtures; the one case
// that exercises the exemption sets it itself.
const ENV = { ...process.env };
delete ENV.MAESTRO_CR_TARGET_PATH;

// realpath the fixture root: node resolves a main module's path through its symlinks,
// so the gate's own ROOT is `/private/var/…` on darwin while `os.tmpdir()` hands back
// `/var/…`. Without this every explicit path would read as "outside plans/".
function mkRoot(prefix) {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  const scripts = path.join(root, 'scripts');
  fs.mkdirSync(scripts);
  for (const f of ['check-artifact-home.cjs', 'gate-scope.cjs']) {
    fs.copyFileSync(path.join(SRC, f), path.join(scripts, f));
  }
  return root;
}

const root = mkRoot('artifact-home-');
const GATE = path.join(root, 'scripts', 'check-artifact-home.cjs');
const PLANS = path.join(root, 'plans');
fs.mkdirSync(PLANS);

const run = (args, env) => spawnSync(NODE, [GATE, ...args], { cwd: root, encoding: 'utf8', env: env || ENV });
const outOf = (r) => (r.stdout || '') + (r.stderr || '');

/** Materialize `plans/<rel>` (creating its parents) and return the absolute path. */
function artifact(rel, body) {
  const abs = path.join(PLANS, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body || '---\nid: X\nstatus: DONE\ncreated_at: t\nupdated_at: t\ncycle: 1\n---\n# x\n');
  return abs;
}

const expectOk = (label, args, env) => {
  const r = run(args, env);
  const out = outOf(r);
  if (r.status === 0 && /artifact-home: OK/.test(out)) return pass(`${label}: OK`);
  fail(`${label}: expected OK, got status=${r.status} out=${JSON.stringify(out.trim())}`);
};

const expectViolation = (label, args, re, env) => {
  const r = run(args, env);
  const out = outOf(r);
  if (r.status !== 0 && re.test(out)) return pass(`${label}: rejected`);
  fail(`${label}: expected a violation matching ${re}, got status=${r.status} out=${JSON.stringify(out.trim())}`);
};

const TOKEN = '20260916T101530Z-a1b2';
const RUN = `${TOKEN}-spot-opening-hours`;

// ---------- the two legal homes ----------

// A legacy artifact directly inside each of the seven frozen kind directories. They
// hold every artifact written before the run-folder layout, in every project, and
// nothing moves — so the gate that governs new writes must still pass all seven.
{
  const legacy = [
    ['specs', 'SPEC'], ['feat', 'FEAT'], ['code-review', 'CR'], ['qa', 'QA'],
    ['test', 'TEST'], ['eval', 'EVAL'], ['final', 'FINAL'],
  ].map(([dir, prefix]) => artifact(`${dir}/${prefix}-20260101T000000Z-abcd-legacy.md`));
  expectOk('seven legacy kind directories', ['--', ...legacy]);
}

// An artifact flat inside a run folder — the layout every new artifact lands in.
expectOk('run-folder artifact', ['--', artifact(`${RUN}/FEAT-${TOKEN}-spot-opening-hours.md`)]);

// The sidecar and the html render are the same artifact's other two files; both sit
// beside the `.md` and must be accepted by name as well as by location.
expectOk('progress sidecar in a run folder', ['--', artifact(`${RUN}/FEAT-${TOKEN}-spot-opening-hours.progress.md`)]);
expectOk('html render in a run folder', ['--', artifact(`${RUN}/FEAT-${TOKEN}-spot-opening-hours.html`, '<html></html>\n')]);
expectOk('html render in a legacy kind directory', ['--', artifact('feat/FEAT-20260101T000000Z-abcd-legacy.html', '<html></html>\n')]);

// `plans/index.html` is the generated read view, the one file that belongs at the root.
expectOk('index.html at the plans/ root', ['--', artifact('index.html', '<html></html>\n')]);

// ---------- the shapes that would otherwise appear silently ----------

// A run folder one character off the grammar: uppercase hex, a `+` separator instead
// of `-`, and a token with no hex suffix at all. Each is the shape a hand-typed or
// re-derived name takes, which is exactly what `newrun` exists to prevent.
expectViolation(
  'run folder with uppercase hex',
  ['--', artifact(`${'20260916T101530Z-A1B2'}-spot-opening-hours/FEAT-${TOKEN}-x.md`)],
  /malformed run folder "20260916T101530Z-A1B2-spot-opening-hours"/,
);
expectViolation(
  'run folder with a + separator',
  ['--', artifact(`${TOKEN}-spot+opening+hours/FEAT-${TOKEN}-x.md`)],
  /malformed run folder/,
);
expectViolation(
  'run folder missing the hex suffix',
  ['--', artifact(`20260916T101530Z-spot-opening-hours/FEAT-${TOKEN}-x.md`)],
  /malformed run folder/,
);

// A directory that is not a run folder and not one of the seven: the silent new
// top-level directory this gate was written for.
expectViolation(
  'unrecognized top-level directory',
  ['--', artifact(`reviews/CR-${TOKEN}-x.md`)],
  /unrecognized directory "reviews" under plans\//,
);

// A leading `<PREFIX>-` is the whole discriminator between a run folder and an
// artifact, so a directory carrying one is an artifact name used as a folder.
expectViolation(
  'artifact name used as a directory',
  ['--', artifact(`SPEC-${TOKEN}-spot-opening-hours/FEAT-${TOKEN}-x.md`)],
  /directory "SPEC-20260916T101530Z-a1b2-spot-opening-hours" is an artifact name/,
);

// Depth 3, in both of the shapes it actually takes: the `evaluations/` subfolder a
// spec-driven-eval run leaves behind without `--out`, and a `plans/runs/` wrapper.
// Either one breaks the `../../docs/adr/…` hrefs the corpus already carries.
expectViolation(
  'evaluations subfolder inside a run folder',
  ['--', artifact(`${RUN}/evaluations/EVAL-${TOKEN}-x.md`)],
  /depth 3 under plans\/ \(expected exactly 2\)/,
);
expectViolation(
  'plans/runs/ wrapper above the run folder',
  ['--', artifact(`runs/${RUN}/FEAT-${TOKEN}-x.md`)],
  /depth 3 under plans\/ \(expected exactly 2\)/,
);

// A stray file at the plans/ root — an artifact whose write path lost its folder.
expectViolation(
  'artifact at the plans/ root',
  ['--', artifact(`FEAT-${TOKEN}-spot-opening-hours.md`)],
  /file at the plans\/ root: only index\.html lives there/,
);

// A path outside plans/ altogether is named as such rather than as a directory rule.
{
  const outside = path.join(root, 'docs', 'stray.md');
  fs.mkdirSync(path.dirname(outside), { recursive: true });
  fs.writeFileSync(outside, '# stray\n');
  expectViolation('target outside plans/', ['--', outside], /outside plans\//);
  // …unless it is the reviewer's MAESTRO_CR_TARGET_PATH, which write-path precedence
  // rule 1 exempts from every path check by name.
  expectOk('MAESTRO_CR_TARGET_PATH exemption', ['--', outside], { ...ENV, MAESTRO_CR_TARGET_PATH: outside });
}

// ---------- explicit-path mode ----------

// An explicit list audits exactly the paths given: the good one is silent, the bad
// one is named, and the count is the number of violations and not of targets.
{
  const good = artifact(`${RUN}/CR-${TOKEN}-spot-opening-hours.md`);
  const bad = artifact(`scratch/CR-${TOKEN}-x.md`);
  const r = run(['--', good, bad]);
  const out = outOf(r);
  if (r.status !== 0 && /artifact-home: 1 violation\(s\)/.test(out) && /scratch/.test(out) && !new RegExp(RUN).test(out)) {
    pass('explicit mixed list: only the offending path is named');
  } else {
    fail(`explicit mixed list: expected exactly the bad path named, got status=${r.status} out=${JSON.stringify(out.trim())}`);
  }
}

// A missing explicit target fails closed rather than being silently dropped (sec-1).
expectViolation('explicit missing target', ['--', path.join(PLANS, RUN, 'gone.md')], /missing target/i);

// A bare `--` is an empty audit list, not a request for branch scope (bug-3).
expectViolation('empty explicit audit list', ['--'], /empty explicit audit list/i);

// ---------- branch scope ----------

const gitOk = spawnSync('git', ['--version'], { encoding: 'utf8' }).status === 0;
const GIT_ENV = { ...ENV, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_SYSTEM: '/dev/null' };
const git = (cwd, args) => spawnSync('git', args, { cwd, encoding: 'utf8', env: GIT_ENV });

if (!gitOk) {
  pass('branch-scope cases: skipped (git unavailable here)');
} else {
  // An EMPTY, untrustworthy scope: a repo with an unborn HEAD resolves neither `main`
  // nor `origin/main`, so the shared discovery refuses to hand back a vacuous [] …
  const empty = mkRoot('artifact-home-empty-');
  fs.mkdirSync(path.join(empty, 'plans'));
  git(empty, ['init', '-q']);
  const runIn = (cwd, args) =>
    spawnSync(NODE, [path.join(cwd, 'scripts', 'check-artifact-home.cjs'), ...args], { cwd, encoding: 'utf8', env: GIT_ENV });
  {
    const r = runIn(empty, []);
    const out = outOf(r);
    if (r.status !== 0 && /could not determine base ref/i.test(out)) pass('unresolvable base: fail-closed');
    else fail(`unresolvable base: expected fail-closed, got status=${r.status} out=${JSON.stringify(out.trim())}`);
  }
  // … while `--allow-empty` opts into the empty scope and the gate prints its verdict.
  {
    const r = runIn(empty, ['--allow-empty']);
    const out = outOf(r);
    if (r.status === 0 && /artifact-home: OK/.test(out)) pass('unresolvable base with --allow-empty: OK');
    else fail(`unresolvable base with --allow-empty: expected OK, got status=${r.status} out=${JSON.stringify(out.trim())}`);
  }

  // A real branch scope: the gate's primary mode. `main` resolves, and the untracked
  // `.md` files under plans/ are the branch's artifacts — one in a run folder, one in
  // a directory that a typo created.
  const repo = mkRoot('artifact-home-branch-');
  fs.mkdirSync(path.join(repo, 'plans'));
  git(repo, ['init', '-q']);
  git(repo, ['symbolic-ref', 'HEAD', 'refs/heads/main']);
  fs.writeFileSync(path.join(repo, 'seed.txt'), 'seed\n');
  git(repo, ['add', '-A']);
  const committed = git(repo, ['commit', '-q', '-m', 'seed', '--author', 'T <t@example.com>']);
  if (committed.status !== 0) {
    fail(`branch-scope fixture: git commit failed: ${(committed.stderr || '').trim()}`);
  } else {
    const mk = (rel) => {
      const abs = path.join(repo, 'plans', rel);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, '---\nid: X\n---\n# x\n');
      return abs;
    };
    mk(`${RUN}/FEAT-${TOKEN}-spot-opening-hours.md`);
    const stray = mk(`feeat/FEAT-${TOKEN}-typo.md`);
    {
      const r = runIn(repo, []);
      const out = outOf(r);
      if (r.status !== 0 && /artifact-home: 1 violation\(s\)/.test(out) && /unrecognized directory "feeat"/.test(out)) {
        pass('branch scope typo: the discovered directory is named');
      } else {
        fail(`branch scope typo: expected the typo'd directory named once, got status=${r.status} out=${JSON.stringify(out.trim())}`);
      }
    }
    // Remove the offender and the same branch scope is clean — the verdict tracks the
    // tree, not the mere presence of changed files.
    fs.rmSync(path.dirname(stray), { recursive: true, force: true });
    {
      const r = runIn(repo, []);
      const out = outOf(r);
      if (r.status === 0 && /artifact-home: OK/.test(out)) pass('branch scope clean: a clean branch passes');
      else fail(`branch scope clean: expected OK, got status=${r.status} out=${JSON.stringify(out.trim())}`);
    }
  }
}

if (failures) { console.error(`\ncheck-artifact-home: ${failures} failure(s)`); process.exit(1); }
console.log('\ncheck-artifact-home: OK');
