"use strict";
// envision's one executable boundary. `render` validates docs/vision/board.json, gates "agreed" on ready(),
// shuffles the directions and injects the board into templates/board.html through one escaped JSON seam;
// `check` gates a prototype for /design-to-code; `bake` re-seals a page's CSP script hash (USAGE below).
// The tests import THESE functions. Exit 0 done · 1 refused, every reason on stderr · 2 usage, I/O or template.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const TEMPLATE = path.join(__dirname, "..", "templates", "board.html");
const SEAM = '<script id="vision-data" type="application/json">/*__VISION_DATA__*/</script>';
const OPEN = SEAM.slice(0, SEAM.indexOf("/*"));
const cspFor = (token) =>
  `default-src 'none'; script-src ${token}; style-src 'unsafe-inline'; img-src data:; font-src data:; ` +
  "base-uri 'none'; form-action 'none'";
const USAGE =
  'usage: render.cjs render [docs/vision/board.json] [--for "<name>"] | check <prototype.html>... | bake <file.html>';
const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
const set = (s) => typeof s === "string" && s.trim() !== "";
const chars = (s) => [...s].length;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const sha = (text) => `'sha256-${crypto.createHash("sha256").update(text, "utf8").digest("base64")}'`;
function stop(exit, head, lines = []) {
  throw Object.assign(new Error(head), { exit, lines });
}

// --- Schema: fixtures/sample-board.json is the worked example of every key -------------------
// Every key is required and an unknown one is refused, so a typo cannot hide a field from ready().
const TEXT = "text", BOOL = "bool", INT = "int", HEX = "hex", SKETCH = "sketch";
const list = (of) => ({ list: of });
const oneOf = (...values) => ({ oneOf: values });
const SPEC = {
  schema: oneOf(1),
  project: TEXT,
  round: INT,
  step: oneOf(1, 2, 3, 4),
  status: oneOf("exploring", "agreed", "draft"),
  outcome: TEXT,
  stillToSee: list(TEXT),
  intent: TEXT,
  appetite: TEXT,
  tone: list(TEXT),
  notes: list(TEXT),
  heard: list({ theme: TEXT, episode: BOOL, quotes: list({ text: TEXT, round: INT, from: TEXT }) }),
  people: list({ name: TEXT, wants: TEXT, failsIf: TEXT, decides: BOOL }),
  concepts: list({
    id: TEXT, title: TEXT, forWhom: TEXT, moment: TEXT, givesUp: TEXT,
    outside: BOOL, yours: BOOL, existingTools: BOOL, home: SKETCH,
  }),
  pick: { id: TEXT, miss: TEXT },
  screens: list({ id: TEXT, title: TEXT, wireframe: SKETCH, next: list(TEXT) }),
  features: list({
    id: TEXT, title: TEXT, step: TEXT,
    bucket: oneOf("first", "later", "no"), source: oneOf("said", "picked", "guess"), quote: TEXT,
  }),
  open: list({
    id: TEXT, kind: oneOf("tension", "decision", "question"), text: TEXT, options: list(TEXT), who: TEXT,
  }),
  agreement: { teach: TEXT, oneFlow: TEXT, couldWait: list(TEXT), annoy: TEXT, items: list(TEXT), yes: TEXT },
  feel: {
    source: oneOf("", "adopt", "impeccable", "claude-design", "in-session"),
    tiles: list({ id: TEXT, name: TEXT, swatches: list(HEX), fonts: list(TEXT), note: TEXT }),
    pick: TEXT,
    locked: BOOL,
  },
  changed: list({ line: TEXT, change: TEXT }),
};
const ID = /^[A-Za-z][A-Za-z0-9_-]{0,23}$/;
const OUTCOME = /^(On hold|Not building it: \S.*|Solved without building: \S.*)$/s;
const own = (o, k) => Object.hasOwn(o, k); // never `in`: "constructor" or "__proto__" would pass as a field

