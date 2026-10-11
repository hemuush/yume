/**
 * The Wrap player: advances by itself beat by beat, right tap skips ahead, left goes back, holding pauses,
 * the last beat's buttons work, and with reduce motion nothing advances itself. Made-up figures.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, AppState } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
const mockReduce = { current: false };
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce.current }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), confirm: jest.fn(), warn: jest.fn() } }));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

import { WrapPlayer, HOLD_MS } from './WrapPlayer';
import { Wrap, BEAT_MS } from './wrapData';

jest.useFakeTimers();

const WRAP: Wrap = {
  period: 'month',
  label: 'September',
  key: '2026-09',
  beats: [
    { kind: 'hook', kicker: 'Your month, wrapped', title: 'September', spentMinor: 3_840_000 },
    { kind: 'kept', incomeMinor: 4_920_000, keptMinor: 1_080_000, keptPct: 21.95 },
    {
      kind: 'mover',
      category: {
        categoryId: 'food',
        name: 'Food & Dining',
        color: '#FFC9B3',
        totalMinor: 980_000,
        isSensitive: false,
      },
      pctChange: 32,
      comparedTo: 'August',
    },
    { kind: 'final', title: 'That was September.' },
  ],
};

function texts(r: ReactTestRenderer): string[] {
  return r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
}
const has = (r: ReactTestRenderer, s: string) => texts(r).some((t) => t.includes(s));

function tapArea(r: ReactTestRenderer) {
  return r.root.findAll(
    (n) => n.props.testID === 'wrap-story-surface' && typeof n.props.onPress === 'function'
  )[0];
}

async function render(onClose = jest.fn(), onOpenReport = jest.fn(), wrap = WRAP) {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<WrapPlayer wrap={wrap} onClose={onClose} onOpenReport={onOpenReport} />);
  });
  // Give it a size, as a phone would.
  const root = r.root.findAll((n) => typeof n.props.onLayout === 'function')[0];
  act(() => root.props.onLayout({ nativeEvent: { layout: { x: 0, y: 0, width: 360, height: 760 } } }));
  return r;
}

function tap(r: ReactTestRenderer, pageX: number) {
  const area = tapArea(r);
  act(() => area.props.onPressIn());
  act(() => {
    area.props.onPressOut();
    area.props.onPress({ nativeEvent: { pageX } });
  });
}

afterEach(() => {
  mockReduce.current = false;
});

describe('WrapPlayer', () => {
  it('offers visible navigation and a pause control without losing gesture navigation', async () => {
    const r = await render();
    const control = (label: string) =>
      r.root.findAll(
        (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
      )[0];
    act(() => control('Pause wrap').props.onPress());
    act(() => jest.advanceTimersByTime(BEAT_MS.hook + 50));
    expect(has(r, 'Your month, wrapped')).toBe(true);
    expect(control('Resume wrap')).toBeDefined();
    act(() => control('Next part').props.onPress());
    expect(has(r, 'What you kept')).toBe(true);
    act(() => control('Previous part').props.onPress());
    expect(has(r, 'Your month, wrapped')).toBe(true);
    act(() => r.unmount());
  });
  it('opens on the hook', async () => {
    const r = await render();
    expect(has(r, 'Your month, wrapped')).toBe(true);
    expect(has(r, 'went out.')).toBe(true);
    act(() => r.unmount());
  });

  it('moves on by itself when a beat has played', async () => {
    const r = await render();
    act(() => jest.advanceTimersByTime(BEAT_MS.hook + 50));
    expect(has(r, 'What you kept')).toBe(true);
    act(() => r.unmount());
  });

  it('a tap on the right skips ahead; a tap on the left goes back', async () => {
    const r = await render();
    tap(r, 300);
    expect(has(r, 'What you kept')).toBe(true);
    tap(r, 300);
    expect(has(r, 'What moved')).toBe(true);
    tap(r, 20);
    expect(has(r, 'What you kept')).toBe(true);
    act(() => r.unmount());
  });

  it('holding pauses, and letting go carries on without skipping', async () => {
    const r = await render();
    const area = tapArea(r);
    act(() => area.props.onPressIn());
    act(() => jest.advanceTimersByTime(HOLD_MS + 10));
    expect(has(r, 'Paused')).toBe(true);
    act(() => jest.advanceTimersByTime(BEAT_MS.hook * 3));
    expect(has(r, 'Your month, wrapped')).toBe(true);
    act(() => area.props.onPressOut({ nativeEvent: { pageX: 300 } }));
    expect(has(r, 'Paused')).toBe(false);
    expect(has(r, 'Your month, wrapped')).toBe(true);
    act(() => r.unmount());
  });

  it('ends on the final card, which opens the report; ✕ closes', async () => {
    const onClose = jest.fn();
    const onOpenReport = jest.fn();
    const r = await render(onClose, onOpenReport);
    tap(r, 300);
    tap(r, 300);
    tap(r, 300);
    expect(has(r, 'That was September.')).toBe(true);
    // Tapping past the end stays on it.
    tap(r, 300);
    expect(has(r, 'That was September.')).toBe(true);
    const report = r.root.find((n) => n.props.title === 'See the full report' && n.props.onPress);
    act(() => report.props.onPress());
    expect(onOpenReport).toHaveBeenCalledTimes(1);
    const close = r.root.find((n) => n.props.accessibilityLabel === 'Close' && n.props.onPress);
    act(() => close.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it('✕ closes at any point', async () => {
    const onClose = jest.fn();
    const r = await render(onClose);
    const x = r.root.find((n) => n.props.accessibilityLabel === 'Close' && n.props.onPress);
    act(() => x.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it('with reduce motion, nothing moves on by itself and numbers show in full', async () => {
    mockReduce.current = true;
    const r = await render();
    expect(has(r, '₹38,400')).toBe(true);
    act(() => jest.advanceTimersByTime(BEAT_MS.hook * 5));
    expect(has(r, 'Your month, wrapped')).toBe(true);
    tap(r, 300);
    expect(has(r, 'What you kept')).toBe(true);
    expect(has(r, '22%')).toBe(true);
    act(() => r.unmount());
  });
});

function button(r: ReactTestRenderer, label: string) {
  return r.root.findAll(
    (node) => node.props.accessibilityLabel === label && typeof node.props.onPress === 'function'
  )[0];
}

it('jumping to a chapter pauses playback and replay starts the whole wrap again', async () => {
  const r = await render();
  act(() => button(r, 'Jump to Changes').props.onPress());
  expect(has(r, 'What moved')).toBe(true);
  act(() => jest.advanceTimersByTime(BEAT_MS.mover * 2));
  expect(has(r, 'What moved')).toBe(true);
  expect(button(r, 'Resume wrap')).toBeDefined();
  act(() => button(r, 'Jump to Your card').props.onPress());
  act(() => button(r, 'Replay wrap').props.onPress());
  expect(has(r, 'Your month, wrapped')).toBe(true);
  expect(button(r, 'Pause wrap')).toBeDefined();
  act(() => r.unmount());
});

it('holding and releasing does not undo an explicit pause or navigate', async () => {
  const r = await render();
  act(() => button(r, 'Pause wrap').props.onPress());
  const area = tapArea(r);
  act(() => area.props.onPressIn());
  act(() => jest.advanceTimersByTime(HOLD_MS + 10));
  act(() => {
    area.props.onPressOut();
    area.props.onPress({ nativeEvent: { pageX: 300 } });
  });
  act(() => jest.advanceTimersByTime(BEAT_MS.hook * 2));
  expect(has(r, 'Your month, wrapped')).toBe(true);
  expect(button(r, 'Resume wrap')).toBeDefined();
  act(() => r.unmount());
});

it('backgrounding pauses the current chapter until the app becomes active again', async () => {
  let change!: (state: string) => void;
  const appStateListenerMock = AppState.addEventListener as jest.MockedFunction<
    typeof AppState.addEventListener
  >;
  const originalImplementation = jest.isMockFunction(appStateListenerMock)
    ? appStateListenerMock.getMockImplementation()
    : undefined;
  const listener = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => {
    change = callback as (state: string) => void;
    return { remove: jest.fn() };
  });
  const r = await render();
  act(() => change('background'));
  act(() => jest.advanceTimersByTime(BEAT_MS.hook * 2));
  expect(has(r, 'Your month, wrapped')).toBe(true);
  act(() => change('active'));
  act(() => jest.advanceTimersByTime(BEAT_MS.hook + 50));
  expect(has(r, 'What you kept')).toBe(true);
  act(() => r.unmount());
  listener.mockRestore();
  if (originalImplementation && jest.isMockFunction(AppState.addEventListener))
    appStateListenerMock.mockImplementation(originalImplementation);
});

it('exploring a category pauses the story without stepping to another chapter', async () => {
  const wrap: Wrap = {
    ...WRAP,
    beats: [
      WRAP.beats[0],
      {
        kind: 'bars',
        items: [
          { categoryId: 'food', name: 'Food', color: '#FFC9B3', totalMinor: 980000, isSensitive: false },
        ],
      },
      WRAP.beats[3],
    ],
  };
  const r = await render(jest.fn(), jest.fn(), wrap);
  tap(r, 300);
  act(() => button(r, 'Explore Food').props.onPress());
  act(() => jest.advanceTimersByTime(BEAT_MS.bars * 2));
  expect(has(r, 'Where it went')).toBe(true);
  expect(button(r, 'Resume wrap')).toBeDefined();
  act(() => r.unmount());
});

it('a canceled press during scrolling pauses rather than navigating', async () => {
  const r = await render();
  const area = tapArea(r);
  act(() => area.props.onPressIn());
  act(() =>
    r.root.findAll((node) => typeof node.props.onScrollBeginDrag === 'function')[0].props.onScrollBeginDrag()
  );
  act(() => area.props.onPressOut());
  act(() => jest.advanceTimersByTime(BEAT_MS.hook * 2));
  expect(has(r, 'Your month, wrapped')).toBe(true);
  expect(button(r, 'Resume wrap')).toBeDefined();
  act(() => r.unmount());
});
