/**
 * The recurring sheet: its card previews the rule as it will be logged, a new rule opens on the category
 * grid, Schedule shows the next three dates, and Delete is a quiet link that still deletes with an undo.
 */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: React.ReactNode; footer?: React.ReactNode }) => (
    <>
      {children}
      {footer}
    </>
  ),
  SheetLink: ({ label, onPress }: { label: string; onPress: () => void }) => {
    const { Pressable, Text: RNText } = require('react-native');
    return (
      <Pressable onPress={onPress}>
        <RNText>{label}</RNText>
      </Pressable>
    );
  },
}));
jest.mock('@/components/DateField', () => ({ DateField: () => null }));
jest.mock('@/components/ToggleSwitch', () => ({ ToggleSwitch: () => null }));
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#A6B4F2', secondary: '#8FE8C8' }),
}));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
jest.mock('@/db/recurring', () => ({
  ...jest.requireActual('@/db/recurring'),
  deleteRecurringRule: jest.fn(async () => ({ snapshot: true })),
  updateRecurringRule: jest.fn(async () => {}),
  setRecurringRuleActive: jest.fn(async () => {}),
}));

import { RuleModal } from './RuleModal';
import { deleteRecurringRule, updateRecurringRule } from '@/db/recurring';
import { weekdayDayMonth } from '@/lib/dateLabels';
import { PrimaryButton } from '@/components/PrimaryButton';
import { AmountField } from '@/components/AmountField';

const accounts = [{ id: 'sbi', name: 'SBI', type: 'bank' } as any];
const categories = [
  {
    id: 'subs',
    name: 'YouTube Premium',
    kind: 'expense',
    icon: 'youtube',
    color: '#F27E8C',
    parentId: null,
  } as any,
];
const rule = {
  id: 'r1',
  type: 'expense',
  accountId: 'sbi',
  toAccountId: null,
  categoryId: 'subs',
  amountMinor: 29900,
  note: '',
  frequency: 'monthly',
  intervalCount: 1,
  nextRunDate: '2026-10-01',
  endDate: null,
  active: true,
} as any;

const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((t) => [].concat(t.props.children).join(''));

async function render(editing: typeof rule | null) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <RuleModal
        visible
        editing={editing}
        accounts={accounts}
        categories={categories}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        onDeleted={jest.fn()}
      />
    );
  });
  return tree;
}

