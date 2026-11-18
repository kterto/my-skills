// Contract tests for roadmap's review page wiring (ADR-0036): tree approval asks page or text, the rules
// ship inside this skill (references/review-page.md, scripts/review-page.cjs), and the checker runs from here.
// The two files are copies of context-builder's; scripts/__tests__/review-page-parity.test.mjs keeps them equal
// and context-builder's suites test them in full.
// Run: node --test   (or: node __tests__/review-page-wiring.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const SKILL = path.join(__dirname, "..");
const MD = fs.readFileSync(path.join(SKILL, "SKILL.md"), "utf8");
const REF = fs.readFileSync(path.join(SKILL, "references", "review-page.md"), "utf8");
const SCRIPT = path.join(SKILL, "scripts", "review-page.cjs");
const step3 = MD.split("### Step 3 — User confirmation")[1].split("\n### ")[0];

test("tree approval asks page or text right before asking for approval, and a pasted block is never approval", () => {
  assert.match(step3, /^\s*Right before asking for approval, ask \*page or text\?\* \(`references\/review-page\.md`\); a pasted Copy block is never approval\. Wait for user approval\./);
  assert.ok(step3.indexOf("page or text?") < step3.indexOf("Wait for user approval"));
});

test("the reference carries roadmap's own row: what the page shows, its ids, its file, its agreement", () => {
  const row = (name) => REF.split("\n").find((l) => l.startsWith(`| ${name} |`)) || "";
  assert.match(row("The page shows"), /milestone → phase → story tree/);
  assert.match(row("Ids"), /`001-bootstrap`, `001\.1`, `001\.1\.1`/);
  assert.match(row("File name"), /`roadmap-tree\.html`/);
  assert.match(row("Agreement"), /a typed approval of the tree/);
  assert.match(REF, /roadmap edits the tree/);
});

const PAGE = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>Roadmap tree, draft 1</title>
<style>body{background:#fff;color:#111}</style></head><body><main><h1>001-bootstrap</h1>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" role="img"><title>sequence</title><rect width="10" height="10" fill="#1e6b43"/></svg>
</main></body></html>`;

test("the checker runs from this skill: 0 on a clean tree page, 1 on Mermaid, 2 on usage", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "roadmap-review-"));
  const good = path.join(dir, "roadmap-tree.html"), bad = path.join(dir, "bad.html");
  fs.writeFileSync(good, PAGE);
  fs.writeFileSync(bad, PAGE.replace("</main>", '<pre class="mermaid">graph TD;A-->B</pre></main>'));
  const run = (...args) => spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
  assert.strictEqual(run("check", good).status, 0);
  const r = run("check", bad);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /diagram\.mermaid: /);
  assert.strictEqual(run().status, 2);
});
