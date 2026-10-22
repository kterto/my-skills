"use strict";
// Tests the PNG boundary with hand-assembled files whose chunks, filters and CRCs are built here, independent of png.cjs.
const test = require("node:test");
const assert = require("node:assert");
const zlib = require("node:zlib");
const { decode, encode } = require("../scripts/lib/png.cjs");
const { assertSameBytes } = require("./helpers/bytes.cjs");

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const CHANNELS = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };
const NAMES = { 0: "greyscale", 2: "truecolour", 3: "indexed", 4: "greyscale+alpha", 6: "truecolour+alpha" };
const FILTER_RUNS = { None: [0, 0, 0, 0, 0, 0], Sub: [1, 1, 1, 1, 1, 1], Up: [2, 2, 2, 2, 2, 2], Average: [3, 3, 3, 3, 3, 3], Paeth: [4, 4, 4, 4, 4, 4], mixed: [4, 3, 2, 1, 0, 4] };

function prng(seed) {
  return (n) => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) % n;
  };
}

function chunk(type, data = Buffer.alloc(0)) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(zlib.crc32(body), body.length + 4);
  return out;
}

function ihdr(width, height, depth, colourType, interlace = 0) {
  const data = Buffer.alloc(13);
  data.writeUInt32BE(width, 0);
  data.writeUInt32BE(height, 4);
  data[8] = depth;
  data[9] = colourType;
  data[12] = interlace;
  return chunk("IHDR", data);
}

function pack(samples, depth) {
  if (depth === 16) return Buffer.from(samples.flatMap((v) => [v >> 8, v & 255]));
  if (depth === 8) return Buffer.from(samples);
  const out = Buffer.alloc(Math.ceil((samples.length * depth) / 8), 0xff);
  samples.forEach((v, i) => {
    const shift = 8 - depth - ((i * depth) % 8);
    const at = (i * depth) >> 3;
    out[at] = (out[at] & ~(((1 << depth) - 1) << shift)) | (v << shift);
  });
  return out;
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  if (pb <= pc) return b;
  return c;
}

function filterScanlines(scanlines, filters, bpp) {
  return Buffer.concat(scanlines.map((row, y) => {
    const prior = y ? scanlines[y - 1] : Buffer.alloc(row.length);
    const out = Buffer.alloc(row.length + 1);
    out[0] = filters[y];
    for (let i = 0; i < row.length; i++) {
      const a = i >= bpp ? row[i - bpp] : 0;
      const c = i >= bpp ? prior[i - bpp] : 0;
      const predictor = [0, a, prior[i], (a + prior[i]) >> 1, paethPredictor(a, prior[i], c)][filters[y]];
      out[i + 1] = (row[i] - predictor) & 255;
    }
    return out;
  }));
}

function pngFile({ width, height, depth, colourType, rows, filters = rows.map(() => 0), palette, transparency, interlace, idatSplit }) {
  const bpp = Math.max(1, (CHANNELS[colourType] * depth) >> 3);
  const compressed = zlib.deflateSync(filterScanlines(rows.map((r) => pack(r, depth)), filters, bpp));
  const idat = idatSplit ? [compressed.subarray(0, idatSplit), compressed.subarray(idatSplit)] : [compressed];
  return Buffer.concat([
    SIGNATURE,
    ihdr(width, height, depth, colourType, interlace),
    ...(palette ? [chunk("PLTE", Buffer.from(palette.flat()))] : []),
    ...(transparency ? [chunk("tRNS", Buffer.from(transparency))] : []),
    ...idat.map((part) => chunk("IDAT", part)),
    chunk("IEND"),
  ]);
}

function chunkList(file) {
  const out = [];
  for (let at = 8; at < file.length; ) {
    const length = file.readUInt32BE(at);
    out.push({ type: file.toString("latin1", at + 4, at + 8), data: file.subarray(at + 8, at + 8 + length), crc: file.readUInt32BE(at + 8 + length), body: file.subarray(at + 4, at + 8 + length) });
    at += 12 + length;
  }
  return out;
}

