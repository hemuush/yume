import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { Text, StyleSheet } from 'react-native';
import { TransactionRow } from './TransactionRow';
import { theme } from '@/constants/theme';
import type { Transaction, Category } from '@/types';
jest.mock('@/components/CategoryIcon', () => ({ CategoryIcon: () => null }));
jest.mock('@/theme/AccentContext', () => ({ useAccent: () => ({ secondary: '#8FE8C8' }) }));
let mockHidden = false;
jest.mock('@/theme/PrivacyContext', () => ({ usePrivacy: () => ({ hideAmounts: mockHidden }) }));
const tx = {
  id: 't',
  type: 'expense',
  accountId: 'bank',
  categoryId: 'loan',
  amountMinor: 50000,
  date: '2026-10-11',
  note: 'Prepayment — Personal Loan',
} as Transaction;
const cat = { id: 'loan', name: 'Loan EMI', isSensitive: true } as Category;
const texts = (tree: ReactTestRenderer) =>
  tree.root.findAllByType(Text).map((n) => [n.props.children].flat(Infinity).join(''));
function render(entry = tx, onPress = jest.fn()) {
  let tree!: ReactTestRenderer;
  act(() => {
    tree = create(
      <TransactionRow
        tx={entry}
        cat={cat}
        currency="INR"
        contextCategoryId="loan"
        categoryName={() => 'Loan EMI'}
        accountName={() => 'Bank'}
        divider={false}
        onPress={onPress}
      />
    );
  });
  return tree;
}
afterEach(() => {
  mockHidden = false;
  jest.restoreAllMocks();
});
it('promotes the entry label, shows a date badge and keeps expense amounts neutral', () => {
  const open = jest.fn();
  const tree = render(tx, open);
  expect(texts(tree)).toContain('Prepayment — Personal Loan');
  expect(texts(tree)).toContain('11');
  expect(texts(tree)).toContain('OCT');
  const amount = tree.root
    .findAllByType(Text)
    .find((n) => Array.isArray(n.props.children) && n.props.children[0] === '−')!;
  expect(StyleSheet.flatten(amount.props.style).color).toBe(theme.colors.textPrimary);
  expect(StyleSheet.flatten(amount.props.style).fontFamily).toBe(theme.font.bodyBold);
  act(() =>
    tree.root.findAll((n) => n.props.accessibilityRole === 'button' && n.props.onPress)[0].props.onPress()
  );
  expect(open).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
});
it('falls back to the category when the entry label is blank', () => {
  const tree = render({ ...tx, note: '   ' });
  expect(texts(tree)).toContain('Loan EMI');
  act(() => tree.unmount());
});
it('masks sensitive amounts in both visible text and spoken entry details', () => {
  mockHidden = true;
  const tree = render();
  const labels = tree.root
    .findAll((n) => typeof n.props.accessibilityLabel === 'string')
    .map((n) => n.props.accessibilityLabel)
    .join(' ');
  expect(texts(tree).join(' ')).not.toContain('₹500');
  expect(labels).not.toContain('₹500');
  expect(labels).toContain('••••');
  act(() => tree.unmount());
});
