"use strict";
// Draws the report's diagrams as static inline SVG at render time. There is no diagram runtime
// in the page, so nothing parses diagram source in the browser and nothing can fail to render
// there: a diagram is plain markup the renderer wrote. Repo-derived text reaches the SVG only
// as HTML-escaped <text>/<title> content; ids, classes, shapes and coordinates are minted here.
//
// graph = { kind: "flow" | "er" | "sequence", direction?: "TD" | "LR",
//           nodes: [{ label, shape?: "box"|"decision"|"store"|"actor", fields?: [string] }],
//           edges: [{ from, to, label?, style?: "reply" }] }   // from/to = node indexes

const PLACEHOLDER = "(label omitted)";
const MAX_LABEL = 48;      // code points; longer labels are cut, the full text stays in <title>
const MAX_FIELDS = 8;      // ER entity rows; the rest collapse into "+N more"
const MAX_NODES = 150;
const MAX_EDGES = 300;
const CHAR_W = 7.2;        // monospace advance at 12px
const LINE_H = 18;
const PAD_X = 12;
const NODE_H = 36;
const MARGIN = 16;
const SHAPES = new Set(["box", "decision", "store", "actor"]);

function esc(v) {
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;")
    .replace(/\{/g, "&#123;").replace(/\}/g, "&#125;");
}

function cleanLabel(raw) {
  if (typeof raw !== "string" && typeof raw !== "number") return PLACEHOLDER;
  const one = String(raw).replace(/[\x00-\x1f\x7f-\x9f\u2028\u2029]/g, " ").replace(/\s+/g, " ").trim();
  return one.length ? one : PLACEHOLDER;
}
function cut(text) {
  const cps = Array.from(text);
  return cps.length > MAX_LABEL ? cps.slice(0, MAX_LABEL - 1).join("") + "…" : text;
}
function textWidth(text) {
  let w = 0;
  for (const ch of text) w += ch.codePointAt(0) >= 0x2e80 ? 2 : 1;   // CJK and emoji take two cells
  return w * CHAR_W;
}
const r1 = (n) => Math.round(n * 10) / 10;

function normalize(graph) {
  const g = graph && typeof graph === "object" ? graph : {};
  const kind = ["flow", "er", "sequence"].includes(g.kind) ? g.kind : "flow";
  const direction = g.direction === "LR" || (kind === "er" && g.direction !== "TD") ? "LR" : "TD";
  const allNodes = Array.isArray(g.nodes) ? g.nodes : [];
  const nodes = allNodes.slice(0, MAX_NODES).map((nd) => {
    const full = cleanLabel(nd && nd.label);
    const shape = nd && SHAPES.has(nd.shape) ? nd.shape : "box";
    const rawFields = kind === "er" && nd && Array.isArray(nd.fields) ? nd.fields : [];
    const fields = rawFields.slice(0, MAX_FIELDS).map((f) => cut(cleanLabel(f)));
    if (rawFields.length > MAX_FIELDS) fields.push(`+${rawFields.length - MAX_FIELDS} more`);
    return { full, text: cut(full), shape, fields };
  });
  // An endpoint is a node index: an integer, or a string of digits. Number(null) is 0, so a
  // bare Number() cast would turn a missing endpoint into node 0.
  const index = (v) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN);
  const inRange = (e, n) => {
    if (!e || typeof e !== "object") return false;
    const a = index(e.from), b = index(e.to);
    return Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= 0 && a < n && b < n;
  };
  const allEdges = Array.isArray(g.edges) ? g.edges : [];
  const edges = [];
  for (const e of allEdges) {
    if (edges.length >= MAX_EDGES) break;
    if (!inRange(e, nodes.length)) continue;
    const hasLabel = (typeof e.label === "string" && e.label.trim() !== "") || typeof e.label === "number";
    const label = hasLabel ? cut(cleanLabel(e.label)) : null;
    edges.push({ from: index(e.from), to: index(e.to), label, reply: e.style === "reply" });
  }
  const validEdges = allEdges.filter((e) => inRange(e, allNodes.length)).length;
  const omitted = { nodes: allNodes.length - nodes.length, edges: validEdges - edges.length };
  return { kind, direction, nodes, edges, omitted };
}

