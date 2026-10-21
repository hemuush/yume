import { Animated, Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

let mockReduce = false;
const mockCompletions: { target: number; finish: (finished: boolean) => void }[] = [];
const mockTargets: number[] = [];
jest.mock('react-native-reanimated', () => ({
  ...require('@/test-support/reanimatedMock').createReanimatedMock(),
  withTiming: (target: number, _config: unknown, finish?: (finished: boolean) => void) => {
    mockTargets.push(target);
    if (finish) mockCompletions.push({ target, finish });
    return target;
  },
}));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));
jest.mock('./HeroActions', () => ({ HeroActions: () => null }));

import { CountUpAmount } from '@/components/CountUpAmount';
import { ThisMonthHero } from './ThisMonthHero';
import { usePressScale } from '@/lib/usePressScale';
import { SpendBars } from './SpendBars';

const text = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((n) =>
      [n.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string' || typeof c === 'number')
        .join('')
    )
    .join(' ');
let roots: ReactTestRenderer[] = [];
function render(node: React.ReactElement) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(node);
  });
  roots.push(r);
  return r;
}
beforeEach(() => {
  mockReduce = false;
  mockCompletions.length = 0;
  mockTargets.length = 0;
});
afterEach(() => {
  act(() => roots.forEach((r) => r.unmount()));
  roots = [];
  jest.restoreAllMocks();
});

it('shows settled money immediately when opening a screen by default', () => {
  const timing = jest.spyOn(Animated, 'timing');
  const r = render(<CountUpAmount minor={12345600} />);
  expect(text(r)).toContain('₹1,23,456');
  expect(timing).not.toHaveBeenCalled();
});

it('continues a changed amount from the visible value and ignores an obsolete completion', () => {
  const runs: { value: Animated.Value; finish?: Animated.EndCallback; stop: jest.Mock }[] = [];
  jest.spyOn(Animated, 'timing').mockImplementation((value) => {
    const run = {
      value: value as Animated.Value,
      stop: jest.fn(),
      finish: undefined as Animated.EndCallback | undefined,
    };
    runs.push(run);
    return {
      start: (finish?: Animated.EndCallback) => {
        run.finish = finish;
      },
      stop: run.stop,
      reset: jest.fn(),
    };
  });
  const r = render(<CountUpAmount minor={100000} countFromZero={false} />);
  act(() => {
    r.update(<CountUpAmount minor={300000} countFromZero={false} />);
  });
  act(() => {
    runs[0].value.setValue(0.5);
  });
  expect(text(r)).toContain('₹2,000');
  act(() => {
    r.update(<CountUpAmount minor={500000} countFromZero={false} />);
  });
  expect(runs[0].stop).toHaveBeenCalled();
  act(() => {
    runs[0].finish?.({ finished: true });
    runs[1].value.setValue(0.25);
  });
  expect(text(r)).toContain('₹2,750');
  mockReduce = true;
  act(() => {
    r.update(<CountUpAmount minor={500000} countFromZero={false} />);
  });
  expect(runs[1].stop).toHaveBeenCalled();
  expect(text(r)).toContain('₹5,000');
});

it('keeps the month label, figures and current-month chips together through interrupted transitions', () => {
  const displayed = jest.fn();
  const hero = (key: string, income: number) => (
    <ThisMonthHero
      periodKey={key}
      direction={-1}
      incomeMinor={income}
      spentMinor={0}
      savingsMinor={0}
      surplusMinor={income}
      canStepForward
      onStep={jest.fn()}
      renderPeriod={(key) => <Text>{key}</Text>}
      onPeriodDisplayed={displayed}
      today={key === 'month:0' ? { spentMinor: 13200, goalMinor: 50000 } : null}
    />
  );
  const r = render(hero('month:0', 100000));
  act(() =>
    r.root.find((n) => n.props.accessibilityLabel === 'How this adds up' && n.props.onPress).props.onPress()
  );
  act(() => r.update(hero('month:-1', 200000)));
  const stale = mockCompletions.at(-1)!;
  expect(text(r)).toContain('month:0');
  expect(text(r)).toContain('₹368 left today');
  act(() => r.update(hero('month:-2', 300000)));
  const latest = mockCompletions.at(-1)!;
  act(() => stale.finish(true));
  expect(text(r)).toContain('month:0');
  act(() => latest.finish(true));
  expect(text(r)).toContain('month:-2');
  expect(r.root.findAllByType(CountUpAmount)[0].props.minor).toBe(300000);
  expect(text(r)).not.toContain('₹368 left today');
  expect(displayed.mock.calls.map(([key]) => key)).toEqual(['month:0', 'month:-2']);
  act(() => r.unmount());
  roots = roots.filter((root) => root !== r);
  act(() => latest.finish(true));
  expect(displayed).toHaveBeenCalledTimes(2);
});

