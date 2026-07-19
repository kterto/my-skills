// Regression fixture for bug-2: a retained orphan (prior-only finding whose code
// left the diff) must render in the report. The skill materializes it into
// REVIEW_DATA.findings with orphan:true; the template must (a) route it to a group
// and (b) render its location WITHOUT a dead diff-jump. See review-data-schema.md
// §Orphan (prior-only) findings.
// Run: node __tests__/orphan-render.test.cjs   (exits non-zero on failure)
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

// Globals + constants the render helpers close over.
let STORE = {}, STATE_READONLY = false, DRAFTS = {};
const SECTION_LABELS = { architecture: "Architecture", security: "Security", bugs: "Bugs" };
const STATE_LABELS = { open: "Open", fixed: "Fixed", ignored: "Ignored", acknowledged: "Acknowledge", resolved: "Resolved", regressed: "Regressed" };
const USER_STATES = ["open", "fixed", "ignored", "acknowledged"];
function esc(s){return String(s==null?"":s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}
function linkify(s){return esc(s);}
function fileSlug(p){return String(p).replace(/[\/.]/g,"-");}

for (const n of ["effState","effThread","isAck","groupOf","isCounted","stateControl","threadBlock","commentBox","findingCard"]) {
  eval(extractFn(html, n));
}

// A resolved orphan materialized from lastFinding (no files[] diff line).
const orphan = {
  id: "sec-9", fingerprint: "security|gone.ts|leak", severity: "high", section: "security",
  title: "Leak in removed helper", file: "gone.ts", line: 12, state: "resolved",
  rationale: "was here", orphan: true,
  thread: [{ author: "user", text: "removed the helper", ts: "2026-07-18T00:00:00Z" }]
};

// (a) routes to the Resolved group and stays out of the counts.
assert.strictEqual(groupOf(orphan), "resolved", "resolved orphan routes to Resolved group");
assert.strictEqual(isCounted(orphan), false, "orphan excluded from severity counts");

// (b) renders with a marker and NO dead diff-jump.
const cardHtml = findingCard(orphan);
assert(/no longer in the current diff/.test(cardHtml), "orphan location shows the marker");
assert(!/class="loc-link"/.test(cardHtml), "orphan location is not a dead diff anchor link");
assert(!/data-diffline=/.test(cardHtml), "orphan card carries no finding->diff jump");
assert(/Leak in removed helper/.test(cardHtml), "orphan title rendered");
assert(/removed the helper/.test(cardHtml), "orphan thread rendered");

// A normal (non-orphan) finding still gets its diff-jump link — guard against regression.
const normal = { id: "b1", fingerprint: "bugs|f.ts|x", severity: "low", section: "bugs",
  title: "X", file: "f.ts", line: 3, state: "open", rationale: "" };
const normalHtml = findingCard(normal);
assert(/class="loc-link"/.test(normalHtml), "normal finding keeps its diff-jump link");
assert(/data-diffline=/.test(normalHtml), "normal finding keeps its finding->diff jump");

console.log("PASS: orphan render (bug-2) — materialized orphan routes + renders without a dead diff-jump");
