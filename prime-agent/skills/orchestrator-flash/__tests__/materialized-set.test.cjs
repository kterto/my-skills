#!/usr/bin/env node
'use strict';
/**
 * Three lists have to agree or the skill re-bootstraps on every run (or, worse,
 * never): the files the stamp digests, the files the bootstrap step copies, and the
 * files the staleness trigger names. This test is the only thing that compares them.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { join } = require('node:path');

const REPO = join(__dirname, '..', '..', '..', '..', '..');
const FLASH = join(__dirname, '..');
const skill = () => readFileSync(join(FLASH, 'SKILL.md'), 'utf8');

/** The enumerated set, read out of the stamp script's source. */
function stampFiles() {
  const src = readFileSync(join(REPO, 'scripts/stamp-flash-version.mjs'), 'utf8');
  const start = src.indexOf('export const FLASH_FILES');
  const block = src.slice(start, src.indexOf(']', start));
  return [...block.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

test('every digested file exists in the skill', () => {
  for (const rel of stampFiles()) {
    assert.ok(existsSync(join(FLASH, rel)), `the stamp digests a missing file: ${rel}`);
  }
});

test('the digested set is exactly the seven materialized files', () => {
  assert.deepEqual(stampFiles().sort(), [
    'templates/architect.md',
    'templates/artifact-format-flash.md',
    'templates/brainstormer.md',
    'templates/coder.md',
    'templates/flash-config.template.json',
    'templates/live.md',
    'templates/reviewer.md',
  ]);
});

test('the staleness trigger names every digested file', () => {
  const md = skill();
  for (const rel of stampFiles()) {
    const base = rel.split('/').pop();
    assert.ok(md.includes(base), `the bootstrap trigger never names ${base}`);
  }
});

test('the trigger compares the stamp, not just presence', () => {
  assert.match(skill(), /MATERIALIZED-VERSION/);
  assert.match(skill(), /\.materialized-version/);
});

test('no test file is ever materialized into a consumer project', () => {
  for (const rel of stampFiles()) {
    assert.ok(!rel.includes('__tests__'), `the stamp digests a test file: ${rel}`);
  }
});

test('the two skills write the same .gitignore region, byte for byte', () => {
  // Both bootstraps own `.orchestrator/`. If their managed blocks ever differ, whichever
  // ran last silently changes what the project tracks — and the orchestrator rewrites the
  // region on every bootstrap, so flash's version would lose without anyone noticing.
  const block = (src) => {
    const start = src.indexOf('# --- BEGIN orchestrator-managed');
    const end = src.indexOf('# --- END orchestrator-managed', start);
    assert.ok(start > -1 && end > start, 'no orchestrator-managed block found');
    return src.slice(start, end).split('\n').map((l) => l.trim()).filter(Boolean);
  };
  const boot = readFileSync(join(REPO, 'plugins/my-skills/skills/orchestrator/references/bootstrap.md'), 'utf8');
  assert.deepEqual(block(skill()), block(boot),
    "flash's .gitignore block has drifted from the orchestrator's");
});

test('the allow-list tracks the flash config and ignores the flash role copies', () => {
  const md = skill();
  assert.match(md, /^!flash-config\.json$/m,
    'flash-config.json is hand-authored project policy and would be invisible to a teammate\'s clone');
  assert.ok(!/^!flash\//m.test(md),
    'the materialized role copies are tracked — every flash version bump would land in a product PR');
});

test('a first run is not dirty from its own bootstrap: the guard exempts exactly what bootstrap leaves', () => {
  // On a flash-only project, bootstrap writes `.gitignore` and `flash-config.json`, and the
  // allow-list un-ignores both. A guard that counted them would ask about a mess the run just
  // made, on every first run, and stall product-manager's first story on it. The plain porcelain
  // collapses them to `?? .orchestrator/`, so the guard reads every untracked file.
  const md = skill();
  const guard = /^4\. \*\*Guard the workspace\.\*\*.*$/m.exec(md)?.[0];
  assert.ok(guard, 'Step 0 has no workspace guard');
  assert.match(guard, /`git status --porcelain -uall`/);
  const exempt = [...guard.matchAll(/`(\?\? [^`]+)`/g)].map((m) => m[1]);

  const root = mkdtempSync(join(tmpdir(), 'flash-guard-'));
  try {
    const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))), GIT_CEILING_DIRECTORIES: tmpdir() };
    const git = (...args) => execFileSync('git', ['-c', 'core.excludesFile=/dev/null', '-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args],
      { cwd: root, env, encoding: 'utf8' });
    git('init', '-q');
    git('-c', 'user.name=flash', '-c', 'user.email=flash@example.invalid', 'commit', '-q', '--allow-empty', '-m', 'init');
    // Bootstrap as the section says: the role files, the stamp, the config, and the .gitignore block.
    mkdirSync(join(root, '.orchestrator', 'flash'), { recursive: true });
    for (const f of ['artifact-format-flash.md', 'brainstormer.md', 'architect.md', 'coder.md', 'live.md', 'reviewer.md']) {
      copyFileSync(join(FLASH, 'templates', f), join(root, '.orchestrator', 'flash', f));
    }
    copyFileSync(join(FLASH, 'MATERIALIZED-VERSION'), join(root, '.orchestrator', 'flash', '.materialized-version'));
    copyFileSync(join(FLASH, 'templates', 'flash-config.template.json'), join(root, '.orchestrator', 'flash-config.json'));
    const block = /```gitignore\n([\s\S]*?)```/.exec(md);
    assert.ok(block, 'the Bootstrap section has no .gitignore block');
    writeFileSync(join(root, '.orchestrator', '.gitignore'), block[1]);
    const dirty = git('status', '--porcelain', '-uall').split('\n').filter(Boolean);
    assert.deepEqual(dirty.sort(), exempt.sort(), 'the guard\'s exemptions are not what bootstrap leaves untracked');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a proceed on a protected branch still cuts the flash branch, named from the brief', () => {
  const guard = /^4\. \*\*Guard the workspace\.\*\*.*$/m.exec(skill())?.[0] ?? '';
  assert.match(guard, /Clean or proceeding, on `main`, `master`, `develop`, `dev` or `release\/\*` cut and switch to `flash\/<slug>`/);
  assert.match(guard, /`<slug>` the `slugify` of the brief's first five words/, 'the guard names a slug that nothing has minted yet');
});

test('the stamp file exists and is a single hex line', () => {
  const stamp = readFileSync(join(FLASH, 'MATERIALIZED-VERSION'), 'utf8').trim();
  assert.match(stamp, /^[0-9a-f]{16,64}$/);
});
