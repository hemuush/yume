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
import { ComingUpSection } from './ComingUpSection';
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

// The rows count days from the real clock; pin only Date so the fixture's "today" is today.
beforeAll(() =>
  jest.useFakeTimers({
    now: new Date(2026, 9, 9, 9, 0, 0),
    doNotFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'setImmediate',
      'clearImmediate',
      'nextTick',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
    ],
  })
);
afterAll(() => jest.useRealTimers());

const dueSoon = { totalMinor: 0, emiMinor: 0, billMinor: 0, count: 0, untilDate: '2026-10-22' };

it.each([
  ['2026-10-08', 'Overdue'],
  ['2026-10-09', 'Due now'],
  ['2026-10-10', 'Due soon'],
])('labels payment status for %s while retaining Pay', (date, label) => {
  const pay = jest.fn(),
    open = jest.fn();
  const item = {
    key: 'emi',
    title: 'Home loan',
    kind: 'emi' as const,
    dueDate: date,
    amountMinor: 10000,
    route: '/loans' as const,
    loanId: 'loan',
  };
  const tree = render(
    <ComingUpSection
      groups={[{ date, outMinor: 10000, items: [item] }]}
      today="2026-10-09"
      onOpen={open}
      onPay={pay}
    />
  );
  expect(texts(tree)).toContain(label);
  // The Pay pill ends the row; the row is the one tap target and opens the pay sheet.
  act(() =>
    tree.root
      .findAll(
        (n) =>
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.endsWith(', Pay') &&
          typeof n.props.onPress === 'function'
      )[0]
      .props.onPress()
  );
  expect(pay).toHaveBeenCalledWith('loan');
  expect(open).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

describe('Plan sections with nothing in them yet', () => {
  it('shows only the debt summary and opens Loans without selecting a loan detail', () => {
    const open = jest.fn();
    const loans = {
      debtLeftMinor: 90000,
      paidOffMinor: 10000,
      borrowedPrincipalMinor: 100000,
      paidFraction: 0.1,
      borrowedCount: 1,
      debtFreeDate: '2028-10-09',
      lentLeftMinor: 0,
      rows: [
        {
          id: 'private-loan',
          name: 'House loan',
          direction: 'borrowed' as const,
          leftMinor: 90000,
          nextDueDate: '2026-11-01',
          nextEmiMinor: 10000,
          paidCount: 1,
          totalCount: 24,
          endDate: '2028-10-09',
        },
      ],
    };
    const tree = render(<DebtPath loans={loans} today="2026-10-09" onOpen={open} />);
    expect(texts(tree)).toContain('₹900 left');
    expect(texts(tree)).not.toContain('House loan');
    const actions = tree.root.findAll(
      (node) => node.props.onPress && node.props.accessibilityRole === 'button'
    );
    expect(actions.every((node) => String(node.props.accessibilityLabel).endsWith('Open loans'))).toBe(true);
    act(() => actions[0].props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
    expect(open.mock.calls[0]).toEqual([]);
  });
  it('shows what is left, the debt-free month and how much is repaid, and opens Loans', () => {
    const row = (id: string, name: string, leftMinor: number, nextDueDate: string) => ({
      id,
      name,
      direction: 'borrowed' as const,
      leftMinor,
      nextDueDate,
      nextEmiMinor: 340600,
      paidCount: 1,
      totalCount: 24,
      endDate: '2045-01-03',
    });
    const loans = {
      debtLeftMinor: 2254000,
      paidOffMinor: 46000,
      borrowedPrincipalMinor: 2300000,
      paidFraction: 0.02,
      borrowedCount: 2,
      debtFreeDate: '2045-01-03',
      lentLeftMinor: 0,
      rows: [row('small', 'Personal', 500000, '2026-11-03'), row('big', 'House', 1754000, '2026-11-05')],
    };
    const onOpen = jest.fn();
    const tree = render(<DebtPath loans={loans} today="2026-10-09" onOpen={onOpen} />);
    const shown = texts(tree);
    expect(shown.some((t) => t.startsWith('Debt-free '))).toBe(true);
    expect(shown).toContain('₹22,540 left');
    expect(shown).toContain('2% repaid · 2 loans');
    // One card, one action: no second link and no loan row repeating what Loans lists.
    expect(shown).not.toContain('House');
    expect(shown.some((t) => t.includes('View loans'))).toBe(false);
    act(() =>
      tree.root.find((n) => n.props.onPress && n.props.accessibilityRole === 'button').props.onPress()
    );
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

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
    const shown = texts(render(<DebtPath loans={loans} today="2026-10-09" onOpen={jest.fn()} />));
    expect(shown).toContain('Track an EMI');
    expect(shown).toContain('₹2,000 you lent out');
  });

  it('says what is going out when there is no spending account to draw the runway from', () => {
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
      />
    );
    const shown = texts(tree);
    expect(shown).not.toContain('Covered');
    // No balance to draw: it says what is going out and asks for an account.
    expect(shown).toContain('₹450');
    expect(shown.some((t) => t.includes('Add a bank, cash or wallet account'))).toBe(true);
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
    expect(shown.some((t) => t.includes('₹31k'))).toBe(true);
  });

  it('withholds the fill, percent and saved amount, keeping the target', () => {
    mockHide = true;
    try {
      const tree = render(<GoalsStrip goals={[goal]} savingsAccounts={[]} onOpen={jest.fn()} />);
      const shown = texts(tree);
      expect(shown.some((t) => t.startsWith('62'))).toBe(false);
      expect(shown.some((t) => t.includes('₹31k'))).toBe(false);
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
  it('labels completed goals, preserves their action and hides completion under privacy', () => {
    mockHide = false;
    const open = jest.fn();
    const completed = { ...goal, currentAmountMinor: goal.targetAmountMinor };
    const tree = render(<GoalsStrip goals={[completed]} savingsAccounts={[]} onOpen={open} />);
    expect(texts(tree)).toContain('Completed');
    act(() =>
      tree.root
        .findAll(
          (n) =>
            n.props.accessibilityRole === 'button' && String(n.props.accessibilityLabel).includes('reached')
        )[0]
        .props.onPress()
    );
    expect(open).toHaveBeenCalledTimes(1);
    mockHide = true;
    try {
      act(() => tree.update(<GoalsStrip goals={[completed]} savingsAccounts={[]} onOpen={open} />));
      expect(texts(tree)).not.toContain('Completed');
    } finally {
      mockHide = false;
      act(() => tree.unmount());
    }
  });
});

describe('Runway card', () => {
  it('hides a flat chart and says nothing is due', () => {
    const tree = render(
      <RunwayCard dueSoon={dueSoon} runway={buildRunway(1125000, [], '2026-10-09', 14)} hasAccounts />
    );
    expect(tree.root.findAll((n) => n.props.testID === 'runway')).toHaveLength(0);
    expect(texts(tree)).toContain('Nothing due');
    expect(texts(tree).some((t) => t.includes('₹11,250'))).toBe(true);
    // The old extras are gone: the list under the card is the detail.
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Forecast details')).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Open Coming up')).toHaveLength(0);
  });

  it('keeps an income-only changing forecast visible without claiming payment coverage', () => {
    const item = {
      key: 'salary',
      title: 'Salary',
      kind: 'income' as const,
      dueDate: '2026-10-11',
      amountMinor: 500000,
      route: '/recurring' as const,
    };
    const tree = render(
      <RunwayCard dueSoon={dueSoon} runway={buildRunway(100000, [item], '2026-10-09', 14)} hasAccounts />
    );
    expect(tree.root.findAll((n) => n.props.testID === 'runway').length).toBeGreaterThan(0);
    expect(texts(tree)).not.toContain('Covered');
    expect(texts(tree).some((t) => t.includes('+₹5,000 coming in'))).toBe(true);
  });
});

it('starts budget setup directly from an empty Plan budget card', () => {
  const open = jest.fn(),
    add = jest.fn();
  const tree = render(<BudgetJars summary={buildBudgetsSummary([])} onOpen={open} onAdd={add} />);
  act(() =>
    tree.root
      .findAll(
        (n) => n.props.accessibilityLabel === 'Set a monthly limit. Open budgets' && n.props.onPress
      )[0]
      .props.onPress()
  );
  expect(add).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
  act(() => tree.unmount());
});
