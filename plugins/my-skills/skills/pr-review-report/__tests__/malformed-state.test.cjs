// Regression fixture for bug-4: malformed browser/envelope state must not abort the
// report. A string where an array is expected (thread/history), a bogus state enum,
// or a wrong-shaped op is coerced/dropped with a warning — never propagated to
// thread.map. See review-data-schema.md and overlayLocalStorage/buildStore.
// Run: node __tests__/malformed-state.test.cjs   (exits non-zero on failure)
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "references", "report-template.html"), "utf8");
function extractFn(src, name) {
  const start = src.indexOf("function " + name + "(");
  assert(start >= 0, "not found: " + name);
  let i = src.indexOf("{", start), depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(start, j + 1);
  }
  throw new Error("unbalanced: " + name);
}
// Pull the sanitizer + STATE_ENUM declarations (a block spanning several statements).
function extractBetween(src, startMarker, endMarker) {
  const a = src.indexOf(startMarker); assert(a >= 0, "start not found");
  const b = src.indexOf(endMarker, a); assert(b >= 0, "end not found");
  return src.slice(a, b);
}

let STORE = {}, STATE_VERSION = 1, STATE_READONLY = false, KNOWN_STATE_VERSION = 1;
let EMITTED_REV = "", OP_LOG = [], LS_KEY = null;
// sawMalformed + STATE_ENUM + sanitizers come from the extracted template block below.
const _ls = new Map();
const window = { localStorage: { getItem: (k) => (_ls.has(k) ? _ls.get(k) : null), setItem: (k, v) => _ls.set(k, v) } };
const warns = [];
const realLog = console.log.bind(console);
global.console = { warn: (m) => warns.push(m), log: realLog };

// sanitizers + STATE_ENUM + markMalformed live as a block before buildStore.
eval(extractBetween(html, "var STATE_ENUM =", "// Seed STORE from the complete"));
for (const n of ["hasTurn", "sameTurn", "hasTransition", "mergeThread", "applyOp",
  "overlayLocalStorage", "buildStore", "effThread"]) {
  eval(extractFn(html, n));
}
function threadMapProbe(f) { return effThread(f).map(function (m) { return m.text; }); } // must not throw

// 1) Envelope with a STRING thread + STRING history + bogus state must not throw and
//    must coerce to arrays.
sawMalformed = false;
assert.doesNotThrow(function () {
  buildStore({
    meta: { branch: "x" },
    reviewState: { version: 1, branch: "x", findings: {
      "bugs|f.ts|x": { state: "not-a-state", thread: "oops-a-string", history: "also-string", lastFinding: "nope" }
    } },
    findings: [{ id: "b", fingerprint: "bugs|f.ts|x", severity: "low", section: "bugs", title: "X", file: "f.ts", line: 1 }]
  });
}, "malformed envelope must not throw");
assert(Array.isArray(STORE["bugs|f.ts|x"].thread), "string thread coerced to array");
assert(Array.isArray(STORE["bugs|f.ts|x"].history), "string history coerced to array");
assert.strictEqual(STORE["bugs|f.ts|x"].state, "open", "bogus state falls back to open");
assert.strictEqual(STORE["bugs|f.ts|x"].lastFinding, null, "bad lastFinding coerced to null");
assert(sawMalformed, "malformed data flagged");
assert.deepStrictEqual(threadMapProbe({ fingerprint: "bugs|f.ts|x" }), [], "thread.map is safe");
console.log("Scenario 1 (malformed envelope coerced, no throw) ✓");

// 2) Malformed thread turns are dropped; valid ones kept.
sawMalformed = false;
buildStore({
  meta: { branch: "x" },
  reviewState: { version: 1, branch: "x", findings: {
    "bugs|f.ts|y": { state: "open", thread: [
      { author: "user", text: "good", ts: "2026-07-19T00:00:00Z" },
      { author: "nobody", text: "bad author", ts: "t" },
      { author: "user", text: 42, ts: "t" },
      "totally-bogus"
    ], history: [] }
  } },
  findings: [{ id: "b", fingerprint: "bugs|f.ts|y", severity: "low", section: "bugs", title: "Y", file: "f.ts", line: 1 }]
});
assert.strictEqual(STORE["bugs|f.ts|y"].thread.length, 1, "only the valid turn survives");
assert.strictEqual(STORE["bugs|f.ts|y"].thread[0].text, "good", "valid turn kept");
assert(sawMalformed, "dropped turns flagged");
console.log("Scenario 2 (invalid thread turns dropped) ✓");

// 3) A corrupt localStorage op-log (ops is a string) is ignored, not misread.
sawMalformed = false;
_ls.clear();
_ls.set("pr-review-state:x", JSON.stringify({ rev: "", ops: "not-an-array" }));
assert.doesNotThrow(function () {
  buildStore({ meta: { branch: "x" }, reviewState: { version: 1, branch: "x", findings: {} }, findings: [] });
}, "corrupt op-log must not throw");
assert(sawMalformed, "corrupt op-log flagged");
console.log("Scenario 3 (corrupt op-log ignored) ✓");

// 4) A legacy snapshot cache with a string thread is sanitized, not applied raw.
sawMalformed = false;
_ls.clear();
_ls.set("pr-review-state:x", JSON.stringify({ "bugs|f.ts|z": { state: "ignored", thread: "STRING", history: [] } }));
buildStore({ meta: { branch: "x" }, findings: [
  { id: "b", fingerprint: "bugs|f.ts|z", severity: "low", section: "bugs", title: "Z", file: "f.ts", line: 1 }
] });
assert(Array.isArray(STORE["bugs|f.ts|z"].thread), "legacy string thread coerced to array");
assert.doesNotThrow(function () { threadMapProbe({ fingerprint: "bugs|f.ts|z" }); }, "render-safe");
console.log("Scenario 4 (legacy snapshot sanitized) ✓");

assert(warns.some(function (w) { return /malformed/.test(w); }), "a warning was surfaced");
console.log("PASS: malformed state resilience (bug-4)");
