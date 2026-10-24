import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

import { RunwayChart } from './RunwayChart';
import { buildRunway } from './runway';

const texts = (tree: ReturnType<typeof create>) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

it('opens on the first day the balance runs short and names what moves it', () => {
  const runway = buildRunway(
    10000,
    [
      {
        key: 'a',
        title: 'Rent',
        kind: 'bill',
        dueDate: '2026-10-24',
        amountMinor: 15000,
        route: '/recurring',
      },
    ],
    '2026-10-22',
    5
  );
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RunwayChart runway={runway} />);
  });
  const shown = texts(tree);
  expect(shown.some((t) => t.includes('Rent −'))).toBe(true);
  expect(shown.some((t) => t.includes('50'))).toBe(true);
});

it('says nothing is due on a quiet day', () => {
  const runway = buildRunway(10000, [], '2026-10-22', 5);
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RunwayChart runway={runway} />);
  });
  expect(texts(tree)).toContain('Nothing due');
});

it('labels the day being read and the dates once the chart has a width', () => {
  const runway = buildRunway(
    10000,
    [
      {
        key: 'a',
        title: 'Rent',
        kind: 'bill',
        dueDate: '2026-10-24',
        amountMinor: 15000,
        route: '/recurring',
      },
    ],
    '2026-10-22',
    30
  );
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RunwayChart runway={runway} />);
  });
  const chart = tree.root.find((n) => n.props.accessibilityRole === 'adjustable');
  act(() => chart.props.onLayout({ nativeEvent: { layout: { width: 320, height: 176 } } }));
  const shown = texts(tree);
  expect(shown).toContain('Today');
  expect(shown.some((t) => t.includes('24 Oct') && t.includes('·'))).toBe(true);
  expect(shown.length).toBeGreaterThan(8);
});
