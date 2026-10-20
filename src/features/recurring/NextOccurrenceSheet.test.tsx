import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { NextOccurrenceSheet } from './NextOccurrenceSheet';
import { SheetTabs } from '@/components/SheetTabs';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AmountField } from '@/components/AmountField';
import { changeNextOccurrence } from '@/db/recurringOccurrence';
import type { RecurringRule } from '@/types';
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: React.ReactNode; footer: React.ReactNode }) => (
    <>
      {children}
      {footer}
    </>
  ),
}));
jest.mock('@/components/DateField', () => ({ DateField: () => null }));
jest.mock('@/db/recurringOccurrence', () => ({ changeNextOccurrence: jest.fn() }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8FCBFF' }) }));
const rule = { id: 'r', amountMinor: 12345, nextRunDate: '2026-10-20' } as RecurringRule;
let tree: ReactTestRenderer;
afterEach(() => {
  act(() => tree?.unmount());
  jest.resetAllMocks();
});
it('preserves stored paise when the occurrence amount is untouched', async () => {
  (changeNextOccurrence as jest.Mock).mockResolvedValue(undefined);
  await act(async () => {
    tree = create(<NextOccurrenceSheet rule={rule} onClose={jest.fn()} onSaved={jest.fn()} />);
  });
  await act(async () => tree.root.findByType(PrimaryButton).props.onPress());
  expect(changeNextOccurrence).toHaveBeenCalledWith('r', rule.nextRunDate, {
    kind: 'change',
    date: rule.nextRunDate,
    amountMinor: 12345,
  });
});
it('quantizes a new amount and prevents a second submission while saving', async () => {
  let resolve!: () => void;
  (changeNextOccurrence as jest.Mock).mockReturnValue(
    new Promise<void>((r) => {
      resolve = r;
    })
  );
  await act(async () => {
    tree = create(<NextOccurrenceSheet rule={rule} onClose={jest.fn()} onSaved={jest.fn()} />);
  });
  act(() => tree.root.findByType(AmountField).props.onChangeText('200'));
  act(() => tree.root.findByType(SheetTabs).props.onChange('confirm'));
  let pending!: Promise<void>;
  act(() => {
    const press = tree.root.findByType(PrimaryButton).props.onPress;
    pending = press();
    void press();
  });
  expect(changeNextOccurrence).toHaveBeenCalledTimes(1);
  expect((changeNextOccurrence as jest.Mock).mock.calls[0][2]).toMatchObject({
    kind: 'confirm',
    amountMinor: 20000,
  });
  await act(async () => {
    resolve();
    await pending;
  });
});
