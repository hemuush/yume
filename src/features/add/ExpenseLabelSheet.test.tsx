import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { TextInput } from '@/components/Text';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Chip } from '@/components/Chip';
import { ExpenseLabelSheet } from './ExpenseLabelSheet';
import { listExpenseLabels } from '@/db/expenseLabels';
import { Keyboard } from 'react-native';

jest.mock('@/db/expenseLabels', () => ({ listExpenseLabels: jest.fn() }));
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: false }) }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({
    visible,
    children,
    footer,
  }: {
    visible: boolean;
    children: React.ReactNode;
    footer: React.ReactNode;
  }) =>
    visible ? (
      <>
        {children}
        {footer}
      </>
    ) : null,
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
let tree: ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers();
  (listExpenseLabels as jest.Mock).mockResolvedValue(['Lunch']);
});
afterEach(() => {
  act(() => tree?.unmount());
  jest.useRealTimers();
  jest.resetAllMocks();
});
async function render(value = '') {
  const pick = jest.fn(),
    close = jest.fn();
  await act(async () => {
    tree = create(<ExpenseLabelSheet visible value={value} onClose={close} onPick={pick} />);
  });
  await act(async () => {
    jest.advanceTimersByTime(200);
  });
  return { pick, close };
}
it('reuses a prior label as the only expense text field', async () => {
  const { pick, close } = await render();
  expect(tree.root.findAllByType(TextInput)).toHaveLength(1);
  act(() => tree.root.findByType(Chip).props.onPress());
  expect(pick).toHaveBeenCalledWith('Lunch');
  expect(close).toHaveBeenCalledTimes(1);
});
it('accepts a custom label or removes it without a second notes value', async () => {
  const { pick } = await render('Work');
  act(() => tree.root.findByType(TextInput).props.onChangeText('  Trip  '));
  act(() => tree.root.findByType(PrimaryButton).props.onPress());
  expect(pick).toHaveBeenLastCalledWith('Trip');
  act(() => tree.root.findByType(TextInput).props.onChangeText(''));
  act(() => tree.root.findByType(PrimaryButton).props.onPress());
  expect(pick).toHaveBeenLastCalledWith('');
});
it('allows a custom label if previous labels fail to load', async () => {
  (listExpenseLabels as jest.Mock).mockRejectedValue(new Error('busy'));
  const { pick } = await render('Commute');
  act(() => tree.root.findByType(PrimaryButton).props.onPress());
  expect(pick).toHaveBeenCalledWith('Commute');
});
it('does not force the keyboard open or reload suggestions while typing', async () => {
  await render();
  expect(tree.root.findByType(TextInput).props.autoFocus).not.toBe(true);
  act(() => tree.root.findByType(TextInput).props.onChangeText(' lun '));
  expect(tree.root.findByType(Chip).props.label).toBe('Lunch');
  expect(listExpenseLabels).toHaveBeenCalledTimes(1);
});
it('dismisses the keyboard before returning to the amount pad', async () => {
  const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => {});
  const { close } = await render();
  act(() => tree.root.findByType(Chip).props.onPress());
  expect(dismiss).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
  dismiss.mockRestore();
});
