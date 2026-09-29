#!/usr/bin/env node
'use strict';
/**
 * Flash has to fit the smallest window it is sold for. After a compaction the host
 * re-attaches an invoked skill cut at about 20.5 KB, and a conductor that keeps only the
 * head of its protocol runs the rest from memory. 16,384 bytes is never cut, and the first
 * kilobyte tells a conductor that lost its place where to pick up (ADR-0029).
 */
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');

const REPO = join(__dirname, '..', '..', '..', '..', '..');
const FLASH = join(__dirname, '..');
const CEILING = 16384;
const ADR = 'docs/adr/0029-flash-fits-the-smallest-window-and-runs-one-live-check.md';
const entry = () => JSON.parse(readFileSync(join(REPO, 'plugins/my-skills/skills/budgets.json'), 'utf8')).files['orchestrator-flash/SKILL.md'];
// The Prime build copies this suite into prime-agent/skills/, where SKILL.md opens with the
// Prime preamble and carries no budget. The window these tests guard is the marketplace copy's.
const PORT = FLASH !== join(REPO, 'plugins', 'my-skills', 'skills', 'orchestrator-flash');
const marketplaceOnly = { skip: PORT && 'a derived copy: the budget and the resume pointer bind the marketplace SKILL.md' };

const roots = [];
after(() => { for (const r of roots) rmSync(r, { recursive: true, force: true }); });

test('SKILL.md fits under the re-attach cut, with its ceiling in budgets.json', marketplaceOnly, () => {
  const size = statSync(join(FLASH, 'SKILL.md')).size;
  assert.ok(size <= CEILING, `SKILL.md is ${size} bytes, over ${CEILING}`);
  assert.equal(entry().maxBytes, CEILING);
  assert.equal(entry().adr, ADR);
  assert.ok(existsSync(join(REPO, ADR)), `the budget names ${ADR}, which does not exist`);
});

