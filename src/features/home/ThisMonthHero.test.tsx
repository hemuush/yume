/**
 * Home's month card: the free-to-use headline with income and carry-over under it, chips for the spent
 * share, today and bills still to pay, the Add buttons, and stepping the period. All figures are made up.
 */
import { Text, StyleSheet } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Circle } from 'react-native-svg';
import { theme } from '@/constants/theme';
// The allowance and the day tick read the date: fix it (22 October, 9 days left) so the figures are steady.
beforeAll(() => {
  jest.useFakeTimers({
    now: new Date(2026, 9, 22, 12),
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'queueMicrotask',
      'performance',
      'hrtime',
    ],
  });
});
afterAll(() => jest.useRealTimers());
jest.mock('@expo/vector-icons/Feather', () => () => null);
jest.mock('@expo/vector-icons/MaterialCommunityIcons', () => () => null);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#A6B4F2', secondary: '#8FE8C8' }),
}));
// Amounts show their value straight away, without counting up.
jest.mock('@/components/CountUpAmount', () => {
  const { Text: T } = require('react-native');
  const { formatMoney } = require('@/lib/money');
  return { CountUpAmount: ({ minor }: { minor: number }) => <T>{formatMoney(minor)}</T> };
});
jest.mock('@/components/LimitMeter', () => ({ LimitMeter: () => null }));

import { ThisMonthHero } from './ThisMonthHero';

const texts = (r: ReactTestRenderer) =>
  r.root.findAllByType(Text).map((t) =>
    [t.props.children]
      .flat(Infinity)
      .filter((c) => typeof c === 'string')
      .join('')
  );
const byLabel = (r: ReactTestRenderer, start: string) =>
  r.root.find(
    (n) =>
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith(start) &&
      typeof n.props.onPress === 'function'
  );

function hero(over: Partial<React.ComponentProps<typeof ThisMonthHero>> = {}) {
  const today = 'today' in over ? over.today : { spentMinor: 204_500, goalMinor: 500_000 };
  return (
    <ThisMonthHero
      periodKey="month:0"
      direction={0}
      canStepForward={false}
      onStep={jest.fn()}
      incomeMinor={19_605_600}
      spentMinor={9_576_200}
      savingsMinor={9_950_000}
      surplusMinor={79_400}
      dueMinor={0}
      today={today}
      spendingTrend={
        today
          ? {
              daily: [{ date: '2026-10-22', totalMinor: today.spentMinor }],
              today: '2026-10-22',
              mode: 'week',
            }
          : null
      }
      pace={{ projectedMinor: 10_370_000, byLabel: '30 Sept' }}
      {...over}
    />
  );
}

function render(over: Partial<React.ComponentProps<typeof ThisMonthHero>> = {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(hero(over));
  });
  return r;
}

