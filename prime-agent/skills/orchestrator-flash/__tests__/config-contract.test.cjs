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
  'test_cmd', 'typecheck_cmd', 'build_cmd', 'live_cmd', 'live_minutes'];

// Documented, deliberately NOT written by the template. An explicit key outranks the
// project's `automation_level`, so a template that wrote one would make that read inert
// in every bootstrapped project — a default behaving as a pin, which is the failure the
// Configuration section forbids by name.
const UNPINNED = ['interview'];

const config = () => JSON.parse(readFileSync(join(FLASH, 'templates/flash-config.template.json'), 'utf8'));
const skill = () => readFileSync(join(FLASH, 'SKILL.md'), 'utf8');

test('the template holds exactly the nine pinnable keys', () => {
  assert.deepEqual(Object.keys(config()).sort(), [...KEYS].sort());
});

test('the tenth key is documented and deliberately absent from the template', () => {
  const md = skill();
  for (const k of UNPINNED) {
    assert.ok(!(k in config()), `the template pins \`${k}\`, which outranks a project's own setting`);
    assert.match(md, new RegExp(`^\\| \`${k}\``, 'm'), `\`${k}\` is not in the configuration table`);
    assert.match(md, /not in the config template/i,
      'nothing says why the key is absent, so the next edit adds it back');
  }
});

test('the defaults are the ones the spec fixed', () => {
  const c = config();
  assert.equal(c.review, true);
  assert.equal(c.simplify, false);
  assert.equal(c.max_review_cycles, 1);
  assert.equal(c.warn_after_minutes, 90);
  assert.equal(c.live_minutes, 15);
});

test('the four command keys ship null so detection runs', () => {
  const c = config();
  for (const k of ['test_cmd', 'typecheck_cmd', 'build_cmd', 'live_cmd']) {
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

test('the live keys are documented with their defaults, and no key turns the check off', () => {
  // D8: the live check runs on every run. The two keys shape it (what to start, how long it
  // may take) and neither can skip it; a key like `live: false` would be a switch D8 forbids.
  const md = skill();
  assert.match(md, /^\| `live_cmd` \| `null` \|/m);
  assert.match(md, /^\| `live_minutes` \| `15` \|/m);
  assert.deepEqual(Object.keys(config()).filter((k) => /^live/.test(k)).sort(), ['live_cmd', 'live_minutes']);
  // A key documented in the table is a key, template or not: `interview` is one the template
  // omits. So the table holds no switch either.
  const table = md.slice(md.indexOf('## Configuration'), md.indexOf('## How to spawn a role'));
  assert.ok(table.startsWith('## Configuration') && table.length > 0, 'the Configuration section or its end sentinel was renamed');
  const rows = table.split('\n').filter((l) => /^\| `live/.test(l)).map((l) => /^\| `([^`]+)`/.exec(l)[1]);
  assert.deepEqual(rows.sort(), ['live_cmd', 'live_minutes'], 'the configuration table documents a live key D8 does not have');
});

test('a review budget of 0 is documented as a disabled loop, not a clamp', () => {
  assert.match(skill(), /`max_review_cycles`[^\n]*\b0\b/);
});
