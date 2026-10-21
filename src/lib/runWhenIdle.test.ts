import { runWhenIdle } from './runWhenIdle';

const original = globalThis.requestIdleCallback;
afterEach(() => {
  Object.defineProperty(globalThis, 'requestIdleCallback', {
    configurable: true,
    writable: true,
    value: original,
  });
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

it('falls back to a timer instead of throwing when reading requestIdleCallback fails', () => {
  jest.useFakeTimers();
  Object.defineProperty(globalThis, 'requestIdleCallback', {
    configurable: true,
    get() {
      throw new Error("TurboModuleRegistry.getEnforcing(...): 'NativeIdleCallbacksCxx' could not be found.");
    },
  });
  const task = jest.fn();
  expect(() => runWhenIdle(task)).not.toThrow();
  jest.runAllTimers();
  expect(task).toHaveBeenCalledTimes(1);
});

it('falls back to a timer when scheduling the idle callback itself throws', () => {
  jest.useFakeTimers();
  globalThis.requestIdleCallback = () => {
    throw new Error('scheduling failed');
  };
  const task = jest.fn();
  expect(() => runWhenIdle(task)).not.toThrow();
  jest.runAllTimers();
  expect(task).toHaveBeenCalledTimes(1);
});
