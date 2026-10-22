# flutter-envs: design

**Date:** 2026-10-21
**Status:** synthesized design, Inc 1 in implementation
**Author:** an architect arena of four candidate designs (four models, one brief), synthesized onto one base with grafts; owner decisions taken 2026-10-20 (§1)
**Decision record:** ADR-0035 (lands with Inc 1)

This repository is public. Nothing below names a client project, a real bundle id or a real Firebase project. The survey corpus, the reference app's history and the arena record are kept privately, and fixtures cite them only by an opaque `private_ref` (ADR-0030, *The corpus is split by visibility*). Examples use `com.acme.shop`.

---

## 0. Summary

`flutter-envs` is the first skill here that edits a target project's native configuration. It reads a Flutter app's environment separation, converges the parts code can close, proves the result against real build settings and artifacts, and prints the steps only a person can take. The owner's five criteria are:

1. **Ids.** A distinct application id per environment, so the environments install side by side.
2. **Identity.** A distinct launcher icon and display name per environment.
3. **Banner.** A top-left banner naming the environment outside production, `ENVLESS` when no environment is set. Flutter's own debug banner stays top-right.
4. **Firebase.** Each environment is configured on its own. Production must have its own Firebase project. Non-production environments may share one, which is asked or configured.
5. **Env files.** Environment variables live in `env/<env>.json`, kept out of git and passed with `--dart-define-from-file`.

The reference is the owner's most recent hand-built setup (Toodls). The skill reproduces its design, not its defects. An earlier attempt failed: a 1,108-line interactive bash wizard built by an orchestrator plan. It prompted for every value, chose a single iOS scheme, copied icons at build time, generated the Firebase options at build time, and checked its idempotency sentinel in a different comment syntax than it wrote, so a re-run duplicated the Gradle block. §8.4 maps each of those faults to the structure that prevents it here.

## 1. Owner decisions (2026-10-20)

1. The skill is `flutter-envs`, invoked as `/flutter-envs`.
2. Dart-side Firebase options come from `env/<env>.json`. `lib/firebase_options.dart` reads `Env.FIREBASE_*` constants. The skill fills those keys from each environment's native Firebase files and cross-checks env against native on every run.
3. Run and build entry points are Makefile targets only (`make run-debug env=dev`, with the env file as a prerequisite). The skill writes no `launch.json` and no IDE run configuration.

## 2. Usage

### 2.1 What the owner types

```text
/flutter-envs                  check, ask what is open, converge, prove, hand back a checklist
/flutter-envs check            evaluate only; writes nothing
/flutter-envs add <env>        add <env> to flutter_envs.json, then the same run
/flutter-envs verify [--build] prove the setup on this machine; --build builds every flavor
Flags: --app <dir> (monorepos)   --text (numbered questions instead of pickers)
```

The skill needs no file from the user. On the first run it drafts `flutter_envs.json` from the project (§3.7), asks at most four questions in one round for what the project cannot say, and records every default with its basis. A fresh `flutter create` app asks two: the production id (the template id is a placeholder) and whether to keep the default environments. An already-configured project types nothing.

### 2.2 What the agent runs

```text
node "$skill_dir/scripts/envs.cjs" check    [--app <dir>] [--set k=v]... [--only c,...] [--json] [--all] [--explain <code>]
node "$skill_dir/scripts/envs.cjs" apply    [--app <dir>] [--set k=v]... [--dry-run] [--allow-dirty] [--json]
node "$skill_dir/scripts/envs.cjs" firebase [--app <dir>] [--set k=v]... (--plan | --confirm <plan-id>) [--json]
node "$skill_dir/scripts/envs.cjs" verify   [--app <dir>] [--tier static|config|build] [--env <e>] [--json]
node "$skill_dir/scripts/envs.cjs" recipe   <id> [--app <dir>]
```

`--set` takes one closed vocabulary (§3.4) and refuses an unknown key or a malformed value. On `apply`, the answers are written into `flutter_envs.json` (created from the draft when absent) before anything else, so the spec is the one place a decision lives. `check --only` filters the report to one criterion, for the agent's recipe loop. stdout carries data: a text report of at most 80 lines, or JSON with `--json`. stderr carries diagnostics. Exit 0 is success. Exit 1 is a conflict, a failed proof or a rolled-back apply. Exit 2 is usage, a refused gate or an unreadable file. `apply --dry-run` prints a unified diff of every planned change and writes nothing. `recipe <id>` prints a recipe's snippet with the project's values filled in, for the agent-applied edits (§5).

### 2.3 The run (SKILL.md phases)

| Phase | What happens | Ends when |
|---|---|---|
| 0 Locate | Find the app: a `pubspec.yaml` with `flutter: sdk: flutter` beside `android/` or `ios/`, at most three levels down. Probe the tools and read the git state. Refuse below Node 22 and below Flutter 3.24. | The app root, the tool map and the clean-tree verdict are known |
| 1 Check | `check` builds the matrix, derives inputs with provenance, runs the criteria, and prints the report | The report is printed |
| 2 Decide | Only when `flutter_envs.json` is absent or incomplete. One round of at most four questions, each with a default and its basis. The answers become `--set` flags | Every spec field has a source |
| 3 Apply | `apply` writes or updates `flutter_envs.json`, runs edits in dependency order, re-reads, plans again and stops when the plan is empty. It rolls back if a check its edits should satisfy stays red | `converged: true`, or the leftovers named |
| 4 Recipes | Only for `recipe` findings. The agent follows `references/recipes.md` (and `recipe <id>`), then re-runs `check` as the acceptance test | No recipe finding left, or each named as the owner's call |
| 5 Firebase | Only when Firebase is in use. `firebase --plan`, one consent naming every command, then `firebase --confirm <id>` | Apps exist, config files placed, env keys derived, or the commands handed over as steps |
| 6 Prove | `verify` at the config tier, then the build tier on consent | Every check reads `pass`, `fail` or `not-run` with a reason |
| 7 Handoff | Print the receipt, the matrix, the leftovers, the checklist and the next commands | Printed. Nothing committed |

## 3. Data shapes

