/**
 * Home's compact month card (the Home A sign-off): the ring's face says how
 * much was kept, four tiles give spent, to savings, free to use and debt
 * left, tapping a tile picks its slice (and tapping it again goes back),
 * the ring steps through the slices, and an overspent month says so. All
 * figures are made up.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
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
        periodName="September"
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
  it('shows what was kept on the ring, and the four figures beside it', () => {
    const all = texts(render());
    expect(all).toEqual(
      expect.arrayContaining(['51%', 'kept', 'Spent', 'To savings', 'Free to use', 'Debt left'])
    );
    expect(all).toEqual(expect.arrayContaining(['₹95,762', '₹99,500', '₹794', '₹23,18,958']));
    expect(all.some((t) => t.startsWith('On pace for about'))).toBe(true);
    expect(all).toContain('Half of September stayed with you.');
  });

  it('picks a slice from its tile, and lets go on a second tap', () => {
    const r = render();
    act(() => byLabel(r, 'Spent,').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['49%', 'spent']));
    act(() => byLabel(r, 'Spent,').props.onPress());
    expect(texts(r)).toEqual(expect.arrayContaining(['51%', 'kept']));
  });

  it('steps through the slices from the ring', () => {
    const r = render();
    act(() => byLabel(r, '51%').props.onPress());
    expect(texts(r)).toContain('spent');
  });

  it('says when more went out than came in', () => {
    const all = texts(
      render({ incomeMinor: 5_000_000, spentMinor: 6_000_000, savingsMinor: 0, surplusMinor: -1_000_000 })
    );
    expect(all).toEqual(expect.arrayContaining(['Over', 'spent more']));
    expect(all.some((t) => t.includes('more went out than came in'))).toBe(true);
  });
});
