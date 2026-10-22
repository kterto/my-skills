"use strict";
// Launcher icons on both platforms: Android mipmap and drawable sets per source set, iOS app icon sets. The read half
// is digests and PNG header facts (size and alpha). The write half badges production's icons into each environment's
// set at their own sizes, and owns an icon on disk only while its pixels equal a fresh render of the current source.

const { digest } = require("../lib/io.cjs");
const { CONVENTIONS } = require("../lib/vocab.cjs");
const { decode, encode } = require("../lib/png.cjs");
const { badge } = require("../lib/badge.cjs");

const SIG = "89504e470d0a1a0a";

// -> { width, height, colorType, alpha } from the PNG chunks before the image data, or null for a non-PNG.
function pngFacts(buf) {
  if (!buf || buf.length < 33 || buf.subarray(0, 8).toString("hex") !== SIG) return null;
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const colorType = buf[25];
  let trns = false;
  for (let p = 8; p + 8 <= buf.length;) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString("latin1", p + 4, p + 8);
    if (type === "tRNS") trns = true;
    if (type === "IDAT" || type === "IEND") break;
    p += 12 + len;
  }
  return { width, height, colorType, alpha: colorType === 4 || colorType === 6 || trns };
}

const setDigest = (files) => digest(files.map((f) => `${f.name}:${f.digest}`).sort().join("\n"));
const LAYER = /<(foreground|background|monochrome)\b[^>]*?\bandroid:drawable\s*=\s*"@(?:mipmap|drawable)\/([\w.]+)"/g;

function androidSets(io, iconName) {
  const out = {};
  for (const set of io.list("android/app/src").filter((e) => e.dir).map((e) => e.name)) {
    const files = [];
    for (const dir of io.list(`android/app/src/${set}/res`).filter((e) => e.dir && /^(mipmap|drawable)/.test(e.name))) {
      for (const f of io.list(`android/app/src/${set}/res/${dir.name}`)) {
        if (f.dir || !f.name.startsWith(iconName)) continue;
        const rel = `android/app/src/${set}/res/${dir.name}/${f.name}`;
        const buf = io.readBinary(rel);
        files.push({ rel, name: `${dir.name}/${f.name}`, digest: digest(buf), png: pngFacts(buf), webp: f.name.endsWith(".webp") });
      }
    }
    // The layers each adaptive-icon XML of the set names, by resource name.
    const adaptive = files.filter((f) => /^mipmap-anydpi[^/]*\/[^/]+\.xml$/.test(f.name))
      .map((f) => ({ name: f.name, ...Object.fromEntries([...(io.read(f.rel) || "").matchAll(LAYER)].map((m) => [m[1], m[2]])) }));
    if (files.length) out[set] = { files, digest: setDigest(files), adaptive };
  }
  return out;
}

// A launcher file's resource: its folder and name without the extension, which is how Gradle merges source sets, so a
// flavor's ic_launcher.png replaces main's ic_launcher.webp.
const resourceOf = (name) => name.replace(/\.[^./]+$/, "");

// A launcher file's resource name alone, without its folder or extension.
const baseOf = (name) => resourceOf(name).split("/")[1];

// The adaptive foregrounds of a set that no PNG or webp draws, such as the vector drawable of Android Studio's default
// icon. The badge cannot draw them, so a flavor that draws none of its own shows production's on Android 8 and later.
function undrawnForegrounds(set) {
  const raster = new Set(set.files.filter((f) => /\.(png|webp)$/.test(f.name)).map((f) => baseOf(f.name)));
  return [...new Set(set.adaptive.map((a) => a.foreground).filter((fg) => fg && !raster.has(fg)))];
}

// The layer each launcher file of a set is to the badge: an adaptive icon's XML ("xml"), its foreground, badged inside
// the safe zone ("safe"), its background or monochrome, which stay production's ("skip"), or a legacy or round icon
// ("full"); null for a file the badge cannot draw, such as a vector drawable. The set's adaptive XML names its layers,
// and without one the _foreground, _background and _monochrome suffixes do.
function launcherLayer(set) {
  const roles = new Map();
  for (const a of (set && set.adaptive) || []) {
    if (a.foreground) roles.set(a.foreground, "safe");
    for (const n of [a.background, a.monochrome]) if (n && !roles.has(n)) roles.set(n, "skip");
  }
  return (name) => {
    const [dir, file] = name.split("/");
    if (/^mipmap-anydpi/.test(dir) && file.endsWith(".xml")) return "xml";
    if (!/\.(png|webp)$/.test(file)) return null;
    const base = file.replace(/\.[^.]+$/, "");
    if (roles.has(base)) return roles.get(base);
    return /_foreground$/.test(base) ? "safe" : /_(background|monochrome)$/.test(base) ? "skip" : "full";
  };
}

