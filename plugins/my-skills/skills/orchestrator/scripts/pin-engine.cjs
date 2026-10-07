#!/usr/bin/env node
'use strict';
/**
 * pin-engine.cjs — copy the clean-code-gates engine into a project, so every gate
 * command a run executes uses one build: the build this orchestrator release was
 * stamped with.
 *
 *   node <orchestrator skill dir>/scripts/pin-engine.cjs <project root>
 *
 * Bootstrap runs it from the skill directory (`references/bootstrap.md` → B3, item 2),
 * after the other copies and before the stamp. Roles then run
 * `.orchestrator/engine/bin/gates.cjs` and nothing else (`references/gate-config.md` →
 * *The pinned engine*). The script is skill-only: it is never copied into a project.
 *
 * Why a copy. Any other path a role could run names whatever build is there at that
 * moment: a skills link into a working tree changes with every edit made in it, and a
 * plugin cache directory is named by one release and swept after the next. A copy
 * taken at bootstrap stays the build the stamp vouches for until bootstrap runs again.
 *
 * One definition of the engine. `isEngineFile` is the only list. This script copies
 * through it, `scripts/stamp-orchestrator-version.mjs` digests through it, and the
 * Prime builder filters through it, so the files a project receives and the files the
 * stamp covers cannot drift apart. The engine is what `bin/gates.cjs` loads when it
 * runs: `bin/` and `src/`, plus `defaults.cjs`, `package.json` (the version every report
 * carries) and `references/instruments.md` (what `<kind> --help` prints). Tests, schemas
 * and the skill's own docs never run, so they are not copied, and editing them moves
 * no stamp.
 *
 * The swap is atomic. The new copy is built whole in `.orchestrator/engine.tmp-<pid>`
 * and only then renamed into place, so `.orchestrator/engine` never holds half a copy:
 * a process still running the old engine never meets a half-copied tree, and a copy
 * that fails part-way leaves the old engine where it was. The copy's `.gitignore` is
 * its first file, so even what a crash leaves behind stays out of git.
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ENGINE_DIRS = new Set(['bin', 'src']);
const ENGINE_FILES = new Set(['defaults.cjs', 'package.json', 'references/instruments.md']);
// Never engine files, at any depth: test suites, and the metadata a desktop file
// browser drops beside source files.
const NEVER = new Set(['__tests__', '.DS_Store']);

/** Whether `rel`, a '/'-separated path inside the clean-code-gates skill, is an engine file. */
function isEngineFile(rel) {
  if (typeof rel !== 'string') return false;
  const parts = rel.split('/');
  if (parts.some((part) => part === '' || part === '.' || part === '..' || NEVER.has(part))) return false;
  return ENGINE_FILES.has(rel) || (parts.length > 1 && ENGINE_DIRS.has(parts[0]));
}

// By code unit, never by locale: the copy's digest and the stamp both hash this list
// in order, and a locale collation would order it differently on another machine.
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function walk(dir, rel, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (NEVER.has(entry.name)) continue;
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(path.join(dir, entry.name), child, out);
    else if (entry.isFile()) out.push(child);
  }
  return out;
}

/** The engine files of the clean-code-gates skill at `cgDir`, '/'-separated and sorted. */
function engineFiles(cgDir) {
  return walk(cgDir, '', []).filter(isEngineFile).sort(byCodeUnit);
}

function realpathOrNull(target) {
  try {
    return fs.realpathSync(target);
  } catch {
    return null;
  }
}

