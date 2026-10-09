/** The Loans hero in each state: owing, all paid off, only lending, and loading. All figures are made up. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer, ReactTestInstance } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/CountUpAmount', () => {
  const { Text: RNText } = jest.requireActual('react-native');
  const { formatMoney } = jest.requireActual('@/lib/money');
  return { CountUpAmount: ({ minor }: { minor: number }) => <RNText>{formatMoney(minor)}</RNText> };
});

import { LoansHero } from './LoansHero';
import type { LoanTotals } from './loanTotals';

const totals = (over: Partial<LoanTotals> = {}): LoanTotals => ({
  youOweMinor: 9000000,
  owedToYouMinor: 0,
  emiPerMonthMinor: 250000,
  interestLeftMinor: 1200000,
  debtFreeDate: '2045-01-05',
  repaidFraction: 0.02,
  activeCount: 2,
  closedCount: 0,
  ...over,
});

const flat = (n: ReactTestInstance | string): string =>
  typeof n === 'string' ? n : n.children.map(flat).join('');
const texts = (tree: ReactTestRenderer) => tree.root.findAllByType(Text).map(flat);

function render(t: LoanTotals, loading = false) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <LoansHero totals={t} shares={[{ id: 'a', fraction: 1 }]} hues={{ a: '#FFE3D6' }} loading={loading} />
    );
  });
  return tree;
}

afterAll(() => new Promise((resolve) => setTimeout(resolve, 800)));

describe('LoansHero', () => {
  it('shows the debt, the debt-free month and the repaid share while you owe', () => {
    const shown = texts(render(totals()));
    expect(shown).toEqual(
      expect.arrayContaining(['You owe', '₹90,000', 'Debt-free', 'Jan 2045', '₹2,500', 'EMIs a month'])
    );
    expect(shown.some((t) => t.includes('2%') && t.includes('repaid'))).toBe(true);
    expect(shown).toEqual(expect.arrayContaining(['2', 'active loans']));
  });

  it('has no explainer line under the share bar', () => {
    expect(texts(render(totals())).some((t) => t.includes('the bar shows'))).toBe(false);
  });

  it('says everything is paid off once nothing is owed or lent', () => {
    const shown = texts(
      render(totals({ youOweMinor: 0, debtFreeDate: null, activeCount: 0, closedCount: 3 }))
    );
    expect(shown).toEqual(expect.arrayContaining(['Debt-free', 'Everything is paid off', '3 loans closed']));
    expect(shown).not.toContain('You owe');
  });

  it('shows money owed to you when you only lend', () => {
    const shown = texts(
      render(totals({ youOweMinor: 0, owedToYouMinor: 500000, debtFreeDate: null, activeCount: 1 }))
    );
    expect(shown).toEqual(expect.arrayContaining(['Owed to you', '₹5,000', '1', 'active loan']));
  });

  it('shows a skeleton and none of the figures while loading', () => {
    const shown = texts(render(totals(), true));
    expect(shown).not.toContain('You owe');
  });

  it('draws the road to debt-free: a line per loan ending the month it finishes', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <LoansHero
          totals={totals()}
          shares={[{ id: 'a', fraction: 1 }]}
          hues={{ a: '#FFE3D6' }}
          timeline={{
            rows: [
              { id: 'b', name: 'Car loan', endDate: '2028-06-05', fraction: 0.15 },
              { id: 'a', name: 'Home loan', endDate: '2045-01-05', fraction: 1 },
            ],
            midYear: 2035,
            endYear: 2045,
          }}
        />
      );
    });
    const shown = texts(tree);
    expect(shown).toEqual(
      expect.arrayContaining(['Car loan', 'Jun 2028', 'Home loan', 'Now', '2035', 'Debt-free 2045'])
    );
  });

  it('keeps the split bar when a loan you owe on has no end date to put on the timeline', () => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <LoansHero
          totals={totals()}
          shares={[
            { id: 'a', fraction: 0.8 },
            { id: 'p', fraction: 0.2 },
          ]}
          hues={{ a: '#FFE3D6', p: '#FBF0CE' }}
          timeline={{
            rows: [{ id: 'a', name: 'Home loan', endDate: '2045-01-05', fraction: 1 }],
            midYear: 2035,
            endYear: 2045,
          }}
        />
      );
    });
    expect(texts(tree)).not.toContain('Debt-free 2045');
  });
});
