# Scroll and navigation audit — 10 October 2026

The screenshots show a visible change in background below the Reports status bar and tightly joined title/control rows. Still images do not measure dropped frames or establish the cause of the background seam. This pass preserves the existing screens, theme, charts, gestures and financial features.

## Findings and changes

| Area | Finding | Change |
| --- | --- | --- |
| Shared collapsing headers | Every scroll offset invalidated several header styles even after collapse had finished. | Derive a clamped offset and progress on the UI thread. Home, shared headers and their backdrops consume those values. |
| Scroll release | A missing drag velocity was treated as zero, allowing a programmatic header snap to interrupt momentum. | Only snap at drag end with a known slow velocity; otherwise settle at momentum end. |
| Secondary screen visits | Most shared screen loaders repeated queries on every focus, including returning from a sheet or child page with no database change. | Default to the existing version/day/input/age freshness check. Successful manual reloads also record freshness. Writes invalidate it, failures remain retryable, and explicit reloads always run. |
| Activity | Transaction-change events reloaded Activity even while another screen was showing. | Reload in place only while focused; the existing freshness check fetches changes on return. |
| Reports refresh | Refreshing the same period replaced the entire scroll view with a skeleton, rebuilding charts and resetting the view. | Retain the same scroll view and data during refresh. A refresh failure shows an inline retry. A new period/privacy input still waits for matching data. |
| Reports loading and period changes | An in-flow loading header was followed by another header-height padding. A previous period's collapse could survive into the new period. | Remove duplicate padding; reset scroll and collapse on period changes. |
| Header spacing | Title and period/type controls touched vertically. | Add 8 dp between the title row and controls. No font family or overall page design change. |
| Wallpaper | Each page uses a static gradient/SVG background underneath translucent content. | Cache the static Android wallpaper in a hardware texture. Device memory and frame-time checks remain necessary. |
| Add and static headers | Static wallpaper headers mounted an invisible collapse backdrop that they did not use. | Omit that backdrop when there is no collapsing header. |
| Progress and animation lifetime | Returning to unchanged bars/rings started animations with identical endpoints. Garden growth/pop and screen fades could continue after unmount. | Skip identical endpoints; stop growth/pop and fade animations when their owners leave. |

## Coverage

Code review of shared scrolling, loaders, navigation, animations and background rendering covered Home, Activity, Add/Edit, Plan, Reports and its Days/Categories/Trends views; Profile and Settings; Backup; Budgets; Categories and category detail; Garden; Loans; Notifications and notification settings; Friends & family; Recently deleted; Recurring; Savings goals; Split; Themes; Tidy up; What-if; and Wrap. The existing smoke suite exercises these 23 routes with empty and populated data and privacy state. Modal, number-pad, tab-bar and financial operations retain their existing implementations and feature tests.

This is a performance-focused review, not a claim that every possible runtime issue has been eliminated.

## Validation

- Initial targeted run: 9 suites, 182 tests passed, including the 23-route smoke suite and new freshness/refresh/animation regressions.
- Final TypeScript and ESLint checks passed.
- Full regression run: 246 suites / 10,713 tests passed; the two opt-in performance tests were skipped in that run and passed in the separate benchmark run. Jest reported an open-handle shutdown warning after completing all tests, as in the prior baseline; this harness issue is not claimed fixed.
- Final Android Hermes export passed: `dist/perf-fixes-check`, bundle `index-c2eda027498405b809405ee32953e79e.hbc` (7.8 MB).
- Existing real-SQLite benchmark and output check passed with 20,000 synthetic transactions. Cold desktop loads: Home 79 ms / 52 SQL calls; Activity month 12 ms / 15 calls; Reports month 124 ms / 51 calls; Plan 9 ms / 5 calls. These are diagnostic desktop measurements, not Android frame rates or a measured before/after improvement.
- No data/query calculations were changed in this pass.

## Device verification still needed

Android device tooling is not available on PATH or at the standard local SDK path. The status-bar background seam, actual scroll FPS, navigation frame times, wallpaper texture memory, keyboard behavior and large-font layout need verification on the affected phone. Check repeated tab switches, fast and slow scrolls across header collapse, Reports period/lens changes, Add with the pad open/closed, opening and closing sheets, and returning after edits.

The previously shared version-code-11 APK predates these fixes. This pass does not start another EAS build.

Implementation references: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/), [Reanimated derived values](https://docs.swmansion.com/react-native-reanimated/docs/core/useDerivedValue/), [React Native View texture caching](https://reactnative.dev/docs/view#rendertohardwaretextureandroid).
