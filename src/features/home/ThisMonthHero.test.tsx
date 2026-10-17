/**
 * Home's month card: the free-to-use headline with income and carry-over under it, chips for the spent
 * share, today and bills still to pay, the Add buttons, and stepping the period. All figures are made up.
 */
import { StyleSheet, Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
jest.mock('@expo/vector-icons/Feather', () => () => null);

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
      outstandingLoansMinor={231_895_800}
      today={{ spentMinor: 204_500, goalMinor: 500_000 }}
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
  it('leads with what is free to use, what it is out of, and the spent share and what is left today as chips', () => {
    const all = texts(render());
    expect(all).toEqual(
      expect.arrayContaining([
        'Free to use',
        '₹794',
        'of ₹1,96,056 after spending and savings',
        '49% spent',
        '₹2,955 left today',
        'Expense',
        'Income',
        'Transfer',
      ])
    );
    // Spent | Saved | Debt left, as on the old card.
    expect(all).toEqual(
      expect.arrayContaining(['Spent', 'Saved', 'Debt left', '₹95,762', '₹99,500', '₹23,18,958'])
    );
    // Free to use is said once, as the headline.
    expect(all.filter((t) => t === 'Free to use')).toHaveLength(1);
    // The pace is a spending forecast, and says so.
    expect(all.some((t) => t.startsWith('On pace to spend about'))).toBe(true);
    expect(all.some((t) => t.startsWith('On pace for about'))).toBe(false);
  });

  it('says how far over the daily goal today is', () => {
    const all = texts(render({ today: { spentMinor: 600_000, goalMinor: 500_000 } }));
    expect(all).toContain('₹6,000 today · ₹1,000 over');
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

  it('takes the bills off the headline and shows them as a chip', () => {
    const all = texts(render(base));
    expect(all).toEqual(
      expect.arrayContaining([
        'Free after bills',
        '₹40,000',
        'of ₹1,00,000 after spending, savings and bills',
        '₹20,000 still to pay',
      ])
    );
    expect(all).not.toContain('Free to use');
  });

  it('opens the sum from the chip, and closes it again', () => {
    const r = render(base);
    expect(texts(r)).not.toContain('After bills');
    act(() => byLabel(r, '₹20,000 still to pay').props.onPress());
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
    act(() => byLabel(r, '₹20,000 still to pay').props.onPress());
    expect(texts(r)).not.toContain('After bills');
  });

  it('says short when the bills are more than what is free', () => {
    const all = texts(render({ ...base, dueMinor: 7_000_000 }));
    expect(all).toEqual(expect.arrayContaining(['Short after bills', '-₹10,000', '₹70,000 still to pay']));
  });

  it('is the plain Free to use card when nothing is due', () => {
    const all = texts(render({ ...base, dueMinor: 0 }));
    expect(all).toEqual(
      expect.arrayContaining(['Free to use', '₹60,000', 'of ₹1,00,000 after spending and savings'])
    );
    expect(all.some((t) => t.includes('still to pay'))).toBe(false);
  });

  it('hides the set-aside amount in the sum when savings are hidden', () => {
    mockHideAmounts = true;
    try {
      const r = render(base);
      act(() => byLabel(r, '₹20,000 still to pay').props.onPress());
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

  it('keeps the free headline and the spent share, and never says what was saved', () => {
    const all = texts(render(hidden));
    expect(all).toEqual(
      expect.arrayContaining(['10% spent', 'Free to use', '₹30,000', 'Spent', 'Debt left'])
    );
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
    expect(all).toEqual(
      expect.arrayContaining(['Free to use', '₹80,000', 'of ₹1,20,000 after spending and savings'])
    );
  });

  it('shows the carried amount as its own line in the sum', () => {
    const r = render({ ...base, dueMinor: 2_000_000 });
    act(() => byLabel(r, '₹20,000 still to pay').props.onPress());
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
          outstandingLoansMinor={0}
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

describe('month card, debt', () => {
  it('ticks Debt left once it is all paid off', () => {
    const r = render({ outstandingLoansMinor: 0 });
    expect(
      r.root.findAll((n) => n.props.accessibilityLabel === 'Debt left, ₹0, all paid off').length
    ).toBeGreaterThan(0);
  });
});

describe('month card money bar', () => {
  const bar = (r: ReactTestRenderer) => r.root.findAll((n) => n.props.testID === 'home-money-bar');

  it('shows where the money went as a thin bar under the figure', () => {
    expect(bar(render()).length).toBeGreaterThan(0);
  });

  it('is hidden from a screen reader, which gets the same facts in words', () => {
    const [node] = bar(render());
    expect(node.props.importantForAccessibility).toBe('no-hide-descendants');
  });

  it('is not there with no income', () => {
    expect(bar(render({ incomeMinor: 0, spentMinor: 0, savingsMinor: 0, surplusMinor: 0 }))).toHaveLength(0);
  });
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
    act(() => byLabel(r, '₹20,000 still to pay').props.onPress());
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

describe('month card: the free label, today and pace', () => {
  it('names the free part of the bar with the same figure as the headline', () => {
    expect(texts(render())).toContain('₹794 free');
  });

  it('has no free label when more went out than came in, or the bills take it all', () => {
    expect(
      texts(
        render({ incomeMinor: 5_000_000, spentMinor: 6_000_000, savingsMinor: 0, surplusMinor: -1_000_000 })
      )
    ).not.toContain('₹10,000 free');
    const all = texts(
      render({
        incomeMinor: 10_000_000,
        spentMinor: 1_000_000,
        savingsMinor: 3_000_000,
        surplusMinor: 6_000_000,
        dueMinor: 7_000_000,
      })
    );
    expect(all.some((t) => t.endsWith(' free'))).toBe(false);
  });

  it('says what is left of the daily goal, and none left once it is spent', () => {
    expect(texts(render({ today: { spentMinor: 0, goalMinor: 500_000 } }))).toContain('₹5,000 left today');
    expect(texts(render({ today: { spentMinor: 500_000, goalMinor: 500_000 } }))).toContain('₹0 left today');
  });

  it('draws a thin meter that fills as the daily goal is spent', () => {
    const meter = (spentMinor: number) =>
      render({ today: { spentMinor, goalMinor: 500_000 } }).root.findAll(
        (n) => n.props.testID === 'home-today-meter'
      )[0];
    expect(StyleSheet.flatten(meter(125_000).props.style).width).toBe('25%');
    expect(StyleSheet.flatten(meter(0).props.style).width).toBe('0%');
    // Refunds can make today's net spend negative: the meter stays empty rather than going below zero.
    expect(StyleSheet.flatten(meter(-50_000).props.style).width).toBe('0%');
  });

  it('keeps saying how far over it is, and then shows no meter', () => {
    const r = render({ today: { spentMinor: 600_000, goalMinor: 500_000 } });
    expect(texts(r)).toContain('₹6,000 today · ₹1,000 over');
    expect(r.root.findAll((n) => n.props.testID === 'home-today-meter')).toHaveLength(0);
  });
});