function shape(v, spec, at, errs) {
  const sub = (k) => (at ? `${at}.${k}` : k);
  if (spec === SKETCH) return; // sketch() checks it once the ids are known
  if (spec === TEXT) return typeof v === "string" || errs.push(`${at}: expected text`);
  if (spec === BOOL) return typeof v === "boolean" || errs.push(`${at}: expected true or false`);
  if (spec === INT) return (Number.isInteger(v) && v >= 1) || errs.push(`${at}: expected a whole number of 1 or more`);
  if (spec === HEX) return /^#[0-9a-fA-F]{6}$/.test(v) || errs.push(`${at}: expected a #rrggbb colour`);
  if (spec.oneOf) {
    const shown = spec.oneOf.map((x) => JSON.stringify(x)).join(" | ");
    return spec.oneOf.includes(v) || errs.push(`${at}: expected one of ${shown}`);
  }
  if (spec.list) {
    if (!Array.isArray(v)) return errs.push(`${at}: expected a list`);
    return v.forEach((x, i) => shape(x, spec.list, `${at}[${i}]`, errs));
  }
  if (!isObj(v)) return errs.push(`${at || "board"}: expected an object`);
  for (const k of Object.keys(spec)) {
    if (own(v, k)) shape(v[k], spec[k], sub(k), errs);
    else errs.push(`${sub(k)}: missing`);
  }
  for (const k of Object.keys(v)) {
    if (!own(spec, k) && !(at === "" && k === "$comment")) errs.push(`${sub(k)}: not a board field`);
  }
}

// --- Wireframe DSL: containers and named regions; no colour, font or size field exists -------
const BOXES = ["row", "col"];
const REGIONS = "nav header text list card table form field button image tabs modal empty badge".split(" ");
function sketch(n, at, isIn, errs, depth) {
  if (!isObj(n)) return errs.push(`${at}: expected a sketch part`);
  const box = BOXES.includes(n.type);
  const allowed = box ? ["type", "children"] : ["type", "label", "copy", "feature", "go"];
  if (!box && !REGIONS.includes(n.type)) {
    return errs.push(`${at}.type: "${n.type}" is not a sketch part (${BOXES.concat(REGIONS).join(" ")})`);
  }
  const stray = (k) => `${at}.${k}: not a sketch field (allowed: ${allowed.join(" ")}); no colour, font or size`;
  for (const k of Object.keys(n)) if (!allowed.includes(k)) errs.push(stray(k));
  if (box && !Array.isArray(n.children)) return errs.push(`${at}.children: expected a list`);
  if (box && depth >= 8) return errs.push(`${at}: sketch nested deeper than 8`);
  if (box) return n.children.forEach((c, i) => sketch(c, `${at}.children[${i}]`, isIn, errs, depth + 1));
  if (!set(n.label) || chars(n.label) > 40) errs.push(`${at}.label: 1-40 characters`);
  if (own(n, "copy") && (typeof n.copy !== "string" || chars(n.copy) > 120)) {
    errs.push(`${at}.copy: at most 120 characters`);
  }
  if (own(n, "feature") && !isIn(n.feature, "features")) errs.push(`${at}.feature: no feature card "${n.feature}"`);
  if (own(n, "go") && !isIn(n.go, "screens")) errs.push(`${at}.go: no screen "${n.go}"`);
}

