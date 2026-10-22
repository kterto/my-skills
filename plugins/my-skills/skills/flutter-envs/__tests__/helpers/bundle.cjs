"use strict";
// Fixture bundles: one JSON file per project state, path -> text, or { base64 } for a binary. `pack` keeps only the
// files a reader needs, drops the Apple team id and refuses machine paths; `node bundle.cjs pack <dir> <out> <how>`.

const fs = require("node:fs");
const path = require("node:path");

const KEEP = [
  /^(pubspec\.yaml|\.gitignore|\.fvmrc|Makefile|flutter_envs\.json|firebase\.json|codemagic\.yaml)$/,
  /^\.github\/workflows\/[^/]+\.ya?ml$/,
  /^(lib|test)\/.+\.dart$/,
  /^env\//,
  /^android\/(settings\.gradle(\.kts)?|build\.gradle(\.kts)?|gradle\.properties|\.gitignore)$/,
  /^android\/app\/(build\.gradle(\.kts)?|google-services\.json)$/,
  /^android\/app\/src\/[^/]+\/(AndroidManifest\.xml|google-services\.json)$/,
  /^android\/app\/src\/[^/]+\/res\/(values[^/]*|mipmap-[^/]+)\/[^/]+$/,
  /^ios\/(\.gitignore|Podfile)$/,
  /^ios\/Flutter\/(?!Generated)[^/]+\.xcconfig$/,
  /^ios\/Runner\.xcodeproj\/(project\.pbxproj|xcshareddata\/xcschemes\/[^/]+\.xcscheme)$/,
  /^ios\/Runner\/(Info\.plist|GoogleService-Info\.plist)$/,
  /^ios\/Runner\/Assets\.xcassets\/[^/]+\.appiconset\/[^/]+$/,
  /^ios\/config\//,
];
const BINARY = /\.(png|webp|jpg|jar|keystore|p12|cer)$/;
const MACHINE = /\/(Users|Volumes|home)\/[^/\s"']+|DEVELOPMENT_TEAM/;
// flutter create writes the machine's Apple team id into the pbxproj; a public fixture must not carry it.
const scrub = (rel, text) => (rel.endsWith(".pbxproj") ? text.replace(/^[ \t]*DEVELOPMENT_TEAM\s*=[^;\n]*;\r?\n/gm, "") : text);

function walk(dir, rel = "") {
  const out = [];
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) { if (!["build", ".dart_tool", "Pods", ".git", ".gradle", "ephemeral"].includes(e.name)) out.push(...walk(dir, child)); }
    else out.push(child);
  }
  return out;
}

function pack(dir, made) {
  const files = {};
  for (const rel of walk(dir).filter((r) => KEEP.some((k) => k.test(r))).sort()) {
    const buf = fs.readFileSync(path.join(dir, rel));
    if (BINARY.test(rel)) { files[rel] = { base64: buf.toString("base64") }; continue; }
    const text = scrub(rel, buf.toString("utf8"));
    const machine = MACHINE.exec(text);
    if (machine) throw new Error(`${rel} holds machine identity (${machine[0]}); a bundle must not`);
    files[rel] = text;
  }
  return { made, files };
}

// -> { rel: string | Buffer }
function unpack(bundle) {
  return Object.fromEntries(Object.entries(bundle.files).map(([rel, v]) => [rel, typeof v === "string" ? v : Buffer.from(v.base64, "base64")]));
}

module.exports = { KEEP, pack, unpack };

if (require.main === module) {
  const [verb, dir, out, ...made] = process.argv.slice(2);
  if (verb !== "pack" || !dir || !out || !made.length) {
    process.stderr.write("usage: bundle.cjs pack <dir> <out.json> <how it was made>\n");
    process.exit(2);
  }
  const bundle = pack(path.resolve(dir), made.join(" "));
  fs.writeFileSync(out, JSON.stringify(bundle, null, 1) + "\n");
  process.stdout.write(`${Object.keys(bundle.files).length} files -> ${out}\n`);
}
