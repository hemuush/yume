# Build and release guide

Yume uses Expo SDK 57 and EAS Build. Read the [exact SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) before changing native configuration or Expo APIs.

## Environment

Use Node 22.13 or newer and install the lockfile dependencies with `npm ci`. The SDK 57 reference lists React Native 0.86, React 19.2.3, Android 7 or newer, and Android compile/target API 36. These platform floors do not guarantee compatibility with every device or future Android version.

The project owner is `hemant.shrma.3004`, configured in [app.json](app.json), linked to EAS project `e649762d-57b0-4a9a-bcd6-0185188a9294`: [project dashboard](https://expo.dev/accounts/hemant.shrma.3004/projects/yume). On 21 October 2026, `eas whoami` confirmed this account, but `eas project:info` rejected the previously configured ID `cc28c8d3-765f-46b2-accc-4cd89f084075` as nonexistent. Removing that stale ID and running `eas project:init --account hemant.shrma.3004 --non-interactive --json --no-icon` linked the existing `yume` project; no new remote project was created. A subsequent `eas project:info` confirmed the new ID. Log into an account with access to that project. Run `eas init` only when intentionally relinking a project or fork.

The 19 October setup preserves Android package `com.yume.app` and app version `1.0.0`. The owner subsequently requested local version code **1** for the new account. Both preview and production use `autoIncrement: false`, so EAS builds the configured version code exactly rather than changing it to 2. Advance the local code or deliberately restore auto-increment before later releases. The existing APK/AAB profiles and remote credential source remain in place. No signing key was generated or replaced. The new project's Android build list was empty at verification. The previous link was `@yume-expense-tracker/yume`, project `6c5db8df-593f-429b-a168-6f734be681b5`; changing the link does not transfer its build history or establish signing-key continuity.

Historically, the 16 October account switch linked `@yume-expense-tracker/yume`. The owner explicitly selected a fresh signing setup and version-code baseline of **1**, with app version **1.0.0**. That APK cannot update an installation signed with the earlier account's key; export a backup before uninstalling that installation, then restore it after the fresh install. That first submission temporarily disabled preview auto-increment so its actual version code stayed 1; auto-increment was restored afterward. This historical signing decision is not an instruction to reset credentials again for the 19 October account.

When changing EAS projects, preserve the Android package (`com.yume.app`), version-code progression and original signing key. A new signing key cannot update the APK already installed under the old key. Confirm credential availability before the next build. Historical build links below belong to the previous account.

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

Account setup verification on 19 October 2026: the authenticated EAS project matched `@hemant.shrma.3004/yume`; resolved preview and production configurations matched its project ID and package. Both profiles use remote credentials. The first initialization check retained version code 3 and auto-increment; the subsequent requested baseline is version code 1 with auto-increment disabled. `eas config` is evaluated with the corresponding `EAS_BUILD_PROFILE` environment variable set to verify release Internet blocking. The initialization checks passed all 21 Expo Doctor checks and all 8 security-script checks, targeted configuration/document formatting and `git diff --check`. This validates account linking and configuration; it does not provision signing credentials or prove APK/AAB creation. GitHub token access is checked separately by the workflow.

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
