import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ visible, children, footer }: any) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));
let mockHide = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHide }) }));
jest.mock('./GoalDetailModal', () => ({
  GoalDetailModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'goal-edit' }),
}));
jest.mock('./ContributeModal', () => ({
  ContributeModal: (props: object) =>
    require('react').createElement(require('react-native').View, { ...props, testID: 'goal-contribute' }),
}));
import { GoalOverviewModal } from './GoalOverviewModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import type { Account, SavingsGoal } from '@/types';
const goal: SavingsGoal = {
  id: 'g1',
  name: 'Emergency fund',
  targetAmountMinor: 500000,
  currentAmountMinor: 100000,
  targetDate: null,
  linkedAccountId: null,
  tracksAccount: false,
  archived: false,
  createdAt: '2026-01-01',
  noteToSelf: null,
  letterRevealed: false,
};
const accounts = [{ id: 'savings', name: 'Savings', type: 'savings', archived: false }] as Account[];
const changed = jest.fn(),
  moved = jest.fn();
const roots: ReactTestRenderer[] = [];
const words = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().join(''))
    .join(' ');
const button = (tree: ReactTestRenderer, title: string) =>
  tree.root.findAllByType(PrimaryButton).find((n) => n.props.title === title)!;
function render(value = goal, linked = accounts) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <GoalOverviewModal
        goal={value}
        accounts={linked}
        onClose={jest.fn()}
        onChanged={changed}
        onMoveMoney={moved}
      />
    );
  });
  roots.push(tree);
  return tree;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockHide = false;
});
afterEach(() => act(() => roots.splice(0).forEach((tree) => tree.unmount())));
it('starts read-only and returns from editing without changing progress', () => {
  const tree = render();
  expect(words(tree)).toContain('₹4,000');
  expect(tree.root.findAllByProps({ testID: 'goal-edit' })).toHaveLength(0);
  act(() => button(tree, 'Edit goal').props.onPress());
  const edit = tree.root.findByProps({ testID: 'goal-edit' });
  expect(edit.props.goal.id).toBe('g1');
  expect(edit.props.backLabel).toBe('Back to goal overview');
  act(() => edit.props.onClose());
  expect(button(tree, 'Add money')).toBeDefined();
  expect(changed).not.toHaveBeenCalled();
});
it('uses the existing contribution flow and refreshes after saving', async () => {
  const tree = render();
  act(() => button(tree, 'Add money').props.onPress());
  const contribute = tree.root.findByProps({ testID: 'goal-contribute' });
  expect(contribute.props.goal.id).toBe('g1');
  expect(contribute.props.backLabel).toBe('Back to goal overview');
  await act(async () => {
    await contribute.props.onContributed();
  });
  expect(changed).toHaveBeenCalledTimes(1);
  expect(button(tree, 'Edit goal')).toBeDefined();
});
it('moves money to a following account rather than adding manual progress', () => {
  const tree = render({ ...goal, linkedAccountId: 'savings', tracksAccount: true });
  act(() => {
    button(tree, 'Move money').props.onPress();
    button(tree, 'Move money').props.onPress();
  });
  expect(moved).toHaveBeenCalledTimes(1);
  expect(moved).toHaveBeenCalledWith('savings');
  expect(tree.root.findAllByProps({ testID: 'goal-contribute' })).toHaveLength(0);
});
it('blocks moving money when the following account is missing', () => {
  const tree = render({ ...goal, linkedAccountId: null, tracksAccount: true }, []);
  expect(button(tree, 'Move money').props.disabled).toBe(true);
  act(() => button(tree, 'Move money').props.onPress());
  expect(moved).not.toHaveBeenCalled();
  expect(words(tree)).toContain('Edit the goal');
});
it('keeps reservations on their existing reserve/release flow', () => {
  const reserved = { ...goal, linkedAccountId: 'savings', reservesAccount: true };
  const tree = render(reserved);
  act(() => button(tree, 'Reserve / release').props.onPress());
  expect(tree.root.findByProps({ testID: 'goal-contribute' }).props.goal.reservesAccount).toBe(true);
  expect(moved).not.toHaveBeenCalled();
});
it('hides saved amounts, remaining money and completion while keeping the target readable', () => {
  mockHide = true;
  const tree = render({ ...goal, currentAmountMinor: 600000 });
  const text = words(tree);
  expect(text).toContain('₹5,000');
  expect(text).toContain('••••');
  expect(text).not.toContain('₹6,000');
  expect(text).not.toContain('Reached');
  expect(text).not.toContain('Target reached');
  expect(text).not.toMatch(/\d+%/);
});
