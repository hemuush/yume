/** The days turn the page with the period: in from the side the step came from, under a clearing cover. */
import { renderHook } from '@/test-support/renderHook';

// Every value a shared value is set to, in order, so a test can see where an animation started.
const mockSets: { name: string; value: unknown }[] = [];
let mockCount = 0;
jest.mock('react-native-reanimated', () => ({
  useSharedValue: (initial: unknown) => {
    const { useState } = require('react');
    const [sv] = useState(() => {
      const name = ['x', 'cover'][mockCount++ % 2];
      let v = initial;
      return { get: () => v, set: (next: unknown) => ((v = next), mockSets.push({ name, value: next })) };
    });
    return sv;
  },
  useAnimatedStyle: (fn: () => unknown) => fn(),
  withSpring: (to: unknown) => ({ spring: to }),
  withTiming: (to: unknown) => ({ timing: to }),
  cancelAnimation: jest.fn(),
  Easing: { bezier: () => () => 0 },
}));
jest.mock('@/lib/animation', () => ({ timing: (duration: number) => ({ duration }) }));
let mockReduce = false;
jest.mock('@/hooks/useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));

import { useListTurn } from './useListTurn';

type P = { key: string; dir: -1 | 0 | 1 };
const start = (initialProps: P) => {
  mockSets.length = 0;
  mockCount = 0;
  return renderHook(({ key, dir }: P) => useListTurn(key, dir), { initialProps });
};
const starts = () => mockSets.filter((s) => typeof s.value === 'number');

it('does nothing on the first load', () => {
  const hook = start({ key: '', dir: 0 });
  hook.rerender({ key: 'week:2026-11-22', dir: 0 });
  expect(starts()).toEqual([]);
  hook.unmount();
});

it('slides in from the side of the step, under a cover that clears', () => {
  const hook = start({ key: 'week:2026-11-22', dir: 0 });
  hook.rerender({ key: 'week:2026-11-15', dir: -1 });
  expect(starts()).toEqual([
    { name: 'x', value: -36 },
    { name: 'cover', value: 1 },
  ]);
  expect(mockSets.slice(-2)).toEqual([
    { name: 'x', value: { spring: 0 } },
    { name: 'cover', value: { timing: 0 } },
  ]);
  hook.unmount();
});

it('only clears for a Week/Month switch, and stays still with reduced motion', () => {
  const hook = start({ key: 'week:2026-11-22', dir: 0 });
  hook.rerender({ key: 'month:2026-11-01', dir: 0 });
  expect(starts()).toEqual([
    { name: 'x', value: 0 },
    { name: 'cover', value: 1 },
  ]);
  hook.unmount();
  mockReduce = true;
  const still = start({ key: 'week:2026-11-22', dir: 0 });
  still.rerender({ key: 'week:2026-11-29', dir: 1 });
  expect(starts()).toEqual([]);
  still.unmount();
  mockReduce = false;
});
