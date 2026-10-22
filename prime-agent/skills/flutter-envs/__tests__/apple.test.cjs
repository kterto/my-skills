"use strict";
// The apple writer's write half on both pristine templates: scheme clones keep every byte but the five configuration
// names, the scheme plan writes, keeps and refuses as the new-file class says, the base xcconfigs drop the plain Pods
// include, the Podfile map replaces only the template's own statement, Info.plist changes one value, and each op
// reaches the engine's tree with its conflicts left untouched.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const cp = require("node:child_process");
const A = require("../scripts/writers/apple.cjs");
const { CONVENTIONS } = require("../scripts/lib/vocab.cjs");
const { readBlock } = require("../scripts/lib/managed.cjs");
const { bundle } = require("./helpers/project.cjs");
const { memtree, apply, SHOP, configsOf, iosEdits, lineDiff, hasTool } = require("./helpers/memtree.cjs");

const BUNDLES = ["pristine-flutter-3.47", "pristine-flutter-3.41-pods"];
const SCHEMES = "ios/Runner.xcodeproj/xcshareddata/xcschemes";
const configs = configsOf;
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apple-test-"));
test.after(() => fs.rmSync(tmp, { recursive: true, force: true }));
const bundles = Object.fromEntries(BUNDLES.map((b) => [b, bundle(b)]));
const runnerScheme = (b) => bundles[b][`${SCHEMES}/Runner.xcscheme`];
const attr = (xml, tag) => new RegExp(`<${tag}\\b[^>]*?buildConfiguration\\s*=\\s*"([^"]*)"`).exec(xml)[1];

for (const b of BUNDLES) {
  test(`${b}: cloneScheme points each action at its environment's configuration and changes nothing else`, () => {
    const xml = runnerScheme(b);
    const out = A.cloneScheme(xml, "dev");
    assert.deepEqual(["TestAction", "LaunchAction", "AnalyzeAction", "ProfileAction", "ArchiveAction"].map((t) => attr(out, t)), ["Debug-dev", "Debug-dev", "Debug-dev", "Profile-dev", "Release-dev"]);
    const { removed, added } = lineDiff(xml, out);
    assert.equal(removed.length, 5);
    assert.deepEqual(added, removed.map((l) => l.replace(/"(Debug|Profile|Release)"/, '"$1-dev"')));
  });

  test(`${b}: cloneScheme keeps the RunnerTests testable and is well-formed XML`, { skip: !hasTool("xmllint") && "xmllint not on PATH" }, () => {
    const out = A.cloneScheme(runnerScheme(b), "staging");
    assert.match(out, /<TestableReference[\s\S]*?BlueprintName = "RunnerTests"[\s\S]*?<\/TestableReference>/);
    const file = path.join(tmp, `${b}.xcscheme`);
    fs.writeFileSync(file, out);
    assert.equal(cp.spawnSync("xmllint", ["--noout", file]).status, 0);
  });
}

test("cloneScheme keeps the SwiftPM pre-action of the 3.47.4 template byte for byte", () => {
  const xml = runnerScheme("pristine-flutter-3.47");
  const pre = /<PreActions>[\s\S]*?<\/PreActions>/.exec(xml)[0];
  assert.match(pre, /title = "Run Prepare Flutter Framework Script"/);
  assert.match(pre, /xcode_backend\.sh&quot; prepare/);
  assert.ok(A.cloneScheme(xml, "dev").includes(pre));
});

test("cloneScheme refuses a scheme whose action names no configuration", () => {
  const xml = runnerScheme("pristine-flutter-3.47").replace('<ArchiveAction\n      buildConfiguration = "Release"', "<ArchiveAction");
  assert.throws(() => A.cloneScheme(xml, "dev"), /<ArchiveAction> has no buildConfiguration/);
});

test("planSchemes makes the production scheme from Runner, clones the rest, and removes Runner last", () => {
  const schemes = { "Runner.xcscheme": runnerScheme("pristine-flutter-3.47") };
  const plan = A.planSchemes({ schemes, envs: SHOP.envs, production: SHOP.production });
  assert.deepEqual(plan.write.map((w) => [w.file, w.state]), [["production.xcscheme", "created"], ["dev.xcscheme", "created"], ["staging.xcscheme", "created"]]);
  assert.equal(attr(plan.write[0].text, "ArchiveAction"), "Release-production");
  assert.deepEqual(plan.remove, ["Runner.xcscheme"]);
});

