import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Account, RecurringRule } from '@/types';
import { Text } from 'react-native';
const mockPrivacy = { hideAmounts: false };
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => mockPrivacy }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/db/annualBills', () => ({
  ...jest.requireActual('@/db/annualBills'),
  getAnnualBillGoal: jest.fn(async () => null),
  prepareAnnualBill: jest.fn(async () => 'goal'),
  unlinkAnnualBill: jest.fn(async () => {}),
}));
jest.mock('@/db/savingsGoals', () => ({ listSavingsGoals: jest.fn(async () => []) }));
import { AnnualBillPreparation } from './AnnualBillPreparation';
import { prepareAnnualBill, getAnnualBillGoal } from '@/db/annualBills';
it('creates preparation only after the user selects its funding account', async () => {
  let tree!: ReactTestRenderer;
  const rule = {
    id: 'annual',
    accountId: 'bank',
    type: 'expense',
    frequency: 'yearly',
    active: true,
    amountMinor: 240000,
    nextRunDate: '2027-04-12',
  } as RecurringRule;
  await act(async () => {
    tree = create(
      <AnnualBillPreparation
        rule={rule}
        accounts={[{ id: 'bank', name: 'Bank', type: 'bank', currency: 'INR' } as Account]}
        onNavigate={jest.fn()}
      />
    );
  });
  expect(tree.root.findAll((n) => n.props.title === 'Create preparation goal')).toHaveLength(0);
  await act(async () =>
    tree.root
      .find(
        (n) => n.props.accessibilityLabel === 'Set up preparation' && typeof n.props.onPress === 'function'
      )
      .props.onPress()
  );
  expect(tree.root.find((n) => n.props.title === 'Create preparation goal').props.disabled).toBe(true);
  await act(async () =>
    tree.root.find((n) => n.props.label === 'Bank' && typeof n.props.onPress === 'function').props.onPress()
  );
  await act(async () =>
    tree.root
      .find((n) => n.props.title === 'Create preparation goal' && typeof n.props.onPress === 'function')
      .props.onPress()
  );
  expect(prepareAnnualBill).toHaveBeenCalledWith('annual', { accountId: 'bank' });
  await act(async () => tree.unmount());
});
it('does not offer preparation setup for a paused recurring entry', async () => {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <AnnualBillPreparation
        rule={
          {
            id: 'paused',
            accountId: 'bank',
            amountMinor: 240000,
            nextRunDate: '2027-04-12',
            active: false,
          } as RecurringRule
        }
        accounts={[]}
        onNavigate={jest.fn()}
      />
    );
  });
  expect(tree.root.findAll((n) => n.props.accessibilityLabel === 'Set up preparation')).toHaveLength(0);
  expect(tree.root.findAll((n) => n.props.title === 'Create preparation goal')).toHaveLength(0);
  await act(async () => tree.unmount());
});
it('offers an explicit retry after a preparation read fails', async () => {
  jest.mocked(getAnnualBillGoal).mockRejectedValueOnce(new Error('Database unavailable'));
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <AnnualBillPreparation
        rule={
          {
            id: 'annual',
            accountId: 'bank',
            amountMinor: 240000,
            nextRunDate: '2027-04-12',
            active: true,
          } as RecurringRule
        }
        accounts={[]}
        onNavigate={jest.fn()}
      />
    );
  });
  await act(async () =>
    tree.root
      .find((n) => n.props.title === 'Retry preparation' && typeof n.props.onPress === 'function')
      .props.onPress()
  );
  await act(async () =>
    tree.root
      .find(
        (n) => n.props.accessibilityLabel === 'Set up preparation' && typeof n.props.onPress === 'function'
      )
      .props.onPress()
  );
  expect(tree.root.find((n) => n.props.title === 'Create preparation goal').props.disabled).toBe(true);
  await act(async () => tree.unmount());
});

it.each([false, true])('only masks unreserved preparation for a sensitive bill: %s', async (sensitive) => {
  mockPrivacy.hideAmounts = true;
  jest.mocked(getAnnualBillGoal).mockResolvedValueOnce(null);
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <AnnualBillPreparation
        rule={
          {
            id: 'annual',
            accountId: 'bank',
            amountMinor: 240000,
            nextRunDate: '2099-04-12',
            active: true,
          } as RecurringRule
        }
        accounts={[]}
        onNavigate={jest.fn()}
        sensitive={sensitive}
      />
    );
  });
  const text = tree.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().join(''))
    .join(' ');
  expect(text.includes('₹2,400')).toBe(!sensitive);
  expect(text.includes('••••')).toBe(sensitive);
  await act(async () => tree.unmount());
  mockPrivacy.hideAmounts = false;
});

it('keeps linked goal reservations private while showing an ordinary bill amount', async () => {
  mockPrivacy.hideAmounts = true;
  jest
    .mocked(getAnnualBillGoal)
    .mockResolvedValueOnce({ id: 'goal', name: 'Preparation', archived: 0, reserved_amount_minor: 120000 });
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <AnnualBillPreparation
        rule={
          {
            id: 'annual',
            accountId: 'bank',
            amountMinor: 240000,
            nextRunDate: '2099-04-12',
            active: true,
          } as RecurringRule
        }
        accounts={[]}
        onNavigate={jest.fn()}
      />
    );
  });
  const text = tree.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat().join(''))
    .join(' ');
  expect(text).toContain('₹2,400');
  expect(text).not.toContain('₹1,200');
  expect(text).toContain('••••');
  await act(async () => tree.unmount());
  mockPrivacy.hideAmounts = false;
});
