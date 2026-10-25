# Recreated Expo account setup — 23 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

The owner deleted the previous Expo account and recreated it using the same username, `hemant.shrma.3004`. The authenticated CLI accepted the username, but the former project ID `e649762d-57b0-4a9a-bcd6-0185188a9294` no longer existed. An account name alone was insufficient to validate the old link.

## Current configuration

- Owner/slug: `@hemant.shrma.3004/yume`.
- Project ID: `f12d79ce-5d59-449a-9d84-020a9abc95e4`, confirmed by authenticated `eas project:info`.
- Dashboard: https://expo.dev/accounts/hemant.shrma.3004/projects/yume.
- Android package: `com.yume.app`; app/package version `1.0.0`; Android version code `1`.
- `eas.json` retains local version ownership and `autoIncrement: false` in both profiles. Preview is an internal ARM64 APK; production is an AAB. Both resolve remote credentials.
- Release permission blocking, native R8 keep rules, widget metadata, app scheme and plugins remain unchanged.

Only the stale project ID needed changing in app.json. EAS initialization also wrote a resolved Router setting; it was removed from the source diff to preserve the existing static configuration. No dependency or global CLI upgrade was installed.

## Approved signing setup

The owner explicitly chose a fresh signing key. EAS credentials initially reported no credentials for the new project. The Android credential manager generated a JKS in the cloud and confirmed `Build Credentials k1hj-JgguT` as the default for `com.yume.app`. The public certificate SHA-256 fingerprint is `61:9E:F0:E1:A4:D4:BF:9F:58:5A:98:68:A8:B2:B6:68:A2:5C:77:9D:EA:A8:CC:5F:A5:29:67:F6:8C:E5:A2:1B`.

No keystore, password, access token or credentials.json was downloaded into this repository. Back up credentials securely through EAS. A new key cannot update the existing APK signed by the deleted account's key: export the ledger backup before uninstalling, install a new signed build, then restore the backup. This is not signing continuity with the old installation or certification for an existing Play Store listing.

## Fresh verification

- `eas whoami` and `eas project:info`: authenticated owner/project confirmed.
- `eas config --platform android --profile preview --json --non-interactive` with `EAS_BUILD_PROFILE=preview`: passed.
- Corresponding production configuration with `EAS_BUILD_PROFILE=production`: passed.
- Assertions against both resolved configurations: new project ID, owner, package, version/code, remote credentials, APK/AAB type, disabled auto-increment and blocked INTERNET all pass. Local version source confirmed.
- `npx expo-doctor`: 20/20 checks pass.
- Configuration regression: 1 suite / 3 tests pass.
- `npm run test:security`: 7 tests pass.
- `npm run typecheck`: passes. App/EAS JSON formatting and `git diff --check` pass.
- ESLint passes across Git-tracked JS/CJS/TS/TSX source files without warnings. The initial `eslint .` stalled during discovery and was stopped; the explicit tracked-file run completed successfully. Whole-repository formatting and explicit Markdown formatting pass.
- Read-only production credential inspection confirms the same default JKS and certificate fingerprint as preview.
- `eas build:list --platform android --limit 1 --json --non-interactive`: empty list. No build queued or quota consumed by a build.

Validation covers account linking and credential provisioning. No new APK/AAB, device installation, native runtime result or fresh full application regression is claimed for this configuration-only change. Prior audit results remain historical.

## GitHub and next build

The local CLI uses a session; no local `EXPO_TOKEN` is set. Local login does not update GitHub's repository secret. Set a new-account token in the repository's `EXPO_TOKEN` secret before using automatic builds. Do not paste it into chat or configuration. That secret's access was not verified or changed here; no workflow was dispatched because the owner requested local commit only, without a push.

After the configuration is intentionally pushed, the existing workflow's `verify_only: true` option can check token access without starting a build. The regular workflow queues the preview APK after successful main CI. For a local submission, use `eas build --platform android --profile preview`; production uses `--profile production`. Both preserve code 1. No Play submission credentials or FCM credentials were configured: the app uses local reminders, and store submission is a separate action.

Rollback: restore the prior app.json only if its remote project becomes valid again; the deleted ID currently cannot resolve. Changing a local project link does not delete remote projects or credentials.

## Official references checked

- [Exact Expo SDK 58 documentation](https://docs.expo.dev/versions/v58.0.0/).
- [EAS Build setup](https://docs.expo.dev/build/setup/).
- [App version management](https://docs.expo.dev/build-reference/app-versions/): local source plus disabled auto-increment preserves the requested code.
- [Programmatic access](https://docs.expo.dev/accounts/programmatic-access/): token authentication is separate from local login.
- [Existing signing credentials](https://docs.expo.dev/app-signing/existing-credentials/).
