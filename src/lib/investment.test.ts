import {
  STALE_DAYS,
  returnPct,
  formatReturnPct,
  daysBetween,
  valueAgeDays,
  isValueStale,
  staleTrackedAccounts,
  gainLabel,
  ageLabel,
  valueReminderLine,
} from './investment';
import type { Account, AccountInvestment } from '@/types';

const inv = (over: Partial<AccountInvestment> = {}): AccountInvestment => ({
  investedMinor: 4_200_000,
  takenOutMinor: 0,
  gainMinor: 256_000,
  valuedAt: '2026-09-28',
  lastValueMinor: 4_306_000,
  ...over,
});

const acct = (name: string, investment?: AccountInvestment, archived = false): Account =>
  ({ id: name, name, type: 'savings', currency: 'INR', archived, investment }) as unknown as Account;

describe('return', () => {
  it('is the gain over what was invested', () => {
    expect(returnPct(inv())).toBeCloseTo(6.095, 2);
  });
  it('is null before the first update or with nothing invested', () => {
    expect(returnPct(inv({ gainMinor: null }))).toBeNull();
    expect(returnPct(inv({ investedMinor: 0 }))).toBeNull();
  });
  it('formats with one decimal and a true minus', () => {
    expect(formatReturnPct(6.095)).toBe('+6.1%');
    expect(formatReturnPct(-2.43)).toBe('−2.4%');
    expect(formatReturnPct(0)).toBe('0.0%');
    expect(formatReturnPct(-0.02)).toBe('0.0%');
  });
});

describe('gainLabel', () => {
  it('shows the gain and its return', () => {
    expect(gainLabel(inv(), { currency: 'INR' })).toBe('+₹2,560 · +6.1%');
  });
  it('shows a loss with a minus, and money only when asked', () => {
    expect(gainLabel(inv({ gainMinor: -150_000 }), { currency: 'INR', moneyOnly: true })).toBe('−₹1,500');
  });
  it('is null until the first update', () => {
    expect(gainLabel(inv({ gainMinor: null }))).toBeNull();
  });
  it('masks the money and the percentage together', () => {
    expect(gainLabel(inv(), { masked: true })).toBe('•••• · ••%');
    expect(gainLabel(inv(), { masked: true, moneyOnly: true })).toBe('••••');
  });
});

describe('staleness', () => {
  it('counts whole days', () => {
    expect(daysBetween('2026-09-28', '2026-10-02')).toBe(4);
    expect(daysBetween('2026-10-02', '2026-09-28')).toBe(0);
    expect(valueAgeDays(inv({ valuedAt: null }), '2026-10-02')).toBeNull();
  });
  it('is stale only past the limit', () => {
    expect(STALE_DAYS).toBe(35);
    expect(isValueStale(inv({ valuedAt: '2026-08-28' }), '2026-10-02')).toBe(false); // exactly 35 days
    expect(isValueStale(inv({ valuedAt: '2026-08-27' }), '2026-10-02')).toBe(true);
    expect(isValueStale(inv({ valuedAt: '2026-08-29' }), '2026-10-02')).toBe(false);
    expect(isValueStale(inv({ valuedAt: null }), '2026-10-02')).toBe(false);
  });
  it('lists active tracked accounts that have gone stale', () => {
    const accounts = [
      acct('Old fund', inv({ valuedAt: '2026-06-01' })),
      acct('Fresh fund', inv()),
      acct('Archived fund', inv({ valuedAt: '2026-06-01' }), true),
      acct('Plain pot'),
    ];
    expect(staleTrackedAccounts(accounts, '2026-10-02').map((a) => a.name)).toEqual(['Old fund']);
  });
  it('words an age', () => {
    expect(ageLabel(0)).toBe('Updated today');
    expect(ageLabel(1)).toBe('1 day old');
    expect(ageLabel(42)).toBe('42 days old');
  });
});

describe('valueReminderLine', () => {
  const old = inv({ valuedAt: '2026-08-01' });
  it('names the account when one is stale, in the first week of a month', () => {
    expect(valueReminderLine([acct('Index fund', old)], '2026-10-02')).toContain('Index fund');
  });
  it('counts them when several are stale', () => {
    expect(valueReminderLine([acct('A', old), acct('B', old)], '2026-10-01')).toContain(
      '2 of your investments'
    );
  });
  it('stays quiet later in the month, or when nothing is stale', () => {
    expect(valueReminderLine([acct('Index fund', old)], '2026-10-15')).toBeNull();
    expect(valueReminderLine([acct('Index fund', inv())], '2026-10-02')).toBeNull();
  });
});
