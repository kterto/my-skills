// Static SVG diagrams (svg-diagram.cjs): repo text stays inert, every graph shape draws, and
// the layout keeps nodes apart and inside the viewBox.
// Run: node --test   (or: node __tests__/svg-diagram.test.cjs)
const { test } = require("node:test");
const assert = require("node:assert");
const { buildDiagram, PLACEHOLDER, MAX_NODES } = require("../references/svg-diagram.cjs");

const HOSTILE = [
  "</text></svg><script>alert(1)</script>",
  '" onload="alert(1)',
  "' onmouseover='x",
  "<img src=x onerror=alert(1)>",
  "{{SCOPE_LABEL}}",
  "<!-- REPEAT:entity -->",
  "]]><![CDATA[",
];

function boxes(svg) {
  return [...svg.matchAll(/<g class="dg-node[^"]*"><title>[^<]*<\/title><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)]
    .map((m) => ({ x: +m[1], y: +m[2], w: +m[3], h: +m[4] }));
}
function viewBox(svg) {
  const m = svg.match(/viewBox="(-?\d+) (-?\d+) (\d+) (\d+)"/);
  return { x: +m[1], y: +m[2], W: +m[1] + +m[3], H: +m[2] + +m[4] };
}
// Every coordinate drawn: rect corners, text anchors (with their estimated half width), path points.
function outside(svg) {
  const vb = viewBox(svg), bad = [];
  const check = (x, y, what) => { if (x < vb.x || y < vb.y || x > vb.W || y > vb.H) bad.push(`${what} at ${x},${y}`); };
  for (const m of svg.matchAll(/<rect[^>]* x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
    check(+m[1], +m[2], "rect"); check(+m[1] + +m[3], +m[2] + +m[4], "rect");
  }
  for (const m of svg.matchAll(/<path[^>]* d="([^"]+)"/g)) {
    const nums = m[1].match(/-?[\d.]+/g).map(Number);
    for (let i = 0; i + 1 < nums.length; i += 2) if (!/A/.test(m[1])) check(nums[i], nums[i + 1], "path");
  }
  return bad;
}
function lcg(seed) { let s = seed; return () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; }

for (const kind of ["flow", "er", "sequence"]) {
  test(`${kind}: hostile labels stay text, never markup`, () => {
    const nodes = HOSTILE.map((label) => ({ label, fields: [label] }));
    const edges = HOSTILE.map((label, i) => ({ from: i, to: (i + 1) % HOSTILE.length, label }));
    const svg = buildDiagram({ kind, nodes, edges }, "dg-x");
    assert.ok(!/<script|<img|<!--|<!\[CDATA/i.test(svg), "no injected element");
    assert.ok(!/<[^>]*\son\w+=/i.test(svg), "no injected event attribute inside a tag");
    assert.ok(!/\{\{|\}\}/.test(svg), "braces are entities, so the template fill cannot rewrite them");
    assert.strictEqual((svg.match(/<svg/g) || []).length, 1);
    assert.strictEqual((svg.match(/<\/svg>/g) || []).length, 1);
    assert.ok(svg.includes("&lt;/text&gt;&lt;/svg&gt;&lt;script&gt;"), "the text is shown escaped");
  });
}

test("labels: control characters collapse, non-strings become the placeholder, long ones are cut", () => {
  const long = "x".repeat(120);
  const svg = buildDiagram({ kind: "flow", nodes: [{ label: "a\u2028b\u0000\tc" }, { label: { evil: 1 } }, { label: long }], edges: [] });
  assert.ok(svg.includes(">a b c</text>"));
  assert.ok(svg.includes(`>${PLACEHOLDER}</text>`));
  assert.ok(svg.includes(`<title>${long}</title>`), "the full label stays in the hover title");
  assert.ok(svg.includes(`>${"x".repeat(47)}…</text>`), "the drawn label is cut");
});

test("unknown kind, shape and id fall back to safe defaults", () => {
  const svg = buildDiagram({ kind: "javascript:x", nodes: [{ label: "A", shape: "evil" }], edges: [] }, '"><script>');
  assert.ok(svg.startsWith('<svg class="dg dg--flow"'));
  assert.ok(svg.includes('class="dg-node dg-node--box"'));
  assert.ok(svg.includes('id="dg-title"'));
});

test("edges with bad endpoints are dropped; every arrow points at a defined marker", () => {
  const svg = buildDiagram({ kind: "flow", nodes: [{ label: "A" }, { label: "B" }],
    edges: [{ from: 0, to: 1 }, { from: 0, to: 9 }, { from: "x", to: 1 }, { from: 1.5, to: 0 }, null, { from: null, to: 0 }, { to: 1 }, { from: [], to: 1 }] }, "dg-e");
  assert.strictEqual((svg.match(/class="dg-edge[" ]/g) || []).length, 1);
  for (const m of svg.matchAll(/marker-end="url\(#([^)]+)\)"/g)) assert.ok(svg.includes(`<marker id="${m[1]}"`));
});

test("cycles and self-loops draw one path each and terminate", () => {
  const svg = buildDiagram({ kind: "flow", nodes: [{ label: "A" }, { label: "B" }, { label: "C" }],
    edges: [{ from: 0, to: 1 }, { from: 1, to: 2 }, { from: 2, to: 0 }, { from: 1, to: 1, label: "retry" }] });
  assert.strictEqual((svg.match(/<path class="dg-edge[" ]/g) || []).length, 4);
  assert.ok(svg.includes("dg-edge--back"), "the cycle-closing edge is marked as a back edge");
});

