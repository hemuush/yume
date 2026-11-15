/** Jumping the Activity list to a day: where it lands, and the one retry when the list has not measured that far. */
import { act } from 'react-test-renderer';
import { renderHook } from '@/test-support/renderHook';

const mockReduce = jest.fn(() => false);
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => mockReduce() }));

import { useDayJump } from './useDayJump';

type Props = Parameters<typeof useDayJump>[0];
const days = [{ date: '2026-09-25' }, { date: '2026-09-23' }, { date: '2026-09-18' }];
const scrollRef = { current: { scrollToIndex: jest.fn(), scrollToOffset: jest.fn() } };
const list = scrollRef.current;
let hook: ReturnType<typeof renderHook<ReturnType<typeof useDayJump>, Props>> | undefined;
const props = (next: Partial<Props> = {}): Props => ({
  scrollRef: scrollRef as never,
  collapsedHeight: 90,
  days,
  scope: 'week',
  listKey: 'week-1',
  ...next,
});
// Shown, or shown again with other props (a new scope, a new list).
const show = (next: Partial<Props> = {}) => {
  if (hook) hook.rerender(props(next));
  else hook = renderHook(useDayJump, { initialProps: props(next) });
};
beforeEach(() => {
  jest.useFakeTimers();
  mockReduce.mockReturnValue(false);
  list.scrollToIndex.mockClear();
  list.scrollToOffset.mockClear();
  show();
});
afterEach(() => {
  hook!.unmount();
  hook = undefined;
  jest.useRealTimers();
});
const jump = {
  scrollToDay: (key: string) => hook!.result.current.scrollToDay(key),
  onScrollToIndexFailed: (info: { index: number; averageItemLength: number }) =>
    hook!.result.current.onScrollToIndexFailed(info),
};

it('scrolls a day of the week to just under the shrunk header', () => {
  expect(jump.scrollToDay('2026-09-23')).toBe(true);
  expect(list.scrollToIndex).toHaveBeenCalledWith({
    index: 1,
    animated: true,
    viewPosition: 0,
    viewOffset: 90,
  });
});

it('does not scroll to a day the list does not have', () => {
  expect(jump.scrollToDay('2026-09-24')).toBe(false);
  expect(list.scrollToIndex).not.toHaveBeenCalled();
});

it('jumps without animating when the phone asks for reduced motion', () => {
  mockReduce.mockReturnValue(true);
  show();
  jump.scrollToDay('2026-09-25');
  expect(list.scrollToIndex).toHaveBeenCalledWith(expect.objectContaining({ animated: false }));
});

it('takes a week’s bar in a month to the first day that week has', () => {
  show({ scope: 'month' });
  // The week starting 20 Sept holds the 23rd and the 25th; the list is newest first, so the 25th (index 0) is met first.
  expect(jump.scrollToDay('2026-09-20')).toBe(true);
  expect(list.scrollToIndex).toHaveBeenCalledWith(expect.objectContaining({ index: 0 }));
  list.scrollToIndex.mockClear();
  expect(jump.scrollToDay('2026-09-06')).toBe(false);
  expect(list.scrollToIndex).not.toHaveBeenCalled();
});

describe('a jump past what the list has measured', () => {
  const failed = { index: 40, averageItemLength: 200 };

  it('moves to where the day should be, then tries once more after the list has laid out', () => {
    jump.scrollToDay('2026-09-18');
    jump.onScrollToIndexFailed(failed);
    expect(list.scrollToOffset).toHaveBeenCalledWith({ offset: 8000, animated: false });
    list.scrollToIndex.mockClear();
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(list.scrollToIndex).toHaveBeenCalledWith({
      index: 40,
      animated: true,
      viewPosition: 0,
      viewOffset: 90,
    });
  });

  it('gives up after one retry, until the next jump', () => {
    jump.scrollToDay('2026-09-18');
    jump.onScrollToIndexFailed(failed);
    jump.onScrollToIndexFailed(failed);
    expect(list.scrollToOffset).toHaveBeenCalledTimes(1);
    jump.scrollToDay('2026-09-18');
    jump.onScrollToIndexFailed(failed);
    expect(list.scrollToOffset).toHaveBeenCalledTimes(2);
  });

  it('drops a retry waiting on a list that has since changed', () => {
    jump.scrollToDay('2026-09-18');
    jump.onScrollToIndexFailed(failed);
    list.scrollToIndex.mockClear();
    show({ listKey: 'week-2' });
    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(list.scrollToIndex).not.toHaveBeenCalled();
  });
});
