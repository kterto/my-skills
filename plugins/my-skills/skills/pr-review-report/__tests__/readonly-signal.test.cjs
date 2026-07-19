// Regression fixture for bug-1: a future/unknown state version must render read-only
// and must NOT be downgraded to version 1 on save — even when the skill could not
// embed a reviewState envelope. The read-only signal is carried explicitly in
// meta.stateReadOnly / meta.stateVersion (see review-data-schema.md §Read-only signal).
// Run: node __tests__/readonly-signal.test.cjs   (exits non-zero on failure)
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

let STORE = {}, STATE_VERSION = 1, STATE_READONLY = false;
const KNOWN_STATE_VERSION = 1;
let EMITTED_REV = "", OP_LOG = [], LS_KEY = null, DATA = null;
const window = { localStorage: { getItem: () => null, setItem: () => {} } };
function overlayLocalStorage() {} // not under test here

eval(extractFn(html, "buildStore"));
eval(extractFn(html, "buildSaveObject"));

// 1) Explicit meta read-only signal with NO reviewState (skill could not parse a
//    future file) -> read-only, version preserved, save does NOT downgrade to 1.
buildStore({ meta: { branch: "x", stateVersion: 2, stateReadOnly: true }, findings: [] });
assert.strictEqual(STATE_READONLY, true, "meta.stateReadOnly forces read-only without reviewState");
assert.strictEqual(STATE_VERSION, 2, "meta.stateVersion preserved");
assert.strictEqual(buildSaveObject().version, 2, "save writes preserved version, not downgraded to 1");
console.log("Scenario 1 (explicit meta signal, no envelope) ✓");

// 2) reviewState.version fallback still raises read-only even if meta omitted.
buildStore({ meta: { branch: "x" }, reviewState: { version: 3, branch: "x", findings: {} }, findings: [] });
assert.strictEqual(STATE_READONLY, true, "reviewState.version fallback raises read-only");
assert.strictEqual(STATE_VERSION, 3, "envelope version wins");
assert.strictEqual(buildSaveObject().version, 3, "save preserves envelope version");
console.log("Scenario 2 (reviewState.version fallback) ✓");

// 3) meta.stateReadOnly must never be cleared by a current-version envelope.
buildStore({ meta: { branch: "x", stateReadOnly: true }, reviewState: { version: 1, branch: "x", findings: {} }, findings: [] });
assert.strictEqual(STATE_READONLY, true, "current-version envelope cannot clear an explicit read-only flag");
console.log("Scenario 3 (read-only never cleared) ✓");

// 4) Normal current-version run is writable at version 1.
buildStore({ meta: { branch: "x" }, reviewState: { version: 1, branch: "x", findings: {} }, findings: [] });
assert.strictEqual(STATE_READONLY, false, "current version is writable");
assert.strictEqual(buildSaveObject().version, 1, "normal save writes version 1");
console.log("Scenario 4 (normal run writable) ✓");

console.log("PASS: read-only signal (bug-1)");
