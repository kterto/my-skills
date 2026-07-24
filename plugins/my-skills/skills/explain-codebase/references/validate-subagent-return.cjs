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

const REQUIRED_ARRAYS = ["files", "entities", "businessRules", "dataFlowEdges", "dependencies", "useCases"];
// A `file:line` anchor: any non-empty path, a colon, then a 1+ digit line number.
const ANCHOR_RE = /^.+:\d+$/;
const FLOW_KINDS = ["ingress", "transform", "store", "egress"];
const DEP_KINDS = ["internal", "external"];

const isStr = (v) => typeof v === "string" && v.length > 0;
const isOptStr = (v) => v === undefined || typeof v === "string";
const isOptStrArr = (v) => v === undefined || (Array.isArray(v) && v.every((x) => typeof x === "string"));
const isOptEnum = (allowed) => (v) => v === undefined || (typeof v === "string" && allowed.includes(v));
const isOptNonNegNum = (v) => v === undefined || (typeof v === "number" && Number.isFinite(v) && v >= 0);

// Canonical identity (arch-2): a catalog id, or the reserved `new:<module-id>:<name>` form for
// a genuinely module-local item Phase 3 reconciles. Membership is enforced only when the caller
// passes a catalog (ctx.catalog); without one the validator does format-only checks (back-compat).
const NEW_ID_RE = /^new:[^:]+:.+$/;
function asSet(v) { return v instanceof Set ? v : new Set(v || []); }
function isCatalogId(id, allowedSet) {
  return typeof id === "string" && id.length > 0 && (NEW_ID_RE.test(id) || allowedSet.has(id));
}

