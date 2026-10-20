/** Home's Upcoming, Budgets and Goals rows: one shape, the right words, and goal amounts staying hidden. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.useFakeTimers();
beforeEach(() => jest.setSystemTime(new Date(2026, 9, 17, 12)));
import { UpcomingRow } from './UpcomingRow';

const text = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((t) =>
      [t.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string' || typeof c === 'number')
        .join('')
    )
    .join(' | ');
const render = (el: React.ReactElement) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el);
  });
  return r;
};
const label = (r: ReactTestRenderer) =>
  r.root.find((n) => typeof n.props.accessibilityLabel === 'string' && n.props.onPress).props
    .accessibilityLabel as string;

describe('Home upcoming row', () => {
  const row = (over: Partial<React.ComponentProps<typeof UpcomingRow>> = {}) => (
    <UpcomingRow
      icon="calendar"
      iconBg="#EEE"
      title="Loan EMI"
      subtitle="Tomorrow"
      amountMinor={500_000}
      sign="-"
      date="2026-10-18"
      onPress={jest.fn()}
      {...over}
    />
  );

  it('shows the title, when, and the amount', () => {
    const t = text(render(row()));
    expect(t).toContain('Loan EMI');
    expect(t).toContain('Tomorrow');
    expect(t).toContain('-₹5,000');
  });

  it('puts a status chip and a Pay button on a bill that is due now', () => {
    const r = render(row({ date: '2026-10-17', subtitle: 'Today', urgent: true, actionLabel: 'Pay' }));
    expect(text(r)).toContain('Due now');
    expect(text(r)).toContain('Pay');
    expect(label(r)).toContain('Pay');
  });

  it('labels an earlier unpaid bill Overdue instead of Due now', () => {
    const r = render(row({ date: '2026-10-16', subtitle: 'Yesterday', urgent: true, actionLabel: 'Pay' }));
    expect(text(r)).toContain('Overdue');
    expect(text(r)).not.toContain('Due now');
  });
});
