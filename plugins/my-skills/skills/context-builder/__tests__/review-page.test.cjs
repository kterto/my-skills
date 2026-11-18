// Tests for the review page checker, scripts/review-page.cjs (ADR-0036). Each case breaks one rule of a page
// that passes and asserts the code, so a rule that stops gating fails here; the cases that must pass are
// asserted just as hard, because a checker that flags the page a skill should write gets switched off.
// Run: node --test   (or: node __tests__/review-page.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const R = require("../scripts/review-page.cjs");

const SCRIPT = path.join(__dirname, "..", "scripts", "review-page.cjs");
const FIX = path.join(__dirname, "fixtures");
const GOOD = fs.readFileSync(path.join(FIX, "review-page-good.html"), "utf8");
const BAD = fs.readFileSync(path.join(FIX, "review-page-bad.html"), "utf8");
const codes = (html) => R.check(html).map((p) => p.split(":")[0]);
const cli = (args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });

// The codes `check` printed on the owner's hand-made page (not in this repository: it holds a client's
// context). review-page-bad.html carries the same faults on made-up content, so it must print the same set.
const EXAMPLE_CODES = [
  "skel.doctype", "skel.lang", "skel.charset", "skel.viewport", "csp.missing", "net.link", "net.remote", "net.nav",
  "diagram.mermaid", "diagram.source", "svg.override",
];

test("the bad fixture reproduces every fault of the owner's example, and nothing else", () => {
  assert.deepStrictEqual([...new Set(codes(BAD))].sort(), [...EXAMPLE_CODES].sort());
});

test("the good fixture passes: design-system colours on SVG, the svg xmlns URL, a table, storage and clipboard", () => {
  assert.deepStrictEqual(R.check(GOOD), []);
  assert.match(GOOD, /xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, "the fixture must carry the xmlns URL it proves");
  assert.match(GOOD, /<rect[^>]* fill="#[0-9a-f]{6}"/i, "the fixture must carry a colour attribute it proves");
});