const to8 = (v, depth) => (depth === 16 ? Math.round(v / 257) : Math.round((v * 255) / (2 ** depth - 1)));

function fixture(colourType, depth, seed) {
  const width = 7;
  const height = 6;
  const next = prng(seed);
  const max = 2 ** depth;
  const palette = colourType === 3 ? Array.from({ length: max }, () => [next(256), next(256), next(256)]) : null;
  const rows = [];
  const expected = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      const px = Array.from({ length: CHANNELS[colourType] }, () => ((x + y) % 5 === 0 ? max - 1 : (x * y) % 7 === 3 ? 0 : next(max)));
      row.push(...px);
      const s = px.map((v) => to8(v, depth));
      const rgba = { 0: () => [s[0], s[0], s[0], 255], 2: () => [...s, 255], 3: () => [...palette[px[0]], 255], 4: () => [s[0], s[0], s[0], s[1]], 6: () => s }[colourType]();
      expected.set(rgba, (y * width + x) * 4);
    }
    rows.push(row);
  }
  return { width, height, depth, colourType, rows, palette, expected };
}

const CASES = [[0, 1], [0, 2], [0, 4], [0, 8], [0, 16], [2, 8], [2, 16], [3, 1], [3, 2], [3, 4], [3, 8], [4, 8], [4, 16], [6, 8], [6, 16]];

for (const [colourType, depth] of CASES) {
  test(`decodes ${NAMES[colourType]} ${depth}-bit through every filter type and round-trips through encode`, () => {
    const f = fixture(colourType, depth, colourType * 100 + depth);
    for (const [name, filters] of Object.entries(FILTER_RUNS)) {
      const image = decode(pngFile({ ...f, filters }));
      assert.strictEqual(image.width, 7);
      assert.strictEqual(image.height, 6);
      assertSameBytes(image.rgba, f.expected, `pixels after ${name} filtering`);
      assertSameBytes(decode(encode(image)).rgba, image.rgba, `encode then decode after ${name} filtering`);
    }
  });
}

const BAND_ROWS = 8;
const ROWS_BY_TARGET_FILTER = {
  Paeth: ({ x, y, k }) => 3 * x + 5 * y + 40 * k,
  Up: ({ bandStart, up, fresh }) => (bandStart ? fresh : up),
  Sub: ({ x, k, rowOffset }) => rowOffset + 2 * x + k,
  Average: ({ x, bandStart, left, up, fresh }) => (x === 0 || bandStart ? fresh : (left + up) >> 1),
  "None, with colour under alpha 0": ({ x, k, fresh }) => (k === 3 && x % 3 === 0 ? 0 : fresh),
};

function filterExercise() {
  const next = prng(42);
  const bands = Object.values(ROWS_BY_TARGET_FILTER);
  const width = 61;
  const height = bands.length * BAND_ROWS;
  const rgba = new Uint8Array(width * height * 4);
  const at = (x, y) => (y * width + x) * 4;
  for (let y = 0; y < height; y++) {
    const rowOffset = next(256);
    for (let x = 0; x < width; x++) {
      for (let k = 0; k < 4; k++) {
        const left = x ? rgba[at(x - 1, y) + k] : 0;
        const up = y ? rgba[at(x, y - 1) + k] : 0;
        rgba[at(x, y) + k] = bands[Math.floor(y / BAND_ROWS)]({ x, y, k, left, up, rowOffset, bandStart: y % BAND_ROWS === 0, fresh: next(256) });
      }
    }
  }
  return { width, height, rgba };
}

function rowFilters(file, stride, height) {
  const raw = zlib.inflateSync(Buffer.concat(chunkList(file).filter((c) => c.type === "IDAT").map((c) => c.data)));
  return Array.from({ length: height }, (_, y) => raw[y * (stride + 1)]);
}

