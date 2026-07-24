// Placeholder-fill contract for FEAT-20260723T141806Z-d784. The skill fills
// references/report-template.html DETERMINISTICALLY: it substitutes a fixed set of
// {{SCALAR}} placeholders and expands <!-- REPEAT:block --> ... <!-- /REPEAT:block -->
// regions. This test asserts:
//   (1) every token the fill logic references (the CONTRACT below) is DEFINED in the
//       template — a placeholder the skill fills but the template lacks would silently
//       drop data;
//   (2) the template defines NO stray token outside the contract — a template token the
//       fill logic never sets would ship a literal `{{...}}` to users;
//   (3) every REPEAT block is balanced (open + close) and holds its inner fields;
//   (4) all 7 report regions exist in BOTH template and demo (region parity);
//   (5) the demo is a FULLY-EXPANDED render — no leftover placeholders or REPEAT markers.
// The `.sh` sibling (self-contained.test.sh) asserts CSP-safety + the fill-state split.
// Run: node --test   (or: node __tests__/placeholder-fill.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REF = path.join(__dirname, "..", "references");
const TEMPLATE = path.join(REF, "report-template.html");
const DEMO = path.join(REF, "report-template.demo.html");

// --- The fill contract the skill relies on (single source of truth for the test) ----
const SCALARS = [
  "SCOPE_LABEL", "SYSTEM_PURPOSE", "COMMIT_SHA", "GENERATED_DATE",
  "MODULE_COUNT", "ENTITY_COUNT", "RULE_COUNT", "USECASE_COUNT", "SUBAGENT_COUNT",
  "ANALYSIS_COMPLETE",
  "DATA_MODEL_MERMAID", "BUSINESS_LOGIC_MERMAID", "DATA_FLOW_MERMAID",
];
// Provenance taxonomy (see references/analysis-schema.md §Provenance taxonomy):
//   claim-bearing rows carry an `anchor` (entity, rule, flowEdge, useCase, dependency,
//   stackBadge → its detecting manifest, glossaryTerm → its defining source);
//   `fileIndex.path` is self-anchoring (it IS the file); `metric` bars and the scalar
//   counts are derived, non-claim aggregates over already-anchored items and carry none.
const BLOCKS = {
  stackBadge: ["label", "anchor"],
  entity: ["name", "fields", "invariants", "anchor"],
  rule: ["name", "what", "why", "domain", "anchor"],
  flowEdge: ["from", "to", "kind", "anchor", "crossModule"],
  useCase: ["actor", "goal", "trigger", "steps", "dataTouched", "anchor", "mermaid"],
  dependency: ["name", "kind", "anchor"],
  metric: ["label", "value", "max"],
  glossaryTerm: ["term", "definition", "anchor"],
  fileIndex: ["path", "role"],
  // Partial-analysis disclosure (arch-2): one row per fan-out unit, so a partial run is
  // structurally distinguishable from a complete one.
  analysisUnit: ["name", "modules", "files", "grouped", "status", "skipped"],
};
const REGIONS = [
  "region-overview", "region-data-model", "region-business-logic",
  "region-data-flow", "region-user-stories", "region-metrics", "region-appendix",
];

const TOKEN_RE = /\{\{\s*([A-Za-z0-9_.]+)\s*\}\}/g;
const OPEN_RE = /<!--\s*REPEAT:([A-Za-z0-9_]+)\s*-->/g;
const CLOSE_RE = /<!--\s*\/REPEAT:([A-Za-z0-9_]+)\s*-->/g;

function allMatches(src, re) {
  const out = [];
  let m;
  re.lastIndex = 0;
  while ((m = re.exec(src)) !== null) out.push(m[1]);
  return out;
}

// The full set of legal tokens the contract defines.
const CONTRACT_TOKENS = new Set([
  ...SCALARS,
  ...Object.entries(BLOCKS).flatMap(([b, fs2]) => fs2.map((f) => `${b}.${f}`)),
]);

assert.ok(fs.existsSync(TEMPLATE), "references/report-template.html must exist");
assert.ok(fs.existsSync(DEMO), "references/report-template.demo.html must exist");
const tpl = fs.readFileSync(TEMPLATE, "utf8");
// The shipped demo carries the `<!-- MERMAID_RUNTIME -->` marker (like the template) and
// does NOT inline the runtime — that lives only in references/vendor, and the fully-inlined
// demo is a generated, non-shipped artifact (bug-6). This strip is kept as a no-op guard so
// that IF an inlined runtime is ever present (its minified JS contains `{{...}}`-shaped
// substrings), it is not mistaken for an unfilled placeholder.
const RUNTIME_RE = /<script id="mermaid-runtime">[\s\S]*?<\/script>/i;
const demo = fs.readFileSync(DEMO, "utf8").replace(RUNTIME_RE, "");

// `tpl` is constant, so its token set is derivable once and reused by every test.
const TPL_TOKENS = new Set(allMatches(tpl, TOKEN_RE));

test("every contract scalar placeholder is defined in the template", () => {
  for (const s of SCALARS) {
    assert.ok(TPL_TOKENS.has(s), `template missing scalar placeholder {{${s}}}`);
  }
});

