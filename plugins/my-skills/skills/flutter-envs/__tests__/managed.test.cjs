"use strict";
// The marker function: each comment syntax writes, re-reads and refuses to overwrite a hand edit.
const { test } = require("node:test");
const assert = require("node:assert");
const M = require("../scripts/lib/managed.cjs");

const atEnd = (t) => t.length;
const nowhere = () => -1;
const SAMPLES = {
  slash: { host: "android {\n}\n", body: 'flavorDimensions += "env"\nproductFlavors {\n}\n' },
  hash: { host: "all:\n\techo ok\n", body: "env ?= dev\nrun-debug:\n\tflutter run\n" },
  xml: { host: "<resources>\n</resources>\n", body: '<string name="app_display_name">Shop</string>\n' },
};

for (const [syntax, { host, body }] of Object.entries(SAMPLES)) {
  test(`${syntax}: created, then unchanged, then updated, then conflict`, () => {
    const created = M.ensureBlock(host, { id: "flavors", syntax, body, anchor: atEnd, indent: "    " });
    assert.strictEqual(created.state, "created");
    assert.ok(created.text.startsWith(host), "the host text before the anchor is untouched");

    const again = M.ensureBlock(created.text, { id: "flavors", syntax, body, anchor: atEnd, indent: "    " });
    assert.strictEqual(again.state, "unchanged");
    assert.strictEqual(again.text, created.text, "a second run writes the same bytes");

    const updated = M.ensureBlock(created.text, { id: "flavors", syntax, body: `${body}extra\n`, anchor: atEnd, indent: "    " });
    assert.strictEqual(updated.state, "updated", "a stale block we wrote is ours to rewrite");
    assert.match(updated.text, /extra/);
    assert.strictEqual(M.readBlock(updated.text, { id: "flavors", syntax }).edited, false);

    const handEdited = created.text.replace(body.split("\n")[0], `${body.split("\n")[0]} // mine`);
    const refused = M.ensureBlock(handEdited, { id: "flavors", syntax, body: `${body}extra\n`, anchor: atEnd, indent: "    " });
    assert.strictEqual(refused.state, "conflict", "a block edited inside is never overwritten");
    assert.strictEqual(refused.text, handEdited);
  });

  test(`${syntax}: what ensureBlock writes, readBlock reads back in the same syntax only`, () => {
    const { text } = M.ensureBlock(host, { id: "guard", syntax, body, anchor: atEnd });
    const found = M.readBlock(text, { id: "guard", syntax });
    assert.ok(found, "the writer's own syntax finds the block");
    assert.strictEqual(found.edited, false);
    assert.strictEqual(found.body, body);
    for (const other of Object.keys(M.SYNTAX).filter((s) => s !== syntax)) {
      assert.strictEqual(M.readBlock(text, { id: "guard", syntax: other }), null, `${other} must not claim a ${syntax} block`);
    }
  });
}

test("a block that cannot be placed is a conflict and changes nothing", () => {
  const out = M.ensureBlock("android {\n}\n", { id: "flavors", syntax: "slash", body: "x\n", anchor: nowhere });
  assert.deepStrictEqual(out, { text: "android {\n}\n", state: "conflict" });
});

test("a CRLF file gets a CRLF block, and a second run leaves it unchanged", () => {
  const host = "line one\r\nline two\r\n";
  const first = M.ensureBlock(host, { id: "makefile", syntax: "hash", body: "a\nb\n", anchor: atEnd });
  assert.strictEqual(first.state, "created");
  assert.ok(!/[^\r]\n/.test(first.text), "every newline in the file is CRLF");
  assert.strictEqual(M.ensureBlock(first.text, { id: "makefile", syntax: "hash", body: "a\nb\n", anchor: atEnd }).state, "unchanged");
});

test("the wizard's legacy marker is found in either syntax and never written", () => {
  const gradle = [
    "android {",
    "    // setup-flutter-envs: managed",
    '    flavorDimensions += "env"',
    "}",
    '//    # setup-flutter-envs: managed',
    '//    flavorDimensions += "env"',
  ].join("\n");
  const found = M.legacyMarkers(gradle);
  assert.deepStrictEqual(found.map((f) => f.line.trim()), ["// setup-flutter-envs: managed", "//    # setup-flutter-envs: managed"]);
  for (const syntax of Object.keys(M.SYNTAX)) {
    const { text } = M.ensureBlock(gradle, { id: "flavors", syntax, body: "x\n", anchor: atEnd });
    assert.strictEqual(M.legacyMarkers(text).length, 2, `${syntax} adds no legacy marker`);
  }
});
