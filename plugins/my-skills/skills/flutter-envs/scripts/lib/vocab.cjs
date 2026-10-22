"use strict";
// The only copy of flutter-envs' closed vocabularies, its finding registry and its conventions. Every other
// file imports these; a code, severity, input key or question that is not listed here does not exist.

const list = (...items) => Object.freeze(items);

const CRITERIA = list("ids", "identity", "banner", "firebase", "envfiles");
const GROUPS = list(...CRITERIA, "repo");
const SEVERITIES = list("defect", "gap", "note");
const FIXES = list("edit", "recipe", "cli", "human", "none");
const STATUSES = list("ok", "partial", "absent", "n/a");
const CHANGES = list("created", "updated", "removed", "unchanged", "conflict", "skipped");
const RESULTS = list("pass", "fail", "not-run");
const TIERS = list("static", "config", "build");
const SOURCES = list("derived", "default", "asked");
const SPEC_SOURCES = list("file", "draft");
const BLOCKED = list("foreign", "conflict", "input");
const WHERE = list("console", "apple", "play", "ci", "terminal", "device");
const PLATFORMS = list("android", "ios");
const WRITERS = list("gradle", "android", "pbxproj", "apple", "icons", "envfiles", "dart");
const INPUT_KEYS = list(
  "envs", "production", "appName", "prodId", "androidId", "iosId", "labels", "bannerGuard", "icons",
  "defaultFlavor", "firebase.nonprod", "firebase.projects", "firebase.productionFiles", "firebase.refresh",
);
const QUESTIONS = list("prodId", "envs", "firebaseNonprod", "firebaseProd", "appName");

// The edit ids a finding's `ref` may name. Writers implement them from Inc 2 on.
const EDITS = list(
  "gradle.flavors", "gradle.default-id", "gradle.guard", "gradle.gms-plugin", "gradle.min-sdk",
  "android.label", "android.strings",
  "pbxproj.rename-plain", "pbxproj.clone-flavors", "pbxproj.set-settings", "pbxproj.base-xcconfigs", "pbxproj.shell-phase",
  "pbxproj.deployment-target",
  "apple.xcconfig-files", "apple.podfile-map", "apple.podfile-platform", "apple.schemes", "apple.infoplist-name",
  "icons.android", "icons.ios",
  "envfiles.env-gitignore", "envfiles.gitignore", "envfiles.sample", "envfiles.skeletons", "envfiles.keys",
  "envfiles.makefile", "envfiles.default-flavor",
  "dart.env", "dart.banner", "dart.banner-test", "dart.wire-banner", "dart.firebase-options", "dart.env-firebase-region",
);

// The recipe ids a finding's `ref` may name: agent-applied edits to user-owned code (references/recipes.md).
const RECIPES = list(
  "banner.wire-existing-builder", "banner.fix-adopted", "firebase.options-hand-edited", "firebase.switch-fallback",
  "firebase.delivery-adopted", "firebase.move-misplaced", "identity.remove-resvalue", "ids.remove-commented-duplicate",
  "ids.adopt-foreign-block", "ids.extend-suffix-style", "envfiles.makefile-existing", "envfiles.remove-unread-keys",
  "repo.remove-destructive-targets", "repo.remove-leftovers",
);

const row = (criterion, severity, fix, source, summary) => Object.freeze({ criterion, severity, fix, source, summary });

