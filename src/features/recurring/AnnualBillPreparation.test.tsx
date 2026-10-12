import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Account, RecurringRule } from '@/types';
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
