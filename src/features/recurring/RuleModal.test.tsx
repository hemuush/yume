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
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ accent: '#A6B4F2' }) }));
const mockShowUndo = jest.fn();
jest.mock('@/components/UndoToast', () => ({ useUndoToast: () => ({ show: mockShowUndo }) }));
jest.mock('@/db/recurring', () => ({
  ...jest.requireActual('@/db/recurring'),
  deleteRecurringRule: jest.fn(async () => ({ snapshot: true })),
}));

import { RuleModal } from './RuleModal';
import { deleteRecurringRule } from '@/db/recurring';
import { weekdayDayMonth } from '@/lib/dateLabels';

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
  it('previews the rule on its card', async () => {
    const tree = await render(rule);
    expect(texts(tree)).toEqual(expect.arrayContaining(['Every month', 'YouTube Premium']));
    expect(texts(tree).some((t) => t.includes('299'))).toBe(true);
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
});
