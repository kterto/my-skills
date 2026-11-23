// Tests for the executable render boundary (arch-3): the same functions the skill invokes.
// Run: node --test   (or: node __tests__/render-report.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const { htmlEscape, fillTemplate, renderModel } = require("../references/render-report.cjs");

test("htmlEscape neutralizes markup-breaking characters", () => {
  assert.strictEqual(htmlEscape('a<b>&"c'), "a&lt;b&gt;&amp;&quot;c");
});

test("fillTemplate expands a REPEAT block once per row and escapes values", () => {
  const tpl = `<ul><!-- REPEAT:item --><li>{{item.name}}={{item.val}}</li><!-- /REPEAT:item --></ul>`;
  const out = fillTemplate(tpl, { blocks: { item: [{ name: "a", val: "<x>" }, { name: "b", val: "y" }] } });
  assert.strictEqual(out, "<ul><li>a=&lt;x&gt;</li><li>b=y</li></ul>");
});

test("fillTemplate substitutes scalars (escaped) and leaves unknown tokens intact", () => {
  const out = fillTemplate(`<h1>{{TITLE}}</h1><p>{{MISSING}}</p>`, { scalars: { TITLE: "A & B" } });
  assert.strictEqual(out, "<h1>A &amp; B</h1><p>{{MISSING}}</p>");
});

test("a substituted value cannot break the injection seam (escaped)", () => {
  const out = fillTemplate(`<pre>{{X}}</pre>`, { scalars: { X: "</pre><script>alert(1)</script>" } });
  assert.ok(!out.includes("<script>"), "raw script tag must not survive");
  assert.ok(out.includes("&lt;script&gt;"));
});

test("source text containing a token is NOT re-interpreted (bug-2)", () => {
  // A known token inside a REPEAT row value must display literally, not be rewritten by the
  // later scalar pass; an unknown {{X}} in a value must not survive as a leftover marker.
  const tpl = `<ul><!-- REPEAT:item --><li>{{item.text}}</li><!-- /REPEAT:item --></ul><h1>{{TITLE}}</h1>`;
  const out = fillTemplate(tpl, {
    scalars: { TITLE: "Real Title" },
    blocks: { item: [{ text: "see {{TITLE}} and {{UNKNOWN}}" }] },
  });
  assert.ok(!out.includes("Real Title</li>") && !/\{\{\s*TITLE/.test(out.split("</ul>")[0]), "token in a value must not be rewritten");
  assert.ok(!/\{\{\s*[A-Z0-9_]+\s*\}\}/.test(out), "no leftover {{...}} marker survives from a value");
  assert.ok(out.includes("&#123;&#123;TITLE&#125;&#125;"), "the value's braces are neutralized to entities");
  assert.ok(out.includes("<h1>Real Title</h1>"), "the real template scalar still fills");
});

test("renderModel draws diagram scalars as SVG from structured data (arch-3)", () => {
  const out = renderModel(`<div>{{DATA_MODEL_DIAGRAM}}</div>`, { diagrams: { DATA_MODEL_DIAGRAM: { kind: "er", nodes: [{ label: "User" }], edges: [] } } });
  assert.ok(out.startsWith('<div><svg class="dg dg--er"'), "drawn markup is inserted unescaped");
  assert.ok(out.includes(">User</text>"));
});

test("renderModel draws one sequence per use case with distinct ids", () => {
  const seq = { nodes: [{ label: "A" }, { label: "B" }], edges: [{ from: 0, to: 1, label: "go" }] };
  const tpl = `<!-- REPEAT:useCase --><i>{{useCase.goal}}</i>{{useCase.diagram}}<!-- /REPEAT:useCase -->`;
  const out = renderModel(tpl, { blocks: { useCase: [{ goal: "<b>", sequence: seq }, { goal: "two", sequence: seq }] } });
  assert.ok(out.includes("<i>&lt;b&gt;</i>"), "ordinary fields stay escaped");
  assert.strictEqual((out.match(/<svg class="dg dg--sequence"/g) || []).length, 2);
  assert.ok(out.includes('id="dg-seq0-arrow"') && out.includes('id="dg-seq1-arrow"'), "marker ids do not collide");
});

test("renderModel REJECTS a prebuilt diagram scalar (arch-3)", () => {
  assert.throws(
    () => renderModel(`<div>{{DATA_FLOW_DIAGRAM}}</div>`, { scalars: { DATA_FLOW_DIAGRAM: "<script>alert(1)</script>" } }),
    /prebuilt diagram not allowed/,
  );
});

test("renderModel REJECTS a prebuilt useCase.diagram (arch-3)", () => {
  assert.throws(
    () => renderModel(`x`, { blocks: { useCase: [{ actor: "a", diagram: "<script>alert(1)</script>" }] } }),
    /prebuilt useCase\.diagram not allowed/,
  );
});

test("a model cannot reach the unescaped channel through scalars or other fields", () => {
  const tpl = `<p>{{SCOPE_LABEL}}</p><!-- REPEAT:useCase -->{{useCase.goal}}<!-- /REPEAT:useCase -->`;
  const out = renderModel(tpl, { scalars: { SCOPE_LABEL: "<svg onload=x>" }, blocks: { useCase: [{ goal: "<svg onload=y>" }] } });
  assert.ok(!out.includes("<svg onload"), "only renderer-drawn diagrams go in raw");
});

test("malformed blocks are refused with a clear message", () => {
  const tpl = `<!-- REPEAT:useCase -->{{useCase.goal}}<!-- /REPEAT:useCase -->`;
  assert.throws(() => fillTemplate(tpl, { blocks: { "(": [] } }), /is not a template block/);
  assert.throws(() => fillTemplate(tpl, { blocks: { "useCase|x": [] } }), /is not a template block/);
  assert.throws(() => fillTemplate(tpl, { blocks: { rule: "abc" } }), /must be an array of rows/);
  assert.throws(() => renderModel(tpl, { blocks: { useCase: "abc" } }), /must be an array of rows/);
  assert.strictEqual(fillTemplate(tpl, { blocks: { useCase: [null, { goal: "g" }] } }), "g", "a null row renders empty");
});
