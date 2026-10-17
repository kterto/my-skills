// Tests for the board page and the prototype skeleton: what templates/board.html's one script draws
// and sends, run in node:vm against a small DOM stand-in (no deps). The words a user reads, the Copy
// lines, the clipboard fallbacks and the per-round storage are checked as behaviour, not by grep.
// Run: node --test   (or: node __tests__/template.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const R = require("../scripts/render.cjs");

const SKILL = path.join(__dirname, "..");
const TEMPLATE = fs.readFileSync(path.join(SKILL, "templates", "board.html"), "utf8");
const PROTO = fs.readFileSync(path.join(SKILL, "templates", "prototype.html"), "utf8");
const sample = () => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", "sample-board.json"), "utf8"));
// An exploring board: the look stays empty until agreement, so the sample's Feel is cleared.
const exploring = () => Object.assign(sample(), { status: "exploring", stillToSee: [], feel: { source: "", tiles: [], pick: "", locked: false } });
const OPEN = '<script id="vision-data" type="application/json">';
const seamText = (html) => { const i = html.indexOf(OPEN) + OPEN.length; return html.slice(i, html.indexOf("</script>", i)); };

// --- A DOM stand-in: only the API the board script uses ------------------------------------
class Element {
  constructor(tag, doc) {
    Object.assign(this, { tagName: tag.toUpperCase(), doc, children: [], attrs: {}, listeners: {}, text: "", hidden: false, value: "", parentNode: null });
    this.style = { setProperty: (k, v) => { this.style[k] = v; } };
  }
  appendChild(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
  removeChild(c) { this.children.splice(this.children.indexOf(c), 1); c.parentNode = null; return c; }
  set textContent(t) { this.children = []; this.text = String(t); }
  get textContent() { return this.text + this.children.map((c) => c.textContent).join(""); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  focus() { this.doc.activeElement = this; }
  select() { this.doc.selection = this.value; }
  scrollIntoView() {}
}

// Runs the page's one inline script; returns the drawn tree and the fakes it touched.
function open(html, { storage = new Map(), clipboard, exec = () => true, blockStorage = false } = {}) {
  const doc = { activeElement: null, title: "", copied: [] };
  doc.createElement = (tag) => new Element(tag, doc);
  doc.body = doc.createElement("body");
  const app = doc.body.appendChild(doc.createElement("main"));
  const seam = doc.createElement("script");
  seam.textContent = seamText(html);
  doc.getElementById = (id) => ({ app, "vision-data": seam })[id] || null;
  doc.execCommand = () => { doc.copied.push(doc.selection); return exec(); };
  const localStorage = {
    getItem: (k) => (storage.has(k) ? storage.get(k) : null), setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k), key: (i) => [...storage.keys()][i] ?? null, get length() { return storage.size; },
  };
  const window = blockStorage ? { get localStorage() { throw new Error("SecurityError"); } } : { localStorage };
  vm.runInNewContext(R.inlineScripts(html)[0], { document: doc, window, navigator: clipboard ? { clipboard } : {} });
  return { doc, app, storage };
}

const all = (n, out = []) => { out.push(n); n.children.forEach((c) => all(c, out)); return out; };
const find = (root, pred) => all(root).find(pred);
const byData = (root, id) => find(root, (n) => n.attrs["data-id"] === id);
const button = (root, text) => find(root, (n) => n.tagName === "BUTTON" && n.textContent === text);
const input = (root, label) => find(root, (n) => n.tagName === "LABEL" && n.children[0] && n.children[0].textContent.trim() === label).children[1];
const section = (app, key) => find(app, (n) => n.attrs["data-section"] === key);
const click = (n) => { assert.ok(n, "nothing to click"); (n.listeners.click || []).forEach((f) => f()); };
const type = (n, v) => { n.value = v; (n.listeners.input || []).forEach((f) => f()); };
const tick = () => new Promise((r) => setImmediate(r));
// What a reader sees: text and accessible labels, minus the Copy preview (its lines name ids on purpose).
const words = (root) => all(root).filter((n) => !/\blines\b/.test(n.className || "")).flatMap((n) => [n.text, n.attrs["aria-label"] || ""]).join("\n");
const staticText = (html) => html.replace(/<script\b[\s\S]*?<\/script>|<style>[\s\S]*?<\/style>|<!--[\s\S]*?-->|<[^>]+>/g, " ");

function boards() {
  const r1 = exploring();
  Object.assign(r1, { round: 1, step: 1, pick: { id: "", miss: "" }, changed: [] });
  r1.open.push({ id: "T1", kind: "tension", text: "Bruno is 10 days late on Friday evening: send now, or wait for your OK on Monday?", options: ["Send now", "Wait for my OK"], who: "me" });
  r1.features[1].source = "guess";
  const draft = Object.assign(exploring(), { status: "draft", outcome: "Solved without building: a pinned FAQ" });
  return { agreed: sample(), round1: r1, draft, teachBack: Object.assign(exploring(), { agreement: { ...sample().agreement, teach: "", items: [] } }) };
}

// --- The template's side of the render contract --------------------------------------------

test("template: one seam, one executable script, no markup or network APIs reachable from data", () => {
  assert.strictEqual(TEMPLATE.split(R.SEAM).length, 2, "the seam element appears exactly once");
  assert.strictEqual(TEMPLATE.split("<script").length, 3, "no <script text besides the seam and the one script");
  const js = R.inlineScripts(TEMPLATE);
  assert.strictEqual(js.length, 1);
  assert.doesNotMatch(js[0], /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/, "text goes in through textContent only");
  assert.doesNotMatch(TEMPLATE, /https?:\/\/|\son[a-z]+\s*=\s*["']|javascript:/i, "no remote URL, inline handler or javascript: URL");
  const page = R.renderHtml(TEMPLATE, sample(), { links: [{ kind: "prototype", href: "prototype/nudge-preview.html" }] });
  assert.deepStrictEqual(R.check(page.replace(seamText(page), "{}")).filter((p) => /^(csp|net|js)\./.test(p)), []);
});

test("template: renders a notice, not a broken page, when opened unfilled or with scripts off", () => {
  const { app } = open(TEMPLATE);
  assert.match(words(app), /empty template\. Open docs\/vision\/index\.html/);
  assert.match(TEMPLATE, /<noscript>[^<]*<p[^>]*>This page needs JavaScript[^<]*answer in chat/);
});

// --- What the reader sees -------------------------------------------------------------------

const BANNED = /\bcontext-builder\b|\bvoices?\b|\btensions?\b|fail(?:ure)? condition|\breserved\b|\bloss\b|\bv1\b|\bAGREE\b|\bparked\b|\bkilled\b|\bpending\b|\bconcepts?\b|\bbreadboards?\b|\bschema\b|\bjson\b|\bundefined\b|\bnull\b|\[object/;

test("plain words: no internal jargon on any page the user or a colleague reads", () => {
  for (const [name, b] of Object.entries(boards())) for (const forName of [null, "Ana"]) {
    if (name === "agreed" && forName) continue; // agreed boards are not shared for marking
    const html = R.renderHtml(TEMPLATE, b, { forName, links: [{ kind: "tokens", href: "design/tokens.css" }] });
    const { app, doc } = open(html);
    for (const text of [words(app), doc.title, staticText(TEMPLATE)]) {
      const hit = text.match(BANNED);
      assert.ok(!hit, `${name}${forName ? " (for Ana)" : ""}: "${hit && hit[0]}" reaches the reader in: ${hit && text.slice(Math.max(0, hit.index - 60), hit.index + 40)}`);
    }
  }
});

test("ids live in data attributes only; every card is reachable by its id", () => {
  for (const b of [exploring(), sample()]) {
    const { app } = open(R.renderHtml(TEMPLATE, b));
    const ids = [...b.concepts, ...b.screens, ...b.features, ...b.open, ...b.feel.tiles].map((x) => x.id);
    const seen = words(app);
    for (const id of ids) {
      assert.ok(byData(app, id), `no element carries data-id="${id}"`);
      assert.doesNotMatch(seen, new RegExp(`\\b${id}\\b`), `${id} is visible text`);
    }
  }
});

test("an id or text that names an Object member draws the whole page", () => {
  const b = exploring();
  b.features[6].id = "constructor";
  b.agreement.couldWait = ["constructor", "toString"];
  const { app } = open(R.renderHtml(TEMPLATE, b));
  assert.deepStrictEqual(all(app).filter((n) => n.attrs["data-section"]).map((n) => n.attrs["data-section"]), ["heard", "dirs", "walk", "in", "open", "agree", "look"]);
  assert.ok(button(app, "Copy"), "the Copy dock is drawn");
  assert.match(words(app), /Could wait\s*Card payments, toString/);
});

test("what I heard: tone and appetite read as one plain line; notes and themes stay apart", () => {
  const { app } = open(R.renderHtml(TEMPLATE, exploring()));
  const heard = words(section(app, "heard"));
  assert.match(heard, /How it should feel: "calm", "not pushy" · How much time: a month, tops/);
  assert.doesNotMatch(heard, /bank's app/, "notes are for the PRD, not the page");
  assert.match(words(app), /getting paid ×3 · client notes ×1\n/);
});

test("the page shows each part with the user's real wording", () => {
  const { app, doc } = open(R.renderHtml(TEMPLATE, sample(), { links: [{ kind: "agreement", href: "../foundation/PRD-freelance-money.md" }] }));
  const seen = words(app);
  assert.strictEqual(doc.title, "Freelance money · Round 4");
  for (const s of ["Round 4", "Agreed, waiting on Rita", "Your turn (1)", "Should a nudge mention the late fee?",
    "A sketch on purpose: tell me what's wrong, not how it looks.", "getting paid ×3", "Bruno was 45 days late; I felt like a debt collector.",
    "outside what you said", "your words", "Hi Bruno, just a friendly nudge about invoice 14.", "4 screens", "First version", "Later",
    "Who owes me, by date", "Rita decides.", "Before we can agree", "This page can't agree for you: say yes in chat.",
    "No card payments.", "Quiet ledger", "paper and ink, one calm green"]) assert.ok(seen.includes(s), `missing "${s}"`);
  const a = find(app, (n) => n.tagName === "A");
  assert.strictEqual(a.attrs.href, "../foundation/PRD-freelance-money.md");
});

test("links: only relative hrefs are drawn, whatever the view carries", () => {
  const links = [{ kind: "tokens", href: "design/tokens.css" }, { kind: "prototype", href: "https://example.com/x.html" },
    { kind: "prototype", href: "//example.com/x.html" }, { kind: "prototype", href: "/etc/x.html" }, { kind: "prototype", href: "prototype/a.html" }];
  const { app } = open(R.renderHtml(TEMPLATE, exploring(), { links }));
  const hrefs = all(app).filter((n) => "href" in n.attrs).map((n) => n.attrs.href);
  assert.deepStrictEqual([...new Set(hrefs)].sort(), ["design/tokens.css", "prototype/a.html"]);
});

test("sections not central to the round collapse; Your turn's targets stay open", () => {
  const { round1, agreed, teachBack } = boards();
  const openKeys = (b) => all(open(R.renderHtml(TEMPLATE, b)).app).filter((n) => n.attrs["data-section"] && n.open).map((n) => n.attrs["data-section"]);
  assert.deepStrictEqual(openKeys(round1), ["heard", "dirs", "in", "open"]);
  assert.deepStrictEqual(openKeys(agreed), ["open", "agree", "look"]);
  const r2 = Object.assign(exploring(), { round: 2, step: 2, agreement: { ...sample().agreement, teach: "", items: [] }, open: [] });
  assert.deepStrictEqual(openKeys(r2), ["walk"]);
  assert.ok(openKeys(teachBack).includes("agree"));
  const small = Object.assign(JSON.parse(JSON.stringify(r2)), { features: r2.features.slice(0, 5) });
  assert.deepStrictEqual(openKeys(small), ["walk", "in"], "with 6 cards or fewer, sorting shares the Try it round");
});

test("the step is the board's, not the round's: an extra round keeps its own step", () => {
  const header = (b) => { const { app } = open(R.renderHtml(TEMPLATE, b)); return words(find(app, (n) => n.tagName === "HEADER")); };
  const blank = { ...sample().agreement, teach: "", oneFlow: "", couldWait: [], annoy: "", items: [] };
  const tryIt = Object.assign(exploring(), { round: 3, step: 2, agreement: blank, open: [], features: exploring().features.slice(0, 5) });
  assert.match(header(tryIt), /Step 2 of about 4: Try it and sort what's in/);
  assert.match(header(tryIt), /Current intent \(my read\):\s+Get paid on time/);
  const turn = find(open(R.renderHtml(TEMPLATE, tryIt)).app, (n) => n.className === "turn");
  assert.match(words(turn), /Your turn \(1\)\s+Walk the flow and tell me what's wrong, or say it's fine/, "a Try it round never reads 'Nothing to decide'");
  const sorting = Object.assign(exploring(), { round: 5, step: 3, agreement: blank });
  sorting.open.push({ id: "T1", kind: "tension", text: "Send now, or wait for your OK?", options: [], who: "me" });
  assert.match(header(sorting), /Step 3 of about 4: Sort what's in/);
  assert.doesNotMatch(header(sorting), /stays hidden/);
});

test("the intent line hides during the teach-back and returns once it is said", () => {
  const { teachBack } = boards();
  assert.doesNotMatch(words(open(R.renderHtml(TEMPLATE, teachBack)).app), /Current intent|Get paid on time/);
  assert.match(words(open(R.renderHtml(TEMPLATE, exploring())).app), /Current intent \(my read\):\s+Get paid on time/);
});

test("try it: the walk follows next and go, one screen at a time", () => {
  const { app } = open(R.renderHtml(TEMPLATE, exploring()));
  const shown = () => ["W1", "W2", "W3", "W4"].filter((id) => !byData(app, id).hidden);
  assert.deepStrictEqual(shown(), ["W1"]);
  click(button(byData(app, "W1"), "Next: Draft a nudge"));
  assert.deepStrictEqual(shown(), ["W2"]);
  click(find(byData(app, "C2"), (n) => n.attrs["data-go"] === "W3"));
  assert.deepStrictEqual(shown(), ["W3"]);
  assert.strictEqual(section(app, "walk").open, true, "a go from a direction opens Try it");
  click(button(section(app, "walk"), "Back"));
  assert.deepStrictEqual(shown(), ["W2"]);
});

// --- Copy: the lines, the order of fallbacks, the wait for a miss ----------------------------

test("copy: one line per mark in the agreed format, headed by round and who answers", async () => {
  let sent = null;
  const { app } = open(R.renderHtml(TEMPLATE, exploring()), { clipboard: { writeText: (t) => { sent = t; return Promise.resolve(); } } });
  click(button(byData(app, "C1"), "Pick this"));
  type(input(app, "What you'd miss"), "the overdue list");
  click(button(byData(app, "F4"), "First version"));
  type(input(byData(app, "W3"), "Wrong or missing here?"), "can I see it\nbefore it goes?");
  click(button(byData(app, "Q1"), "After 30 days"));
  click(button(byData(app, "F6"), "undo it"));
  click(button(app, "Copy"));
  await tick();
  assert.strictEqual(sent, [
    "envision · round 4 · from: me",
    "picked: Client hub [C1]",
    'would miss: "the overdue list"',
    '"Send reminders automatically" [F4]: first version',
    'note on "Preview before it goes" [W3]: "can I see it before it goes?"',
    'answer to "Should a nudge mention the late fee?" [Q1]: "After 30 days"',
    '"Mark as paid" [F6]: I\'ll need to undo it',
  ].join("\n"));
  assert.match(words(app), /Copied\. Paste it in chat\./);
});

test("copy: choosing the board's current answer again sends nothing", async () => {
  let sent = null;
  const { app } = open(R.renderHtml(TEMPLATE, exploring()), { clipboard: { writeText: (t) => { sent = t; return Promise.resolve(); } } });
  click(button(byData(app, "C2"), "Pick this"));
  click(button(byData(app, "F4"), "Later"));
  click(button(byData(app, "F4"), "No"));
  click(button(byData(app, "F4"), "No"));
  assert.strictEqual(button(byData(app, "F4"), "Later").attrs["aria-pressed"], "true");
  click(button(app, "Copy"));
  await tick();
  assert.strictEqual(sent, null);
  assert.match(words(app), /Nothing marked yet/);
});

test("copy: a new pick waits once for what you'd miss, then sends", async () => {
  let sent = null;
  const { app, doc } = open(R.renderHtml(TEMPLATE, exploring()), { clipboard: { writeText: (t) => { sent = t; return Promise.resolve(); } } });
  click(button(byData(app, "C3"), "Pick this"));
  click(button(app, "Copy"));
  await tick();
  assert.strictEqual(sent, null);
  assert.strictEqual(doc.activeElement, input(app, "What you'd miss"));
  click(button(app, "Copy"));
  await tick();
  assert.strictEqual(sent, "envision · round 4 · from: me\npicked: Paid on booking [C3]");
  click(button(app, "Nothing"));
  click(button(app, "Copy"));
  await tick();
  assert.match(sent, /\nwould miss: "nothing"$/);
});

test("copy: no clipboard API falls back to execCommand", () => {
  const { app, doc } = open(R.renderHtml(TEMPLATE, exploring()));
  click(button(byData(app, "C1"), "Not this one"));
  click(button(app, "Copy"));
  assert.deepStrictEqual(doc.copied, ["envision · round 4 · from: me\nnot this one: Client hub [C1]"]);
  assert.match(words(app), /Copied\./);
});

test("copy: a refused clipboard and execCommand leave the lines pre-selected", async () => {
  const { app, doc } = open(R.renderHtml(TEMPLATE, exploring()), { clipboard: { writeText: () => Promise.reject(new Error("denied")) }, exec: () => false });
  type(input(app, "A note (on its own it changes nothing)"), "warmer, please");
  click(button(app, "Copy"));
  await tick();
  const manual = find(app, (n) => n.tagName === "TEXTAREA" && n.attrs["aria-label"] === "Lines to copy");
  assert.strictEqual(manual.hidden, false);
  assert.strictEqual(manual.value, 'envision · round 4 · from: me\nnote: "warmer, please"');
  assert.strictEqual(doc.selection, manual.value);
  assert.match(words(app), /press Ctrl\+C/);
});

// --- Storage: per project and round, never reapplied across rounds ---------------------------

test("storage: marks survive a reload of the same round", () => {
  const storage = new Map();
  const html = R.renderHtml(TEMPLATE, exploring());
  click(button(byData(open(html, { storage }).app, "C1"), "Pick this"));
  assert.ok(storage.has("envision:Freelance money:4"));
  const again = open(html, { storage }).app;
  assert.strictEqual(button(byData(again, "C1"), "Pick this").attrs["aria-pressed"], "true");
  assert.match(words(again), /1 mark\b/);
});

test("storage: an older round's unsent marks are shown, never applied; sent ones are dropped", async () => {
  const storage = new Map([
    ["envision:Freelance money:3", JSON.stringify({ marks: { pick: "C1" }, text: "envision · round 3 · from: me\npicked: Client hub [C1]", sent: false })],
    ["envision:Freelance money:2", JSON.stringify({ marks: { pick: "C3" }, text: "envision · round 2 · from: me\npicked: Paid on booking [C3]", sent: true })],
    ["envision:Other project:3", JSON.stringify({ marks: { pick: "C1" }, text: "x", sent: false })],
  ]);
  let sent = null;
  const { app } = open(R.renderHtml(TEMPLATE, exploring()), { storage, clipboard: { writeText: (t) => { sent = t; return Promise.resolve(); } } });
  assert.match(words(app), /You marked the round 3 page and didn't send it/);
  assert.doesNotMatch(words(app), /round 2 page/);
  assert.ok(!storage.has("envision:Freelance money:2"), "a sent round is cleaned up");
  assert.strictEqual(button(byData(app, "C1"), "Pick this").attrs["aria-pressed"], "false", "old marks are not applied");
  assert.match(words(app), /No marks yet/);
  click(button(app, "Copy them as they were"));
  await tick();
  assert.strictEqual(sent, "envision · round 3 · from: me\npicked: Client hub [C1]");
  assert.ok(!storage.has("envision:Freelance money:3"));
  assert.ok(storage.has("envision:Other project:3"), "another project's marks are left alone");
});

test("storage: a blocked store still draws the page and copies", async () => {
  let sent = null;
  const { app } = open(R.renderHtml(TEMPLATE, exploring()), { blockStorage: true, clipboard: { writeText: (t) => { sent = t; return Promise.resolve(); } } });
  click(button(byData(app, "C1"), "Not this one"));
  click(button(app, "Copy"));
  await tick();
  assert.match(sent, /not this one: Client hub \[C1\]/);
});

// --- Share copies ---------------------------------------------------------------------------

test("share copy: the name is fixed, What I heard is gone, the lines say who sent them", async () => {
  let sent = null;
  const storage = new Map();
  const { app } = open(R.renderHtml(TEMPLATE, exploring(), { forName: "Ana" }), { storage, clipboard: { writeText: (t) => { sent = t; return Promise.resolve(); } } });
  const seen = words(app);
  assert.match(seen, /Answering as: Ana/);
  assert.ok(!find(app, (n) => n.tagName === "INPUT" && n.parentNode.textContent.startsWith("Answering as")), "the name cannot be retyped");
  assert.ok(!section(app, "heard"), "What I heard is not in a share copy");
  assert.doesNotMatch(seen, /^(?:you said|you picked|my guess)$|Where did this come from|So far you said|Design:|Before we can agree|How it should feel/m, "no provenance and no owner-only lines");
  assert.match(seen, /Rita decides\./);
  click(button(byData(app, "F5"), "First version"));
  click(button(app, "Copy"));
  await tick();
  assert.strictEqual(sent, 'envision · round 4 · from: Ana\n"Client notes" [F5]: first version');
  assert.ok(storage.has("envision:Freelance money:4:Ana"), "a share copy keeps its marks apart from the owner's");
});

// --- The prototype skeleton -----------------------------------------------------------------

test("prototype skeleton: fails check only on its example text, and carries design-to-code's five channels", () => {
  assert.deepStrictEqual(R.check(PROTO).map((p) => p.split(":")[0]), ["placeholder"], "a copied skeleton must not pass as a real screen");
  for (const marker of [/TOKENS — mirrored from \.\.\/design\/tokens\.css/, /<!-- PANEL 1 — /, /<!-- PANEL 2 — Component gallery/,
    /because "[^"]+" \(R\d+, said\)/, /out of scope here/, /EDITMODE-BEGIN[\s\S]*EDITMODE-END/, /data-state="empty"/, /data-state="error"/])
    assert.match(PROTO, marker);
  assert.doesNotMatch(staticText(PROTO), BANNED);
});
