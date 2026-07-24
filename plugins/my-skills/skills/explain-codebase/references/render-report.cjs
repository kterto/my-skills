"use strict";
// The ONE executable rendering boundary (arch-3). Escaping, Mermaid construction +
// sanitization, template expansion, and literal runtime inlining were previously agent
// procedure, while tests exercised a *separate* test-only sanitizer — so the real render path
// could drift while every gate stayed green. This module owns all of it; SKILL.md Phase 4
// invokes it, and the tests import THESE functions, so a change to the boundary is a change to
// what the tests run.

const fs = require("node:fs");

// --- HTML escaping (applied to every substituted value) -------------------------------
function htmlEscape(v) {
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

// --- Literal runtime inlining (no $-interpretation corruption) ------------------------
function inlineRuntime(html, runtimeSource) {
  const marker = "<!-- MERMAID_RUNTIME -->";
  if (!html.includes(marker)) return html;
  const safe = String(runtimeSource).replace(/<\/script/gi, "<\\/script");
  const block = `<script id="mermaid-runtime">${safe}</script>`;
  return html.replace(marker, () => block); // function replacement → $& etc. are literal
}

module.exports = { htmlEscape, sanitizeMermaidLabel, mermaidNode, fillTemplate, inlineRuntime, PLACEHOLDER };

// --- CLI: render a template with a JSON model, optionally inlining a runtime file ------
if (require.main === module) {
  const [tplPath, modelPath, runtimePath] = process.argv.slice(2);
  if (!tplPath || !modelPath) {
    console.error("usage: render-report.cjs <template.html> <model.json> [runtime.js]");
    process.exit(2);
  }
  const tpl = fs.readFileSync(tplPath, "utf8");
  const model = JSON.parse(fs.readFileSync(modelPath, "utf8"));
  let out = fillTemplate(tpl, model);
  if (runtimePath) out = inlineRuntime(out, fs.readFileSync(runtimePath, "utf8"));
  if (/\{\{|<!--\s*REPEAT:/.test(out)) { console.error("render incomplete: leftover markers"); process.exit(1); }
  process.stdout.write(out);
}