const FINDINGS = Object.freeze({
  "ids.no-flavors": row("ids", "gap", "edit", "survey",
    "Neither Android nor iOS defines a flavor, so every environment builds the same app."),
  "ids.env-missing": row("ids", "gap", "edit", "survey",
    "An environment has no Gradle flavor, or lacks one of its Debug, Profile and Release configurations, on a platform."),
  "ids.env-unlisted": row("ids", "gap", "human", "new",
    "An environment exists in the project but not in flutter_envs.json, so nothing records its id, name or Firebase project."),
  "ids.id-shared": row("ids", "defect", "edit", "survey",
    "Two environments resolve to the same application id on one platform, so they cannot be installed side by side."),
  "ids.id-differs": row("ids", "gap", "edit", "survey",
    "An environment's effective application id differs from the expected one (flutter_envs.json, or its other iOS configurations)."),
  "ids.template-id": row("ids", "gap", "edit", "survey",
    "An application id still starts with com.example, the flutter create placeholder."),
  "ids.cross-platform-mismatch": row("ids", "note", "none", "survey",
    "An environment's Android and iOS ids differ; that is allowed, so confirm it is not a typo."),
  "ids.id-computed": row("ids", "note", "none", "survey",
    "An application id is computed at build time (a properties file or an unresolved setting), so it cannot be checked here."),
  "ids.android.commented-duplicate": row("ids", "note", "recipe", "ref:I1",
    "A commented-out copy of the flavor block sits in the Gradle file, with values that can differ from the live block."),
  "ids.android.foreign-block": row("ids", "note", "recipe", "wizard:W5 survey",
    "The flavor block belongs to another tool (the earlier wizard's setup-flutter-envs marker, or flutter_flavorizr), so apply leaves it."),
  "ids.ios.scheme-missing": row("ids", "gap", "edit", "wizard:W2",
    "An environment has iOS configurations but no shared scheme with its exact name, so flutter --flavor cannot select it."),
  "ids.ios.scheme-builds-other-flavor": row("ids", "defect", "edit", "survey",
    "A flavor's scheme runs or archives another flavor's configuration, so its builds carry the wrong id."),
  "ids.ios.scheme-not-shared": row("ids", "defect", "edit", "platform",
    "A flavor's scheme exists only under xcuserdata, so CI and other machines cannot build the flavor."),
  "ids.ios.scheme-prepare-action-missing": row("ids", "defect", "edit", "platform",
    "The project uses Swift Package Manager and a flavor's scheme lacks the Run Prepare Flutter Framework Script pre-action."),
  "ids.flavor-name": row("ids", "defect", "human", "platform",
    "An environment name is not lowercase letters and digits, which breaks Flutter's iOS appFlavor parse or the scheme lookup."),
  "ids.ios.podfile-map-missing": row("ids", "note", "edit", "ref:history platform",
    "CocoaPods is in use and the Podfile's project 'Runner' map lacks flavored configurations, so their pods get release settings."),
  "ids.ios.pods-xcconfig-missing": row("ids", "defect", "edit", "ref:history",
    "CocoaPods is in use and a flavored configuration's base xcconfig does not include its own Pods xcconfig, so the Pods settings vanish."),

  "identity.name-same": row("identity", "gap", "edit", "survey",
    "Two environments show the same display name on a platform: a literal label, an unread name key, or no name of their own."),
  "identity.name-differs": row("identity", "gap", "edit", "new",
    "A display name differs from the one flutter_envs.json records."),
  "identity.names-drift": row("identity", "gap", "edit", "ref:I2",
    "One environment shows different display names across platforms or configurations, and no flutter_envs.json says which is right."),
  "identity.android.resvalue-unread": row("identity", "note", "recipe", "ref:I2",
    "A flavor's resValue sets a string the manifest never reads, so it is dead and can disagree with the real name."),
  "identity.android.resvalue-agp9": row("identity", "defect", "recipe", "platform",
    "A flavor uses resValue on AGP 9 or later without buildFeatures.resValues, which fails the build."),
  "identity.icon-same": row("identity", "gap", "edit", "survey",
    "A non-production environment shows production's launcher icon: no icon of its own, an identical copy, or the same icon set."),
  "identity.ios.icon-set-missing": row("identity", "defect", "edit", "new",
    "A configuration names an app icon set the asset catalog does not contain, which fails the asset compile."),
  "identity.ios.icon-alpha-marketing": row("identity", "note", "human", "ref:I22",
    "A 1024 px App Store icon has an alpha channel, which App Store validation can reject (ITMS-90717)."),

  "banner.absent": row("banner", "gap", "edit", "survey",
    "No environment banner exists in lib/."),
  "banner.not-wired": row("banner", "gap", "edit", "survey",
    "An environment banner widget exists, but nothing wraps the app with it."),
  "banner.corner": row("banner", "defect", "recipe", "survey",
    "The banner is not pinned top-left (BannerLocation.topStart with layoutDirection: TextDirection.ltr, or topLeft)."),
  "banner.corner-unpinned": row("banner", "note", "recipe", "new",
    "The banner is top-left under a left-to-right locale but moves to the top right under a right-to-left one, because its Banner( sets no layoutDirection: TextDirection.ltr, the one argument that pins it."),
  "banner.no-envless": row("banner", "gap", "recipe", "survey",
    "An empty NAME shows an empty banner or none, instead of ENVLESS."),
  "banner.no-production-hide": row("banner", "gap", "recipe", "survey",
    "Nothing near the banner compares NAME with the production value, so production shows a banner."),
  "banner.production-constant-mismatch": row("banner", "defect", "recipe", "survey",
    "The banner's production constant differs from the NAME production's env file sets, so production shows a banner."),
  "banner.drops-child": row("banner", "defect", "recipe", "survey",
    "The banner's production branch returns a placeholder instead of the app."),
  "banner.build-mode-gated": row("banner", "defect", "recipe", "survey",
    "The banner is shown by build mode (kDebugMode or kReleaseMode), not by environment."),
  "banner.name-flavor-mismatch": row("banner", "defect", "edit", "ref:I26",
    "An env file's NAME names another environment, so its builds carry the wrong label."),
  "banner.mismatch-guard-missing": row("banner", "note", "recipe", "ref:I26",
    "Nothing compares NAME with appFlavor, so a build started from Xcode with stale defines shows the wrong environment."),

  "firebase.production-unregistered": row("firebase", "gap", "human", "ref:I10",
    "Production has no Firebase project of its own yet."),
  "firebase.production-shares-project": row("firebase", "defect", "human", "ref:I10",
    "Production's Firebase project is also used by a non-production environment, on the Android file, the iOS file or the env file."),
  "firebase.native-missing": row("firebase", "gap", "cli", "survey",
    "An environment has no Firebase config file of its own on a platform, and CI does not provide one."),
  "firebase.native-wrong-app": row("firebase", "defect", "cli", "survey",
    "An environment's Firebase config file has no app for its id, so the Gradle plugin stops or the app reports to another app."),
  "firebase.native-foreign-project": row("firebase", "defect", "human", "survey",
    "An environment's native Firebase file points at another project than flutter_envs.json records, or its two platforms disagree."),
  "firebase.native-misplaced": row("firebase", "gap", "recipe", "survey",
    "A Firebase config file sits where no build reads it (android/app/src/main/google-services.json)."),
  "firebase.android-guard-missing": row("firebase", "gap", "edit", "ref:history",
    "No Gradle guard stops an Android build whose environment has no google-services.json, so a missing CI file is found late."),
  "firebase.gradle-plugin-missing": row("firebase", "gap", "edit", "new",
    "Firebase is in use but the google-services Gradle plugin is not applied, so Android ignores google-services.json."),
  "firebase.ios-delivery-missing": row("firebase", "gap", "edit", "survey",
    "No Xcode Run Script phase delivers each configuration's GoogleService-Info.plist, so builds bundle whatever copy was left."),
  "firebase.ios-delivery-wrong": row("firebase", "defect", "recipe", "survey ref:I4",
    "The phase that picks GoogleService-Info.plist maps a configuration ambiguously, skips Profile, or uses the wrong file name."),
  "firebase.ios-delivery-source-tree": row("firebase", "defect", "edit", "ref:I4",
    "The delivery phase writes GoogleService-Info.plist into the source tree, where it is not gitignored or the script sandbox blocks it."),
  "firebase.env-native-disagree": row("firebase", "defect", "edit", "survey ref:I10",
    "A FIREBASE_* key in env/<env>.json differs from the value its native Firebase file implies, so Dart and native disagree."),
  "firebase.env-unverifiable": row("firebase", "note", "human", "new",
    "Production's native Firebase files are CI-provided and absent here, so its FIREBASE_* keys cannot be compared."),
  "firebase.android-client-ambiguous": row("firebase", "note", "human", "new",
    "env/<env>.json sets FIREBASE_ANDROID_CLIENT_ID, but google-services.json has no single type-1 client for the package to derive it from."),
  "firebase.options-not-env": row("firebase", "gap", "edit", "survey",
    "Firebase.initializeApp gets one literal options object for every environment, not options built from Env."),
  "firebase.options-default-prod": row("firebase", "defect", "recipe", "survey",
    "A Dart switch picks Firebase options by environment and falls back to production for an unknown or empty name."),
  "firebase.firebasejson-stale": row("firebase", "note", "none", "ref:I5 ref:I28",
    "firebase.json names Dart options files that do not exist, or targets a build-time copy."),
  "firebase.symbols-pinned-default": row("firebase", "note", "human", "ref:I6",
    "The FlutterFire Crashlytics upload phase passes --default-config=default, so every configuration uploads to one app."),
  "firebase.ci-materialization-missing": row("firebase", "gap", "human", "ref:I20",
    "Production's Firebase files are gitignored for CI to write, but no CI file writes them."),
  "firebase.min-platform": row("firebase", "gap", "edit", "platform",
    "The iOS deployment target is below Firebase's minimum (iOS 15)."),

  "envfiles.none": row("envfiles", "gap", "edit", "survey",
    "No env/<env>.json setup exists."),
  "envfiles.not-ignored": row("envfiles", "defect", "edit", "survey",
    "Env files are not kept out of git: no ignore rule covers env/, or a real env file escapes it."),
  "envfiles.gitignore-self-ignored": row("envfiles", "defect", "edit", "survey",
    "env/.gitignore ignores itself and is untracked, so a fresh clone has no rule keeping env files out of git."),
  "envfiles.sample-missing": row("envfiles", "gap", "edit", "survey",
    "No tracked env/sample.json lists the keys an environment needs."),
  "envfiles.sample-drift": row("envfiles", "gap", "edit", "ref:I13",
    "env/sample.json lacks keys that the env files or Dart read."),
  "envfiles.sample-holds-env-values": row("envfiles", "defect", "edit", "ref:I12",
    "env/sample.json holds an environment's values, so a copied sample builds with that environment's label and settings."),
  "envfiles.key-unread": row("envfiles", "note", "recipe", "ref:I11",
    "Env files set keys that no Dart code reads."),
  "envfiles.key-missing": row("envfiles", "gap", "edit", "new",
    "Dart reads a key with no default that an environment's env file does not set."),
  "envfiles.file-missing": row("envfiles", "gap", "edit", "survey",
    "An environment has no env/<env>.json on this machine."),
  "envfiles.tracked-real-file": row("envfiles", "defect", "human", "survey",
    "A real env file is tracked in git, so its values are in the history."),
  "envfiles.name-key-missing": row("envfiles", "defect", "edit", "new",
    "An env file sets no NAME, so its builds show ENVLESS."),
  "envfiles.run-not-wired": row("envfiles", "gap", "edit", "survey",
    "No Makefile target runs with --flavor $(env) and --dart-define-from-file=env/$(env).json."),
  "envfiles.makefile-flavor-mismatch": row("envfiles", "defect", "recipe", "survey",
    "A Make target passes --flavor, but the native projects define no flavors, so it fails."),
  "envfiles.default-flavor-missing": row("envfiles", "gap", "edit", "ref:I17",
    "Flavors exist but pubspec.yaml sets no flutter: default-flavor, so plain flutter run and flutter test fail."),
  "envfiles.envless-target-breaks": row("envfiles", "defect", "edit", "ref:I17",
    "A Make target runs flutter without --flavor while flavors exist and no default-flavor is set, so it fails."),
  "envfiles.legacy-dotenv": row("envfiles", "note", "none", "ref:I14 survey",
    "The older .env.<env> generation (files, ignore lines or an awk Makefile) is still present."),
  "envfiles.dotenv-asset": row("envfiles", "defect", "human", "survey",
    "A .env file is bundled as a Flutter asset, so its values ship readable inside the app."),
  "envfiles.reserved-key": row("envfiles", "defect", "human", "platform",
    "An env file sets a key with a reserved FLUTTER_ prefix, which flutter refuses."),

  "repo.flutter-too-old": row("repo", "defect", "human", "platform",
    "The pinned Flutter is older than 3.24, which lacks default-flavor."),
  "repo.other-platforms-unseparated": row("repo", "note", "none", "ref:I29",
    "macOS, web, Linux or Windows targets exist without environment separation; the skill covers Android and iOS."),
  "repo.destructive-target": row("repo", "note", "recipe", "ref:I27 ref:I16",
    "A template target would undo the setup: make unbootstrap deletes android/ and ios/, configure-firebase rewrites ids and options."),
  "repo.signing-material-tracked": row("repo", "defect", "human", "ref:I15",
    "Private signing material (.p8, .p12, .jks, .keystore, key.properties) is tracked in git."),
  "repo.not-a-git-repo": row("repo", "note", "none", "new",
    "The app is not in a git repository, so tracked and ignored state cannot be checked."),
  "repo.unreadable-file": row("repo", "defect", "human", "new",
    "A file the checks need could not be parsed."),
  "repo.leftovers": row("repo", "note", "recipe", "ref:I3 ref:I4 ref:I15 survey",
    "Leftovers from earlier setups: stray Firebase files, an unused root google-services.json, orphan source sets, certificates."),
});