describe('month card', () => {
  it('explains the daily limit without refilling it from refunds', () => {
    const r = render({ today: { spentMinor: 27000, goalMinor: 50000 } });
    const action = byLabel(r, 'How today’s allowance');
    expect(action.props.accessibilityState.expanded).toBe(false);
    act(() => action.props.onPress());
    expect(texts(r)).toContain('Daily limit');
    expect(texts(r)).toContain('Expenses today');
    expect(texts(r)).toContain('Refunds and income do not refill your daily limit. Transfers are excluded.');
    expect(texts(r)).toContain('₹230 left');
  });

  it('leads with what is free to use, what it is out of, and what is left today as a chip', () => {
    const r = render();
    const all = texts(r);
    expect(all).toEqual(
      expect.arrayContaining([
        'Free to use',
        '₹794',
        'after spending and savings',
        'Add expense',
        'Income',
        'Transfer',
      ])
    );
    // The money-bar legend stays scoped to this month.
    expect(all).toEqual(expect.arrayContaining(['Spent', 'Saved', 'Free', '₹95,762', '₹99,500']));
    expect(
      r.root.findAll((n) => n.props.accessibilityLabel === 'Spent, ₹95,762, 49%').length
    ).toBeGreaterThan(0);
    expect(
      r.root.findAll((n) => n.props.accessibilityLabel === 'Saved, ₹99,500, 51%').length
    ).toBeGreaterThan(0);
    expect(all).not.toContain('49%');
    expect(all).not.toContain('Bills left');
    expect(all).toContain('₹2,955 left');
    expect(byLabel(r, 'How this adds up')).toBeDefined();
    // Free to use is said once, as the headline.
    expect(all.filter((t) => t === 'Free to use')).toHaveLength(1);
    // The shares are in the bar and the tray, not a chip; the pace waits under Details.
    expect(all.some((t) => t.endsWith('% spent'))).toBe(false);
    expect(all.some((t) => t.startsWith('On pace'))).toBe(false);
  });

  it('draws the ring from the month’s money only, with no second ring for how far through the month it is', () => {
    // 22 October is in the current month: the ring once drew a black arc for 22 of 31 days, which nothing explained.
    const strokes = render()
      .root.findAllByType(Circle)
      .map((c) => c.props.stroke);
    expect(strokes.length).toBeGreaterThan(0);
    expect(strokes).not.toContain(theme.colors.ink);
    expect(strokes).not.toContain(theme.colors.divider);
  });

  it('puts the pace, a spending forecast, under Details', () => {
    const r = render();
    act(() => byLabel(r, 'How this adds up').props.onPress());
    const all = texts(r);
    expect(all.some((t) => t.startsWith('On pace by '))).toBe(true);
    expect(all.some((t) => t.startsWith('about ₹'))).toBe(true);
  });

  it('says how far over the daily goal today is', () => {
    const all = texts(render({ today: { spentMinor: 600_000, goalMinor: 500_000 } }));
    expect(all).toEqual(expect.arrayContaining(['Today', '₹6,000', '₹1,000 over']));
  });

  it('says when more went out than came in', () => {
    const all = texts(
      render({ incomeMinor: 5_000_000, spentMinor: 6_000_000, savingsMinor: 0, surplusMinor: -1_000_000 })
    );
    expect(all).toEqual(expect.arrayContaining(['Over by', '₹10,000']));
    expect(all.filter((t) => t.includes('more went out than came in'))).toHaveLength(1);
    expect(all.some((t) => t.endsWith('% spent'))).toBe(false);
  });

  it('steps the period from a screen reader, never past the newest', () => {
    const onStep = jest.fn();
    const r = render({ onStep });
    const figure = r.root.find((n) => typeof n.props.onAccessibilityAction === 'function');
    expect(figure.props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['decrement']);
    act(() => figure.props.onAccessibilityAction({ nativeEvent: { actionName: 'decrement' } }));
    act(() => figure.props.onAccessibilityAction({ nativeEvent: { actionName: 'increment' } }));
    expect(onStep.mock.calls).toEqual([[-1]]);
  });
});

