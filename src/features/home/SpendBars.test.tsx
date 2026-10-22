import { Text, StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { LinearGradient } from 'expo-linear-gradient';
import { THEMES } from '@/theme/themes';
import { hexToRgba } from '@/lib/color';
import { haptics } from '@/lib/haptics';

let mockPack = { primary: '#8FCBFF', secondary: '#8FE8C8' };

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: mockPack.primary, secondary: mockPack.secondary }),
}));
jest.mock('@expo/vector-icons/Feather', () => () => null);

import { SpendBars } from './SpendBars';

// Jest's default font scale is 2: the tests run at the phone's normal size unless one says otherwise.
beforeEach(() => {
  jest
    .spyOn(require('react-native'), 'useWindowDimensions')
    .mockReturnValue({ width: 390, height: 800, scale: 3, fontScale: 1 });
});
afterEach(() => jest.restoreAllMocks());

const text = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((n) =>
      [n.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string' || typeof c === 'number')
        .join('')
    )
    .join(' | ');
function render(daily: { date: string; totalMinor: number }[], today: string) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<SpendBars daily={daily} today={today} />);
  });
  return r;
}
// A capsule's fill is the view that grows from its bottom edge.
const fills = (r: ReactTestRenderer) =>
  r.root.findAll(
    (n) => String(n.type) === 'View' && StyleSheet.flatten(n.props.style)?.transformOrigin === 'bottom'
  );
const heights = (r: ReactTestRenderer) =>
  fills(r).map((n) => StyleSheet.flatten(n.props.style).height as number);
// One capsule fills the track; a smaller day keeps its square-root share of it.
const FULL = 60;
const smaller = (ratio: number) => 14 + Math.sqrt(ratio) * (FULL - 14);

it.each(THEMES)(
  'uses the selected $name palette for the capsules, without changing spending heights',
  (pack) => {
    mockPack = { primary: pack.primary, secondary: pack.secondary };
    const tree = render([{ date: '2026-10-17', totalMinor: 10000 }], '2026-10-17');
    const gradients = tree.root.findAllByType(LinearGradient);
    expect(gradients).toHaveLength(7);
    expect(
      gradients.every((g) => g.props.colors[0] === pack.primary && g.props.colors[1] === pack.secondary)
    ).toBe(true);
    const tracks = tree.root.findAll(
      (n) => String(n.type) === 'View' && StyleSheet.flatten(n.props.style)?.maxWidth === 28
    );
    expect(tracks).toHaveLength(7);
    expect(
      tracks.every((n) => StyleSheet.flatten(n.props.style).backgroundColor === hexToRgba(pack.primary, 0.2))
    ).toBe(true);
    expect(heights(tree)).toEqual([0, 0, 0, 0, 0, 0, FULL]);
  }
);

it('does not repeat haptics or selection updates when the selected day is tapped again', () => {
  const tree = render([], '2026-10-17');
  const selected = () =>
    tree.root.findAll(
      (n) => n.props.onPress && n.props.accessibilityRole === 'button' && n.props.accessibilityState?.selected
    )[0];
  act(() => selected().props.onPress());
  expect(haptics.tap).not.toHaveBeenCalled();
  const previous = tree.root.findAll(
    (n) => n.props.onPress && n.props.accessibilityLabel?.startsWith('Friday')
  )[0];
  act(() => previous.props.onPress());
  act(() => selected().props.onPress());
  expect(haptics.tap).toHaveBeenCalledTimes(1);
});

describe('Home spending week', () => {
  it('names the days, and calls the last one Today', () => {
    const t = text(render([{ date: '2026-10-16', totalMinor: 92_700 }], '2026-10-17'));
    for (const label of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Today']) expect(t).toContain(label);
  });

  it('puts each day’s amount over its capsule, a dash over an empty one', () => {
    const t = text(render([{ date: '2026-10-16', totalMinor: 92_700 }], '2026-10-17'));
    expect(t).toContain('₹927');
    expect(t).toContain('–');
  });

  it('starts on today with its amount read in the row above', () => {
    const r = render([{ date: '2026-10-16', totalMinor: 92_700 }], '2026-10-17');
    expect(text(r)).toContain('Today | ₹0 | No spending');
    expect(
      r.root.findAll(
        (n) =>
          n.props.accessibilityRole === 'button' &&
          n.props.accessibilityState?.selected &&
          n.props.accessibilityLabel?.includes('17')
      ).length
    ).toBeGreaterThan(0);
  });

  it('reads the picked day in the row above', () => {
    const r = render([{ date: '2026-10-16', totalMinor: 92_700 }], '2026-10-17');
    const day = r.root.findAll(
      (n) => n.props.onPress && n.props.accessibilityLabel?.includes('16 October')
    )[0];
    act(() => day.props.onPress());
    expect(text(r)).toContain('Fri, 16 Oct | ₹927');
  });
});

it('fits seven interactive days inside the card without range tabs', () => {
  const r = render([{ date: '2026-10-16', totalMinor: 92700 }], '2026-10-17');
  expect(heights(r)).toHaveLength(7);
  expect(r.root.findAll((n) => n.props.accessibilityRole === 'tab')).toHaveLength(0);
  act(() => r.unmount());
});

it('shows every completed-month week including the last partial week', () => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <SpendBars
        daily={[
          { date: '2026-09-01', totalMinor: 10000 },
          { date: '2026-09-08', totalMinor: 20000 },
          { date: '2026-09-30', totalMinor: 30000 },
        ]}
        today="2026-09-30"
        periodMode="month"
      />
    );
  });
  expect(heights(r)).toHaveLength(5);
  expect(text(r)).toContain('Week 5 · 29–30 Sept | ₹300');
  const week = r.root.findAll(
    (n) => n.props.onPress && n.props.accessibilityLabel?.startsWith('Week 2 of')
  )[0];
  act(() => week.props.onPress());
  expect(text(r)).toContain('Week 2 · 8–14 Sept | ₹200');
  act(() => r.unmount());
});