test("decode(encode(x)) equals x pixel for pixel, including colour under alpha 0", () => {
  const image = filterExercise();
  const file = encode(image);
  assert.deepStrictEqual(new Set(rowFilters(file, image.width * 4, image.height)), new Set([0, 1, 2, 3, 4]), "the fixture makes the encoder use all five filter types");
  const back = decode(file);
  assert.deepStrictEqual({ ...back, rgba: null }, { ...image, rgba: null, chunks: [] });
  assertSameBytes(back.rgba, image.rgba, "pixels after decode(encode(x))");
  const opaque = { ...image, rgba: image.rgba.map((v, i) => (i % 4 === 3 ? 255 : v)) };
  const flat = decode(encode(opaque, { alpha: false }));
  assert.deepStrictEqual({ ...flat, rgba: null }, { ...opaque, rgba: null, chunks: [] }, "an opaque image survives alpha: false unchanged");
  assertSameBytes(flat.rgba, opaque.rgba, "an opaque image's pixels survive alpha: false unchanged");
});

test("Paeth ties resolve in the spec order: left, then up, then upper-left", () => {
  const rows = [[20, 10, 20, 40], [40, 99, 10, 77]];
  const grey = [...decode(pngFile({ width: 4, height: 2, depth: 8, colourType: 0, rows, filters: [0, 4] })).rgba].filter((_, i) => i % 4 === 0);
  assert.strictEqual(grey[5], 99, "x=1: left 40, up 10, upper-left 20 tie on left vs upper-left (40 + 2*10 = 3*20), and left wins");
  assert.strictEqual(grey[7], 77, "x=3: left 10, up 40, upper-left 20 tie on up vs upper-left (2*10 + 40 = 3*20), and up wins");
  assert.deepStrictEqual(grey, rows.flat());
});

test("an 8-bit value stored as 16 bits (v * 257) decodes back to v", () => {
  const values = Array.from({ length: 256 }, (_, v) => v);
  const rows = Array.from({ length: 4 }, (_, y) => values.slice(y * 64, y * 64 + 64).map((v) => v * 257));
  const image = decode(pngFile({ width: 64, height: 4, depth: 16, colourType: 0, rows }));
  assert.deepStrictEqual([...image.rgba].filter((_, i) => i % 4 === 0), values);
});

test("16-bit samples down-convert to the nearest 8-bit value", () => {
  const samples = [0, 128, 129, 255, 0x7f7f, 0x8080, 0xfe00, 0xffff];
  const image = decode(pngFile({ width: samples.length, height: 1, depth: 16, colourType: 0, rows: [samples] }));
  assert.deepStrictEqual([...image.rgba].filter((_, i) => i % 4 === 0), samples.map((v) => Math.round(v / 257)));
});

test("tRNS gives palette entries their alpha and leaves entries past its end opaque", () => {
  const palette = [[10, 20, 30], [40, 50, 60], [70, 80, 90], [100, 110, 120]];
  const image = decode(pngFile({ width: 4, height: 1, depth: 2, colourType: 3, rows: [[0, 1, 2, 3]], palette, transparency: [0, 128] }));
  assert.deepStrictEqual([...image.rgba], [10, 20, 30, 0, 40, 50, 60, 128, 70, 80, 90, 255, 100, 110, 120, 255]);
});

