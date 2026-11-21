/**
 * Plan's new sections on their own: the prompts they show when there's nothing yet, goals with amounts
 * hidden, and the runway without a spending account. The full screen is in PlanScreen.test.tsx.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, StyleSheet, View } from 'react-native';

jest.setTimeout(30000);
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(require('react-native').View, null, children),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));

import { PlanPeopleHabit } from './PlanPeopleHabit';
import { RunwayCard } from './RunwayCard';
import { ForecastDetails } from './ForecastDetails';
import { ComingUpSection } from './ComingUpSection';
import { buildRunway } from './runway';

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
  ['2026-10-08', 'Overdue by 1 day'],
  ['2026-10-09', 'Due today'],
  ['2026-10-10', 'Due tomorrow'],
])('says how late or close the payment is for %s while retaining Pay', (date, label) => {
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
  expect(texts(tree).some((t) => t.includes(label))).toBe(true);
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

it('a preview row says what it is, not the day its heading already names', () => {
  const tree = render(
    <ComingUpSection
      preview
      groups={[
        {
          date: '2026-10-20',
          outMinor: 10000,
          items: [
            {
              key: 'b',
              title: 'Rent',
              kind: 'bill',
              dueDate: '2026-10-20',
              amountMinor: 10000,
              route: '/recurring',
            },
          ],
        },
      ]}
      today="2026-10-09"
      onOpen={jest.fn()}
    />
  );
  expect(texts(tree)).toContain('Bill');
  expect(texts(tree).some((t) => t.includes('Tue, 20 Oct'))).toBe(false);
  act(() => tree.unmount());
});

describe('Plan sections with nothing in them yet', () => {
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

  it('keeps the forecast verdict and balance visible and puts the cash-flow figures in details', () => {
    const runway = buildRunway(10000, [], '2026-10-09', 30);
    const tree = render(<RunwayCard dueSoon={dueSoon} runway={runway} hasAccounts days={30} />);
    const before = tree.root.findAllByType(Text).map((text) => text.props.children);
    expect(before).toEqual(expect.arrayContaining(['Nothing due', 'Current balance', '₹100']));
    expect(before).not.toContain('Going out');
    const details = tree.root.findAll(
      (node) => node.props.accessibilityLabel?.startsWith('Forecast details.') && node.props.onPress
    )[0];
    act(() => details.props.onPress());
    expect(tree.root.findByType(ForecastDetails).props.runway).toBe(runway);
    act(() => tree.unmount());
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

  it('starts on All, lists every day under its heading, and marks late or close dates with a dot', () => {
    const { UpcomingDates } = require('./UpcomingDates');
    const { ComingUpSection } = require('./ComingUpSection');
    const item = (key: string, title: string, dueDate: string, kind: 'emi' | 'bill' = 'bill') => ({
      key,
      title,
      kind,
      dueDate,
      amountMinor: 10000,
      route: '/recurring' as const,
    });
    const runway = buildRunway(
      0,
      [item('a', 'Rent', '2026-10-09'), item('b', 'Gym', '2026-10-20'), item('c', 'Streaming', '2026-10-21')],
      '2026-10-09',
      30
    );
    const tree = render(
      <UpcomingDates
        runway={runway}
        today="2026-10-09"
        renderDays={(days: typeof runway.days) => (
          <ComingUpSection
            today="2026-10-09"
            onOpen={jest.fn()}
            groups={days.map((day) => ({ date: day.date, outMinor: day.outMinor, items: day.items }))}
          />
        )}
      />
    );
    // Every date's payments show at once, with a heading and total per day.
    expect(texts(tree)).toEqual(expect.arrayContaining(['Rent', 'Gym', 'Streaming']));
    expect(texts(tree).some((t) => t.startsWith('Today · '))).toBe(true);
    expect(texts(tree).filter((t) => t === '₹100 out')).toHaveLength(3);
    const chip = (date: string) => tree.root.findByProps({ testID: `outgoing-day-${date}` });
    expect(tree.root.findByProps({ testID: 'outgoing-day-all' }).props.accessibilityState.selected).toBe(
      true
    );
    // Rent is due today, so its date says so; the others carry no warning.
    expect(chip('2026-10-09').props.accessibilityLabel).toContain('due now or late');
    expect(chip('2026-10-20').props.accessibilityLabel).not.toContain('due');
    act(() => chip('2026-10-20').props.onPress());
    expect(texts(tree)).toContain('Gym');
    expect(texts(tree)).not.toContain('Rent');
    act(() => tree.root.findByProps({ testID: 'outgoing-day-all' }).props.onPress());
    expect(texts(tree)).toEqual(expect.arrayContaining(['Rent', 'Gym']));
    act(() => tree.unmount());
  });

  it('notes overdue payments in the day heading that counts them', () => {
    const { ComingUpSection } = require('./ComingUpSection');
    const tree = render(
      <ComingUpSection
        today="2026-10-09"
        onOpen={jest.fn()}
        groups={[
          {
            date: '2026-10-09',
            outMinor: 20000,
            items: [
              {
                key: 'late',
                title: 'Rent',
                kind: 'bill' as const,
                dueDate: '2026-10-07',
                amountMinor: 20000,
                route: '/recurring' as const,
              },
            ],
          },
        ]}
      />
    );
    expect(texts(tree).some((t) => t.includes('incl. overdue'))).toBe(true);
    expect(texts(tree).some((t) => t.includes('Overdue by 2 days'))).toBe(true);
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
    const tree = render(<UpcomingDates runway={runway} today="2026-10-09" />);
    expect(texts(tree).some((t) => t.includes('₹100'))).toBe(true);
    expect(texts(tree)).toContain('Rent');
    expect(texts(tree)).not.toContain('Salary');
    act(() => tree.root.findByProps({ testID: 'outgoing-day-2026-10-09' }).props.onPress());
    const income = tree.root.findAll(
      (node) =>
        node.props.accessibilityRole === 'radio' &&
        typeof node.props.onPress === 'function' &&
        node.findAllByType(Text).some((label) => label.props.children === 'Money in')
    )[0];
    act(() => income.props.onPress());
    expect(tree.root.findByProps({ testID: 'income-day-2026-10-09' }).props.accessibilityLabel).not.toContain(
      'due now or late'
    );
    const outgoing = tree.root.findAll(
      (node) =>
        node.props.accessibilityRole === 'radio' &&
        typeof node.props.onPress === 'function' &&
        node.findAllByType(Text).some((label) => label.props.children === 'Money out')
    )[0];
    act(() => outgoing.props.onPress());
    expect(
      tree.root.findByProps({ testID: 'outgoing-day-2026-10-09' }).props.accessibilityState.selected
    ).toBe(true);
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

  it('shows a negative spending balance even when no payments are scheduled', () => {
    const tree = render(
      <RunwayCard
        dueSoon={dueSoon}
        runway={buildRunway(-12500, [], '2026-10-09', 14)}
        hasAccounts
        days={14}
      />
    );
    expect(texts(tree)).toContain('₹125 more needed');
    expect(texts(tree)).not.toContain('Nothing due');
    act(() => tree.unmount());
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
    // The income is named in the details button label.
    expect(
      tree.root.findAll((n) => String(n.props.accessibilityLabel).includes('+₹5,000 coming in')).length
    ).toBeGreaterThan(0);
  });
});

const peopleCard = (people: React.ComponentProps<typeof PlanPeopleHabit>['people']) =>
  render(
    <PlanPeopleHabit
      people={people}
      topPeople={[]}
      habit={null}
      goalMinor={null}
      onPeople={jest.fn()}
      onGarden={jest.fn()}
    />
  );

it('shows both People balances without netting one against the other', () => {
  const tree = peopleCard({ kind: 'balances', count: 2, owedToYouMinor: 50000, youOweMinor: 20000 });
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

it('shows only the People balance there is', () => {
  const owed = texts(peopleCard({ kind: 'balances', count: 1, owedToYouMinor: 50000, youOweMinor: 0 }));
  expect(owed).toContain('To collect');
  expect(owed).not.toContain('To pay back');
  const owing = texts(peopleCard({ kind: 'balances', count: 1, owedToYouMinor: 0, youOweMinor: 20000 }));
  expect(owing).toContain('To pay back');
  expect(owing).not.toContain('To collect');
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
    const { PlanMoneyRow } = require('./PlanMoneyRow');
    const tree = render(
      <PlanMoneyRow
        icon={null}
        title="A long category name"
        subtitle={null}
        value="₹10,000 over"
        progress={{ pct: 100, color: '#BD3547', animKey: 'k' }}
        accessibilityLabel="Open category"
        onPress={jest.fn()}
      />
    );
    const styles = tree.root.findAllByType(View).map((node) => StyleSheet.flatten(node.props.style));
    expect(styles.some((style) => style?.flexDirection === 'column')).toBe(stacked);
    act(() => tree.unmount());
  } finally {
    dimensions.mockRestore();
  }
});