test('a SKILL.md grown by 1 KB fails check-skill-budgets.mjs', marketplaceOnly, () => {
  // A fixture copy, never the real tree: the real tree is what the script itself checks.
  // The ADR is a stub here; the test above holds the real one to existing.
  const root = mkdtempSync(join(tmpdir(), 'flash-budget-'));
  roots.push(root);
  const skill = join(root, 'plugins/my-skills/skills/orchestrator-flash/SKILL.md');
  mkdirSync(dirname(skill), { recursive: true });
  copyFileSync(join(FLASH, 'SKILL.md'), skill);
  writeFileSync(join(root, 'plugins/my-skills/skills/budgets.json'), JSON.stringify({ version: 1, files: { 'orchestrator-flash/SKILL.md': entry() } }));
  mkdirSync(dirname(join(root, ADR)), { recursive: true });
  writeFileSync(join(root, ADR), '# ADR-0029 (fixture stub)\n');
  const env = { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_'))), GIT_CEILING_DIRECTORIES: tmpdir() };
  const run = () => spawnSync(process.execPath, [join(REPO, 'scripts/check-skill-budgets.mjs'), '--root', root], { encoding: 'utf8', env });
  const clean = run();
  assert.equal(clean.status, 0, clean.stderr);
  appendFileSync(skill, 'x'.repeat(1024));
  const grown = run();
  assert.equal(grown.status, 1, grown.stdout);
  assert.match(grown.stderr, /orchestrator-flash\/SKILL\.md: \d+ bytes, \d+ over its budget of 16384/);
});

test('the resume pointer sits in the first kilobyte, and says only what is true', marketplaceOnly, () => {
  const bytes = readFileSync(join(FLASH, 'SKILL.md'));
  const head = bytes.subarray(0, 1024).toString('utf8');
  assert.match(head, /Lost your place after a compaction\?/, 'no resume pointer in the first 1 KB');
  assert.match(head, /newest `plans\/\*\/` whose `SPEC` this run minted/, 'the pointer does not say where the run folder is');
  assert.match(head, /step after its newest artifact/, 'the pointer does not say what to continue from');
  assert.match(head, /no state file/, 'the pointer must not imply a state file flash does not keep');
  // Names sort by prefix and mtime moves when the coder edits the plan, so "newest" needs its
  // reading: the id's timestamp, which the conductor minted in step order.
  assert.match(head, /newest artifact, by the timestamp in its id/, 'the pointer does not say how to tell the newest artifact');
  // The whole pointer, its artifact-to-step map included, and not only its opening phrases.
  const start = bytes.indexOf('> **Lost your place');
  const end = bytes.indexOf('\n', start);
  assert.ok(start > -1 && end > start, 'the pointer is not a paragraph of its own');
  assert.ok(end <= 1024, `the pointer ends at byte ${end}, past the first kilobyte`);
  assert.match(bytes.subarray(start, end).toString('utf8'), /`FINAL` → the Step 5 read-back\.$/, 'the pointer lost the end of its map');
});

test('the ADR and the measurement protocol name the same blind spots, the spent live rework among them', marketplaceOnly, () => {
  // The falsifier counts any state loss outside the states the ADR names, so a known gap left
  // off the list would read as a refutation, and a boundary left out of the draw goes unmeasured.
  const adr = readFileSync(join(REPO, ADR), 'utf8');
  const doc = readFileSync(join(REPO, 'docs/compaction-measurement.md'), 'utf8');
  assert.match(adr, /Five states leave nothing in the folder that sets them apart/);
  for (const re of [/- whether the one live rework is spent:/, /- the interview's figures:/]) assert.match(adr, re);
  assert.match(adr, /loses state outside the five states decision 3 names/);
  assert.match(doc, /Five flash states leave no file/);
  for (const re of [/\*\*Whether the live rework is spent\.\*\*/, /\*\*The interview's figures\.\*\*/, /or re-ran the live rework/]) assert.match(doc, re);
  assert.match(doc, /^11\. after a live-rework coder, before `live` is spawned again/m);
  assert.match(doc, /Math\.random\(\) \* 11/, 'the draw cannot reach the eleventh boundary');
});

test('the conductor mints every id from SKILL.md itself, with the recipe\'s own newid', () => {
  // Every step mints an id, and after a compaction the conductor holds the re-attached SKILL.md,
  // not the recipe it read once. A newid only in the recipe is one protocol read per compaction.
  const md = readFileSync(join(FLASH, 'SKILL.md'), 'utf8');
  const line = md.split('\n').find((l) => l.startsWith('newid() {'));
  assert.ok(line, 'SKILL.md has no newid of its own');
  const recipe = readFileSync(join(FLASH, 'templates/artifact-format-flash.md'), 'utf8');
  const from = recipe.indexOf('newid() {');
  const fn = recipe.slice(from, recipe.indexOf('\n}', from) + 2);
  assert.ok(from > -1, 'the recipe has no newid');
  // The same output as the recipe's with date and openssl pinned; without openssl, the same
  // fallback expression (bash reseeds RANDOM in a subshell, so its value cannot be pinned).
  const run = (def, openssl) => execFileSync('bash', ['-c', `date() { echo 20260929T120000Z; }\nopenssl() { ${openssl}; }\n${def}\nnewid FINAL`], { encoding: 'utf8' }).trim();
  assert.equal(run(line, 'echo 0bad'), 'FINAL-20260929T120000Z-0bad');
  assert.equal(run(fn, 'echo 0bad'), 'FINAL-20260929T120000Z-0bad', 'the recipe\'s newid changed shape; SKILL.md\'s copy must follow it');
  assert.match(run(line, 'return 1'), /^FINAL-20260929T120000Z-[0-9a-f]{4}$/);
  const fallback = "openssl rand -hex 2 2>/dev/null || printf '%04x' $(( (RANDOM<<8 ^ RANDOM) & 0xffff ))";
  assert.ok(fn.includes(fallback) && line.includes(fallback), 'SKILL.md\'s newid and the recipe\'s draw their four hex differently');
});