const CSP_META = /<meta http-equiv="Content-Security-Policy"[^>]*>/;
const inScript = (h, js) => h.replace("paint();\n})();", `paint(); ${js};\n})();`);
const CASES = [
  // skeleton: a page opened from file:// gets no wrapper
  ["skel.doctype", (h) => h.replace("<!doctype html>\n", "")],
  ["skel.doctype", (h) => h.replace("<!doctype html>\n", "<p>x</p><!doctype html>\n")],
  ["skel.lang", (h) => h.replace('<html lang="en">', "<html>")],
  ["skel.lang", (h) => h.replace('<html lang="en">', '<html lang=" ">')],
  ["skel.charset", (h) => h.replace('<meta charset="utf-8">\n', "")],
  ["skel.charset", (h) => h.replace('<meta charset="utf-8">', '<meta charset="iso-8859-1">')],
  ["skel.charset", (h) => h.replace('<meta charset="utf-8">\n', "").replace("</head>", '<meta charset="utf-8"></head>')],
  ["skel.viewport", (h) => h.replace(/<meta name="viewport"[^>]*>\n/, "")],
  ["skel.viewport", (h) => h.replace(/<meta name="viewport"[^>]*>/, (m) => `<!-- ${m} -->`)],
  ["skel.title", (h) => h.replace(/<title>[^<]*<\/title>/, "")],
  ["skel.title", (h) => h.replace(/<title>[^<]*<\/title>/, "<title>  </title>")],
  // the CSP: envision's network-denying policy
  ["csp.missing", (h) => h.replace(CSP_META, "")],
  ["csp.missing", (h) => h.replace(CSP_META, (m) => `<!-- ${m} -->`)],
  ["csp.missing", (h) => h.replace(CSP_META, "").replace("<body>", () => `<body>${h.match(CSP_META)[0]}`)],
  ["csp.default", (h) => h.replace("default-src 'none'", "default-src 'self'")],
  ["csp.base", (h) => h.replace("; base-uri 'none'", "")],
  ["csp.form", (h) => h.replace("; form-action 'none'", "")],
  ["csp.connect", (h) => h.replace("default-src 'none';", "default-src 'none'; connect-src 'none';")],
  ["csp.source", (h) => h.replace("font-src data:", "font-src data: https://fonts.gstatic.com")],
  ["csp.duplicate", (h) => h.replace(CSP_META, (m) => m + m)],
  ["csp.hash", (h) => h.replace("script-src 'unsafe-inline'", "script-src 'unsafe-inline' 'sha256-AAAA'")],
  ["csp.hash", (h) => h.replace("script-src 'unsafe-inline'", "script-src 'none'")],
  // no outside load of any kind
  ["net.script", (h) => h.replace("</body>", '<script src="app.js"></script></body>')],
  ["net.link", (h) => h.replace("</head>", '<link rel="stylesheet" href="look.css"></head>')],
  ["net.link", (h) => h.replace("</head>", '<link rel="preconnect" href="https://fonts.googleapis.com"></head>')],
  ["net.remote", (h) => h.replace("</main>", '<img src="https://example.com/a.png" alt=""></main>')],
  ["net.remote", (h) => h.replace("</main>", '<a href="//example.com/x">x</a></main>')],
  ["net.remote", (h) => h.replace("</main>", '<img alt="" src="https&#58;//example.com/a.png"></main>')],
  ["net.remote", (h) => h.replace("<rect ", '<image href="https://example.com/a.png"/><rect ')],
  ["net.url", (h) => h.replace("<style>", "<style>body{background:url(http://example.com/a.png)}")],
  ["net.url", (h) => h.replace("<style>", "<style>@font-face{font-family:X;src:url(https://example.com/x.woff2)}")],
  ["net.url", (h) => h.replace("<style>", String.raw`<style>body{background:\75rl(https://example.com/a.png)}`)],
  ["net.import", (h) => h.replace("<style>", "<style>@import url(look.css);")],
  ["net.refresh", (h) => h.replace("</head>", '<meta http-equiv="refresh" content="0;url=https://example.com/"></head>')],
  ["net.embed", (h) => h.replace("</main>", "<iframe></iframe></main>")],
  ["net.api", (h) => inScript(h, "fetch('/log')")],
  ["net.api", (h) => inScript(h, "new WebSocket('ws://x')")],
  ["net.nav", (h) => inScript(h, "location.reload()")],
  ["net.nav", (h) => inScript(h, "window.open('x')")],
  ["js.inline", (h) => h.replace('<button type="button" id="copy">', '<button type="button" id="copy" onclick="go()">')],
  ["js.url", (h) => h.replace("</main>", '<a href="javascript:go()">x</a></main>')],
  ["js.url", (h) => inScript(h, "a.href = 'javascript:go()'")],
  ["net.remote", (h) => inScript(h, "img.src = 'https://example.com/a.png'")],
  ["net.import", (h) => h.replace("<main ", '<main style="@import url(x.css)" ')],
  ["js.inline", (h) => h.replace("<main ", '<main title="a > b" onclick="go()" ')],
  // diagrams are drawn when the page is written, never by a runtime
  ["diagram.mermaid", (h) => h.replace("</main>", '<pre class="mermaid">A-->B</pre></main>')],
  ["diagram.mermaid", (h) => h.replace("</main>", '<pre><code class="language-mermaid">A-->B</code></pre></main>')],
  ["diagram.mermaid", (h) => inScript(h, "var m = window.mermaid")],
  ["diagram.source", (h) => h.replace("</main>", "<pre>flowchart LR\n  A --> B</pre></main>")],
  ["diagram.source", (h) => h.replace("</main>", "<pre>graph TD;A-->B</pre></main>")],
  ["diagram.source", (h) => h.replace("</main>", "<pre>sequenceDiagram\n  A->>B: hi</pre></main>")],
  ["diagram.source", (h) => h.replace("</main>", "<pre>digraph G { a -> b }</pre></main>")],
  ["diagram.source", (h) => h.replace("</main>", "<pre>@startuml\nA -> B\n@enduml</pre></main>")],
  ["diagram.source", (h) => h.replace("</main>", "<pre>journey\n  title My day\n  section Work</pre></main>")],
  ["diagram.source", (h) => h.replace("</main>", "<pre>gantt\n  dateFormat YYYY-MM-DD</pre></main>")],
  ["diagram.source", (h) => h.replace("</main>", "<pre>mindmap\n  root((ideas))</pre></main>")],
  ["diagram.runtime", (h) => inScript(h, "d3.select('svg')")],
  ["diagram.runtime", (h) => inScript(h, "new Chart(el, {})")],
  // readable whatever the reader's theme
  ["read.background", (h) => h.replace("body{background:var(--bg);", "body{")],
  ["read.background", (h) => h.replace("body{background:var(--bg);", "body{background:transparent;")],
  ["read.color", (h) => h.replace("body{background:var(--bg);color:var(--text);", "body{background:var(--bg);")],
  ["svg.override", (h) => h.replace("<style>", "<style>svg text{fill:var(--text)}")],
  ["svg.override", (h) => h.replace("<style>", "<style>.fig rect{stroke:#000}")],
  ["svg.override", (h) => h.replace("<rect ", '<rect class="bar" ').replace("<style>", "<style>svg rect.bar{fill:#000}")],
  ["svg.override", (h) => h.replace("<style>", "<style>svg *{fill:#f00}")],
  ["svg.override", (h) => h.replace("<style>", "<style>svg :is(text,rect){fill:#f00}")],
  ["svg.override", (h) => h.replace("<style>", "<style>svg :where(.x, text){stroke:#f00}").replace(' fill="#2b3a67"', ' stroke="#2b3a67"')],
  ["size", (h) => h.replace("</main>", `<p>${"x".repeat(R.MAX_BYTES)}</p></main>`)],
];

for (const [code, breakIt] of CASES) {
  test(`check: rejects ${code}`, () => {
    const broken = breakIt(GOOD);
    assert.notStrictEqual(broken, GOOD, "the mutation did not apply to the fixture");
    const got = codes(broken);
    assert.ok(got.includes(code), `${code} not reported; got ${JSON.stringify(R.check(broken))}`);
  });
}

