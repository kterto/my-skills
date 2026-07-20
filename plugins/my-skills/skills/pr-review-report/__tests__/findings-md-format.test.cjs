// Format-conformance fixture for FEAT-20260720T004258Z-0590: the Markdown findings
// backlog emitted by Step 6b must be consumable UNCHANGED by the validation-fixer
// skill. This test mirrors validation-fixer SKILL.md Step 1 parse and asserts the
// contract every `docs/reviews/<branch>-<date>.md` must satisfy:
//   - `## ` lines are section delimiters (informational, kept — never items),
//   - every `- [ ]` bullet is an ACTIONABLE work item (open / regressed finding),
//   - every `- [x]` bullet is SKIPPED (already-triaged audit row),
//   - indented continuation lines attach to their preceding bullet (fingerprint /
//     Rationale / Fix / ADR / `_state: reason_`), never parse as their own item.
// The fixture is the authoritative example of references/findings-md-schema.md.
// Run: node __tests__/findings-md-format.test.cjs   (exits non-zero on failure)
const fs = require("fs");
const path = require("path");
const assert = require("assert");

const md = fs.readFileSync(path.join(__dirname, "fixtures", "findings.md"), "utf8");
const lines = md.split("\n");

// --- Parser: a faithful port of validation-fixer SKILL.md Step 1 ---------------
// `##` heading -> section; top-level `-` bullet -> item; indented non-blank line ->
// continuation of the current item. `- [x]` is done/skip; `- [ ]`/`- [~]`/plain `-`
// is open. An italic `_fixed via`/`_attempted via` line is skill metadata, not an item.
const SECTION_RE = /^##\s+(.+)$/;
const BULLET_RE = /^-\s+(?:\[( |x|~)\]\s+)?(.*)$/; // group1 = mark (or undefined), group2 = text
const CONT_RE = /^\s+\S/; // indented, non-blank
const META_RE = /^\s*_(?:fixed|attempted) via\b/;

const sections = [];
const items = []; // { section, mark, text, cont: [] }
let curSection = null;
let curItem = null;

for (const raw of lines) {
  if (raw.trim() === "") continue;
  const sec = raw.match(SECTION_RE);
  if (sec) {
    curSection = sec[1].trim(); // a `## ` heading becomes the current section
    if (!sections.includes(curSection)) sections.push(curSection);
    curItem = null;
    continue;
  }
  if (/^#/.test(raw)) { // header block / `#`/`###` lines are not items
    curItem = null;
    continue;
  }
  const b = raw.match(BULLET_RE);
  if (b) {
    curItem = { section: curSection || sections[sections.length - 1] || null, mark: b[1] || " ", text: b[2], cont: [] };
    curSection = curItem.section;
    items.push(curItem);
    continue;
  }
  if (CONT_RE.test(raw)) {
    if (META_RE.test(raw)) continue; // skill metadata line, never an item
    assert(curItem, "continuation line with no preceding bullet: " + JSON.stringify(raw));
    curItem.cont.push(raw.trim());
    continue;
  }
  // any other flush-left prose (header block lines) resets the item context
  curItem = null;
}

// --- Assertions ----------------------------------------------------------------
const actionable = items.filter((i) => i.mark === " " || i.mark === "~");
const skipped = items.filter((i) => i.mark === "x");

// 1) The three lenses are present as `## ` section delimiters.
for (const lens of ["Architecture", "Security", "Bugs & Improvements"]) {
  assert(sections.some((s) => s === lens), "missing lens section: " + lens);
}
console.log("Scenario 1 (three lens sections detected) ✓");

// 2) Every actionable `- [ ]` bullet carries `[<ID>|<sev>]`, a title, and `(file:line)`.
// One severity vocabulary, used to build both regexes and the rank map below (§findings-md-schema.md).
const SEVS = "crit|high|med|low|info";
const SEV = new RegExp("\\|(" + SEVS + ")\\]");
const ROW = new RegExp("^\\[[^|\\]]+\\|(" + SEVS + ")\\]\\s+.+\\s+\\([^):]+:\\d+\\)\\s*$");
assert(actionable.length >= 1, "fixture must contain at least one actionable finding");
for (const it of actionable) {
  assert(ROW.test(it.text), "actionable row not in `[ID|sev] title (file:line)` shape: " + JSON.stringify(it.text));
}
console.log("Scenario 2 (actionable rows carry [ID|sev] title (file:line)) ✓");

// 3) Actionable findings appear severity-descending within each section.
const RANK = Object.fromEntries(SEVS.split("|").map((s, i) => [s, i])); // crit=0 … info=4
const bySection = {};
for (const it of actionable) {
  const sev = it.text.match(SEV)[1];
  (bySection[it.section] = bySection[it.section] || []).push(RANK[sev]);
}
for (const [sec, ranks] of Object.entries(bySection)) {
  for (let i = 1; i < ranks.length; i++) {
    assert(ranks[i] >= ranks[i - 1], "severity not descending in section " + sec);
  }
}
console.log("Scenario 3 (severity-descending order per section) ✓");

// 4) Actionable findings carry indented continuation lines (fingerprint + Rationale/Fix)
//    that attached to the bullet rather than parsing as their own items.
for (const it of actionable) {
  assert(it.cont.length >= 1, "actionable finding has no continuation lines: " + it.text);
  assert(it.cont.some((c) => /^fingerprint:/.test(c)), "actionable finding missing fingerprint continuation: " + it.text);
}
console.log("Scenario 4 (continuation lines attach to their bullet) ✓");

// 5) At least one Architecture actionable row carries an ADR continuation line.
const archActionable = actionable.filter((i) => i.section === "Architecture");
assert(archActionable.some((it) => it.cont.some((c) => /^ADR:/.test(c))),
  "expected an Architecture finding with an ADR continuation line");
console.log("Scenario 5 (Architecture ADR continuation present) ✓");

// 6) Every `- [x]` triaged row is skipped and carries exactly a `_<state>: <ref>_` note.
assert(skipped.length >= 1, "fixture must contain at least one triaged `- [x]` audit row");
for (const it of skipped) {
  assert(it.cont.some((c) => /^_[a-z]+:.*_$/.test(c)),
    "triaged row missing `_<state>: <reason>_` note: " + it.text);
}
console.log("Scenario 6 (triaged `- [x]` rows skipped with state note) ✓");

// 7) No continuation line leaked into the work list as its own item.
for (const it of items) {
  assert(!/^fingerprint:/.test(it.text), "a fingerprint line was parsed as a bullet: " + it.text);
  assert(!/^(Rationale|Fix|ADR):/.test(it.text), "a continuation label was parsed as a bullet: " + it.text);
}
console.log("Scenario 7 (no continuation line mis-parsed as an item) ✓");

// 8) Header block: the `# PR Review Findings —` title and a `Counts:` line that
//    tallies the five severities plus acknowledged (the header validation-fixer
//    keeps as flush-left prose, never as items).
assert(lines.some((l) => /^# PR Review Findings —/.test(l)),
  "missing `# PR Review Findings —` title line");
const countsLine = lines.find((l) => /^Counts:/.test(l));
assert(countsLine, "missing `Counts:` header line");
for (const label of ["crit", "high", "med", "low", "info", "acknowledged"]) {
  assert(new RegExp("\\b" + label + "\\b\\s+\\d+").test(countsLine),
    "Counts line missing `" + label + " <n>`: " + JSON.stringify(countsLine));
}
console.log("Scenario 8 (header title + Counts line present) ✓");

console.log("PASS: findings.md format conformance (validation-fixer parse contract)");
