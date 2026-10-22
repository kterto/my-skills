"use strict";
// The pbxproj writer. The read half on all four bundles: the parser agrees with plutil and the resolver follows the
// xcconfig chain. The write half on both pristine templates: every op applied twice gives the bytes of one
// application, removes only the lines it owns, adds no violation and passes plutil; quoting round-trips through the
// parser, plutil and xcodebuild; the validator refuses each injected fault; and `ops` reaches the engine's tree.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const P = require("../scripts/writers/pbxproj.cjs");
const apple = require("../scripts/writers/apple.cjs");
const { CONVENTIONS } = require("../scripts/lib/vocab.cjs");
const { createIO } = require("../scripts/lib/io.cjs");
const { bundle, materialize } = require("./helpers/project.cjs");
const { memtree, apply, SHOP, PHASE_SCRIPT, configsOf, iosEdits, lineDiff, hasTool, plutilLint } = require("./helpers/memtree.cjs");

const BUNDLES = ["pristine-flutter-3.47", "pristine-flutter-3.41-pods"];
const PBXPROJ = P.FILE;
const PHASE = { name: CONVENTIONS.deliveryPhase, script: PHASE_SCRIPT };
const configs = configsOf;
const byConfig = (spec, f) => Object.fromEntries(configs(spec).map((c) => [c.name, f(c)]));

// The eight pure ops in the planner's order, as the scratch suite ran them, with the display name already literal.
function pbxprojSteps(spec) {
  return [
    ["renamePlainConfigs", (t) => P.renamePlainConfigs(t, spec.production)],
    ["cloneConfigs", (t) => P.cloneConfigs(t, { from: spec.production, envs: spec.envs })],
    ["setTargetSettings", (t) => P.setTargetSettings(t, {
      target: "Runner",
      byConfig: byConfig(spec, ({ env }) => ({ PRODUCT_BUNDLE_IDENTIFIER: spec.ids[env], DISPLAY_NAME: P.literal(spec.names[env]), ASSETCATALOG_COMPILER_APPICON_NAME: CONVENTIONS.iosIconSet(env, spec.production) })),
    })],
    ["setRunnerTestsIds", (t) => P.setRunnerTestsIds(t, byConfig(spec, ({ env }) => `${spec.ids[env]}.RunnerTests`))],
    ["ensureXcconfigRefs", (t) => P.ensureXcconfigRefs(t, configs(spec).map((c) => `${c.name}.xcconfig`))],
    ["setBaseConfigs", (t) => P.setBaseConfigs(t, { target: "Runner", byConfig: byConfig(spec, (c) => `${c.name}.xcconfig`) })],
    ["upsertShellPhase", (t) => P.upsertShellPhase(t, { target: "Runner", name: PHASE.name, script: PHASE.script, after: "Resources", alwaysOutOfDate: true })],
    ["setDeploymentTarget", (t) => P.setDeploymentTarget(t, "15.0")],
  ];
}

// Runs the steps in order and returns every intermediate text, so a test can check each step on its own input.
function runSteps(text, steps) {
  const out = [{ step: "input", text }];
  for (const [step, op] of steps) out.push({ step, text: op(out[out.length - 1].text) });
  return out;
}

const ALL_BUNDLES = ["pristine-flutter-3.47", "pristine-flutter-3.41-pods", "configured-flutter-3.47", "configured-flutter-3.41-pods"];
const textOf = (b) => bundle(b)[P.FILE];
const read = (dir) => { const io = createIO(dir, { git: false }); return P.read(io, { xcconfigs: apple.read(io).xcconfigs }); };
const config = (facts, target, name) => facts.targets.find((t) => t.name === target).configs.find((c) => c.name === name);

test("every bundle's pbxproj parses, keeping offsets that point back at the text", () => {
  for (const b of ALL_BUNDLES) {
    const text = textOf(b);
    const m = P.model(text);
    assert.ok(m.byId.size > 30, `${b} has its objects`);
    for (const o of m.byId.values()) assert.strictEqual(text.slice(o.entry.keyStart, o.entry.keyStart + 24), o.id, `${b}: ${o.id} offset`);
  }
});

test("the parsed object graph equals plutil's", { skip: !hasTool("plutil") && "plutil not on PATH" }, () => {
  for (const b of ALL_BUNDLES) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pbx-"));
    const file = path.join(dir, "project.pbxproj");
    fs.writeFileSync(file, textOf(b));
    const r = cp.spawnSync("plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" });
    fs.rmSync(dir, { recursive: true, force: true });
    assert.strictEqual(r.status, 0, r.stderr);
    assert.deepStrictEqual(P.toJSON(P.parse(textOf(b))), JSON.parse(r.stdout), b);
  }
});

