"use strict";
// What check prints: every enumerated JSON value comes from vocab.cjs, the text stays within 80 lines without
// hiding a defect or a gap, no step carries a placeholder, no env or Firebase value ever reaches the output, and the
// CLI keeps its exit codes.
const { test } = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const V = require("../scripts/lib/vocab.cjs");
const report = require("../scripts/lib/report.cjs");
const { run, checkProject } = require("../scripts/envs.cjs");
const { CASES } = require("./fixtures/cases.cjs");
const { materialize, bundle } = require("./helpers/project.cjs");

const CLI = path.join(__dirname, "..", "scripts", "envs.cjs");
const capture = (argv, cwd) => {
  const out = []; const err = [];
  const code = run(argv, { cwd, stdout: { write: (s) => out.push(s) }, stderr: { write: (s) => err.push(s) } });
  return { code, stdout: out.join(""), stderr: err.join("") };
};
const SAMPLE = ["ids.env-missing", "ids.ios.pods-xcconfig-missing", "identity.names-drift", "banner.not-wired", "banner.absent", "firebase.production-shares-project",
  "firebase.env-unverifiable", "firebase.ios-delivery-wrong", "envfiles.none", "envfiles.not-ignored", "repo.not-a-git-repo", "ids.template-id", "ids.cross-platform-mismatch"];
const projects = [
  ...["configured-flutter-3.47", "configured-flutter-3.41-pods", "pristine-flutter-3.47"].map((b) => ({ name: b, dir: materialize(b) })),
  ...CASES.filter((c) => SAMPLE.includes(c.code)).map((c) => ({ name: c.code, dir: materialize(c.base, c.mutate, c.options) })),
];

// Many cases' mutations on one project: the worst report the line cap has to hold.
const stress = materialize("configured-flutter-3.47", (f) => {
  for (const c of CASES.filter((x) => x.base === "configured-flutter-3.47" && !x.options && ["ids.env-unlisted", "ids.id-differs", "ids.ios.scheme-missing", "identity.name-same", "identity.ios.icon-set-missing", "banner.corner", "banner.no-envless", "banner.drops-child", "firebase.native-missing", "firebase.android-guard-missing", "firebase.min-platform", "firebase.options-not-env", "envfiles.sample-drift", "envfiles.key-missing", "envfiles.name-key-missing", "envfiles.legacy-dotenv", "repo.flutter-too-old", "repo.other-platforms-unseparated", "repo.unreadable-file", "repo.leftovers"].includes(x.code))) c.mutate(f);
});

function walkVocab(json) {
  const bad = [];
  const is = (list, v, where) => { if (!list.includes(v)) bad.push(`${where}: ${JSON.stringify(v)}`); };
  const stepIds = new Set(json.plan.steps.map((s) => s.id.split(":")[0]));
  assert.deepStrictEqual(Object.keys(json.criteria), [...V.CRITERIA]);
  for (const [c, r] of Object.entries(json.criteria)) {
    is(V.STATUSES, r.status, `${c}.status`);
    for (const f of r.findings) {
      is(Object.keys(V.FINDINGS), f.code, `${c} finding`);
      if (V.FINDINGS[f.code]) is([c], V.FINDINGS[f.code].criterion, `${f.code} criterion`);
    }
  }
  const findings = [...Object.values(json.criteria).flatMap((r) => r.findings), ...json.repo];
  for (const f of json.repo) is(["repo"], V.FINDINGS[f.code] && V.FINDINGS[f.code].criterion, `${f.code} criterion`);
  for (const f of findings) {
    if (f.blocked !== undefined) is(V.BLOCKED, f.blocked, `${f.code}.blocked`);
    if (f.ref !== undefined && !V.EDITS.includes(f.ref) && !V.RECIPES.includes(f.ref) && !stepIds.has(f.ref)) bad.push(`${f.code}.ref ${f.ref}`);
    for (const k of Object.keys(f)) is(["code", "env", "claim", "at", "ref", "blocked"], k, `${f.code} key`);
  }
  is(V.SPEC_SOURCES, json.spec.source, "spec.source");
  for (const [k, field] of Object.entries(json.spec.fields)) is(V.SOURCES, field.source, `spec.fields.${k}.source`);
  for (const q of json.questions) is(V.QUESTIONS, q.id, "question.id");
  assert.ok(json.questions.length <= V.CONVENTIONS.maxQuestions, "at most four questions");
  for (const s of json.plan.steps) { is(V.WHERE, s.where, `${s.id}.where`); is([true, false, null], s.done, `${s.id}.done`); }
  return bad;
}

test("every enumerated value of the JSON report is drawn from vocab.cjs", () => {
  for (const p of [...projects, { name: "stress", dir: stress }]) {
    const json = JSON.parse(capture(["check", "--json", "--app", p.dir]).stdout);
    assert.strictEqual(json.schema, 1);
    assert.deepStrictEqual(walkVocab(json), [], p.name);
  }
});

