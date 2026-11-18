#!/usr/bin/env node
'use strict';
/**
 * Flash's short form of the owner's development directives (ADR-0037): tasks grouped into
 * vertical cycles that each name a proof, and a `Proof:` line the coder writes under each
 * cycle before checking its last task. Flash keeps no sidecar, so the plan is the record.
 * violations() is pure, so the second test proves each pattern fails when its text is gone.
 *
 *   node --test __tests__/proof-prose.test.cjs
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const FLASH = join(__dirname, '..');
const read = (rel) => readFileSync(join(FLASH, rel), 'utf8');
const flat = (text) => text.replace(/\s+/g, ' ');

const RULES = [
  { file: 'templates/architect.md', must: [/vertical cycle/, /`Proof:` line naming the entry point/] },
  { file: 'templates/coder.md', must: [/assert what a caller sees, never that a function was called/,
    /\*\*A passing unit test is not proof\.\*\*/, /`Proof: \{the command\} → \{what it showed\}`/,
    /`Proof: UNPROVEN — \{why\}`/, /never one you did not run/] },
];

function violations(readText) {
  const out = [];
  for (const { file, must } of RULES) {
    const text = flat(readText(file));
    for (const re of must) if (!re.test(text)) out.push(`${file}: no match for ${re}`);
  }
  return out;
}

test('the cycle and proof rules are in the flash templates', () => {
  assert.deepEqual(violations(read), []);
});

test('removing the text any pattern pins fails the check', () => {
  for (const { file, must } of RULES) {
    for (const re of must) {
      const broken = (rel) => (rel === file ? flat(read(rel)).replace(new RegExp(re.source, 'g'), '') : read(rel));
      assert.ok(violations(broken).length > 0, `${file}: deleting ${re} breaks nothing`);
    }
  }
});

test('the proof lines are bookkeeping the coder names, and the live check stays the independent one', () => {
  assert.match(flat(read('templates/coder.md')), /Those two flips and the `Proof:` lines are the entire bookkeeping/);
  // The coder's proof never stands in for the live role's: that one runs through a channel the coder did not write.
  assert.match(read('templates/live.md'), /through a channel the coder did not write/);
});
