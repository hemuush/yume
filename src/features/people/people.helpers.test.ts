import { personStatus, peopleTotals, lastActivityShort } from './people.helpers';

describe('people helpers', () => {
  it('reads a balance as owed, owe or settled by its sign', () => {
    expect(personStatus(500)).toBe('owed');
    expect(personStatus(-500)).toBe('owe');
    expect(personStatus(0)).toBe('settled');
  });

  it('totals rounded balances each way, so they match the rows', () => {
    // 120040 → ₹1,200 · -29960 → -₹300 · 40 paise rounds to 0 (settled)
    expect(peopleTotals([{ balanceMinor: 120040 }, { balanceMinor: -29960 }, { balanceMinor: 40 }])).toEqual({
      owedToYouMinor: 120000,
      youOweMinor: 30000,
    });
    expect(peopleTotals([])).toEqual({ owedToYouMinor: 0, youOweMinor: 0 });
  });

  it('describes the last activity compactly', () => {
    const now = new Date(2026, 8, 26, 15, 0);
    expect(lastActivityShort(null, now)).toBe('No activity');
    expect(lastActivityShort('2026-09-26', now)).toBe('Today');
    expect(lastActivityShort('2026-09-25', now)).toBe('Yesterday');
    expect(lastActivityShort('2026-09-13', now)).toBe('13d ago');
    expect(lastActivityShort('2026-09-12', now)).toBe('2w ago');
  });
});
