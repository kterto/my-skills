"use strict";
// The inputs a configured bundle holds that no apply writes: the decisions in flutter_envs.json, the native Firebase
// files, the CI workflow, the owner's env values and the app's own Dart (its Firebase start-up and Env fields). Laid
// over a pristine bundle they make the project a person would bring to apply. Production's native files and the env
// files go in after the fixture's commit, untracked, as they are on a real machine.

const { readBlock } = require("../../scripts/lib/managed.cjs");
const { CONVENTIONS } = require("../../scripts/lib/vocab.cjs");

const INPUT = [/^flutter_envs\.json$/, /^android\/app\/src\/[^/]+\/google-services\.json$/, /^ios\/config\/[^/]+\/GoogleService-Info\.plist$/, /^\.github\/workflows\//];
const LOCAL = /^env\/(?!sample\.json$|\.gitignore$)[^/]+\.json$/;

// Mutates `files` (a pristine bundle) into the inputs of `configured`, and returns materialize's { post } for the
// untracked ones.
function inputsOf(files, configured) {
  const spec = JSON.parse(configured["flutter_envs.json"]);
  const production = [CONVENTIONS.fbAndroidFile(spec.production), CONVENTIONS.fbIosFile(spec.production)];
  const post = {};
  for (const [rel, data] of Object.entries(configured)) {
    if (LOCAL.test(rel) || production.includes(rel)) post[rel] = data;
    else if (INPUT.some((re) => re.test(rel))) files[rel] = data;
  }
  files["pubspec.yaml"] = configured["pubspec.yaml"].replace(/^ {2}default-flavor: .*\n/m, "");
  files["lib/main.dart"] = configured["lib/main.dart"].replace("import 'env/env_banner.dart';\n", "").replace(/^\s*builder: \(context, child\) => EnvBanner\(child: child\),\n/m, "");
  const env = configured["lib/env/env.dart"];
  const region = readBlock(env, { id: "firebase", syntax: "slash" });
  files["lib/env/env.dart"] = region ? env.slice(0, region.start) + env.slice(region.end) : env;
  return { post };
}

module.exports = { inputsOf };