### 3.1 Closed vocabularies (`scripts/lib/vocab.cjs`, the only copy)

```js
CRITERIA   = ['ids', 'identity', 'banner', 'firebase', 'envfiles']   // reported as 1-5; 'repo' holds the rest
SEVERITIES = ['defect', 'gap', 'note']    // defect: ships a wrong env or breaks a build. gap: a criterion unmet. note: confirm intent
FIXES      = ['edit', 'recipe', 'cli', 'human', 'none']
STATUSES   = ['ok', 'partial', 'absent', 'n/a']
CHANGES    = ['created', 'updated', 'unchanged', 'conflict', 'skipped']
RESULTS    = ['pass', 'fail', 'not-run']
TIERS      = ['static', 'config', 'build']
SOURCES    = ['derived', 'default', 'asked']
INPUT_KEYS = ['envs', 'production', 'appName', 'prodId', 'androidId', 'iosId', 'labels', 'bannerGuard', 'icons',
              'defaultFlavor', 'firebase.nonprod', 'firebase.projects', 'firebase.productionFiles', 'firebase.refresh']
QUESTIONS  = ['prodId', 'envs', 'firebaseNonprod', 'firebaseProd', 'appName']
FINDINGS   = { [code]: { criterion, severity, fix, source, summary } }   // the registry, §6
CONVENTIONS                                                              // §4
```

Every other file imports these. No second copy exists, so nothing has to be checked equal to them.

### 3.2 The environment matrix

One structure feeds evaluation, edits, the report and the checklist. It is keyed by facet, then by environment, and has three access patterns. A column read asks whether ids are distinct and whether a cell is missing. A row read renders one environment and builds its checklist. A pair read asks whether one environment's Android id equals its iOS id.

```ts
type Env = string                   // parsed once against /^[a-z][a-z0-9]*$/, not main|test|androidTest|debug|release|profile
type At  = string                   // 'path:line', or 'path' for a whole-file fact
interface Cell<T> { value: T; at: At }
interface FacetValue {
  androidId:   string
  iosId:       { byConfig: Record<string, string> }              // Debug-x, Profile-x, Release-x, resolved through target, xcconfig chain, project
  androidName: { key: string; value: string }                    // the key the manifest reads, and this flavor's value for it
  iosName:     { variable: string | null; byConfig: Record<string, string> }
  androidIcon: { files: number; sameAsMain: boolean }
  iosIcon:     { set: string; exists: boolean; digest: string | null }
  scheme:      { launch: string; archive: string; shared: boolean; prepareAction: boolean }
  fbAndroid:   NativeFirebase
  fbIos:       NativeFirebase
  fbEnv:       { projectId: string | null; keys: string[]; digests: Record<string, string> }   // names and 8-hex digests only
  envFile:     { keys: string[]; name: string | null; tracked: boolean; ignored: boolean }
}
interface NativeFirebase { projectId: string; appId: string | null; ids: string[]; ciProvided: boolean; file: string; digests: Record<string, string> }
interface Matrix {
  envs: Env[]                       // union of every source, production last
  production: Env | null
  cell(facet, env): Cell | null
  column(facet): Array<[Env, Cell | null]>
  row(env): Partial<Record<facet, Cell>>
}
```

Facts that are not per environment sit beside the matrix in `facts`, one record per writer. These are the banner, the `Env` class, the Flutter version, `default-flavor`, the CocoaPods mode, the Makefile, the Podfile map and tracked signing files. Readers are pure over the text that `io.read` supplies, so tests feed them strings.

**Secrets never enter the matrix, a report or the context.** Env and Firebase values enter as 8-hex digests. Key names, ids, project ids and paths are printed. Values are not.

### 3.3 Findings and the report

```ts
interface Finding { code: keyof FINDINGS; env: Env | null; claim: string; at: At[]; ref?: string; blocked?: 'foreign' | 'conflict' | 'input' }
interface CriterionReport { status: Status; variant: string; findings: Finding[] }
interface Report { schema: 1; project; tools; spec: { source: 'file' | 'draft'; fields: Record<string, Input> }; matrix; criteria: Record<Criterion, CriterionReport>; repo: Finding[]; questions: Question[];
                   plan: { edits: EditSummary[]; recipes: string[]; remote: RemoteStep[]; steps: Step[] } }
```

A finding carries only what varies. Severity, fix, criterion and provenance come from `FINDINGS[code]` and are never copied. One function derives each criterion's status. `n/a` means the criterion cannot apply (no Firebase dependency and no native Firebase file). `absent` means every facet it reads is empty. `ok` means no `gap` or `defect` remains. Anything else is `partial`. Notes never change a status.

### 3.4 The spec draft, provenance, questions

When `flutter_envs.json` is absent, `check` drafts it. Each drafted field is an `Input` with its provenance, and the report lists the fields that are not `derived`.

```ts
interface Input<T> { value: T; source: 'derived' | 'default' | 'asked'; at?: At; basis?: string }
```