test("the text report stays within 80 lines and still names every defect and gap", () => {
  for (const p of [...projects, { name: "stress", dir: stress }]) {
    const { ctx, ev } = checkProject(p.dir);
    const text = report.text(ctx, ev);
    assert.ok(text.trimEnd().split("\n").length <= V.CONVENTIONS.reportLines, `${p.name}: ${text.split("\n").length} lines`);
    for (const f of [...Object.values(ev.criteria).flatMap((c) => c.findings), ...ev.repo].filter((x) => V.FINDINGS[x.code].severity !== "note")) {
      assert.ok(text.includes(f.claim) || text.includes(`(+`), `${p.name}: ${f.code} is in the report`);
    }
  }
  const { ctx, ev } = checkProject(stress);
  const blocking = new Set([...Object.values(ev.criteria).flatMap((c) => c.findings), ...ev.repo].filter((x) => V.FINDINGS[x.code].severity !== "note").map((x) => x.code));
  assert.ok(blocking.size >= 15, `the stress project carries ${blocking.size} defect and gap codes`);
  const text = report.text(ctx, ev);
  for (const code of blocking) {
    const first = [...Object.values(ev.criteria).flatMap((c) => c.findings), ...ev.repo].find((x) => x.code === code);
    assert.ok(text.includes(first.claim), `stress: ${code} survives truncation`);
  }
});

test("no rendered step carries a placeholder", () => {
  for (const p of [...projects, { name: "stress", dir: stress }]) {
    const { ev } = checkProject(p.dir);
    for (const s of ev.steps) {
      for (const line of [s.title, s.why, ...s.do]) assert.doesNotMatch(line, /<[a-z][^>]*>|\{\{|\$\{|\bTODO\b|\bXXX\b/i, `${p.name}: ${s.id}: ${line}`);
    }
  }
});

test("no env or Firebase value reaches the text or the JSON report", () => {
  const files = bundle("configured-flutter-3.47");
  const secret = /API_KEY|APP_ID|SENDER|BUCKET|CLIENT_ID|BASE_URL/;
  const values = Object.entries(files).filter(([rel]) => /^env\/(dev|staging|production)\.json$/.test(rel))
    .flatMap(([, text]) => Object.entries(JSON.parse(text)).filter(([k]) => secret.test(k)).map(([, v]) => String(v)));
  const plists = Object.entries(files).filter(([rel]) => rel.endsWith("GoogleService-Info.plist")).flatMap(([, t]) => [...t.matchAll(/<key>(API_KEY|GOOGLE_APP_ID)<\/key>\s*<string>([^<]+)/g)].map((m) => m[2]));
  assert.ok(values.length >= 20 && plists.length >= 6, "the fixture carries the sentinel values");
  for (const p of projects) {
    const outputs = [capture(["check", "--app", p.dir, "--all"]), capture(["check", "--json", "--app", p.dir])];
    for (const o of outputs) for (const v of [...values, ...plists]) assert.ok(!o.stdout.includes(v) && !o.stderr.includes(v), `${p.name} printed a value`);
  }
});

test("the CLI keeps its exit codes and refuses what it does not know", () => {
  const dir = projects[0].dir;
  assert.strictEqual(capture(["check", "--app", dir]).code, 0);
  const explain = capture(["check", "--explain", "ids.no-flavors"]);
  assert.strictEqual(explain.code, 0);
  assert.ok(explain.stdout.includes(V.FINDINGS["ids.no-flavors"].summary));
  assert.strictEqual(capture(["check", "--explain", "ids.nope"]).code, 2);
  const unknownSet = capture(["check", "--app", dir, "--set", "colour=blue"]);
  assert.strictEqual(unknownSet.code, 2);
  assert.match(unknownSet.stderr, /unknown key/);
  assert.strictEqual(capture(["check", "--app", dir, "--set", "prodId=not an id"]).code, 2);
  assert.strictEqual(capture(["check", "--app", dir, "--frobnicate"]).code, 2);
  assert.strictEqual(capture(["check", "--app", dir, "--only", "nonsense"]).code, 2);
  const modeless = capture(["firebase", "--app", dir]);
  assert.strictEqual(modeless.code, 2, "firebase without --plan or --confirm is a usage error, before any firebase call");
  assert.match(modeless.stderr, /firebase takes one of --plan and --confirm <plan id>/);
  assert.strictEqual(capture(["recipe", "no.such-recipe", "--app", dir]).code, 2, "an unknown recipe id is a usage error");
  const only = capture(["check", "--app", dir, "--only", "banner"]).stdout;
  assert.match(only, /^3 banner/m);
  assert.doesNotMatch(only, /^1 ids/m, "--only leaves the other criteria out");
  const spawned = spawnSync(process.execPath, [CLI, "check", "--json"], { cwd: dir, encoding: "utf8" });
  assert.strictEqual(spawned.status, 0, spawned.stderr);
  assert.strictEqual(JSON.parse(spawned.stdout).project.name, "shop", "the app is found from the working directory");
});

test("a refused flutter_envs.json stops check with exit 2 and one line per reason", () => {
  const dir = materialize("configured-flutter-3.47", (f) => { f["flutter_envs.json"] = JSON.stringify({ version: 1, production: "production", environments: { dev: { id: "com.acme.shop.dev", name: "Shop Dev", firebase: "acme-prod" }, production: { id: "com.acme.shop", name: "Shop", firebase: "acme-prod" } } }); });
  const r = capture(["check", "--app", dir]);
  assert.strictEqual(r.code, 2);
  assert.match(r.stderr, /production's Firebase project acme-prod is also dev's/);
  assert.strictEqual(r.stdout, "", "nothing is reported from a refused spec");
});