test("planSchemes on its own result writes nothing and removes nothing", () => {
  const first = A.planSchemes({ schemes: { "Runner.xcscheme": runnerScheme("pristine-flutter-3.47") }, envs: SHOP.envs, production: SHOP.production });
  const after = Object.fromEntries(first.write.map((w) => [w.file, w.text]));
  const again = A.planSchemes({ schemes: after, envs: SHOP.envs, production: SHOP.production });
  assert.deepEqual(again.write.map((w) => w.state), ["unchanged", "unchanged", "unchanged"]);
  assert.deepEqual(again.remove, []);
});

test("planSchemes reports a hand-edited scheme as a conflict and then keeps Runner", () => {
  const runner = runnerScheme("pristine-flutter-3.41-pods");
  const edited = A.cloneScheme(runner, "dev").replace('allowLocationSimulation = "YES"', 'allowLocationSimulation = "NO"');
  const plan = A.planSchemes({ schemes: { "Runner.xcscheme": runner, "dev.xcscheme": edited }, envs: SHOP.envs, production: SHOP.production });
  assert.equal(plan.write.find((w) => w.file === "dev.xcscheme").state, "conflict");
  assert.deepEqual(plan.remove, []);
});

test("planSchemes refuses when there is no scheme to clone", () => {
  assert.throws(() => A.planSchemes({ schemes: {}, envs: SHOP.envs, production: SHOP.production }), /neither Runner\.xcscheme nor production\.xcscheme/);
});

test("renderModeXcconfig for a SwiftPM template: the flavored Pods include, then Generated", () => {
  const debug = bundles["pristine-flutter-3.47"]["ios/Flutter/Debug.xcconfig"];
  assert.equal(A.renderModeXcconfig({ mode: "Debug", env: "dev", extraIncludes: A.xcconfigIncludes(debug) }), '#include? "Pods/Target Support Files/Pods-Runner/Pods-Runner.debug-dev.xcconfig"\n#include "Generated.xcconfig"\n');
});

test("renderModeXcconfig drops the template plain Pods include and keeps its other includes", () => {
  const release = bundles["pristine-flutter-3.41-pods"]["ios/Flutter/Release.xcconfig"];
  assert.match(release, /Pods-Runner\.release\.xcconfig/);
  const out = A.renderModeXcconfig({ mode: "Profile", env: "staging", extraIncludes: [...A.xcconfigIncludes(release), '#include "Shared.xcconfig"'] });
  assert.equal(out, '#include? "Pods/Target Support Files/Pods-Runner/Pods-Runner.profile-staging.xcconfig"\n#include "Generated.xcconfig"\n#include "Shared.xcconfig"\n');
});

test("renderModeXcconfig given its own output renders the same text", () => {
  for (const { mode, env } of configs(SHOP)) {
    const once = A.renderModeXcconfig({ mode, env, extraIncludes: ['#include "Shared.xcconfig"'] });
    assert.equal(A.renderModeXcconfig({ mode, env, extraIncludes: A.xcconfigIncludes(once) }), once);
  }
});

test("MODE_XCCONFIG names the template file each mode was based on", () => {
  assert.deepEqual(A.MODE_XCCONFIG, { Debug: "Debug.xcconfig", Profile: "Release.xcconfig", Release: "Release.xcconfig" });
});

const podfile = bundles["pristine-flutter-3.41-pods"]["ios/Podfile"];
const configNames = configs(SHOP).map((c) => c.name);
const place = (text, block) => { const { text: rest, at } = A.podfileMapAnchor(text); return at < 0 ? null : rest.slice(0, at) + block + rest.slice(at); };

test("podKinds maps Debug to :debug and Profile and Release to :release, and podfileMapBlock keeps the order given", () => {
  assert.deepEqual(A.podKinds(["Debug-dev", "Profile-dev", "Release-dev"]), { "Debug-dev": "debug", "Profile-dev": "release", "Release-dev": "release" });
  assert.equal(A.podfileMapBlock(A.podKinds(["Debug-dev", "Profile-dev", "Release-dev"])), "project 'Runner', {\n  'Debug-dev' => :debug,\n  'Profile-dev' => :release,\n  'Release-dev' => :release,\n}\n");
  assert.throws(() => A.podKinds(["Beta-dev"]), /names no build mode/);
});

