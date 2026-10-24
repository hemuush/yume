import {
  investLines,
  investRole,
  investmentIdsOf,
  estimatedValue,
  parseYearlyRate,
  earnsKnownRate,
} from './investment';
import type { Account, AccountInvestment } from '@/types';

const ids = investmentIdsOf([
  { id: 'fund', investment: {} },
  { id: 'gold', investment: {} },
  { id: 'bank', investment: undefined },
] as Account[]);
const tx = (accountId: string, toAccountId: string | null, over = {}) => ({
  type: 'transfer' as const,
  accountId,
  toAccountId,
  note: '',
  ruleId: null,
  ...over,
});
const name = (id: string) => ({ fund: 'Nifty 50', gold: 'Digital gold', bank: 'HDFC' })[id] ?? id;

describe('investRole', () => {
  it('reads a transfer into an investment as invest, out of one as withdraw, between two as move', () => {
    expect(investRole(tx('bank', 'fund'), ids)).toBe('invest');
    expect(investRole(tx('fund', 'bank'), ids)).toBe('withdraw');
    expect(investRole(tx('fund', 'gold'), ids)).toBe('move');
  });
  it('leaves ordinary transfers and every other entry alone', () => {
    expect(investRole(tx('bank', 'cash'), ids)).toBeNull();
    expect(investRole({ ...tx('bank', 'fund'), type: 'expense' as never }, ids)).toBeNull();
    expect(investRole(tx('bank', null), ids)).toBeNull();
  });
});

describe('investLines', () => {
  it('says Invested in with where it came from, and SIP when a rule posted it', () => {
    expect(investLines(tx('bank', 'fund'), 'invest', name)).toEqual({
      title: 'Invested in Nifty 50',
      sub: 'from HDFC',
    });
    expect(investLines(tx('bank', 'fund', { ruleId: 'r1' }), 'invest', name).sub).toBe('SIP · from HDFC');
    expect(investLines(tx('bank', 'fund', { note: 'Top-up', ruleId: 'r1' }), 'invest', name).sub).toBe(
      'Top-up · SIP · from HDFC'
    );
  });
  it('words a withdrawal and a move', () => {
    expect(investLines(tx('gold', 'bank'), 'withdraw', name)).toEqual({
      title: 'Withdrawn from Digital gold',
      sub: 'to HDFC',
    });
    expect(investLines(tx('gold', 'fund'), 'move', name)).toEqual({
      title: 'Moved Digital gold → Nifty 50',
      sub: 'Between investments',
    });
  });
});

describe('estimatedValue', () => {
  const fd = (
    over: object = {}
  ): { currentBalanceMinor: number; interestRateAnnualBp: number | null; investment: AccountInvestment } =>
    ({
      currentBalanceMinor: 1_000_000_00,
      interestRateAnnualBp: 700,
      investment: {
        investedMinor: 1_000_000_00,
        takenOutMinor: 0,
        gainMinor: 0,
        valuedAt: '2026-01-01',
        lastValueMinor: 1_000_000_00,
        kind: 'fixed_deposit',
        maturityDate: null,
        ...over,
      },
    }) as never;

  it('grows a deposit quarterly at its yearly rate', () => {
    // One year at 7% added quarterly is 7.1859%.
    const e = estimatedValue(fd(), '2027-01-01')!;
    expect(e.days).toBe(365);
    expect(e.valueMinor).toBeGreaterThan(1_071_800_00);
    expect(e.valueMinor).toBeLessThan(1_071_900_00);
  });
  it('grows a PPF or EPF account once a year', () => {
    const e = estimatedValue(fd({ kind: 'ppf_epf' }), '2027-01-01')!;
    expect(e.valueMinor).toBe(1_070_000_00);
  });
  it('adds simple interest for the part of a period that has not ended yet', () => {
    // Half a year of PPF at 7%: not yet credited, so simple interest, 3.5%.
    const ppf = estimatedValue(fd({ kind: 'ppf_epf' }), '2026-07-03')!;
    expect(ppf.days).toBe(183);
    expect(ppf.valueMinor).toBe(Math.round(1_000_000_00 * (1 + (0.07 * 183) / 365)));
    // A year and a half: one full year compounded, then half a year of simple interest on that.
    const long = estimatedValue(fd({ kind: 'ppf_epf' }), '2027-07-02')!;
    expect(long.valueMinor).toBe(Math.round(1_000_000_00 * 1.07 * (1 + (0.07 * 182) / 365)));
  });
  it('adds what moved since the last update', () => {
    const base = fd();
    const moved = { ...base, currentBalanceMinor: 1_050_000_00 };
    expect(estimatedValue(moved, '2027-01-01')!.valueMinor).toBe(
      estimatedValue(base, '2027-01-01')!.valueMinor + 50_000_00
    );
  });
  it('stops growing at maturity', () => {
    const e = estimatedValue(fd({ maturityDate: '2026-07-01' }), '2027-01-01')!;
    expect(e.matured).toBe(true);
    expect(e.days).toBe(181);
  });
  it('is null for other kinds, with no rate, no update, or no time passed', () => {
    expect(estimatedValue(fd({ kind: 'mutual_fund' }), '2027-01-01')).toBeNull();
    expect(estimatedValue({ ...fd(), interestRateAnnualBp: null }, '2027-01-01')).toBeNull();
    expect(estimatedValue(fd({ valuedAt: null }), '2027-01-01')).toBeNull();
    expect(estimatedValue(fd({ lastValueMinor: null }), '2027-01-01')).toBeNull();
    expect(estimatedValue(fd(), '2026-01-01')).toBeNull();
  });
});

describe('parseYearlyRate', () => {
  it('reads percent as basis points, and empty as none', () => {
    expect(parseYearlyRate('7.1')).toEqual({ rateBp: 710 });
    expect(parseYearlyRate('')).toEqual({ rateBp: null });
  });
  it('rejects a rate outside 0-100 or that is not a number', () => {
    expect(parseYearlyRate('101')).toHaveProperty('error');
    expect(parseYearlyRate('-1')).toHaveProperty('error');
    expect(parseYearlyRate('x')).toHaveProperty('error');
  });
  it('only deposits and provident funds earn a known rate', () => {
    expect(earnsKnownRate('fixed_deposit')).toBe(true);
    expect(earnsKnownRate('ppf_epf')).toBe(true);
    expect(earnsKnownRate('mutual_fund')).toBe(false);
    expect(earnsKnownRate(null)).toBe(false);
  });
});
