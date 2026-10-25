# Loan flow review — 21 October 2026

> Historical record: validation and implementation claims apply to the revision recorded below. For maintained behavior see [architecture](ARCHITECTURE.md); for the newer check results see the [repository re-audit](REPOSITORY_REAUDIT_2026_10_25.md).

Targeted source and automated-flow review, preserving the selected theme, loan identity colours and current card/sheet structure. Earlier cleanup reports retain their own evidence; they are not fresh validation for this pass. Changes remain uncommitted.

## Areas traced

| Surface             | Flow checked                                                                                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Loans               | Empty/loading/error/closed/defaulted states, list payment action and repeated detail/payment links                                    |
| Home and Plan       | Direct payment links, largest upcoming outgoings, Debt summary/list, Upcoming payment context and post-save refresh                   |
| Payment and receipt | Correct account direction, actual versus due date, duplicate-tap guard, failed-save retry, final EMI, undo and late completion        |
| Loan details        | Loading failure/retry, switching loan sessions, overview/schedule, payoff completeness, nested-sheet return and rate-history wrapping |
| Loan setup          | Borrowed/lent and new/existing modes, hidden fields, date defaults, reference-load cancellation and save guard                        |
| Supporting sheets   | Prepayment preview/save/result, floating rate, repayment account and optional asset removal                                           |
| Other entry points  | Notification routes, Next Due widget route, Activity linked-payment undo and guarded loan-linked edits                                |

## Corrections

- Payment confirmation now holds the selected EMI/account/category through schedule refresh. It no longer jumps to another installment or vanishes when the final EMI is paid.
- Lent repayments say received/into account, including their balance preview, account picker and setup. Defaulted loans can record repayments through details consistently with the existing list/database behavior; closed loans cannot.
- The actual payment/receipt date defaults to today rather than the agreed due date. This is an intentional UX change. Earlier dates remain editable and future dates are blocked. Errors stay inline with retry instead of closing the form; the selected date is retained.
- Saved payments and successful undo operations cannot be reported as failed merely because refresh failed. Late completion after unmount still emits the data-change event, without stale UI callbacks or navigation. Success uses the shared button's single haptic and respects reduced motion.
- Details offer Retry. Missing/truncated schedules state that payoff is incomplete rather than implying no balance remains or a reliable debt-free date. The query, detail helper, Loans totals and Plan totals use the same completion requirement.
- Reminder/detail requests are consumed individually; a subsequent request can open in the same Loans route. Missing loans explain the unavailable link, closed loans remain reviewable, and an empty list omits the paid-off hero.
- Schedules show actual paid/received dates, distinguishing historical paid-before-tracking rows and missing dates on recorded payments. Plan's lent-only prompt no longer claims there are no loans.
- Untouched setup dates refresh when reopened; explicitly selected dates are preserved. Cancelled reference reads cannot update another opening. Hidden borrowed-only assets and irrelevant processing fees are ignored after mode changes. An asset label can be removed before adding a value estimate.
- Changed prepayment amounts clear the stale preview during recalculation. The rate-date picker prevents choosing before the loan's start; rate-history amounts can wrap on narrow layouts.

No amortization formula or persisted money schema changed. Loan payment, disbursement, prepayment and charge writes retain existing database behavior. Recorded-prepayment undo and deletion restrictions remain; this pass does not add unsupported actions or infer how a lender should restructure a loan.

## Validation record

The first six-suite run recorded twelve behavior/UX expectation failures and three route-test setup failures caused by missing safe-area context. After fixing that harness, the three navigation cases also failed against the earlier implementation (`.expo/loan-flow-reproductions.log`, `.expo/loan-navigation-reproduction.log`). These are not fifteen independently classified financial defects; several cases exercise one flow from different states, and changing the default payment date/retry behavior was deliberate.

The first corrected focused run passed nine suites / 78 tests. Expanded verification passed sixteen suites / 129 tests and exposed a duplicate test import. The follow-up found one older Plan assertion still expecting the previous lent-only prompt. Both were corrected. The next three-suite follow-up passed all 43 tests, including single success haptics. React Compiler lint also identified a derived mutable dependency in the payment-opening callback; it now derives the installment inside the callback from schedule state, and the focused compiler check passed.

The fresh final full run passed **311 suites / 11,288 tests, with zero failures**, in 441.175 seconds (`.expo/loan-flow-full.log`). The standard run skipped two optional performance suites/tests; these opt-in checks were not rerun in this pass.

Final type checking and full-repository lint passed (`.expo/loan-flow-types-verified.log`, `.expo/loan-flow-lint-final.log`). Changed-source formatting, guide formatting and diff whitespace checks passed (`.expo/loan-flow-source-check.log`, `.expo/loan-flow-doc-check.log`). Android export passed to `.expo/loan-flow-android-export`, with the 8.2MB Hermes bundle `index-9b3db56a436585a8f9695d1ad9a28ebb.hbc` (`.expo/loan-flow-android-export.log`). This is a JavaScript/Hermes export, not an APK build, installation or native presentation check. Earlier report results are not substituted for this revision.

## Native acceptance remaining

No APK was built or installed. ADB is unavailable on PATH; this pass does not establish native keyboard, TalkBack, actual modal stacking, theme presentation, enlarged-text clipping or animation/frame-rate acceptance. The [device checklist](RELEASE_DEVICE_CHECKS.md) retains those checks as not run. Test with copied data on a candidate containing these uncommitted changes.

No commit or push was performed.
