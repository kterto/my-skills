"use strict";
// Criterion 3, the banner: a top-left Banner names the environment outside production and reads ENVLESS when no NAME
// is set; it wraps the whole app and is shown by environment, never by build mode. Rules are pure over the context.

const path = require("node:path");
const { CONVENTIONS, finding, edit } = require("../lib/vocab.cjs");

const ENV_FILE = "lib/env/env.dart";
const BANNER_FILE = "lib/env/env_banner.dart";

const flavored = (facts, m) => facts.gradle.flavors.length > 0 || m.sources.ios.length > 0;
const norm = (s) => String(s || "").trim().toUpperCase();

function check(ctx) {
  const { facts, matrix: m, spec } = ctx;
  const b = facts.dart.banner;
  if (!b) return [finding("banner.absent", null, "no Banner( naming the environment exists under lib/", [], { ref: "dart.banner" })];
  const out = [];
  if (!b.wired) {
    const simple = facts.dart.roots.length === 1 && !facts.dart.roots[0].builder;
    out.push(finding("banner.not-wired", null, `${b.widget || "the banner"} (${b.at}) is not wrapped around the app`, [b.at, ...facts.dart.roots.map((r) => r.at)],
      simple ? { ref: "dart.wire-banner" } : { ref: "banner.wire-existing-builder", blocked: "foreign" }));
  }
  // Flutter resolves the corner from layoutDirection, else the locale's direction: topStart is top-left under a
  // left-to-right locale and top-right under a right-to-left one unless layoutDirection pins it.
  const wrong = b.locations.filter((l) => l !== "topLeft" && !(l === "topStart" && !b.layoutDirections.includes("rtl")));
  const pinned = b.layoutDirections.length === 1 && b.layoutDirections[0] === "ltr";
  if (wrong.length) out.push(finding("banner.corner", null, `the banner sits at ${b.locations.join(", ")}${b.layoutDirections.includes("rtl") ? " with layoutDirection: TextDirection.rtl" : ""}`, [b.at], { ref: "banner.fix-adopted" }));
  else if (b.locations.includes("topStart") && !pinned) {
    const rtl = facts.l10n.rtl;
    if (rtl.length) out.push(finding("banner.corner", null, `the banner sits at topStart without layoutDirection: TextDirection.ltr, and the app declares ${rtl.join(", ")}, so it moves to the top right there`, [b.at], { ref: "banner.fix-adopted" }));
    else out.push(finding("banner.corner-unpinned", null, "the banner sits at topStart without layoutDirection: TextDirection.ltr, so a right-to-left locale would move it to the top right", [b.at], { ref: "banner.fix-adopted" }));
  }
  if (!b.envless) out.push(finding("banner.no-envless", null, `${b.file} has no ENVLESS fallback for an empty NAME`, [b.at], { ref: "banner.fix-adopted" }));
  if (!b.production) out.push(finding("banner.no-production-hide", null, `${b.file} never compares the environment with production`, [b.at], { ref: "banner.fix-adopted" }));
  else {
    const prodFile = spec.production && m.cell("envFile", spec.production);
    const name = prodFile && prodFile.value.name;
    const hides = b.production.value;
    if (hides !== null && name !== null && name !== undefined) {
      const same = b.production.caseInsensitive ? norm(name) === norm(hides) : name.trim() === hides.trim();
      if (!same) out.push(finding("banner.production-constant-mismatch", spec.production, `the banner hides for "${hides}", but ${prodFile.value.file} sets NAME "${name}"`, [b.production.at, prodFile.at], { ref: "banner.fix-adopted" }));
    }
  }
  if (b.dropsChild) out.push(finding("banner.drops-child", null, `the production branch at ${b.production.at} returns a placeholder instead of the app`, [b.production.at], { ref: "banner.fix-adopted" }));
  if (b.buildModeGated) out.push(finding("banner.build-mode-gated", null, `${b.widget || "the banner"} is shown by kDebugMode or kReleaseMode`, [b.at], { ref: "banner.fix-adopted" }));

  const labels = (env) => {
    const own = [norm(env), norm((spec.environments[env] && spec.environments[env].badge && spec.environments[env].badge.label) || CONVENTIONS.badgeLabels[env])].filter(Boolean);
    return env === spec.production ? [...own, ...CONVENTIONS.productionNames.map(norm)] : own;
  };
  for (const env of m.envs) {
    const f = m.cell("envFile", env);
    if (!f || !f.value.name) continue;
    const other = m.envs.find((o) => o !== env && labels(o).includes(norm(f.value.name)) && !labels(env).includes(norm(f.value.name)));
    if (other) out.push(finding("banner.name-flavor-mismatch", env, `${f.value.file} sets NAME "${f.value.name}", which names ${other}`, [f.at], { ref: "envfiles.keys" }));
  }
  if (spec.settings.bannerGuard !== "off" && flavored(facts, m) && !b.mismatchGuard) {
    out.push(finding("banner.mismatch-guard-missing", null, `${b.widget || "the banner"} never compares NAME with appFlavor`, [b.at], { ref: "banner.fix-adopted" }));
  }
  return out;
}

