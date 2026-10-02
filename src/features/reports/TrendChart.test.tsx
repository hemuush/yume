/** The Trends sentence: a finished month against its average, a month still going as "so far". All figures are made up. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/money', () => ({
  ...jest.requireActual('@/lib/money'),
  formatMoney: (minor: number) => `₹${minor / 100}`,
}));

import { TrendChart } from './TrendChart';

const trend = ['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((label, i) => ({
  label,
  totalMinor: [31_200, 36_500, 29_800, 38_400, 32_515, 13_784][i] * 100,
}));

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));

function chart(inProgress: boolean) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <TrendChart
        periodName="October"
        spentMinor={13_784_00}
        trend={trend}
        baseline={33_683_00}
        inProgress={inProgress}
        netWorthTrend={[]}
      />
    );
  });
  return r;
}

describe('TrendChart sentence', () => {
  it('reads a finished month against the average', () => {
    expect(texts(chart(false))).toContain('October is ₹19899 below your average of ₹33683.');
  });

  it('reads a month still going as "so far", naming the dashed line', () => {
    expect(texts(chart(true))).toContain(
      'October so far: ₹13784. The dashed line is your usual month, ₹33683.'
    );
  });
});
