"use strict";
// The Android writer's display names: escaped the way AAPT2 compiles a string value, read back as written, and
// converging when an owner's name carries an apostrophe, an ampersand or a leading @.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { escape, xmlText } = require("../scripts/writers/android.cjs");
const { materialize } = require("./helpers/project.cjs");
const { applyProject, checkProject } = require("../scripts/envs.cjs");

test("a display name is escaped for AAPT2 and reads back as itself", () => {
  assert.strictEqual(escape("Joe's Shop"), "Joe\\'s Shop", "AAPT2 rejects an unescaped apostrophe");
  assert.strictEqual(escape("A & B <C>"), "A &amp; B &lt;C&gt;");
  assert.strictEqual(escape("@home"), "\\@home", "a leading @ would read as a resource reference");
  assert.strictEqual(escape("?attr"), "\\?attr");
  for (const name of ["Joe's Shop", 'Say \\"hi\\"', "A & B <C>", "@home", "?attr", "back\\slash", "Shop Dev"]) {
    assert.strictEqual(xmlText(escape(name)), name, name);
  }
});

test("apply with an apostrophe and an ampersand in the app name writes escaped strings, reads them back and converges", () => {
  const dir = materialize("pristine-flutter-3.47");
  const sets = ["prodId=com.acme.shop", "appName=Joe's Shop & Co"];
  const first = applyProject(dir, { sets, now: "20261021T000000Z" });
  assert.strictEqual(first.code, 0, first.error);
  const dev = fs.readFileSync(path.join(dir, "android/app/src/dev/res/values/strings.xml"), "utf8");
  assert.match(dev, /<string name="app_display_name">Joe\\'s Shop &amp; Co Dev<\/string>/);
  const { ctx, ev } = checkProject(dir);
  assert.deepStrictEqual(ctx.matrix.envs.map((e) => ctx.matrix.cell("androidName", e).value.value), ["Joe's Shop & Co Dev", "Joe's Shop & Co Staging", "Joe's Shop & Co"]);
  assert.deepStrictEqual(ev.criteria.identity.findings.filter((f) => /name/.test(f.code)).map((f) => f.code), [], "no name finding after apply");
  const second = applyProject(dir, { sets, now: "20261021T000000Z" });
  assert.deepStrictEqual(second.receipt.changes.filter((c) => c.state !== "unchanged").map((c) => c.file), []);
});
