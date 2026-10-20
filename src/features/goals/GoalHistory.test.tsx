import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { GoalHistory } from './GoalHistory';
import { listGoalActivity } from '@/db/goalHistory';
import { formatMoney } from '@/lib/money';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/db/goalHistory', () => ({ listGoalActivity: jest.fn() }));
let mockHidden = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHidden }) }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
let tree: ReactTestRenderer;
const entry = (amount: number) => ({
  id: String(amount),
  sequence: amount,
  amount_minor: amount,
  balance_after_minor: amount,
  kind: 'manual',
  currency: 'INR',
  created_at: '2026-10-20 01:00:00',
});
const text = () =>
  tree.root
    .findAllByType(Text)
    .map((n) => n.props.children)
    .flat(Infinity)
    .join('');
afterEach(() => {
  act(() => tree?.unmount());
  jest.resetAllMocks();
  mockHidden = false;
});
it('masks loaded journal amounts immediately when privacy is enabled', async () => {
  (listGoalActivity as jest.Mock).mockResolvedValue([entry(12300)]);
  await act(async () => {
    tree = create(<GoalHistory goalId="goal" />);
  });
  expect(text()).toContain(formatMoney(12300, 'INR'));
  mockHidden = true;
  await act(async () => tree.update(<GoalHistory goalId="goal" />));
  expect(text()).not.toContain(formatMoney(12300, 'INR'));
  expect(text()).toContain('Balance hidden');
});
it('refreshes unchanged-balance goal data and ignores the obsolete history response', async () => {
  let resolve!: (rows: unknown[]) => void;
  (listGoalActivity as jest.Mock)
    .mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    )
    .mockResolvedValueOnce([entry(20000)]);
  await act(async () => {
    tree = create(<GoalHistory goalId="goal" refreshToken={{}} />);
  });
  await act(async () => tree.update(<GoalHistory goalId="goal" refreshToken={{}} />));
  await act(async () => resolve([entry(10000)]));
  expect(listGoalActivity).toHaveBeenCalledTimes(2);
  expect(text()).toContain(formatMoney(20000, 'INR'));
  expect(text()).not.toContain(formatMoney(10000, 'INR'));
});