it('cancels press feedback on reduced-motion changes and unmount', () => {
  let feedback!: ReturnType<typeof usePressScale>;
  function Button() {
    feedback = usePressScale(0.92);
    return <Text>Button</Text>;
  }
  const timing = jest
    .spyOn(Animated, 'timing')
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  const r = render(<Button />);
  const scale = feedback.animatedStyle.transform[0].scale;
  const stop = jest.spyOn(scale, 'stopAnimation');
  act(() => {
    feedback.onPressIn();
    feedback.onPressOut();
  });
  expect(stop).toHaveBeenCalledTimes(2);
  expect(timing).toHaveBeenCalledTimes(2);
  expect(timing).toHaveBeenNthCalledWith(
    1,
    scale,
    expect.objectContaining({ toValue: 0.97, duration: 80, useNativeDriver: true })
  );
  expect(timing).toHaveBeenNthCalledWith(
    2,
    scale,
    expect.objectContaining({ duration: 120, useNativeDriver: true })
  );
  mockReduce = true;
  act(() => r.update(<Button />));
  timing.mockClear();
  act(() => {
    feedback.onPressIn();
    feedback.onPressOut();
  });
  expect(timing).not.toHaveBeenCalled();
  stop.mockClear();
  act(() => r.unmount());
  roots = roots.filter((root) => root !== r);
  expect(stop).toHaveBeenCalled();
});

it('labels days with full dates and takes its chart range from the parent period', () => {
  mockReduce = true;
  const daily = [{ date: '2026-10-10', totalMinor: 13200 }];
  const r = render(<SpendBars daily={daily} today="2026-10-10" />);
  expect(
    r.root.findAll(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        /Saturday.*10.*October.*₹132/.test(n.props.accessibilityLabel)
    ).length
  ).toBeGreaterThan(0);
  expect(r.root.findAll((n) => n.props.accessibilityRole === 'tab')).toHaveLength(0);
  act(() => r.update(<SpendBars daily={daily} today="2026-10-31" periodMode="month" />));
  expect(text(r)).toContain('W5');
  expect(text(r)).toMatch(/Spent · by week\s+₹132/);
});

it('inspects exact amounts and resets selection when the parent period changes', () => {
  mockReduce = true;
  const daily = [
    { date: '2026-10-05', totalMinor: 2650000 },
    { date: '2026-10-10', totalMinor: 13200 },
  ];
  const r = render(<SpendBars daily={daily} today="2026-10-10" />);
  const day = r.root.find(
    (n) =>
      n.props.onPress &&
      typeof n.props.accessibilityLabel === 'string' &&
      /Monday.*5.*October/.test(n.props.accessibilityLabel)
  );
  act(() => day.props.onPress());
  expect(text(r)).toContain('Mon, 5 Oct · ₹26,500');
  expect(day.props.accessibilityState.selected).toBe(true);
  const picked = () =>
    String(
      r.root.find(
        (n) =>
          n.props.accessibilityRole === 'button' &&
          n.props.accessibilityState?.selected === true &&
          typeof n.props.accessibilityLabel === 'string' &&
          n.props.accessibilityLabel.includes('₹')
      ).props.accessibilityLabel
    );
  act(() => r.update(<SpendBars daily={daily} today="2026-10-31" periodMode="month" />));
  expect(picked()).toMatch(/Week 5 .*₹0/);
  const week = r.root.find((n) => n.props.onPress && n.props.accessibilityLabel?.startsWith('Week 2 of'));
  act(() => week.props.onPress());
  expect(picked()).toMatch(/Week 2 .*₹132/);
  expect(text(r)).toContain('8–14 Oct · ₹132');
  act(() => r.update(<SpendBars daily={daily} today="2026-10-10" />));
  expect(picked()).toMatch(/10 .*₹132/);
  act(() => r.update(<SpendBars daily={[]} today="2026-10-11" />));
  expect(picked()).toMatch(/11 .*₹0/);
});
