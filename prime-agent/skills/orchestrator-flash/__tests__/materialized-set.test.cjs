#!/usr/bin/env node
'use strict';
/**
 * Three lists have to agree or the skill re-bootstraps on every run (or, worse,
 * never): the files the stamp digests, the files the bootstrap step copies, and the
 * files the staleness trigger names. This test is the only thing that compares them.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
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

test('the digested set is exactly the six materialized files', () => {
  assert.deepEqual(stampFiles().sort(), [
    'templates/architect.md',
    'templates/artifact-format-flash.md',
    'templates/brainstormer.md',
    'templates/coder.md',
    'templates/flash-config.template.json',
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

test('the stamp file exists and is a single hex line', () => {
  const stamp = readFileSync(join(FLASH, 'MATERIALIZED-VERSION'), 'utf8').trim();
  assert.match(stamp, /^[0-9a-f]{16,64}$/);
});
