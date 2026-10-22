"use strict";
// Tests the badge through its public function: band placement, untouched pixels, label ink, opacity, purity and refusals.
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert");
const { badge } = require("../scripts/lib/badge.cjs");
const { decode, encode } = require("../scripts/lib/png.cjs");
const { assertSameBytes, assertDifferentBytes } = require("./helpers/bytes.cjs");

const GREEN = [0x2e, 0x7d, 0x32];
const FONT = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-";

function translucentPattern(size) {
  const rgba = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) rgba.set([x & 255, y & 255, (x * 7 + y * 3) & 255, (x + y) % 255], (y * size + x) * 4);
  }
  return { width: size, height: size, rgba };
}

const pixel = (image, x, y) => [...image.rgba.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
const isWhiteish = ([r, g, b, a]) => r >= 245 && g >= 245 && b >= 245 && a === 255;

function boxWhere({ x0, y0, x1, y1 }, matches) {
  let box = null;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (!matches(x, y)) continue;
      box = box ? { x0: Math.min(box.x0, x), y0: Math.min(box.y0, y), x1: Math.max(box.x1, x + 1), y1: Math.max(box.y1, y + 1) } : { x0: x, y0: y, x1: x + 1, y1: y + 1 };
    }
  }
  return box;
}

const changedBox = (before, after) => boxWhere({ x0: 0, y0: 0, x1: before.width, y1: before.height }, (x, y) => pixel(before, x, y).join() !== pixel(after, x, y).join());
const inkBox = (image, band, colour) => boxWhere(band, (x, y) => pixel(image, x, y).slice(0, 3).join() !== colour.join());

test("full mode paints an opaque band of the colour over the bottom 22% and leaves the rows above untouched", () => {
  const before = translucentPattern(216);
  const after = badge(before, { label: "DEV", color: "2E7D32", mode: "full" });
  const top = 216 - Math.round(216 * 0.22);
  assertSameBytes(after.rgba.subarray(0, top * 216 * 4), before.rgba.subarray(0, top * 216 * 4), "rows above the band");
  for (const [x, y] of [[0, top], [215, top], [0, 215], [215, 215], [3, top + 20]]) assert.deepStrictEqual(pixel(after, x, y), [...GREEN, 255], `band pixel ${x},${y}`);
  for (let y = top; y < 216; y++) for (let x = 0; x < 216; x++) assert.strictEqual(pixel(after, x, y)[3], 255, `band alpha at ${x},${y}`);
});

test("full mode centres a white, anti-aliased label about 0.6 of the band tall", () => {
  const after = badge(translucentPattern(216), { label: "H", color: "2E7D32", mode: "full" });
  const band = { x0: 0, y0: 168, x1: 216, y1: 216 };
  assert.ok(isWhiteish(pixel(after, 108, 192)), `the crossbar of H at the band centre is white, got ${pixel(after, 108, 192)}`);
  const ink = inkBox(after, band, GREEN);
  assert.ok(Math.abs((ink.x0 + ink.x1) / 2 - 108) <= 1, `label centred horizontally, ink spans x ${ink.x0}..${ink.x1}`);
  assert.ok(Math.abs((ink.y0 + ink.y1) / 2 - 192) <= 1, `label centred vertically, ink spans y ${ink.y0}..${ink.y1}`);
  assert.ok(Math.abs(ink.y1 - ink.y0 - 0.6 * 48) <= 2, `label height ${ink.y1 - ink.y0} px is about 0.6 of the 48 px band`);
  let partial = 0;
  for (let y = band.y0; y < band.y1; y++) {
    for (let x = 0; x < 216; x++) {
      const [r, g, b] = pixel(after, x, y);
      if (r > GREEN[0] && r < 255 && g > GREEN[1] && g < 255 && b > GREEN[2] && b < 255) partial++;
    }
  }
  assert.ok(partial >= 20, `stroke edges blend band colour into white (${partial} partial pixels)`);
});

