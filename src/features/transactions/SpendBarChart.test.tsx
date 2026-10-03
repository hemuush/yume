/**
 * The Activity chart's week: the tapped day's amount shows in a bubble over its bar, today's label is an ink
 * pill, and days of the neighbouring month are named once above their dots. All figures are made up.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/money', () => ({
  ...jest.requireActual('@/lib/money'),
  formatMoney: (minor: number) => `₹${minor / 100}`,
}));

import { SpendBarChart } from './SpendBarChart';
import { buildWeekSpendBars } from './spendChart';
import type { Transaction } from '@/types';

const expense = (date: string, amountMinor: number) =>
  ({ id: date, type: 'expense', date, amountMinor, categoryId: null, isRefund: false }) as Transaction;

// 1 Oct 2026 is a Thursday: the first week is Thu–Sat, with 27–30 Sep before it.
const bars = buildWeekSpendBars(
  [expense('2026-10-01', 13_484_00), expense('2026-10-02', 175_00)],
  [],
  { start: '2026-10-01', end: '2026-10-03' },
  '2026-10-02'
);

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));

function chart(selectedKey: string | null, onPressDay = jest.fn()) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<SpendBarChart bars={bars} onPressDay={onPressDay} selectedKey={selectedKey} inset={0} />);
  });
  return { r, onPressDay };
}

describe('SpendBarChart week', () => {
  it('shows no amount until a day is tapped, then the tapped day’s amount', () => {
    expect(texts(chart(null).r)).not.toContain('₹13484');
    expect(texts(chart('2026-10-01').r)).toContain('₹13484');
  });

  it('shows the amount of one day only', () => {
    const all = texts(chart('2026-10-02').r);
    expect(all).toContain('₹175');
    expect(all).not.toContain('₹13484');
  });

  it('does not caption the dimmed days from the neighbouring month; the period row names the dates', () => {
    const note = texts(chart(null).r).filter((t) => t.startsWith('27–'));
    expect(note).toHaveLength(0);
  });

  it('still reports a tap on a real day, and ignores the placeholder days', () => {
    const { r, onPressDay } = chart(null);
    const buttons = r.root.findAll((n) => n.props.accessibilityRole === 'button' && !!n.props.onPress);
    expect(buttons).toHaveLength(2);
    act(() => buttons[0].props.onPress());
    expect(onPressDay).toHaveBeenCalledWith('2026-10-01');
  });
});
