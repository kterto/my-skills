"use strict";
// Byte comparisons for pixel arrays and file bytes. assert's deep-equality diff prints a typed array one element per
// line and diffs those lines, so a failing comparison of a few thousand bytes allocates gigabytes within a second;
// these report the first differing byte instead, or that the arrays are equal, in one line.
const assert = require("node:assert");

function assertSameBytes(actual, expected, label) {
  assert.strictEqual(actual.constructor, expected.constructor, `${label}: array type`);
  let at = 0;
  while (at < actual.length && at < expected.length && actual[at] === expected[at]) at++;
  assert.ok(at === actual.length && at === expected.length, `${label}: byte ${at} is ${actual[at]}, expected ${expected[at]} (lengths ${actual.length} and ${expected.length})`);
}

function assertDifferentBytes(actual, expected, label) {
  const same = actual.length === expected.length && actual.every((v, i) => v === expected[i]);
  assert.ok(!same, `${label}: the ${actual.length} bytes are identical`);
}

module.exports = { assertSameBytes, assertDifferentBytes };
