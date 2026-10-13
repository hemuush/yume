jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from '@/components/Text';
import { Text, Keyboard } from 'react-native';
import { ModalSheet } from '@/components/ModalSheet';
import { ExpenseLabelsReport } from './ExpenseLabelsReport';
import { expenseLabelTotals } from '@/db/expenseLabels';
import { PrimaryButton } from '@/components/PrimaryButton';
jest.mock('@/db/expenseLabels', () => ({ expenseLabelTotals: jest.fn() }));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: true }) }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('@/components/Amount', () => ({
  Amount: ({ minor }: { minor: number }) =>
    require('react').createElement(require('react-native').Text, null, minor),
}));
let tree: ReactTestRenderer;
afterEach(() => {
  act(() => tree?.unmount());
  jest.resetAllMocks();
});
it('retries a failed load without showing an empty report as success', async () => {
  (expenseLabelTotals as jest.Mock).mockRejectedValueOnce(new Error('read failed')).mockResolvedValueOnce([]);
  await act(async () => {
    tree = create(
      <ExpenseLabelsReport visible range={{ start: '2026-10-01', end: '2026-10-13' }} onClose={jest.fn()} />
    );
  });
  expect(tree.root.findByType(PrimaryButton).props.title).toBe('Retry labels');
  await act(async () => tree.root.findByType(PrimaryButton).props.onPress());
  expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toContain(
    'No spending in this period.'
  );
});

it('ignores an old response after changing the selected period', async () => {
  let resolveOld!: (rows: { label: string; totalMinor: number; count: number }[]) => void;
  (expenseLabelTotals as jest.Mock)
    .mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      })
    )
    .mockResolvedValueOnce([{ label: 'Current', totalMinor: 500, count: 1 }]);
  await act(async () => {
    tree = create(
      <ExpenseLabelsReport visible range={{ start: '2026-09-01', end: '2026-09-30' }} onClose={jest.fn()} />
    );
  });
  await act(async () =>
    tree.update(
      <ExpenseLabelsReport visible range={{ start: '2026-10-01', end: '2026-10-13' }} onClose={jest.fn()} />
    )
  );
  await act(async () => resolveOld([{ label: 'Old', totalMinor: 900, count: 1 }]));
  const text = tree.root.findAllByType(Text).map((node) => node.props.children);
  expect(text).toContain('Current');
  expect(text).not.toContain('Old');
});
it('uses the selected dates/privacy scope and searches label totals', async () => {
  (expenseLabelTotals as jest.Mock).mockResolvedValue([
    { label: 'Lunch', totalMinor: 2600, count: 2 },
    { label: '', totalMinor: 500, count: 1 },
  ]);
  await act(async () => {
    tree = create(
      <ExpenseLabelsReport visible range={{ start: '2026-10-01', end: '2026-10-13' }} onClose={jest.fn()} />
    );
  });
  expect(expenseLabelTotals).toHaveBeenCalledWith('2026-10-01', '2026-10-13', true);
  expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toContain(3100);
  expect(tree.root.findAllByType(Text).map((node) => node.props.children)).toContain('No label');
  act(() => tree.root.findByType(TextInput).props.onChangeText(' lunch '));
  const visible = tree.root.findAllByType(Text).map((node) => node.props.children);
  expect(visible).toContain('Lunch');
  expect(visible).not.toContain('No label');
  expect(visible).toContain(3100);
  expect(expenseLabelTotals).toHaveBeenCalledTimes(1);
  act(() => tree.root.findByProps({ accessibilityLabel: 'Clear label search' }).props.onPress());
  expect(tree.root.findByType(TextInput).props.value).toBe('');
});
it('dismisses the keyboard on done and close without forcing focus', async () => {
  (expenseLabelTotals as jest.Mock).mockResolvedValue([]);
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const close = jest.fn();
  await act(async () => {
    tree = create(
      <ExpenseLabelsReport visible range={{ start: '2026-10-01', end: '2026-10-13' }} onClose={close} />
    );
  });
  expect(tree.root.findByType(TextInput).props.autoFocus).not.toBe(true);
  act(() => tree.root.findByType(TextInput).props.onSubmitEditing());
  act(() => tree.root.findByType(ModalSheet).props.onClose());
  expect(dismiss).toHaveBeenCalledTimes(2);
  expect(close).toHaveBeenCalledTimes(1);
  dismiss.mockRestore();
});
