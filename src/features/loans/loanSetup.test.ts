/** The Loan setup sheet's rules, with no sheet: each check, in the order a person meets it, and the loan that is saved. */
import { buildLoanInput, problemWithLoanBasics, type LoanSetupForm } from './loanSetup';

const form = (over: Partial<LoanSetupForm> = {}): LoanSetupForm => ({
  direction: 'borrowed',
  counterparty: 'HDFC',
  principalMinor: 50000000,
  rateBp: 950,
  tenureMonths: 60,
  rateType: 'fixed',
  personId: null,
  loanTiming: 'new',
  startDate: '2026-11-01',
  emiStartDate: '2026-12-01',
  alreadyPaidCount: 0,
  disbAccountId: 'bank',
  disbCategoryId: 'inc',
  disbFee: '',
  feeCategoryId: 'fee',
  repayAccountId: 'bank',
  trackAsset: false,
  assetLabel: '',
  assetValue: '',
  ...over,
});
const TODAY = '2026-11-22';
const errorOf = (over: Partial<LoanSetupForm>) => {
  const built = buildLoanInput(form(over), TODAY);
  return 'error' in built ? built.error : null;
};

describe('problemWithLoanBasics', () => {
  it('is fine for a named loan with an amount, a tenure and a rate inside the limits', () => {
    expect(problemWithLoanBasics(form())).toBeNull();
  });

  it.each([
    ['no name', { counterparty: '  ' }],
    ['no amount', { principalMinor: 0 }],
    ['a rate that is not a number', { rateBp: NaN }],
    ['a negative rate', { rateBp: -1 }],
    ['no tenure', { tenureMonths: 0 }],
  ])('asks for the basics when there is %s', (_name, over) => {
    expect(problemWithLoanBasics(form(over))).toMatch(/Fill in who it’s with/);
  });

  it('names a rate or tenure outside the limits', () => {
    expect(problemWithLoanBasics(form({ rateBp: 99999 }))).toBeTruthy();
    expect(problemWithLoanBasics(form({ tenureMonths: 5000 }))).toBeTruthy();
  });
});

describe('buildLoanInput', () => {
  it('needs the disbursement account and category for a new loan, and the repaying account for one already running', () => {
    expect(errorOf({ disbAccountId: null })).toMatch(/account and category for the disbursement/);
    expect(errorOf({ disbCategoryId: null })).toMatch(/account and category for the disbursement/);
    expect(errorOf({ loanTiming: 'existing', repayAccountId: null })).toMatch(
      /future EMIs should come out of/
    );
  });

  it('does not let the first EMI fall before the disbursement', () => {
    expect(errorOf({ emiStartDate: '2026-10-31' })).toBe('The first EMI is before the disbursement date');
  });

  it('checks the EMIs already paid against the tenure and against the months that have passed', () => {
    const running = { loanTiming: 'existing' as const, startDate: '2026-01-15' };
    expect(errorOf({ ...running, alreadyPaidCount: -1 })).toMatch(/how many EMIs are already paid/);
    expect(errorOf({ ...running, alreadyPaidCount: 61 })).toBe(
      'The loan only has 60 EMIs, so 61 can’t be paid already'
    );
    expect(errorOf({ ...running, alreadyPaidCount: 40 })).toMatch(/only about 10 months have passed/);
    expect(errorOf({ ...running, alreadyPaidCount: 10 })).toBeNull();
  });

  it('refuses a processing fee that is not a number or has no category, and one for a loan you lent is ignored', () => {
    expect(errorOf({ disbFee: 'abc' })).toBe('Enter a valid processing fee, or leave it blank');
    expect(errorOf({ disbFee: '1000', feeCategoryId: null })).toBe('Pick a category for the processing fee');
    expect(errorOf({ direction: 'lent', disbFee: 'abc', feeCategoryId: null })).toBeNull();
  });

  it('refuses an asset value that is not a number, but leaves it out when blank', () => {
    expect(errorOf({ trackAsset: true, assetValue: 'abc' })).toMatch(/valid current value for the asset/);
    expect(errorOf({ trackAsset: true, assetValue: '   ' })).toBeNull();
  });

  it('builds a new borrowed loan with its disbursement, fee and asset', () => {
    const built = buildLoanInput(
      form({
        disbFee: '2500',
        trackAsset: true,
        assetLabel: ' Home ',
        assetValue: '3500000',
        personId: 'p1',
      }),
      TODAY
    );
    expect(built).toEqual({
      input: {
        direction: 'borrowed',
        counterparty: 'HDFC',
        principalMinor: 50000000,
        interestRateAnnualBp: 950,
        tenureMonths: 60,
        startDate: '2026-11-01',
        emiStartDate: '2026-12-01',
        rateType: 'fixed',
        personId: 'p1',
        assetLabel: 'Home',
        assetValueMinor: 350000000,
        alreadyPaidInstallments: 0,
        linkedAccountId: null,
        disbursement: { accountId: 'bank', categoryId: 'inc', feeAmountMinor: 250000, feeCategoryId: 'fee' },
      },
    });
  });

  it('builds a running loan you lent with no disbursement, no fee and no asset', () => {
    const built = buildLoanInput(
      form({
        direction: 'lent',
        loanTiming: 'existing',
        startDate: '2026-05-01',
        alreadyPaidCount: 3,
        disbFee: '2500',
        trackAsset: true,
        assetLabel: 'Home',
      }),
      TODAY
    );
    expect(built).toMatchObject({
      input: {
        direction: 'lent',
        emiStartDate: undefined,
        assetLabel: null,
        assetValueMinor: null,
        alreadyPaidInstallments: 3,
        linkedAccountId: 'bank',
        disbursement: null,
      },
    });
  });
});
