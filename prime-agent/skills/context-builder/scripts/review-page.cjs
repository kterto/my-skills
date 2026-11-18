"use strict";
// The review page's one executable boundary. `check <page.html>…` holds a page the agent wrote by hand to the
// rules that keep it readable offline from file:// (references/review-page.md → *The checker*): a full skeleton,
// a network-denying CSP, no outside load, no diagram runtime, an explicit background and text colour, a size cap.
// It judges reliability and safety only, never the page's structure or look. The file ships byte for byte in
// context-builder, roadmap and orchestrator: a skill never loads another skill's code at run time; the net.* and js.*
// rules are envision's (envision/scripts/render.cjs), and a repository test keeps them in step.
// Exit 0 clean · 1 problems, one "<file>: <code>: <reason>" line each on stderr · 2 usage or I/O.

const fs = require("node:fs");
const crypto = require("node:crypto");

const MAX_BYTES = 200 * 1024;
const USAGE = "usage: review-page.cjs check <page.html>...";
const set = (s) => typeof s === "string" && s.trim() !== "";
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sha = (text) => `'sha256-${crypto.createHash("sha256").update(text, "utf8").digest("base64")}'`;
const inlineScripts = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter((m) => !/\btype\s*=\s*["']?application\/json/i.test(m[1])).map((m) => m[2]);
const COMMENTS = /<!--[\s\S]*?-->/g;

// --- Reading a page as a browser does (envision's flatten, headStart and attrs) ----------------
// Patterns run on a flat copy: entities decoded (bar < > " '), CSS comments dropped and escapes undone,
// so `&#58;`, `\75rl(` or `url(/**/…)` hide nothing. The CSP blocks what a pattern cannot see.
const ENTITY = {
  __proto__: null, amp: "&", colon: ":", sol: "/", bsol: "\\", period: ".",
  tab: "\t", newline: "\n", lpar: "(", rpar: ")",
};
const char = (n) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "�");
const decode = (s) => s.replace(/&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));?/gi, (m, hex, dec, name) => {
  const c = hex ? char(parseInt(hex, 16)) : dec ? char(Number(dec)) : ENTITY[name.toLowerCase()] ?? m;
  return /^[<>"']$/.test(c) ? m : c;
});
const flatten = (html) => decode(html)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\\([0-9a-f]{1,6})[ \t\n]?|\\([^\n0-9a-f])/gi, (m, hex, c) => (hex ? char(parseInt(hex, 16)) : c));