test("every REPEAT block is balanced and carries its inner fields", () => {
  const opens = allMatches(tpl, OPEN_RE);
  const closes = allMatches(tpl, CLOSE_RE);
  for (const block of Object.keys(BLOCKS)) {
    assert.ok(opens.includes(block), `template missing <!-- REPEAT:${block} -->`);
    assert.strictEqual(
      opens.filter((b) => b === block).length,
      closes.filter((b) => b === block).length,
      `REPEAT:${block} open/close count mismatch`,
    );
    // Inner fields must appear as {{block.field}} tokens somewhere in the template.
    for (const field of BLOCKS[block]) {
      assert.ok(TPL_TOKENS.has(`${block}.${field}`), `template missing {{${block}.${field}}}`);
    }
  }
});

test("template defines no stray token outside the contract", () => {
  const stray = [...TPL_TOKENS].filter((t) => !CONTRACT_TOKENS.has(t));
  assert.deepStrictEqual(stray, [], `template has tokens not in the fill contract: ${stray.join(", ")}`);
});

test("all 7 report regions exist in the template", () => {
  for (const id of REGIONS) {
    assert.ok(tpl.includes(`id="${id}"`), `template missing region id="${id}"`);
  }
});

test("template <-> demo region parity: demo has the same 7 regions", () => {
  for (const id of REGIONS) {
    assert.ok(demo.includes(`id="${id}"`), `demo missing region id="${id}"`);
  }
});

test("demo is fully expanded — no leftover placeholders or REPEAT markers", () => {
  assert.deepStrictEqual(allMatches(demo, TOKEN_RE), [], "demo still has {{...}} placeholders");
  assert.deepStrictEqual(allMatches(demo, OPEN_RE), [], "demo still has <!-- REPEAT:... --> markers");
  assert.deepStrictEqual(allMatches(demo, CLOSE_RE), [], "demo still has <!-- /REPEAT:... --> markers");
});

test("demo renders file:line anchors (universal-anchor rule holds in sample data)", () => {
  assert.ok(/[\w./-]+:\d+/.test(demo), "demo must contain at least one file:line source anchor");
});

test("business-rule cards are grouped by domain (bug-7)", () => {
  for (const [name, src] of [["template", tpl], ["demo", demo]]) {
    assert.ok(/id="rule-cards"/.test(src), `${name} must give the rule container an id for grouping`);
    assert.ok(/function groupRulesByDomain\s*\(/.test(src), `${name} must define groupRulesByDomain()`);
    assert.ok(/groupRulesByDomain\(\);/.test(src), `${name} must call groupRulesByDomain() on init`);
    assert.ok(/class="domain-head"/.test(src) || /"domain-head"/.test(src), `${name} must build domain headings`);
  }
  // Rule cards carry the data-domain used to group them (was previously unused).
  assert.ok(/class="card rule" data-domain=/.test(tpl), "template rule card must carry data-domain");
  assert.ok(/class="card rule" data-domain="[^"]+"/.test(demo), "demo rule cards must carry a data-domain value");
});

test("domain grouping is prototype-key safe (bug-5)", () => {
  // Both files must build the domain map with a null prototype (or Map), never a bare {}.
  for (const [name, src] of [["template", tpl], ["demo", demo]]) {
    assert.ok(/byDomain\s*=\s*Object\.create\(null\)/.test(src), `${name} must use Object.create(null) for the domain map`);
    assert.ok(!/byDomain\s*=\s*\{\}/.test(src), `${name} must not use a bare object literal for the domain map`);
  }
  // Fixture: the grouping keying pattern is safe under prototype-name domains only with a
  // null-proto map. A bare object's inherited "constructor" makes `if (!m[d])` false → no array
  // → the subsequent .push throws; a null-proto object behaves correctly.
  const group = (make) => {
    const m = make();
    for (const d of ["billing", "constructor", "__proto__", "toString"]) {
      if (!m[d]) m[d] = [];
      m[d].push(d);
    }
    return m;
  };
  assert.throws(() => group(() => ({})), "bare object must break on a prototype-key domain");
  const safe = group(() => Object.create(null));
  assert.deepStrictEqual(safe.constructor, ["constructor"]);
  assert.deepStrictEqual(safe.toString, ["toString"]);
});

test("demo values conform to the analysis contract (bug-6)", () => {
  // Dependency kinds must be the documented enum (internal|external) — never runtime/dev.
  const depTags = [...demo.matchAll(/<article class="card dep">[\s\S]*?<span class="tag">([^<]+)<\/span>/g)].map((m) => m[1].trim());
  assert.ok(depTags.length > 0, "demo must have dependency rows to check");
  for (const k of depTags) {
    assert.ok(["internal", "external"].includes(k), `dependency kind "${k}" is not in the enum internal|external`);
  }
  // The skill NEVER runs tests, so the demo must not claim passing test suites (a value the
  // static analysis contract cannot produce).
  assert.ok(!/test suites? (?:passing|pass)/i.test(demo), "demo must not claim passing test suites");
});

test("cross-module edges get a highlight hook and distinct styling (bug-4)", () => {
  // Template: the flowEdge row carries the crossModule fill token + data attribute, and the
  // CSS distinctly styles a cross-module edge (keyed on data-cross-module="yes").
  assert.ok(tpl.includes('data-cross-module="{{flowEdge.crossModule}}"'), "flowEdge row must carry data-cross-module");
  assert.match(tpl, /\.edge\[data-cross-module="yes"\]/, "template must style cross-module edges distinctly");
  // Demo shows BOTH a cross-module edge (yes + chip) and ordinary local edges.
  assert.ok(demo.includes('data-cross-module="yes"'), "demo must include a cross-module edge");
  assert.match(demo, /data-kind="ingress"(?![^>]*data-cross-module="yes")/, "demo must include an ordinary (local) edge too");
});