test("podfileMapAnchor replaces the template's own statement in place", () => {
  const block = A.podfileMapBlock(A.podKinds(configNames));
  const out = place(podfile, block);
  assert.equal((out.match(/^project 'Runner'/gm) || []).length, 1);
  assert.doesNotMatch(out, /'Debug' => :debug/);
  assert.equal(out.indexOf(block), podfile.indexOf("project 'Runner', {"));
  assert.ok(out.indexOf(block) < out.indexOf("def flutter_root"));
});

test("podfileMapAnchor puts the map before target Runner when there is no statement", () => {
  const bare = podfile.replace(/^project 'Runner', \{[^}]*\}\n/m, "");
  const out = place(bare, A.podfileMapBlock(A.podKinds(configNames)));
  assert.ok(out.indexOf("project 'Runner'") < out.indexOf("target 'Runner' do"));
});

test("podfileMapAnchor leaves an owner's own map alone", () => {
  const owned = podfile.replace("'Debug' => :debug,", "'Debug' => :debug,\n  'Beta' => :release,");
  assert.deepEqual(A.podfileMapAnchor(owned), { text: owned, at: -1 });
  const placed = place(podfile, A.podfileMapBlock(A.podKinds(configNames)));
  assert.equal(A.podfileMapAnchor(placed).at, -1, "a placed map is never placed again");
});

