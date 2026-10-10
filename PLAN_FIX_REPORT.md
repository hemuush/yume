# Plan page improvement report

The approved improvements cover the full Plan page while preserving its existing wallpaper, glass cards, typography, jars, goal fills, debt lanes, sprouts, and navigation dock.

## Changes

- Runway: clearer scheduled-payment and account-balance text, forecast limitations, independent payment-date controls, correctly aligned chart markers, and navigation to upcoming payments.
- Budgets: readable two-line category names, exact remaining amounts, near-limit status, and direct edit/add navigation.
- Debt: distinguish principal repaid from time to scheduled payoff, show each loan's end date, explain schedule estimates, and open selected loan details. Incomplete schedules do not display a fabricated payoff timeline.
- Goals and what-if: responsive cards, readable names and amounts, fill below percentage labels, direct goal detail/add navigation, clearer estimated savings, and larger reduction controls.
- People and habit: clearer collect/pay wording, names below avatars, dated habit marks, and separate untracked days from days above the spending target.
- Coming up: clearer totals and schedule labels, more room for long titles, and independent payment actions that do not trigger row navigation.
- Loading: visible retry for failed reads, prevent older requests from overwriting newer results, refresh date-sensitive data on focus, protect amounts during privacy changes, and respect reduced motion for list jumps.

## Verification

- Full app tests: 245 suites passed; 10,683 tests passed; two suites/tests skipped. Jest reported lingering asynchronous handles after completing the suite and the runner was stopped. This is a test-runner caveat, not a failing assertion.
- Focused Plan tests: 38 passed. After the final chart layout correction, the two screen/component suites were rerun: all 16 tests passed.
- Real SQLite screen smoke tests cover selected goal, budget, and loan navigation plus add flows without unintended data creation.
- TypeScript and repository lint passed during verification. Final TypeScript and targeted lint passed after the chart correction.
- Final Android JavaScript export and Hermes compilation succeeded (`index-289af1b76b0efcc778651ee820917fa9.hbc`). This verifies bundling; it is not an APK.

## Review limits

The private design proposal is available at https://yume-design-review.earthystork1.chatgpt.site/plan.html. It is a design preview, not the native app runtime.

Device verification of native animation smoothness, scrolling, and actual font scaling remains pending. No Android device tooling was available through PATH. No APK or EAS build was requested or created for this work.
