import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(require('react-native').View, null, children),
}));

import { PlanNavigation, PLAN_TABS } from './PlanNavigation';
import { ForecastDetails } from './ForecastDetails';
import { buildRunway } from './runway';

function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(element);
  });
  return tree;
}
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

afterEach(() => jest.restoreAllMocks());

it('keeps all four destinations reachable in the fixed tab control', () => {
  const onChange = jest.fn();
  const tree = render(<PlanNavigation value="money" onChange={onChange} />);
  expect(PLAN_TABS).toHaveLength(4);
  expect(texts(tree)).toEqual(expect.arrayContaining(PLAN_TABS.map((t) => t.label)));
  const debt = tree.root.findAll(
    (n) =>
      n.props.onPress &&
      n.props.accessibilityRole === 'tab' &&
      n.findAllByType(Text).some((t) => t.props.children === 'Debt')
  )[0];
  act(() => debt.props.onPress());
  expect(onChange).toHaveBeenCalledWith('debt');
});

it('explains an early shortfall even when late income makes the ending balance positive', () => {
  const runway = buildRunway(
    10000,
    [
      {
        key: 'bill',
        title: 'Bill',
        kind: 'bill',
        amountMinor: 30000,
        dueDate: '2026-10-20',
        route: '/recurring',
      },
      {
        key: 'salary',
        title: 'Salary',
        kind: 'income',
        amountMinor: 50000,
        dueDate: '2026-10-25',
        route: '/recurring',
      },
    ],
    '2026-10-19',
    30
  );
  const tree = render(<ForecastDetails runway={runway} onClose={jest.fn()} />);
  const values = texts(tree);
  expect(values).toContain('₹200');
  expect(values.some((value) => /[-−]₹200/.test(value))).toBe(true);
  expect(values).toContain('₹300');
  expect(values.some((t) => t.startsWith('First shortfall'))).toBe(true);
  expect(values.some((t) => t.includes('unreceived refunds are excluded'))).toBe(true);
});

it('reveals income-only dates and passes only the selected mode to its detail renderer', () => {
  const { UpcomingDates } = require('./UpcomingDates');
  const { buildDueItems, buildLoansSummary } = require('./planOverview');
  const schedule = buildRunway(
    0,
    buildDueItems(
      buildLoansSummary([], []).rows,
      [
        {
          id: 'salary',
          type: 'income',
          active: true,
          nextRunDate: '2026-10-22',
          amountMinor: 500000,
          label: 'Salary',
          frequency: 'monthly',
          intervalCount: 1,
        },
      ],
      [],
      '2026-11-18'
    ),
    '2026-10-20',
    30
  );
  const detail = jest.fn((days, mode) => (
    <Text>
      {mode}:{days.map((day: { inMinor: number }) => day.inMinor).join(',')}
    </Text>
  ));
  const tree = render(<UpcomingDates runway={schedule} renderDays={detail} />);
  expect(texts(tree)).toContain('No upcoming outgoing payments');
  const income = tree.root.findAll((n) => n.props.accessibilityRole === 'radio' && n.props.onPress)[1];
  act(() => income.props.onPress());
  expect(
    tree.root.findAll((n) => n.props.testID === 'income-day-2026-10-22' && n.props.onPress)
  ).toHaveLength(1);
  expect(detail.mock.calls.at(-1)?.[1]).toBe('income');
  expect(detail.mock.calls.at(-1)?.[0][0].inMinor).toBe(500000);
  act(() => tree.unmount());
});
