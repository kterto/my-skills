"use strict";
// The icons writer's badge ops through the engine's tree. iOS copies Contents.json verbatim and badges every image it
// names at its own size, the App Store icon without alpha; Android badges the legacy, round and adaptive foreground
// icons into the environment's source set. A second run writes the same bytes, a file whose pixels differ from a
// fresh render is foreign and stays, a missing production source is a conflict, and colour chunks travel through
// without changing who owns a file.
const test = require("node:test");
const assert = require("node:assert/strict");
const I = require("../scripts/writers/icons.cjs");
const { decode, encode } = require("../scripts/lib/png.cjs");
const { bundle } = require("./helpers/project.cjs");
const { memtree, apply, SHOP } = require("./helpers/memtree.cjs");
const { assertSameBytes, assertDifferentBytes } = require("./helpers/bytes.cjs");

const BUNDLES = ["pristine-flutter-3.47", "pristine-flutter-3.41-pods"];
const PROD = "ios/Runner/Assets.xcassets/AppIcon.appiconset";
const DEV = "ios/Runner/Assets.xcassets/AppIcon-dev.appiconset";
const MAIN = "android/app/src/main/res";
const colourType = (bytes) => bytes[25];
const ctxOf = (t) => ({ spec: { production: SHOP.production }, facts: { icons: I.read(t.io) } });
const run = (files, edits) => { const t = memtree(files); apply(t.tree, edits, ctxOf(t)); return t; };
const ios = (env) => ({ id: `icons.ios:${env}`, args: { env, ...SHOP.badges[env] } });
const android = (env) => ({ id: `icons.android:${env}`, args: { env, ...SHOP.badges[env] } });
const images = (files) => JSON.parse(files[`${PROD}/Contents.json`]).images;
const named = (files) => [...new Set(images(files).map((i) => i.filename))].sort();
const transparent = (image) => image.rgba.some((v, i) => i % 4 === 3 && v !== 255);
const withChunks = (bytes, chunks) => encode({ ...decode(bytes), chunks }, { alpha: true });

for (const b of BUNDLES) {
  test(`${b}: icons.ios copies Contents.json verbatim and badges every image it names at its own size`, () => {
    const files = bundle(b);
    const t = run(files, [ios("dev")]);
    assert.equal(t.tree.read(`${DEV}/Contents.json`), files[`${PROD}/Contents.json`]);
    assert.deepEqual(t.changes().filter((c) => !c.file.endsWith("Contents.json")).map((c) => [c.file.slice(DEV.length + 1), c.state]), named(files).map((f) => [f, "created"]));
    for (const f of named(files)) {
      const [src, out] = [decode(files[`${PROD}/${f}`]), decode(t.tree.readBytes(`${DEV}/${f}`))];
      assert.deepEqual([out.width, out.height], [src.width, src.height], f);
      assertDifferentBytes(out.rgba, src.rgba, `${f} carries the badge`);
    }
  });

  test(`${b}: icons.ios writes the App Store icon without alpha, and alpha elsewhere only where a pixel is transparent`, () => {
    const t = run(bundle(b), [ios("staging")]);
    const store = images(bundle(b)).find((i) => i.idiom === "ios-marketing");
    assert.ok(store, "the template has an App Store icon");
    const set = "ios/Runner/Assets.xcassets/AppIcon-staging.appiconset";
    assert.equal(colourType(t.tree.readBytes(`${set}/${store.filename}`)), 2);
    for (const image of images(bundle(b))) {
      const bytes = t.tree.readBytes(`${set}/${image.filename}`);
      assert.equal(colourType(bytes), transparent(decode(bytes)) ? 6 : 2, `${image.filename} colour type`);
    }
  });

  test(`${b}: icons.ios keeps a transparent pixel outside the App Store icon, and flattens one inside it`, () => {
    const files = bundle(b);
    for (const name of ["Icon-App-20x20@1x.png", "Icon-App-1024x1024@1x.png"]) {
      const src = decode(files[`${PROD}/${name}`]);
      src.rgba[3] = 0;
      files[`${PROD}/${name}`] = encode(src, { alpha: true });
    }
    const t = run(files, [ios("dev")]);
    assert.equal(colourType(t.tree.readBytes(`${DEV}/Icon-App-20x20@1x.png`)), 6);
    assert.equal(decode(t.tree.readBytes(`${DEV}/Icon-App-20x20@1x.png`)).rgba[3], 0);
    assert.equal(colourType(t.tree.readBytes(`${DEV}/Icon-App-1024x1024@1x.png`)), 2);
    assert.equal(decode(t.tree.readBytes(`${DEV}/Icon-App-1024x1024@1x.png`)).rgba[3], 255);
  });

  test(`${b}: icons.android badges each launcher icon of src/main into src/<env>/res under the same name`, () => {
    const files = bundle(b);
    const sources = Object.keys(files).filter((f) => f.startsWith(`${MAIN}/mipmap-`)).sort();
    assert.equal(sources.length, 5);
    const t = run(files, [android("dev")]);
    assert.deepEqual(t.changes().map((c) => [c.file, c.state]), sources.map((f) => [f.replace("/src/main/", "/src/dev/"), "created"]));
    for (const f of sources) {
      const [src, out] = [decode(files[f]), decode(t.tree.readBytes(f.replace("/src/main/", "/src/dev/")))];
      assert.deepEqual([out.width, out.height], [src.width, src.height], f);
      const top = out.width * 4 * Math.floor(out.height * 0.7);
      assertSameBytes(out.rgba.subarray(0, top), src.rgba.subarray(0, top), `${f}: the rows above the full band are production's`);
      assertDifferentBytes(out.rgba, src.rgba, `${f} carries the badge`);
    }
  });

  test(`${b}: a second run of both icon ops on its own output writes the same bytes`, () => {
    const edits = [ios("dev"), ios("staging"), android("dev"), android("staging")];
    const first = run(bundle(b), edits);
    const second = run(first.files(), edits);
    assert.equal(second.changes().length, 2 * (named(bundle(b)).length + 1) + 2 * 5, "every icon of both sets on both platforms");
    assert.deepEqual(second.changes().filter((c) => c.state !== "unchanged"), []);
  });
}

