# flutter-envs recipes

A recipe is an edit to code the owner wrote, where the shape varies, so `apply` never makes it. For each one, run `node "$skill_dir/scripts/envs.cjs" recipe <id>`: it prints the block below, the findings that name it, and the snippet with this project's values. Make that edit and nothing else, then run the check named under Accept. Red twice: report it as the owner's call. Never turn a recipe into a rewrite of the file.

## banner.wire-existing-builder
Fixes `banner.not-wired` when the app root already passes `builder:` or there are several roots. Wrap what the builder returns: `builder: (context, child) => EnvBanner(child: <existing>(context, child))`, and import the banner. Accept: `check --only banner`.

## banner.fix-adopted
Fixes a banner rule (`banner.corner`, `no-envless`, `no-production-hide`, `production-constant-mismatch`, `drops-child`, `build-mode-gated`, `mismatch-guard-missing`) on the owner's banner. Change only the rule named, against the snippet: `BannerLocation.topStart` with `layoutDirection: TextDirection.ltr` (Flutter picks the corner from it, so `textDirection` alone flips under a right-to-left locale); ENVLESS for an empty NAME; hidden when NAME equals production's, trimmed and case-insensitive; return the child, never a `SizedBox`; no `kDebugMode` gate; MISMATCH when a non-empty NAME differs from `appFlavor`. Accept: `check --only banner`.

## firebase.options-hand-edited
Fixes `firebase.options-not-env` on a hand-edited `lib/firebase_options.dart`. Set each `FirebaseOptions` field to the `Env` constant the snippet names, keep `DefaultFirebaseOptions.currentPlatform`, and leave other platforms throwing. Accept: `check --only firebase`.

## firebase.switch-fallback
Fixes `firebase.options-default-prod`. Pass `options: DefaultFirebaseOptions.currentPlatform` to `Firebase.initializeApp` and delete the switch whose default is production. Accept: `check --only firebase`.

## firebase.delivery-adopted
Fixes `firebase.ios-delivery-wrong` in an existing Run Script phase. Map each configuration to its own environment by its suffix (`${CONFIGURATION##*-}`), include Profile, and copy the exact name `GoogleService-Info.plist`. Accept: `check --only firebase`.

## firebase.move-misplaced
Fixes `firebase.native-misplaced`. Move `android/app/src/main/google-services.json` to the environment it belongs to, `android/app/src/<env>/google-services.json` (its project id says which), or delete it when each environment has its own. Accept: `check --only firebase`.

## identity.remove-resvalue
Fixes `identity.android.resvalue-unread` and `resvalue-agp9`. Delete the `resValue("string", ...)` lines the findings name, only those. The names live in `src/<env>/res/values/strings.xml`. Accept: `check --only identity`.

## ids.remove-commented-duplicate
Fixes `ids.android.commented-duplicate`. Delete the commented-out `productFlavors` region the finding names, and leave the live block. Accept: `check --only ids`.

## ids.adopt-foreign-block
Fixes `ids.android.foreign-block` (the earlier wizard's marker or a block another tool wrote) once the owner agrees. Replace the block with the snippet, a managed block `apply` then keeps. Inside each flavor, keep what the snippet does not set (`signingConfig`, `manifestPlaceholders`, `versionNameSuffix`). With flutter_flavorizr, edit `flavorizr.yaml` instead. Accept: `check --only ids`.

## ids.extend-suffix-style
Fixes `ids.env-missing` in a Groovy block that derives ids with `applicationIdSuffix`. Add the missing environment the same way, as the snippet shows, rather than converting the block. Accept: `check --only ids`.

## envfiles.makefile-existing
Fixes `envfiles.run-not-wired` or `makefile-flavor-mismatch` when the Makefile already has targets with the skill's names. Make each pass `--flavor $(env) -t lib/main.dart --dart-define-from-file=env/$(env).json` with `env/$(env).json` as a prerequisite, keeping the owner's extra steps; the snippet is the skill's block for reference. Accept: `check --only envfiles`.

## envfiles.remove-unread-keys
Fixes `envfiles.key-unread`. Native code or CI may still read a key, so ask before removing one. On a yes, remove it from `env/sample.json` and every `env/<env>.json` by name, without opening the values. Accept: `check --only envfiles`.

## repo.remove-destructive-targets
Fixes `repo.destructive-target`. Ask whether to delete or guard each target the finding names (`unbootstrap`, `configure-firebase`). Never run one. Accept: `check`.

## repo.remove-leftovers
Fixes `repo.leftovers`. Show the owner the paths the finding names. Delete only what they confirm, as a plain file delete (never `git rm`, which stages), and keep anything a build still reads. Accept: `check`.
