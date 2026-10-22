"use strict";
// Owns the PNG file boundary: parses untrusted PNG bytes into 8-bit straight-alpha RGBA, and writes RGBA back as PNG.
// The colour chunks say how to read the samples, so they travel with the pixels, verbatim, from decode to encode.
const zlib = require("node:zlib");

const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
// The largest launcher icon is 1024 px. Refusing more than 8192 px on a side bounds what a hostile or mistaken file
// can make decode allocate: 256 MiB of RGBA, and at most 512 MiB of inflated 16-bit samples.
const MAX_SIDE = 8192;
const COLOUR_CHUNKS = new Set(["iCCP", "sRGB", "gAMA", "cHRM"]);

const COLOUR_TYPES = {
  0: { name: "greyscale", channels: 1, depths: [1, 2, 4, 8, 16], expand: expandGrey },
  2: { name: "truecolour", channels: 3, depths: [8, 16], expand: expandTruecolour },
  3: { name: "indexed", channels: 1, depths: [1, 2, 4, 8], expand: expandIndexed },
  4: { name: "greyscale with alpha", channels: 2, depths: [8, 16], expand: expandGreyAlpha },
  6: { name: "truecolour with alpha", channels: 4, depths: [8, 16], expand: expandTruecolourAlpha },
};

const CRC_TABLE = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function decode(bytes) {
  if (!(bytes instanceof Uint8Array)) throw new TypeError("decode expects a Buffer or Uint8Array");
  const png = readChunks(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
  const { width, height, depth, kind } = png.header;
  const stride = Math.ceil((width * kind.channels * depth) / 8);
  const raw = inflate(Buffer.concat(png.idat), height * (stride + 1));
  unfilter(raw, stride, height, Math.max(1, (kind.channels * depth) >> 3));
  return { width, height, rgba: toRgba(raw, stride, png), chunks: png.colour };
}

function readChunks(buf) {
  if (buf.length < 8 || !buf.subarray(0, 8).equals(SIGNATURE)) throw new Error("not a PNG file (bad signature)");
  const png = { header: null, palette: null, transparency: null, idat: [], colour: [] };
  for (let at = 8; ; ) {
    if (at + 12 > buf.length) throw new Error(`truncated PNG: the file ends at byte ${buf.length} before the IEND chunk`);
    const length = buf.readUInt32BE(at);
    const type = buf.toString("latin1", at + 4, at + 8);
    const name = JSON.stringify(type);
    const end = at + 12 + length;
    if (end > buf.length) throw new Error(`truncated PNG: chunk ${name} at byte ${at} declares ${length} data bytes but the file ends at byte ${buf.length}`);
    if (crc32(buf.subarray(at + 4, end - 4)) !== buf.readUInt32BE(end - 4)) throw new Error(`corrupt PNG: CRC mismatch in chunk ${name} at byte ${at}`);
    if (at === 8 && type !== "IHDR") throw new Error(`corrupt PNG: the first chunk is ${name}, not IHDR`);
    if (at !== 8 && type === "IHDR") throw new Error("corrupt PNG: more than one IHDR chunk");
    const data = buf.subarray(at + 8, end - 4);
    if (type === "IEND") break;
    if (type === "IHDR") png.header = parseHeader(data);
    else if (type === "PLTE") png.palette = data;
    else if (type === "tRNS") png.transparency = data;
    else if (type === "IDAT") png.idat.push(data);
    else if (COLOUR_CHUNKS.has(type)) png.colour.push({ type, data: Buffer.from(data) });
    else if (!(type.charCodeAt(0) & 0x20)) throw new Error(`unsupported PNG: unknown critical chunk ${name}`);
    at = end;
  }
  if (!png.idat.length) throw new Error("corrupt PNG: no IDAT chunk");
  if (png.header.colourType === 3 && !png.palette) throw new Error("corrupt PNG: indexed image without a PLTE chunk");
  return png;
}

function parseHeader(data) {
  if (data.length !== 13) throw new Error(`corrupt PNG: IHDR holds ${data.length} bytes, not 13`);
  const width = data.readUInt32BE(0);
  const height = data.readUInt32BE(4);
  const [depth, colourType, compression, filter, interlace] = data.subarray(8);
  const kind = COLOUR_TYPES[colourType];
  if (!width || !height) throw new Error(`corrupt PNG: image size ${width}x${height}`);
  if (width > MAX_SIDE || height > MAX_SIDE) throw new Error(`unsupported PNG: ${width}x${height} is larger than ${MAX_SIDE} px on a side`);
  if (!kind) throw new Error(`corrupt PNG: unknown colour type ${colourType}`);
  if (!kind.depths.includes(depth)) throw new Error(`corrupt PNG: bit depth ${depth} is invalid for colour type ${colourType} (${kind.name})`);
  if (compression !== 0 || filter !== 0) throw new Error(`corrupt PNG: unknown compression method ${compression} or filter method ${filter}`);
  if (interlace === 1) throw new Error("interlaced PNGs are unsupported: re-save the image without Adam7 interlacing");
  if (interlace !== 0) throw new Error(`corrupt PNG: unknown interlace method ${interlace}`);
  return { width, height, depth, colourType, kind };
}

function inflate(compressed, expected) {
  let raw;
  try {
    raw = zlib.inflateSync(compressed, { maxOutputLength: expected });
  } catch (err) {
    if (err.code === "ERR_BUFFER_TOO_LARGE") throw new Error(`corrupt PNG: image data inflates past the ${expected} bytes its IHDR implies`);
    throw new Error(`corrupt PNG: image data does not inflate (${err.message})`);
  }
  if (raw.length !== expected) throw new Error(`corrupt PNG: image data inflates to ${raw.length} bytes, its IHDR implies ${expected}`);
  return raw;
}

function paeth(a, b, c) {
  const pa = Math.abs(b - c);
  const pb = Math.abs(a - c);
  const pc = Math.abs(a + b - 2 * c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function unfilter(raw, stride, height, bpp) {
  const zero = new Uint8Array(stride);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1);
    const filter = raw[start];
    const row = raw.subarray(start + 1, start + 1 + stride);
    const prior = y ? raw.subarray(start - stride, start) : zero;
    if (filter === 1) {
      for (let i = bpp; i < stride; i++) row[i] += row[i - bpp];
    } else if (filter === 2) {
      for (let i = 0; i < stride; i++) row[i] += prior[i];
    } else if (filter === 3) {
      for (let i = 0; i < bpp; i++) row[i] += prior[i] >> 1;
      for (let i = bpp; i < stride; i++) row[i] += (row[i - bpp] + prior[i]) >> 1;
    } else if (filter === 4) {
      for (let i = 0; i < bpp; i++) row[i] += prior[i];
      for (let i = bpp; i < stride; i++) row[i] += paeth(row[i - bpp], prior[i], prior[i - bpp]);
    } else if (filter !== 0) {
      throw new Error(`corrupt PNG: row ${y} uses unknown filter type ${filter}`);
    }
  }
}

function toRgba(raw, stride, png) {
  const { width, height, depth, colourType, kind } = png.header;
  const context = { scale: sampleScale(depth), key: transparentKey(png), palette: colourType === 3 ? paletteRgba(png) : null };
  const samples = depth === 16 ? new Uint16Array(width * kind.channels) : new Uint8Array(width * kind.channels);
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const start = y * (stride + 1) + 1;
    kind.expand(unpack(raw.subarray(start, start + stride), depth, samples), rgba, y * width * 4, width, context);
  }
  return rgba;
}

