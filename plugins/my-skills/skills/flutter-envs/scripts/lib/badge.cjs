"use strict";
// Owns the environment badge: paints an opaque band with a white stroke-font label onto an RGBA image, as a pure,
// bit-reproducible function. It changes pixels only, so the image's colour chunks reach the encoder untouched.

const FONT_CAP_HEIGHT = 6;
const FONT = {
  A: "M0,6 L2,0 L4,6 M0.8,4 L3.2,4",
  B: "M0,6 L0,0 L2.6,0 L3.6,0.8 L3.6,2.2 L2.6,3 L0,3 M2.6,3 L3.8,3.9 L3.8,5.2 L2.6,6 L0,6",
  C: "M3.8,1.2 L2.9,0 L1,0 L0,1.2 L0,4.8 L1,6 L2.9,6 L3.8,4.8",
  D: "M0,0 L0,6 L2.4,6 L3.8,4.8 L3.8,1.2 L2.4,0 L0,0",
  E: "M3.8,0 L0,0 L0,6 L3.8,6 M0,3 L3,3",
  F: "M3.8,0 L0,0 L0,6 M0,3 L3,3",
  G: "M3.8,1.2 L2.9,0 L1,0 L0,1.2 L0,4.8 L1,6 L2.9,6 L3.8,4.8 L3.8,3.2 L2.2,3.2",
  H: "M0,0 L0,6 M3.8,0 L3.8,6 M0,3 L3.8,3",
  I: "M0.8,0 L3,0 M1.9,0 L1.9,6 M0.8,6 L3,6",
  J: "M3.8,0 L3.8,4.8 L2.8,6 L1,6 L0,4.8",
  K: "M0,0 L0,6 M3.8,0 L0,3.6 M1.2,2.6 L3.8,6",
  L: "M0,0 L0,6 L3.8,6",
  M: "M0,6 L0,0 L1.9,3.4 L3.8,0 L3.8,6",
  N: "M0,6 L0,0 L3.8,6 L3.8,0",
  O: "M1,0 L2.8,0 L3.8,1 L3.8,5 L2.8,6 L1,6 L0,5 L0,1 L1,0",
  P: "M0,6 L0,0 L2.8,0 L3.8,1 L3.8,2.4 L2.8,3.4 L0,3.4",
  Q: "M1,0 L2.8,0 L3.8,1 L3.8,5 L2.8,6 L1,6 L0,5 L0,1 L1,0 M2.4,4.4 L3.9,6.2",
  R: "M0,6 L0,0 L2.8,0 L3.8,1 L3.8,2.4 L2.8,3.4 L0,3.4 M2,3.4 L3.8,6",
  S: "M3.8,1 L3,0 L0.8,0 L0,0.9 L0,2.2 L0.8,3 L3,3 L3.8,3.8 L3.8,5.1 L3,6 L0.8,6 L0,5",
  T: "M0,0 L3.8,0 M1.9,0 L1.9,6",
  U: "M0,0 L0,5 L1,6 L2.8,6 L3.8,5 L3.8,0",
  V: "M0,0 L1.9,6 L3.8,0",
  W: "M0,0 L0.9,6 L1.9,2.6 L2.9,6 L3.8,0",
  X: "M0,0 L3.8,6 M3.8,0 L0,6",
  Y: "M0,0 L1.9,3 L3.8,0 M1.9,3 L1.9,6",
  Z: "M0,0 L3.8,0 L0,6 L3.8,6",
  0: "M1,0 L2.8,0 L3.8,1 L3.8,5 L2.8,6 L1,6 L0,5 L0,1 L1,0 M0.7,5.2 L3.1,0.8",
  1: "M0.8,1.2 L2,0 L2,6 M0.8,6 L3.2,6",
  2: "M0,1 L1,0 L2.8,0 L3.8,1 L3.8,2.4 L0,6 L3.8,6",
  3: "M0,0.6 L0.8,0 L3,0 L3.8,0.9 L3.8,2.3 L2.8,3 L1.4,3 M2.8,3 L3.8,3.8 L3.8,5.1 L3,6 L0.8,6 L0,5.4",
  4: "M3,6 L3,0 L0,4.2 L3.8,4.2",
  5: "M3.8,0 L0.4,0 L0,3 L2.6,2.8 L3.8,3.8 L3.8,5.1 L2.8,6 L0.6,6 L0,5.2",
  6: "M3.6,0.6 L2.6,0 L1,0 L0,1.2 L0,4.8 L1,6 L2.8,6 L3.8,4.8 L3.8,3.4 L2.8,2.6 L0,2.8",
  7: "M0,0 L3.8,0 L1.4,6",
  8: "M1,0 L2.8,0 L3.6,0.9 L3.6,2.1 L2.8,3 L1,3 L0.2,2.1 L0.2,0.9 L1,0 M1,3 L0,3.9 L0,5.1 L1,6 L2.8,6 L3.8,5.1 L3.8,3.9 L2.8,3",
  9: "M0.2,5.4 L1.2,6 L2.8,6 L3.8,4.8 L3.8,1.2 L2.8,0 L1,0 L0,1.2 L0,2.6 L1,3.4 L3.8,3.2",
  "-": "M0.4,3 L2.8,3",
};
const GLYPHS = new Map(Object.entries(FONT).map(([ch, path]) => [ch, parseGlyph(path)]));