const ALLOWED = [
  ["a body style attribute in place of a rule", (h) => h.replace("body{background:var(--bg);color:var(--text);", "body{")
    .replace("<body>", '<body style="background:#fff;color:#111">')],
  ["html carrying the colours", (h) => h.replace("body{background:var(--bg);color:var(--text);", "html{background-color:#fff;color:#111}body{")],
  ["a class rule that sets fill", (h) => h.replace("<style>", "<style>svg .ink{fill:#123}")],
  ["svg text fill when no <text> carries a fill attribute", (h) => h.replace(' fill="#2b3a67"', "").replace("<style>", "<style>svg text{fill:var(--text)}")],
  ["a local anchor and a data: image", (h) => h.replace("</main>", '<a href="#S2">S2</a><img alt="" src="data:image/png;base64,iVBORw0KGgo="></main>')],
  ["location.hash", (h) => inScript(h, "var at = location.hash")],
  ["the word graph or flowchart in prose", (h) => h.replace("</main>", "<p>The flowchart below is a graph of who signs what.</p></main>")],
  // headings and items that start with a diagram keyword are prose, not diagram source
  ["a Journey heading", (h) => h.replace("</main>", "<h3>Journey</h3></main>")],
  ["a list item starting with Journey", (h) => h.replace("</main>", "<ul>\n<li>Journey 1: the baker opens the shop</li>\n</ul></main>")],
  ["a paragraph starting with Mindmap", (h) => h.replace("</main>", "<p>Mindmap of the ideas below</p></main>")],
  ["a cell starting with Gantt", (h) => h.replace("<td>Customer</td>", "<td>\nGantt view of phases</td>")],
  // ordinary script: a comparison then an identifier starting with on is no inline handler
  ["a loop comparison in script", (h) => inScript(h, "for (let i=0;i<marks.length;i++) { const one = marks[i]; }")],
  ["a comparison before an onTop variable", (h) => inScript(h, "var a = 1, b = 2; if (a<b) { let onTop = 1; }")],
  // visible prose and quoted snippets are read, never loaded or run
  ["@import named in prose", (h) => h.replace("</main>", "<p>Decision: replace @import with @use in the Sass files.</p></main>")],
  ["javascript: named in prose", (h) => h.replace("</main>", "<p>Rule: no javascript: URLs in links.</p></main>")],
  ["a quoted link in a code sample", (h) => h.replace("</main>", '<pre><code>&lt;a href="https://bakery.example/menu"&gt;</code></pre></main>')],
  ["story titles kept as JSON data", (h) => h.replace("</body>", '<script type="application/json" id="data">' +
    '[{"id":"S2","title":"Store location picker"},{"id":"S3","title":"Live orders over a WebSocket"},"not mermaid"]</script></body>')],
  // colours set where the design tokens live
  [":root carrying the colours", (h) => h.replace("body{background:var(--bg);color:var(--text);", ":root{background:#fff;color:#111}body{")],
  // a type rule that reaches no coloured attribute
  ["a classed shape rule when no shape has that class", (h) => h.replace("<style>", "<style>svg rect.bar{fill:#000}")],
  ["a hashed script in place of unsafe-inline", (h) => {
    const crypto = require("node:crypto");
    const token = `'sha256-${crypto.createHash("sha256").update(R.inlineScripts(h)[0], "utf8").digest("base64")}'`;
    return h.replace("script-src 'unsafe-inline'", `script-src ${token}`);
  }],
  ["a byte-order mark and a leading comment before the doctype", (h) => `﻿<!-- draft 2 -->\n${h}`],
];

for (const [what, edit] of ALLOWED) {
  test(`check: allows ${what}`, () => {
    const page = edit(GOOD);
    assert.notStrictEqual(page, GOOD, "the edit did not apply to the fixture");
    assert.deepStrictEqual(R.check(page), []);
  });
}

test("check CLI: exit 0 on a clean page, 1 with every problem and its file, 2 on usage or an unreadable file", () => {
  const ok = cli(["check", path.join(FIX, "review-page-good.html")]);
  assert.strictEqual(ok.status, 0, ok.stderr);
  assert.match(ok.stdout, /^check passed: 1 page/);
  const bad = cli(["check", path.join(FIX, "review-page-good.html"), path.join(FIX, "review-page-bad.html")]);
  assert.strictEqual(bad.status, 1);
  assert.match(bad.stderr, /^check failed: 11 problems/);
  for (const code of EXAMPLE_CODES) assert.match(bad.stderr, new RegExp(`review-page-bad\\.html: ${code.replace(".", "\\.")}: `));
  assert.doesNotMatch(bad.stderr, /review-page-good\.html:/);
  for (const args of [[], ["check"], ["render", "x.html"], ["check", path.join(os.tmpdir(), "no-such-review-page.html")]]) {
    const r = cli(args);
    assert.strictEqual(r.status, 2, `${JSON.stringify(args)} → ${r.status}: ${r.stderr}`);
  }
});

test("check CLI: a directory in place of a file is an I/O error, exit 2", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "review-page-"));
  assert.strictEqual(cli(["check", dir]).status, 2);
});
