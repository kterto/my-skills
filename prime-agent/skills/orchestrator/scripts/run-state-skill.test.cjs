#!/usr/bin/env node
'use strict';
/**
 * What `SKILL.md` tells the conductor to run against `run-state.cjs`, run as written.
 * `run-state.test.cjs` pins the script; this pins the sentences that drive it, because
 * a template that quotes free text the wrong way, or names a flag the script does not
 * take, fails only in a live run — and a shell that ran the backticks in an operator's
 * answer still exits 0, with the audit record silently altered.
 *
 * The prose pins below are the rules a READY_WITH_WARNINGS, a bounded gate or a resume
 * must not lose, each tested for what it says rather than for its wording.
 *
 *   node --test scripts/run-state-skill.test.cjs
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCRIPT = path.join(__dirname, 'run-state.cjs');
const SKILL = fs.readFileSync(path.join(__dirname, '..', 'SKILL.md'), 'utf8');
const QA = fs.readFileSync(path.join(__dirname, '..', 'templates', 'qa.md'), 'utf8');

const RUN = '20260929T101500Z-a1b2-skill';
// Backticks, a `$`, a double quote and an apostrophe: everything a shell would act on.
const FREE = 'Yes — keep `max_review_cycles` at 6, it costs $5 more; don\'t "ask" again';
const FILL = {
  '<run>': RUN,
  '{claude-code|opencode|prime}': 'claude-code',
  '{N}': '4',
  '{what}': 'reviewer',
  '{id}': 'FR-3',
  '{spec_id}': 'SPEC-20260929T101500Z-a1b2',
  '{key}': 'max_review_cycles',
  '{to}': '6',
  '{current}': '4',
};

/** The rule block, from its heading to the next section. */
function ruleBlock() {
  const start = SKILL.indexOf('**Run state — one rule for every step.**');
  assert.ok(start !== -1, 'SKILL.md has no Run state rule');
  return SKILL.slice(start, SKILL.indexOf('\n## ', start));
}

/**
 * Fill a template the way a conductor following it would: a placeholder for free text
 * gets the operator's words, escaped only as the quotes around it require. Inside
 * single quotes that is `'\''` for each `'`, which the rule block states; inside double
 * quotes nothing, since the text goes in verbatim.
 */
function fill(template) {
  return template.replace(/<run>|\{[^}]+\}/g, (placeholder, at) => {
    if (Object.hasOwn(FILL, placeholder)) return FILL[placeholder];
    return template[at - 1] === "'" ? FREE.replace(/'/g, "'\\''") : FREE;
  });
}

test('the Run state rule\'s commands run as written, and the operator\'s free text arrives verbatim', () => {
  const templates = {};
  for (const [, template] of ruleBlock().matchAll(/`((start|next|done|wait|lookup|decide|raise|budget) <run>[^`]*)`/g)) {
    templates[template.split(' ')[0]] ??= template;
  }
  assert.deepEqual(Object.keys(templates).sort(), ['budget', 'decide', 'done', 'lookup', 'next', 'raise', 'start', 'wait']);
  assert.match(ruleBlock(), /'\\''/, 'the rule says how to write an apostrophe inside single quotes');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'run-state-skill-'));
  try {
    const run = (name) => {
      const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(SCRIPT)} --root ${JSON.stringify(root)} ${fill(templates[name])}`;
      const r = spawnSync('bash', ['-c', command], { cwd: root, encoding: 'utf8' });
      assert.equal(r.status, 0, `${name}: ${r.stderr}`);
      return r;
    };
    const file = (name) => fs.readFileSync(path.join(root, '.orchestrator', 'runs', RUN, name), 'utf8');

    run('start');
    run('next');
    assert.equal(file('NEXT'), `Step 4 — reviewer\n${FREE}\n`);
    run('wait');
    assert.ok(file('pending_decision').endsWith(` ${FREE}\n`), file('pending_decision'));
    run('decide');
    const [decision] = file('decisions.jsonl').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(decision.question, FREE);
    assert.equal(decision.answer, FREE);
    assert.equal(decision.spec, FILL['{spec_id}']);
    assert.equal(JSON.parse(run('lookup').stdout).answer, FREE, 'lookup finds the decision the template recorded');
    assert.match(run('raise').stdout, /^BUDGET RAISED max_review_cycles 4→6$/m);
    assert.equal(JSON.parse(file('budget-raises.jsonl')).approval, FREE, 'the approval is the operator\'s answer, verbatim');
    assert.equal(run('budget').stdout, '6\n');
    run('done');
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('a decision is reused only for the same spec and the same question', () => {
  const rule = ruleBlock();
  assert.match(rule, /`lookup <run> \{id\} --spec \{spec_id\} --all`/);
  assert.match(rule, /`decide <run> \{id\} --spec \{spec_id\} /);
  assert.match(rule, /on a hit whose `question` asks what you would/);
});

test('the resume header re-records the step before dispatching it, so the watchdog guards a resumed session', () => {
  const header = SKILL.slice(SKILL.indexOf('# orchestrator')).split('\n').find((line) => line.startsWith('> '));
  assert.match(header, /run-state\.cjs status/);
  assert.match(header, /re-run `next <run>` with its NEXT label, then dispatch/);
});

test('the lifecycle: done follows the last banner, and asking names both hosts\' tools', () => {
  const rule = ruleBlock();
  assert.match(rule, /`done <run>` once Step 7b prints its `pipeline complete` banner/);
  assert.match(rule, /ask the operator first \(`AskUserQuestion` \/ `question`\) about an `active` one/);
  // The Prime Agent build names its one role directory here instead.
  assert.match(SKILL, /the six role files in (this host's agent directory \(on opencode, whichever of `\.opencode\/agents\/` or `\.opencode\/agent\/` exists\)|`\.orchestrator\/roles\/`) —/);
});

test('a raised gate_wall_clock_minutes reaches QA through the Step 5 prompt, and only once raised', () => {
  const step5 = SKILL.slice(SKILL.indexOf('### Step 5 — QA'), SKILL.indexOf('Parse QA\'s output'));
  assert.match(step5, /^gate_wall_clock_minutes=\{the raised value\} +← only after an in-session raise; omit the line otherwise$/m);
  assert.match(QA, /a `gate_wall_clock_minutes=` line in your prompt wins/);
});

test('a bounded gate is never written up as a pass', () => {
  // ADR-0028's falsifier: a bounded G6 that reads as a pass anywhere.
  for (const line of QA.split('\n').filter((l) => /READY_WITH_WARNINGS/.test(l) && /unmeasured_bounded/.test(l))) {
    assert.match(line, /not a pass/, `qa.md: ${line}`);
    assert.doesNotMatch(line, /All blocking checks pass but [^;]*, or /, `qa.md lumps a bound in with the passes: ${line}`);
  }
  const warnings = SKILL.slice(SKILL.indexOf('#### If READY_WITH_WARNINGS:'), SKILL.indexOf('#### If BLOCKED_STALE:'));
  assert.doesNotMatch(warnings, /All blocking gates passed/);
  assert.match(warnings, /Every measured blocking gate passed/);
  assert.match(SKILL, /carry each `Warning:` line into the Issues found list/);
  assert.doesNotMatch(SKILL, /carry the G8 warning into the Issues found list/);

  for (const skill of ['product-manager', 'validation-fixer']) {
    const file = path.join(__dirname, '..', '..', skill, 'SKILL.md');
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8').replace(/\s+/g, ' ');
    assert.match(text, /advisory G8 rework ratio, or a G6 bounded under `on_bound: disclose`/, skill);
    assert.match(text, /every measured blocking gate passed/, skill);
  }
});
