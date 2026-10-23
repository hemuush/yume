/**
 * Plan's new sections on their own: the prompts they show when there's nothing yet, goals with amounts
 * hidden, and the runway without a spending account. The full screen is in PlanScreen.test.tsx.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, StyleSheet, View } from 'react-native';
import { theme } from '@/constants/theme';

jest.setTimeout(30000);
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(require('react-native').View, null, children),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));

import { PeopleTile } from './PlanTiles';
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
  it('does not tell a lender that no loans exist', () => {
    const loans = buildLoansSummary(
      [
        {
          id: 'lent',
          counterparty: 'Test borrower',
          direction: 'lent',
          status: 'active',
          principalMinor: 100000,
          outstandingPrincipalMinor: 50000,
        },
      ],
      []
    );
    const open = jest.fn();
    const tree = render(<DebtPath loans={loans} today="2026-10-21" onOpen={open} />);
    expect(texts(tree)).toContain('No borrowed loans');
    expect(texts(tree)).toContain('Review repayments');
    expect(texts(tree)).not.toContain('No loans yet');
    const action = tree.root.findAll(
      (n) => n.props.accessibilityLabel === 'Review repayments. Open loans'
    )[0];
    act(() => action.props.onPress());
    expect(open).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });
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
    expect(shown).toContain('Review repayments');
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
        days={14}
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

  it('keeps compact goal rows private while retaining their detail action', () => {
    const onGoal = jest.fn();
    mockHide = true;
    try {
      const tree = render(
        <GoalsStrip compact goals={[goal]} savingsAccounts={[]} onOpen={jest.fn()} onGoal={onGoal} />
      );
      const { PlanSummaryRow } = require('./PlanSummaryRow');
      const row = tree.root.findByType(PlanSummaryRow);
      expect(row.props.progress).toBeUndefined();
      expect(row.props.subtitle).toBe('Target ₹50,000');
      expect(row.props.amount).toBe('Saved amount hidden');
      expect(texts(tree).some((t) => t.includes('₹31,000'))).toBe(false);
      act(() => row.props.onPress());
      expect(onGoal).toHaveBeenCalledWith('g');
      act(() => tree.unmount());
    } finally {
      mockHide = false;
    }
  });

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
  it('uses cash-flow outgoings even when no EMI or bill is listed', () => {
    // Plan converts a spending-to-savings transfer into an expense for the runway only.
    const runway = buildRunway(
      10000,
      [
        {
          key: 'savings-transfer',
          title: 'Move to savings',
          kind: 'bill',
          dueDate: '2026-10-10',
          amountMinor: 25000,
          route: '/recurring',
        },
      ],
      '2026-10-09',
      30
    );
    const tree = render(<RunwayCard dueSoon={dueSoon} runway={runway} hasAccounts days={30} />);
    expect(texts(tree)).not.toContain('Nothing due');
    expect(texts(tree)).toContain('₹250');
    expect(texts(tree)).toContain('₹150 more needed');
    const button = tree.root.findAll(
      (n) => n.props.onPress && String(n.props.accessibilityLabel).startsWith('Forecast details.')
    )[0];
    act(() => button.props.onPress());
    const { ForecastDetails } = require('./ForecastDetails');
    expect(tree.root.findByType(ForecastDetails).props.runway).toBe(runway);
    act(() => tree.root.findByType(ForecastDetails).props.onClose());
    expect(tree.root.findAllByType(ForecastDetails)).toHaveLength(0);
  });

  it('shows only outgoing dates in a scrollable row and preserves the selected date on refresh', () => {
    const items = [
      {
        key: 'bill',
        title: 'Bill',
        kind: 'bill' as const,
        dueDate: '2026-10-10',
        amountMinor: 20000,
        route: '/recurring' as const,
      },
      {
        key: 'income',
        title: 'Salary',
        kind: 'income' as const,
        dueDate: '2026-10-11',
        amountMinor: 900000,
        route: '/recurring' as const,
      },
      {
        key: 'later',
        title: 'Later bill',
        kind: 'bill' as const,
        dueDate: '2026-11-07',
        amountMinor: 10000,
        route: '/recurring' as const,
      },
    ];
    const { UpcomingDates } = require('./UpcomingDates');
    const runway = buildRunway(10000, items, '2026-10-09', 30);
    const tree = render(<UpcomingDates runway={runway} />);
    expect(tree.root.findAll((n) => n.props.horizontal === true).length).toBeGreaterThan(0);
    expect(tree.root.findAllByProps({ testID: 'outgoing-day-2026-10-11' })).toHaveLength(0);
    expect(tree.root.findAllByProps({ testID: 'outgoing-day-2026-10-09' })).toHaveLength(0);
    expect(texts(tree)).toContain('Bill');
    act(() => tree.root.findByProps({ testID: 'outgoing-day-2026-11-07' }).props.onPress());
    expect(texts(tree)).toContain('Later bill');
    act(() => tree.update(<UpcomingDates runway={buildRunway(999999, items, '2026-10-09', 30)} />));
    expect(
      tree.root.findByProps({ testID: 'outgoing-day-2026-11-07' }).props.accessibilityState.selected
    ).toBe(true);
    act(() => tree.update(<UpcomingDates runway={buildRunway(0, items.slice(0, 2), '2026-10-09', 30)} />));
    expect(texts(tree)).toContain('Bill');
    expect(texts(tree)).not.toContain('Salary');
    act(() => tree.unmount());
  });

  it('does not net income against outgoing on the same day', () => {
    const { UpcomingDates } = require('./UpcomingDates');
    const runway = buildRunway(
      0,
      [
        {
          key: 'in',
          title: 'Salary',
          kind: 'income',
          dueDate: '2026-10-09',
          amountMinor: 10000,
          route: '/recurring',
        },
        {
          key: 'out',
          title: 'Rent',
          kind: 'bill',
          dueDate: '2026-10-09',
          amountMinor: 10000,
          route: '/recurring',
        },
      ],
      '2026-10-09',
      1
    );
    const tree = render(<UpcomingDates runway={runway} />);
    expect(texts(tree)).toContain('₹100');
    expect(texts(tree)).toContain('Rent');
    expect(texts(tree)).not.toContain('Salary');
    act(() => tree.unmount());
  });

  it('shows a useful empty state for income-only or empty forecasts', () => {
    const { UpcomingDates } = require('./UpcomingDates');
    const runway = buildRunway(
      900000,
      [
        {
          key: 'in',
          title: 'Salary',
          kind: 'income',
          dueDate: '2026-10-09',
          amountMinor: 10000,
          route: '/recurring',
        },
      ],
      '2026-10-09',
      1
    );
    const tree = render(<UpcomingDates runway={runway} />);
    expect(texts(tree)).toContain('No upcoming outgoing payments');
    expect(texts(tree)).not.toContain('Salary');
    act(() => tree.update(<UpcomingDates runway={{ ...runway, days: [] }} />));
    expect(texts(tree)).toContain('No upcoming outgoing payments');
    act(() => tree.unmount());
  });

  it('hides a flat chart and says nothing is due', () => {
    const tree = render(
      <RunwayCard
        dueSoon={dueSoon}
        runway={buildRunway(1125000, [], '2026-10-09', 14)}
        hasAccounts
        days={14}
      />
    );
    expect(tree.root.findAll((n) => n.props.testID === 'runway')).toHaveLength(0);
    expect(texts(tree)).toContain('Nothing due');
    expect(texts(tree).some((t) => t.includes('₹11,250'))).toBe(true);
    // The old extras are gone: the list under the card is the detail.
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Forecast details')).toHaveLength(0);
    expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Open Coming up')).toHaveLength(0);
  });

  it('keeps income in the forecast summary without claiming payment coverage', () => {
    const item = {
      key: 'salary',
      title: 'Salary',
      kind: 'income' as const,
      dueDate: '2026-10-11',
      amountMinor: 500000,
      route: '/recurring' as const,
    };
    const tree = render(
      <RunwayCard
        dueSoon={dueSoon}
        runway={buildRunway(100000, [item], '2026-10-09', 14)}
        hasAccounts
        days={14}
      />
    );
    expect(tree.root.findAll((n) => n.props.testID === 'runway')).toHaveLength(0);
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

it('keeps every budget and the add action available beyond the six-tile preview', () => {
  const summary = buildBudgetsSummary(
    Array.from({ length: 8 }, (_, i) => ({
      id: `budget-${i}`,
      categoryName: `Category ${i}`,
      spentMinor: 10000,
      effectiveLimitMinor: 20000,
      remainingMinor: 10000,
      percentUsed: 50,
      overBudget: false,
    }))
  );
  const onBudget = jest.fn(),
    onAdd = jest.fn();
  const tree = render(
    <BudgetJars
      summary={summary}
      limit={summary.rows.length + 1}
      onOpen={jest.fn()}
      onBudget={onBudget}
      onAdd={onAdd}
    />
  );
  expect(texts(tree)).toContain('Category 7');
  const last = tree.root.findAll(
    (n) => n.props.onPress && String(n.props.accessibilityLabel).startsWith('Category 7,')
  )[0];
  act(() => last.props.onPress());
  expect(onBudget).toHaveBeenCalledWith('budget-7');
  const add = tree.root.findAll((n) => n.props.onPress && n.props.accessibilityLabel === 'Add a budget')[0];
  act(() => add.props.onPress());
  expect(onAdd).toHaveBeenCalledTimes(1);
});

it('shows both People balances without netting one against the other', () => {
  const tree = render(
    <PeopleTile
      state={{ kind: 'balances', count: 2, owedToYouMinor: 50000, youOweMinor: 20000 }}
      people={[]}
      onOpen={jest.fn()}
    />
  );
  expect(texts(tree)).toEqual(expect.arrayContaining(['To collect', 'To pay back', '₹500', '₹200']));
  expect(
    tree.root.findAll(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        n.props.accessibilityLabel.includes('500 to collect') &&
        n.props.accessibilityLabel.includes('200 to pay back')
    ).length
  ).toBeGreaterThan(0);
});

it('prioritises over-budget compact rows, limits the preview and opens the selected budget', () => {
  const summary = buildBudgetsSummary([
    {
      id: 'fine',
      categoryName: 'Travel',
      spentMinor: 9000,
      effectiveLimitMinor: 10000,
      remainingMinor: 1000,
      percentUsed: 90,
      overBudget: false,
    },
    {
      id: 'over',
      categoryName: 'Food',
      spentMinor: 15000,
      effectiveLimitMinor: 10000,
      remainingMinor: -5000,
      percentUsed: 150,
      overBudget: true,
    },
  ]);
  const onBudget = jest.fn();
  const tree = render(
    <BudgetJars compact limit={1} summary={summary} onOpen={jest.fn()} onBudget={onBudget} />
  );
  const { PlanSummaryRow } = require('./PlanSummaryRow');
  const rows = tree.root.findAllByType(PlanSummaryRow);
  expect(rows).toHaveLength(1);
  expect(rows[0].props.name).toBe('Food');
  expect(rows[0].props.amount).toBe('₹50 over');
  act(() => rows[0].props.onPress());
  expect(onBudget).toHaveBeenCalledWith('over');
  act(() => tree.unmount());
});

it.each([
  [320, 1, true],
  [390, 1.5, true],
  [390, 1, false],
])('wraps compact row amounts at width %s and font scale %s', (width, fontScale, stacked) => {
  const rn = require('react-native');
  const dimensions = jest
    .spyOn(rn, 'useWindowDimensions')
    .mockReturnValue({ width, height: 800, scale: 1, fontScale });
  try {
    const { PlanSummaryRow } = require('./PlanSummaryRow');
    const tree = render(
      <PlanSummaryRow
        name="A long category name"
        subtitle="150% used"
        amount="₹10,000 over"
        icon="tag"
        progress={150}
        color="#BD3547"
        accessibilityLabel="Open category"
        onPress={jest.fn()}
      />
    );
    const styles = tree.root.findAllByType(View).map((node) => StyleSheet.flatten(node.props.style));
    expect(styles.some((style) => style?.flexDirection === 'column')).toBe(stacked);
    expect(styles.some((style) => style?.width === '100%')).toBe(true);
    act(() => tree.unmount());
  } finally {
    dimensions.mockRestore();
  }
});

it.each([false, true])('keeps integrated Add loan separate from opening Loans (has debt: %s)', (hasDebt) => {
  const loans = buildLoansSummary(
    hasDebt
      ? [
          {
            id: 'loan',
            counterparty: 'Bank',
            direction: 'borrowed',
            status: 'active',
            principalMinor: 10000,
            outstandingPrincipalMinor: 8000,
          },
        ]
      : [],
    []
  );
  const open = jest.fn(),
    add = jest.fn();
  const tree = render(<DebtPath loans={loans} today="2026-10-20" onOpen={open} onAdd={add} />);
  const action = tree.root.findAll((n) => n.props.accessibilityLabel === 'Add loan' && n.props.onPress)[0];
  for (let parent = action.parent; parent; parent = parent.parent)
    expect(parent.props.accessibilityRole).not.toBe('button');
  act(() => action.props.onPress());
  expect(add).toHaveBeenCalledTimes(1);
  expect(open).not.toHaveBeenCalled();
  const summary = tree.root.findAll(
    (n) =>
      n.props.onPress &&
      (String(n.props.accessibilityLabel).startsWith('Principal left') ||
        n.props.accessibilityLabel === 'Track an EMI. Open loans')
  )[0];
  act(() => summary.props.onPress());
  expect(open).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

it('turns an over-budget progress card red', () => {
  const summary = buildBudgetsSummary([
    {
      id: 'coloured',
      categoryName: 'Travel',
      categoryColor: '#A56ABC',
      spentMinor: 12000,
      effectiveLimitMinor: 10000,
      remainingMinor: -2000,
      percentUsed: 120,
      overBudget: true,
    },
  ]);
  const tree = render(<BudgetJars summary={summary} onOpen={jest.fn()} />);
  const progress = tree.root
    .findAllByType(View)
    .find(
      (n) =>
        StyleSheet.flatten(n.props.style)?.width === '100%' &&
        StyleSheet.flatten(n.props.style)?.backgroundColor === theme.colors.expense
    );
  expect(progress).toBeDefined();
  expect(texts(tree).join(' ')).toContain('over');
  act(() => tree.unmount());
});