const STROKE = 1.3;
const SPACING = 1.0;
const LABEL_HEIGHT = 0.6;
const LABEL_WIDTH = 0.86;
const SUPERSAMPLE = 4;
const FULL_BAND_SHARE = 0.22;
const LAYER_DP = 108;
const SAFE_ZONE_DP = 66;
const SAFE_BAND_DP = 16;

const BANDS = {
  full: (width, height) => {
    const top = height - Math.round(height * FULL_BAND_SHARE);
    return { x: 0, y: top, width, height: height - top };
  },
  safe: (width, height) => {
    const inset = (LAYER_DP - SAFE_ZONE_DP) / 2;
    const left = Math.round((width * inset) / LAYER_DP);
    const bottom = height - Math.round((height * inset) / LAYER_DP);
    const bandHeight = Math.round((height * SAFE_BAND_DP) / LAYER_DP);
    return { x: left, y: bottom - bandHeight, width: width - 2 * left, height: bandHeight };
  },
};

function parseGlyph(path) {
  const strokes = path
    .split("M")
    .filter((part) => part.trim())
    .map((part) => part.trim().split(/\s+/).map((point) => point.replace("L", "").split(",").map(Number)));
  const xs = strokes.flat().map(([x]) => x);
  return { strokes, left: Math.min(...xs), width: Math.max(...xs) - Math.min(...xs) };
}

function badge(image, { label, color, mode, opaque = false, flatten = "FFFFFF" } = {}) {
  const { width, height, rgba } = image;
  if (!(rgba instanceof Uint8Array) || !(width > 0 && height > 0) || rgba.length !== width * height * 4) throw new Error("badge needs an image { width, height, rgba } with width * height * 4 rgba bytes");
  if (!Object.hasOwn(BANDS, mode)) throw new Error(`badge mode must be "full" or "safe", got ${JSON.stringify(mode)}`);
  if (typeof opaque !== "boolean") throw new Error("badge option opaque must be true or false");
  const glyphs = glyphsOf(label);
  const fill = parseColour(color, "color");
  const background = parseColour(flatten, "flatten");
  const out = new Uint8Array(rgba);
  const band = BANDS[mode](width, height);
  paintBand(out, width, band, fill);
  paintLabel(out, width, band, fill, rasterize(layout(glyphs, band), band));
  if (opaque) flattenOnto(out, background);
  return { ...image, rgba: out };
}

function glyphsOf(label) {
  if (typeof label !== "string" || !label) throw new Error("badge label must be a non-empty string");
  return [...label].map((ch) => {
    const glyph = GLYPHS.get(ch);
    if (!glyph) throw new Error(`badge label ${JSON.stringify(label)} has ${JSON.stringify(ch)}, which the badge font lacks (it covers A-Z, 0-9 and -)`);
    return glyph;
  });
}

function parseColour(hex, option) {
  if (typeof hex !== "string" || !/^[0-9a-f]{6}$/i.test(hex)) throw new Error(`badge option ${option} must be a hex colour like "2E7D32", got ${JSON.stringify(hex)}`);
  const v = parseInt(hex, 16);
  return [v >> 16, (v >> 8) & 255, v & 255];
}

