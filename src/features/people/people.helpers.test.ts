import { personStatus, peopleTotals, lastActivityShort, groupPeople } from './people.helpers';

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

describe('groupPeople', () => {
  const p = (name: string, balanceMinor: number) => ({ name, balanceMinor });

  it('splits by who owes whom, biggest balance first, and totals the two sides', () => {
    const g = groupPeople([p('a', 85000), p('b', -120000), p('c', 240000), p('d', 0), p('e', -30000)]);
    expect(g.owed.map((x) => x.name)).toEqual(['c', 'a']);
    expect(g.owe.map((x) => x.name)).toEqual(['b', 'e']);
    expect(g.settled.map((x) => x.name)).toEqual(['d']);
    expect(g.owedToYouMinor).toBe(325000);
    expect(g.youOweMinor).toBe(150000);
    expect(g.netMinor).toBe(175000);
  });

  it('treats a balance that rounds to zero rupees as settled', () => {
    const g = groupPeople([p('a', 30), p('b', -20)]);
    expect(g.settled).toHaveLength(2);
    expect(g.owed).toHaveLength(0);
    expect(g.netMinor).toBe(0);
  });

  it('is negative overall when you owe more than you are owed', () => {
    expect(groupPeople([p('a', 10000), p('b', -50000)]).netMinor).toBe(-40000);
  });
});
