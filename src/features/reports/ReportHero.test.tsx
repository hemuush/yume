import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { StyleSheet, Text, View } from 'react-native';
import { ReportHero } from './ReportHero';

jest.mock('@/components/CountUpAmount', () => ({ CountUpAmount: () => null }));
jest.mock('@/components/Amount', () => ({ Amount: () => null }));

afterEach(() => jest.restoreAllMocks());

it.each([
  [390, 1, 'row'],
  [320, 1, 'column'],
  [390, 2, 'column'],
])('keeps summary metrics readable at width %i and text scale %s', (width, fontScale, direction) => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
    width,
    height: 800,
    fontScale,
    scale: 1,
  });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ReportHero
        periodName="November"
        inProgress
        spentMinor={15000}
        perDayMinor={5000}
        budget={null}
        incomeMinor={10000}
        previousIncomeMinor={0}
        comparedTo="October"
        animKey="November"
      />
    );
  });
  const metric = tree.root
    .findAllByType(View)
    .find(
      (n) =>
        n.findAllByType(Text).some((t) => t.props.children === 'Kept') &&
        !n.findAllByType(Text).some((t) => t.props.children === 'Income')
    )!;
  const group = tree.root
    .findAllByType(View)
    .find(
      (n) =>
        StyleSheet.flatten(n.props.style)?.flexDirection &&
        n.findAllByType(Text).some((t) => t.props.children === 'Kept') &&
        n.findAllByType(Text).some((t) => t.props.children === 'Income')
    )!;
  expect(StyleSheet.flatten(group.props.style).flexDirection).toBe(direction);
  const keptText = metric.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
  expect(keptText).toEqual(expect.arrayContaining(['Kept', '−₹50', '-50% of income']));
  act(() => tree.unmount());
});

describe('the income comparison', () => {
  const texts = (inProgress: boolean) => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <ReportHero
          periodName="November"
          inProgress={inProgress}
          spentMinor={15000}
          perDayMinor={5000}
          budget={null}
          incomeMinor={6000}
          previousIncomeMinor={10000}
          comparedTo="the month before"
          animKey="November"
        />
      );
    });
    const out = tree.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
    act(() => tree.unmount());
    return out;
  };

  it('says "so far" when the period is still going, since it is set against all of the one before', () => {
    expect(texts(true)).toContain('↓ 40% so far vs the month before');
  });

  it('is a plain comparison once the period is over', () => {
    const shown = texts(false);
    expect(shown).toContain('↓ 40% vs the month before');
    expect(shown.some((t) => t.includes('so far vs'))).toBe(false);
  });
});

it('gives Income the most room of the three columns: it carries the long line, so it stays on two lines at 360 dp', () => {
  jest.spyOn(require('react-native'), 'useWindowDimensions').mockReturnValue({
    width: 360,
    height: 800,
    fontScale: 1,
    scale: 1,
  });
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <ReportHero
        periodName="November"
        inProgress
        spentMinor={15000}
        perDayMinor={5000}
        budget={null}
        incomeMinor={10000}
        previousIncomeMinor={9000}
        comparedTo="the month before"
        animKey="November"
      />
    );
  });
  const columnOf = (label: string) =>
    tree.root
      .findAllByType(View)
      .find(
        (n) =>
          n.findAllByType(Text).some((t) => t.props.children === label) &&
          StyleSheet.flatten(n.props.style)?.flexBasis === 0 &&
          !n.findAllByType(View).some((m) => m !== n && StyleSheet.flatten(m.props.style)?.flexBasis === 0)
      )!;
  const grow = (label: string) => StyleSheet.flatten(columnOf(label).props.style).flexGrow as number;
  expect(grow('Income')).toBeGreaterThan(grow('Kept'));
  expect(grow('Income')).toBeGreaterThan(grow('Spent so far'));
  act(() => tree.unmount());
});