test("tRNS makes exactly the keyed grey or RGB sample transparent, compared at the file bit depth", () => {
  const grey8 = decode(pngFile({ width: 3, height: 1, depth: 8, colourType: 0, rows: [[77, 78, 76]], transparency: [0, 77] }));
  assert.deepStrictEqual([...grey8.rgba], [77, 77, 77, 0, 78, 78, 78, 255, 76, 76, 76, 255]);
  const grey1 = decode(pngFile({ width: 3, height: 1, depth: 1, colourType: 0, rows: [[1, 0, 1]], transparency: [0, 1] }));
  assert.deepStrictEqual([...grey1.rgba], [255, 255, 255, 0, 0, 0, 0, 255, 255, 255, 255, 0]);
  const key = 0x1234;
  const grey16 = decode(pngFile({ width: 2, height: 1, depth: 16, colourType: 0, rows: [[key, key + 1]], transparency: [key >> 8, key & 255] }));
  assert.deepStrictEqual([grey16.rgba[3], grey16.rgba[7]], [0, 255], "a sample one step from the 16-bit key stays opaque although both round to the same 8-bit grey");
  const rgb = decode(pngFile({ width: 2, height: 1, depth: 8, colourType: 2, rows: [[10, 20, 30, 10, 20, 31]], transparency: [0, 10, 0, 20, 0, 30] }));
  assert.deepStrictEqual([rgb.rgba[3], rgb.rgba[7]], [0, 255]);
  const rgb16 = decode(pngFile({ width: 2, height: 1, depth: 16, colourType: 2, rows: [[1000, 2000, 3000, 1000, 2000, 3001]], transparency: [3, 232, 7, 208, 11, 184] }));
  assert.deepStrictEqual([rgb16.rgba[3], rgb16.rgba[7]], [0, 255]);
});

test("IDAT data split across several chunks and unknown ancillary chunks still decode", () => {
  const f = fixture(6, 8, 9);
  const file = pngFile({ ...f, idatSplit: 5 });
  const withText = Buffer.concat([file.subarray(0, 33), chunk("tEXt", Buffer.from("Comment\0hi")), chunk("zzZz", Buffer.from([1])), file.subarray(33)]);
  assertSameBytes(decode(withText).rgba, f.expected, "pixels of a split IDAT");
  assert.deepStrictEqual(decode(withText).chunks, [], "ancillary chunks other than the colour ones are not carried");
});

const COLOUR = [
  { type: "iCCP", data: Buffer.concat([Buffer.from("Display P3\0\0", "latin1"), zlib.deflateSync(Buffer.from("a stand-in for an ICC profile"))]) },
  { type: "sRGB", data: Buffer.from([0]) },
  { type: "gAMA", data: Buffer.from([0, 0, 0xb1, 0x8f]) },
  { type: "cHRM", data: Buffer.alloc(32, 7) },
];
const hexOf = (chunks) => chunks.map((c) => [c.type, Buffer.from(c.data).toString("hex")]);

test("decode returns the colour chunks verbatim and in file order, and encode writes them back before IDAT", () => {
  const f = fixture(6, 8, 12);
  const plain = pngFile(f);
  const coloured = Buffer.concat([plain.subarray(0, 33), ...COLOUR.map((c) => chunk(c.type, c.data)), plain.subarray(33)]);
  const image = decode(coloured);
  assertSameBytes(image.rgba, f.expected, "pixels of a file with colour chunks");
  assert.deepStrictEqual(hexOf(image.chunks), hexOf(COLOUR));
  const written = chunkList(encode(image));
  assert.deepStrictEqual(written.map((c) => c.type), ["IHDR", "iCCP", "sRGB", "gAMA", "cHRM", "IDAT", "IEND"]);
  assert.deepStrictEqual(hexOf(written.slice(1, 5)), hexOf(COLOUR));
  assert.deepStrictEqual(decode(plain).chunks, [], "a file without colour chunks gives none");
});

test("encode refuses to write a chunk that is not a colour chunk", () => {
  const image = { width: 1, height: 1, rgba: new Uint8Array(4) };
  for (const chunks of [[{ type: "tRNS", data: Buffer.alloc(2) }], [{ type: "tEXt", data: Buffer.from("a\0b") }], [{ type: "iCCP", data: "text" }], "iCCP"]) {
    assert.throws(() => encode({ ...image, chunks }), /only colour chunks/, JSON.stringify(chunks));
  }
});

const sample = () => pngFile(fixture(6, 8, 5));

test("refuses input without the PNG signature", () => {
  for (const bytes of [Buffer.alloc(0), Buffer.from("GIF89a"), Buffer.concat([Buffer.from("JFIF"), sample()]), sample().subarray(0, 7)]) {
    assert.throws(() => decode(bytes), /not a PNG file \(bad signature\)/);
  }
  assert.throws(() => decode("not bytes"), TypeError);
});

