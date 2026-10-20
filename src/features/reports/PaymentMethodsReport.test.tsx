import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { PaymentMethodsReport } from './PaymentMethodsReport';
import { paymentMethodTotals } from '@/db/paymentMethods';
import { PrimaryButton } from '@/components/PrimaryButton';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('@/db/paymentMethods', () => ({ paymentMethodTotals: jest.fn() }));
jest.mock('@/db/settings', () => ({ getCachedCurrency: () => 'INR' }));
let mockHidden = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHidden }) }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
let tree: ReactTestRenderer;
const props = { visible: true, range: { start: '2026-10-01', end: '2026-10-20' }, onClose: jest.fn() };
const text = () => tree.root.findAllByType(Text).map((n) => n.props.children);
afterEach(() => {
  act(() => tree?.unmount());
  jest.resetAllMocks();
  mockHidden = false;
});
it('retries a failed query instead of presenting it as empty', async () => {
  (paymentMethodTotals as jest.Mock).mockRejectedValueOnce(new Error('failed')).mockResolvedValueOnce([]);
  await act(async () => {
    tree = create(<PaymentMethodsReport {...props} />);
  });
  expect(tree.root.findByType(PrimaryButton).props.title).toBe('Retry methods');
  await act(async () => tree.root.findByType(PrimaryButton).props.onPress());
  expect(text()).toContain('No spending in this period.');
});
it('ignores an obsolete private response after privacy changes', async () => {
  let resolve!: (rows: unknown[]) => void;
  (paymentMethodTotals as jest.Mock)
    .mockReturnValueOnce(
      new Promise((r) => {
        resolve = r;
      })
    )
    .mockResolvedValueOnce([]);
  await act(async () => {
    tree = create(<PaymentMethodsReport {...props} />);
  });
  mockHidden = true;
  await act(async () => tree.update(<PaymentMethodsReport {...props} />));
  await act(async () => resolve([{ method: 'upi', totalMinor: 123456, count: 1 }]));
  expect(text()).not.toContain('UPI');
  expect(paymentMethodTotals).toHaveBeenLastCalledWith(props.range, true);
});
