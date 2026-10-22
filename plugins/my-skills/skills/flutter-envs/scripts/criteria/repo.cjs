"use strict";
// The checks no criterion owns: the pinned Flutter, platforms the skill does not cover, destructive template targets,
// tracked signing material, git itself, files that would not parse, and leftovers of earlier setups.

const { CONVENTIONS, finding } = require("../lib/vocab.cjs");

const BUILD_SETS = new Set(["main", "debug", "profile", "release", "test", "androidtest"]);
const and = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const older = (version, min) => {
  const a = String(version).split(".").map(Number);
  const b = min.split(".").map(Number);
  for (let i = 0; i < b.length; i++) { if ((a[i] || 0) !== b[i]) return (a[i] || 0) < b[i]; }
  return false;
};

function check(ctx) {
  const { facts, matrix: m } = ctx;
  const e = facts.envfiles;
  const out = [];
  if (e.pin && /^\d+\.\d+/.test(e.pin.version) && older(e.pin.version, CONVENTIONS.minFlutter)) {
    out.push(finding("repo.flutter-too-old", null, `${e.pin.via} pins Flutter ${e.pin.version}; default-flavor needs ${CONVENTIONS.minFlutter}`, [e.pin.via]));
  }
  const flavored = facts.gradle.flavors.length > 0 || m.sources.ios.length > 0;
  if (flavored && e.platforms.length) out.push(finding("repo.other-platforms-unseparated", null, `${and(e.platforms)} ${e.platforms.length > 1 ? "have" : "has"} no environment separation`, e.platforms));
  const mk = e.makefile;
  const targets = mk ? mk.targets.filter((t) => /^(unbootstrap|configure-firebase.*)$/.test(t.name)) : [];
  const scripts = e.scripts.filter((s) => /\/(unbootstrap|configure-firebase)\.sh$/.test(s));
  if (targets.length || scripts.length) {
    out.push(finding("repo.destructive-target", null, `${and([...targets.map((t) => `make ${t.name}`), ...scripts.filter((s) => !targets.some((t) => s.includes(t.name.replace(/-yes$/, ""))))])} would undo the setup`, [...targets.map((t) => t.at), ...scripts], { ref: "repo.remove-destructive-targets" }));
  }
  if (e.signingTracked.length) out.push(finding("repo.signing-material-tracked", null, `${and(e.signingTracked)} ${e.signingTracked.length > 1 ? "are" : "is"} tracked in git`, e.signingTracked));
  if (!facts.git.repo) out.push(finding("repo.not-a-git-repo", null, "the app is not inside a git repository", []));

  const errors = [
    ...facts.gradle.errors, ...facts.apple.errors, ...facts.android.errors, ...facts.icons.errors,
    ...(facts.pbxproj.error ? [{ at: facts.pbxproj.file, why: facts.pbxproj.error }] : []),
    ...[...e.files, ...(e.sample ? [e.sample] : [])].filter((f) => f.error).map((f) => ({ at: f.file, why: f.error })),
  ];
  for (const err of errors) out.push(finding("repo.unreadable-file", null, `${err.at}: ${err.why}`, [err.at]));

  const left = [];
  for (const p of facts.apple.firebase) {
    if (!/^ios\/(config|Runner)\/[^/]+\//.test(p.file) && p.file !== "ios/Runner/GoogleService-Info.plist") left.push(p.file);
  }
  const root = facts.android.firebase.find((f) => f.set === null);
  if (root && facts.gradle.flavors.length && facts.gradle.flavors.every((f) => { const c = m.cell("fbAndroid", f.name.toLowerCase()); return c && !c.value.fallback; })) left.push(root.file);
  const flavors = facts.gradle.flavors.map((f) => f.name.toLowerCase());
  for (const set of facts.android.sourceSets) {
    const s = set.toLowerCase();
    if (BUILD_SETS.has(s) || flavors.includes(s) || flavors.some((f) => s.startsWith(f) && BUILD_SETS.has(s.slice(f.length)))) continue;
    left.push(`android/app/src/${set}`);
  }
  left.push(...e.certificatesTracked);
  if (left.length) out.push(finding("repo.leftovers", null, `${and(left)} ${left.length > 1 ? "are" : "is"} left from an earlier setup`, left, { ref: "repo.remove-leftovers" }));
  return out;
}

module.exports = { key: "repo", check, steps: () => [], plan: () => [], prove: () => [] };
