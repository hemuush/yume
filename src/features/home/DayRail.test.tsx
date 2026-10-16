import { StyleSheet, Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

import { DayRail } from './DayRail';
import { buildRail } from './dayRail';

const rail = buildRail([{ date: '2026-10-03', totalMinor: 50_000 }], '2026-10-16');
const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));

function render(selected: number | null, onSelect = jest.fn()) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<DayRail rail={rail} monthName="October" selected={selected} onSelect={onSelect} />);
  });
  return { r, onSelect };
}
const slider = (r: ReactTestRenderer) => r.root.find((n) => n.props.accessibilityRole === 'adjustable');

describe('day rail', () => {
  it('invites a drag, and says it is today', () => {
    const { r } = render(null);
    expect(texts(r)).toEqual(['Drag to travel through October', 'Today, 16 Oct']);
    expect(slider(r).props.accessibilityValue).toEqual({ text: 'Today, 16 Oct' });
  });

  it('names the day it has travelled to', () => {
    const { r } = render(7);
    expect(texts(r)).toEqual(['Travelling through October', '7 Oct']);
  });

  it('treats today as not travelling', () => {
    const { r } = render(16);
    expect(texts(r)[0]).toBe('Drag to travel through October');
  });

  it('is stepped one day at a time from a screen reader, and ends back at today', () => {
    const { r, onSelect } = render(null);
    const act1 = (name: string) =>
      act(() => slider(r).props.onAccessibilityAction({ nativeEvent: { actionName: name } }));
    act1('decrement');
    expect(onSelect).toHaveBeenLastCalledWith(15);
    act1('increment');
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('never steps before the 1st', () => {
    const { r, onSelect } = render(1);
    act(() => slider(r).props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    expect(onSelect).toHaveBeenLastCalledWith(1);
  });

  it('draws one tick for every day of the month', () => {
    const { r } = render(null);
    const ticks = r.root.findAll(
      (n) => String(n.type) === 'View' && StyleSheet.flatten(n.props.style)?.maxWidth === 6
    );
    expect(ticks).toHaveLength(31);
  });
});
