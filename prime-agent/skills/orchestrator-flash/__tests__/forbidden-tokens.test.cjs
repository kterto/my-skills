#!/usr/bin/env node
'use strict';
/**
 * Four preamble keys in the orchestrator signal by their ABSENCE — a role that sees
 * `lane=` at all switches into join mode. Flash has no lanes, no joins and no html,
 * so the safe form is for the tokens never to appear. This test is the guard.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const FLASH = join(__dirname, '..');
const files = () => [
  join(FLASH, 'SKILL.md'),
  ...readdirSync(join(FLASH, 'templates'))
    .filter((f) => f.endsWith('.md'))
    .map((f) => join(FLASH, 'templates', f)),
];

const FORBIDDEN = ['lane=', 'contract=', 'leaves=', 'aggregate=', 'tree=', 'delta=',
  'output_format=html', '.progress.md', 'deferred-to-join', 'render-artifact.cjs'];

test('no parallel, join or html token appears anywhere in the skill', () => {
  for (const f of files()) {
    const body = readFileSync(f, 'utf8');
    for (const token of FORBIDDEN) {
      assert.ok(!body.includes(token), `${f} contains the forbidden token "${token}"`);
    }
  }
});

test('pre-flight binds the four run variables before any spawn', () => {
  const md = readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
  for (const v of ['base_sha', 'run_started_at', 'run_dir', 'role_agent_type']) {
    assert.ok(md.includes(v), `SKILL.md never binds ${v}`);
  }
});

test('every spawn carries run_dir unconditionally', () => {
  const md = readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
  assert.match(md, /run_dir=/);
  assert.ok(!/run_dir=[^\n]*\bonly\b/i.test(md), 'run_dir is described as conditional');
});

test('the reviewer base is shipped under the name four roles already read', () => {
  assert.match(readFileSync(join(FLASH, 'SKILL.md'), 'utf8'), /MAESTRO_REVIEW_BASE=/);
});

test('roles are spawned as a generic agent type, never a registered role name', () => {
  const md = readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
  assert.match(md, /general-purpose/);
  assert.ok(!/subagent_type:\s*"(brainstormer|architect|coder|reviewer)"/.test(md),
    'flash registers a role agent type that sync-agents.sh --prune would delete');
});

test('a pre-mint stop never rmdirs an unbound path', () => {
  const md = readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
  for (const line of md.split('\n').filter((l) => l.includes('rmdir'))) {
    assert.match(line, /\$\{run_dir:-\}|-n "\$run_dir"|2>\/dev\/null/,
      `unguarded rmdir: ${line}`);
  }
});