// Schema, ids, references, the directions contract and the status rules. [] means valid.
function validate(b) {
  const errs = [];
  shape(b, SPEC, "", errs);
  if (errs.length) return errs;
  const owner = new Map(), f = b.feel;
  const groups = {
    concepts: b.concepts, screens: b.screens, features: b.features, open: b.open, "feel.tiles": f.tiles,
  };
  for (const [name, items] of Object.entries(groups)) {
    items.forEach((x, i) => {
      if (!ID.test(x.id)) {
        errs.push(`${name}[${i}].id: "${x.id}" is not an id (a letter, then letters, digits, - or _; 24 at most)`);
      } else if (owner.has(x.id)) {
        errs.push(`${name}[${i}].id: "${x.id}" is already used by ${owner.get(x.id)}`);
      } else {
        owner.set(x.id, name);
      }
    });
  }
  const isIn = (id, name) => owner.get(id) === name;
  const count = (key) => b.concepts.filter((c) => c[key]).length;
  if (b.concepts.length < 2 || b.concepts.length > 4) {
    errs.push(`concepts: need 2-4 directions, found ${b.concepts.length}`);
  }
  if (count("outside") !== 1) {
    const found = count("outside");
    errs.push(`concepts: exactly one direction must be "outside what you said" (outside: true), found ${found}`);
  }
  if (count("yours") > 1) {
    errs.push(`concepts: at most one direction can be "your words" (yours: true), found ${count("yours")}`);
  }
  b.concepts.forEach((c, i) => {
    if (c.yours && c.outside) errs.push(`concepts[${i}]: a direction cannot be both "your words" and "outside"`);
  });
  b.concepts.forEach((c, i) => sketch(c.home, `concepts[${i}].home`, isIn, errs, 0));
  b.screens.forEach((s, i) => sketch(s.wireframe, `screens[${i}].wireframe`, isIn, errs, 0));
  b.screens.forEach((s, i) => s.next.forEach((id, j) => {
    if (!isIn(id, "screens")) errs.push(`screens[${i}].next[${j}]: no screen "${id}"`);
  }));
  b.features.forEach((x, i) => {
    if (x.source === "said" && !set(x.quote)) {
      errs.push(`features[${i}].quote: a "said" card carries the user's own words`);
    }
  });
  b.open.forEach((o, i) => {
    if (o.kind === "tension" && o.who !== "me") errs.push(`open[${i}].who: a tension is the owner's to settle ("me")`);
  });
  b.agreement.items.forEach((t, i) => {
    if (!set(t)) errs.push(`agreement.items[${i}]: empty`);
  });
  if (b.pick.id && !isIn(b.pick.id, "concepts")) errs.push(`pick.id: no direction "${b.pick.id}"`);
  if (f.pick && !isIn(f.pick, "feel.tiles")) errs.push(`feel.pick: no tile "${f.pick}"`);
  if (b.status !== "agreed" && (f.source || f.tiles.length || f.pick || f.locked)) {
    errs.push('feel: the look comes after agreement; keep it empty until status is "agreed"');
  }
  if (b.status === "draft" && !OUTCOME.test(b.outcome)) {
    errs.push('outcome: a draft carries "On hold", "Not building it: <why>" or "Solved without building: <how>"');
  }
  if (b.status !== "draft" && b.outcome !== "") errs.push("outcome: only a draft carries an outcome");
  return errs;
}

// --- ready(): the agent's side of agreement; it catches omission, not fabrication -------------
// The page lists these under "Before we can agree", so the text is in the user's plain words.
function ready(b) {
  const a = b.agreement;
  const feature = new Map(b.features.map((f) => [f.id, f]));
  const first = (id) => feature.get(id)?.bucket === "first";
  const known = new Set([...b.concepts, ...b.features, ...b.open].map((x) => x.id));
  const tensions = b.open.filter((o) => o.kind === "tension").map((o) => o.id);
  const guesses = b.features.filter((f) => f.bucket === "first" && f.source === "guess").map((f) => f.id);
  const waitCards = a.couldWait.filter((w) => feature.has(w));
  const annoyOk = a.annoy.trim().toLowerCase() === "none" || (feature.has(a.annoy) && !first(a.annoy));
  return [
    ["ready.pick", Boolean(b.pick.id) && set(b.pick.miss), [b.pick.id],
      "Pick a direction and say what you'd miss ('nothing' is fine)"],
    ["ready.tension", tensions.length === 0, tensions,
      "Settle the things you said that pull against each other"],
    ["ready.guess", guesses.length === 0, guesses,
      "Keep, move or drop the First version cards that are still my guesses"],
    ["ready.answers", set(a.teach) && set(a.oneFlow) && set(a.annoy), [],
      "Say what we're building and for whom, the one flow, and what would annoy you"],
    ["ready.couldWait", a.couldWait.some(set) && !waitCards.some(first), waitCards.filter(first),
      "Name what could wait if you shipped next week, or why nothing can; those cards leave First version"],
    ["ready.oneFlow", first(a.oneFlow) && annoyOk, [a.oneFlow, a.annoy],
      "Your one flow is in First version, and what would annoy you is not"],
    ["ready.items", a.items.length >= 1 && a.items.length <= 9, [],
      `Write the agreement as 1 to 9 items (now ${a.items.length})`],
  ].map(([code, ok, refs, text]) => ({ code, ok, text, refs: refs.filter((id) => known.has(id)) }));
}

