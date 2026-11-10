import { act, create } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

import { RunwayRibbon } from './RunwayRibbon';
import { buildRunway } from './runway';

const texts = (tree: ReturnType<typeof create>) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

const rent = {
  key: 'a',
  title: 'Rent',
  kind: 'bill' as const,
  dueDate: '2026-10-24',
  amountMinor: 15000,
  route: '/recurring' as const,
};

it('opens on the first day the balance runs short and reads what moves it', () => {
  const runway = buildRunway(10000, [rent], '2026-10-22', 5);
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RunwayRibbon runway={runway} />);
  });
  const shown = texts(tree);
  expect(shown.some((t) => t.startsWith('Rent −'))).toBe(true);
  expect(shown.some((t) => t.startsWith('leaves '))).toBe(true);
  act(() => tree.unmount());
});

it('steps to another day for a screen reader and says when nothing is scheduled', () => {
  const runway = buildRunway(10000, [rent], '2026-10-22', 5);
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RunwayRibbon runway={runway} />);
  });
  const surface = tree.root.find((n) => n.props.accessibilityRole === 'adjustable');
  expect(surface.props.accessibilityLabel).toContain('Rent');
  act(() => surface.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
  expect(texts(tree)).toContain('Nothing scheduled');
  act(() => tree.unmount());
});

it('draws nothing for an empty runway', () => {
  const runway = buildRunway(10000, [], '2026-10-22', 0);
  let tree!: ReturnType<typeof create>;
  act(() => {
    tree = create(<RunwayRibbon runway={runway} />);
  });
  expect(tree.toJSON()).toBeNull();
  act(() => tree.unmount());
});
