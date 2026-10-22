"use strict";
// Every finding code, detected on its own mutated project: the exact set of codes must match, so an extra code (a
// false positive) fails as surely as a missing one.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { CASES } = require("./fixtures/cases.cjs");
const { materialize } = require("./helpers/project.cjs");
const { checkProject } = require("../scripts/envs.cjs");

const codesOf = (ev) => [...new Set([...Object.values(ev.criteria).flatMap((c) => c.findings), ...ev.repo].map((f) => f.code))].sort();

for (const c of CASES) {
  test(`${c.code}: ${c.does}`, () => {
    const { ev } = checkProject(materialize(c.base, c.mutate, c.options));
    const got = codesOf(ev);
    const want = [...c.expect].sort();
    assert.deepStrictEqual(got, want, `missing ${JSON.stringify(want.filter((x) => !got.includes(x)))}, extra ${JSON.stringify(got.filter((x) => !want.includes(x)))}`);
  });
}

for (const base of ["configured-flutter-3.47", "configured-flutter-3.41-pods"]) {
  test(`${base} is the zero-finding base every case mutates`, () => {
    const { ev } = checkProject(materialize(base));
    assert.deepStrictEqual(codesOf(ev), []);
    assert.deepStrictEqual(Object.values(ev.criteria).map((c) => c.status), ["ok", "ok", "ok", "ok", "ok"]);
  });
}

// ok: no gap or defect. partial: one remains. absent: every facet the criterion reads is empty. n/a: it cannot apply.
// A note never moves a status.
test("each criterion reports the four statuses where they hold", () => {
  const statuses = (dir) => Object.fromEntries(Object.entries(checkProject(dir).ev.criteria).map(([k, v]) => [k, v.status]));
  assert.deepStrictEqual(statuses(materialize("pristine-flutter-3.47")), { ids: "absent", identity: "absent", banner: "absent", firebase: "n/a", envfiles: "absent" });
  assert.deepStrictEqual(statuses(materialize("configured-flutter-3.47")), { ids: "ok", identity: "ok", banner: "ok", firebase: "ok", envfiles: "ok" });
  const { drop } = require("./helpers/edit.cjs");
  const gap = materialize("configured-flutter-3.47", (f) => { drop(f, "ios/Runner.xcodeproj/xcshareddata/xcschemes/staging.xcscheme"); drop(f, "env/staging.json"); });
  assert.deepStrictEqual(statuses(gap), { ids: "partial", identity: "ok", banner: "ok", firebase: "ok", envfiles: "partial" });
  const note = materialize("configured-flutter-3.47", (f) => { f[".env.dev"] = "NAME=DEV\n"; });
  assert.deepStrictEqual(codesOf(checkProject(note).ev), ["envfiles.legacy-dotenv"]);
  assert.strictEqual(statuses(note).envfiles, "ok", "a note leaves the status ok");
});

// Every finding an edit claims (same code, environment and edit) is gone after apply on its own case. A case that
// mutates a file the skill owns (a managed block, or a new file such as a scheme or a base xcconfig) reads as a hand
// edit, which apply refuses as a conflict: only the files the case changed, each left byte for byte, and each claimed
// finding either gone or left over with that reason. Every edit code must be claimed on its own case, so a code that
// stops being claimed fails.
const { FINDINGS } = require("../scripts/lib/vocab.cjs");
const { applyProject, evaluateProject } = require("../scripts/envs.cjs");
const { bundle } = require("./helpers/project.cjs");

const all = (ev) => [...Object.values(ev.criteria).flatMap((x) => x.findings), ...ev.repo];
const keyOf = (f) => `${f.code}|${f.env || ""}|${f.ref || ""}`;
// The paths a case's mutation adds, removes or changes.
function mutated(c) {
  const before = bundle(c.base);
  const after = bundle(c.base);
  c.mutate(after);
  const same = (a, b) => a !== undefined && b !== undefined && a !== null && b !== null && Buffer.from(a).equals(Buffer.from(b));
  return new Set([...new Set([...Object.keys(before), ...Object.keys(after)])].filter((k) => !same(before[k], after[k])));
}

