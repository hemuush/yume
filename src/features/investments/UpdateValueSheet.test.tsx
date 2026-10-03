/**
 * Updating a tracked account's worth: the estimate chip fills the account's figure, saving adds/edits the
 * update, empty or bad values are refused, delete offers undo. Made-up figures.
 */
import { Text, TextInput } from 'react-native';
import { create, act, ReactTestRenderer } from 'react-test-renderer';

jest.setTimeout(30000);

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/ModalSheet', () => {
  const { View, Pressable: P } = require('react-native');
  return {
    ModalSheet: ({ children, footer }: any) => (
      <View>
        {children}
        {footer}
      </View>
    ),
    SheetFooter: ({ children, onDelete }: any) => (
      <View>
        {onDelete && <P accessibilityLabel="Delete this value" onPress={onDelete} />}
        {children}
      </View>
    ),
  };
});
jest.mock('@/components/DateField', () => ({ DateField: () => null }));
jest.mock('@/components/SheetCard', () => ({ SheetCard: () => null }));
jest.mock('@/lib/haptics', () => ({ haptics: { confirm: jest.fn(), tap: jest.fn(), warn: jest.fn() } }));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
jest.mock('@/theme/PrivacyContext', () => ({
  usePrivacy: () => ({ hideAmounts: false, toggleHideAmounts: jest.fn() }),
}));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#8CCED6', dot: '#8CCED6' }) }));
jest.mock('@/db/valuations', () => ({
  addValuation: jest.fn(async () => ({})),
  updateValuation: jest.fn(async () => ({})),
  deleteValuation: jest.fn(async () => ({ table: 'account_valuations', row: {} })),
  restoreValuation: jest.fn(async () => undefined),
}));

import { UpdateValueSheet } from './UpdateValueSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { addValuation, updateValuation, deleteValuation, restoreValuation } from '@/db/valuations';
import { toLocalIsoDate } from '@/lib/date';
import type { Account } from '@/types';

const account = {
  id: 'fund',
  name: 'Index fund',
  type: 'savings',
  currency: 'INR',
  archived: false,
  currentBalanceMinor: 4_456_000,
  investment: {
    investedMinor: 4_200_000,
    takenOutMinor: 0,
    gainMinor: 256_000,
    valuedAt: '2026-09-28',
    lastValueMinor: 4_306_000,
  },
} as unknown as Account;

const today = toLocalIsoDate(new Date());

function render(props: Partial<React.ComponentProps<typeof UpdateValueSheet>> = {}) {
  const onSaved = jest.fn();
  const onDeleted = jest.fn();
  let r!: ReactTestRenderer;
  act(() => {
    r = create(
      <UpdateValueSheet
        account={account}
        visible
        onClose={jest.fn()}
        onSaved={onSaved}
        onDeleted={onDeleted}
        {...props}
      />
    );
  });
  return { r, onSaved, onDeleted };
}

const shown = (r: ReactTestRenderer) =>
  r.root
    .findAllByType(Text)
    .map((t) => [t.props.children].flat().join(''))
    .join(' | ');
const press = (r: ReactTestRenderer, label: string) =>
  act(() => {
    r.root.findByProps({ accessibilityLabel: label }).props.onPress();
  });
const save = async (r: ReactTestRenderer) => {
  const btn = r.root.findAllByType(PrimaryButton)[0];
  await act(async () => {
    btn.props.onPress();
  });
};
const type = (r: ReactTestRenderer, text: string) =>
  act(() => {
    r.root.findByType(TextInput).props.onChangeText(text);
  });

describe('UpdateValueSheet', () => {
  it('offers the accounts own figure as the estimate and explains it', () => {
    const { r } = render();
    expect(shown(r)).toContain('Use ₹44,560');
    expect(shown(r)).toContain("Your last update plus the ₹1,500 you've put in since.");
    press(r, 'Use the estimate ₹44,560');
    expect(r.root.findByType(TextInput).props.value).toBe('44560');
  });

  it('shows how the gain changes once a value is typed', () => {
    const { r } = render();
    type(r, '45000');
    expect(shown(r)).toContain('Gain was +₹2,560, becomes +₹3,000 · +7.1%');
  });

  it('refuses an empty value', async () => {
    const { r, onSaved } = render();
    await save(r);
    expect(shown(r)).toContain('Enter what it is worth');
    expect(addValuation).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('saves a new value as of today', async () => {
    const { r, onSaved } = render();
    type(r, '44560');
    await save(r);
    expect(addValuation).toHaveBeenCalledWith('fund', { date: today, valueMinor: 4_456_000 });
    expect(onSaved).toHaveBeenCalled();
  });

  it('edits an earlier update instead of adding one', async () => {
    const valuation = {
      id: 'v1',
      accountId: 'fund',
      date: '2026-09-28',
      valueMinor: 4_306_000,
      investedMinor: 4_050_000,
      takenOutMinor: 0,
      gainMinor: 256_000,
    };
    const { r, onSaved } = render({ valuation });
    expect(r.root.findByType(TextInput).props.value).toBe('43060');
    type(r, '43500');
    await save(r);
    expect(updateValuation).toHaveBeenCalledWith('v1', { date: '2026-09-28', valueMinor: 4_350_000 });
    expect(addValuation).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it('deletes an update and offers undo that restores it', async () => {
    const valuation = {
      id: 'v1',
      accountId: 'fund',
      date: '2026-09-28',
      valueMinor: 4_306_000,
      investedMinor: 4_050_000,
      takenOutMinor: 0,
      gainMinor: 256_000,
    };
    const { r, onSaved, onDeleted } = render({ valuation });
    await act(async () => {
      r.root.findByProps({ accessibilityLabel: 'Delete this value' }).props.onPress();
    });
    expect(deleteValuation).toHaveBeenCalledWith('v1');
    expect(onDeleted).toHaveBeenCalled();
    expect(mockShowUndo).toHaveBeenCalledTimes(1);
    await act(async () => {
      await mockShowUndo.mock.calls[0][1]();
    });
    expect(restoreValuation).toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });
});
