"use strict";
// The ONE executable rendering boundary (arch-3). Escaping, Mermaid construction +
// sanitization, template expansion, and literal runtime inlining were previously agent
// procedure, while tests exercised a *separate* test-only sanitizer — so the real render path
// could drift while every gate stayed green. This module owns all of it; SKILL.md Phase 4
// invokes it, and the tests import THESE functions, so a change to the boundary is a change to
// what the tests run.

const fs = require("node:fs");

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

// --- Mermaid label sanitizer (the real one; the test imports this) --------------------
const PLACEHOLDER = "(label omitted)";
const DANGER = [
  /%%/,                                                 // directive / comment marker
  /^\s*---/,                                            // frontmatter
  /\b(?:classDef|linkStyle|style|click|call|class|href)\b/i,
  /(?:https?|javascript|data|vbscript|file):/i,        // any URL scheme
];
const META = /["'`\[\]{}()<>;#|]/g;
const CONTROL = /[\x00-\x1f\x7f]/g;
function sanitizeMermaidLabel(raw) {
  if (typeof raw !== "string") return PLACEHOLDER;
  const oneLine = raw.replace(CONTROL, " ");
  if (DANGER.some((re) => re.test(oneLine))) return PLACEHOLDER;
  const cleaned = oneLine.replace(META, "").replace(/\s+/g, " ").trim();
  return cleaned.length ? cleaned : PLACEHOLDER;
}
// A node uses a SYNTHETIC id and the sanitized label quoted — repo text never becomes syntax.
function mermaidNode(index, rawLabel) {
  return `n${index}["${sanitizeMermaidLabel(rawLabel)}"]`;
}

// --- Deterministic template fill (REPEAT blocks + scalars) ----------------------------
// model = { scalars: { NAME: value, … }, blocks: { blockName: [ { field: value, … }, … ] } }
// Every substituted value is HTML-escaped. List fields must be pre-joined by the caller.
const REPEAT_RE = (b) => new RegExp(`<!--\\s*REPEAT:${b}\\s*-->([\\s\\S]*?)<!--\\s*/REPEAT:${b}\\s*-->`, "g");
function fillTemplate(template, model) {
  const scalars = (model && model.scalars) || {};
  const blocks = (model && model.blocks) || {};
  let out = template;
  // 1) Expand each REPEAT block once per row, resolving its inner {{block.field}} tokens.
  for (const [block, rows] of Object.entries(blocks)) {
    out = out.replace(REPEAT_RE(block), (_m, inner) =>
      (rows || []).map((row) =>
        inner.replace(new RegExp(`\\{\\{\\s*${block}\\.([A-Za-z0-9_]+)\\s*\\}\\}`, "g"),
          (_t, field) => htmlEscape(row[field] === undefined ? "" : row[field]))
      ).join("")
    );
  }
  // 2) Replace scalar {{PLACEHOLDER}} tokens.
  out = out.replace(/\{\{\s*([A-Z0-9_]+)\s*\}\}/g, (t, name) =>
    Object.prototype.hasOwnProperty.call(scalars, name) ? htmlEscape(scalars[name]) : t);
  return out;
}

// --- Diagram construction from STRUCTURED data (arch-3) -------------------------------
// The renderer builds every Mermaid source itself from a structured graph — synthetic node ids
// (n0, n1, …) + `sanitizeMermaidLabel`d labels — so repo-derived text can NEVER be prebuilt
// Mermaid syntax handed straight to the template. The diagram `header` is chosen from a fixed
// allowlist (never free text). A caller that supplies prebuilt source is rejected (see
// renderModel).
const ALLOWED_HEADERS = new Set(["flowchart TD", "flowchart LR", "erDiagram", "sequenceDiagram"]);
function buildDiagram(graph) {
  if (!graph || typeof graph !== "object") return "flowchart TD\n";
  const header = ALLOWED_HEADERS.has(graph.header) ? graph.header : "flowchart TD";
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const lines = [header];
  nodes.forEach((nd, i) => { lines.push(`  ${mermaidNode(i, nd && nd.label)}`); });
  for (const e of edges) {
    const a = Number(e && e.from), b = Number(e && e.to);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a >= nodes.length || b >= nodes.length) continue;
    const label = e && e.label != null ? `|"${sanitizeMermaidLabel(String(e.label))}"|` : "";
    lines.push(`  n${a} -->${label} n${b}`);
  }
  return lines.join("\n") + "\n";
}

const DIAGRAM_SCALARS = ["DATA_MODEL_MERMAID", "BUSINESS_LOGIC_MERMAID", "DATA_FLOW_MERMAID"];

// The whole model → report path (arch-3). Rejects any PREBUILT Mermaid source, builds every
// diagram from `model.diagrams` / per-useCase `sequence` structured data, then fills + inlines.
function renderModel(template, model, runtimeSource) {
  const scalars = { ...((model && model.scalars) || {}) };
  const blocks = { ...((model && model.blocks) || {}) };
  const diagrams = (model && model.diagrams) || {};
  // Reject prebuilt source: diagram scalars and useCase.mermaid must NOT be caller-supplied.
  for (const s of DIAGRAM_SCALARS) {
    if (s in scalars) throw new Error(`prebuilt Mermaid source not allowed for scalar ${s} — pass structured data in model.diagrams`);
  }
  for (const row of blocks.useCase || []) {
    if (row && "mermaid" in row) throw new Error("prebuilt useCase.mermaid not allowed — pass structured data in useCase.sequence");
  }
  // Build diagram scalars from structured data.
  for (const s of DIAGRAM_SCALARS) scalars[s] = buildDiagram(diagrams[s]);
  // Build each useCase's sequence diagram, then drop the structured field.
  blocks.useCase = (blocks.useCase || []).map((row) => {
    const { sequence, ...rest } = row || {};
    return { ...rest, mermaid: buildDiagram(sequence || { header: "sequenceDiagram" }) };
  });
  let out = fillTemplate(template, { scalars, blocks });
  if (runtimeSource != null) out = inlineRuntime(out, runtimeSource);
  return out;
}

// --- Literal runtime inlining (no $-interpretation corruption) ------------------------
function inlineRuntime(html, runtimeSource) {
  const marker = "<!-- MERMAID_RUNTIME -->";
  if (!html.includes(marker)) return html;
  const safe = String(runtimeSource).replace(/<\/script/gi, "<\\/script");
  const block = `<script id="mermaid-runtime">${safe}</script>`;
  return html.replace(marker, () => block); // function replacement → $& etc. are literal
}

module.exports = { htmlEscape, sanitizeMermaidLabel, mermaidNode, buildDiagram, renderModel, fillTemplate, inlineRuntime, PLACEHOLDER };

// --- CLI: render a template with a JSON model, optionally inlining a runtime file ------
if (require.main === module) {
  const [tplPath, modelPath, runtimePath] = process.argv.slice(2);
  if (!tplPath || !modelPath) {
    console.error("usage: render-report.cjs <template.html> <model.json> [runtime.js]");
    process.exit(2);
  }
  const tpl = fs.readFileSync(tplPath, "utf8");
  const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  let out;
  try {
    // renderModel BUILDS every diagram from structured data + rejects prebuilt Mermaid (arch-3).
    out = renderModel(tpl, model, runtimePath ? fs.readFileSync(runtimePath, "utf8") : null);
  } catch (e) {
    console.error(`render refused: ${e.message}`);
    process.exit(1);
  }
  if (/\{\{|<!--\s*REPEAT:/.test(out)) { console.error("render incomplete: leftover markers"); process.exit(1); }
  process.stdout.write(out);
}