function unpack(row, depth, samples) {
  if (depth === 8) return row;
  if (depth === 16) {
    for (let i = 0; i < samples.length; i++) samples[i] = (row[2 * i] << 8) | row[2 * i + 1];
    return samples;
  }
  const perByte = 8 / depth;
  const mask = (1 << depth) - 1;
  for (let i = 0; i < samples.length; i++) samples[i] = (row[(i / perByte) | 0] >> (8 - depth * (1 + (i % perByte)))) & mask;
  return samples;
}

function sampleScale(depth) {
  const max = (1 << depth) - 1;
  const scale = new Uint8Array(max + 1);
  for (let v = 0; v <= max; v++) scale[v] = Math.round((v * 255) / max);
  return scale;
}

function transparentKey({ header, transparency }) {
  const size = { 0: 2, 2: 6 }[header.colourType];
  if (!transparency || !size) return null;
  if (transparency.length !== size) throw new Error(`corrupt PNG: tRNS holds ${transparency.length} bytes, not ${size}`);
  return Array.from({ length: size / 2 }, (_, i) => transparency.readUInt16BE(2 * i));
}

function paletteRgba({ palette, transparency }) {
  if (palette.length % 3 || palette.length > 768) throw new Error(`corrupt PNG: PLTE holds ${palette.length} bytes`);
  const rgba = new Uint8Array((palette.length / 3) * 4);
  for (let i = 0; i < palette.length / 3; i++) {
    rgba.set(palette.subarray(i * 3, i * 3 + 3), i * 4);
    rgba[i * 4 + 3] = transparency && i < transparency.length ? transparency[i] : 255;
  }
  return rgba;
}

function expandGrey(s, rgba, o, width, { scale, key }) {
  const k = key ? key[0] : -1;
  for (let x = 0; x < width; x++, o += 4) {
    rgba[o] = rgba[o + 1] = rgba[o + 2] = scale[s[x]];
    rgba[o + 3] = s[x] === k ? 0 : 255;
  }
}