function gitTopLevel(dir) {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

// The orchestrator's own stamp, which covers the engine files: the one value that
// says which release a project's copy came from.
function orchestratorStamp() {
  try {
    return fs.readFileSync(path.join(__dirname, '..', 'MATERIALIZED-VERSION'), 'utf8').trim() || null;
  } catch {
    return null;
  }
}

function resolveProject(rootArg) {
  const root = realpathOrNull(path.resolve(rootArg));
  const top = root && fs.statSync(root).isDirectory() ? realpathOrNull(gitTopLevel(root) ?? '') : null;
  if (!root || top !== root) {
    throw new Error(`${rootArg} is not the top level of a git repository; pass "$(git rev-parse --show-toplevel)"`);
  }
  const orchestrator = path.join(root, '.orchestrator');
  if (!fs.statSync(orchestrator, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${rootArg} has no .orchestrator/; the engine is pinned by the orchestrator's setup, after it creates that directory`);
  }
  return orchestrator;
}

function resolveEngine() {
  const sibling = path.resolve(__dirname, '..', '..', 'clean-code-gates');
  const engineDir = realpathOrNull(sibling);
  if (!engineDir) {
    throw new Error(`no clean-code-gates skill beside this orchestrator (looked for ${sibling}); install the skill set whole, then re-run the orchestrator's setup`);
  }
  const rels = engineFiles(engineDir);
  if (!rels.includes('bin/gates.cjs')) throw new Error(`${engineDir} holds no bin/gates.cjs, so it is not a clean-code-gates engine`);
  return { engineDir, rels };
}

/** Build the whole copy in `next`. Returns the digest of the engine files written. */
function buildCopy(next, engineDir, rels, stamp) {
  fs.mkdirSync(next);
  fs.writeFileSync(path.join(next, '.gitignore'), '*\n');
  const hash = crypto.createHash('sha256');
  for (const rel of rels) {
    const from = path.join(engineDir, ...rel.split('/'));
    const to = path.join(next, ...rel.split('/'));
    const bytes = fs.readFileSync(from);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    fs.writeFileSync(to, bytes, { mode: fs.statSync(from).mode & 0o777 });
    // Length-framed, so no file's bytes can pass for the next file's header.
    hash.update(`${rel}\0${bytes.length}\0`);
    hash.update(bytes);
  }
  const digest = hash.digest('hex');
  const source = engineDir.split(path.sep).filter(Boolean).slice(-4).join('/');
  const record = `{"source": ${JSON.stringify(source)}, "stamp": ${JSON.stringify(stamp)}, "engine_digest": ${JSON.stringify(digest)}}\n`;
  fs.writeFileSync(path.join(next, 'PINNED'), record);
  return { source, digest };
}

/** Rename the finished copy into place; on any failure, put the old copy back. */
function swapIn(next, live, retired) {
  fs.rmSync(retired, { recursive: true, force: true });
  const hadLive = fs.lstatSync(live, { throwIfNoEntry: false }) !== undefined;
  try {
    if (hadLive) fs.renameSync(live, retired);
    try {
      fs.renameSync(next, live);
    } catch (error) {
      if (hadLive) fs.renameSync(retired, live);
      throw error;
    }
  } catch (error) {
    fs.rmSync(next, { recursive: true, force: true });
    throw new Error(`could not swap the new engine in (${error.message}); .orchestrator/engine was left as it was`);
  }
  if (hadLive) fs.rmSync(retired, { recursive: true, force: true });
}

function pin(rootArg) {
  const orchestrator = resolveProject(rootArg);
  const { engineDir, rels } = resolveEngine();
  const stamp = orchestratorStamp();
  const next = path.join(orchestrator, `engine.tmp-${process.pid}`);
  fs.rmSync(next, { recursive: true, force: true });
  let built;
  try {
    built = buildCopy(next, engineDir, rels, stamp);
  } catch (error) {
    fs.rmSync(next, { recursive: true, force: true });
    throw new Error(`copying the engine failed (${error.message}); .orchestrator/engine was left as it was`);
  }
  swapIn(next, path.join(orchestrator, 'engine'), path.join(orchestrator, `engine.old-${process.pid}`));
  return { count: rels.length, stamp, ...built };
}

function main(argv) {
  if (argv.length !== 1 || argv[0] === '' || argv[0].startsWith('-')) {
    process.stderr.write('usage: node pin-engine.cjs <project root>\n');
    return 2;
  }
  try {
    const { count, source, stamp, digest } = pin(argv[0]);
    process.stdout.write(`pinned .orchestrator/engine/: ${count} files from ${source} (stamp ${stamp ?? 'none'}, digest ${digest.slice(0, 12)})\n`);
    return 0;
  } catch (error) {
    process.stderr.write(`pin-engine: ${error.message}\n`);
    return 1;
  }
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));

module.exports = { isEngineFile, engineFiles };
