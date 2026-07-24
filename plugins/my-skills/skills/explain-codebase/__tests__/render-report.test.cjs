// Tests for the executable render boundary (arch-3): the same functions the skill invokes.
// Run: node --test   (or: node __tests__/render-report.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const { htmlEscape, fillTemplate, inlineRuntime } = require("../references/render-report.cjs");

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

test("inlineRuntime replaces the marker literally ($-sequences not expanded)", () => {
  const runtime = "var x='$&';var y='$`';var z=\"$'\";"; // $-sequences a naive replace would corrupt
  const out = inlineRuntime("<head><!-- MERMAID_RUNTIME --></head>", runtime);
  assert.ok(out.includes(`<script id="mermaid-runtime">${runtime}</script>`), "runtime inlined verbatim");
  assert.ok(!out.includes("<!-- MERMAID_RUNTIME -->"), "marker consumed");
});

test("inlineRuntime escapes any </script in the runtime", () => {
  const out = inlineRuntime("<!-- MERMAID_RUNTIME -->", "a</script>b");
  assert.ok(out.includes("a<\\/script>b"), "</script must be escaped so it can't close early");
});
