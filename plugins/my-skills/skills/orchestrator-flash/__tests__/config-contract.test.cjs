#!/usr/bin/env node
'use strict';
/**
 * `rigor: sketch` was a design on paper because the orchestrator's config template
 * wrote every cap explicitly and an explicit key beats its preset. These tests make
 * that class of defect mechanical for flash: the template holds exactly the
 * documented keys, and the one key whose name promises a bound must not bound.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const FLASH = join(__dirname, '..');
const KEYS = ['review', 'simplify', 'max_review_cycles', 'warn_after_minutes',
  'test_cmd', 'typecheck_cmd', 'build_cmd'];

const config = () => JSON.parse(readFileSync(join(FLASH, 'templates/flash-config.template.json'), 'utf8'));
const skill = () => readFileSync(join(FLASH, 'SKILL.md'), 'utf8');

test('the template holds exactly the seven documented keys', () => {
  assert.deepEqual(Object.keys(config()).sort(), [...KEYS].sort());
});

test('the defaults are the ones the spec fixed', () => {
  const c = config();
  assert.equal(c.review, true);
  assert.equal(c.simplify, false);
  assert.equal(c.max_review_cycles, 1);
  assert.equal(c.warn_after_minutes, 90);
});

test('the three command keys ship null so detection runs', () => {
  const c = config();
  for (const k of ['test_cmd', 'typecheck_cmd', 'build_cmd']) {
    assert.equal(c[k], null, `${k} pins a command the project should supply`);
  }
});

test('every template key is documented in SKILL.md', () => {
  const md = skill();
  for (const k of KEYS) assert.ok(md.includes(k), `SKILL.md never mentions ${k}`);
});

test('no key named max_run_minutes survives — the clock is advisory', () => {
  assert.ok(!('max_run_minutes' in config()));
  assert.ok(!skill().includes('max_run_minutes'));
});

test('the clock never halts the run', () => {
  const md = skill();
  const clockLines = md.split('\n').filter((l) => l.includes('warn_after_minutes'));
  assert.ok(clockLines.length > 0, 'SKILL.md never mentions warn_after_minutes');
  for (const line of clockLines) {
    assert.ok(!/\bSTALLED\b|\bhalts?\b/i.test(line),
      `the advisory clock is wired to a stop: ${line}`);
    assert.ok(!/\bstops? the run\b/i.test(line) || /never|nothing|does not/i.test(line),
      `the advisory clock is wired to a stop: ${line}`);
  }
});

test('a review budget of 0 is documented as a disabled loop, not a clamp', () => {
  assert.match(skill(), /`max_review_cycles`[^\n]*\b0\b/);
});
