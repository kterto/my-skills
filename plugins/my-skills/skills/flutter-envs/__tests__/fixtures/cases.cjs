"use strict";
// One case per finding code: a fixture bundle, one mutation, and the exact set of codes `check` must report on the
// result, so a false positive fails as surely as a miss. C is the configured 3.47 app (zero findings), CP its 3.41
// CocoaPods twin, P and PP the pristine templates.

const { PBX, SCHEMES, replace, json, drop, phaseScript, removePhase, addPhase, png } = require("../helpers/edit.cjs");

const C = "configured-flutter-3.47";
const CP = "configured-flutter-3.41-pods";
const P = "pristine-flutter-3.47";
const GRADLE = "android/app/build.gradle.kts";
const BANNER = "lib/env/env_banner.dart";
const MAIN = "lib/main.dart";
const PHASE = "flutter-envs: GoogleService-Info.plist";
const PRISTINE = ["ids.no-flavors", "banner.absent", "envfiles.none"];
const prodComparison = "if (current.toUpperCase() == production.toUpperCase()) return app;";
const mismatchBlock = /    if \(guard &&\n[\s\S]*?\n    \}\n/;

const CASES = [
  // ---- ids ----
  { code: "ids.no-flavors", base: P, does: "the pristine template, untouched", mutate: () => {}, expect: PRISTINE },
  { code: "ids.env-missing", base: C, does: "the Gradle block loses its staging flavor",
    mutate: (f) => replace(f, GRADLE, /        create\("staging"\) \{[\s\S]*?\n        \}\n/, ""), expect: ["ids.env-missing", "repo.leftovers"] },
  { code: "ids.env-unlisted", base: C, does: "Gradle gains a qa flavor that flutter_envs.json does not list",
    mutate: (f) => replace(f, GRADLE, '        create("production") {', '        create("qa") {\n            dimension = "env"\n            applicationId = "com.acme.shop.qa"\n        }\n        create("production") {'), expect: ["ids.env-unlisted"] },
  { code: "ids.id-shared", base: C, does: "staging's Android id becomes dev's",
    mutate: (f) => replace(f, GRADLE, 'applicationId = "com.acme.shop.staging"', 'applicationId = "com.acme.shop.dev"'), expect: ["ids.id-shared", "ids.id-differs", "firebase.env-native-disagree"] },
  { code: "ids.id-differs", base: C, does: "flutter_envs.json records another id for dev",
    mutate: (f) => json(f, "flutter_envs.json", (s) => { s.environments.dev.id = "com.acme.shop.develop"; }), expect: ["ids.id-differs"] },
  { code: "ids.template-id", base: P, does: "the pristine template keeps the com.example placeholder",
    mutate: (f) => { replace(f, GRADLE, 'applicationId = "com.acme.shop"', 'applicationId = "com.example.shop"'); replace(f, PBX, "PRODUCT_BUNDLE_IDENTIFIER = com.acme.shop;", "PRODUCT_BUNDLE_IDENTIFIER = com.example.shop;", { all: true }); },
    expect: [...PRISTINE, "ids.template-id"] },
  { code: "ids.cross-platform-mismatch", base: C, does: "with no flutter_envs.json, dev's iOS id (and its Firebase files) spell it differently",
    mutate: (f) => {
      delete f["flutter_envs.json"];
      replace(f, PBX, "PRODUCT_BUNDLE_IDENTIFIER = com.acme.shop.dev;", "PRODUCT_BUNDLE_IDENTIFIER = com.acme.shop.develop;", { all: true });
      replace(f, "ios/config/dev/GoogleService-Info.plist", "<string>com.acme.shop.dev</string>", "<string>com.acme.shop.develop</string>");
      json(f, "env/dev.json", (e) => { e.FIREBASE_IOS_BUNDLE_ID = "com.acme.shop.develop"; });
    }, expect: ["ids.cross-platform-mismatch"] },
  { code: "ids.id-computed", base: C, does: "Debug-dev's bundle id comes from an unresolved build setting",
    mutate: (f) => replace(f, PBX, /(Debug-dev[\s\S]*?)PRODUCT_BUNDLE_IDENTIFIER = com\.acme\.shop\.dev;/, '$1PRODUCT_BUNDLE_IDENTIFIER = "$(APP_ID).dev";'), expect: ["ids.id-computed"] },
  { code: "ids.android.commented-duplicate", base: C, does: "a commented-out copy of the flavor block is appended",
    mutate: (f) => { f[GRADLE] += '\n//    productFlavors {\n//        create("dev") { applicationId = "com.acme.old.dev" }\n//    }\n'; }, expect: ["ids.android.commented-duplicate"] },
  { code: "ids.android.foreign-block", base: C, does: "the flavor block carries the wizard's legacy marker instead of ours",
    mutate: (f) => { replace(f, GRADLE, /    \/\/ flutter-envs:begin flavors sha=[0-9a-f]{8}\n/, "    // setup-flutter-envs: managed\n"); replace(f, GRADLE, "    // flutter-envs:end flavors\n", ""); }, expect: ["ids.android.foreign-block"] },
  { code: "ids.ios.scheme-missing", base: C, does: "the staging scheme is deleted",
    mutate: (f) => drop(f, `${SCHEMES}/staging.xcscheme`), expect: ["ids.ios.scheme-missing"] },
  { code: "ids.ios.scheme-builds-other-flavor", base: C, does: "the staging scheme runs Debug-production",
    mutate: (f) => replace(f, `${SCHEMES}/staging.xcscheme`, /(<LaunchAction\b[^>]*?buildConfiguration\s*=\s*")Debug-staging(")/, "$1Debug-production$2"), expect: ["ids.ios.scheme-builds-other-flavor"] },
  { code: "ids.ios.scheme-not-shared", base: C, does: "the staging scheme moves under xcuserdata",
    mutate: (f) => { f["ios/Runner.xcodeproj/xcuserdata/me.xcuserdatad/xcschemes/staging.xcscheme"] = f[`${SCHEMES}/staging.xcscheme`]; drop(f, `${SCHEMES}/staging.xcscheme`); }, expect: ["ids.ios.scheme-not-shared"] },
  { code: "ids.ios.scheme-prepare-action-missing", base: C, does: "the staging scheme loses the SwiftPM prepare pre-action",
    mutate: (f) => replace(f, `${SCHEMES}/staging.xcscheme`, /<PreActions>[\s\S]*?<\/PreActions>\s*/, ""), expect: ["ids.ios.scheme-prepare-action-missing"] },
  { code: "ids.flavor-name", base: C, does: "the Gradle flavor is spelled Staging",
    mutate: (f) => replace(f, GRADLE, 'create("staging")', 'create("Staging")'), expect: ["ids.flavor-name"] },
  { code: "ids.ios.podfile-map-missing", base: CP, does: "the Podfile map loses Debug-staging",
    mutate: (f) => replace(f, "ios/Podfile", "  'Debug-staging' => :debug,\n", ""), expect: ["ids.ios.podfile-map-missing"] },
  { code: "ids.ios.pods-xcconfig-missing", base: CP, does: "Debug-staging's base xcconfig includes Debug.xcconfig, whose Pods file no configuration produces",
    mutate: (f) => { f["ios/Flutter/Debug-staging.xcconfig"] = '#include "Debug.xcconfig"\n'; }, expect: ["ids.ios.pods-xcconfig-missing"] },

  // ---- identity ----
  { code: "identity.name-same", base: C, does: "staging's strings.xml is deleted, so it shows production's name",
    mutate: (f) => drop(f, "android/app/src/staging/res/values/strings.xml"), expect: ["identity.name-same"] },
  { code: "identity.name-differs", base: C, does: "flutter_envs.json renames staging",
    mutate: (f) => json(f, "flutter_envs.json", (s) => { s.environments.staging.name = "Shop QA"; }), expect: ["identity.name-differs"] },
  { code: "identity.names-drift", base: C, does: "with no flutter_envs.json, iOS spells staging's name differently",
    mutate: (f) => { delete f["flutter_envs.json"]; replace(f, PBX, 'DISPLAY_NAME = "Shop Staging";', 'DISPLAY_NAME = "Shop STG";', { all: true }); }, expect: ["identity.names-drift"] },
  { code: "identity.android.resvalue-unread", base: CP, does: "the dev flavor sets resValue app_name, which the manifest does not read (AGP 8)",
    mutate: (f) => replace(f, GRADLE, 'applicationId = "com.acme.shop.dev"', 'applicationId = "com.acme.shop.dev"\n            resValue("string", "app_name", "Shop DEV")'), expect: ["identity.android.resvalue-unread"] },
  { code: "identity.android.resvalue-agp9", base: C, does: "the dev flavor sets a resValue on AGP 9 without buildFeatures.resValues",
    mutate: (f) => replace(f, GRADLE, 'applicationId = "com.acme.shop.dev"', 'applicationId = "com.acme.shop.dev"\n            resValue("string", "app_display_name", "Shop Dev")'), expect: ["identity.android.resvalue-agp9"] },
  { code: "identity.icon-same", base: C, does: "dev's Android launcher icons are deleted, so it shows src/main's",
    mutate: (f) => { for (const rel of Object.keys(f).filter((r) => r.startsWith("android/app/src/dev/res/mipmap-"))) delete f[rel]; }, expect: ["identity.icon-same"] },
  { code: "identity.ios.icon-set-missing", base: C, does: "the AppIcon-staging set is deleted",
    mutate: (f) => drop(f, "ios/Runner/Assets.xcassets/AppIcon-staging.appiconset"), expect: ["identity.ios.icon-set-missing"] },
  { code: "identity.ios.icon-alpha-marketing", base: C, does: "production's 1024 px icon gains an alpha channel",
    mutate: (f) => { f["ios/Runner/Assets.xcassets/AppIcon.appiconset/Icon-App-1024x1024@1x.png"] = png(1024, 1024, 6); }, expect: ["identity.ios.icon-alpha-marketing"] },

  // ---- banner ----
  { code: "banner.absent", base: C, does: "the banner widget and its wiring are removed",
    mutate: (f) => { drop(f, BANNER); replace(f, MAIN, "import 'env/env_banner.dart';\n", ""); replace(f, MAIN, "      builder: (context, child) => EnvBanner(child: child),\n", ""); }, expect: ["banner.absent"] },
  { code: "banner.not-wired", base: C, does: "MaterialApp loses its builder",
    mutate: (f) => replace(f, MAIN, "      builder: (context, child) => EnvBanner(child: child),\n", ""), expect: ["banner.not-wired"] },
  { code: "banner.corner", base: C, does: "the banner moves to topEnd",
    mutate: (f) => replace(f, BANNER, "BannerLocation.topStart", "BannerLocation.topEnd", { all: true }), expect: ["banner.corner"] },
  { code: "banner.corner-unpinned", base: C, does: "the banner's Banner( calls lose layoutDirection, in an app with no right-to-left locale",
    mutate: (f) => replace(f, BANNER, /^ *layoutDirection: TextDirection\.ltr,\n/gm, ""), expect: ["banner.corner-unpinned"] },
  { code: "banner.no-envless", base: C, does: "an empty NAME no longer reads ENVLESS",
    mutate: (f) => replace(f, BANNER, "current.isEmpty ? 'ENVLESS' : current", "current"), expect: ["banner.no-envless"] },
  { code: "banner.no-production-hide", base: C, does: "the production comparison is removed",
    mutate: (f) => replace(f, BANNER, `    ${prodComparison}\n`, ""), expect: ["banner.no-production-hide"] },
  { code: "banner.production-constant-mismatch", base: C, does: "the banner hides for Envs.PRODUCTION = 'PROD' while env/production.json says PRODUCTION",
    mutate: (f) => { replace(f, BANNER, prodComparison, "if (current == Envs.PRODUCTION) return app;"); f["lib/env/envs.dart"] = "class Envs {\n  static const PRODUCTION = 'PROD';\n}\n"; }, expect: ["banner.production-constant-mismatch"] },
  { code: "banner.drops-child", base: C, does: "the production branch returns a SizedBox",
    mutate: (f) => replace(f, BANNER, prodComparison, "if (current.toUpperCase() == production.toUpperCase()) return const SizedBox();"), expect: ["banner.drops-child"] },
  { code: "banner.build-mode-gated", base: C, does: "the builder shows the banner only in debug builds",
    mutate: (f) => replace(f, MAIN, "builder: (context, child) => EnvBanner(child: child),", "builder: (context, child) => kDebugMode ? EnvBanner(child: child) : child!,"), expect: ["banner.build-mode-gated"] },
  { code: "banner.name-flavor-mismatch", base: C, does: "env/staging.json's NAME says DEV",
    mutate: (f) => json(f, "env/staging.json", (e) => { e.NAME = "DEV"; }), expect: ["banner.name-flavor-mismatch"] },
  { code: "banner.mismatch-guard-missing", base: C, does: "the MISMATCH guard is removed",
    mutate: (f) => replace(f, BANNER, mismatchBlock, ""), expect: ["banner.mismatch-guard-missing"] },

  // ---- firebase ----
  { code: "firebase.production-unregistered", base: C, does: "flutter_envs.json records no production project yet",
    mutate: (f) => json(f, "flutter_envs.json", (s) => { s.environments.production.firebase = null; }), expect: ["firebase.production-unregistered"] },
  { code: "firebase.production-shares-project", base: C, does: "env/production.json names the dev and staging project",
    mutate: (f) => json(f, "env/production.json", (e) => { e.FIREBASE_PROJECT_ID = "acme-dev-staging"; }), expect: ["firebase.production-shares-project", "firebase.env-native-disagree"] },
  { code: "firebase.native-missing", base: C, does: "staging's google-services.json is deleted",
    mutate: (f) => drop(f, "android/app/src/staging/google-services.json"), expect: ["firebase.native-missing"] },
  { code: "firebase.native-wrong-app", base: C, does: "staging's google-services.json holds another package",
    mutate: (f) => replace(f, "android/app/src/staging/google-services.json", '"package_name": "com.acme.shop.staging"', '"package_name": "com.acme.shop.qa"'), expect: ["firebase.native-wrong-app"] },
  { code: "firebase.native-foreign-project", base: C, does: "dev's google-services.json comes from another project",
    mutate: (f) => replace(f, "android/app/src/dev/google-services.json", '"project_id": "acme-dev-staging"', '"project_id": "acme-other"'), expect: ["firebase.native-foreign-project"] },
  { code: "firebase.native-misplaced", base: C, does: "a google-services.json lands in src/main, which the plugin never reads",
    mutate: (f) => { f["android/app/src/main/google-services.json"] = f["android/app/src/production/google-services.json"]; }, expect: ["firebase.native-misplaced"] },
  { code: "firebase.android-guard-missing", base: C, does: "the Gradle guard block is removed",
    mutate: (f) => replace(f, GRADLE, /\/\/ flutter-envs:begin guard[\s\S]*?\/\/ flutter-envs:end guard\n/, ""), expect: ["firebase.android-guard-missing"] },
  { code: "firebase.gradle-plugin-missing", base: C, does: "the app no longer applies the google-services plugin",
    mutate: (f) => replace(f, GRADLE, '    id("com.google.gms.google-services")\n', ""), expect: ["firebase.gradle-plugin-missing"] },
  { code: "firebase.ios-delivery-missing", base: C, does: "the Run Script phase that delivers GoogleService-Info.plist is removed",
    mutate: (f) => removePhase(f, PHASE), expect: ["firebase.ios-delivery-missing"] },
  { code: "firebase.ios-delivery-wrong", base: C, does: "the delivery script becomes a case that skips Profile",
    mutate: (f) => phaseScript(f, PHASE, 'case "${CONFIGURATION}" in\n  Debug-dev|Release-dev) FLAVOR=dev ;;\n  Debug-staging|Release-staging) FLAVOR=staging ;;\n  Debug-production|Release-production) FLAVOR=production ;;\n  *) exit 1 ;;\nesac\ncp "${PROJECT_DIR}/config/${FLAVOR}/GoogleService-Info.plist" "${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/GoogleService-Info.plist"\n'),
    expect: ["firebase.ios-delivery-wrong"] },
  { code: "firebase.ios-delivery-source-tree", base: C, does: "the delivery script copies into ios/Runner, which no .gitignore covers",
    mutate: (f) => phaseScript(f, PHASE, 'ENV="${CONFIGURATION##*-}"\ncp "${PROJECT_DIR}/config/${ENV}/GoogleService-Info.plist" "${PROJECT_DIR}/Runner/GoogleService-Info.plist"\n'),
    expect: ["firebase.ios-delivery-source-tree"] },
  { code: "firebase.env-native-disagree", base: C, does: "env/dev.json's FIREBASE_IOS_APP_ID differs from dev's plist",
    mutate: (f) => json(f, "env/dev.json", (e) => { e.FIREBASE_IOS_APP_ID = "1:100000000001:ios:other0000000000000"; }), expect: ["firebase.env-native-disagree"] },
  { code: "firebase.env-unverifiable", base: C, does: "production's CI-provided Firebase files are absent on this machine",
    mutate: (f) => { drop(f, "android/app/src/production/google-services.json"); drop(f, "ios/config/production/GoogleService-Info.plist"); }, expect: ["firebase.env-unverifiable"] },
  { code: "firebase.android-client-ambiguous", base: C, does: "env/dev.json sets FIREBASE_ANDROID_CLIENT_ID while dev's package has two type-1 clients",
    mutate: (f) => {
      json(f, "env/dev.json", (e) => { e.FIREBASE_ANDROID_CLIENT_ID = "100000000001-dev.apps.googleusercontent.com"; });
      json(f, "env/sample.json", (e) => { e.FIREBASE_ANDROID_CLIENT_ID = ""; });
      json(f, "android/app/src/dev/google-services.json", (g) => { g.client[0].oauth_client = ["a", "b"].map((k) => ({ client_id: `100000000001-${k}.apps.googleusercontent.com`, client_type: 1, android_info: { package_name: "com.acme.shop.dev", certificate_hash: k.repeat(40) } })); });
    }, expect: ["firebase.android-client-ambiguous", "envfiles.key-unread"] },
  { code: "firebase.options-not-env", base: C, does: "firebase_options.dart is regenerated with literal options",
    mutate: (f) => { f["lib/firebase_options.dart"] = "// File generated by FlutterFire CLI.\nimport 'package:firebase_core/firebase_core.dart' show FirebaseOptions;\n\nclass DefaultFirebaseOptions {\n  static FirebaseOptions get currentPlatform => android;\n  static const FirebaseOptions android = FirebaseOptions(\n    apiKey: 'AIza-FAKE-LITERAL',\n    appId: '1:100000000001:android:literal0000',\n    messagingSenderId: '100000000001',\n    projectId: 'acme-dev-staging',\n  );\n}\n"; },
    expect: ["firebase.options-not-env"] },
  { code: "firebase.options-default-prod", base: C, does: "main.dart switches on NAME and falls back to production's options",
    mutate: (f) => replace(f, MAIN, "  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);", "  final FirebaseOptions options = switch (const String.fromEnvironment('NAME')) {\n    'DEV' => DefaultFirebaseOptions.currentPlatform,\n    _ => prod.DefaultFirebaseOptions.currentPlatform,\n  };\n  await Firebase.initializeApp(options: options);"),
    expect: ["firebase.options-default-prod"] },
  { code: "firebase.firebasejson-stale", base: C, does: "firebase.json names a per-flavor options file that does not exist",
    mutate: (f) => { f["firebase.json"] = '{"flutter":{"platforms":{"dart":{"lib/firebase_options_dev.dart":{"projectId":"acme-dev-staging"}}}}}\n'; }, expect: ["firebase.firebasejson-stale"] },
  { code: "firebase.symbols-pinned-default", base: C, does: "a FlutterFire symbol upload phase pins --default-config=default",
    mutate: (f) => addPhase(f, "FlutterFire: upload symbols", 'flutterfire upload-crashlytics-symbols --upload-symbols-script-path="${PODS_ROOT}/FirebaseCrashlytics/run" --platform=ios --default-config=default\n'),
    expect: ["firebase.symbols-pinned-default"] },
  { code: "firebase.ci-materialization-missing", base: C, does: "the CI workflow that writes production's files is deleted",
    mutate: (f) => drop(f, ".github/workflows/build.yml"), expect: ["firebase.ci-materialization-missing"] },
  { code: "firebase.min-platform", base: C, does: "the iOS deployment target drops to 13.0",
    mutate: (f) => replace(f, PBX, "IPHONEOS_DEPLOYMENT_TARGET = 15.0;", "IPHONEOS_DEPLOYMENT_TARGET = 13.0;", { all: true }), expect: ["firebase.min-platform"] },

  // ---- envfiles ----
  { code: "envfiles.none", base: C, does: "env/ and the Makefile are removed",
    mutate: (f) => { drop(f, "env"); drop(f, "Makefile"); }, expect: ["envfiles.none"] },
  { code: "envfiles.not-ignored", base: C, does: "after the commit, env/.gitignore stops ignoring the env files",
    mutate: () => ({ post: { "env/.gitignore": "!.gitignore\n!sample.json\n" } }), expect: ["envfiles.not-ignored"] },
  { code: "envfiles.gitignore-self-ignored", base: C, does: "env/.gitignore ignores itself",
    mutate: (f) => { f["env/.gitignore"] = "*\n!sample.json\n"; }, expect: ["envfiles.gitignore-self-ignored"] },
  { code: "envfiles.sample-missing", base: C, does: "env/sample.json is deleted",
    mutate: (f) => drop(f, "env/sample.json"), expect: ["envfiles.sample-missing"] },
  { code: "envfiles.sample-drift", base: C, does: "env/sample.json loses BASE_URL",
    mutate: (f) => json(f, "env/sample.json", (e) => { delete e.BASE_URL; }), expect: ["envfiles.sample-drift"] },
  { code: "envfiles.sample-holds-env-values", base: C, does: "env/sample.json carries dev's NAME",
    mutate: (f) => json(f, "env/sample.json", (e) => { e.NAME = "DEV"; }), expect: ["envfiles.sample-holds-env-values"] },
  { code: "envfiles.key-unread", base: C, does: "env/dev.json and the sample gain a key no Dart code reads",
    mutate: (f) => { json(f, "env/dev.json", (e) => { e.LEGACY_KEY = "x"; }); json(f, "env/sample.json", (e) => { e.LEGACY_KEY = ""; }); }, expect: ["envfiles.key-unread"] },
  { code: "envfiles.key-missing", base: C, does: "env/staging.json loses BASE_URL",
    mutate: (f) => json(f, "env/staging.json", (e) => { delete e.BASE_URL; }), expect: ["envfiles.key-missing"] },
  { code: "envfiles.file-missing", base: C, does: "env/staging.json is deleted",
    mutate: (f) => drop(f, "env/staging.json"), expect: ["envfiles.file-missing"] },
  { code: "envfiles.tracked-real-file", base: C, does: "env/dev.json is force-added to git",
    mutate: () => ({ track: ["env/dev.json"] }), expect: ["envfiles.tracked-real-file"] },
  { code: "envfiles.name-key-missing", base: C, does: "env/staging.json loses NAME",
    mutate: (f) => json(f, "env/staging.json", (e) => { delete e.NAME; }), expect: ["envfiles.name-key-missing"] },
  { code: "envfiles.run-not-wired", base: C, does: "the Makefile is deleted",
    mutate: (f) => drop(f, "Makefile"), expect: ["envfiles.run-not-wired"] },
  { code: "envfiles.makefile-flavor-mismatch", base: P, does: "the pristine template gets a Make target that passes --flavor",
    mutate: (f) => { f.Makefile = "env ?= dev\nrun-debug:\n\tflutter run --flavor $(env)\n"; }, expect: [...PRISTINE, "envfiles.makefile-flavor-mismatch"] },
  { code: "envfiles.default-flavor-missing", base: C, does: "pubspec.yaml loses default-flavor and the Makefile its envless targets",
    mutate: (f) => { replace(f, "pubspec.yaml", "  default-flavor: dev\n", ""); replace(f, "Makefile", /run-debug-envless:\n\t[^\n]*\nrun-release-envless:\n\t[^\n]*\n/, ""); }, expect: ["envfiles.default-flavor-missing"] },
  { code: "envfiles.envless-target-breaks", base: C, does: "pubspec.yaml loses default-flavor while the envless targets remain",
    mutate: (f) => replace(f, "pubspec.yaml", "  default-flavor: dev\n", ""), expect: ["envfiles.envless-target-breaks"] },
  { code: "envfiles.legacy-dotenv", base: C, does: "a .env.dev file from the older generation is added",
    mutate: (f) => { f[".env.dev"] = "NAME=DEV\n"; }, expect: ["envfiles.legacy-dotenv"] },
  { code: "envfiles.dotenv-asset", base: C, does: "pubspec.yaml bundles .env as an asset",
    mutate: (f) => replace(f, "pubspec.yaml", "  default-flavor: dev\n", "  default-flavor: dev\n  assets:\n    - .env\n"), expect: ["envfiles.dotenv-asset"] },
  { code: "envfiles.reserved-key", base: C, does: "env/dev.json and the sample set FLUTTER_APP_FLAVOR",
    mutate: (f) => { json(f, "env/dev.json", (e) => { e.FLUTTER_APP_FLAVOR = "dev"; }); json(f, "env/sample.json", (e) => { e.FLUTTER_APP_FLAVOR = ""; }); }, expect: ["envfiles.reserved-key"] },

  // ---- repo ----
  { code: "repo.flutter-too-old", base: C, does: ".fvmrc pins Flutter 3.22.3",
    mutate: (f) => { f[".fvmrc"] = '{\n  "flutter": "3.22.3"\n}\n'; }, expect: ["repo.flutter-too-old"] },
  { code: "repo.other-platforms-unseparated", base: C, does: "a macos/ target appears",
    mutate: (f) => { f["macos/Runner/Configs/AppInfo.xcconfig"] = "PRODUCT_BUNDLE_IDENTIFIER = com.acme.shop\n"; }, expect: ["repo.other-platforms-unseparated"] },
  { code: "repo.destructive-target", base: C, does: "the Makefile gains the template's unbootstrap target",
    mutate: (f) => { f.Makefile += "unbootstrap:\n\tbash scripts/unbootstrap.sh\n"; }, expect: ["repo.destructive-target"] },
  { code: "repo.signing-material-tracked", base: C, does: "an upload keystore is force-added to git",
    mutate: (f) => { f["android/app/upload.jks"] = Buffer.from("not a real keystore"); return { track: ["android/app/upload.jks"] }; }, expect: ["repo.signing-material-tracked"] },
  { code: "repo.not-a-git-repo", base: C, does: "the project is materialised without git", options: { git: false },
    mutate: () => {}, expect: ["repo.not-a-git-repo"] },
  { code: "repo.unreadable-file", base: C, does: "AppIcon-dev's Contents.json is not valid JSON",
    mutate: (f) => { f["ios/Runner/Assets.xcassets/AppIcon-dev.appiconset/Contents.json"] = '{"images": ['; }, expect: ["repo.unreadable-file"] },
  { code: "repo.leftovers", base: C, does: "a stray ios/GoogleService-info.plist (lower-case i) is left behind",
    mutate: (f) => { f["ios/GoogleService-info.plist"] = f["ios/config/dev/GoogleService-Info.plist"]; }, expect: ["repo.leftovers"] },
];

module.exports = { CASES, BASES: { C, CP, P } };
