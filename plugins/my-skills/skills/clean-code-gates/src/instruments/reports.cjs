'use strict';
// The barrier's report parsers (contract §5.2 step 3). Each returns
// { suites: [{ file, hasFile, result, executed, passed, failed, skipped, failures, message }] },
// or null when the report is missing or unparseable, which the barrier reads as vacuous.
const path = require('node:path');
const { redact, byCodeUnit } = require('./envelope.cjs');

const firstLine = (s) => (redact(String(s || '')).split('\n').map((l) => l.trim()).find(Boolean) || '').slice(0, 300);

const suite = (file, hasFile) => ({ file, hasFile, result: 'pass', executed: 0, passed: 0, failed: 0, skipped: 0, failures: [], message: null });

function settle(s, allErrored) {
  s.executed = s.passed + s.failed;
  if (allErrored || s.message !== null) s.result = 'error';
  else if (s.failed) s.result = 'fail';
  else if (!s.executed) s.result = 'skipped';
  return s;
}

/** A report path as a repo-relative file: `<cwd>/` + its path below runner_cwd. Outside it, the report is unusable. */
function mapper(cwd, runnerCwd) {
  return (name) => {
    const rel = path.posix.relative(runnerCwd, path.posix.resolve(runnerCwd, String(name)));
    if (!rel || rel === '..' || rel.startsWith('../')) throw new Error(`${name} is outside ${runnerCwd}`);
    return path.posix.join(cwd, rel);
  };
}

function jest(text, map) {
  return JSON.parse(text).testResults.map((r) => {
    const s = suite(map(r.name), true);
    for (const a of r.assertionResults || []) {
      if (a.status === 'passed') s.passed += 1;
      else if (a.status !== 'failed') s.skipped += 1;
      else {
        s.failed += 1;
        s.failures.push({ name: a.fullName || a.title, message: firstLine((a.failureMessages || [])[0]) });
      }
    }
    // A failed suite with no failing test never ran them, or failed around them.
    if (r.status === 'failed' && !s.failed) s.message = firstLine(r.message || r.failureMessage) || 'failed to run';
    return settle(s, false);
  });
}

const TAG = /<(\/?)(testsuite|testcase|failure|error|skipped)\b((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>/g;
const ENTITIES = { lt: '<', gt: '>', amp: '&', quot: '"', apos: "'" };
const unxml = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => (e[0] !== '#' ? ENTITIES[e] ?? m
  : String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))));

