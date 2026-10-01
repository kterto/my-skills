'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { treeOf, candidateTree } = require('./git.cjs');

const CAP = 2048;
const FIRST_LINE_CAP = 1024;
const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Canonical JSON, keys sorted at every depth: what digests and "changed" compare.
const stableJson = (obj) => JSON.stringify(obj, (key, v) => (v && typeof v === 'object' && !Array.isArray(v)
  ? Object.fromEntries(Object.keys(v).sort(byCodeUnit).map((k) => [k, v[k]])) : v));

// `status` starts at not-run, so a kind that never sets it cannot read as a pass.
function envelope({ kind, mode = null, root, base, instruments, isolation = null, now, version }) {
  const { source, from, digest, moves } = instruments;
  return { schemaVersion: '1.0', kind, mode, generatedAt: now, tool: { name: 'clean-code-gates', version },
    tree: { base: base.sha, baseTree: treeOf(root, base.sha), candidateTree: candidateTree(root) },
    instruments: { source, from, digest, moves }, isolation, status: 'not-run', timing: {} };
}

function fmtDuration(ms) {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${String(s % 60).padStart(2, '0')}s`;
}
const ANSI = /\x1b\[[0-?]*[ -/]*[@-~]/g;
const SECRET = /(password|passwd|secret|token|api[_-]?key)\w*["']?\s*[=:]\s*\S*/gi;
// A URL's userinfo password (`scheme://user:<redacted>@host`) and a bearer token go too.
const URL_PASSWORD = /\b([a-z][a-z0-9+.-]*:\/\/[^\s:/?#@]*:)[^\s/?#@]+@/gi;
const BEARER = /\b(bearer)\s+[\w.~+/=-]+/gi;
const redact = (line) => String(line).replace(ANSI, '').replace(URL_PASSWORD, '$1<redacted>@').replace(BEARER, '$1 <redacted>')
  .replace(SECRET, '<redacted>');

// A character split by the cut decodes to U+FFFD, which is dropped with it. `left` keeps the end instead.
function cut(s, max, left = false) {
  const bytes = Buffer.from(s);
  if (bytes.length <= max) return s;
  return left ? `…${bytes.subarray(bytes.length - max + 3).toString().replace(/^\uFFFD+/, '')}`
    : `${bytes.subarray(0, max - 3).toString().replace(/\uFFFD$/, '')}…`;
}

// Line 1 (the verdict) and the last (the report path) always survive; past the cap, details drop from
// the end behind one "… +N more lines" line, and a path too long for what line 1 leaves is cut from its left.
function summarize(lines, reportPath) {
  const first = cut(String(lines[0] ?? ''), FIRST_LINE_CAP);
  const details = lines.slice(1).map(String);
  const more = (n) => `… +${n} more lines`;
  const room = CAP - Buffer.byteLength(`${first}\n${details.length ? `${more(details.length)}\n` : ''}report → \n`);
  const last = `report → ${cut(String(reportPath), room, true)}`;
  const text = (middle) => `${[first, ...middle, last].join('\n')}\n`;
  const fits = (middle) => Buffer.byteLength(text(middle)) <= CAP;
  if (fits(details)) return text(details);
  const kept = [];
  while (fits([...kept, details[kept.length], more(details.length - kept.length - 1)])) kept.push(details[kept.length]);
  return text([...kept, more(details.length - kept.length)]);
}

function writeReport(outDir, kind, obj) {
  fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, `${kind}.json`);
  fs.writeFileSync(file, `${JSON.stringify(obj, null, 2)}\n`);
  return file;
}

module.exports = { envelope, stableJson, byCodeUnit, summarize, fmtDuration, redact, writeReport };