describe('month card with bills still to pay', () => {
  // ₹1,00,000 income, ₹10,000 spent, ₹30,000 set aside → ₹60,000 free; ₹20,000 still to pay → ₹40,000 after
  // bills.
  const base = {
    incomeMinor: 10_000_000,
    spentMinor: 1_000_000,
    savingsMinor: 3_000_000,
    surplusMinor: 6_000_000,
    dueMinor: 2_000_000,
  };

  it('takes bills off the headline and shows them in the legend', () => {
    const all = texts(render(base));
    expect(all).toEqual(
      expect.arrayContaining([
        'Free after bills',
        '₹40,000',
        'after spending, savings and bills',
        'Bills left',
        '₹20,000',
      ])
    );
    expect(all).not.toContain('Free to use');
  });

  it('opens the sum from Bills left, and closes it again', () => {
    const r = render(base);
    expect(texts(r)).not.toContain('After bills');
    act(() => byLabel(r, 'Bills left, ₹20,000').props.onPress());
    expect(texts(r)).toEqual(
      expect.arrayContaining([
        'Income',
        '₹1,00,000',
        '−₹10,000',
        'Set aside',
        '−₹30,000',
        'Free to use',
        '₹60,000',
      ])
    );
    expect(texts(r)).toEqual(expect.arrayContaining(['Still to pay', '−₹20,000', 'After bills', '₹40,000']));
    act(() => byLabel(r, 'Bills left, ₹20,000').props.onPress());
    expect(texts(r)).not.toContain('After bills');
  });

  it('puts a picked slice in the headline, and puts free back when it is picked again', () => {
    const { haptics } = require('@/lib/haptics');
    haptics.tap.mockClear();
    const r = render({ dueMinor: 2_000_000 });
    expect(texts(r)).toContain('Short after bills');
    // From the legend: spent, then the same slice again.
    act(() => byLabel(r, 'Spent, ₹').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['Spent this month', '₹95,762']));
    expect(texts(r).some((t) => t.endsWith('of what you had to spend'))).toBe(true);
    expect(texts(r)).not.toContain('Short after bills');
    act(() => byLabel(r, 'Spent, ₹').props.onPress());
    expect(texts(r)).toContain('Short after bills');
    // Another slice, from the legend.
    act(() => byLabel(r, 'Saved, ₹').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['Saved this month', '₹99,500']));
    expect(haptics.tap).toHaveBeenCalledTimes(3);
    expect(r.root.find((n) => n.props.accessibilityRole === 'image').props.accessibilityLabel).toMatch(
      /^Where the month went/
    );
    act(() => r.unmount());
  });

  it('shows what bills are still to pay when that slice is picked, and clears a pick when the month turns', () => {
    const r = render({ dueMinor: 2_000_000 });
    act(() => byLabel(r, 'Bills left, ₹').props.onPress());
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Bills still to pay', '₹20,000', 'before the month ends'])
    );
    act(() => r.update(hero({ dueMinor: 2_000_000, periodKey: 'month:-1' })));
    expect(texts(r)).not.toContain('Bills still to pay');
    act(() => r.unmount());
  });

  it('never offers the saved slice while savings are hidden', () => {
    mockHideAmounts = true;
    try {
      const r = render({ dueMinor: 2_000_000 });
      expect(r.root.findAll((n) => String(n.props.accessibilityLabel).startsWith('Saved, ')).length).toBe(0);
      act(() => r.unmount());
    } finally {
      mockHideAmounts = false;
    }
  });

  it('says short when the bills are more than what is free', () => {
    const all = texts(render({ ...base, dueMinor: 7_000_000 }));
    expect(all).toEqual(expect.arrayContaining(['Short after bills', '-₹10,000', '₹70,000']));
  });

  it('is the plain Free to use card when nothing is due', () => {
    const all = texts(render({ ...base, dueMinor: 0 }));
    expect(all).toEqual(expect.arrayContaining(['Free to use', '₹60,000', 'after spending and savings']));
    expect(all.some((t) => t.includes('still to pay'))).toBe(false);
  });

  it('hides the set-aside amount in the sum when savings are hidden', () => {
    mockHideAmounts = true;
    try {
      const r = render(base);
      act(() => byLabel(r, 'Bills left, ₹20,000').props.onPress());
      const all = texts(r).join(' | ');
      expect(all).toContain('Set aside');
      expect(all).not.toContain('30,000');
      expect(all).toContain('₹••••');
    } finally {
      mockHideAmounts = false;
    }
  });
});

describe('month card with savings hidden', () => {
  // 10% spent, 60% to savings, 30% free — round numbers so the figures are easy to spot.
  const hidden = {
    incomeMinor: 10_000_000,
    spentMinor: 1_000_000,
    savingsMinor: 6_000_000,
    surplusMinor: 3_000_000,
  };
  const labels = (r: ReactTestRenderer) =>
    r.root
      .findAll((n) => typeof n.props.accessibilityLabel === 'string')
      .map((n) => n.props.accessibilityLabel as string);

  beforeEach(() => {
    mockHideAmounts = true;
  });
  afterEach(() => {
    mockHideAmounts = false;
  });

  it('keeps the free headline, and never says what was saved', () => {
    const all = texts(render(hidden));
    expect(all).toEqual(expect.arrayContaining(['Free to use', '₹30,000', 'Spent']));
    expect(all).not.toContain('Saved');
  });

  it('never prints or reads out the amount that went to savings', () => {
    const r = render(hidden);
    const everything = [...texts(r), ...labels(r)].join(' | ');
    expect(everything).not.toContain('60,000');
    expect(everything).not.toMatch(/savings|kept/i);
  });

  it('still says when more went out than came in', () => {
    const all = texts(
      render({ incomeMinor: 5_000_000, spentMinor: 6_000_000, savingsMinor: 0, surplusMinor: -1_000_000 })
    );
    expect(all).toContain('Over by');
  });
});

