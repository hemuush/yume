import { trackedSumLines, groupAccountsByType } from './trackedSum';

describe('trackedSumLines', () => {
  it('keeps whole-rupee parts exactly as they are', () => {
    expect(
      trackedSumLines(
        { accountsMinor: 150_000_00, loansMinor: -2_300_000_00, peopleMinor: 1_600_00 },
        150_000_00
      )
    ).toEqual({
      totalMinor: -2_148_400_00,
      accountsMinor: 150_000_00,
      loansMinor: -2_300_000_00,
      peopleMinor: 1_600_00,
    });
  });

  it('builds the total from the shown lines, so the sum on screen holds', () => {
    // Two accounts of ₹10.40 show as ₹10 + ₹10 = ₹20; loans −₹1,000.55 show
    // as −₹1,001; people ₹0.30 show as ₹0. Total: ₹20 − ₹1,001 + ₹0.
    expect(trackedSumLines({ accountsMinor: 2080, loansMinor: -100055, peopleMinor: 30 }, 2000)).toEqual({
      totalMinor: -98100,
      accountsMinor: 2000,
      loansMinor: -100100,
      peopleMinor: 0,
    });
  });

  it('never moves a rounding remainder onto a line that is really zero', () => {
    // ₹84,200.40 + ₹15,799.40 show as ₹99,999 in the accounts card; with no
    // loans the loans line must stay ₹0, not absorb the leftover rupee.
    const lines = trackedSumLines(
      { accountsMinor: 9_999_980, loansMinor: 0, peopleMinor: 250_000 },
      9_999_900
    );
    expect(lines.loansMinor).toBe(0);
    expect(lines.totalMinor).toBe(10_249_900);
  });
});

describe('groupAccountsByType', () => {
  const acc = (type: string, balance: number, currency = 'INR') => ({
    type,
    currency,
    currentBalanceMinor: balance,
  });

  it('groups by type with savings last, and subtotals that add up to the accounts total', () => {
    const groups = groupAccountsByType(
      [acc('savings', 100_00), acc('bank', 10_40), acc('bank', 10_40), acc('cash', 5_00)],
      'INR'
    );
    expect(groups.map((g) => g.type)).toEqual(['bank', 'cash', 'savings']);
    expect(groups.map((g) => g.subtotalMinor)).toEqual([20_00, 5_00, 100_00]);
    expect(groups[0].accounts).toHaveLength(2);
  });

  it('leaves other-currency accounts out of a subtotal, and gives none when nothing counts', () => {
    const groups = groupAccountsByType(
      [acc('bank', 50_00), acc('bank', 99_00, 'USD'), acc('wallet', 9_00, 'USD')],
      'INR'
    );
    expect(groups.find((g) => g.type === 'bank')?.subtotalMinor).toBe(50_00);
    expect(groups.find((g) => g.type === 'wallet')?.subtotalMinor).toBeNull();
  });

  it('is empty for no accounts', () => {
    expect(groupAccountsByType([], 'INR')).toEqual([]);
  });
});
