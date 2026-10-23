# Widget validation — 23 October 2026

The recheck started on 22 October and continued on 23 October. Reviewed all five widget components, their data/registry paths, picker assets and the installed Android renderer after the style update.

## Corrections from this review

- The month line now sends positive integer weights. `react-native-android-widget` 0.23.0 passes the JS flex value through to `BaseWidget.java`, which reads it with `getInt`; fractional shares could disappear. The regression checks converted native props, including a tiny positive share.
- The month card uses a solid pale theme wash. The native gradient replaces the drawable holding the border; a CSS preview alone concealed that difference.
- Next Due's hidden-details placeholder omits its third line to fit the one-row widget. Privacy gating and tap behavior remain unchanged.
- Preview rendering explicitly loads every configured font and waits for the next paint before capture. The generator also rejects fractional weights and gradients combined with borders.

## Fresh checks

- Full app regression: 326 suites and 11,392 tests passed; 2 suites/tests skipped.
- Targeted widgets: 5 suites, 21 tests passed after the native fixes and compact privacy placeholder.
- TypeScript, whole-repository lint/formatting, cycle checks and 7 security checks passed. Final targeted lint and TypeScript also passed after the fixes.
- Performance/output parity: 2 suites, 2 tests passed.
- Release-profile Android prebuild succeeded in an isolated validation directory. All five generated widget dimensions and preview bytes match app.json/source assets. All four generated font files match their source bytes. Receivers remain non-exported, the guarded image provider is present, and release INTERNET removal remains configured.
- Standard and minimum-size images were regenerated with explicit font loading and visually checked. All five final picker PNGs also match a fresh prebuild byte for byte.
- Android production bundle export passed: 2,314 modules, 8.3 MB Hermes bundle, 38 assets. The first attempt was stopped to reduce concurrent memory pressure; the completed run is the result recorded here.

## Limits

No APK/Gradle build or physical phone acceptance was performed. Native font padding/scaling, launcher preview caching, taps and resizing still require a rebuilt app on a phone. Browser images and a successful prebuild do not prove those checks.
