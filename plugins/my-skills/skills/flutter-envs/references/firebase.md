# Firebase: the CLI leg

Read this file in phase 5, when the report says Firebase is in use. The leg creates the Firebase apps the spec needs and downloads the config files that are missing. It is the only thing the skill does outside the project.

## Run the leg

1. Run `node "$skill_dir/scripts/envs.cjs" firebase --plan --json`. It runs read-only lookups (`login:list`, `projects:list`, `apps:list`) and prints `id`, `account`, `steps` and `blocked`.
2. If `blocked` is not empty, show its steps to the owner as they are. Never run a blocked step's commands yourself.
3. If `steps` is empty, go to step 6.
4. Show the consent line below, once, with every command and every file. Wait for a yes.
5. Run `node "$skill_dir/scripts/envs.cjs" firebase --confirm <id> --json` with the id the owner saw.
   - If `status` is `done`, every step ran.
   - If it is `refused`, nothing ran, because the account, an app or a file changed after the plan. Show the new plan and ask again. A yes covers one plan id only.
   - If it is `failed`, the run stopped at one step, and the steps before it ran. Show the step in `failure`. The next plan lists only what is left.
6. Run `apply` again to derive the `FIREBASE_*` keys in `env/<env>.json` from the placed native files, backing up replaced values. Then run `check` to confirm agreement. Show key names only.

Production's config files belong to CI by default (`firebase.productionFiles` is `ci`). The plan creates production's apps but downloads no file for production.

The plan never replaces a config file that exists. To replace one, for example after Google sign-in was turned on, plan again with `--set firebase.refresh=yes`. The consent line then names each file it replaces.

## The consent line

Fill it from the plan. Put each command on its own line, exactly as `steps[].args` gives it after `firebase`. Name the file each `apps:sdkconfig` saves, and write "replaces" instead of "saved as" when the step has `overwrite: true`.

> I will run these 3 Firebase commands as owner@example.com, and nothing else (plan 3fa1c2d9):
> 1. `firebase apps:create ANDROID "Shop Staging" --package-name com.acme.shop.staging --project acme-dev-staging`
> 2. `firebase apps:sdkconfig ANDROID <app-id:staging:android> --project acme-dev-staging`, saved as `android/app/src/staging/google-services.json`
> 3. `firebase apps:create IOS Shop --bundle-id com.acme.shop --project acme-prod`
>
> `<app-id:staging:android>` is the id that command 1 returns. Run exactly these?

Offer two answers: run them, or not now. After "not now", the steps stay in the checklist.

## Shared or separate

Ask this only when Firebase is in use, there are two or more non-production environments, and no native file answers it already. Use these words:

> Should dev and staging use one Firebase project together, or one project each? One project together means fewer settings to keep in step, and most apps do this. One project each keeps test data apart, which Firebase recommends. Production gets its own project either way.

The default is `shared`, one project together. The answer becomes the `firebase` id of each environment in `flutter_envs.json`. `parseSpec` refuses a production id that any other environment uses. Every command passes `--project`, so no `.firebaserc` alias is needed.

## Steps only the owner can take

The skill never does these. Each one appears in the checklist only while it is open, and only when the project needs it:

- Sign in with `firebase login`. It opens a browser.
- Accept the Firebase Terms at https://console.firebase.google.com/. A 403 from the CLI often means the Terms are not accepted.
- Create a project with `firebase projects:create <id>`. A project id is permanent and can never be reused. Production must have a project of its own.
- Move a project to the Blaze plan, only with `firebase_storage` or `cloud_functions`.
- Create an APNs key at Apple and upload it to each project, only with `firebase_messaging`.
- Enable the sign-in providers, and register the release signing fingerprints with `firebase apps:android:sha:create`, only with `firebase_auth` or `google_sign_in`. Which certificate signs releases is the owner's call.
- Register the apps with App Check and decide when to enforce it, only with `firebase_app_check`.
- Add the CI secrets `GOOGLE_SERVICES_JSON_<ENV>`, `GOOGLE_SERVICE_INFO_PLIST_<ENV>` and `ENV_<ENV>_JSON` for production, whose files stay out of git.

## Never

- Never run `firebase login`, `logout`, `use`, `init`, `projects:create` or `apps:android:sha:create`, and never run `flutterfire configure`.
- Never run a Firebase command that is not in a confirmed plan.
- Never print a config file, an API key, or the output of `firebase login:list`, which holds the account's tokens.
