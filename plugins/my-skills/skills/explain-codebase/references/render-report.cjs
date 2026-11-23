"use strict";
// The ONE executable rendering boundary (arch-3). Escaping, diagram drawing and template
// expansion were previously agent procedure, while tests exercised a *separate* test-only sanitizer — so the real render path
// could drift while every gate stayed green. This module owns all of it; SKILL.md Phase 4
// invokes it, and the tests import THESE functions, so a change to the boundary is a change to
// what the tests run.

const fs = require("node:fs");
const { buildDiagram, PLACEHOLDER } = require("./svg-diagram.cjs");

// --- HTML escaping (applied to every substituted value) -------------------------------
// Also neutralizes `{`/`}` (bug-2): a substituted value is source-derived and may contain a
// `{{TOKEN}}` sequence; without this the later scalar pass would REWRITE a known token inside the
// value, and an unknown `{{X}}` would survive and abort the render. Escaping braces to entities
// makes the value inert to token substitution while still displaying as `{`/`}` in the browser.
function htmlEscape(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\{/g, "&#123;")
    .replace(/\}/g, "&#125;");
}

// --- Deterministic template fill (REPEAT blocks + scalars) ----------------------------
// model = { scalars: { NAME: value, … }, blocks: { blockName: [ { field: value, … }, … ] } }
// Every substituted value is HTML-escaped. List fields must be pre-joined by the caller.
// `trusted` is never read from the model: renderModel passes the diagram markup it drew itself
// ({ scalars: Set of names, fields: { block: Set of fields } }), and only those go in unescaped.
const REPEAT_RE = (b) => new RegExp(`<!--\\s*REPEAT:${b}\\s*-->([\\s\\S]*?)<!--\\s*/REPEAT:${b}\\s*-->`, "g");
function fillTemplate(template, model, trusted = {}) {
  const rawScalars = trusted.scalars || new Set();
  const rawFields = trusted.fields || {};
  const scalars = (model && model.scalars) || {};
  const blocks = (model && model.blocks) || {};
  let out = template;
  // 1) Expand each REPEAT block once per row, resolving its inner {{block.field}} tokens.
  for (const [block, rows] of Object.entries(blocks)) {
    if (!/^[A-Za-z0-9_]+$/.test(block)) throw new Error(`block name ${JSON.stringify(block)} is not a template block`);
    if (rows != null && !Array.isArray(rows)) throw new Error(`block ${block} must be an array of rows`);
    out = out.replace(REPEAT_RE(block), (_m, inner) =>
      (rows || []).map((r) => (r && typeof r === "object" ? r : {})).map((row) =>
        inner.replace(new RegExp(`\\{\\{\\s*${block}\\.([A-Za-z0-9_]+)\\s*\\}\\}`, "g"),
          (_t, field) => {
            const v = row[field] === undefined ? "" : row[field];
            return rawFields[block] && rawFields[block].has(field) ? String(v) : htmlEscape(v);
          })
      ).join("")
    );
  }
  // 2) Replace scalar {{PLACEHOLDER}} tokens.
  out = out.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (t, name) =>
    !Object.prototype.hasOwnProperty.call(scalars, name) ? t
      : rawScalars.has(name) ? String(scalars[name]) : htmlEscape(scalars[name]));
  return out;
}

// --- Diagrams from STRUCTURED data (arch-3) --------------------------------------------
// The model carries graphs ({ kind, nodes, edges }), never markup. svg-diagram.cjs draws each
// one as static SVG with escaped text, so the report needs no diagram runtime. A model that
// supplies a diagram scalar or a useCase.diagram itself is refused: only the drawn markup is
// inserted unescaped.
const DIAGRAM_SCALARS = ["DATA_MODEL_DIAGRAM", "BUSINESS_LOGIC_DIAGRAM", "DATA_FLOW_DIAGRAM"];
const DIAGRAM_IDS = { DATA_MODEL_DIAGRAM: "dg-model", BUSINESS_LOGIC_DIAGRAM: "dg-logic", DATA_FLOW_DIAGRAM: "dg-flow" };

function renderModel(template, model) {
  const scalars = { ...((model && model.scalars) || {}) };
  const blocks = { ...((model && model.blocks) || {}) };
  const diagrams = (model && model.diagrams) || {};
  for (const s of DIAGRAM_SCALARS) {
    if (s in scalars) throw new Error(`prebuilt diagram not allowed for scalar ${s} — pass structured data in model.diagrams`);
  }
  if (blocks.useCase != null && !Array.isArray(blocks.useCase)) throw new Error("block useCase must be an array of rows");
  for (const row of blocks.useCase || []) {
    if (row && "diagram" in row) throw new Error("prebuilt useCase.diagram not allowed — pass structured data in useCase.sequence");
  }
  for (const s of DIAGRAM_SCALARS) scalars[s] = buildDiagram(diagrams[s], DIAGRAM_IDS[s]);
  blocks.useCase = (blocks.useCase || []).map((row, i) => {
    const { sequence, ...rest } = row || {};
    return { ...rest, diagram: buildDiagram({ ...(sequence || {}), kind: "sequence" }, `dg-seq${i}`) };
  });
  return fillTemplate(template, { scalars, blocks }, {
    scalars: new Set(DIAGRAM_SCALARS),
    fields: { useCase: new Set(["diagram"]) },
  });
}

module.exports = { htmlEscape, buildDiagram, renderModel, fillTemplate, PLACEHOLDER };

// --- CLI: render a template with a JSON model ------------------------------------------
if (require.main === module) {
  const [tplPath, modelPath] = process.argv.slice(2);
  if (!tplPath || !modelPath) {
    console.error("usage: render-report.cjs <template.html> <model.json>");
    process.exit(2);
  }
  const tpl = fs.readFileSync(tplPath, "utf8");
  const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  let out;
  try {
    // renderModel draws every diagram from structured data and refuses prebuilt markup (arch-3).
    out = renderModel(tpl, model);
  } catch (e) {
    console.error(`render refused: ${e.message}`);
    process.exit(1);
  }
  if (/\{\{|<!--\s*REPEAT:/.test(out)) { console.error("render incomplete: leftover markers"); process.exit(1); }
  process.stdout.write(out);
}
