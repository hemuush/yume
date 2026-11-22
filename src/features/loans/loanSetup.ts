import type { CreateLoanInput } from '@/db/loans';
import { monthsBetweenIsoDates } from '@/lib/date';
import { dayMonthYear } from '@/lib/dateLabels';
import { rateProblem, tenureProblem } from '@/lib/loanLimits';
import { toMinor, toWholeMinor } from '@/lib/money';
import { plural } from '@/lib/plural';
import type { LoanDirection, LoanRateType } from '@/types';

/** What the Loan setup sheet holds, as the checks and the saved loan need it. */
export interface LoanSetupForm {
  direction: LoanDirection;
  counterparty: string;
  principalMinor: number;
  rateBp: number;
  tenureMonths: number;
  rateType: LoanRateType;
  personId: string | null;
  loanTiming: 'new' | 'existing';
  /** YYYY-MM-DD: the disbursement (a new loan) or the first EMI period (one already running). */
  startDate: string;
  emiStartDate: string;
  alreadyPaidCount: number;
  disbAccountId: string | null;
  disbCategoryId: string | null;
  /** The processing fee as typed; blank for none. */
  disbFee: string;
  feeCategoryId: string | null;
  repayAccountId: string | null;
  trackAsset: boolean;
  assetLabel: string;
  /** The asset's value as typed; blank leaves it out. */
  assetValue: string;
}

/** What step 1 needs before the sheet moves on: who it is with, the amount, the tenure and a rate inside the limits. */
export function problemWithLoanBasics(f: LoanSetupForm): string | null {
  const invalid =
    !f.counterparty.trim() ||
    !Number.isFinite(f.principalMinor) ||
    f.principalMinor <= 0 ||
    !Number.isFinite(f.tenureMonths) ||
    f.tenureMonths <= 0 ||
    !Number.isFinite(f.rateBp) ||
    f.rateBp < 0;
  if (invalid) return 'Fill in who it’s with, the amount, the tenure and a valid interest rate';
  return rateProblem(f.rateBp) ?? tenureProblem(f.tenureMonths);
}

/**
 * Every check the sheet makes before it saves, in the order a person meets them, then the loan to save. Pure, so each rule
 * can be tested without drawing the sheet. `today` is YYYY-MM-DD.
 */
export function buildLoanInput(
  f: LoanSetupForm,
  today: string
): { error: string } | { input: CreateLoanInput } {
  const basics = problemWithLoanBasics(f);
  if (basics) return { error: basics };
  if (f.loanTiming === 'new' && (!f.disbAccountId || !f.disbCategoryId))
    return { error: 'Pick an account and category for the disbursement, or switch to "Already in progress"' };
  if (f.loanTiming === 'existing' && !f.repayAccountId)
    return { error: 'Pick which account future EMIs should come out of' };
  // Both branches share one date picker: a real disbursement date is often earlier than the day you enter
  // it into Yume (or than a sanction letter's print date), so "new" can't only mean "today".
  if (f.loanTiming === 'new' && f.emiStartDate < f.startDate)
    return { error: 'The first EMI is before the disbursement date' };
  if (f.loanTiming === 'existing' && (!Number.isFinite(f.alreadyPaidCount) || f.alreadyPaidCount < 0))
    return { error: 'Enter how many EMIs are already paid, or 0' };
  if (f.loanTiming === 'existing' && f.alreadyPaidCount > f.tenureMonths)
    return {
      error: `The loan only has ${plural(f.tenureMonths, 'EMI')}, so ${f.alreadyPaidCount} can’t be paid already`,
    };
  if (f.loanTiming === 'existing' && f.alreadyPaidCount > 0) {
    // The two numbers must agree: 50 installments paid from a start date 13 months ago is a mismatch
    // either way (a real loan got a next-due date 3 years out while active). Caught here, not downstream.
    const elapsedMonths = monthsBetweenIsoDates(f.startDate, today);
    if (f.alreadyPaidCount > elapsedMonths)
      return {
        error: `You said ${plural(f.alreadyPaidCount, 'installment')} ${f.alreadyPaidCount === 1 ? 'is' : 'are'} already paid, but only about ${plural(elapsedMonths, 'month')} ${elapsedMonths === 1 ? 'has' : 'have'} passed since ${dayMonthYear(f.startDate)} — double-check the start date or the paid count.`,
      };
  }
  // A processing fee is only asked for on a borrowed loan, so a stale value from before switching to
  // "I lent" is ignored rather than recorded.
  const feeAmountMinor =
    f.loanTiming === 'new' && f.direction === 'borrowed' && f.disbFee ? toMinor(parseFloat(f.disbFee)) : 0;
  if (!Number.isFinite(feeAmountMinor) || feeAmountMinor < 0)
    return { error: 'Enter a valid processing fee, or leave it blank' };
  if (feeAmountMinor > 0 && f.direction === 'borrowed' && !f.feeCategoryId)
    return { error: 'Pick a category for the processing fee' };
  // The value is optional here too — matching the same "loan asset" edit modal on the detail screen — only validated
  // when actually provided.
  let assetValueMinor: number | null = null;
  if (f.direction === 'borrowed' && f.trackAsset && f.assetValue.trim()) {
    assetValueMinor = toWholeMinor(parseFloat(f.assetValue));
    if (!Number.isFinite(assetValueMinor) || assetValueMinor <= 0)
      return { error: 'Enter a valid current value for the asset, or leave it blank for now' };
  }
  return {
    input: {
      direction: f.direction,
      counterparty: f.counterparty.trim(),
      principalMinor: f.principalMinor,
      interestRateAnnualBp: f.rateBp,
      tenureMonths: f.tenureMonths,
      startDate: f.startDate,
      emiStartDate: f.loanTiming === 'new' ? f.emiStartDate : undefined,
      rateType: f.rateType,
      personId: f.personId,
      assetLabel: f.direction === 'borrowed' && f.trackAsset ? f.assetLabel.trim() || 'Asset' : null,
      assetValueMinor: f.direction === 'borrowed' && f.trackAsset ? assetValueMinor : null,
      alreadyPaidInstallments: f.loanTiming === 'existing' ? f.alreadyPaidCount : 0,
      linkedAccountId: f.loanTiming === 'existing' ? f.repayAccountId : null,
      disbursement:
        f.loanTiming === 'new' && f.disbAccountId && f.disbCategoryId
          ? {
              accountId: f.disbAccountId,
              categoryId: f.disbCategoryId,
              feeAmountMinor: feeAmountMinor > 0 ? feeAmountMinor : undefined,
              feeCategoryId: f.direction === 'borrowed' ? (f.feeCategoryId ?? undefined) : undefined,
            }
          : null,
    },
  };
}
