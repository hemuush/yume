/** The Trends in-and-out card and category tracks: made-up figures throughout. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));

import { CashFlowCard } from './CashFlowCard';
import { CategoryTracks } from './CategoryTracks';

const flow = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'].map((label, i) => ({
  label,
  incomeMinor: 8_000_000,
  expenseMinor: [5_000_000, 6_000_000, 9_000_000, 4_000_000, 5_000_000, 6_000_000, 2_500_000][i],
}));

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));

function render(ui: React.ReactElement) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(ui);
  });
  return r;
}

describe('CashFlowCard', () => {
  it('reads the latest month as so far and shows the summary strip', () => {
    const shown = texts(render(<CashFlowCard points={flow} inProgress />));
    expect(shown.some((t) => t.startsWith('Oct so far:'))).toBe(true);
    expect(shown).toEqual(
      expect.arrayContaining(['Money in and out', 'Avg kept', 'Best month', 'Months kept'])
    );
    expect(shown).toContain('5 of 6');
  });

  it('reads another month when its bars are tapped', () => {
    const r = render(<CashFlowCard points={flow} inProgress />);
    const jun = r.root.findAll((n) => n.props.accessibilityLabel?.startsWith('Jun,'))[0];
    act(() => jun.props.onPress());
    expect(texts(r).some((t) => t.startsWith('Jun:') && t.includes('more went out than came in'))).toBe(true);
  });

  it('offers to open the picked month when it can be', () => {
    const open = jest.fn();
    const r = render(<CashFlowCard points={flow} inProgress monthLink={() => ({ name: 'October', open })} />);
    const link = r.root.findAll((n) => n.props.accessibilityRole === 'link')[0];
    act(() => link.props.onPress());
    expect(open).toHaveBeenCalled();
    expect(texts(r)).toContain('Open October in Reports ›');
  });

  it('is left out with too few months or no income', () => {
    expect(render(<CashFlowCard points={flow.slice(0, 2)} inProgress={false} />).toJSON()).toBeNull();
    const none = flow.map((p) => ({ ...p, incomeMinor: 0 }));
    expect(render(<CashFlowCard points={none} inProgress={false} />).toJSON()).toBeNull();
  });
});

describe('CategoryTracks', () => {
  const row = (id: string, name: string, nowMinor: number) => ({
    categoryId: id,
    name,
    color: '#8FE8C8',
    totalsMinor: [400_000, 400_000, 400_000, nowMinor],
    nowMinor,
    usualMinor: 400_000,
    pct: Math.round((nowMinor / 400_000) * 100),
  });
  const rows = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((n, i) =>
    row(`id-${n}`, `Cat ${n}`, 900_000 - i * 100_000)
  );
  const press = (r: ReactTestRenderer, match: (label?: string) => boolean) =>
    act(() => r.root.findAll((n) => n.props.onPress && match(n.props.accessibilityLabel))[0].props.onPress());

  it('shows five, expands to all, and opens a category', () => {
    const onOpen = jest.fn();
    const r = render(<CategoryTracks rows={rows} catById={new Map()} inProgress onOpen={onOpen} />);
    expect(texts(r)).toContain('Cat E');
    expect(texts(r)).not.toContain('Cat F');
    expect(texts(r)).toContain('2 more categories');
    press(r, (l) => !!l?.startsWith('Cat A,'));
    expect(onOpen).toHaveBeenCalledWith('id-A');
    press(r, (l) => l === undefined);
    expect(texts(r)).toContain('Cat G');
    expect(texts(r)).toContain('Show less');
  });

  it('says "so far" while the month is still going', () => {
    const r = render(
      <CategoryTracks rows={rows.slice(0, 1)} catById={new Map()} inProgress onOpen={jest.fn()} />
    );
    expect(texts(r).some((t) => t.includes('so far · usual'))).toBe(true);
  });

  it('draws nothing without rows', () => {
    const r = render(<CategoryTracks rows={[]} catById={new Map()} inProgress={false} onOpen={jest.fn()} />);
    expect(r.toJSON()).toBeNull();
  });
});