// ---- layered layout (flow + er) -------------------------------------------------------
// Sugiyama-style: break cycles by reversing DFS back edges, rank by longest path, split long
// edges with dummy points, order each rank by barycenter sweeps, then place ranks.
function rankNodes(n, edges) {
  const out = Array.from({ length: n }, () => []);
  edges.forEach((e, i) => { if (e.from !== e.to) out[e.from].push(i); });
  const state = new Array(n).fill(0);
  const reversed = new Set();
  for (let s = 0; s < n; s++) {
    if (state[s]) continue;
    const stack = [[s, 0]];
    state[s] = 1;
    while (stack.length) {
      const top = stack[stack.length - 1];
      const [v, k] = top;
      if (k >= out[v].length) { state[v] = 2; stack.pop(); continue; }
      top[1]++;
      const ei = out[v][k], w = edges[ei].to;
      if (state[w] === 1) reversed.add(ei);
      else if (state[w] === 0) { state[w] = 1; stack.push([w, 0]); }
    }
  }
  const dag = edges.map((e, i) => (e.from === e.to ? null : reversed.has(i) ? [e.to, e.from] : [e.from, e.to]));
  const indeg = new Array(n).fill(0);
  const succ = Array.from({ length: n }, () => []);
  for (const d of dag) if (d) { succ[d[0]].push(d[1]); indeg[d[1]]++; }
  const rank = new Array(n).fill(0);
  const queue = [];
  for (let v = 0; v < n; v++) if (!indeg[v]) queue.push(v);
  for (let qi = 0; qi < queue.length; qi++) {
    const v = queue[qi];
    for (const w of succ[v]) { rank[w] = Math.max(rank[w], rank[v] + 1); if (--indeg[w] === 0) queue.push(w); }
  }
  return { rank, dag, reversed };
}

