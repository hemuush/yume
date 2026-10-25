# Build and release guide

Yume targets Android with Expo SDK 58, React Native 0.88 and React 19.3.0. Read the [exact SDK 58 reference](https://docs.expo.dev/versions/v58.0.0/) before changing Expo APIs or native configuration. Use Node 22.13 or newer and the committed npm lockfile.

## Project and signing

| Setting            | Source and value                                                                                |
| ------------------ | ----------------------------------------------------------------------------------------------- |
| Expo owner/project | [app.json](app.json): `@hemant.shrma.3004/yume`, project `f12d79ce-5d59-449a-9d84-020a9abc95e4` |
| Android identity   | `com.yume.app`, app version `1.0.0`, local version code `1`                                     |
| Version policy     | [eas.json](eas.json): local versions, `autoIncrement: false` in both profiles                   |
| Preview            | Internal installable APK, `arm64-v8a` only                                                      |
| Production         | Android App Bundle; store submission is a separate action                                       |

The owner approved a fresh remote signing key for the recreated account on 23 October. It cannot update an APK signed with an earlier account's key. Export a backup before uninstalling an old-key installation, then restore it after installing the new-key build. Do not generate another key or relink the project for a routine build. Preserve a secure offline keystore backup; never commit keys, passwords, access tokens or credentials.json. The [account setup record](docs/EAS_ACCOUNT_SETUP_2026_10_23.md) preserves the original decision and verification.

Advance the local Android version code deliberately before a subsequent store release that requires a higher code. Do not reset versioning or credentials merely because an account or username was recreated.

## Install and validate

```sh
npm ci
npm run typecheck
npm run lint
npm run check:cycles
npm run format:check
npm test -- --runInBand
npm run test:security
npm run test:perf
npx expo install --check
npx expo-doctor
node scripts/auditGate.js
npx expo export --platform android
```

Type checking includes unused locals/parameters. Markdown is excluded by the repository's default Prettier ignore file; format edited Markdown explicitly with an empty ignore file or Prettier's API. Historical reports and generated coverage CSV snapshots retain their own dates/results.

The audit gate rejects unapproved high/critical advisories. Its documented CLI-only node-forge exception is still a build-tool risk; a passing gate does not mean zero advisories. Keep Expo-compatible native versions together rather than independently installing every package's latest release. See [security boundaries](SECURITY.md) and [current verification](docs/REPOSITORY_REAUDIT_2026_10_25.md).

## Native checks

```sh
npx expo prebuild --platform android --no-install
npm run check:native
```

Prebuild writes the ignored Android project and can change the package.json `android` script to `expo run:android`; retain the repository's intended development script. `check:native` checks the generated launcher aliases, enabled MainActivity, shortcuts, deep-link scheme, backup/storage policy and local icon-module autolinking. It does not compile Kotlin/Java or install the app.

[app.config.js](app.config.js) blocks Internet permission when `EAS_BUILD_PROFILE` is set; local development retains Metro connectivity. Set the matching profile when inspecting release configuration, and inspect permissions on the actual APK/AAB after native changes. Automatic Android backup and unused broad storage/photo permissions are disabled. Git and EAS independently exclude `.env*`, credentials.json, private/signing files and local attachments; ignore rules cannot remove already tracked secrets.

Keep the WorkManager/Room R8 rules in app.json. They retain constructors used reflectively by the widget library and fixed the previously observed release-only startup crash. A future release crash needs its actual logcat evidence before changing those rules. The [SDK upgrade record](docs/SDK_58_UPGRADE_2026_10_21.md) contains earlier compatibility decisions.

## Build artifacts

```sh
npx eas-cli whoami
npx eas-cli project:info
npx eas-cli build --platform android --profile preview
# For an approved store candidate:
npx eas-cli build --platform android --profile production
```

Use the [configured EAS project](https://expo.dev/accounts/hemant.shrma.3004/projects/yume). Download/install only after the EAS build succeeds. Preview is limited to compatible ARM64 phones; it is not a universal APK. Local native builds additionally require the Android SDK and JDK required by the generated Gradle project.

## GitHub CI and EAS

[CI](.github/workflows/ci.yml) runs static, regression, security, Expo and Android export/prebuild checks. The large-ledger performance fixture is report-only because shared-runner timings vary. [EAS Build](.github/workflows/eas-build.yml) queues a preview build after a successful main-branch push and checks out the commit that CI validated. It does not submit to the Play Store; a successful queueing workflow does not mean the remote APK build has finished.

The repository's `EXPO_TOKEN` secret must authorize the configured project. Local EAS login does not update that secret. The workflow checks project access before submitting a build. Use its `verify_only: true` manual input for an access check without queueing a build. The [23 October setup record](docs/EAS_ACCOUNT_SETUP_2026_10_23.md) retains its then-unverified token status; the later [workflow at 71f80c9](https://github.com/hemuush/yume/actions/runs/40149655675) successfully checked access and queued its build.

Actions are pinned to commits and workflows use read-only repository permissions. Review staged files and exclude personal backups, signing files and tokens before pushing. Never put secrets into client-visible `EXPO_PUBLIC_*` configuration.

## Android acceptance

Use [release device checks](docs/RELEASE_DEVICE_CHECKS.md) with copied data and record the artifact, device and OS. Check cold start/upgrade, authentication/capture, Add and sheets with the keyboard, back gestures, 200% text/TalkBack, realistic scrolling/motion, widgets/launcher changes, notification delivery, print/share and restore/revoked-folder failures. A JavaScript bundle, native-config check or earlier APK does not establish acceptance for a newer revision. Leave unperformed checks open.
