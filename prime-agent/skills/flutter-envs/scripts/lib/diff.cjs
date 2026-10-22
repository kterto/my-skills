"use strict";
// Unified diffs of text, for `apply --dry-run`: a line-based Myers diff and hunks with three lines of context. Pure;
// the caller decides what text it is shown, so values that must stay out of output never reach this module.

const CONTEXT = 3;
const LIMIT = 40000;

const lines = (text) => {
  if (text === null || text === "") return [];
  const out = text.split("\n");
  if (out[out.length - 1] === "") out.pop();
  return out;
};

// -> [op, line] pairs, op being '=', '-' or '+' (Myers, "An O(ND) Difference Algorithm").
function edits(a, b) {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  if (max > LIMIT) return [...a.map((l) => ["-", l]), ...b.map((l) => ["+", l])];
  const off = max + 1;
  const v = new Int32Array(2 * max + 3);
  const trace = [];
  for (let d = 0; d <= max; d++) {
    trace.push(v.slice());
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) { x++; y++; }
      v[off + k] = x;
      if (x >= n && y >= m) return walk(trace, a, b, off);
    }
  }
  return [];
}

function walk(trace, a, b, off) {
  const out = [];
  let x = a.length;
  let y = b.length;
  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d];
    const k = x - y;
    const prevK = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? k + 1 : k - 1;
    const prevX = v[off + prevK];
    const prevY = prevX - prevK;
    while (x > prevX && y > prevY) { out.push(["=", a[x - 1]]); x--; y--; }
    if (d > 0) out.push(x === prevX ? ["+", b[y - 1]] : ["-", a[x - 1]]);
    x = prevX;
    y = prevY;
  }
  return out.reverse();
}

// -> the unified diff of one file, '' when the texts are equal. A null side is a file that does not exist.
function unified(file, before, after) {
  if (before === after) return "";
  const ops = edits(lines(before), lines(after));
  const changed = ops.map((o, i) => (o[0] === "=" ? -1 : i)).filter((i) => i >= 0);
  const hunks = [];
  for (const i of changed) {
    const last = hunks[hunks.length - 1];
    if (last && i - last.end <= 2 * CONTEXT) last.end = i;
    else hunks.push({ start: i, end: i });
  }
  const out = [`--- ${before === null ? "/dev/null" : `a/${file}`}`, `+++ ${after === null ? "/dev/null" : `b/${file}`}`];
  for (const h of hunks) {
    const from = Math.max(0, h.start - CONTEXT);
    const to = Math.min(ops.length, h.end + CONTEXT + 1);
    let aLine = 1;
    let bLine = 1;
    for (let i = 0; i < from; i++) { if (ops[i][0] !== "+") aLine++; if (ops[i][0] !== "-") bLine++; }
    const body = ops.slice(from, to);
    const aCount = body.filter((o) => o[0] !== "+").length;
    const bCount = body.filter((o) => o[0] !== "-").length;
    out.push(`@@ -${aCount ? aLine : aLine - 1},${aCount} +${bCount ? bLine : bLine - 1},${bCount} @@`);
    for (const [op, line] of body) out.push(`${op === "=" ? " " : op}${line}`);
  }
  return `${out.join("\n")}\n`;
}

module.exports = { unified, edits };