| Field | Drafted from | Default and basis | Asked when |
|---|---|---|---|
| environments | the union of Gradle flavors, iOS configuration suffixes, `env/*.json` names, Firebase folders and schemes | dev, staging, production (the owner's most common set) | only when nothing exists yet |
| `production` | the environment named `production`, `prod`, `prd` or `live` | none | zero or several candidates |
| names | the effective per-environment labels (the manifest's key per source set, `CFBundleDisplayName` resolved per configuration). When none exists: `appName` plus the environment's title for non-production, where `appName` is a literal `CFBundleDisplayName`, else a literal Android label, else the Title Case of the pubspec `name` | as derived | the label is a placeholder, or two effective sources disagree |
| ids | the effective Android `applicationId` and iOS bundle id per environment. When none exists: the production id plus `.<env>` | none for production | production's id is a `com.example` placeholder |
| `badge` per non-production environment | none | dev DEV, staging STG, qa QA, uat UAT, test TEST, else three consonants upper-cased. Colors cycle `2E7D32 E65100 6A1B9A 1565C0 AD1457 00695C` | never |
| `firebase` per environment | the native files, then env JSON, then a literal in `firebase_options.dart` (each disagreement a finding) | non-production: one shared project (the owner's usual layout) | Firebase is in use, there are two or more non-production environments, and no native file decides it. Production's id: whenever it is unknown |

Two settings are not spec fields. `bannerGuard` is on, because Xcode-started builds reuse the last CLI run's defines. `firebase.productionFiles` is `ci`, meaning production's files are gitignored and CI writes them. Both take `--set` to opt out.

### 3.5 Edits, changes, receipt

```ts
interface Edit    { id: string; writer: Writer; op: string; args: unknown; requires: string[]; summary: string }   // id '<writer>.<op>[:<env>]'
interface Change  { writer: Writer; file: string; state: Change; before?: string; after?: string; note?: string }   // before/after are sha1 prefixes
interface Receipt { schema: 1; changes: Change[]; converged: boolean; rolledBack: boolean; leftovers: Finding[]; undo: { restore: string[]; remove: string[] } }
```

A criterion emits edits as data, and a writer turns them into file changes. `undo` is two printed lists, the files git can restore and the files the run created. The skill runs neither.

### 3.6 Steps and checks

```ts
interface Step  { id; where: 'console' | 'apple' | 'play' | 'ci' | 'terminal' | 'device'; title; do: string[]; why; blocks: string[];
                  done: (ctx) => boolean | null }          // true closes it, false keeps it, null: cannot be checked from here
interface Check { id; tier; env; platform; expect; run: () => Promise<{ result: 'pass' | 'fail' | 'not-run'; got?: string; why?: string }> }
```

### 3.7 Persistence: one committed spec, checked every run

`flutter_envs.json` sits at the app root and is committed. It holds only the decisions the project cannot reveal on its own.

```json
{
  "version": 1,
  "production": "production",
  "environments": {
    "dev":        { "id": "com.acme.shop.dev",     "name": "Shop Dev",     "firebase": "acme-dev-staging" },
    "staging":    { "id": "com.acme.shop.staging", "name": "Shop Staging", "firebase": "acme-dev-staging" },
    "production": { "id": "com.acme.shop",         "name": "Shop",         "firebase": "acme-prod" }
  }
}
```

Optional per-environment fields are `iosId` (only when the iOS bundle id must differ from `id`), `badge` (`{ "label": "DEV", "color": "2E7D32" }`), and `firebase: null` (Firebase is in use and the project is not created yet). Without Firebase, the `firebase` fields are absent. Key order is the generation order.

`parseSpec` runs once at the boundary and refuses, one stderr line per reason. It refuses names that break `Env`, a `production` that names no environment, no other environment, ids that are not valid on both platforms (segments start with a letter, no `_` for iOS), ids or names that repeat, a name containing `//` or `"`, and unknown keys. **It refuses a production `firebase` id equal to any other environment's.** Production isolation is therefore a parse-time invariant: a spec that shares production's project never reaches a writer. Inside the scripts a parsed spec is trusted.

Why a spec and not "the project is the state" (rejected in the arena). Production's Firebase project cannot be derived locally, because its native files are CI-provided by design. And drift needs an expected value: the reference app carried one display name in four places, and an evaluator with no spec can detect that but not say which value is right. The spec is not a hand-synced list. It is drafted from the project, so a configured project types nothing, and every run checks it against every artifact. `default-flavor` lives once, in `pubspec.yaml`, where Flutter reads it. A declined item is not remembered. It stays a finding and returns until its artifact exists.

## 4. Conventions (`CONVENTIONS`, for new setups only)

An existing project that spells a convention differently is adopted, not rewritten. The reader finds the key the manifest already reads and the variable `Info.plist` already uses, and the criteria compare against those.

| What | New setups get |
|---|---|
| Flavor dimension | `env`, with `dimension = "env"` on every flavor and a full `applicationId` per flavor. Production equals the base id. No suffix and no `resValue`, because AGP 9 turns `resValues` off |
| Android display name | `@string/app_display_name`, set by a new `src/<env>/res/values/strings.xml` per non-production flavor and a managed block in `src/main/res/values/strings.xml` |
| iOS configurations | the template's `Debug`, `Profile` and `Release` renamed to `<Mode>-<production>` in the project, Runner and RunnerTests lists, with `defaultConfigurationName` following. The other environments are clones |
| iOS schemes | one shared scheme per environment, named exactly like it and cloned from `Runner.xcscheme` (which keeps the SwiftPM pre-action). `Runner.xcscheme` becomes `<production>.xcscheme` |
| iOS identity | per-configuration Runner target settings `PRODUCT_BUNDLE_IDENTIFIER`, `DISPLAY_NAME` and `ASSETCATALOG_COMPILER_APPICON_NAME`. `Info.plist` `CFBundleDisplayName = $(DISPLAY_NAME)`. The display name is set on every configuration |
| iOS base xcconfigs | when a Podfile exists, one `ios/Flutter/<Mode>-<env>.xcconfig` per configuration: `#include?` of the flavored Pods xcconfig, then `#include "Generated.xcconfig"`, plus any extra include the template's `Debug.xcconfig` or `Release.xcconfig` carries, minus its plain Pods include. Without this layer the renamed configurations lose every Pods setting (measured: `PODS_ROOT` vanishes). A SwiftPM app has no Pods settings to carry, so it gets the layer only once a Podfile arrives |
| Podfile | when a Podfile exists, a managed `project 'Runner', { '<Mode>-<env>' => :debug or :release }` map |
| iOS icon sets | production keeps `AppIcon`. Other environments get `AppIcon-<env>` |
| Firebase files | `android/app/src/<env>/google-services.json` and `ios/config/<env>/GoogleService-Info.plist`. Production's are gitignored by exact path and CI writes them |
| Firebase on iOS | one Run Script phase after Copy Bundle Resources. It copies `ios/config/${CONFIGURATION##*-}/GoogleService-Info.plist` into the built app and fails loudly, naming the CI variable, when the file is missing or the configuration has no environment suffix (§7.4) |
| Env files | `env/.gitignore` = `*`, `!.gitignore`, `!sample.json`. `env/sample.json` = `NAME` plus every key Dart reads, all empty. `env/<env>.json` = the sample with `NAME` set to the environment upper-cased |
| Default flavor | `flutter: default-flavor: <first non-production env>` in `pubspec.yaml`, inserted on the line right after `flutter:` |
| Make | a managed block with `env ?= <default>`, fvm detection, a pattern rule that turns a missing `env/<env>.json` into a readable error, `run-debug`, `run-profile`, `run-release`, `run-debug-envless`, `run-release-envless`, `build-apk`, `build-appbundle`, `build-ipa`, the three `build-obfuscate-*` targets, and `xcode-config` (`flutter build ios --config-only`, run before opening Xcode or fastlane so stale defines cannot leak) |
| Dart | `lib/env/env.dart` (`Env` with one `static const` per key), `lib/env/env_banner.dart`, `test/env_banner_test.dart`, and `lib/firebase_options.dart` reading `Env` when Firebase is in use |
| CI variables named in the checklist | `GOOGLE_SERVICES_JSON_<ENV>`, `GOOGLE_SERVICE_INFO_PLIST_<ENV>`, `ENV_<ENV>_JSON` |

## 5. Who writes what

### 5.1 Code or agent, part by part

| Part | Done by | Why |
|---|---|---|
| Reading every format (Gradle, pbxproj, xcconfig, plist, XML, JSON, gitignore, Dart facts) | code | Verdicts must rerun the same and be calibrated against a corpus |
| Matrix, findings, status, questions, checklist | code | Pure functions. The agent relays them |
| Gradle flavor block, guard, plugin lines | code | A managed block at a fixed anchor, validated by Gradle in the live suite |
| pbxproj, schemes, base xcconfigs, Podfile map, `Info.plist` key | code | List membership and object ids are what hand edits get wrong |
| `strings.xml`, manifest label, launcher icons, icon sets | code | Byte-deterministic from the inputs |
| `flutter_envs.json`, `env/` files, ignores, Makefile block, `default-flavor` | code | Mechanical |
| `FIREBASE_*` env keys | code | A projection of the native files, never a decision |
| Firebase CLI calls | code, behind a plan id | The script, not the host's per-command prompt, enforces what the user consented to |
| `Env`, `EnvBanner`, its test and `firebase_options.dart` from templates, and the simple wiring (one `MaterialApp(` call with no `builder:`) | code | New files and one insertion into a predictable shape |
| Wiring when `builder:` exists, an adopted banner that fails a rule, a hand-edited `firebase_options.dart`, legacy marker blocks, dead `resValue` lines, existing Make targets, a commented duplicate flavor block, destructive template targets | agent, from `references/recipes.md` | User-owned code whose shape varies. The next `check` is the acceptance test. A `recipe` finding is never promoted to `edit` |
| CI files | printed in the checklist | A bad CI edit has a large blast radius |

### 5.2 Four ownership classes

| Class | Examples | Rule | Re-run |
|---|---|---|---|
| New file | `env/.gitignore`, flavor `strings.xml`, icon sets, `<env>.xcscheme`, `<Mode>-<env>.xcconfig`, Dart templates | Write when absent. Present and equal to the render is `unchanged`. Present and different is `conflict`, never overwritten | converges |
| Managed block | Gradle flavors and guard, the Makefile block, `.gitignore` blocks, the `Env` Firebase region, the main `strings.xml` block, the Podfile map | `flutter-envs:begin <id> sha=<8 hex>` and `flutter-envs:end <id>`. The sha is the body as written. A recorded sha that equals the current body means the block is ours and stale, so `updated`. A recorded sha that differs means someone edited inside, so `conflict`, never overwritten | `unchanged` |
| Surgical edit | the iOS rename, clone and settings, `CFBundleDisplayName`, `android:label`, `defaultConfig.applicationId`, `default-flavor`, the `MaterialApp(` wiring, env key merges | only on a recognised shape. Setting a value to the desired value is idempotent by construction | `unchanged` |
| Foreign | a `productFlavors` the skill did not write, a generator's block (flutter_flavorizr), a legacy marker block, user keys in env JSON | never edited by `apply`. Read by the evaluator. A recipe may edit it with the diff shown | n/a |

One function writes and reads the marker, per comment syntax (`slash` for Gradle and Dart, `hash` for Make, gitignore and Podfile, `xml` for `strings.xml`). A test round-trips every syntax. The legacy `setup-flutter-envs: managed` marker is recognised read-only, and its block is `foreign`.

### 5.3 Safety

- **Clean targets.** Before writing, `apply` lists every tracked file it would modify and refuses with exit 2 when one has uncommitted changes, so `git diff` afterwards is exactly the skill's work. `--allow-dirty` overrides that, and only on the user's word.
- **Rollback.** `apply` keeps the before-bytes of every file it writes in memory. After the writes it re-evaluates. If a finding that one of its edits claimed to fix is still open, it restores every file it touched, sets `rolledBack`, exits 1 and names the finding.
- **Atomic writes.** Each write goes to a temp file and is renamed. A path outside the app root, or under `.git`, is refused.
- **Env backups.** Env files are untracked, so git cannot restore them. Before a value in an existing `env/<env>.json` changes, the file is copied to `env/.flutter-envs-backup/<env>.json.<timestamp>`, which `env/.gitignore`'s `*` covers.
- **Never.** It never commits, pushes, stashes, resets or runs `git clean` or `git rm`. It never runs `make unbootstrap`, `flutterfire configure`, `flutter_flavorizr` or a template's `configure-firebase.sh`. It never prints or stores a value from an env file, a Firebase API key or a keystore. It never creates a Firebase project, a billing link, an Apple identifier or a store record.

## 6. The finding registry

One table in `vocab.cjs`, about 70 to 80 codes grouped by criterion (`ids.*`, `identity.*`, `banner.*`, `firebase.*`, `envfiles.*`, `repo.*`). Each row is `{ criterion, severity, fix, source, summary }`. `source` marks where the class was seen: a numbered defect of the reference app's inventory, a fault of the failed wizard, a trap of the private survey corpus, a platform fact, or new in this design. It never names a client project. Every code has exactly one case in `__tests__/fixtures/cases.cjs`. A case builds a project from a pristine bundle plus one mutation and asserts the **exact set** of codes that appear, so a false positive fails as surely as a miss. For an `edit` code the case also asserts that the code is gone after `apply`. `structure.test.cjs` fails when a code has no case or a case names no code. `check --explain <code>` prints a row's summary and source, so `SKILL.md` lists no codes.

The defect classes the registry must cover, at a minimum, follow. Each is a real defect from the reference app, the wizard or the corpus.

- **ids.** No flavors. An environment missing on one platform. A shared or mixed id. A template id that survived. A scheme that builds another flavor, a scheme that is not shared, or one missing the SwiftPM pre-action. A flavor name the iOS `appFlavor` parse breaks. A Podfile map that is missing. A missing per-configuration Pods xcconfig layer. A commented duplicate flavor block. A legacy managed block. A block a foreign generator owns.
- **identity.** A literal manifest label. A name key the manifest or `Info.plist` does not read. A `resValue` label (dead, or broken on AGP 9). Icons missing, or byte-identical to production. One icon set for every environment. Alpha in the 1024 px marketing icon. Display names that drift between platforms or sources.
- **banner.** The banner missing or not wired. The wrong corner. No `ENVLESS`. Not hidden in production. A production constant that mismatches the production env file. A production branch that drops the app. A banner gated on `kDebugMode`. `NAME` disagreeing with `appFlavor`.
- **firebase.** Production unregistered. Production sharing a project, on any source. A native file missing, from another app, or misplaced. A root fallback file. A guard or plugin missing. The iOS delivery missing, ambiguous, skipping Profile, or using the wrong file name. Env disagreeing with native. Options not built from `Env`. A switch that falls back to production. A stale `firebase.json`. CI materialisation missing. Deployment targets below Firebase's minimums.
- **envfiles.** No env setup. An `env/.gitignore` that ignores itself. A missing or drifted sample. A sample holding one environment's values. A key Dart reads but no env file sets, or the reverse. A tracked or unignored real file. A missing `NAME`. Run targets not wired. A Make target that passes `--flavor` to a project with no flavors. A missing `default-flavor`. An envless target that breaks. A reserved `FLUTTER_` key. The legacy `.env.<env>` generation. `flutter_dotenv` bundling `.env` as an asset.
- **repo.** Flutter too old. Other platforms not separated. Destructive template targets. Tracked signing material. An unreadable file.

## 7. The criteria

Each criterion module exports `check(ctx) -> Finding[]`, `plan(ctx) -> Edit[]`, `steps(ctx) -> Step[]` and `prove(ctx) -> Check[]`, all pure. Writers are the only code that touches files.

### 7.1 Ids

Reads Gradle flavors (comments and strings masked first, Kotlin and Groovy, applied scripts, explicit or suffix ids), iOS configurations resolved through the xcconfig chain, schemes, the Podfile and the CocoaPods mode. Edits are `gradle.flavors` (a managed block after `defaultConfig {}`), `gradle.default-id`, `pbxproj.rename-plain`, `pbxproj.clone-flavors`, `pbxproj.set-settings`, `apple.xcconfig-files`, `pbxproj.base-xcconfigs`, `apple.podfile-map` and `apple.schemes`. A Groovy project with suffix-style ids keeps its block. A missing environment there is `blocked`, and a recipe names the lines.

### 7.2 Identity

Icons are badged in plain Node: a PNG codec (palette, grey, RGB and RGBA, 8-bit) and a stroke font. Every existing file of the production set is decoded, banded and labelled at its own size, then encoded into the environment's directory. There is no master image and no resampling. Android legacy and round icons get the full band. Adaptive foregrounds keep the band inside the 66 of 108 safe zone. The monochrome layer is left as it is. iOS copies `Contents.json` verbatim and badges every file it references, dark and tinted variants included. The 1024 marketing icon is written without alpha. Production is never badged. The output is byte-deterministic, so an existing icon is ours exactly when it equals what would be written. A different one is a `conflict` unless `--set icons=regen` is passed. Icon Composer `.icon` and webp sources become a step (on macOS, `sips` converts webp first).

### 7.3 Banner

The skill writes `lib/env/env.dart`, `lib/env/env_banner.dart` and `test/env_banner_test.dart` when no `Env` or banner exists, and reuses an existing `Env` class and its path when one does. The widget is the reference app's `EnvBanner`, with these changes.

- `Banner(location: BannerLocation.topStart, layoutDirection: TextDirection.ltr, textDirection: TextDirection.ltr)`, so it sits top-left whatever the locale. Flutter picks the corner from `layoutDirection`. With `textDirection` alone the banner paints top-right under a right-to-left locale (measured on 3.27.3 and 3.47.4), so the reader counts a banner as pinned only when `layoutDirection` is `ltr`.
- The message is `NAME`, or `ENVLESS` when `NAME` is empty. There is no banner when `NAME` equals the production name, compared trimmed and case-insensitively.
- It wraps `child ?? const SizedBox.shrink()` and never drops the app.
- `flavor` is a constructor parameter that defaults to `appFlavor`. Every shipped test passes it, because `default-flavor` makes `flutter test` run with `appFlavor == 'dev'`.
- When `bannerGuard` is on, `appFlavor` is set and `NAME` is not empty, a `NAME` that disagrees with the flavor shows a red `MISMATCH` banner in every build mode. A release archive started from Xcode is exactly where a debug assert would not run. An empty `NAME` is ENVLESS, never a mismatch, because `default-flavor` makes `flutter test` run with `appFlavor == 'dev'` and no env file (measured).

Wiring is one insertion of `builder: (context, child) => EnvBanner(child: child),` into the single `MaterialApp(` call that has no `builder:`, found by balancing parentheses over a string-and-comment mask, plus an import. Anything else is a recipe.

### 7.4 Firebase

Firebase is in use when `firebase_core` is a dependency or any native Firebase file exists. Otherwise the criterion is `n/a`.

**Isolation.** Production's project must be in nobody else's set, on every source: the spec (a parse-time refusal), the Android file, the iOS file and the env file. Non-production environments may share. Sharing is never a finding. While production's `firebase` is `null`, `firebase.production-unregistered` is a `human` gap.

**Env keys.** The skill never asks for a `FIREBASE_*` value. It derives each one.

| Env key | Android `google-services.json` | iOS `GoogleService-Info.plist` |
|---|---|---|
| `FIREBASE_PROJECT_ID` | `project_info.project_id` | `PROJECT_ID` |
| `FIREBASE_STORAGE_BUCKET` | `project_info.storage_bucket` | `STORAGE_BUCKET` |
| `FIREBASE_MESSAGING_SENDER_ID` | `project_info.project_number` | `GCM_SENDER_ID` |
| `FIREBASE_ANDROID_APP_ID`, `FIREBASE_ANDROID_API_KEY` | the client whose `package_name` is the environment's id: `client_info.mobilesdk_app_id`, `api_key[0].current_key` | |
| `FIREBASE_IOS_APP_ID`, `FIREBASE_IOS_API_KEY`, `FIREBASE_IOS_BUNDLE_ID`, `FIREBASE_IOS_CLIENT_ID` | | `GOOGLE_APP_ID`, `API_KEY`, `BUNDLE_ID`, `CLIENT_ID` |
| `FIREBASE_ANDROID_CLIENT_ID` (when present) | the type-1 OAuth client for the environment's package, only when exactly one exists. With one client per signing certificate the value depends on the machine, so the key is left alone and reported as a note | |
| `OAUTH_GOOGLE_SERVER_CLIENT_ID` (when present) | the type-3 (web) OAuth client | |

Every run compares each key present in `env/<env>.json` with its derived value by digest. A mismatch is `firebase.env-native-disagree`, fixed by rewriting the env key from the native file after a backup. When production's native files are CI-provided and absent, the comparison cannot run. That is a note and a step, never a pass. `Env` gets a managed region holding the Firebase constants. `firebase_options.dart` is written from a template only when it is absent or unmodified FlutterFire output. An empty `FIREBASE_PROJECT_ID` throws a `StateError` that says the build is ENVLESS and names the flag. A hand-edited file is a recipe.

**iOS delivery.** One managed Run Script phase, `flutter-envs: GoogleService-Info.plist`, runs after Copy Bundle Resources. It derives the environment as `${CONFIGURATION##*-}`, so the script holds no list of environments to keep in sync. It copies `${PROJECT_DIR}/config/<env>/GoogleService-Info.plist` to `${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/`. It declares that input and output, and it exits 1 with a message naming the file and the CI variable when the file is missing or the configuration has no suffix. Nothing lands in the source tree, so no stray file can be committed. That the copy reaches the signed app is proven by the live suite, which reads `Runner.app/GoogleService-Info.plist` from a simulator build. An existing phase that copies a `GoogleService-Info.plist` selected by `${CONFIGURATION}` is a recognised shape (the reference app has one) and is adopted, not replaced.

**Android.** The Gradle block adds the guard, which fails a build for an environment whose file is missing and names the file and `GOOGLE_SERVICES_JSON_<ENV>`. It also adds the google-services plugin lines when they are absent, with the version in one constant.

**The CLI leg.** Remote writes are the only thing the skill does outside the project.

- `firebase --plan` runs the read-only lookups (`login:list`, `projects:list`, `apps:list`). It lists the writes, `apps:create` for each missing app (with a display name such as `Shop Dev`) and `apps:sdkconfig` for each missing config file, and prints a plan id, the first 8 hex characters of the plan's sha1. Registering a SHA fingerprint is a checklist step with the exact `apps:android:sha:create` command, because the right certificate is the owner's call.
- `firebase --confirm <id>` recomputes the plan and runs nothing unless the plan still hashes to `<id>`.
- `apps:sdkconfig` writes to a temp path, and the envfiles writer places the file. An existing config file is replaced only with `--set firebase.refresh=yes`.
- The skill never runs `projects:create`. Creating the production project is a step, because a project id is permanent.
- Feature detection runs the command, never reads a version number. The wrapper parses stdout only, treats `status: error` as a failed lookup that becomes a step, and puts a timeout on every call.

**Shared or separate.** The question is asked once, in plain words, and only when nothing decides it. The default is `shared`. The answer lands in the spec's per-environment `firebase` ids. Every CLI call passes `--project` explicitly, so no alias file is needed.

### 7.5 Env files

Reads `env/*.json` (key names and digests only), the ignore files, `git ls-files` and `git check-ignore --no-index` per file, the `String|bool|int.fromEnvironment` keys in `lib/` (including calls split across lines), the Makefile, `pubspec.yaml` and `.fvmrc`. Edits are `envfiles.env-gitignore`, `envfiles.sample`, `envfiles.skeletons` (which never overwrite), `envfiles.keys` (which ensure `NAME` and the derived Firebase keys, with a backup before a value changes), `envfiles.makefile` and `envfiles.default-flavor`. A key Dart reads with a `defaultValue` goes into the sample only, because an empty string in an env file would replace the Dart default. When a Makefile already has targets with the skill's names, they are the owner's code. The skill evaluates them, and a defect there becomes a recipe.

### 7.6 Variants the evaluator accepts

| Variant | `check` | `apply` |
|---|---|---|
| Groovy with suffix ids on one `defaultConfig` id | reads the effective ids | leaves `productFlavors` alone. A missing environment is blocked and a recipe names the lines |
| iOS identity held in xcconfig files | the resolver follows the chain | settings that live in an xcconfig are blocked and handed to a recipe |
| `flutter_flavorizr` owns the flavors | `project.owner` is `flavorizr` | ids and identity are report-only. Banner, Firebase and env files still run |
| Plain configurations beside flavored ones | a note | nothing. The rename happens only when the skill creates the iOS flavors |
| Legacy marker block, commented duplicate | findings | nothing. Recipes remove them |
| The legacy `.env.<env>` generation | a note | nothing. No migration |
| Per-flavor Dart options, or a switch on `appFlavor` | a note, and a defect when the switch falls back to production | nothing |

## 8. Checklist, verification, tests

### 8.1 The human checklist

Each criterion's `steps(ctx)` builds its steps from the same facts as its findings, so a step exists exactly while the thing it asks for is missing. The report prints three groups. *Left for you* holds the steps whose `done` is `false`. *Cannot be checked from here* holds the steps whose `done` is `null`: Apple, Play, console and CI state. *Not run* holds the verify checks that did not run, each with its reason. A step carries `where`, `do` with exact commands and values from the matrix, `why`, and `done`. A test fails on any rendered step that still contains a placeholder. A step appears only when a dependency calls for it: APNs with `firebase_messaging`, auth providers and release SHA fingerprints with `firebase_auth` or `google_sign_in`, billing with `firebase_storage` or `cloud_functions`.

### 8.2 The verification ladder

| Tier | Needs | Checks |
|---|---|---|
| `static` | Node | Re-read the matrix. Run the pbxproj validator. Run the banner detector, ignore state, isolation, and env-versus-native digests |
| `config` | whichever platform tools exist | **iOS.** `plutil -lint`. `xcodebuild -list -json`. Per flavor, `-showBuildSettings -scheme <f> -configuration Debug-<f>` must match the spec, with `PODS_ROOT` present under CocoaPods. `flutter build ios --config-only --flavor <f>`. **Android.** `./gradlew --offline :app:tasks --all` lists the variants, and with Firebase in use `process<F>DebugGoogleServices` passes per flavor (the plugin's own package match). **Dart.** `flutter test test/env_banner_test.dart`. **Make.** `make -n run-debug env=<f>`. No AGP-internal artifact path is read |
| `build` (on consent) | Flutter and the SDKs | `flutter build apk --debug` and `flutter build ios --simulator --debug` per flavor. Read `aapt2 dump badging` (package, label), the built `Info.plist` (`CFBundleIdentifier`, `CFBundleDisplayName`, icon name), the built `GoogleService-Info.plist` (`PROJECT_ID`, `BUNDLE_ID`), and the launcher icon entries, whose hashes must differ across flavor APKs. When production's Firebase files are absent, its build must fail with the guard's own message |

A check that did not run is `not-run` with its reason, never `pass`. An unrecognised AGP artifact layout is `not-run`, not `fail`.

### 8.3 The skill's own tests

CI runs everything synthetic on ubuntu with Node 22. It has no Flutter, Xcode, Ruby, Swift or network. Fixtures are bundles: one JSON file per pristine template (3.47.4 SwiftPM with AGP 9, 3.41.2 CocoaPods with AGP 8), mapping each path to its text or base64. That keeps `index.json` to one entry per bundle. A helper materialises a bundle in a temp directory and applies a mutation.

| Test | Proves |
|---|---|
| `managed.test.cjs` | created, unchanged, updated and conflict for each syntax. The round trip. The legacy marker is recognised and never written |
| `gradle.test.cjs` | the mask and block finder on Kotlin and Groovy. Explicit, suffix and applied-script ids. A commented duplicate is invisible. The block render and the guard |
| `pbxproj.test.cjs` | parse, rename, clone, settings, base xcconfig references and the shell phase on both bundles. The validator refuses an edit that adds a dangling id, a duplicate name or unequal lists, and accepts an edit on a file that already had such faults. Idempotent. `plutil -lint` when present |
| `apple.test.cjs` | scheme clone and the `Runner.xcscheme` removal, the Podfile map, xcconfig files, the `Info.plist` key, the `Contents.json` copy |
| `icons.test.cjs` | PNG round trip for palette, RGB and RGBA. Badge pixels at known coordinates. The safe zone untouched. The marketing icon without alpha |
| `spec.test.cjs` | each `parseSpec` invariant refuses its violation, a production that shares a project above all. The draft on a fresh app asks two questions, on a configured app none |
| `envfiles.test.cjs` | ignore evaluation, sample derivation from Dart keys, skeletons never overwriting, key merge with backup, the Makefile block (and `make -n` when `make` exists), `default-flavor` |
| `dart.test.cjs` | banner facts on reduced trap sources, the wiring on a single `MaterialApp(`, the refusal on an existing `builder:`, the options template |
| `criteria.test.cjs` | one case per finding code, asserting the exact set (§6) |
| `converge.test.cjs` | `apply` twice leaves every byte equal on both bundles. A simulated crash after each writer, then a re-run, converges to the same bytes. A fault-injected edit rolls back to the pre-apply hash |
| `safety.test.cjs` | a conflict leaves the file untouched. Foreign blocks stay untouched. A dirty planned path is refused. Sentinel secrets in fixture env files never appear in stdout, stderr or a receipt. `check` changes neither `git log` nor `git status` |
| `structure.test.cjs` | only `envs.cjs` requires `plan`, `verify` and `firebase-cli`. Only `plan.cjs` and the criteria require writers. Every code has a case, and every op, recipe and step id a finding names exists |
| `report.test.cjs` | the JSON report's values are all drawn from `vocab.cjs`. The text report is at most 80 lines. No step has a placeholder |
| `firebase-cli.test.cjs` | a fake `firebase` on `PATH`. The plan-id binding. `--confirm` with a changed plan runs nothing. Unparseable output becomes a step |
| `verify.test.cjs` | the tiers against fake `xcodebuild`, `flutter` and `gradlew`. `not-run` reasons. An unrecognised artifact layout is not a failure |
| `wizard-faults.test.cjs` | one test per wizard fault (§8.4) |

These run locally on the owner's Mac. CI reports a visible skip.

- `live/live.test.cjs` (`ENVS_LIVE=1`). It runs `flutter create` with 3.47.4 and 3.41.2, then `apply`, `plutil`, `xcodebuild`, `flutter build ios --config-only`, `gradlew tasks` and the merged-artifact reads. A second `apply` must be byte-identical. With `ENVS_BUILD=1` it also runs the build tier.
- `history/replay.test.cjs` (`ENVS_HISTORY=<repo>`, `ENVS_HISTORY_EXPECT=<file outside this repo>`). It extracts commits with `git archive`, which writes nothing to that repository, runs `check` on each, and compares the result with the private expectation.
- `history/corpus.test.cjs` (`ENVS_CORPUS=<list>`, `ENVS_VERDICTS=<file>`). It compares per-criterion statuses with the private survey's verdicts. Every disagreement must be explained in a private deltas file. A new, unexplained delta fails.

### 8.4 The wizard's faults

| Fault | What prevents it | Test |
|---|---|---|
| It prompted for every value | `check` derives, and the question round is capped at four | a fresh app asks at most two |
| One iOS scheme | `ids.ios.scheme-missing` is a gap, and `apply` writes one shared scheme per flavor | after `apply`, every flavor has a scheme and `Runner.xcscheme` is gone |
| Icons copied at build time | icons are static per-flavor native assets | after `apply`, no file references `assets/icons` and no phase references a PNG |
| `firebase_options` generated from the env file | options are a template reading `Env`, and env keys are a projection of the native files | `apply` creates no file under `scripts/` |
| A marker written with `//` and checked with `#` | one function writes and reads markers | the round trip, and `apply` twice on the wizard's output adds nothing |
| Acceptance never run on a build | `verify` exists, and the handoff names the tier that ran | a missing tool yields `not-run`, never `pass` |

## 9. Files

```text
plugins/my-skills/skills/flutter-envs/
  SKILL.md                      ceiling 12,288 bytes
  references/recipes.md         ceiling 6,144: one block per recipe id
  references/firebase.md        ceiling 6,144: the CLI leg, the consent line, the human-only list
  templates/                    Dart, Gradle (Kotlin and Groovy), xcconfig, the shell phase, the Podfile map, the Makefile block
  scripts/envs.cjs              CLI: arguments, dispatch, exit codes
  scripts/lib/{vocab,io,managed,spec,matrix,report,png,badge}.cjs
  scripts/{plan,verify,firebase-cli}.cjs
  scripts/writers/{gradle,android,pbxproj,apple,icons,envfiles,dart}.cjs
  scripts/criteria/{ids,identity,banner,firebase,envfiles}.cjs
  __tests__/                    the suite in §8.3, the fixture bundles, cases.cjs, helpers
```

Call chains stay at three files or fewer. The agent calls `envs.cjs`, `envs.cjs` calls `plan`, `verify`, `firebase-cli` or a criterion, and those call writers. `structure.test.cjs` enforces it.

## 10. Increments

Each increment ends in a check that runs.

| Inc | Adds | Lands with |
|---|---|---|
| 1 | `check` only: vocab, io, the marker function, matrix, report, every reader, every criterion's `check` and `steps`, the case suite, and the corpus and history harnesses | the case suite green. The corpus agreement explained. The history replay matching its private expectation. The wizard-fault cases red then green |
| 2 | `apply` for Android, env files and Dart, and `verify` static plus the Android, Make and Dart parts of `config` | a fresh 3.47.4 app converges. Gradle lists the flavors. `make -n` expands. The banner test passes |
| 3 | the iOS writers (pbxproj, apple) and icons | `xcodebuild` and `flutter build ios --config-only` on both templates, run by the live suite. A byte-identical second `apply` |
| 4 | the `firebase` verb, key derivation and the build tier | fake-`firebase` tests, then one live run on a scratch Firebase project, on the owner's yes |

## 11. Repository integration

- **ADR-0035.** It records the context, the decisions above, the owner's decisions, admission, consequences and the falsifier. It lists the rejected alternatives: no spec file at all (the project as the only state, with `.firebaserc` aliases), the Ruby xcodeproj gem, Swift or Pillow icons, wrapping flutter_flavorizr, flutter_launcher_icons or FlutterFire, an evaluator plus agent-only edits, generator scripts left in the project, and keeping the plain iOS configurations.
- **Budgets.** `flutter-envs/SKILL.md` 12,288 bytes. The two references 6,144 bytes each. `code.flutter-envs` set at the measured size when it lands, as ADR-0033 did for envision.
- **Admission.** `fixtures/admission.json` gains entries for the touchpoints (`decide`, `firebase-consent`, `build-consent`), the gates (`clean-tree`, `managed-conflict`, `convergence`, `rollback`), the criterion statuses and the proof results. Finding codes are admitted through the case suite and the history replay. `admission.test.mjs` learns this skill's `vocab.cjs` the way it reads clean-code-gates'. The history fixtures are `kind: history` with an opaque `private_ref`. The synthetic ones name the CI test that executes them. Costs carry the unmeasured form until the first real run measures them.
- **Hosts.** One `SKILL.md`, dual-host in place: `AskUserQuestion` (Claude) / `question` (opencode), with both spellings in `allowed-tools`. There is no opencode override port. `.opencode/commands/flutter-envs.md` follows envision's shape. `prime-agent/overlays/flutter-envs.json` drops `allowed-tools`, inserts the preamble and replaces the dual-host paragraph. The generated trees are regenerated. The skill counts go from fourteen to fifteen (README, the Prime README and tests).
- **Place.** It is not a pipeline step. It stands alone and runs on any Flutter app after `flutter create`.

## 12. Open questions, with the defaults applied

0. May each app commit `flutter_envs.json`? **Default: yes.** The skill writes it and never commits. The owner reviews it with the rest of the diff.
1. Rename the plain iOS configurations and `Runner` scheme (the reference app's choice), or keep them beside the flavored ones (Flutter's docs)? **Default: rename,** with the per-configuration Pods xcconfig layer that renaming requires.
2. Production's Firebase files gitignored and CI-written, or committed like the others? **Default: gitignored and CI-written.**
3. Non-production Firebase: shared or separate? **Asked when nothing decides it. Default: shared.**
4. The red `MISMATCH` guard goes beyond the reference app. **Default: on,** and `--set bannerGuard=off` turns it off.
5. Badges are a bottom band with a white label, a fixed palette and no badge on production. **Default: generated,** and the owner may drop in art that the skill only places.
6. `default-flavor`: plain `flutter run` and `flutter test` work, and a CI step that forgets `--flavor` builds the first non-production flavor instead of failing. **Default: on,** and `--set defaultFlavor=off` makes the envless targets pass `--flavor $(env)` themselves.
