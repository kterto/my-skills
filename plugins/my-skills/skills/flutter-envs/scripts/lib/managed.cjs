"use strict";
// The ownership marker. One function pair writes and reads `flutter-envs:begin <id> sha=<8 hex>` ... `flutter-envs:end
// <id>` in each comment syntax, so a block is always looked for in the syntax it was written in. The earlier
// wizard's `setup-flutter-envs: managed` marker is recognised read-only and never written.

const crypto = require("node:crypto");

const SYNTAX = Object.freeze({ slash: ["// ", ""], hash: ["# ", ""], xml: ["<!-- ", " -->"] });
const LEGACY = "setup-flutter-envs: managed";

const sha = (text) => crypto.createHash("sha1").update(text).digest("hex").slice(0, 8);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const eolOf = (text) => ((text.match(/\r\n/g) || []).length * 2 > (text.match(/\n/g) || []).length ? "\r\n" : "\n");

function pattern(id, syntax) {
  const [open, close] = SYNTAX[syntax];
  const begin = `${esc(open)}flutter-envs:begin ${esc(id)} sha=([0-9a-f]{8})${esc(close)}`;
  const end = `${esc(open)}flutter-envs:end ${esc(id)}${esc(close)}`;
  return new RegExp(`^([ \\t]*)${begin}\\r?\\n([\\s\\S]*?)^[ \\t]*${end}(?:\\r?\\n)?`, "m");
}

function render(id, syntax, body, indent, eol) {
  const [open, close] = SYNTAX[syntax];
  const inner = body.replace(/\r?\n$/, "").split(/\r?\n/).map((l) => (l ? indent + l : l)).join(eol) + eol;
  return `${indent}${open}flutter-envs:begin ${id} sha=${sha(inner)}${close}${eol}${inner}${indent}${open}flutter-envs:end ${id}${close}${eol}`;
}

// -> null, or the block's span, its recorded sha and whether someone edited inside it since it was written.
function readBlock(text, { id, syntax }) {
  const m = pattern(id, syntax).exec(text);
  if (!m) return null;
  return { start: m.index, end: m.index + m[0].length, indent: m[1], recorded: m[2], body: m[3], edited: sha(m[3]) !== m[2] };
}

// -> { text, state }. A hand-edited block is a conflict and is never overwritten; anchor() < 0 cannot place one.
function ensureBlock(text, { id, syntax, body, anchor, indent = "" }) {
  const block = render(id, syntax, body, indent, eolOf(text));
  const found = readBlock(text, { id, syntax });
  if (found) {
    if (found.edited) return { text, state: "conflict" };
    if (text.slice(found.start, found.end) === block) return { text, state: "unchanged" };
    return { text: text.slice(0, found.start) + block + text.slice(found.end), state: "updated" };
  }
  const at = anchor(text);
  if (at < 0) return { text, state: "conflict" };
  return { text: text.slice(0, at) + block + text.slice(at), state: "created" };
}

// Every line carrying the earlier wizard's marker, in any comment syntax (it wrote `//` and checked for `#`).
function legacyMarkers(text) {
  const out = [];
  for (let i = text.indexOf(LEGACY); i >= 0; i = text.indexOf(LEGACY, i + LEGACY.length)) {
    const start = text.lastIndexOf("\n", i) + 1;
    const end = text.indexOf("\n", i);
    out.push({ index: i, lineStart: start, line: text.slice(start, end < 0 ? text.length : end) });
  }
  return out;
}

module.exports = { SYNTAX, LEGACY, sha, readBlock, ensureBlock, legacyMarkers };
