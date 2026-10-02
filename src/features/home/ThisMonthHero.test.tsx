/**
 * Home's month card, number first: what's free to use is the headline, a
 * small ring says how much was spent, three tiles give spent, saved and debt
 * left, tapping a tile picks its slice (and tapping it again goes back), the
 * ring steps through the slices, and an overspent month says so. All
 * figures are made up.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ dot: '#F0876A', accent: '#A6B4F2' }) }));
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

function render(over: Partial<React.ComponentProps<typeof ThisMonthHero>> = {}) {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <ThisMonthHero
        periodKey="month:0"
        direction={0}
        title="This month"
        canStepForward={false}
        onStep={jest.fn()}
        incomeMinor={19_605_600}
        spentMinor={9_576_200}
        savingsMinor={9_950_000}
        surplusMinor={79_400}
        outstandingLoansMinor={231_895_800}
        suu={{ text: 'Half of September stayed with you.', pose: 'default' }}
        today={{ spentMinor: 204_500, goalMinor: 500_000 }}
        pace={{ projectedMinor: 10_370_000, byLabel: '30 Sept' }}
        {...over}
      />
    );
  });
  return r;
}

describe('month card', () => {
  it('leads with what is free to use, with the spent share on the ring and three tiles under it', () => {
    const all = texts(render());
    expect(all).toEqual(
      expect.arrayContaining([
        'Free to use',
        'left of ₹1,96,056 income',
        '49%',
        'spent',
        'Spent',
        'Saved',
        'Debt left',
      ])
    );
    expect(all).toEqual(expect.arrayContaining(['₹794', '₹95,762', '₹99,500', '₹23,18,958']));
    // Free to use is said once, as the headline — it has no tile of its own.
    expect(all.filter((t) => t === 'Free to use')).toHaveLength(1);
    expect(all.some((t) => t.startsWith('On pace for about'))).toBe(true);
    expect(all).toContain('Half of September stayed with you.');
  });

  it('picks a slice from its tile, and lets go on a second tap', () => {
    const r = render();
    act(() => byLabel(r, 'Saved,').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['51%', 'saved']));
    act(() => byLabel(r, 'Saved,').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['49%', 'spent']));
  });

  it('steps through the slices from the ring', () => {
    const r = render();
    act(() => byLabel(r, '49%').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['51%', 'saved']));
  });

  it('says when more went out than came in', () => {
    const all = texts(
      render({ incomeMinor: 5_000_000, spentMinor: 6_000_000, savingsMinor: 0, surplusMinor: -1_000_000 })
    );
    expect(all).toEqual(expect.arrayContaining(['Over', 'Over by', '₹10,000']));
    expect(all.filter((t) => t.includes('more went out than came in'))).toHaveLength(1);
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

  it('keeps the free headline and the Spent tile, drops the Saved tile, and leaves Debt', () => {
    const all = texts(render(hidden));
    expect(all).toEqual(expect.arrayContaining(['10%', 'spent', 'Spent', 'Free to use', 'Debt left']));
    expect(all).not.toContain('Saved');
    expect(all).not.toContain('kept');
    expect(all).toEqual(expect.arrayContaining(['₹10,000', '₹30,000']));
  });

  it('never prints or reads out the amount that went to savings', () => {
    const r = render(hidden);
    const everything = [...texts(r), ...labels(r)].join(' | ');
    expect(everything).not.toContain('60,000');
    expect(everything).not.toMatch(/savings|kept/i);
  });

  it('steps between free and spent only, never through a savings view', () => {
    const r = render(hidden);
    act(() => byLabel(r, '10%').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['30%', 'free']));
    act(() => byLabel(r, '30%').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['10%', 'spent']));
  });

  it('still says when more went out than came in', () => {
    const all = texts(
      render({ incomeMinor: 5_000_000, spentMinor: 6_000_000, savingsMinor: 0, surplusMinor: -1_000_000 })
    );
    expect(all).toEqual(expect.arrayContaining(['Over', 'Over by']));
  });
});

describe('month card with no income', () => {
  it('asks for income instead of showing a figure', () => {
    const all = texts(render({ incomeMinor: 0, spentMinor: 0, savingsMinor: 0, surplusMinor: 0 }));
    expect(all).toEqual(expect.arrayContaining(['Free to use', '—', 'Add income to see what is free']));
  });
});
