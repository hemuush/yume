# Reports fixes — approved design

Implemented the approved [private Reports preview](https://yume-design-review.earthystork1.chatgpt.site/reports.html), including the request to remove the duplicate Home summary. The native page keeps its wallpaper, frosted cards, fonts, heatmap, category colours, story carousel, charts and floating navigation.

## Changes

- Removed the top summary card and collapsed-header spending total. Days, Categories and Trends now begin directly under the period controls. The sticky tab band is opaque and pins the correct first child.
- Put the Spending / Net worth switch below its heading. Reduced story headline size, allowed more wrapping, and added previous/next insight buttons. Improved long category and transaction names, amount presentation and touch-target heights.
- Category bars now represent the stated share of the total, rather than giving the largest category a full-width bar. Changes name their comparison period and distinguish a current partial period from a full previous period.
- Past no-spend calendar days can open their entries. Future days remain disabled. Today uses a dot and the selected day uses an outline. Removed the repeated calendar-cell entrance animation; period changes, insight navigation and scroll actions respect reduced motion.
- Historical months before the first eligible transaction and future months are unavailable rather than fabricated zero history. Zero months inside the recorded span remain zero. Averages require enough eligible prior months; finished-month summaries exclude the current month. Current cash-flow figures stop at today. History coverage is inferred from the first eligible ledger transaction, not proof that imported history is complete.
- Trends show the selected monthly amount even in a year view, chart scale, distinct average/partial legends, gaps, explicit month buttons and less crowded long-history labels. Cash flow shows exact selected income, spending and money left, with an explanation of “Kept.”
- Period/privacy changes hide the old dataset while loading. Older period and day responses cannot overwrite newer selections. Failed day reads and secondary queries show errors with retry controls. Loading does not impersonate an empty account breakdown or an empty day. Empty periods retain access to Trends.

## Verification

| Check | Result |
| --- | --- |
| Final Reports, report-window and reporting-database tests | 11 suites, 156 tests passed |
| TypeScript (`npx tsc --noEmit`) | Passed |
| ESLint on all changed application/test files | Passed, no errors or warnings |
| Android JavaScript/Hermes export with Expo 57 | Passed; 7.8 MB Hermes bundle |
| Formatting and Git whitespace check | Passed |

The wider app run passed 244 suites and 10,689 tests, with two suites/tests skipped. Its one failure was an old custom-range assertion that expected no-spend days to be disabled. That assertion was corrected for the approved behavior and passed in the final affected run. The final run also covers later year-view and future-entry corrections. The full app suite was not repeated after those focused fixes.

Regression coverage includes period-response races, closing a pending day request, failed-day retry, failed-account retry, category-share bar scaling, insight arrows, recorded-history gaps and zero months, future-entry exclusion, and monthly selection inside a year report. Existing month/year/custom navigation, privacy, refunds, currency and subcategory tests remain passing.

Jest needed `--forceExit` because of lingering animation/test handles; existing icon/Expo test warnings remain. Assertions passed, but this is not evidence of an issue-free native animation runtime.

No APK or EAS build was requested or created. Android exports are local JavaScript/Hermes compilation checks only. Native device scrolling, frame timing and physical touch behaviour have not been verified on a connected phone; adb was unavailable on PATH and at the standard local SDK path.
