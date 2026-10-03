/**
 * The Quiet motion pieces render as expected: a saved entry's row glows once per list, the pill switch
 * still reports taps, and a Garden plant that grows a stage (or first loads) never throws.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Animated, View } from 'react-native';
import { JustAddedGlow } from './JustAddedGlow';
import { SegmentedControl } from './SegmentedControl';
import { GardenPlant } from '@/features/garden/GardenPlant';
import { markJustAdded, resetJustAdded } from '@/lib/justAdded';

jest.useFakeTimers();

beforeEach(() => resetJustAdded());

function glowCount(r: ReactTestRenderer): number {
  return r.root.findAll((n) => n.type === Animated.View && n.props.pointerEvents === 'none', { deep: false })
    .length;
}

describe('JustAddedGlow', () => {
  it('glows a row that was just saved, once per list', () => {
    markJustAdded(['t1']);
    let home!: ReactTestRenderer;
    act(() => {
      home = create(<JustAddedGlow ids={['t1']} surface="home" />);
    });
    expect(glowCount(home)).toBe(1);

    let again!: ReactTestRenderer;
    act(() => {
      again = create(<JustAddedGlow ids={['t1']} surface="home" />);
    });
    expect(glowCount(again)).toBe(0);

    let activity!: ReactTestRenderer;
    act(() => {
      activity = create(<JustAddedGlow ids={['t1']} surface="activity" />);
    });
    expect(glowCount(activity)).toBe(1);
  });

  it('fades away', () => {
    markJustAdded(['t1']);
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<JustAddedGlow ids={['t1']} surface="home" />);
    });
    act(() => jest.advanceTimersByTime(3000));
    expect(glowCount(r)).toBe(0);
  });

  it('shows nothing for other rows', () => {
    markJustAdded(['t1']);
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<JustAddedGlow ids={['t2']} surface="home" />);
    });
    expect(glowCount(r)).toBe(0);
  });

  it('glows a row that is already on screen when it is edited', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<JustAddedGlow ids={['t1']} surface="activity" />);
    });
    expect(glowCount(r)).toBe(0);
    act(() => markJustAdded(['t1']));
    expect(glowCount(r)).toBe(1);
  });
});

describe('SegmentedControl', () => {
  const OPTIONS = [
    { label: 'Expense', value: 'expense' },
    { label: 'Income', value: 'income' },
    { label: 'Transfer', value: 'transfer' },
  ] as const;

  it('reports the tapped choice, and its pill appears once it has a width', () => {
    const onChange = jest.fn();
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<SegmentedControl options={[...OPTIONS]} value="expense" onChange={onChange} />);
    });
    const wrap = r.root.findAll((n) => n.type === View && typeof n.props.onLayout === 'function')[0];
    act(() => wrap.props.onLayout({ nativeEvent: { layout: { width: 306, height: 40, x: 0, y: 0 } } }));
    const pill = r.root.findAll((n) => n.type === Animated.View && n.props.pointerEvents === 'none');
    expect(pill).toHaveLength(1);
    const segments = r.root.findAll(
      (n) =>
        typeof n.type !== 'string' &&
        n.props.accessibilityRole === 'button' &&
        typeof n.props.onPress === 'function',
      { deep: false }
    );
    act(() => segments[1].props.onPress());
    expect(onChange).toHaveBeenCalledWith('income');
    act(() => r.update(<SegmentedControl options={[...OPTIONS]} value="income" onChange={onChange} />));
    act(() => jest.advanceTimersByTime(500));
    act(() => r.unmount());
  });
});

describe('GardenPlant', () => {
  it('grows from sprout to bloom without throwing', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(<GardenPlant stage="sprout" animKey="garden:2026-09-27" />);
    });
    act(() => r.update(<GardenPlant stage="sapling" animKey="garden:2026-09-27" />));
    act(() => jest.advanceTimersByTime(1000));
    act(() => r.update(<GardenPlant stage="bloom" animKey="garden:2026-09-27" />));
    act(() => jest.advanceTimersByTime(1000));
    act(() => r.update(<GardenPlant stage="seed" animKey="garden:2026-09-27" />));
    act(() => jest.runOnlyPendingTimers());
    act(() => r.unmount());
  });
});
