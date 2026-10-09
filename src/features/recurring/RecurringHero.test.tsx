/**
 * The top of Recurring: month and year cost, how many are running, when the next is due and the split
 * between them; or just a line about the page when no expense rule is running. Made-up figures.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, StyleSheet } from 'react-native';

import { RecurringHero } from './RecurringHero';

const StyleSheetFlatten = (st: unknown) => StyleSheet.flatten(st as never) as { width?: number };

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));

function render(props: Partial<React.ComponentProps<typeof RecurringHero>> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <RecurringHero
        totals={{ monthlyMinor: 100000, yearlyMinor: 1200000, count: 2 }}
        shares={[
          { key: 'r', name: 'Rent', minor: 75000, color: '#FBF0CE' },
          { key: 'w', name: 'Wifi', minor: 25000, color: '#EAF3FE' },
        ]}
        nextDate="2026-11-01"
        {...props}
      />
    );
  });
  return tree;
}

describe('RecurringHero', () => {
  it('shows the month, the year, how many are running and the next date', () => {
    const shown = texts(render());
    expect(shown).toEqual(expect.arrayContaining(['Subscriptions & bills', 'A year', '₹12,000']));
    expect(shown.some((t) => t.startsWith('₹1,000'))).toBe(true);
    expect(shown.some((t) => t.includes('2 running') && t.includes('Next: ') && t.includes('1 Nov'))).toBe(
      true
    );
  });

  it('says which one is the biggest slice', () => {
    expect(texts(render()).some((t) => t.startsWith('Rent is 75% of it'))).toBe(true);
  });

  it('leaves out the split and the share line for a single rule', () => {
    const shown = texts(
      render({
        totals: { monthlyMinor: 25000, yearlyMinor: 300000, count: 1 },
        shares: [{ key: 'w', name: 'Wifi', minor: 25000, color: '#EAF3FE' }],
      })
    );
    expect(shown.some((t) => t.includes('of it'))).toBe(false);
    expect(shown.some((t) => t.startsWith('1 running'))).toBe(true);
  });

  it('is only a line about the page with no expense rule running', () => {
    const shown = texts(
      render({ totals: { monthlyMinor: 0, yearlyMinor: 0, count: 0 }, shares: [], nextDate: null })
    );
    expect(shown.some((t) => t.startsWith('Set up rent'))).toBe(true);
    expect(shown).not.toContain('A year');
  });

  it('puts a dot on each day something lands in the next 30 days, bigger for bigger amounts', () => {
    const tree = render({
      today: '2026-10-09',
      marks: [
        { key: 'rent', date: '2026-10-12', amountMinor: 1800000, incoming: false },
        { key: 'jio', date: '2026-10-20', amountMinor: 39900, incoming: false },
        { key: 'pay', date: '2026-11-01', amountMinor: 9500000, incoming: true },
      ],
    });
    act(() =>
      tree.root
        .find((n) => n.props.testID === 'landLine')
        .props.onLayout({ nativeEvent: { layout: { width: 290 } } })
    );
    const dots = tree.root.findAll(
      (n) =>
        typeof n.type === 'string' &&
        []
          .concat(n.props.style ?? [])
          .flat()
          .some((x: { borderWidth?: number }) => x?.borderWidth === 3)
    );
    expect(dots).toHaveLength(3);
    const size = (i: number) => StyleSheetFlatten(dots[i].props.style).width as number;
    // Pay day (the biggest) is the biggest dot; the ₹399 bill the smallest.
    expect(size(2)).toBeGreaterThan(size(0));
    expect(size(0)).toBeGreaterThan(size(1));
    expect(texts(tree)).toEqual(expect.arrayContaining(['When they land, next 30 days', 'Today']));
  });

  it('leaves the line out when nothing lands', () => {
    const tree = render({ today: '2026-10-09', marks: [] });
    expect(tree.root.findAll((n) => n.props.testID === 'landLine')).toHaveLength(0);
  });
});