function iosSets(io, errors) {
  const base = "ios/Runner/Assets.xcassets";
  const out = {};
  for (const e of io.list(base).filter((x) => x.dir && x.name.endsWith(".appiconset"))) {
    const name = e.name.slice(0, -".appiconset".length);
    const rel = `${base}/${e.name}`;
    let images = [];
    try { images = JSON.parse(io.read(`${rel}/Contents.json`) || '{"images":[]}').images || []; }
    catch (err) { errors.push({ at: `${rel}/Contents.json`, why: err.message }); }
    const files = images.filter((i) => i.filename).map((i) => {
      const buf = io.readBinary(`${rel}/${i.filename}`);
      return { rel: `${rel}/${i.filename}`, name: i.filename, idiom: i.idiom, size: i.size, digest: buf ? digest(buf) : null, png: pngFacts(buf) };
    });
    const marketing = files.find((f) => f.idiom === "ios-marketing" || f.size === "1024x1024") || null;
    out[name] = { name, rel, files, digest: files.length ? setDigest(files) : null, marketing };
  }
  return out;
}

function read(io, { androidIcon = "ic_launcher" } = {}) {
  const errors = [];
  return { android: androidSets(io, androidIcon), ios: iosSets(io, errors), errors };
}

const ASSETS = "ios/Runner/Assets.xcassets";
const setDir = (name) => `${ASSETS}/${name}.appiconset`;
const isStoreIcon = (image) => image.idiom === "ios-marketing" || (image.size === "1024x1024" && !image.appearances);
const hasTransparency = ({ rgba }) => { for (let o = 3; o < rgba.length; o += 4) if (rgba[o] !== 255) return true; return false; };
const decodes = (bytes) => { try { return decode(bytes); } catch { return null; } };
const samePixels = (a, b) => a.width === b.width && a.height === b.height && Buffer.from(a.rgba.buffer, a.rgba.byteOffset, a.rgba.byteLength).equals(Buffer.from(b.rgba.buffer, b.rgba.byteOffset, b.rgba.byteLength));

// One production icon badged at its own size. It keeps an alpha channel only where a pixel is transparent, and the
// opaque one (the App Store icon) is flattened. Colour chunks travel through, so a Display P3 icon stays P3.
function render(bytes, { label, color, mode, opaque }) {
  const badged = badge(decode(bytes), { label, color, mode, opaque });
  return encode(badged, { alpha: hasTransparency(badged) });
}

// The way to rebadge an icon that reads as the owner's; the foreign note and apply's leftover both name it.
const REGEN = "--set icons=regen rebadges it";

// Writes a badged icon unless the file on disk is the owner's: ours means its pixels equal the fresh render. A byte copy
// of production's icon (one icon for every flavor) is the owner's too, and the note says which it is.
// With regen the owner asked for a rebadge, so whatever is there is overwritten.
function place(tree, to, bytes, regen, source) {
  const current = tree.readBytes(to);
  if (current !== null && !regen) {
    const pixels = decodes(current);
    if (!pixels || !samePixels(pixels, decode(bytes))) {
      const what = current.equals(source) ? "it is a copy of production's icon, not a badge of it" : "its pixels are not a fresh badge of production's icon, so it was replaced by hand";
      return tree.foreign(to, `${what}; ${REGEN}`);
    }
  }
  tree.write(to, bytes);
}

// A verbatim copy of production's file, in the new-file class: absent is written, equal stays, different is a conflict
// (overwritten under regen).
function copy(tree, to, bytes, regen) {
  const current = tree.readBytes(to);
  if (current !== null && !current.equals(bytes) && !regen) { tree.conflict(to, "it differs from production's copy, which flutter-envs copies verbatim"); return false; }
  tree.write(to, bytes);
  return true;
}

function badgeInto(tree, from, to, options, regen) {
  const source = tree.readBytes(from);
  if (source === null) return tree.conflict(to, `production's ${from} is missing, so there is nothing to badge`);
  let bytes;
  try { bytes = render(source, options); } catch (e) { return tree.conflict(to, `production's ${from} is not a PNG the badge can read (${e.message})`); }
  place(tree, to, bytes, regen, source);
}