// The tags a browser has read before anything can run or load: the head up to its first script, style,
// link, base, text or body. A CSP <meta> elsewhere (a comment, the body, after a script) is ignored or late.
function headStart(html) {
  const tags = [], s = html.replace(/<!--[\s\S]*?-->|<!doctype[^>]*>|<title\b[\s\S]*?<\/title\s*>/gi, " ");
  for (const m of s.matchAll(/<(\/?[a-z][\w-]*)\b[^>]*>|[^<\s][^<]*|</gi)) {
    if (!/^\/?(?:html|head|meta)$/i.test(m[1] || "")) break;
    tags.push(m[0]);
  }
  return tags;
}
// A tag's attributes, names lowercased and values decoded; a repeated attribute keeps its first value, as browsers do.
function attrs(tag) {
  const a = Object.create(null);
  for (const m of tag.slice(1).matchAll(/([^\s"'=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    a[m[1].toLowerCase()] ??= decode(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return a;
}

// --- skel.*: a page opened from file:// gets no wrapper, so it must carry its own skeleton --------
function skeletonProblems(html) {
  const p = [], head = html.replace(COMMENTS, " ").split(/<body\b/i)[0];
  if (!/^﻿?(?:\s|<!--[\s\S]*?-->)*<!doctype\s+html\s*>/i.test(html)) {
    p.push("skel.doctype: the file does not start with <!doctype html>, so the browser renders it in quirks mode");
  }
  const root = head.match(/<html\b[^>]*>/i);
  if (!root || !set(attrs(root[0]).lang)) p.push('skel.lang: no <html lang="…">; name the page\'s language');
  if (!headStart(html).map(attrs).some((a) => (a.charset || "").trim().toLowerCase() === "utf-8")) {
    p.push('skel.charset: no <meta charset="utf-8"> at the top of <head>; accented text would rest on a guess');
  }
  const metas = [...head.matchAll(/<meta\b[^>]*>/gi)].map((m) => attrs(m[0]));
  const fits = (a) => (a.name || "").toLowerCase() === "viewport" && /width\s*=\s*device-width/i.test(a.content || "");
  if (!metas.some(fits)) {
    p.push('skel.viewport: no <meta name="viewport" content="width=device-width">; a phone shows the desktop width');
  }
  const title = head.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i);
  if (!title || !set(title[1])) p.push("skel.title: no <title> with text in <head>");
  return p;
}

// --- csp.*: envision's network-denying policy; 'unsafe-inline' scripts pass while no hash is listed ----
const SOURCE_OK = /^(?:'none'|'unsafe-inline'|'sha(?:256|384|512)-[A-Za-z0-9+/=]+'|data:)$/;
function cspProblems(html) {
  const isCsp = (a) => (a["http-equiv"] || "").trim().toLowerCase() === "content-security-policy";
  const metas = headStart(html).map(attrs).filter(isCsp);
  if (metas.length > 1) return ["csp.duplicate: more than one CSP <meta>; keep the one network-denying policy"];
  if (!metas.length) {
    return ['csp.missing: no <meta http-equiv="Content-Security-Policy"> in <head> before any script or style; ' +
      "a network-denying CSP is required"];
  }
  const dirs = new Map(), p = [];
  const directives = (metas[0].content || "").split(";").map((d) => d.trim().split(/\s+/)).filter((d) => d[0]);
  for (const [k, ...v] of directives) {
    if (dirs.has(k.toLowerCase())) p.push(`csp.duplicate: ${k} appears twice; the browser keeps only the first`);
    else dirs.set(k.toLowerCase(), v);
  }
  for (const k of ["default-src", "base-uri", "form-action"]) {
    if ((dirs.get(k) || []).join(" ") !== "'none'") p.push(`csp.${k.split("-")[0]}: ${k} must be 'none'`);
  }
  if (dirs.has("connect-src")) p.push("csp.connect: connect-src opens the network");
  for (const [k, v] of dirs) {
    for (const s of v) {
      if (!SOURCE_OK.test(s)) p.push(`csp.source: ${k} ${s} allows more than inline code and data: URLs`);
    }
  }
  // A browser ignores 'unsafe-inline' once a hash is listed, so then every inline script needs its own hash.
  const allowed = dirs.get("script-src") || [], hashed = allowed.some((s) => /^'sha\d+-/.test(s));
  const inlineOk = !hashed && allowed.includes("'unsafe-inline'");
  const stale = inlineScripts(html).map(sha).filter((t) => !allowed.includes(t) && !inlineOk);
  if (stale.length) p.push(`csp.hash: script-src lacks ${stale.join(" ")}; list it, or 'unsafe-inline' and no hash`);
  return p;
}

// --- net.* and js.*: envision's FORBIDDEN, read on code only ------------------------------------
// envision scans the whole flat page; here prose and a quoted snippet are text a reader sees, never markup that
// loads or runs, so a rule reads the tags, style sheets and scripts and never the text between tags.
// js.inline reads the tags alone: `i<rows.length; onTop` in a script is no attribute.
// Any scheme but data:, or a host-relative // (or \\), with the leading spaces and controls a browser skips.
const AWAY = String.raw`["']?[\x00-\x20]*(?:(?!data:)[a-z][a-z0-9+.\t\n\r-]*:|[\\/][\t\n\r]*[\\/])`;
const ATTR_URL = String.raw`\b(?:(?:src|href|action|formaction|poster|data)\s*=|srcset\s*=\s*["']?(?:[^"'>]*?,)?)\s*`;
const NET_API =
  /\b(?:fetch|sendBeacon|importScripts|XMLHttpRequest|WebSocket|EventSource|WebTransport|RTCPeerConnection)\b/;
const FORBIDDEN = [ // [code, pattern, what, "js" when it runs on the inline scripts rather than the flat page]
  ["net.script", /<script\b[^>]*\bsrc\s*=/i, "loads a script file"],
  ["net.link", /<link\b[^>]*\bhref\s*=/i, "links an outside stylesheet or file"],
  ["net.remote", new RegExp(ATTR_URL + AWAY, "i"), "points a src, srcset or href at another host or scheme"],
  ["net.url", new RegExp(String.raw`(?:url|image-set)\(\s*${AWAY}`, "i"),
    "has a CSS url() or image-set() on another host"],
  ["net.import", /@import\b/i, "has an @import"],
  ["net.refresh", /<meta\b[^>]*\bhttp-equiv\s*=\s*["']?\s*refresh/i, "has a meta refresh, which navigates away"],
  ["net.embed", /<(?:iframe|frame|object|embed|portal)\b/i, "embeds another document"],
  ["net.api", NET_API, "reaches the network from script", "js"],
  ["net.nav", /\bopen\s*\(|\blocation\b(?!\s*\.\s*hash\b)/, "navigates to another page from script", "js"],
  ["js.inline", /<[a-z][\w-]*\b(?:"[^"]*"|'[^']*'|[^'">])*?[\s/"']on[a-z]+\s*=/i,
    "has an inline on…= handler; wire behaviour with addEventListener", "tags"],
  ["js.url", /javascript:/i, "has a javascript: URL"],
];

// --- diagram.*: a diagram is inline SVG or a table, drawn when the page is written -------------
// Diagram source left on screen is what a missing runtime shows, so the source shapes count as much as the runtime.
// Case-sensitive, as the keywords are; gantt, journey and mindmap count only with their next line's syntax, so a
// "Journey" heading or a "Mindmap of…" item stays prose.
const SOURCE_SHAPES = new RegExp(String.raw`^\s*(?:(?:flowchart|graph)\s+(?:TB|TD|BT|RL|LR)\b|` +
  String.raw`(?:sequenceDiagram|erDiagram|stateDiagram(?:-v2)?|classDiagram|gitGraph)\b|` +
  String.raw`(?:gantt|journey|mindmap)[ \t]*\n\s*(?:title|dateFormat|section|root)\b|` +
  String.raw`%%\{\s*init|@startuml\b|(?:strict\s+)?digraph\b[^\n{]*\{)`, "m");
const RUNTIME = new RegExp(String.raw`\b(?:mermaid|d3|vega|vegaEmbed|Viz|graphviz|plantuml|nomnoml|echarts|` +
  String.raw`cytoscape|dagre|ELK|Chart|Plotly)\s*\.\s*[A-Za-z_$][\w$]*\s*\(|\bnew\s+(?:Chart|Viz|ELK)\s*\(`);
function diagramProblems(html, js) {
  const p = [], body = html.split(/<body\b/i)[1] ?? html;
  const shown = body.replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ");
  const classes = [...html.matchAll(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)]
    .map((m) => m[1] ?? m[2] ?? m[3]);
  if (classes.some((c) => /(?:^|\s)(?:language-|lang-)?mermaid(?:\s|$)/i.test(c)) || /\bmermaid\b/i.test(js)) {
    p.push("diagram.mermaid: Mermaid needs a runtime the page may not load; draw the diagram as inline SVG or a table");
  }
  const shape = decode(shown).match(SOURCE_SHAPES);
  if (shape) p.push(`diagram.source: "${shape[0].trim().replace(/\s+/g, " ")}" would show as raw text; draw it as inline SVG or a table`);
  if (RUNTIME.test(js)) p.push("diagram.runtime: script calls a diagram or chart library; draw it as you write");
  return p;
}

// --- read.* and svg.override: the page stays readable whatever the reader's theme --------------
const SHAPES = /^(?:text|tspan|rect|circle|ellipse|line|polyline|polygon|path)$/i;
function cssRules(html) {
  const css = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]).join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({ sel: split(m[1], ","), body: m[2] }));
}
// Splits at a separator outside parentheses: a list's commas, not those inside :is(…).
function split(s, seps) {
  const out = [];
  let depth = 0, at = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "(" || s[i] === ")") depth += s[i] === "(" ? 1 : -1;
    else if (!depth && seps.includes(s[i])) out.push(s.slice(at, at = i + 1).slice(0, -1));
  }
  return [...out, s.slice(at)].map((x) => x.trim()).filter(Boolean);
}
const last = (sel) => split(sel, " \t\n>+~").pop() || "";
// What a selector's last compound picks: {tag, classes, id} each, `*` for any tag; :is() and :where() count.
function targets(compound) {
  const own = compound.replace(/:[\w-]+\([^()]*\)|\[[^\]]*\]/g, "");
  const tag = (own.match(/^(\*|[a-z][\w-]*)/i) || [])[1], id = (own.match(/#([\w-]+)/) || [])[1];
  const classes = [...own.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  const inner = [...compound.matchAll(/:(?:is|where|matches)\(([^()]*)\)/gi)]
    .flatMap((m) => split(m[1], ",").flatMap((x) => targets(last(x))));
  if (inner.length) return inner.map((t) => ({ tag: t.tag, classes: [...t.classes, ...classes], id: t.id ?? id }));
  return tag || classes.length || id ? [{ tag: (tag || "*").toLowerCase(), classes, id }] : [];
}
const UNSET = String.raw`(?!\s*(?:transparent|initial|unset)\b)`;
const declares = (body, prop) => new RegExp(String.raw`(?:^|;)\s*${prop}\s*:\s*${UNSET}\S`, "i").test(body);
function readProblems(html) {
  const p = [], rules = cssRules(html), bodyTag = (html.match(/<body\b[^>]*>/i) || [""])[0];
  const page = rules.filter((r) => r.sel.some((s) => /^(?::root|html|body)$/i.test(s))).map((r) => r.body);
  page.push(attrs(bodyTag || "<b>").style || "");
  if (!page.some((b) => declares(b, "background(?:-color)?"))) {
    p.push("read.background: neither :root, html nor body sets a background; a reader's dark default could hide dark text");
  }
  if (!page.some((b) => declares(b, "color"))) {
    p.push("read.color: neither :root, html nor body sets a text colour; set it with the background so the two stay paired");
  }
  // CSS beats an SVG presentation attribute, so `svg text { fill: … }` silently repaints every fill="…" on <text>.
  const shapes = [...html.replace(COMMENTS, " ").matchAll(new RegExp(`<(${SHAPES.source.slice(4, -2)})\\b[^>]*>`, "gi"))]
    .map((m) => ({ tag: m[1].toLowerCase(), a: attrs(m[0]) }));
  const hits = (t, prop) => shapes.find((e) => prop in e.a && (t.tag === "*" || t.tag === e.tag) && (!t.id || e.a.id === t.id) &&
    t.classes.every((c) => (e.a.class || "").split(/\s+/).includes(c)));
  for (const { sel, body } of rules) {
    for (const prop of ["fill", "stroke"].filter((x) => declares(body, x))) {
      for (const s of sel) {
        const e = targets(last(s)).map((t) => hits(t, prop)).find(Boolean);
        const where = split(s, " \t\n>+~").length > 1 ? " wherever it reaches one" : "";
        if (e) p.push(`svg.override: "${s} { ${prop} }" repaints <${e.tag} ${prop}="…">${where}; colour them by class`);
      }
    }
  }
  return p;
}

// A page's code, flattened: its tags with their attributes (not the text between them), its style sheets and its
// scripts but data ones. A tag is read whole, quoted `>` included.
const TAG = /<[a-z][\w-]*(?:"[^"]*"|'[^']*'|[^'">])*>/gi;
function code(html) {
  const s = html.replace(COMMENTS, " ");
  const styles = [...s.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)].map((m) => m[1]);
  const tags = [...s.replace(/<(script|style)\b([^>]*)>[\s\S]*?<\/\1\s*>/gi, "<$1$2>").matchAll(TAG)].map((m) => m[0]);
  return { tags: flatten(tags.join("\n")), code: flatten([...tags, ...styles, ...inlineScripts(s)].join("\n")) };
}

