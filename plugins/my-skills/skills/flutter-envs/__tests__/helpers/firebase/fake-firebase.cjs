#!/usr/bin/env node
"use strict";
// A stand-in `firebase` for the tests. It keeps a small world in FAKE_FIREBASE_WORLD (projects, apps, the signed-in
// account), answers the commands the Firebase leg runs the way firebase-tools 11.19 and 15.34 do under --json, and
// appends its argv to FAKE_FIREBASE_LOG. `world.flavor` picks the print style: 11.19 ends the JSON with a newline
// (console.log), 15.34 does not (process.stdout.write) and honours FIREBASE_DEBUG_PATH.

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const argv = process.argv.slice(2);
fs.appendFileSync(process.env.FAKE_FIREBASE_LOG, `${JSON.stringify(argv)}\n`);
process.stderr.write("(node:4242) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.\n");

const worldFile = process.env.FAKE_FIREBASE_WORLD;
const world = JSON.parse(fs.readFileSync(worldFile, "utf8"));
const save = () => fs.writeFileSync(worldFile, JSON.stringify(world, null, 2));
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

function print(object) {
  const text = JSON.stringify(object, null, 2);
  if (world.flavor === "11.19") console.log(text);
  else process.stdout.write(text);
}

function debugLog(lines) {
  const base = world.flavor === "11.19" ? process.cwd() : process.env.FIREBASE_DEBUG_PATH || process.cwd();
  const stamp = "[debug] [2026-10-21T00:00:00.000Z]";
  fs.writeFileSync(path.join(base, "firebase-debug.log"), `${lines.map((l) => `${stamp} ${l}`).join("\n")}\n`);
}

function fail(message, { exit = 2, status = null, url = null } = {}) {
  if (status) {
    debugLog([
      `Command:       firebase ${argv.join(" ")}`,
      `>>> [apiv2][query] GET ${url} pageSize=100`,
      `<<< [apiv2][status] GET ${url} ${status}`,
      `<<< [apiv2][body] GET ${url} {"error":{"code":${status},"message":"The caller does not have permission","status":"PERMISSION_DENIED"}}`,
    ]);
  }
  print({ status: "error", error: message });
  process.exit(exit);
}

const done = (result) => {
  print({ status: "success", result });
  process.exit(0);
};

if (argv[0] === "--version") {
  process.stdout.write(`${world.version}\n`);
  process.exit(0);
}

const args = argv.filter((a) => a !== "--json");
const canned = (world.canned || {})[args.join(" ")];
if (canned) {
  if (canned.sleepMs) sleep(canned.sleepMs);
  if (canned.debugStatus) debugLog([`<<< [apiv2][status] GET https://firebase.googleapis.com/v1beta1/canned ${canned.debugStatus}`]);
  if (canned.stderr) process.stderr.write(canned.stderr);
  if (canned.stdout !== undefined) process.stdout.write(canned.stdout);
  process.exit(canned.code || 0);
}

const option = (name) => {
  const at = args.indexOf(name);
  return at >= 0 ? args[at + 1] : undefined;
};
const [command, ...rest] = args;
const positional = rest.filter((a, i) => !a.startsWith("-") && !(i > 0 && rest[i - 1].startsWith("-")));

if (command === "login:list") {
  if (!world.account) done(undefined);
  done([{ user: { email: world.account }, tokens: { refresh_token: "SENTINEL-REFRESH-TOKEN", access_token: "SENTINEL-ACCESS-TOKEN" } }]);
}

if (!["projects:list", "apps:list", "apps:create", "apps:sdkconfig"].includes(command)) fail(`${command} is not a Firebase command`, { exit: 1 });
if (!world.account) fail("Failed to authenticate, have you run firebase login?", { exit: 1 });
if (world.reauth) fail("Authentication Error: Your credentials are no longer valid. Please run firebase login --reauth", { exit: 1 });

if (command === "projects:list") {
  done(world.projects.filter((p) => p.listed !== false).map((p) => ({
    projectId: p.projectId, projectNumber: p.projectNumber, displayName: p.projectId, name: `projects/${p.projectId}`,
    resources: { hostingSite: p.projectId }, state: "ACTIVE",
  })));
}

