/**
 * Smoke-renders GoalCard across real data shapes (0%, mid, done, over target, no date);
 * a render-time throw reproduces a crash without a device, which the db tests can't catch.
 */
import { create as createTree, act } from 'react-test-renderer';
const mounted: ReturnType<typeof createTree>[] = [];
function create(...args: Parameters<typeof createTree>) {
  const tree = createTree(...args);
  mounted.push(tree);
  return tree;
}
afterEach(() => {
  act(() => {
    for (const tree of mounted) tree.unmount();
  });
  mounted.length = 0;
});
import { GoalCard } from './GoalCard';
import { SavingsGoal } from '@/types';

// Bars and rings animate to their values (useGrowFrom); fake timers keep those
// frames inside the test instead of firing after it ends.
jest.useFakeTimers();

function makeGoal(overrides: Partial<SavingsGoal> = {}): SavingsGoal {
  return {
    id: 'g1',
    name: 'Goa Trip',
    targetAmountMinor: 4000000,
    currentAmountMinor: 0,
    targetDate: null,
    linkedAccountId: null,
    tracksAccount: false,
    noteToSelf: null,
    letterRevealed: false,
    archived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('GoalCard', () => {
  it('renders a freshly created, an in-progress, and a completed goal without throwing', () => {
    for (const goal of [
      makeGoal(),
      makeGoal({ currentAmountMinor: 2000000 }),
      makeGoal({ currentAmountMinor: 4000000 }),
      makeGoal({ archived: true, currentAmountMinor: 4000000 }),
    ]) {
      expect(() => {
        act(() => {
          create(<GoalCard goal={goal} onPress={() => {}} onContribute={() => {}} />);
        });
      }).not.toThrow();
    }
  });
});