function paintBand(rgba, width, band, [r, g, b]) {
  for (let y = band.y; y < band.y + band.height; y++) {
    for (let o = (y * width + band.x) * 4, end = o + band.width * 4; o < end; o += 4) {
      rgba[o] = r;
      rgba[o + 1] = g;
      rgba[o + 2] = b;
      rgba[o + 3] = 255;
    }
  }
}

function layout(glyphs, band) {
  const inkWidth = glyphs.reduce((sum, g) => sum + g.width, 0) + (glyphs.length - 1) * (STROKE + SPACING) + STROKE;
  const inkHeight = FONT_CAP_HEIGHT + STROKE;
  const unit = Math.min((band.height * LABEL_HEIGHT) / inkHeight, (band.width * LABEL_WIDTH) / inkWidth);
  const radius = (STROKE / 2) * unit;
  const top = band.y + (band.height - inkHeight * unit) / 2 + radius;
  let left = band.x + (band.width - inkWidth * unit) / 2 + radius;
  const segments = [];
  for (const glyph of glyphs) {
    for (const stroke of glyph.strokes) {
      for (let k = 1; k < stroke.length; k++) {
        const [x0, y0] = stroke[k - 1];
        const [x1, y1] = stroke[k];
        segments.push([left + (x0 - glyph.left) * unit, top + y0 * unit, left + (x1 - glyph.left) * unit, top + y1 * unit]);
      }
    }
    left += (glyph.width + STROKE + SPACING) * unit;
  }
  return { segments, radius };
}

function rasterize({ segments, radius }, band) {
  const cols = band.width * SUPERSAMPLE;
  const rows = band.height * SUPERSAMPLE;
  const inside = new Uint8Array(cols * rows);
  const r2 = radius * radius;
  for (const [ax, ay, bx, by] of segments) {
    const dx = bx - ax;
    const dy = by - ay;
    const length2 = dx * dx + dy * dy;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - radius - band.x) * SUPERSAMPLE));
    const i1 = Math.min(cols, Math.ceil((Math.max(ax, bx) + radius - band.x) * SUPERSAMPLE));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by) - radius - band.y) * SUPERSAMPLE));
    const j1 = Math.min(rows, Math.ceil((Math.max(ay, by) + radius - band.y) * SUPERSAMPLE));
    for (let j = j0; j < j1; j++) {
      const wy = band.y + (j + 0.5) / SUPERSAMPLE - ay;
      for (let i = i0; i < i1; i++) {
        const wx = band.x + (i + 0.5) / SUPERSAMPLE - ax;
        const t = wx * dx + wy * dy;
        let hit;
        if (t <= 0) hit = wx * wx + wy * wy <= r2;
        else if (t >= length2) hit = (wx - dx) * (wx - dx) + (wy - dy) * (wy - dy) <= r2;
        else hit = (wx * dy - wy * dx) * (wx * dy - wy * dx) <= r2 * length2;
        if (hit) inside[j * cols + i] = 1;
      }
    }
  }
  const counts = new Uint8Array(band.width * band.height);
  for (let j = 0; j < rows; j++) {
    const base = ((j / SUPERSAMPLE) | 0) * band.width;
    for (let i = 0; i < cols; i++) counts[base + ((i / SUPERSAMPLE) | 0)] += inside[j * cols + i];
  }
  return counts;
}

function paintLabel(rgba, width, band, fill, counts) {
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  const shades = Array.from({ length: samples + 1 }, (_, n) => fill.map((c) => Math.round((c * (samples - n) + 255 * n) / samples)));
  for (let k = 0; k < counts.length; k++) {
    if (!counts[k]) continue;
    const o = ((band.y + ((k / band.width) | 0)) * width + band.x + (k % band.width)) * 4;
    const [r, g, b] = shades[counts[k]];
    rgba[o] = r;
    rgba[o + 1] = g;
    rgba[o + 2] = b;
  }
}

function flattenOnto(rgba, [r, g, b]) {
  for (let o = 0; o < rgba.length; o += 4) {
    const a = rgba[o + 3];
    if (a === 255) continue;
    rgba[o] = ((rgba[o] * a + r * (255 - a) + 127) / 255) | 0;
    rgba[o + 1] = ((rgba[o + 1] * a + g * (255 - a) + 127) / 255) | 0;
    rgba[o + 2] = ((rgba[o + 2] * a + b * (255 - a) + 127) / 255) | 0;
    rgba[o + 3] = 255;
  }
}

module.exports = { badge };
