"use strict";
// The Firebase steps only a person can take, as data (spec 3.6, 8.1). Every `do` line is a command or a console path
// filled from the spec. `done(state)` reads { version, account, projects } from the CLI probe; `done: null` means
// nothing here can see whether the step is done.

const { PLATFORMS, CONVENTIONS } = require("./vocab.cjs");

const CONSOLE = "https://console.firebase.google.com";
const projectPage = (project, page) => `${CONSOLE}/project/${project}/${page}`;
const remoteFor = (env) => `firebase.apps:${env}`;
const short = (message) => (message.length > 200 ? `${message.slice(0, 197)}...` : message);
const joined = (items) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`);
const step = (id, where, title, todo, why, blocks, done) => ({ id, where, title, do: todo, why, blocks, done });

// -> [{ env, name, project, production, ids: { android, ios } }] in spec order. `project` is null while the
// environment's Firebase project is not created, and undefined without Firebase.
function environments(spec) {
  return Object.entries(spec.environments).map(([env, e]) => ({
    env, name: e.name, project: e.firebase, production: env === spec.production, ids: { android: e.id, ios: e.iosId || e.id },
  }));
}

// The steps that stop the CLI leg. The plan and confirm return them in `blocked`.

const install = () => step("firebase.install", "terminal", "Install the Firebase CLI",
  ["npm install -g firebase-tools"],
  "The Firebase leg runs the firebase command, and no firebase is on PATH.",
  ["firebase.login"], (s) => Boolean(s && s.version));

const login = ({ envs, reauth = false }) => step("firebase.login", "terminal",
  reauth ? "Sign in to the Firebase CLI again" : "Sign in to the Firebase CLI",
  [reauth ? "firebase login --reauth" : "firebase login"],
  `${reauth ? "The saved Firebase sign-in no longer works" : "Every Firebase lookup needs a signed-in account"}. Signing in opens a browser, so only you can do it.`,
  envs.map(remoteFor), reauth ? () => false : (s) => Boolean(s && s.account));

const terms = ({ envs, projects }) => step("firebase.terms", "console", "Accept the Firebase Terms",
  [
    `Open ${CONSOLE}/ signed in as the account firebase login uses, and accept the Terms when the console asks.`,
    ...projects.map((p) => `If the Terms are already accepted, ask an owner of ${p} to give this account a Firebase role at ${projectPage(p, "settings/iam")}.`),
  ],
  "Firebase answered 403 (permission denied). It does that for an account that has not accepted its Terms, and only the console can accept them.",
  envs.map(remoteFor), null);

const createProject = ({ project, envs }) => step(`firebase.project:${project}`, "terminal", `Create the Firebase project ${project}`,
  [
    `firebase projects:create ${project}`,
    `If ${project} already exists in Google Cloud without Firebase, run firebase projects:addfirebase ${project} instead.`,
    `If another account owns ${project}, ask that owner to add you at ${projectPage(project, "settings/iam")}.`,
  ],
  `The signed-in account cannot read ${project}, so the plan cannot check its apps. A project id is permanent, so the skill never creates a project.`,
  envs.map(remoteFor), (s) => Boolean(s && Array.isArray(s.projects) && s.projects.includes(project)));

const lookupFailed = ({ args, message, envs }) => step(`firebase.lookup:${args.filter((a) => !a.startsWith("-")).join(":")}`, "terminal",
  `Run the failed lookup firebase ${args.join(" ")}`,
  [`firebase ${args.join(" ")}`],
  `It answered "${short(message)}", so the plan cannot tell which apps exist. Running it shows the whole error.`,
  envs.map(remoteFor), () => false);

// `local` failures happened here (a refused placement), not in the CLI.
const writeFailed = ({ id, env, args, message, local = false }) => step(`firebase.failed:${id}`, "terminal", `Finish the Firebase leg, which stopped at firebase ${args[0]}`,
  ["/flutter-envs"],
  `${local ? `${message}.` : `firebase ${args.join(" ")} answered "${short(message)}".`} The commands before it ran, so the next plan lists only what is left.`,
  [remoteFor(env)], () => false);

// -> the step a failed call turns into: install, sign in, Terms, or the call itself.
function forFailure(failure, { envs, projects = [], account = null, write = null }) {
  if (failure.kind === "missing") return install();
  if (failure.kind === "auth") return login({ envs, reauth: Boolean(account) });
  if (failure.kind === "denied") return terms({ envs, projects });
  if (write) return writeFailed({ ...write, message: failure.message, local: Boolean(failure.local) });
  return lookupFailed({ args: failure.args, message: failure.message, envs });
}

// -> steps plus one more, folded into a step with the same id when there is one, so ids stay unique.
function addStep(steps, extra) {
  const at = steps.findIndex((s) => s.id === extra.id);
  if (at < 0) return [...steps, extra];
  const union = (a, b) => [...new Set([...a, ...b])];
  return steps.map((s, i) => (i === at ? { ...s, do: union(s.do, extra.do), blocks: union(s.blocks, extra.blocks) } : s));
}

// The checklist. Each row emits its steps only while the project calls for them (spec 8.1).

const productionProject = (c) => step("firebase.production-project", "terminal", "Create the production Firebase project",
  ["firebase projects:create", `/flutter-envs, then give the new id when it asks for the Firebase project of ${c.production.env}`],
  "Production needs a Firebase project that no other environment uses. The command asks for the id, which is permanent and can never be reused.",
  [remoteFor(c.production.env)], () => false);

const billing = (p) => step(`firebase.billing:${p}`, "console", `Move ${p} to the Blaze plan`,
  [`Open ${projectPage(p, "usage/details")}, choose Modify plan, and pick Blaze.`],
  "Cloud Storage and Cloud Functions need the pay-as-you-go Blaze plan, and linking a billing account needs its owner.",
  [], null);

const apns = (p, bundleIds) => step(`firebase.apns:${p}`, "console", `Upload the APNs key to ${p}`,
  [
    "Open https://developer.apple.com/account/resources/authkeys/list and create a key with Apple Push Notifications service (APNs) enabled, unless your team has one. Download its .p8 file.",
    `Open ${projectPage(p, "settings/cloudmessaging")} and, under Apple app configuration, upload the .p8 with its Key ID and your Team ID for ${joined(bundleIds)}.`,
  ],
  "Firebase Cloud Messaging reaches iOS devices only through an APNs key, and only a member of the Apple team can create one.",
  [], null);

const authProviders = (p) => step(`firebase.auth-providers:${p}`, "console", `Enable the sign-in providers in ${p}`,
  [
    `Open ${projectPage(p, "authentication/providers")} and enable each provider the app uses, such as Google for google_sign_in.`,
    "/flutter-envs, asking for a refresh of the Firebase config files, so they carry the new OAuth clients",
  ],
  "Firebase Auth refuses a provider that is off in the console. Turning on Google adds OAuth clients that only freshly downloaded config files contain.",
  [], null);

const releaseSha = (e, appId) => step(`firebase.release-sha:${e.env}`, "terminal", `Register the release signing fingerprints of ${e.ids.android}`,
  [
    `(cd android && ./gradlew signingReport)   # prints SHA1 and SHA-256 per variant; read the ${e.env}Release ones`,
    'keytool -list -v -keystore "$KEYSTORE" -alias "$KEY_ALIAS"   # the same fingerprints, read from the release keystore file',
    `firebase apps:android:sha:create ${appId} "$SHA1" --project ${e.project}`,
    `firebase apps:android:sha:create ${appId} "$SHA256" --project ${e.project}`,
    "If Google Play signs your releases, also register the SHA-1 and SHA-256 of the app signing key, from Play Console under App integrity.",
  ],
  "Google sign-in on Android accepts only builds whose signing certificate the Firebase app knows. Which certificate signs releases is your call, so the skill never registers one.",
  [], null);

