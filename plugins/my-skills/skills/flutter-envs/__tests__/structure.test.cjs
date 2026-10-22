"use strict";
// The skill's shape: one case per finding code, every ref a finding can carry resolves, writers sit behind the matrix,
// call chains stay at three files, and every script opens with the boundary it owns.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const V = require("../scripts/lib/vocab.cjs");
const { CASES } = require("./fixtures/cases.cjs");

const SCRIPTS = path.join(__dirname, "..", "scripts");
const files = (dir = SCRIPTS) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : e.name.endsWith(".cjs") ? [path.join(dir, e.name)] : []));
const rel = (p) => path.relative(SCRIPTS, p);
const requires = (p) => [...fs.readFileSync(p, "utf8").matchAll(/require\("(\.[^"]+)"\)/g)].map((m) => rel(path.resolve(path.dirname(p), m[1])));
const graph = Object.fromEntries(files().map((p) => [rel(p), requires(p)]));
// Libraries that require nothing but node built-ins and each other: any module may use them, and they do not count
// toward a call chain. png, badge and firebase-keys are Increment 3a's codecs, which its writers need; spec gives the
// planners an environment's badge, and firebase-steps gives the Firebase criterion its human steps.
const LEAVES = new Set(["lib/vocab.cjs", "lib/io.cjs", "lib/managed.cjs", "lib/templates.cjs", "lib/diff.cjs", "lib/png.cjs", "lib/badge.cjs", "lib/firebase-keys.cjs", "lib/spec.cjs", "lib/firebase-steps.cjs"]);

test("every finding code has exactly one case, and every case is for a code that exists", () => {
  const counts = {};
  for (const c of CASES) {
    assert.ok(V.FINDINGS[c.code], `case for unknown code ${c.code}`);
    assert.ok(c.expect.includes(c.code), `${c.code}'s case does not expect its own code`);
    for (const code of c.expect) assert.ok(V.FINDINGS[code], `${c.code}'s case expects unknown code ${code}`);
    counts[c.code] = (counts[c.code] || 0) + 1;
  }
  assert.deepStrictEqual(Object.keys(V.FINDINGS).filter((code) => counts[code] !== 1), [], "codes without exactly one case");
});

test("every registry row is complete and drawn from the vocabularies", () => {
  for (const [code, row] of Object.entries(V.FINDINGS)) {
    assert.ok(V.GROUPS.includes(row.criterion), `${code} criterion`);
    assert.ok(code.startsWith(`${row.criterion}.`), `${code} is not under ${row.criterion}`);
    assert.ok(V.SEVERITIES.includes(row.severity), `${code} severity`);
    assert.ok(V.FIXES.includes(row.fix), `${code} fix`);
    assert.match(row.source, /^((ref:(I\d+|history))|wizard:W\d|survey|platform|new)( ((ref:(I\d+|history))|wizard:W\d|survey|platform|new))*$/, `${code} source`);
    assert.ok(row.summary.length > 20 && row.summary.endsWith("."), `${code} summary`);
  }
  assert.ok(Object.keys(V.FINDINGS).length >= 70 && Object.keys(V.FINDINGS).length <= 85, "the registry holds 70 to 85 codes");
});

test("every ref a criterion writes names an edit, a recipe or a step that exists", () => {
  const criteria = files(path.join(SCRIPTS, "criteria")).map((p) => fs.readFileSync(p, "utf8"));
  // The Firebase criterion takes its human steps from lib/firebase-steps.cjs, which builds them with step("<id>", ...).
  const human = fs.readFileSync(path.join(SCRIPTS, "lib", "firebase-steps.cjs"), "utf8");
  const steps = new Set([...criteria.flatMap((t) => [...t.matchAll(/\{ id: [`"]([\w.-]+)/g)].map((m) => m[1])), ...[...human.matchAll(/\bstep\("([\w.-]+)"/g)].map((m) => m[1])]);
  const refs = new Set(criteria.flatMap((t) => [...t.matchAll(/ref: ([^,}]+)/g)].flatMap((m) => [...m[1].matchAll(/"([\w-]+\.[\w.-]+)"/g)].map((x) => x[1]))));
  const unknown = [...refs].filter((r) => !V.EDITS.includes(r) && !V.RECIPES.includes(r) && !steps.has(r));
  assert.deepStrictEqual(unknown, []);
  assert.ok(refs.size > 20, "the scan found the refs");
});

test("writers are required only by the matrix (later, plan and the criteria), and never by each other", () => {
  for (const [file, deps] of Object.entries(graph)) {
    for (const dep of deps.filter((d) => d.startsWith("writers/"))) {
      assert.ok(file === "lib/matrix.cjs" || file === "plan.cjs" || file.startsWith("criteria/"), `${file} requires ${dep}`);
    }
    if (file.startsWith("writers/")) assert.deepStrictEqual(deps.filter((d) => !LEAVES.has(d)), [], `${file} requires more than the lib leaves`);
  }
});

test("a leaf library requires only other leaves", () => {
  for (const leaf of [...LEAVES].filter((l) => graph[l])) assert.deepStrictEqual(graph[leaf].filter((d) => !LEAVES.has(d)), [], `${leaf} requires more than leaves`);
});

test("only envs.cjs reaches the criteria, plan, verify and firebase-cli", () => {
  for (const [file, deps] of Object.entries(graph)) {
    for (const dep of deps.filter((d) => d === "criteria/index.cjs" || /^(plan|verify|firebase-cli)\.cjs$/.test(d))) assert.strictEqual(file, "envs.cjs", `${file} requires ${dep}`);
  }
});

test("call chains stay at three files, the lib leaves aside", () => {
  const depth = (file, seen = new Set()) => (seen.has(file) ? 0 : 1 + Math.max(0, ...graph[file].filter((d) => !LEAVES.has(d)).map((d) => depth(d, new Set([...seen, file])))));
  assert.ok(depth("envs.cjs") <= 3, `envs.cjs reaches ${depth("envs.cjs")} files deep`);
});

test("every script opens with use strict and one comment saying what it owns", () => {
  for (const p of files()) {
    const lines = fs.readFileSync(p, "utf8").split("\n");
    assert.strictEqual(lines[0], '"use strict";', `${rel(p)} line 1`);
    assert.match(lines[1], /^\/\/ \S/, `${rel(p)} opens with its boundary comment`);
  }
});

test("no file but vocab.cjs spells a finding code, so the registry stays the only copy", () => {
  const codes = Object.keys(V.FINDINGS);
  for (const p of files().filter((f) => !f.endsWith(path.join("lib", "vocab.cjs")))) {
    const text = fs.readFileSync(p, "utf8");
    if (/criteria\//.test(p)) continue;
    assert.deepStrictEqual(codes.filter((c) => text.includes(`"${c}"`)), [], `${rel(p)} names finding codes`);
  }
});

// A failing deep-equality assertion on a pixel array makes Node's diff allocate gigabytes within a second (the
// 2026-10-21 crash), so a test compares pixels through helpers/bytes.cjs. The rule: a deepStrictEqual, deepEqual,
// notDeepStrictEqual or notDeepEqual call with an argument `<expr>.rgba` that is not spread, indexed or measured.
const DEEP = /\b(?:deepStrictEqual|deepEqual|notDeepStrictEqual|notDeepEqual)\s*\(/g;
function pixelAsserts(text) {
  const out = [];
  for (const call of text.matchAll(DEEP)) {
    const open = call.index + call[0].length - 1;
    let depth = 0;
    let close = open;
    for (; close < text.length; close++) { if (text[close] === "(") depth++; else if (text[close] === ")" && --depth === 0) break; }
    const args = text.slice(open + 1, close);
    for (const m of args.matchAll(/\.rgba\b(?!\s*\[|\.(?:length|byteLength|byteOffset)\b)/g)) {
      let start = m.index;
      for (let nest = 0; start > 0; start--) {
        const ch = args[start - 1];
        if (ch === ")") nest++;
        else if (ch === "(") { if (nest === 0) break; nest--; } else if (nest === 0 && !/[\w$.]/.test(ch)) break;
      }
      if (!args.slice(start, m.index).startsWith("...")) { out.push(text.slice(call.index, close + 1).split("\n")[0]); break; }
    }
  }
  return out;
}

test("the pixel-array rule flags the four calls behind the crash and passes the safe forms", () => {
  const crashed = [
    "assert.deepStrictEqual(after.rgba.subarray(0, top * 216 * 4), before.rgba.subarray(0, top * 216 * 4), 'rows above the band')",
    "assert.deepStrictEqual(decode(encode(plain, { alpha: false })).rgba, flattened.rgba)",
    "assert.deepStrictEqual(input.rgba, snapshot, 'input pixels unchanged')",
    "assert.deepEqual(out.rgba.subarray(0, top), src.rgba.subarray(0, top), `${f}: the rows above the full band are production's`)",
  ];
  for (const call of crashed) assert.strictEqual(pixelAsserts(call).length, 1, call);
  const safe = ["assert.deepStrictEqual([...image.rgba].filter((_, i) => i % 4 === 0), values)", "assert.deepStrictEqual([grey16.rgba[3], grey16.rgba[7]], [0, 255])",
    "assert.deepStrictEqual({ ...back, rgba: null }, { ...image, rgba: null, chunks: [] })", "assertSameBytes(out.rgba, src.rgba, 'x')",
    "assert.deepStrictEqual([first.width, first.height, first.rgba.length], [192, 192, 192 * 192 * 4])"];
  for (const call of safe) assert.deepStrictEqual(pixelAsserts(call), [], call);
});

test("no skill test compares a pixel array with a deep-equality assertion", () => {
  const TESTS = path.join(__dirname);
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith(".cjs") ? [path.join(dir, e.name)] : []));
  const hits = walk(TESTS).filter((p) => p !== __filename).flatMap((p) => pixelAsserts(fs.readFileSync(p, "utf8")).map((c) => `${path.relative(TESTS, p)}: ${c}`));
  assert.deepStrictEqual(hits, [], "compare pixel arrays with helpers/bytes.cjs");
});
