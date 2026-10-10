/** The Trends sentence: a finished month against its average, a month still going as "so far". All figures are made up. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

// Every rendered chart owns animation frames; dispose them before Jest tears down its environment.
const mounted: ReactTestRenderer[] = [];
afterEach(() => {
  act(() => {
    for (const tree of mounted) tree.unmount();
  });
  mounted.length = 0;
});

jest.mock('@/lib/money', () => ({
  ...jest.requireActual('@/lib/money'),
  formatMoney: (minor: number) => `₹${minor / 100}`,
}));

import { TrendChart } from './TrendChart';

jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

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
  mounted.push(r);
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

describe('TrendChart touch', () => {
  const pressable = (r: ReactTestRenderer, text: string) =>
    r.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => [t.props.children].flat(Infinity).join('') === text)
    );

  function touchable(monthLink?: React.ComponentProps<typeof TrendChart>['monthLink']) {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <TrendChart
          periodName="October"
          spentMinor={13_784_00}
          trend={trend}
          baseline={33_683_00}
          inProgress={false}
          netWorthTrend={[]}
          monthLink={monthLink}
        />
      );
    });
    mounted.push(r);
    const touch = r.root.findByProps({ testID: 'trend-touch' });
    act(() => {
      touch.props.onLayout({ nativeEvent: { layout: { width: 300 } } });
    });
    const at = (locationX: number) =>
      act(() => {
        touch.props.onResponderGrant({ nativeEvent: { locationX } });
      });
    return { r, at };
  }

  it('reads the month you touch against your usual, and goes back to the sentence on the last point', () => {
    const { r, at } = touchable();
    at(14);
    expect(texts(r).some((t) => t.startsWith('May: ₹31200 · 7% below your usual'))).toBe(true);
    at(286);
    expect(texts(r)).toContain('October is ₹19899 below your average of ₹33683.');
  });

  it('ignores a touch before the chart has measured its width', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <TrendChart
          periodName="October"
          spentMinor={13_784_00}
          trend={trend}
          baseline={33_683_00}
          inProgress={false}
          netWorthTrend={[]}
        />
      );
    });
    act(() => {
      r.root
        .findByProps({ testID: 'trend-touch' })
        .props.onResponderGrant({ nativeEvent: { locationX: 14 } });
    });
    mounted.push(r);
    expect(texts(r)).toContain('October is ₹19899 below your average of ₹33683.');
  });

  it('offers to open the touched month in Reports, but not when it cannot be opened', () => {
    const open = jest.fn();
    const { r, at } = touchable((i) => (i === 0 ? { name: 'May', open } : null));
    expect(texts(r).some((t) => t.startsWith('Open '))).toBe(false);
    at(14);
    act(() => {
      pressable(r, 'Open May in Reports ›').props.onPress();
    });
    expect(open).toHaveBeenCalledTimes(1);
    at(286);
    expect(texts(r).some((t) => t.startsWith('Open '))).toBe(false);
  });
});