const appCheck = (p, androidIds, iosIds) => step(`firebase.app-check:${p}`, "console", `Register the apps with App Check in ${p}`,
  [
    `Open ${projectPage(p, "appcheck")} and register ${joined([
      ...(androidIds.length ? [`${joined(androidIds)} with Play Integrity`] : []),
      ...(iosIds.length ? [`${joined(iosIds)} with App Attest`] : []),
    ])}. Play Integrity needs the app's SHA-256 fingerprint registered first.`,
    "Turn on enforcement for each product only after its App Check metrics show your current builds as verified.",
  ],
  "App Check accepts only registered apps, and enforcement rejects every client that is not, so when to enforce is your call.",
  [], null);

const ciSecrets = (c) => {
  const prod = c.production;
  const vars = CONVENTIONS.ciVars(prod.env);
  const fetch = (platform) => {
    const appId = c.apps[prod.env]?.[platform];
    return `the output of firebase apps:sdkconfig ${platform.toUpperCase()} ${appId ? `${appId} ` : ""}--project ${prod.project}`;
  };
  return step(`firebase.ci-secrets:${prod.env}`, "ci", `Add the ${prod.env} secrets to CI`,
    [
      ...c.platforms.map((platform) => `Set ${vars[platform]} to ${fetch(platform)}.`),
      `Set ${vars.env} to the contents of ${CONVENTIONS.envDir}/${prod.env}.json.`,
    ],
    `The Firebase files and the env file of ${prod.env} stay out of git, so a CI build of ${prod.env} fails until CI writes them from these secrets.`,
    [], null);
};