for (const c of CASES.filter((x) => FINDINGS[x.code].fix === "edit")) {
  test(`${c.code}: gone after apply`, (t) => {
    const dir = materialize(c.base, c.mutate, c.options);
    const sets = c.base.startsWith("pristine") ? ["prodId=com.acme.shop"] : [];
    const before = evaluateProject(dir, sets);
    const open = all(before.ev).filter((f) => f.code === c.code);
    const claimed = open.filter((f) => !f.blocked && before.edits.some((e) => `${e.writer}.${e.op}` === f.ref && e.fixes.includes(f.code)));
    assert.ok(claimed.length, `an edit claims ${c.code} on its own case (open: ${JSON.stringify(open.map((f) => [f.ref, f.blocked || ""]))})`);
    const r = applyProject(dir, { sets, now: "20261021T000000Z", allowDirty: true });
    const conflicts = r.receipt ? r.receipt.changes.filter((ch) => ch.state === "conflict") : [];
    if (r.code === 1 && conflicts.length && !r.receipt.broken) {
      const changed = mutated(c);
      for (const ch of conflicts) {
        assert.ok(changed.has(ch.file), `${ch.file} is a conflict, but the case did not change it`);
        assert.strictEqual(ch.before, ch.after, `${ch.file} is left byte for byte`);
      }
      const after = new Set(all(checkProject(dir).ev).map(keyOf));
      for (const f of claimed) {
        const left = r.receipt.leftovers.find((l) => keyOf(l) === keyOf(f));
        assert.ok(!after.has(keyOf(f)) || (left && left.pending === "conflict"), `${keyOf(f)} is either gone or left over as a conflict`);
      }
      return t.diagnostic(`the case edits a file the skill owns, so apply refuses it: ${conflicts.map((ch) => ch.file).join(", ")}`);
    }
    assert.strictEqual(r.code, 0, r.error || JSON.stringify(r.receipt && r.receipt.broken));
    const after = new Set(all(checkProject(dir).ev).map(keyOf));
    for (const f of claimed) assert.ok(!after.has(keyOf(f)), `${keyOf(f)} is still reported`);
  });
}

// CocoaPods writes a Pods-Runner xcconfig for every key of the Podfile map as well as every Runner configuration, so a
// plain include resolves while the map keeps that plain key (the reference history's state before its flavored map).
test("a plain Pods include counts while the Podfile map keeps that plain key", () => {
  const { replace } = require("./helpers/edit.cjs");
  const plainInclude = (f) => { f["ios/Flutter/Debug-staging.xcconfig"] = '#include "Debug.xcconfig"\n'; };
  const without = codesOf(checkProject(materialize("configured-flutter-3.41-pods", plainInclude)).ev);
  const withKey = codesOf(checkProject(materialize("configured-flutter-3.41-pods", (f) => { plainInclude(f); replace(f, "ios/Podfile", "  'Debug-staging' => :debug,\n", "  'Debug-staging' => :debug,\n  'Debug' => :debug,\n"); })).ev);
  assert.ok(without.includes("ids.ios.pods-xcconfig-missing"), "no plain map key: the include resolves to nothing");
  assert.ok(!withKey.includes("ids.ios.pods-xcconfig-missing"), `a plain map key: the include resolves (got ${JSON.stringify(withKey)})`);
});

// Gradle merges launcher icons one resource at a time, whatever the extension, and an adaptive icon draws the layers
// its XML names: a flavor shows production's icon where it lacks one of those, and nowhere else.
test("launcher icons compare by resource, and only the layers a flavor's adaptive icon draws count", () => {
  const MAIN = "android/app/src/main/res";
  const DENSITIES = ["hdpi", "mdpi", "xhdpi", "xxhdpi", "xxxhdpi"];
  const xml = (fg, bg) => `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@mipmap/${bg}"/>\n  <foreground android:drawable="@mipmap/${fg}"/>\n</adaptive-icon>\n`;
  const iconSame = (mutate) => checkProject(materialize("configured-flutter-3.47", mutate)).ev.criteria.identity.findings.filter((f) => f.code === "identity.icon-same").map((f) => [f.env, f.claim]);
  assert.deepStrictEqual(iconSame((f) => { for (const d of DENSITIES) { f[`android/app/src/dev/res/mipmap-${d}/ic_launcher.webp`] = f[`android/app/src/dev/res/mipmap-${d}/ic_launcher.png`]; delete f[`android/app/src/dev/res/mipmap-${d}/ic_launcher.png`]; } }), [], "dev's ic_launcher.webp replaces main's ic_launcher.png");
  const adaptive = (f) => {
    f[`${MAIN}/mipmap-anydpi-v26/ic_launcher.xml`] = xml("ic_launcher_adaptive_fore", "ic_launcher_adaptive_back");
    for (const d of DENSITIES) for (const layer of ["fore", "back"]) f[`${MAIN}/mipmap-${d}/ic_launcher_adaptive_${layer}.png`] = f[`${MAIN}/mipmap-${d}/ic_launcher.png`];
  };
  const inherited = iconSame(adaptive);
  assert.deepStrictEqual(inherited.map(([env]) => env), ["dev", "staging"], "with no adaptive icon of their own, both show main's foreground");
  assert.match(inherited[0][1], /^dev lacks mipmap-hdpi\/ic_launcher_adaptive_fore\.png/);
  assert.ok(inherited.every(([, claim]) => !/adaptive_back/.test(claim)), "a background layer stays production's by design");
  const ownAdaptive = (f) => {
    adaptive(f);
    f["android/app/src/dev/res/mipmap-anydpi-v26/ic_launcher.xml"] = xml("ic_launcher_dev_fore", "ic_launcher_adaptive_back");
    for (const d of DENSITIES) f[`android/app/src/dev/res/mipmap-${d}/ic_launcher_dev_fore.png`] = f[`android/app/src/dev/res/mipmap-${d}/ic_launcher.png`];
  };
  assert.deepStrictEqual(iconSame(ownAdaptive).map(([env]) => env), ["staging"], "dev's own adaptive icon draws its own foreground");
});

