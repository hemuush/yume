/**
 * Combinatorial coverage of the two pure net-worth primitives shared by Home
 * and Profile: `loanNetWorthContribution` (per-loan sign + asset-value
 * offset) and `computeTrackedBalance` (the whole headline figure). Every
 * generated case is checked against an independent hand formula so the
 * helpers can't silently drift.
 */
import { loanNetWorthContribution, computeTrackedBalance } from './reports';

const rupees = (n: number) => n * 100;

describe('loanNetWorthContribution — sign, sign, and the borrowed-loan asset offset', () => {
  const PRINCIPALS = [0, rupees(1000), rupees(50000), rupees(500000), rupees(2500000), rupees(10000000)];
  const PAID_FRACS = [0, 0.1, 0.25, 0.5, 0.75, 1, 1.2]; // 1.2 = over-paid (rounding)
  const ASSET_FRACS = [0, 0.5, 0.9, 1, 1.5, 3];

  for (const principal of PRINCIPALS) {
    for (const paidFrac of PAID_FRACS) {
      const paid = Math.round(principal * paidFrac);
      const outstanding = Math.max(0, principal - paid);

      it(`lent P=${principal} paid=${paid} → +outstanding (${outstanding})`, () => {
        expect(loanNetWorthContribution('lent', principal, paid)).toBe(outstanding);
        // Asset value is meaningless for a lent loan and must be ignored.
        expect(loanNetWorthContribution('lent', principal, paid, rupees(9_99_999))).toBe(outstanding);
      });

      it(`borrowed P=${principal} paid=${paid}, no asset → -outstanding (${-outstanding})`, () => {
        // `-0 || 0` normalises the fully-paid case (avoids an Object.is(-0, 0) mismatch).
        expect(loanNetWorthContribution('borrowed', principal, paid)).toBe(-outstanding || 0);
      });

      for (const assetFrac of ASSET_FRACS) {
        const assetValue = Math.round(principal * assetFrac);
        it(`borrowed P=${principal} paid=${paid} asset=${assetValue} → equity (asset - outstanding)`, () => {
          expect(loanNetWorthContribution('borrowed', principal, paid, assetValue)).toBe(
            assetValue - outstanding
          );
        });
      }
    }
  }
});

describe('computeTrackedBalance — accounts (default currency only) + loans + people, vs a hand formula', () => {
  type Acc = { currency: string; currentBalanceMinor: number };
  type Ln = {
    direction: 'borrowed' | 'lent';
    status: 'active' | 'closed' | 'defaulted';
    outstandingPrincipalMinor: number;
    assetValueMinor: number | null;
  };

  const acc = (currency: string, bal: number): Acc => ({ currency, currentBalanceMinor: bal });
  const ln = (
    direction: Ln['direction'],
    status: Ln['status'],
    outstanding: number,
    asset: number | null = null
  ): Ln => ({ direction, status, outstandingPrincipalMinor: outstanding, assetValueMinor: asset });

  const hand = (input: {
    accounts: Acc[];
    loans: Ln[];
    people: { balanceMinor: number }[];
    defaultCurrency: string;
  }) => {
    const accountsTotal = input.accounts
      .filter((a) => a.currency === input.defaultCurrency)
      .reduce((s, a) => s + a.currentBalanceMinor, 0);
    const loansNet = input.loans
      .filter((l) => l.status !== 'closed')
      .reduce((s, l) => {
        if (l.direction === 'lent') return s + l.outstandingPrincipalMinor;
        return s + ((l.assetValueMinor ?? 0) - l.outstandingPrincipalMinor);
      }, 0);
    const peopleNet = input.people.reduce((s, p) => s + p.balanceMinor, 0);
    return accountsTotal + loansNet + peopleNet;
  };

  const ACCOUNT_SETS: Acc[][] = [
    [],
    [acc('INR', rupees(1000))],
    [acc('INR', rupees(50000)), acc('INR', rupees(-3000))],
    [acc('INR', rupees(20000)), acc('USD', rupees(5000)), acc('EUR', rupees(9999))],
    [acc('USD', rupees(100000))], // no default-currency account at all
    [acc('INR', 0), acc('INR', 0), acc('INR', rupees(777))],
  ];
  const LOAN_SETS: Ln[][] = [
    [],
    [ln('borrowed', 'active', rupees(200000))],
    [ln('lent', 'active', rupees(80000))],
    [ln('borrowed', 'active', rupees(2200000), rupees(3500000))], // home with equity
    [ln('borrowed', 'active', rupees(2200000), rupees(1800000))], // underwater
    [ln('borrowed', 'defaulted', rupees(150000))], // still counts
    [ln('borrowed', 'closed', 0), ln('lent', 'closed', 0)], // both drop out
    [
      ln('borrowed', 'active', rupees(500000)),
      ln('lent', 'active', rupees(120000)),
      ln('borrowed', 'defaulted', rupees(90000)),
      ln('borrowed', 'closed', 0),
      ln('borrowed', 'active', rupees(3000000), rupees(4000000)),
    ],
  ];
  const PEOPLE_SETS: { balanceMinor: number }[][] = [
    [],
    [{ balanceMinor: rupees(500) }],
    [{ balanceMinor: rupees(2000) }, { balanceMinor: rupees(-1200) }],
    [{ balanceMinor: rupees(-5000) }],
  ];

  for (let ai = 0; ai < ACCOUNT_SETS.length; ai++) {
    for (let li = 0; li < LOAN_SETS.length; li++) {
      for (let pi = 0; pi < PEOPLE_SETS.length; pi++) {
        const input = {
          accounts: ACCOUNT_SETS[ai],
          loans: LOAN_SETS[li],
          people: PEOPLE_SETS[pi],
          defaultCurrency: 'INR',
        };
        it(`accounts[${ai}] × loans[${li}] × people[${pi}]`, () => {
          expect(computeTrackedBalance(input)).toBe(hand(input));
        });
      }
    }
  }

  it('is invariant to loan/account/people ordering', () => {
    const a = [acc('INR', rupees(10000)), acc('USD', rupees(1)), acc('INR', rupees(-2000))];
    const l = LOAN_SETS[7];
    const p = PEOPLE_SETS[2];
    const base = computeTrackedBalance({ accounts: a, loans: l, people: p, defaultCurrency: 'INR' });
    expect(
      computeTrackedBalance({
        accounts: [...a].reverse(),
        loans: [...l].reverse(),
        people: [...p].reverse(),
        defaultCurrency: 'INR',
      })
    ).toBe(base);
  });

  it('a fully closed loan changes nothing whether present or absent', () => {
    const withClosed = computeTrackedBalance({
      accounts: [acc('INR', rupees(5000))],
      loans: [ln('borrowed', 'active', rupees(100000)), ln('lent', 'closed', 0)],
      people: [],
      defaultCurrency: 'INR',
    });
    const withoutClosed = computeTrackedBalance({
      accounts: [acc('INR', rupees(5000))],
      loans: [ln('borrowed', 'active', rupees(100000))],
      people: [],
      defaultCurrency: 'INR',
    });
    expect(withClosed).toBe(withoutClosed);
  });
});