function attrs(raw) {
  const out = {};
  for (const [, k, dq, sq] of raw.matchAll(/([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) out[k] = unxml(dq ?? sq);
  return out;
}

function junit(text, map, tierId) {
  const suites = new Map();
  const errored = new Map();
  const open = [];
  let tc = null;
  const add = (c) => {
    const ts = open[open.length - 1];
    const file = c.file || (ts && ts.file);
    const key = file ? map(file) : ts ? ts.name || tierId : tierId;
    if (!suites.has(key)) {
      suites.set(key, suite(key, !!file));
      errored.set(key, true);
    }
    const s = suites.get(key);
    if (c.outcome === 'skipped') s.skipped += 1;
    else if (c.outcome === 'passed') s.passed += 1;
    else {
      s.failed += 1;
      s.failures.push({ name: c.name, message: c.message });
    }
    if (c.outcome !== 'error') errored.set(key, false);
  };
  TAG.lastIndex = 0;
  for (let m = TAG.exec(text); m; m = TAG.exec(text)) {
    const [, close, tag, raw, self] = m;
    if (tag === 'testsuite') {
      if (close) open.pop();
      else if (!self) open.push(attrs(raw));
    } else if (tag === 'testcase') {
      if (!close) tc = { ...attrs(raw), outcome: 'passed', message: '' };
      if ((close || self) && tc) add(tc), tc = null;
    } else if (!close && tc) {
      // Skip the element's body, so a stack trace or CDATA can never read as tags.
      const end = self ? TAG.lastIndex : text.indexOf(`</${tag}>`, TAG.lastIndex);
      const body = end < 0 ? '' : text.slice(TAG.lastIndex, end).replace(/<!\[CDATA\[|\]\]>/g, '');
      if (!self) TAG.lastIndex = end < 0 ? text.length : end + tag.length + 3;
      // A <skipped> wins over a later <failure>: Node reports a failing todo test that way, and counts it todo.
      if (tag === 'skipped') tc.outcome = 'skipped';
      else if (tc.outcome !== 'skipped') {
        tc.outcome = tc.outcome === 'failure' ? 'failure' : tag;
        tc.message = firstLine(attrs(raw).message || unxml(body));
      }
    }
  }
  return [...suites.values()].map((s) => settle(s, errored.get(s.file) && s.failed > 0));
}

function flutter(text, map, partial) {
  const suites = new Map();
  const tests = new Map();
  let done = false;
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    let e; // read partially (a run cut off at its bound), a line torn mid-write is skipped
    try { e = JSON.parse(line); } catch (err) { if (partial) continue; throw err; }
    if (e.type === 'done') done = true;
    else if (e.type === 'suite') suites.set(e.suite.id, suite(map(e.suite.path), true));
    else if (e.type === 'testStart') {
      const loading = /^loading /.test(e.test.name) && !(e.test.groupIDs || []).length;
      tests.set(e.test.id, { s: suites.get(e.test.suiteID), name: e.test.name, loading, message: '' });
    } else if (e.type === 'error' && tests.has(e.testID)) {
      const t = tests.get(e.testID);
      t.message = t.message || firstLine(e.error);
    } else if (e.type === 'testDone' && tests.has(e.testID)) {
      const t = Object.assign(tests.get(e.testID), { done: true });
      const bad = e.result === 'error' || e.result === 'failure';
      // Loading and other hidden tests are not executed tests; one that failed means the suite never ran.
      if (e.hidden || t.loading) {
        if (bad) t.s.message = t.s.message || t.message || `${t.name}: ${e.result}`;
      } else if (e.skipped) t.s.skipped += 1;
      else if (bad) {
        t.s.failed += 1;
        t.s.failures.push({ name: t.name, message: t.message });
      } else t.s.passed += 1;
    }
  }
  // A stream without its `done` event is a runner that died mid-run; a test it started and never finished errs its suite.
  if (!done && !partial) throw new Error('the report has no done event');
  for (const t of tests.values()) if (!t.done) t.s.message = t.s.message || `${t.name}: started, never finished`;
  return [...suites.values()].map((s) => settle(s, false));
}

function exitCode(exit, tierId) {
  const s = suite(tierId, false);
  return { ...s, result: exit === 0 ? 'pass' : 'fail', executed: null, passed: null, failed: null, skipped: null };
}

// `partial`: the report of a run cut off at its bound, read for its counts (flutter-json: the tests that finished).
function parseReport(format, text, { cwd, runnerCwd, tierId, exit, partial = false }) {
  if (format === 'exit-code') return partial ? null : { suites: [exitCode(exit, tierId)] };
  if (text == null) return null;
  try {
    const map = mapper(cwd, runnerCwd);
    const suites = format === 'jest-json' ? jest(text, map) : format === 'junit' ? junit(text, map, tierId) : flutter(text, map, partial);
    return { suites: suites.sort((a, b) => byCodeUnit(a.file, b.file)) };
  } catch {
    return null;
  }
}

function totals(suites) {
  const sum = (k) => (suites.some((s) => s[k] === null) ? null : suites.reduce((n, s) => n + s[k], 0));
  return { executed: sum('executed'), passed: sum('passed'), failed: sum('failed'), skipped: sum('skipped') };
}

// The counts in a log's last `MM:SS +P ~S -F:` line (flutter's and dart's reporters): what a run cut off before its report had.
const PROGRESS = /\b\d+:\d\d \+(\d+)(?: ~(\d+))?(?: -(\d+))?:/g;
function progress(lines) {
  const [, p, s, f] = (lines.flatMap((l) => [...l.matchAll(PROGRESS)]).pop() || []).map((n) => Number(n || 0));
  return p === undefined ? null : { executed: p + f, passed: p, failed: f, skipped: s };
}

module.exports = { parseReport, totals, progress };
