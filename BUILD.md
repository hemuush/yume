# Build and release guide

Yume uses Expo SDK 57 and EAS Build. Read the [exact SDK 57 documentation](https://docs.expo.dev/versions/v57.0.0/) before changing native configuration or Expo APIs.

## Environment

Use Node 22.13 or newer and install the lockfile dependencies with `npm ci`. The SDK 57 reference lists React Native 0.86, React 19.2.3, Android 7 or newer, and Android compile/target API 36. These platform floors do not guarantee compatibility with every device or future Android version.

The project owner is `hemant.shar.3004`, configured in [app.json](app.json). Log into an account with access to that EAS project. Run `eas init` only when intentionally linking a new project or fork.

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

The latest recorded build is **1.0.0, version code 15**: [build page](https://expo.dev/accounts/yume-expense-track/projects/yume/builds/0e6f1aa4-9054-41b9-8d90-44b446a7b819). This is a historical artifact, not a promise that later source changes have been rebuilt.

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
- Test Add, sheet forms, calculator, notes and the docked pad with the system keyboard.
- Check compact Plan, Reports, long names, large amounts and enlarged system text for clipping.
- Exercise empty, populated, overdue and insufficient-balance states; confirm every payment and detail action.
- Restore a valid backup, reject an invalid file, select a folder containing newer data and revoke folder permission.
- Test hidden amounts and widget privacy separately; app lock alone does not hide launcher details.
- Profile scrolling and navigation with realistic large data on a physical phone, including reduced motion.

Record the artifact, device, OS and results. Do not label these checks passed unless they were performed.
