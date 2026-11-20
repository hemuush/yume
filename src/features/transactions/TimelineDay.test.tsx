/**
 * One Activity day, drawn like Home's Recent activity: one card with the day named inside it and every entry beneath,
 * 2+ entries of a category stack into a line that opens in place; every entry stays tappable (no "+N more").
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text, StyleSheet, View } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
}));

import { createStackStore, type StackStore } from './stackStore';
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
        stacks={createStackStore()}
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

// Bars, rings and the new-entry glow animate (useDrawnValue, JustAddedGlow); fake
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
          stacks={createStackStore()}
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

/** The words of one Text: strings and numbers only, so a nested Text (the date after the day's name) is left to itself. */
function wordsOf(t: { props: { children?: unknown } }): string {
  return [t.props.children]
    .flat(Infinity)
    .filter((c) => typeof c === 'string' || typeof c === 'number')
    .join('');
}

/** An icon font's glyph is a Text of private-use characters: a mark, not a word. */
const isGlyph = (text: string) => /^[\uE000-\uF8FF\u{F0000}-\u{FFFFD}]*$/u.test(text);

function texts(r: ReactTestRenderer): string[] {
  return r.root.findAllByType(Text).map(wordsOf);
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

/** The words inside one row, in order (icons left out): the Pressable named by `label`, not the whole day. */
function rowTexts(r: ReactTestRenderer, label: string): string[] {
  return byLabel(r, label)[0]
    .findAllByType(Text)
    .map(wordsOf)
    .filter((t) => !isGlyph(t));
}

/** A store with some stacks open, that tells `onToggle` which stack was tapped. */
function storeOf(open: Iterable<string>, onToggle: (key: string) => void): StackStore {
  const stacks = createStackStore(open);
  return {
    ...stacks,
    toggle: (key) => {
      onToggle(key);
      stacks.toggle(key);
    },
  };
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
        stacks={storeOf(openStacks, onToggleStack)}
        onReorder={onReorder}
        onDragActive={opts.onDragActive}
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
    expect(all).toContain('−₹250 · +₹500');
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
    expect(all).toContain('−₹50 · +₹500');
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
    expect(all).toContain('−₹250 · +₹500');
    expect(all).toContain('Bank →\u00A0Cash');
    expect(all).toContain('Transfer');
    expect(byLabel(r, '₹3,000 moved from Bank to Cash')).toHaveLength(1);
  });

  it('stacks two Food entries into one closed line', () => {
    const toggle = jest.fn();
    const r = render(new Set(), toggle);
    // The count is the stack's second line, with its one account, like a single entry's.
    expect(texts(r)).toContain('2 entries · Bank');
    expect(rowTexts(r, 'Food, 2 entries, ₹200')).toEqual(['Food', '2', '2 entries · Bank', '−₹200']);
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

  it('shows a stack’s entries only while it is open, in a panel that glides its own height', () => {
    const open = render(new Set([`${DATE}|expense|food`]));
    expect(byLabel(open, 'Food, Lunch').length).toBeGreaterThan(0);
    const panels = open.root.findAll(
      (n) => typeof n.type === 'string' && StyleSheet.flatten(n.props.style)?.overflow === 'hidden'
    );
    expect(panels.length).toBeGreaterThan(0);
    // Neither the panel's entries nor the day use an entering, exiting or layout animation: those leave the list's
    // cell to change height at once, so the rows below jumped. The panel's own height glides instead.
    expect(
      panels[0].findAll((n) => n.props.layout !== undefined || n.props.exiting !== undefined)
    ).toHaveLength(0);
    expect(
      open.root.findAll(
        (n) =>
          typeof n.type === 'string' &&
          n.props.layout !== undefined &&
          StyleSheet.flatten(n.props.style)?.marginTop === 14
      )
    ).toHaveLength(0);
    act(() => open.unmount());
    const closed = render(new Set());
    expect(byLabel(closed, 'Food, Lunch')).toHaveLength(0);
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
          stacks={createStackStore()}
        />
      );
    });
    // The parent is the line under the name, before the account.
    expect(rowTexts(r, 'Flipkart Minutes, in Groceries')).toEqual([
      'Flipkart Minutes',
      'Groceries · Bank',
      '−₹210',
    ]);
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

it('re-renders only the stack that opens: not the day, and not a stack of another day', () => {
  const money = require('@/lib/money');
  const format = jest.spyOn(money, 'formatMaskableMoney');
  const stacks = createStackStore();
  const props = {
    date: DATE,
    label: 'Today',
    dateLabel: '25 Sept',
    items,
    categories,
    accountName: (id: string) => accounts[id],
    categoryName: (id: string | null) => names[id ?? ''],
    onPressTx: jest.fn(),
    stacks,
  };
  let tree!: ReactTestRenderer;
  try {
    act(() => {
      tree = create(<TimelineDay {...props} />);
    });
    format.mockClear();
    // Another day's stack opening changes nothing here.
    act(() => stacks.toggle('2026-09-24|expense|food'));
    expect(format).not.toHaveBeenCalled();
    expect(byLabel(tree, 'Food, Lunch')).toHaveLength(0);
    // This day's own stack opens, and only the stack redraws: the lines beside it are left as they are.
    const singles = format.mock.calls.length;
    act(() => stacks.toggle(`${DATE}|expense|food`));
    expect(byLabel(tree, 'Food, Lunch').length).toBeGreaterThan(0);
    const drawn = format.mock.calls.length - singles;
    format.mockClear();
    act(() => tree.update(<TimelineDay {...props} dateLabel="26 Sept" />));
    // A change to the day itself redraws every line: the stack alone was a fraction of that.
    expect(format.mock.calls.length).toBeGreaterThan(drawn);
  } finally {
    act(() => tree.unmount());
    format.mockRestore();
  }
});

it('does not redraw a day whose list of entries was rebuilt around the very same entries, and does when one changed', () => {
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
    stacks: createStackStore(),
  };
  let tree!: ReactTestRenderer;
  try {
    act(() => {
      tree = create(<TimelineDay {...props} />);
    });
    format.mockClear();
    act(() => tree.update(<TimelineDay {...props} items={[...items]} />));
    expect(format).not.toHaveBeenCalled();
    act(() =>
      tree.update(<TimelineDay {...props} items={[{ ...items[0], amountMinor: 1 }, ...items.slice(1)]} />)
    );
    expect(format).toHaveBeenCalled();
  } finally {
    act(() => tree.unmount());
    format.mockRestore();
  }
});