function layeredLayout(model) {
  const { nodes, edges, direction } = model;
  const TD = direction === "TD";
  const n = nodes.length;
  const sizes = nodes.map((nd) => {
    const fieldW = nd.fields.reduce((m, f) => Math.max(m, textWidth(f)), 0);
    const base = Math.max(textWidth(nd.text), fieldW) + 2 * PAD_X;
    const w = nd.shape === "decision" ? base * 1.6 + 8 : Math.max(base, 72);
    const h = nd.fields.length ? NODE_H + nd.fields.length * LINE_H + 6 : nd.shape === "decision" ? NODE_H + 12 : NODE_H;
    return { w, h };
  });
  const { rank, dag, reversed } = rankNodes(n, edges);
  // vertices: real nodes, then dummies for every rank an edge crosses
  const verts = sizes.map((s, i) => ({ id: i, rank: rank[i], w: s.w, h: s.h, dummy: false }));
  const chains = edges.map((e, i) => {
    const d = dag[i];
    if (!d) return null;
    const chain = [d[0]];
    for (let r = rank[d[0]] + 1; r < rank[d[1]]; r++) {
      verts.push({ id: verts.length, rank: r, w: TD ? 8 : 4, h: TD ? 4 : 8, dummy: true });
      chain.push(verts.length - 1);
    }
    chain.push(d[1]);
    return chain;
  });
  const up = verts.map(() => []), down = verts.map(() => []);
  for (const c of chains) if (c) for (let k = 0; k + 1 < c.length; k++) { down[c[k]].push(c[k + 1]); up[c[k + 1]].push(c[k]); }
  const maxRank = verts.reduce((m, v) => Math.max(m, v.rank), 0);
  const layers = Array.from({ length: maxRank + 1 }, () => []);
  verts.forEach((v) => layers[v.rank].push(v.id));
  const pos = new Array(verts.length).fill(0);
  const setPos = () => layers.forEach((l) => l.forEach((v, i) => { pos[v] = i; }));
  setPos();
  const bary = (v, nb) => (nb[v].length ? nb[v].reduce((s, u) => s + pos[u], 0) / nb[v].length : pos[v]);
  for (let sweep = 0; sweep < 6; sweep++) {
    const downward = sweep % 2 === 0;
    const order = downward ? layers.keys() : [...layers.keys()].reverse();
    for (const r of order) {
      const nb = downward ? up : down;
      const keyed = layers[r].map((v) => [bary(v, nb), pos[v], v]);
      keyed.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      layers[r] = keyed.map((k) => k[2]);
      layers[r].forEach((v, i) => { pos[v] = i; });
    }
  }
  // place: rank axis = y (TD) or x (LR); order axis = x (TD) or y (LR)
  const hasLabels = edges.some((e) => e.label);
  const labelW = edges.reduce((m, e) => Math.max(m, e.label ? textWidth(e.label) + 16 : 0), 0);
  const rankGap = TD ? (hasLabels ? 64 : 48) : Math.max(56, labelW + 32);
  const orderGap = 28;
  const thick = layers.map((l) => l.reduce((m, v) => Math.max(m, TD ? verts[v].h : verts[v].w), 0));
  const span = layers.map((l) => l.reduce((s, v) => s + (TD ? verts[v].w : verts[v].h), 0) + Math.max(0, l.length - 1) * orderGap);
  const widest = Math.max(0, ...span);
  const centre = new Array(verts.length);
  let rankAt = MARGIN;
  layers.forEach((l, r) => {
    let o = MARGIN + (widest - span[r]) / 2;
    const mid = rankAt + thick[r] / 2;
    for (const v of l) {
      const size = TD ? verts[v].w : verts[v].h;
      centre[v] = TD ? { x: o + size / 2, y: mid } : { x: mid, y: o + size / 2 };
      o += size + orderGap;
    }
    rankAt += thick[r] + rankGap;
  });
  const W = TD ? widest + 2 * MARGIN : rankAt - rankGap + MARGIN;
  const H = TD ? rankAt - rankGap + MARGIN : widest + 2 * MARGIN;
  const box = (v) => ({ x: centre[v].x - verts[v].w / 2, y: centre[v].y - verts[v].h / 2, w: verts[v].w, h: verts[v].h });
  const routes = edges.map((e, i) => {
    if (!chains[i]) return { self: true, node: e.from };
    const pts = chains[i].map((v, k) => {
      const c = centre[v];
      if (verts[v].dummy) return { x: c.x, y: c.y };
      const half = (TD ? verts[v].h : verts[v].w) / 2;
      const sign = k === 0 ? 1 : -1;
      return TD ? { x: c.x, y: c.y + sign * half } : { x: c.x + sign * half, y: c.y };
    });
    return { pts: reversed.has(i) ? pts.reverse() : pts, back: reversed.has(i) };
  });
  return { W: Math.ceil(W), H: Math.ceil(H), box, routes, TD };
}

function curve(pts, TD) {
  let d = `M${r1(pts[0].x)},${r1(pts[0].y)}`;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    if (TD) { const m = (a.y + b.y) / 2; d += ` C${r1(a.x)},${r1(m)} ${r1(b.x)},${r1(m)} ${r1(b.x)},${r1(b.y)}`; }
    else { const m = (a.x + b.x) / 2; d += ` C${r1(m)},${r1(a.y)} ${r1(m)},${r1(b.y)} ${r1(b.x)},${r1(b.y)}`; }
  }
  return d;
}

function edgeLabel(text, x, y) {
  const w = textWidth(text) + 10;
  return `<rect class="dg-edge-label-bg" x="${r1(x - w / 2)}" y="${r1(y - 9)}" width="${r1(w)}" height="18" rx="3"/>` +
    `<text class="dg-edge-label" x="${r1(x)}" y="${r1(y)}" text-anchor="middle" dominant-baseline="central">${esc(text)}</text>`;
}

