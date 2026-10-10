import { Animated, ScrollView, Text } from 'react-native';
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
import { WhereItWent } from './WhereItWent';
import { ThisMonthHero } from './ThisMonthHero';
import { HomeSwipeCard, SwipePage } from './HomeSwipeCard';
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
const press = (r: ReactTestRenderer, label: string) =>
  act(() => {
    r.root.find((n) => n.props.accessibilityLabel === label && n.props.onPress).props.onPress();
  });
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

it('settles dial details only for the latest tap, preserving category selection across data reordering', () => {
  const categories = ['Food', 'Rent', 'Travel', 'Shopping'].map((name, i) => ({
    categoryId: name,
    name,
    totalMinor: (4 - i) * 10000,
    color: '#fff',
    hasSubcategories: false,
    isSensitive: false,
  }));
  const dial = (breakdown = categories) => (
    <WhereItWent
      breakdown={breakdown}
      iconFor={() => 'tag'}
      spentMinor={100000}
      previousSpentMinor={0}
      periodName="October"
      previousName="September"
      onOpenReports={jest.fn()}
    />
  );
  const r = render(dial());
  press(r, 'Shopping, 10% of spending');
  const stale = mockCompletions.at(-1)!;
  expect(text(r)).toContain('₹400 · 40% of spending');
  press(r, 'Rent, 30% of spending');
  const latest = mockCompletions.at(-1)!;
  act(() => stale.finish(true));
  expect(text(r)).toContain('₹400 · 40% of spending');
  act(() => latest.finish(true));
  expect(text(r)).toContain('₹300 · 30% of spending');
  mockReduce = true;
  act(() => r.update(dial([...categories].reverse())));
  expect(text(r)).toContain('₹300 · 30% of spending');
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
      outstandingLoansMinor={0}
      canStepForward
      onStep={jest.fn()}
      renderPeriod={(key) => <Text>{key}</Text>}
      onPeriodDisplayed={displayed}
      today={key === 'month:0' ? { spentMinor: 13200, goalMinor: 50000 } : null}
    />
  );
  const r = render(hero('month:0', 100000));
  act(() => r.update(hero('month:-1', 200000)));
  const stale = mockCompletions.at(-1)!;
  expect(text(r)).toContain('month:0');
  expect(text(r)).toContain('₹132 of ₹500 today');
  act(() => r.update(hero('month:-2', 300000)));
  const latest = mockCompletions.at(-1)!;
  act(() => stale.finish(true));
  expect(text(r)).toContain('month:0');
  act(() => latest.finish(true));
  expect(text(r)).toContain('month:-2');
  expect(text(r)).toContain('₹3,000');
  expect(text(r)).not.toContain('₹132 of ₹500 today');
  expect(displayed.mock.calls.map(([key]) => key)).toEqual(['month:0', 'month:-2']);
  act(() => r.unmount());
  roots = roots.filter((root) => root !== r);
  act(() => latest.finish(true));
  expect(displayed).toHaveBeenCalledTimes(2);
});

const pages: SwipePage[] = ['upcoming', 'budgets', 'goals'].map((key) => ({
  key,
  label: key,
  content: <Text>{key} content</Text>,
}));
function measure(r: ReactTestRenderer) {
  act(() =>
    r.root
      .findAll((n) => n.props.testID === 'home-swipe-pages' && n.props.onLayout)[0]
      .props.onLayout({ nativeEvent: { layout: { width: 300 } } })
  );
}
const offset = (x: number) => ({ nativeEvent: { contentOffset: { x } } });

it('preserves the selected page key when an earlier page disappears', () => {
  mockReduce = true;
  const r = render(<HomeSwipeCard pages={pages} />);
  measure(r);
  const scroll = jest.spyOn(r.root.findByType(ScrollView).instance, 'scrollTo');
  press(r, 'budgets');
  expect(scroll).toHaveBeenLastCalledWith({ x: 300, animated: false });
  act(() => r.update(<HomeSwipeCard pages={pages.slice(1)} />));
  const tab = r.root.find((n) => n.props.accessibilityLabel === 'budgets' && n.props.onPress);
  expect(tab.props.accessibilityState.selected).toBe(true);
});

