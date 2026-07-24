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

// Import the SAME validator the skill runs at runtime (references/validate-subagent-return.cjs)
// — the single mirror of analysis-schema.md, so doc, runtime, and test can never drift.
const { validateSubagentReturn, REQUIRED_ARRAYS } = require("../references/validate-subagent-return.cjs");

function validReturn() {
  return {
    module: "src/billing",
    files: [
      { path: "src/billing/invoice.ts", role: "Invoice entity + finalize transition", loc: 120, anchor: "src/billing/invoice.ts:1" },
    ],
    entities: [
      { id: "e:Invoice", name: "Invoice", fields: ["id", "total"], invariants: ["total >= 0"], relations: ["e:Customer"], anchor: "src/billing/invoice.ts:12" },
    ],
    businessRules: [
      { name: "No negative charge", what: "reject charge < 0", why: "billing integrity", domain: "billing", anchor: "src/billing/charge.ts:40" },
    ],
    dataFlowEdges: [
      { from: "http:POST /charge", to: "ChargeService", fromId: "f:http:POST /charge", toId: "f:m:src/billing:ChargeService", kind: "ingress", anchor: "src/billing/routes.ts:8" },
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

test("all required arrays are enforced", () => {
  assert.ok(REQUIRED_ARRAYS.includes("files"), "files[] must be a required array");
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

test("the envelope `module` string is required", () => {
  const bad = validReturn();
  delete bad.module;
  assert.ok(validateSubagentReturn(bad).some((e) => e.includes("missing required string: module")));
});

test("required per-item fields are enforced (not just anchors)", () => {
  const cases = [
    ["files", "path"],
    ["files", "role"],
    ["entities", "name"],
    ["entities", "id"],
    ["businessRules", "what"],
    ["dataFlowEdges", "from"],
    ["dataFlowEdges", "to"],
    ["dataFlowEdges", "fromId"],
    ["dataFlowEdges", "toId"],
    ["dependencies", "name"],
    ["useCases", "actor"],
    ["useCases", "goal"],
  ];
  for (const [key, field] of cases) {
    const bad = validReturn();
    delete bad[key][0][field];
    const errs = validateSubagentReturn(bad);
    assert.ok(
      errs.some((e) => e.includes(`${key}[0] missing/invalid required field: ${field}`)),
      `${key}.${field} must be required`,
    );
  }
});

test("optional field type violations are caught", () => {
  const badFields = validReturn();
  badFields.entities[0].fields = "id,total"; // must be string[]
  assert.ok(validateSubagentReturn(badFields).some((e) => e.includes("entities[0] optional field has wrong type: fields")));

  const badSteps = validReturn();
  badSteps.useCases[0].steps = [1, 2]; // must be string[]
  assert.ok(validateSubagentReturn(badSteps).some((e) => e.includes("useCases[0] optional field has wrong type: steps")));
});

test("documented enums are enforced", () => {
  const badFlow = validReturn();
  badFlow.dataFlowEdges[0].kind = "sideways"; // not ingress/transform/store/egress
  assert.ok(validateSubagentReturn(badFlow).some((e) => e.includes("dataFlowEdges[0] optional field has wrong type: kind")));

  const badDep = validReturn();
  badDep.dependencies[0].kind = "vendored"; // not internal/external
  assert.ok(validateSubagentReturn(badDep).some((e) => e.includes("dependencies[0] optional field has wrong type: kind")));
});

test("valid canonical ids + enums still validate", () => {
  const good = validReturn();
  good.entities[0].id = "e:Invoice";               // canonical catalog id (arch-3)
  good.dataFlowEdges[0].kind = "ingress";
  good.dataFlowEdges[0].fromId = "f:m:src/billing:route";
  good.dependencies[0].kind = "external";
  assert.deepStrictEqual(validateSubagentReturn(good), []);
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
