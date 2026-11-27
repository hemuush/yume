import { Text } from 'react-native';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AllowanceTile } from './AllowanceTile';

const render = (el: React.ReactElement) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el);
  });
  return r;
};
const words = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((t) =>
      [t.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string')
        .join('')
    )
    .join(' | ');
const label = (r: ReactTestRenderer) =>
  r.root.find((n) => typeof n.props.accessibilityLabel === 'string').props.accessibilityLabel as string;

describe('the daily figure under the headline', () => {
  it('says the pace, and nothing about today until something went out', () => {
    const r = render(<AllowanceTile perDayMinor={46700} daysLeft={9} />);
    expect(words(r)).toContain('a day');
    expect(words(r)).not.toContain('Today');
    act(() => r.unmount());
  });

  it('shows what went out today beside the pace, and says so when it is more', () => {
    const under = render(<AllowanceTile perDayMinor={46700} daysLeft={9} todaySpentMinor={12500} />);
    expect(words(under)).toContain('₹342 left today');
    expect(label(under)).toContain('Today ₹125 spent');
    expect(label(under)).not.toContain('over pace');
    const over = render(<AllowanceTile perDayMinor={46700} daysLeft={9} todaySpentMinor={60000} />);
    expect(label(over)).toContain('over pace');
    act(() => under.unmount());
    act(() => over.unmount());
  });

  it('sets today against its own share when it is given, not the pace of the days after it', () => {
    // ₹924 free after ₹243 today, 8 days to come: ₹116 a day after today, but today's own share was (924+243)/9.
    const r = render(
      <AllowanceTile perDayMinor={11600} daysLeft={8} todaySpentMinor={24300} todayBudgetMinor={12967} />
    );
    expect(words(r)).toContain('₹113 over pace');
    expect(label(r)).toContain('₹113 over pace');
    act(() => r.unmount());
  });

  it('says by how much today is over or under the pace, not only with a bar', () => {
    const under = render(<AllowanceTile perDayMinor={46700} daysLeft={9} todaySpentMinor={12500} />);
    expect(words(under)).toContain('₹342 left today');
    const over = render(<AllowanceTile perDayMinor={11600} daysLeft={8} todaySpentMinor={24300} />);
    expect(words(over)).toContain('₹127 over pace');
    act(() => under.unmount());
    act(() => over.unmount());
  });

  it('shows the full available allowance when nothing was spent today', () => {
    const r = render(
      <AllowanceTile perDayMinor={50000} daysLeft={9} todaySpentMinor={0} todayBudgetMinor={45000} />
    );
    expect(words(r)).toContain('₹450 left today');
    expect(label(r)).toContain('₹450 left today');
    act(() => r.unmount());
  });
});