function nodeShape(nd, b) {
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
  const tip = `<title>${esc(nd.full)}</title>`;
  if (nd.shape === "decision") {
    return `<g class="dg-node dg-node--decision">${tip}<polygon points="${r1(b.x)},${r1(cy)} ${r1(cx)},${r1(b.y)} ${r1(b.x + b.w)},${r1(cy)} ${r1(cx)},${r1(b.y + b.h)}"/>` +
      `<text class="dg-label" x="${r1(cx)}" y="${r1(cy)}" text-anchor="middle" dominant-baseline="central">${esc(nd.text)}</text></g>`;
  }
  if (nd.shape === "store") {
    const ry = 5;
    const d = `M${r1(b.x)},${r1(b.y + ry)} A${r1(b.w / 2)},${ry} 0 0 1 ${r1(b.x + b.w)},${r1(b.y + ry)} V${r1(b.y + b.h - ry)} A${r1(b.w / 2)},${ry} 0 0 1 ${r1(b.x)},${r1(b.y + b.h - ry)} Z` +
      ` M${r1(b.x)},${r1(b.y + ry)} A${r1(b.w / 2)},${ry} 0 0 0 ${r1(b.x + b.w)},${r1(b.y + ry)}`;
    return `<g class="dg-node dg-node--store">${tip}<path d="${d}"/>` +
      `<text class="dg-label" x="${r1(cx)}" y="${r1(cy + 2)}" text-anchor="middle" dominant-baseline="central">${esc(nd.text)}</text></g>`;
  }
  const rx = nd.shape === "actor" ? b.h / 2 : 6;
  let inner = `<rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.w)}" height="${r1(b.h)}" rx="${r1(rx)}"/>`;
  if (nd.fields.length) {
    inner += `<text class="dg-label dg-label--head" x="${r1(cx)}" y="${r1(b.y + NODE_H / 2)}" text-anchor="middle" dominant-baseline="central">${esc(nd.text)}</text>` +
      `<line class="dg-divider" x1="${r1(b.x)}" y1="${r1(b.y + NODE_H)}" x2="${r1(b.x + b.w)}" y2="${r1(b.y + NODE_H)}"/>`;
    nd.fields.forEach((f, i) => {
      inner += `<text class="dg-field" x="${r1(b.x + PAD_X)}" y="${r1(b.y + NODE_H + 3 + LINE_H * i + LINE_H / 2)}" dominant-baseline="central">${esc(f)}</text>`;
    });
  } else {
    inner += `<text class="dg-label" x="${r1(cx)}" y="${r1(cy)}" text-anchor="middle" dominant-baseline="central">${esc(nd.text)}</text>`;
  }
  return `<g class="dg-node dg-node--${nd.shape}">${tip}${inner}</g>`;
}

