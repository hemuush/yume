/**
 * Goals that follow an account, on screen: the card says which account it
 * follows and its button moves money there instead of "+ Add money"; the
 * new-goal form starts a savings account on Follow, saves the choice, and
 * warns when another goal already follows the same account.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children, footer }: { visible: boolean; children: any; footer?: any }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: () => null }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const mockFollowing = { current: [] as string[] };
jest.mock('@/db/savingsGoals', () => ({
  createSavingsGoal: jest.fn(async () => ({})),
  goalsFollowingAccount: jest.fn(async () => mockFollowing.current),
}));

import { GoalCard } from './GoalCard';
import { AddGoalModal } from './AddGoalModal';
import { router } from 'expo-router';
import { createSavingsGoal } from '@/db/savingsGoals';
import { Account, SavingsGoal } from '@/types';

// Bars and rings animate to their values (useGrowFrom, at most the 700ms draw):
// let the last ones finish before the file ends, so no frame fires after teardown.
afterAll(() => new Promise((resolve) => setTimeout(resolve, 800)));

const goal: SavingsGoal = {
  id: 'g1',
  name: 'Rainy day',
  targetAmountMinor: 15000000,
  currentAmountMinor: 5400000,
  targetDate: null,
  linkedAccountId: 'pot',
  tracksAccount: true,
  noteToSelf: null,
  letterRevealed: false,
  archived: false,
  createdAt: '2026-09-01 00:00:00',
};
const accounts = [
  { id: 'bank', name: 'Bank', type: 'bank' },
  { id: 'pot', name: 'Pot', type: 'savings' },
] as Account[];

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [t.props.children].flat().join(''));
// The innermost pressable holding that text — the card itself also takes an onPress.
const pressText = (tree: ReactTestRenderer, label: string) =>
  tree.root
    .findAll(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((t) => [t.props.children].flat().join('') === label)
    )
    .at(-1)!
    .props.onPress();
const settle = () => act(async () => new Promise((r) => setTimeout(r, 0)));

beforeAll(async () => {
  await act(async () => {
    create(<GoalCard goal={goal} accountName="Pot" onPress={jest.fn()} onContribute={jest.fn()} />);
  });
}, 180000);

describe('GoalCard following an account', () => {
  it('names the account and moves money into it', async () => {
    const onContribute = jest.fn();
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <GoalCard goal={goal} accountName="Pot" onPress={jest.fn()} onContribute={onContribute} />
      );
    });
    expect(texts(tree)).toContain('Following Pot');
    expect(texts(tree)).not.toContain('+ Add money');
    act(() => pressText(tree, 'Move money here'));
    expect(router.push).toHaveBeenCalledWith('/add-transaction?type=transfer&toAccountId=pot');
    expect(onContribute).not.toHaveBeenCalled();
  });

  it('keeps + Add money for a goal filled by hand', async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(
        <GoalCard goal={{ ...goal, tracksAccount: false }} onPress={jest.fn()} onContribute={jest.fn()} />
      );
    });
    expect(texts(tree)).toContain('+ Add money');
    expect(texts(tree).some((t) => t.startsWith('Following'))).toBe(false);
  });
});

describe('the new-goal form', () => {
  const fill = async (tree: ReactTestRenderer) => {
    const inputs = tree.root.findAll(
      (n) => typeof n.props.onChangeText === 'function' && n.props.placeholder
    );
    await act(async () => {
      inputs.find((i) => i.props.placeholder === 'e.g. Goa trip')!.props.onChangeText('Rainy day');
      inputs.find((i) => i.props.placeholder === 'e.g. 40000')!.props.onChangeText('150000');
    });
  };
  const render = async () => {
    let tree!: ReactTestRenderer;
    await act(async () => {
      tree = create(<AddGoalModal visible accounts={accounts} onClose={jest.fn()} onCreated={jest.fn()} />);
    });
    return tree;
  };

  it('starts a savings account on Follow and saves it that way', async () => {
    mockFollowing.current = [];
    const tree = await render();
    await fill(tree);
    await act(async () => pressText(tree, 'Pot'));
    const follow = tree.root.find((n) => n.props.accessibilityLabel === 'Follow Pot' && n.props.onPress);
    expect(follow.props.accessibilityState).toEqual({ checked: true });
    await act(async () => pressText(tree, 'Create goal'));
    expect(createSavingsGoal).toHaveBeenCalledWith(
      expect.objectContaining({ linkedAccountId: 'pot', tracksAccount: true, targetAmountMinor: 15000000 })
    );
  });

  it('starts any other account on adding money by hand', async () => {
    const tree = await render();
    await fill(tree);
    await act(async () => pressText(tree, 'Bank'));
    await act(async () => pressText(tree, 'Create goal'));
    expect(createSavingsGoal).toHaveBeenCalledWith(
      expect.objectContaining({ linkedAccountId: 'bank', tracksAccount: false })
    );
  });

  it('warns when another goal already follows that account', async () => {
    mockFollowing.current = ['Goa trip'];
    const tree = await render();
    await act(async () => pressText(tree, 'Pot'));
    await settle();
    expect(texts(tree)).toContain('Goa trip already follows Pot. Both will show the same balance.');
  });
});