test("the placed Podfile is valid Ruby", { skip: !hasTool("ruby") && "ruby not on PATH" }, () => {
  const file = path.join(tmp, "Podfile");
  fs.writeFileSync(file, place(podfile, `# flutter-envs:begin podfile-map sha=00000000\n${A.podfileMapBlock(A.podKinds(configNames))}# flutter-envs:end podfile-map\n`));
  const r = cp.spawnSync("ruby", ["-c", file], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
});

const plist = bundles["pristine-flutter-3.47"]["ios/Runner/Info.plist"];

test("setInfoPlistDisplayName rewrites only the CFBundleDisplayName value", () => {
  const out = A.setInfoPlistDisplayName(plist, "DISPLAY_NAME");
  assert.deepEqual(lineDiff(plist, out), { removed: ["\t<string>Shop</string>"], added: ["\t<string>$(DISPLAY_NAME)</string>"] });
  assert.equal(A.setInfoPlistDisplayName(out, "DISPLAY_NAME"), out);
});

test("setInfoPlistDisplayName adds the key in sorted position when it is missing", () => {
  const without = plist.replace("\t<key>CFBundleDisplayName</key>\n\t<string>Shop</string>\n", "");
  const out = A.setInfoPlistDisplayName(without, "DISPLAY_NAME");
  assert.ok(out.includes("\t<key>CFBundleDevelopmentRegion</key>\n\t<string>$(DEVELOPMENT_LANGUAGE)</string>\n\t<key>CFBundleDisplayName</key>\n\t<string>$(DISPLAY_NAME)</string>\n\t<key>CFBundleExecutable</key>"));
});

test("setInfoPlistDisplayName ignores a nested CFBundleDisplayName and edits the root one", () => {
  const nested = plist.replace("<key>UISceneConfigurationName</key>", "<key>CFBundleDisplayName</key>\n\t\t\t\t\t<string>Nested</string>\n\t\t\t\t\t<key>UISceneConfigurationName</key>");
  const out = A.setInfoPlistDisplayName(nested, "DISPLAY_NAME");
  assert.match(out, /<string>Nested<\/string>/);
  assert.match(out, /<key>CFBundleDisplayName<\/key>\n\t<string>\$\(DISPLAY_NAME\)<\/string>/);
});

test("setInfoPlistDisplayName adds a root key when the only CFBundleDisplayName is nested", () => {
  const onlyNested = plist
    .replace("\t<key>CFBundleDisplayName</key>\n\t<string>Shop</string>\n", "")
    .replace("<key>UISceneConfigurationName</key>", "<key>CFBundleDisplayName</key>\n\t\t\t\t\t<string>Nested</string>\n\t\t\t\t\t<key>UISceneConfigurationName</key>");
  const out = A.setInfoPlistDisplayName(onlyNested, "DISPLAY_NAME");
  assert.match(out, /<key>CFBundleDisplayName<\/key>\n\t\t\t\t\t<string>Nested<\/string>/);
  assert.ok(out.includes("\t<key>CFBundleDisplayName</key>\n\t<string>$(DISPLAY_NAME)</string>\n\t<key>CFBundleExecutable</key>"));
});

test("setInfoPlistDisplayName refuses a value that is not a build setting name", () => {
  assert.throws(() => A.setInfoPlistDisplayName(plist, "DISPLAY NAME"), /not a build setting name/);
});

test("the edited Info.plist passes plutil and reads back the variable", { skip: !hasTool("plutil") && "plutil not on PATH" }, () => {
  const file = path.join(tmp, "Info.plist");
  for (const text of [plist, plist.replace("\t<key>CFBundleDisplayName</key>\n\t<string>Shop</string>\n", "")]) {
    fs.writeFileSync(file, A.setInfoPlistDisplayName(text, "DISPLAY_NAME"));
    assert.equal(cp.spawnSync("plutil", ["-lint", file]).status, 0);
    assert.equal(cp.execFileSync("plutil", ["-extract", "CFBundleDisplayName", "raw", file], { encoding: "utf8" }).trim(), "$(DISPLAY_NAME)");
  }
});

const PODFILE = "ios/Podfile";
const editOf = (id) => iosEdits(SHOP).find((e) => e.id === id);
const run = (files, ids) => { const t = memtree(files); apply(t.tree, ids.map(editOf), {}); return t; };
const statesOf = (t) => Object.fromEntries(t.changes().map((c) => [c.file, c.state]));

test("xcconfig-files writes one base xcconfig per configuration, then leaves them, and refuses one changed by hand", () => {
  for (const b of BUNDLES) {
    const first = run(bundle(b), ["apple.xcconfig-files"]);
    assert.deepEqual(Object.values(statesOf(first)), Array(9).fill("created"), b);
    assert.equal(first.tree.read("ios/Flutter/Release-staging.xcconfig"), '#include? "Pods/Target Support Files/Pods-Runner/Pods-Runner.release-staging.xcconfig"\n#include "Generated.xcconfig"\n');
    const second = run(first.files(), ["apple.xcconfig-files"]);
    assert.deepEqual(Object.values(statesOf(second)), Array(9).fill("unchanged"), b);
  }
  const edited = { ...bundle("pristine-flutter-3.47"), "ios/Flutter/Debug-dev.xcconfig": '#include "Generated.xcconfig"\nFLAG = mine\n' };
  const t = run(edited, ["apple.xcconfig-files"]);
  assert.equal(t.state("ios/Flutter/Debug-dev.xcconfig"), "conflict");
  assert.equal(t.tree.read("ios/Flutter/Debug-dev.xcconfig"), edited["ios/Flutter/Debug-dev.xcconfig"], "the conflicting file is left as it is");
  assert.equal(t.state("ios/Flutter/Debug-staging.xcconfig"), "created", "the others are still written");
});

test("podfile-map puts the managed map where the template's statement was, and a rerun keeps its bytes", () => {
  const first = run(bundle("pristine-flutter-3.41-pods"), ["apple.podfile-map"]);
  const out = first.tree.read(PODFILE);
  const block = readBlock(out, { id: "podfile-map", syntax: "hash" });
  assert.ok(block && !block.edited, "a managed block whose recorded sha matches its body");
  assert.equal(out.indexOf("# flutter-envs:begin podfile-map"), podfile.indexOf("project 'Runner', {"));
  assert.doesNotMatch(out, /'Debug' => :debug/);
  assert.equal((out.match(/=> :debug,/g) || []).length, 3);
  assert.equal((out.match(/=> :release,/g) || []).length, 6);
  const second = run(first.files(), ["apple.podfile-map"]);
  assert.equal(second.state(PODFILE), "unchanged");
  assert.deepEqual(run(bundle("pristine-flutter-3.47"), ["apple.podfile-map"]).changes(), [], "a SwiftPM app without a Podfile gets nothing");
});

test("podfile-map refuses an owner's own map and a managed map edited by hand, and leaves both Podfiles as they are", () => {
  const owned = { ...bundle("pristine-flutter-3.41-pods"), [PODFILE]: podfile.replace("'Debug' => :debug,", "'Debug' => :debug,\n  'Beta' => :release,") };
  const t = run(owned, ["apple.podfile-map"]);
  assert.equal(t.state(PODFILE), "conflict");
  assert.equal(t.tree.read(PODFILE), owned[PODFILE]);
  const placed = run(bundle("pristine-flutter-3.41-pods"), ["apple.podfile-map"]).files();
  const edited = { ...placed, [PODFILE]: placed[PODFILE].toString().replace("'Debug-dev' => :debug,", "'Debug-dev' => :release,") };
  const u = run(edited, ["apple.podfile-map"]);
  assert.equal(u.state(PODFILE), "conflict");
  assert.equal(u.tree.read(PODFILE), edited[PODFILE]);
});

test("podfile-platform uncomments the template line at the minimum, raises a lower one, and keeps a higher one", () => {
  const pods = bundle("pristine-flutter-3.41-pods");
  assert.match(podfile, /^# platform :ios, '13\.0'$/m);
  const raised = run(pods, ["apple.podfile-platform"]);
  assert.deepEqual(lineDiff(podfile, raised.tree.read(PODFILE)), { removed: ["# platform :ios, '13.0'"], added: ["platform :ios, '15.0'"] });
  assert.equal(run(raised.files(), ["apple.podfile-platform"]).state(PODFILE), "unchanged");
  const lower = run({ ...pods, [PODFILE]: podfile.replace("# platform :ios, '13.0'", "platform :ios, '12.0'") }, ["apple.podfile-platform"]);
  assert.match(lower.tree.read(PODFILE), /^platform :ios, '15\.0'$/m);
  const higher = { ...pods, [PODFILE]: podfile.replace("# platform :ios, '13.0'", "platform :ios, '16.4'") };
  assert.equal(run(higher, ["apple.podfile-platform"]).tree.read(PODFILE), higher[PODFILE]);
  const bare = { ...pods, [PODFILE]: podfile.replace("# platform :ios, '13.0'\n", "") };
  assert.equal(run(bare, ["apple.podfile-platform"]).tree.read(PODFILE), bare[PODFILE], "no platform line at all is left to the project's deployment target");
});

test("schemes writes one per environment and removes Runner.xcscheme, and a rerun only rewrites the same bytes", () => {
  for (const b of BUNDLES) {
    const first = run(bundle(b), ["apple.schemes"]);
    assert.deepEqual(statesOf(first), {
      [`${SCHEMES}/Runner.xcscheme`]: "removed", [`${SCHEMES}/dev.xcscheme`]: "created", [`${SCHEMES}/production.xcscheme`]: "created", [`${SCHEMES}/staging.xcscheme`]: "created",
    }, b);
    assert.equal(attr(first.tree.read(`${SCHEMES}/staging.xcscheme`), "ArchiveAction"), "Release-staging");
    const second = run(first.files(), ["apple.schemes"]);
    assert.deepEqual(Object.values(statesOf(second)), ["unchanged", "unchanged", "unchanged"], b);
  }
});

test("schemes leaves a hand-edited scheme and keeps Runner.xcscheme while one conflicts", () => {
  const files = bundle("pristine-flutter-3.41-pods");
  const edited = A.cloneScheme(files[`${SCHEMES}/Runner.xcscheme`], "dev").replace('allowLocationSimulation = "YES"', 'allowLocationSimulation = "NO"');
  const t = run({ ...files, [`${SCHEMES}/dev.xcscheme`]: edited }, ["apple.schemes"]);
  assert.equal(t.state(`${SCHEMES}/dev.xcscheme`), "conflict");
  assert.equal(t.tree.read(`${SCHEMES}/dev.xcscheme`), edited);
  assert.equal(t.state(`${SCHEMES}/Runner.xcscheme`), null, "Runner.xcscheme is not touched");
  assert.equal(t.state(`${SCHEMES}/staging.xcscheme`), "created");
});

test("infoplist-name sets CFBundleDisplayName to the variable once, and a rerun keeps its bytes", () => {
  const first = run(bundle("pristine-flutter-3.47"), ["apple.infoplist-name"]);
  assert.deepEqual(lineDiff(plist, first.tree.read("ios/Runner/Info.plist")), { removed: ["\t<string>Shop</string>"], added: [`\t<string>$(${CONVENTIONS.iosNameSetting})</string>`] });
  assert.equal(run(first.files(), ["apple.infoplist-name"]).state("ios/Runner/Info.plist"), "unchanged");
});