describe('month card with no income', () => {
  it('keeps its footer as tall as the populated card’s, so the caption does not sit on the card’s edge', () => {
    const r = render({ incomeMinor: 0, spentMinor: 0, savingsMinor: 0, surplusMinor: 0 });
    const caption = r.root.findAll(
      (n) => n.type === Text && [n.props.children].flat().join('') === 'Add income to see what is free'
    )[0];
    let footer = caption.parent;
    while (footer && !StyleSheet.flatten(footer.props.style)?.borderTopWidth) footer = footer.parent;
    expect(StyleSheet.flatten(footer!.props.style).minHeight).toBeGreaterThanOrEqual(44);
  });

  it('asks for income instead of showing a figure', () => {
    const all = texts(render({ incomeMinor: 0, spentMinor: 0, savingsMinor: 0, surplusMinor: 0 }));
    expect(all).toEqual(expect.arrayContaining(['Free to use', '—', 'Add income to see what is free']));
  });
});

describe('month card with money carried over from earlier months', () => {
  // ₹1,00,000 income, ₹10,000 spent, ₹30,000 set aside, ₹20,000 carried in → ₹80,000 free.
  const base = {
    incomeMinor: 10_000_000,
    spentMinor: 1_000_000,
    savingsMinor: 3_000_000,
    surplusMinor: 8_000_000,
    carryMinor: 2_000_000,
  };

  it('says what the figure is out of, income and what carried over together, without double counting it', () => {
    const all = texts(render(base));
    expect(all).toEqual(expect.arrayContaining(['Free to use', '₹80,000', 'after spending and savings']));
  });

  it('shows the carried amount as its own line in the sum', () => {
    const r = render({ ...base, dueMinor: 2_000_000 });
    act(() => byLabel(r, 'Bills left, ₹20,000').props.onPress());
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Carried over', '+₹20,000', 'Free to use', '₹80,000', 'After bills', '₹60,000'])
    );
  });

  it('carries a shortfall as a minus in the sum, and leaves the amount out of the caption', () => {
    const r = render({ ...base, carryMinor: -1_000_000, surplusMinor: 5_000_000 });
    // A carried shortfall only lowers the headline: it is not part of what the figure is "out of".
    expect(texts(r)).toContain('after spending and savings');
    act(() => byLabel(r, 'How this adds up').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['Carried over', '−₹10,000']));
  });

  it('says nothing about it when nothing carried over', () => {
    const all = texts(render({ ...base, carryMinor: 0, surplusMinor: 6_000_000 }));
    expect(all.join(' ')).not.toContain('carried over');
  });
});

describe('month card with savings withdrawals and carried shortfalls', () => {
  const withdrawn = {
    incomeMinor: 100_000,
    spentMinor: 150_000,
    savingsMinor: -100_000,
    carryMinor: 0,
    surplusMinor: 50_000,
  };

  it('keeps the actual free balance when a withdrawal funds spending beyond income', () => {
    const all = texts(render(withdrawn));
    expect(all).toEqual(expect.arrayContaining(['Free to use', '₹500']));
    expect(all).not.toContain('Over by');
  });

  it('deducts outstanding bills once from a savings-funded balance', () => {
    const r = render({ ...withdrawn, dueMinor: 20_000 });
    expect(texts(r)).toEqual(expect.arrayContaining(['Free after bills', '₹300']));
    act(() => byLabel(r, 'How this adds up').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['Free to use', '₹500', 'After bills', '₹300']));
  });

  it('reports the actual remaining deficit after a smaller withdrawal', () => {
    const all = texts(render({ ...withdrawn, savingsMinor: -20_000, surplusMinor: -30_000 }));
    expect(all).toEqual(expect.arrayContaining(['Over by', '₹300']));
    expect(all).not.toContain('₹500');
  });

  it('includes a carried shortfall in the overspent headline', () => {
    const all = texts(render({ ...withdrawn, savingsMinor: 0, carryMinor: -20_000, surplusMinor: -70_000 }));
    expect(all).toEqual(expect.arrayContaining(['Over by', '₹700']));
    expect(all).not.toContain('₹500');
  });

  it('keeps a savings-funded balance usable when savings are hidden', () => {
    mockHideAmounts = true;
    try {
      const all = texts(render(withdrawn));
      expect(all).toEqual(expect.arrayContaining(['Free to use', '₹500', 'after deductions']));
      expect(all).not.toContain('Over by');
      expect(all.join(' ')).not.toMatch(/savings/i);
    } finally {
      mockHideAmounts = false;
    }
  });
});

