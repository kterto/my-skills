#!/usr/bin/env node
'use strict';
/**
 * The owner's development directives in the role templates (ADR-0037): red fails for the
 * expected reason, tests assert what a caller observes, green is seen, every phase is one
 * vertical cycle, and every phase ends in a recorded proof through its real entry point.
 * Nothing executes these sentences but a live run, so a template that drifts back to
 * "implementing is enough" would pass every other test. This pins them.
 *
 * RULES holds the pins; SENTENCES holds every rule sentence as the templates write it. The
 * mutation test deletes each sentence from its real template and requires violations() to
 * report it, so a rule sentence no pin covers fails here instead of being deletable in
 * silence. SENTENCES must also still be in the templates, so the list cannot rot into a
 * list of text that no longer exists.
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

const CODER = 'templates/coder.md';
const ARCHITECT = 'templates/architect.md';
const TESTER = 'templates/tester.md';
const REVIEWER = 'templates/reviewer.md';
const PARALLEL = 'references/parallel.md';

const RULES = [
  { file: CODER, rule: 'red fails on the assertion, never on a compile or import error',
    must: [/\*\*A compile, import or missing-symbol error is not red\*\*: stub the symbol until your assertion is what fails/] },
  { file: CODER, rule: 'a test asserts what a caller can observe',
    must: [/\*\*Assert what a caller can observe\*\* — a return value, a response, state read back, a rendered element — never that an internal function was called/] },
  { file: CODER, rule: 'green is seen in the output',
    must: [/\*\*read the pass in its output\*\* — green is seen, never assumed/] },
  { file: CODER, rule: 'each phase ends in a proof through its real entry point, recorded',
    must: [/### 4e — Per-phase proof/, /### \{ISO 8601 datetime\} \| CODER — PROOF/,
      /Proof: \{pass \| fail \| UNPROVEN \| deferred-to-join\}/, /cmd: \{the exact command\(s\) you ran\}/, /observed: \{/,
      /run the behaviour the phase delivers through its real entry point/, /Append one entry per phase to `\.progress\.md`/] },
  { file: CODER, rule: 'a green unit test is not proof',
    must: [/\*\*A green unit test is not proof\.\*\*/] },
  { file: CODER, rule: 'a plan that says UNPROVEN is recorded as UNPROVEN',
    must: [/A plan line `Proof: UNPROVEN — \{reason\}` is recorded as `UNPROVEN` with that reason/,
      /do not hunt for a surface the architect ruled out/] },
  { file: CODER, rule: 'a proof that cannot run is UNPROVEN, never claimed',
    must: [/record `UNPROVEN` with the reason — never a proof you did not run/] },
  { file: CODER, rule: 'a wrong result is fixed or recorded as fail, never hidden',
    must: [/A proof that shows the wrong result is this phase's defect/] },
  { file: CODER, rule: 'FIX and QAF proofs: behaviour reproduced, gate findings left to 4d and QA',
    must: [/a behavioural finding's proof is its own reproduction, now showing the fixed result/,
      /A gate finding's proof is its 4d entry: record `UNPROVEN — gate finding, proven by 4d \/ QA`/,
      /never reproduce G1 or G6 here/, /A doc-only plan records `UNPROVEN — no runnable surface`/] },
  { file: CODER, rule: 'a lane proves alone or defers to the tester, never to the gate join',
    must: [/prove only what you can run without shared mutable state/, /record anything else as `deferred-to-join`/,
      /\*\*This is not a deferred gate:\*\* the outer join runs deferred gates, never a deferred proof/,
      /the tester always includes a deferred phase in its e2e and reports its verdict/] },
  { file: CODER, rule: 'the integration lane proves its cross-lane slice',
    must: [/it proves its cross-lane slice instead of deferring it/] },
  { file: CODER, rule: 'proof cost stays scoped, and a started stack lives until Step 6',
    must: [/reuse a stack that is already running/, /never the whole-app suite/,
      /A stack you started may stay up for the next phase; stop everything you started before Step 6, and before you exit `BLOCKED`/] },
  { file: CODER, rule: 'DONE needs a proof or an UNPROVEN reason for every phase',
    must: [/Never mark the plan `DONE` while a phase has no `CODER — PROOF` entry/, /a recorded `UNPROVEN` reason counts, silence does not/] },
  { file: ARCHITECT, rule: 'each phase is one vertical cycle with a named proof',
    must: [/Each phase is one vertical cycle/, /ends in something runnable; later phases close the gaps/,
      /all backend first, then all UI/, /- Proof: \{the real entry point/] },
  { file: ARCHITECT, rule: 'a lane plan is sliced by its PACT and needs no horizontal justification',
    must: [/a lane plan's slicing is the `PACT`'s, and needs no such note/, /bounded by the lane's owned globs/,
      /a layer-scoped lane plan needs no Technical Notes justification/,
      /the cross-layer slice is proven by the integration lane or by the tester at the outer join/,
      /A `Proof:` the lane cannot run alone reads `deferred-to-join`/] },
  { file: ARCHITECT, rule: 'a proof the coder cannot run is planned as UNPROVEN, in the coder\'s word',
    must: [/A phase with no runnable surface reads `Proof: UNPROVEN — \{reason\}`/,
      /a behavioural finding's proof is its reproduction, now showing the fixed result/,
      /a gate finding's reads `Proof: UNPROVEN — gate finding, proven by 4d \/ QA`/,
      /a doc-only plan's `Proof: UNPROVEN — no runnable surface`/] },
  { file: TESTER, rule: 'the tester reads the coder\'s proofs and always runs a deferred one',
    must: [/Read the coder's `CODER — PROOF` entries in each plan's `\.progress\.md`/, /a phase recorded `UNPROVEN` is a candidate you score first/,
      /a phase recorded `deferred-to-join` is \*\*always included, never a deliberate exclusion\*\*/,
      /your report gives its proof a verdict/, /a `pass` is evidence, never a substitute for your e2e/,
      /\*\*Region F's `PROOF` rows replace\*\* the walk over every leaf `\.progress\.md`/] },
  { file: REVIEWER, rule: 'the reviewer reads the coder\'s proofs',
    must: [/\*\*The coder's `CODER — PROOF` entries\*\* in `\.progress\.md`, one per phase/, /a `fail` is a Must Fix/, /a phase with no entry at all is a Should Fix/,
      /a `pass` whose `cmd:` is only a test runner/, /an `UNPROVEN` whose reason contradicts a surface/,
      /\*\*Region F's `PROOF` rows replace\*\* the walk over every leaf `\.progress\.md`/] },
  { file: PARALLEL, rule: 'the join never runs a deferred proof, and the digest carries the proofs',
    must: [/\*\*A `CODER — PROOF` entry recorded `deferred-to-join` is not a deferred gate and never runs here\.\*\*/,
      /always includes that phase in its e2e and reports its verdict/,
      /per `CODER — PROOF` entry: leaf, phase, verdict, its `cmd:` or `reason:` line verbatim/,
      /tester, reviewer \(`PROOF` rows\)/] },
  { file: PARALLEL, rule: 'slicing prefers the feature axis',
    must: [/\*\*Prefer the `feature` axis\*\*/, /A `layer` split makes every lane plan horizontal and defers every proof to the join/] },
];

// Every rule sentence, flattened, exactly as its template writes it.
const SENTENCES = [
  [CODER, '**Assert what a caller can observe** — a return value, a response, state read back, a rendered element — never that an internal function was called: a test that still passes with the behaviour broken proves nothing.'],
  [CODER, '**A compile, import or missing-symbol error is not red**: stub the symbol until your assertion is what fails.'],
  [CODER, 'Run the test command and **read the pass in its output** — green is seen, never assumed from a clean edit.'],
  [CODER, '### 4e — Per-phase proof'],
  [CODER, 'run the behaviour the phase delivers through its real entry point'],
  [CODER, '**A green unit test is not proof.**'],
  [CODER, 'A plan line `Proof: UNPROVEN — {reason}` is recorded as `UNPROVEN` with that reason; do not hunt for a surface the architect ruled out.'],
  [CODER, 'Append one entry per phase to `.progress.md`:'],
  [CODER, '### {ISO 8601 datetime} | CODER — PROOF'],
  [CODER, 'Phase: {N} Proof: {pass | fail | UNPROVEN | deferred-to-join}'],
  [CODER, 'cmd: {the exact command(s) you ran}'],
  [CODER, 'observed: {the output or result you saw, excerpted}'],
  [CODER, 'Keep it cheap: reuse a stack that is already running'],
  [CODER, 'and never the whole-app suite (4d rule 5).'],
  [CODER, 'A stack you started may stay up for the next phase; stop everything you started before Step 6, and before you exit `BLOCKED`.'],
  [CODER, 'record `UNPROVEN` with the reason — never a proof you did not run.'],
  [CODER, "A proof that shows the wrong result is this phase's defect"],
  [CODER, "a behavioural finding's proof is its own reproduction, now showing the fixed result."],
  [CODER, "A gate finding's proof is its 4d entry: record `UNPROVEN — gate finding, proven by 4d / QA`, and never reproduce G1 or G6 here"],
  [CODER, 'A doc-only plan records `UNPROVEN — no runnable surface`.'],
  [CODER, '**Lane mode:** prove only what you can run without shared mutable state'],
  [CODER, 'and record anything else as `deferred-to-join`.'],
  [CODER, '**This is not a deferred gate:** the outer join runs deferred gates, never a deferred proof'],
  [CODER, 'the tester always includes a deferred phase in its e2e and reports its verdict.'],
  [CODER, 'so it proves its cross-lane slice instead of deferring it.'],
  [CODER, '**Never mark the plan `DONE` while a phase has no `CODER — PROOF` entry** (4e); a recorded `UNPROVEN` reason counts, silence does not.'],
  [ARCHITECT, 'Each phase is one vertical cycle: it cuts through every layer one user-visible behaviour needs (e.g. the backend endpoint and the mobile screen that calls it) and ends in something runnable; later phases close the gaps.'],
  [ARCHITECT, 'Never phase horizontally — all backend first, then all UI — unless Technical Notes say why a slice is impossible'],
  [ARCHITECT, "(a lane plan's slicing is the `PACT`'s, and needs no such note)"],
  [ARCHITECT, '- Proof: {the real entry point'],
  [ARCHITECT, "Its vertical cycles are bounded by the lane's owned globs"],
  [ARCHITECT, 'so a layer-scoped lane plan needs no Technical Notes justification for phasing within its layer, and the cross-layer slice is proven by the integration lane or by the tester at the outer join.'],
  [ARCHITECT, 'A `Proof:` the lane cannot run alone reads `deferred-to-join`.'],
  [ARCHITECT, "A phase with no runnable surface reads `Proof: UNPROVEN — {reason}` (the coder's own word)."],
  [ARCHITECT, "On a `FIX` or `QAF` plan a behavioural finding's proof is its reproduction, now showing the fixed result;"],
  [ARCHITECT, "a gate finding's reads `Proof: UNPROVEN — gate finding, proven by 4d / QA`, and a doc-only plan's `Proof: UNPROVEN — no runnable surface`."],
  [TESTER, "Read the coder's `CODER — PROOF` entries in each plan's `.progress.md`:"],
  [TESTER, 'a phase recorded `UNPROVEN` is a candidate you score first;'],
  [TESTER, 'a phase recorded `deferred-to-join` is **always included, never a deliberate exclusion**'],
  [TESTER, 'your report gives its proof a verdict (`pass`, `fail`, or `UNPROVEN` with the reason)'],
  [TESTER, 'a `pass` is evidence, never a substitute for your e2e.'],
  [TESTER, "**Region F's `PROOF` rows replace** the walk over every leaf `.progress.md` for the coder's `CODER — PROOF` entries"],
  [REVIEWER, "**The coder's `CODER — PROOF` entries** in `.progress.md`, one per phase:"],
  [REVIEWER, 'a `fail` is a Must Fix against the criteria that phase delivers;'],
  [REVIEWER, 'a phase with no entry at all is a Should Fix naming the phase;'],
  [REVIEWER, 'so is a `pass` whose `cmd:` is only a test runner, and an `UNPROVEN` whose reason contradicts a surface'],
  [REVIEWER, "**Region F's `PROOF` rows replace** the walk over every leaf `.progress.md` for the coder's `CODER — PROOF` entries"],
  [PARALLEL, '**A `CODER — PROOF` entry recorded `deferred-to-join` is not a deferred gate and never runs here.**'],
  [PARALLEL, 'the tester, dispatched after this step, always includes that phase in its e2e and reports its verdict'],
  [PARALLEL, 'per `CODER — PROOF` entry: leaf, phase, verdict, its `cmd:` or `reason:` line verbatim, and the same locator'],
  [PARALLEL, 'QA (`GATE` rows); tester, reviewer (`PROOF` rows)'],
  [PARALLEL, '**Prefer the `feature` axis** whenever the candidate lane set allows one'],
  [PARALLEL, 'A `layer` split makes every lane plan horizontal and defers every proof to the join; propose it only when no feature partition is defensible.'],
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

test('the proof runs after the phase gate, and its deferral is not a deferred gate', () => {
  const coder = read(CODER);
  const proof = coder.slice(coder.indexOf('### 4e — Per-phase proof'), coder.indexOf('### TDD rules'));
  assert.ok(proof.length > 0, '4e sits before the TDD rules');
  assert.ok(coder.indexOf('### 4d —') < coder.indexOf('### 4e —'), 'the proof runs after the phase gate');
  assert.doesNotMatch(flat(proof), /the same deferral as a gate/);
  // The outer join's deferred-gate step names the proof deferral as outside it.
  const parallel = flat(read(PARALLEL));
  const step4 = parallel.slice(parallel.indexOf('4. **Run every deferred gate'), parallel.indexOf('5. **Update the parent `PACT`'));
  assert.match(step4, /is not a deferred gate and never runs here/);
});
