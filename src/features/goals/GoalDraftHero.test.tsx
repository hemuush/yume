/** The goal card the Edit goal and Add money sheets open on: percent, reached, and what is hidden with amounts. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(120000);

jest.mock('./GoalHero', () => ({
  GoalHero: (p: object) =>
    require('react').createElement(require('react-native').View, { testID: 'hero', ...p }),
}));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8CCED6', secondary: '#8FE8C8' }),
}));

import { GoalDraftHero } from './GoalDraftHero';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { dayMonthYear } from '@/lib/dateLabels';

const mounted: ReactTestRenderer[] = [];
function hero(props: Partial<React.ComponentProps<typeof GoalDraftHero>> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <GoalDraftHero name="Test goal" savedMinor={1_000_000} targetMinor={4_000_000} {...props} />
    );
  });
  mounted.push(tree);
  return tree.root.findByProps({ testID: 'hero' }).props;
}

beforeEach(() => {
  mockHide = false;
});
afterEach(() => act(() => mounted.splice(0).forEach((t) => t.unmount())));

describe('GoalDraftHero', () => {
  it('shows the saved amount, the percent of the target, what is left and a bar to match', () => {
    const p = hero();
    expect(p.name).toBe('Test goal');
    expect(p.kicker).toBe(`Savings goal · 25% of ${formatMoney(4_000_000)}`);
    expect(p.saved).toBe(formatMaskableMoney(1_000_000, { masked: false }));
    expect(p.fraction).toBeCloseTo(0.25);
    expect(p.toGo).toEqual({ figure: formatMoney(3_000_000) });
    expect(p.date).toBeUndefined();
  });

  it('adds the target date', () => {
    expect(hero({ targetDate: '2030-05-01' }).date).toBe(dayMonthYear('2030-05-01'));
  });

  it('says Reached, with a flag, once the target is met', () => {
    const p = hero({ savedMinor: 4_000_000 });
    expect(p.kicker).toBe('Savings goal · Reached');
    expect(p.icon).toBe('flag-checkered');
    expect(p.toGo).toEqual({ reached: true });
  });

  it('says "After this" when the figures are what a payment would make them', () => {
    expect(hero({ after: true }).kicker).toBe(`After this · 25% of ${formatMoney(4_000_000)}`);
  });

  it('hides progress, the amount, what is left and the Reached state when amounts are hidden', () => {
    mockHide = true;
    const p = hero({ savedMinor: 4_000_000, targetDate: '2030-05-01' });
    expect(p.kicker).toBe(`Savings goal · of ${formatMoney(4_000_000)}`);
    expect(p.fraction).toBe(0);
    expect(p.icon).toBe('piggy-bank-outline');
    expect(p.saved).toBe(formatMaskableMoney(4_000_000, { masked: true }));
    expect(p.toGo).toBeUndefined();
    expect(p.date).toBeUndefined();
  });
});
