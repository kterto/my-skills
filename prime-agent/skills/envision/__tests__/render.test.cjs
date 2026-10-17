// Tests for envision's one executable boundary: the functions render.cjs runs, plus its CLI, and the
// skill's own section pointers. Each test feeds a broken input and asserts the refusal, so a gate
// that stops gating fails here.
// Run: node --test   (or: node __tests__/render.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const R = require("../scripts/render.cjs");

const SKILL = path.join(__dirname, "..");
const SCRIPT = path.join(SKILL, "scripts", "render.cjs");
const FIX = path.join(__dirname, "fixtures");
const TEMPLATE = fs.readFileSync(path.join(SKILL, "templates", "board.html"), "utf8");
const PROTO_TEMPLATE = fs.readFileSync(path.join(SKILL, "templates", "prototype.html"), "utf8");
const GOOD_PROTO = fs.readFileSync(path.join(FIX, "prototype-good.html"), "utf8");
const OPEN = '<script id="vision-data" type="application/json">';
const CSP_V2 = (tok) => `default-src 'none'; script-src ${tok}; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'`;

const sample = () => JSON.parse(fs.readFileSync(path.join(FIX, "sample-board.json"), "utf8"));
// An exploring board: the look stays empty until agreement, so the sample's Feel is cleared.
const exploring = () => Object.assign(sample(), { status: "exploring", stillToSee: [], feel: { source: "", tiles: [], pick: "", locked: false } });
const render = (board, opts) => R.renderHtml(TEMPLATE, board, opts);
const seamText = (html) => { const i = html.indexOf(OPEN) + OPEN.length; return html.slice(i, html.indexOf("</script>", i)); };
const seam = (html) => JSON.parse(seamText(html));
const refusal = (fn) => { try { fn(); } catch (e) { return e; } return assert.fail("expected a refusal"); };
const refusedWith = (board, re) => {
  const e = refusal(() => render(board));
  assert.strictEqual(e.exit, 1, `exit 1 expected, got ${e.exit}: ${e.message}`);
  assert.match([e.message, ...e.lines].join("\n"), re);
};
const failing = (board) => R.ready(board).filter((c) => !c.ok).map((c) => c.code);
// Re-seals a page's script-src as `render.cjs bake` does, so each mutation breaks one rule only.
const reseal = (html) => {
  const token = `'sha256-${crypto.createHash("sha256").update(R.inlineScripts(html)[0], "utf8").digest("base64")}'`;
  return html.replace(/script-src [^;"]*/, () => `script-src ${token}`);
};
const cli = (args, cwd) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd, encoding: "utf8" });
function project(board) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envision-"));
  fs.mkdirSync(path.join(dir, "docs", "vision"), { recursive: true });
  fs.writeFileSync(path.join(dir, "docs", "vision", "board.json"), JSON.stringify(board, null, 2));
  return dir;
}

// --- The sample is the schema document, so it must stay valid and exercise every key -------

test("the sample board is valid, agreed and ready", () => {
  const b = sample();
  assert.deepStrictEqual(R.validate(b), []);
  assert.deepStrictEqual(failing(b), []);
  assert.ok(render(b).includes(OPEN));
});

test("the sample exercises every list (an empty list would hide its item shape)", () => {
  const walk = (v, at) => {
    if (Array.isArray(v)) { assert.ok(v.length > 0, `${at} is empty in the sample`); v.forEach((x, i) => walk(x, `${at}[${i}]`)); }
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, `${at}.${k}`);
  };
  walk(sample(), "board");
});

// --- Seam: escaped JSON, replaced exactly once --------------------------------------------

const PAYLOAD = "</script><script>x()</script><!--&\u2028\u2029";
// Ids, enums and references are not free text: they are checked by pattern, never shown raw.
const STRUCTURAL = new Set(["$comment", "id", "status", "bucket", "source", "kind", "type", "feature", "go", "outcome", "pick"]);
const STRUCTURAL_LISTS = new Set(["next", "swatches"]);