const upper = (env) => env.toUpperCase();
const CONVENTIONS = Object.freeze({
  envPattern: /^[a-z][a-z0-9]*$/,
  reservedEnvs: list("main", "test", "androidtest", "debug", "release", "profile"),
  productionNames: list("production", "prod", "prd", "live"),
  defaultEnvs: list("dev", "staging", "production"),
  modes: list("Debug", "Profile", "Release"),
  envDir: "env",
  sampleFile: "env/sample.json",
  nameKey: "NAME",
  specFile: "flutter_envs.json",
  envProbe: "env/flutter-envs-probe.json",
  dimension: "env",
  androidNameKey: "app_display_name",
  iosNameSetting: "DISPLAY_NAME",
  iosIconSet: (env, production) => (env === production ? "AppIcon" : `AppIcon-${env}`),
  fbAndroidFile: (env) => `android/app/src/${env}/google-services.json`,
  fbIosFile: (env) => `ios/config/${env}/GoogleService-Info.plist`,
  ciVars: (env) => Object.freeze({
    android: `GOOGLE_SERVICES_JSON_${upper(env)}`, ios: `GOOGLE_SERVICE_INFO_PLIST_${upper(env)}`, env: `ENV_${upper(env)}_JSON`,
  }),
  badgeLabels: Object.freeze({ dev: "DEV", staging: "STG", qa: "QA", uat: "UAT", test: "TEST" }),
  badgeColors: list("2E7D32", "E65100", "6A1B9A", "1565C0", "AD1457", "00695C"),
  deliveryPhase: "flutter-envs: GoogleService-Info.plist",
  // Each FIREBASE_* env key and the native field it is derived from (spec 7.4). Values are compared by digest only.
  firebaseKeys: Object.freeze({
    android: Object.freeze({
      FIREBASE_PROJECT_ID: "project_id", FIREBASE_STORAGE_BUCKET: "storage_bucket", FIREBASE_MESSAGING_SENDER_ID: "project_number",
      FIREBASE_ANDROID_APP_ID: "mobilesdk_app_id", FIREBASE_ANDROID_API_KEY: "current_key", FIREBASE_ANDROID_CLIENT_ID: "oauth_type_1",
      OAUTH_GOOGLE_SERVER_CLIENT_ID: "oauth_type_3",
    }),
    ios: Object.freeze({
      FIREBASE_PROJECT_ID: "PROJECT_ID", FIREBASE_STORAGE_BUCKET: "STORAGE_BUCKET", FIREBASE_MESSAGING_SENDER_ID: "GCM_SENDER_ID",
      FIREBASE_IOS_APP_ID: "GOOGLE_APP_ID", FIREBASE_IOS_API_KEY: "API_KEY", FIREBASE_IOS_BUNDLE_ID: "BUNDLE_ID", FIREBASE_IOS_CLIENT_ID: "CLIENT_ID",
    }),
  }),
  // The Env constants the Firebase options read, in the order the managed region lists them.
  firebaseFields: Object.freeze([
    ["firebaseProjectId", "FIREBASE_PROJECT_ID"], ["firebaseStorageBucket", "FIREBASE_STORAGE_BUCKET"],
    ["firebaseMessagingSenderId", "FIREBASE_MESSAGING_SENDER_ID"], ["firebaseAndroidAppId", "FIREBASE_ANDROID_APP_ID"],
    ["firebaseAndroidApiKey", "FIREBASE_ANDROID_API_KEY"], ["firebaseIosAppId", "FIREBASE_IOS_APP_ID"],
    ["firebaseIosApiKey", "FIREBASE_IOS_API_KEY"], ["firebaseIosBundleId", "FIREBASE_IOS_BUNDLE_ID"],
  ].map(Object.freeze)),
  envBackupDir: "env/.flutter-envs-backup",
  minFlutter: "3.24",
  firebaseMinIos: 15,
  firebaseMinSdk: 24,
  googleServicesVersion: "4.4.2",
  maxQuestions: 4,
  reportLines: 80,
});

