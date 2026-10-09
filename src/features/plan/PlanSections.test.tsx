/**
 * Plan's new sections on their own: the prompts they show when there's nothing yet, goals with amounts
 * hidden, and the runway without a spending account. The full screen is in PlanScreen.test.tsx.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));

import { BudgetJars } from './BudgetJars';
import { DebtPath } from './DebtPath';
import { GoalsStrip } from './PlanGoals';
import { RunwayCard } from './RunwayCard';
import { buildBudgetsSummary, buildLoansSummary } from './planOverview';
import { buildRunway } from './runway';
import type { SavingsGoal } from '@/types';

function render(el: React.ReactElement) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(el);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

const dueSoon = { totalMinor: 0, emiMinor: 0, billMinor: 0, count: 0, untilDate: '2026-10-22' };

describe('Plan sections with nothing in them yet', () => {
  it('asks for a first budget, and a first EMI (saying what you lent)', () => {
    expect(texts(render(<BudgetJars summary={buildBudgetsSummary([])} onOpen={jest.fn()} />))).toContain(
      'Set a monthly limit'
    );
    const loans = buildLoansSummary(
      [
        {
          id: 'l',
          counterparty: 'Asha',
          direction: 'lent',
          status: 'active',
          principalMinor: 500000,
          outstandingPrincipalMinor: 200000,
        },
      ],
      []
    );
    const shown = texts(
      render(<DebtPath loans={loans} dueSoon={dueSoon} today="2026-10-09" onOpen={jest.fn()} />)
    );
    expect(shown).toContain('Track an EMI');
    expect(shown).toContain('₹2,000 you lent out');
  });

  it('says what is next when there is no spending account to draw the runway from', () => {
    const next = {
      date: '2026-10-11',
      outMinor: 45000,
      items: [
        {
          key: 'r',
          title: 'Rent',
          kind: 'bill' as const,
          dueDate: '2026-10-11',
          amountMinor: 45000,
          route: '/recurring' as const,
        },
      ],
    };
    const tree = render(
      <RunwayCard
        dueSoon={{ ...dueSoon, totalMinor: 45000, billMinor: 45000, count: 1 }}
        runway={buildRunway(0, next.items, '2026-10-09', 14)}
        hasAccounts={false}
        next={next}
        onOpen={jest.fn()}
        onJumpToDay={jest.fn()}
      />
    );
    const shown = texts(tree);
    expect(shown).not.toContain('Your accounts cover it');
    // "Next: Sun, 11 Oct (₹450), in 2 days" — the day is its own bold piece.
    const { weekdayDayMonth } = require('@/lib/dateLabels');
    expect(shown).toContain(weekdayDayMonth('2026-10-11'));
    expect(tree.root.findAll((n) => n.props.testID === 'runway')).toHaveLength(0);
  });
});

describe('Goals with amounts hidden', () => {
  const goal: SavingsGoal = {
    id: 'g',
    name: 'Goa trip',
    targetAmountMinor: 5000000,
    currentAmountMinor: 3100000,
    targetDate: null,
    linkedAccountId: null,
    tracksAccount: false,
    noteToSelf: null,
    letterRevealed: false,
    archived: false,
    createdAt: '2026-01-01',
  };

  it('shows the percent and saved amount normally', () => {
    mockHide = false;
    const shown = texts(render(<GoalsStrip goals={[goal]} savingsAccounts={[]} onOpen={jest.fn()} />));
    expect(shown.some((t) => t.startsWith('62'))).toBe(true);
    expect(shown.some((t) => t.includes('₹31,000'))).toBe(true);
  });

  it('withholds the fill, percent and saved amount, keeping the target', () => {
    mockHide = true;
    try {
      const tree = render(<GoalsStrip goals={[goal]} savingsAccounts={[]} onOpen={jest.fn()} />);
      const shown = texts(tree);
      expect(shown.some((t) => t.startsWith('62'))).toBe(false);
      expect(shown.some((t) => t.includes('₹31,000'))).toBe(false);
      expect(
        tree.root.findAll(
          (n) =>
            typeof n.props.accessibilityLabel === 'string' &&
            n.props.accessibilityLabel.includes('saved amount hidden')
        ).length
      ).toBeGreaterThan(0);
    } finally {
      mockHide = false;
    }
  });
});
