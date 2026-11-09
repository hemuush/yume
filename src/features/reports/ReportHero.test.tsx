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
