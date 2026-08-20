// Format-conformance fixture for FEAT-20260720T004258Z-0590: the Markdown findings
// backlog emitted by Step 6b must be consumable UNCHANGED by the validation-fixer
// skill. This test mirrors validation-fixer SKILL.md Step 1 parse and asserts the
// contract every `docs/reviews/<branch_slug>-<date>.md` must satisfy:
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

// 4) Every actionable finding carries the full context the downstream fixer needs:
//    exactly one `fingerprint:`, one `Rationale:`, and one `Fix:` continuation, plus
//    at most one `ADR:` and only on an Architecture row (§findings-md-schema.md
//    §Actionable rows). These attach to the bullet, never parse as their own items.
const countCont = (it, re) => it.cont.filter((c) => re.test(c)).length;
for (const it of actionable) {
  assert(countCont(it, /^fingerprint:/) === 1,
    "actionable finding must carry exactly one `fingerprint:` continuation: " + it.text);
  assert(countCont(it, /^Rationale:/) === 1,
    "actionable finding must carry exactly one `Rationale:` continuation: " + it.text);
  assert(countCont(it, /^Fix:/) === 1,
    "actionable finding must carry exactly one `Fix:` continuation: " + it.text);
  const adrs = countCont(it, /^ADR:/);
  assert(adrs <= 1, "actionable finding carries more than one `ADR:` continuation: " + it.text);
  if (adrs === 1) assert(it.section === "Architecture",
    "`ADR:` continuation is allowed only on an Architecture finding: " + it.text);
}
console.log("Scenario 4 (each actionable row: 1 fingerprint + 1 Rationale + 1 Fix; ADR only on Architecture) ✓");

// 5) At least one Architecture actionable row carries an ADR continuation line.
const archActionable = actionable.filter((i) => i.section === "Architecture");
assert(archActionable.some((it) => it.cont.some((c) => /^ADR:/.test(c))),
  "expected an Architecture finding with an ADR continuation line");
console.log("Scenario 5 (Architecture ADR continuation present) ✓");

// 6) Every `- [x]` triaged row is skipped, carries exactly a `_<state>: <ref>_` note
//    (state labels may be hyphenated, e.g. `prior-only` — see Scenario 9), AND carries
//    exactly one `fingerprint:` continuation — the merge keys uniformly on every row,
//    actionable or audit (arch-3: Step 6b / merge-key say fingerprint is on every row,
//    so the audit-row format, fixture, and this test must all supply it).
assert(skipped.length >= 1, "fixture must contain at least one triaged `- [x]` audit row");
for (const it of skipped) {
  assert(it.cont.some((c) => /^_[a-z][a-z-]*:.*_$/.test(c)),
    "triaged row missing `_<state>: <reason>_` note: " + it.text);
  assert(countCont(it, /^fingerprint:/) === 1,
    "triaged row must carry exactly one `fingerprint:` continuation (arch-3): " + it.text);
}
console.log("Scenario 6 (triaged `- [x]` rows skipped, with state note + fingerprint) ✓");

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

// 9) Prior-only retention (arch-2): an unmatched consumer-owned finding whose concern
//    left the diff is kept as a closed `- [x]` audit row that (a) is SKIPPED, not
//    actionable, (b) preserves the consumer's `_fixed via …_` / `_attempted via …_`
//    commit/attempt evidence verbatim, and (c) carries a `_prior-only: …_` note. This
//    proves the re-review does not silently discard consumer-owned history.
const priorOnly = skipped.filter((it) =>
  it.cont.some((c) => /^_prior-only:.*_$/.test(c)));
assert(priorOnly.length >= 1,
  "fixture must contain at least one prior-only `- [x]` retained audit row");
for (const it of priorOnly) {
  // The consumer's status line is `_fixed|attempted via …_` metadata — the parser
  // drops it from `cont` (META_RE), so assert it survives in the raw bullet block.
  const mdIdx = lines.findIndex((l) => l.includes(it.text));
  assert(mdIdx >= 0, "prior-only row not locatable in source: " + it.text);
  const block = lines.slice(mdIdx, mdIdx + 5).join("\n");
  assert(/_(?:fixed|attempted) via\b/.test(block),
    "prior-only row must carry the consumer `_fixed/attempted via …_` evidence: " + it.text);
  assert(it.cont.some((c) => /^fingerprint:/.test(c)),
    "prior-only row must keep its `fingerprint:` line for re-keying: " + it.text);
  assert(!actionable.includes(it), "prior-only row must be skipped, never actionable: " + it.text);
}
console.log("Scenario 9 (prior-only rows retain consumer evidence, stay skipped) ✓");

console.log("PASS: findings.md format conformance (validation-fixer parse contract)");