test("a long label shrinks to fit at most 0.86 of the band width", () => {
  const after = badge(translucentPattern(512), { label: "ABCDEFGHIJKLMNOPQRSTUVWXYZ", color: "2E7D32", mode: "full" });
  const top = 512 - Math.round(512 * 0.22);
  const ink = inkBox(after, { x0: 0, y0: top, x1: 512, y1: 512 }, GREEN);
  assert.ok(ink.x1 - ink.x0 <= Math.ceil(0.86 * 512) + 1, `ink width ${ink.x1 - ink.x0} px`);
  assert.ok(Math.abs((ink.x0 + ink.x1) / 2 - 256) <= 1, `centred, ink spans x ${ink.x0}..${ink.x1}`);
  assert.ok(ink.y1 - ink.y0 < 0.6 * (512 - top), "width, not height, limits the size");
});

test("safe mode paints a solid band inside the centred 66/108 square, at its bottom edge, and nothing else", () => {
  const before = translucentPattern(216);
  const after = badge(before, { label: "STG", color: "EF6C00", mode: "safe" });
  const safe = { x0: (216 * 21) / 108, x1: (216 * 87) / 108, y0: (216 * 21) / 108, y1: (216 * 87) / 108 };
  const band = changedBox(before, after);
  assert.ok(band.x0 >= safe.x0 && band.x1 <= safe.x1 && band.y0 >= safe.y0 && band.y1 <= safe.y1, `band ${JSON.stringify(band)} lies inside the safe square ${JSON.stringify(safe)}`);
  assert.ok(safe.y1 - band.y1 <= 0.04 * (safe.y1 - safe.y0), `band bottom ${band.y1} is near the safe square's bottom ${safe.y1}`);
  for (let y = 0; y < 216; y++) {
    for (let x = 0; x < 216; x++) {
      const inBand = x >= band.x0 && x < band.x1 && y >= band.y0 && y < band.y1;
      if (inBand) assert.strictEqual(pixel(after, x, y)[3], 255, `band pixel ${x},${y} is opaque`);
      else assert.deepStrictEqual(pixel(after, x, y), pixel(before, x, y), `pixel ${x},${y} outside the band is untouched`);
    }
  }
  assert.deepStrictEqual(pixel(after, band.x0, band.y0), [0xef, 0x6c, 0x00, 255], "band corner has the band colour");
  const ink = inkBox(after, band, [0xef, 0x6c, 0x00]);
  assert.ok(ink && ink.x0 > band.x0 && ink.x1 < band.x1 && ink.y0 > band.y0 && ink.y1 < band.y1, "label ink stays inside the band");
});

test("opaque mode composites the whole image over the flatten colour so no pixel has alpha below 255", () => {
  const before = translucentPattern(108);
  for (const [flatten, rgb] of [[undefined, [255, 255, 255]], ["123456", [0x12, 0x34, 0x56]]]) {
    const after = badge(before, { label: "QA", color: "2E7D32", mode: "safe", opaque: true, flatten });
    for (let o = 3; o < after.rgba.length; o += 4) assert.strictEqual(after.rgba[o], 255, `alpha at byte ${o}`);
    assert.deepStrictEqual(pixel(after, 0, 0), [...rgb, 255], "a fully transparent pixel takes the flatten colour");
    const [r, g, b, a] = pixel(before, 100, 30);
    const expected = [r, g, b].map((c, k) => (c * a + rgb[k] * (255 - a)) / 255);
    pixel(after, 100, 30).slice(0, 3).forEach((v, k) => assert.ok(Math.abs(v - expected[k]) <= 1, `composited channel ${k}: ${v} vs ${expected[k].toFixed(2)}`));
  }
});

test("opaque flattening matches encode with alpha: false pixel for pixel", () => {
  const plain = badge(translucentPattern(96), { label: "DEV", color: "2E7D32", mode: "full" });
  const flattened = badge(translucentPattern(96), { label: "DEV", color: "2E7D32", mode: "full", opaque: true });
  assertSameBytes(decode(encode(plain, { alpha: false })).rgba, flattened.rgba, "badge's opaque pixels against encode's flattening");
});

test("badge is pure and deterministic: same input and options give identical pixels, input untouched", () => {
  const input = translucentPattern(192);
  const snapshot = new Uint8Array(input.rgba);
  const options = { label: "BETA-2", color: "6A1B9A", mode: "full", opaque: true };
  const first = badge(input, options);
  const second = badge(input, { ...options });
  assertSameBytes(input.rgba, snapshot, "input pixels unchanged");
  assert.notStrictEqual(first.rgba, input.rgba, "output is a new pixel array");
  assert.deepStrictEqual({ ...second, rgba: null }, { ...first, rgba: null });
  assertSameBytes(second.rgba, first.rgba, "the second call's pixels");
  assert.deepStrictEqual([first.width, first.height, first.rgba.length], [192, 192, 192 * 192 * 4]);
});