describe('recurring sheet', () => {
  it('includes the end date but never previews a run after it', async () => {
    const tree = await render({ ...rule, endDate: '2026-11-01' });
    act(() =>
      tree.root.find((n) => n.props.value === 'setup' && n.props.onChange).props.onChange('schedule')
    );
    const t = texts(tree);
    const i = t.indexOf('Coming up');
    expect(t.slice(i + 1, i + 5)).toEqual(['01', 'OCT', '01', 'NOV']);
    expect(t.slice(i + 1)).not.toContain('DEC');
    act(() => tree.unmount());
  });
  it('keeps rule context compact and the amount editable', async () => {
    const tree = await render(rule);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Every month', 'YouTube Premium']));
    expect(tree.root.findByType(AmountField).props.value).toBe('299');
    expect(texts(tree)).toContain(`From SBI · next ${weekdayDayMonth('2026-10-01')}`);
  });

  it('opens a new rule on the category grid', async () => {
    const tree = await render(null);
    expect(tree.root.findAll((n) => n.props.variant === 'medal' && n.props.onSelect)).toHaveLength(1);
  });

  it('shows the next three dates on the Schedule page', async () => {
    const tree = await render(rule);
    act(() =>
      tree.root.find((n) => n.props.value === 'setup' && n.props.onChange).props.onChange('schedule')
    );
    const t = texts(tree);
    const i = t.indexOf('Coming up');
    expect(t.slice(i + 1, i + 7)).toEqual(['01', 'OCT', '01', 'NOV', '01', 'DEC']);
  });

  it('deletes from the quiet link, with an undo', async () => {
    const tree = await render(rule);
    expect(texts(tree)).not.toContain('Delete recurring entry');
    const more = tree.root.findAll(
      (n) => n.props.accessibilityLabel === 'More options' && typeof n.props.onPress === 'function'
    )[0];
    act(() => more.props.onPress());
    const link = tree.root.find(
      (n) =>
        typeof n.props.onPress === 'function' &&
        n.findAllByType(Text).some((c) => c.props.children === 'Delete recurring entry')
    );
    await act(async () => {
      await link.props.onPress();
    });
    expect(deleteRecurringRule).toHaveBeenCalledWith('r1');
    expect(mockShowUndo).toHaveBeenCalledWith('Deleted recurring entry', expect.any(Function));
  });

  const amountField = (tree: ReactTestRenderer) =>
    tree.root.findAll((n) => n.props.label === 'Amount' && typeof n.props.onChangeText === 'function')[0];
  const save = async (tree: ReactTestRenderer) => {
    await act(async () => {
      await tree.root
        .findAllByType(PrimaryButton)
        .find((n) => /^(Save|Add)/.test(n.props.title))!
        .props.onPress();
    });
  };

  it('keeps what was typed when the accounts list reloads while it is open', async () => {
    const tree = await render(null);
    await act(async () => amountField(tree).props.onChangeText('450'));
    await act(async () => {
      tree.update(
        <RuleModal
          visible
          editing={null}
          accounts={[...accounts]}
          categories={categories}
          onClose={jest.fn()}
          onSaved={jest.fn()}
          onDeleted={jest.fn()}
        />
      );
    });
    expect(amountField(tree).props.value).toBe('450');
  });

  it('rejects an interval beyond the cap for its frequency, and saves one inside it', async () => {
    const tree = await render(rule);
    act(() =>
      tree.root.find((n) => n.props.value === 'setup' && n.props.onChange).props.onChange('schedule')
    );
    const interval = () =>
      tree.root.findAll(
        (n) =>
          typeof n.props.label === 'string' &&
          n.props.label.startsWith('Every how many') &&
          n.props.onChangeText
      )[0];
    await act(async () => interval().props.onChangeText('9999'));
    await save(tree);
    expect(updateRecurringRule).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Repeat interval must be between 1 and 120');
    await act(async () => interval().props.onChangeText('3'));
    await save(tree);
    expect(updateRecurringRule).toHaveBeenCalledWith('r1', expect.objectContaining({ intervalCount: 3 }));
  });
});

it.each([true, false])('confirms a status change from active=%s before writing', async (active) => {
  const dialog = require('@/components/AppDialog');
  const alert = jest.spyOn(dialog, 'showAlert').mockImplementation(() => {});
  const { setRecurringRuleActive } = require('@/db/recurring');
  setRecurringRuleActive.mockClear();
  const tree = await render({ ...rule, active });
  const disclosure = tree.root.find((n) => n.props.title === 'More options' && typeof n.type !== 'string');
  // Disclosure content mounts only when expanded.
  const button = disclosure.findAll((n) => n.props.accessibilityRole === 'button' && n.props.onPress)[0];
  if (button) act(() => button.props.onPress());
  const label = active ? 'Pause recurring entry' : 'Resume recurring entry';
  act(() => tree.root.find((n) => n.props.label === label && n.props.onPress).props.onPress());
  expect(setRecurringRuleActive).not.toHaveBeenCalled();
  const args = alert.mock.calls.at(-1) as any[];
  expect(args[1]).toContain('Unsaved edits');
  await act(async () => {
    await args[2][1].onPress();
  });
  expect(setRecurringRuleActive).toHaveBeenCalledWith('r1', !active);
  alert.mockRestore();
});

it('warns before changing an overdue confirm-first rule to automatic posting', async () => {
  const dialog = require('@/components/AppDialog');
  const alert = jest.spyOn(dialog, 'showAlert').mockImplementation(() => {});
  (updateRecurringRule as jest.Mock).mockClear();
  const tree = await render({ ...rule, postingMode: 'confirm', nextRunDate: '2020-01-01' });
  act(() => tree.root.find((n) => n.props.value === 'setup' && n.props.onChange).props.onChange('schedule'));
  act(() =>
    tree.root.find((n) => n.props.value === 'confirm' && n.props.onChange).props.onChange('automatic')
  );
  await act(async () =>
    tree.root
      .findAllByType(PrimaryButton)
      .find((n) => /^(Save|Add)/.test(n.props.title))!
      .props.onPress()
  );
  expect(updateRecurringRule).not.toHaveBeenCalled();
  expect(alert.mock.calls.at(-1)?.[0]).toMatch(/^Log \d+ past entries\?$/);
  const buttons = alert.mock.calls.at(-1)?.[2] as { onPress?: () => Promise<void> }[];
  await act(async () => {
    await buttons[1].onPress!();
  });
  expect(updateRecurringRule).toHaveBeenCalledWith(
    'r1',
    expect.objectContaining({ postingMode: 'automatic' })
  );
  alert.mockRestore();
});