function expandTruecolour(s, rgba, o, width, { scale, key }) {
  for (let i = 0; i < width * 3; i += 3, o += 4) {
    rgba[o] = scale[s[i]];
    rgba[o + 1] = scale[s[i + 1]];
    rgba[o + 2] = scale[s[i + 2]];
    rgba[o + 3] = key && s[i] === key[0] && s[i + 1] === key[1] && s[i + 2] === key[2] ? 0 : 255;
  }
}

function expandIndexed(s, rgba, o, width, { palette }) {
  for (let x = 0; x < width; x++, o += 4) {
    const p = s[x] * 4;
    if (p >= palette.length) throw new Error(`corrupt PNG: palette index ${s[x]} is past the ${palette.length / 4}-entry palette`);
    rgba[o] = palette[p];
    rgba[o + 1] = palette[p + 1];
    rgba[o + 2] = palette[p + 2];
    rgba[o + 3] = palette[p + 3];
  }
}

function expandGreyAlpha(s, rgba, o, width, { scale }) {
  for (let i = 0; i < width * 2; i += 2, o += 4) {
    rgba[o] = rgba[o + 1] = rgba[o + 2] = scale[s[i]];
    rgba[o + 3] = scale[s[i + 1]];
  }
}

function expandTruecolourAlpha(s, rgba, o, width, { scale }) {
  for (let i = 0; i < width * 4; i++) rgba[o + i] = scale[s[i]];
}

function encode(image, { alpha = true } = {}) {
  const { width, height, rgba, chunks = [] } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) throw new Error(`encode needs positive integer width and height, got ${width}x${height}`);
  if (!(rgba instanceof Uint8Array) || rgba.length !== width * height * 4) throw new Error(`encode needs rgba as a Uint8Array of ${width}x${height}x4 bytes`);
  if (typeof alpha !== "boolean") throw new Error("encode option alpha must be true or false");
  if (!Array.isArray(chunks) || !chunks.every((c) => c && COLOUR_CHUNKS.has(c.type) && c.data instanceof Uint8Array)) throw new Error("encode passes through only colour chunks: { type: iCCP, sRGB, gAMA or cHRM, data: bytes }");
  const channels = alpha ? 4 : 3;
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = alpha ? 6 : 2;
  const scanlines = filterScanlines(alpha ? rgba : flattenOverWhite(rgba), width * channels, height, channels);
  return Buffer.concat([SIGNATURE, chunk("IHDR", header), ...chunks.map((c) => chunk(c.type, c.data)), chunk("IDAT", zlib.deflateSync(scanlines, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "latin1");
  out.set(data, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

function flattenOverWhite(rgba) {
  const rgb = new Uint8Array((rgba.length / 4) * 3);
  for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
    const a = rgba[i + 3];
    const white = 255 * (255 - a) + 127;
    rgb[j] = ((rgba[i] * a + white) / 255) | 0;
    rgb[j + 1] = ((rgba[i + 1] * a + white) / 255) | 0;
    rgb[j + 2] = ((rgba[i + 2] * a + white) / 255) | 0;
  }
  return rgb;
}

function filterScanlines(pixels, stride, height, bpp) {
  const out = Buffer.alloc(height * (stride + 1));
  const zero = new Uint8Array(stride);
  const candidates = Array.from({ length: 5 }, () => new Uint8Array(stride));
  for (let y = 0; y < height; y++) {
    const row = pixels.subarray(y * stride, (y + 1) * stride);
    const prior = y ? pixels.subarray((y - 1) * stride, y * stride) : zero;
    let best = 0;
    let bestSum = Infinity;
    for (let type = 0; type < 5; type++) {
      const absoluteSum = filterRow(type, row, prior, bpp, candidates[type]);
      if (absoluteSum < bestSum) {
        best = type;
        bestSum = absoluteSum;
      }
    }
    out[y * (stride + 1)] = best;
    out.set(candidates[best], y * (stride + 1) + 1);
  }
  return out;
}

function filterRow(type, row, prior, bpp, into) {
  const n = row.length;
  if (type === 0) into.set(row);
  else if (type === 1) {
    for (let i = 0; i < bpp; i++) into[i] = row[i];
    for (let i = bpp; i < n; i++) into[i] = row[i] - row[i - bpp];
  } else if (type === 2) {
    for (let i = 0; i < n; i++) into[i] = row[i] - prior[i];
  } else if (type === 3) {
    for (let i = 0; i < bpp; i++) into[i] = row[i] - (prior[i] >> 1);
    for (let i = bpp; i < n; i++) into[i] = row[i] - ((row[i - bpp] + prior[i]) >> 1);
  } else {
    for (let i = 0; i < bpp; i++) into[i] = row[i] - prior[i];
    for (let i = bpp; i < n; i++) into[i] = row[i] - paeth(row[i - bpp], prior[i], prior[i - bpp]);
  }
  let absoluteSum = 0;
  for (let i = 0; i < n; i++) absoluteSum += into[i] < 128 ? into[i] : 256 - into[i];
  return absoluteSum;
}

module.exports = { decode, encode };
