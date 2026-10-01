#!/usr/bin/env node
'use strict';
/**
 * What the role templates tell QA to do with the clean-code-gates barrier (ADR-0030
 * decision 13). The barrier's own tests pin the engine; this pins the sentences that
 * make QA run it, read it and record it, because a template that drifts back to
 * choosing suites by name fails only in a live run, where a narrowed suite passes a
 * regression the whole tier would have caught.
 *
 *   node --test scripts/qa-barrier-prose.test.cjs
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SKILL_DIR = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(SKILL_DIR, rel), 'utf8');
const QA = read('templates/qa.md');

/** The text from one heading to the next heading of the same level. */
function section(text, heading) {
  const start = text.indexOf(heading);
  assert.ok(start !== -1, `no "${heading}"`);
  const level = heading.match(/^#+ /)[0];
  const end = text.indexOf(`\n${level}`, start + heading.length);
  return text.slice(start, end === -1 ? text.length : end);
}
// Hard-wrapped prose: a pinned sentence may break at any space.
const flat = (text) => text.replace(/\s+/g, ' ');
const step0 = flat(section(QA, '## Step 0 —'));
const step3 = section(QA, '## Step 3 —');
// Step 5 holds the report template, whose own `## ` headings sit inside a fence.
const step5 = QA.slice(QA.indexOf('## Step 5 —'), QA.indexOf('## Step 6 —'));
const step6 = flat(section(QA, '## Step 6 —'));
// Step 3's paragraphs by their bold lead, so a rule is checked where it applies.
const para = (lead) => {
  const start = step3.indexOf(lead);
  assert.ok(start !== -1, `Step 3 has no paragraph "${lead}"`);
  const end = step3.indexOf('\n\n', start);
  return step3.slice(start, end === -1 ? step3.length : end);
};
const TIER_COMMAND = '<gates-cli> barrier --base {base_sha} --tier <id> --out .orchestrator/runs/{run}/barrier/<id> --cache .orchestrator/barrier-cache.json';

test('Step 3 runs the barrier from the root against the ledger base, into untracked run state and one shared cache', () => {
  assert.ok(step3.includes(`\`\`\`\n${TIER_COMMAND}\n\`\`\``), 'the per-tier command, in its own block');
  assert.match(step3, /3 with `no barrier tiers declared`/, 'the one exit that means "no barrier"');
  // One --out per tier: a re-run of one tier never overwrites another's report.
  assert.match(step3, /every run shares the one cache, and each tier keeps its own `barrier\.json`/);
});

test('each tier runs as its own command, and that command, verbatim, is its ledger suite', () => {
  // SKILL.md Step 0a matches a row only on the byte-identical command about to run.
  assert.match(step3, /A tier's command, exactly as run, is its `suite`/);
  assert.doesNotMatch(step3, /\[--tier <ids>\]/, 'one invocation for several tiers has no per-tier command to key a row on');
  assert.doesNotMatch(step3, /`<gates-cli> barrier --base \{base_sha\} --tier <id>`/, 'a key that is never the executed command');
  const table = step3.slice(step3.indexOf('| Tier result |'));
  assert.match(table, /`not-run \(empty-scope\)` \| `pass`/);
  assert.match(table, /any other `not-run` \| none/);
});

test('the tiers are the definition at {base_sha}, and a moved instrument reaches the report and the FINAL', () => {
  assert.match(step3, /the definition at `\{base_sha\}` of each/);
  assert.doesNotMatch(step3, /the merge-base's definition/, 'QA passes base_sha, so the merge-base is not what runs');
  assert.match(step3, /Copy any `INSTRUMENT MOVED` line the barrier prints on stderr into the report verbatim/);
  assert.match(read('references/gate-config.md'), /QA carries the barrier's line the same way \(`templates\/qa\.md` → Step 3\)/);
  const moved = read('SKILL.md').split('\n- **`Instrument moved:`**')[1].split('\n- **')[0];
  assert.match(moved, /`report\.instrument\.moves` or the\s+barrier's `instruments\.moves`/, 'the FINAL banner reads the barrier\'s moves too');
});

test('every barrier exit has a reading, and only "no barrier tiers declared" takes the without-tiers path', () => {
  const exits = para('**Every exit has a reading.**') + step3.slice(step3.indexOf('- **Exit 0, 1 or 4:**'), step3.indexOf('**Reading the result'));
  assert.match(exits, /- \*\*Exit 0, 1 or 4:\*\* read the tier's `barrier\.json`/);
  // Exit 4 is the engine's "no verdict": a stale entry, however it reads.
  assert.match(exits, /Exit 4 means the tier is `not-run`: a `stale_gates:` entry, never the without-tiers path/);
  assert.match(exits, /- \*\*Exit 3 with `no barrier tiers declared`:\*\* the project has no barrier; take the without-tiers path/);
  assert.match(exits, /any other exit 3 \(an invalid `\.cleancode-gates\.json` at `\{base_sha\}`, an unknown `--tier`, a `--base` that does not resolve\), a crash, or no `barrier\.json` to read/);
  assert.match(exits, /add `\{gate: barrier, elapsed_minutes: <m>, reason: "<first stderr line>"\}` to `stale_gates:`/);
  assert.match(exits, /reaches `BLOCKED_STALE` and an operator decision; never take the without-tiers path in its place/);
  // Declared tiers with no CLI to run them are no verdict, never "no barrier".
  assert.match(step3, /\*\*When tiers are declared \(at `\{base_sha\}` or in the working tree\) but Commands names no gates CLI\*\*, run no tier: add `\{gate: barrier, elapsed_minutes: 0, reason: "barrier declared but no gates CLI in Commands"\}` to `stale_gates:`, and never take the without-tiers path in its place/);
  assert.doesNotMatch(step3, /When Commands names no such CLI, or the barrier exits 3/, 'the silent fallback the rule replaces');
});

test('a not-run tier is stale with its reason, never failed or passed, and a carried suite is labelled pre-existing', () => {
  assert.match(step3, /\{gate: barrier\/<tier id>, elapsed_minutes: <m>, reason: <its reason>\}/);
  assert.match(step3, /`<m>` being the tier's `timing\.tiers\.<id>\.candidate_ms` in minutes, rounded up/);
  assert.match(step3, /`BLOCKED_STALE`/);
  assert.match(step3, /`pre-existing \(at base since <first_seen>\)`/);
  assert.match(step3, /never "carried"/);
  assert.match(step3, /list it in the report's `### Barrier` table, never under `## Failures`/, 'a suite under Failures becomes a task');
});

test('flaky suites are listed and never block; a no-base newly red suite fails unless the baseline already named its failures', () => {
  assert.match(step3, /\*\*A tier's `flaky` suites\*\* failed, then passed the barrier's one rerun\. List them in the `### Barrier` table; they never block\./);
  assert.match(step3, /A `newly_red` suite with `basis: "no-base"` had no base to compare against\. When Commands maps a suite to this tier and Step 0d baselined that suite, a `no-base` suite whose every failing test is named in that baseline row's `failing\[\]` is `pre-existing \(baseline\)` \(`gate-config\.md`\): list it in the `### Barrier` table, not under `## Failures`, and do not remediate it\. Otherwise it still fails/, 'a shared-dev tier has no base run, and the baseline is the only proof a red predates the run');
});

test('the report has a Barrier table with a row per tier, and a barrier stale entry carries its reason', () => {
  assert.match(step5, /\n### Barrier\n\n\| Tier \| Scope \| Result \| Reason \| Newly red \| Pre-existing \| Flaky \| Isolation \| Minutes \|\n/);
  assert.match(step5, /stale_gates: \[\] +# or \[\{gate: G6, elapsed_minutes: 43\}, \{gate: barrier\/e2e, elapsed_minutes: 16, reason: timeout\}, \.\.\.\]/);
  // qa.md:6 claimed a full suite run, which a change-selected tier is not.
  assert.doesNotMatch(QA, /by running the full test suite/);
  assert.match(QA.split('\n')[5], /by running the barrier \(or, without tiers, every whole-app suite\)/);
});

test('with tiers, every whole-app suite still runs unless Commands maps it to a barrier tier', () => {
  const outside = para('**Suites the tiers do not run.**');
  assert.doesNotMatch(step3, /no tier's `cwd` covers/, 'keyed on cwd, one tier silently dropped every other suite of its app');
  assert.match(outside, /For each app the plan touches, every whole-app suite Commands names runs as in the without-tiers path, unless Commands maps it to a barrier tier \(for example "e2e — barrier tier `e2e`"\), in which case it runs through the barrier/);
});

test('a suite the plan modifies always runs, with tiers or without', () => {
  assert.match(para('**Suites the tiers do not run.**'), /Any suite the plan modifies that no tier runs is run as in the without-tiers path/);
  assert.match(para('**Without declared tiers**'), /skip a suite only when its app was not touched, but always run a suite the plan modifies/);
});

test('without tiers, every whole-app suite runs and none is narrowed by name, path or feature', () => {
  assert.match(step3, /\*\*Never narrow a suite by name pattern, path pattern or feature\*\*/);
  assert.match(step3, /--testPathPatterns/);
  assert.doesNotMatch(step3, /Run all relevant test suites based on what the plan touches/, 'the latitude the barrier replaced');
});

test('Step 0 bounds only the gates, and names the barrier as the second producer of stale_gates', () => {
  assert.match(step0, /Without tiers, the Step 3 suite stays unbounded, as does any suite Step 3 runs outside the barrier/);
  assert.match(step0, /Step 3 \(a barrier tier `not-run`, or a barrier with no verdict\) are the only producers of `stale_gates:`/);
});

test('Step 6: a tier fail blocks, and a tier not-run other than empty-scope is never ready', () => {
  assert.match(step6, /READY_TO_COMMIT\*\*: All test suites pass \(with a barrier: no newly red suite outside `pre-existing \(baseline\)`, and no tier `not-run` other than `empty-scope`\)/);
  assert.match(step6, /BLOCKED\*\*: Any test failure \(with a barrier: a newly red suite that is not `pre-existing \(baseline\)`\)/);
  assert.match(step6, /\*\*A barrier tier `not-run`, or a barrier with no verdict \(Step 3\), is a `stale_gates:` entry like any other\.\*\*/);
});

test('SKILL.md Step 5d, config.md and coder.md name both producers and the barrier', () => {
  const stale = section(read('SKILL.md'), '#### If BLOCKED_STALE:');
  assert.doesNotMatch(stale, /sole producer/);
  assert.match(stale, /a barrier tier `not-run`, the two producers/);
  assert.doesNotMatch(read('references/config.md'), /bounds each individual suite or gate command in QA Steps 3, 4 and 4b/);
  assert.match(read('references/config.md'), /a barrier tier `not-run` or a barrier with no verdict at QA Step 3/);
  assert.match(read('templates/coder.md'), /runs the project's declared barrier tiers or, without tiers, every suite the plan\s+touched/);
});

// The admission registry sits at the repository root, above this skill; an installed copy has none.
function findUp(rel) {
  for (let dir = __dirname; ; dir = path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, rel))) return path.join(dir, rel);
    if (path.dirname(dir) === dir) return null;
  }
}
const REGISTRY = findUp(path.join('fixtures', 'admission.json'));

test('the touchpoint is admitted: a not-run tier that stops the run for an operator has a registry entry', { skip: !REGISTRY && 'no admission registry above this copy' }, () => {
  const entry = JSON.parse(fs.readFileSync(REGISTRY, 'utf8')).entries.find((e) => e.id === 'orchestrator.qa.barrier-not-run');
  assert.ok(entry, 'fixtures/admission.json has no orchestrator.qa.barrier-not-run');
  assert.deepEqual([entry.skill, entry.enum], ['orchestrator', 'touchpoint']);
  const fixture = JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(REGISTRY)), entry.fixture), 'utf8'));
  assert.equal(fixture.evidence, 'docs/adr/0030-the-engine-measures-at-the-tree.md#13-qas-step-3-runs-the-barrier', 'it cites ADR-0030 decision 13');
  assert.equal(fixture.test, 'plugins/my-skills/skills/orchestrator/scripts/qa-barrier-prose.test.cjs');
});
