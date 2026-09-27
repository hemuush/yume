/**
 * Bars and rings remember what they showed: the first sight after launch
 * draws in from 0, coming back starts at the old value (so nothing moves if
 * nothing changed), and a new value glides from the old one.
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
  it('draws in from 0 the first time', () => {
    act(() => {
      create(<Probe k="bar" value={60} />);
    });
    expect(valueOf(box.seen)).toBe(0);
    act(() => jest.advanceTimersByTime(2000));
    expect(valueOf(box.seen)).toBe(60);
  });

  it('starts at the old value when you come back', () => {
    let r!: ReturnType<typeof create>;
    act(() => {
      r = create(<Probe k="bar" value={60} />);
    });
    act(() => jest.advanceTimersByTime(2000));
    act(() => r.unmount());
    act(() => {
      create(<Probe k="bar" value={60} />);
    });
    expect(valueOf(box.seen)).toBe(60);
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
    act(() => jest.advanceTimersByTime(2000));
    act(() => {
      create(<Probe k="b" value={90} />);
    });
    expect(valueOf(box.seen)).toBe(0);
  });
});
