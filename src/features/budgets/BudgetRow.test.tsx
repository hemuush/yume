/**
 * Smoke-renders BudgetRow across on-track, over-budget, and rollover shapes.
 * Mirrors src/features/goals/GoalRing.test.tsx — the same class of bug
 * (BudgetRow, GoalCard, and GoalChip all mismatched react-native-reanimated's
 * `createAnimatedComponent` with usePressScale's React-Native-core Animated
 * values, a native-level incompatibility that crashed release builds
 * silently) would have shown up here immediately if this render test had
 * existed before it shipped.
 */
import { create, act } from 'react-test-renderer';
import { BudgetRow } from './BudgetRow';
import { BudgetProgress } from '@/db/budgets';

function makeProgress(overrides: Partial<BudgetProgress> = {}): BudgetProgress {
  return {
    budget: { id: 'b1', categoryId: 'c1', periodMonth: '2026-09', limitAmountMinor: 500000, rollover: false },
    categoryName: 'Groceries',
    categoryIcon: 'cart-outline',
    categoryColor: '#8FE8C8',
    spentMinor: 410000,
    effectiveLimitMinor: 500000,
    remainingMinor: 90000,
    percentUsed: 82,
    overBudget: false,
    ...overrides,
  };
}

describe('BudgetRow', () => {
  it('renders an on-track budget without throwing', () => {
    expect(() => {
      act(() => {
        create(<BudgetRow progress={makeProgress()} divider={false} onPress={() => {}} />);
      });
    }).not.toThrow();
  });

  it('renders an over-budget row without throwing', () => {
    expect(() => {
      act(() => {
        create(
          <BudgetRow
            progress={makeProgress({
              spentMinor: 620000,
              remainingMinor: -120000,
              percentUsed: 124,
              overBudget: true,
            })}
            divider
            onPress={() => {}}
          />
        );
      });
    }).not.toThrow();
  });

  it('renders a fresh (0% spent) row without throwing', () => {
    expect(() => {
      act(() => {
        create(
          <BudgetRow
            progress={makeProgress({ spentMinor: 0, remainingMinor: 500000, percentUsed: 0 })}
            divider={false}
            onPress={() => {}}
            onLongPress={() => {}}
          />
        );
      });
    }).not.toThrow();
  });
});
