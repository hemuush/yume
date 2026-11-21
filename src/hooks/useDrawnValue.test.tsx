import { useEffect } from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';

let mockReduced = false;
jest.mock('./useReduceMotion', () => ({ useReduceMotion: () => mockReduced }));
jest.mock('react-native-reanimated', () => {
  const mock = require('@/test-support/reanimatedMock').createReanimatedMock();
  return { ...mock, withTiming: jest.fn(mock.withTiming), cancelAnimation: jest.fn(mock.cancelAnimation) };
});

import { withTiming, cancelAnimation } from 'react-native-reanimated';
import { useDrawnValue } from './useDrawnValue';

let shown = 0;
function Probe({ id, target }: { id: string; target: number }) {
  const value = useDrawnValue(id, target);
  useEffect(() => {
    shown = value.value;
  });
  return null;
}

it('restores each record independently and skips unchanged remembered values', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<Probe id="draw-first" target={80} />);
  });
  expect(shown).toBe(80);
  act(() => tree.update(<Probe id="draw-second" target={20} />));
  expect(shown).toBe(20);
  jest.mocked(withTiming).mockClear();
  act(() => tree.update(<Probe id="draw-first" target={80} />));
  expect(shown).toBe(80);
  expect(withTiming).not.toHaveBeenCalled();
  act(() => tree.unmount());
});

it('shows its value at once the first time, and glides only a real change', () => {
  let tree!: ReactTestRenderer;
  jest.mocked(withTiming).mockClear();
  act(() => {
    tree = create(<Probe id="draw-once" target={50} />);
  });
  expect(shown).toBe(50);
  expect(withTiming).not.toHaveBeenCalled();
  act(() => tree.update(<Probe id="draw-once" target={70} />));
  expect(withTiming).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});

it('jumps to the end with reduced motion and cancels work on unmount', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(<Probe id="draw-cancel" target={30} />);
  });
  // A real change starts a glide, which the next change or an unmount cancels.
  act(() => tree.update(<Probe id="draw-cancel" target={45} />));
  jest.mocked(cancelAnimation).mockClear();
  mockReduced = true;
  try {
    act(() => tree.update(<Probe id="draw-cancel" target={60} />));
    expect(shown).toBe(60);
    expect(cancelAnimation).toHaveBeenCalled();
    jest.mocked(withTiming).mockClear();
    act(() => tree.update(<Probe id="draw-cancel" target={90} />));
    expect(shown).toBe(90);
    expect(withTiming).not.toHaveBeenCalled();
  } finally {
    mockReduced = false;
    act(() => tree.unmount());
  }
});
