"use strict";
// Writes the fake `firebase` into a temp dir that goes first on PATH, with its world file, an argv log and an empty
// app root for placements.

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { cli } = require("../../../scripts/firebase-cli.cjs");

// -> a fresh temp dir that the test's after hook removes, whether the test passes, fails or times out.
function tempDir(t, prefix) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

const ACCOUNT = "owner@example.invalid";

// Two projects of the spec's example, both listed; no app exists yet.
function baseWorld(flavor = "15.34") {
  return {
    flavor,
    version: flavor === "11.19" ? "11.19.0" : "15.34.0",
    account: ACCOUNT,
    projects: [
      { projectId: "acme-dev-staging", projectNumber: "111111111111" },
      { projectId: "acme-prod", projectNumber: "222222222222" },
    ],
    apps: [],
  };
}

function fakeFirebase(t, world) {
  const dir = tempDir(t, "fake-firebase-");
  const bin = path.join(dir, "bin");
  const app = path.join(dir, "app");
  fs.mkdirSync(bin);
  fs.mkdirSync(app);
  fs.copyFileSync(path.join(__dirname, "fake-firebase.cjs"), path.join(bin, "firebase"));
  fs.chmodSync(path.join(bin, "firebase"), 0o755);
  const worldFile = path.join(dir, "world.json");
  const logFile = path.join(dir, "argv.log");
  fs.writeFileSync(worldFile, JSON.stringify(world, null, 2));
  fs.writeFileSync(logFile, "");
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_FIREBASE_WORLD: worldFile, FAKE_FIREBASE_LOG: logFile };
  return {
    dir,
    app,
    env,
    call: (args, options = {}) => cli(args, { env, ...options }),
    calls: () => fs.readFileSync(logFile, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)),
    world: () => JSON.parse(fs.readFileSync(worldFile, "utf8")),
    edit(change) {
      const w = JSON.parse(fs.readFileSync(worldFile, "utf8"));
      change(w);
      fs.writeFileSync(worldFile, JSON.stringify(w, null, 2));
    },
  };
}

module.exports = { ACCOUNT, baseWorld, fakeFirebase, tempDir };