describe('days as a heading above a card', () => {
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
          stacks={createStackStore()}
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

  it('names the day inside the card, over its entries, with its total, and says them as one heading', () =>
    withWidth(() => {
      const tree = day();
      const shown = texts(tree);
      // The day's name and date, then what it spent, drawn as Home's day heading ("−₹150").
      expect(shown).toContain('Today · Fri 25 Sept');
      expect(shown).toContain(`−${formatMoney(15000)}`);
      // No marker rail beside the day: its weekday and number are in the heading, not repeated at its side.
      expect(shown).not.toContain('FRI');
      expect(shown).not.toContain('25');
      const heading = tree.root.find((n) => n.props.accessibilityRole === 'header');
      expect(heading.props.accessibilityLabel).toBe(`Today, Fri 25 Sept, ${formatMoney(15000)} spent`);
      act(() => tree.unmount());
    }));

  it('names today and yesterday alone, as Home does, when the date is left out of the heading', () =>
    withWidth(() => {
      const tree = day({ dateInHeading: false });
      expect(texts(tree)).toContain('Today');
      expect(texts(tree).some((t) => t.includes('Fri 25 Sept'))).toBe(false);
      // The date is still read out with the heading.
      expect(
        tree.root.find((n) => n.props.accessibilityRole === 'header').props.accessibilityLabel
      ).toContain('Fri 25 Sept');
      act(() => tree.unmount());
    }));

  it('draws the date and its entries in one card that leaves room for a lifted row', () =>
    withWidth(() => {
      const tree = day();
      const lane = tree.root.find(
        (n) =>
          typeof n.type === 'string' &&
          StyleSheet.flatten(n.props.style)?.marginHorizontal === 16 &&
          StyleSheet.flatten(n.props.style)?.borderWidth === StyleSheet.hairlineWidth
      );
      // The same section and the same 2 dp margin as Home's Recent activity (the rows keep their own 14 dp inset, so
      // their content sits on the 16 dp gutter): the paper itself between two hairlines, no fill and no rounded box.
      // It does not clip, so a lifted line's shadow is not cut off.
      expect(StyleSheet.flatten(lane.props.style)).toMatchObject({
        marginHorizontal: 16,
        backgroundColor: theme.colors.home.surface,
        borderColor: theme.colors.borderSoft,
        overflow: 'visible',
      });
      expect(StyleSheet.flatten(lane.props.style).borderRadius).toBe(theme.radius.lg);
      expect(lane.findAll((n) => n.props.accessibilityRole === 'header').length).toBeGreaterThan(0);
      act(() => tree.unmount());
    }));

  it('uses Home’s row: a 40 dp disc in a 44 dp slot, a 56 dp least height, 14 dp of side padding', () =>
    withWidth(() => {
      const tree = day();
      const styles = tree.root
        .findAll((n) => typeof n.type === 'string')
        .map((n) => StyleSheet.flatten(n.props.style) ?? {});
      expect(styles.some((s) => s.width === 44 && s.alignItems === 'center')).toBe(true);
      expect(styles.some((s) => s.width === 40 && s.height === 40)).toBe(true);
      expect(styles.some((s) => s.minHeight === 56 && s.paddingHorizontal === 14)).toBe(true);
      act(() => tree.unmount());
    }));

  it('has no marker line beside the day: the card runs the full width', () =>
    withWidth(() => {
      const tree = day();
      const rail = tree.root.findAll((n) => {
        const flat = StyleSheet.flatten(n.props.style);
        return typeof n.type === 'string' && !!flat && flat.width === 2 && flat.flex === 1;
      });
      expect(rail).toHaveLength(0);
      act(() => tree.unmount());
    }));

  it('sits the picked day of the chart on a soft tint, and leaves the others plain', () =>
    withWidth(() => {
      const tint = (selected: boolean) => {
        const tree = day({ selected });
        const heading = tree.root.find(
          (n) => typeof n.type === 'string' && n.props.accessibilityRole === 'header'
        );
        const flat = StyleSheet.flatten(heading.props.style);
        act(() => tree.unmount());
        return flat.backgroundColor;
      };
      expect(tint(true)).toEqual(expect.any(String));
      expect(tint(false)).toBeUndefined();
    }));

  it('says a day of only transfers by how many there were, and draws spending and money in as signed figures', () =>
    withWidth(() => {
      const move = (id: string) => tx(id, { type: 'transfer', categoryId: null, toAccountId: 'cash' });
      const two = day({ items: [move('m1'), move('m2')] });
      expect(texts(two)).toContain('2 transfers');
      expect(two.root.find((n) => n.props.accessibilityRole === 'header').props.accessibilityLabel).toBe(
        'Today, Fri 25 Sept, 2 transfers'
      );
      act(() => two.unmount());
      // One transfer alone would only repeat its own row.
      const one = day({ items: [move('m1')] });
      expect(one.root.find((n) => n.props.accessibilityRole === 'header').props.accessibilityLabel).toBe(
        'Today, Fri 25 Sept'
      );
      act(() => one.unmount());

      const mixed = day({
        items: [
          tx('a', { amountMinor: 10000 }),
          tx('b', { type: 'income', categoryId: 'salary', amountMinor: 5000 }),
        ],
      });
      expect(texts(mixed)).toContain(`−${formatMoney(10000)} · +${formatMoney(5000)}`);
      // Spoken without the sign: a screen reader says "in", not "plus".
      expect(mixed.root.find((n) => n.props.accessibilityRole === 'header').props.accessibilityLabel).toBe(
        `Today, Fri 25 Sept, ${formatMoney(10000)} spent · ${formatMoney(5000)} in`
      );
      act(() => mixed.unmount());
    }));

  describe('a row', () => {
    const labelled = (items: Transaction[]) => {
      const tree = day({ items });
      return { tree, row: (label: string) => rowTexts(tree, label) };
    };

    it('leads with its note and puts "category · account" under it, the amount alone at the right', () =>
      withWidth(() => {
        const { tree, row } = labelled([tx('a', { note: 'Lunch', amountMinor: 20000 })]);
        expect(row('Food, Lunch')).toEqual(['Lunch', 'Food · bank', `−${formatMoney(20000)}`]);
        act(() => tree.unmount());
      }));

    it('has the account alone under the category when there is no note', () =>
      withWidth(() => {
        const { tree, row } = labelled([tx('a', { amountMinor: 20000 })]);
        expect(row('Food,')).toEqual(['Food', 'bank', `−${formatMoney(20000)}`]);
        act(() => tree.unmount());
      }));

    it('never lets an amount shrink: not to fit, and not as a child of a column, in a row or in an open group', () => {
      // On a phone an amount that shrinks to fit, inside a column that shrinks, was drawn a few dp tall in an open
      // group. The amounts sit directly in their line, drawn at their own size, as on Home.
      const open = render(new Set([`${DATE}|expense|food`]));
      const amounts = open.root.findAllByType(Text).filter((t) => /^[−+]₹/.test(wordsOf(t)));
      expect(amounts.length).toBeGreaterThan(3);
      for (const amount of amounts) {
        expect(amount.props.adjustsFontSizeToFit).toBeFalsy();
        expect(StyleSheet.flatten(amount.props.style).flexShrink).toBeUndefined();
        let parent = amount.parent;
        while (parent && typeof parent.type !== 'string') parent = parent.parent;
        expect(StyleSheet.flatten(parent!.props.style).flexDirection).toBe('row');
      }
      act(() => open.unmount());
    });

    it('writes money in green with a plus, spending and a transfer in ink, a transfer with no sign', () =>
      withWidth(() => {
        const { tree } = labelled([
          tx('a', { amountMinor: 1000 }),
          tx('b', { type: 'income', categoryId: 'salary', amountMinor: 2000 }),
          tx('c', { type: 'transfer', categoryId: null, toAccountId: 'cash', amountMinor: 3000 }),
        ]);
        const colour = (words: string) =>
          StyleSheet.flatten(tree.root.findAllByType(Text).find((t) => wordsOf(t) === words)!.props.style)
            .color;
        expect(colour(`−${formatMoney(1000)}`)).toBe(theme.colors.textPrimary);
        expect(colour(`+${formatMoney(2000)}`)).toBe(theme.colors.incomeText);
        expect(colour(formatMoney(3000))).toBe(theme.colors.textPrimary);
        act(() => tree.unmount());
      }));
  });

  it('leaves the day total out when one line would only repeat it', () =>
    withWidth(() => {
      const tree = day({ items: [tx('a', { amountMinor: 10000 })] });
      expect(texts(tree).filter((t) => t === `−${formatMoney(10000)}`)).toHaveLength(1);
      const heading = tree.root.find((n) => n.props.accessibilityRole === 'header');
      expect(heading.props.accessibilityLabel).toBe('Today, Fri 25 Sept');
      act(() => tree.unmount());
    }));

  it('insets a hairline to the text column between entries', () =>
    withWidth(() => {
      const tree = day();
      const separators = tree.root.findAll((n) => {
        const flat = StyleSheet.flatten(n.props.style);
        return (
          !!flat &&
          flat.height === StyleSheet.hairlineWidth &&
          flat.backgroundColor === theme.colors.home.edge &&
          flat.marginLeft > 44
        );
      });
      expect(separators.length).toBeGreaterThan(0);
      act(() => tree.unmount());
    }));
});

