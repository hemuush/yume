/** Home's Upcoming, Budgets and Goals rows: one shape, the right words, and goal amounts staying hidden. */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

let mockHideAmounts = false;
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: mockHideAmounts, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ dot: '#F0876A', accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));
jest.mock('@expo/vector-icons/Feather', () => 'Feather');
jest.mock('@/features/budgets/useToday', () => ({ useToday: () => '2026-10-17' }));
jest.useFakeTimers();

import { HomeBudgetRow } from './HomeBudgetRow';
import { HomeGoalRow } from './HomeGoalRow';
import { UpcomingRow } from './UpcomingRow';
import { GoalRing } from '@/features/goals/GoalRing';
import type { BudgetProgress } from '@/db/budgets';
import type { SavingsGoal } from '@/types';

const text = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((t) =>
      [t.props.children]
        .flat(Infinity)
        .filter((c) => typeof c === 'string' || typeof c === 'number')
        .join('')
    )
    .join(' | ');
const render = (el: React.ReactElement) => {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(el);
  });
  return r;
};
const label = (r: ReactTestRenderer) =>
  r.root.find((n) => typeof n.props.accessibilityLabel === 'string' && n.props.onPress).props
    .accessibilityLabel as string;

const budget = (over: Partial<BudgetProgress> = {}): BudgetProgress =>
  ({
    budget: { id: 'b1', periodMonth: '2026-10' },
    categoryName: 'Travel',
    categoryIcon: 'airplane',
    categoryColor: '#8FCBFF',
    spentMinor: 347_200,
    effectiveLimitMinor: 500_000,
    remainingMinor: 152_800,
    percentUsed: 69,
    overBudget: false,
    ...over,
  }) as BudgetProgress;

const goal: SavingsGoal = {
  id: 'g1',
  name: 'Goa Trip',
  targetAmountMinor: 4_000_000,
  currentAmountMinor: 2_500_000,
  targetDate: null,
  linkedAccountId: null,
  tracksAccount: false,
  noteToSelf: null,
  letterRevealed: false,
  archived: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('Home budget row', () => {
  it('says what is left, what was spent of the limit, and the pace', () => {
    const r = render(<HomeBudgetRow progress={budget()} divider={false} onPress={jest.fn()} />);
    const t = text(r);
    expect(t).toContain('Travel');
    expect(t).toContain('₹3,472 of ₹5,000');
    expect(t).toContain('₹1,528 left');
    // The ring's own label is drawn by SVG, so it is read from the ring's props.
    expect(r.root.findByType(GoalRing).props.label).toBe('69%');
    expect(t).toMatch(/Ahead of pace|On track/);
  });

  it('says by how much a budget is over, in words as well as colour', () => {
    const r = render(
      <HomeBudgetRow
        progress={budget({ overBudget: true, remainingMinor: -82_000, percentUsed: 108 })}
        divider={false}
        onPress={jest.fn()}
      />
    );
    expect(text(r)).toContain('₹820 over');
    expect(text(r)).toContain('Over limit');
    expect(r.root.findByType(GoalRing).props.label).toBe('108%');
    expect(label(r)).toContain('₹820 over budget');
  });
});

describe('Home goal row', () => {
  afterEach(() => {
    mockHideAmounts = false;
  });

  it('shows what is saved of the target, and what is still to go', () => {
    const r = render(<HomeGoalRow goal={goal} divider={false} onPress={jest.fn()} />);
    expect(text(r)).toContain('₹25,000 of ₹40,000');
    expect(text(r)).toContain('₹15,000 to go');
    expect(r.root.findAllByType(GoalRing)).toHaveLength(1);
  });

  it('says Reached for a finished goal', () => {
    const r = render(
      <HomeGoalRow goal={{ ...goal, currentAmountMinor: 4_000_000 }} divider={false} onPress={jest.fn()} />
    );
    expect(text(r)).toContain('Reached');
    expect(text(r)).not.toContain('to go');
  });

  it('withholds the saved amount, the ring and the rest while amounts are hidden, keeping the target', () => {
    mockHideAmounts = true;
    const r = render(<HomeGoalRow goal={goal} divider={false} onPress={jest.fn()} />);
    const shown = text(r);
    expect(shown).toContain('Target ₹40,000');
    expect(shown).not.toContain('25,000');
    expect(shown).not.toContain('to go');
    expect(r.root.findAllByType(GoalRing)).toHaveLength(0);
    expect(label(r)).not.toContain('25,000');
    expect(label(r)).not.toMatch(/\d+ percent/);
  });
});

describe('Home upcoming row', () => {
  const row = (over: Partial<React.ComponentProps<typeof UpcomingRow>> = {}) => (
    <UpcomingRow
      icon="calendar"
      iconBg="#EEE"
      title="Loan EMI"
      subtitle="Tomorrow"
      amountMinor={500_000}
      sign="-"
      date="2026-10-18"
      onPress={jest.fn()}
      {...over}
    />
  );

  it('shows the title, when, and the amount', () => {
    const t = text(render(row()));
    expect(t).toContain('Loan EMI');
    expect(t).toContain('Tomorrow');
    expect(t).toContain('-₹5,000');
  });

  it('puts a status chip and a Pay button on a bill that is due now', () => {
    const r = render(row({ urgent: true, actionLabel: 'Pay' }));
    expect(text(r)).toContain('Due now');
    expect(text(r)).toContain('Pay');
    expect(label(r)).toContain('Pay');
  });
});
