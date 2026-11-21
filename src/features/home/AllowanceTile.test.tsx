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
    expect(words(under)).toContain('Today');
    expect(label(under)).toContain('Today ₹125 spent');
    expect(label(under)).not.toContain('over that pace');
    const over = render(<AllowanceTile perDayMinor={46700} daysLeft={9} todaySpentMinor={60000} />);
    expect(label(over)).toContain('over that pace');
    act(() => under.unmount());
    act(() => over.unmount());
  });
});
