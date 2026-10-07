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
  assert.match(exits, /- \*\*Exit 3 with `no barrier tiers declared`:\*\* neither `\{base_sha\}` nor the working tree declares a tier; read the default branch's \(above\), and take the without-tiers path only when it declares none either/);
  assert.match(exits, /any other exit 3 \(an invalid `\.cleancode-gates\.json` at `\{base_sha\}`, an unknown `--tier`, a `--base` that does not resolve\), a crash, or no `barrier\.json` to read/);
  assert.match(exits, /add `\{gate: barrier, elapsed_minutes: <m>, reason: "<first stderr line>"\}` to `stale_gates:`/);
  assert.match(exits, /reaches `BLOCKED_STALE` and an operator decision; never take the without-tiers path in its place/);
  // Declared tiers with no pinned engine to run them are no verdict, never "no barrier".
  assert.match(step3, /\*\*When tiers are declared \(at `\{base_sha\}`, in the working tree or on the default branch\) but `\.orchestrator\/engine\/bin\/gates\.cjs` does not exist\*\*, run no tier: add `\{gate: barrier, elapsed_minutes: 0, reason: "barrier declared but no pinned engine at \.orchestrator\/engine"\}` to `stale_gates:`, and never take the without-tiers path in its place/);
  assert.doesNotMatch(step3, /no gates CLI in Commands/, 'the CLI is the pinned engine, never one Commands names');
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
  assert.match(step3, /A `newly_red` suite with `basis: "no-base"` had no base to compare against\. When Commands maps a suite to this tier and Step 0d baselined that suite, by its Commands sweep or by its barrier baseline \(`gate-config\.md` → \*Baselining the barrier\*\), a `no-base` suite that names at least one failing test, every one of them, written `<file>::<name>`, in that baseline row's `failing\[\]`, is `pre-existing \(baseline\)` \(`gate-config\.md`\): list it in the `### Barrier` table, not under `## Failures`, and do not remediate it\. Otherwise it still fails/, 'a shared-dev tier has no base run, and the baseline is the only proof a red predates the run');
  // A suite that names no failing test (an error suite, an exit-code tier) matches every baseline row vacuously: it still fails.
  assert.match(step3, /so does an `error` suite or an `exit-code` tier, which names no failing test to compare/);
  // The engine's own path: a whole record Step 0d left at the base key is inherited as the base, and carries only assertion reds.
  assert.match(step3, /when the engine inherited this tier's base from Step 0d's whole record \(`base\.source: inherited`\), a suite already red there by assertion comes back `carried` \(below\); an `error` suite or an `exit-code` tier red there never does/);
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

// Every gate command runs the engine bootstrap pinned (gate-config.md → The pinned engine).
const GATES_CLI = 'node "$(git rev-parse --show-toplevel)/.orchestrator/engine/bin/gates.cjs"';
// What a run reads: the templates and references bootstrap B3 materializes, and the conductor's SKILL.md.
const MATERIALIZED_REFERENCES = ['artifact-format.md', 'artifact-format-html.md', 'artifact-format-parallel.md', 'config.md', 'gate-config.md', 'lane-protocol.md'];
function filesUnder(rel) {
  return fs.readdirSync(path.join(SKILL_DIR, rel), { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? filesUnder(path.join(rel, entry.name)) : [path.join(rel, entry.name)]));
}

test('no template or reference a run reads sends a gate to an unpinned engine', () => {
  const files = [...filesUnder('templates'), ...MATERIALIZED_REFERENCES.map((name) => path.join('references', name)), 'SKILL.md'];
  assert.ok(files.includes(path.join('templates', 'qa.md')) && files.length > 15, `only ${files.length} files`);
  for (const rel of files) {
    const text = read(rel);
    for (const unpinned of ['~/.claude/skills/clean-code-gates', '$HOME/.claude/skills/clean-code-gates', '/plugins/cache/']) {
      assert.ok(!text.includes(unpinned), `${rel} names ${unpinned}`);
    }
  }
});

test('the pinned engine is the one gates CLI: gate-config defines it, and QA, the architect and the coder run it', () => {
  const pinned = flat(section(read('references/gate-config.md'), '### The pinned engine'));
  assert.ok(pinned.includes(`\`\`\` ${GATES_CLI} \`\`\``), 'the exact <gates-cli>, in its own block');
  assert.match(pinned, /written and recorded \*\*unexpanded\*\*, by every role and by the conductor/);
  assert.match(pinned, /Step 0d's sweep and barrier baseline/);
  assert.match(pinned, /runs with that prefix substituted, and the substituted string is the ledger `suite`/);
  assert.match(pinned, /re-run the orchestrator's setup/);
  assert.ok(flat(step3).includes(`with \`<gates-cli>\`, the pinned engine: exactly \`${GATES_CLI}\``), 'QA defines <gates-cli> where it runs the tiers');
  for (const [rel, text] of [['templates/qa.md', step3], ['templates/architect.md', read('templates/architect.md')], ['templates/coder.md', read('templates/coder.md')]]) {
    assert.match(flat(text), /`\.orchestrator\/gate-config\.md` → \*The pinned engine\*/, rel);
  }
  assert.match(read('templates/coder.md'), /substituted: \{the plan's literal string\} → \{narrowed to this phase's intersection \| run with <gates-cli>\}/);
  assert.match(step5, /\*\*Stamp the engine beside it\*\* — `Engine: \{PINNED stamp\}`/, 'a report names the build that measured it');
});

test('bootstrap pins the engine inside item 2, without renumbering, and its summary names the engine', () => {
  const bootstrap = read('references/bootstrap.md');
  const b3 = bootstrap.slice(bootstrap.indexOf('## B3 — Materialize'));
  const pin = b3.indexOf('\n   **Pin the engine**: after the copies above and before item 5\'s stamp, run `node <this skill\'s directory>/scripts/pin-engine.cjs "$(git rev-parse --show-toplevel)"`.');
  assert.ok(pin !== -1, 'the pin paragraph, indented into item 2');
  assert.ok(b3.indexOf('\n2. **Materialize') < pin && pin < b3.indexOf('\n3. **Write the state-tracking contract**'), 'inside item 2, before item 3');
  // Prime's overlay finds item 6 by its text, and other items cite 3 and 4 by number.
  assert.deepEqual([...b3.matchAll(/^(\d)\. \*\*/gm)].map((m) => m[1]), ['1', '2', '3', '4', '5', '6']);
  assert.match(b3, /\n6\. \*\*Print bootstrap summary\*\*: list all created\/updated paths \(including `\.orchestrator\/\.gitignore`[^\n]*and the achieved context confidence\. The list also names `\.orchestrator\/engine\/`/);
  const paragraph = flat(b3.slice(pin, b3.indexOf('\n\n', pin + 1)));
  assert.match(paragraph, /never `\$CLAUDE_PLUGIN_ROOT`/);
  assert.match(paragraph, /If it exits non-zero, print its message and continue: the stamp is still written/);
  const worktree = /`(mkdir -p \{path\}\/\.orchestrator && cp -R [^`]+)`/.exec(read('SKILL.md'));
  assert.ok(worktree, 'SKILL.md Step 0a copies the untracked materialized files into a new worktree');
  assert.match(worktree[1], /cp -R \.orchestrator\/\{[^}]*,engine\} /, 'a new worktree carries the pinned engine');
});

test('Step 0d baselines the barrier whenever tiers are declared: whole tiers, through the barrier, joined before any coder', () => {
  const skill = read('SKILL.md');
  const step0d = flat(skill.slice(skill.indexOf('#### 0d — Baseline sweep'), skill.indexOf('### Step 1 — Brainstormer')));
  assert.doesNotMatch(step0d, /skip this sub-step entirely/, 'an `off` sweep must not take the barrier baseline with it');
  assert.match(step0d, /On `off`, skip the Commands sweep below/);
  assert.match(step0d, /\*\*The barrier baseline is not that sweep: it runs whenever tiers are declared\*\*, whatever `baseline_sweep` says \(`\.orchestrator\/gate-config\.md` → \*Baselining the barrier\*\)/);
  // The always-loaded join: the file the chain writes last, a dispatch re-recorded before a turn waits on it (else the watchdog
  // reads the wait as a stall and points at the coder), and no coder dispatch before it.
  assert.match(step0d, /it stays in every `next --note` until its chain writes `baseline\/exits`; re-`dispatch` it before a turn waits for it; dispatch no coder before that file/);
  assert.match(step0d, /A suite Commands maps to a barrier tier is left to the barrier baseline above\./);

  const baseline = section(read('references/gate-config.md'), '### Baselining the barrier (Step 0d)');
  const blocks = [...baseline.matchAll(/```\n([\s\S]*?)\n\s*```/g)].map((m) => m[1].trim());
  assert.ok(blocks.includes('<gates-cli> barrier --base {base_sha} --tier <id> --whole --out .orchestrator/runs/{run}/baseline/<id> --cache .orchestrator/barrier-cache.json'), 'the per-tier command, with --whole');
  assert.ok(!blocks.some((block) => block.includes('--if-changed')), 'every run measures its own base');
  const text = flat(baseline);
  assert.match(text, /The `scope: whole` tiers declared at `\{base_sha\}`, plus any the working tree adds/);
  assert.match(text, /\*\*Never a change-selected tier\*\*/);
  assert.match(text, /There is no `--if-changed`/);
  assert.match(text, /print `INSTRUMENTS ABSENT AT BASE — declared on <ref>`, and append `--instruments-from <ref>` to every command below/);
  // One chain from the root (an app folder's shell would put its files inside the measured tree), exits written last.
  const chain = blocks.find((block) => block.startsWith('cd "$(git rev-parse --show-toplevel)" && mkdir -p .orchestrator/runs/{run}/baseline && {'));
  assert.ok(chain, 'the chain, anchored at the repository root');
  assert.ok(chain.includes('--cache .orchestrator/barrier-cache.json; echo "<id> $?" >> .orchestrator/runs/{run}/baseline/exits.part'), 'each tier appends to exits.part');
  assert.ok(chain.endsWith('mv .orchestrator/runs/{run}/baseline/exits.part .orchestrator/runs/{run}/baseline/exits; }'), 'exits appears only after the last tier');
  assert.match(text, /Each tier's line ends in `;`, never `&&`, so a red tier never stops the chain, and only the last line writes `baseline\/exits`: the file exists once every tier has run, never sooner/);
  assert.match(text, /only when every baselined tier is `cache_scope: cwd` or `barrier\.frozen` covers `plans\/\*\*`/);
  assert.match(text, /record `dispatch <run> 'Step 0d barrier baseline'`/);
  assert.match(text, /\*\*the join:\*\* before the first coder dispatch \(Step 3, 3L or 3s\), `\.orchestrator\/runs\/\{run\}\/baseline\/exits` exists and lists every baselined tier\. Wait until it does, then write the ledger rows/);
  assert.match(text, /when the chain is done, leave the tree as you found it \(`SKILL\.md` Step 0d\)/, 'a runner\'s output in the checkout moves it off tree_base');
  assert.match(text, /any exit with no `barrier\.json` \(a pinned engine that is missing, or that cannot load, exits 1 with none\)/, 'an exit 1 with no report is no recorded red');
  assert.match(text, /0 or 1 with its `barrier\.json`: write the row/);
  assert.match(text, /`baseline: <suite> skipped \(change-selected tier <id>\)`/, 'a suite neither path baselines is said, never silent');
  assert.match(text, /`BARRIER BASELINE ERROR <id>: <first stderr line>`/);
  assert.match(text, /`failing\[\]` holds one entry per failing test of each `newly_red` suite, exactly `<file>::<name>`/);
  assert.match(text, /`baseline: <id> in the barrier cache only \(no Commands suite maps to it\)`/);
  assert.match(text, /compare `git rev-parse <tree\.candidateTree>:<cwd>` with `git rev-parse \{base_sha\}:<cwd>`/);
  assert.match(flat(read('references/config.md')), /`off` skips only the Commands sweep; the barrier baseline still runs, and costs each `scope: whole` tier's runtime/);
});

test('Step 3 leaves a change-selected tier\'s scope to the engine, and a fail by test timeout is still a failure', () => {
  const scope = flat(para('**A change-selected tier\'s scope belongs to the engine, so run it as declared.**'));
  assert.match(scope, /Never hand-batch it, replace it with directory runs, or run `select` separately: `barrier\.json` carries the selection\./);
  assert.doesNotMatch(scope, /and its reasons/, 'the reasons are in select.json only');
  assert.match(scope, /A selection past the tier's `select\.batch_files` runs in batches, each within the tier's per-invocation bound, and the table's Minutes is their sum/);
  assert.match(scope, /a project's per-invocation minutes rule is honoured by that bound, not by QA/);
  assert.match(scope, /\*\*A tier `fail` with reason `timeout` is a test failure, remediated like any fail; only `not-run \(timeout\)` is a stale gate\.\*\*/);
  assert.match(flat(read('templates/coder.md')), /nor a folder sweep standing in for one; on a change-selected stack \(one whose suite the barrier runs as a `change-selected` tier\), phase exit runs the test files the phase created or edited/);
  assert.match(read('templates/tester.md'), /on a change-selected stack \(one whose suite the barrier runs as a `change-selected` tier\), never a unit-directory sweep in its place/);
});

test('a base that predates the tiers runs the default branch\'s, the report says so, and the FINAL carries it', () => {
  const absent = flat(para('**When neither `{base_sha}` nor the working tree declares tiers**'));
  assert.match(absent, /\(the barrier exits 3 with `no barrier tiers declared`\), read `git show <ref>:\.\/\.cleancode-gates\.json` for the first of `origin\/HEAD`, `origin\/main` or `main` that resolves/);
  assert.match(absent, /run each per the block above plus `--instruments-from <ref>`, write `instruments_from: <ref>` in the report's frontmatter, and label the `### Barrier` section `tiers from <ref> \(absent at base \{base_sha12\}\)`/);
  assert.match(absent, /a tier that cannot run that way is a `stale_gates:` entry/);
  assert.match(absent, /If it declares none either, the project has no barrier: take the without-tiers path below/);
  assert.match(step5, /\ninstruments_from: null +# or <ref>/, 'always emitted, null when it does not apply');
  const moved = flat(read('SKILL.md').split('\n- **`Instrument moved:`**')[1].split('\n- **')[0]);
  assert.match(moved, /plus QA's `instruments_from:` as `barrier tiers from <ref> \(absent at base\)`/);
  assert.match(moved, /`none` when nothing moved/);
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
