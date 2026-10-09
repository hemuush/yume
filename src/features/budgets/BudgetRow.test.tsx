/**
 * Smoke-renders BudgetRow (on-track, over-budget, rollover). Guards the bug where reanimated's
 * `createAnimatedComponent` was mixed with usePressScale's core Animated values, crashing release builds.
 */
import { Text } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { BudgetRow } from './BudgetRow';
import { BudgetProgress } from '@/db/budgets';

// Bars and rings animate to their values (useGrowFrom); fake timers keep those
// frames inside the test instead of firing after it ends.
jest.useFakeTimers();

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
            onMore={() => {}}
          />
        );
      });
    }).not.toThrow();
  });

  it('opens its actions from a visible button, and from a long-press too', () => {
    const onMore = jest.fn();
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <BudgetRow progress={makeProgress()} divider={false} onPress={() => {}} onMore={onMore} />
      );
    });
    act(() =>
      tree.root
        .find((n) => n.props.accessibilityLabel === 'More for Groceries budget' && n.props.onPress)
        .props.onPress()
    );
    act(() => tree.root.find((n) => typeof n.props.onLongPress === 'function').props.onLongPress());
    expect(onMore).toHaveBeenCalledTimes(2);
  });
});

describe('BudgetRow per-day figure', () => {
  const rowText = (showPerDay?: boolean, over?: Partial<BudgetProgress>) => {
    jest.setSystemTime(new Date(2026, 9, 2, 12));
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        <BudgetRow
          progress={makeProgress({
            budget: {
              id: 'b1',
              categoryId: 'c1',
              periodMonth: '2026-10',
              limitAmountMinor: 500000,
              rollover: false,
            },
            spentMinor: 100000,
            remainingMinor: 400000,
            percentUsed: 20,
            ...over,
          })}
          divider={false}
          onPress={() => {}}
          showPerDay={showPerDay}
        />
      );
    });
    return JSON.stringify(tree.toJSON());
  };

  it('says what is left each day when asked to', () => {
    expect(rowText(true)).toContain('left · ₹138 a day');
  });

  it('keeps "left this month" when not asked', () => {
    const t = rowText(false);
    expect(t).toContain('left this month');
    expect(t).not.toContain('a day');
  });

  it('says nothing per day for an over-budget row', () => {
    expect(rowText(true, { overBudget: true, remainingMinor: -1000, percentUsed: 101 })).not.toContain(
      'a day'
    );
  });

  it('says which parent a subcategory budget belongs to, and nothing for a top-level one', () => {
    const shown = (progress: BudgetProgress) => {
      let r!: ReactTestRenderer;
      act(() => {
        r = create(<BudgetRow progress={progress} divider={false} onPress={() => {}} />);
      });
      return r.root.findAllByType(Text).map((t) => [t.props.children].flat(Infinity).join(''));
    };
    expect(shown(makeProgress({ categoryName: 'Flipkart Minutes', parentName: 'Food & Dining' }))).toContain(
      'in Food & Dining'
    );
    expect(shown(makeProgress()).some((t) => t.startsWith('in '))).toBe(false);
  });

  it('draws a jar in place of the icon and bar on Budgets, keeping the figures and the menu', () => {
    const { LimitMeter } = require('@/components/LimitMeter');
    let tree!: ReactTestRenderer;
    act(() => {
      tree = create(
        <BudgetRow
          progress={makeProgress({
            spentMinor: 620000,
            remainingMinor: -120000,
            percentUsed: 124,
            overBudget: true,
          })}
          divider={false}
          onPress={() => {}}
          onMore={() => {}}
          jar
        />
      );
    });
    expect(tree.root.findAllByType(LimitMeter)).toHaveLength(0);
    const shown = tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));
    expect(shown).toContain('Groceries');
    expect(shown.some((t) => t.includes('over budget'))).toBe(true);
    // Over the limit, the jar is full (no overflow past its top).
    const full = tree.root.findAll((n) => {
      const st = [].concat(n.props.style ?? []) as { height?: string }[];
      return typeof n.type === 'string' && st.some((x) => x && x.height === '100%');
    });
    expect(full.length).toBeGreaterThan(0);
    expect(
      tree.root.findAll((n) => n.props.accessibilityLabel === 'More for Groceries budget' && n.props.onPress)
    ).toHaveLength(1);
  });
});