test("every character of A-Z, 0-9 and - draws its own white ink, at 48 px too", () => {
  const seen = new Map();
  for (const ch of FONT) {
    const after = badge(translucentPattern(96), { label: ch, color: "2E7D32", mode: "full" });
    const band = after.rgba.subarray(96 * (96 - Math.round(96 * 0.22)) * 4);
    let white = 0;
    for (let o = 0; o < band.length; o += 4) if (isWhiteish([band[o], band[o + 1], band[o + 2], band[o + 3]])) white++;
    assert.ok(white > 0, `${ch} draws white pixels`);
    const key = Buffer.from(band).toString("base64");
    assert.ok(!seen.has(key), `${ch} renders differently from ${seen.get(key)}`);
    seen.set(key, ch);
  }
  const small = badge(translucentPattern(48), { label: "DEV", color: "2E7D32", mode: "full" });
  const ink = inkBox(small, { x0: 0, y0: 37, x1: 48, y1: 48 }, GREEN);
  assert.ok(ink && ink.y1 - ink.y0 >= 6, `DEV at 48 px has ink ${JSON.stringify(ink)}`);
});

test("refuses characters outside the font and malformed options", () => {
  const image = translucentPattern(48);
  const ok = { label: "DEV", color: "2E7D32", mode: "full" };
  assert.throws(() => badge(image, { ...ok, label: "dev" }), /has "d", which the badge font lacks/);
  assert.throws(() => badge(image, { ...ok, label: "A B" }), /has " "/);
  assert.throws(() => badge(image, { ...ok, label: "PRÉ" }), /has "É"/);
  assert.throws(() => badge(image, { ...ok, label: "" }), /label must be a non-empty string/);
  assert.throws(() => badge(image, { ...ok, color: "#2E7D32" }), /color must be a hex colour/);
  assert.throws(() => badge(image, { ...ok, color: "green" }), /color must be a hex colour/);
  assert.throws(() => badge(image, { ...ok, flatten: "FFF", opaque: true }), /flatten must be a hex colour/);
  assert.throws(() => badge(image, { ...ok, mode: "corner" }), /mode must be "full" or "safe"/);
  assert.throws(() => badge(image, { ...ok, opaque: "yes" }), /opaque must be true or false/);
  assert.throws(() => badge({ width: 48, height: 48, rgba: new Uint8Array(10) }, ok), /width \* height \* 4/);
});

test("a badged icon keeps its source colour chunks byte for byte, and only its pixels change", () => {
  const iccp = { type: "iCCP", data: Buffer.concat([Buffer.from("Display P3\0\0", "latin1"), Buffer.from([0x78, 0x9c, 1, 2, 3])]) };
  const source = decode(encode({ ...translucentPattern(96), chunks: [iccp] }));
  for (const [opaque, alpha] of [[false, true], [true, false]]) {
    const badged = decode(encode(badge(source, { label: "DEV", color: "2E7D32", mode: "full", opaque }), { alpha }));
    assert.deepStrictEqual(badged.chunks.map((c) => [c.type, Buffer.from(c.data).toString("hex")]), [["iCCP", iccp.data.toString("hex")]], `opaque ${opaque}`);
    assertDifferentBytes(badged.rgba, source.rgba, `opaque ${opaque}: the badge is painted`);
  }
});

test("decode and badge use only exactly specified arithmetic, so their pixels match on every engine and Node version", () => {
  const approximated = /\bMath\.(?:acosh?|asinh?|atanh?|atan2|cbrt|cosh?|exp|expm1|hypot|log|log1p|log2|log10|pow|random|sinh?|tanh?)\b|\*\*/;
  for (const file of ["png.cjs", "badge.cjs"]) {
    const source = fs.readFileSync(path.join(__dirname, "..", "scripts", "lib", file), "utf8");
    assert.doesNotMatch(source, approximated, `${file} uses a Math function or ** that ECMA-262 leaves implementation-approximated`);
  }
});
