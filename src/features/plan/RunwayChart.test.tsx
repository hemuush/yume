import { act, create } from 'react-test-renderer';
import { Text, StyleSheet } from 'react-native';

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

describe('large text', () => {
  const heightAt = (fontScale: number) => {
    const spy = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 360, height: 800, scale: 2, fontScale });
    const runway = buildRunway(10000, [], '2026-10-22', 30);
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<RunwayChart runway={runway} />);
    });
    const chart = tree.root.find((n) => n.props.accessibilityRole === 'adjustable');
    act(() => chart.props.onLayout({ nativeEvent: { layout: { width: 320, height: 176 } } }));
    const flat = StyleSheet.flatten(
      tree.root.find((n) => n.props.accessibilityRole === 'adjustable').props.style
    );
    const dateRow = tree.root
      .findAllByType(Text)
      .filter(
        (t) =>
          t.props.style &&
          StyleSheet.flatten(t.props.style).top != null &&
          'width' in StyleSheet.flatten(t.props.style)
      );
    const out = {
      height: flat.height as number,
      tickTop: StyleSheet.flatten(dateRow.at(-1)?.props.style).top as number,
    };
    spy.mockRestore();
    return out;
  };

  it('gives the date row and the chart more room as the text grows', () => {
    const normal = heightAt(1);
    const large = heightAt(2);
    expect(large.height).toBeGreaterThan(normal.height);
    expect(large.tickTop).toBeGreaterThan(normal.tickTop);
    // The date labels stay inside the chart at every size.
    expect(normal.tickTop).toBeLessThan(normal.height);
    expect(large.tickTop).toBeLessThan(large.height);
  });

  it('never grows past the supported text scale', () => {
    expect(heightAt(5).height).toBe(heightAt(2).height);
  });
});