describe('month card when bills change without the period changing', () => {
  it('never shows a short state for a month whose figures have not landed yet', () => {
    // Same period key: Home keeps the old month on screen while the next one
    // loads, so a change to the bills figure alone must still add up.
    const props = {
      incomeMinor: 10_000_000,
      spentMinor: 1_000_000,
      savingsMinor: 0,
      surplusMinor: 9_000_000,
    };
    const r = render({ ...props, dueMinor: 0 });
    expect(texts(r)).toContain('Free to use');
    act(() => {
      r.update(
        <ThisMonthHero
          periodKey="month:0"
          direction={0}
          canStepForward={false}
          onStep={jest.fn()}
          {...props}
          dueMinor={2_000_000}
        />
      );
    });
    const all = texts(r);
    expect(all).not.toContain('Short after bills');
    expect(all).toContain('Free after bills');
  });
});

it('omits zero bills from the summary', () => {
  const r = render({ dueMinor: 0 });
  expect(texts(r)).not.toContain('Bills left');
});

describe('month card: how this adds up', () => {
  const open = (r: ReactTestRenderer) => act(() => byLabel(r, 'How this adds up').props.onPress());

  it('opens the sum from the link, with no bills due, and closes it again', () => {
    const r = render();
    expect(texts(r)).not.toContain('Set aside');
    open(r);
    expect(texts(r)).toEqual(
      expect.arrayContaining([
        'Income',
        '₹1,96,056',
        'Spent',
        '−₹95,762',
        'Set aside',
        '−₹99,500',
        'Free to use',
      ])
    );
    // No bills due: no bills lines.
    expect(texts(r)).not.toContain('Still to pay');
    expect(texts(r)).not.toContain('After bills');
    open(r);
    expect(texts(r)).not.toContain('Set aside');
  });

  it('is the same sum, with the bills lines, whether opened from the link or the bills chip', () => {
    const r = render({ dueMinor: 2_000_000 });
    open(r);
    expect(texts(r)).toEqual(expect.arrayContaining(['Still to pay', '−₹20,000', 'After bills']));
    // The chip toggles the same sum.
    act(() => byLabel(r, 'Bills left, ₹20,000').props.onPress());
    expect(texts(r)).not.toContain('After bills');
  });

  it('reports its state to a screen reader', () => {
    const r = render();
    expect(byLabel(r, 'How this adds up').props.accessibilityState).toEqual({ expanded: false });
    open(r);
    expect(byLabel(r, 'How this adds up').props.accessibilityState).toEqual({ expanded: true });
  });

  it('never shows the amount that went to savings when savings are hidden', () => {
    mockHideAmounts = true;
    try {
      const r = render();
      open(r);
      const all = texts(r).join(' | ');
      expect(all).toContain('Set aside');
      expect(all).not.toContain('99,500');
      expect(all).toContain('₹••••');
    } finally {
      mockHideAmounts = false;
    }
  });

  it('is not there when there is no income to add up', () => {
    const r = render({ incomeMinor: 0, spentMinor: 0, savingsMinor: 0, surplusMinor: 0 });
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'How this adds up')).toHaveLength(0);
  });

  it('still adds up when more went out than came in', () => {
    const r = render({
      incomeMinor: 5_000_000,
      spentMinor: 6_000_000,
      savingsMinor: 0,
      surplusMinor: -1_000_000,
    });
    open(r);
    expect(texts(r)).toEqual(
      expect.arrayContaining(['Income', '₹50,000', 'Spent', '−₹60,000', 'Free to use'])
    );
  });
});

describe('month card: today and the free figure', () => {
  const expanded = (over: Partial<React.ComponentProps<typeof ThisMonthHero>> = {}) => {
    const r = render(over);
    act(() => byLabel(r, 'How this adds up').props.onPress());
    return r;
  };
  it('says the free figure once, in the headline, with no second "free" label', () => {
    expect(texts(render()).some((t) => t.endsWith(' free'))).toBe(false);
  });

  it('says what is left of the daily goal, and none left once it is spent', () => {
    expect(texts(expanded({ today: { spentMinor: 0, goalMinor: 500_000 } }))).toContain('No spending');
    expect(texts(expanded({ today: { spentMinor: 250_000, goalMinor: 500_000 } }))).toContain('₹2,500 left');
    expect(texts(expanded({ today: { spentMinor: 500_000, goalMinor: 500_000 } }))).toContain('₹0 left');
  });

  it('says a day far over the goal was a big day, not a slip', () => {
    expect(texts(expanded({ today: { spentMinor: 5_000_000, goalMinor: 500_000 } }))).toContain('A big day');
    expect(texts(expanded({ today: { spentMinor: 600_000, goalMinor: 500_000 } }))).toContain('₹1,000 over');
  });
});