const PLATFORM = (positional[0] || "").toUpperCase();
const projectId = option("--project");
const project = world.projects.find((p) => p.projectId === projectId);
const kind = PLATFORM === "IOS" ? "iosApps" : "androidApps";
const url = `https://firebase.googleapis.com/v1beta1/projects/${projectId}/${kind}`;
const denied = !project || project.listed === false || project.denyApps;

const shape = (app) => ({
  name: `projects/${app.projectId}/${app.platform === "IOS" ? "iosApps" : "androidApps"}/${app.appId}`,
  appId: app.appId, displayName: app.displayName, projectId: app.projectId,
  ...(app.platform === "IOS" ? { bundleId: app.bundleId } : { packageName: app.packageName }),
  apiKeyId: `key-${app.appId.slice(-4)}`, state: "ACTIVE",
});

if (command === "apps:list") {
  if (denied) fail(`Failed to list Firebase ${PLATFORM} apps. See firebase-debug.log for more info.`, { status: 403, url });
  done(world.apps.filter((a) => a.projectId === projectId && a.platform === PLATFORM).map((a) => ({ ...shape(a), platform: PLATFORM })));
}

if (command === "apps:create") {
  const id = PLATFORM === "IOS" ? option("--bundle-id") : option("--package-name");
  if (denied) fail(`Failed to create ${PLATFORM === "IOS" ? "iOS" : "Android"} app for project ${projectId}. See firebase-debug.log for more info.`, { status: 403, url });
  const appId = `1:${project.projectNumber}:${PLATFORM.toLowerCase()}:${crypto.createHash("sha1").update(`${projectId}/${id}`).digest("hex").slice(0, 12)}`;
  const app = { projectId, platform: PLATFORM, appId, displayName: positional[1], ...(PLATFORM === "IOS" ? { bundleId: id } : { packageName: id }) };
  world.apps.push(app);
  save();
  done(shape(app));
}

if (command === "apps:sdkconfig") {
  const app = world.apps.find((a) => a.appId === positional[1] && a.platform === PLATFORM);
  if (!app) fail(`Failed to get ${PLATFORM} app configuration. See firebase-debug.log for more info.`);
  if (world.appearOnSdkconfig) {
    fs.mkdirSync(path.dirname(world.appearOnSdkconfig.path), { recursive: true });
    fs.writeFileSync(world.appearOnSdkconfig.path, world.appearOnSdkconfig.text);
  }
  const number = project.projectNumber;
  if (PLATFORM === "ANDROID") {
    const config = world.sdkconfigOverride && world.sdkconfigOverride.ANDROID ? world.sdkconfigOverride.ANDROID : {
      project_info: { project_number: number, project_id: projectId, storage_bucket: `${projectId}.appspot.com` },
      client: world.apps.filter((a) => a.projectId === projectId && a.platform === "ANDROID").map((a) => ({
        client_info: { mobilesdk_app_id: a.appId, android_client_info: { package_name: a.packageName } },
        oauth_client: [], api_key: [{ current_key: `AIza-SENTINEL-${a.appId.slice(-4)}` }],
      })),
      configuration_version: "1",
    };
    done({ fileName: "google-services.json", fileContents: JSON.stringify(config, null, 2) });
  }
  const entries = {
    API_KEY: `AIza-SENTINEL-${app.appId.slice(-4)}`, GCM_SENDER_ID: number, PLIST_VERSION: "1", BUNDLE_ID: app.bundleId, PROJECT_ID: projectId,
    STORAGE_BUCKET: `${projectId}.appspot.com`, IS_GCM_ENABLED: true, GOOGLE_APP_ID: app.appId, ...((world.sdkconfigOverride || {}).IOS || {}),
  };
  const body = Object.entries(entries).map(([k, v]) => `\t<key>${k}</key>\n\t${typeof v === "boolean" ? `<${v}/>` : `<string>${v}</string>`}`).join("\n");
  done({ fileName: "GoogleService-Info.plist", fileContents: `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0">\n<dict>\n${body}\n</dict>\n</plist>\n` });
}
