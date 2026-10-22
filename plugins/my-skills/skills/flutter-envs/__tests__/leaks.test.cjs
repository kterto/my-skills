"use strict";
// The repository is public: no file of the skill may carry this machine's identity, an Apple team id or a local path.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");

const SKILL = path.join(__dirname, "..");
// Spelled in pieces, so this file does not match its own scan.
const LEAKS = [`/${"Users"}/`, `/${"Volumes"}/`, `${"DEVELOPMENT_TEAM"} =`];
const files = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)]));

test("no file under the skill carries an Apple team id or a local path", () => {
  const all = files(SKILL);
  for (const reached of ["SKILL.md", path.join("scripts", "envs.cjs"), path.join("__tests__", "fixtures")]) {
    assert.ok(all.some((f) => path.relative(SKILL, f).startsWith(reached)), `the scan reaches ${reached}`);
  }
  const found = all.flatMap((f) => fs.readFileSync(f, "utf8").split("\n").flatMap((line, i) => LEAKS.filter((l) => line.includes(l)).map((l) => `${path.relative(SKILL, f)}:${i + 1}: ${l}`)));
  assert.deepStrictEqual(found, []);
});
