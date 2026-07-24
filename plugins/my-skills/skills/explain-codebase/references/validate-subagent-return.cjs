"use strict";
// Executable validator — the single RUNTIME mirror of references/analysis-schema.md.
// SKILL.md Phase 2 runs this on every fan-out subagent return (retry once on invalid,
// per the fan-out retry policy); __tests__/analysis-schema.test.cjs imports the SAME
// function, so the schema doc, the runtime check, and the tests can never drift.
//
// validateSubagentReturn(obj) -> [] when valid, else an array of human-readable
// violation strings. A "faithful" validator: it checks the envelope, every REQUIRED
// field, every OPTIONAL field's TYPE, and the documented ENUMS — not just array presence
// and anchors (which was the shallow gap this module closes).
//
// CLI: `node validate-subagent-return.cjs <file.json>` (or JSON on stdin) — prints each
// violation and exits non-zero when invalid, zero when valid. The skill uses the CLI to
// gate a subagent return before synthesis.

const fs = require("node:fs");

const REQUIRED_ARRAYS = ["entities", "businessRules", "dataFlowEdges", "dependencies", "useCases"];
// A `file:line` anchor: any non-empty path, a colon, then a 1+ digit line number.
const ANCHOR_RE = /^.+:\d+$/;
const FLOW_KINDS = ["ingress", "transform", "store", "egress"];
const DEP_KINDS = ["internal", "external"];

const isStr = (v) => typeof v === "string" && v.length > 0;
const isOptStr = (v) => v === undefined || typeof v === "string";
const isOptStrArr = (v) => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === "string"));
const isOptEnum = (allowed) => (v) => v === undefined || (typeof v === "string" && allowed.includes(v));

// Per-array item contract, mirroring the tables in analysis-schema.md. `required` fields
// must be non-empty strings (except `anchor`, checked separately for the file:line form);
// `optional` fields, when present, must match their type/enum.
const ITEM_SPECS = {
  entities: {
    required: { name: isStr },
    optional: { id: isOptStr, fields: isOptStrArr, invariants: isOptStrArr, relations: isOptStrArr },
  },
  businessRules: {
    required: { name: isStr, what: isStr },
    optional: { why: isOptStr, domain: isOptStr },
  },
  dataFlowEdges: {
    required: { from: isStr, to: isStr },
    optional: { fromId: isOptStr, toId: isOptStr, kind: isOptEnum(FLOW_KINDS) },
  },
  dependencies: {
    required: { name: isStr },
    optional: { kind: isOptEnum(DEP_KINDS) },
  },
  useCases: {
    required: { actor: isStr, goal: isStr },
    optional: { trigger: isOptStr, steps: isOptStrArr, dataTouched: isOptStrArr },
  },
};

function validateSubagentReturn(obj) {
  const errs = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return ["return must be a JSON object"];
  }
  // Envelope: `module` identifies the analyzed slice and is required.
  if (!isStr(obj.module)) errs.push("missing required string: module");

  for (const key of REQUIRED_ARRAYS) {
    if (!(key in obj)) { errs.push(`missing required array: ${key}`); continue; }
    if (!Array.isArray(obj[key])) { errs.push(`${key} must be an array`); continue; }
    const spec = ITEM_SPECS[key];
    obj[key].forEach((item, i) => {
      if (item === null || typeof item !== "object" || Array.isArray(item)) {
        errs.push(`${key}[${i}] must be an object`);
        return;
      }
      // The universal anchor rule (message text preserved for existing callers/tests).
      if (typeof item.anchor !== "string" || !ANCHOR_RE.test(item.anchor)) {
        errs.push(`${key}[${i}] missing required file:line anchor`);
      }
      for (const [field, check] of Object.entries(spec.required)) {
        if (!check(item[field])) errs.push(`${key}[${i}] missing/invalid required field: ${field}`);
      }
      for (const [field, check] of Object.entries(spec.optional)) {
        if (!check(item[field])) errs.push(`${key}[${i}] optional field has wrong type: ${field}`);
      }
    });
  }
  return errs;
}

module.exports = { validateSubagentReturn, REQUIRED_ARRAYS, ANCHOR_RE, FLOW_KINDS, DEP_KINDS };

// --- CLI ------------------------------------------------------------------------------
if (require.main === module) {
  const file = process.argv[2];
  let raw;
  try {
    raw = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");
  } catch (e) {
    console.error(`cannot read input: ${e.message}`);
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    console.error(`invalid JSON: ${e.message}`);
    process.exit(2);
  }
  const errs = validateSubagentReturn(parsed);
  if (errs.length) {
    for (const e of errs) console.error(e);
    process.exit(1);
  }
  console.log("valid subagent return");
}
