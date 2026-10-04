/** The goal card the goal sheets open on: percent, "Reached", and what is hidden when amounts are hidden. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(120000);

jest.mock('@/components/SheetCard', () => ({
  SheetCard: (p: object) =>
    require('react').createElement(require('react-native').View, { testID: 'card', ...p }),
}));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));

import { GoalSheetCard } from './GoalSheetCard';
import { formatMoney, formatMaskableMoney } from '@/lib/money';
import { dayMonthYear } from '@/lib/dateLabels';

const mounted: ReactTestRenderer[] = [];
function card(props: Partial<React.ComponentProps<typeof GoalSheetCard>> = {}) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <GoalSheetCard name="Test goal" savedMinor={1_000_000} targetMinor={4_000_000} {...props} />
    );
  });
  mounted.push(tree);
  return tree.root.findByProps({ testID: 'card' }).props;
}

beforeEach(() => {
  mockHide = false;
});
afterEach(() => act(() => mounted.splice(0).forEach((t) => t.unmount())));

describe('GoalSheetCard', () => {
  it('shows the saved amount, the percent, and a bar to match', () => {
    const p = card();
    expect(p.kicker).toBe('25%');
    expect(p.title).toBe('Test goal');
    expect(p.amount).toBe(formatMaskableMoney(1_000_000, { masked: false }));
    expect(p.progress).toBeCloseTo(0.25);
    expect(p.meta).toBe(`of ${formatMoney(4_000_000)}`);
  });

  it('adds the target date to the line under the name', () => {
    expect(card({ targetDate: '2030-05-01' }).meta).toBe(
      `of ${formatMoney(4_000_000)} · by ${dayMonthYear('2030-05-01')}`
    );
  });

  it('says Reached, with a flag, once the target is met', () => {
    const p = card({ savedMinor: 4_000_000 });
    expect(p.kicker).toBe('Reached');
    expect(p.icon).toBe('flag-checkered');
  });

  it('lets a caller replace the corner label', () => {
    expect(card({ kicker: 'After this' }).kicker).toBe('After this');
  });

  it('hides progress, the amount and the Reached state when amounts are hidden', () => {
    mockHide = true;
    const p = card({ savedMinor: 4_000_000 });
    expect(p.kicker).toBe('Saved');
    expect(p.progress).toBe(0);
    expect(p.icon).toBe('piggy-bank-outline');
    expect(p.amount).toBe(formatMaskableMoney(4_000_000, { masked: true }));
  });
});
