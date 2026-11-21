import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
let mockFocus: () => () => void;
jest.mock('expo-router', () => ({
  useFocusEffect: (cb: () => () => void) => {
    mockFocus = cb;
  },
}));
import { millisecondsToNextDay, useLocalDayRefresh } from './useLocalDayRefresh';

let tree: ReactTestRenderer;
let stop: (() => void) | undefined;
let foreground: (state: string) => void;
let spy: jest.SpyInstance;
function setup(refreshOnForeground = false) {
  const change = jest.fn();
  spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, cb) => {
    foreground = cb as (state: string) => void;
    return { remove: jest.fn() };
  });
  function Probe() {
    useLocalDayRefresh(change, refreshOnForeground);
    return null;
  }
  act(() => {
    tree = create(<Probe />);
  });
  act(() => {
    stop = mockFocus();
    foreground('active');
  });
  return change;
}
afterEach(() => {
  act(() => {
    stop?.();
    tree?.unmount();
  });
  spy?.mockRestore();
  jest.useRealTimers();
});
it('refreshes once at local midnight without a transaction or navigation', () => {
  jest.useFakeTimers({ now: new Date(2026, 11, 31, 23, 59, 59) });
  const change = setup();
  act(() => jest.advanceTimersByTime(1100));
  expect(change).toHaveBeenCalledTimes(1);
  act(() => jest.advanceTimersByTime(1000));
  expect(change).toHaveBeenCalledTimes(1);
});
it('catches a day change after backgrounding, but not repeated same-day activation', () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 20, 21) });
  const change = setup();
  act(() => foreground('background'));
  jest.setSystemTime(new Date(2026, 9, 21, 8));
  act(() => {
    foreground('active');
    foreground('active');
  });
  expect(change).toHaveBeenCalledTimes(1);
});
it('checks the calendar on activation even when a background event was not observed', () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 20, 21) });
  const change = setup(true);
  const initialCalls = change.mock.calls.length;
  jest.setSystemTime(new Date(2026, 9, 21, 8));
  act(() => foreground('active'));
  expect(change).toHaveBeenCalledTimes(initialCalls + 1);
  act(() => foreground('active'));
  expect(change).toHaveBeenCalledTimes(initialCalls + 1);
});
it('cancels the timer when the screen loses focus', () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 20, 23, 59, 59) });
  const change = setup();
  act(() => {
    stop?.();
    stop = undefined;
    jest.advanceTimersByTime(2000);
  });
  expect(change).not.toHaveBeenCalled();
});
it('refreshes once on a real foreground transition and retains its midnight timer after duplicate active events', () => {
  jest.useFakeTimers({ now: new Date(2026, 9, 20, 23, 59, 59) });
  const change = setup(true);
  const initialCalls = change.mock.calls.length;
  act(() => {
    foreground('background');
    foreground('active');
    foreground('active');
  });
  expect(change).toHaveBeenCalledTimes(initialCalls + 1);
  act(() => jest.advanceTimersByTime(1100));
  expect(change).toHaveBeenCalledTimes(initialCalls + 2);
});
it('computes the boundary using local calendar fields', () => {
  const now = new Date(2026, 9, 20, 23, 59, 59);
  expect(millisecondsToNextDay(now)).toBe(1050);
});
