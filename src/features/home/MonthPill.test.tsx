/** Home's period control: its label, opening the picker, and what each pick means as an offset from today. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@/components/PeriodPicker', () => ({ PeriodPicker: () => null }));

import { MonthPill } from './MonthPill';
import { PeriodPicker } from '@/components/PeriodPicker';
import type { PeriodCursor } from '@/lib/period';

const NOW = new Date(2026, 10, 12, 12, 0, 0); // Thursday 12 November 2026

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterAll(() => jest.useRealTimers());

function mount(cursor: PeriodCursor = { granularity: 'month', offset: 0 }, compact = false) {
  const onChange = jest.fn();
  let r!: ReactTestRenderer;
  act(() => {
    r = create(<MonthPill cursor={cursor} onChange={onChange} compact={compact} />);
  });
  const picker = () => r.root.findByType(PeriodPicker);
  return { r, onChange, picker };
}

it('shows the month, and the short form (no calendar icon) when compact', () => {
  const full = mount();
  expect(full.r.root.findAllByType(Text).map((t) => t.props.children)).toContain('November');
  act(() => full.r.unmount());
  const small = mount({ granularity: 'month', offset: -1 }, true);
  expect(small.r.root.findAllByType(Text).map((t) => String(t.props.children))).toEqual(['Oct']);
  act(() => small.r.unmount());
});

it('opens the picker for the month shown, and closes it again', () => {
  const { r, picker } = mount({ granularity: 'month', offset: -2 });
  expect(picker().props.visible).toBe(false);
  act(() => r.root.find((n) => n.props.accessibilityRole === 'button').props.onPress());
  expect(picker().props.visible).toBe(true);
  // September 2026, picked from the month the cursor points at.
  expect(picker().props.selected).toEqual({ kind: 'month', year: 2026, month: 8 });
  act(() => picker().props.onClose());
  expect(picker().props.visible).toBe(false);
  act(() => r.unmount());
});

it.each([
  [2026, 10, 0], // this month
  [2026, 9, -1], // October
  [2026, 0, -10], // January this year
  [2025, 11, -11], // December last year: across the year boundary
  [2025, 10, -12],
  [2027, 0, 2], // January next year, two months ahead
])('turns the picked month %i/%i into an offset of %i from this month', (year, month, offset) => {
  const { r, onChange, picker } = mount();
  act(() => picker().props.onPickMonth(year, month));
  expect(onChange).toHaveBeenCalledWith({ granularity: 'month', offset });
  act(() => r.unmount());
});

it('turns a picked year, and "this month" or "this year", into offsets too, and closes the picker', () => {
  const { r, onChange, picker } = mount();
  act(() => r.root.find((n) => n.props.accessibilityRole === 'button').props.onPress());
  act(() => picker().props.onPickYear(2024));
  expect(onChange).toHaveBeenLastCalledWith({ granularity: 'year', offset: -2 });
  expect(picker().props.visible).toBe(false);
  act(() => picker().props.onCurrent('year'));
  expect(onChange).toHaveBeenLastCalledWith({ granularity: 'year', offset: 0 });
  act(() => picker().props.onCurrent('month'));
  expect(onChange).toHaveBeenLastCalledWith({ granularity: 'month', offset: 0 });
  act(() => r.unmount());
});

it('reads a year cursor as that year', () => {
  const { r, picker } = mount({ granularity: 'year', offset: -1 });
  expect(picker().props.selected).toEqual({ kind: 'year', year: 2025, month: 0 });
  act(() => r.unmount());
});