// --- "Your turn": what this round asks of `who`; render caps it at 7 ---------------------------
// The owner ("me") answers the pick, the walk, unclaimed items and guesses; anyone else only the
// open items that name them.
function yourTurn(b, who = "me") {
  const turn = [], mine = who === "me";
  if (mine && !b.pick.id) {
    turn.push({ kind: "pick", text: "Which direction would you open on Monday?", refs: b.concepts.map((c) => c.id) });
  } else if (mine && !set(b.pick.miss)) {
    turn.push({
      kind: "miss", text: "What will you miss from the other directions? 'Nothing' is fine.", refs: [b.pick.id],
    });
  }
  if (mine && b.status === "exploring" && b.step === 2 && b.screens.length) {
    turn.push({
      kind: "walk", text: "Walk the flow and tell me what's wrong, or say it's fine", refs: [b.screens[0].id],
    });
  }
  for (const o of b.open) {
    if (o.who === who || (mine && o.who === "")) turn.push({ kind: o.kind, text: o.text, refs: [o.id] });
  }
  const guesses = b.features.filter((f) => f.bucket === "first" && f.source === "guess").map((f) => f.id);
  const are = guesses.length === 1 ? "is" : "are";
  const text = `${plural(guesses.length, "First version card")} ${are} my guess: keep, move or drop`;
  if (mine && guesses.length) turn.push({ kind: "guess", text, refs: guesses });
  return turn;
}

// Directions in shown order, shuffled from a seed of project, round and ids: a re-render of the
// same round keeps its order. The user's own frame ("your words") is never first.
function ordered(b) {
  const ids = b.concepts.map((c) => c.id).sort();
  const seed = crypto.createHash("sha256").update(`${b.project}\n${b.round}\n${ids.join(",")}`).digest();
  const out = [...b.concepts].sort((x, y) => (x.id < y.id ? -1 : 1));
  for (let i = out.length - 1; i > 0; i--) {
    const j = seed[i] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out[0].yours) {
    const j = 1 + (seed[31] % (out.length - 1));
    [out[0], out[j]] = [out[j], out[0]];
  }
  return out;
}

// A share copy carries none of the owner's own words: no What I heard (quotes, people), tone,
// appetite or notes, no provenance (source, quote, the feedback line behind each change), no miss,
// no yes, no tension (it quotes the owner) and no item nobody is named for. Venting never reaches its subjects.
const forShare = (b) => ({
  ...b,
  heard: [],
  people: [],
  tone: [],
  appetite: "",
  notes: [],
  pick: { ...b.pick, miss: "" },
  agreement: { ...b.agreement, yes: "" },
  open: b.open.filter((o) => o.kind !== "tension" && o.who !== ""),
  features: b.features.map(({ source, quote, ...f }) => f),
  changed: b.changed.map(({ line, ...c }) => c),
});