const CHECKLIST = Object.freeze([
  { when: (c) => c.production && c.production.project === null, build: (c) => [productionProject(c)] },
  { when: (c) => c.uses("firebase_storage", "cloud_functions"), build: (c) => c.projects.map(billing) },
  { when: (c) => c.uses("firebase_messaging") && c.platforms.includes("ios"), build: (c) => c.projects.map((p) => apns(p, c.idsOn(p, "ios"))) },
  {
    when: (c) => c.uses("firebase_auth", "google_sign_in"),
    build: (c) => [
      ...c.projects.map(authProviders),
      ...(c.platforms.includes("android") ? c.envs.filter((e) => e.project && c.apps[e.env]?.android).map((e) => releaseSha(e, c.apps[e.env].android)) : []),
    ],
  },
  { when: (c) => c.uses("firebase_app_check"), build: (c) => c.projects.map((p) => appCheck(p, c.idsOn(p, "android"), c.idsOn(p, "ios"))) },
  { when: (c) => c.production && typeof c.production.project === "string" && c.settings.productionFiles === "ci", build: (c) => [ciSecrets(c)] },
]);

// -> the dependency-gated Firebase checklist. `apps` holds known app ids ({ [env]: { android, ios } }), from the native
// files or the plan's lookups; a step that needs an unknown app id waits for a later run.
function firebaseSteps({ spec, deps = [], platforms = PLATFORMS, apps = {}, settings = {} }) {
  const envs = environments(spec);
  const on = PLATFORMS.filter((p) => platforms.includes(p));
  const c = {
    envs,
    apps,
    platforms: on,
    settings: { productionFiles: "ci", ...settings },
    production: envs.find((e) => e.production) || null,
    projects: [...new Set(envs.map((e) => e.project).filter((p) => typeof p === "string"))],
    uses: (...names) => names.some((n) => deps.includes(n)),
    idsOn: (p, platform) => (on.includes(platform) ? envs.filter((e) => e.project === p).map((e) => e.ids[platform]) : []),
  };
  return CHECKLIST.filter((row) => row.when(c)).flatMap((row) => row.build(c));
}

module.exports = { environments, firebaseSteps, forFailure, addStep, install, login, terms, createProject };