// Per-array item contract, mirroring the tables in analysis-schema.md. `required` fields
// must be non-empty strings (except `anchor`, checked separately for the file:line form);
// `optional` fields, when present, must match their type/enum.
const ITEM_SPECS = {
  files: {
    required: { path: isStr, role: isStr },
    optional: { loc: isOptNonNegNum },
  },
  entities: {
    // `id` is the canonical catalog identity (arch-3) — required, never guessed per subagent.
    required: { name: isStr, id: isStr },
    optional: { fields: isOptStrArr, invariants: isOptStrArr, relations: isOptStrArr },
  },
  businessRules: {
    required: { name: isStr, what: isStr },
    optional: { why: isOptStr, domain: isOptStr },
  },
  dataFlowEdges: {
    // fromId/toId are canonical flow-node ids (arch-3) — required for cross-module stitching.
    required: { from: isStr, to: isStr, fromId: isStr, toId: isStr },
    optional: { kind: isOptEnum(FLOW_KINDS) },
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

// Split a `path:line` anchor into its parts (last colon wins, so Windows-ish paths are safe).
function parseAnchor(anchor) {
  if (typeof anchor !== "string") return null;
  const m = anchor.match(/^(.+):(\d+)$/);
  if (!m) return null;
  return { path: m[1], line: Number(m[2]) };
}
const isUnsafePath = (p) => typeof p !== "string" || p.startsWith("/") || p.split("/").includes("..");

// Bind a `files[].path` to the assigned allowlist slice (sec-3). `ctx` is optional; when
// absent, only the absolute/parent-traversal shape check applies (back-compat). When present:
//   ctx.allow  — Set of repo-relative paths in this unit's slice (the reviewed allowlist)
// A path outside the allowlist, absolute, or parent-traversing is a prompt-injection / drift
// signal Phase 3 must NOT trust as provenance. (Anchor line-bounds are enforced separately, at
// the anchor call site via parseAnchor + ctx.lines — a file record carries no line to bound.)
function checkPathBinding(pathValue, ctx, label, errs) {
  if (isUnsafePath(pathValue)) { errs.push(`${label} path is absolute or parent-traversing: ${pathValue}`); return; }
  if (!ctx) return;
  const allow = ctx.allow instanceof Set ? ctx.allow : new Set(ctx.allow || []);
  if (!allow.has(pathValue)) errs.push(`${label} path not in the assigned allowlist: ${pathValue}`);
}

function validateSubagentReturn(obj, ctx) {
  const errs = [];
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) {
    return ["return must be a JSON object"];
  }
  // Envelope: `module` identifies the analyzed slice and is required.
  if (!isStr(obj.module)) errs.push("missing required string: module");
  const allow = ctx ? (ctx.allow instanceof Set ? ctx.allow : new Set(ctx.allow || [])) : null;
  const lines = ctx ? (ctx.lines instanceof Map ? Object.fromEntries(ctx.lines) : (ctx.lines || {})) : {};
  // Identity catalog (arch-2): when present, entity ids, relation targets, and flow-node ids
  // must resolve in the catalog (or be a reserved new: id) — not merely be nonempty strings.
  const catalog = ctx && ctx.catalog ? ctx.catalog : null;
  const entityIds = catalog ? asSet(catalog.entityIds) : null;
  const nodeIds = catalog ? asSet(catalog.nodeIds) : null;

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
      const parsed = parseAnchor(item.anchor);
      if (!parsed) {
        errs.push(`${key}[${i}] missing required file:line anchor`);
      } else {
        // Bind the anchor to the reviewed allowlist slice (sec-3).
        if (isUnsafePath(parsed.path)) {
          errs.push(`${key}[${i}] anchor path is absolute or parent-traversing: ${parsed.path}`);
        } else if (allow) {
          if (!allow.has(parsed.path)) {
            errs.push(`${key}[${i}] anchor path not in the assigned allowlist: ${parsed.path}`);
          } else if (Object.prototype.hasOwnProperty.call(lines, parsed.path) && (parsed.line < 1 || parsed.line > lines[parsed.path])) {
            errs.push(`${key}[${i}] anchor line ${parsed.line} out of range for ${parsed.path} (1..${lines[parsed.path]})`);
          }
        }
      }
      // files[].path is itself provenance — bind it too (sec-3).
      if (key === "files" && typeof item.path === "string") {
        checkPathBinding(item.path, ctx, `files[${i}]`, errs);
        // A file record's anchor MUST point at that same file (bug-3): otherwise a role can be
        // attributed to a *different* reviewed file. Enforce the documented `<path>:1` form.
        if (parsed) {
          if (parsed.path !== item.path) {
            errs.push(`files[${i}] anchor path ${parsed.path} must equal the record path ${item.path}`);
          } else if (parsed.line !== 1) {
            errs.push(`files[${i}] anchor must use the <path>:1 convention (got :${parsed.line})`);
          }
        }
      }
      for (const [field, check] of Object.entries(spec.required)) {
        if (!check(item[field])) errs.push(`${key}[${i}] missing/invalid required field: ${field}`);
      }
      for (const [field, check] of Object.entries(spec.optional)) {
        if (!check(item[field])) errs.push(`${key}[${i}] optional field has wrong type: ${field}`);
      }
      // Canonical-identity catalog enforcement (arch-2), only when a catalog was provided.
      if (catalog) {
        if (key === "entities") {
          if (typeof item.id === "string" && !isCatalogId(item.id, entityIds)) {
            errs.push(`entities[${i}] id not in the identity catalog: ${item.id}`);
          }
          if (Array.isArray(item.relations)) {
            item.relations.forEach((r, j) => {
              if (!isCatalogId(r, entityIds)) errs.push(`entities[${i}].relations[${j}] target not in the identity catalog: ${r}`);
            });
          }
        } else if (key === "dataFlowEdges") {
          for (const f of ["fromId", "toId"]) {
            if (typeof item[f] === "string" && !isCatalogId(item[f], nodeIds)) {
              errs.push(`dataFlowEdges[${i}] ${f} not in the flow-node catalog: ${item[f]}`);
            }
          }
        }
      }
    });
  }
  return errs;
}

module.exports = { validateSubagentReturn, parseAnchor, REQUIRED_ARRAYS, ANCHOR_RE, FLOW_KINDS, DEP_KINDS };

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
  // Optional allowlist manifest binds anchors/paths to the reviewed slice (sec-3):
  //   { "allow": ["repo/rel/path", ...], "lines": { "repo/rel/path": <lineCount> } }
  let ctx;
  const allowFile = process.argv[3];
  if (allowFile) {
    try {
      ctx = JSON.parse(fs.readFileSync(allowFile, "utf8"));
    } catch (e) {
      console.error(`cannot read allowlist manifest: ${e.message}`);
      process.exit(2);
    }
  }
  const errs = validateSubagentReturn(parsed, ctx);
  if (errs.length) {
    for (const e of errs) console.error(e);
    process.exit(1);
  }
  console.log("valid subagent return");
}