function drawLayered(model, id) {
  const L = layeredLayout(model);
  const arrow = model.kind !== "er";
  const parts = [];
  // Extents of everything drawn, so labels and loops outside the node area stay in the viewBox.
  const bb = { x0: 0, y0: 0, x1: L.W, y1: L.H };
  const grow = (x, y) => { bb.x0 = Math.min(bb.x0, x); bb.y0 = Math.min(bb.y0, y); bb.x1 = Math.max(bb.x1, x); bb.y1 = Math.max(bb.y1, y); };
  // Edges between the same two nodes (either direction) fan out instead of drawing on top of
  // each other.
  const pairKey = (e) => (e.from < e.to ? `${e.from}:${e.to}` : `${e.to}:${e.from}`);
  const groupSize = new Map(), seen = new Map();
  model.edges.forEach((e) => groupSize.set(pairKey(e), (groupSize.get(pairKey(e)) || 0) + 1));
  model.edges.forEach((e, i) => {
    const rt = L.routes[i];
    const key = pairKey(e), n = groupSize.get(key), k = seen.get(key) || 0;
    seen.set(key, k + 1);
    const cls = `dg-edge${rt.back ? " dg-edge--back" : ""}${e.reply ? " dg-edge--reply" : ""}${arrow ? "" : " dg-edge--rel"}`;
    const end = arrow ? ` marker-end="url(#${id}-arrow)"` : "";
    let mid;
    if (rt.self) {
      const b = L.box(rt.node);
      const x = b.x + b.w, y = b.y + b.h / 2, reach = 34 + 16 * k, rise = 26 + 6 * k;
      parts.push(`<path class="${cls}" d="M${r1(x)},${r1(y - 8)} C${r1(x + reach)},${r1(y - rise)} ${r1(x + reach)},${r1(y + rise)} ${r1(x)},${r1(y + 8)}"${end}/>`);
      grow(x + reach, y - rise); grow(x + reach, y + rise);
      mid = { x: x + reach * 0.75 + (e.label ? (textWidth(e.label) + 10) / 2 : 0), y };
    } else {
      let pts = rt.pts.map((pt) => ({ ...pt }));
      const off = (k - (n - 1) / 2) * 24;
      if (off) {
        if (pts.length === 2) pts = [pts[0], { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }, pts[1]];
        for (let j = 1; j < pts.length - 1; j++) { if (L.TD) pts[j].x += off; else pts[j].y += off; }
      }
      parts.push(`<path class="${cls}" d="${curve(pts, L.TD)}"${end}/>`);
      pts.forEach((pt) => grow(pt.x, pt.y));
      if (pts.length % 2) mid = pts[(pts.length - 1) / 2];
      else { const j = pts.length / 2 - 1; mid = { x: (pts[j].x + pts[j + 1].x) / 2, y: (pts[j].y + pts[j + 1].y) / 2 }; }
    }
    if (e.label) {
      const w = textWidth(e.label) + 10;
      grow(mid.x - w / 2, mid.y - 9); grow(mid.x + w / 2, mid.y + 9);
      parts.push(edgeLabel(e.label, mid.x, mid.y));
    }
  });
  const edgesSvg = parts.join("");
  const nodesSvg = model.nodes.map((nd, i) => nodeShape(nd, L.box(i))).join("");
  const x0 = Math.floor(Math.min(0, bb.x0 - 4)), y0 = Math.floor(Math.min(0, bb.y0 - 4));
  const x1 = Math.ceil(Math.max(L.W, bb.x1 + 4)), y1 = Math.ceil(Math.max(L.H, bb.y1 + 4));
  return { vb: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, body: edgesSvg + nodesSvg, arrow };
}

// ---- sequence -------------------------------------------------------------------------
function drawSequence(model, id) {
  const { nodes, edges } = model;
  const widths = nodes.map((nd) => Math.max(textWidth(nd.text) + 2 * PAD_X, 72));
  const gaps = nodes.map(() => 40);                     // gaps[i] = space between i and i+1
  for (const e of edges) {
    const need = e.label ? textWidth(e.label) + 24 : 0;
    if (e.from === e.to) {
      if (e.from < nodes.length - 1) gaps[e.from] = Math.max(gaps[e.from], need + 40 - widths[e.from + 1] / 2);
      continue;
    }
    const a = Math.min(e.from, e.to), b = Math.max(e.from, e.to);
    let have = widths[a] / 2 + widths[b] / 2;
    for (let i = a; i < b; i++) have += gaps[i];
    for (let i = a + 1; i < b; i++) have += widths[i];
    if (need > have) gaps[b - 1] += need - have;
  }
  const xs = [];
  let at = MARGIN;
  nodes.forEach((_, i) => { xs.push(at + widths[i] / 2); at += widths[i] + gaps[i]; });
  const selfTail = edges.some((e) => e.from === e.to && e.from === nodes.length - 1)
    ? Math.max(...edges.filter((e) => e.from === e.to && e.from === nodes.length - 1).map((e) => (e.label ? textWidth(e.label) + 50 : 40)))
    : 0;
  const W = Math.ceil(at - gaps[nodes.length - 1] + MARGIN + selfTail);
  const top = MARGIN, rowH = 40;
  const firstRow = top + NODE_H + 28;
  const bottom = firstRow + Math.max(0, edges.length - 1) * rowH + (edges.some((e) => e.from === e.to) ? 28 : 0) + 20;
  const H = Math.ceil(bottom + MARGIN);
  const parts = [];
  nodes.forEach((nd, i) => {
    parts.push(`<line class="dg-lifeline" x1="${r1(xs[i])}" y1="${r1(top + NODE_H)}" x2="${r1(xs[i])}" y2="${r1(bottom)}"/>`);
    parts.push(nodeShape({ ...nd, shape: nd.shape === "actor" ? "actor" : "box", fields: [] }, { x: xs[i] - widths[i] / 2, y: top, w: widths[i], h: NODE_H }));
  });
  edges.forEach((e, k) => {
    const y = firstRow + k * rowH;
    const cls = `dg-edge${e.reply ? " dg-edge--reply" : ""}`;
    if (e.from === e.to) {
      const x = xs[e.from];
      parts.push(`<path class="${cls}" d="M${r1(x)},${r1(y)} H${r1(x + 30)} V${r1(y + 20)} H${r1(x + 4)}" marker-end="url(#${id}-arrow)"/>`);
      if (e.label) parts.push(`<text class="dg-edge-label" x="${r1(x + 36)}" y="${r1(y + 10)}" dominant-baseline="central">${esc(e.label)}</text>`);
      return;
    }
    const dir = xs[e.to] > xs[e.from] ? 1 : -1;
    parts.push(`<line class="${cls}" x1="${r1(xs[e.from])}" y1="${r1(y)}" x2="${r1(xs[e.to] - dir * 3)}" y2="${r1(y)}" marker-end="url(#${id}-arrow)"/>`);
    if (e.label) parts.push(`<text class="dg-edge-label" x="${r1((xs[e.from] + xs[e.to]) / 2)}" y="${r1(y - 9)}" text-anchor="middle">${esc(e.label)}</text>`);
  });
  return { vb: { x: 0, y: 0, w: W, h: H }, body: parts.join(""), arrow: true };
}