it('draws proportional zero-baseline heights, a small day keeping its square-root share', () => {
  const r = render(
    [
      { date: '2026-10-11', totalMinor: 10000 },
      { date: '2026-10-12', totalMinor: 5000 },
    ],
    '2026-10-17'
  );
  const h = heights(r);
  expect(h.slice(0, 2)).toEqual([FULL, smaller(0.5)]);
  expect(h.slice(2)).toEqual([0, 0, 0, 0, 0]);
  act(() => r.unmount());
});

it('defaults to today with zero spend and returns to today after a transaction refresh', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<SpendBars daily={[{ date: '2026-10-19', totalMinor: 11300 }]} today="2026-10-20" />);
  });
  const selected = () =>
    tree.root.findAll(
      (n) =>
        n.props.accessibilityRole === 'button' &&
        n.props.accessibilityState?.selected &&
        typeof n.props.onPress === 'function'
    )[0];
  expect(selected().props.accessibilityLabel).toMatch(/20.*October.*₹0/);
  expect(text(tree)).toContain('Today | ₹0');
  const previous = tree.root.findAll(
    (n) =>
      n.props.accessibilityRole === 'button' &&
      n.props.accessibilityLabel?.includes('19') &&
      typeof n.props.onPress === 'function'
  )[0];
  act(() => previous.props.onPress());
  expect(selected().props.accessibilityLabel).toMatch(/19.*October.*₹113/);
  act(() =>
    tree.update(
      <SpendBars
        daily={[
          { date: '2026-10-19', totalMinor: 11300 },
          { date: '2026-10-20', totalMinor: 7000 },
        ]}
        today="2026-10-20"
      />
    )
  );
  expect(selected().props.accessibilityLabel).toMatch(/20.*October.*₹70/);
  expect(text(tree)).toContain('Today | ₹70');
  act(() => tree.unmount());
});

describe('against a daily goal', () => {
  const goalBars = (todaySpentMinor: number) => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <SpendBars
          daily={[{ date: '2026-10-17', totalMinor: todaySpentMinor }]}
          today="2026-10-17"
          goalMinor={50000}
          todaySpentMinor={todaySpentMinor}
        />
      );
    });
    return r;
  };
  it('says what is left, how far over, or that it was a big day', () => {
    expect(text(goalBars(27000))).toContain('₹230 left');
    expect(text(goalBars(60000))).toContain('₹100 over');
    expect(text(goalBars(270000))).toContain('A big day');
  });
  it('marks the goal on the capsules and names it', () => {
    const r = goalBars(27000);
    expect(text(r)).toContain('Daily goal ₹500');
  });
  it('opens how the allowance works from today’s row, without refilling it from refunds', () => {
    const r = goalBars(27000);
    const action = r.root.find(
      (n) =>
        n.props.accessibilityLabel?.startsWith('How today’s allowance') &&
        typeof n.props.onPress === 'function'
    );
    expect(action.props.accessibilityState.expanded).toBe(false);
    act(() => action.props.onPress());
    expect(text(r)).toContain('Daily limit');
    expect(text(r)).toContain('Expenses today');
    expect(text(r)).toContain('Refunds and income do not refill your daily limit. Transfers are excluded.');
  });
  it('has no goal row or key in a past month’s weeks', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <SpendBars
          daily={[{ date: '2026-09-30', totalMinor: 30000 }]}
          today="2026-09-30"
          periodMode="month"
          goalMinor={50000}
        />
      );
    });
    expect(text(r)).not.toContain('Daily goal');
    expect(
      r.root.findAll((n) => n.props.accessibilityLabel?.startsWith('How today’s allowance'))
    ).toHaveLength(0);
  });
});

it('leaves the amounts off the capsules at a large font size, keeping the picked day’s above', () => {
  const rn = require('react-native');
  const spy = jest
    .spyOn(rn, 'useWindowDimensions')
    .mockReturnValue({ width: 390, height: 800, scale: 3, fontScale: 1.3 });
  try {
    const r = render([{ date: '2026-10-16', totalMinor: 92_700 }], '2026-10-17');
    expect(text(r)).not.toContain('₹927 |');
    expect(text(r)).toContain('Today | ₹0');
  } finally {
    spy.mockRestore();
  }
});