// Problems as "<code>: <reason>" lines; [] means the page passes.
function check(html) {
  const js = inlineScripts(html).join("\n"), read = { js, ...code(html) };
  const p = [...skeletonProblems(html), ...cspProblems(html)];
  for (const [id, re, what, on = "code"] of FORBIDDEN) if (re.test(read[on])) p.push(`${id}: ${what}`);
  p.push(...diagramProblems(html, js), ...readProblems(html));
  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > MAX_BYTES) p.push(`size: ${bytes} bytes is over the ${MAX_BYTES}-byte cap; cut content, embed no font`);
  return p;
}

function cmdCheck(files) {
  if (!files.length) return [2, [USAGE]];
  const problems = [];
  for (const f of files) {
    let html;
    try {
      html = fs.readFileSync(f, "utf8");
    } catch (e) {
      return [2, [`cannot read ${f}: ${e.message}`]];
    }
    problems.push(...check(html).map((line) => `${f}: ${line}`));
  }
  const head = `check failed: ${plural(problems.length, "problem")}`;
  if (problems.length) return [1, [head, ...problems.map((l) => `  ${l}`)]];
  return [0, [`check passed: ${plural(files.length, "page")} (skeleton, offline CSP, no diagram runtime, readable)`]];
}

module.exports = { MAX_BYTES, check, inlineScripts };

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  const [exit, lines] = cmd === "check" ? cmdCheck(args) : [2, [USAGE]];
  (exit === 0 ? console.log : console.error)(lines.join("\n"));
  process.exitCode = exit;
}
