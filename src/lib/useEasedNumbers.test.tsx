import { useEffect } from 'react';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

let mockReduce = false;
jest.mock('./useReduceMotion', () => ({ useReduceMotion: () => mockReduce }));

import { useEasedNumbers } from './useEasedNumbers';

let latest: number[] = [];
const seen = (values: number[]) => {
  latest = values;
};
function Probe({ values }: { values: number[] }) {
  const shown = useEasedNumbers(values, 200);
  useEffect(() => seen(shown));
  return null;
}
function render(values: number[]) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<Probe values={values} />);
  });
  return r;
}

beforeEach(() => {
  jest.useFakeTimers();
  mockReduce = false;
});
afterEach(() => jest.useRealTimers());

it('starts at the first values, with nothing to glide from', () => {
  render([10, 20]);
  expect(latest).toEqual([10, 20]);
});

it('lands on a new value at once with reduced motion', () => {
  mockReduce = true;
  const r = render([10, 20]);
  act(() => r.update(<Probe values={[30, 5]} />));
  expect(latest).toEqual([30, 5]);
});

it('glides to a new value and ends exactly on it', () => {
  const r = render([0, 100]);
  act(() => r.update(<Probe values={[100, 0]} />));
  act(() => {
    jest.advanceTimersByTime(60);
  });
  expect(latest[0]).toBeGreaterThan(0);
  expect(latest[0]).toBeLessThan(100);
  act(() => {
    jest.advanceTimersByTime(400);
  });
  expect(latest).toEqual([100, 0]);
});

it('carries on from where it was when interrupted, never jumping back', () => {
  const r = render([0]);
  act(() => r.update(<Probe values={[100]} />));
  act(() => {
    jest.advanceTimersByTime(100);
  });
  const mid = latest[0];
  expect(mid).toBeGreaterThan(0);
  act(() => r.update(<Probe values={[0]} />));
  expect(latest[0]).toBeGreaterThanOrEqual(mid - 1);
  act(() => {
    jest.advanceTimersByTime(500);
  });
  expect(latest).toEqual([0]);
});