test("seam: </script><script> and <!-- in every user-text field stay inside the data", () => {
  const b = exploring();
  const paths = [];
  const inject = (v, at) => {
    for (const [k, x] of Object.entries(v)) {
      if ((typeof x === "string" && STRUCTURAL.has(k)) || STRUCTURAL_LISTS.has(k)) continue;
      if (typeof x === "string") { v[k] = PAYLOAD; paths.push(`${at}.${k}`); }
      else if (Array.isArray(x) && x.every((s) => typeof s === "string")) x.forEach((_, i) => { x[i] = PAYLOAD; paths.push(`${at}.${k}[${i}]`); });
      else if (x && typeof x === "object") inject(x, `${at}.${k}`);
    }
  };
  inject(b, "board");
  assert.ok(paths.length > 60, `only ${paths.length} user-text fields were reached`);
  const html = render(b);
  const raw = seamText(html);
  assert.doesNotMatch(raw, /[<>&\u2028\u2029]/, "raw < > & U+2028 U+2029 must not survive in the seam");
  assert.strictEqual(html.split("<script").length, TEMPLATE.split("<script").length, "no script element was added");
  const got = seam(html).board;
  for (const p of paths) {
    const value = p.replace(/^board\./, "").split(/\.|\[|\]\.?/).filter(Boolean).reduce((o, k) => o[k], { ...got, concepts: b.concepts.map((c) => got.concepts.find((x) => x.id === c.id)) });
    assert.strictEqual(value, PAYLOAD, `${p} did not round-trip`);
  }
});

test("seam: a draft outcome carrying markup stays inside the data", () => {
  const b = Object.assign(exploring(), { status: "draft", outcome: `Not building it: ${PAYLOAD}` });
  const html = render(b);
  assert.doesNotMatch(seamText(html), /[<>&]/);
  assert.strictEqual(seam(html).board.outcome, `Not building it: ${PAYLOAD}`);
});

test("seam: the element is replaced exactly once; a template with none or two is refused", () => {
  const html = render(sample());
  assert.strictEqual(html.split(OPEN).length, 2);
  assert.ok(!html.includes("/*__VISION_DATA__*/</script>"), "placeholder element left behind");
  for (const broken of [TEMPLATE.replace(R.SEAM, ""), TEMPLATE.replace(R.SEAM, R.SEAM + R.SEAM)]) {
    const e = refusal(() => R.renderHtml(broken, sample()));
    assert.strictEqual(e.exit, 2);
    assert.match(e.message, /seam/);
  }
});

// --- CSP: the baked hash and a network-denying policy -------------------------------------

test("the baked script-src hash matches the template's one inline script", () => {
  const scripts = [...TEMPLATE.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((m) => !/application\/json/.test(m[1]));
  assert.strictEqual(scripts.length, 1, "the board template has exactly one executable script");
  const want = `'sha256-${crypto.createHash("sha256").update(scripts[0][2], "utf8").digest("base64")}'`;
  assert.ok(TEMPLATE.includes(`content="${CSP_V2(want)}"`), `template CSP must be exactly v2 §5 with ${want}`);
  const stale = TEMPLATE.replace(scripts[0][2], () => `${scripts[0][2]}\n`);
  const e = refusal(() => R.renderHtml(stale, sample()));
  assert.strictEqual(e.exit, 2);
  assert.match(e.message, /bake/);
  assert.ok(R.renderHtml(reseal(stale), sample()), "a re-sealed template renders again");
});

test("the rendered page carries the v2 CSP and loads nothing from the network", () => {
  const html = render(sample());
  const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]*)"/)[1];
  assert.match(csp, /^default-src 'none'; script-src 'sha256-[A-Za-z0-9+/=]+'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'$/);
  assert.doesNotMatch(csp, /connect-src|https?:|\*/);
  const page = html.replace(seamText(html), "{}");
  assert.deepStrictEqual(R.check(page).filter((p) => /^(csp|net|js)\./.test(p)), []);
  const leaky = [page.replace("</head>", '<img src="https://example.com/x.png"></head>'), page.replace("default-src 'none';", "default-src 'none'; connect-src https:;")];
  assert.ok(R.check(leaky[0]).some((p) => p.startsWith("net.remote")));
  assert.ok(R.check(leaky[1]).some((p) => p.startsWith("csp.connect")));
});

// --- Directions contract and the shuffle --------------------------------------------------

