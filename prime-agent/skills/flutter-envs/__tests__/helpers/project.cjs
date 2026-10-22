"use strict";
// Materialises a fixture bundle plus one mutation into a temp git repository, so readers see real files and real git
// state: everything committed except what .gitignore keeps out, then the mutation's `track` list force-added.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { unpack } = require("./bundle.cjs");

const FIXTURES = path.join(__dirname, "..", "fixtures");
const loaded = new Map();
const made = [];

function bundle(name) {
  if (name === null) return {};
  if (!loaded.has(name)) loaded.set(name, JSON.parse(fs.readFileSync(path.join(FIXTURES, `${name}.json`), "utf8")));
  return unpack(loaded.get(name));
}

function git(dir, ...args) {
  const r = spawnSync("git", ["-C", dir, "-c", "user.name=fixture", "-c", "user.email=fixture@example.invalid", "-c", "commit.gpgsign=false", ...args], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")}: ${r.stderr}`);
  return r.stdout;
}

// mutate(files) edits the path -> text|Buffer map in place (null deletes) and may return { track: [paths] } to
// force-add ignored files and { post: { path: text|null } } to change files after the commit.
function materialize(name, mutate = () => {}, { git: useGit = true } = {}) {
  const files = bundle(name);
  const extra = mutate(files) || {};
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flutter-envs-"));
  made.push(dir);
  for (const [rel, content] of Object.entries(files)) {
    if (content === null || content === undefined) continue;
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  }
  if (useGit) {
    git(dir, "init", "-q");
    git(dir, "add", "-A");
    for (const rel of extra.track || []) git(dir, "add", "-f", rel);
    git(dir, "commit", "-q", "--allow-empty", "-m", "fixture");
  }
  for (const [rel, content] of Object.entries(extra.post || {})) {
    if (content === null) fs.rmSync(path.join(dir, rel), { force: true });
    else { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), content); }
  }
  return dir;
}

// A project made only of the given files, for reader tests that need a few files and nothing else.
const fromFiles = (files, options) => materialize(null, (f) => { Object.assign(f, files); }, options);

process.on("exit", () => { for (const dir of made) fs.rmSync(dir, { recursive: true, force: true }); });

module.exports = { bundle, materialize, fromFiles };
