"use strict";
// Dart sources under lib/. The read half: a comment- and string-aware mask, the fromEnvironment keys, the Env class
// and production constants, the environment banner (where it sits, what it hides, how it is wired), the app roots,
// and the Firebase options and initialisation. Every fact is read from masked code, so comments never count. The write
// half: Env, the banner and its test from templates, the Env Firebase region, the MaterialApp( wiring and the options.

const path = require("node:path");
const { at } = require("../lib/io.cjs");
const { readBlock, ensureBlock } = require("../lib/managed.cjs");
const { render } = require("../lib/templates.cjs");

// A same-length copy with comments blanked and, by default, string contents blanked (delimiters kept).
function mask(text, { strings = true } = {}) {
  const out = text.split("");
  const n = text.length;
  const blank = (from, to) => { for (let k = from; k < to; k++) if (out[k] !== "\n") out[k] = " "; };
  function string(i) {
    const raw = text[i] === "r";
    const q = text[raw ? i + 1 : i];
    const triple = text.startsWith(q.repeat(3), raw ? i + 1 : i);
    const close = triple ? q.repeat(3) : q;
    const open = (raw ? 1 : 0) + close.length;
    for (let j = i + open; j < n;) {
      if (!raw && text[j] === "\\") { j += 2; continue; }
      if (!raw && text[j] === "$" && text[j + 1] === "{") { j = interpolation(j + 2); continue; }
      if (text.startsWith(close, j)) return { open, end: j + close.length, close: close.length };
      if (!triple && text[j] === "\n") return { open, end: j, close: 0 };
      j++;
    }
    return { open, end: n, close: 0 };
  }
  function interpolation(j) {
    for (let depth = 1; j < n && depth;) {
      const c = text[j];
      if (c === "'" || c === '"') { j = string(j).end; continue; }
      if (c === "{") depth++;
      else if (c === "}") depth--;
      j++;
    }
    return j;
  }
  for (let i = 0; i < n;) {
    if (text.startsWith("//", i)) { const e = text.indexOf("\n", i); const end = e < 0 ? n : e; blank(i, end); i = end; }
    else if (text.startsWith("/*", i)) {
      let d = 1;
      let j = i + 2;
      while (j < n && d) { if (text.startsWith("/*", j)) { d++; j += 2; } else if (text.startsWith("*/", j)) { d--; j += 2; } else j++; }
      blank(i, j);
      i = j;
    } else if (text[i] === "'" || text[i] === '"' || (text[i] === "r" && (text[i + 1] === "'" || text[i + 1] === '"') && !/[\w$]/.test(text[i - 1] || ""))) {
      const s = string(i);
      if (strings) blank(i + s.open, s.end - s.close);
      i = s.end;
    } else i++;
  }
  return out.join("");
}

const PAIR = { "(": ")", "[": "]", "{": "}" };
function closer(code, open) {
  const stack = [];
  for (let i = open; i < code.length; i++) {
    const c = code[i];
    if (PAIR[c]) stack.push(PAIR[c]);
    else if (c === ")" || c === "]" || c === "}") { if (stack.pop() !== c) return -1; if (!stack.length) return i; }
  }
  return -1;
}

// The top-level `name:` arguments of a call whose parentheses span [open, close].
function namedArgs(code, keep, open, close) {
  const out = {};
  let depth = 0;
  let start = open + 1;
  const flush = (end) => {
    const part = keep.slice(start, end);
    const m = /^\s*(\w+)\s*:\s*([\s\S]*?)\s*$/.exec(part);
    if (m) out[m[1]] = { expr: m[2], index: start + part.indexOf(m[1]) };
  };
  for (let i = open + 1; i < close; i++) {
    const c = code[i];
    if (c === "(" || c === "[" || c === "{") depth++;
    else if (c === ")" || c === "]" || c === "}") depth--;
    else if (c === "," && depth === 0) { flush(i); start = i + 1; }
  }
  flush(close);
  return out;
}