test("directions: 2-4 concepts, exactly one outside, at most one of yours", () => {
  const b = exploring();
  const extra = (id) => Object.assign(JSON.parse(JSON.stringify(b.concepts[1])), { id });
  refusedWith(Object.assign(exploring(), { concepts: [b.concepts[1]], pick: { id: "", miss: "" } }), /need 2-4 directions, found 1/);
  refusedWith(Object.assign(exploring(), { concepts: [...b.concepts, extra("C4"), extra("C5")] }), /need 2-4 directions, found 5/);
  refusedWith(Object.assign(exploring(), { concepts: b.concepts.map((c) => ({ ...c, outside: false })) }), /exactly one direction .*outside.*found 0/);
  refusedWith(Object.assign(exploring(), { concepts: b.concepts.map((c) => ({ ...c, outside: c.id !== "C1" })) }), /found 2/);
  refusedWith(Object.assign(exploring(), { concepts: b.concepts.map((c) => ({ ...c, yours: c.id !== "C3" })) }), /at most one direction .*your words/);
  refusedWith(Object.assign(exploring(), { concepts: b.concepts.map((c) => ({ ...c, yours: c.outside })) }), /both "your words" and "outside/);
  assert.ok(render(Object.assign(exploring(), { concepts: [...b.concepts, extra("C4")] })));
});

test("shuffle: stable within a round, never your words first, and it does move", () => {
  const firsts = new Set();
  for (const n of [2, 3, 4]) for (let round = 1; round <= 120; round++) {
    const b = Object.assign(exploring(), { round });
    if (n === 2) b.concepts = b.concepts.slice(1).map((c) => ({ ...c, yours: c.id === "C2" }));
    if (n === 4) b.concepts.push(Object.assign(JSON.parse(JSON.stringify(b.concepts[1])), { id: "C4" }));
    const order = seam(render(b)).board.concepts.map((c) => c.id);
    assert.ok(!seam(render(b)).board.concepts[0].yours, `round ${round}, ${n} cards: your words came first`);
    const edited = JSON.parse(JSON.stringify(b));
    edited.concepts.reverse().forEach((c) => { c.title += " (edited)"; });
    assert.deepStrictEqual(seam(render(edited)).board.concepts.map((c) => c.id), order, "re-render of the same round reordered");
    firsts.add(`${n}:${order[0]}`);
  }
  assert.ok(firsts.size >= 6, `the shuffle barely moves (${[...firsts]})`);
});

test("shuffle: with no card of yours, every order of three turns up across rounds", () => {
  const orders = new Set();
  for (let round = 1; round <= 60; round++) {
    const b = Object.assign(exploring(), { round });
    b.concepts.forEach((c) => { c.yours = false; });
    orders.add(seam(render(b)).board.concepts.map((c) => c.id).join(""));
  }
  assert.strictEqual(orders.size, 6, `only ${[...orders]} turned up`);
});

// --- ready(): each condition blocks on its own --------------------------------------------

const READY_CASES = [
  ["ready.pick", (b) => { b.pick.miss = ""; }],
  ["ready.tension", (b) => { b.open.push({ id: "T1", kind: "tension", text: "Calm vs automatic sending", options: ["Wait for my OK", "Send at once"], who: "me" }); }],
  ["ready.guess", (b) => { b.features[5].source = "guess"; }],
  ["ready.answers", (b) => { b.agreement.teach = " "; }],
  ["ready.couldWait", (b) => { b.agreement.couldWait = []; }],
  ["ready.couldWait", (b) => { b.agreement.couldWait = ["F6"]; }],
  ["ready.oneFlow", (b) => { b.agreement.oneFlow = "F5"; }],
  ["ready.oneFlow", (b) => { b.agreement.annoy = "F3"; }],
  ["ready.items", (b) => { b.agreement.items = Array.from({ length: 10 }, (_, i) => `item ${i}`); }],
  ["ready.items", (b) => { b.agreement.items = []; }],
];

READY_CASES.forEach(([code, breakIt], i) => {
  test(`ready(): ${code} fails alone (case ${i})`, () => {
    const b = sample();
    breakIt(b);
    assert.deepStrictEqual(failing(b), [code]);
    refusedWith(b, new RegExp(`status is "agreed" but[\\s\\S]*${code.replace(".", "\\.")}`));
    const shown = seam(render(Object.assign(b, { status: "exploring", stillToSee: [], feel: exploring().feel })));
    assert.deepStrictEqual(shown.view.ready.filter((c) => !c.ok).map((c) => c.code), [code], "exploring renders and shows the failing line");
  });
});

test("ready(): 'none' is a fine annoy, and a reason is a fine could-wait", () => {
  const b = sample();
  b.agreement.annoy = "None";
  b.agreement.couldWait = ["none, because the board is already small"];
  assert.deepStrictEqual(failing(b), []);
});

test("agreed needs the user's own yes", () => {
  const b = sample();
  b.agreement.yes = "";
  refusedWith(b, /agreement\.yes/);
});

// --- "Your turn": the 7-decision cap -------------------------------------------------------

test("your turn: 7 decisions render, 8 are refused, other people's do not count", () => {
  const ask = (i, who) => ({ id: `Q${i + 10}`, kind: "decision", text: `Decision ${i}`, options: [], who });
  const b = exploring();
  b.open = Array.from({ length: 6 }, (_, i) => ask(i, i % 2 ? "me" : "")).concat([ask(20, "Rita"), ask(21, "Bruno")]);
  b.pick.miss = "";
  assert.strictEqual(seam(render(b)).view.turn.length, 7);
  b.open.push(ask(30, "me"));
  refusedWith(b, /"Your turn" has 8 decisions; keep it to 7/);
});

test("your turn: a Try it round asks for the walk; another person answers only what names them", () => {
  const b = Object.assign(exploring(), { step: 2 });
  assert.deepStrictEqual(R.yourTurn(b).map((t) => t.kind), ["walk", "decision"]);
  b.pick.miss = "";
  b.features[1].source = "guess";
  assert.deepStrictEqual(R.yourTurn(b, "Rita").map((t) => t.refs[0]), ["Q2"]);
});

test("your turn: an unpicked board asks for the pick, and First version guesses ask once", () => {
  const b = exploring();
  b.pick = { id: "", miss: "" };
  b.features[0].source = "guess";
  b.features[1].source = "guess";
  const kinds = seam(render(b)).view.turn.map((t) => t.kind);
  assert.deepStrictEqual(kinds, ["pick", "decision", "guess"]);
});

// --- Schema and the sketch whitelist -------------------------------------------------------

test("sketch: a colour, font or size field is refused", () => {
  for (const field of ["color", "font", "size", "style", "width"]) {
    const b = exploring();
    b.screens[0].wireframe.children[0][field] = "x";
    refusedWith(b, new RegExp(`screens\\[0\\]\\.wireframe\\.children\\[0\\]\\.${field}: not a sketch field`));
  }
});

test("sketch: unknown parts, long labels or copy, and dangling ids are refused", () => {
  const cases = [
    [(b) => { b.concepts[0].home.children[0].type = "chart"; }, /"chart" is not a sketch part/],
    [(b) => { b.concepts[0].home.children[0].label = "x".repeat(41); }, /label: 1-40 characters/],
    [(b) => { b.concepts[0].home.children[0].copy = "x".repeat(121); }, /copy: at most 120 characters/],
    [(b) => { b.screens[0].wireframe.children[1].feature = "F99"; }, /no feature card "F99"/],
    [(b) => { b.screens[0].wireframe.children[2].go = "W99"; }, /no screen "W99"/],
    [(b) => { b.screens[0].wireframe.label = "Board"; }, /wireframe\.label: not a sketch field/],
    [(b) => { b.screens[0].next = ["W9"]; }, /next\[0\]: no screen "W9"/],
  ];
  for (const [breakIt, re] of cases) { const b = exploring(); breakIt(b); refusedWith(b, re); }
});

test("schema: unknown or missing keys, bad enums and unsourced quotes are refused", () => {
  const cases = [
    [(b) => { b.concept = []; }, /^concept: not a board field/m],
    [(b) => { delete b.intent; }, /^intent: missing/m],
    [(b) => { b.status = "parked"; }, /^status: expected one of/m],
    [(b) => { b.features[0].bucket = "v1"; }, /features\[0\]\.bucket: expected one of/],
    [(b) => { b.features[0].quote = ""; }, /a "said" card carries the user's own words/],
    [(b) => { b.pick.id = "C9"; }, /pick\.id: no direction "C9"/],
    [(b) => { b.features[1].id = "C1"; }, /"C1" is already used/],
    [(b) => { b.feel = sample().feel; b.feel.tiles[0].swatches[0] = "url(https://x)"; }, /expected a #rrggbb colour/],
    [(b) => { b.step = 5; }, /^step: expected one of 1 \| 2 \| 3 \| 4/m],
    [(b) => { delete b.tone; }, /^tone: missing/m],
    [(b) => { b.open.push({ id: "T9", kind: "tension", text: "Calm vs automatic", options: [], who: "" }); }, /open\[2\]\.who: a tension is the owner's to settle/],
    [(b) => { b.agreement.items = ["The board shows who owes me.", " "]; }, /^agreement\.items\[1\]: empty/m],
    [(b) => { b.feel = sample().feel; }, /^feel: the look comes after agreement/m],
    [(b) => { b.status = "draft"; }, /^outcome: a draft carries/m],
    [(b) => { b.outcome = "On hold"; }, /^outcome: only a draft carries an outcome/m],
  ];
  for (const [breakIt, re] of cases) { const b = exploring(); breakIt(b); refusedWith(b, re); }
});

test("schema: a key named after an Object member is refused, at the top and inside", () => {
  const text = JSON.stringify(exploring())
    .replace(/^\{/, '{"constructor":"x","__proto__":{"polluted":true},"toString":"y",')
    .replace('"pick":{', '"pick":{"hasOwnProperty":"z","valueOf":"w",');
  const b = JSON.parse(text);
  const errs = R.validate(b);
  for (const k of ["constructor", "__proto__", "toString", "pick.hasOwnProperty", "pick.valueOf"]) assert.ok(errs.includes(`${k}: not a board field`), `${k} slipped through: ${errs}`);
  const c = exploring();
  c.agreement.couldWait = ["constructor"];
  c.features[6].id = "constructor";
  assert.deepStrictEqual(R.validate(c), [], "an id or text that names an Object member is just text");
});

// --- Share copies --------------------------------------------------------------------------

// The owner's own words, planted where a share copy must not carry them.
const PRIVATE = ["honestly I will miss nagging Bruno", "do not tell Rita it is because of her", "you said calm but also send it for me",
  "I already send invoices from my bank's app", "a month, tops", "not pushy"];
function privateBoard() {
  const b = exploring();
  b.pick.miss = PRIVATE[0];
  b.agreement.yes = PRIVATE[1];
  b.open.push({ id: "T1", kind: "tension", text: `"${PRIVATE[2]}": Bruno is 10 days late on Friday evening: send now, or wait?`, options: [], who: "me" },
    { id: "Q3", kind: "decision", text: "Who signs off the export?", options: [], who: "" });
  return b;
}

test("share copy: fixes the name, omits what I heard and provenance, stays untracked", () => {
  const dir = project(privateBoard());
  const git = spawnSync("git", ["init", "-q"], { cwd: dir });
  const r = cli(["render", "--for", "Ana"], dir);
  assert.strictEqual(r.status, 0, r.stderr);
  const out = path.join(dir, "docs", "vision", "share", "ana.html");
  assert.ok(fs.existsSync(out));
  assert.ok(!fs.existsSync(path.join(dir, "docs", "vision", "index.html")), "a share render must not touch index.html");
  assert.strictEqual(fs.readFileSync(path.join(dir, "docs", "vision", "share", ".gitignore"), "utf8"), "*\n");
  const html = fs.readFileSync(out, "utf8");
  const { board, view } = seam(html);
  assert.strictEqual(view.for, "Ana");
  assert.deepStrictEqual([board.heard, board.people, view.links], [[], [], []]);
  assert.ok(board.features.every((f) => !("source" in f) && !("quote" in f)), "provenance left in the share copy");
  assert.ok(board.changed.every((c) => !("line" in c)));
  for (const q of ["Bruno was 45 days late", "third reminder", "a note on every client", "can I see it before it goes", ...PRIVATE]) assert.ok(!html.toLowerCase().includes(q.toLowerCase()), `share copy leaks "${q}"`);
  assert.deepStrictEqual(board.open.map((o) => o.id), ["Q1", "Q2"], "no tension and no unclaimed item in a share copy");
  assert.deepStrictEqual([view.turn, view.ready], [[], []], "nothing names Ana, and the checks are the owner's");
  assert.deepStrictEqual(R.yourTurn(privateBoard(), "Rita").map((t) => t.refs[0]), ["Q2"], "Rita answers only what names her");
  if (git.status === 0) {
    const st = spawnSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: dir, encoding: "utf8" }).stdout;
    assert.doesNotMatch(st, /share/, "share copies must stay untracked");
  }
  assert.strictEqual(cli(["render", "--for", "Zoë"], dir).status, 0);
  assert.ok(fs.existsSync(path.join(dir, "docs", "vision", "share", "zoe.html")));
});

test("owner page keeps what I heard and provenance; the name is not fixed", () => {
  const { board, view } = seam(render(exploring()));
  assert.strictEqual(view.for, null);
  assert.ok(board.heard.length && board.features.every((f) => "source" in f));
});

// --- check: prototypes ---------------------------------------------------------------------

test("check: the good fixture passes; the skeleton fails only on its example text until it is filled", () => {
  assert.deepStrictEqual(R.check(GOOD_PROTO), []);
  assert.deepStrictEqual(R.check(PROTO_TEMPLATE).map((p) => p.split(":")[0]), ["placeholder"]);
  const filled = PROTO_TEMPLATE.replace("the user's own words go here", "Can I see it before it goes?").replace(/Screen (?:title|name)/g, "Nudge preview")
    .replace("The screen's real wording goes here", "Hi Bruno, just a friendly nudge").replace("round N", "round 4");
  assert.deepStrictEqual(R.check(filled), []);
});

const CSP_META = /<meta http-equiv="Content-Security-Policy"[^>]*>/;
const inScript = (h, js) => reseal(h.replace("addEventListener(", `addEventListener(${js}, `));
const CHECK_CASES = [
  ["csp.missing", (h) => h.replace(/<meta http-equiv="Content-Security-Policy"[^>]*>/, "")],
  ["csp.default", (h) => h.replace("default-src 'none'", "default-src 'self'")],
  ["csp.connect", (h) => h.replace("default-src 'none';", "default-src 'none'; connect-src 'none';")],
  ["csp.source", (h) => h.replace("img-src data:", "img-src data: https:")],
  ["csp.form", (h) => h.replace("; form-action 'none'", "")],
  ["csp.hash", (h) => h.replace("addEventListener(", "addEventListener (")],
  // A browser ignores a CSP <meta> in a comment, in the body or after a script, keeps the first of a
  // repeated directive, and ignores 'unsafe-inline' once a hash is listed.
  ["csp.missing", (h) => h.replace(CSP_META, (m) => `<!-- ${m} -->`)],
  ["csp.missing", (h) => h.replace(CSP_META, "").replace("<body>", () => `<body>${h.match(CSP_META)[0]}`)],
  ["csp.missing", (h) => h.replace(CSP_META, (m) => `<script>1</script>${m}`)],
  ["csp.default", (h) => h.replace(CSP_META, (m) => `<!-- ${m} --><meta content="default-src *" http-equiv="Content-Security-Policy">`)],
  ["csp.duplicate", (h) => h.replace("default-src 'none';", "default-src *; default-src 'none';")],
  ["csp.duplicate", (h) => h.replace("default-src 'none';", "default-src&#32;*; default-src 'none';")],
  ["csp.duplicate", (h) => h.replace(CSP_META, (m) => m + m)],
  ["csp.hash", (h) => h.replace("addEventListener(", "addEventListener (").replace("script-src '", "script-src 'unsafe-inline' '")],
  ["net.script", (h) => h.replace("</body>", '<script src="app.js"></script></body>')],
  ["net.link", (h) => h.replace("</head>", '<link rel="stylesheet" href="look.css"></head>')],
  ["net.remote", (h) => h.replace("</body>", '<img src="https://example.com/a.png" alt=""></body>')],
  ["net.remote", (h) => h.replace("</body>", '<a href="//example.com/x">x</a></body>')],
  ["net.remote", (h) => h.replace("</body>", '<img alt="" srcset="a.png 1x, https://example.com/b.png 2x"></body>')],
  ["net.remote", (h) => h.replace("</body>", '<img alt="" src="https&#58;//example.com/a.png"></body>')],
  ["net.remote", (h) => h.replace("</body>", '<img alt="" src="&#x2F;&#x2F;example.com/a.png"></body>')],
  ["net.remote", (h) => h.replace("</body>", String.raw`<img alt="" src="https:\\example.com/a.png"></body>`)],
  ["net.remote", (h) => h.replace("</body>", '<img alt="" src="https:example.com/a.png"></body>')],
  ["net.refresh", (h) => h.replace("</head>", '<meta http-equiv="refresh" content="0;url=https://example.com/"></head>')],
  ["net.import", (h) => h.replace("<style>", "<style>@import 'look.css';")],
  ["net.url", (h) => h.replace("<style>", "<style>body{background:url(http://example.com/a.png)}")],
  ["net.url", (h) => h.replace("<style>", '<style>body{background-image:image-set("https://example.com/a.png" 1x)}')],
  ["net.url", (h) => h.replace("<style>", String.raw`<style>body{background:\75rl(https://example.com/a.png)}`)],
  ["net.url", (h) => h.replace("<style>", "<style>body{background:url(/**/https://example.com/a.png)}")],
  ["net.api", (h) => inScript(h, "fetch('/log')")],
  ["net.api", (h) => inScript(h, "fetch.call(window, '/log')")],
  ["net.api", (h) => inScript(h, "new RTCPeerConnection({})")],
  ["net.nav", (h) => inScript(h, "location.assign('https://example.com')")],
  ["net.nav", (h) => inScript(h, "window.open('https://example.com')")],
  ["net.embed", (h) => h.replace("</body>", "<iframe></iframe></body>")],
  ["js.inline", (h) => h.replace("<body>", '<body onload="go()">')],
  ["js.inline", (h) => h.replace("</body>", '<svg/onload="go()"></svg></body>')],
  ["placeholder", (h) => h.replace("Preview before it goes</h1>", "Screen title</h1>")],
  ["js.url", (h) => h.replace("</body>", '<a href="javascript:go()">x</a></body>')],
  ["ch1.tokens", (h) => h.replace(/:root\s*\{[^}]*\}/, "")],
  ["ch2.comments", (h) => h.replace(/<!--[^>]*because "[^"]*" \(R\d+, said\)[^>]*-->/g, "")],
  ["ch3.gallery", (h) => h.replace(/<!-- PANEL 2 — Component gallery[^>]*-->/, "<!-- PANEL 2 -->")],
  ["ch4.js", (h) => reseal(h.replace(/\.addEventListener\(/g, ".on("))],
  ["ch5.xref", (h) => h.replace(/mirrored from [^\s*]+/g, "copied by hand")],
  ["banner", (h) => h.replace(/<div class="provisional"[^>]*>[\s\S]*?<\/div>/, "")],
  ["banner", (h) => h.replace(/<div class="provisional"[^>]*>[\s\S]*?<\/div>/, "<!-- PROVISIONAL -->")],
];

for (const [code, breakIt] of CHECK_CASES) {
  test(`check: rejects ${code}`, () => {
    const broken = breakIt(GOOD_PROTO);
    assert.notStrictEqual(broken, GOOD_PROTO, "the mutation did not apply to the fixture");
    const problems = R.check(broken);
    assert.ok(problems.some((p) => p.startsWith(`${code}:`)), `${code} not reported; got ${JSON.stringify(problems)}`);
  });
}

test("check CLI: exit 0 on a good prototype, 1 with each problem on a bad one", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envision-check-"));
  const bad = path.join(dir, "bad.html");
  fs.writeFileSync(bad, GOOD_PROTO.replace(/<!-- PANEL 2 — Component gallery[^>]*-->/, "").replace(/<div class="provisional"[^>]*>[\s\S]*?<\/div>/, ""));
  const ok = cli(["check", path.join(FIX, "prototype-good.html")], dir);
  assert.strictEqual(ok.status, 0, ok.stderr);
  const r = cli(["check", bad], dir);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /check failed: 2 problems/);
  assert.match(r.stderr, /bad\.html: ch3\.gallery: /);
  assert.match(r.stderr, /bad\.html: banner: /);
});

// --- CLI: outputs, exit codes, determinism -------------------------------------------------

test("render CLI: writes index.html next to board.json and is byte-deterministic", () => {
  const dir = project(exploring());
  fs.mkdirSync(path.join(dir, "docs", "vision", "prototype"));
  fs.writeFileSync(path.join(dir, "docs", "vision", "prototype", "nudge-preview.html"), GOOD_PROTO);
  const first = cli(["render"], dir);
  assert.strictEqual(first.status, 0, first.stderr);
  assert.match(first.stdout, /^wrote docs\/vision\/index\.html \(round 4 · exploring · your turn 1 · ready 7\/7\)/);
  const out = path.join(dir, "docs", "vision", "index.html");
  const a = fs.readFileSync(out);
  assert.strictEqual(cli(["render", "docs/vision/board.json"], dir).status, 0);
  assert.ok(a.equals(fs.readFileSync(out)), "same board, different bytes");
  assert.strictEqual(render(exploring()), render(exploring()));
  assert.deepStrictEqual(seam(a.toString()).view.links, [{ kind: "prototype", href: "prototype/nudge-preview.html" }]);
});

test("render CLI: exit 1 lists every problem; exit 2 for usage and unreadable input", () => {
  const b = sample();
  b.pick.miss = "";
  b.agreement.items = [];
  const dir = project(b);
  const r = cli(["render"], dir);
  assert.strictEqual(r.status, 1);
  assert.match(r.stderr, /^render refused: status is "agreed" but 2 of 7 checks fail \(Before we can agree\)/);
  assert.match(r.stderr, /\n  ready\.pick: /);
  assert.match(r.stderr, /\n  ready\.items: /);
  assert.ok(!fs.existsSync(path.join(dir, "docs", "vision", "index.html")), "a refused render writes nothing");
  fs.writeFileSync(path.join(dir, "docs", "vision", "board.json"), "{ not json");
  assert.strictEqual(cli(["render"], dir).status, 2);
  assert.strictEqual(cli(["render", "missing.json"], dir).status, 2);
  assert.strictEqual(cli(["publish"], dir).status, 2);
  assert.strictEqual(cli(["render", "--for"], dir).status, 2);
  assert.strictEqual(cli(["check"], dir).status, 2);
});

test("render CLI: --for refuses the owner's name, and a second person on the same file", () => {
  const dir = project(exploring());
  const share = (f) => path.join(dir, "docs", "vision", "share", f);
  assert.strictEqual(cli(["render", "--for", "Me"], dir).status, 2);
  assert.strictEqual(cli(["render", "--for", "José"], dir).status, 0);
  const clash = cli(["render", "--for", "jose"], dir);
  assert.strictEqual(clash.status, 2);
  assert.match(clash.stderr, /"José"'s copy/);
  assert.strictEqual(seam(fs.readFileSync(share("jose.html"), "utf8")).view.for, "José", "the first person's copy was replaced");
  assert.strictEqual(cli(["render", "--for", "José"], dir).status, 0, "the same person's copy re-renders");
});

test("render CLI: never writes through a symbolic link", () => {
  const dir = project(exploring()), vision = path.join(dir, "docs", "vision"), victim = path.join(dir, "victim");
  fs.mkdirSync(victim);
  fs.writeFileSync(path.join(victim, "dot-zshrc"), "keep\n");
  fs.symlinkSync(path.join(victim, "dot-zshrc"), path.join(vision, "index.html"));
  assert.strictEqual(cli(["render"], dir).status, 2);
  fs.symlinkSync(victim, path.join(vision, "share"));
  assert.strictEqual(cli(["render", "--for", "Ana"], dir).status, 2);
  assert.deepStrictEqual(fs.readdirSync(victim), ["dot-zshrc"]);
  assert.strictEqual(fs.readFileSync(path.join(victim, "dot-zshrc"), "utf8"), "keep\n");
});

test("bake CLI: re-seals a file's one inline script in place", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "envision-bake-"));
  const f = path.join(dir, "p.html");
  fs.writeFileSync(f, GOOD_PROTO.replace("addEventListener(", "addEventListener ("));
  assert.ok(R.check(fs.readFileSync(f, "utf8")).some((p) => p.startsWith("csp.hash")));
  const r = cli(["bake", f], dir);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.deepStrictEqual(R.check(fs.readFileSync(f, "utf8")), []);
  fs.writeFileSync(f, GOOD_PROTO.replace("</body>", "<script>1</script></body>"));
  assert.strictEqual(cli(["bake", f], dir).status, 1, "two inline scripts cannot share one baked hash");
});