// ---- entry point ----------------------------------------------------------------------
const KIND_NAME = { flow: "Flowchart", er: "Entity-relationship diagram", sequence: "Sequence diagram" };

function describe(model) {
  const lines = model.edges.map((e) => {
    const a = model.nodes[e.from].full, b = model.nodes[e.to].full;
    return `${a} ${model.kind === "er" ? "—" : "→"} ${b}${e.label ? `: ${e.label}` : ""}`;
  });
  return lines.join("; ");
}

function buildDiagram(graph, id = "dg") {
  const safeId = /^[a-z][a-z0-9-]{0,31}$/.test(id) ? id : "dg";
  const model = normalize(graph);
  if (!model.nodes.length) return `<p class="diagram__empty">Nothing to draw for this scope.</p>`;
  const drawn = model.kind === "sequence" ? drawSequence(model, safeId) : drawLayered(model, safeId);
  const noun = model.kind === "sequence" ? ["participants", "messages"] : model.kind === "er" ? ["entities", "relationships"] : ["steps", "links"];
  const title = `${KIND_NAME[model.kind]}: ${model.nodes.length} ${noun[0]}, ${model.edges.length} ${noun[1]}`;
  const defs = drawn.arrow
    ? `<defs><marker id="${safeId}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="dg-arrow" d="M0,0 L10,5 L0,10 z"/></marker></defs>`
    : "";
  const svg = `<svg class="dg dg--${model.kind}" xmlns="http://www.w3.org/2000/svg" viewBox="${drawn.vb.x} ${drawn.vb.y} ${drawn.vb.w} ${drawn.vb.h}" width="${drawn.vb.w}" height="${drawn.vb.h}" role="img" aria-labelledby="${safeId}-title ${safeId}-desc">` +
    `<title id="${safeId}-title">${esc(title)}</title><desc id="${safeId}-desc">${esc(describe(model))}</desc>${defs}${drawn.body}</svg>`;
  const dropped = [];
  if (model.omitted.nodes > 0) dropped.push(`${model.omitted.nodes} ${noun[0]}`);
  if (model.omitted.edges > 0) dropped.push(`${model.omitted.edges} ${noun[1]}`);
  return dropped.length ? `${svg}<p class="diagram__note">Too large to draw in full: ${esc(dropped.join(" and "))} not shown.</p>` : svg;
}

module.exports = { buildDiagram, cleanLabel, PLACEHOLDER, MAX_LABEL, MAX_NODES, MAX_EDGES };
