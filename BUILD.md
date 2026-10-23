# Build and release guide

Yume uses Expo SDK 58 and EAS Build. Read the [exact SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/) before changing native configuration or Expo APIs.

## Environment

Use Node 22.13 or newer and install the lockfile dependencies with `npm ci`. SDK 58 pins React Native 0.88 and React 19.3.0; React Native 0.88's Gradle defaults are Android 7 or newer (minSdk 24), target API 36 and compile API 37, built with Gradle 9.4.1 and Android Gradle Plugin 9, which need a current JDK for local builds. These platform floors do not guarantee compatibility with every device or future Android version.

The current owner is the recreated Expo account `hemant.shrma.3004`, configured in [app.json](app.json), linked to EAS project `f12d79ce-5d59-449a-9d84-020a9abc95e4`: [project dashboard](https://expo.dev/accounts/hemant.shrma.3004/projects/yume). On 23 October 2026, `eas whoami` authenticated the reused username, but `eas project:info` rejected the deleted account's project `e649762d-57b0-4a9a-bcd6-0185188a9294` as nonexistent. Removing that stale ID and running `eas init --account hemant.shrma.3004 --non-interactive --json --no-icon` linked the current project; a subsequent project lookup confirmed its ID. Reusing a username does not restore the deleted account's project or credentials. Run `eas init` only when intentionally relinking a project or fork.

Android package `com.yume.app`, app version **1.0.0**, and local version code **1** are preserved. Both preview and production use `autoIncrement: false`, so EAS builds code 1 exactly. The existing APK/AAB profiles and remote credential source remain in place. Advance the code deliberately before subsequent Play Store releases that require a new code. The current project's Android build list was empty during this setup; no build was submitted. Historical build links belong to earlier account/project identities.

The owner explicitly selected a **fresh signing key** on 23 October. EAS generated and stored the default Android JKS for `com.yume.app` (credential configuration `Build Credentials k1hj-JgguT`). This key cannot update an APK signed with the deleted account's key. Export a Yume backup from the existing installation before uninstalling it, then restore the backup after installing a build signed by the new key. Keep a secure offline keystore backup using the EAS credentials dashboard or `eas credentials`; never commit the key, passwords, access tokens or credentials.json. See [current setup verification](docs/EAS_ACCOUNT_SETUP_2026_10_23.md).

Historically, the 16 October account switch linked `@yume-expense-tracker/yume`. The owner explicitly selected a fresh signing setup and version-code baseline of **1**, with app version **1.0.0**. That APK cannot update an installation signed with the earlier account's key; export a backup before uninstalling that installation, then restore it after the fresh install. That first submission temporarily disabled preview auto-increment so its actual version code stayed 1; auto-increment was restored afterward. This historical signing decision is not an instruction to reset credentials again for the 19 October account.

When changing EAS projects, preserve the original signing key when installation continuity is needed. The fresh-key choice above intentionally requires a reinstall. Confirm credential availability before the next build. Historical build links below belong to previous projects.

```sh
npm ci
npx eas-cli login
npx eas-cli whoami
```

## Installable APK

```sh
npx eas-cli build --platform android --profile preview
```

The [preview profile](eas.json) creates an internal-distribution APK and restricts native architecture to **arm64-v8a**. It is not an APK for every Android architecture. EAS returns a build page and download link after success; build duration varies. Install only on a compatible device, for example using `adb install path/to/yume.apk`.

The previous account's first submitted preview was **1.0.0, version code 1**: [historical build page](https://expo.dev/accounts/yume-expense-tracker/projects/yume/builds/06193728-45c8-4b2b-9133-a08171c9f1c1). It contains the earlier popup and startup/privacy refinements. Later changes require a new build. It was accepted by EAS on 16 October 2026; that historical submission is not proof of a current APK or a build under the new account.

## CI builds

[eas-build.yml](.github/workflows/eas-build.yml) queues a `preview` APK build on EAS after CI passes on `main` (or when run manually from the Actions tab). It needs an `EXPO_TOKEN` repository secret authorized for `@hemant.shrma.3004/yume`. Before starting a build, the workflow verifies that token's access with `eas project:info`; a failure reports which repository secret must be corrected. Local `eas login` does not update that GitHub secret: token authentication takes precedence, as described in [Expo's programmatic-access guide](https://docs.expo.dev/accounts/programmatic-access/). Update the secret in [repository Actions secrets](https://github.com/hemuush/yume/settings/secrets/actions) using a token from the new account before relying on automatic builds. Never add the token to app configuration or commit it. GitHub exposes secret names/update times, not their values; token access to the new project was not verified during local initialization.

The [19 October CI build attempt](https://github.com/hemuush/yume/actions/runs/39198977293) failed because the previous account exhausted its monthly Android build quota. Its upload/credential steps ran against the previous project; it is not validation of the new account. Verify or import the intended Android signing credentials for the new project before its first build. Download the APK only after its EAS build succeeds. CI never builds the production AAB or submits to the Play Store.

For a read-only authentication check from GitHub, run the EAS Build workflow manually with `verify_only: true` (or `gh workflow run eas-build.yml -f verify_only=true`). It installs dependencies and verifies the configured Expo project using the repository secret, then skips the build command. Normal automatic and manual runs still queue the preview APK.

The 21 October pre-fix [verification run](https://github.com/hemuush/yume/actions/runs/39578855243) authenticated but failed to resolve the stale project ID. That result does not establish access to the replacement project; rerun verification after pushing the corrected configuration. Local `eas config` checks passed for preview and production with their matching `EAS_BUILD_PROFILE`: both resolve the replacement project, package `com.yume.app`, version code 1, no auto-increment, remote credentials and release Internet blocking. No credentials were generated or replaced. Private `.codex-attachments/` files are excluded from both Git and EAS uploads.

## Release APK closes at launch (WorkManager and R8)

`react-native-android-widget` depends on WorkManager 2.8.1, which keeps a Room database it creates by reflection at app start. Expo SDK 58 runs R8 in full mode, which removed the generated `WorkDatabase_Impl` constructor, so a release APK closed right after opening (22 October, Pixel on Android 17). Debug builds skip R8 and did not show it. The keep rules in `expo-build-properties`' `extraProguardRules` in [app.json](app.json) fix it, and [appConfig.test.ts](src/__tests__/appConfig.test.ts) guards them; the fixed build opened on the phone. If a future dependency makes a release build close, capture the crash first (`adb logcat -d -b crash`) and add a keep rule for the class it names. Do not remove these rules when upgrading until the widget library depends on a WorkManager that ships its own.

## Play Store bundle

```sh
npx eas-cli build --platform android --profile production
```

Production creates an AAB. Both profiles currently build local version code **1** without auto-increment, as requested for the new account. Review and commit version changes before subsequent releases. Store submission is a separate action requiring Play Console access and release approval.

[app.config.js](app.config.js) blocks `android.permission.INTERNET` when `EAS_BUILD_PROFILE` is set. Development requires Metro connectivity. Verify generated permissions on the actual release artifact when changing native plugins.

## Automated checks

```sh
npm run typecheck
npm run lint
npm run format:check
npm test -- --runInBand
npm run test:security
npm run test:perf
npx expo-doctor
npx expo export --platform android
```

Inspect [.github/workflows](.github/workflows) and [scripts](scripts) for CI and dependency-audit policy. Markdown is excluded by the default Prettier ignore file; explicitly format documentation with an empty ignore file when editing it. Tests cover database, component and screen interactions. Export success does not establish native installation or frame-rate performance.

Current account setup verification on 23 October 2026: authenticated project lookup and resolved preview/production configurations match project `f12d79ce-5d59-449a-9d84-020a9abc95e4`. Both resolve remote credentials, package `com.yume.app`, version `1.0.0`, code 1 and disabled auto-increment. Each was checked with its matching `EAS_BUILD_PROFILE`, including release Internet blocking. Expo Doctor passes 20/20 checks, configuration tests pass 3/3, and security scripts pass 7/7. EAS confirms a default remote JKS after the approved fresh-key setup. This is configuration/credential validation, not an APK/AAB build or phone acceptance. GitHub token access remains unverified and requires a token from the recreated account.

## Device release checks

- Verify cold start, lock/unlock, resume, back gestures and navigation from notifications/widgets.
- Test Add, sheet forms, calculator, expense labels, other-entry notes and the docked pad with the system keyboard.
- Check compact Plan, Reports, long names, large amounts and enlarged system text for clipping.
- Exercise empty, populated, overdue and insufficient-balance states; confirm every payment and detail action.
- Restore a valid backup, reject an invalid file, select a folder containing newer data and revoke folder permission.
- Test hidden amounts and widget privacy separately; app lock alone does not hide launcher details.
- Profile scrolling and navigation with realistic large data on a physical phone, including reduced motion.

Record the artifact, device, OS and results. Do not label these checks passed unless they were performed.

## Final release candidate

See [production release audit](docs/PRODUCTION_RELEASE_AUDIT.md) before public release. Build 9 completed and its APK manifest was inspected; it must be replaced by a candidate containing the widget-provider restriction and unused-photo-permission removal. After the new APK succeeds, verify widget rendering, caller denial, permissions, lock/keyboard/restore behavior and upgrade continuity on a phone before building/submitting the production AAB. Passing source/export checks alone does not close these gates.
