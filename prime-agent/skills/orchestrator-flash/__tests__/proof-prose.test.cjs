#!/usr/bin/env node
'use strict';
/**
 * Flash's short form of the owner's development directives (ADR-0037): tasks grouped into
 * vertical cycles that each open with a `Proof (planned):` line, which the coder replaces
 * with what it ran and saw before the cycle's last box. Flash keeps no sidecar, so the plan
 * is the record, and a planned line left in place is how a skipped proof stays visible.
 * SENTENCES holds every rule sentence as the templates write it; the mutation test deletes
 * each from its real template and requires a pin to notice.
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

const ARCHITECT = 'templates/architect.md';
const CODER = 'templates/coder.md';

const RULES = [
  { file: ARCHITECT, must: [/Group the tasks into vertical cycles/, /ends in something runnable/,
    /opens with a `Proof \(planned\):` line naming the entry point/] },
  { file: CODER, must: [/assert what a caller sees, never that a function was called/,
    /run its `Proof \(planned\):` through the real entry point and replace that line/,
    /\*\*A passing unit test is not proof\.\*\*/, /`Proof: \{the command\} → \{what it showed\}`/,
    /`Proof: UNPROVEN — \{why\}`/, /never one you did not run/, /Stop every process you started for it/,
    /and no `Proof \(planned\):` line remains, flip/] },
];

const SENTENCES = [
  [ARCHITECT, 'Group the tasks into vertical cycles: each cuts through every layer one user-visible behaviour needs, ends in something runnable, and opens with a `Proof (planned):` line naming the entry point and the result that shows it works.'],
  [ARCHITECT, 'ends in something runnable, '],
  [CODER, 'assert what a caller sees, never that a function was called.'],
  [CODER, "Before a cycle's last box, run its `Proof (planned):` through the real entry point and replace that line with"],
  [CODER, '`Proof: {the command} → {what it showed}`'],
  [CODER, 'or `Proof: UNPROVEN — {why}` when it cannot run; never one you did not run.'],
  [CODER, '**A passing unit test is not proof.**'],
  [CODER, 'Stop every process you started for it.'],
  [CODER, 'and no `Proof (planned):` line remains,'],
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

test('every rule sentence is still in its template', () => {
  for (const [file, sentence] of SENTENCES) {
    assert.ok(flat(read(file)).includes(sentence), `${file} no longer says: ${sentence}`);
  }
});

test('deleting any rule sentence from its real template fails the check', () => {
  const unpinned = SENTENCES.filter(([file, sentence]) => {
    const broken = (rel) => (rel === file ? flat(read(rel)).split(sentence).join(' ') : read(rel));
    return violations(broken).length === 0;
  }).map(([file, sentence]) => `${file}: deleting "${sentence}" breaks no pin`);
  assert.deepEqual(unpinned, []);
});

test('a planned proof and a recorded one never share a shape', () => {
  const planned = /`Proof \(planned\):/;
  assert.match(read(ARCHITECT), planned);
  // The architect never writes the coder's recorded shape, so an untouched line reads as unproven.
  assert.doesNotMatch(read(ARCHITECT), /`Proof:/);
});

test('the proof lines are bookkeeping the coder names, and the live check stays the independent one', () => {
  assert.match(flat(read(CODER)), /Those two flips and the `Proof:` lines are the entire bookkeeping/);
  // The coder's proof never stands in for the live role's: that one runs through a channel the coder did not write.
  assert.match(read('templates/live.md'), /through a channel the coder did not write/);
});
