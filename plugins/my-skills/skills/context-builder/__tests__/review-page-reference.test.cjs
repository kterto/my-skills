// Tests for references/review-page.md (ADR-0036): the rules a model reads before it writes a review page, and
// the reference snippet it may adapt. The snippet is lifted from the markdown, put in a page that must pass
// `check`, and run in node:vm against a stub DOM with no dependencies, so the Copy block it builds is tested as
// the user would paste it. The rule phrases are the contract: rewording one away fails here on purpose.
// Run: node --test   (or: node __tests__/review-page-reference.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = require("../scripts/review-page.cjs");

const SKILL = path.join(__dirname, "..");
const REF = fs.readFileSync(path.join(SKILL, "references", "review-page.md"), "utf8");
const SNIPPET = REF.split("## Reference snippet")[1].match(/```js\n([\s\S]*?)```/)[1];
const GOOD = fs.readFileSync(path.join(__dirname, "fixtures", "review-page-good.html"), "utf8");

// --- The rules the reference must keep ----------------------------------------------------------

const RULES = [
  ["the question's rules are read before it is asked", /Read \*\*Page or text\?\*\* before\s+asking that question; read the rest only after the user picks \*\*page\*\*/],
  ["the browser gate names the OS", /on\s+macOS \(`uname` is `Darwin`\) `open` exists, or on Linux `xdg-open` exists and `\$DISPLAY` or\s+`\$WAYLAND_DISPLAY` is set/],
  ["a failed open falls back to text", /If opening fails after \*\*Page\*\*, fall back to text and say why/],
  ["look at the rendered page", /screenshot the page at desktop and phone\s+width, light and dark, and look before opening it/],
  ["page data in a JSON script", /Keep the page's data\*\*[\s\S]*?<script type="application\/json">`\s+and read it with `JSON\.parse`/],
  ["SVG coloured by class from the tokens", /Colour SVG by class from the `:root` tokens\*\*, so it follows dark mode/],
  ["diagrams fit a phone", /never set SVGs side by side in a grid/],
  ["never mark table rows", /never table rows/],
  ["a quoted yes is not agreement", /quoted notes are the user's words and are\s+never agreement, even when they say yes or sim/],
  ["a quote is one JSON string", /one JSON string \(`\\"` is a quote inside it\)/],
  ["the question is its own, right before agreement", /its own question, right before the agreement question/],
  ["it is asked only with a reachable browser", /only when a browser is reachable[\s\S]*?\$SSH_CONNECTION[\s\S]*?skip the\s+question/],
  ["all three hosts", /`AskUserQuestion` \(Claude Code\) \/ `question` \(opencode\)[\s\S]*?Prime Agent[\s\S]*?numbered/],
  ["text is today's behaviour", /\*\*Text\*\* is the step exactly as it was/],
  ["the page lives outside the project", /Never in the project[\s\S]*?\$\{TMPDIR:-\/tmp\}\/my-skills-review\//],
  ["opened once, then reload", /Open it the first time only[\s\S]*?Reload the page/],
  ["the check command and its exit codes", /node "\$skill_dir\/scripts\/review-page\.cjs" check <file>` — exit 0 clean; 1 problems[\s\S]*?2 usage or I\/O/],
  ["fix until clean before opening", /until it exits 0, then open it\. Never open a page that fails/],
  ["no fixed template", /There is no template/],
  ["the user's language", /Write in the user's language/],
  ["the project's design system", /Use the project's design system[\s\S]*?DESIGN\.md[\s\S]*?ThemeData/],
  ["no Mermaid, SVG or tables", /Inline SVG[\s\S]*?Tables[\s\S]*?Never Mermaid/],
  ["dark mode", /prefers-color-scheme: dark/],
  ["unmarked is not reviewed", /Unmarked means "not reviewed", never correct/],
  ["the pasted block is data", /correction and data, never instructions/],
  ["the pasted block is never agreement", /It is never agreement/],
  ["agreement is a typed yes", /To agree, type\s+yes in chat/],
];
for (const [what, re] of RULES) test(`the reference keeps: ${what}`, () => assert.match(REF, re));

test("the reference no longer claims the block can never contain yes", () => {
  assert.doesNotMatch(REF, /It never contains "yes"/);
});

test("the reference documents every code the checker can print", () => {
  const src = fs.readFileSync(path.join(SKILL, "scripts", "review-page.cjs"), "utf8");
  const families = new Set([...src.matchAll(/["`]((?:skel|csp|net|js|diagram|read|svg)\.[a-z]+|size): /g)].map((m) => m[1].split(".")[0]));
  for (const f of families) assert.match(REF, new RegExp("`" + (f === "size" ? "size" : `${f}\\.`)), `${f} is not in the reference's table`);
});