// --- Section pointers: scripts/check-section-pointers.py covers only the orchestrator -------

test("section pointers: each `references/<file>.md` → **Section** names a heading in that file", () => {
  const docs = ["SKILL.md", ...["references", "templates"].flatMap((d) => fs.readdirSync(path.join(SKILL, d)).filter((f) => f.endsWith(".md")).map((f) => `${d}/${f}`))];
  const read = (f) => fs.readFileSync(path.join(SKILL, f), "utf8").split("\n");
  const norm = (s) => s.replace(/[`*]/g, "").trim();
  const headings = new Map(docs.map((f) => [path.basename(f), read(f).map((l) => /^#{2,4}\s+(.*?)\s*$/.exec(l)).filter(Boolean).map((m) => norm(m[1]))]));
  const pointers = docs.flatMap((f) => read(f).flatMap((l, i) => [...l.matchAll(/`?(?:references\/)?([A-Za-z0-9_.-]+\.md)`?\s*(?:→|->)\s*\*{0,2}([^*\n.,;)]+)/g)]
    .map((m) => [`${f}:${i + 1}`, m[1], norm(m[2])])));
  assert.ok(pointers.length >= 10, `only ${pointers.length} pointers found; the pattern no longer matches the docs`);
  for (const [at, file, section] of pointers) {
    assert.ok(headings.has(file), `${at}: points into ${file}, which is not one of envision's docs`);
    assert.ok(headings.get(file).some((h) => h === section || h.startsWith(`${section} — `)), `${at}: ${file} has no heading "${section}"`);
  }
});