describe('month card: what can be spent a day', () => {
  it('shows the days left and a day’s allowance for the current month', () => {
    // ₹794 free over the 9 days after 22 October.
    const r = render();
    expect(texts(r)).toContain('₹88 a day');
    expect(
      r.root.findAll((n) => n.props.accessibilityLabel === '9 days left, about ₹88 a day').length
    ).toBeGreaterThan(0);
  });
  it('is left out of a past month, a month over its income, and one with nothing free', () => {
    expect(texts(render({ periodKey: 'month:-1' })).some((t) => t.includes('a day'))).toBe(false);
    expect(texts(render({ periodKey: 'month:-1' }))).not.toContain('22');
    expect(
      texts(render({ spentMinor: 25_000_000, savingsMinor: 0, surplusMinor: -5_395_000 })).some((t) =>
        t.includes('a day')
      )
    ).toBe(false);
    expect(texts(render({ surplusMinor: 0 })).some((t) => t.includes('a day'))).toBe(false);
  });
});

it('omits Bills left when a period has no current bill estimate', () => {
  const r = render({ periodKey: 'month:-1', dueMinor: null });
  expect(texts(r)).not.toContain('Bills left');
  act(() => byLabel(r, 'How this adds up').props.onPress());
  expect(texts(r)).not.toContain('Still to pay');
  act(() => r.unmount());
});

it('keeps every ready recap available from the calculation disclosure', () => {
  const month = jest.fn(),
    week = jest.fn();
  const r = render({
    recaps: [
      { key: 'month', label: 'September', onPress: month },
      { key: 'week', label: '12–18 Oct', onPress: week },
    ],
  });
  expect(r.root.findAll((n) => n.props.accessibilityLabel === 'View September recap')).toHaveLength(0);
  act(() => byLabel(r, 'How this adds up').props.onPress());
  act(() => byLabel(r, 'View September recap').props.onPress());
  act(() => byLabel(r, 'View 12–18 Oct recap').props.onPress());
  expect(month).toHaveBeenCalledTimes(1);
  expect(week).toHaveBeenCalledTimes(1);
});

it('keeps the week card and insights attached to the displayed period', () => {
  const onSeeInsights = jest.fn();
  const r = render({ spendingTrend: { daily: [], today: '2026-10-20' }, onSeeInsights });
  const { SpendBars } = require('./SpendBars');
  expect(r.root.findAllByType(SpendBars)).toHaveLength(1);
  act(() => byLabel(r, 'Insights — This week').props.onPress());
  expect(onSeeInsights).toHaveBeenLastCalledWith('month:0');
  act(() => r.update(hero({ periodKey: 'month:-1', spendingTrend: null, onSeeInsights })));
  expect(r.root.findAllByType(SpendBars)).toHaveLength(0);
  act(() => byLabel(r, 'See spending insights').props.onPress());
  expect(onSeeInsights).toHaveBeenLastCalledWith('month:-1');
  act(() => r.unmount());
});