// --- The seam: JSON Unicode escapes (not entities) that JSON.parse decodes; no </script> or <!-- survives
const escapeJson = (json) =>
  json.replace(/[<>&\u2028\u2029]/g, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const seamOf = (html) => JSON.parse(html.slice(html.indexOf(OPEN) + OPEN.length).split("</script>")[0]);
// The inner text of each executable inline <script>; JSON data blocks never run.
const inlineScripts = (html) => [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)]
  .filter((m) => !/\btype\s*=\s*["']?application\/json/i.test(m[1])).map((m) => m[2]);
// The template keeps the seam once, one inline script, and v2's CSP baked with that script's hash.
function checkTemplate(tpl) {
  const scripts = inlineScripts(tpl);
  if (tpl.split(SEAM).length !== 2) stop(2, `template broken: the seam element must appear exactly once: ${SEAM}`);
  if (scripts.length !== 1) stop(2, `template broken: expected one inline script, found ${scripts.length}`);
  if (tpl.includes(`<meta http-equiv="Content-Security-Policy" content="${cspFor(sha(scripts[0]))}">`)) return;
  const fix = `run: node render.cjs bake ${TEMPLATE}`;
  stop(2, `template broken: its CSP is not the contract's or its script hash is stale; ${fix}`);
}

function renderHtml(tpl, board, opts = {}) {
  checkTemplate(tpl);
  const errs = validate(board);
  if (errs.length) stop(1, `render refused: board.json has ${plural(errs.length, "problem")}`, errs);
  const forName = opts.forName || null, agreed = board.status === "agreed";
  const turn = yourTurn(board, forName || "me");
  const checks = ready(board);
  const failing = checks.filter((c) => !c.ok);
  const gate = [
    turn.length > 7 && [`"Your turn" has ${turn.length} decisions; keep it to 7 and move the rest to the next round`,
      turn.map((t) => `${t.kind}: ${t.text}`)],
    agreed && failing.length && [`status is "agreed" but ${failing.length} of 7 checks fail (Before we can agree)`,
      failing.map((c) => `${c.code}: ${c.text}${c.refs.length ? ` [${c.refs.join(", ")}]` : ""}`)],
    agreed && !set(board.agreement.yes) &&
      ['status is "agreed" but agreement.yes is empty; only the user\'s own "yes" in chat agrees', []],
  ].find(Boolean);
  if (gate) stop(1, `render refused: ${gate[0]}`, gate[1]);
  const { $comment, ...rest } = board;
  const shown = { ...(forName ? forShare(rest) : rest), concepts: ordered(board) };
  const view = { for: forName, turn, ready: forName ? [] : checks, links: forName ? [] : opts.links || [] };
  const json = escapeJson(JSON.stringify({ board: shown, view }));
  return tpl.replace(SEAM, () => `${OPEN}${json}</script>`);
}

// --- check: a prototype is offline, carries design-to-code's five channels and the banner -----
// Patterns run on a flat copy: entities decoded (bar < > " '), CSS comments dropped and escapes undone,
// so `&#58;`, `\75rl(` or `url(/**/…)` hide nothing. The CSP blocks what a pattern cannot see.
const ENTITY = {
  __proto__: null, amp: "&", colon: ":", sol: "/", bsol: "\\", period: ".",
  tab: "\t", newline: "\n", lpar: "(", rpar: ")",
};
const char = (n) => (n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "\ufffd");
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
  if (stale.length) p.push(`csp.hash: script-src lacks ${stale.join(" ")}; run: node render.cjs bake <file>`);
  return p;
}

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
  ["js.inline", /<[a-z][\w-]*\b[^>]*[\s/"']on[a-z]+\s*=/i,
    "has an inline on…= handler; wire behaviour with addEventListener"],
  ["js.url", /javascript:/i, "has a javascript: URL"],
];
// The skeleton's example text: a copied prototype must say real things before it passes.
const PLACEHOLDER = /the user's own words go here|real wording goes here|\bScreen (?:title|name)\b|\bround N\b/;
// design-to-code's five channels (design-to-code/SKILL.md, references/extraction-guide.md).
const CHANNELS = [
  ["ch1.tokens", (h) => /:root\s*\{[^}]*--[\w-]+\s*:/.test(h), "channel 1 (tokens): no :root { --name: value } block"],
  ["ch2.comments",
    (h, notes) => notes.some((c) => /because\s+["“][^"”]+["”]\s*\(R\d+,\s*(?:said|picked|guess)\b/.test(c)),
    "channel 2 (reviewer comments): no intent comment quoting the user: " +
      '<!-- what, because "their words" (R2, said) -->'],
  ["ch3.gallery", (h, notes) => notes.some((c) => /^<!--\s*PANEL\s+\d+\s+—\s+Component gallery\b/.test(c)),
    "channel 3 (gallery states): no <!-- PANEL n — Component gallery --> comment"],
  ["ch4.js", (h) => inlineScripts(h).some((s) => /\.addEventListener\s*\(/.test(s)),
    "channel 4 (vanilla JS): no script using addEventListener"],
  ["ch5.xref", (h, notes) => notes.some((c) => /mirrored from\s+(?![a-z][a-z0-9+.-]*:|\/\/)[\w./-]+/i.test(c)),
    "channel 5 (cross-references): no 'TOKENS — mirrored from <local path>' comment"],
];

// Problems as "<code>: <reason>" lines; [] means the prototype passes.
function check(html) {
  const p = cspProblems(html), flat = flatten(html), js = inlineScripts(html).join("\n");
  for (const [code, re, what, on] of FORBIDDEN) if (re.test(on === "js" ? js : flat)) p.push(`${code}: ${what}`);
  if (PLACEHOLDER.test(html)) {
    p.push("placeholder: still carries the skeleton's example text; write the screen's real words");
  }
  const notes = html.match(/<!--[\s\S]*?-->|\/\*[\s\S]*?\*\//g) || [];
  for (const [code, has, what] of CHANNELS) if (!has(html, notes)) p.push(`${code}: ${what}`);
  const body = html.split(/<body\b/i)[1] ?? html;
  const visible = body.replace(/<!--[\s\S]*?-->|<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ").replace(/<[^>]*>/g, " ");
  if (!/\bPROVISIONAL\b/.test(visible)) p.push("banner: no visible PROVISIONAL banner");
  return p;
}

// --- CLI --------------------------------------------------------------------------------------
const rel = (p) => path.relative(process.cwd(), p) || p;
const linked = (p) => fs.lstatSync(p, { throwIfNoEntry: false })?.isSymbolicLink() ?? false;
function write(file, text) { // a planted symbolic link would carry the write outside the project
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (linked(file)) stop(2, `refused: ${rel(file)} is a symbolic link; render writes only real files`);
  fs.writeFileSync(file, text);
}
function slug(name) {
  const latin = name.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") ||
    `p-${crypto.createHash("sha256").update(name).digest("hex").slice(0, 8)}`;
}
// Design links for the page header, as hrefs relative to index.html.
function links(dir) {
  const ls = (sub, re) => {
    try {
      return fs.readdirSync(path.join(dir, sub)).filter((f) => re.test(f)).sort();
    } catch {
      return [];
    }
  };
  const kinds = [
    ["agreement", "../foundation", /^PRD-[\w.-]+\.md$/],
    ["tokens", "design", /^tokens\.css$/],
    ["prototype", "prototype", /^[\w.-]+\.html$/],
  ];
  return kinds.flatMap(([kind, sub, re]) => ls(sub, re).map((f) => ({ kind, href: `${sub}/${f}` })));
}

function cmdRender(args) {
  const at = args.indexOf("--for"), forName = at === -1 ? null : args.splice(at, 2)[1];
  if (at !== -1 && (!set(forName) || chars(forName) > 40 || forName.trim().toLowerCase() === "me")) {
    stop(2, 'usage: --for needs a name of 1-40 characters other than "me" (the owner)');
  }
  if (args.length > 1) stop(2, USAGE);
  const boardPath = path.resolve(args[0] || path.join("docs", "vision", "board.json"));
  const dir = path.dirname(boardPath);
  let board;
  try {
    board = JSON.parse(fs.readFileSync(boardPath, "utf8"));
  } catch (e) {
    stop(2, `cannot read ${rel(boardPath)}: ${e.message}`);
  }
  const html = renderHtml(fs.readFileSync(TEMPLATE, "utf8"), board, { forName, links: links(dir) });
  // Share copies live in share/, ignored by its own .gitignore: the project's root one is never edited.
  const share = path.join(dir, "share");
  const out = forName ? path.join(share, `${slug(forName)}.html`) : path.join(dir, "index.html");
  if (forName && linked(share)) stop(2, `refused: ${rel(share)} is a symbolic link; render writes only real files`);
  if (forName && fs.existsSync(out)) { // names that differ only in accents, case or punctuation share a slug
    let was = null;
    try {
      was = seamOf(fs.readFileSync(out, "utf8")).view.for;
    } catch {
      // not a share copy
    }
    const whose = was ? `"${was}"` : "someone else";
    if (was !== forName) {
      stop(2, `usage: ${rel(out)} is ${whose}'s copy; give "${forName}" a name that differs in letters`);
    }
  }
  if (forName && !fs.existsSync(path.join(share, ".gitignore"))) write(path.join(share, ".gitignore"), "*\n");
  write(out, html);
  const failing = ready(board).filter((c) => !c.ok).map((c) => c.code);
  const who = forName ? ` · for ${forName}, untracked` : "";
  const turn = yourTurn(board, forName || "me").length;
  const summary = `round ${board.round} · ${board.status} · your turn ${turn} · ready ${7 - failing.length}/7${who}`;
  console.log(`wrote ${rel(out)} (${summary})`);
  if (failing.length) console.log(`before we can agree: ${failing.join(", ")}`);
}

function cmdCheck(files) {
  if (!files.length) stop(2, USAGE);
  const problems = files.flatMap((f) => check(fs.readFileSync(f, "utf8")).map((p) => `${f}: ${p}`));
  if (problems.length) stop(1, `check failed: ${plural(problems.length, "problem")}`, problems);
  console.log(`check passed: ${plural(files.length, "prototype")} (offline CSP, five channels, PROVISIONAL banner)`);
}

// Rewrites script-src to the sha256 of the page's one inline script; the meta sits outside the script.
function cmdBake(args) {
  if (args.length !== 1) stop(2, USAGE);
  const html = fs.readFileSync(args[0], "utf8"), scripts = inlineScripts(html);
  const re = /(<meta\s+http-equiv="Content-Security-Policy"\s+content="[^"]*?script-src\s+)[^;"]*/i;
  if (scripts.length !== 1 || !re.test(html)) {
    stop(1, `bake refused: needs one inline script (found ${scripts.length}) and a CSP script-src`);
  }
  write(args[0], html.replace(re, (_, head) => head + sha(scripts[0])));
  console.log(`baked ${args[0]}: script-src ${sha(scripts[0])}`);
}

module.exports = {
  SEAM, TEMPLATE, cspFor, validate, ready, yourTurn, ordered, forShare, escapeJson, inlineScripts, renderHtml, check,
};

if (require.main === module) {
  const [cmd, ...args] = process.argv.slice(2);
  const cmds = { render: cmdRender, check: cmdCheck, bake: cmdBake };
  try {
    if (!own(cmds, cmd ?? "")) stop(2, USAGE);
    cmds[cmd](args);
  } catch (e) {
    const lines = e.exit === undefined ? [`render.cjs: ${e.message}`] : [e.message, ...e.lines.map((l) => `  ${l}`)];
    console.error(lines.join("\n"));
    process.exit(e.exit ?? 2);
  }
}