test("icons.ios is byte-deterministic, and two environments differ", () => {
  const a = run(bundle("pristine-flutter-3.47"), [ios("dev")]).files();
  const b = run(bundle("pristine-flutter-3.47"), [ios("dev")]).files();
  const c = run(bundle("pristine-flutter-3.47"), [ios("staging")]).files();
  for (const f of Object.keys(a).filter((x) => x.startsWith(DEV))) assert.ok(Buffer.from(a[f]).equals(Buffer.from(b[f])), f);
  assert.ok(!Buffer.from(a[`${DEV}/Icon-App-1024x1024@1x.png`]).equals(Buffer.from(c["ios/Runner/Assets.xcassets/AppIcon-staging.appiconset/Icon-App-1024x1024@1x.png"])));
});

test("an icon copied from production or replaced by hand is foreign and stays, while the rest of its set is still ours", () => {
  const first = run(bundle("pristine-flutter-3.47"), [ios("dev"), android("dev")]).files();
  const copies = [`${DEV}/Icon-App-40x40@2x.png`, "android/app/src/dev/res/mipmap-hdpi/ic_launcher.png"];
  const art = decode(Buffer.from(first[`${DEV}/Icon-App-60x60@3x.png`]));
  art.rgba.set([1, 2, 3, 255], 0);
  const replaced = { ...first, [copies[0]]: first[`${PROD}/Icon-App-40x40@2x.png`], [copies[1]]: first[`${MAIN}/mipmap-hdpi/ic_launcher.png`], [`${DEV}/Icon-App-60x60@3x.png`]: encode(art, { alpha: false }) };
  const t = run(replaced, [ios("dev"), android("dev")]);
  for (const f of [...copies, `${DEV}/Icon-App-60x60@3x.png`]) {
    assert.equal(t.state(f), "foreign", f);
    assert.ok(t.tree.readBytes(f).equals(Buffer.from(replaced[f])), `${f} keeps the owner's bytes`);
  }
  for (const f of copies) assert.match(t.foreign.get(f), /^it is a copy of production's icon, not a badge of it; --set icons=regen rebadges it$/, `${f}'s note says it is a copy and names the way to rebadge`);
  assert.match(t.foreign.get(`${DEV}/Icon-App-60x60@3x.png`), /^its pixels are not a fresh badge of production's icon, so it was replaced by hand; --set icons=regen rebadges it$/);
  assert.equal(t.state(`${DEV}/Icon-App-40x40@3x.png`), "unchanged");
  const garbage = run({ ...first, [`${DEV}/Icon-App-20x20@1x.png`]: Buffer.from("not a png") }, [ios("dev")]);
  assert.equal(garbage.state(`${DEV}/Icon-App-20x20@1x.png`), "foreign", "a file that does not decode is not ours either");
});

test("with regen the icon ops overwrite what is there: a replaced icon, an undecodable one and a hand-edited Contents.json", () => {
  const regen = (edit) => ({ ...edit, args: { ...edit.args, regen: true } });
  const fresh = run(bundle("pristine-flutter-3.47"), [ios("dev"), android("dev")]).files();
  const replaced = {
    ...fresh, [`${DEV}/Icon-App-40x40@2x.png`]: fresh[`${PROD}/Icon-App-40x40@2x.png`], [`${DEV}/Icon-App-20x20@1x.png`]: Buffer.from("not a png"),
    [`${DEV}/Contents.json`]: Buffer.from(`${fresh[`${DEV}/Contents.json`]}\n`), "android/app/src/dev/res/mipmap-hdpi/ic_launcher.png": fresh[`${MAIN}/mipmap-hdpi/ic_launcher.png`],
  };
  const t = run(replaced, [regen(ios("dev")), regen(android("dev"))]);
  for (const f of [`${DEV}/Icon-App-40x40@2x.png`, `${DEV}/Icon-App-20x20@1x.png`, `${DEV}/Contents.json`, "android/app/src/dev/res/mipmap-hdpi/ic_launcher.png"]) {
    assert.equal(t.state(f), "updated", f);
    assert.ok(t.tree.readBytes(f).equals(Buffer.from(fresh[f])), `${f} is the fresh render again`);
  }
  assert.equal(t.foreign.size + t.conflicts.size, 0);
});

test("after production's icon changes, its badged copy reads foreign under keep and is rebadged under regen", () => {
  const first = run(bundle("pristine-flutter-3.47"), [ios("dev")]).files();
  const source = decode(Buffer.from(first[`${PROD}/Icon-App-60x60@3x.png`]));
  source.rgba.set([1, 2, 3, 255], 0);
  const changed = { ...first, [`${PROD}/Icon-App-60x60@3x.png`]: encode(source, { alpha: false }) };
  const keep = run(changed, [ios("dev")]);
  assert.equal(keep.state(`${DEV}/Icon-App-60x60@3x.png`), "foreign");
  assert.match(keep.foreign.get(`${DEV}/Icon-App-60x60@3x.png`), /--set icons=regen rebadges it/);
  assert.equal(keep.state(`${DEV}/Icon-App-40x40@2x.png`), "unchanged", "an icon whose source did not change is still ours");
  const regen = run(changed, [{ ...ios("dev"), args: { ...ios("dev").args, regen: true } }]);
  assert.equal(regen.state(`${DEV}/Icon-App-60x60@3x.png`), "updated");
  assertDifferentBytes(decode(regen.tree.readBytes(`${DEV}/Icon-App-60x60@3x.png`)).rgba, decode(Buffer.from(first[`${DEV}/Icon-App-60x60@3x.png`])).rgba, "the rebadge follows the new source");
});

test("an adaptive foreground that is a vector drawable is a conflict naming the layer, once, and the PNG layers are still badged", () => {
  const files = bundle("pristine-flutter-3.47");
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/ic_launcher_background"/>\n  <foreground android:drawable="@drawable/ic_launcher_foreground"/>\n</adaptive-icon>\n';
  files[`${MAIN}/mipmap-anydpi-v26/ic_launcher.xml`] = xml;
  files[`${MAIN}/mipmap-anydpi-v26/ic_launcher_round.xml`] = xml;
  files[`${MAIN}/drawable/ic_launcher_foreground.xml`] = '<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#FFFFFF" android:pathData="M30,30h48v48h-48z"/></vector>\n';
  const t = run(files, [android("dev")]);
  const layer = "android/app/src/dev/res/drawable/ic_launcher_foreground.xml";
  assert.equal(t.state(layer), "conflict");
  assert.match(t.conflicts.get(layer), /foreground layer @drawable\/ic_launcher_foreground is not a PNG \(a vector drawable\), so the badge cannot draw it/);
  assert.deepEqual([...t.conflicts.keys()], [layer], "two adaptive icons sharing the layer report it once");
  assert.equal(t.state("android/app/src/dev/res/mipmap-anydpi-v26/ic_launcher.xml"), "created");
  assert.equal(t.state("android/app/src/dev/res/mipmap-mdpi/ic_launcher.png"), "created");
  const own = run({ ...files, [layer]: files[`${MAIN}/drawable/ic_launcher_foreground.xml`] }, [android("dev")]);
  assert.equal(own.conflicts.size, 0, "an environment that draws its own foreground is not told to");
});

test("a missing production icon is a conflict with a note, and the set's other icons are still written", () => {
  const files = bundle("pristine-flutter-3.47");
  delete files[`${PROD}/Icon-App-20x20@2x.png`];
  const t = run(files, [ios("dev")]);
  assert.equal(t.state(`${DEV}/Icon-App-20x20@2x.png`), "conflict");
  assert.match(t.conflicts.get(`${DEV}/Icon-App-20x20@2x.png`), /Icon-App-20x20@2x\.png is missing/);
  assert.equal(t.state(`${DEV}/Icon-App-20x20@3x.png`), "created");
  const noSet = bundle("pristine-flutter-3.47");
  delete noSet[`${PROD}/Contents.json`];
  const u = run(noSet, [ios("dev")]);
  assert.deepEqual(u.changes().map((c) => [c.file, c.state]), [[`${DEV}/Contents.json`, "conflict"]]);
});

test("an environment Contents.json edited by hand is a conflict, and none of its images are written", () => {
  const first = run(bundle("pristine-flutter-3.47"), [ios("dev")]).files();
  const edited = { ...first, [`${DEV}/Contents.json`]: Buffer.from(`${first[`${DEV}/Contents.json`]}\n`) };
  const t = run(edited, [ios("dev")]);
  assert.deepEqual(t.changes().map((c) => [c.file, c.state]), [[`${DEV}/Contents.json`, "conflict"]]);
});

test("colour chunks travel into the badged icon, and a file that differs from the render only by them is still ours", () => {
  const iccp = { type: "iCCP", data: Buffer.concat([Buffer.from("Display P3\0\0", "latin1"), Buffer.from([0x78, 0x9c, 3, 0])]) };
  const files = bundle("pristine-flutter-3.47");
  files[`${PROD}/Icon-App-60x60@3x.png`] = withChunks(files[`${PROD}/Icon-App-60x60@3x.png`], [iccp]);
  files[`${MAIN}/mipmap-xxhdpi/ic_launcher.png`] = withChunks(files[`${MAIN}/mipmap-xxhdpi/ic_launcher.png`], [iccp]);
  const first = run(files, [ios("dev"), android("dev")]);
  for (const f of [`${DEV}/Icon-App-60x60@3x.png`, "android/app/src/dev/res/mipmap-xxhdpi/ic_launcher.png"]) {
    assert.deepEqual(decode(first.tree.readBytes(f)).chunks.map((c) => [c.type, c.data.toString("hex")]), [["iCCP", iccp.data.toString("hex")]], f);
  }
  const plain = first.files();
  plain[`${DEV}/Icon-App-60x60@3x.png`] = encode({ ...decode(plain[`${DEV}/Icon-App-60x60@3x.png`]), chunks: [] }, { alpha: false });
  const second = run(plain, [ios("dev")]);
  assert.equal(second.state(`${DEV}/Icon-App-60x60@3x.png`), "updated");
  assert.deepEqual(decode(second.tree.readBytes(`${DEV}/Icon-App-60x60@3x.png`)).chunks.map((c) => c.type), ["iCCP"]);
});

test("icons.android keeps the adaptive band in the safe zone, copies the adaptive XML, and leaves background and monochrome", () => {
  const files = bundle("pristine-flutter-3.47");
  const legacy = decode(files[`${MAIN}/mipmap-xxxhdpi/ic_launcher.png`]);
  const layer = (rgba) => encode({ width: 432, height: 432, rgba }, { alpha: true });
  const fg = new Uint8Array(432 * 432 * 4);
  for (let o = 0; o < fg.length; o += 4) fg.set([(o >> 2) % 251, 40, 90, (o >> 2) % 3 ? 0 : 255], o);
  const xml = '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@mipmap/ic_launcher_background"/>\n  <foreground android:drawable="@mipmap/ic_launcher_foreground"/>\n  <monochrome android:drawable="@mipmap/ic_launcher_monochrome"/>\n</adaptive-icon>\n';
  Object.assign(files, {
    [`${MAIN}/mipmap-xxxhdpi/ic_launcher_foreground.png`]: layer(fg),
    [`${MAIN}/mipmap-xxxhdpi/ic_launcher_background.png`]: layer(new Uint8Array(432 * 432 * 4).fill(200)),
    [`${MAIN}/mipmap-xxxhdpi/ic_launcher_monochrome.png`]: layer(new Uint8Array(432 * 432 * 4).fill(255)),
    [`${MAIN}/mipmap-anydpi-v26/ic_launcher.xml`]: xml,
  });
  const t = run(files, [android("staging")]);
  const out = (rel) => `android/app/src/staging/res/${rel}`;
  assert.equal(t.tree.read(out("mipmap-anydpi-v26/ic_launcher.xml")), xml);
  assert.equal(t.state(out("mipmap-xxxhdpi/ic_launcher_background.png")), null);
  assert.equal(t.state(out("mipmap-xxxhdpi/ic_launcher_monochrome.png")), null);
  const before = decode(files[`${MAIN}/mipmap-xxxhdpi/ic_launcher_foreground.png`]);
  const after = decode(t.tree.readBytes(out("mipmap-xxxhdpi/ic_launcher_foreground.png")));
  const safe = [(432 * 21) / 108, (432 * 87) / 108];
  let changed = 0;
  for (let y = 0; y < 432; y++) for (let x = 0; x < 432; x++) {
    const o = (y * 432 + x) * 4;
    if (before.rgba.subarray(o, o + 4).join() === after.rgba.subarray(o, o + 4).join()) continue;
    changed++;
    assert.ok(x >= safe[0] && x < safe[1] && y >= safe[0] && y < safe[1], `pixel ${x},${y} changed outside the 66/108 safe square`);
  }
  assert.ok(changed > 1000, "the band is painted");
  assert.equal(decode(t.tree.readBytes(out("mipmap-xxxhdpi/ic_launcher.png"))).width, legacy.width);
});

test("icons.android takes the layers' roles from the adaptive XML, and adds no second file for a resource the flavor draws", () => {
  const files = bundle("pristine-flutter-3.47");
  const layer = (rgba) => encode({ width: 432, height: 432, rgba }, { alpha: true });
  const fg = new Uint8Array(432 * 432 * 4);
  for (let o = 0; o < fg.length; o += 4) fg.set([(o >> 2) % 251, 40, 90, (o >> 2) % 3 ? 0 : 255], o);
  Object.assign(files, {
    [`${MAIN}/mipmap-anydpi-v26/ic_launcher.xml`]: '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@mipmap/ic_launcher_adaptive_back"/>\n  <foreground android:drawable="@mipmap/ic_launcher_adaptive_fore"/>\n</adaptive-icon>\n',
    [`${MAIN}/mipmap-xxxhdpi/ic_launcher_adaptive_fore.png`]: layer(fg),
    [`${MAIN}/mipmap-xxxhdpi/ic_launcher_adaptive_back.png`]: layer(new Uint8Array(432 * 432 * 4).fill(200)),
  });
  const t = run(files, [android("dev")]);
  const out = (rel) => `android/app/src/dev/res/${rel}`;
  assert.equal(t.state(out("mipmap-xxxhdpi/ic_launcher_adaptive_back.png")), null, "the background the XML names stays production's");
  const before = decode(files[`${MAIN}/mipmap-xxxhdpi/ic_launcher_adaptive_fore.png`]);
  const after = decode(t.tree.readBytes(out("mipmap-xxxhdpi/ic_launcher_adaptive_fore.png")));
  const safe = [(432 * 21) / 108, (432 * 87) / 108];
  let changed = 0;
  for (let y = 0; y < 432; y++) for (let x = 0; x < 432; x++) {
    const o = (y * 432 + x) * 4;
    if (before.rgba.subarray(o, o + 4).join() === after.rgba.subarray(o, o + 4).join()) continue;
    changed++;
    assert.ok(x >= safe[0] && x < safe[1] && y >= safe[0] && y < safe[1], `the foreground the XML names changed at ${x},${y}, outside the safe square`);
  }
  assert.ok(changed > 1000, "the band is painted on the foreground");
  const twin = { ...files, [out("mipmap-hdpi/ic_launcher.webp")]: files[`${MAIN}/mipmap-hdpi/ic_launcher.png`] };
  const u = run(twin, [{ ...android("dev"), args: { ...android("dev").args, regen: true } }]);
  assert.equal(u.state(out("mipmap-hdpi/ic_launcher.png")), "foreign", "even with regen, no ic_launcher.png beside the flavor's ic_launcher.webp");
  assert.match(u.foreign.get(out("mipmap-hdpi/ic_launcher.png")), /dev's own mipmap-hdpi\/ic_launcher\.webp draws this icon; remove it, then --set icons=regen rebadges it/);
  assert.equal(u.tree.readBytes(out("mipmap-hdpi/ic_launcher.png")), null);
});

test("icons.android refuses a webp icon and an app without src/main icons, and production is never badged", () => {
  const files = bundle("pristine-flutter-3.47");
  files[`${MAIN}/mipmap-hdpi/ic_launcher.webp`] = files[`${MAIN}/mipmap-hdpi/ic_launcher.png`];
  delete files[`${MAIN}/mipmap-hdpi/ic_launcher.png`];
  const t = run(files, [android("dev")]);
  assert.equal(t.state("android/app/src/dev/res/mipmap-hdpi/ic_launcher.webp"), "conflict");
  assert.equal(t.state("android/app/src/dev/res/mipmap-mdpi/ic_launcher.png"), "created");
  const none = Object.fromEntries(Object.entries(bundle("pristine-flutter-3.47")).filter(([f]) => !f.startsWith(`${MAIN}/mipmap`)));
  assert.deepEqual(run(none, [android("dev")]).changes().map((c) => c.state), ["conflict"]);
  assert.throws(() => run(bundle("pristine-flutter-3.47"), [{ id: "icons.ios:production", args: { env: "production", label: "PRD", color: "2E7D32" } }]), /never badged/);
  assert.throws(() => run(bundle("pristine-flutter-3.47"), [{ id: "icons.android:production", args: { env: "production", label: "PRD", color: "2E7D32" } }]), /never badged/);
});

test("memtree over a directory reports each path against its bytes before the flush", (t) => {
  const fs = require("node:fs");
  const os = require("node:os");
  const path = require("node:path");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flutter-envs-memtree-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  for (const [rel, bytes] of Object.entries(bundle("pristine-flutter-3.47"))) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), bytes);
  }
  const first = memtree(dir);
  apply(first.tree, [ios("dev")], { spec: { production: SHOP.production }, facts: { icons: I.read(memtree(bundle("pristine-flutter-3.47")).io) } });
  first.flush(dir);
  assert.deepEqual([...new Set(first.changes().map((c) => c.state))], ["created"]);
  assert.ok(fs.existsSync(path.join(dir, DEV, "Icon-App-1024x1024@1x.png")), "flush wrote the set");
  const second = memtree(dir);
  apply(second.tree, [ios("dev")], { spec: { production: SHOP.production }, facts: { icons: I.read(memtree(bundle("pristine-flutter-3.47")).io) } });
  second.flush(dir);
  assert.deepEqual([...new Set(second.changes().map((c) => c.state))], ["unchanged"]);
});