test("the resolver reads target settings first, then the base xcconfig chain, then the project", () => {
  const configured = read(materialize("configured-flutter-3.47", undefined, { git: false }));
  const dev = config(configured, "Runner", "Debug-dev");
  assert.strictEqual(dev.settings.PRODUCT_BUNDLE_IDENTIFIER.value, "com.acme.shop.dev");
  assert.match(dev.settings.PRODUCT_BUNDLE_IDENTIFIER.at, /^ios\/Runner\.xcodeproj\/project\.pbxproj:\d+$/);
  assert.strictEqual(dev.settings.IPHONEOS_DEPLOYMENT_TARGET.value, "15.0", "a project-level setting resolves for the target");
  const pods = read(materialize("configured-flutter-3.41-pods", (f) => {
    f["ios/Flutter/Debug-dev.xcconfig"] += "APP_ID = com.acme.shop\nDISPLAY_NAME = From Xcconfig\nPRODUCT_BUNDLE_IDENTIFIER = com.acme.loses\n";
    f[P.FILE] = f[P.FILE].replace(/(Debug-dev[\s\S]*?)DISPLAY_NAME = "Shop Dev";\n\s*/, "$1").replace(/(Debug-dev[\s\S]*?)PRODUCT_BUNDLE_IDENTIFIER = com\.acme\.shop\.dev;/, '$1PRODUCT_BUNDLE_IDENTIFIER = "$(APP_ID).dev";');
  }, { git: false }));
  const d = config(pods, "Runner", "Debug-dev");
  assert.strictEqual(d.base, "ios/Flutter/Debug-dev.xcconfig", "the base reference resolves through its group");
  assert.deepStrictEqual([d.settings.DISPLAY_NAME.value, d.settings.DISPLAY_NAME.at], ["From Xcconfig", "ios/Flutter/Debug-dev.xcconfig:4"]);
  assert.strictEqual(d.settings.PRODUCT_BUNDLE_IDENTIFIER.value, "com.acme.shop.dev", "the target's setting beats its xcconfig's, and $(APP_ID) expands through the chain");
});

test("the validator finds no fault in any bundle, and reports only what an edit adds", () => {
  for (const b of ALL_BUNDLES) assert.deepStrictEqual([...P.violations(textOf(b))], [], b);
  const text = textOf("configured-flutter-3.47");
  const m = P.model(text);
  const dev = [...m.byId.values()].find((o) => o.isa === "XCBuildConfiguration" && o.node.get("name").v === "Debug-dev");
  const dangling = text.slice(0, text.lastIndexOf("\n", dev.entry.keyStart) + 1) + text.slice(text.indexOf("\n", dev.entry.end) + 1);
  assert.ok(P.validate(text, dangling).some((v) => /^dangling id/.test(v)), "deleting a configuration object leaves a dangling id");
  const duplicate = text.replace('name = "Debug-dev";', 'name = "Debug-staging";');
  assert.ok(P.validate(text, duplicate).some((v) => /duplicate configuration /.test(v)), "a renamed duplicate is caught");
  assert.deepStrictEqual(P.validate(duplicate, duplicate.replace("IPHONEOS_DEPLOYMENT_TARGET = 15.0;", "IPHONEOS_DEPLOYMENT_TARGET = 16.0;")), [], "an edit on a file that already has a fault adds none");
});

test("a pbxproj that does not parse is reported, not thrown", () => {
  const dir = materialize("configured-flutter-3.47", (f) => { f[P.FILE] = f[P.FILE].slice(0, 5000); }, { git: false });
  const facts = read(dir);
  assert.match(facts.error, /^pbxproj: /);
  assert.deepStrictEqual(facts.targets, []);
});

const PLUTIL = hasTool("plutil");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pbxproj-test-"));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));

const pristine = Object.fromEntries(BUNDLES.map((b) => [b, bundle(b)[PBXPROJ]]));
const runFor = (b) => runSteps(pristine[b], pbxprojSteps(SHOP));
const textAfter = (b, step) => runFor(b).find((r) => r.step === step).text;
const textBefore = (b, step) => { const runs = runFor(b); return runs[runs.findIndex((r) => r.step === step) - 1].text; };

const listNames = (text) => {
  const m = P.model(text);
  return Object.fromEntries(m.lists("XCConfigurationList").map((l) => [l.id, P.configsOf(m, l.id).map((c) => c.name)]));
};
const targetConfig = (text, target, name) => {
  const m = P.model(text);
  const t = m.lists("PBXNativeTarget").find((x) => x.node.get("name").v === target);
  return P.configsOf(m, t.node.get("buildConfigurationList").v).find((c) => c.name === name);
};
const setting = (text, target, config, key) => {
  const c = targetConfig(text, target, config);
  const v = c && c.obj.node.get("buildSettings").get(key);
  return v && v.v;
};

