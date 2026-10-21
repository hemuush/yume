import { runWhenIdle } from './runWhenIdle';

const original = globalThis.requestIdleCallback;
afterEach(() => {
  globalThis.requestIdleCallback = original;
  jest.useRealTimers();
});

it('runs the task from an idle callback with a deadline so it cannot be starved', () => {
  const idle = jest.fn((cb: IdleRequestCallback, _options?: IdleRequestOptions) => {
    cb({ didTimeout: false, timeRemaining: () => 10 });
    return 1;
  });
  globalThis.requestIdleCallback = idle;
  const task = jest.fn();
  runWhenIdle(task, 1500);
  expect(task).toHaveBeenCalledTimes(1);
  expect(idle.mock.calls[0][1]).toEqual({ timeout: 1500 });
});

it('falls back to a zero-delay timer where requestIdleCallback is missing', () => {
  jest.useFakeTimers();
  (globalThis as { requestIdleCallback?: unknown }).requestIdleCallback = undefined;
  const task = jest.fn();
  runWhenIdle(task);
  expect(task).not.toHaveBeenCalled();
  jest.runAllTimers();
  expect(task).toHaveBeenCalledTimes(1);
});