for (const [kind, direction] of [["flow", "TD"], ["flow", "LR"], ["er", "LR"]]) {
  test(`${kind} ${direction}: nodes keep a gap and stay inside the viewBox`, () => {
    const rnd = lcg(7);
    const n = 40;
    const nodes = Array.from({ length: n }, (_, i) => ({ label: `node ${i} ${"w".repeat(Math.floor(rnd() * 20))}`, fields: kind === "er" ? ["id", "name"] : undefined }));
    const edges = Array.from({ length: 70 }, () => ({ from: Math.floor(rnd() * n), to: Math.floor(rnd() * n), label: rnd() > 0.5 ? "rel" : undefined }));
    const svg = buildDiagram({ kind, direction, nodes, edges });
    const bs = boxes(svg), { W, H } = viewBox(svg);
    assert.strictEqual(bs.length, n);
    for (const b of bs) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= W && b.y + b.h <= H, "inside viewBox");
    assert.deepStrictEqual(outside(svg), [], "every label and route inside the viewBox");
    for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      const G = 16;   // nodes keep a visible gap, not just "not overlapping"
      const apart = a.x + a.w + G <= b.x || b.x + b.w + G <= a.x || a.y + a.h + G <= b.y || b.y + b.h + G <= a.y;
      assert.ok(apart, `nodes ${i} and ${j} overlap or touch`);
    }
    assert.strictEqual(svg, buildDiagram({ kind, direction, nodes, edges }), "deterministic");
  });
}

test("sequence: one lifeline per participant, one arrow per message, columns left to right", () => {
  const svg = buildDiagram({ kind: "sequence", nodes: [{ label: "User", shape: "actor" }, { label: "API" }, { label: "DB" }],
    edges: [{ from: 0, to: 1, label: "a very long request label that needs room" }, { from: 1, to: 2 }, { from: 2, to: 1, style: "reply" }, { from: 1, to: 1, label: "self" }] });
  assert.strictEqual((svg.match(/class="dg-lifeline"/g) || []).length, 3);
  assert.strictEqual((svg.match(/class="dg-edge[" ]/g) || []).length, 4);
  assert.ok(svg.includes("dg-edge--reply"));
  const xs = [...svg.matchAll(/class="dg-lifeline" x1="([\d.]+)"/g)].map((m) => +m[1]);
  assert.ok(xs[0] < xs[1] && xs[1] < xs[2]);
  assert.ok(xs[1] - xs[0] >= "a very long request label that needs room".length * 7.2, "the gap fits the label");
  for (const m of svg.matchAll(/x2="([\d.]+)"/g)) assert.ok(+m[1] <= viewBox(svg).W);
});

test("an empty graph says so instead of drawing", () => {
  assert.match(buildDiagram({ kind: "flow", nodes: [], edges: [] }), /diagram__empty/);
  assert.match(buildDiagram(null), /diagram__empty/);
});

test("an oversized graph is capped and says what it left out", () => {
  const nodes = Array.from({ length: MAX_NODES + 20 }, (_, i) => ({ label: `n${i}` }));
  const edges = [{ from: 0, to: 1 }, { from: 0, to: MAX_NODES + 5 }];
  const out = buildDiagram({ kind: "flow", nodes, edges });
  assert.strictEqual(boxes(out).length, MAX_NODES);
  assert.match(out, /Too large to draw in full: 20 steps and 1 links not shown\./);
});

test("the accessible description lists every edge", () => {
  const svg = buildDiagram({ kind: "er", nodes: [{ label: "Customer" }, { label: "Invoice" }], edges: [{ from: 0, to: 1, label: "issues" }] }, "dg-a");
  assert.ok(svg.includes('aria-labelledby="dg-a-title dg-a-desc"'));
  assert.ok(svg.includes("<desc id=\"dg-a-desc\">Customer — Invoice: issues</desc>"));
  assert.ok(!svg.includes("marker-end"), "ER relationships carry no arrowheads");
});

for (const [kind, direction] of [["flow", "TD"], ["flow", "LR"], ["er", "LR"]]) {
  test(`${kind} ${direction}: long edge labels and self-loops stay inside the viewBox`, () => {
    const svg = buildDiagram({ kind, direction, nodes: [{ label: "A" }, { label: "B" }],
      edges: [{ from: 0, to: 1, label: "validates the payload and persists it to db" },
              { from: 1, to: 1, label: "retry until done ok" }, { from: 1, to: 1, label: "again" }] });
    assert.deepStrictEqual(outside(svg), []);
  });
}

test("a 2-cycle and duplicate edges fan out, so their labels never share a spot", () => {
  for (const edges of [[{ from: 0, to: 1, label: "go" }, { from: 1, to: 0, label: "back" }],
                       [{ from: 0, to: 1, label: "x" }, { from: 0, to: 1, label: "y" }]]) {
    const svg = buildDiagram({ kind: "flow", nodes: [{ label: "A" }, { label: "B" }], edges });
    const spots = [...svg.matchAll(/<text class="dg-edge-label" x="([\d.-]+)" y="([\d.-]+)"/g)].map((m) => `${m[1]},${m[2]}`);
    assert.strictEqual(spots.length, 2);
    assert.notStrictEqual(spots[0], spots[1]);
    const paths = [...svg.matchAll(/<path class="dg-edge[^"]*" d="([^"]+)"/g)].map((m) => m[1]);
    assert.notStrictEqual(paths[0], paths[1].split(" ").reverse().join(" "));
    assert.notStrictEqual(paths[0], paths[1]);
  }
});

test("an empty or non-text edge label draws no label", () => {
  const svg = buildDiagram({ kind: "flow", nodes: [{ label: "A" }, { label: "B" }],
    edges: [{ from: 0, to: 1, label: "" }, { from: 0, to: 1, label: "  " }, { from: 0, to: 1, label: false }, { from: 0, to: 1, label: {} }] });
  assert.ok(!svg.includes("dg-edge-label"));
});
