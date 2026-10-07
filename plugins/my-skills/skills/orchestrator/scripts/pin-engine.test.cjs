#!/usr/bin/env node
'use strict';
/**
 * `pin-engine.cjs`: the copy of the clean-code-gates engine that bootstrap pins into a
 * project, and the one file list the stamp shares with it. Every case builds a
 * throwaway skills directory (this orchestrator's script beside a copy of the engine
 * skill) and a throwaway git project, so nothing here touches this repository or a
 * real project.
 *
 *   node --test scripts/pin-engine.test.cjs
 */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync, execFileSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, 'pin-engine.cjs');
const STAMP = path.join(__dirname, '..', 'MATERIALIZED-VERSION');
const ENGINE_SKILL = path.join(__dirname, '..', '..', 'clean-code-gates');

// git reads GIT_* from the environment, so a suite run from inside a git hook would
// otherwise aim every command below at the hook's repository.
const ENV = {
  ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_'))),
  GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_CONFIG_NOSYSTEM: '1',
};
const gitOk = spawnSync('git', ['--version']).status === 0;
const git = (cwd, ...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, env: ENV, encoding: 'utf8' });

const temps = [];
after(() => { for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true }); });
function tempDir(prefix) {
  const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
  temps.push(dir);
  return dir;
}

/** A skills directory: this script, the orchestrator's stamp, and a copy of the engine skill beside them. */
function skillsTree({ engine = true, stamp = true } = {}) {
  const skills = path.join(tempDir('pin-skills-'), 'skills');
  const scripts = path.join(skills, 'orchestrator', 'scripts');
  fs.mkdirSync(scripts, { recursive: true });
  fs.copyFileSync(SCRIPT, path.join(scripts, 'pin-engine.cjs'));
  if (stamp) fs.copyFileSync(STAMP, path.join(skills, 'orchestrator', 'MATERIALIZED-VERSION'));
  if (engine) fs.cpSync(ENGINE_SKILL, path.join(skills, 'clean-code-gates'), { recursive: true });
  return { script: path.join(scripts, 'pin-engine.cjs'), engine: path.join(skills, 'clean-code-gates') };
}

/** A git project B3 has started on: one commit, and an `.orchestrator/` with no allow-list. */
function project() {
  const root = tempDir('pin-project-');
  git(root, 'init', '-q');
  fs.writeFileSync(path.join(root, 'README.md'), '# project\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-qm', 'init');
  fs.mkdirSync(path.join(root, '.orchestrator'));
  return root;
}

const run = (script, args, options = {}) => spawnSync(process.execPath, [...(options.preload ? ['--require', options.preload] : []), script, ...args], {
  encoding: 'utf8',
  cwd: options.cwd,
  env: { ...ENV, ...options.env },
});
const engineOf = (root) => path.join(root, '.orchestrator', 'engine');

/** Every file under `dir`, '/'-separated and sorted by code unit. */
function files(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...files(dir, child));
    else out.push(child);
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** The tree under `dir` as [path, sha256] pairs, or null when it does not exist. */
function listing(dir) {
  if (!fs.existsSync(dir)) return null;
  return files(dir).map((rel) => [rel, crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, rel))).digest('hex')]);
}

