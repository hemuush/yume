import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text, View } from 'react-native';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) =>
    require('react').createElement(require('react-native').View, null, children),
}));

import { PlanNavigation, PLAN_TABS } from './PlanNavigation';
import { TileGrid } from './PlanGrid';
import { styles as planStyles } from './plan.styles';
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

it.each([false, true])('keeps Budgets among the five destinations (stacked: %s)', (stacked) => {
  const onChange = jest.fn();
  const tree = render(<PlanNavigation value="budgets" onChange={onChange} stacked={stacked} />);
  expect(texts(tree)).toEqual(expect.arrayContaining(PLAN_TABS.map((t) => t.label)));
  const debt = tree.root.findAll(
    (n) =>
      n.props.onPress &&
      n.props.accessibilityRole === 'button' &&
      n.findAllByType(Text).some((t) => t.props.children === 'Debt')
  )[0];
  act(() => debt.props.onPress());
  expect(onChange).toHaveBeenCalledWith('debt');
});

it.each([
  [390, 1, 1],
  [320, 1, 2],
  [390, 1.3, 3],
])('fits three tiles at width %i, text scale %s into %i rows', (width, fontScale, expectedRows) => {
  jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width, height: 800, fontScale, scale: 1 });
  const tree = render(
    <TileGrid
      tiles={[0, 1, 2].map((i) => (
        <View key={i} testID={`tile-${i}`} />
      ))}
      label="Add"
      accessibilityLabel="Add a budget"
      onAdd={jest.fn()}
    />
  );
  const rows = tree.root.findAllByType(View).filter((n) => n.props.style === planStyles.gridRow);
  const expectedWithAdd = expectedRows + (width >= 360 || fontScale > 1.2 ? 1 : 0);
  expect(rows).toHaveLength(expectedWithAdd);
  expect(
    tree.root.findAll((n) => n.props.accessibilityLabel === 'Add a budget' && n.props.onPress).length
  ).toBeGreaterThan(0);
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
