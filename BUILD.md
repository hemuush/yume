# Build and release guide

Yume uses Expo SDK 57 and EAS Build. Read the [exact SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) before changing native configuration or Expo APIs.

## Environment

Use Node 22.13 or newer and install the lockfile dependencies with `npm ci`. The SDK 57 reference lists React Native 0.86, React 19.2.3, Android 7 or newer, and Android compile/target API 36. These platform floors do not guarantee compatibility with every device or future Android version.

The project owner is `yume-expense-tracker`, configured in [app.json](app.json), linked to EAS project `6c5db8df-593f-429b-a168-6f734be681b5`. This replaces the previous `xyumex` project link. Log into an account with access to that EAS project. Run `eas init` only when intentionally linking a new project or fork.

The 16 October account switch linked `@yume-expense-tracker/yume`. The owner explicitly selected a fresh signing setup and version-code baseline of **1**, with app version **1.0.0**. This APK cannot update an installation signed with the old account's key; export a backup before uninstalling that installation, then restore it after the fresh install. The first submission temporarily disables preview auto-increment so its actual version code stays 1; auto-increment is restored for subsequent builds.

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

The current account's first submitted preview is **1.0.0, version code 1**: [build page](https://expo.dev/accounts/yume-expense-tracker/projects/yume/builds/06193728-45c8-4b2b-9133-a08171c9f1c1). It contains the earlier popup and startup/privacy refinements. The subsequent pastel sheet redesign is newer than this submission and requires another build. It was accepted by EAS on 16 October 2026; completion and APK availability must be checked on the build page. This is a fresh-install signing baseline.

## CI builds

[eas-build.yml](.github/workflows/eas-build.yml) queues a `preview` APK build on EAS after CI passes on `main` (or when run manually from the Actions tab). It needs an `EXPO_TOKEN` repository secret from the `yume-expense-tracker` account. Download the APK from the build page on expo.dev. CI never builds the production AAB or submits to the Play Store.

## Play Store bundle

```sh
npx eas-cli build --platform android --profile production
```

Production creates an AAB. Both profiles auto-increment the version code using the local version source. Review and commit resulting configuration changes. Store submission is a separate action requiring Play Console access and release approval.

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
