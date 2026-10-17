import { Text, StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));

import { SpendBars } from './SpendBars';

const text = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((n) =>
      [n.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string' || typeof c === 'number')
        .join('')
    )
    .join(' | ');
function render(daily: { date: string; totalMinor: number }[], today: string) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<SpendBars daily={daily} today={today} />);
  });
  return r;
}
// A bar is the animated view that takes its height from the amount.
const heights = (r: ReactTestRenderer) =>
  r.root
    .findAll((n) => String(n.type) === 'View' && StyleSheet.flatten(n.props.style)?.maxWidth === 34)
    .map((n) => StyleSheet.flatten(n.props.style).height as number);

describe('Home spending bars', () => {
  it('names the days, and calls the last one Today', () => {
    const t = text(render([{ date: '2026-10-16', totalMinor: 92_700 }], '2026-10-17'));
    for (const label of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Today']) expect(t).toContain(label);
  });

  it('opens on the latest day with spending, and says so in the readout', () => {
    const r = render([{ date: '2026-10-16', totalMinor: 92_700 }], '2026-10-17');
    expect(text(r)).toContain('16 Oct · ₹927');
  });

  it('opens on today when nothing has been spent', () => {
    expect(text(render([], '2026-10-17'))).toContain('17 Oct · ₹0');
  });

  it('keeps an ordinary day visible next to one big payment', () => {
    // 5,000 against 56,900: a straight scale would draw it at 8 of 70.
    const r = render(
      [
        { date: '2026-10-11', totalMinor: 5_690_000 },
        { date: '2026-10-12', totalMinor: 500_000 },
        { date: '2026-10-13', totalMinor: 0 },
      ],
      '2026-10-17'
    );
    const [big, small, none] = heights(r);
    expect(big).toBe(70);
    expect(small).toBeGreaterThanOrEqual(25);
    expect(small).toBeLessThan(big);
    // A day with nothing spent stays a thin line, not a small amount.
    expect(none).toBe(4);
  });
});