// An unpinned topStart banner is only a note until the app declares a right-to-left locale, where it moves for real.
test("an unpinned banner reads banner.corner once the app declares a right-to-left locale, by ARB file or supportedLocales", () => {
  const { replace } = require("./helpers/edit.cjs");
  const unpin = (f) => replace(f, "lib/env/env_banner.dart", /^ *layoutDirection: TextDirection\.ltr,\n/gm, "");
  const codes = (more) => codesOf(checkProject(materialize("configured-flutter-3.47", (f) => { unpin(f); more(f); })).ev);
  assert.deepStrictEqual(codes((f) => { f["lib/l10n/app_ar.arb"] = '{"@@locale": "ar"}\n'; }), ["banner.corner"]);
  assert.deepStrictEqual(codes((f) => { f["l10n.yaml"] = "arb-dir: i18n\n"; f["i18n/intl_he_IL.arb"] = '{"@@locale": "he_IL"}\n'; }), ["banner.corner"]);
  assert.deepStrictEqual(codes((f) => replace(f, "lib/main.dart", "return MaterialApp(\n", "return MaterialApp(\n      supportedLocales: const [Locale('en'), Locale('fa')],\n")), ["banner.corner"]);
  assert.deepStrictEqual(codes((f) => { f["lib/l10n/app_pt.arb"] = '{"@@locale": "pt"}\n'; f["lib/l10n/app_dvorak.arb"] = "{}\n"; }), ["banner.corner-unpinned"], "pt is left-to-right, and a name that only starts with dv is no locale");
});

// firebase.min-platform names the edit that raises it: a Runner configuration's target first, else the Podfile's
// platform alone. Apply raises whichever is low, a second apply finds nothing to do, and the edit that is not needed
// stays out of the plan.
test("firebase.min-platform names the edit that raises it, and apply raises a target, the Podfile, or both", () => {
  const { replace, PBX } = require("./helpers/edit.cjs");
  const lowPod = (f) => replace(f, "ios/Podfile", "platform :ios, '15.0'", "platform :ios, '13.0'");
  const lowTargets = (f) => replace(f, PBX, "IPHONEOS_DEPLOYMENT_TARGET = 15.0;", "IPHONEOS_DEPLOYMENT_TARGET = 13.0;", { all: true });
  const open = (dir) => all(checkProject(dir).ev).filter((f) => f.code === "firebase.min-platform");
  const raisers = (dir) => evaluateProject(dir, []).edits.filter((e) => e.fixes.includes("firebase.min-platform")).map((e) => `${e.writer}.${e.op}`);
  assert.strictEqual(FINDINGS["firebase.min-platform"].fix, "edit", "an edit raises it, so the gone-after-apply loop covers its case");
  const rows = [
    ["the Podfile alone", lowPod, "apple.podfile-platform", ["apple.podfile-platform"]],
    ["the targets alone", lowTargets, "pbxproj.deployment-target", ["pbxproj.deployment-target", "apple.podfile-platform"]],
    ["the targets and the Podfile", (f) => { lowPod(f); lowTargets(f); }, "pbxproj.deployment-target", ["pbxproj.deployment-target", "apple.podfile-platform"]],
  ];
  for (const [does, mutate, ref, edits] of rows) {
    const dir = materialize("configured-flutter-3.41-pods", mutate);
    assert.deepStrictEqual(open(dir).map((f) => f.ref), [ref], `${does}: the finding names its edit`);
    assert.deepStrictEqual(raisers(dir), edits, `${does}: the edits that list it`);
    const r = applyProject(dir, { sets: [], now: "20261021T000000Z" });
    assert.strictEqual(r.code, 0, `${does}: ${r.error || JSON.stringify(r.receipt && r.receipt.broken)}`);
    assert.deepStrictEqual(open(dir), [], `${does}: gone after apply`);
    assert.match(fs.readFileSync(path.join(dir, "ios/Podfile"), "utf8"), /^platform :ios, '15\.0'$/m, `${does}: the Podfile reads 15.0`);
    assert.doesNotMatch(fs.readFileSync(path.join(dir, PBX), "utf8"), /IPHONEOS_DEPLOYMENT_TARGET = 1[0-4]\./, `${does}: no target is below 15`);
    const again = applyProject(dir, { sets: [], now: "20261021T000000Z", allowDirty: true });
    assert.deepStrictEqual(again.receipt.changes.filter((c) => c.state !== "unchanged"), [], `${does}: a second apply changes nothing`);
  }
});

