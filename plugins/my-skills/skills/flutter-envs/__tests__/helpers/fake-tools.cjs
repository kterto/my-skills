"use strict";
// Fake build tools for tests that run envs.cjs as a process: each one goes first on PATH (or wherever `install` puts
// it, such as android/gradlew or an SDK's build-tools), appends its argv to a JSON-lines log, and answers from rows of
// { tool, match, code, stdout, stderr }, the first whose regex matches its joined arguments. Also a stored zip writer,
// enough for a fake APK.

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const { tempDir } = require("./firebase/fake.cjs");

const TOOL = `#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_TOOLS_LOG, JSON.stringify([tool, ...args]) + "\\n");
const rows = JSON.parse(fs.readFileSync(process.env.FAKE_TOOLS_ROWS, "utf8"));
const row = rows.find((r) => r.tool === tool && new RegExp(r.match || "").test(args.join(" "))) || {};
if (row.stdout) process.stdout.write(row.stdout);
if (row.stderr) process.stderr.write(row.stderr);
process.exitCode = row.code || 0;
`;

function fakeTools(t, rows, { names = ["flutter", "fvm", "xcodebuild", "plutil", "make", "aapt2"] } = {}) {
  const dir = tempDir(t, "fake-tools-");
  const bin = path.join(dir, "bin");
  const log = path.join(dir, "calls.log");
  const rowsFile = path.join(dir, "rows.json");
  fs.writeFileSync(log, "");
  fs.writeFileSync(rowsFile, JSON.stringify(rows));
  const install = (file) => {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, TOOL, { mode: 0o755 });
  };
  for (const name of names) install(path.join(bin, name));
  const env = { ...process.env, PATH: `${bin}${path.delimiter}${process.env.PATH}`, FAKE_TOOLS_LOG: log, FAKE_TOOLS_ROWS: rowsFile };
  delete env.ANDROID_HOME;
  delete env.ANDROID_SDK_ROOT;
  return { dir, env, install, calls: () => fs.readFileSync(log, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line)) };
}

// -> the bytes of a zip that stores each { name: content } uncompressed, with real CRC-32s and a central directory.
function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(entries)) {
    const data = Buffer.from(content);
    const file = Buffer.from(name);
    const crc = zlib.crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(file.length, 26);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(data.length, 20);
    entry.writeUInt32LE(data.length, 24);
    entry.writeUInt16LE(file.length, 28);
    entry.writeUInt32LE(offset, 42);
    locals.push(local, file, data);
    central.push(entry, file);
    offset += 30 + file.length + data.length;
  }
  const directory = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(central.length / 2, 8);
  end.writeUInt16LE(central.length / 2, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

module.exports = { fakeTools, zip };
