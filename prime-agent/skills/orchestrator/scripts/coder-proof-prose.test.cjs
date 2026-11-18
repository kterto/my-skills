#!/usr/bin/env node
'use strict';
/**
 * The owner's development directives in the role templates (ADR-0037): red fails for the
 * expected reason, tests assert what a caller observes, green is seen, every phase is one
 * vertical cycle, and every phase ends in a recorded proof through its real entry point.
 * Nothing executes these sentences but a live run, so a template that drifts back to
 * "implementing is enough" would pass every other test. This pins them.
 *
 * Each rule is a list of patterns over one template. violations() is pure, so the second
 * test proves every pattern fails when the text it pins is removed: a pin that a deletion
 * cannot break is no pin.
 *
 *   node --test scripts/coder-proof-prose.test.cjs
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(SKILL_DIR, rel), 'utf8');
// Hard-wrapped prose: a pinned sentence may break at any space.
const flat = (text) => text.replace(/\s+/g, ' ');

const RULES = [
  { file: 'templates/coder.md', rule: 'red fails on the assertion, never on a compile or import error',
    must: [/\*\*A compile, import or missing-symbol error is not red\*\*: stub the symbol until your assertion is what fails/] },
  { file: 'templates/coder.md', rule: 'a test asserts what a caller can observe',
    must: [/\*\*Assert what a caller can observe\*\* — a return value, a response, state read back, a rendered element — never that an internal function was called/] },
  { file: 'templates/coder.md', rule: 'green is seen in the output',
    must: [/\*\*read the pass in its output\*\* — green is seen, never assumed/] },
  { file: 'templates/coder.md', rule: 'each phase ends in a proof through its real entry point, recorded',
    must: [/### 4e — Per-phase proof/, /### \{ISO 8601 datetime\} \| CODER — PROOF/,
      /Proof: \{pass \| fail \| UNPROVEN \| deferred-to-join\}/, /cmd: \{the exact command/, /observed: \{/,
      /through its real entry point/] },
  { file: 'templates/coder.md', rule: 'a green unit test is not proof',
    must: [/\*\*A green unit test is not proof\.\*\*/] },
  { file: 'templates/coder.md', rule: 'a proof that cannot run is UNPROVEN, never claimed',
    must: [/record `UNPROVEN` with the reason — never a proof you did not run/] },
  { file: 'templates/coder.md', rule: 'a wrong result is fixed or recorded as fail, never hidden',
    must: [/A proof that shows the wrong result is this phase's defect/] },
  { file: 'templates/coder.md', rule: 'a lane proves alone or defers to the join',
    must: [/run without shared mutable state; anything else is `deferred-to-join`/] },
  { file: 'templates/coder.md', rule: 'proof cost stays scoped',
    must: [/reuse a stack that is already running/, /never the whole-app suite/] },
  { file: 'templates/coder.md', rule: 'DONE needs a proof or an UNPROVEN reason for every phase',
    must: [/Never mark the plan `DONE` while a phase has no `CODER — PROOF` entry/] },
  { file: 'templates/architect.md', rule: 'each phase is one vertical cycle with a named proof',
    must: [/Each phase is one vertical cycle/, /all backend first, then all UI/,
      /- Proof: \{the real entry point/, /bounded by the lane's owned globs/] },
  { file: 'templates/tester.md', rule: 'the tester reads the coder\'s proofs',
    must: [/`CODER — PROOF`/, /`UNPROVEN` or `deferred-to-join`/] },
  { file: 'templates/reviewer.md', rule: 'the reviewer reads the coder\'s proofs',
    must: [/`CODER — PROOF`/, /a `fail` is a Must Fix/] },
];

function violations(readText) {
  const out = [];
  for (const { file, rule, must } of RULES) {
    const text = flat(readText(file));
    for (const re of must) if (!re.test(text)) out.push(`${file}: ${rule} — no match for ${re}`);
  }
  return out;
}

test('every directive is in its template', () => {
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

test('the proof entry keeps the GATE entry\'s shape, and the phase gate stays separate from it', () => {
  const coder = read('templates/coder.md');
  const proof = coder.slice(coder.indexOf('### 4e — Per-phase proof'), coder.indexOf('### TDD rules'));
  assert.ok(proof.length > 0, '4e sits before the TDD rules');
  assert.ok(coder.indexOf('### 4d —') < coder.indexOf('### 4e —'), 'the proof runs after the phase gate');
  // The deferral is the gate's own outcome, not a second vocabulary.
  assert.match(flat(proof), /the same deferral as a gate with no path-scoped form \(4d rule 5\)/);
});
