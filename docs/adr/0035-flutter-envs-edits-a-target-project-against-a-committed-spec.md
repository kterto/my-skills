# ADR-0035 — flutter-envs: the first skill that edits a target project, checked against a committed spec

- **Status:** Accepted.
- **Date:** 2026-10-21
- **Amends:** [ADR-0030](0030-the-engine-measures-at-the-tree.md) decision 4's enforcement scope. `scripts/__tests__/admission.test.mjs` already reads the vocabulary of clean-code-gates and fails on a value with no admission entry. It now also reads `flutter-envs/scripts/lib/vocab.cjs` → `ADMITTED`. [ADR-0026](0026-skill-byte-budgets-and-the-admission-rule.md) is applied, not changed. *Admission* below says which of its conditions this skill meets.
- **Skills affected:**
  - `flutter-envs` is new: `SKILL.md`, `references/{recipes,firebase}.md`, `templates/`, `scripts/` and `__tests__/`.
  - `budgets.json` gains three file entries and one code entry.
  - `fixtures/admission.json` gains its entries and `fixtures/replays/flutter-envs-*.json`.
  - `scripts/__tests__/admission.test.mjs` learns the second vocabulary.
  - `prime-agent/overlays/flutter-envs.json` is new, and the generated Prime tree is rebuilt.
  - `.opencode/commands/flutter-envs.md` is new.
  - `plugins/my-skills/skills/index.json` is regenerated.
  - The README, the two manifests and the skill-count pins move from fourteen to fifteen.
- **Source finding:** the owner's request of 2026-10-20 and three private investigations. These are an inventory of the reference app's environment setup (its sections A-I, 30 defects), a survey of 47 Flutter apps on the owner's machine with a detection-rule table, and platform research covering Flutter 3.41-3.47, AGP 9, SwiftPM, FlutterFire 1.4.1, firebase-tools and the xcodeproj gem. The design came out of an architect arena: four candidate designs from four models on one brief and one rubric, scored by a cross-judge from a fifth model run. None of these files is in this repository, because they name client projects. The mechanisms they found are restated below.
- **Precedent:** [ADR-0033](0033-envision-a-divergent-step-before-context-builder.md) gave a new skill a measured code ceiling and fixtures. ADR-0030 gives *The corpus is split by visibility*: real history stays private behind an opaque `private_ref`. ADR-0029 gives a live check that proves on the real tool rather than a proxy. ADR-0026 decisions 1-2 set a byte budget for every session-resident file.

## Context

The owner repeats one environment separation across Flutter apps. Five criteria define it:

1. Distinct application ids, so the environments install side by side.
2. Distinct launcher icons and display names.
3. A top-left banner naming the environment, `ENVLESS` when none is set.
4. A Firebase setup per environment. Production must have its own project, and the others may share one.
5. Environment variables in gitignored `env/<env>.json` files passed with `--dart-define-from-file`.

The reference app reached that state by hand, in one 224-file commit followed by about 30 more environment commits over five months, and it still carries 30 defects. Examples: one display name spelled four ways, Gradle `resValue` labels the manifest never reads, envless Make targets that cannot build because nothing sets `default-flavor`, a local production env file pointing at the non-production Firebase project, and a stale `firebase.json`.

An earlier automation attempt failed. An orchestrator plan of 54 tasks produced a 1,108-line interactive bash wizard and 26 shell tests. It was "not fully working", and the owner redid the work by hand the same afternoon. It had six faults:

- W1. It prompted for every value.
- W2. It chose a single iOS scheme, which Flutter does not support.
- W3. It copied icons at build time.
- W4. It generated the Firebase options from the env file at build time.
- W5. It checked its idempotency sentinel in a different comment syntax than it wrote, so a re-run duplicated the Gradle block.
- W6. Its acceptance criteria never ran on a build.

The survey found the same criteria met in only three of 38 first-party apps, and nine distinct implementation variants. Projects keep tripping over the same few defects:

- Per-flavor icons that are byte-identical to production's.
- `google-services.json` files missing the flavor's package.
- A banner constant that does not match the env file.
- An `env/.gitignore` that ignores itself.
- A scheme that builds another flavor.

The platform also moved:

- AGP 9 turns `resValues` off (Flutter 3.44+).
- SwiftPM is on by default from 3.44, and the CocoaPods registry goes read-only on 2026-12-02.
- `flutter: default-flavor:` exists from 3.24.
- Xcode-started builds reuse the last CLI run's defines.

## Decision

### 1. `flutter-envs` is a new, standalone skill, and the first that edits a target project

