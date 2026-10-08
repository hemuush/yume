/** The period picker: months with what each cost, future and pre-history months off, years, weeks. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children }: { visible: boolean; children: React.ReactNode }) =>
    visible ? children : null,
}));
jest.mock('@/db/reports', () => ({
  getSpendByMonth: async () => ({
    byMonth: new Map([
      ['2025-11', 4_500_000],
      ['2026-09', 7_400_000],
      ['2026-10', 5_340_000],
    ]),
    firstMonth: '2025-11',
  }),
}));

import { PeriodPicker, compactMoney } from './PeriodPicker';

const today = new Date(2026, 9, 8);
const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
const button = (r: ReactTestRenderer, label: string) =>
  r.root.find((n) => n.props.accessibilityLabel === label && typeof n.props.onPress === 'function');

async function render(over: Partial<React.ComponentProps<typeof PeriodPicker>> = {}) {
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(
      <PeriodPicker
        visible
        onClose={jest.fn()}
        today={today}
        selected={{ kind: 'month', year: 2026, month: 9 }}
        onPickMonth={jest.fn()}
        onCurrent={jest.fn()}
        {...over}
      />
    );
  });
  return r;
}

describe('period picker', () => {
  it('shows what each month cost, and keeps the future and the months before the first entry off', async () => {
    const r = await render();
    expect(texts(r)).toEqual(expect.arrayContaining(['₹74k', '₹53k']));
    expect(button(r, 'November 2026').props.disabled).toBe(true);
    expect(button(r, 'October 2026, this month').props.disabled).toBe(false);
    act(() => button(r, '2025').props.onPress());
    expect(button(r, 'October 2025').props.disabled).toBe(true);
    expect(button(r, 'November 2025').props.disabled).toBe(false);
  });

  it('picks a month in one tap', async () => {
    const onPickMonth = jest.fn();
    const r = await render({ onPickMonth });
    act(() => button(r, 'September 2026').props.onPress());
    expect(onPickMonth).toHaveBeenCalledWith(2026, 8);
  });

  it('offers years only where the screen has a year view', async () => {
    expect(texts(await render()).includes('Year')).toBe(false);
    const onPickYear = jest.fn();
    const r = await render({ allowYear: true, onPickYear });
    const yearTab = r.root.find(
      (n) =>
        n.props.accessibilityRole === 'radio' &&
        n.findAllByType(Text).some((t) => t.props.children === 'Year')
    );
    act(() => yearTab.props.onPress());
    act(() => button(r, '2025').props.onPress());
    expect(onPickYear).toHaveBeenCalledWith(2025);
    expect(texts(r)).toContain('This year');
  });

  it("lists the shown month's weeks, the future ones off", async () => {
    const onPick = jest.fn();
    const r = await render({
      weeks: {
        monthLabel: 'October',
        index: 1,
        ranges: [
          { start: '2026-10-01', end: '2026-10-03' },
          { start: '2026-10-04', end: '2026-10-10' },
          { start: '2026-10-11', end: '2026-10-17' },
        ],
        onPick,
      },
    });
    expect(texts(r)).toEqual(expect.arrayContaining(['Weeks of October', '1–3', '4–10']));
    expect(button(r, 'Week 3 of 3, 11–17').props.disabled).toBe(true);
    act(() => button(r, 'Week 1 of 3, 1–3').props.onPress());
    expect(onPick).toHaveBeenCalledWith('2026-10-01');
  });
});

describe('compactMoney', () => {
  it('shortens amounts to fit under a month', () => {
    expect(compactMoney(85_000)).toBe('₹850');
    expect(compactMoney(450_000)).toBe('₹4.5k');
    expect(compactMoney(6_100_000)).toBe('₹61k');
    expect(compactMoney(12_000_000)).toBe('₹1.2L');
  });
});
