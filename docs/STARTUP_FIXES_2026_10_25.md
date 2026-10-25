# First-install insets and theme launch branding — 25 October 2026

Baseline: `cc3c0e7`. These changes address the two reported Android startup issues while retaining the existing app design and financial behavior. The [SDK 58 navigation-bar](https://docs.expo.dev/versions/v58.0.0/sdk/navigation-bar/) and [splash-screen](https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/) references were read before implementation.

## First-install navigation-bar overlap

Onboarding placed its bottom safe-area inset in KeyboardAvoidingView.paddingBottom. The installed keyboard controller writes its own animated paddingBottom, including zero with the keyboard closed, overriding that inset. Onboarding is the first-install path, which explains why ordinary later launches differ.

The inset now lives in marginBottom, independently of keyboard animation. AmountPadDock reports whether its own pad is visible; when it is, the dock owns the navigation-bar inset and onboarding removes the duplicate margin. Other dock callers retain their existing layout.

The regression models the installed keyboard controller's padding override and a 48dp three-button navigation inset. It failed on the original layout, then passed on welcome, account setup and number-pad focus, checking that exactly one dock owns the inset. This is a component regression, not a phone screenshot or pixel-geometry test.

## Original icon flashing after a theme change

The launcher switched activity aliases, while the launch theme still referenced the fixed original splash drawable. JavaScript runs after Android has already constructed that starting window, so changing only the launcher icon could not correct the flash.

The existing native icon plugin now generates a stable splash theme for each icon, with matching artwork at Expo's 288dp canvas and configured 200dp logo size. MainActivity references every style through generated R.style fields, so native compilation checks the resource IDs and release shrinking retains the themes and their images. Before Expo installs its splash screen, MainActivity selects the enabled alias's theme, including Android's older compatibility splash.

On Android 12+, the icon module persists that native splash theme **before** enabling the new alias. Android's [setSplashScreenTheme](<https://developer.android.com/reference/android/window/SplashScreen#setSplashScreenTheme(int)>) explicitly persists the theme for later launches; style names must remain stable across upgrades. The operation runs on the main queue. The base theme has no fixed original icon: Android 12+ can use the launcher's selected alias while no override is stored, and older Android has a plain starting background until the compatibility splash uses the selected theme. Android's [starting-window implementation](https://android.googlesource.com/platform/frameworks/base/+/f68c80b4e9dbdb1e5bf6620f437c3d9f865eb047/libs/WindowManager/Shell/src/com/android/wm/shell/startingsurface/SplashscreenContentDrawer.java) uses the activity icon when no explicit splash icon is set.

Turning theme matching off still selects Yume's original icon and launch theme. MainActivity stays enabled; shortcuts, widgets and deep links keep their existing target. No database schema, dependency or permission change was introduced.

## Verification

- Full Jest regression: 363 suites / 11,763 tests passed; two performance cases are excluded from the ordinary runner. After the final native-resource refinement, the focused onboarding, startup, amount-pad and icon suite passed again: 4 suites / 41 tests.
- Security/native-guard unit runner: all 18 tests passed on the final implementation.
- Android JavaScript/Hermes export passed.
- TypeScript checking passed; CI also runs lint, formatting and circular-import guards on the committed tree.
- Fresh `expo prebuild --platform android --no-install --clean` and `check:native` passed, confirming all six launch themes, all 25 themed density images, direct resource references, native-module autolinking and the hook before Expo's splash installation. The incidental package script change was reverted.
- CI reruns the final committed tree, including Android export and native generation. Follow the revision's [CI and EAS workflows](https://github.com/hemuush/yume/actions) and the [EAS build dashboard](https://expo.dev/accounts/hemant.shrma.3004/projects/yume/builds) for remote results; this source report is written before those runs complete. A successful build-submission workflow alone does not establish native compilation.

These are fresh automated results for this correction. Earlier audit results are not reused as evidence. This workstation has no configured Android SDK/JDK or attached phone; native compilation and phone acceptance are separate from local configuration checks.

## Android acceptance

A **new native APK** is required; an over-the-air JavaScript change cannot add native theme resources or modify the icon module. Expo Go cannot validate this launch experience. Validate a clean install with gesture and three-button navigation; onboarding with keyboard and number pad; all five themed icons plus default; warm/cold launches, force-stop/reopen and reboot; Match the app icon off; and notification/widget/deep-link launches. Record the APK, Android version and launcher in [device acceptance](RELEASE_DEVICE_CHECKS.md). Device confirmation remains open until those checks are performed.