It has five verbs on one CLI, `scripts/envs.cjs`: `check`, `apply`, `firebase`, `verify` and `recipe`. It is not a pipeline step and reads no other skill's files. It never commits, pushes, stashes or resets. Its changes stay in the working tree for `git diff`. The rule it adds to the house: **code writes absent files, owned blocks and recognised shapes; recipes write the rest; the evaluator proves both.**

### 2. One committed spec, `flutter_envs.json`, checked against every artifact on every run

The spec holds only what the project cannot reveal. That is the environments, the id, display name and Firebase project of each, and which one is production. The skill drafts it from the project, so an already-configured app types nothing. A fresh app answers at most four questions in one round, two in the common case. `parseSpec` refuses a production Firebase project equal to any other environment's. Production isolation is therefore a parse-time invariant, and no writer ever sees a spec that shares it.

The arena's best-measured candidate argued for no spec, with `.firebaserc` aliases as the only record. The cross-judge's argument for a spec won on two facts. Production's project cannot be derived locally, because its native files are CI-provided by design. And an evaluator with no expected value can detect the reference app's four-way display-name drift but cannot say which spelling is right. A spec drafted from the project and checked on every run is a contract, not a hand-synced list.

### 3. The evaluator: one matrix, one closed registry, exact-set cases

One structure, keyed by facet and then by environment, feeds evaluation, edits, the report and the checklist. Every finding is a code in one registry (`vocab.cjs`, 80 codes). Each code records its criterion, severity (`defect`, `gap`, `note`), fix (`edit`, `recipe`, `cli`, `human`, `none`) and source tag (a reference-app defect number, a wizard fault, a survey trap, a platform fact). Every code has exactly one case in `__tests__/fixtures/cases.cjs`. The case builds a project from a pristine template bundle plus one mutation, and asserts the **exact set** of codes it reports, so a false positive fails as surely as a miss. Readers are pure over file text, so CI runs them on ubuntu with no Flutter, Xcode, Ruby or Swift.

### 4. Writes have an ownership class, and `apply` rolls back on red

Every byte the skill writes belongs to one of four classes:

- **A new file.** Written when absent. An existing one that differs is a `conflict`, never overwritten.
- **A managed block.** `flutter-envs:begin <id> sha=<8 hex>` … `flutter-envs:end <id>`. An edited body is a `conflict`, never overwritten.
- **A surgical edit on a recognised shape.**
- **Foreign.** Never edited by code.

One function writes and reads the marker for every comment syntax, so W5 cannot recur, and a test round-trips each syntax. Before writing, `apply` refuses any tracked target with uncommitted changes (`--allow-dirty` overrides). It journals the before-bytes in memory, re-evaluates after writing, and restores every file when a finding its edits claimed to fix stays open. Writes are atomic. Env files are backed up before a value changes, because git cannot restore them.

### 5. iOS by Node text splice, in the reference app's layout

`project.pbxproj` is parsed with byte offsets and edited by splicing. It is never re-serialised, object ids are deterministic, and an edit is accepted only if it adds no structural fault the file did not already have. The arena measured the splice on 25 of 25 unflavored corpus projects: `plutil -lint` passed and a re-run was byte-identical. Xcode and `flutter build ios --config-only` accept the result. The Ruby xcodeproj gem was rejected. CI cannot run it, it comes with CocoaPods, which is in decline, and opening and saving a project with it churns a comment.

The layout is the reference app's:

- The template's `Debug`, `Profile` and `Release` are renamed to `<Mode>-<production>`, and the others are clones.
- There is one shared scheme per environment, cloned from `Runner.xcscheme` so the SwiftPM pre-action survives.
- Identity lives in Runner target settings, with `CFBundleDisplayName = $(DISPLAY_NAME)`.
- Each configuration gets a base xcconfig, `<Mode>-<env>.xcconfig`, that includes its flavored Pods xcconfig. Without that layer the renamed configurations lose every Pods setting (measured).

### 6. The Firebase plist reaches the app through one phase, keyed on the configuration suffix

