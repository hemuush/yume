/**
 * Wrap flows: a month Wrap marks its review seen as soon as it plays; "See the full report" opens Reports on that
 * month/week without stacking a second tabs copy; nothing-to-play or a failed load says so. Made-up figures.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
const mockParams = { current: { period: 'month' } as { period?: string } };
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), navigate: jest.fn(), replace: jest.fn(), canGoBack: jest.fn(() => true) },
  useLocalSearchParams: () => mockParams.current,
}));
jest.mock('@/db/settings', () => ({
  ...jest.requireActual('@/db/settings'),
  markWrapSeen: jest.fn(async () => {}),
}));
const mockMonth = { current: null as unknown };
const mockWeek = { current: null as unknown };
const mockFail = { current: false };
jest.mock('@/features/wrap/wrapData', () => {
  const actual = jest.requireActual('@/features/wrap/wrapData');
  return {
    ...actual,
    loadMonthWrap: jest.fn(async () => {
      if (mockFail.current) throw new Error('Database is busy');
      return mockMonth.current;
    }),
    loadWeekWrap: jest.fn(async () => mockWeek.current),
  };
});

import WrapScreen from '../../../app/wrap';
import { router } from 'expo-router';
import { markWrapSeen } from '@/db/settings';

const finalOnly = (title: string) => [{ kind: 'final' as const, title }];

function texts(r: ReactTestRenderer): string {
  return r.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat(Infinity).join(''))
    .join(' | ');
}

async function render() {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<WrapScreen />);
  });
  return r;
}

const press = (r: ReactTestRenderer, title: string) =>
  act(() => r.root.find((n) => n.props.title === title && n.props.onPress).props.onPress());

beforeEach(() => {
  mockParams.current = { period: 'month' };
  mockMonth.current = {
    period: 'month',
    label: 'September',
    key: '2026-09',
    beats: finalOnly('That was September.'),
  };
  mockWeek.current = {
    period: 'week',
    label: '20–26 Sept',
    key: '2026-09-20',
    beats: finalOnly('A lighter week.'),
  };
  mockFail.current = false;
});

describe('Wrap screen', () => {
  it('marks the month seen as soon as it plays', async () => {
    const r = await render();
    expect(texts(r)).toContain('That was September.');
    expect(markWrapSeen).toHaveBeenCalledWith('2026-09');
    act(() => r.unmount());
  });

  it("opens last month's report on the Reports tab", async () => {
    const r = await render();
    press(r, 'See the full report');
    expect(router.navigate).toHaveBeenCalledWith('/reports?month=-1');
    expect(router.replace).not.toHaveBeenCalled();
    act(() => r.unmount());
  });

  it('opens the report on exactly the week it played, and marks that week seen', async () => {
    mockParams.current = { period: 'week' };
    const r = await render();
    expect(texts(r)).toContain('A lighter week.');
    press(r, 'See the full report');
    expect(router.navigate).toHaveBeenCalledWith('/reports?from=2026-09-20&to=2026-09-26');
    expect(markWrapSeen).toHaveBeenCalledWith('2026-09-20');
    act(() => r.unmount());
  });

  it('✕ goes back', async () => {
    const r = await render();
    act(() => r.root.find((n) => n.props.accessibilityLabel === 'Close' && n.props.onPress).props.onPress());
    expect(router.back).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it('says when there is nothing to play, with a way out', async () => {
    mockMonth.current = null;
    const r = await render();
    expect(texts(r)).toContain('Nothing to wrap yet');
    press(r, 'Close');
    expect(router.back).toHaveBeenCalledTimes(1);
    act(() => r.unmount());
  });

  it('says what went wrong when it cannot load', async () => {
    mockFail.current = true;
    const r = await render();
    expect(texts(r)).toContain("Couldn't make your Wrap");
    expect(texts(r)).toContain('Database is busy');
    act(() => r.unmount());
  });
});
