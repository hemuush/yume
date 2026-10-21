/** Adding money to a goal and the milestone note it can raise: made-up goals throughout. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

const mockShow = jest.fn();
const mockContribute = jest.fn(async () => {});
const mockSeen: { keys: string[] } = { keys: [] };
const mockHide = { current: false };
const mockMove = jest.fn(async () => {});
const mockRelease = jest.fn(async () => {});
const mockAvailable = { amount: 500000, shortfall: 0 };
jest.mock('@/db/goalReservations', () => ({
  getGoalReservationSummary: jest.fn(async () => ({
    availableMinor: mockAvailable.amount,
    shortfallMinor: mockAvailable.shortfall,
  })),
  moveGoalReservation: (...args: unknown[]) => (mockMove as (...a: unknown[]) => Promise<void>)(...args),
  releaseGoalReservation: (...args: unknown[]) =>
    (mockRelease as (...a: unknown[]) => Promise<void>)(...args),
}));

jest.mock('@/db/savingsGoals', () => ({
  contributeToGoal: (...a: unknown[]) => (mockContribute as (...x: unknown[]) => Promise<void>)(...a),
  markGoalLetterRevealed: jest.fn(async () => {}),
  listSavingsGoals: jest.fn(async () => [
    { id: 'g2', name: 'Emergency', reservesAccount: true, linkedAccountId: 'pot' },
  ]),
}));
jest.mock('@/db/settings', () => ({
  getCachedCurrency: () => 'INR',
  getCachedAccentColor: () => '#8FCBFF',
  getMilestonesSeen: async () => mockSeen.keys,
  markMilestonesSeen: async (keys: string[]) => {
    mockSeen.keys = [...mockSeen.keys, ...keys];
  },
}));
jest.mock('@/components/MilestoneNote', () => ({ useMilestoneNote: () => mockShow }));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide.current }) }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), confirm: jest.fn() } }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));
jest.mock('@/components/Chip', () => ({
  Chip: (props: object) => require('react').createElement(require('react-native').View, props),
}));
jest.mock('@/components/AmountField', () => ({
  AmountField: ({ onChangeText }: { onChangeText: (v: string) => void }) =>
    require('react').createElement(require('react-native').View, { testID: 'amount', onChangeText }),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('./GoalSheetCard', () => ({ GoalSheetCard: () => null }));
jest.mock('./GoalLetterReveal', () => ({ GoalLetterReveal: () => null }));

import { ContributeModal } from './ContributeModal';
import type { SavingsGoal } from '@/types';

const goal = (over: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 'g1',
  name: 'Trip',
  targetAmountMinor: 1_000_000,
  currentAmountMinor: 200_000,
  targetDate: null,
  linkedAccountId: null,
  tracksAccount: false,
  noteToSelf: null,
  letterRevealed: false,
  archived: false,
  createdAt: '2026-01-01',
  ...over,
});

async function add(g: SavingsGoal, rupees: string, direction: 'add' | 'withdraw' = 'add') {
  const onContributed = jest.fn();
  let r!: ReactTestRenderer;
  await act(async () => {
    r = create(<ContributeModal goal={g} onClose={jest.fn()} onContributed={onContributed} />);
  });
  if (direction === 'withdraw') {
    const seg = r.root.find((n) => typeof n.props.onChange === 'function' && n.props.options);
    await act(async () => seg.props.onChange('withdraw'));
  }
  await act(async () => r.root.findByProps({ testID: 'amount' }).props.onChangeText(rupees));
  const save = r.root.find(
    (n) => typeof n.props.onPress === 'function' && n.props.title && !n.props.disabled
  );
  await act(async () => {
    await save.props.onPress();
  });
  return { onContributed, tree: r };
}

beforeEach(() => {
  mockShow.mockClear();
  mockContribute.mockClear();
  mockMove.mockClear();
  mockRelease.mockClear();
  mockSeen.keys = [];
  mockHide.current = false;
});

describe('milestone note on a contribution', () => {
  it('does not replay an old save callback after showing completion', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <ContributeModal
          goal={goal({ currentAmountMinor: 900000 })}
          onClose={jest.fn()}
          onContributed={jest.fn()}
        />
      );
    });
    act(() => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('1000'));
    const submit = tree.root.find(
      (n) => n.props.title === 'Add money' && typeof n.props.onPress === 'function'
    ).props.onPress;
    await act(async () => {
      await submit();
      await submit();
    });
    expect(mockContribute).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('does not announce completion while savings are hidden', async () => {
    mockHide.current = true;
    const { onContributed, tree } = await add(
      goal({ currentAmountMinor: 900000, noteToSelf: 'Private letter' }),
      '1000'
    );
    expect(onContributed).toHaveBeenCalledTimes(1);
    expect(require('@/db/savingsGoals').markGoalLetterRevealed).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(require('./GoalLetterReveal').GoalLetterReveal)).toHaveLength(0);
    expect(tree.root.findAllByProps({ title: 'Goal completed' })).toHaveLength(0);
    act(() => tree.unmount());
  });

  it('drops a note when a save crosses a line, and remembers it', async () => {
    const { onContributed } = await add(goal(), '1000');
    expect(onContributed).toHaveBeenCalled();
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow.mock.calls[0][0].title).toBe('A quarter of the way');
    expect(mockSeen.keys).toEqual(['goal:g1:25']);
  });

  it('marks every line it jumped past but only announces the highest', async () => {
    await add(goal(), '6000');
    expect(mockShow).toHaveBeenCalledTimes(1);
    expect(mockShow.mock.calls[0][0].title).toBe('Three quarters there');
    expect(mockSeen.keys).toEqual(['goal:g1:25', 'goal:g1:50', 'goal:g1:75']);
  });

  it('never repeats a line that was already shown', async () => {
    mockSeen.keys = ['goal:g1:25'];
    await add(goal(), '1000');
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('stays quiet when no line is crossed, and for a withdrawal', async () => {
    await add(goal({ currentAmountMinor: 300_000 }), '1000');
    expect(mockShow).not.toHaveBeenCalled();
    await add(goal({ currentAmountMinor: 600_000 }), '2000', 'withdraw');
    expect(mockShow).not.toHaveBeenCalled();
  });

  it('leaves the amount out of the note while savings are hidden', async () => {
    mockHide.current = true;
    await add(goal({ currentAmountMinor: 400_000 }), '1000');
    expect(mockShow.mock.calls[0][0].body).toBe('Trip is 50% funded.');
  });

  it('leaves 100% to the sealed letter when there is one, but still remembers it', async () => {
    await add(goal({ currentAmountMinor: 900_000, noteToSelf: 'Well done' }), '1000');
    expect(mockShow).not.toHaveBeenCalled();
    expect(mockSeen.keys).toContain('goal:g1:100');
  });

  it('marks a completion letter read only after acknowledgement', async () => {
    const mark = jest.mocked(require('@/db/savingsGoals').markGoalLetterRevealed);
    mark.mockClear();
    const { tree } = await add(goal({ currentAmountMinor: 900000, noteToSelf: 'Keep going' }), '1000');
    expect(mark).not.toHaveBeenCalled();
    await act(async () => {
      await tree.root.findByProps({ title: 'Done' }).props.onPress();
    });
    expect(mark).toHaveBeenCalledTimes(1);
    expect(mark).toHaveBeenCalledWith('g1');
    act(() => tree.unmount());
  });

  it('keeps a failed letter acknowledgement retryable and allows closing without replaying progress', async () => {
    const mark = jest.mocked(require('@/db/savingsGoals').markGoalLetterRevealed);
    mark
      .mockRejectedValueOnce(new Error('receipt unavailable'))
      .mockRejectedValueOnce(new Error('receipt unavailable'));
    const { tree, onContributed } = await add(
      goal({ currentAmountMinor: 900000, noteToSelf: 'My note' }),
      '1000'
    );
    await act(async () => {
      await tree.root.findByProps({ title: 'Done' }).props.onPress();
    });
    expect(onContributed).not.toHaveBeenCalled();
    expect(
      tree.root
        .findAllByType(Text)
        .map((n) => [n.props.children].flat().join(' '))
        .join(' ')
    ).toContain('progress was saved');
    await act(async () => {
      await tree.root.findByType(require('@/components/ModalSheet').ModalSheet).props.onClose();
    });
    expect(onContributed).toHaveBeenCalledTimes(1);
    expect(mockContribute).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('keeps the completion confirmation open without a letter and avoids a duplicate toast', async () => {
    const { tree, onContributed } = await add(goal({ currentAmountMinor: 900_000 }), '1000');
    expect(mockShow).not.toHaveBeenCalled();
    expect(onContributed).not.toHaveBeenCalled();
    expect(mockSeen.keys).toContain('goal:g1:100');
    await act(async () => tree.root.findByProps({ title: 'Done' }).props.onPress());
    expect(onContributed).toHaveBeenCalledTimes(1);
  });
});

describe('withdrawing more than is saved', () => {
  const shown = (tree: ReactTestRenderer) =>
    tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

  it('says so inline instead of silently clamping to zero', async () => {
    const { onContributed, tree } = await add(goal({ currentAmountMinor: 200_000 }), '2500', 'withdraw');
    expect(mockContribute).not.toHaveBeenCalled();
    expect(onContributed).not.toHaveBeenCalled();
    expect(shown(tree).some((t) => t.startsWith('You can withdraw up to'))).toBe(true);
  });

  it('lets a withdrawal of exactly what is saved through', async () => {
    const { onContributed } = await add(goal({ currentAmountMinor: 200_000 }), '2000', 'withdraw');
    expect(mockContribute).toHaveBeenCalledWith('g1', -200_000);
    expect(onContributed).toHaveBeenCalled();
  });
});

describe('shared account reservations', () => {
  const reserved = () => goal({ reservesAccount: true, linkedAccountId: 'pot' });
  it('reserves/releases through the goal action and masks available amounts', async () => {
    mockHide.current = true;
    const { tree } = await add(reserved(), '100');
    expect(mockContribute).toHaveBeenCalledWith('g1', 10000);
    const texts = tree.root
      .findAllByType(Text)
      .map((t) => [t.props.children].flat().join(''))
      .join(' ');
    expect(texts).toContain('Available to reserve');
    expect(texts).toContain('••••');
    expect(texts).not.toContain('₹5,000');
    const result = await add(reserved(), '100', 'withdraw');
    expect(mockContribute).toHaveBeenLastCalledWith('g1', -10000);
    await act(async () => {
      tree.unmount();
      result.tree.unmount();
    });
  });
  it('moves a reservation to the selected goal without creating a contribution', async () => {
    let tree!: ReactTestRenderer;
    const changed = jest.fn();
    await act(async () => {
      tree = create(<ContributeModal goal={reserved()} onClose={jest.fn()} onContributed={changed} />);
    });
    await act(async () =>
      tree.root.find((n) => n.props.options && typeof n.props.onChange === 'function').props.onChange('move')
    );
    await act(async () =>
      tree.root
        .find((n) => n.props.label === 'Emergency' && typeof n.props.onPress === 'function')
        .props.onPress()
    );
    await act(async () => tree.root.findByProps({ testID: 'amount' }).props.onChangeText('100'));
    await act(async () =>
      tree.root
        .find((n) => n.props.title === 'Move reservation' && typeof n.props.onPress === 'function')
        .props.onPress()
    );
    expect(mockMove).toHaveBeenCalledWith('g1', 'g2', 10000);
    expect(mockContribute).not.toHaveBeenCalled();
    expect(changed).toHaveBeenCalledTimes(1);
    await act(async () => tree.unmount());
  });
  it('offers an explicit keep/release decision after completing a reservation goal', async () => {
    const { tree } = await add(
      goal({ reservesAccount: true, linkedAccountId: 'pot', currentAmountMinor: 900000 }),
      '1000'
    );
    expect(tree.root.findAll((n) => n.props.title === 'Keep reserved')).not.toHaveLength(0);
    await act(async () =>
      tree.root
        .find((n) => n.props.title === 'Release reservation' && typeof n.props.onPress === 'function')
        .props.onPress()
    );
    expect(mockRelease).toHaveBeenCalledWith('g1');
    await act(async () => tree.unmount());
  });
});
