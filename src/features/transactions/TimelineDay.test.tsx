/**
 * One Activity day: heading is only day and date, every entry sits in one card (transfers as quiet end rows),
 * 2+ entries of a category stack into a line that opens in place; every entry stays tappable (no "+N more").
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, StyleSheet } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
}));

import { TimelineDay } from './TimelineDay';
import { Category, Transaction } from '@/types';
import { theme } from '@/constants/theme';
import { formatMoney } from '@/lib/money';

it('shows foreign amounts in their own currency and excludes them from the day total', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <TimelineDay
        date={DATE}
        label="Today"
        dateLabel="25 Sept"
        items={[
          tx('inr', { amountMinor: 10000 }),
          tx('usd', { accountId: 'usd', amountMinor: 1000, categoryId: 'travel' }),
        ]}
        categories={categories}
        accountName={(id) => id}
        categoryName={(id) => names[id ?? ''] ?? ''}
        accountCurrency={(id) => (id === 'usd' ? 'USD' : 'INR')}
        onPressTx={jest.fn()}
        openStacks={new Set()}
        onToggleStack={jest.fn()}
      />
    );
  });
  const labels = tree.root
    .findAll((n) => typeof n.props.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel);
  expect(labels.some((label) => label.includes(formatMoney(1000, 'USD')))).toBe(true);
  expect(texts(tree).join(' ')).not.toContain(formatMoney(11000, 'INR'));
  act(() => tree.unmount());
});

// Bars, rings and the new-entry glow animate (useGrowFrom, JustAddedGlow); fake
// timers keep those frames inside the test instead of firing after it ends.
jest.useFakeTimers();

const DATE = '2026-09-25';

function tx(id: string, over: Partial<Transaction>): Transaction {
  return {
    id,
    type: 'expense',
    accountId: 'bank',
    toAccountId: null,
    categoryId: 'food',
    amountMinor: 10000,
    date: DATE,
    note: '',
    paymentMode: null,
    loanPaymentId: null,
    splitId: null,
    isRefund: false,
    createdAt: `${DATE}T10:00:00.000Z`,
    ...over,
  };
}

const items = [
  tx('t1', { categoryId: 'food', amountMinor: 12000, note: 'Lunch', createdAt: `${DATE}T13:00:00.000Z` }),
  tx('t2', { type: 'transfer', categoryId: null, toAccountId: 'cash', amountMinor: 300000 }),
  tx('t3', { categoryId: 'travel', amountMinor: 5000 }),
  tx('t4', { categoryId: 'food', amountMinor: 8000, note: 'Tea', createdAt: `${DATE}T09:00:00.000Z` }),
  tx('t5', { type: 'income', categoryId: 'salary', amountMinor: 50000 }),
];

const categories = [
  { id: 'food', name: 'Food', icon: 'food', color: '#FF9E7D' },
  { id: 'travel', name: 'Travel', icon: 'car', color: '#8CCED6' },
  { id: 'salary', name: 'Salary', icon: 'cash', color: '#8FE8C8' },
] as Category[];
const names: Record<string, string> = { food: 'Food', travel: 'Travel', salary: 'Salary' };
const accounts: Record<string, string> = { bank: 'Bank', cash: 'Cash' };

it('labels a received refund without exposing its sensitive amount and still opens the entry', () => {
  mockHideAmounts = true;
  const refund = tx('refund', { type: 'income', isRefund: true });
  const open = jest.fn();
  let tree!: ReactTestRenderer;
  try {
    act(() => {
      tree = create(
        <TimelineDay
          date={DATE}
          label="Today"
          dateLabel="25 Sept"
          items={[refund]}
          categories={categories.map((c) => ({ ...c, isSensitive: true }))}
          accountName={(id) => id}
          categoryName={(id) => names[id ?? '']}
          onPressTx={open}
          openStacks={new Set()}
          onToggleStack={jest.fn()}
        />
      );
    });
    expect(texts(tree)).toContain('Refund');
    expect(texts(tree).join(' ')).not.toContain('₹100');
    const row = tree.root.findAll(
      (n) => typeof n.props.onPress === 'function' && String(n.props.accessibilityLabel).includes(', refund')
    )[0];
    expect(row.props.accessibilityLabel).toContain('••••');
    act(() => row.props.onPress());
    expect(open).toHaveBeenCalledWith(refund);
  } finally {
    mockHideAmounts = false;
    if (tree) act(() => tree.unmount());
  }
});

function texts(r: ReactTestRenderer): string[] {
  return r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
}

function byLabel(r: ReactTestRenderer, start: string) {
  // The composite Pressable, not the host views it renders.
  return r.root.findAll(
    (n) =>
      typeof n.type !== 'string' &&
      typeof n.props.onPress === 'function' &&
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(start),
    { deep: false }
  );
}

function render(
  openStacks: Set<string>,
  onToggleStack = jest.fn(),
  onPressTx = jest.fn(),
  onReorder?: (date: string, ids: string[]) => Promise<void>,
  opts: {
    categories?: Category[];
    savingsAccountIds?: Set<string>;
    onDragActive?: (active: boolean) => void;
    animateLayout?: boolean;
  } = {}
) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <TimelineDay
        date={DATE}
        label="Yesterday"
        dateLabel="25 Sept"
        items={items}
        categories={opts.categories ?? categories}
        savingsAccountIds={opts.savingsAccountIds}
        accountName={(id) => accounts[id] ?? id}
        categoryName={(id) => (id ? names[id] : 'Transfer')}
        onPressTx={onPressTx}
        openStacks={openStacks}
        onToggleStack={onToggleStack}
        onReorder={onReorder}
        onDragActive={opts.onDragActive}
        animateLayout={opts.animateLayout}
      />
    );
  });
  return r;
}

describe('TimelineDay with savings amounts hidden', () => {
  const sensitiveFood = categories.map((c) =>
    c.id === 'food' ? { ...c, isSensitive: true } : c
  ) as Category[];

  afterEach(() => {
    mockHideAmounts = false;
  });

  it('shows everything while hiding is off', () => {
    const r = render(new Set(), jest.fn(), jest.fn(), undefined, {
      categories: sensitiveFood,
      savingsAccountIds: new Set(['cash']),
    });
    const all = texts(r).join(' | ');
    expect(all).toContain('₹250 spent · ₹500 in');
    expect(all).not.toContain('••••');
  });

  it('masks investment entries and savings transfers, and leaves them out of the day net', () => {
    mockHideAmounts = true;
    const r = render(new Set(), jest.fn(), jest.fn(), undefined, {
      categories: sensitiveFood,
      savingsAccountIds: new Set(['cash']),
    });
    const all = texts(r).join(' | ');
    // Only salary +500 and travel -50 are left to count.
    expect(all).toContain('₹50 spent · ₹500 in');
    expect(all).not.toContain('₹120');
    expect(all).not.toContain('₹80');
    expect(all).not.toContain('₹200');
    expect(all).not.toContain('₹3,000');
    expect(all).toContain('••••');
    expect(byLabel(r, 'Food, 2 entries, ₹200')).toHaveLength(0);
    expect(byLabel(r, '₹3,000 moved')).toHaveLength(0);
    // Ordinary entries stay readable.
    expect(byLabel(r, 'Travel, ₹50').length).toBeGreaterThan(0);
  });
});

describe('TimelineDay', () => {
  it('shows the day, what it spent and took in, with the transfer as a row', () => {
    const r = render(new Set());
    const all = texts(r).join('\n');
    expect(
      r.root.findAll((n) => String(n.props.accessibilityLabel).includes('25 Sept')).length
    ).toBeGreaterThan(0);
    expect(all).not.toContain('5 entries');
    // Food 200 and travel 50 spent, salary 500 in; the transfer moves nothing.
    expect(all).toContain('₹250 spent · ₹500 in');
    expect(all).toContain('Bank →\u00A0Cash');
    expect(all).toContain('Transfer');
    expect(byLabel(r, '₹3,000 moved from Bank to Cash')).toHaveLength(1);
  });

  it('stacks two Food entries into one closed line', () => {
    const toggle = jest.fn();
    const r = render(new Set(), toggle);
    // The count is the stack's second line, with its one account, like a single entry's.
    expect(texts(r)).toContain('2 entries · Bank');
    expect(byLabel(r, 'Food, Lunch')).toHaveLength(0);
    const stack = byLabel(r, 'Food, 2 entries, ₹200');
    expect(stack).toHaveLength(1);
    act(() => stack[0].props.onPress());
    expect(toggle).toHaveBeenCalledWith(`${DATE}|expense|food`);
  });

  it('an open stack lists each entry, and every entry of the day can be tapped', () => {
    const onPress = jest.fn();
    const r = render(new Set([`${DATE}|expense|food`]), jest.fn(), onPress);
    expect(texts(r)).toEqual(expect.arrayContaining(['Lunch', 'Tea']));
    const tappable = [
      ...byLabel(r, 'Food, Lunch'),
      ...byLabel(r, 'Food, Tea'),
      ...byLabel(r, 'Travel,'),
      ...byLabel(r, 'Salary,'),
      ...byLabel(r, '₹3,000 moved'),
    ];
    tappable.forEach((p) => act(() => p.props.onPress()));
    expect(onPress.mock.calls.map(([t]) => t.id).sort()).toEqual(['t1', 't2', 't3', 't4', 't5']);
  });

  it('opens and closes a stack with the panel motion, and lets days animate only just after a toggle', () => {
    const { PANEL_ENTER, ROW_EXIT, ROW_LAYOUT } = require('@/lib/animation');
    const open = render(new Set([`${DATE}|expense|food`]));
    const panels = open.root.findAll(
      (n) => typeof n.type === 'string' && n.props.entering === PANEL_ENTER && n.props.exiting === ROW_EXIT
    );
    expect(panels.length).toBeGreaterThan(0);
    const dayLayouts = (tree: ReactTestRenderer) =>
      tree.root.findAll(
        (n) =>
          typeof n.type === 'string' &&
          n.props.layout === ROW_LAYOUT &&
          StyleSheet.flatten(n.props.style)?.flexDirection === 'row' &&
          StyleSheet.flatten(n.props.style)?.marginTop === 14
      ).length;
    // At rest the day carries no layout animation of its own, so a shift in a long list lands at once.
    expect(dayLayouts(open)).toBe(0);
    act(() => open.unmount());
    const moving = render(new Set([`${DATE}|expense|food`]), jest.fn(), jest.fn(), undefined, {
      animateLayout: true,
    });
    expect(dayLayouts(moving)).toBe(1);
    act(() => moving.unmount());
    const closed = render(new Set());
    expect(closed.root.findAll((n) => n.props.entering === PANEL_ENTER)).toHaveLength(0);
    act(() => closed.unmount());
  });

  it('moves a line up or down for TalkBack, saving the day with stacks whole and transfers last', async () => {
    const onReorder = jest.fn().mockResolvedValue(undefined);
    const r = render(new Set(), jest.fn(), jest.fn(), onReorder);
    const travel = byLabel(r, 'Travel,')[0];
    expect(travel.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual([
      'moveUp',
      'moveDown',
    ]);
    await act(async () => travel.props.onAccessibilityAction({ nativeEvent: { actionName: 'moveUp' } }));
    expect(onReorder).toHaveBeenCalledWith(DATE, ['t3', 't1', 't4', 't5', 't2']);
    // The top line cannot go higher.
    onReorder.mockClear();
    const top = byLabel(r, 'Travel,')[0];
    await act(async () => top.props.onAccessibilityAction({ nativeEvent: { actionName: 'moveUp' } }));
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('lifts a held line, and confirms with a haptic only when it lands in a new place', async () => {
    const { DraggableLine } = require('./DraggableLine');
    const { haptics } = require('@/lib/haptics');
    const confirm = jest.spyOn(haptics, 'confirm').mockImplementation(() => {});
    const onReorder = jest.fn().mockResolvedValue(undefined);
    const r = render(new Set(), jest.fn(), jest.fn(), onReorder);
    const lineOf = (label: string): ReactTestRenderer['root'] | undefined =>
      r.root
        .findAllByType(DraggableLine)
        .find(
          (l: ReactTestRenderer['root']) =>
            l.findAll((n) => String(n.props.accessibilityLabel ?? '').startsWith(label)).length > 0
        );
    act(() => byLabel(r, 'Travel,')[0].props.onLongPress());
    expect(lineOf('Travel,')!.props.lifted).toBe(true);
    // Let go where it started: nothing is saved, nothing is confirmed.
    await act(async () => lineOf('Travel,')!.props.onEnd());
    expect(onReorder).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
    // Lift again, drag it one line up, let go.
    act(() => byLabel(r, 'Travel,')[0].props.onLongPress());
    act(() => lineOf('Travel,')!.props.onMove(-48));
    await act(async () => lineOf('Travel,')!.props.onEnd());
    expect(onReorder).toHaveBeenCalledWith(DATE, ['t3', 't1', 't4', 't5', 't2']);
    expect(confirm).toHaveBeenCalledTimes(1);
    confirm.mockRestore();
    act(() => r.unmount());
  });

  it('offers no reordering when the screen does not allow it (search, filters)', () => {
    const r = render(new Set());
    expect(byLabel(r, 'Travel,')[0].props.onLongPress).toBeUndefined();
  });
});

describe('TimelineDay with subcategories', () => {
  const withParents = [
    ...categories,
    { id: 'groc', name: 'Groceries', icon: 'cart', color: '#8FE8C8', parentId: null },
    { id: 'flipG', name: 'Flipkart Minutes', icon: 'cart', color: '#8FE8C8', parentId: 'groc' },
  ] as Category[];

  it('names the parent under a subcategory row, so same-named children can be told apart', () => {
    let r!: ReactTestRenderer;
    act(() => {
      r = create(
        <TimelineDay
          date={DATE}
          label="Yesterday"
          dateLabel="25 Sept"
          items={[tx('s1', { categoryId: 'flipG', amountMinor: 21000 })]}
          categories={withParents}
          accountName={(id) => accounts[id] ?? id}
          categoryName={(id) => (id === 'flipG' ? 'Flipkart Minutes' : (names[id ?? ''] ?? ''))}
          onPressTx={jest.fn()}
          openStacks={new Set()}
          onToggleStack={jest.fn()}
        />
      );
    });
    expect(texts(r).map((t) => t.replace(/^false/, ''))).toContain('Groceries · Bank');
    expect(byLabel(r, 'Flipkart Minutes, in Groceries')).toHaveLength(1);
  });
});

it('releases the parent scroll lock when a held day unmounts', () => {
  const onDragActive = jest.fn();
  const r = render(new Set(), jest.fn(), jest.fn(), async () => {}, { onDragActive });
  const row = r.root.findAll((n) => typeof n.props.onLongPress === 'function')[0];
  act(() => row.props.onLongPress());
  expect(onDragActive).toHaveBeenLastCalledWith(true);
  act(() => r.unmount());
  expect(onDragActive).toHaveBeenLastCalledWith(false);
});

it('does not rebuild an unrelated day when another day expands, but refreshes its own expansion', () => {
  const money = require('@/lib/money');
  const format = jest.spyOn(money, 'formatMaskableMoney');
  const props = {
    date: DATE,
    label: 'Today',
    dateLabel: '25 Sept',
    items,
    categories,
    accountName: (id: string) => accounts[id],
    categoryName: (id: string | null) => names[id ?? ''],
    onPressTx: jest.fn(),
    onToggleStack: jest.fn(),
    openStacks: new Set<string>(),
  };
  let tree!: ReactTestRenderer;
  try {
    act(() => {
      tree = create(<TimelineDay {...props} />);
    });
    format.mockClear();
    act(() => tree.update(<TimelineDay {...props} openStacks={new Set(['2026-09-24|expense|food'])} />));
    expect(format).not.toHaveBeenCalled();
    act(() => tree.update(<TimelineDay {...props} openStacks={new Set([`${DATE}|expense|food`])} />));
    expect(format).toHaveBeenCalled();
  } finally {
    act(() => tree.unmount());
    format.mockRestore();
  }
});

describe('days as a feed with a marker rail', () => {
  const day = (over: Partial<React.ComponentProps<typeof TimelineDay>> = {}) => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <TimelineDay
          date={DATE}
          label="Today"
          dateLabel="Fri 25 Sept"
          items={[tx('a', { amountMinor: 10000 }), tx('b', { amountMinor: 5000, categoryId: 'travel' })]}
          categories={categories}
          accountName={(id) => id}
          categoryName={(id) => names[id ?? ''] ?? ''}
          onPressTx={jest.fn()}
          openStacks={new Set()}
          onToggleStack={jest.fn()}
          {...over}
        />
      );
    });
    return tree;
  };
  const withWidth = (fn: () => void) => {
    const dimensions = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ width: 390, height: 800, scale: 3, fontScale: 1 });
    try {
      fn();
    } finally {
      dimensions.mockRestore();
    }
  };

  it('names the day above its entries, with its total, and says them as one heading', () =>
    withWidth(() => {
      const tree = day();
      const shown = texts(tree);
      expect(shown.some((t) => t.startsWith('Today'))).toBe(true);
      expect(shown).toContain(`${formatMoney(15000)} spent`);
      // The marker rail carries the weekday and date number, not the word Today.
      expect(shown).toEqual(expect.arrayContaining(['FRI', '25']));
      expect(shown).not.toContain('TODAY');
      const heading = tree.root.find((n) => n.props.accessibilityRole === 'header');
      expect(heading.props.accessibilityLabel).toBe(`Today, Fri 25 Sept, ${formatMoney(15000)} spent`);
      act(() => tree.unmount());
    }));

  it('puts the day’s entries on a card, not straight on the wallpaper', () =>
    withWidth(() => {
      const tree = day();
      const lane = tree.root.find(
        (n) =>
          typeof n.type === 'string' &&
          StyleSheet.flatten(n.props.style)?.backgroundColor === theme.colors.surface &&
          StyleSheet.flatten(n.props.style)?.borderRadius === theme.radius.xl
      );
      expect(StyleSheet.flatten(lane.props.style)).toMatchObject({
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: theme.colors.borderSoft,
        paddingHorizontal: 14,
      });
      act(() => tree.unmount());
    }));

  it('runs the marker line down to the next day, and ends it on the last and only days', () =>
    withWidth(() => {
      const lines = (position: 'only' | 'first' | 'middle' | 'last') => {
        const tree = day({ position });
        const count = tree.root.findAll((n) => {
          const flat = StyleSheet.flatten(n.props.style);
          return typeof n.type === 'string' && !!flat && flat.width === 2 && flat.flex === 1;
        }).length;
        act(() => tree.unmount());
        return count;
      };
      expect(lines('first')).toBe(1);
      expect(lines('middle')).toBe(1);
      expect(lines('last')).toBe(0);
      expect(lines('only')).toBe(0);
    }));

  it('puts today’s date number in a filled circle', () =>
    withWidth(() => {
      const circle = (today: boolean) => {
        const tree = day({ today });
        const found = tree.root.findAll((n) => {
          const flat = StyleSheet.flatten(n.props.style);
          return !!flat && flat.borderRadius === 17 && flat.backgroundColor === theme.colors.ink;
        }).length;
        act(() => tree.unmount());
        return found;
      };
      expect(circle(true)).toBeGreaterThan(0);
      expect(circle(false)).toBe(0);
    }));

  it('turns the heading of the picked day of the chart bold', () =>
    withWidth(() => {
      const weight = (selected: boolean) => {
        const tree = day({ selected });
        const title = tree.root.findAllByType(Text).find((t) => t.props.children === 'Today')!;
        const flat = StyleSheet.flatten(title.props.style);
        act(() => tree.unmount());
        return flat.fontFamily;
      };
      expect(weight(true)).toBe(theme.font.bodyBold);
      expect(weight(false)).not.toBe(theme.font.bodyBold);
    }));

  it('leaves the day total out when one line would only repeat it', () =>
    withWidth(() => {
      const tree = day({ items: [tx('a', { amountMinor: 10000 })] });
      expect(texts(tree).filter((t) => t === `−${formatMoney(10000)}`)).toHaveLength(1);
      const heading = tree.root.find((n) => n.props.accessibilityRole === 'header');
      expect(heading.props.accessibilityLabel).toBe('Today, Fri 25 Sept');
      act(() => tree.unmount());
    }));

  it('separates rows with a hairline that starts under the icon', () =>
    withWidth(() => {
      const tree = day();
      const separators = tree.root.findAll((n) => {
        const flat = StyleSheet.flatten(n.props.style);
        return !!flat && flat.height === StyleSheet.hairlineWidth && flat.marginLeft === 44;
      });
      expect(separators.length).toBeGreaterThan(0);
      act(() => tree.unmount());
    }));
});
