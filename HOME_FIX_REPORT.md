# Approved Home fixes

The revision 5 private review was approved on 10 October 2026. This implementation preserves the existing curved category dial, card order, account chips, navigation, colours and font families. The approved greeting/insight separation and explanatory captions are the only typography/content changes. The earlier shared compact sizing remains in place.

## Findings and implementation

| Review item | Result |
| --- | --- |
| H01 — greeting and insight read as one sentence | The greeting and smaller insight are separate text blocks. Income not spent is described as unspent income, rather than confirmed savings or cash available. Thin-margin and privacy copy also avoid claiming money was saved. |
| H02 — balance context unclear | The existing caption explains deductions for spending, net savings movements and remaining bills. Carry-over stays visible. Privacy mode uses neutral deduction wording. Financial calculations are unchanged. |
| H03 — dial labels jump ahead of the moving pill | Category details settle when the latest animation completes. Interrupted callbacks are ignored; animations are cancelled on replacement/unmount. Selection follows category identity if data reorders. Positions use transforms, retaining the original arc geometry. The text column is bounded on narrow screens. |
| H04 — nothing due this week alongside a later payment | The existing next-payment row explicitly says “After this week”. No new group or card was added. |
| H05 — account headline seems inconsistent with the chips | The caption identifies the bank/cash/wallet total. Savings and credit-card chips remain in their existing positions; default-currency aggregation is unchanged and tested. |
| H06 — chart context and presentation | The same bars, controls and highlight remain. Captions include the date range; screen-reader labels identify full dates. Bars animate by scale within fixed layout heights and range changes do not replay entry animations. |
| H07 — recent transaction taps | Code review confirmed these Home rows are intentionally read-only. Existing “See all” navigation is retained. No new transaction-detail flow was introduced. |
| H08 — tab/page mismatch and height jumps | Paging selection follows page keys, surviving conditional tab removal. Intermediate programmatic offsets cannot reset a tapped tab. Height stays fixed during a drag and follows the final page; resize and reduced-motion changes reconcile the native offset. |
| H09 — interrupted/replayed motion | Obsolete hero transitions and bar animations are cancelled. Hero values, today chips and spending pace share the displayed-period snapshot. The existing hero gesture remains; native frame-time profiling is still required. |
| H10 — press feedback and touch targets | Shared press feedback stops older springs and honours reduced motion, including changes while mounted. Compact month controls now request a 44 dp vertical touch region without changing their visible size. Actual hit bounds, parent clipping and the original dial's neighbouring-target overlap require device verification. |
| H11 — collapsing-header flicker | Separate enter/leave thresholds prevent repeated focus/touch changes near the collapse boundary. Compact controls become interactive after becoming visible. Existing measured header padding and scroll transforms remain; reduced motion disables miniature-control scaling. |
| H12 — amount interruption and cleanup | Counting starts from the currently interpolated value, not the previous target. Listeners and animations stop during cleanup; stale completion callbacks cannot overwrite new values. Initial counting starts at zero without a full-value flash. |
| H13 — new month label over old figures | Both month controls follow the period actually displayed by the hero. The hero switches its label, figures and period-specific chips together, with guarded callbacks during interrupted transitions. |

Screenshots and the separate review-site source are excluded from Git staging and EAS upload.

## Regression coverage

New controlled-animation tests cover interrupted counting, stale completion callbacks, rapid dial taps, reordered categories, interrupted month transitions, conditional tab removal, old scroll destinations, finger takeover, frozen paging height, reduced-motion press feedback and dated chart labels. A separate test covers header-collapse hysteresis. Existing screen smoke tests verify month stepping, carry-over and removal of current-month bills from historical months.

These tests exercise React state and controlled animation callbacks. They do not simulate the Android UI thread or measure frames per second.

## Verification

| Check | Result |
| --- | --- |
| Full Jest suite | 243 suites and 10,663 tests passed; two existing opt-in performance suites/tests skipped. No failing tests. Command: `npm test -- --maxWorkers=2 --workerIdleMemoryLimit=512MB`. |
| Home/screen regressions | All 119 screen smoke tests, eight controlled Home motion tests and the collapse-hysteresis test passed. Existing financial/caption tests also passed in the full suite. |
| TypeScript, lint and formatting | Passed on final source; lint used `--max-warnings=0`. |
| Android export | Passed on final source: 2,301 modules, 40 assets, 7.8 MB Hermes bundle. Output: `.expo/home-approved-export-final`. |
| Git | Implementation `e37e39d` pushed to `origin/main`; version 10 metadata and this report are recorded in the delivery commit. |
| Preview APK | Signed internal Android build finished successfully: version 1.0.0, version code 10, package `com.yume.app`, arm64. Build source: `e37e39d484d417581545f090e48a377aeedb405e`. |

[Download APK build 10](https://expo.dev/artifacts/eas/ScoLNCurNE7X3pnBfKBYE0JrO5k9TvCPLeiCRtE0q9E.apk) · [EAS build details](https://expo.dev/accounts/yume-expense-track/projects/yume/builds/8d24406b-6dcf-4c2a-a59e-68ce51da2e4c)

The complete Jest log is `.expo/home-approved-tests.log`. Some existing tests emit non-fatal console diagnostics, including asynchronous icon-font/Animated-view `act` warnings; they are not treated as evidence of device performance. The new controlled Home motion tests mock icons and unmount their trees.

## Android checks still required

No Android device tools are available in this workspace. On a phone, check rapid dial taps, horizontal hero/paging gestures during vertical scrolling, week/month switching, interrupted month loading, reduced motion, large system fonts, narrow screens and bottom-navigation clearance. Measure animation frame times on a representative lower-end phone and check adjacent dial touch regions before calling the motion fully device-verified.

Private approved review: https://yume-design-review.earthystork1.chatgpt.site
