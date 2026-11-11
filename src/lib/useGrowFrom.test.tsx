/**
 * Bars and rings show their value at once: nothing draws in from empty, coming back starts at the old value
 * (nothing moves if nothing changed), and only a real change glides from the old value to the new one.
 */
import { useEffect } from 'react';
import { create, act } from 'react-test-renderer';
import { Animated } from 'react-native';
import { useGrowFrom, resetGrowMemory } from './useGrowFrom';

jest.useFakeTimers();

// The probe hands its value out through a ref-like box, set after render.
const box: { seen: Animated.Value | null } = { seen: null };
function Probe({ k, value }: { k: string; value: number }) {
  const v = useGrowFrom(k, value);
  useEffect(() => {
    box.seen = v;
  });
  return null;
}
// Animated.Value keeps its number privately; __getValue is its own read.
const valueOf = (v: Animated.Value | null) => (v as unknown as { __getValue: () => number }).__getValue();

beforeEach(() => resetGrowMemory());

describe('useGrowFrom', () => {
  it('shows a new key at its value when the same component changes records', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Probe k="first" value={80} />);
    });
    act(() => tree.update(<Probe k="second" value={20} />));
    expect(valueOf(box.seen)).toBe(20);
    act(() => tree.unmount());
  });

  it('restores a remembered key without animating from the previous record', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Probe k="first" value={80} />);
    });
    act(() => jest.advanceTimersByTime(2000));
    act(() => tree.update(<Probe k="second" value={20} />));
    act(() => jest.advanceTimersByTime(2000));
    const timing = jest.spyOn(Animated, 'timing');
    act(() => tree.update(<Probe k="first" value={80} />));
    expect(valueOf(box.seen)).toBe(80);
    expect(timing).not.toHaveBeenCalled();
    timing.mockRestore();
    act(() => tree.unmount());
  });

  it('stops a pending glide when its owner unmounts', () => {
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(<Probe k="cancelled" value={40} />);
    });
    const value = box.seen;
    act(() => tree.update(<Probe k="cancelled" value={60} />));
    act(() => tree.unmount());
    const frozen = valueOf(value);
    act(() => jest.advanceTimersByTime(2000));
    expect(valueOf(value)).toBe(frozen);
  });

  it('shows its value at once the first time, with nothing drawn in from empty', () => {
    const timing = jest.spyOn(Animated, 'timing');
    act(() => {
      create(<Probe k="bar" value={60} />);
    });
    expect(valueOf(box.seen)).toBe(60);
    expect(timing).not.toHaveBeenCalled();
    timing.mockRestore();
  });

  it('starts at the old value when you come back', () => {
    const timing = jest.spyOn(Animated, 'timing');
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Probe k="bar" value={60} />);
    });
    act(() => jest.advanceTimersByTime(2000));
    act(() => r.unmount());
    timing.mockClear();
    act(() => {
      create(<Probe k="bar" value={60} />);
    });
    expect(valueOf(box.seen)).toBe(60);
    expect(timing).not.toHaveBeenCalled();
    timing.mockRestore();
  });

  it('glides from the old value to a new one', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Probe k="bar" value={40} />);
    });
    act(() => jest.advanceTimersByTime(2000));
    act(() => r.update(<Probe k="bar" value={50} />));
    const mid = valueOf(box.seen);
    expect(mid).toBeGreaterThanOrEqual(40);
    expect(mid).toBeLessThanOrEqual(50);
    act(() => jest.advanceTimersByTime(2000));
    expect(valueOf(box.seen)).toBe(50);
  });

  it('keeps separate bars apart', () => {
    act(() => {
      create(<Probe k="a" value={10} />);
    });
    act(() => {
      create(<Probe k="b" value={90} />);
    });
    expect(valueOf(box.seen)).toBe(90);
  });
});