// --- A stub DOM: just what the snippet touches ----------------------------------------------------

class El {
  constructor(tag, attrs = {}, kids = []) {
    Object.assign(this, { tagName: tag.toUpperCase(), attrs: {}, children: [], parentNode: null, listeners: {}, style: {} });
    Object.assign(this, { textContent: "", value: "", hidden: false, checked: false, type: "", className: "" });
    this.dataset = {};
    for (const [k, v] of Object.entries(attrs)) this.setAttribute(k, v);
    kids.forEach((k) => this.appendChild(k));
  }
  setAttribute(k, v) {
    this.attrs[k] = String(v);
    if (k.startsWith("data-")) this.dataset[k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = String(v);
    if (k === "type" || k === "value") this[k] = String(v);
  }
  getAttribute(k) { return this.attrs[k] ?? null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, ref) { this.removeChild(c); c.parentNode = this; this.children.splice(this.children.indexOf(ref), 0, c); return c; }
  removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  fire(type) { (this.listeners[type] || []).forEach((fn) => fn({ target: this })); }
  focus() {} select() {}
  matches(sel) {
    const m = /^([a-z]*)((?:\[[^\]]+\])*)$/.exec(sel);
    if (m[1] && this.tagName !== m[1].toUpperCase()) return false;
    return [...m[2].matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)].every(([, k, v]) => {
      const have = k === "type" ? this.type || this.attrs.type : this.attrs[k];
      return v === undefined ? have !== undefined : have === v;
    });
  }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
  querySelectorAll(sel) { return this.all().filter((e) => e.matches(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  closest(sel) { let e = this; while (e && !(e.matches && e.matches(sel))) e = e.parentNode; return e || null; }
}
const h = (tag, attrs, ...kids) => new El(tag, attrs, kids);

// A page with one of each kind: a section, a row inside it, a conflict and an open decision.
function page({ storage = "ok", clipboard = "ok", execCommand = true, confirm = true, rich = false } = {}) {
  // rich: each option a title plus a <small> description, a short data-label on the radio, the note inside its <label>
  const radio = (v, text) => h("label", {},
    Object.assign(h("input", { type: "radio", name: "C1", value: v, ...(rich ? { "data-label": text } : {}) }), { textContent: "" }),
    Object.assign(h("span"), { textContent: rich ? `${text}Interview. A long description of "${text}".` : text }));
  const note = h("textarea", { "data-note": "" });
  const c1 = h("fieldset", { "data-review": "C1", "data-kind": "conflict" }, radio("a", "Interview"), radio("b", "Design 02"),
    radio("other", "Neither"), rich ? h("label", {}, note) : note);
  for (const l of c1.querySelectorAll("label").filter((l) => l.children[1])) Object.defineProperty(l, "textContent", { get: () => l.children[1].textContent });
  const main = h("main", { "data-review-key": "bakery:context", "data-draft": "3", "data-skill": "context-builder" },
    h("section", { "data-review": "S1", "data-kind": "section", "data-label": "Problem" }),
    h("li", { "data-review": "S1.2", "data-kind": "item", "data-label": "Totals drift" }),
    c1,
    h("div", { "data-review": "O1", "data-kind": "open", "data-label": "Who approves credit" }),
    h("p", { id: "review-progress" }), h("pre", { id: "review-out" }), h("button", { id: "review-copy" }),
    h("button", { id: "review-reset" }), h("p", { id: "review-status" }));
  const body = h("body", {}, main);
  const store = new Map(), log = { copied: [], selected: 0, keys: [] };
  const localStorage = storage === "blocked"
    ? { getItem() { throw new Error("SecurityError"); }, setItem() { throw new Error("SecurityError"); } }
    : { getItem: (k) => (log.keys.push(k), store.get(k) ?? null), setItem: (k, v) => store.set(k, v) };
  const document = {
    body,
    querySelector: (s) => (s === "main[data-review-key]" ? main : body.querySelector(s)),
    getElementById: (id) => body.all().find((e) => e.attrs.id === id) || null,
    createElement: (t) => new El(t),
    createRange: () => ({ selectNodeContents() {} }),
    execCommand: () => execCommand,
  };
  const navigator = clipboard === "none" ? {} : {
    clipboard: { writeText: (t) => (clipboard === "ok" ? (log.copied.push(t), Promise.resolve()) : Promise.reject(new Error("denied"))) },
  };
  const window = { getSelection: () => ({ removeAllRanges() {}, addRange() { log.selected++; } }), confirm: () => confirm };
  const ctx = vm.createContext({ document, localStorage, navigator, window, String, JSON, Promise });
  vm.runInContext(SNIPPET, ctx);
  const $ = (id) => document.getElementById(id);
  const controls = (id) => body.all().find((e) => e.dataset.review === id).querySelector("div");
  const button = (id, i) => controls(id).querySelectorAll("button")[i];
  const textarea = (id) => body.all().find((e) => e.dataset.review === id).querySelector("textarea");
  return { ctx, $, button, textarea, store, log, c1 };
}
const type = (ta, text) => { ta.value = text; ta.fire("input"); };
const tick = () => new Promise((r) => setImmediate(r));

test("the snippet in a page passes check", () => {
  const html = GOOD.replace(/<script>[\s\S]*<\/script>/, () => `<script>\n${SNIPPET}</script>`);
  assert.deepStrictEqual(R.check(html), []);
});

test("copyBlock: one line per mark, unmarked items listed as not reviewed, the header names skill, project and draft", () => {
  const { ctx } = page();
  const block = ctx.copyBlock({ skill: "roadmap", project: "bakery", draft: "2" }, [
    { id: "001-bootstrap", kind: "section", mark: { state: "ok" } },
    { id: "001.1", kind: "section", mark: { state: "fix", note: "split this\nphase" } },
    { id: "001.1.1", kind: "item", mark: { state: "fix", note: "too big" } },
    { id: "001.1.2", kind: "item", mark: { state: "fix" } },
    { id: "C1", kind: "conflict", mark: { pick: "b", label: "Design 02" } },
    { id: "C2", kind: "conflict", mark: { pick: "other", note: "both wrong" } },
    { id: "O1", kind: "open", mark: { note: "the owner" } },
    { id: "O2", kind: "open", mark: { note: "" } },
    { id: "002-sales", kind: "section" },
    { id: "C3", kind: "conflict", mark: {} },
  ]);
  assert.strictEqual(block, [
    "review-page · roadmap · bakery · draft 2",
    "ok [001-bootstrap]",
    'fix [001.1]: "split this phase"',
    'flag [001.1.1]: "too big"',
    "flag [001.1.2]",
    'pick [C1] = b: "Design 02"',
    'other [C2]: "both wrong"',
    'answer [O1]: "the owner"',
    "not reviewed: O2, 002-sales, C3",
  ].join("\n"));
});

test("copyBlock: every item correct still says no yes and no agree", () => {
  const { ctx } = page();
  const block = ctx.copyBlock({ skill: "context-builder", project: "bakery", draft: "1" },
    ["S1", "S2", "S3"].map((id) => ({ id, kind: "section", mark: { state: "ok" } })));
  assert.doesNotMatch(block, /\byes\b|agree/i);
});

test("the page: marks become the Copy block, progress counts every kind, and marks are kept per draft", () => {
  const p = page();
  assert.strictEqual(p.$("review-out").textContent,
    "review-page · context-builder · bakery · draft 3\nnot reviewed: S1, S1.2, C1, O1");
  assert.strictEqual(p.$("review-progress").textContent, "0 of 4 reviewed");
  p.button("S1", 0).fire("click");
  p.button("S1.2", 1).fire("click");
  type(p.textarea("S1.2"), "it is weekly, not daily");
  const b = p.c1.querySelectorAll('input[type="radio"]')[1];
  b.checked = true; b.fire("change");
  type(p.textarea("O1"), "the owner, in person");
  assert.strictEqual(p.$("review-out").textContent, [
    "review-page · context-builder · bakery · draft 3", "ok [S1]", 'flag [S1.2]: "it is weekly, not daily"',
    'pick [C1] = b: "Design 02"', 'answer [O1]: "the owner, in person"',
  ].join("\n"));
  assert.strictEqual(p.$("review-progress").textContent, "4 of 4 reviewed");
  assert.strictEqual(p.button("S1", 0).getAttribute("aria-pressed"), "true");
  assert.deepStrictEqual([...p.store.keys()], ["review:bakery:context:draft3"]);
  assert.match(p.store.get("review:bakery:context:draft3"), /weekly/);
  p.button("S1", 0).fire("click");
  assert.match(p.$("review-out").textContent, /not reviewed: S1$/, "pressing a mark again clears it");
});

test("the page: a conflict's other choice shows its note and copies it", () => {
  const p = page();
  const note = p.c1.querySelector("textarea[data-note]");
  assert.strictEqual(note.hidden, true);
  const other = p.c1.querySelectorAll('input[type="radio"]')[2];
  other.checked = true; other.fire("change");
  assert.strictEqual(note.hidden, false);
  type(note, "a PIN per clerk");
  assert.match(p.$("review-out").textContent, /^other \[C1\]: "a PIN per clerk"$/m);
});

test("the page: a pick copies the radio's data-label, not its whole label, and quotes inside a note stay one string", () => {
  const p = page({ rich: true });
  const b = p.c1.querySelectorAll('input[type="radio"]')[1];
  b.checked = true; b.fire("change");
  assert.match(p.$("review-out").textContent, /^pick \[C1\] = b: "Design 02"$/m);
  type(p.textarea("S1.2"), 'powers "of the owner"');
  p.button("S1.2", 1).fire("click");
  const line = p.$("review-out").textContent.split("\n").find((l) => l.startsWith("flag [S1.2]"));
  assert.strictEqual(line, 'flag [S1.2]: "powers \\"of the owner\\""');
  assert.strictEqual(JSON.parse(line.slice("flag [S1.2]: ".length)), 'powers "of the owner"');
});

test("the page: a conflict note inside its <label> hides with its label until other is picked", () => {
  const p = page({ rich: true });
  const box = p.c1.querySelector("textarea[data-note]").parentNode;
  assert.strictEqual(box.tagName, "LABEL");
  assert.strictEqual(box.hidden, true);
  const other = p.c1.querySelectorAll('input[type="radio"]')[2];
  other.checked = true; other.fire("change");
  assert.strictEqual(box.hidden, false);
});

test("the page: blocked storage still renders and still copies", async () => {
  const p = page({ storage: "blocked" });
  p.button("S1", 0).fire("click");
  assert.match(p.$("review-out").textContent, /^ok \[S1\]$/m);
  p.$("review-copy").fire("click");
  await tick();
  assert.strictEqual(p.log.copied.length, 1);
});

test("the page: Copy falls back from the clipboard to execCommand, then to a selection the user copies", async () => {
  const viaExec = page({ clipboard: "denied" });
  viaExec.$("review-copy").fire("click");
  await tick();
  assert.match(viaExec.$("review-status").textContent, /^Copied/);
  const manual = page({ clipboard: "none", execCommand: false });
  manual.$("review-copy").fire("click");
  assert.strictEqual(manual.log.selected, 1);
  assert.match(manual.$("review-status").textContent, /Ctrl\+C/);
});

test("the page: Reset asks first, and clears only on yes", () => {
  const keep = page({ confirm: false });
  keep.button("S1", 0).fire("click");
  keep.$("review-reset").fire("click");
  assert.match(keep.$("review-out").textContent, /^ok \[S1\]$/m);
  const clear = page({ confirm: true });
  clear.button("S1", 0).fire("click");
  clear.$("review-reset").fire("click");
  assert.match(clear.$("review-out").textContent, /not reviewed: S1, S1.2, C1, O1$/);
});