// Which lines each step may remove, as a predicate over the removed line. Every step adds lines freely.
const MAY_REMOVE = {
  renamePlainConfigs: (l) => /\b(Debug|Profile|Release)\b/.test(l),
  cloneConfigs: () => false,
  setTargetSettings: (l) => /^\t+(PRODUCT_BUNDLE_IDENTIFIER|DISPLAY_NAME|ASSETCATALOG_COMPILER_APPICON_NAME) = /.test(l),
  setRunnerTestsIds: (l) => /^\t+PRODUCT_BUNDLE_IDENTIFIER = .*RunnerTests;$/.test(l),
  ensureXcconfigRefs: () => false,
  setBaseConfigs: (l) => /^\t+baseConfigurationReference = /.test(l),
  upsertShellPhase: () => false,
  setDeploymentTarget: (l) => /^\t+IPHONEOS_DEPLOYMENT_TARGET = /.test(l),
};

for (const b of BUNDLES) {
  test(`${b}: every op, applied twice, gives the bytes of one application`, () => {
    for (const r of runFor(b).slice(1)) {
      const op = pbxprojSteps(SHOP).find(([name]) => name === r.step)[1];
      assert.equal(op(r.text), r.text, `${r.step} changed its own output`);
    }
  });

  test(`${b}: the whole sequence rerun on its output changes nothing`, () => {
    const out = runFor(b).at(-1).text;
    assert.equal(runSteps(out, pbxprojSteps(SHOP)).at(-1).text, out);
  });

  test(`${b}: each op removes only the lines it owns`, () => {
    const runs = runFor(b);
    for (let k = 1; k < runs.length; k++) {
      const { removed } = lineDiff(runs[k - 1].text, runs[k].text);
      const foreign = removed.filter((l) => !MAY_REMOVE[runs[k].step](l));
      assert.deepEqual(foreign, [], `${runs[k].step} removed lines it does not own`);
    }
  });

  test(`${b}: no op adds a violation, and every output parses`, () => {
    const runs = runFor(b);
    for (let k = 1; k < runs.length; k++) assert.deepEqual(P.validate(runs[k - 1].text, runs[k].text), [], `${runs[k].step} added violations`);
    assert.equal(P.violations(runs.at(-1).text).size, 0);
  });

  test(`${b}: plutil -lint accepts the output of every op`, { skip: !PLUTIL && "plutil not on PATH" }, () => {
    for (const r of runFor(b).slice(1)) assert.ok(plutilLint(r.text, tmp).ok, `${r.step}: ${plutilLint(r.text, tmp).out}`);
  });

  test(`${b}: renamePlainConfigs renames every list, its comments and the default`, () => {
    const out = textAfter(b, "renamePlainConfigs");
    for (const names of Object.values(listNames(out))) assert.deepEqual([...names].sort(), ["Debug-production", "Profile-production", "Release-production"]);
    assert.equal((out.match(/defaultConfigurationName = "Release-production";/g) || []).length, 3);
    assert.doesNotMatch(out, /\/\* (Debug|Profile|Release) \*\//);
    assert.doesNotMatch(out, /defaultConfigurationName = Release;/);
  });

  test(`${b}: cloneConfigs gives every list nine configurations with ids derived from the list and the name`, () => {
    const out = textAfter(b, "cloneConfigs");
    const want = configs(SHOP).map((c) => c.name).sort();
    for (const [listId, names] of Object.entries(listNames(out))) {
      assert.deepEqual([...names].sort(), want);
      for (const name of ["Debug-dev", "Release-staging"]) assert.ok(out.includes(`${P.idFor(`${listId}:${name}`)} /* ${name} */ = {`), `${name} of ${listId} has its derived id`);
    }
  });

  test(`${b}: a clone carries its base's build settings and base xcconfig`, () => {
    const out = textAfter(b, "cloneConfigs");
    for (const target of ["Runner", "RunnerTests"]) {
      const base = targetConfig(out, target, "Release-production").obj.node;
      const clone = targetConfig(out, target, "Release-staging").obj.node;
      const flat = (n) => JSON.stringify(n.get("buildSettings").entries.map((e) => [e.key, e.v.v ?? e.v.items.map((i) => i.v)]));
      assert.equal(flat(clone), flat(base));
      assert.equal((clone.get("baseConfigurationReference") || {}).v, (base.get("baseConfigurationReference") || {}).v);
    }
  });

  test(`${b}: setTargetSettings and setRunnerTestsIds write each configuration's identity`, () => {
    const out = runFor(b).at(-1).text;
    for (const { name, env } of configs(SHOP)) {
      assert.equal(setting(out, "Runner", name, "PRODUCT_BUNDLE_IDENTIFIER"), SHOP.ids[env]);
      assert.equal(setting(out, "Runner", name, "DISPLAY_NAME"), SHOP.names[env]);
      assert.equal(setting(out, "Runner", name, "ASSETCATALOG_COMPILER_APPICON_NAME"), env === "production" ? "AppIcon" : `AppIcon-${env}`);
      assert.equal(setting(out, "RunnerTests", name, "PRODUCT_BUNDLE_IDENTIFIER"), `${SHOP.ids[env]}.RunnerTests`);
    }
  });

  test(`${b}: setBaseConfigs points Runner's configurations at references shaped like Debug.xcconfig's`, () => {
    const out = runFor(b).at(-1).text;
    const m = P.model(out);
    for (const { name } of configs(SHOP)) {
      const ref = m.byId.get(targetConfig(out, "Runner", name).obj.node.get("baseConfigurationReference").v);
      assert.equal(ref.node.get("path").v, `Flutter/${name}.xcconfig`);
      assert.equal(ref.node.get("name").v, `${name}.xcconfig`);
      assert.equal(ref.node.get("sourceTree").v, "<group>");
    }
    const flutter = m.lists("PBXGroup").find((g) => (g.node.get("name") || {}).v === "Flutter");
    const children = flutter.node.get("children").items.map((it) => m.byId.get(it.v).node.get("path").v);
    for (const { name } of configs(SHOP)) assert.ok(children.includes(`Flutter/${name}.xcconfig`));
  });

  test(`${b}: the resolver follows the new base xcconfig into its includes`, () => {
    const t = memtree({ ...bundle(b), [PBXPROJ]: runFor(b).at(-1).text, "ios/Flutter/Debug-dev.xcconfig": '#include "Generated.xcconfig"\n#include "Extra.xcconfig"\n', "ios/Flutter/Extra.xcconfig": "SHOP_FLAG = on\nSHOP_REF = $(DISPLAY_NAME)!\n" });
    const runner = P.read(t.io, { xcconfigs: apple.read(t.io).xcconfigs }).targets.find((x) => x.name === "Runner");
    const s = Object.fromEntries(Object.entries(runner.configs.find((c) => c.name === "Debug-dev").settings).map(([k, v]) => [k, v.value]));
    assert.equal(s.PRODUCT_BUNDLE_IDENTIFIER, "com.acme.shop.dev");
    assert.equal(s.PRODUCT_NAME, "Runner");
    assert.equal(s.SHOP_FLAG, "on");
    assert.equal(s.SHOP_REF, "Shop Dev!");
    assert.equal(s.IPHONEOS_DEPLOYMENT_TARGET, "15.0");
  });

  test(`${b}: upsertShellPhase puts one phase right after Resources with the script byte for byte`, () => {
    const out = runFor(b).at(-1).text;
    const m = P.model(out);
    const runner = m.lists("PBXNativeTarget").find((t) => t.node.get("name").v === "Runner");
    const phases = runner.node.get("buildPhases").items.map((it) => m.byId.get(it.v));
    const at = phases.findIndex((o) => o.node.get("name") && o.node.get("name").v === PHASE.name);
    assert.equal(phases[at - 1].isa, "PBXResourcesBuildPhase");
    assert.equal(phases.filter((o) => o.node.get("name") && o.node.get("name").v === PHASE.name).length, 1);
    assert.equal(phases[at].node.get("shellScript").v, PHASE.script);
    assert.equal(phases[at].node.get("alwaysOutOfDate").v, "1");
    assert.equal(phases[at].id, P.idFor(`phase:Runner:${PHASE.name}`));
  });
}

test("the 3.41.2 template is raised to iOS 15.0; 3.47.4 is already there and keeps its bytes", () => {
  const pods = "pristine-flutter-3.41-pods";
  assert.match(textBefore(pods, "setDeploymentTarget"), /IPHONEOS_DEPLOYMENT_TARGET = 13\.0;/);
  assert.doesNotMatch(textAfter(pods, "setDeploymentTarget"), /IPHONEOS_DEPLOYMENT_TARGET = 13\.0;/);
  const swiftpm = textBefore("pristine-flutter-3.47", "setDeploymentTarget");
  assert.equal(P.setDeploymentTarget(swiftpm, "15.0"), swiftpm);
});

test("setDeploymentTarget only raises", () => {
  const raised = textAfter("pristine-flutter-3.41-pods", "setDeploymentTarget");
  assert.equal(P.setDeploymentTarget(raised, "12.0"), raised);
  const count = (text, v) => (text.match(new RegExp(`IPHONEOS_DEPLOYMENT_TARGET = ${v.replace(".", "\\.")};`, "g")) || []).length;
  const total = count(raised, "15.0");
  assert.equal(total, 9, "three project configurations per environment");
  const sixteen = raised.replace("IPHONEOS_DEPLOYMENT_TARGET = 15.0;", "IPHONEOS_DEPLOYMENT_TARGET = 16.4;");
  const out = P.setDeploymentTarget(sixteen, "16.0");
  assert.equal(count(out, "16.4"), 1);
  assert.equal(count(out, "16.0"), total - 1);
});

test("renamePlainConfigs does nothing once any flavored configuration exists", () => {
  const text = pristine["pristine-flutter-3.47"];
  const withFlavor = P.cloneConfigs(text.replace("name = Profile;", 'name = "Profile-qa";'), { from: "qa", envs: [] });
  assert.equal(P.renamePlainConfigs(withFlavor, "production"), withFlavor);
});

test("cloneConfigs refuses an id that already belongs to another object", () => {
  const text = textAfter("pristine-flutter-3.47", "renamePlainConfigs");
  const listId = "97C147051CF9000F007C117D";
  const taken = text.replace("97C147061CF9000F007C117D /* Debug-production */,", `97C147061CF9000F007C117D /* Debug-production */,\n\t\t\t\t${P.idFor(`${listId}:Debug-dev`)} /* Debug-dev */,`).replace("/* End XCBuildConfiguration section */", `\t\t${P.idFor(`${listId}:Debug-dev`)} /* x */ = {isa = XCBuildConfiguration; buildSettings = {}; name = Other; };\n/* End XCBuildConfiguration section */`);
  assert.throws(() => P.cloneConfigs(taken, { from: "production", envs: ["dev"] }), /reuse object id/);
});

test("setTargetSettings keeps the bytes of a value that already holds, however it is quoted", () => {
  const text = textAfter("pristine-flutter-3.47", "renamePlainConfigs").replaceAll("PRODUCT_BUNDLE_IDENTIFIER = com.acme.shop;", 'PRODUCT_BUNDLE_IDENTIFIER = "com.acme.shop";');
  assert.equal(P.setTargetSettings(text, { target: "Runner", byConfig: { "Debug-production": { PRODUCT_BUNDLE_IDENTIFIER: "com.acme.shop" } } }), text);
});

test("setTargetSettings refuses a configuration the target lacks", () => {
  assert.throws(() => P.setTargetSettings(pristine["pristine-flutter-3.47"], { target: "Runner", byConfig: { "Debug-dev": { DISPLAY_NAME: "x" } } }), /has no configuration Debug-dev/);
  assert.throws(() => P.setTargetSettings(pristine["pristine-flutter-3.47"], { target: "Nope", byConfig: {} }), /no target named Nope/);
});

test("setRunnerTestsIds leaves a project without RunnerTests alone", () => {
  const m = P.model(pristine["pristine-flutter-3.47"]);
  const tests = m.lists("PBXNativeTarget").find((t) => t.node.get("name").v === "RunnerTests");
  const text = pristine["pristine-flutter-3.47"];
  const renamed = text.slice(0, tests.node.get("name").start) + "Other" + text.slice(tests.node.get("name").end);
  assert.equal(P.setRunnerTestsIds(renamed, { Debug: "com.acme.x" }), renamed);
});

test("setBaseConfigs refuses a file nobody referenced yet", () => {
  const text = textAfter("pristine-flutter-3.47", "cloneConfigs");
  assert.throws(() => P.setBaseConfigs(text, { target: "Runner", byConfig: { "Debug-dev": "Debug-dev.xcconfig" } }), /run ensureXcconfigRefs first/);
});

test("ensureXcconfigRefs adopts a reference Xcode made under another id", () => {
  const text = textAfter("pristine-flutter-3.47", "cloneConfigs");
  const xcode = text
    .replace("/* End PBXFileReference section */", '\t\tAAAAAAAAAAAAAAAAAAAAAAAA /* Debug-dev.xcconfig */ = {isa = PBXFileReference; lastKnownFileType = text.xcconfig; path = "Flutter/Debug-dev.xcconfig"; sourceTree = "<group>"; };\n/* End PBXFileReference section */')
    .replace("\t\t\t\t9740EEB31CF90195004384FC /* Generated.xcconfig */,\n", "\t\t\t\t9740EEB31CF90195004384FC /* Generated.xcconfig */,\n\t\t\t\tAAAAAAAAAAAAAAAAAAAAAAAA /* Debug-dev.xcconfig */,\n");
  const out = P.ensureXcconfigRefs(xcode, ["Debug-dev.xcconfig", "Release-dev.xcconfig"]);
  assert.equal((out.match(/Debug-dev\.xcconfig \*\/ = \{/g) || []).length, 1);
  assert.match(out, /Release-dev\.xcconfig \*\/ = \{/);
  const based = P.setBaseConfigs(out, { target: "Runner", byConfig: { "Debug-dev": "Debug-dev.xcconfig" } });
  assert.match(based, /baseConfigurationReference = AAAAAAAAAAAAAAAAAAAAAAAA \/\* Debug-dev\.xcconfig \*\/;/);
});

test("upsertShellPhase updates an existing phase in place and moves it after Resources", () => {
  const text = textAfter("pristine-flutter-3.47", "upsertShellPhase");
  const id = P.idFor(`phase:Runner:${PHASE.name}`);
  const stale = text.replace(P.quote(PHASE.script), P.quote("echo old\n"));
  const updated = P.upsertShellPhase(stale, { target: "Runner", name: PHASE.name, script: PHASE.script });
  assert.equal(updated, text);
  const line = `\t\t\t\t${id} /* ${PHASE.name} */,\n`;
  const early = text.replace(line, "").replace("\t\t\t\t9740EEB61CF901F6004384FC /* Run Script */,\n", `${line}\t\t\t\t9740EEB61CF901F6004384FC /* Run Script */,\n`);
  assert.notEqual(early, text);
  assert.equal(P.upsertShellPhase(early, { target: "Runner", name: PHASE.name, script: PHASE.script }), text);
  const off = P.upsertShellPhase(text, { target: "Runner", name: PHASE.name, script: PHASE.script, alwaysOutOfDate: false });
  assert.equal(lineDiff(text, off).removed.length, 1);
  assert.match(lineDiff(text, off).removed[0], /alwaysOutOfDate = 1;/);
});

test("upsertShellPhase refuses a target without the anchor phase", () => {
  assert.throws(() => P.upsertShellPhase(pristine["pristine-flutter-3.47"], { target: "Runner", name: "x", script: "true", after: "Headers" }), /has no Headers phase/);
});

const TRICKY = ["Shop", "Shop Dev", "com.acme.shop.dev", "Debug-dev", 'say "hi"', "back\\slash", "$(inherited)", "$DOLLAR", "a//b", "a___b", "", "tab\there", "line\nbreak", "Café Ünïcode", "semi;colon", "{braces}", "per%cent"];

test("quote leaves bare exactly what Xcode leaves bare", () => {
  const bare = TRICKY.filter((s) => P.quote(s) === s);
  assert.deepEqual(bare, ["Shop", "com.acme.shop.dev", "$DOLLAR"]);
  assert.equal(P.quote(""), '""');
  assert.equal(P.quote("Debug-dev"), '"Debug-dev"');
});

test("quote round-trips through the parser", () => {
  for (const s of TRICKY) assert.equal(P.parse(`{ k = ${P.quote(s)}; }`).get("k").v, s);
});

test("quote refuses control characters it cannot write", () => {
  assert.throws(() => P.quote("bell\u0007"), /control character/);
});

test("a quoted DISPLAY_NAME round-trips through plutil as well", { skip: !PLUTIL && "plutil not on PATH" }, () => {
  const base = textAfter("pristine-flutter-3.47", "cloneConfigs");
  for (const s of TRICKY) {
    const text = P.setTargetSettings(base, { target: "Runner", byConfig: { "Debug-dev": { DISPLAY_NAME: s } } });
    assert.equal(setting(text, "Runner", "Debug-dev", "DISPLAY_NAME"), s);
    const file = path.join(tmp, "q.pbxproj");
    fs.writeFileSync(file, text);
    const json = JSON.parse(cp.execFileSync("plutil", ["-convert", "json", "-o", "-", file], { encoding: "utf8" }));
    const id = targetConfig(text, "Runner", "Debug-dev").id;
    assert.equal(json.objects[id].buildSettings.DISPLAY_NAME, s, `plutil reads ${JSON.stringify(s)}`);
  }
});

test("xcodebuild reads a literal() display name back unchanged, and expands the bare one", { skip: !hasTool("xcodebuild") && "xcodebuild not on PATH" }, () => {
  const dir = fs.mkdtempSync(path.join(tmp, "xcb-"));
  // The CocoaPods template: a SwiftPM one cannot resolve its package before Flutter generates it.
  const files = bundle("pristine-flutter-3.41-pods");
  for (const rel of Object.keys(files).filter((p) => p.startsWith("ios/"))) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), files[rel]);
  }
  fs.writeFileSync(path.join(dir, "ios/Flutter/Generated.xcconfig"), "");
  const name = "Shop $5 $$ $(TARGET_NAME)";
  const read = (value) => {
    fs.writeFileSync(path.join(dir, PBXPROJ), P.setTargetSettings(pristine["pristine-flutter-3.41-pods"], { target: "Runner", byConfig: { Debug: { DISPLAY_NAME: value } } }));
    const out = cp.execFileSync("xcodebuild", ["-project", "ios/Runner.xcodeproj", "-target", "Runner", "-configuration", "Debug", "-showBuildSettings", "-json"], { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return JSON.parse(out.slice(out.indexOf("["))).find((e) => e.target === "Runner").buildSettings.DISPLAY_NAME;
  };
  assert.equal(read(P.literal(name)), name);
  assert.equal(read(name), "Shop $5 $ Runner");
});

const clean = () => runFor("pristine-flutter-3.47").at(-1).text;
const objectSpan = (text, id) => {
  const start = text.indexOf(`\t\t${id} `);
  return [start, text.indexOf("\n\t\t};\n", start) + "\n\t\t};\n".length];
};
const FAULTS = {
  "a configuration object deleted while its list keeps it": (t) => { const [a, b] = objectSpan(t, P.idFor("97C147051CF9000F007C117D:Debug-dev")); return t.slice(0, a) + t.slice(b); },
  "a configuration renamed to a duplicate": (t) => t.replace(new RegExp(`(${P.idFor("97C147051CF9000F007C117D:Debug-dev")} /\\* Debug-dev \\*/ = \\{[\\s\\S]*?name = )"Debug-dev";`), '$1"Debug-staging";'),
  "one list missing a configuration the others have": (t) => t.replace(`\t\t\t\t${P.idFor("97C147051CF9000F007C117D:Profile-staging")} /* Profile-staging */,\n`, ""),
  "a base reference to an object that does not exist": (t) => t.replace(/baseConfigurationReference = E0E5[0-9A-F]{20} \/\* Debug-dev\.xcconfig \*\/;/, "baseConfigurationReference = 0123456789ABCDEF01234567 /* gone */;"),
  "a phase list item pointing at nothing": (t) => t.replace(`${P.idFor(`phase:Runner:${PHASE.name}`)} /* ${PHASE.name} */,`, "FEDCBA9876543210FEDCBA98 /* gone */,"),
  "two objects under one id": (t) => t.replace("/* End PBXFileReference section */", '\t\t97C147021CF9000F007C117D /* twin */ = {isa = PBXFileReference; path = Twin.plist; sourceTree = "<group>"; };\n/* End PBXFileReference section */'),
  "a default configuration no list holds": (t) => t.replace('defaultConfigurationName = "Release-production";', 'defaultConfigurationName = "Release-qa";'),
  "text that no longer parses": (t) => t.replace("isa = PBXProject;", "isa = PBXProject"),
};

for (const [fault, inject] of Object.entries(FAULTS)) {
  test(`validate refuses ${fault}`, () => {
    const good = clean();
    const bad = inject(good);
    assert.notEqual(bad, good, "the fault was injected");
    assert.ok(P.validate(good, bad).length > 0, `no violation reported for ${fault}`);
  });

  test(`validate accepts an op on a file that already had ${fault}`, () => {
    const bad = inject(clean());
    if ([...P.violations(bad)].some((v) => v.startsWith("unparseable"))) return;
    const after = P.setTargetSettings(bad, { target: "Runner", byConfig: { "Release-production": { DISPLAY_NAME: "Shop 2" } } });
    assert.notEqual(after, bad);
    assert.deepEqual(P.validate(bad, after), []);
  });
}

test("validate accepts a clone that copies a dangling base reference the input already had", () => {
  const renamed = textAfter("pristine-flutter-3.47", "renamePlainConfigs");
  const [a, b] = objectSpan(renamed, "97C147071CF9000F007C117D");
  const broken = renamed.slice(0, a) + renamed.slice(a, b).replace("7AFA3C8E1D35360C0083082E /* Release.xcconfig */", "0123456789ABCDEF01234567 /* gone */") + renamed.slice(b);
  assert.notEqual(broken, renamed);
  assert.ok(P.violations(broken).has("dangling id 0123456789ABCDEF01234567"));
  const cloned = P.cloneConfigs(broken, { from: "production", envs: ["dev"] });
  assert.equal((cloned.match(/0123456789ABCDEF01234567/g) || []).length, 2, "the clone carries the reference");
  assert.deepEqual(P.validate(broken, cloned), []);
});

test("validate names what an op added and nothing the input already had", () => {
  const bad = FAULTS["a base reference to an object that does not exist"](clean());
  const worse = FAULTS["a configuration renamed to a duplicate"](bad);
  assert.deepEqual(P.validate(bad, worse).sort(), [
    "duplicate configuration Debug-staging in list 97C147051CF9000F007C117D",
    "target 97C146ED1CF9000F007C117D configurations differ from the project's",
  ]);
});

for (const b of BUNDLES) {
  test(`${b}: the six ops reach the engine's tree, equal the pure sequence, and a second run writes the same bytes`, () => {
    const edits = iosEdits(SHOP).filter((e) => e.id.startsWith("pbxproj."));
    assert.deepEqual(edits.map((e) => e.id), ["pbxproj.rename-plain", "pbxproj.clone-flavors", "pbxproj.set-settings", "pbxproj.base-xcconfigs", "pbxproj.shell-phase", "pbxproj.deployment-target"]);
    const first = memtree(bundle(b));
    apply(first.tree, edits, {});
    assert.deepEqual(first.changes().map((c) => [c.file, c.state]), [[PBXPROJ, "updated"]]);
    assert.equal(first.tree.read(PBXPROJ), runFor(b).at(-1).text);
    const second = memtree(first.files());
    apply(second.tree, edits, {});
    assert.deepEqual(second.changes().map((c) => [c.file, c.state]), [[PBXPROJ, "unchanged"]]);
  });
}

test("set-settings writes the display name through literal(), so a $ in it reaches the app", () => {
  const t = memtree(bundle("pristine-flutter-3.47"));
  apply(t.tree, [{ id: "pbxproj.rename-plain", args: { production: "production" } }, { id: "pbxproj.set-settings", args: { byConfig: { "Debug-production": { DISPLAY_NAME: "Shop $5" } } } }], {});
  assert.equal(setting(t.tree.read(PBXPROJ), "Runner", "Debug-production", "DISPLAY_NAME"), "Shop $$5");
  assert.equal(setting(t.tree.read(PBXPROJ), "RunnerTests", "Debug-production", "PRODUCT_BUNDLE_IDENTIFIER"), "com.acme.shop.RunnerTests", "no testsIds leaves RunnerTests alone");
});

test("deployment-target takes the vocabulary's whole number as well as a version string", () => {
  for (const min of [CONVENTIONS.firebaseMinIos, "15.0"]) {
    const t = memtree(bundle("pristine-flutter-3.41-pods"));
    apply(t.tree, [{ id: "pbxproj.deployment-target", args: { min } }], {});
    assert.doesNotMatch(t.tree.read(PBXPROJ), /IPHONEOS_DEPLOYMENT_TARGET = 13\.0;/);
    assert.equal((t.tree.read(PBXPROJ).match(/IPHONEOS_DEPLOYMENT_TARGET = 15\.0;/g) || []).length, 3, `min ${JSON.stringify(min)}`);
  }
});

test("an op whose splice would add a violation throws and stages nothing", () => {
  const text = pristine["pristine-flutter-3.47"];
  const m = P.model(text);
  const runner = m.lists("PBXNativeTarget").find((t) => t.node.get("name").v === "Runner");
  const release = P.configsOf(m, runner.node.get("buildConfigurationList").v).find((c) => c.name === "Release");
  const line = text.slice(text.lastIndexOf("\n", release.item.start) + 1, text.indexOf("\n", release.item.end) + 1);
  const broken = text.replace(line, "");
  assert.ok(P.violations(broken).size > 0, "the input already has its own fault");
  const t = memtree({ [PBXPROJ]: broken });
  assert.throws(() => apply(t.tree, [{ id: "pbxproj.rename-plain", args: { production: "production" } }], {}), /would add list [0-9A-F]{24} default Release-production names no configuration/);
  assert.equal(t.staged.size, 0);
});

test("the read half skips a configuration whose object is gone instead of throwing, as the ops do", () => {
  const text = clean();
  const m = P.model(text);
  const runner = m.lists("PBXNativeTarget").find((t) => t.node.get("name").v === "Runner");
  const gone = P.configsOf(m, runner.node.get("buildConfigurationList").v).find((c) => c.name === "Debug-dev");
  const [a, b] = objectSpan(text, gone.id);
  const broken = text.slice(0, a) + text.slice(b);
  assert.ok(P.violations(broken).has(`dangling id ${gone.id}`));
  const facts = P.read(memtree({ [PBXPROJ]: broken }).io, { xcconfigs: {} });
  assert.equal(facts.error, null);
  assert.deepEqual(facts.targets.find((x) => x.name === "Runner").configs.map((c) => c.name).sort(), configs(SHOP).map((c) => c.name).filter((n) => n !== "Debug-dev").sort());
});