// An adaptive foreground that is a vector drawable has no PNG for the badge to draw, so a flavor shows production's
// foreground on Android 8 and later unless it draws its own: through its own drawable of that name, or through an
// adaptive XML of its own that names another foreground. The first apply copies main's adaptive XML into the flavor,
// which changes nothing about that.
test("a vector adaptive foreground counts as a layer the flavor lacks, unless the flavor draws its own", () => {
  const MAIN = "android/app/src/main/res";
  const adaptive = (fg) => `<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n  <background android:drawable="@color/ic_launcher_background"/>\n  <foreground android:drawable="@drawable/${fg}"/>\n</adaptive-icon>\n`;
  const vector = (shade) => `<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108"><path android:fillColor="#${shade}" android:pathData="M30,30h48v48h-48z"/></vector>\n`;
  const res = (env) => `android/app/src/${env}/res`;
  const iconSame = (mutate) => checkProject(materialize("configured-flutter-3.47", (f) => {
    f[`${MAIN}/mipmap-anydpi-v26/ic_launcher.xml`] = adaptive("ic_launcher_foreground");
    f[`${MAIN}/drawable/ic_launcher_foreground.xml`] = vector("FFFFFF");
    mutate(f);
  })).ev.criteria.identity.findings.filter((x) => x.code === "identity.icon-same");
  const envs = (found) => found.map((x) => x.env);

  const bare = iconSame(() => {});
  assert.deepStrictEqual(envs(bare), ["dev", "staging"], "badged legacy icons do not make up for a foreground the flavor lacks");
  assert.match(bare[0].claim, /dev draws no foreground of its own for ic_launcher_foreground, a vector the badge cannot draw/);
  assert.deepStrictEqual(envs(iconSame((f) => { for (const e of ["dev", "staging"]) f[`${res(e)}/mipmap-anydpi-v26/ic_launcher.xml`] = adaptive("ic_launcher_foreground"); })), ["dev", "staging"], "main's adaptive XML copied into the flavor still draws main's foreground");
  assert.deepStrictEqual(envs(iconSame((f) => { f[`${res("dev")}/drawable/ic_launcher_foreground.xml`] = vector("00FF00"); })), ["staging"], "a drawable of the same name in the flavor is its own foreground");
  assert.deepStrictEqual(envs(iconSame((f) => { f[`${res("dev")}/mipmap-anydpi-v26/ic_launcher.xml`] = adaptive("ic_launcher_dev_fore"); f[`${res("dev")}/drawable/ic_launcher_dev_fore.xml`] = vector("00FF00"); })), ["staging"], "an adaptive XML of its own that names another foreground");
  const raster = iconSame((f) => { delete f[`${MAIN}/drawable/ic_launcher_foreground.xml`]; for (const d of ["hdpi", "mdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) f[`${MAIN}/mipmap-${d}/ic_launcher_foreground.png`] = f[`${MAIN}/mipmap-${d}/ic_launcher.png`]; });
  assert.ok(raster.every((x) => !/a vector the badge cannot draw/.test(x.claim)), "a foreground with a PNG in main is the PNG rule's, not the vector rule's");
});
