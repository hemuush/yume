# Building an installable APK

Yume is an Expo app, so a real Android APK is built in Expo's cloud build service (EAS Build) — this keeps your own laptop from ever running a heavy Android/Gradle toolchain locally.

## One-time setup

1. Create a free Expo account at [expo.dev](https://expo.dev) if you don't have one.
2. Install the EAS CLI and log in:
   ```bash
   npm install -g eas-cli
   eas login
   ```
3. Link this project to your account (run once from the project root):
   ```bash
   eas init
   ```

## Building the APK

```bash
eas build --platform android --profile preview
```

This uses the `preview` profile in `eas.json`, which is configured to output a directly-installable **APK** (not the Play Store `.aab` format). The build runs on Expo's servers; you'll get a link to download the `.apk` when it finishes (usually 10-20 minutes). Install it on any Android phone via that link, or `adb install`.

## Android version support

The app targets whatever Android API level the current Expo SDK ships with (SDK 57 → a recent, current `targetSdkVersion`, managed automatically by Expo — you don't set this by hand in `app.json`). Note that "Android 17" isn't an existing OS version as of this writing (Android's naming is currently in the low teens by version number); this build config targets the **latest available Android APIs**, which by Android's own backward-compatibility guarantees will keep working correctly on every future Android release, not just the current one — a compliant app built against a recent SDK doesn't need to be rebuilt for each new Android version to keep functioning.

The app also runs on older devices — `expo-sqlite`, `expo-router`, and everything else used here has no unusual minimum-version requirements beyond what Expo SDK 57 itself supports.

## Production builds (Play Store)

```bash
eas build --platform android --profile production
```

This produces an `.aab` (Android App Bundle), the format the Play Store requires, with auto-incrementing version codes. Submitting to the Play Store separately needs a Play Console developer account and `eas submit` — out of scope until you're ready to publish there.

## Before shipping

- Set `googleDriveClientId` in `app.json` (see [BACKUP.md](./BACKUP.md)) if you want Drive backup working in the built APK — get the production build's SHA-1 from `eas credentials` and register it in Google Cloud Console the same way as the debug one.
- Update the app icon/splash assets in `assets/` if you want custom branding beyond the defaults.