test("refuses a chunk whose CRC does not match, whether data or checksum was damaged", () => {
  const file = sample();
  const idatAt = 33;
  const dataFlipped = Buffer.from(file);
  dataFlipped[idatAt + 8 + 2] ^= 0x10;
  assert.throws(() => decode(dataFlipped), /CRC mismatch in chunk "IDAT" at byte 33/);
  const crcFlipped = Buffer.from(file);
  crcFlipped[29] ^= 0x01;
  assert.throws(() => decode(crcFlipped), /CRC mismatch in chunk "IHDR" at byte 8/);
});

test("refuses every truncated prefix of a valid file, and none of them hangs", { timeout: 5000 }, () => {
  const file = sample();
  assert.ok(decode(file), "the untruncated file decodes");
  for (let length = 0; length < file.length; length++) {
    assert.throws(() => decode(file.subarray(0, length)), /truncated PNG|bad signature/, `prefix of ${length} bytes`);
  }
});

test("refuses Adam7 interlaced input with a message that says interlaced PNGs are unsupported", () => {
  const f = fixture(6, 8, 3);
  assert.throws(() => decode(pngFile({ ...f, interlace: 1 })), { message: /interlaced PNGs are unsupported/ });
});

test("refuses image data that is short, long, or not a zlib stream, even when every CRC is valid", () => {
  const f = fixture(2, 8, 4);
  const idat = (data) => Buffer.concat([SIGNATURE, ihdr(7, 6, 8, 2), chunk("IDAT", data), chunk("IEND")]);
  const scanlines = filterScanlines(f.rows.map((r) => pack(r, 8)), FILTER_RUNS.None, 3);
  assert.throws(() => decode(idat(zlib.deflateSync(scanlines.subarray(1)))), /inflates to 131 bytes, its IHDR implies 132/);
  assert.throws(() => decode(idat(zlib.deflateSync(Buffer.concat([scanlines, Buffer.alloc(1)])))), /inflates past the 132 bytes/);
  assert.throws(() => decode(idat(Buffer.from("definitely not zlib"))), /image data does not inflate/);
  assert.throws(() => decode(idat(zlib.deflateSync(scanlines).subarray(0, 20))), /image data does not inflate/);
});

test("refuses a PNG over 8192 px on a side from its IHDR, before inflating anything, and decodes one at 8192", () => {
  const declared = (width, height) => Buffer.concat([SIGNATURE, ihdr(width, height, 8, 6), chunk("IDAT", zlib.deflateSync(Buffer.alloc(0))), chunk("IEND")]);
  for (const [width, height] of [[8193, 1], [1, 8193], [16384, 16384], [0xffffffff, 0xffffffff]]) {
    assert.throws(() => decode(declared(width, height)), { message: `unsupported PNG: ${width}x${height} is larger than 8192 px on a side` });
  }
  for (const [width, height] of [[8192, 1], [1, 8192]]) {
    const image = decode(pngFile({ width, height, depth: 8, colourType: 0, rows: Array.from({ length: height }, () => new Array(width).fill(9)) }));
    assert.strictEqual(image.rgba.length, width * height * 4, `${width}x${height} decodes`);
  }
});