describe('how a day’s lines move', () => {
  const render = (rows: Transaction[]) => {
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <TimelineDay
          date={DATE}
          label="Today"
          dateLabel="25 Sept"
          items={rows}
          categories={categories}
          accountName={(id) => id}
          categoryName={(id) => names[id ?? ''] ?? ''}
          onPressTx={jest.fn()}
          stacks={createStackStore()}
        />
      );
    });
    return tree;
  };
  // In the test double a row's `layout` prop is set exactly when the row is given its slide into place.
  const sliding = (tree: ReactTestRenderer) =>
    tree.root.findAllByType(View).filter((v) => v.props.layout !== undefined);
  const food = [tx('f1', { categoryId: 'food' }), tx('f2', { categoryId: 'food' })];
  const others = [tx('t', { categoryId: 'travel' }), tx('s', { type: 'income', categoryId: 'salary' })];

  it('slides its lines into place when an entry above them comes or goes', () => {
    const tree = render(others);
    expect(sliding(tree)).toHaveLength(2);
    act(() => tree.unmount());
  });

  it('does not slide the lines of a day that holds a group, which would trail the panel as it opens', () => {
    // The panel changes height every frame; a line below it that slid towards each new position would always be
    // a few frames behind the panel's edge, overlapping it as it opens and leaving a gap as it closes.
    const tree = render([...food, ...others]);
    expect(sliding(tree)).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('lets the whole day leave without each of its lines playing an exit first', () => {
    const tree = render([...food, ...others]);
    const config = tree.root.findAll((n) => n.props.skipExiting === true);
    expect(config).toHaveLength(1);
    // Every line that has an exit animation is inside it, so none of them runs when the day itself is removed.
    const exiting = (root: { findAllByType: typeof tree.root.findAllByType }) =>
      root.findAllByType(View).filter((v) => v.props.exiting !== undefined).length;
    expect(exiting(config[0])).toBeGreaterThan(0);
    expect(exiting(config[0])).toBe(exiting(tree.root));
    act(() => tree.unmount());
  });
});