it('serializes confirmed recurring saves with save, delete and pause actions', async () => {
  const alert = jest.spyOn(require('@/components/AppDialog'), 'showAlert').mockImplementation(() => {});
  let resolve!: () => void;
  (updateRecurringRule as jest.Mock)
    .mockClear()
    .mockImplementationOnce(() => new Promise<void>((r) => (resolve = r)));
  const tree = await render({ ...rule, postingMode: 'confirm', nextRunDate: '2020-01-01' });
  const { setRecurringRuleActive } = require('@/db/recurring');
  (deleteRecurringRule as jest.Mock).mockClear();
  setRecurringRuleActive.mockClear();
  const disclosure = tree.root.find((n) => n.props.title === 'More options' && typeof n.type !== 'string');
  act(() =>
    disclosure.findAll((n) => n.props.accessibilityRole === 'button' && n.props.onPress)[0].props.onPress()
  );
  const remove = tree.root.find((n) => n.props.label === 'Delete recurring entry' && n.props.onPress).props
    .onPress;
  act(() =>
    tree.root.find((n) => n.props.label === 'Pause recurring entry' && n.props.onPress).props.onPress()
  );
  const pause = (alert.mock.calls.at(-1)?.[2] as { onPress: () => void }[])[1].onPress;
  act(() => tree.root.find((n) => n.props.value === 'setup' && n.props.onChange).props.onChange('schedule'));
  act(() =>
    tree.root.find((n) => n.props.value === 'confirm' && n.props.onChange).props.onChange('automatic')
  );
  const press = tree.root.findAllByType(PrimaryButton).find((n) => /^Save/.test(n.props.title))!.props
    .onPress;
  await act(async () => press());
  const confirm = (alert.mock.calls.at(-1)?.[2] as { onPress: () => void }[])[1].onPress;
  await act(async () => {
    confirm();
    confirm();
    pause();
    await remove();
    await press();
  });
  // Even an old main-button callback and an old confirmation cannot overlap writes.
  expect(updateRecurringRule).toHaveBeenCalledTimes(1);
  expect(deleteRecurringRule).not.toHaveBeenCalled();
  expect(setRecurringRuleActive).not.toHaveBeenCalled();
  await act(async () => resolve());
  act(() => tree.unmount());
  alert.mockRestore();
});

it('opens one-off controls from Schedule and returns without losing the recurring draft', async () => {
  const { NextOccurrenceSheet } = require('./NextOccurrenceSheet');
  const { ModalSheet } = require('@/components/ModalSheet');
  const tree = await render(rule);
  act(() => tree.root.findByType(AmountField).props.onChangeText('450'));
  expect(tree.root.findAllByType(NextOccurrenceSheet)).toHaveLength(0);
  act(() => tree.root.find((n) => n.props.value === 'setup' && n.props.onChange).props.onChange('schedule'));
  const action = tree.root.findAll(
    (n) => n.props.label === 'Manage next occurrence' && typeof n.props.onPress === 'function'
  )[0];
  act(() => action.props.onPress());
  expect(tree.root.findByType(NextOccurrenceSheet).props.rule.id).toBe(rule.id);
  expect(tree.root.findAllByType(ModalSheet).map((n) => n.props.visible)).toEqual([false, true]);
  act(() => tree.root.findByType(NextOccurrenceSheet).props.onClose());
  expect(tree.root.findAllByType(NextOccurrenceSheet)).toHaveLength(0);
  act(() => tree.root.find((n) => n.props.value === 'schedule' && n.props.onChange).props.onChange('setup'));
  expect(tree.root.findByType(AmountField).props.value).toBe('450');
  act(() => tree.unmount());
});