const PROD = /^(production|prod|prd|live)$/i;
// A member read from an Env-like class (Env, AppEnv, EnvConfig): the read half's fromEnv and the write half's FlutterFire
// test share it, so both halves agree on which options files already read Env.
const READS_ENV = /\b(?:[A-Z]\w*)?Env\w*\.\w/;
const ROOT = /(?<![\w.])(MaterialApp|CupertinoApp|WidgetsApp)(\.router)?\s*\(/g;

function spans(src, re) {
  return [...src.code.matchAll(re)].map((m) => {
    const open = m.index + m[0].length - 1;
    return { index: m.index, open, close: closer(src.code, open), name: m[1] };
  }).filter((s) => s.close > 0);
}

// The class or function whose body holds `index`: the innermost declaration before it whose braces enclose it.
function enclosing(src, index) {
  let best = null;
  for (const m of src.code.matchAll(/\bclass\s+(\w+)[^{;]*\{|(?<![\w.])([A-Za-z_]\w*)\s*\([^()]*(?:\([^()]*\)[^()]*)*\)\s*(?:async\s*)?\{/g)) {
    if (m.index > index) break;
    const name = m[1] || m[2];
    if (!m[1] && /^(if|for|while|switch|catch|build|return)$/.test(name)) continue;
    const open = m.index + m[0].length - 1;
    const close = closer(src.code, open);
    if (close > index && (!best || open > best.open)) best = { name, open, close, isClass: !!m[1] };
  }
  return best;
}

function fromEnvironment(sources) {
  const keys = {};
  for (const src of sources) {
    for (const m of src.text.matchAll(/\b(String|bool|int|double)\.fromEnvironment\(\s*(['"])([^'"\n]+)\2([^)]*)\)/g)) {
      if (src.code[m.index] === " ") continue;
      const hasDefault = /defaultValue\s*:/.test(m[4]);
      const k = (keys[m[3]] ||= { key: m[3], kind: m[1], at: at(src.rel, src.text, m.index), hasDefault: false, sites: 0 });
      k.hasDefault = k.hasDefault || hasDefault;
      k.sites++;
    }
  }
  return keys;
}

function envClass(sources) {
  let best = null;
  for (const src of sources) {
    for (const m of src.code.matchAll(/\bclass\s+(\w+)[^{;]*\{/g)) {
      const open = m.index + m[0].length - 1;
      const close = closer(src.code, open);
      const body = src.text.slice(open, close);
      const region = readBlock(src.text, { id: "firebase", syntax: "slash" });
      const fields = [...body.matchAll(/static\s+const\s+(?:\w+\??\s+)?(\w+)\s*=\s*(?:const\s+)?(?:String|bool|int|double)\.fromEnvironment\(\s*['"]([^'"]+)['"]/g)]
        .filter((f) => src.code[open + f.index] !== " ")
        .map((f) => ({ field: f[1], key: f[2], inRegion: !!region && open + f.index >= region.start && open + f.index < region.end }));
      if (fields.length && (!best || fields.length > best.fields.length)) best = { file: src.rel, name: m[1], at: at(src.rel, src.text, m.index), fields, region: !!region };
    }
  }
  return best;
}

// Production-named string constants. A backslash escape reads as the character it protects, so a NAME the write half
// escaped reads back as written.
function prodConstants(sources) {
  const out = [];
  for (const src of sources) {
    for (const m of src.keep.matchAll(/\b(?:static\s+)?const\s+(?:String\s+)?(\w+)\s*=\s*(?:'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)")/g)) {
      if (PROD.test(m[1])) out.push({ name: m[1], value: (m[2] ?? m[3]).replace(/\\(.)/g, "$1"), file: src.rel, at: at(src.rel, src.text, m.index) });
    }
  }
  return out;
}

// The production comparison in a banner's file: either side may be the production constant or literal.
// Each side is an identifier chain (calls allowed) or a string literal; no nested quantifier, so no backtracking blow-up.
const COMPARISON = /([\w.]+(?:\(\)[\w.]*)*|'[^'\n]*'|"[^"\n]*")\s*(==|!=)\s*([\w.]+(?:\(\)[\w.]*)*|'[^'\n]*'|"[^"\n]*")/g;
function productionCheck(src, constants) {
  for (const m of src.keep.matchAll(COMPARISON)) {
    if (src.code[m.index] === " ") continue;
    for (const side of [m[3], m[1]]) {
      const literal = /^['"](.*)['"]$/.exec(side);
      const last = literal ? null : side.split(".").filter((p) => !/\(\)$/.test(p)).pop();
      if (literal ? !PROD.test(literal[1]) : !(last && PROD.test(last))) continue;
      // The banner file's own constant wins over a same-named one in another file.
      const constant = constants.find((c) => c.name === last && c.file === src.rel) || constants.find((c) => c.name === last);
      const value = literal ? literal[1] : (constant || {}).value || null;
      const index = m.index + m[0].indexOf(m[2], m[1].length);
      return { op: m[2], value, constant: literal ? null : side, at: at(src.rel, src.text, index), index, caseInsensitive: /to(Lower|Upper)Case\(\)|equalsIgnoreCase/.test(m[0]) };
    }
  }
  return null;
}

const PLACEHOLDER = /^\s*(const\s+)?(SizedBox|Container|Placeholder|Offstage)\b/;
const isTernary = (code, i) => code[i] === "?" && code[i + 1] !== "?" && code[i + 1] !== "." && code[i - 1] !== "?";

// Does the branch taken in production return the app's child, or a placeholder in its place?
function dropsChild(src, check) {
  const code = src.code;
  let i = check.index + 2;
  for (let depth = 0; i < code.length; i++) {
    const c = code[i];
    if (c === "{" && depth === 0) break;
    if ("([{".includes(c)) depth++;
    else if (")]}".includes(c)) { if (depth === 0) break; depth--; }
    else if (depth === 0 && (c === ";" || c === "," || isTernary(code, i))) break;
  }
  if (isTernary(code, i)) {
    let colon = -1;
    let end = code.length;
    for (let j = i + 1, depth = 0, pending = 0; j < code.length; j++) {
      const c = code[j];
      if ("([{".includes(c)) depth++;
      else if (")]}".includes(c)) { if (depth === 0) { end = j; break; } depth--; }
      else if (depth === 0 && isTernary(code, j)) pending++;
      else if (depth === 0 && c === ":") { if (pending) pending--; else if (colon < 0) colon = j; }
      else if (depth === 0 && (c === "," || c === ";") && colon >= 0) { end = j; break; }
    }
    if (colon < 0) return false;
    return PLACEHOLDER.test(check.op === "==" ? code.slice(i + 1, colon) : code.slice(colon + 1, end));
  }
  if (code[i] !== ")") return false;
  const body = code.slice(i + 1);
  if (check.op === "==") { const r = /^\s*\{?\s*return\s+([\s\S]{0,80})/.exec(body); return !!r && PLACEHOLDER.test(r[1]); }
  const open = /^\s*\{/.exec(body);
  const rest = open ? code.slice(closer(code, i + 1 + open[0].length - 1) + 1) : body.slice(body.indexOf(";") + 1);
  const r = /^\s*return\s+([\s\S]{0,80})/.exec(rest);
  return !!r && PLACEHOLDER.test(r[1]);
}

function banner(sources, constants, roots) {
  const found = [];
  for (const src of sources) {
    const envless = /['"]ENVLESS['"]/.test(src.keep);
    for (const call of spans(src, /(?<![\w.])Banner\s*\(/g)) {
      const args = namedArgs(src.code, src.keep, call.open, call.close);
      const message = args.message ? args.message.expr : "";
      if (/Not integrated/i.test(message) || (/^['"][^'"]*['"]$/.test(message.trim()) && !envless && !/ENVLESS/.test(message))) continue;
      found.push({ src, call, args, envless });
    }
  }
  if (!found.length) return null;
  const first = found.find((f) => f.envless) || found[0];
  const { src } = first;
  const inFile = found.filter((f) => f.src === src);
  const owner = enclosing(src, first.call.index);
  const rootOf = (s, index) => roots.find((r) => r.src === s && r.open < index && index < r.close) || null;
  const inlineRoot = !!rootOf(src, first.call.index);
  const callers = owner ? sources.flatMap((s) => spans(s, new RegExp(`(?<![\\w.])${owner.name}\\s*\\(`, "g"))
    .filter((c) => !(s === src && c.index >= owner.open && c.index <= owner.close) && !(s === src && c.index < owner.open && /class\s+$|\w+\s+$/.test(s.code.slice(Math.max(0, c.index - 40), c.index))))
    .map((c) => ({ s, c }))) : [];
  const check = productionCheck(src, constants);
  const gated = (text) => /\bk(Debug|Release|Profile)Mode\b/.test(text || "");
  // A gate is read where it can decide the banner: the root's builder: expression, the banner widget's own body, or the
  // arguments of a call to it. Unrelated mode checks elsewhere in the same file or function do not count.
  const callGate = (s, c) => { const r = rootOf(s, c.index); return r && r.builder !== null ? gated(r.builder) : gated(s.code.slice(c.open, c.close)); };
  return {
    file: src.rel, at: at(src.rel, src.text, first.call.index), widget: owner ? owner.name : null,
    locations: [...new Set(inFile.map((f) => (/BannerLocation\.(\w+)/.exec((f.args.location || {}).expr || "") || [])[1] || "unset"))],
    // Flutter resolves the corner from layoutDirection; textDirection only lays out the label.
    layoutDirections: [...new Set(inFile.map((f) => (/TextDirection\.(\w+)/.exec((f.args.layoutDirection || {}).expr || "") || [])[1] || "unset"))],
    envless: first.envless,
    production: check && { op: check.op, value: check.value, constant: check.constant, at: check.at, caseInsensitive: check.caseInsensitive },
    dropsChild: !!check && dropsChild(src, check),
    buildModeGated: inlineRoot ? gated(rootOf(src, first.call.index).builder) : (owner && gated(src.code.slice(owner.open, owner.close))) || callers.some(({ s, c }) => callGate(s, c)),
    mismatchGuard: /\bappFlavor\b/.test(src.code) && (/['"]MISMATCH['"]/.test(src.keep) || /appFlavor\s*!?[!=]=|[!=]=\s*appFlavor/.test(src.code)),
    wired: inlineRoot || callers.length > 0,
    wiredAt: inlineRoot ? at(src.rel, src.text, first.call.index) : callers.length ? at(callers[0].s.rel, callers[0].s.text, callers[0].c.index) : null,
  };
}

function firebase(io, sources) {
  const optionFiles = sources.filter((s) => /(^|\/)firebase_options[\w]*\.dart$/.test(s.rel));
  const main = optionFiles.find((s) => s.rel === "lib/firebase_options.dart") || null;
  const constructors = (src) => spans(src, /(?<![\w.])FirebaseOptions\s*\(/g).map((c) => namedArgs(src.code, src.keep, c.open, c.close));
  const literalArg = (a) => a && /^['"]/.test(a.expr.trim());
  const describe = (src) => {
    const cs = constructors(src);
    return {
      file: src.rel,
      generated: /File generated by FlutterFire CLI/.test(src.text.slice(0, 400)),
      literal: cs.some((a) => literalArg(a.apiKey) || literalArg(a.projectId)),
      fromEnv: cs.some((a) => Object.values(a).some((v) => READS_ENV.test(v.expr) || /fromEnvironment/.test(v.expr))),
      projectIds: cs.map((a) => a.projectId && /^['"]([^'"]+)['"]$/.exec(a.projectId.expr.trim())).filter(Boolean).map((m) => m[1]),
    };
  };
  const init = sources.flatMap((s) => spans(s, /(?<![\w.])Firebase\.initializeApp\s*\(/g).map((c) => ({
    at: at(s.rel, s.text, c.index), args: Object.keys(namedArgs(s.code, s.keep, c.open, c.close)),
  })));
  let defaultsToProd = null;
  for (const s of sources) {
    for (const m of s.keep.matchAll(/(?:(?<![\w.])_\s*=>|\bdefault\s*:\s*(?:return\b)?)\s*([\w.]+)/g)) {
      if (s.code[m.index] === " ") continue;
      if (/(^|\.)(prod|production|prd)\b/i.test(m[1]) && /FirebaseOptions/.test(s.text)) { defaultsToProd = at(s.rel, s.text, m.index); break; }
    }
    if (defaultsToProd) break;
  }
  return { main: main ? describe(main) : null, perFlavor: optionFiles.filter((s) => s !== main).map((s) => s.rel), init, defaultsToProd };
}

function read(io) {
  const rels = io.walk("lib", { test: (p) => p.endsWith(".dart") && !/\.(g|freezed|gr|mocks|config)\.dart$/.test(p) });
  const sources = rels.map((rel) => { const text = io.read(rel); return { rel, text, code: mask(text), keep: mask(text, { strings: false }) }; });
  const constants = prodConstants(sources);
  const roots = sources.flatMap((src) => spans(src, ROOT).map((r) => {
    const args = namedArgs(src.code, src.keep, r.open, r.close);
    return { src, open: r.open, close: r.close, at: at(src.rel, src.text, r.index), builder: "builder" in args ? args.builder.expr : null };
  }));
  return {
    files: rels.length,
    fromEnvironment: fromEnvironment(sources),
    env: envClass(sources),
    prodConstants: constants,
    banner: banner(sources, constants, roots),
    roots: roots.map(({ at: where, builder }) => ({ at: where, builder: builder !== null, wraps: builder !== null && /\bEnvBanner\s*\(/.test(builder) })),
    appFlavor: sources.some((s) => /\bappFlavor\b/.test(s.code)),
    firebase: firebase(io, sources),
    dotenv: sources.some((s) => /package:flutter_dotenv|\bdotenv\.load\(/.test(s.keep)),
  };
}

// ---- write half: ops over the engine's tree ----

const FILES = Object.freeze({ env: "lib/env/env.dart", banner: "lib/env/env_banner.dart", test: "test/env_banner_test.dart", options: "lib/firebase_options.dart" });
const WIRE = "builder: (context, child) => EnvBanner(child: child),";

// A file the skill creates once: written when absent, unchanged when it still equals the render, and the owner's file
// otherwise, which apply leaves and the checks read.
function newFile(tree, rel, text) {
  const current = tree.read(rel);
  if (current === null || current === text) return tree.write(rel, text);
  tree.foreign(rel, `${rel} differs from the skill's template, so it is the owner's now`);
}

// A value inside a single-quoted Dart literal: a backslash, a quote and a $ (interpolation) are escaped.
const quoted = (s) => String(s).replace(/[\\'$]/g, "\\$&");

const bannerText = ({ envImport, nameExpr, production, guard }) => render("env_banner.dart", { envImport, nameExpr, production: quoted(production), guard: guard ? "true" : "false" });

// One Env constant. Past dart format's 80 columns it takes the split form with a trailing comma, which both the short
// and the tall formatter leave as is, so formatting the file keeps the managed region's sha.
function constant({ field, key }, indent) {
  const line = `static const ${field} = String.fromEnvironment('${key}');`;
  return indent.length + line.length <= 80 ? line : `static const ${field} = String.fromEnvironment(\n  '${key}',\n);`;
}

// The start of the line holding class `name`'s closing brace, when that line holds nothing else; -1 otherwise.
function classClose(text, name) {
  const code = mask(text);
  const m = new RegExp(`\\bclass\\s+${name}\\b[^{;]*\\{`).exec(code);
  if (!m) return -1;
  const close = closer(code, m.index + m[0].length - 1);
  if (close < 0) return -1;
  const start = text.lastIndexOf("\n", close - 1) + 1;
  return /^[ \t]*$/.test(text.slice(start, close)) ? start : -1;
}

// Adds `import '<rel>';` among the relative imports in sorted place, or after the last import with a blank line.
function addImport(text, rel) {
  const imports = [...text.matchAll(/^import\s+['"]([^'"]+)['"][^;\n]*;[ \t]*$/gm)];
  if (imports.some((m) => m[1] === rel)) return text;
  const line = `import '${rel}';`;
  const relative = imports.filter((m) => !/^(package|dart):/.test(m[1]));
  const before = relative.find((m) => m[1] > rel);
  if (before) return `${text.slice(0, before.index)}${line}\n${text.slice(before.index)}`;
  const last = (relative.length ? relative : imports).slice(-1)[0];
  if (!last) return `${line}\n\n${text}`;
  const end = last.index + last[0].length;
  return `${text.slice(0, end)}${relative.length ? "\n" : "\n\n"}${line}${text.slice(end)}`;
}

// Unmodified FlutterFire output: its header, and no options built from an Env class.
const flutterFire = (text) => /File generated by FlutterFire CLI/.test(text.slice(0, 400)) && !READS_ENV.test(mask(text));

const ops = {
  // A seed: the owner adds keys to Env, so once the file exists it is theirs and only its managed region is the skill's.
  env(tree) {
    const current = tree.read(FILES.env);
    tree.write(FILES.env, current === null ? render("env.dart") : current);
  },

  banner(tree, args) {
    newFile(tree, FILES.banner, bannerText(args));
  },

  "banner-test"(tree, { pkg, production }) {
    newFile(tree, FILES.test, render("env_banner_test.dart", { package: pkg, production: quoted(production) }));
  },

  // The Firebase constants the options read, in a managed region before the Env class's closing brace.
  "env-firebase-region"(tree, { file, className, fields }) {
    const text = tree.read(file);
    if (text === null) return tree.conflict(file, `${file} is missing`);
    const indent = "  ";
    const body = `${fields.map((f) => constant(f, indent)).join("\n")}\n`;
    const r = ensureBlock(text, { id: "firebase", syntax: "slash", body, anchor: (t) => classClose(t, className), indent });
    if (r.state === "conflict") return tree.conflict(file, readBlock(text, { id: "firebase", syntax: "slash" }) ? "the Env firebase region was edited by hand" : `class ${className}'s closing brace does not sit on its own line`);
    tree.write(file, r.text);
  },

  // One insertion into the single app root with no builder:, plus the banner's import.
  "wire-banner"(tree, { file }) {
    const text = tree.read(file);
    if (text === null) return tree.conflict(file, `${file} is missing`);
    const code = mask(text);
    const keep = mask(text, { strings: false });
    const roots = spans({ code }, ROOT);
    if (roots.length !== 1) return tree.conflict(file, roots.length ? "several app roots in one file" : "no MaterialApp( to wire the banner into");
    const { open, close } = roots[0];
    const args = namedArgs(code, keep, open, close);
    let out = text;
    if (args.builder) {
      if (!/\bEnvBanner\s*\(/.test(args.builder.expr)) return tree.conflict(file, "the app root already passes builder:");
    } else {
      const nl = text.indexOf("\n", open);
      if (nl > 0 && /^\s*$/.test(text.slice(open + 1, nl))) {
        const indent = /^[ \t]*/.exec(text.slice(nl + 1))[0] || "  ";
        out = `${text.slice(0, nl + 1)}${indent}${WIRE}\n${text.slice(nl + 1)}`;
      } else out = `${text.slice(0, open + 1)}${WIRE} ${text.slice(open + 1)}`;
    }
    tree.write(file, addImport(out, path.posix.relative(path.posix.dirname(file), FILES.banner)));
  },

  // lib/firebase_options.dart from the template: when absent, unchanged, or unmodified FlutterFire output.
  "firebase-options"(tree, { envImport, fields }) {
    const text = render("firebase_options.dart", { envImport, ...fields });
    const current = tree.read(FILES.options);
    if (current === null || current === text || flutterFire(current)) return tree.write(FILES.options, text);
    tree.foreign(FILES.options, `${FILES.options} is the owner's, so it is not rewritten`);
  },
};

// What the Dart recipes print: the reference banner, the options built from Env, and the wrapped builder.
const snippets = {
  banner: bannerText,
  options: ({ envImport, fields }) => render("firebase_options.dart", { envImport, ...fields }),
  wire: ({ file }) => `builder: (context, child) => EnvBanner(child: <the existing builder>(context, child)),\nimport '${path.posix.relative(path.posix.dirname(file), FILES.banner)}';\n`,
};

module.exports = { read, mask, closer, ops, snippets, FILES };