const FOREGROUND = /<foreground\b[^>]*?\bandroid:drawable\s*=\s*"@(drawable|mipmap)\/([\w.]+)"/;

// The writer ops, by edit id icons.<op>. Production is never badged.
const ops = {
  android: (tree, { env, label, color, regen = false }, ctx) => {
    if (env === ctx.spec.production) throw new Error(`icons: ${env} is the production environment, which is never badged`);
    const main = ctx.facts.icons.android.main;
    if (!main) return tree.conflict(`android/app/src/${env}/res`, "src/main has no launcher icons to badge");
    const pngs = new Set(main.files.filter((f) => f.name.endsWith(".png")).map((f) => f.name.split("/")[1].slice(0, -".png".length)));
    const ownSet = Object.entries(ctx.facts.icons.android).find(([set]) => set.toLowerCase() === env);
    const own = ownSet ? ownSet[1].files : [];
    const base = (name) => name.split("/")[1].replace(/\.[^.]+$/, "");
    const drawsOwn = (layer) => own.some((x) => base(x.name) === layer);
    const layer = launcherLayer(main);
    const reported = new Set();
    for (const f of main.files) {
      const to = `android/app/src/${env}/res/${f.name}`;
      const role = layer(f.name);
      // The flavor's own file of this resource under another extension already draws it; a second one would not merge.
      const twin = own.find((x) => x.name !== f.name && resourceOf(x.name) === resourceOf(f.name));
      if (role === "xml") {
        const xml = tree.readBytes(f.rel);
        if (xml === null) { tree.conflict(to, `production's ${f.rel} is missing`); continue; }
        copy(tree, to, xml, regen);
        // An adaptive foreground the badge cannot draw leaves the environment showing production's on Android 8 and later.
        const fg = FOREGROUND.exec(xml.toString("utf8"));
        if (fg && !pngs.has(fg[2]) && !drawsOwn(fg[2]) && !reported.has(fg[2])) {
          reported.add(fg[2]);
          const drawn = main.files.find((x) => base(x.name) === fg[2]);
          tree.conflict(`android/app/src/${env}/res/${drawn ? drawn.name : f.name}`, `the adaptive icon's foreground layer @${fg[1]}/${fg[2]} is not a PNG (a vector drawable), so the badge cannot draw it and ${env} shows production's foreground on Android 8 and later; give ${env} a foreground PNG of its own`);
        }
      } else if (role !== "full" && role !== "safe") continue;
      else if (twin) tree.foreign(to, `${env}'s own ${twin.name} draws this icon; remove it, then ${REGEN}`);
      else if (f.webp) tree.conflict(to, `production's ${f.rel} is webp; convert it to PNG so it can be badged`);
      else badgeInto(tree, f.rel, to, { label, color, mode: role, opaque: false }, regen);
    }
  },
  ios: (tree, { env, label, color, regen = false }, ctx) => {
    const production = ctx.spec.production;
    const from = setDir(CONVENTIONS.iosIconSet(production, production));
    const to = setDir(CONVENTIONS.iosIconSet(env, production));
    if (from === to) throw new Error(`icons: ${env} is the production environment, which is never badged`);
    const contents = tree.readBytes(`${from}/Contents.json`);
    if (contents === null) return tree.conflict(`${to}/Contents.json`, `${from}/Contents.json is missing, so there is no production set to badge`);
    let images;
    try { images = JSON.parse(contents.toString("utf8")).images || []; } catch (e) { return tree.conflict(`${to}/Contents.json`, `${from}/Contents.json does not parse (${e.message})`); }
    if (!copy(tree, `${to}/Contents.json`, contents, regen)) return;
    const done = new Set();
    for (const image of images) {
      if (!image.filename || done.has(image.filename)) continue;
      done.add(image.filename);
      badgeInto(tree, `${from}/${image.filename}`, `${to}/${image.filename}`, { label, color, mode: "full", opaque: isStoreIcon(image) }, regen);
    }
  },
};

// What a leftover of a skipped (foreign) icon names as its way out.
const remedies = Object.freeze({ foreign: REGEN });

module.exports = { read, pngFacts, launcherLayer, resourceOf, baseOf, undrawnForegrounds, ops, remedies };
