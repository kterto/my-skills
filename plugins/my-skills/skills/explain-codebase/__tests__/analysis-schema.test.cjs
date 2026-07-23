// Schema-shape fixture for FEAT-20260723T141806Z-d784: the Phase-2 subagent JSON
// return that each fan-out subagent produces must conform to the normative schema in
// references/analysis-schema.md. This test encodes that schema as an executable
// validator and asserts:
//   (1) a conforming return validates,
//   (2) the five required arrays (entities, businessRules, dataFlowEdges,
//       dependencies, useCases) are present and typed,
//   (3) EVERY item in EVERY array carries a required `file:line` `anchor`,
//   (4) references/analysis-schema.md exists and documents each key + the anchor rule
//       (so the schema doc is the single source of truth this validator mirrors).
// Run: node --test   (or: node __tests__/analysis-schema.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SCHEMA_MD = path.join(__dirname, "..", "references", "analysis-schema.md");

// The five arrays every subagent return must carry (§analysis-schema.md).
const REQUIRED_ARRAYS = ["entities", "businessRules", "dataFlowEdges", "dependencies", "useCases"];
// A `file:line` anchor: any non-empty path, a colon, then a 1+ digit line number.
const ANCHOR_RE = /^.+:\d+$/;

// --- The executable validator: a faithful port of references/analysis-schema.md -----
// Returns [] when valid, else an array of human-readable violation strings.
function validateSubagentReturn(obj) {
  const errs = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return ["return must be a JSON object"];
  }
  for (const key of REQUIRED_ARRAYS) {
    if (!(key in obj)) { errs.push(`missing required array: ${key}`); continue; }
    if (!Array.isArray(obj[key])) { errs.push(`${key} must be an array`); continue; }
    obj[key].forEach((item, i) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        errs.push(`${key}[${i}] must be an object`);
        return;
      }
      if (typeof item.anchor !== "string" || !ANCHOR_RE.test(item.anchor)) {
        errs.push(`${key}[${i}] missing required file:line anchor`);
      }
    });
  }
  return errs;
}

function validReturn() {
  return {
    module: "src/billing",
    entities: [
      { name: "Invoice", fields: ["id", "total"], invariants: ["total >= 0"], anchor: "src/billing/invoice.ts:12" },
    ],
    businessRules: [
      { name: "No negative charge", what: "reject charge < 0", why: "billing integrity", domain: "billing", anchor: "src/billing/charge.ts:40" },
    ],
    dataFlowEdges: [
      { from: "http:POST /charge", to: "ChargeService", kind: "ingress", anchor: "src/billing/routes.ts:8" },
    ],
    dependencies: [
      { name: "stripe", kind: "external", anchor: "src/billing/charge.ts:1" },
    ],
    useCases: [
      { actor: "Customer", goal: "pay invoice", trigger: "clicks Pay", steps: ["POST /charge", "persist"], dataTouched: ["Invoice"], anchor: "src/billing/routes.ts:8" },
    ],
  };
}

test("a conforming subagent return validates", () => {
  assert.deepStrictEqual(validateSubagentReturn(validReturn()), []);
});

test("all five required arrays are enforced", () => {
  for (const key of REQUIRED_ARRAYS) {
    const bad = validReturn();
    delete bad[key];
    const errs = validateSubagentReturn(bad);
    assert.ok(errs.some((e) => e.includes(`missing required array: ${key}`)), `${key} must be required`);
  }
});

test("a non-array required key is rejected", () => {
  const bad = validReturn();
  bad.entities = { name: "x" };
  const errs = validateSubagentReturn(bad);
  assert.ok(errs.some((e) => e.includes("entities must be an array")));
});

test("every item must carry a file:line anchor", () => {
  for (const key of REQUIRED_ARRAYS) {
    const bad = validReturn();
    delete bad[key][0].anchor; // drop the anchor on the first item
    const errs = validateSubagentReturn(bad);
    assert.ok(errs.some((e) => e.includes(`${key}[0] missing required file:line anchor`)), `${key} item must require an anchor`);
  }
});

test("an anchor without a line number is rejected", () => {
  const bad = validReturn();
  bad.entities[0].anchor = "src/billing/invoice.ts"; // no :line
  const errs = validateSubagentReturn(bad);
  assert.ok(errs.some((e) => e.includes("entities[0] missing required file:line anchor")));
});

test("references/analysis-schema.md exists and is the source of truth", () => {
  assert.ok(fs.existsSync(SCHEMA_MD), "references/analysis-schema.md must exist");
  const md = fs.readFileSync(SCHEMA_MD, "utf8");
  for (const key of REQUIRED_ARRAYS) {
    assert.ok(md.includes(key), `analysis-schema.md must document the \`${key}\` array`);
  }
  // The universal anchor rule must be documented (both the field name and the file:line form).
  assert.ok(/anchor/i.test(md), "analysis-schema.md must document the `anchor` field");
  assert.ok(/file:line/i.test(md), "analysis-schema.md must document the `file:line` anchor form");
});
