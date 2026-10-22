"use strict";
// The six-method tree an op receives, over a map of files, for driving the Android, env, Dart and Make ops one at a
// time: reads see earlier writes, and a test reads back each file, its conflicts and its foreign notes.

function optree(files = {}) {
  const data = new Map(Object.entries(files).filter(([, v]) => v !== null && v !== undefined).map(([k, v]) => [k, Buffer.isBuffer(v) ? v : Buffer.from(String(v))]));
  const conflicts = new Map();
  const foreign = new Map();
  const written = new Set();
  const tree = {
    read: (rel) => (data.has(rel) ? data.get(rel).toString("utf8") : null),
    readBytes: (rel) => (data.has(rel) ? Buffer.from(data.get(rel)) : null),
    write: (rel, content) => { written.add(rel); data.set(rel, Buffer.isBuffer(content) ? content : Buffer.from(String(content))); },
    remove: (rel) => { written.add(rel); data.delete(rel); },
    conflict: (rel, note) => conflicts.set(rel, note),
    foreign: (rel, note) => foreign.set(rel, note),
  };
  return { tree, text: (rel) => tree.read(rel), files: () => Object.fromEntries([...data].map(([k, v]) => [k, v.toString("utf8")])), conflicts, foreign, written };
}

// Runs an op twice from the same start and returns both trees, for idempotency checks.
function twice(op, files, args, ctx = { stamp: "20261021T000000Z" }) {
  const a = optree(files);
  op(a.tree, args, ctx);
  const b = optree(a.files());
  op(b.tree, args, ctx);
  return [a, b];
}

module.exports = { optree, twice };