it('cancels press feedback on reduced-motion changes and unmount', () => {
  let feedback!: ReturnType<typeof usePressScale>;
  function Button() {
    feedback = usePressScale();
    return <Text>Button</Text>;
  }
  const spring = jest
    .spyOn(Animated, 'spring')
    .mockReturnValue({ start: jest.fn(), stop: jest.fn(), reset: jest.fn() });
  const r = render(<Button />);
  const scale = feedback.animatedStyle.transform[0].scale;
  const stop = jest.spyOn(scale, 'stopAnimation');
  act(() => {
    feedback.onPressIn();
    feedback.onPressOut();
  });
  expect(stop).toHaveBeenCalledTimes(2);
  expect(spring).toHaveBeenCalledTimes(2);
  mockReduce = true;
  act(() => r.update(<Button />));
  spring.mockClear();
  act(() => {
    feedback.onPressIn();
    feedback.onPressOut();
  });
  expect(spring).not.toHaveBeenCalled();
  stop.mockClear();
  act(() => r.unmount());
  roots = roots.filter((root) => root !== r);
  expect(stop).toHaveBeenCalled();
});

it('labels chart days with full dates while retaining the original week and month controls', () => {
  mockReduce = true;
  const r = render(<SpendBars daily={[{ date: '2026-10-10', totalMinor: 13200 }]} today="2026-10-10" />);
  expect(
    r.root.findAll(
      (n) =>
        typeof n.props.accessibilityLabel === 'string' &&
        /Saturday.*10.*October.*₹132/.test(n.props.accessibilityLabel)
    ).length
  ).toBeGreaterThan(0);
  act(() =>
    r.root
      .find(
        (n) =>
          n.props.onPress &&
          n.props.accessibilityRole === 'tab' &&
          n.findAllByType(Text).some((t) => t.props.children === 'Month')
      )
      .props.onPress()
  );
  expect(text(r)).toContain('W2');
  expect(text(r)).toContain('₹132 this month');
});

it('ignores old scroll destinations after rapid taps and reconciles a finger takeover', () => {
  const r = render(<HomeSwipeCard pages={pages} />);
  measure(r);
  press(r, 'goals');
  press(r, 'budgets');
  act(() => r.root.findByType(ScrollView).props.onMomentumScrollEnd(offset(600)));
  expect(
    r.root.find((n) => n.props.accessibilityLabel === 'budgets' && n.props.onPress).props.accessibilityState
      .selected
  ).toBe(true);
  act(() => r.root.findByType(ScrollView).props.onScrollBeginDrag());
  act(() => r.root.findByType(ScrollView).props.onMomentumScrollEnd(offset(0)));
  expect(
    r.root.find((n) => n.props.accessibilityLabel === 'upcoming' && n.props.onPress).props.accessibilityState
      .selected
  ).toBe(true);
});

it('holds card height through a drag and settles to the destination height', () => {
  const r = render(<HomeSwipeCard pages={pages} />);
  measure(r);
  const height = (key: string, value: number) =>
    act(() =>
      r.root
        .findAll((n) => n.props.testID === `home-page-${key}` && n.props.onLayout)[0]
        .props.onLayout({ nativeEvent: { layout: { height: value } } })
    );
  height('upcoming', 100);
  height('budgets', 200);
  mockTargets.length = 0;
  act(() => r.root.findByType(ScrollView).props.onScrollBeginDrag());
  height('upcoming', 120);
  act(() => r.root.findByType(ScrollView).props.onScroll(offset(180)));
  expect(mockTargets).not.toContain(120);
  expect(mockTargets).not.toContain(200);
  act(() => r.root.findByType(ScrollView).props.onMomentumScrollEnd(offset(300)));
  expect(mockTargets).toContain(200);
});
