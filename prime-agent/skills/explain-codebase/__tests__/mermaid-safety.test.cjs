// Mermaid-injection safety fixture for FEAT-20260723T141806Z-d784 (sec-3). The report's
// runtime reads each `<pre class="mermaid">` back via `textContent`, which DECODES HTML
// entities BEFORE Mermaid parses the source — so HTML-escaping does NOT protect the diagram.
// Repo-derived text placed raw into a diagram can inject Mermaid directives (`%%{init}%%`),
// frontmatter (leading `---`), classDef/style/click/href, URLs, or remote-loading CSS, which
// are active even under securityLevel:"strict". SKILL.md Phase 4 therefore builds every
// diagram from SYNTHETIC node ids + SANITIZED, quoted labels. This test is the executable
// mirror of that label-sanitization contract, plus the network-denying-CSP outer guard.
// Run: node --test   (or: node __tests__/mermaid-safety.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const REF = path.join(__dirname, "..", "references");
// Import the REAL render-boundary functions (arch-3): the skill invokes the same module, so
// these tests exercise the actual sanitizer, not a drifting test-only copy.
const { sanitizeMermaidLabel, mermaidNode, PLACEHOLDER } = require("../references/render-report.cjs");

test("benign labels pass through, collapsed to one line", () => {
  assert.strictEqual(sanitizeMermaidLabel("Invoice total"), "Invoice total");
  assert.strictEqual(sanitizeMermaidLabel("  Charge   service \n row "), "Charge service row");
});

test("mermaid directives and frontmatter are rejected", () => {
  assert.strictEqual(sanitizeMermaidLabel("%%{init: {'theme':'base'}}%%"), PLACEHOLDER);
  assert.strictEqual(sanitizeMermaidLabel("--- \n config: { x: 1 } \n ---"), PLACEHOLDER);
  assert.strictEqual(sanitizeMermaidLabel("A %% inline comment"), PLACEHOLDER);
});

test("style/callback/link keywords are rejected", () => {
  for (const p of ["classDef evil fill:red", "style A fill:#f00", "click A callback",
                   "linkStyle 0 stroke:red", "call foo()", "href https://x"]) {
    assert.strictEqual(sanitizeMermaidLabel(p), PLACEHOLDER, `must reject: ${p}`);
  }
});

test("any URL scheme is rejected", () => {
  for (const p of ["http://evil.example", "https://evil.example/x.css",
                   "javascript:alert(1)", "data:text/html,x", "file:///etc/passwd"]) {
    assert.strictEqual(sanitizeMermaidLabel(p), PLACEHOLDER, `must reject: ${p}`);
  }
});

test("structural metacharacters are stripped, control chars removed", () => {
  assert.strictEqual(sanitizeMermaidLabel("User[Admin]"), "UserAdmin");
  assert.strictEqual(sanitizeMermaidLabel('say "hi"'), "say hi");
  assert.strictEqual(sanitizeMermaidLabel("a b\tc"), "a b c");
});

test("empty-after-clean falls back to the placeholder", () => {
  assert.strictEqual(sanitizeMermaidLabel("[]{}()"), PLACEHOLDER);
  assert.strictEqual(sanitizeMermaidLabel(""), PLACEHOLDER);
  assert.strictEqual(sanitizeMermaidLabel(null), PLACEHOLDER);
});

test("emitted nodes use synthetic ids and a safe quoted label", () => {
  // A malicious label can never break out of the quotes or introduce a directive.
  const node = mermaidNode(3, '"]%%{init}%%click x');
  assert.strictEqual(node, `n3["${PLACEHOLDER}"]`);
  assert.match(mermaidNode(0, "Payment"), /^n0\["Payment"\]$/);
});

test("template and demo carry the network-denying CSP (outer guard)", () => {
  const CSP_RE = /http-equiv=["']Content-Security-Policy["'][^>]*default-src\s+'none'/i;
  for (const f of ["report-template.html", "report-template.demo.html"]) {
    const html = fs.readFileSync(path.join(REF, f), "utf8");
    assert.match(html, CSP_RE, `${f} must emit a default-src 'none' CSP`);
    const csp = html.match(/Content-Security-Policy[^>]*/i)[0];
    assert.ok(!/connect-src/i.test(csp), `${f} CSP must not grant connect-src (network stays denied)`);
  }
});
