"use strict";
// Mutations for fixture cases. Every edit throws when its anchor is missing, so a case can never pass because its
// mutation silently did not apply.

const zlib = require("node:zlib");
const pbx = require("../../scripts/writers/pbxproj.cjs");

const PBX = "ios/Runner.xcodeproj/project.pbxproj";
const SCHEMES = "ios/Runner.xcodeproj/xcshareddata/xcschemes";

function replace(files, rel, from, to, { all = false } = {}) {
  const text = files[rel];
  if (typeof text !== "string") throw new Error(`mutation: ${rel} is not in the fixture`);
  const hit = from instanceof RegExp ? from.test(text) : text.includes(from);
  if (!hit) throw new Error(`mutation: ${rel} does not contain ${from}`);
  files[rel] = from instanceof RegExp || !all ? text.replace(from, to) : text.split(from).join(to);
}

function json(files, rel, fn) {
  if (typeof files[rel] !== "string") throw new Error(`mutation: ${rel} is not in the fixture`);
  const value = JSON.parse(files[rel]);
  fn(value);
  files[rel] = `${JSON.stringify(value, null, 2)}\n`;
}

function drop(files, prefix) {
  const hits = Object.keys(files).filter((rel) => rel === prefix || rel.startsWith(`${prefix}/`));
  if (!hits.length) throw new Error(`mutation: nothing under ${prefix}`);
  for (const rel of hits) delete files[rel];
}

const quote = (s) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\t/g, "\\t")}"`;

// Replaces the shellScript of the named Runner phase.
function phaseScript(files, name, script) {
  const text = files[PBX];
  const m = pbx.model(text);
  const phase = [...m.byId.values()].find((o) => o.isa === "PBXShellScriptBuildPhase" && (o.node.get("name") || {}).v === name);
  if (!phase) throw new Error(`mutation: no phase named ${name}`);
  const node = phase.node.get("shellScript");
  files[PBX] = text.slice(0, node.start) + quote(script) + text.slice(node.end);
}

// Removes the named phase object and its entry in the Runner target.
function removePhase(files, name) {
  const text = files[PBX];
  const m = pbx.model(text);
  const phase = [...m.byId.values()].find((o) => (o.node.get("name") || {}).v === name);
  if (!phase) throw new Error(`mutation: no phase named ${name}`);
  const runner = m.lists("PBXNativeTarget").find((t) => t.node.get("name").v === "Runner");
  const item = runner.node.get("buildPhases").items.find((it) => it.v === phase.id);
  const cuts = [
    [text.lastIndexOf("\n", phase.entry.keyStart) + 1, text.indexOf("\n", phase.entry.end) + 1],
    [text.lastIndexOf("\n", item.start) + 1, text.indexOf("\n", item.end) + 1],
  ].sort((a, b) => b[0] - a[0]);
  let out = text;
  for (const [from, to] of cuts) out = out.slice(0, from) + out.slice(to);
  files[PBX] = out;
}

// Adds a Run Script phase at the end of the Runner target's phases.
function addPhase(files, name, script) {
  const text = files[PBX];
  const m = pbx.model(text);
  const runner = m.lists("PBXNativeTarget").find((t) => t.node.get("name").v === "Runner");
  const list = runner.node.get("buildPhases");
  const id = "0FFE00000000000000000001";
  const obj = `\t\t${id} /* ${name} */ = {\n\t\t\tisa = PBXShellScriptBuildPhase;\n\t\t\tbuildActionMask = 2147483647;\n\t\t\tfiles = (\n\t\t\t);\n\t\t\tinputPaths = (\n\t\t\t);\n\t\t\tname = ${quote(name)};\n\t\t\toutputPaths = (\n\t\t\t);\n\t\t\trunOnlyForDeploymentPostprocessing = 0;\n\t\t\tshellPath = /bin/sh;\n\t\t\tshellScript = ${quote(script)};\n\t\t};\n`;
  const end = text.indexOf("/* End PBXShellScriptBuildPhase section */");
  const objAt = text.lastIndexOf("\n", end) + 1;
  const itemAt = text.lastIndexOf("\n", list.end - 1) + 1;
  const edits = [{ at: objAt, text: obj }, { at: itemAt, text: `\t\t\t\t${id} /* ${name} */,\n` }].sort((a, b) => b.at - a.at);
  let out = text;
  for (const e of edits) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  files[PBX] = out;
}

// A valid PNG of the given size and colour type (2 RGB, 6 RGBA), all black: enough for header facts and digests.
function png(width, height, colorType) {
  const channels = colorType === 6 ? 4 : 3;
  const raw = Buffer.alloc(height * (width * channels + 1));
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, body) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(body.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(Buffer.concat([Buffer.from(type), body])));
    return Buffer.concat([len, Buffer.from(type), body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = colorType;
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

module.exports = { PBX, SCHEMES, replace, json, drop, phaseScript, removePhase, addPhase, png };