describe('the ring in the middle of the card', () => {
  const { HeroLegend } = require('./HeroLegend');
  const { MonthRing } = require('./MonthRing');
  const withScreen = (size: { width: number; fontScale: number }, fn: () => void) => {
    const spy = jest
      .spyOn(require('react-native'), 'useWindowDimensions')
      .mockReturnValue({ ...size, height: 900, scale: 3 });
    try {
      fn();
    } finally {
      spy.mockRestore();
    }
  };

  it('splits the legend into two halves on either side of the ring, so the ring is centred', () =>
    withScreen({ width: 412, fontScale: 1 }, () => {
      const r = render({ dueMinor: 10_000 });
      const legends = r.root.findAllByType(HeroLegend);
      expect(legends.map((l) => l.props.side)).toEqual(['left', 'right']);
      // Four slices (spent, saved, bills left, free): two on each side, so the halves are equal.
      expect(legends.map((l) => (l.props.items as unknown[]).length)).toEqual([2, 2]);
      // The ring sits between them in the row.
      const row = r.root.findByType(MonthRing).parent!;
      const order = row.children
        .filter((c) => typeof c !== 'string')
        .map((c) => (typeof c !== 'string' && c.type === MonthRing ? 'ring' : 'legend'));
      expect(order).toEqual(['legend', 'ring', 'legend']);
      act(() => r.unmount());
    }));

  it('keeps the legend whole (still tappable) across the two halves', () =>
    withScreen({ width: 412, fontScale: 1 }, () => {
      const r = render({ dueMinor: 10_000 });
      for (const label of ['Spent, ₹', 'Saved, ₹', 'Bills left, ₹']) {
        expect(byLabel(r, label)).toBeTruthy();
      }
      act(() => r.unmount());
    }));

  it('centres the ring on its own line and drops the legend under it on a narrow phone or at large text', () => {
    for (const size of [
      { width: 360, fontScale: 1 },
      { width: 412, fontScale: 1.3 },
    ]) {
      withScreen(size, () => {
        const r = render({ dueMinor: 10_000 });
        const legends = r.root.findAllByType(HeroLegend);
        expect(legends).toHaveLength(1);
        expect(legends[0].props.side).toBeUndefined();
        expect((legends[0].props.items as unknown[]).length).toBe(4);
        act(() => r.unmount());
      });
    }
  });

  it('lets a big figure shrink to fit its half of the legend rather than being cut off', () =>
    withScreen({ width: 412, fontScale: 1 }, () => {
      // The shared Text only shrinks a figure at normal text sizes (above 130% it wraps instead).
      const scale = jest.spyOn(require('@/lib/useFontScale'), 'useFontScale').mockReturnValue(1);
      const r = render({ dueMinor: 10_000, spentMinor: 123_456_789_00, incomeMinor: 200_000_000_00 });
      const amount = r.root
        .findAllByType(Text)
        .find((t) => [t.props.children].flat().join('').startsWith('₹12,34,56'));
      expect(amount?.props.adjustsFontSizeToFit).toBe(true);
      expect(amount?.props.numberOfLines).toBe(1);
      act(() => r.unmount());
      scale.mockRestore();
    }));

  it('shows no legend at all, and keeps the ring centred, before there is any income', () =>
    withScreen({ width: 412, fontScale: 1 }, () => {
      const r = render({ incomeMinor: 0 });
      expect(r.root.findAllByType(HeroLegend)).toHaveLength(0);
      expect(r.root.findAllByType(MonthRing)).toHaveLength(1);
      act(() => r.unmount());
    }));
});

describe('month card: nothing jumps under the finger', () => {
  const order = (r: ReactTestRenderer) => r.root.findAll(() => true);
  const indexOf = (r: ReactTestRenderer, test: (n: ReturnType<typeof order>[number]) => boolean) =>
    order(r).findIndex(test);
  const link = (n: { props: Record<string, unknown> }) => n.props.accessibilityLabel === 'How this adds up';
  const flatStyle = (n: { props: Record<string, unknown> }) =>
    StyleSheet.flatten(n.props.style as never) as Record<string, unknown> | undefined;

  it('opens the sum under the link that opens it, so the link stays where the finger is', () => {
    const r = render();
    act(() => byLabel(r, 'How this adds up').props.onPress());
    const linkAt = indexOf(r, link);
    const sumAt = indexOf(r, (n) => n.type === Text && [n.props.children].flat().join('') === 'Income');
    expect(linkAt).toBeGreaterThan(-1);
    expect(sumAt).toBeGreaterThan(linkAt);
  });

  it('keeps both links on one line in a year, the caption under them, never a link alone on a line', () => {
    const r = render({ spendingTrend: null, onSeeInsights: jest.fn() });
    const how = indexOf(r, link);
    const insights = indexOf(r, (n) => n.props.accessibilityLabel === 'See spending insights');
    const caption = indexOf(r, (n) => n.type === Text && flatStyle(n)?.flexBasis === '100%');
    expect(how).toBeGreaterThan(-1);
    expect(insights).toBeGreaterThan(how);
    expect(caption).toBeGreaterThan(insights);
  });

  it('leaves the caption beside the link when there is only the one link', () => {
    const r = render();
    expect(r.root.findAll((n) => n.type === Text && flatStyle(n)?.flexBasis === '100%')).toHaveLength(0);
    expect(r.root.findAll((n) => n.props.accessibilityLabel === 'See spending insights')).toHaveLength(0);
  });
});
