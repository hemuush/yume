# Activity review and fixes

Reviewed against screenshots 1710 and 1711 on 10 October 2026. The existing Activity layout, cards, chart, colours, font sizes, transaction rows and bottom navigation are retained. No APK was requested or built for these changes.

## Issues fixed

| Area | Problem | Change |
| --- | --- | --- |
| Period changes | The headline delayed its old data while chart taps and timeline rows already referenced the next period. Interrupting the animation could leave it faded or translated. | Render committed data immediately, animate its entrance, and cancel superseded/unmounted motion. Period amounts start at their actual value rather than rolling through the previous period's figure. |
| Loading | Requested-period captions could label old rows and comparison figures; account/category metadata could arrive before their matching transactions. | Keep captions and comparison text tied to the loaded period, show `Updating…` in the existing subtitle while the next period loads, and commit metadata, rows and totals together. |
| Chart motion | Every animation frame changed bar height through JS layout. | Animate a bottom-anchored scale with the native driver; stop interrupted animations and respect reduced motion. |
| Refund rendering | Positive category segments could sum to more than net spending after a refund in another category, overflowing the stack. | Normalize segment geometry against the positive category weights. Net bar height and financial amounts remain unchanged. |
| Legend and accessibility | Empty/future bars could contribute legend entries; long names could overflow; single weekday letters were ambiguous to screen readers. | Limit the legend to visible positive bars, constrain long names and include the date in bar labels. |
| Chart jumps | Failed list jumps could retry indefinitely or scroll to a stale index after a period/filter change. | Make one bounded retry, first bring unmeasured content into range, cancel obsolete retries and respect reduced motion. |
| Timeline rendering | Virtualized day groups replayed staggered entry animations when remounted while scrolling. | Remove the group entry stagger. Existing row movement and new-entry feedback remain. |
| Dragging | A held day could unmount/reload without releasing the parent scroll lock. Stale reorder failures could clear a later arrangement. | Release drag locks, stop drag motion, bind temporary visual state to its source rows and invalidate obsolete reorder callbacks. |
| Search | DB failures looked like genuine zero results; in-place saves did not refresh active searches. | Add an explicit retry state and refresh search results after ledger-change events. |
| Privacy | Amount suggestions and detail/split amounts could expose entries whose parent category was sensitive. | Apply the shared privacy predicate consistently and make it inherit parent-category sensitivity. |
| Filters | Switching to Transfers retained category picks that were then hidden, making valid transfers disappear. | Clear category picks when switching to Transfers, retaining account selections. |
| Detail sheet | Recurring-form state could carry over when another entry opened. | Reset it when the selected entry changes. |
| Scroll header | Compact period controls became interactive while nearly transparent; automatic settling ignored reduced motion. | Enable compact controls at their visible threshold with hysteresis; remove invisible expanded controls from touch/focus; respect reduced motion for native settling. These are shared-header fixes. |

## Validation

- Activity, shared privacy, header motion and app screen smoke regression run: **14 suites, 224 tests passed**.
- Added coverage for rapid period changes and matching chart taps, interrupted native bar animation, cross-category refunds, empty legends, failed-search retries, drag-unmount cleanup, slow period loading, transfer filters and inherited privacy in transaction details.
- Full app suite: **245 suites, 10,675 tests passed**; two existing opt-in performance tests/suites skipped.
- TypeScript, repository ESLint with zero warnings, Prettier and `git diff --check`: passed.
- Android JavaScript/Hermes export: passed (`.expo/activity-review-export`). This verifies bundling and produces no APK or EAS build.

## Review limits

Automated tests verify data, state transitions, cancellation and reduced-motion configuration. They do not measure Android frame rate, verify native gesture arbitration, or prove touch bounds and final-row clearance on a physical device. Those checks remain for hands-on review when you authorize the next build.

The chart height represents net spending; its positive category colours are normalized when refunds remove spending from another category. No transaction amounts, balances or category records are rewritten.

The full-suite preparation run encountered a local encoding error in one test file. The file was restored, the encoding corrected, and the completed sources were retested. The preparation run is not counted as a passing validation result.
