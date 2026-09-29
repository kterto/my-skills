#!/usr/bin/env node
'use strict';
/**
 * Every other test in this suite reads SKILL.md and the role templates — the source
 * text that describes what a run should produce. None of them opens a thing a run
 * actually produced, which is why flash's first real run could write a FINAL with no
 * status, no elapsed time and none of ADR-0025's mandated disclosures while all fifty
 * assertions stayed green: the suite was checking the prose about the artifact, not
 * the artifact.
 *
 * `lintFinal` is the FINAL contract stated as code. It reads the FENCED BLOCK the
 * report opens with and nothing else — a banner line quoted in a later paragraph is
 * prose, and prose is exactly what the first run had instead of a banner.
 *
 * It also runs against a real report on demand:
 *
 *   FLASH_FINAL=path/to/FINAL-<id>-<slug>.md node --test __tests__/final-artifact.test.cjs
 *
 * That is the only mode in which this suite has ever read a produced artifact. Point
 * it at a finished run before trusting that run's green.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, existsSync } = require('node:fs');
const { join } = require('node:path');

// Every line the banner block must carry, each with the reason it is there. A FINAL is
// only ever written on the success path — a halt stops before Step 5 mints one — so the
// headline and the verdict are pinned to their success values rather than left open.
const REQUIRED_LINES = [
  [/^ORCHESTRATOR — pipeline complete \(flash\)\s*$/m, 'the headline `product-manager` matches, qualified by the pipeline that earned it'],
  [/^Status: (READY_TO_COMMIT|READY_WITH_WARNINGS)\s*$/m, "the run's verdict — frontmatter `status: COMPLETE` is the artifact's lifecycle, not this"],
  [/^Pipeline: flash/m, 'ADR-0025 disclosure 1 — without it this file is indistinguishable from an orchestrator FINAL'],
  [/^NOT VERIFIED:/m, 'ADR-0025 disclosure 2 — the skipped checks, by name'],
  [/^Spec:\s+\S/m, '`product-manager` reads `spec_id` from it on every terminal state'],
  [/^Run folder:\s+\S/m, '`product-manager` reads `run_dir` from it to reach every other artifact'],
  [/^Final report:\s+\S/m, '`product-manager` reads `final_report_path` from it before it commits anything'],
  [/^Plan:\s+\S/m, 'the FEAT this report is the outcome of — the frontmatter may not carry a `plan:` key'],
  [/^Built:\s+\S/m, 'what the run produced — the line a reader looks at first'],
  [/^Verified:\s+\S/m, 'what was actually checked, as against what was skipped on the line below'],
  [/^Interview:\s+(1 round: \d+ asked, \d+ answered, \d+ defaulted, \d+m waiting|none — (interview: skipped \(.+\)|the brainstormer asked nothing))$/m,
    'whether the user was asked anything, in one of the three shapes Step 5 defines — a spec from answers and one from defaults are different evidence'],
  [/^Rigor:\s+flash\b/m, 'PM logs this cell on every story row; it is what tells two greens apart'],
  [/^Delivered:\s+\S/m, "PM copies it into the PR's *Not delivered* section, where absence reads as innocence"],
  [/^Unmeasured:\s+\S/m, 'same section — "no gate ran" has to be said, not implied'],
  [/^Instrument moved:\s+\S/m, 'same section — a moved threshold is a reviewer decision'],
  [/^Deferred by decision:\s+\S/m, 'same section — an acceptance criterion the plan deferred'],
  [/^Issues found:/m, "same section — every open CR finding, Must Fix first, one per line beneath"],
  [/^QA report:\s+\S/m, "PM's human-validation scan reads a QA report; flash has none and must say so, not stay silent"],
  [/^Elapsed:\s+\S/m, 'what the run cost, the one number a speed pipeline exists to report'],
  [/Review cycles:\s*(\d+\/\d+|—)/, 'how much of the review budget the run spent, or that no reviewer ran'],
  [/Live rework: [01]\/1/, 'whether Step 3c spent its one live rework — a FAIL that rework fixed leaves no other trace'],
  [/^Index:\s+\S/m, 'whether the run reached the project index, or why it could not'],
  [/^Proposed commit message:\s*$/m, 'PM takes the commit message from this report, not from the diff'],
  [/^Proposed PR message:\s*$/m, "PM fills the PR template's summary and test plan from this report"],
];

// Named by category, never counted: a reader who cares about one of these finds it by
// searching for it (ADR-0025, Decision, mechanism 2).
const SKIPPED_CHECKS = ['e2e', 'coverage floor', 'mutation', 'spec grading', 'QA regression', 'full test suite'];

// The two shapes the live verdict takes on the banner (SKILL.md → Step 5).
const LIVE_PASS = /· live: PASS — \S/;
const LIVE_PASS_TEXT = /· live: PASS — .*$/gm;
const LIVE_OTHER = /· live check \((FAIL|not run) — [^)\n]*\S[^)\n]*\)/;
// The body's `## Live check` section opens with the final report's verdict line. A report
// held in a code fence is still that report, so one opening fence may sit between them.
const LIVE_SECTION = /^## Live check[ \t]*\n\s*(?:```[^\n]*\n\s*)?LIVE: (PASS|FAIL|NOT RUN)[ \t]*$/m;
// The flow, the reason and the Must Fix line are the live report's own words (Step 5), and a
// route template or a JSON body carries braces: `PATCH /spots/{id}/hours`. Inside those words
// only the template's own slots are unfilled placeholders. Each pattern has three groups, so the
// replacer's arguments line up: the lead, the words, and what closes the segment.
const LIVE_WORDS = [
  /(· live: PASS — )(.*)()$/gm,
  /(· live check \((?:FAIL|not run) — )(.*?)(\)(?= · code review|[ \t]*$))/gm,
  /(MUST FIX: live check failed — )(.*)()$/gm,
];
const LIVE_SLOT = /\{(?:flow|reason|one line)\}/g;
const REVIEW_OFF_ISSUE = '- none — review: skipped (config); no reviewer ran';
const REVIEW_OFF_NV = '· code review — review: skipped (config)';

function slotsOnly(fields) {
  return LIVE_WORDS.reduce((text, re) =>
    text.replace(re, (m, lead, words, close) => `${lead}${(words.match(LIVE_SLOT) || []).join(' ')}${close}`), fields);
}

// The banner is the first fenced block after the frontmatter, and it ends at the first
// closing fence — not at "wherever the next fence happens to be". An opening fence that is
// never closed would otherwise swallow the whole report, and every disclosure could then be
// satisfied by ordinary prose several screens below.
const FENCE = /^\s{0,3}```/;

function bannerBlock(body) {
  const lines = body.replace(/\r\n/g, '\n').trimStart().split('\n');
  if (!FENCE.test(lines[0] || '')) return { error: 'the report does not open with a fenced banner block — the disclosure is prose, or absent' };
  const close = lines.slice(1).findIndex((l) => /^\s{0,3}```\s*$/.test(l));
  if (close === -1) return { error: 'the banner block\'s opening fence is never closed — the whole report reads as banner' };
  const block = lines.slice(1, close + 1).join('\n');
  if (/^#{1,6} /m.test(block)) return { error: 'the banner block contains a Markdown heading — the fence closed somewhere other than the end of the banner' };
  return { block, after: lines.slice(close + 2).join('\n') };
}

// The banner's own fields, without the PR text it proposes. The `## Test plan` carries a
// second copy of the NOT VERIFIED list by design, and a copy must never be able to stand in
// for the disclosure itself.
function fieldsOf(block) {
  const i = block.search(/^Proposed commit message:/m);
  return i === -1 ? block : block.slice(0, i);
}

// A field label plus its continuation lines — the wrapping idiom `Built:`, `Verified:` and
// `NOT VERIFIED:` all use. Checking only the label's own line misses everything wrapped.
function fieldOf(text, label) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (!new RegExp(`^${label}`).test(lines[i])) continue;
    out.push(lines[i]);
    for (const l of lines.slice(i + 1)) {
      if (!l.trim() || /^[A-Z][A-Za-z ]*:/.test(l)) break;
      out.push(l);
    }
  }
  return out.join('\n');
}

function lintFinal(text) {
  const problems = [];
  const fm = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(text);
  if (!fm) return ['no YAML frontmatter'];

  const keys = Object.fromEntries(
    fm[1].split(/\r?\n/).filter(Boolean).map((l) => {
      const i = l.indexOf(':');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  for (const k of ['id', 'kind', 'status', 'related_to']) {
    if (!keys[k]) problems.push(`frontmatter is missing \`${k}\``);
  }
  if (keys.kind && keys.kind !== 'final') problems.push(`frontmatter \`kind\` is \`${keys.kind}\`, not \`final\``);
  if (keys.status && keys.status !== 'COMPLETE') problems.push(`frontmatter \`status\` is \`${keys.status}\`, not \`COMPLETE\``);
  if ('plan' in keys) problems.push('frontmatter carries `plan:`, which the artifact contract omits on a final');
  if (keys.id && !keys.id.startsWith('FINAL-')) problems.push(`frontmatter \`id\` is \`${keys.id}\`, not a FINAL id`);
  if (keys.related_to && !keys.related_to.startsWith('SPEC-')) {
    problems.push(`frontmatter \`related_to\` is \`${keys.related_to}\`, not the spec id that keys the run family`);
  }

  const { block, after, error } = bannerBlock(text.slice(fm[0].length));
  if (error) { problems.push(error); return problems; }

  const fields = fieldsOf(block);
  for (const [re, why] of REQUIRED_LINES) {
    // Every field rule reads the banner's fields; only the two proposed-message rules may
    // see the block's tail, since that is where they live.
    const scope = /Proposed (commit|PR) message/.test(String(re)) ? block : fields;
    if (!re.test(scope)) problems.push(`the banner block has no line matching ${re} — ${why}`);
  }

  // An unfilled template placeholder is a line nobody wrote. It reads as a value. The live
  // report's words keep their braces; the scan sees only the slots among them.
  const scanned = slotsOnly(fields).split('\n');
  fields.split('\n').forEach((line, i) => {
    if (/\{[^}]*\}/.test(scanned[i])) problems.push(`the banner line \`${line.trim()}\` still carries a {placeholder}`);
  });

  const nv = fieldOf(fields, 'NOT VERIFIED:');
  for (const c of SKIPPED_CHECKS) {
    if (!nv.toLowerCase().includes(c.toLowerCase())) problems.push(`the NOT VERIFIED block never names "${c}"`);
  }
  // A skipped check claimed as verified is the one falsehood this file exists to stop —
  // across the whole wrapped field, every occurrence of it, and regardless of case.
  // The live flow is the brief's own words, not a check name: "GraphQL mutation saves" claims nothing.
  const verified = fieldOf(fields, 'Verified:').replace(LIVE_PASS_TEXT, '').toLowerCase();
  for (const c of SKIPPED_CHECKS) {
    if (verified.includes(c.toLowerCase())) problems.push(`the Verified: line claims "${c}", which flash never runs`);
  }

  // `Issues found:` is a header with a list under it. A bare header is three findings lost.
  const issues = fieldOf(fields, 'Issues found:');
  if (issues && !/\n\s+-\s+\S/.test(issues) && !/^Issues found:\s+\S/.test(issues)) {
    problems.push('`Issues found:` has no entries beneath it — the CR\'s open findings vanish into a bare header');
  }
  // A verdict of READY_TO_COMMIT with an open Must Fix is the claim flash must never make.
  if (/^Status: READY_TO_COMMIT\b/m.test(fields) && /MUST FIX/i.test(issues)) {
    problems.push('`Status: READY_TO_COMMIT` over an open Must Fix — a budget that ran out is not a finding that was resolved');
  }
  // Must Fix lines come first, so the list PM copies opens with what blocks the change.
  const entries = issues.split('\n').filter((l) => /^\s+-\s+\S/.test(l)).map((l) => l.trim());
  const firstOther = entries.findIndex((e) => !/^- MUST FIX:/.test(e));
  if (firstOther > -1 && entries.slice(firstOther).some((e) => /^- MUST FIX:/.test(e))) {
    problems.push('a Must Fix sits below another entry under `Issues found:` — every Must Fix comes first');
  }
  // The interview's own arithmetic. A line that says three questions were asked and one was
  // answered is claiming a second one vanished; the counts are the only evidence anyone has
  // that the answers in the spec came from a human.
  // The skip vocabulary is closed, and `manual` is not in it: `automation_level: manual`
  // agrees with the default and cannot turn an interview off, so a line naming it as the
  // reason is describing something that did not happen.
  const skip = /^Interview:\s+none — interview: skipped \((.+)\)$/m.exec(fields);
  if (skip && !/^(--no-interview|flash-config|automation_level: autonomous)$/.test(skip[1])) {
    problems.push(`\`Interview:\` blames "${skip[1]}", which is not one of the three inputs that can skip a round`);
  }

  const iv = /^Interview:\s+1 round: (\d+) asked, (\d+) answered, (\d+) defaulted/m.exec(fields);
  if (iv) {
    const [, asked, answered, defaulted] = iv.map(Number);
    if (asked === 0) problems.push('`Interview:` claims a round in which nothing was asked — the shape for that is "none — the brainstormer asked nothing"');
    else if (answered + defaulted !== asked) {
      problems.push(`\`Interview:\` does not add up: ${answered} answered + ${defaulted} defaulted != ${asked} asked`);
    }
  }

  // The live verdict (ADR-0029). Step 3c runs on every run, so exactly one shape is on the
  // banner, riding an existing line; READY_TO_COMMIT needs the PASS; a FAIL is a Must Fix; and
  // the body carries the final report, whose verdict must be the banner's.
  const livePass = LIVE_PASS.test(fieldOf(fields, 'Verified:'));
  const liveOther = LIVE_OTHER.exec(nv);
  if (!livePass && !liveOther) problems.push('the banner carries no live verdict — Step 3c runs on every run, and its result rides `Verified:` or `NOT VERIFIED:`');
  if (livePass && liveOther) problems.push('the banner claims a live PASS and a live FAIL or NOT RUN at once');
  if (/^Status: READY_TO_COMMIT\b/m.test(fields) && !livePass) {
    problems.push('`Status: READY_TO_COMMIT` without a live PASS — a live FAIL or NOT RUN is READY_WITH_WARNINGS');
  }
  if (liveOther && liveOther[1] === 'FAIL' && !/MUST FIX: live check failed — \S/.test(issues)) {
    problems.push('a live FAIL with no `MUST FIX: live check failed` line under `Issues found:`');
  }
  if (liveOther && liveOther[1] === 'FAIL' && /Live rework: 0\/1/.test(fields)) {
    problems.push('a live FAIL with `Live rework: 0/1` — Step 3c spends the one rework on the first FAIL');
  }
  const report = LIVE_SECTION.exec(after);
  if (!report) problems.push('the report has no `## Live check` section opening with its `LIVE:` line — the final live report, verbatim');
  else {
    const banner = livePass ? 'PASS' : liveOther ? (liveOther[1] === 'FAIL' ? 'FAIL' : 'NOT RUN') : null;
    if (banner && report[1] !== banner) problems.push(`the \`## Live check\` report says ${report[1]} and the banner says ${banner} — they disagree`);
  }

  // A run with no reviewer must say so where the record is read, not only in the session.
  const cycles = /Review cycles:\s*—/.test(fields);
  if (cycles && !/code review/i.test(nv)) {
    problems.push('no reviewer ran and the NOT VERIFIED block does not say so — the FINAL reads as reviewed');
  }
  // Step 5 says it three times, each in its place: last on NOT VERIFIED, as the cycle count, and
  // last under `Issues found:`, below a live FAIL's Must Fix. A place that is silent reads as reviewed.
  const reviewOff = nv.includes(REVIEW_OFF_NV);
  if (reviewOff && !nv.trimEnd().endsWith(REVIEW_OFF_NV)) {
    problems.push(`\`${REVIEW_OFF_NV}\` is not the last entry on NOT VERIFIED`);
  }
  if (reviewOff && !cycles) problems.push('NOT VERIFIED says no reviewer ran and `Review cycles:` still counts cycles');
  if ((reviewOff || cycles) && entries.at(-1) !== REVIEW_OFF_ISSUE) {
    problems.push(`no reviewer ran and \`${REVIEW_OFF_ISSUE}\` is not the last entry under \`Issues found:\``);
  }
  return problems;
}

const fixturePath = join(__dirname, 'fixtures', 'final-good.md');
const fixture = () => readFileSync(fixturePath, 'utf8');

test('a conforming FINAL passes', () => {
  assert.deepEqual(lintFinal(fixture()), []);
});

test('every required banner line is load-bearing — removing one is reported as that line', () => {
  // notDeepEqual(…, []) would pass on ANY problem, including one another rule raised.
  // Each case has to fail for its own reason or the rule is decoration.
  for (const [re, why] of REQUIRED_LINES) {
    const m = re.exec(fixture());
    assert.ok(m, `the fixture itself has no line matching ${re}`);
    const without = fixture().replace(m[0], '');
    const problems = lintFinal(without);
    assert.ok(problems.some((p) => p.includes(String(re))),
      `removing "${m[0].trim()}" was not reported as ${re} — ${why}. Got: ${problems.join('; ') || '(clean)'}`);
  }
});

test('the disclosure cannot be satisfied from outside the banner block', () => {
  // The first run's FINAL named its pipeline in a prose paragraph. That is the shape
  // this rejects: a body that says everything, in a block that says nothing.
  const gutted = fixture().replace(/^```\n[\s\S]*?\n```\n/m, '');
  const asProse = `${gutted}\n\nPipeline: flash (reduced verification). Status: READY_TO_COMMIT. NOT VERIFIED: e2e · coverage floor · mutation · spec grading · QA regression · full test suite.\n`;
  const problems = lintFinal(asProse);
  assert.ok(problems.some((p) => p.includes('does not open with a fenced banner block')),
    `a FINAL whose only disclosure is prose passed: ${problems.join('; ') || '(clean)'}`);
});

test('a NOT VERIFIED block that drops a category fails, even if the word survives elsewhere', () => {
  // Naming "mutation" on the Verified: line must not satisfy the NOT VERIFIED block.
  const inverted = fixture()
    .replace(' · mutation (G6)\n', '\n')
    .replace('Verified:     coder TDD tests', 'Verified:     mutation · coder TDD tests');
  const problems = lintFinal(inverted);
  assert.ok(problems.some((p) => p.includes('never names "mutation"')), `a dropped category passed: ${problems.join('; ')}`);
  assert.ok(problems.some((p) => p.includes('claims "mutation"')), `a skipped check claimed as verified passed: ${problems.join('; ')}`);
});

// The fixture as a run whose live check failed after its one rework, carrying `reason` in the
// live report's own words; `noReview` also switches the reviewer off.
function liveFailed(b, reason, noReview = false) {
  const skip = noReview ? ' · code review — review: skipped (config)' : '';
  const out = b
    .replace('Status: READY_TO_COMMIT', 'Status: READY_WITH_WARNINGS')
    .replace(/\n +· live: PASS — .*/, '')
    .replace('· full test suite\n', `· full test suite · live check (FAIL — ${reason})${skip}\n`)
    .replace('Issues found:\n', `Issues found:\n  - MUST FIX: live check failed — ${reason}\n`)
    .replace('Live rework: 0/1', 'Live rework: 1/1')
    .replace('LIVE: PASS', 'LIVE: FAIL');
  if (!noReview) return out;
  return out
    .replace(/ {2}- SHOULD FIX:.*\n/g, '')
    .replace(/(MUST FIX: live check failed — .*\n)/, '$1  - none — review: skipped (config); no reviewer ran\n')
    .replace('Review cycles: 0/1', 'Review cycles: — (review: skipped (config))');
}

