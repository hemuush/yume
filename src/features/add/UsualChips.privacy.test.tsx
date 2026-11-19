import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';
import { UsualChips } from './AddSections';
import { StagedList } from './components/StagedList';
import type { Staged } from './addEntry';
import type { Category } from '@/types';
import { formatMoney } from '@/lib/money';

jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: true }) }));
jest.mock('@/components/ModalSheet', () => ({ ModalSheet: () => null }));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());
jest.mock('@/theme/AccentContext', () => ({
  useAccent: () => ({ accent: '#8FCBFF', secondary: '#8FE8C8' }),
}));

it('masks sensitive usual amounts in visible text and TalkBack labels', () => {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <UsualChips
        usual={[
          {
            type: 'expense',
            accountId: 'bank',
            accountCurrency: 'INR',
            categoryId: 'private',
            categoryName: 'Investments',
            parentName: null,
            categoryIcon: 'cash',
            categoryColor: '#8FCBFF',
            amountMinor: 123400,
            note: '',
            timesLogged: 3,
            isSensitive: true,
          },
        ]}
        categoryId={null}
        accountId={null}
        amountMinor={0}
        onPick={jest.fn()}
      />
    );
  });
  const visible = tree.root
    .findAllByType(Text)
    .map((n) => [n.props.children].flat(Infinity).join(''))
    .join(' ');
  const labels = tree.root
    .findAll((n) => typeof n.props.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel)
    .join(' ');
  expect(visible).toContain('••••');
  expect(labels).toContain('••••');
  expect(visible).not.toContain(formatMoney(123400));
  expect(labels).not.toContain(formatMoney(123400));
  act(() => tree.unmount());
});

it('masks a staged private expense and its subtotal while showing the other rows', () => {
  const category: Category = {
    id: 'private',
    name: 'Investments',
    kind: 'expense',
    parentId: null,
    icon: 'cash',
    color: '#8FCBFF',
    archived: false,
    sortOrder: 0,
    isSensitive: true,
    isSystem: false,
  };
  const privateRow: Staged = {
    id: '1',
    kind: 'transaction',
    type: 'expense',
    accountId: 'bank',
    toAccountId: null,
    categoryId: category.id,
    label: category.name,
    categoryIcon: category.icon,
    categoryColor: category.color,
    amountMinor: 123400,
    date: '2026-11-18',
    note: '',
  };
  const publicRow = { ...privateRow, id: '2', label: 'Food', categoryId: 'food', amountMinor: 10000 };
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <StagedList
        rows={[privateRow, publicRow]}
        accounts={[]}
        categories={[category, { ...category, id: 'food', name: 'Food', isSensitive: false }]}
        fadeStyle={undefined}
        onRemove={jest.fn()}
      />
    );
  });
  const visible = tree.root.findAllByType(Text).map((n) => [n.props.children].flat(Infinity).join(''));
  expect(visible.filter((value) => value.includes('••••'))).toHaveLength(2);
  expect(visible.join(' ')).toContain(formatMoney(10000));
  expect(visible.join(' ')).not.toContain(formatMoney(123400));
  expect(visible.join(' ')).not.toContain(formatMoney(133400));
  act(() => tree.unmount());
});
