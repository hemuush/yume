/** The prepayment guard compares on the same whole-rupee basis the sheet displays. */
import { create, act, ReactTestRenderer } from 'react-test-renderer';
import { Text } from 'react-native';

const mockApply = jest.fn(async (..._a: unknown[]) => ({
  interestSavedMinor: 0,
  monthsShaved: 0,
  oldRemainingCount: 10,
  newRemainingCount: 10,
  oldPayoffDate: '2027-01-01',
  newPayoffDate: '2027-01-01',
}));
const mockPreview = jest.fn(async (..._a: unknown[]) => null);

jest.mock('@/db/loans', () => ({
  applyPrepayment: (...a: unknown[]) => mockApply(...a),
  previewPrepayment: (...a: unknown[]) => mockPreview(...a),
}));
jest.mock('@/lib/useReduceMotion', () => ({ useReduceMotion: () => true }));
jest.mock('@/components/ModalSheet', () => ({
  ModalSheet: ({ children, footer }: { children: unknown; footer?: unknown }) =>
    require('react').createElement(require('react').Fragment, null, children, footer),
}));
jest.mock('@/components/AmountField', () => ({
  AmountField: ({ label, onChangeText }: { label: string; onChangeText: (v: string) => void }) =>
    require('react').createElement(require('react-native').View, { testID: label, onChangeText }),
}));
jest.mock('react-native-reanimated', () => require('@/test-support/reanimatedMock').createReanimatedMock());

import { PrepayModal } from './PrepayModal';
import { PrimaryButton } from '@/components/PrimaryButton';
import type { Account, Loan } from '@/types';

const loan = (outstandingPrincipalMinor: number) =>
  ({ id: 'l1', direction: 'borrowed', outstandingPrincipalMinor }) as Loan;
const account = { id: 'a1', name: 'Main', currency: 'USD' } as Account;

const mounted: ReactTestRenderer[] = [];

async function submit(outstanding: number, typed: string) {
  let tree!: ReactTestRenderer;
  await act(async () => {
    tree = create(
      <PrepayModal
        loan={loan(outstanding)}
        account={account}
        categoryId="c1"
        onClose={jest.fn()}
        onDone={jest.fn()}
      />
    );
  });
  mounted.push(tree);
  await act(async () => tree.root.findByProps({ testID: 'Amount' }).props.onChangeText(typed));
  await act(async () => {
    await tree.root.findByType(PrimaryButton).props.onPress();
  });
  return tree;
}
const texts = (t: ReactTestRenderer) =>
  t.root.findAllByType(Text).map((n) => [].concat(n.props.children).join(''));

// Unmounting cancels the debounced preview so it can't fire after the test ends.
afterEach(() => {
  act(() => mounted.splice(0).forEach((t) => t.unmount()));
});

beforeEach(() => {
  mockApply.mockClear();
  mockPreview.mockClear();
});

describe('prepay guard', () => {
  it('accepts the balance as displayed when it rounds down', async () => {
    await submit(100_040, '1000'); // owes 1,000.40, shown as 1,000
    expect(mockApply).toHaveBeenCalledWith('l1', expect.objectContaining({ amountMinor: 100_000 }));
  });

  it('accepts the balance as displayed when it rounds up, paying off exactly what is owed', async () => {
    await submit(100_060, '1001'); // owes 1,000.60, shown as 1,001
    expect(mockApply).toHaveBeenCalledWith('l1', expect.objectContaining({ amountMinor: 100_060 }));
  });

  it('rejects more than the displayed balance with an inline error', async () => {
    const tree = await submit(100_060, '1002');
    expect(mockApply).not.toHaveBeenCalled();
    expect(texts(tree).some((t) => t.includes("Amount can't exceed the outstanding balance"))).toBe(true);
  });

  it('rejects an empty amount', async () => {
    const tree = await submit(100_000, '');
    expect(mockApply).not.toHaveBeenCalled();
    expect(texts(tree)).toContain('Enter a valid amount');
  });
});