// The static proof checks (spec 8.2) and the finding codes behind each: a check passes while none of them is open.
// The banner check reads its criterion's status instead; `firebase` marks the checks that need Firebase in use.
const STATIC_PROOFS = Object.freeze({
  matrix: Object.freeze({ expect: "every file the checks need parses", codes: list("repo.unreadable-file") }),
  ignore: Object.freeze({ expect: "env files stay out of git and the sample stays in", codes: list("envfiles.not-ignored", "envfiles.gitignore-self-ignored", "envfiles.tracked-real-file", "envfiles.sample-missing") }),
  isolation: Object.freeze({ expect: "production's Firebase project is its own on every source", codes: list("firebase.production-shares-project"), firebase: true }),
  "env-native": Object.freeze({ expect: "env FIREBASE_* keys agree with the native Firebase files", codes: list("firebase.env-native-disagree"), firebase: true }),
});

// The mechanisms the admission rule (ADR-0026, ADR-0035) holds to a replay fixture each.
const ADMITTED = Object.freeze({
  TOUCHPOINTS: list("decide", "firebase-consent", "build-consent"),
  GATES: list("clean-tree", "managed-conflict", "convergence", "rollback", "production-isolation"),
  STATUSES,
  RESULTS,
});

// A finding carries only what varies; severity, fix, criterion and source stay in FINDINGS. An unknown code throws.
function finding(code, env, claim, at = [], extra = {}) {
  if (!FINDINGS[code]) throw new Error(`unregistered finding code: ${code}`);
  return { code, env: env || null, claim, at: [].concat(at).filter(Boolean), ...extra };
}

// An edit is data: a criterion plans it, the writer named by its id carries it out. `fixes` lists the finding codes
// it closes on its own, which the engine holds it to after the writes. An unregistered id or code throws.
function edit(id, args, { requires = [], summary = "", fixes = [] } = {}) {
  const [base, env = null] = id.split(":");
  if (!EDITS.includes(base)) throw new Error(`unregistered edit: ${id}`);
  for (const code of fixes) if (!FINDINGS[code]) throw new Error(`edit ${id} fixes unregistered code ${code}`);
  const dot = base.indexOf(".");
  return { id, writer: base.slice(0, dot), op: base.slice(dot + 1), env, args, requires, summary, fixes };
}

module.exports = {
  CRITERIA, GROUPS, SEVERITIES, FIXES, STATUSES, CHANGES, RESULTS, TIERS, SOURCES, SPEC_SOURCES, BLOCKED, WHERE,
  PLATFORMS, WRITERS, INPUT_KEYS, QUESTIONS, EDITS, RECIPES, FINDINGS, CONVENTIONS, STATIC_PROOFS, ADMITTED, finding, edit,
};
