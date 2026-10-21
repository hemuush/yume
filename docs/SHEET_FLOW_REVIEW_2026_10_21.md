# Related sheet navigation — 21 October 2026

The phone screenshots showed Loan details disappearing when EMI account opened as a small centered dialog over Plan. Earlier child-return work retained form state but intentionally hid one native modal and opened another; that did not provide the requested visual continuity.

## Implementation

`src/components/SheetFlow.tsx` owns one native modal, safe-area provider and active-page Android Back handler for a related task. Nested flows reuse that window. `ModalSheet` root pages opt in with `flowPage`; child tasks join through their existing `backLabel`. Unrelated selectors and confirmations keep their own presentation.

All related pages use the bottom-sheet frame. Its measured height is retained across task changes and clamped to both window dimensions and the native host's measured viewport, including narrow screens, enlarged text, rotation and a resized modal window. The content area grows within a retained frame so short tasks keep their footer at the bottom. The native window stays visible; changing an account or editing a goal no longer dismisses/reopens the window or turns it into a centered dialog. The header and pinned action area retain the selected theme.

An unopened page does not mount its fields. Once opened, a hidden parent remains mounted but hidden from pointer input and accessibility traversal, preserving its form state and content. Back, backdrop and Android Back call the active page's existing return handler. A busy page blocks dismissal through the existing `dismissible` contract. No financial writes, amount calculations, account eligibility or theme palette were changed.

## Entry points covered

| Owner                              | Related pages                                                            |
| ---------------------------------- | ------------------------------------------------------------------------ |
| Loan details, from Plan/Home/Loans | EMI/receiving account, asset, rate, prepayment and installment recording |
| Goal overview                      | Edit and contribute                                                      |
| Goal editor                        | Reservation management, including return to the editor draft             |
| Budget overview                    | Edit limit                                                               |
| Account summary                    | Update investment value                                                  |
| Transaction details                | Make recurring, with an explicit Back to entry action                    |
| Recurring editor                   | Manage next occurrence                                                   |

## Verification

The shared component tests use the actual native-modal wrapper with mocked native measurement/keyboard primitives. They check native window identity/count, retained height, hidden parent accessibility, retained drafts, lazy page mounting, viewport clamping and busy dismissal. A loan integration test uses the real Loan details, EMI-account form and sheet wrapper to select another account, save once and return to refreshed details in the same window.

Feature suites continue to mock native shells; their existing save/refresh/navigation behavior is tested separately. `jest.setup.ts` now mocks `SheetFlow` alongside the existing native-shell mocks, while the shared-shell and loan integration suites explicitly use the real implementation. The first feature run failed because the newly introduced native safe-area provider has no measurements in that renderer harness, not because the financial assertions changed. The harness was updated, and one new wrapper-count assertion was corrected to account for composite components.

The first dedicated native-shell/loan integration recheck passed 2 suites / 13 tests (`.expo/sheet-flow-native-final.log`). The full app run passed **316 suites / 11,329 tests**, with two optional suites/tests skipped and zero failures (`.expo/sheet-flow-full.log`, 451.779 seconds). It includes the actual-shell integration tests and the existing financial, screen, privacy, draft and child-return tests. Subsequent layout-only refinements keep short-task actions pinned and clamp retained height to the measured native viewport. The final shared-shell/loan integration recheck passed **2 suites / 13 tests**, including resized viewport and footer-growth assertions (`.expo/sheet-flow-native-layout-final.log`, 7.119 seconds).

Repository-wide lint passed (`.expo/sheet-flow-lint-final.log`), followed by lint of the final shared/layout/integration sources with no warnings (`.expo/sheet-flow-lint-layout-final.log`). Final TypeScript passed (`.expo/sheet-flow-types-layout-final.log`). Repository formatting passed (`.expo/sheet-flow-format-final.log`), followed by explicit checks of the final modified layout/test sources and all four updated documents. `git diff --check` passed. Android export passed to `.expo/sheet-flow-android-export-final` (`.expo/sheet-flow-android-export-final.log`). The earlier export was intentionally interrupted to apply the footer refinement; only the final export is validation. Notification failure-injection and icon-loader `act` warnings remain in the test logs.

A JavaScript export does not establish native phone layout or smoothness. No APK installation, physical-phone interaction, commit or push was performed for this change.

## Phone acceptance

On a candidate containing this change, open Loan details from Plan and tap EMI account. The panel should remain open at the same bottom-sheet position, with Back returning to Loan details; cancel must not save and Save must refresh the chosen account. Repeat the related tasks above with the keyboard, amount pad, large text, Android Back and reduced motion. Confirm that neither an invisible parent nor its inputs can receive touches or accessibility focus. Record device and artifact results in `RELEASE_DEVICE_CHECKS.md`.