// Each of these lints CLEAN against an earlier draft of this file. They are the audit's
// own attacks, kept as the record of what the checker learned to see.
const ATTACKS = [
  ['an opening fence that is never closed makes the whole report read as banner',
    (b) => b.replace(/^```\n/m, '').replace('# Final report', 'Pipeline: flash\nStatus: READY_TO_COMMIT\n\n# Final report'),
    /fenced banner block|never closed/],
  ['a Verified: continuation line claiming a skipped check',
    (b) => b.replace('· build: exit 0', '· build: exit 0\n              · e2e · mutation'),
    /claims "e2e"/],
  ['a Verified: line claiming a skipped check in another case',
    (b) => b.replace('· typecheck: exit 0', '· E2E · typecheck: exit 0'),
    /claims "e2e"/],
  ['an Issues found: header with nothing beneath it',
    (b) => b.replace(/ {2}- SHOULD FIX:.*\n/g, ''),
    /no entries beneath it/],
  ['a placeholder nobody filled in',
    (b) => b.replace(/^Run folder: .*$/m, 'Run folder:   {run_dir}'),
    /still carries a \{placeholder\}/],
  ['a NOT VERIFIED disclosure satisfied only by the copy inside the PR message',
    (b) => b.replace(/^NOT VERIFIED:.*\n^ +· spec grading.*\n/m, ''),
    /no line matching \/\^NOT VERIFIED/],
  ['READY_TO_COMMIT printed over an open Must Fix',
    (b) => b.replace('  - SHOULD FIX: SF-1', '  - MUST FIX: MF-1 save writes an overlapping pair; AC11 unmet\n  - SHOULD FIX: SF-1'),
    /over an open Must Fix/],
  ['an Interview: line whose counts do not add up',
    (b) => b.replace(/^Interview:.*$/m, 'Interview:    1 round: 3 asked, 1 answered, 1 defaulted, 4m waiting'),
    /does not add up/],
  ['an Interview: line blaming an input that cannot skip a round',
    (b) => b.replace(/^Interview:.*$/m, 'Interview:    none — interview: skipped (automation_level: manual)'),
    /is not one of the three inputs/],
  ['an Interview: line in a shape Step 5 never defines',
    (b) => b.replace(/^Interview:.*$/m, 'Interview:    yes'),
    /no line matching .*Interview/],
  ['READY_TO_COMMIT over a live check that did not run',
    (b) => b.replace(/\n +· live: PASS — .*/, '').replace('· full test suite\n', '· full test suite · live check (not run — no database in this sandbox)\n').replace('LIVE: PASS', 'LIVE: NOT RUN'),
    /READY_TO_COMMIT` without a live PASS/],
  ['a banner with no live verdict at all',
    (b) => b.replace(/\n +· live: PASS — .*/, ''),
    /no live verdict/],
  ['a live FAIL with no Must Fix line',
    (b) => b.replace('Status: READY_TO_COMMIT', 'Status: READY_WITH_WARNINGS').replace(/\n +· live: PASS — .*/, '').replace('· full test suite\n', '· full test suite · live check (FAIL — save stays disabled)\n').replace('LIVE: PASS', 'LIVE: FAIL'),
    /MUST FIX: live check failed/],
  ['a FINAL with no Live check section',
    (b) => b.replace(/## Live check\n\nLIVE: PASS\n/, ''),
    /no `## Live check` section/],
  ['a Live check report that disagrees with the banner',
    (b) => b.replace('LIVE: PASS', 'LIVE: FAIL'),
    /they disagree/],
  ['a --no-review run whose record does not say no reviewer ran',
    (b) => b.replace('Review cycles: 0/1', 'Review cycles: —').replace(/ {2}- SHOULD FIX:.*\n/g, '  - none\n'),
    /does not say so/],
  // The live words keep their braces, but the template's own slots inside them are still unfilled.
  ['an unfilled {flow} slot on the live PASS',
    (b) => b.replace(/· live: PASS — .*/, '· live: PASS — {flow}'),
    /still carries a \{placeholder\}/],
  ['the optional live PASS segment left in its template braces',
    (b) => b.replace(/\n +· live: PASS — .*/, '').replace('· build: exit 0', '· build: exit 0{ · live: PASS — {flow}}'),
    /still carries a \{placeholder\}/],
  ['an unfilled {reason} slot on a live FAIL',
    (b) => liveFailed(b, '{reason}'),
    /still carries a \{placeholder\}/],
  ['an unfilled {one line} slot on the live Must Fix',
    (b) => liveFailed(b, 'save stays disabled').replace('live check failed — save stays disabled', 'live check failed — {one line}'),
    /still carries a \{placeholder\}/],
  ['a live PASS and a live FAIL on one banner',
    (b) => b.replace('· full test suite\n', '· full test suite · live check (FAIL — save stays disabled)\n'),
    /a live PASS and a live FAIL or NOT RUN at once/],
  ['a live FAIL whose one rework never ran',
    (b) => liveFailed(b, 'save stays disabled').replace('Live rework: 1/1', 'Live rework: 0/1'),
    /Live rework: 0\/1/],
  ['a banner that never says whether the live rework was spent',
    (b) => b.replace('   Live rework: 0/1', ''),
    /no line matching \/Live rework/],
  ['a Must Fix listed below a Should Fix',
    (b) => b.replace('Status: READY_TO_COMMIT', 'Status: READY_WITH_WARNINGS').replace(/(  - SHOULD FIX: SF-3.*\n)/, '$1  - MUST FIX: MF-1 save writes an overlapping pair\n'),
    /every Must Fix comes first/],
  ['a --no-review run whose skip line sits above its live Must Fix',
    (b) => liveFailed(b, 'save stays disabled', true).replace(/( {2}- MUST FIX: .*\n)( {2}- none — review: .*\n)/, '$2$1'),
    /every Must Fix comes first/],
  ['a --no-review run whose Issues found keeps the live Must Fix and drops the skip line',
    (b) => liveFailed(b, 'save stays disabled', true).replace(/ {2}- none — review: .*\n/, ''),
    /no reviewer ran and `- none — review: skipped \(config\); no reviewer ran` is not the last entry/],
  ['a --no-review run whose NOT VERIFIED puts the review skip before the live check',
    (b) => liveFailed(b, 'save stays disabled', true).replace('· live check (FAIL — save stays disabled) · code review — review: skipped (config)', '· code review — review: skipped (config) · live check (FAIL — save stays disabled)'),
    /is not the last entry on NOT VERIFIED/],
  ['a --no-review run that still counts review cycles',
    (b) => liveFailed(b, 'save stays disabled', true).replace('Review cycles: — (review: skipped (config))', 'Review cycles: 0/1'),
    /still counts cycles/],
];

test('the attacks that used to lint clean are all caught', () => {
  for (const [name, mutate, expected] of ATTACKS) {
    const problems = lintFinal(mutate(fixture()));
    assert.ok(problems.some((p) => expected.test(p)),
      `${name} lints clean. Got: ${problems.join('; ') || '(clean)'}`);
  }
});

test('a live FAIL that stayed failed is READY_WITH_WARNINGS with its Must Fix, and lints clean', () => {
  const failed = fixture()
    .replace('Status: READY_TO_COMMIT', 'Status: READY_WITH_WARNINGS')
    .replace(/\n +· live: PASS — .*/, '')
    .replace('· full test suite\n', '· full test suite · live check (FAIL — save stays disabled on an overlapping break)\n')
    .replace('Issues found:\n', 'Issues found:\n  - MUST FIX: live check failed — save stays disabled on an overlapping break\n')
    .replace('Live rework: 0/1', 'Live rework: 1/1')
    .replace('LIVE: PASS', 'LIVE: FAIL');
  assert.deepEqual(lintFinal(failed), []);
});

test('a --no-review run with a live PASS is READY_TO_COMMIT, and lints clean', () => {
  // The status rule keys on the live PASS and on no open Must Fix; a run with no reviewer
  // has none, and its NOT VERIFIED list, Issues found and cycle count say no reviewer ran.
  const noReview = fixture()
    .replace('· full test suite\n', '· full test suite · code review — review: skipped (config)\n')
    .replace(/ {2}- SHOULD FIX:.*\n/g, '')
    .replace('Issues found:\n', 'Issues found:\n  - none — review: skipped (config); no reviewer ran\n')
    .replace('Review cycles: 0/1', 'Review cycles: — (review: skipped (config))');
  assert.deepEqual(lintFinal(noReview), []);
});

test('a --no-review run whose live check failed keeps the Must Fix first and the skip last, and lints clean', () => {
  const failed = fixture()
    .replace('Status: READY_TO_COMMIT', 'Status: READY_WITH_WARNINGS')
    .replace(/\n +· live: PASS — .*/, '')
    .replace('· full test suite\n', '· full test suite · live check (FAIL — save stays disabled) · code review — review: skipped (config)\n')
    .replace(/ {2}- SHOULD FIX:.*\n/g, '')
    .replace('Issues found:\n', 'Issues found:\n  - MUST FIX: live check failed — save stays disabled\n  - none — review: skipped (config); no reviewer ran\n')
    .replace('Review cycles: 0/1', 'Review cycles: — (review: skipped (config))')
    .replace('Live rework: 0/1', 'Live rework: 1/1')
    .replace('LIVE: PASS', 'LIVE: FAIL');
  assert.deepEqual(lintFinal(failed), []);
});

test('a report with no LIVE: line is recorded as NOT RUN above it, and lints clean', () => {
  // Step 3c: any other first line counts as NOT RUN, reason `no LIVE: line`. The conductor
  // writes that verdict above the report it could not read, so the section still opens with it.
  const unreadable = fixture()
    .replace('Status: READY_TO_COMMIT', 'Status: READY_WITH_WARNINGS')
    .replace(/\n +· live: PASS — .*/, '')
    .replace('· full test suite\n', '· full test suite · live check (not run — no LIVE: line)\n')
    .replace('LIVE: PASS\n', 'LIVE: NOT RUN\nReason: no LIVE: line\nThe editor loaded and the save looked fine to me.\n');
  assert.deepEqual(lintFinal(unreadable), []);
});

test('a Live check report held in a code fence still lints clean', () => {
  const fenced = fixture().replace(/## Live check\n\n(LIVE: PASS\n[\s\S]*?)\n## Open Must Fix/, '## Live check\n\n```\n$1```\n\n## Open Must Fix');
  assert.notEqual(fenced, fixture(), 'the fixture no longer has the section this test fences');
  assert.deepEqual(lintFinal(fenced), []);
});

test("a live flow worded with a skipped check's name is not a claim to have run it", () => {
  const worded = fixture().replace(/· live: PASS — .*/, '· live: PASS — a GraphQL mutation saves the e2e break');
  assert.deepEqual(lintFinal(worded), []);
});

test("the live report's own words keep their braces, and lint clean", () => {
  // Step 5 copies `Exercised:` and `Reason:` onto the banner. A route template or a JSON body is
  // the user's words, not a placeholder, and a finished run must not halt STALLED over one.
  for (const flow of ['PATCH /spots/{id}/hours with a 12:00-14:00 break', 'PATCH /lists/1 {"name":"Weekend groceries"}, then GET']) {
    assert.deepEqual(lintFinal(fixture().replace(/· live: PASS — .*/, `· live: PASS — ${flow}`)), [], flow);
  }
  for (const reason of ['POST /breaks answered 422 {"error":"overlap"}', 'save stays disabled (no error shown) on {id} 3']) {
    assert.deepEqual(lintFinal(liveFailed(fixture(), reason)), [], reason);
    assert.deepEqual(lintFinal(liveFailed(fixture(), reason, true)), [], `${reason}, with no reviewer`);
  }
});

test('a conforming report with CRLF line endings still passes', () => {
  // It used to fail as "no YAML frontmatter", which is false and sends the writer to the
  // wrong end of the file.
  assert.deepEqual(lintFinal(fixture().replace(/\n/g, '\r\n')), []);
});

test('the frontmatter status stays COMPLETE, and the verdict stays in the banner', () => {
  // Two different fields with two different consumers. Swapping one for the other is
  // the mistake this pair of assertions exists to make impossible to ship quietly.
  assert.deepEqual(lintFinal(fixture().replace('status: COMPLETE', 'status: READY_TO_COMMIT')),
    ['frontmatter `status` is `READY_TO_COMMIT`, not `COMPLETE`']);
  assert.ok(lintFinal(fixture().replace(/^Status: READY_TO_COMMIT$/m, '')).length > 0);
});

test('SKILL.md Step 5 requires the banner inside the file, not only on stdout', () => {
  const md = readFileSync(join(__dirname, '..', 'SKILL.md'), 'utf8');
  const start = md.indexOf('## Step 5');
  const end = md.indexOf('## What flash does not verify');
  assert.ok(start > -1 && end > start, 'the Step 5 heading or its end sentinel was renamed — this test was reading the whole file');
  const step5 = md.slice(start, end);
  assert.match(step5, /fenced, comes the banner block below, verbatim/,
    'Step 5 no longer requires the banner in the FINAL body — the disclosure is back to chat-only');
  assert.match(step5, /Read the FINAL back before printing/,
    'Step 5 lost its read-back guard — flash can print green over an absent report');
  assert.match(step5, /status:` stays `COMPLETE`/,
    'Step 5 no longer states which field holds the lifecycle and which holds the verdict');
  // Two rules name the section, and each has to survive on its own: the write and the read-back.
  assert.match(step5, /a `## Live check` section with the final live report verbatim/, 'Step 5 no longer puts the final live report in the FINAL');
  assert.match(step5, /four frontmatter keys, a `## Live check` section/, 'the read-back no longer checks the FINAL for its `## Live check` section');
  // The read-back is the linter in prose: it scans the fields above the proposed messages for
  // placeholders, not every brace in the fence, or a JSON commit message halts a finished run.
  assert.match(step5, /no `\{placeholder\}` above `Proposed commit message:`/, 'the read-back and lintFinal scan different parts of the banner');
  assert.doesNotMatch(step5, /no `\{`…`\}`/, 'the read-back rejects every brace, which lintFinal accepts');
  assert.match(step5, /READY_TO_COMMIT` only with a live `PASS`/, 'Step 5 lost the rule that READY_TO_COMMIT needs a live PASS');
  // The guard is what actually runs; the linter only runs when a human sets FLASH_FINAL.
  // Every line the linter demands has to be named in the guard, or the two disagree.
  // The guard is what actually runs; the linter only runs when a human sets FLASH_FINAL.
  // Rather than list the labels here — which is how the two drifted apart the first time —
  // derive them from REQUIRED_LINES, so a rule added there must be answered in the skill.
  const banner = step5.slice(step5.indexOf('ORCHESTRATOR — pipeline complete'));
  for (const [re] of REQUIRED_LINES) {
    const label = /\^([A-Za-z][A-Za-z ]*:)/.exec(String(re));
    if (!label) continue;
    assert.ok(banner.includes(label[1]), `REQUIRED_LINES demands ${label[1]} and the banner in SKILL.md has no such line`);
  }
});

test('the six lines product-manager copies into a PR are all present and explained', () => {
  const md = readFileSync(join(__dirname, '..', 'SKILL.md'), 'utf8');
  for (const label of ['Rigor:', 'Delivered:', 'Unmeasured:', 'Instrument moved:', 'Deferred by decision:', 'Issues found:']) {
    assert.match(md, new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'm'),
      `the banner has no ${label} line — product-manager renders its PR all-clear when all six are absent`);
  }
  assert.match(md, /Not delivered/, 'nothing in the skill says why those six lines are there, so the next edit drops them');
});

const real = process.env.FLASH_FINAL;
test('a real FINAL report conforms', { skip: real ? false : 'set FLASH_FINAL=<path> to check a produced report' }, () => {
  assert.ok(existsSync(real), `FLASH_FINAL points at nothing: ${real}`);
  const problems = lintFinal(readFileSync(real, 'utf8'));
  assert.deepEqual(problems, [], `${real}\n  - ${problems.join('\n  - ')}`);
});

module.exports = { lintFinal, REQUIRED_LINES, SKIPPED_CHECKS };
