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

// Canonical identity (arch-2). The catalog is either flat Sets (`entityIds`/`nodeIds` —
// membership only, back-compat) or OWNER MAPS (`entityOwner`/`nodeOwner`: id -> owning module
// id). `catalogView` unifies them. A `new:<module-id>:<name>` id is reserved for a module-local
// item; the module-id may itself contain colons, so ownership is matched by PREFIX.
function asSet(v) { return v instanceof Set ? v : new Set(v || []); }

// The module a `new:` id names, when it names one the unit OWNS; "*" for shape-only (no
// ownership context); null if malformed or naming a non-owned module.
function newIdModule(id, ownedModules) {
  if (typeof id !== "string" || !id.startsWith("new:")) return null;
  const rest = id.slice(4);
  if (!rest.includes(":")) return null;                    // must be new:<module>:<name>
  if (!ownedModules) return "*";                           // shape-only (no ownership context)
  for (const mod of ownedModules) {
    if (rest.startsWith(mod + ":") && rest.length > mod.length + 1) return mod;
  }
  return null;                                             // new: for a non-owned module
}

function catalogView(catalog, kind) {
  const raw = catalog && catalog[kind + "Owner"];
  const owner = raw ? (raw instanceof Map ? raw : new Map(Object.entries(raw))) : null;
  const members = owner ? new Set(owner.keys()) : asSet(catalog && catalog[kind + "Ids"]);
  return { members, ownerOf: (id) => (owner ? owner.get(id) : undefined), hasOwners: !!owner };
}

// A KNOWN reference: any catalog member (FOREIGN allowed — a cross-module relation/edge target)
// or a `new:` id bound to an owned module. Used for relation targets and edge `toId`.
function isKnownId(id, view, ownedModules) {
  if (typeof id !== "string" || id.length === 0) return false;
  if (id.startsWith("new:")) return newIdModule(id, ownedModules) !== null;
  return view.members.has(id);
}

// An OWNED declaration: a catalog member the UNIT OWNS (or a `new:` owned id). Used for the ids a
// unit DECLARES — `entity.id` and edge `fromId` — so a unit cannot declare another module's
// identity. Without owner maps or ownedModules it falls back to membership (back-compat).
function isOwnedId(id, view, ownedModules) {
  if (typeof id !== "string" || id.length === 0) return false;
  if (id.startsWith("new:")) return newIdModule(id, ownedModules) !== null;
  if (!view.members.has(id)) return false;
  if (!view.hasOwners || !ownedModules) return true;
  return ownedModules.has(view.ownerOf(id));
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
  // Identity catalog (arch-2): entities/nodes carry OWNERSHIP. A unit may only DECLARE ids it
  // owns (entity.id, edge.fromId); it may REFERENCE any known id (relation targets, edge.toId)
  // for legitimate cross-module links. The `module`/`moduleId` envelope handling is in bug-1.
  const catalog = ctx && ctx.catalog ? ctx.catalog : null;
  const entityView = catalog ? catalogView(catalog, "entity") : null;
  const nodeView = catalog ? catalogView(catalog, "node") : null;
  const ownedModules = catalog && catalog.moduleIds ? asSet(catalog.moduleIds) : null;
  // Envelope module identity (bug-1): the analyzed unit is identified by a CANONICAL `moduleId`
  // (e.g. `m:src/billing`), validated against the owned modules. The path-shaped `module` stays
  // display-only metadata — comparing a path to canonical catalog ids (the prior bug) is wrong.
  if (ownedModules) {
    if (!isStr(obj.moduleId)) {
      errs.push("missing required string: moduleId (canonical unit module id)");
    } else if (!ownedModules.has(obj.moduleId)) {
      errs.push(`moduleId ${obj.moduleId} is not an assigned unit module`);
    }
  }

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
          } else if (
            // The files[] self-anchor is always `<path>:1` (enforced below) and must hold even
            // for a ZERO-line file (bug-3) — so exempt it from the content line-bound check.
            key !== "files" &&
            Object.prototype.hasOwnProperty.call(lines, parsed.path) &&
            (parsed.line < 1 || parsed.line > lines[parsed.path])
          ) {
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
      // Canonical-identity catalog enforcement (arch-2), only when a catalog was provided. A unit
      // may DECLARE only ids it OWNS (entity.id, edge.fromId); it may REFERENCE any known id
      // (relation targets, edge.toId) so cross-module links remain expressible.
      if (catalog) {
        if (key === "entities") {
          if (typeof item.id === "string" && !isOwnedId(item.id, entityView, ownedModules)) {
            errs.push(`entities[${i}] id not in the identity catalog: ${item.id}`);
          }
          if (Array.isArray(item.relations)) {
            item.relations.forEach((r, j) => {
              if (!isKnownId(r, entityView, ownedModules)) errs.push(`entities[${i}].relations[${j}] target not in the identity catalog: ${r}`);
            });
          }
        } else if (key === "dataFlowEdges") {
          if (typeof item.fromId === "string" && !isOwnedId(item.fromId, nodeView, ownedModules)) {
            errs.push(`dataFlowEdges[${i}] fromId not in the flow-node catalog: ${item.fromId}`);
          }
          if (typeof item.toId === "string" && !isKnownId(item.toId, nodeView, ownedModules)) {
            errs.push(`dataFlowEdges[${i}] toId not in the flow-node catalog: ${item.toId}`);
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
