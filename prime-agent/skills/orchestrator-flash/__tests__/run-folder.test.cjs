#!/usr/bin/env node
'use strict';
/**
 * The run-folder grammar is enforced by a regex in check-artifact-home.cjs, not by
 * prose. Two copies of a grammar is how a folder name and the pattern that validates
 * it drift apart, so this test asserts flash's copy is byte-identical to the
 * orchestrator's normative one AND that what it mints actually passes the gate.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const REPO = join(__dirname, '..', '..', '..', '..', '..');
const FLASH = join(REPO, 'plugins/my-skills/skills/orchestrator-flash');
const ORCH = join(REPO, 'plugins/my-skills/skills/orchestrator');

/** The gate's own regex, read from the shipped script so the two cannot drift. */
function runFolderRegex() {
  const src = readFileSync(join(ORCH, 'scripts/check-artifact-home.cjs'), 'utf8');
  const line = src.split('\n').find((l) => l.startsWith('const RUN_FOLDER ='));
  assert.ok(line, 'check-artifact-home.cjs no longer declares RUN_FOLDER');
  return new RegExp(line.slice(line.indexOf('/') + 1, line.lastIndexOf('/')));
}

/** Extract the first ```bash fence that defines slugify() from a markdown file. */
function bashRecipe(file) {
  const md = readFileSync(file, 'utf8');
  const fences = md.split('```bash').slice(1).map((c) => c.split('```')[0]);
  const recipe = fences.find((f) => f.includes('slugify()'));
  assert.ok(recipe, `${file} has no bash fence defining slugify()`);
  return recipe;
}

function runBash(recipe, script) {
  return execFileSync('bash', ['-c', `${recipe}\n${script}`], { encoding: 'utf8' }).trim();
}

test('flash slugify is byte-identical to the orchestrator normative copy', () => {
  const flash = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  const orch = bashRecipe(join(ORCH, 'references/artifact-format.md'));
  const fn = (s) => s.slice(s.indexOf('slugify()'), s.indexOf('newrun()'));
  assert.equal(fn(flash), fn(orch));
});

test('slugify strips the trailing hyphen truncation leaves', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  const out = runBash(r, 'slugify "Spot opening hours for a cafe near me right now"');
  assert.match(out, /^[a-z0-9]([a-z0-9-]{0,38}[a-z0-9])?$/);
  assert.ok(!out.endsWith('-'), `slug ended in a hyphen: ${out}`);
});

test('slugify falls back to "run" when nothing alphanumeric survives', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  assert.equal(runBash(r, 'slugify "+++ --- +++"'), 'run');
});

test('slugify collapses + rather than carrying it into a name', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  assert.equal(runBash(r, 'slugify "a+b"'), 'a-b');
});

test('newrun mints a folder the home gate accepts', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  const out = runBash(r, 'newrun "$(slugify "spot opening hours")"');
  assert.ok(out.startsWith('plans/'), `not under plans/: ${out}`);
  assert.match(out.slice('plans/'.length), runFolderRegex());
});

test('newrun of an empty invocation still passes the gate', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  const out = runBash(r, 'newrun "$(slugify "")"');
  assert.match(out.slice('plans/'.length), runFolderRegex());
});

test('newid mints a prefixed ID and never scans a directory', () => {
  const r = bashRecipe(join(FLASH, 'templates/artifact-format-flash.md'));
  assert.match(runBash(r, 'newid SPEC'), /^SPEC-[0-9]{8}T[0-9]{6}Z-[0-9a-f]{4}$/);
  assert.ok(!r.includes('ls '), 'the mint recipe lists a directory');
});
