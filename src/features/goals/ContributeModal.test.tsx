/** Adding money to a goal and the milestone note it can raise: made-up goals throughout. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

const mockShow = jest.fn();
const mockContribute = jest.fn(async () => {});
const mockSeen: { keys: string[] } = { keys: [] };
const mockHide = { current: false };

jest.mock('@/db/savingsGoals', () => ({
  contributeToGoal: (...a: unknown[]) => (mockContribute as (...x: unknown[]) => Promise<void>)(...a),
  markGoalLetterRevealed: jest.fn(async () => {}),
}));
jest.mock('@/db/settings', () => ({
  getCachedCurrency: () => 'INR',
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
  mockSeen.keys = [];
  mockHide.current = false;
});

describe('milestone note on a contribution', () => {
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

  it('celebrates 100% when there is no letter', async () => {
    await add(goal({ currentAmountMinor: 900_000 }), '1000');
    expect(mockShow.mock.calls[0][0].title).toBe('Goal reached');
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