One Run Script phase after Copy Bundle Resources copies `ios/config/${CONFIGURATION##*-}/GoogleService-Info.plist` into the built app. It fails the build, naming the file and the CI variable, when the file is missing. It holds no list of environments, and nothing lands in the source tree. Measured on a simulator build: the dev and production builds carry their own plist, `codesign --verify --strict` passes, and a missing file stops the build with that message. A recognised existing two-phase copy (the reference app's) is adopted, not replaced.

### 7. Android, env files, Make and the default flavor follow the reference app

- **Android.** One `env` dimension with a full `applicationId` per flavor. Names come from per-source-set `strings.xml` under the key the manifest reads. No `resValue`, which AGP 9 rejects.
- **Firebase on Android.** A guard fails a flavor build whose `google-services.json` is missing, naming the file and the CI variable.
- **Env files.** `env/.gitignore` with `*`, `!.gitignore` and `!sample.json`, and an empty sample.
- **Make.** A managed Make block with the reference app's targets, plus an `xcode-config` target that refreshes `Generated.xcconfig` before Xcode or fastlane builds.
- **Default flavor.** `default-flavor` names the first non-production environment, so plain `flutter run` and `flutter test` work and the envless targets stop failing.

### 8. Icons by a pure Node PNG codec, owned by pixel equality

Each production icon file is decoded, banded and labelled at its own size with a built-in stroke font, then encoded into the environment's directory. Adaptive foregrounds keep the band inside the 66 of 108 safe zone, and the iOS marketing icon is written opaque. A generated icon is ours exactly when its decoded pixels equal what would be written. Bytes are not compared, because zlib output may differ across Node versions. A CoreText renderer was rejected because its output is not stable across macOS versions, and it cannot run in CI or off a Mac.

### 9. The Dart side: `Env`, `EnvBanner`, options from `Env`

`EnvBanner` is the reference app's widget with these changes:

- A `flavor` parameter that defaults to `appFlavor`.
- A trimmed, case-insensitive production comparison.
- It never drops the app.
- A red `MISMATCH` banner when a non-empty `NAME` disagrees with the flavor. An empty `NAME` is ENVLESS, never a mismatch.

`firebase_options.dart` reads `Env`, which is the owner's decision. Wiring is one insertion into a single `MaterialApp(` call with no `builder:`. Anything else is a recipe.

### 10. The Firebase leg: the CLI, a plan id, derived env keys

The skill calls the `firebase` CLI directly and never FlutterFire. FlutterFire writes literal options, the owner's decision rejects those, and its bundle phase silently skips a missing configuration.

- `firebase --plan` runs only read-only lookups and prints the writes with a plan id.
- `firebase --confirm <id>` runs nothing unless the plan still hashes to that id, so consent binds to the exact commands.
- The skill never creates a project, links billing or registers an Apple id. Those are checklist steps.
- Each `FIREBASE_*` env key is derived from the environment's native files and compared by digest on every run. A disagreement is rewritten from the native file after a backup. A value that would depend on the machine, such as an Android OAuth client chosen by the local debug keystore, is left alone and reported.

### 11. Verification reads real artifacts, and `not-run` is never `pass`

`verify` has three tiers:

- **`static`.** The evaluator again.
- **`config`.** `xcodebuild -showBuildSettings` per flavor, `flutter build ios --config-only`, the Gradle variant list and the google-services task, the banner widget test and `make -n`.
- **`build`.** Simulator and debug APK builds per flavor, read through `aapt2 dump badging` and the built `Info.plist` and `GoogleService-Info.plist`. Icon hashes differ across flavors, and production's build fails with the guard's own message when its files are absent.

A missing tool gives `not-run` with its reason.

### 12. Budgets

| Entry | Ceiling | Why |
|---|---|---|
| `flutter-envs/SKILL.md` | 12,288 bytes | the whole file under the smallest measured compaction cut, like envision |
| `flutter-envs/references/recipes.md` | 6,144 bytes | read once per recipe finding |
| `flutter-envs/references/firebase.md` | 6,144 bytes | read once per Firebase run |
| `code.flutter-envs` | 7,372 lines, measured across `scripts/**/*.cjs` | as ADR-0033 set envision's |

## The owner's decisions

Taken 2026-10-20:

1. The name is `flutter-envs`.
2. Dart Firebase options come from `env/<env>.json`, filled from the native files and cross-checked on every run.
3. The only run and build entry points are Makefile targets.

On 2026-10-21 the owner granted the build full autonomy. These defaults were applied and are recorded as defaults:

- The spec is committed with each app.
- The plain iOS configurations are renamed.
- Production's Firebase files stay gitignored and CI-written.
- Non-production Firebase is shared, and this is asked when nothing decides it.
- The `MISMATCH` guard is on.
- The badge is a generated bottom band.
- `default-flavor` is on.

## Alternatives considered

- **No spec, the project as the only state** (with `.firebaserc`). Rejected in decision 2.
- **The Ruby xcodeproj gem.** Verified idempotent, but CI cannot run it, its prerequisite is declining, and it churns a comment (decision 5).
- **Swift CoreGraphics or Pillow icons.** They look better, but their output is not deterministic and they cannot run in CI (decision 8).
- **Wrapping flutter_flavorizr, flutter_launcher_icons or FlutterFire.** flavorizr overwrites `lib/main.dart` by default and warns against existing projects. flutter_launcher_icons leaves the per-flavor iOS icon name unset for the documented layout. FlutterFire is rejected in decision 10.
- **An evaluator with agent-only edits.** It moves the wizard's failure, hand surgery with no idempotency argument, from bash into the agent.
- **Generator scripts left in the project.** That is the wizard's shape (W3, W4).
- **Keeping the plain configurations beside the flavored ones.** It leaves an unflavored build path and a fourth identity.
- **iOS identity in skill-owned xcconfig files.** A target-level setting beats the xcconfig, so any Xcode UI edit would silently win (measured).

## Admission

ADR-0026's rule holds this skill to a replay fixture for every touchpoint, gate, status and proof result. `vocab.cjs` lists them in `ADMITTED`, and `admission.test.mjs` fails on a listed value with no entry. Finding codes are not admitted one by one. The exact-set case suite holds each code, and the private history replay holds the registry as a whole.

| `ADMITTED` | Values | Fixture | Test that executes it |
|---|---|---|---|
| `TOUCHPOINTS` | `decide` | `flutter-envs-decide` | `spec.test.cjs` |
| | `firebase-consent` | `flutter-envs-firebase-consent` | `firebase-cli.test.cjs` |
| | `build-consent` | `flutter-envs-build-consent` | `verify.test.cjs` |
| `GATES` | `clean-tree` | `flutter-envs-clean-tree` | `safety.test.cjs` |
| | `managed-conflict` | `flutter-envs-managed-conflict` | `managed.test.cjs` |
| | `convergence` | `flutter-envs-convergence` | `converge.test.cjs` |
| | `rollback` | `flutter-envs-rollback` | `converge.test.cjs` |
| | `production-isolation` | `flutter-envs-production-isolation` | `spec.test.cjs` |
| `STATUSES` | `ok`, `partial`, `absent`, `n/a` | `flutter-envs-status` | `criteria.test.cjs` |
| `RESULTS` | `pass`, `fail`, `not-run` | `flutter-envs-proof` | `verify.test.cjs` |

Every fixture is `synthetic`. Each one names the CI test that executes it and cites a decision above. `flutter-envs-status` also carries the opaque `private_ref` of the history replay. Fresh-app acceptance separately measures the real CLI and build tiers.

## Real history replay

The reference app's history was replayed privately. The replay took nine commits: the seven environment milestones and the wizard's two. Each was extracted with `git archive`, committed into a scratch repository so its ignore rules apply, and checked read-only. The expectation was written from the private inventory before the first run.

- **First run.** Recall 144 of 148 (97.3%) and precision 144 of 150 (96.0%). The divergences:
  - two tool defects, now fixed: the placeholder-id rule was suppressed on plain iOS configurations, and a build-mode gate was read from an unrelated `kDebugMode` above `runApp`;
  - one expectation error, now corrected: a sample-drift prediction that the wizard's sample does not support;
  - one real defect the expectation missed, now added: production fell back to a root `google-services.json` that lacks its package.
- **Current run.** All 11 replay snapshots match after the banner-corner split, with recall and precision 1.0 in each of the six classes.
- **What it cannot see.** Untracked files, such as the local env files, are absent from an archive. Those findings are checked on the working tree instead.

The expectation, its correction log and the report stay private behind `private_ref` `flutter-envs-history-replay`.

A corpus of 47 Flutter apps on the owner's machine was checked read-only. The final category agreements are ids 46/47, identity 44/47, banner 47/47, firebase 40/47 and envfiles 31/47. The final 27 deltas are classified privately (24 stricter rules, one design choice and two cases where the skill is right). At Increment 1 the agreement was ids 77%, identity 91%, banner 98%, firebase 85%, envfiles 43%; its 50 initial disagreements were classified:

- 27 are tool defects, fixed in Increment 2;
- 10 are stricter rules that also hit a tool defect;
- 11 are stricter rules the classifier does not apply;
- 1 is a design choice;
- 1 is a case where the skill is right and the classifier wrong.

## Consequences

- A project the skill touched has one more committed file, `flutter_envs.json`, and the owner commits it with the rest of the diff.
- iOS writes need nothing beyond Node. Icons need nothing beyond Node. The `config` and `build` tiers need the platform tools, and answer `not-run` where those are absent.
- **Not enforced here, and named so nobody assumes they are:**
  - an Xcode UI round trip or an archive of a patched project
  - a device install
  - a Firebase write against a real project, which the owner's first run exercises behind the plan id
- **The falsifier.** Any of these disproves the decisions above:
  - a second `apply` that changes a byte on a fixture
  - a spec that shares production's project and still reaches a writer
  - a managed block with a mismatched sha that gets overwritten
  - `verify` reporting `pass` for a check that did not run
  - `SKILL.md` over its ceiling on `main`