test("refuses structurally invalid files with a message naming the problem", () => {
  const f = fixture(3, 2, 6);
  const good = pngFile(f);
  const iend = chunk("IEND");
  const cases = [
    [Buffer.concat([SIGNATURE, chunk("PLTE", Buffer.alloc(3)), good.subarray(8)]), /first chunk is "PLTE", not IHDR/],
    [Buffer.concat([SIGNATURE, ihdr(7, 6, 4, 2), good.subarray(33)]), /bit depth 4 is invalid for colour type 2/],
    [Buffer.concat([SIGNATURE, ihdr(7, 6, 8, 5), iend]), /unknown colour type 5/],
    [Buffer.concat([SIGNATURE, ihdr(0, 6, 8, 6), iend]), /image size 0x6/],
    [Buffer.concat([SIGNATURE, ihdr(7, 6, 2, 3), iend]), /no IDAT chunk/],
    [pngFile({ ...f, palette: undefined }), /indexed image without a PLTE chunk/],
    [pngFile({ ...f, palette: f.palette.slice(0, 2) }), /palette index [23] is past the 2-entry palette/],
    [pngFile({ ...f, filters: [0, 0, 5, 0, 0, 0] }), /row 2 uses unknown filter type 5/],
    [Buffer.concat([good.subarray(0, 33), chunk("ZZZZ", Buffer.from([1])), good.subarray(33)]), /unknown critical chunk "ZZZZ"/],
    [Buffer.concat([good.subarray(0, 33), ihdr(7, 6, 2, 3), good.subarray(33)]), /more than one IHDR/],
  ];
  for (const [file, message] of cases) assert.throws(() => decode(file), message);
});

test("encode writes only IHDR, IDAT and IEND, 8-bit truecolour with alpha, with CRCs that verify", () => {
  const file = encode({ width: 3, height: 2, rgba: new Uint8Array(24).fill(9) });
  assert.deepStrictEqual(file.subarray(0, 8), SIGNATURE);
  const chunks = chunkList(file);
  assert.deepStrictEqual(chunks.map((c) => c.type), ["IHDR", "IDAT", "IEND"]);
  for (const c of chunks) assert.strictEqual(c.crc, zlib.crc32(c.body), `${c.type} CRC`);
  assert.deepStrictEqual([...chunks[0].data], [0, 0, 0, 3, 0, 0, 0, 2, 8, 6, 0, 0, 0]);
});

test("encode with alpha: false writes 8-bit truecolour and flattens onto white", () => {
  const rgba = new Uint8Array([200, 100, 50, 128, 10, 20, 30, 0, 1, 2, 3, 255]);
  const file = encode({ width: 3, height: 1, rgba }, { alpha: false });
  assert.deepStrictEqual([...chunkList(file)[0].data].slice(8, 10), [8, 2]);
  const back = decode(file).rgba;
  const exact = [200, 100, 50].map((c) => (c * 128 + 255 * 127) / 255);
  exact.forEach((v, k) => assert.ok(Math.abs(back[k] - v) <= 1, `half-transparent channel ${k}: ${back[k]} vs ${v.toFixed(2)}`));
  assert.strictEqual(back[3], 255, "the half-transparent pixel becomes opaque");
  assert.deepStrictEqual([...back.subarray(4, 8)], [255, 255, 255, 255], "a transparent pixel turns white");
  assert.deepStrictEqual([...back.subarray(8, 12)], [1, 2, 3, 255], "an opaque pixel keeps its colour");
});

test("encode of identical pixels gives identical bytes within one run", () => {
  const next = prng(11);
  const rgba = new Uint8Array(40 * 30 * 4).map(() => next(256));
  const first = encode({ width: 40, height: 30, rgba });
  assertSameBytes(encode({ width: 40, height: 30, rgba: new Uint8Array(rgba) }), first, "encode of a copy");
  assertSameBytes(encode({ width: 40, height: 30, rgba }, { alpha: false }), encode({ width: 40, height: 30, rgba }, { alpha: false }), "encode with alpha: false");
});

test("encode refuses an image whose rgba does not match its size, and a non-boolean alpha", () => {
  assert.throws(() => encode({ width: 2, height: 2, rgba: new Uint8Array(15) }), /Uint8Array of 2x2x4 bytes/);
  assert.throws(() => encode({ width: 0, height: 2, rgba: new Uint8Array(0) }), /positive integer width and height/);
  assert.throws(() => encode({ width: 1, height: 1, rgba: new Uint8Array(4) }, { alpha: "no" }), /alpha must be true or false/);
});