// The banner when the project has none, or the skill's own at lib/env/env_banner.dart: Env (unless a class exists),
// the widget and its test from templates, and the single app root wrapped. An adopted banner elsewhere is the owner's.
// The values the banner template takes for this project: where Env lives, how NAME is read, production's NAME.
// The name is a parameter's default value, which Dart requires to be constant, so the fallback is a const call.
function bannerArgs({ facts, matrix: m, spec }) {
  const env = facts.dart.env;
  const ours = !env || env.file === ENV_FILE;
  const label = env && env.fields.find((f) => f.key === CONVENTIONS.nameKey);
  const prodFile = spec.production && m.cell("envFile", spec.production);
  return {
    ours,
    envImport: ours || label ? [{ path: path.posix.relative(path.posix.dirname(BANNER_FILE), ours ? ENV_FILE : env.file) }] : [],
    nameExpr: ours ? "Env.name" : label ? `${env.name}.${label.field}` : `const String.fromEnvironment('${CONVENTIONS.nameKey}')`,
    production: (prodFile && prodFile.value.name) || (spec.production || CONVENTIONS.productionNames[0]).toUpperCase(),
    guard: spec.settings.bannerGuard !== "off",
  };
}

function plan(ctx) {
  const { facts } = ctx;
  const d = facts.dart;
  if (d.banner && d.banner.file !== BANNER_FILE) return [];
  const out = [];
  const { ours, envImport, nameExpr, production, guard } = bannerArgs(ctx);
  if (ours) out.push(edit("dart.env", {}, { summary: `${ENV_FILE}, the Env class` }));
  out.push(edit("dart.banner", { envImport, nameExpr, production, guard }, { requires: ["dart.env"], summary: `${BANNER_FILE}, the top-left environment banner`, fixes: ["banner.absent"] }));
  const pkg = facts.envfiles.pubspec && facts.envfiles.pubspec.name;
  if (pkg) out.push(edit("dart.banner-test", { pkg, production }, { requires: ["dart.banner"], summary: "test/env_banner_test.dart" }));
  const roots = d.roots;
  if (roots.length === 1 && (!roots[0].builder || roots[0].wraps)) {
    out.push(edit("dart.wire-banner", { file: roots[0].at.replace(/:\d+$/, "") }, { requires: ["dart.banner"], summary: `builder: wraps the app in EnvBanner (${roots[0].at})`, fixes: ["banner.not-wired"] }));
  }
  return out;
}

// The recipes' snippets: the reference banner to compare an adopted one with, and the builder that wraps an existing one.
function snippets(ctx) {
  const { envImport, nameExpr, production, guard } = bannerArgs(ctx);
  const roots = ctx.facts.dart.roots;
  return {
    "banner.fix-adopted": { writer: "dart", name: "banner", args: { envImport, nameExpr, production, guard } },
    ...(roots.length ? { "banner.wire-existing-builder": { writer: "dart", name: "wire", args: { file: roots[0].at.replace(/:\d+$/, "") } } } : {}),
  };
}

const variant = ({ facts }) => { const b = facts.dart.banner; return b ? `Banner(${b.locations.join(",")}) envless=${b.envless} production=${b.production ? b.production.value : "none"}` : "-"; };

module.exports = { key: "banner", check, steps: () => [], plan, snippets, prove: () => [], empty: ({ facts }) => !facts.dart.banner, variant };