/** The engine set, derived here from the rule as documented rather than from the script. */
function expectedEngine(engineDir) {
  return files(engineDir).filter((rel) => (/^(bin|src)\//.test(rel) && !rel.split('/').includes('__tests__'))
    || ['defaults.cjs', 'package.json', 'references/instruments.md'].includes(rel));
}

/** What a pinned engine directory holds besides the engine itself. */
const MARKERS = ['.gitignore', 'PINNED'];

test('the engine is one rule: bin, src, defaults.cjs, package.json and the instruments reference, never tests, schemas or docs', () => {
  const { isEngineFile, engineFiles } = require('./pin-engine.cjs');
  for (const rel of ['bin/gates.cjs', 'src/run.cjs', 'src/instruments/barrier.cjs', 'defaults.cjs', 'package.json', 'references/instruments.md']) {
    assert.equal(isEngineFile(rel), true, rel);
  }
  for (const rel of ['__tests__/smoke.test.cjs', 'src/__tests__/x.test.cjs', 'schema/barrier.schema.json', 'SKILL.md', 'README.md',
    '.cleancode-gates.json', 'references/other.md', 'src/.DS_Store', 'bin', 'src/', '', '../bin/gates.cjs', 'bin/../SKILL.md', './package.json']) {
    assert.equal(isEngineFile(rel), false, JSON.stringify(rel));
  }
  // The real engine skill has every kind of file the rule must leave behind.
  const listed = engineFiles(ENGINE_SKILL);
  assert.deepEqual(listed, expectedEngine(ENGINE_SKILL));
  for (const rel of ['bin/gates.cjs', 'defaults.cjs', 'package.json', 'references/instruments.md']) assert.ok(listed.includes(rel), rel);
  assert.ok(files(ENGINE_SKILL).some((rel) => rel.startsWith('__tests__/')) && files(ENGINE_SKILL).some((rel) => rel.startsWith('schema/')),
    'the fixture must carry tests and schemas, or excluding them proves nothing');
  assert.ok(!listed.some((rel) => /^(__tests__|schema)\//.test(rel) || ['SKILL.md', 'README.md', '.cleancode-gates.json'].includes(rel)));
});

test('exactly the engine set is copied, byte for byte, into .orchestrator/engine', { skip: !gitOk && 'git unavailable' }, () => {
  const tree = skillsTree();
  const root = project();
  const r = run(tree.script, [root]);
  assert.equal(r.status, 0, r.stderr);
  const copied = files(engineOf(root)).filter((rel) => !MARKERS.includes(rel));
  assert.deepEqual(copied, expectedEngine(tree.engine));
  for (const rel of copied) {
    assert.ok(fs.readFileSync(path.join(engineOf(root), rel)).equals(fs.readFileSync(path.join(tree.engine, rel))), rel);
  }
  assert.match(r.stdout, /pinned \.orchestrator\/engine\//);
});

test('the copy carries a self-ignoring .gitignore and a PINNED record of its source, stamp and digest', { skip: !gitOk && 'git unavailable' }, () => {
  const tree = skillsTree();
  const root = project();
  assert.equal(run(tree.script, [root]).status, 0);
  assert.equal(fs.readFileSync(path.join(engineOf(root), '.gitignore'), 'utf8'), '*\n');
  // No allow-list in this project's .orchestrator/: the engine's own .gitignore keeps it out of git.
  assert.equal(git(root, 'status', '--porcelain', '--untracked-files=all'), '', 'the pinned engine never dirties the tree');

  const pinned = JSON.parse(fs.readFileSync(path.join(engineOf(root), 'PINNED'), 'utf8'));
  assert.deepEqual(Object.keys(pinned), ['source', 'stamp', 'engine_digest']);
  assert.equal(pinned.source, fs.realpathSync(tree.engine).split(path.sep).filter(Boolean).slice(-4).join('/'));
  assert.equal(pinned.stamp, fs.readFileSync(STAMP, 'utf8').trim());
  // sha256 over the sorted engine files, each framed as `<path>\0<length>\0<bytes>`.
  const hash = crypto.createHash('sha256');
  for (const rel of files(engineOf(root)).filter((name) => !MARKERS.includes(name))) {
    const bytes = fs.readFileSync(path.join(engineOf(root), rel));
    hash.update(`${rel}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  assert.equal(pinned.engine_digest, hash.digest('hex'));

  // An install that shipped no stamp still pins, and says so.
  const bare = skillsTree({ stamp: false });
  const other = project();
  assert.equal(run(bare.script, [other]).status, 0);
  assert.equal(JSON.parse(fs.readFileSync(path.join(engineOf(other), 'PINNED'), 'utf8')).stamp, null);
});

test('pinning is idempotent, and a re-pin replaces the whole directory', { skip: !gitOk && 'git unavailable' }, () => {
  const tree = skillsTree();
  const root = project();
  assert.equal(run(tree.script, [root]).status, 0);
  const first = listing(engineOf(root));
  fs.writeFileSync(path.join(engineOf(root), 'stray.cjs'), 'left behind\n');
  fs.appendFileSync(path.join(engineOf(root), 'package.json'), '\n');
  assert.equal(run(tree.script, [root]).status, 0);
  assert.deepEqual(listing(engineOf(root)), first);
  assert.deepEqual(fs.readdirSync(path.join(root, '.orchestrator')), ['engine'], 'no temporary or retired copy is left beside it');
});

// Loaded with --require into the pin's own process: before every write, rename and
// removal it records what `.orchestrator/engine` holds, and with PIN_FAIL_AT=n it
// throws on the n-th file written into the new copy.
const OBSERVER = `'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const live = process.env.PIN_OBSERVE;
const log = process.env.PIN_LOG;
const failAt = Number(process.env.PIN_FAIL_AT || 0);
const write = fs.writeFileSync;
function files(dir, rel) {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const child = rel ? rel + '/' + entry.name : entry.name;
    if (entry.isDirectory()) out.push(...files(dir, child)); else out.push(child);
  }
  return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
function listing() {
  if (!fs.existsSync(live)) return null;
  return files(live, '').map((rel) => [rel, crypto.createHash('sha256').update(fs.readFileSync(path.join(live, rel))).digest('hex')]);
}
let written = 0;
for (const name of ['writeFileSync', 'copyFileSync', 'renameSync', 'rmSync', 'mkdirSync']) {
  const real = fs[name];
  fs[name] = function (...args) {
    write(log, JSON.stringify({ op: name, state: listing() }) + '\\n', { flag: 'a' });
    const target = String(name === 'copyFileSync' ? args[1] : args[0]);
    if ((name === 'writeFileSync' || name === 'copyFileSync') && target.includes('engine.tmp-') && ++written === failAt) {
      throw new Error('injected write failure');
    }
    return real.apply(this, args);
  };
}
`;

function observe(script, root, extraEnv = {}) {
  const dir = tempDir('pin-observe-');
  const preload = path.join(dir, 'observer.cjs');
  const log = path.join(dir, 'log.jsonl');
  fs.writeFileSync(preload, OBSERVER);
  const r = run(script, [root], { preload, env: { PIN_OBSERVE: engineOf(root), PIN_LOG: log, ...extraEnv } });
  const states = fs.existsSync(log) ? fs.readFileSync(log, 'utf8').trim().split('\n').map((line) => JSON.parse(line)) : [];
  return { r, states };
}

test('the swap is atomic: until the new copy is whole, .orchestrator/engine is the old copy, whole', { skip: !gitOk && 'git unavailable' }, () => {
  const tree = skillsTree();
  const root = project();
  assert.equal(run(tree.script, [root]).status, 0);
  fs.writeFileSync(path.join(engineOf(root), 'OLD'), 'the previous pin\n');
  const before = listing(engineOf(root));
  fs.writeFileSync(path.join(tree.engine, 'src', 'zz-added.cjs'), "'use strict';\n");

  const { r, states } = observe(tree.script, root);
  assert.equal(r.status, 0, r.stderr);
  const afterwards = listing(engineOf(root));
  assert.ok(afterwards.some(([rel]) => rel === 'src/zz-added.cjs') && !afterwards.some(([rel]) => rel === 'OLD'), 'the new copy replaced the old');
  const writes = states.filter((s) => s.op === 'writeFileSync' || s.op === 'copyFileSync');
  assert.ok(writes.length >= expectedEngine(tree.engine).length, `every file write was observed (${writes.length})`);
  for (const [i, { op, state }] of states.entries()) {
    const seen = state === null ? 'absent' : JSON.stringify(state) === JSON.stringify(before) ? 'old' : JSON.stringify(state) === JSON.stringify(afterwards) ? 'new' : 'partial';
    assert.notEqual(seen, 'partial', `before ${op} #${i}, .orchestrator/engine held neither the old copy nor the new one`);
  }
  assert.ok(writes.every((s) => JSON.stringify(s.state) === JSON.stringify(before)), 'every file of the new copy is written while the old copy is still in place');
});

test('a copy that fails part-way leaves the old engine where it was, and nothing beside it', { skip: !gitOk && 'git unavailable' }, () => {
  const tree = skillsTree();
  const root = project();
  assert.equal(run(tree.script, [root]).status, 0);
  const before = listing(engineOf(root));
  fs.writeFileSync(path.join(tree.engine, 'src', 'zz-added.cjs'), "'use strict';\n");

  const { r } = observe(tree.script, root, { PIN_FAIL_AT: '5' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /pin-engine: .*injected write failure/);
  assert.match(r.stderr, /\.orchestrator\/engine was left as it was/);
  assert.deepEqual(listing(engineOf(root)), before);
  assert.deepEqual(fs.readdirSync(path.join(root, '.orchestrator')), ['engine']);
});

test('the pinned copy runs in the project: --scaffold exits 0', { skip: !gitOk && 'git unavailable' }, () => {
  const tree = skillsTree();
  const root = project();
  assert.equal(run(tree.script, [root]).status, 0);
  const r = run(path.join(engineOf(root), 'bin', 'gates.cjs'), ['--scaffold'], { cwd: root });
  assert.equal(r.status, 0, r.stderr);
});

test('the pinned copy prints a kind\'s reference from its own copy: barrier --help exits 0 with its section', { skip: !gitOk && 'git unavailable' }, () => {
  const tree = skillsTree();
  const root = project();
  assert.equal(run(tree.script, [root]).status, 0);
  const scaffold = run(path.join(engineOf(root), 'bin', 'gates.cjs'), ['--scaffold'], { cwd: root });
  assert.equal(scaffold.status, 0, scaffold.stderr);
  const help = run(path.join(engineOf(root), 'bin', 'gates.cjs'), ['barrier', '--help'], { cwd: root });
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /## `barrier`/);
});

test('no engine skill beside the orchestrator is a clear error, and nothing is written', { skip: !gitOk && 'git unavailable' }, () => {
  const tree = skillsTree({ engine: false });
  const root = project();
  const r = run(tree.script, [root]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /^pin-engine: no clean-code-gates skill beside this orchestrator/);
  assert.match(r.stderr, /re-run the orchestrator's setup/);
  assert.deepEqual(fs.readdirSync(path.join(root, '.orchestrator')), []);
});

test('a root that is not a git top level holding .orchestrator/ is refused, and nothing is written', { skip: !gitOk && 'git unavailable' }, () => {
  const tree = skillsTree();
  const root = project();
  fs.mkdirSync(path.join(root, 'app', '.orchestrator'), { recursive: true });
  const nested = run(tree.script, [path.join(root, 'app')]);
  assert.equal(nested.status, 1);
  assert.match(nested.stderr, /is not the top level of a git repository/);

  const loose = tempDir('pin-loose-');
  fs.mkdirSync(path.join(loose, '.orchestrator'));
  const notGit = run(tree.script, [loose]);
  assert.equal(notGit.status, 1);
  assert.match(notGit.stderr, /is not the top level of a git repository/);

  const bare = tempDir('pin-bare-');
  git(bare, 'init', '-q');
  const noOrchestrator = run(tree.script, [bare]);
  assert.equal(noOrchestrator.status, 1);
  assert.match(noOrchestrator.stderr, /has no \.orchestrator\//);

  const usage = run(tree.script, []);
  assert.equal(usage.status, 2);
  assert.match(usage.stderr, /^usage: /);

  assert.deepEqual(fs.readdirSync(path.join(root, 'app', '.orchestrator')), []);
  assert.deepEqual(fs.readdirSync(path.join(loose, '.orchestrator')), []);
  assert.ok(!fs.existsSync(path.join(bare, '.orchestrator')));
});
