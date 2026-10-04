/**
 * Editing a savings goal: the form opens from the goal, picking an account keeps "follow the balance" in step
 * with its type, saving sends the right payload, and the end-of-sheet link matches what the goal can safely do.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.setTimeout(120000); // cold module loading is slow while the whole suite runs in parallel

const mockUpdate = jest.fn(async (..._a: unknown[]) => undefined as unknown);
const mockArchive = jest.fn(async (..._a: unknown[]) => undefined as unknown);
const mockUnarchive = jest.fn(async (..._a: unknown[]) => undefined as unknown);
const mockDelete = jest.fn(async (..._a: unknown[]) => ({ id: 'snap' }) as unknown);
const mockRestore = jest.fn(async (..._a: unknown[]) => undefined as unknown);
const mockShowUndo = jest.fn();
const mockAlert = jest.fn();

jest.mock('@/db/savingsGoals', () => ({
  updateSavingsGoal: (...a: unknown[]) => mockUpdate(...a),
  archiveSavingsGoal: (...a: unknown[]) => mockArchive(...a),
  unarchiveSavingsGoal: (...a: unknown[]) => mockUnarchive(...a),
  deleteSavingsGoal: (...a: unknown[]) => mockDelete(...a),
  restoreSavingsGoal: (...a: unknown[]) => mockRestore(...a),
}));
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
jest.mock('@/components/AppDialog', () => ({ showAlert: (...a: unknown[]) => mockAlert(...a) }));
jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn(), warn: jest.fn(), confirm: jest.fn() } }));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
  SheetLink: (p: { label: string; onPress: () => void }) =>
    require('react').createElement(require('react-native').View, { testID: 'sheet-link', ...p }),
}));
jest.mock('./GoalSheetCard', () => ({
  GoalSheetCard: (p: { name: string }) =>
    require('react').createElement(require('react-native').View, { testID: 'card', ...p }),
}));
jest.mock('@/components/FormInput', () => ({
  FormInput: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: p.label, ...p }),
}));
jest.mock('@/components/AmountField', () => ({
  AmountField: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: p.label, ...p }),
}));
jest.mock('@/components/DateField', () => ({
  DateField: (p: { label: string }) =>
    require('react').createElement(require('react-native').View, { testID: p.label, ...p }),
}));
jest.mock('@/components/ToggleSwitch', () => ({
  ToggleSwitch: (p: { value: boolean }) =>
    require('react').createElement(require('react-native').View, { testID: 'by-date', ...p }),
}));
jest.mock('./GoalAccountField', () => ({
  GoalAccountField: (p: { accountId: string | null }) =>
    require('react').createElement(require('react-native').View, { testID: 'account', ...p }),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { GoalDetailModal } from './GoalDetailModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import type { Account, SavingsGoal } from '@/types';

const makeGoal = (over: Partial<SavingsGoal> = {}): SavingsGoal => ({
  id: 'g1',
  name: 'Test Goal',
  targetAmountMinor: 150_000,
  currentAmountMinor: 0,
  targetDate: null,
  linkedAccountId: null,
  tracksAccount: false,
  noteToSelf: null,
  letterRevealed: false,
  archived: false,
  createdAt: '2026-09-01 00:00:00',
  ...over,
});
const accounts = [
  { id: 'bank', name: 'Test Bank', type: 'bank' },
  { id: 'pot', name: 'Test Pot', type: 'savings' },
] as Account[];

const mounted: ReactTestRenderer[] = [];
const byId = (t: ReactTestRenderer, id: string) => t.root.findByProps({ testID: id });
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));
const saveButton = (t: ReactTestRenderer) => t.root.findByType(PrimaryButton);

async function render(goal: SavingsGoal | null = makeGoal(), onChanged = jest.fn()) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <GoalDetailModal goal={goal} accounts={accounts} onClose={jest.fn()} onChanged={onChanged} />
    );
  });
  mounted.push(tree);
  return { tree, onChanged };
}
const save = (t: ReactTestRenderer) =>
  act(async () => {
    await saveButton(t).props.onPress();
  });

afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
  mockUpdate.mockImplementation(async () => undefined);
});

describe('goal form', () => {
  it('renders nothing without a goal', async () => {
    const { tree } = await render(null);
    expect(tree.toJSON()).toBeNull();
  });

  it('opens filled from the goal, with the target in whole units', async () => {
    const { tree } = await render(makeGoal({ linkedAccountId: 'pot', tracksAccount: true }));
    expect(byId(tree, 'Goal name').props.value).toBe('Test Goal');
    expect(byId(tree, 'Target amount').props.value).toBe('1500');
    expect(byId(tree, 'account').props.accountId).toBe('pot');
    expect(byId(tree, 'account').props.tracks).toBe(true);
    expect(byId(tree, 'by-date').props.value).toBe(false);
  });

  it('refills when a different goal is opened', async () => {
    const { tree } = await render(makeGoal());
    await act(async () => {
      tree.update(
        <GoalDetailModal
          goal={makeGoal({ id: 'g2', name: 'Other Goal', targetAmountMinor: 300_000 })}
          accounts={accounts}
          onClose={jest.fn()}
          onChanged={jest.fn()}
        />
      );
    });
    expect(byId(tree, 'Goal name').props.value).toBe('Other Goal');
    expect(byId(tree, 'Target amount').props.value).toBe('3000');
  });
});

describe('account linking', () => {
  it('starts following when a savings account is picked and goes manual for any other', async () => {
    const { tree } = await render();
    await act(async () => byId(tree, 'account').props.onChangeAccount('pot'));
    expect(byId(tree, 'account').props.accountId).toBe('pot');
    expect(byId(tree, 'account').props.tracks).toBe(true);

    await act(async () => byId(tree, 'account').props.onChangeAccount('bank'));
    expect(byId(tree, 'account').props.accountId).toBe('bank');
    expect(byId(tree, 'account').props.tracks).toBe(false);

    await act(async () => byId(tree, 'account').props.onChangeAccount('pot'));
    await act(async () => byId(tree, 'account').props.onChangeAccount(null));
    expect(byId(tree, 'account').props.accountId).toBeNull();
    expect(byId(tree, 'account').props.tracks).toBe(false);
  });

  it('saves the account together with whether it follows it', async () => {
    const { tree, onChanged } = await render();
    await act(async () => byId(tree, 'account').props.onChangeAccount('pot'));
    await save(tree);
    expect(mockUpdate).toHaveBeenCalledWith('g1', {
      name: 'Test Goal',
      targetAmountMinor: 150_000,
      targetDate: null,
      linkedAccountId: 'pot',
      tracksAccount: true,
    });
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('lets the follow switch be turned off while keeping the account', async () => {
    const { tree } = await render(makeGoal({ linkedAccountId: 'pot', tracksAccount: true }));
    await act(async () => byId(tree, 'account').props.onChangeTracks(false));
    await save(tree);
    expect(mockUpdate).toHaveBeenCalledWith(
      'g1',
      expect.objectContaining({ linkedAccountId: 'pot', tracksAccount: false })
    );
  });
});

describe('saving', () => {
  it('trims the name, converts the target and sends the date only when "by a date" is on', async () => {
    const { tree } = await render();
    await act(async () => byId(tree, 'Goal name').props.onChangeText('  Renamed  '));
    await act(async () => byId(tree, 'Target amount').props.onChangeText('2500'));
    await act(async () => byId(tree, 'by-date').props.onChange(true));
    await act(async () => byId(tree, 'Target date').props.onChange('2027-03-01'));
    await save(tree);
    expect(mockUpdate).toHaveBeenCalledWith('g1', {
      name: 'Renamed',
      targetAmountMinor: 250_000,
      targetDate: '2027-03-01',
      linkedAccountId: null,
      tracksAccount: false,
    });
  });

  it('refuses a blank name', async () => {
    const { tree } = await render();
    await act(async () => byId(tree, 'Goal name').props.onChangeText('   '));
    await save(tree);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Enter a name');
  });

  it.each(['', '0', 'abc'])('refuses a target of "%s"', async (typed) => {
    const { tree, onChanged } = await render();
    await act(async () => byId(tree, 'Target amount').props.onChangeText(typed));
    await save(tree);
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(onChanged).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Enter a valid target amount');
  });

  it('shows the database failure and stays open', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('write failed'));
    const { tree, onChanged } = await render();
    await save(tree);
    expect(onChanged).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('write failed');
    expect(saveButton(tree).props.disabled).toBe(false);
  });
});

describe('archive and delete', () => {
  const link = (t: ReactTestRenderer) => byId(t, 'sheet-link');

  it('offers Archive, not Delete, once progress was added by hand', async () => {
    const { tree } = await render(makeGoal({ currentAmountMinor: 20_000 }));
    expect(link(tree).props.label).toBe('Archive goal');
    await act(async () => link(tree).props.onPress());
    expect(mockAlert).toHaveBeenCalledWith('Archive this goal?', expect.any(String), expect.any(Array));
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('archives only after the confirmation is accepted', async () => {
    const { tree, onChanged } = await render(makeGoal({ currentAmountMinor: 20_000 }));
    await act(async () => link(tree).props.onPress());
    const buttons = mockAlert.mock.calls[0][2] as { text: string; onPress?: () => Promise<void> }[];
    expect(mockArchive).not.toHaveBeenCalled();
    await act(async () => {
      await buttons.find((b) => b.text === 'Archive')!.onPress!();
    });
    expect(mockArchive).toHaveBeenCalledWith('g1');
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('offers Delete for a never-funded goal and for one following an account, with undo', async () => {
    const funded = makeGoal({ currentAmountMinor: 90_000, tracksAccount: true, linkedAccountId: 'pot' });
    for (const goal of [makeGoal(), funded]) {
      mockDelete.mockClear();
      mockShowUndo.mockClear();
      const { tree, onChanged } = await render(goal);
      expect(link(tree).props.label).toBe('Delete goal');
      await act(async () => {
        await link(tree).props.onPress();
      });
      expect(mockDelete).toHaveBeenCalledWith('g1');
      expect(onChanged).toHaveBeenCalledTimes(1);
      expect(mockShowUndo).toHaveBeenCalledWith('Deleted "Test Goal"', expect.any(Function));
      await act(async () => {
        await mockShowUndo.mock.calls[0][1]();
      });
      expect(mockRestore).toHaveBeenCalledWith({ id: 'snap' });
    }
  });

  it('offers Unarchive for an archived goal', async () => {
    const { tree, onChanged } = await render(makeGoal({ archived: true, currentAmountMinor: 5_000 }));
    expect(link(tree).props.label).toBe('Unarchive goal');
    await act(async () => {
      await link(tree).props.onPress();
    });
    expect(mockUnarchive).toHaveBeenCalledWith('g1');
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
