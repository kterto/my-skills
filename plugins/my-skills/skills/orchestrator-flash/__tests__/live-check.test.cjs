#!/usr/bin/env node
'use strict';
/**
 * D8: one live check, worded from the user's brief, on every run. A flash run once shipped
 * a form whose save silently disabled itself on the exact input the brief named; driving
 * the form with the user's own values would have taken minutes. These tests pin both
 * halves: the conductor spawns the check whatever `review` says, and the role knows its
 * whole job, its limits, and the one honest verdict for a surface it cannot reach.
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync, statSync } = require('node:fs');
const { join } = require('node:path');

const FLASH = join(__dirname, '..');
const skill = () => readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
const role = () => readFileSync(join(FLASH, 'templates/live.md'), 'utf8');

function section(md, heading, sentinel) {
  const start = md.indexOf(heading);
  const end = md.indexOf(sentinel);
  assert.ok(start > -1, `the file has no ${heading}`);
  assert.ok(end > start, `the sentinel "${sentinel}" was renamed — this test was reading the whole file`);
  return md.slice(start, end);
}

test('Step 3c runs on every run, between the build and the review', () => {
  const md = skill();
  assert.ok(md.indexOf('## Step 3b') < md.indexOf('## Step 3c') && md.indexOf('## Step 3c') < md.indexOf('## Step 4'),
    'Step 3c is not between Step 3b and Step 4');
  const step = section(md, '## Step 3c', '## Step 4');
  assert.match(step, /Every run, whatever `review` says/);
  for (const field of ['User brief (verbatim):', 'Plan path:', 'live_cmd=', 'live_minutes=']) {
    assert.ok(step.includes(field), `the live spawn carries no ${field}`);
  }
  assert.match(md, /Nothing skips the live check/);
  assert.doesNotMatch(md, /--no-live|--skip-live/, 'a flag disables the check D8 runs on every run');
});

test('a live FAIL gets exactly one rework, whatever the review budget says', () => {
  const step = section(skill(), '## Step 3c', '## Step 4');
  assert.match(step, /one live rework per run, whatever `max_review_cycles` says/);
  assert.match(step, /re-spawn `live` once/);
  assert.match(step, /open Must Fix/);
  assert.match(step, /LIVE: NOT RUN/);
});

test('each verdict routes where Step 3c says: every one of them on to the review', () => {
  // A PASS routed to Step 5 would skip the reviewer; so would a FAIL that stays failed.
  const step = section(skill(), '## Step 3c', '## Step 4');
  assert.match(step, /^- `LIVE: PASS` → Step 4\.$/m);
  assert.match(step, /^- `LIVE: FAIL` → .*Still `FAIL`, or no rework left: Step 4, with the failure an open Must Fix\.$/m);
  assert.match(step, /^- `LIVE: NOT RUN`, or any other first line .*→ Step 4; Step 5 discloses it\.$/m);
});

test('a report with no LIVE: line is recorded as NOT RUN, never read as a pass', () => {
  // The FINAL's `## Live check` section has to open with a verdict, so the conductor writes
  // the one it assigned above the report; keeping an unreadable report verbatim with no
  // verdict above it would fail the read-back and halt a run that only needed to disclose.
  const step = section(skill(), '## Step 3c', '## Step 4');
  assert.match(step, /any other first line \(record `LIVE: NOT RUN` and `Reason: no LIVE: line` above the report in `## Live check`\)/);
});

test('a lost report is spawned again, never rebuilt, and its verdict counts', () => {
  // A report written from memory would be the conductor's claim, not the role's observation.
  // The fresh one can differ, and it routes like any other, with the one rework already counted.
  const step = section(skill(), '## Step 3c', '## Step 4');
  assert.match(step, /if it has left your context, re-spawn `live`, never rebuild it/);
  assert.match(step, /a changed verdict takes its branch above, the rework already counted/);
});

test('the live spawn carries the run base and no ID, because it diffs and writes nothing', () => {
  const md = skill();
  assert.match(md, /^ID to use: .*← producing roles; never the coder or live$/m);
  assert.match(md, /^MAESTRO_REVIEW_BASE=\{base_sha\} +← the coder, live and the reviewer$/m);
});

test('a review rework re-runs the live check before the fresh CR', () => {
  assert.match(section(skill(), '## Step 4', '## Step 5'), /Re-run Steps 3b and 3c/);
});

// Each rule is asserted as the sentence that states it. A bare word survives the rule being
// deleted or inverted: "one" is in "none", and "reset" is in "run reset when you need it".
test('the live role file holds the whole job in 2.5 KB', () => {
  assert.ok(statSync(join(FLASH, 'templates/live.md')).size <= 2560);
  const r = role();
  for (const re of [
    /Use `live_cmd` when it is not `none`; otherwise detect it: package scripts, a Makefile, a compose file, the README\./,
    /Pick \*\*one\*\* user-visible flow the change touches, worded from the brief\./,
    /Use the user's own example values when the brief has them/,
    /Never through the coder's tests, and never through a unit test\./,
  ]) assert.match(r, re);
});

test('the live role keeps its hard limits', () => {
  const r = role();
  const limits = section(r, '## Hard limits', '## Verdict');
  for (const re of [
    /^- Never modify source or test files/m,
    /^- Never run destructive commands: no reset, drop, truncate or force-migrate\.$/m,
    /^- Create only throwaway records, and remove them when you can\.$/m,
    /^- Stop every process you started/m,
    /^- Stay within `live_minutes`\.$/m,
  ]) assert.match(limits, re);
});

test('the live role leaves the uncommitted run, other services and real data alone', () => {
  // Nothing is committed while it runs, so a stash or a checkout discards the run's work; a
  // port it frees may be the user's own server; and a flow driven against a shared store or a
  // real mail or payment service has effects no throwaway record undoes.
  const limits = section(role(), '## Hard limits', '## Verdict');
  assert.match(limits, /or git state: no stash, checkout, reset, restore, clean or commit\./);
  assert.match(limits, /and none you did not; never remove volumes\./);
  assert.match(limits, /Use only a local or dev store, named in `Evidence:`; a shared or production one, or real email, SMS or payments, is NOT RUN\./);
});

test('the live report carries no secret into the FINAL, which product-manager commits', () => {
  assert.match(section(role(), '## Hard limits', '## Verdict'), /^- Write `\*\*\*` for every secret in your report: tokens, passwords, API keys, connection strings\.$/m);
});

test('the live role can run what it is told: a diff base it can type, and one verdict line', () => {
  // The base arrives as preamble text, not as an environment variable: `git diff
  // "$MAESTRO_REVIEW_BASE"` runs `git diff ""` and fails. The output block lists the three
  // verdicts, and a role that copies that line is read as none of them.
  const r = role();
  assert.match(r, /`git diff <the preamble's MAESTRO_REVIEW_BASE sha>`/);
  assert.doesNotMatch(r, /\$MAESTRO_REVIEW_BASE"/);
  assert.match(r, /The first line is exactly one verdict, e\.g\. `LIVE: FAIL`\./);
  assert.match(r, /Start servers in the background; drive nothing until the surface answers\./);
  assert.match(r, /\*\*NOT RUN\*\*: the surface did not answer within `live_minutes`/);
});

test('NOT RUN is the honest verdict, and there is no escape value', () => {
  const r = role();
  assert.match(r, /There is no "owner-run", "deferred" or "pending" verdict\./);
  for (const line of r.split('\n').filter((l) => /owner-run|deferred|pending/i.test(l))) {
    assert.match(line, /\bno\b|never/i, `live.md offers an escape verdict: ${line}`);
  }
});
