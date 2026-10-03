/**
 * Smoke-renders GoalRing/GoalChip/GoalCard across real data shapes (0%, mid, done, over target, no date);
 * a render-time throw reproduces a crash without a device, which the db tests can't catch.
 */
import { create, act } from 'react-test-renderer';
import { GoalRing } from './GoalRing';
import { GoalChip } from './GoalChip';
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

describe('GoalRing', () => {
  it.each([0, 1, 50, 99, 100])('renders without throwing at %i%%', (percent) => {
    expect(() => {
      act(() => {
        create(<GoalRing percent={percent} color="#8FE8C8" />);
      });
    }).not.toThrow();
  });

  it('renders the done (checkmark) state without throwing', () => {
    expect(() => {
      act(() => {
        create(<GoalRing percent={100} color="#1C9A5B" done />);
      });
    }).not.toThrow();
  });

  it.each([44, 40, 46, 20, 200])('renders without throwing at size %i', (size) => {
    expect(() => {
      act(() => {
        create(<GoalRing percent={64} color="#8FE8C8" size={size} />);
      });
    }).not.toThrow();
  });
});

describe('GoalChip', () => {
  it('renders a freshly created goal (0% saved) without throwing', () => {
    expect(() => {
      act(() => {
        create(<GoalChip goal={makeGoal()} onPress={() => {}} />);
      });
    }).not.toThrow();
  });

  it('renders a goal saved past its target (>100%) without throwing', () => {
    expect(() => {
      act(() => {
        create(<GoalChip goal={makeGoal({ currentAmountMinor: 5000000 })} onPress={() => {}} />);
      });
    }).not.toThrow();
  });

  it('renders a goal with a target date without throwing', () => {
    expect(() => {
      act(() => {
        create(<GoalChip goal={makeGoal({ targetDate: '2026-12-31' })} onPress={() => {}} />);
      });
    }).not.toThrow();
  });
});

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
